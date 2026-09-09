"""Dialoge des Package Editors und des Packaging Centers."""

from __future__ import annotations

import json
import os
import platform
import tkinter as tk
from tkinter import ttk, messagebox, simpledialog, scrolledtext

from empirum.commands import COMMANDS, FUNCTIONS
from empirum.runner import RunOptions
from empirum.variables import default_environment

SETTINGS_PATH = os.path.join(os.path.expanduser("~"), ".packaging-center.json")


def load_settings() -> dict:
    try:
        with open(SETTINGS_PATH, "r", encoding="utf-8") as fh:
            return json.load(fh)
    except (OSError, ValueError):
        return {}


def save_settings(data: dict) -> None:
    try:
        with open(SETTINGS_PATH, "w", encoding="utf-8") as fh:
            json.dump({k: v for k, v in data.items() if not k.startswith("_")}, fh, indent=2, ensure_ascii=False)
    except OSError:
        pass


class DebugStartDialog(simpledialog.Dialog):
    """Fragt vor DEBUG/EINZELSCHRITT nach dem Setup-Befehl und der Art des Laufs.

    Das Original fragt an dieser Stelle nach der Kommandozeile von Setup.exe;
    /U schaltet auf Deinstallation, /AW auf den Benutzerteil, /S0..4 setzt
    die Anzeigestufe."""

    def __init__(self, parent, inf_path: str, settings: dict, single_step: bool):
        self.inf_path = inf_path
        self.settings = settings
        self.single_step = single_step
        self.result_options: RunOptions | None = None
        self.simulate = True
        self.ask_exit_codes = False
        self.default_exit_code = 0
        super().__init__(parent, "Setup-Befehl fuer den Testlauf")

    def body(self, master):
        pad = {"padx": 6, "pady": 3}
        ttk.Label(master, text="Setup-Befehl (wie Setup.exe ihn erhaelt):").grid(row=0, column=0, sticky="w", **pad)
        last = self.settings.get("last_command_switches", "/S1")
        self.cmd_var = tk.StringVar(value=f'Setup.exe "{self.inf_path}" {last}')
        entry = ttk.Entry(master, textvariable=self.cmd_var, width=90)
        entry.grid(row=1, column=0, columnspan=3, sticky="ew", **pad)

        sw = ttk.Frame(master)
        sw.grid(row=2, column=0, columnspan=3, sticky="w", **pad)
        ttk.Label(sw, text="Schalter:").pack(side="left")
        for label, switch in (("Installation", ""), ("/U Deinstallation", "/U"), ("/R Neuinstallation", "/R"),
                              ("/AW Benutzerteil", "/AW")):
            ttk.Button(sw, text=label, command=lambda s=switch: self._toggle(s)).pack(side="left", padx=2)
        self.level_var = tk.StringVar(value="1")
        ttk.Label(sw, text="  Anzeige /S").pack(side="left")
        ttk.Combobox(sw, textvariable=self.level_var, values=("0", "1", "2", "3", "4"), width=3,
                     state="readonly").pack(side="left")
        self.level_var.trace_add("write", lambda *a: self._set_level())

        mode = ttk.LabelFrame(master, text="Art des Laufs")
        mode.grid(row=3, column=0, columnspan=3, sticky="ew", **pad)
        is_windows = platform.system() == "Windows"
        self.mode_var = tk.StringVar(value=self.settings.get("run_mode", "real" if is_windows else "sim"))
        real = ttk.Radiobutton(mode, text="Echter Testlauf (Standard): Programme, Registry, Dateien und "
                                     "Verknuepfungen genau wie Setup.exe; die Deinstallation nimmt alles zurueck "
                                     "(nur Windows, als Administrator starten)", variable=self.mode_var,
                               value="real")
        real.pack(anchor="w", padx=6, pady=2)
        ttk.Radiobutton(mode, text="Simulation (Trockenlauf): nichts wird veraendert, Programme werden nicht "
                              "gestartet, Registry und Dateien werden nur gelesen", variable=self.mode_var,
                        value="sim").pack(anchor="w", padx=6, pady=2)
        if not is_windows:
            real.state(["disabled"])
            self.mode_var.set("sim")

        opt = ttk.LabelFrame(master, text="Nur fuer die Simulation")
        opt.grid(row=4, column=0, columnspan=3, sticky="ew", **pad)
        self.ask_var = tk.BooleanVar(value=self.settings.get("ask_exit_codes", True))
        ttk.Checkbutton(opt, text="Rueckgabewert jedes Programmaufrufs abfragen (0, 3010, 1603 ...)",
                        variable=self.ask_var).pack(anchor="w", padx=6, pady=2)
        row = ttk.Frame(opt)
        row.pack(anchor="w", padx=6, pady=2)
        ttk.Label(row, text="Sonst angenommener Rueckgabewert:").pack(side="left")
        self.code_var = tk.StringVar(value=str(self.settings.get("default_exit_code", 0)))
        ttk.Entry(row, textvariable=self.code_var, width=8).pack(side="left", padx=4)
        self.exec_var = tk.BooleanVar(value=self.settings.get("execute_programs", False))
        ttk.Checkbutton(opt, text="Mischmodus: Programmaufrufe wirklich starten (Call, CallHidden, MsiExec), "
                             "Registry-, Datei- und Verknuepfungszeilen des Skripts bleiben simuliert",
                        variable=self.exec_var).pack(anchor="w", padx=6, pady=2)
        self.real_reg_var = tk.BooleanVar(value=self.settings.get("read_real_registry", True))
        ttk.Checkbutton(opt, text="Registry und Dateien des Testrechners lesen (sonst nur die Annahmen aus der Testumgebung)",
                        variable=self.real_reg_var).pack(anchor="w", padx=6, pady=2)

        more = ttk.LabelFrame(master, text="Interpreter")
        more.grid(row=5, column=0, columnspan=3, sticky="ew", **pad)
        self.bits_var = tk.StringVar(value=str(self.settings.get("bits", 64)))
        r = ttk.Frame(more)
        r.pack(anchor="w", padx=6, pady=2)
        ttk.Label(r, text="Windows:").pack(side="left")
        ttk.Radiobutton(r, text="64 Bit", variable=self.bits_var, value="64").pack(side="left", padx=4)
        ttk.Radiobutton(r, text="32 Bit", variable=self.bits_var, value="32").pack(side="left", padx=4)
        ttk.Label(r, text="   Vergleiche:").pack(side="left")
        self.cmp_var = tk.StringVar(value=self.settings.get("version_compare", "numeric"))
        ttk.Radiobutton(r, text="numerisch (1.10 > 1.9)", variable=self.cmp_var, value="numeric").pack(side="left", padx=4)
        ttk.Radiobutton(r, text="Zeichenkette", variable=self.cmp_var, value="string").pack(side="left", padx=4)
        self.once_var = tk.BooleanVar(value=self.settings.get("once_rule", True))
        ttk.Checkbutton(more, text="#Sektion laeuft nur einmal (#! erzwingt Wiederholung)",
                        variable=self.once_var).pack(anchor="w", padx=6, pady=2)
        self.reg_var = tk.BooleanVar(value=self.settings.get("apply_registration", True))
        ttk.Checkbutton(more, text="Paket am Ende registrieren (Uninstall-Schluessel, MachineKeyName) wie Setup.exe",
                        variable=self.reg_var).pack(anchor="w", padx=6, pady=2)
        ttk.Label(master, text=("Einzelschritt: haelt vor jeder Zeile an." if self.single_step
                                else "Debug: laeuft bis zum naechsten Haltepunkt (F9) oder bis zum Ende."),
                  foreground="#555").grid(row=6, column=0, columnspan=3, sticky="w", **pad)
        return entry

    def _toggle(self, switch: str) -> None:
        cmd = self.cmd_var.get()
        parts = cmd.split()
        base = [p for p in parts if p.upper() not in ("/U", "/R")] if switch in ("", "/U", "/R") else parts
        if switch == "/AW":
            if "/AW" in [p.upper() for p in parts]:
                base = [p for p in parts if p.upper() != "/AW"]
            else:
                base = parts + ["/AW"]
        elif switch:
            base = base + [switch]
        self.cmd_var.set(" ".join(base))

    def _set_level(self) -> None:
        parts = [p for p in self.cmd_var.get().split() if not p.upper().startswith("/S") or len(p) != 3]
        self.cmd_var.set(" ".join(parts + [f"/S{self.level_var.get()}"]))

    def validate(self):
        try:
            self.default_exit_code = int(self.code_var.get().strip() or "0")
        except ValueError:
            messagebox.showerror("Eingabe", "Der Rueckgabewert muss eine Zahl sein.", parent=self)
            return False
        return True

    def apply(self):
        cmd = self.cmd_var.get()
        opts = RunOptions.from_command_line(cmd, bits=int(self.bits_var.get()),
                                            version_compare=self.cmp_var.get(),
                                            once_rule=self.once_var.get(),
                                            apply_registration=self.reg_var.get())
        opts.command_line = cmd
        self.result_options = opts
        self.simulate = self.mode_var.get() == "sim"
        self.ask_exit_codes = self.ask_var.get()
        self.execute_programs = self.exec_var.get()
        self.read_real_registry = self.real_reg_var.get()
        switches = " ".join(p for p in cmd.split() if p.startswith("/"))
        self.settings.update({
            "last_command_switches": switches, "run_mode": self.mode_var.get(),
            "ask_exit_codes": self.ask_exit_codes, "default_exit_code": self.default_exit_code,
            "bits": int(self.bits_var.get()), "version_compare": self.cmp_var.get(),
            "once_rule": self.once_var.get(), "apply_registration": self.reg_var.get(),
            "read_real_registry": self.read_real_registry, "execute_programs": self.execute_programs,
        })


class EnvironmentDialog(simpledialog.Dialog):
    """Testumgebung: vordefinierte Variablen und Empirum-Variablen (VM_/VU_) setzen.

    Ersetzt fuer den lokalen Test die Werte, die sonst der Empirum-Server
    ueber Values$ liefert."""

    def __init__(self, parent, settings: dict, suggested: list[str] | None = None):
        self.settings = settings
        self.suggested = suggested or []
        super().__init__(parent, "Testumgebung")

    def body(self, master):
        ttk.Label(master, text="Variable = Wert, eine je Zeile. Ueberschreibt vordefinierte Variablen "
                               "(ComputerName, EmpirumServer, ProgramFilesDir ...) und liefert Werte fuer "
                               "Empirum-Variablen (VM_..., VU_...).", wraplength=560, justify="left").pack(anchor="w", padx=6, pady=4)
        self.text = scrolledtext.ScrolledText(master, width=80, height=18, font=("Consolas", 10))
        self.text.pack(fill="both", expand=True, padx=6, pady=4)
        current = self.settings.get("env_overrides", {})
        lines = [f"{k}={v}" for k, v in current.items()]
        for name in self.suggested:
            if name not in current:
                lines.append(f"{name}=")
        self.text.insert("1.0", "\n".join(lines))
        row = ttk.Frame(master)
        row.pack(fill="x", padx=6)
        ttk.Button(row, text="Vordefinierte Werte einfuegen", command=self._insert_defaults).pack(side="left")
        ttk.Button(row, text="Leeren", command=lambda: self.text.delete("1.0", "end")).pack(side="left", padx=4)
        return self.text

    def _insert_defaults(self):
        existing = self.text.get("1.0", "end")
        for k, v in default_environment().items():
            if f"{k}=" not in existing:
                self.text.insert("end", f"\n{k}={v}")

    def apply(self):
        values = {}
        for raw in self.text.get("1.0", "end").splitlines():
            if "=" in raw and not raw.strip().startswith(";"):
                k, _, v = raw.partition("=")
                if k.strip():
                    values[k.strip()] = v.strip()
        self.settings["env_overrides"] = values


class RegistryAssumptionsDialog(simpledialog.Dialog):
    """Registry-Annahmen fuer die Simulation, in Setup.inf-Schreibweise.

    Beispiel: HKLM,"SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\{GUID}","DisplayName",0x00000000,"Demo"
    Damit laesst sich ein Rechner nachstellen, auf dem eine Vorversion
    installiert ist, ohne die Registry anzufassen."""

    def __init__(self, parent, settings: dict):
        self.settings = settings
        super().__init__(parent, "Registry-Annahmen fuer die Simulation")

    def body(self, master):
        ttk.Label(master, text="Eine Registryzeile je Zeile (Setup.inf-Schreibweise). Werden vor dem "
                               "Lauf in die simulierte Registry geschrieben; -HKLM,... loescht.",
                  wraplength=600, justify="left").pack(anchor="w", padx=6, pady=4)
        self.text = scrolledtext.ScrolledText(master, width=90, height=14, font=("Consolas", 10))
        self.text.pack(fill="both", expand=True, padx=6, pady=4)
        self.text.insert("1.0", "\n".join(self.settings.get("registry_assumptions", [])))
        ttk.Button(master, text="Beispiel: installierte Vorversion einfuegen", command=self._example).pack(anchor="w", padx=6)
        return self.text

    def _example(self):
        key = "SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\{00000000-0000-0000-0000-000000000001}"
        self.text.insert("end", f'\nHKLM,"{key}","DisplayName",0x00000000,"Demo App"'
                                f'\nHKLM,"{key}","DisplayVersion",0x00000000,"1.0.0"'
                                f'\nHKLM,"{key}","UninstallString",0x00000000,"C:\\Program Files\\Demo\\unins.exe"')

    def apply(self):
        self.settings["registry_assumptions"] = [ln for ln in self.text.get("1.0", "end").splitlines() if ln.strip()]


class ExitCodeDialog(simpledialog.Dialog):
    """Fragt in der Simulation den Rueckgabewert eines Programmaufrufs ab."""

    CHOICES = [("0  Erfolg", 0), ("3010  Neustart noetig", 3010), ("1641  Neustart eingeleitet", 1641),
               ("1603  Schwerer Fehler", 1603), ("1602  Abgebrochen", 1602), ("1605  Nicht installiert", 1605),
               ("1  Fehler", 1), ("2  Datei nicht gefunden", 2), ("5  Zugriff verweigert", 5)]

    def __init__(self, parent, cmdline: str, hidden: bool, default: int):
        self.cmdline = cmdline
        self.hidden = hidden
        self.default = default
        self.code: int | str | None = None
        super().__init__(parent, "Programmaufruf (Simulation)")

    def body(self, master):
        ttk.Label(master, text="Rueckgabewert annehmen (Aufruf wird nicht gestartet) oder das Programm jetzt "
                               "wirklich starten und den echten Rueckgabewert verwenden?").pack(anchor="w", padx=6, pady=4)
        box = tk.Text(master, height=4, width=90, wrap="word", font=("Consolas", 9))
        box.insert("1.0", ("[versteckt] " if self.hidden else "") + self.cmdline)
        box.configure(state="disabled")
        box.pack(fill="x", padx=6)
        self.var = tk.StringVar(value=str(self.default))
        grid = ttk.Frame(master)
        grid.pack(fill="x", padx=6, pady=6)
        for i, (label, code) in enumerate(self.CHOICES):
            ttk.Radiobutton(grid, text=label, variable=self.var, value=str(code)).grid(row=i // 3, column=i % 3, sticky="w", padx=4, pady=2)
        row = ttk.Frame(master)
        row.pack(anchor="w", padx=6)
        ttk.Label(row, text="Anderer Wert:").pack(side="left")
        entry = ttk.Entry(row, textvariable=self.var, width=8)
        entry.pack(side="left", padx=4)
        return entry

    def buttonbox(self):
        box = ttk.Frame(self)
        ttk.Button(box, text="Wert annehmen", command=self.ok, default="active").pack(side="left", padx=4, pady=6)
        ttk.Button(box, text="Wirklich ausfuehren", command=self._execute).pack(side="left", padx=4, pady=6)
        ttk.Button(box, text="Abbrechen", command=self.cancel).pack(side="left", padx=4, pady=6)
        self.bind("<Return>", self.ok)
        self.bind("<Escape>", self.cancel)
        box.pack()

    def _execute(self):
        self.code = "execute"
        self.destroy()

    def validate(self):
        try:
            self.code = int(self.var.get().strip())
            return True
        except ValueError:
            messagebox.showerror("Eingabe", "Bitte eine Zahl eingeben.", parent=self)
            return False


class AskKillDialog(simpledialog.Dialog):
    """Nachbildung des Dialogs von AskKillProcesses."""

    def __init__(self, parent, payload: dict):
        self.payload = payload
        self.answer = "timeout"
        super().__init__(parent, "Programm beenden")

    def body(self, master):
        p = self.payload
        ttk.Label(master, text=f"Der Prozess {p['process']} laeuft ({p.get('title') or p['process']}).\n"
                               f"Nach {p.get('timeout')} s wuerde Setup.exe: {' '.join(p.get('flags') or []) or 'weiter machen'}",
                  justify="left").pack(anchor="w", padx=8, pady=8)
        return None

    def buttonbox(self):
        box = ttk.Frame(self)
        for label, value in (("Beenden (KillProcess)", "kill"), ("Weiter (CONTINUE)", "continue"),
                             ("Abbrechen (ABORT)", "abort"), ("Zeit abgelaufen", "timeout")):
            ttk.Button(box, text=label, command=lambda v=value: self._choose(v)).pack(side="left", padx=4, pady=6)
        box.pack()

    def _choose(self, value: str) -> None:
        self.answer = value
        self.destroy()


class ReferenceWindow(tk.Toplevel):
    """Befehlsreferenz (Hilfe des Package Editors)."""

    def __init__(self, parent):
        super().__init__(parent)
        self.title("Befehlsreferenz Setup.inf")
        self.geometry("900x600")
        paned = ttk.PanedWindow(self, orient="horizontal")
        paned.pack(fill="both", expand=True)
        left = ttk.Frame(paned)
        self.tree = ttk.Treeview(left, show="tree", selectmode="browse")
        self.tree.pack(fill="both", expand=True)
        paned.add(left, weight=1)
        self.text = scrolledtext.ScrolledText(paned, wrap="word", font=("Segoe UI", 10))
        paned.add(self.text, weight=3)
        groups: dict[str, str] = {}
        for c in COMMANDS:
            if c.group not in groups:
                groups[c.group] = self.tree.insert("", "end", text=c.group, open=True)
            self.tree.insert(groups[c.group], "end", text=c.name, values=("cmd", c.name))
        fgroup = self.tree.insert("", "end", text="Funktionen", open=True)
        for f in FUNCTIONS:
            self.tree.insert(fgroup, "end", text=f, values=("fn", f))
        self.tree.bind("<<TreeviewSelect>>", self._show)
        self.text.insert("1.0", "Befehl links auswaehlen.\n\nDie Beschreibungen stammen aus den Empirum-Vorlagen, "
                                "den Beispielpaketen und der oeffentlichen Dokumentation. Wo das Original "
                                "mehr kann, steht es in der Hilfe von Setup.exe (SetupDeu.chm).")

    def _show(self, event=None):
        sel = self.tree.selection()
        if not sel:
            return
        values = self.tree.item(sel[0], "values")
        self.text.delete("1.0", "end")
        if not values:
            return
        kind, name = values
        if kind == "cmd":
            for c in COMMANDS:
                if c.name == name:
                    self.text.insert("end", f"{c.name}\n\n", ("h",))
                    self.text.insert("end", f"Syntax:\n  {c.syntax}\n\n{c.description}\n")
        else:
            self.text.insert("end", f"{name}\n\n", ("h",))
            self.text.insert("end", FUNCTIONS[name])
        self.text.tag_configure("h", font=("Segoe UI", 13, "bold"))


class FindDialog(simpledialog.Dialog):
    def __init__(self, parent, initial: str = ""):
        self.initial = initial
        self.pattern = ""
        self.replace: str | None = None
        self.replace_all = False
        super().__init__(parent, "Suchen und Ersetzen")

    def body(self, master):
        ttk.Label(master, text="Suchen nach:").grid(row=0, column=0, sticky="w", padx=4, pady=3)
        self.find_var = tk.StringVar(value=self.initial)
        e = ttk.Entry(master, textvariable=self.find_var, width=50)
        e.grid(row=0, column=1, padx=4, pady=3)
        ttk.Label(master, text="Ersetzen durch:").grid(row=1, column=0, sticky="w", padx=4, pady=3)
        self.repl_var = tk.StringVar()
        ttk.Entry(master, textvariable=self.repl_var, width=50).grid(row=1, column=1, padx=4, pady=3)
        self.all_var = tk.BooleanVar(value=False)
        ttk.Checkbutton(master, text="Alle ersetzen", variable=self.all_var).grid(row=2, column=1, sticky="w", padx=4)
        return e

    def buttonbox(self):
        box = ttk.Frame(self)
        ttk.Button(box, text="Suchen", command=self._find).pack(side="left", padx=4, pady=6)
        ttk.Button(box, text="Ersetzen", command=self._replace).pack(side="left", padx=4, pady=6)
        ttk.Button(box, text="Schliessen", command=self.cancel).pack(side="left", padx=4, pady=6)
        self.bind("<Return>", lambda e: self._find())
        self.bind("<Escape>", lambda e: self.cancel())
        box.pack()

    def _find(self):
        self.pattern = self.find_var.get()
        self.replace = None
        self.destroy()

    def _replace(self):
        self.pattern = self.find_var.get()
        self.replace = self.repl_var.get()
        self.replace_all = self.all_var.get()
        self.destroy()
