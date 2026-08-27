#!/usr/bin/env python3
"""Datenrettung – Einstiegspunkt.

Ohne Argumente startet die grafische Oberflaeche. Zusaetzlich gibt es eine
Kommandozeile fuer den kopflosen Betrieb und zum Testen:

    python main.py                     # GUI starten
    python main.py list                # verfuegbare Laufwerke anzeigen
    python main.py scan --source disk.dd --out ./gerettet
    python main.py scan --source \\\\.\\C: --out D:\\gerettet --no-carve

Wichtig: Das Werkzeug liest die Quelle nur. Der Ausgabeordner muss auf einem
anderen Datentraeger als die Quelle liegen, damit nichts ueberschrieben wird.
Der Zugriff auf rohe Laufwerke erfordert Administrator- bzw. root-Rechte.
"""

from __future__ import annotations

import argparse
import sys

from recovery import ByteSource, Scanner, ScanOptions
from recovery import scanner as scanner_mod
from recovery.drives import list_drives, format_size


def cmd_list(_args) -> int:
    drives = list_drives()
    if not drives:
        print("Keine Laufwerke erkannt (oder nicht unterstuetzte Plattform).")
        print("Du kannst stattdessen eine Image-Datei angeben.")
        return 0
    print("Verfuegbare Laufwerke:")
    for d in drives:
        print(f"  {d.path:<24} {d.kind:<9} {d.human_size():>12}  {d.label}")
    return 0


def cmd_scan(args) -> int:
    options = ScanOptions(
        use_ntfs=not args.no_ntfs,
        use_fat=not args.no_fat,
        use_carve=not args.no_carve,
        deleted_only=not args.all,
        max_files=args.max,
        recover_partial=not args.no_partial,
        validate=not args.no_validate,
        ntfs_orphan_scan=args.orphan,
        reconstruct_partitions=args.reconstruct,
        use_usn=args.usn,
    )

    def progress(phase: str, frac: float, count: int) -> None:
        bar = int(frac * 30)
        sys.stdout.write(f"\r  {phase:<40} [{'#' * bar:<30}] "
                         f"{frac * 100:5.1f}%  {count} Funde")
        sys.stdout.flush()

    try:
        with ByteSource(args.source, sector_size=args.sector) as src:
            print(f"Quelle: {args.source}  ({format_size(src.size)})")
            if src.size is None:
                print("  Achtung: Groesse unbekannt. Bei einem Geraet deutet das "
                      "auf fehlende Rechte hin (als Administrator/root starten).")
            scanner = Scanner(src, options)
            findings = scanner.scan(progress_cb=progress)
            print()  # Zeilenumbruch nach der Fortschrittsanzeige
            print(f"Gelesen: {format_size(src.bytes_read)} von {format_size(src.size)}"
                  f"  |  defekte Sektoren: {src.bad_sectors}")

            if not findings:
                print("Keine wiederherstellbaren Dateien gefunden.")
                return 0

            print(f"\n{len(findings)} wiederherstellbare Datei(en) gefunden:")
            _print_summary(findings)

            if args.out:
                print(f"\nSchreibe nach: {args.out}")

                def rec_progress(done: int, total: int, name: str) -> None:
                    sys.stdout.write(f"\r  {done}/{total}  {name[:40]:<40}")
                    sys.stdout.flush()

                ok, skipped, errors = scanner_mod.recover(src, findings, args.out,
                                                          progress_cb=rec_progress)
                print()
                msg = f"{ok} Datei(en) wiederhergestellt."
                if skipped:
                    msg += f" {skipped} bereits vorhanden, uebersprungen."
                print(msg)
                if errors:
                    print(f"{len(errors)} Fehler:")
                    for e in errors[:10]:
                        print(f"  - {e}")
            else:
                print("\nHinweis: mit --out ORDNER werden die Dateien geschrieben.")
    except FileNotFoundError:
        print(f"Quelle nicht gefunden: {args.source}", file=sys.stderr)
        return 1
    except PermissionError:
        print("Zugriff verweigert. Bitte als Administrator/root ausfuehren.",
              file=sys.stderr)
        return 1
    return 0


def _print_summary(findings) -> None:
    by_type: dict[str, tuple[int, int]] = {}
    for f in findings:
        count, size = by_type.get(f.type_name, (0, 0))
        by_type[f.type_name] = (count + 1, size + f.size)
    for name, (count, size) in sorted(by_type.items()):
        print(f"  {name:<28} {count:>6} Datei(en)  {format_size(size):>12}")


def cmd_gui(_args) -> int:
    try:
        from gui.app import run
    except Exception as exc:  # tkinter fehlt o.ae.
        print("Grafische Oberflaeche nicht verfuegbar:", exc, file=sys.stderr)
        print("Nutze die Kommandozeile, z.B.:  python main.py scan --source disk.dd --out ./out",
              file=sys.stderr)
        return 1
    run()
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="datenrettung",
        description="Wiederherstellung von Dateien auf Windows-/NTFS-Datentraegern.")
    sub = parser.add_subparsers(dest="command")

    sub.add_parser("gui", help="grafische Oberflaeche starten (Standard)")
    sub.add_parser("list", help="verfuegbare Laufwerke anzeigen")

    scan = sub.add_parser("scan", help="Quelle scannen und optional wiederherstellen")
    scan.add_argument("--source", required=True,
                      help="Image-Datei oder Geraet (z.B. disk.dd, \\\\.\\C:, /dev/sda)")
    scan.add_argument("--out", help="Ausgabeordner (auf anderem Datentraeger!)")
    scan.add_argument("--no-ntfs", action="store_true", help="NTFS-Scan auslassen")
    scan.add_argument("--no-fat", action="store_true", help="FAT/exFAT-Undelete auslassen")
    scan.add_argument("--no-carve", action="store_true", help="Carving auslassen")
    scan.add_argument("--all", action="store_true",
                      help="bei NTFS auch nicht-geloeschte Dateien listen")
    scan.add_argument("--orphan", action="store_true",
                      help="ganzen Datentraeger nach MFT-Eintraegen absuchen "
                           "(findet auch nach Formatierung, dauert laenger)")
    scan.add_argument("--reconstruct", action="store_true",
                      help="verlorene Partitionstabelle ueber eine Boot-Sektor-Suche "
                           "rekonstruieren (findet Volumes ohne intakte Tabelle)")
    scan.add_argument("--usn", action="store_true",
                      help="USN-Journal auswerten: Namen und Zeit geloeschter Dateien "
                           "(informativ, kein Inhalt)")
    scan.add_argument("--no-partial", action="store_true",
                      help="unvollstaendige Dateien (ohne Endmuster) nicht mitnehmen")
    scan.add_argument("--no-validate", action="store_true",
                      help="Struktur-Validierung der Carving-Treffer abschalten")
    scan.add_argument("--sector", type=int, default=512,
                      help="Sektorgroesse in Bytes (512 oder 4096 fuer 4Kn)")
    scan.add_argument("--max", type=int, default=None,
                      help="Obergrenze fuer Carving-Treffer")
    return parser


def main(argv=None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    if args.command == "list":
        return cmd_list(args)
    if args.command == "scan":
        return cmd_scan(args)
    return cmd_gui(args)


if __name__ == "__main__":
    raise SystemExit(main())
