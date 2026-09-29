"""Prueft die Windows-spezifischen Geraetezugriffe auf einem echten Windows.

Laeuft in der CI auf einem Windows-Runner (dort mit Administratorrechten) und
deckt ab, was sich unter Linux nicht testen laesst: Laufwerksliste ueber
PowerShell, Groesse und Sektorgroesse ueber DeviceIoControl, Lesen von
``\\\\.\\PhysicalDriveN`` und ``\\\\.\\C:`` sowie die Pruefung, ob ein
Ausgabeordner auf der Quelle liegt. Von den Geraeten wird nur gelesen; fuer die
Junction-Pruefung legt das Skript kurz zwei leere Ordner an und entfernt sie
wieder.

Aufruf:  python datenrettung/tests/windows_geraete.py
"""

from __future__ import annotations

import os
import subprocess
import sys

_HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(_HERE))

from recovery import ByteSource, ntfs  # noqa: E402
from recovery.drives import list_drives, output_on_source, windows_disk_letters  # noqa: E402


def check(cond: bool, text: str) -> None:
    print(("OK    " if cond else "FEHLER ") + text)
    if not cond:
        check.failed = True  # type: ignore[attr-defined]


check.failed = False  # type: ignore[attr-defined]


def main() -> int:
    if not sys.platform.startswith("win"):
        print("Nur unter Windows sinnvoll – uebersprungen.")
        return 0

    drives = list_drives()
    for d in drives:
        print(f"  {d.path:<22} {d.kind:<9} {d.human_size():>12}  {d.label}")
    check(any(d.kind == "physical" for d in drives), "physische Laufwerke gelistet")
    check(any(d.path.upper() == "\\\\.\\C:" for d in drives), "Laufwerk C: gelistet")
    check(all("\ufffd" not in d.label for d in drives), "Laufwerksnamen ohne Kodierungsfehler")

    disk = subprocess.run(
        ["powershell", "-NoProfile", "-Command", "(Get-Partition -DriveLetter C).DiskNumber"],
        capture_output=True, text=True, check=False).stdout.strip()
    disk_no = int(disk) if disk.isdigit() else 0
    physical = f"\\\\.\\PhysicalDrive{disk_no}"

    with ByteSource(physical) as src:
        wmi = next((d.size for d in drives if d.path.upper() == physical.upper()), None)
        print(f"  {physical}: IOCTL {src.size}, WMI {wmi}, Sektor {src.sector_size}")
        check(bool(src.size) and src.size > 0, "Groesse per IOCTL ermittelt")
        check(wmi is None or src.size >= wmi, "IOCTL-Groesse mindestens so gross wie WMI")
        check(src.sector_size in (512, 4096), "Sektorgroesse erkannt")
        sector0 = src.read(0, 512)
        check(sector0[510:512] == b"\x55\xAA", "Sektor 0 mit Boot-Signatur gelesen")
        check(len(src.read(1000, 100)) == 100, "unausgerichtetes Lesen")
        tail = src.read(src.size - 512, 512)
        check(len(tail) == 512, "letzter Sektor lesbar")
        offsets = ntfs.partition_offsets(src)
        print(f"  Partitionen: {offsets}")
        check(len(offsets) > 1, "Partitionstabelle ausgewertet")

    with ByteSource("\\\\.\\C:") as src:
        boot = ntfs.BootSector(src.read(0, 512))
        print(f"  C: Volume {src.size} Byte, Cluster {boot.cluster_size}, Eintrag {boot.record_size}")
        reader = ntfs.MftReader(src, boot, 0)
        names = [ntfs._record_name_entry(reader.read_record(n)) for n in range(12)]
        print(f"  MFT-Eintraege 0-11: {[n[0] if n else None for n in names]}")
        check(names[0] is not None and names[0][0] == "$MFT", "MFT von C: gelesen")
        check(reader.record_count() > 1000, "MFT-Groesse plausibel")

    letters = windows_disk_letters(disk_no)
    print(f"  Laufwerksbuchstaben auf Datentraeger {disk_no}: {letters}")
    check("C" in letters, "Buchstaben der Platte ermittelt")
    check(output_on_source("\\\\.\\C:", "C:\\Gerettet") is not None, "C: als Quelle erkannt")
    check(output_on_source(physical, "C:\\Gerettet") is not None, "Platte als Quelle erkannt")
    check(output_on_source("\\\\.\\C:", "\\\\server\\freigabe") is None, "Netzpfad unkritisch")
    check_target_paths(drives, physical)
    return 1 if check.failed else 0  # type: ignore[attr-defined]


def check_target_paths(drives, physical: str) -> None:
    """Zielschutz mit echten Windows-Pfaden: erweitertes Pfadpraefix, anderes
    Laufwerk und eine Junction von einem anderen Laufwerk nach C:."""
    check(output_on_source("\\\\.\\C:", "\\\\?\\C:\\Gerettet") is not None,
          "erweiterter Pfad auf C: als Quelle erkannt")
    check(output_on_source(physical, "\\\\?\\C:\\Gerettet") is not None,
          "erweiterter Pfad auf der Platte erkannt")
    other = next((d.path[4] for d in drives if d.kind == "volume"
                  and d.path.upper() != "\\\\.\\C:"), None)
    if other is None:
        print("  kein zweites Laufwerk – Junction-Pruefung entfaellt")
        return
    check(output_on_source("\\\\.\\C:", f"{other}:\\Gerettet") is None,
          f"{other}: gilt nicht als C:")
    target = "C:\\datenrettung_ziel_test"
    link = f"{other}:\\datenrettung_verweis_test"
    os.makedirs(target, exist_ok=True)
    try:
        made = subprocess.run(["cmd", "/c", "mklink", "/J", link, target],
                              capture_output=True, text=True, check=False)
        check(made.returncode == 0 and os.path.isdir(link), "Junction angelegt")
        reason = output_on_source("\\\\.\\C:", link + "\\Gerettet")
        print(f"  {link} -> {target}: {reason}")
        check(reason is not None, "Junction nach C: als Quelle erkannt")
        check(output_on_source(physical, link) is not None, "Junction nach C: auf der Platte erkannt")
    finally:
        for path in (link, target):
            try:
                os.rmdir(path)
            except OSError:
                pass


if __name__ == "__main__":
    raise SystemExit(main())
