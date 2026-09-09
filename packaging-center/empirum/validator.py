"""Paketpruefung: statische Kontrolle einer Setup.inf.

Findet die typischen Fehler vor dem ersten Testlauf: fehlende Sektionen,
falsch geschriebene If-Zeilen, nicht definierte Variablen, vergessene
ReplaceEnv-Aufrufe, Kopierzeilen auf fehlende Dateien, doppelte Sektionen,
Registryzeilen mit falschem Aufbau.
"""

from __future__ import annotations

import os
import re
from dataclasses import dataclass

from .commands import BUILTIN_VARIABLES, SECTION_FLAGS, COPY_FLAGS, FUNCTIONS
from .inf import InfFile, Section, split_top_level
from .script import parse_section, Statement, is_known_command, looks_like_program
from .variables import default_environment

_VAR_RE = re.compile(r"%([A-Za-z_][A-Za-z0-9_.()\-$]*)%")
_FUNC_RE = re.compile(r"^([A-Za-z_]\w*)\s*\((.*)\)\s*$")


@dataclass
class Finding:
    level: str      # "Fehler", "Warnung", "Hinweis"
    line: int
    section: str
    text: str

    def __str__(self) -> str:
        where = f"Zeile {self.line}" if self.line else "Datei"
        sec = f" [{self.section}]" if self.section else ""
        return f"{self.level:<8} {where:>10}{sec}: {self.text}"


class _Check:
    def __init__(self, inf: InfFile) -> None:
        self.inf = inf
        self.findings: list[Finding] = []
        self.defined: set[str] = set(v.lower() for v in BUILTIN_VARIABLES)
        self.defined.update(k.lower() for k in default_environment())
        self.defined.update({"src", "app", "applicationdir", "setupinfdir", "setupinfpath", "errorlevel",
                             "language", "disk1"})
        self.deferred: set[str] = set()    # Variablen mit %%-Aufschub
        self.replaced: set[str] = set()    # ReplaceEnv-Ziele
        self.referenced_sections: dict[str, list[int]] = {}
        self.section_names: dict[str, str] = {}
        self.package_dir = os.path.dirname(inf.path) if inf.path else ""

    def add(self, level: str, line: int, section: str, text: str) -> None:
        self.findings.append(Finding(level, line, section, text))

    # -- Aufbau ------------------------------------------------------------

    def run(self) -> list[Finding]:
        self.check_structure()
        self.collect_definitions()
        for sec in self.inf.sections:
            if sec.is_script or sec.is_declarative:
                self.check_section(sec)
        self.check_references()
        self.check_deferred()
        self.findings.sort(key=lambda f: ({"Fehler": 0, "Warnung": 1, "Hinweis": 2}[f.level], f.line))
        return self.findings

    def check_structure(self) -> None:
        inf = self.inf
        seen: dict[str, int] = {}
        for sec in inf.sections:
            if sec.key in seen:
                self.add("Warnung", sec.header_line, sec.name,
                         f"Sektion kommt mehrfach vor (zuerst Zeile {seen[sec.key]}); Setup.exe nimmt die erste")
            else:
                seen[sec.key] = sec.header_line
        for required in ("Setup", "Application", "Product"):
            if inf.find(required) is None:
                self.add("Fehler", 0, "", f"Pflichtsektion [{required}] fehlt")
        app = inf.find("Application")
        if app:
            for key in ("ProductName", "DeveloperName", "Version"):
                if not (app.get(key) or "").strip():
                    self.add("Fehler", app.header_line, app.name, f"[Application] {key} ist leer")
            for key in ("UninstallKeyName", "MachineKeyName", "ApplicationDir", "SrcDir"):
                if app.get(key) is None:
                    self.add("Warnung", app.header_line, app.name, f"[Application] {key} fehlt")
            for key in ("UseStringSection", "UseSysStringSection"):
                target = app.get(key)
                if target and inf.find(target) is None:
                    self.add("Fehler", app.header_line, app.name, f"{key}={target}: Sektion [{target}] fehlt")
            reboot = app.get("Reboot")
            if reboot is not None and reboot.strip() not in ("0", "1", "2", "3", "4", "5"):
                self.add("Warnung", app.header_line, app.name, f"Reboot={reboot}: erwartet 0 bis 5")
            for key in ("ProductName", "DeveloperName", "Version"):
                val = app.get(key) or ""
                if any(c in val for c in '\\/:*?"<>|'):
                    self.add("Warnung", app.header_line, app.name,
                             f"{key} enthaelt Zeichen, die in Pfaden nicht erlaubt sind: {val}")
        setup = inf.find("Setup")
        if setup:
            platform_ = (setup.get("Platform") or "").strip().lower()
            if platform_ and platform_ not in ("*", "x86", "x86os", "x64"):
                self.add("Warnung", setup.header_line, setup.name,
                         f"Platform={platform_}: bekannt sind *, x86, x86os, x64")
            if not setup.get("Version"):
                self.add("Warnung", setup.header_line, setup.name, "[Setup] Version fehlt (Setup-Engine-Version)")
        options = inf.find("Options")
        if options:
            for key, value, ln in options.items():
                parts = [p.strip() for p in split_top_level(value, ",")]
                sect = parts[2] if len(parts) > 2 and parts[2] else key
                if inf.find(sect) is None:
                    self.add("Fehler", ln.number, options.name, f"Option '{key}' verweist auf fehlende Sektion [{sect}]")
        for sec in inf.sections:
            if not sec.content_lines() and sec.is_script and sec.key not in ("requirements",):
                self.add("Hinweis", sec.header_line, sec.name, "Sektion ist leer")
        # VarDefInfo
        vardef = inf.find("VarDefInfo")
        if vardef:
            for ln in vardef.content_lines():
                parts = [p.strip() for p in ln.text.split(",")]
                if len(parts) < 3:
                    self.add("Warnung", ln.number, vardef.name,
                             "VarDefInfo-Zeile braucht <Variable>, <0=Computer|1=User>, <0|1 NULL erlaubt>")
                else:
                    self.defined.add(("VM_" + parts[0]).lower())
                    self.defined.add(("VU_" + parts[0]).lower())
                    self.defined.add(parts[0].lower())
        # Liegt die Setup.inf im Ordner, den SetupInfDir nennt?
        if app and inf.path:
            wanted = (app.get("SetupInfDir") or "Install").strip().strip("\\")
            actual = os.path.basename(os.path.dirname(inf.path))
            if wanted and actual.lower() != wanted.lower():
                self.add("Hinweis", app.header_line, app.name,
                         f"Setup.inf liegt im Ordner '{actual}', SetupInfDir sagt '{wanted}'; "
                         f"Kopierzeilen mit %SetupInfDir% zeigen dann ins Leere")
        # Kodierung
        if inf.encoding not in ("cp1252", "utf-8"):
            self.add("Hinweis", 0, "", f"Ungewoehnliche Kodierung: {inf.encoding}")
        if inf.newline != "\r\n":
            self.add("Hinweis", 0, "", "Zeilenenden sind LF; Empirum-Pakete verwenden ueblicherweise CRLF")

    def collect_definitions(self) -> None:
        for name in ("Application", "Environment"):
            sec = self.inf.find(name)
            if sec:
                for key, value, ln in sec.items():
                    self.defined.add(key.lower())
                    if "%%" in value:
                        self.deferred.add(key.lower())
        for sec in self.inf.sections:
            if sec.is_strings:
                for key, _, _ in sec.items():
                    self.defined.add(key.lower())
        for sec in self.inf.sections:
            if sec.is_script:
                for st in parse_section(sec):
                    if st.kind == "command" and st.name == "set":
                        name = st.args.partition("=")[0].strip()
                        self.defined.add(name.lower())
                        # Tokenize erzeugt Name1..NameN
                        m = re.search(r"tokenize\s*\(\s*%?(\w+)%?", st.args, re.IGNORECASE)
                        if m:
                            self.defined.add(m.group(1).lower() + "#")
                        if "%%" in st.args:
                            self.deferred.add(name.lower())
                    elif st.kind == "command" and st.name == "replaceenv":
                        self.replaced.add(st.args.strip().strip("%").lower())
                    elif st.kind == "for":
                        self.defined.add(st.for_var.lower())
                    elif st.kind == "command" and st.name == "prompt":
                        self.defined.add(st.args.strip().lower())

    # -- Sektionen ---------------------------------------------------------

    def check_section(self, sec: Section) -> None:
        for st in parse_section(sec):
            if st.kind == "empty":
                continue
            if st.error:
                self.add("Fehler", st.number, sec.name, st.error)
            if st.kind == "call":
                self.ref(st.target, st.number)
                for f in st.flags:
                    if f not in SECTION_FLAGS:
                        self.add("Warnung", st.number, sec.name, f"Unbekanntes Sektions-Flag {f}")
                if "DONTDELETE" in st.flags and "DELETE" in st.flags:
                    self.add("Fehler", st.number, sec.name, "DONTDELETE und DELETE zusammen ergeben keinen Sinn")
            elif st.kind == "if":
                self.ref(st.then_target, st.number)
                if st.else_target:
                    self.ref(st.else_target, st.number)
                for cond in st.conditions:
                    for side in (cond.lhs, cond.rhs):
                        self.check_operand(side, st)
                if st.uninstall:
                    self.add("Hinweis", st.number, sec.name,
                             "If mit '-' laeuft nur bei Deinstallation; ohne '-' liefe es in beide Richtungen")
            elif st.kind == "for":
                self.ref(st.target, st.number)
                self.check_vars(st.for_start + st.for_end + st.for_step, st)
            elif st.kind == "copy":
                self.check_copy(st)
            elif st.kind == "reg":
                self.check_reg(st)
            elif st.kind == "shell":
                self.check_vars(" ".join(st.fields), st)
                if st.fields and not st.fields[0].strip():
                    self.add("Fehler", st.number, sec.name, "Verknuepfung ohne Pfad")
            elif st.kind == "command":
                self.check_command(st)
            if sec.prefix == "reg" and st.kind not in ("reg", "call"):
                self.add("Fehler", st.number, sec.name, "In [Reg:...]-Sektionen sind nur Registryzeilen erlaubt")

    def check_command(self, st: Statement) -> None:
        sec = st.section
        name = st.name
        self.check_vars(st.args, st)
        if name == "set":
            var, sep, value = st.args.partition("=")
            if not sep:
                self.add("Fehler", st.number, sec.name, "Set ohne '='")
                return
            m = _FUNC_RE.match(value.strip())
            if m and m.group(1).lower() not in {k.lower() for k in FUNCTIONS}:
                self.add("Warnung", st.number, sec.name, f"Unbekannte Funktion {m.group(1)}()")
        elif name == "replaceenv":
            target = st.args.strip().strip("%").lower()
            if target and target not in self.defined:
                self.add("Warnung", st.number, sec.name, f"ReplaceEnv auf nicht definierte Variable {st.args.strip()}")
        elif name in ("abort", "abortsilent", "abortreboot", "exit"):
            pass
        elif name == "askkillprocesses":
            procs = self.inf.find("Processes")
            parts = [p.strip() for p in split_top_level(st.args, ",")]
            for pid in parts[1:]:
                if procs is None or procs.get(pid) is None:
                    self.add("Fehler", st.number, sec.name, f"AskKillProcesses: '{pid}' fehlt in [Processes]")
        elif name in ("deltree",):
            path = st.args.strip().strip('"')
            if not path or path.count("\\") < 1 and "%" not in path:
                self.add("Warnung", st.number, sec.name, f"DelTree mit sehr kurzem Pfad: {path}")
        elif name in ("call", "callhidden", "callasync"):
            if not st.args.strip():
                self.add("Fehler", st.number, sec.name, f"{name} ohne Programm")
        elif name in ("increment", "decrement"):
            if "," not in st.args:
                self.add("Warnung", st.number, sec.name, f"{name} erwartet (Variable, Zahl)")
        elif not is_known_command(name):
            first = st.text.split()[0]
            if not looks_like_program(first):
                self.add("Warnung", st.number, sec.name,
                         f"Unbekannter Befehl '{first}'; Setup.exe versucht, ihn als Programm zu starten")

    def check_operand(self, text: str, st: Statement) -> None:
        t = text.strip()
        m = _FUNC_RE.match(t)
        if m:
            fname = m.group(1)
            if fname.lower() not in {k.lower() for k in FUNCTIONS}:
                self.add("Warnung", st.number, st.section.name, f"Unbekannte Funktion {fname}()")
            self.check_vars(m.group(2), st)
            if fname.lower() == "doesregkeyexist":
                inner = m.group(2).strip().strip('"')
                if not re.match(r"^(HKLM|HKCU|HKCR|HKU|HKEY_)", inner, re.IGNORECASE):
                    self.add("Fehler", st.number, st.section.name,
                             'DoesRegKeyExist erwartet "HKLM,Schluessel[,Wert]"')
                if "wow6432node\\wow6432node" in inner.lower():
                    self.add("Warnung", st.number, st.section.name,
                             "Pfad enthaelt WOW6432Node zweimal; die Abfrage ist immer falsch")
            return
        self.check_vars(t, st)
        if t and not t.startswith('"') and "%" not in t and not t.isdigit() and t.lower() not in ("true", "false"):
            self.add("Hinweis", st.number, st.section.name, f"Vergleichswert ohne Anfuehrungszeichen: {t}")

    def check_vars(self, text: str, st: Statement) -> None:
        for name in _VAR_RE.findall(text):
            low = name.lower()
            if low in self.defined:
                continue
            base = re.sub(r"\d+$", "", low)
            if base != low and base + "#" in self.defined:      # Tokenize-Ergebnis NameN
                continue
            if low.startswith(("vm_", "vu_")):
                self.add("Hinweis", st.number, st.section.name,
                         f"%{name}% kommt aus den Empirum-Variablen (VarDefInfo/Environment); in der Testumgebung setzen")
                self.defined.add(low)
                continue
            self.add("Warnung", st.number, st.section.name, f"Variable %{name}% ist nirgends definiert")
            self.defined.add(low)

    def check_copy(self, st: Statement) -> None:
        sec = st.section
        for f in st.flags:
            if f not in COPY_FLAGS:
                self.add("Warnung", st.number, sec.name, f"Unbekanntes Kopier-Flag {f}")
        self.check_vars(st.src + " " + st.dst, st)
        disks = self.inf.find("Disks")
        if disks and disks.get(st.disk) is None:
            self.add("Warnung", st.number, sec.name, f"Disk {st.disk} ist in [Disks] nicht definiert")
        if "SETUP" in st.flags or not self.package_dir:
            return
        src = st.src
        if "%" in src:
            app = self.inf.find("Application")
            src = src.replace("%SetupInfDir%", (app.get("SetupInfDir") if app else None) or "Install")
            src = src.replace("%Src%", "").replace("%SRC%", "").replace("%src%", "").lstrip("\\")
            if "%" in src:
                return
        app = self.inf.find("Application")
        src_root = os.path.normpath(os.path.join(self.package_dir, ((app.get("SrcDir") if app else None) or "..").replace("\\", os.sep)))
        path = os.path.join(src_root, src.replace("\\", os.sep))
        if not os.path.exists(path):
            level = "Hinweis" if "OPTIONAL" in st.flags else "Warnung"
            self.add(level, st.number, sec.name, f"Kopierquelle nicht gefunden: {path}")

    def check_reg(self, st: Statement) -> None:
        sec = st.section
        if st.error:
            return
        if st.root not in ("HKLM", "HKCU", "HKCR", "HKU", "HKCC", "HKEY_LOCAL_MACHINE",
                           "HKEY_CURRENT_USER", "HKEY_CLASSES_ROOT", "HKEY_USERS"):
            self.add("Fehler", st.number, sec.name, f"Unbekannte Registry-Wurzel {st.root}")
        self.check_vars(st.key + " " + st.value + " " + st.data, st)
        if not st.delete:
            if st.value and not st.reg_flags:
                self.add("Warnung", st.number, sec.name, "Registryzeile ohne Typ (z. B. 0x00000000 fuer REG_SZ)")
            if st.reg_flags and not re.match(r"^0x[0-9A-Fa-f]{8}$", st.reg_flags.strip()):
                self.add("Warnung", st.number, sec.name, f"Ungewoehnlicher Registry-Typ {st.reg_flags}")
            if st.reg_flags.strip().lower() == "0x00010001" and st.data and not re.match(r"^(0x[0-9a-f]+|\d+|%[^%]+%)$", st.data.strip(), re.IGNORECASE):
                self.add("Fehler", st.number, sec.name, f"REG_DWORD mit nicht numerischem Wert: {st.data}")
        if "wow6432node\\wow6432node" in st.key.lower():
            self.add("Warnung", st.number, sec.name, "Pfad enthaelt WOW6432Node zweimal")

    # -- Verweise ----------------------------------------------------------

    def ref(self, target: str, line: int) -> None:
        if not target:
            return
        self.referenced_sections.setdefault(target.lower(), []).append(line)
        self.section_names.setdefault(target.lower(), target)

    def check_references(self) -> None:
        for target, lines in self.referenced_sections.items():
            if self.inf.resolve(target) is None:
                for line in lines:
                    sec = self.inf.section_of_line(line)
                    self.add("Fehler", line, sec.name if sec else "",
                             f"Sektion [{self.section_names.get(target, target)}] wird aufgerufen, existiert aber nicht")
        # nie aufgerufene Skript-Sektionen
        options = self.inf.find("Options")
        auto = {"product", "installer"}
        if options:
            for key, value, _ in options.items():
                parts = [p.strip() for p in split_top_level(value, ",")]
                sect = (parts[2] if len(parts) > 2 and parts[2] else key).lower()
                auto.add(sect)
                for p in ("reg:", "ini:", "shell:", "security:"):
                    auto.add(p + sect)
        for sec in self.inf.sections:
            if not (sec.is_script or sec.is_declarative) or sec.key in auto:
                continue
            base = sec.base.lower()
            if sec.key in self.referenced_sections or base in self.referenced_sections:
                continue
            if sec.prefix == "" and (base in self.referenced_sections or ("set:" + base) in self.referenced_sections):
                continue
            if not sec.content_lines():
                continue
            self.add("Hinweis", sec.header_line, sec.name, "Sektion wird nirgends aufgerufen")

    def check_deferred(self) -> None:
        for name in sorted(self.deferred):
            if name not in self.replaced:
                self.add("Warnung", 0, "",
                         f"Variable {name} nutzt %%...%% (aufgeschobene Ersetzung), aber es gibt kein ReplaceEnv {name}")


def validate(inf: InfFile) -> list[Finding]:
    return _Check(inf).run()
