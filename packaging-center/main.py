#!/usr/bin/env python3
"""Empirum Packaging Center (Nachbau) - Einstiegspunkt.

Ohne Argumente startet die grafische Oberflaeche. Fuer Skripte und den
Betrieb ohne Fenster gibt es eine Kommandozeile:

    python main.py                                  # Oberflaeche
    python main.py check  Pfad\\zur\\Setup.inf        # Paketpruefung
    python main.py run    Pfad\\zur\\Setup.inf [/U] [/AW] [/S1]   # Simulation
    python main.py run    Pfad\\zur\\Setup.inf --programme   # Installer echt starten, Rest simulieren
    python main.py run    Pfad\\zur\\Setup.inf --echt  # echte Ausfuehrung (Windows, Admin)
    python main.py vars   Pfad\\zur\\Setup.inf        # Variablen nach dem Laden
    python main.py list   Ordner                    # Pakete im Package Store
    python main.py new    --vorlage EXE.inf --hersteller X --produkt Y --version 1.0 --store Ordner
    python main.py build  Quelle\\setup.inf --store Ordner --files Installerordner
    python main.py roundtrip Pfad\\zur\\Setup.inf [--echt] [--reinstall]   # hin und zurueck
    python main.py auto   Quelle\\setup.inf --store Ordner --files Installerordner --echt

Die Simulation aendert nichts am Rechner. Die echte Ausfuehrung schreibt
Registry und Dateien und startet Programme, wie Setup.exe es taete.
"""

from __future__ import annotations

import argparse
import os
import sys

_HERE = os.path.dirname(os.path.abspath(__file__))
if _HERE not in sys.path:
    sys.path.insert(0, _HERE)

from empirum import (load_inf, validate, Runner, RunOptions, SimulationBackend, WindowsBackend,  # noqa: E402
                     find_packages, create_package, Status)
from empirum.package import PackageSpec, list_templates  # noqa: E402
from empirum.pipeline import build_package, run_roundtrip  # noqa: E402


def cmd_check(args) -> int:
    inf = load_inf(args.inf)
    findings = validate(inf)
    print(f"Paketpruefung {inf.path} ({inf.encoding}, {'CRLF' if inf.newline == chr(13) + chr(10) else 'LF'})")
    if not findings:
        print("Keine Befunde.")
        return 0
    for f in findings:
        print(" ", f)
    errors = sum(1 for f in findings if f.level == "Fehler")
    warnings = sum(1 for f in findings if f.level == "Warnung")
    print(f"\n{errors} Fehler, {warnings} Warnungen, {len(findings) - errors - warnings} Hinweise")
    return 1 if errors else 0


def cmd_run(args) -> int:
    inf = load_inf(args.inf)
    switches = " ".join(args.switches)
    opts = RunOptions.from_command_line(switches, bits=args.bits,
                                        version_compare="string" if args.string_compare else "numeric",
                                        once_rule=not args.no_once,
                                        emulate_installers=not args.keine_nachbildung)
    opts.command_line = f'Setup.exe "{inf.path}" {switches}'.strip()
    for item in args.var or []:
        k, _, v = item.partition("=")
        opts.env_overrides[k.strip()] = v
    if args.echt:
        if os.name != "nt":
            print("Echte Ausfuehrung gibt es nur unter Windows.")
            return 2
        backend = WindowsBackend()
    else:
        backend = SimulationBackend()
        backend.default_exit_code = args.exit_code
        backend.execute_programs = args.programme
    verbose = args.verbose

    def on_log(entry):
        if verbose or entry.level in ("INFO", "CMD", "ECHO", "WARN", "ERROR"):
            print(entry.format())

    result = Runner(inf, backend, opts, on_log=on_log).run()
    print()
    print(result.summary())
    if result.log_path:
        print(f"Protokoll: {result.log_path}")
    if args.aktionen and result.actions:
        print("\nAktionen:")
        for a in result.actions:
            print("  " + str(a))
    return 0 if result.status == Status.SUCCESS else 1


def cmd_vars(args) -> int:
    inf = load_inf(args.inf)
    runner = Runner(inf, SimulationBackend(), RunOptions(bits=args.bits))
    runner._setup_variables()
    for name, value in runner.vars.items():
        print(f"{name:<32} = {value}")
    return 0


def cmd_list(args) -> int:
    packages = find_packages(args.ordner)
    if not packages:
        print("Keine Setup.inf gefunden.")
        return 0
    for p in packages:
        print(f"{p.developer:<24} {p.product:<36} {p.version:<16} {p.method:<10} {p.setup_inf}")
    return 0


def cmd_new(args) -> int:
    spec = PackageSpec(
        template=args.vorlage, developer=args.hersteller, product=args.produkt, version=args.version,
        revision=args.revision, author=args.autor, description=args.beschreibung or "",
        installer=args.installer or "", install_params=args.parameter or "",
        uninstall_params=args.deinst_parameter or "", display_name=args.displayname or "",
        arch=args.arch, platform=args.platform or "",
    )
    path = create_package(spec, args.store)
    print(f"Paket angelegt: {path}")
    return 0


def cmd_build(args) -> int:
    res = build_package(args.inf, args.store, files_dir=args.files, overwrite=args.ersetzen)
    print(f"Paket: {res.package_root}")
    print(f"Setup.inf: {res.setup_inf}")
    for f in res.copied_files:
        print(f"  kopiert: {f}")
    for n in res.notes:
        print(f"  Hinweis: {n}")
    return 0


def _roundtrip(inf_path: str, args) -> int:
    simulate = not args.echt
    if args.echt and os.name != "nt":
        print("Echte Ausfuehrung gibt es nur unter Windows.")
        return 2
    base = RunOptions(bits=args.bits, version_compare="string" if args.string_compare else "numeric")
    for item in args.var or []:
        k, _, v = item.partition("=")
        base.env_overrides[k.strip()] = v

    def factory(mode, previous):
        if not simulate:
            return WindowsBackend()
        be = SimulationBackend()
        be.default_exit_code = args.exit_code
        be.execute_programs = args.programme
        if previous is not None:
            be.inherit(previous)
        return be

    def on_phase(label, mode):
        print(f"\n=== {label} ===")

    def on_log(entry):
        if args.verbose or entry.level in ("ERROR", "WARN", "ECHO"):
            print(entry.format())

    rt = run_roundtrip(inf_path, simulate=simulate, reinstall=args.reinstall, base_options=base,
                       backend_factory=factory, on_phase=on_phase, runner_hooks={"on_log": on_log},
                       report_path=args.bericht)
    print()
    for p in rt.phases:
        print(f"{p.label:<36} {p.result.status.value:<10} ErrorLevel {p.result.error_level}")
        for name, passed, detail in p.checks:
            print(f"    [{'x' if passed else ' '}] {name}" + (f" ({detail})" if detail else ""))
    print("\n" + rt.summary())
    if rt.report_path:
        print(f"Testbericht: {rt.report_path}")
    return 0 if rt.ok else 1


def cmd_roundtrip(args) -> int:
    return _roundtrip(args.inf, args)


def cmd_auto(args) -> int:
    res = build_package(args.inf, args.store, files_dir=args.files, overwrite=args.ersetzen)
    print(f"Paket gebaut: {res.setup_inf}")
    for n in res.notes:
        print(f"  Hinweis: {n}")
    return _roundtrip(res.setup_inf, args)


def _add_roundtrip_args(p) -> None:
    p.add_argument("--echt", action="store_true", help="echter Testlauf (nur Windows, als Administrator)")
    p.add_argument("--programme", action="store_true", help="Mischmodus: Programme echt, Rest simuliert")
    p.add_argument("--reinstall", action="store_true", help="zwischen Installation und Deinstallation erneut installieren")
    p.add_argument("--bericht", help="Pfad des Testberichts (Standard: Versionsordner des Pakets)")
    p.add_argument("--bits", type=int, default=64, choices=(32, 64))
    p.add_argument("--var", action="append", help="Variable setzen, z. B. --var VM_Umgebung=Test")
    p.add_argument("--exit-code", type=int, default=0, help="angenommener Rueckgabewert in der Simulation")
    p.add_argument("--string-compare", action="store_true")
    p.add_argument("-v", "--verbose", action="store_true")


def main(argv: list[str] | None = None) -> int:
    argv = sys.argv[1:] if argv is None else argv
    if not argv:
        from gui.app import run_app
        return run_app()

    parser = argparse.ArgumentParser(description="Empirum Packaging Center (Nachbau)")
    sub = parser.add_subparsers(dest="cmd", required=True)

    p = sub.add_parser("check", help="Setup.inf statisch pruefen")
    p.add_argument("inf")
    p.set_defaults(func=cmd_check)

    p = sub.add_parser("run", help="Setup.inf ausfuehren (Standard: Simulation)")
    p.add_argument("inf")
    p.add_argument("switches", nargs="*", help="Setup.exe-Schalter: /U /R /AW /S0..4")
    p.add_argument("--echt", action="store_true", help="wirklich ausfuehren (nur Windows)")
    p.add_argument("--keine-nachbildung", action="store_true",
                   help="Simulation: Wirkung von Installern nicht nachbilden")
    p.add_argument("--programme", action="store_true",
                   help="Mischmodus: Programmaufrufe wirklich starten, Rest simulieren")
    p.add_argument("--bits", type=int, default=64, choices=(32, 64))
    p.add_argument("--var", action="append", help="Variable setzen, z. B. --var VM_Umgebung=Test")
    p.add_argument("--exit-code", type=int, default=0, help="angenommener Rueckgabewert fuer Programmaufrufe")
    p.add_argument("--string-compare", action="store_true", help="Vergleiche als Zeichenketten statt numerisch")
    p.add_argument("--no-once", action="store_true", help="Sektionen duerfen mehrfach per # laufen")
    p.add_argument("--aktionen", action="store_true", help="Liste der (simulierten) Aenderungen ausgeben")
    p.add_argument("-v", "--verbose", action="store_true", help="auch DEBUG-Zeilen ausgeben")
    p.set_defaults(func=cmd_run)

    p = sub.add_parser("vars", help="Variablen nach dem Laden anzeigen")
    p.add_argument("inf")
    p.add_argument("--bits", type=int, default=64, choices=(32, 64))
    p.set_defaults(func=cmd_vars)

    p = sub.add_parser("list", help="Pakete in einem Ordner auflisten")
    p.add_argument("ordner")
    p.set_defaults(func=cmd_list)

    p = sub.add_parser("new", help="Paket aus Vorlage anlegen")
    p.add_argument("--vorlage", default="EXE.inf", help=f"Vorlage: {', '.join(list_templates())}")
    p.add_argument("--hersteller", required=True)
    p.add_argument("--produkt", required=True)
    p.add_argument("--version", required=True)
    p.add_argument("--revision", default="0")
    p.add_argument("--autor", default=os.environ.get("USERNAME") or os.environ.get("USER") or "")
    p.add_argument("--beschreibung")
    p.add_argument("--installer", help="Installerdatei (wird nach Files\\ kopiert)")
    p.add_argument("--parameter", help="Parameter fuer den Installer")
    p.add_argument("--deinst-parameter")
    p.add_argument("--displayname", help="DisplayName unter ...\\Uninstall")
    p.add_argument("--arch", default="x64", choices=("x64", "x86", "both"))
    p.add_argument("--platform", help="[Setup] Platform: *, x86, x64")
    p.add_argument("--store", required=True, help="Zielordner (Package Store)")
    p.set_defaults(func=cmd_new)

    p = sub.add_parser("build", help="Paketordner aus Setup.inf und Installerordner zusammensetzen")
    p.add_argument("inf", help="Quell-Setup.inf (z. B. aus dem Paketierungs-Repo)")
    p.add_argument("--store", required=True, help="Package Store (Zielordner)")
    p.add_argument("--files", help="Ordner mit Installerdateien, wird nach Files\\ kopiert")
    p.add_argument("--ersetzen", action="store_true", help="vorhandene Setup.inf ersetzen")
    p.set_defaults(func=cmd_build)

    p = sub.add_parser("roundtrip", help="Installation und Deinstallation hintereinander testen")
    p.add_argument("inf")
    _add_roundtrip_args(p)
    p.set_defaults(func=cmd_roundtrip)

    p = sub.add_parser("auto", help="Paket bauen und danach hin und zurueck testen")
    p.add_argument("inf", help="Quell-Setup.inf")
    p.add_argument("--store", required=True)
    p.add_argument("--files")
    p.add_argument("--ersetzen", action="store_true")
    _add_roundtrip_args(p)
    p.set_defaults(func=cmd_auto)

    args = parser.parse_args(argv)
    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())
