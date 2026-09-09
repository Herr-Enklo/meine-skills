"""Interpreter fuer Setup.inf-Skripte.

Ablauf wie bei Setup.exe:

1. Variablen aufbauen: vordefinierte Werte, [Strings:xx] (per
   UseStringSection), [Application], [Environment].
2. Fuer jede Option aus [Options] die Dateisektion ausfuehren
   ([Installer], [Product]); danach automatisch [Reg:Option],
   [Ini:Option], [Shell:Option], [Security:Option].
3. Installation: Sektionen von oben nach unten, nur Zeilen ohne ``-``.
   Deinstallation (/U): von unten nach oben, nur Zeilen mit ``-``;
   ``If``-, ``For``- und ``#``-Zeilen laufen in beiden Richtungen.
4. Sektionsaufrufe mit Flags: DONTDELETE nur bei Installation, DELETE nur
   bei Deinstallation, WINDOWS64/WINDOWS32 je nach Bitbreite, CLIENT nur
   im Benutzerteil (/AW). Eine per ``#`` aufgerufene Sektion laeuft nur
   einmal, ``#!`` erzwingt einen weiteren Durchlauf.
5. Am Ende registriert Setup.exe das Paket (Uninstall-Schluessel,
   MachineKeyName) bzw. entfernt die Registrierung wieder.

Exit beendet mit Erfolg, Abort mit Fehler, AbortReboot mit "Reboot
Pending", AbortSilent mit Fehler ohne Konsolenmeldung.
"""

from __future__ import annotations

import os
import re
import tempfile
import threading
import time
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Callable

from .backend import (Backend, SimulationBackend, parse_reg_flags, normalize_root, UNINSTALL_KEY,
                      UNINSTALL_KEY_WOW)
from .inf import InfFile, Section, split_top_level, unquote
from .script import Statement, Condition, parse_section, is_known_command, looks_like_program
from .variables import Variables, Expander, default_environment


class Status(Enum):
    SUCCESS = "Erfolg"
    FAILURE = "Fehler"
    SILENT_FAILURE = "Fehler (still)"
    REBOOT_PENDING = "Neustart ausstehend"
    STOPPED = "Abgebrochen"
    RUNNING = "Laeuft"


class ScriptExit(Exception):
    def __init__(self, status: Status, message: str = "") -> None:
        super().__init__(message)
        self.status = status
        self.message = message


class StopRequested(Exception):
    pass


@dataclass
class RunOptions:
    mode: str = "install"          # install | uninstall | reinstall
    user_part: bool = False        # /AW
    display_level: int = 1         # /S0 .. /S4
    bits: int = 64
    language: str = ""             # "07" deutsch, "09" englisch; leer = aus Setup.inf
    once_rule: bool = True
    version_compare: str = "numeric"   # numeric | string
    abort_on_unknown_command: bool = False
    call_timeout: int | None = None    # Sekunden; None = CallTimeOut aus [Application]
    apply_registration: bool = True
    emulate_installers: bool = True    # Simulation: Wirkung von Installern nachbilden
    env_overrides: dict[str, str] = field(default_factory=dict)
    log_path: str | None = None
    command_line: str = ""

    @classmethod
    def from_command_line(cls, cmd: str, **kwargs) -> "RunOptions":
        """Schalter aus ``Setup.exe "...\\Setup.inf" /S1 /U /AW`` lesen."""
        opts = cls(**kwargs)
        opts.command_line = cmd
        for tok in cmd.split():
            t = tok.strip().upper()
            if t == "/U":
                opts.mode = "uninstall"
            elif t == "/R":
                opts.mode = "reinstall"
            elif t == "/AW":
                opts.user_part = True
            elif re.fullmatch(r"/S[0-4]", t):
                opts.display_level = int(t[2])
        return opts

    def switches(self) -> str:
        parts = [f"/S{self.display_level}"]
        if self.mode == "uninstall":
            parts.append("/U")
        elif self.mode == "reinstall":
            parts.append("/R")
        if self.user_part:
            parts.append("/AW")
        return " ".join(parts)

    @property
    def uninstall(self) -> bool:
        return self.mode == "uninstall"


@dataclass
class LogEntry:
    time: datetime
    level: str
    section: str
    line: int
    text: str

    def format(self) -> str:
        where = f"[{self.section}:{self.line}]" if self.section else ""
        return f"{self.time.strftime('%d.%m.%Y %H:%M:%S')}  {self.level:<6} {where:<32} {self.text}"


@dataclass
class RunResult:
    status: Status = Status.RUNNING
    message: str = ""
    error_level: str = "0"
    reboot: str = ""
    log: list[LogEntry] = field(default_factory=list)
    actions: list = field(default_factory=list)
    variables: dict[str, str] = field(default_factory=dict)
    executed_lines: set[int] = field(default_factory=set)
    warnings: int = 0
    errors: int = 0
    duration: float = 0.0
    log_path: str = ""
    trigger: str = ""       # was den Abbruch ausgeloest hat (Zeile, Bedingung)

    def summary(self) -> str:
        parts = [f"Ergebnis: {self.status.value}"]
        if self.message:
            parts.append(self.message)
        if self.trigger:
            parts.append(self.trigger)
        parts.append(f"ErrorLevel {self.error_level}")
        if self.reboot:
            parts.append(f"Neustart: {self.reboot}")
        parts.append(f"{self.warnings} Warnungen, {self.errors} Fehler, {len(self.actions)} Aktionen, "
                     f"{self.duration:.1f} s")
        return " | ".join(parts)


class Frame:
    def __init__(self, section: Section, reason: str) -> None:
        self.section = section
        self.reason = reason


class Runner:
    """Fuehrt eine Setup.inf aus.

    ``step_hook(statement, runner)`` wird vor jeder Anweisung gerufen; der
    Editor haelt darin fuer Einzelschritt und Haltepunkte an. ``ask_hook``
    beantwortet Rueckfragen (AskKillProcesses, Prompt).
    """

    def __init__(self, inf: InfFile, backend: Backend | None = None,
                 options: RunOptions | None = None,
                 on_log: Callable[[LogEntry], None] | None = None,
                 step_hook: Callable[[Statement, "Runner"], None] | None = None,
                 ask_hook: Callable[[str, dict], str] | None = None) -> None:
        self.inf = inf
        self.backend = backend or SimulationBackend()
        self.options = options or RunOptions()
        self.on_log = on_log
        self.step_hook = step_hook
        self.ask_hook = ask_hook
        self.vars = Variables()
        self.expander = Expander(self.vars, self._reg_read, self.backend.ini_read, self._unknown_var)
        self.result = RunResult()
        self.executed: set[str] = set()
        self.stack: list[Frame] = []
        self.current_line = 0
        self.last_branch = ""        # zuletzt genommene If-Verzweigung (fuer die Abbruchmeldung)
        self.exit_line = 0
        self.stop_flag = threading.Event()
        self.reboot_requested = ""
        self._unknown_reported: set[str] = set()
        self.package_dir = os.path.dirname(inf.path) if inf.path else os.getcwd()
        self.backend.log = lambda level, text: self.log(level, text)

    # -- Protokoll ------------------------------------------------------------

    def log(self, level: str, text: str, line: int | None = None) -> None:
        section = self.stack[-1].section.name if self.stack else ""
        entry = LogEntry(datetime.now(), level, section, line or self.current_line, text)
        self.result.log.append(entry)
        if level == "WARN":
            self.result.warnings += 1
        elif level == "ERROR":
            self.result.errors += 1
        if self.on_log:
            self.on_log(entry)

    def _unknown_var(self, name: str) -> None:
        if name.lower() in self._unknown_reported:
            return
        self._unknown_reported.add(name.lower())
        self.log("WARN", f"Variable %{name}% ist nicht definiert (wird als leer behandelt)")

    def _reg_read(self, root: str, key: str, value: str) -> str:
        data = self.backend.reg_read(root, key, value)
        self.log("DEBUG", f"Registry lesen {normalize_root(root)}\\{key}\\{value} -> \"{data}\"")
        return data

    # -- Variablen ------------------------------------------------------------

    def expand(self, text: str) -> str:
        return self.expander.expand(text)

    def _setup_variables(self) -> None:
        opts = self.options
        for k, v in default_environment(opts.bits).items():
            self.vars.set(k, v)
        for k, v in opts.env_overrides.items():
            self.vars.set(k, v)
        raw: dict[str, str] = {}
        order: list[str] = []
        names: dict[str, str] = {}

        def add(section: Section | None) -> None:
            if section is None:
                return
            for key, value, _ in section.items():
                raw[key.lower()] = value
                names.setdefault(key.lower(), key)
                if key.lower() not in order:
                    order.append(key.lower())
                self.vars.set(key, value)  # vorlaeufig roh

        app = self.inf.find("Application")
        strings_name = (app.get("UseStringSection") if app else None) or "Strings:09"
        sys_name = (app.get("UseSysStringSection") if app else None) or "SysStrings:09"
        if opts.language:
            strings_name = f"Strings:{opts.language}"
            sys_name = f"SysStrings:{opts.language}"
        self.vars.set("Language", strings_name.split(":")[-1])
        add(self.inf.find(strings_name))
        add(self.inf.find(sys_name))
        add(app)
        add(self.inf.find("Environment"))
        # Paketpfade
        setup_inf_dir = (app.get("SetupInfDir") if app else None) or "Install"
        src_dir = (app.get("SrcDir") if app else None) or ".."
        src = os.path.normpath(os.path.join(self.package_dir, src_dir.replace("\\", os.sep)))
        self.vars.set("Src", _win_path(src))
        self.vars.set("SetupInfDir", setup_inf_dir)
        self.vars.set("SetupInfPath", _win_path(self.inf.path or ""))
        # Einmal expandieren, in Dateireihenfolge; Verweise auf spaetere Definitionen
        # werden bei Bedarf vorab aufgeloest.
        done: set[str] = set()

        def resolve(key: str, chain: tuple[str, ...] = ()) -> None:
            if key in done or key not in raw or key in chain:
                return
            value = raw[key]
            for ref in re.findall(r"%([A-Za-z_][A-Za-z0-9_.()\-$]*)%", value):
                if ref.lower() in raw and ref.lower() not in done:
                    resolve(ref.lower(), chain + (key,))
            self.vars.set(names.get(key, key), self.expand(value))
            done.add(key)

        if "applicationdir" in raw:
            raw.setdefault("app", raw["applicationdir"])
            names.setdefault("app", "App")
            if "app" not in order:
                order.insert(order.index("applicationdir") + 1, "app")
        for key in order:
            resolve(key)
        app_dir = self.vars.get("ApplicationDir") or ""
        self.vars.set("App", app_dir)
        # Werte, die %App% verwendet haben, jetzt nachziehen
        for key in order:
            if re.search(r"%app%", raw[key], re.IGNORECASE):
                self.vars.set(names.get(key, key), self.expand(raw[key]))
        self.vars.set("ApplicationDir", app_dir)
        self.vars.set("ErrorLevel", "0")
        for k, v in opts.env_overrides.items():
            self.vars.set(k, v)

    # -- Hauptlauf -----------------------------------------------------------

    def run(self) -> RunResult:
        start = time.time()
        opts = self.options
        try:
            self._setup_variables()
            self.log("INFO", f"Setup-Befehl: {opts.command_line or ('Setup.exe ' + (self.inf.path or '') + ' ' + opts.switches())}")
            self.log("INFO", f"Modus: {'Deinstallation' if opts.uninstall else ('Neuinstallation (/R)' if opts.mode == 'reinstall' else 'Installation')}"
                             f", {'mit' if opts.user_part else 'ohne'} Benutzerteil (/AW), {opts.bits} Bit, "
                             f"Backend: {self.backend.name}")
            self.log("INFO", f"Paket: {self.vars.get('DeveloperName')} {self.vars.get('ProductName')} "
                             f"{self.vars.get('Version')} Rev. {self.vars.get('Revision')}  (Quelle %Src% = {self.vars.get('Src')})")
            self._check_platform()
            app_dir = (self.vars.get("ApplicationDir") or "").strip()
            if app_dir and not opts.uninstall:
                # Setup.exe legt den Anwendungsordner zu Beginn an (Setup.inf wird dorthin kopiert)
                self.log("INFO", f"Anwendungsordner anlegen: {app_dir}")
                self.backend.make_dir(app_dir)
            self._run_options()
            if opts.apply_registration:
                self._registration()
            self.result.status = Status.SUCCESS
            self.result.message = self.expand(self.vars.get("EndMessage") or "") if not opts.uninstall else "Deinstallation abgeschlossen"
        except ScriptExit as exc:
            self.result.status = exc.status
            self.result.message = exc.message
            if exc.status not in (Status.SUCCESS,):
                where = f"Abbruch in Zeile {self.exit_line}" if self.exit_line else "Abbruch"
                self.result.trigger = where + (f", ausgeloest durch {self.last_branch}" if self.last_branch else "")
            if exc.status == Status.SUCCESS and opts.apply_registration:
                try:
                    self._registration()
                except ScriptExit:
                    pass
            if exc.status == Status.SILENT_FAILURE:
                self.reboot_requested = ""
        except StopRequested:
            self.result.status = Status.STOPPED
            self.result.message = "Vom Benutzer abgebrochen"
        except Exception as exc:  # Fehler im Interpreter selbst
            self.result.status = Status.FAILURE
            self.result.message = f"Interner Fehler: {exc!r}"
            self.log("ERROR", self.result.message)
        self.result.error_level = self.vars.get("ErrorLevel") or "0"
        self.result.reboot = self.reboot_requested
        self.result.actions = list(self.backend.actions)
        self.result.variables = self.vars.snapshot()
        self.result.duration = time.time() - start
        level = "INFO" if self.result.status == Status.SUCCESS else "ERROR"
        self.log(level, f"Ende: {self.result.status.value}" + (f" - {self.result.message}" if self.result.message else ""))
        if self.reboot_requested:
            self.log("INFO", f"Neustart angefordert: {self.reboot_requested}")
        self._write_log()
        return self.result

    def _check_platform(self) -> None:
        platform_ = (self.inf.value("Setup", "Platform") or "*").strip().lower()
        if platform_ in ("x64", "amd64") and self.options.bits != 64:
            raise ScriptExit(Status.FAILURE, "Paket ist fuer x64, Testumgebung ist 32 Bit (Platform=x64)")
        if platform_ in ("x86", "x86os") and self.options.bits != 32 and platform_ == "x86os":
            raise ScriptExit(Status.FAILURE, "Paket verlangt ein 32-Bit-Windows (Platform=x86os)")

    def _run_options(self) -> None:
        options_sec = self.inf.find("Options")
        names: list[str] = []
        if options_sec:
            for key, value, _ in options_sec.items():
                parts = [p.strip() for p in split_top_level(value, ",")]
                sect = parts[2] if len(parts) > 2 and parts[2] else key
                names.append(sect)
        if not names:
            names = ["Product"]
        if self.options.uninstall:
            for name in reversed(names):
                self._run_option(name)
        else:
            for name in names:
                self._run_option(name)

    def _run_option(self, name: str) -> None:
        sec = self.inf.find(name)
        aux = [f"Reg:{name}", f"Ini:{name}", f"Shell:{name}", f"Security:{name}"]
        if self.options.uninstall:
            # Deinstallation: erst die deklarativen Sektionen zuruecknehmen, dann das Skript rueckwaerts
            for a in reversed(aux):
                s = self.inf.find(a)
                if s is not None and s.key not in self.executed:
                    self.run_section(s, "automatisch (Option %s)" % name)
            if sec is not None:
                self.run_section(sec, "Option %s" % name)
            else:
                self.log("WARN", f"Sektion [{name}] aus [Options] fehlt")
        else:
            if sec is not None:
                self.run_section(sec, "Option %s" % name)
            else:
                self.log("WARN", f"Sektion [{name}] aus [Options] fehlt")
            for a in aux:
                s = self.inf.find(a)
                if s is not None and s.key not in self.executed:
                    self.run_section(s, "automatisch (Option %s)" % name)

    # -- Sektionen ------------------------------------------------------------

    def _flags_allow(self, flags: list[str], where: int) -> tuple[bool, str]:
        opts = self.options
        f = set(flags)
        if "DONTDELETE" in f and opts.uninstall:
            return False, "DONTDELETE: nur bei Installation"
        if "DELETE" in f and not opts.uninstall:
            return False, "DELETE: nur bei Deinstallation"
        if "WINDOWS64" in f and opts.bits != 64:
            return False, "WINDOWS64: nur auf 64 Bit"
        if "WINDOWS32" in f and opts.bits != 32:
            return False, "WINDOWS32: nur auf 32 Bit"
        if "CLIENT" in f and not opts.user_part:
            return False, "CLIENT: Benutzerteil, nur mit /AW"
        return True, ""

    def run_section(self, sec: Section, reason: str, flags: list[str] | None = None,
                    force: bool = False, from_call: bool = False, line: int = 0) -> None:
        flags = flags or []
        ok, why = self._flags_allow(flags, line)
        if not ok:
            self.log("DEBUG", f"[{sec.name}] uebersprungen ({why})", line)
            return
        if from_call and self.options.once_rule and not force and sec.key in self.executed:
            self.log("DEBUG", f"[{sec.name}] bereits ausgefuehrt, uebersprungen (#! erzwingt Wiederholung)", line)
            return
        if len(self.stack) > 200:
            raise ScriptExit(Status.FAILURE, f"Rekursion zu tief bei [{sec.name}]")
        self.executed.add(sec.key)
        self.stack.append(Frame(sec, reason))
        self.log("INFO", f"Sektion [{sec.name}] ({reason})", sec.header_line)
        try:
            stmts = [s for s in parse_section(sec) if s.kind != "empty"]
            order = list(reversed(stmts)) if self.options.uninstall else stmts
            for st in order:
                if self.stop_flag.is_set():
                    raise StopRequested()
                if not self._applies(st):
                    continue
                if self.step_hook:
                    self.step_hook(st, self)
                    if self.stop_flag.is_set():
                        raise StopRequested()
                self.result.executed_lines.add(st.number)
                self.current_line = st.number
                self._exec(st)
        finally:
            self.stack.pop()
            self.current_line = 0

    # Befehle, die bei der Deinstallation auch ohne "-" laufen: Variablenzuweisungen.
    # Die Vorlagen rufen [Set:Win64] am Ende von [Product] mit DELETE erneut auf,
    # damit die Set-Zeilen darin beim Rueckwaertslauf die Variablen setzen.
    _BOTH_WAYS = {"set", "replaceenv", "increment", "decrement"}

    def _applies(self, st: Statement) -> bool:
        if self.options.uninstall:
            if st.uninstall:
                return True
            if st.kind == "command":
                return st.name in self._BOTH_WAYS
            return st.kind in ("if", "for", "call", "copy", "reg", "shell", "ini")
        return not st.uninstall

    # -- Anweisungen -----------------------------------------------------------

    def _exec(self, st: Statement) -> None:
        if st.error and st.kind in ("if", "for", "call"):
            self._fail_line(st, st.error)
            return
        kind = st.kind
        if kind == "call":
            self._exec_call(st)
        elif kind == "if":
            self._exec_if(st)
        elif kind == "for":
            self._exec_for(st)
        elif kind == "copy":
            self._exec_copy(st)
        elif kind == "reg":
            self._exec_reg(st)
        elif kind == "shell":
            self._exec_shell(st)
        elif kind == "ini":
            self._exec_ini(st)
        elif kind == "command":
            self._exec_command(st)
        else:
            self.log("WARN", f"[{st.section.name}] Zeilentyp '{kind}' wird nicht simuliert: {st.text}", st.number)

    def _fail_line(self, st: Statement, why: str) -> None:
        self.log("ERROR", f"{why}: {st.text}", st.number)
        if self.options.abort_on_unknown_command:
            raise ScriptExit(Status.FAILURE, why)

    def _call_target(self, name: str, st: Statement, reason: str, flags: list[str] | None = None,
                     force: bool = False, from_call: bool = False) -> None:
        sec = self.inf.resolve(name)
        if sec is None:
            self._fail_line(st, f"Sektion [{name}] nicht gefunden")
            return
        self.run_section(sec, reason, flags, force=force, from_call=from_call, line=st.number)

    def _exec_call(self, st: Statement) -> None:
        self._call_target(st.target, st, f"Aufruf aus [{st.section.name}] Zeile {st.number}",
                          st.flags, force=st.force, from_call=True)

    def _exec_if(self, st: Statement) -> None:
        result = None
        details = []
        for i, cond in enumerate(st.conditions):
            value = self._eval_condition(cond, st)
            details.append(f"{cond} -> {'wahr' if value else 'falsch'}")
            if result is None:
                result = value
            else:
                op = st.operators[i - 1]
                result = (result or value) if op == "|" else (result and value)
        self.log("CMD", f"If {' ; '.join(details)}  =>  {'Then' if result else 'Else'}", st.number)
        target = st.then_target if result else st.else_target
        if target:
            self.last_branch = (f"If in [{st.section.name}] Zeile {st.number}: "
                                f"{' ; '.join(details)} -> \"{target}\"")
            self._call_target(target, st, f"If in [{st.section.name}] Zeile {st.number}")

    def _exec_for(self, st: Statement) -> None:
        try:
            start = int(self.expand(st.for_start).strip() or "0")
            end = int(self.expand(st.for_end).strip() or "0")
            step = int(self.expand(st.for_step).strip() or "1")
        except ValueError:
            self._fail_line(st, "For: Start, Ende und Schritt muessen Zahlen sein")
            return
        if step == 0:
            self._fail_line(st, "For: Schritt 0")
            return
        sec = self.inf.resolve(st.target)
        if sec is None:
            self._fail_line(st, f"Sektion [{st.target}] nicht gefunden")
            return
        count = 0
        i = start
        while (step > 0 and i <= end) or (step < 0 and i >= end):
            self.vars.set(st.for_var, str(i))
            self.run_section(sec, f"For {st.for_var}={i}", line=st.number)
            i += step
            count += 1
            if count > 100000:
                raise ScriptExit(Status.FAILURE, "For: Endlosschleife")
        self.log("CMD", f"For {st.for_var}: {count} Durchlaeufe von [{sec.name}]", st.number)

    def _exec_copy(self, st: Statement) -> None:
        flags = set(st.flags)
        if "SETUP" in flags:
            self.log("DEBUG", f"Kopierzeile mit SETUP-Flag (Interpreterdatei) uebersprungen: {st.src}", st.number)
            return
        if "WINDOWS64" in flags and self.options.bits != 64:
            return
        if "WINDOWS32" in flags and self.options.bits != 32:
            return
        if "CLIENT" in flags and not self.options.user_part:
            self.log("DEBUG", f"Kopierzeile mit CLIENT-Flag uebersprungen (kein /AW): {st.src}", st.number)
            return
        src = self.expand(st.src)
        if not (len(src) > 1 and (src[1] == ":" or src.startswith("\\\\"))):
            src = os.path.join(self.vars.get("Src") or "", src)
        src = _win_path(os.path.normpath(src.replace("/", "\\")) if os.name != "nt" else os.path.normpath(src))
        dst = self.expand(st.dst).strip() or (self.vars.get("ApplicationDir") or "")
        if "USEFILENAME" in flags or "DIRECTORY" in flags or not st.dst.strip() or dst.endswith("\\"):
            dst = dst.rstrip("\\") + "\\" + os.path.basename(src.replace("\\", "/"))
        if self.options.uninstall:
            if "DONTDELETE" in flags:
                self.log("CMD", f"Datei bleibt (DONTDELETE): {dst}", st.number)
                return
            self.log("CMD", f"Datei entfernen: {dst}", st.number)
            self.backend.delete_file(dst)
            return
        only_if_newer = "ALWAYS" not in flags and "COPYALWAYS" not in flags
        self.log("CMD", f"Kopieren: {src} -> {dst}" + (" (nur wenn neuer)" if only_if_newer else ""), st.number)
        ok = self.backend.copy_file(src, dst, only_if_newer=only_if_newer)
        if not ok:
            if "OPTIONAL" in flags:
                self.log("DEBUG", f"Quelle fehlt, OPTIONAL: {src}", st.number)
            else:
                self.log("ERROR", f"Quelldatei nicht gefunden: {src}", st.number)

    def _exec_reg(self, st: Statement) -> None:
        if st.error:
            self._fail_line(st, st.error)
            return
        key = self.expand(st.key)
        value = self.expand(st.value)
        data = self.expand(st.data)
        root = normalize_root(st.root)
        on_uninstall_section = st.section.base.lower().startswith("onuninstall")
        if st.delete:
            if st.value:
                self.log("CMD", f"Registry Wert loeschen {root}\\{key}\\{value}", st.number)
                self.backend.reg_delete_value(root, key, value)
            else:
                self.log("CMD", f"Registry Schluessel loeschen {root}\\{key}", st.number)
                self.backend.reg_delete_key(root, key)
            return
        if self.options.uninstall and not on_uninstall_section:
            # Bei Deinstallation werden geschriebene Werte wieder entfernt
            self.log("CMD", f"Registry zuruecknehmen {root}\\{key}\\{value}", st.number)
            if st.value:
                self.backend.reg_delete_value(root, key, value)
            return
        if root == "HKCU" and not self.options.user_part and "CLIENT" not in [f.upper() for f in _frame_flags(self)]:
            self.log("WARN", f"HKCU-Eintrag ausserhalb des Benutzerteils: {key} (wird als SYSTEM geschrieben)", st.number)
        flags = parse_reg_flags(st.reg_flags)
        self.log("CMD", f"Registry schreiben {root}\\{key}\\{value or '(Standard)'} = {data}", st.number)
        self.backend.reg_write(root, key, value, flags, data)

    def _exec_shell(self, st: Statement) -> None:
        if st.error:
            self._fail_line(st, st.error)
            return
        f = [self.expand(x) for x in st.fields] + [""] * 9
        link, target, args, workdir, desc, icon, idx = f[0], f[1], f[2], f[3], f[4], f[5], f[6]
        try:
            icon_index = int(idx.strip() or "0")
        except ValueError:
            icon_index = 0
        if self.options.uninstall:
            self.log("CMD", f"Verknuepfung entfernen: {link}", st.number)
            self.backend.delete_shortcut(link)
            return
        self.log("CMD", f"Verknuepfung anlegen: {link} -> {target} {args}".rstrip(), st.number)
        if target and not self.backend.file_exists(target):
            create_unresolvable = (self.inf.value("Application", "CreateUnresolvableShellLinks") or "1") == "1"
            self.log("WARN" if create_unresolvable else "ERROR",
                     f"Ziel der Verknuepfung existiert nicht: {target}", st.number)
            if not create_unresolvable:
                return
        self.backend.create_shortcut(link, target, args, workdir, desc, icon, icon_index)

    def _exec_ini(self, st: Statement) -> None:
        f = [self.expand(x) for x in st.fields] + [""] * 4
        self.log("CMD", f"INI schreiben {f[0]} [{f[1]}] {f[2]}={f[3]}", st.number)
        self.backend.record("INI", "schreiben", f"{f[0]} [{f[1]}] {f[2]}", f[3])

    # -- Befehle --------------------------------------------------------------

    def _exec_command(self, st: Statement) -> None:
        name = st.name
        args = st.args
        handler = getattr(self, "cmd_" + name, None)
        if handler is not None:
            handler(st, args)
            return
        if is_known_command(name):
            self.log("WARN", f"Befehl '{name}' wird nicht simuliert: {st.text}", st.number)
            return
        # Programmaufruf ohne Call
        if not looks_like_program(name):
            self.log("WARN", f"Unbekannter Befehl '{st.text.split()[0]}', wird als Programmaufruf behandelt", st.number)
            if self.options.abort_on_unknown_command:
                raise ScriptExit(Status.FAILURE, f"Unbekannter Befehl: {name}")
        self._run_program(st, st.text, hidden=False)

    def _run_program(self, st: Statement, cmdline: str, hidden: bool, wait: bool = True) -> None:
        cmd = self.expand(cmdline).strip()
        timeout = self.options.call_timeout
        if timeout is None:
            try:
                timeout = int(self.inf.value("Application", "CallTimeOut") or "0") or None
            except ValueError:
                timeout = None
        self.log("CMD", f"{'CallHidden' if hidden else 'Call'}: {cmd}", st.number)
        exe = cmd.split('"')[1] if cmd.startswith('"') else cmd.split()[0] if cmd else ""
        if exe and ("\\" in exe or exe.lower().endswith((".exe", ".msi", ".cmd", ".bat"))) and not self.backend.file_exists(exe):
            self.log("WARN", f"Programmdatei nicht gefunden: {exe}", st.number)
        before = len(self.backend.actions)
        code = self.backend.run(cmd, hidden=hidden, timeout=timeout, wait=wait)
        really = any(a.executed for a in self.backend.actions[before:])
        if not really and not self.backend.executes and self.options.emulate_installers:
            self._emulate_installer(cmd, code, st)
        if code == -1:
            self.log("ERROR", f"Zeitueberschreitung nach {timeout} s: {cmd}", st.number)
            if (self.inf.value("Application", "AbortAfterCallTimeOut") or "0") == "1":
                raise ScriptExit(Status.FAILURE, "CallTimeOut ueberschritten")
        self.vars.set("ErrorLevel", str(code))
        self.log("INFO", f"ErrorLevel = {code}", st.number)

    # Simulation: Wirkung eines Installers nachbilden, damit die Pruefungen der
    # Vorlagen (GetUninstallKeyName nach der Installation, Uninstall-Schluessel
    # nach der Deinstallation) so ausfallen wie am echten Rechner.
    _UNINSTALL_HINTS = ("uninst", "/x ", "/x{", "remove", "helper.exe")

    def _emulate_installer(self, cmd: str, code: int, st: Statement) -> None:
        if code not in (0, 3010, 1641):
            return
        low = cmd.lower()
        is_msi = "msiexec" in low
        display = ""
        for name in ("V_MSIDisplayName", "V_UnattendDisplayName", "V_DisplayName", "ProductName"):
            display = (self.vars.get(name) or "").strip()
            if display:
                break
        arch = (self.vars.get("V_Arch") or "").strip().lower()
        base = UNINSTALL_KEY_WOW if arch in ("x86", "32") or "\\wow6432node\\" in low else UNINSTALL_KEY
        uninstall = is_msi and (" /x" in low or "/uninstall" in low) or \
            (not is_msi and any(h in low for h in self._UNINSTALL_HINTS))
        if uninstall:
            removed = []
            for keybase in (UNINSTALL_KEY, UNINSTALL_KEY_WOW):
                for sub in self.backend.reg_subkeys("HKLM", keybase):
                    full = keybase + "\\" + sub
                    if self.backend.reg_read("HKLM", full, "SimulatedBy") != "PackagingCenter":
                        continue
                    name = self.backend.reg_read("HKLM", full, "DisplayName")
                    ustr = self.backend.reg_read("HKLM", full, "UninstallString").lower().strip('"')
                    loc = self.backend.reg_read("HKLM", full, "InstallLocation")
                    if (display and name.lower() == display.lower()) or sub.lower() in low or \
                            (ustr and ustr.split(" /x")[0] in low) or (loc and loc.lower() in low):
                        self.backend.reg_delete_key("HKLM", full)
                        if loc:
                            self.backend.delete_tree(loc)
                        removed.append(sub)
            if removed:
                self.log("INFO", f"Simulation: Deinstallation nachgebildet, Uninstall-Schluessel entfernt: {', '.join(removed)}", st.number)
            return
        if not (is_msi and " /i" in low or not is_msi and (".exe" in low or ".msi" in low)):
            return
        if not display:
            return
        if self.backend.find_uninstall_key(display, arch):
            return
        import hashlib
        digest = hashlib.md5(display.lower().encode("utf-8")).hexdigest().upper()
        keyname = f"{{{digest[:8]}-5349-4D55-4C41-{digest[8:20]}}}"
        key = base + "\\" + keyname
        version = self.vars.get("Version") or ""
        # Angenommener Installationsordner samt ueblicher Deinstallationsprogramme, damit
        # DoesFileExist(%UninstallString%) und aehnliche Pruefungen der Vorlagen aufgehen.
        pf = self.vars.get("ProgramFilesDirx86" if arch in ("x86", "32") else "ProgramFilesDir") or "C:\\Program Files"
        location = pf + "\\" + re.sub(r'[<>:"/\\|?*]', "", self.vars.get("ProductName") or display).strip()
        uninstall_string = f"MsiExec.exe /X{keyname}" if is_msi else f'"{location}\\uninstall.exe"'
        for name, data in (("DisplayName", display), ("DisplayVersion", version),
                           ("Publisher", self.vars.get("DeveloperName") or ""),
                           ("UninstallString", uninstall_string), ("InstallLocation", location),
                           ("SimulatedBy", "PackagingCenter")):
            if data:
                self.backend.reg_write("HKLM", key, name, 0, data)
        sim_files = getattr(self.backend, "files_created", None)
        if sim_files is not None:
            for rel in ("uninstall.exe", "unins000.exe", "uninstall\\helper.exe"):
                sim_files[os.path.normpath(location + "\\" + rel).lower()] = "(simulierter Installer)"
            getattr(self.backend, "dirs_created", set()).add(os.path.normpath(location).lower())
        self.log("INFO", f"Simulation: Installation nachgebildet, Uninstall-Schluessel angelegt: {keyname} "
                         f"(DisplayName \"{display}\", DisplayVersion \"{version}\", InstallLocation {location})", st.number)

    def cmd_call(self, st, args):
        self._run_program(st, args, hidden=False)

    def cmd_callhidden(self, st, args):
        self._run_program(st, args, hidden=True)

    def cmd_callasync(self, st, args):
        self._run_program(st, args, hidden=False, wait=False)

    def cmd_msiexec(self, st, args):
        self._run_program(st, st.text, hidden=False)

    def cmd_echo(self, st, args):
        self.log("ECHO", self.expand(args), st.number)

    def cmd_log(self, st, args):
        self.log("ECHO", self.expand(args), st.number)

    def cmd_sleep(self, st, args):
        try:
            ms = int(self.expand(args).strip() or "0")
        except ValueError:
            ms = 0
        self.log("CMD", f"Sleep {ms} ms", st.number)
        self.backend.sleep(ms)

    def cmd_addmeter(self, st, args):
        self.log("DEBUG", f"AddMeter {args.strip()}", st.number)

    def cmd_errorlogmsg(self, st, args):
        self.log("ERROR", "ErrorLogMsg: " + self.expand(args), st.number)
        self.backend.record("Fehlerprotokoll", "melden", self.expand(args))

    def cmd_exit(self, st, args):
        msg = self.expand(args)
        self.exit_line = st.number
        self.log("INFO", "Exit " + msg, st.number)
        raise ScriptExit(Status.SUCCESS, msg)

    def cmd_abort(self, st, args):
        msg = self.expand(args)
        self.exit_line = st.number
        self.log("ERROR", "Abort " + msg, st.number)
        raise ScriptExit(Status.FAILURE, msg)

    def cmd_abortsilent(self, st, args):
        msg = self.expand(args)
        self.exit_line = st.number
        self.log("ERROR", "AbortSilent " + msg, st.number)
        raise ScriptExit(Status.SILENT_FAILURE, msg)

    def cmd_abortreboot(self, st, args):
        msg = self.expand(args)
        self.exit_line = st.number
        self.log("ERROR", "AbortReboot " + msg, st.number)
        self.reboot_requested = self.reboot_requested or "AbortReboot"
        raise ScriptExit(Status.REBOOT_PENDING, msg)

    def cmd_set(self, st, args):
        name, sep, value = args.partition("=")
        if not sep:
            self._fail_line(st, "Set ohne '='")
            return
        name = name.strip()
        value = value.strip()
        m = re.match(r"^([A-Za-z_]\w*)\s*\((.*)\)\s*$", value)
        if m and m.group(1).lower() in _FUNCTIONS:
            result = self._call_function(m.group(1), m.group(2), st)
        else:
            result = self.expand(value)
        self.vars.set(name, result)
        self.log("CMD", f"Set {name} = \"{result}\"", st.number)

    def cmd_replaceenv(self, st, args):
        name = args.strip().strip("%")
        old = self.vars.get(name)
        if old is None:
            self.log("WARN", f"ReplaceEnv: Variable {name} ist nicht definiert", st.number)
            return
        new = self.expand(old)
        self.vars.set(name, new)
        self.log("CMD", f"ReplaceEnv {name} = \"{new}\"", st.number)

    def _incdec(self, st, args, sign):
        parts = [p.strip() for p in split_top_level(args, ",")]
        name = parts[0].strip().strip("%") if parts else ""
        try:
            delta = int(self.expand(parts[1]).strip()) if len(parts) > 1 else 1
            current = int((self.vars.get(name) or "0").strip() or "0")
        except ValueError:
            self._fail_line(st, "Increment/Decrement: kein Zahlenwert")
            return
        self.vars.set(name, str(current + sign * delta))
        self.log("CMD", f"{name} = {current + sign * delta}", st.number)

    def cmd_increment(self, st, args):
        self._incdec(st, args, 1)

    def cmd_decrement(self, st, args):
        self._incdec(st, args, -1)

    def cmd_setreboot(self, st, args):
        val = self.expand(args).strip() or "1"
        self.reboot_requested = f"SetReboot {val}"
        self.log("INFO", f"Neustart angefordert (SetReboot {val})", st.number)
        self.backend.record("System", "Neustart anfordern", f"SetReboot {val}")

    def cmd_systemshutdown(self, st, args):
        parts = [unquote(self.expand(p)) for p in split_top_level(args, ",")] + [""] * 5
        reboot = parts[1].strip() in ("1", "true")
        force = parts[2].strip() in ("1", "true")
        try:
            seconds = int(parts[3].strip() or "0")
        except ValueError:
            seconds = 0
        self.reboot_requested = "SystemShutdown"
        self.log("WARN", f"SystemShutdown: {'Neustart' if reboot else 'Herunterfahren'} in {seconds} s "
                         f"(im Testlauf unterdrueckt)", st.number)
        fn = getattr(self.backend, "system_shutdown", None)
        if fn:
            fn(reboot, force, seconds)
        else:
            self.backend.record("System", "Neustart" if reboot else "Herunterfahren", f"in {seconds} s")

    def cmd_killprocess(self, st, args):
        parts = [unquote(self.expand(p)) for p in split_top_level(args, ",")]
        name = parts[0].strip() if parts else ""
        self.log("CMD", f"KillProcess {name}", st.number)
        self.backend.kill_process(name)

    def cmd_askkillprocesses(self, st, args):
        parts = [p.strip() for p in split_top_level(self.expand(args), ",")]
        timeout = parts[0] if parts else "0"
        procs = self.inf.find("Processes")
        for pid in parts[1:]:
            entry = procs.get(pid) if procs else None
            if entry is None:
                self.log("ERROR", f"AskKillProcesses: Eintrag '{pid}' fehlt in [Processes]", st.number)
                continue
            fields = [unquote(self.expand(x)) for x in split_top_level(entry, ",")] + ["", "", ""]
            exe, title, flags = fields[0].strip(), fields[1].strip(), fields[2].upper().split()
            running = self.backend.process_exists(exe)
            self.log("CMD", f"AskKillProcesses {exe} ('{title}', {timeout} s, {' '.join(flags)}): "
                            f"{'laeuft' if running else 'laeuft nicht'}", st.number)
            if not running:
                continue
            answer = "timeout"
            if self.ask_hook:
                answer = self.ask_hook("askkill", {"process": exe, "title": title, "timeout": timeout,
                                                   "flags": flags})
            if answer == "kill" or (answer == "timeout" and "KILLPROCESS" in flags):
                self.backend.kill_process(exe)
            elif answer == "abort" or (answer == "timeout" and "ABORT" in flags):
                raise ScriptExit(Status.FAILURE, f"Prozess {exe} laeuft noch (AskKillProcesses ABORT)")

    def cmd_waituntilprocessexists(self, st, args):
        self.log("CMD", f"WaitUntilProcessExists {self.expand(args)} (im Testlauf nicht gewartet)", st.number)

    def cmd_waitwhileprocessexists(self, st, args):
        self.log("CMD", f"WaitWhileProcessExists {self.expand(args)} (im Testlauf nicht gewartet)", st.number)

    def cmd_copy(self, st, args):
        parts = [unquote(self.expand(p)) for p in split_top_level(args, ",")]
        if len(parts) < 2:
            self._fail_line(st, "Copy braucht Quelle und Ziel")
            return
        self.log("CMD", f"Copy {parts[0]} -> {parts[1]}", st.number)
        if not self.backend.copy_file(parts[0].strip(), parts[1].strip()):
            self.log("WARN", f"Quelle nicht gefunden: {parts[0]}", st.number)

    def cmd_del(self, st, args):
        path = unquote(self.expand(args))
        self.log("CMD", f"Del {path}", st.number)
        self.backend.delete_file(path)

    cmd_delete = cmd_del

    def cmd_deltree(self, st, args):
        path = unquote(self.expand(args))
        if not path.strip() or path.strip() in ("\\", "C:\\", "C:"):
            self._fail_line(st, f"DelTree mit gefaehrlichem Pfad '{path}' verweigert")
            return
        self.log("CMD", f"DelTree {path}", st.number)
        self.backend.delete_tree(path)

    def cmd_mkdir(self, st, args):
        path = unquote(self.expand(args))
        self.log("CMD", f"MkDir {path}", st.number)
        self.backend.make_dir(path)

    def cmd_rmdir(self, st, args):
        path = unquote(self.expand(args))
        self.log("CMD", f"RmDir {path}", st.number)
        self.backend.remove_dir(path)

    def cmd_rename(self, st, args):
        parts = [unquote(self.expand(p)) for p in split_top_level(args, ",")]
        if len(parts) < 2:
            self._fail_line(st, "Rename braucht alten und neuen Namen")
            return
        self.log("CMD", f"Rename {parts[0]} -> {parts[1]}", st.number)
        self.backend.rename(parts[0], parts[1])

    def cmd_prompt(self, st, args):
        name = args.strip()
        answer = ""
        if self.ask_hook:
            prompts = self.inf.find("Prompts")
            answer = self.ask_hook("prompt", {"variable": name,
                                              "definition": prompts.get(name) if prompts else ""})
        self.vars.set(name, answer)
        self.log("CMD", f"Prompt {name} = \"{answer}\"", st.number)

    def cmd_startservice(self, st, args):
        self.log("CMD", f"StartService {args}", st.number)
        self.backend.service_control(self.expand(args).strip(), "start")

    def cmd_stopservice(self, st, args):
        self.log("CMD", f"StopService {args}", st.number)
        self.backend.service_control(self.expand(args).strip(), "stop")

    def cmd_reboot(self, st, args):
        self.cmd_setreboot(st, args)

    # -- Bedingungen und Funktionen ------------------------------------------

    def _eval_condition(self, cond: Condition, st: Statement) -> bool:
        lhs = self._eval_operand(cond.lhs, st)
        rhs = self._eval_operand(cond.rhs, st)
        return compare(lhs, cond.op, rhs, self.options.version_compare, self._compare_warning(st))

    def _compare_warning(self, st: Statement):
        def warn(text: str) -> None:
            self.log("WARN", text, st.number)
        return warn

    def _eval_operand(self, text: str, st: Statement) -> str:
        t = text.strip()
        m = re.match(r"^([A-Za-z_]\w*)\s*\((.*)\)\s*$", t)
        if m and m.group(1).lower() in _FUNCTIONS:
            return self._call_function(m.group(1), m.group(2), st)
        return unquote(self.expand(t))

    def _call_function(self, name: str, argtext: str, st: Statement) -> str:
        fn = _FUNCTIONS[name.lower()]
        raw_args = [a.strip() for a in split_top_level(argtext, ",")] if argtext.strip() else []
        try:
            result = fn(self, raw_args, st)
        except Exception as exc:
            self.log("ERROR", f"{name}({argtext}) fehlgeschlagen: {exc}", st.number)
            result = ""
        self.log("DEBUG", f"{name}({argtext}) -> \"{result}\"", st.number)
        return result

    def _arg(self, raw: str) -> str:
        return unquote(self.expand(raw))

    # -- Registrierung ---------------------------------------------------------

    def _registration(self) -> None:
        app = self.inf.find("Application")
        if app is None:
            return
        uninstall_key = self.expand(app.get("UninstallKeyName") or "")
        machine_key = self.expand(app.get("MachineKeyName") or "")
        user_key = self.expand(app.get("UserKeyName") or "")
        if self.options.uninstall:
            if uninstall_key:
                self.log("INFO", f"Registrierung entfernen: HKLM\\{UNINSTALL_KEY}\\{uninstall_key}")
                self.backend.reg_delete_key("HKLM", f"{UNINSTALL_KEY}\\{uninstall_key}")
            if machine_key:
                self.backend.reg_delete_key("HKLM", f"SOFTWARE\\{machine_key}")
            if user_key and self.options.user_part:
                self.backend.reg_delete_key("HKCU", f"SOFTWARE\\{user_key}")
            return
        if uninstall_key:
            key = f"{UNINSTALL_KEY}\\{uninstall_key}"
            self.log("INFO", f"Paket registrieren: HKLM\\{key}")
            values = {
                "DisplayName": self.expand(app.get("UninstallDisplayName") or uninstall_key),
                "DisplayVersion": self.expand(app.get("Version") or ""),
                "Publisher": self.expand(app.get("DeveloperName") or ""),
                "UninstallString": self.expand(app.get("UninstallString") or ""),
                "DisplayIcon": self.expand(app.get("UninstallDisplayIcon") or ""),
                "InstallDate": datetime.now().strftime("%Y%m%d"),
                "SetupInfPath": self.vars.get("SetupInfPath") or "",
            }
            for k, v in values.items():
                if v:
                    self.backend.reg_write("HKLM", key, k, 0, v)
            opts = (app.get("UninstallOptions") or "").upper().split()
            for flag, name in (("NOREMOVE", "NoRemove"), ("NOMODIFY", "NoModify"), ("NOREPAIR", "NoRepair")):
                if flag in opts:
                    self.backend.reg_write("HKLM", key, name, 0x00010001, "1")
        if machine_key:
            key = f"SOFTWARE\\{machine_key}"
            self.log("INFO", f"Maschinenteil vermerken: HKLM\\{key}")
            self.backend.reg_write("HKLM", key, "Version", 0, self.expand(app.get("Version") or ""))
            self.backend.reg_write("HKLM", key, "Revision", 0, self.expand(app.get("Revision") or ""))
        if user_key and self.options.user_part:
            key = f"SOFTWARE\\{user_key}"
            self.log("INFO", f"Benutzerteil vermerken: HKCU\\{key}")
            self.backend.reg_write("HKCU", key, "Version", 0, self.expand(app.get("Version") or ""))

    # -- Protokolldatei ---------------------------------------------------------

    def _write_log(self) -> None:
        path = self.options.log_path
        if path is None:
            base = self.vars.get("Temp") or tempfile.gettempdir()
            if os.name != "nt":
                base = tempfile.gettempdir()
            folder = os.path.join(base, "PackagingCenter")
            name = f"{self.vars.get('DeveloperName') or 'Paket'}.{self.vars.get('ProductName') or ''}." \
                   f"{self.vars.get('Version') or ''}.{self.options.mode}.log"
            name = re.sub(r'[<>:"/\\|?*]', "_", name)
            path = os.path.join(folder, name)
        try:
            os.makedirs(os.path.dirname(path), exist_ok=True)
            with open(path, "w", encoding="utf-8") as fh:
                for e in self.result.log:
                    fh.write(e.format() + "\n")
                fh.write("\n" + self.result.summary() + "\n")
                if self.result.actions:
                    fh.write("\nAktionen:\n")
                    for a in self.result.actions:
                        fh.write("  " + str(a) + "\n")
            self.result.log_path = path
        except OSError as exc:
            self.log("WARN", f"Protokoll konnte nicht geschrieben werden: {exc}")


# -- Vergleiche -----------------------------------------------------------------

_VERSION_RE = re.compile(r"^\d+(\.\d+)*$")


def compare(lhs: str, op: str, rhs: str, mode: str = "numeric",
            warn: Callable[[str], None] | None = None) -> bool:
    a, b = lhs.strip(), rhs.strip()
    numeric = _VERSION_RE.match(a) and _VERSION_RE.match(b)
    if numeric:
        ta = tuple(int(x) for x in a.split("."))
        tb = tuple(int(x) for x in b.split("."))
        n = max(len(ta), len(tb))
        ta += (0,) * (n - len(ta))
        tb += (0,) * (n - len(tb))
        num_result = _apply(ta, op, tb)
        str_result = _apply(a.lower(), op, b.lower())
        if warn and num_result != str_result:
            warn(f"Vergleich \"{a}\" {op} \"{b}\" faellt je nach Vergleichsmodus verschieden aus "
                 f"(numerisch: {num_result}, Zeichenkette: {str_result}); aktiv: {mode}")
        return num_result if mode == "numeric" else str_result
    return _apply(a.lower(), op, b.lower())


def _apply(a, op, b) -> bool:
    if op == "==":
        return a == b
    if op in ("!=", "<>"):
        return a != b
    if op == ">=":
        return a >= b
    if op == "<=":
        return a <= b
    if op == ">":
        return a > b
    if op == "<":
        return a < b
    return False


# -- Funktionen -----------------------------------------------------------------

def _fn_doesregkeyexist(r: Runner, args, st) -> str:
    spec = r._arg(args[0]) if args else ""
    parts = [unquote(p) for p in split_top_level(spec, ",")]
    if len(parts) < 2:
        # Auch DoesRegKeyExist("HKLM", "Key", "Wert") zulassen
        parts = [r._arg(a) for a in args]
    root = parts[0].strip() if parts else "HKLM"
    key = parts[1].strip() if len(parts) > 1 else ""
    value = parts[2].strip() if len(parts) > 2 else None
    return "1" if r.backend.reg_key_exists(root, key, value) else "0"


def _fn_doesfileexist(r: Runner, args, st) -> str:
    return "1" if args and r.backend.file_exists(r._arg(args[0])) else "0"


def _fn_doespathexist(r: Runner, args, st) -> str:
    return "1" if args and r.backend.dir_exists(r._arg(args[0])) else "0"


def _fn_doestextinfileexist(r: Runner, args, st) -> str:
    if len(args) < 2:
        return "0"
    return "1" if r.backend.text_in_file(r._arg(args[0]), r._arg(args[1])) else "0"


def _fn_getuninstallkeyname(r: Runner, args, st) -> str:
    name = r._arg(args[0]) if args else ""
    arch = r._arg(args[1]) if len(args) > 1 else ""
    return r.backend.find_uninstall_key(name, arch)


def _fn_tokenize(r: Runner, args, st) -> str:
    if not args:
        return "0"
    name = args[0].strip().strip("%")
    sep = r._arg(args[1]) if len(args) > 1 else ","
    value = r.vars.get(name)
    if value is None:
        value = r._arg(args[0])
        name = re.sub(r"\W", "_", name)
    tokens = [t.strip() for t in value.split(sep)] if value else []
    for i, tok in enumerate(tokens, start=1):
        r.vars.set(f"{name}{i}", tok)
    return str(len(tokens))


def _fn_len(r: Runner, args, st) -> str:
    return str(len(r._arg(args[0]))) if args else "0"


def _fn_removefromleft(r: Runner, args, st) -> str:
    text = r._arg(args[0]) if args else ""
    n = int(r._arg(args[1]) or "0") if len(args) > 1 else 0
    return text[n:]


def _fn_removefromright(r: Runner, args, st) -> str:
    text = r._arg(args[0]) if args else ""
    n = int(r._arg(args[1]) or "0") if len(args) > 1 else 0
    return text[:-n] if n else text


def _fn_left(r: Runner, args, st) -> str:
    text = r._arg(args[0]) if args else ""
    n = int(r._arg(args[1]) or "0") if len(args) > 1 else 0
    return text[:n]


def _fn_right(r: Runner, args, st) -> str:
    text = r._arg(args[0]) if args else ""
    n = int(r._arg(args[1]) or "0") if len(args) > 1 else 0
    return text[-n:] if n else ""


def _fn_mid(r: Runner, args, st) -> str:
    text = r._arg(args[0]) if args else ""
    start = int(r._arg(args[1]) or "1") if len(args) > 1 else 1
    n = int(r._arg(args[2]) or "0") if len(args) > 2 else len(text)
    return text[start - 1:start - 1 + n]


def _fn_uppercase(r: Runner, args, st) -> str:
    return r._arg(args[0]).upper() if args else ""


def _fn_lowercase(r: Runner, args, st) -> str:
    return r._arg(args[0]).lower() if args else ""


def _fn_trim(r: Runner, args, st) -> str:
    return r._arg(args[0]).strip() if args else ""


def _fn_replace(r: Runner, args, st) -> str:
    if len(args) < 3:
        return r._arg(args[0]) if args else ""
    return r._arg(args[0]).replace(r._arg(args[1]), r._arg(args[2]))


def _fn_readxmltext(r: Runner, args, st) -> str:
    if len(args) < 2:
        return ""
    return r.backend.read_xml(r._arg(args[0]), r._arg(args[1]))


def _fn_getfileversion(r: Runner, args, st) -> str:
    return r.backend.file_version(r._arg(args[0])) if args else ""


def _fn_isprocessrunning(r: Runner, args, st) -> str:
    return "1" if args and r.backend.process_exists(r._arg(args[0])) else "0"


_FUNCTIONS = {
    "doesregkeyexist": _fn_doesregkeyexist,
    "doesfileexist": _fn_doesfileexist,
    "doespathexist": _fn_doespathexist,
    "doesdirexist": _fn_doespathexist,
    "doestextinfileexist": _fn_doestextinfileexist,
    "getuninstallkeyname": _fn_getuninstallkeyname,
    "tokenize": _fn_tokenize,
    "len": _fn_len,
    "removefromleft": _fn_removefromleft,
    "removefromright": _fn_removefromright,
    "left": _fn_left,
    "right": _fn_right,
    "mid": _fn_mid,
    "uppercase": _fn_uppercase,
    "lowercase": _fn_lowercase,
    "trim": _fn_trim,
    "replace": _fn_replace,
    "readxmltext": _fn_readxmltext,
    "getfileversion": _fn_getfileversion,
    "isprocessrunning": _fn_isprocessrunning,
}


def _frame_flags(runner: Runner) -> list[str]:
    return []


def _win_path(path: str) -> str:
    """Pfad in Windows-Schreibweise (Backslashes) fuer %Src% und Co."""
    if os.name == "nt":
        return path
    return path.replace("/", "\\")
