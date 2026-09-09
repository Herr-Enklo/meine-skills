"""Automatik: Paket zusammensetzen und hin und zurueck testen.

Zwei Bausteine:

* ``build_package`` legt aus einer Setup.inf (z. B. aus dem Paketierungs-Repo)
  und einem Ordner mit Installerdateien den Paketordner im Package Store an:
  ``<Store>\\<Hersteller>\\<Produkt>\\<Version>\\Install\\Setup.inf`` und ``Files\\``.
* ``run_roundtrip`` fuehrt die Phasen Installation, wahlweise erneute
  Installation, Deinstallation hintereinander aus, prueft nach jeder Phase den
  Registry-Zustand (Uninstall-Schluessel der Software, Empirum-Registrierung)
  und schreibt einen Testbericht als Markdown neben das Paket.

Beides ist ohne Oberflaeche nutzbar (``main.py build``, ``main.py roundtrip``,
``main.py auto``); der Editor nutzt dieselben Funktionen fuer den sichtbaren
Lauf.
"""

from __future__ import annotations

import os
import shutil
import time
from dataclasses import dataclass, field
from datetime import datetime
from typing import Callable

from .backend import Backend, SimulationBackend, WindowsBackend, UNINSTALL_KEY
from .inf import InfFile, load_inf
from .package import _safe
from .runner import Runner, RunOptions, RunResult, Status
from .validator import validate, Finding


# -- Paket zusammensetzen ------------------------------------------------------

@dataclass
class BuildResult:
    setup_inf: str
    package_root: str
    copied_files: list[str] = field(default_factory=list)
    notes: list[str] = field(default_factory=list)


def build_package(source_inf: str, store: str, files_dir: str | None = None,
                  extra_install_files: list[str] | None = None, overwrite: bool = False) -> BuildResult:
    """Paketordner aus einer Setup.inf und einem Installerordner anlegen.

    Hersteller, Produkt und Version kommen aus [Application]. Vorhandene
    Setup.inf werden nur mit ``overwrite`` ersetzt; Dateien in Files\\ werden
    uebersprungen, wenn sie schon gleich gross vorhanden sind."""
    inf = load_inf(source_inf)
    app = inf.find("Application")
    if app is None:
        raise ValueError("Setup.inf ohne [Application]-Sektion")
    developer = (app.get("DeveloperName") or "").strip()
    product = (app.get("ProductName") or "").strip()
    version = (app.get("Version") or "").strip()
    if not (developer and product and version):
        raise ValueError("DeveloperName, ProductName oder Version fehlt in [Application]")
    setup_inf_dir = (app.get("SetupInfDir") or "Install").strip().strip("\\")
    root = os.path.join(store, _safe(developer), _safe(product), _safe(version))
    install_dir = os.path.join(root, setup_inf_dir)
    files_dir_target = os.path.join(root, "Files")
    os.makedirs(install_dir, exist_ok=True)
    os.makedirs(files_dir_target, exist_ok=True)
    target = os.path.join(install_dir, "Setup.inf")
    result = BuildResult(setup_inf=target, package_root=root)
    if os.path.exists(target) and not overwrite:
        with open(target, "rb") as a, open(source_inf, "rb") as b:
            same = a.read() == b.read()
        if not same:
            raise FileExistsError(f"Es gibt schon eine andere Setup.inf: {target} (overwrite=True zum Ersetzen)")
        result.notes.append("Setup.inf war schon vorhanden und identisch")
    else:
        shutil.copyfile(source_inf, target)      # byteerhaltend (Kodierung, CRLF)
        result.copied_files.append(target)
    # Begleitdateien neben der Quell-Setup.inf (Setup.ico, Logo.bmp ...)
    src_dir = os.path.dirname(os.path.abspath(source_inf))
    for name in os.listdir(src_dir):
        low = name.lower()
        if low in ("setup.ico", "logo.bmp", "setup.bmp") or low.endswith((".ico", ".bmp")):
            _copy_if_needed(os.path.join(src_dir, name), os.path.join(install_dir, name), result)
    for extra in extra_install_files or []:
        if os.path.isfile(extra):
            _copy_if_needed(extra, os.path.join(install_dir, os.path.basename(extra)), result)
    if files_dir and os.path.isdir(files_dir):
        for dirpath, _, filenames in os.walk(files_dir):
            rel = os.path.relpath(dirpath, files_dir)
            for name in filenames:
                src = os.path.join(dirpath, name)
                dst = os.path.join(files_dir_target, rel, name) if rel != "." else os.path.join(files_dir_target, name)
                _copy_if_needed(src, dst, result)
    elif files_dir:
        result.notes.append(f"Installerordner nicht gefunden: {files_dir}")
    # Fehlen Dateien, die das Skript nennt?
    findings = validate(load_inf(target))
    for f in findings:
        if "Kopierquelle nicht gefunden" in f.text or "Programmdatei" in f.text:
            result.notes.append(f.text)
    return result


def _copy_if_needed(src: str, dst: str, result: BuildResult) -> None:
    if os.path.exists(dst) and os.path.getsize(dst) == os.path.getsize(src):
        return
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    shutil.copy2(src, dst)
    result.copied_files.append(dst)


# -- Hin und zurueck -----------------------------------------------------------

@dataclass
class PhaseResult:
    label: str
    mode: str
    result: RunResult
    checks: list[tuple[str, bool, str]] = field(default_factory=list)   # (Pruefung, bestanden, Details)

    @property
    def ok(self) -> bool:
        return self.result.status == Status.SUCCESS and all(passed for _, passed, _ in self.checks)


@dataclass
class RoundtripResult:
    setup_inf: str
    started: datetime
    simulate: bool
    phases: list[PhaseResult] = field(default_factory=list)
    findings: list[Finding] = field(default_factory=list)
    report_path: str = ""

    @property
    def ok(self) -> bool:
        return all(p.ok for p in self.phases) and not any(f.level == "Fehler" for f in self.findings)

    def summary(self) -> str:
        parts = [f"{p.label}: {'OK' if p.ok else 'FEHLER'}" for p in self.phases]
        return ("Gesamt: " + ("bestanden" if self.ok else "nicht bestanden") + " | " + ", ".join(parts))


def default_phases(reinstall: bool = False, user_part: bool = False, switches: str = "") -> list[tuple[str, str]]:
    """(Beschriftung, Modus) der Phasen eines Hin-und-zurueck-Tests."""
    phases = [("Installation", "install")]
    if reinstall:
        phases.append(("Erneute Installation (Reparatur)", "reinstall"))
    phases.append(("Deinstallation", "uninstall"))
    return phases


def make_options(inf: InfFile, mode: str, base: RunOptions | None = None) -> RunOptions:
    """RunOptions fuer eine Phase, abgeleitet von den Command line options des Pakets."""
    switches = (inf.value("SetupInfo", "Command line options") or "/S0").strip()
    opts = RunOptions.from_command_line(switches)
    if base is not None:
        for name in ("bits", "language", "once_rule", "version_compare", "abort_on_unknown_command",
                     "call_timeout", "apply_registration", "emulate_installers", "log_path"):
            setattr(opts, name, getattr(base, name))
        opts.env_overrides = dict(base.env_overrides)
        opts.user_part = base.user_part or opts.user_part
    opts.mode = "install" if mode == "reinstall" else mode
    opts.command_line = f'Setup.exe "{inf.path}" {opts.switches()}'
    return opts


def run_roundtrip(inf_path: str, simulate: bool = True, reinstall: bool = False,
                  base_options: RunOptions | None = None,
                  backend_factory: Callable[[str, Backend | None], Backend] | None = None,
                  on_phase: Callable[[str, str], None] | None = None,
                  runner_hooks: dict | None = None,
                  report_path: str | None = None) -> RoundtripResult:
    """Installation, wahlweise erneute Installation, Deinstallation hintereinander.

    ``backend_factory(mode, previous_backend)`` liefert das Backend je Phase;
    ohne Angabe: Simulation mit uebernommener Registry bzw. Windows-Backend.
    ``runner_hooks`` (on_log, step_hook, ask_hook) gehen an jeden Runner, damit
    der Editor den Lauf zeigen kann."""
    inf = load_inf(inf_path)
    rt = RoundtripResult(setup_inf=inf.path or inf_path, started=datetime.now(), simulate=simulate)
    rt.findings = validate(inf)
    hooks = runner_hooks or {}
    previous: Backend | None = None
    display = ""
    for index, (label, mode) in enumerate(default_phases(reinstall), start=1):
        if on_phase:
            on_phase(label, mode)
        if backend_factory is not None:
            backend = backend_factory(mode, previous)
        elif simulate:
            backend = SimulationBackend()
            if isinstance(previous, SimulationBackend):
                backend.inherit(previous)
        else:
            backend = WindowsBackend()
        opts = make_options(inf, mode, base_options)
        if opts.log_path is None:
            opts.log_suffix = f".{index}"
        runner = Runner(load_inf(inf_path), backend, opts, **hooks)
        result = runner.run()
        phase = PhaseResult(label=label, mode=mode, result=result)
        display = _display_name(result.variables) or display
        phase.checks = _checks(runner, backend, mode, display)
        rt.phases.append(phase)
        previous = backend
        if result.status == Status.STOPPED:
            break
        if result.status != Status.SUCCESS and mode != "uninstall":
            # Ohne erfolgreiche Installation ist die Deinstallation nicht aussagekraeftig;
            # sie laeuft trotzdem, damit der Rechner sauber bleibt, wird aber vermerkt.
            phase.checks.append(("Folgephasen", False, "Installation fehlgeschlagen, weitere Phasen nur zur Bereinigung"))
    rt.report_path = write_report(rt, report_path)
    return rt


def _display_name(variables: dict[str, str]) -> str:
    for name in ("V_MSIDisplayName", "V_UnattendDisplayName", "V_DisplayName"):
        for k, v in variables.items():
            if k.lower() == name.lower() and v.strip():
                return v.strip()
    return ""


def _checks(runner: Runner, backend: Backend, mode: str, display: str) -> list[tuple[str, bool, str]]:
    checks: list[tuple[str, bool, str]] = []
    app = runner.inf.find("Application")
    uninstall_key = runner.expand(app.get("UninstallKeyName") or "") if app else ""
    machine_key = runner.expand(app.get("MachineKeyName") or "") if app else ""
    arch = (runner.vars.get("V_Arch") or "").strip()
    expect_present = mode != "uninstall"
    if display:
        key = backend.find_uninstall_key(display, arch)
        ok = bool(key) == expect_present
        checks.append((f"Uninstall-Schluessel der Software ('{display}') {'vorhanden' if expect_present else 'entfernt'}",
                       ok, f"gefunden: {key}" if key else "nicht gefunden"))
    else:
        checks.append(("Uninstall-Schluessel der Software", True,
                       "kein DisplayName im Skript (V_MSIDisplayName/V_UnattendDisplayName), nicht geprueft"))
    if uninstall_key and runner.options.apply_registration:
        present = backend.reg_key_exists("HKLM", f"{UNINSTALL_KEY}\\{uninstall_key}")
        checks.append((f"Empirum-Registrierung ({uninstall_key}) {'vorhanden' if expect_present else 'entfernt'}",
                       present == expect_present, ""))
    if machine_key and runner.options.apply_registration:
        present = backend.reg_key_exists("HKLM", f"SOFTWARE\\{machine_key}")
        checks.append((f"MachineKeyName {'vorhanden' if expect_present else 'entfernt'}",
                       present == expect_present, f"HKLM\\SOFTWARE\\{machine_key}"))
    return checks


def write_report(rt: RoundtripResult, path: str | None = None) -> str:
    """Testbericht als Markdown neben das Paket schreiben (Versionsordner)."""
    if path is None:
        root = os.path.dirname(os.path.dirname(rt.setup_inf))
        path = os.path.join(root, f"Testbericht_{rt.started.strftime('%Y-%m-%d_%H%M%S')}.md")
    lines = [
        f"# Testbericht {os.path.basename(os.path.dirname(os.path.dirname(rt.setup_inf)))}",
        "",
        f"Setup.inf: `{rt.setup_inf}`  ",
        f"Datum: {rt.started.strftime('%d.%m.%Y %H:%M:%S')}  ",
        f"Art: {'Simulation' if rt.simulate else 'echter Testlauf (Windows)'}  ",
        f"Ergebnis: **{'bestanden' if rt.ok else 'nicht bestanden'}**",
        "",
        "## Phasen",
        "",
        "| Phase | Ergebnis | ErrorLevel | Neustart | Warnungen | Fehler | Aktionen | Dauer |",
        "|---|---|---|---|---|---|---|---|",
    ]
    for p in rt.phases:
        r = p.result
        lines.append(f"| {p.label} | {r.status.value}{'' if p.ok else ' (Pruefung fehlgeschlagen)'} | {r.error_level} | "
                     f"{r.reboot or '-'} | {r.warnings} | {r.errors} | {len(r.actions)} | {r.duration:.1f} s |")
    for p in rt.phases:
        lines += ["", f"### {p.label}", ""]
        if p.result.message:
            lines.append(f"Meldung: {p.result.message}  ")
        if p.result.trigger:
            lines.append(f"{p.result.trigger}  ")
        if p.result.log_path:
            lines.append(f"Protokoll: `{p.result.log_path}`")
        lines.append("")
        for name, passed, detail in p.checks:
            lines.append(f"- [{'x' if passed else ' '}] {name}" + (f" ({detail})" if detail else ""))
        problems = [e for e in p.result.log if e.level in ("ERROR", "WARN")]
        if problems:
            lines += ["", "Warnungen und Fehler im Protokoll:", ""]
            for e in problems[:40]:
                lines.append(f"- Zeile {e.line} [{e.section}] {e.level}: {e.text}")
            if len(problems) > 40:
                lines.append(f"- ... und {len(problems) - 40} weitere")
    errors = [f for f in rt.findings if f.level == "Fehler"]
    warnings = [f for f in rt.findings if f.level == "Warnung"]
    lines += ["", "## Paketpruefung", "",
              f"{len(errors)} Fehler, {len(warnings)} Warnungen, {len(rt.findings) - len(errors) - len(warnings)} Hinweise", ""]
    for f in rt.findings:
        if f.level != "Hinweis":
            lines.append(f"- {f}")
    lines.append("")
    try:
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "w", encoding="utf-8") as fh:
            fh.write("\n".join(lines))
    except OSError:
        return ""
    return path
