"""Auflisten verfuegbarer Laufwerke fuer die Auswahl in der Oberflaeche.

Das reine Auflisten benoetigt keine Administratorrechte – erst das spaetere
*Lesen* eines rohen Geraets tut das. Schlaegt die Erkennung fehl, wird eine
leere Liste zurueckgegeben; der Nutzer kann dann trotzdem eine Image-Datei
auswaehlen.
"""

from __future__ import annotations

import os
import re
import subprocess
import sys
from dataclasses import dataclass


@dataclass(frozen=True)
class Drive:
    path: str            # z.B. "\\\\.\\PhysicalDrive0", "/dev/sda", "disk.dd"
    label: str           # menschenlesbar fuer die Oberflaeche
    size: int | None     # Groesse in Bytes, falls bekannt
    kind: str            # "physical", "volume", "image"

    def human_size(self) -> str:
        return format_size(self.size)


def format_size(size: int | None) -> str:
    if not size or size <= 0:
        return "unbekannt"
    units = ["B", "KB", "MB", "GB", "TB", "PB"]
    value = float(size)
    for unit in units:
        if value < 1024 or unit == units[-1]:
            return f"{value:.1f} {unit}" if unit != "B" else f"{int(value)} B"
        value /= 1024
    return f"{size} B"


def list_drives() -> list[Drive]:
    """Ermittelt die verfuegbaren Laufwerke der aktuellen Plattform."""
    try:
        if sys.platform.startswith("win"):
            return _list_windows()
        if sys.platform.startswith("linux"):
            return _list_linux()
        if sys.platform == "darwin":
            return _list_macos()
    except Exception:
        # Erkennung darf die Oberflaeche nie blockieren.
        return []
    return []


# -- Windows -------------------------------------------------------------

def _list_windows() -> list[Drive]:
    drives: list[Drive] = []
    drives.extend(_windows_physical_drives())
    drives.extend(_windows_volumes())
    return drives


def _windows_physical_drives() -> list[Drive]:
    # Hinweis: Win32_DiskDrive.Size wird aus der Zylindergeometrie berechnet und
    # ist einige MB kleiner als die echte Platte. Der Wert dient nur der Anzeige;
    # beim Lesen fragt ByteSource die exakte Groesse per IOCTL ab.
    ps = (
        "Get-CimInstance Win32_DiskDrive | "
        "Select-Object DeviceID,Model,Size | ConvertTo-Csv -NoTypeInformation"
    )
    out = _run_powershell(ps)
    result: list[Drive] = []
    if out:
        for row in _parse_csv(out):
            device = row.get("DeviceID", "").strip()
            if not device:
                continue
            model = row.get("Model", "").strip() or "Datentraeger"
            size = _to_int(row.get("Size"))
            result.append(Drive(device, f"{model} ({format_size(size)})", size, "physical"))
    return result


def _windows_volumes() -> list[Drive]:
    # DriveType 2 = Wechseldatentraeger, 3 = lokale Platte. Netzlaufwerke (4),
    # CD/DVD (5) und RAM-Disks (6) lassen sich nicht roh lesen.
    ps = (
        "Get-CimInstance Win32_LogicalDisk | "
        "Select-Object DeviceID,DriveType,VolumeName,FileSystem,Size | "
        "ConvertTo-Csv -NoTypeInformation"
    )
    out = _run_powershell(ps)
    result: list[Drive] = []
    if out:
        for row in _parse_csv(out):
            letter = row.get("DeviceID", "").strip()  # z.B. "C:"
            if not letter or _to_int(row.get("DriveType")) not in (2, 3):
                continue
            name = row.get("VolumeName", "").strip()
            fs = row.get("FileSystem", "").strip()
            size = _to_int(row.get("Size"))
            desc = " ".join(p for p in (name, fs) if p) or "Volume"
            path = f"\\\\.\\{letter}"
            result.append(Drive(path, f"{letter} {desc} ({format_size(size)})", size, "volume"))
    return result


# -- Linux ---------------------------------------------------------------

def _list_linux() -> list[Drive]:
    result: list[Drive] = []
    block_root = "/sys/block"
    if not os.path.isdir(block_root):
        return result
    for name in sorted(os.listdir(block_root)):
        # Schleifen-, RAM- und Optical-Devices ueberspringen.
        if name.startswith(("loop", "ram", "sr", "fd", "dm-")):
            continue
        base = os.path.join(block_root, name)
        size = _read_int(os.path.join(base, "size"))
        size_bytes = size * 512 if size else None
        model = _read_str(os.path.join(base, "device", "model")) or ""
        label = f"/dev/{name} {model}".strip()
        result.append(Drive(f"/dev/{name}", f"{label} ({format_size(size_bytes)})",
                            size_bytes, "physical"))
        # Partitionen dieses Geraets ergaenzen.
        for part in sorted(os.listdir(base)):
            if not part.startswith(name):
                continue
            psize = _read_int(os.path.join(base, part, "size"))
            psize_bytes = psize * 512 if psize else None
            result.append(Drive(f"/dev/{part}", f"/dev/{part} ({format_size(psize_bytes)})",
                                psize_bytes, "volume"))
    return result


# -- macOS ---------------------------------------------------------------

def _list_macos() -> list[Drive]:
    out = _run(["diskutil", "list"])
    result: list[Drive] = []
    if not out:
        return result
    for line in out.splitlines():
        m = re.match(r"^(/dev/disk\d+)", line.strip())
        if m:
            path = m.group(1)
            result.append(Drive(path, path, None, "physical"))
    return result


# -- Hilfsfunktionen -----------------------------------------------------

def _run(cmd: list[str]) -> str | None:
    kwargs: dict = {}
    if sys.platform.startswith("win"):
        # Ohne dieses Flag blitzt beim Start aus pythonw.exe ein Konsolenfenster auf.
        kwargs["creationflags"] = getattr(subprocess, "CREATE_NO_WINDOW", 0x08000000)
    try:
        proc = subprocess.run(cmd, capture_output=True, timeout=20, check=False, **kwargs)
    except (OSError, subprocess.SubprocessError):
        return None
    if proc.returncode != 0:
        return None
    return proc.stdout.decode("utf-8", errors="replace")


def _run_powershell(script: str) -> str | None:
    # Ausgabe ausdruecklich als UTF-8, sonst kommen Umlaute in Laufwerks- und
    # Modellnamen in der OEM-Codepage (cp850) an und werden verstuemmelt.
    prefix = "[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; "
    return _run(["powershell", "-NoProfile", "-NonInteractive", "-Command", prefix + script])


# -- Ausgabeordner auf dem Quelldatentraeger? ------------------------------

def output_on_source(source_path: str, out_dir: str) -> str | None:
    """Prueft, ob ``out_dir`` auf dem Datentraeger der Quelle liegt.

    Rueckgabe: eine Begruendung (Text), wenn das so ist, sonst ``None``. Bei
    Image-Dateien besteht keine Gefahr, weil die Image-Datei selbst belegt ist
    und beim Schreiben nicht ueberschrieben wird. Wo sich der Datentraeger nicht
    bestimmen laesst, wird ``None`` geliefert (kein Fehlalarm).
    """
    try:
        if sys.platform.startswith("win"):
            return _output_on_source_windows(source_path, out_dir)
        if sys.platform.startswith("linux"):
            return _output_on_source_linux(source_path, out_dir)
    except Exception:
        return None
    return None


def _output_on_source_windows(source_path: str, out_dir: str) -> str | None:
    src = _device_path(source_path)
    m_vol = re.match(r"^\\\\\.\\([A-Z]):$", src)
    m_disk = re.match(r"^\\\\\.\\PHYSICALDRIVE(\d+)$", src)
    if not (m_vol or m_disk):
        return None                                   # Image-Datei o.Ae.
    target = _existing_ancestor(out_dir)
    letter = _path_letter(target)

    # Bevorzugt fragt das Programm Windows selbst, auf welchem Volume der
    # Ordner liegt. Das erfasst auch \\?\-Pfade, Junctions, symbolische Links
    # und Volumes, die in einen Ordner eingehaengt sind.
    out_volume = _win_final_volume(target)
    if out_volume:
        if m_vol:
            src_volume = _win_volume_of_letter(m_vol.group(1))
            if src_volume:
                if src_volume.lower() != out_volume.lower():
                    return None
                src_letter = m_vol.group(1)
                if letter == src_letter:
                    return f"Der Ausgabeordner liegt auf {src_letter}:, also auf der Quelle selbst."
                return (f"Der Ausgabeordner verweist auf {src_letter}: (Verknüpfung oder "
                        "eingehängtes Laufwerk) und liegt damit auf der Quelle selbst.")
        else:
            disks = _win_volume_disks(out_volume)
            if disks is not None:
                if int(m_disk.group(1)) in disks:
                    return ("Der Ausgabeordner liegt auf einer Partition der gewaehlten "
                            f"Platte (Datentraeger {m_disk.group(1)}).")
                return None

    # Rueckfall ohne Windows-Abfrage: Laufwerksbuchstabe aus dem Pfad.
    if not letter:
        return None                                   # Netzpfad o.Ae.
    if m_vol:
        if m_vol.group(1) == letter:
            return f"Der Ausgabeordner liegt auf {letter}:, also auf der Quelle selbst."
        return None
    if letter in windows_disk_letters(int(m_disk.group(1))):
        return (f"Der Ausgabeordner liegt auf {letter}:, einer Partition der "
                f"gewaehlten Platte (Datentraeger {m_disk.group(1)}).")
    return None


def _device_path(path: str) -> str:
    r"""Geraetepfad vereinheitlichen: ``\\?\C:`` wie ``\\.\C:``, Grossbuchstaben."""
    path = path.upper().rstrip("\\")
    if path.startswith("\\\\?\\") and not path.startswith("\\\\?\\UNC\\"):
        path = "\\\\.\\" + path[4:]
    return path


def _strip_prefix(path: str) -> str:
    r"""Erweiterte Praefixe entfernen: ``\\?\C:\x`` -> ``C:\x``,
    ``\\?\UNC\srv\f`` -> ``\\srv\f``."""
    upper = path.upper()
    if upper.startswith("\\\\?\\UNC\\"):
        return "\\\\" + path[8:]
    if re.match(r"^\\\\[?.]\\[A-Z]:", upper):
        return path[4:]
    return path                      # z.B. \\?\Volume{...}\ bleibt, wie es ist


def _path_letter(path: str) -> str | None:
    drive = os.path.splitdrive(_strip_prefix(path))[0]
    if len(drive) == 2 and drive[1] == ":" and drive[0].isalpha():
        return drive[0].upper()
    return None


def _existing_ancestor(path: str) -> str:
    """Naechster existierender Ordner (das Ziel wird oft erst angelegt)."""
    path = _strip_prefix(path)
    path = os.path.abspath(path)
    while not os.path.exists(path):
        parent = os.path.dirname(path)
        if parent == path:
            break
        path = parent
    return path


def _kernel32():
    import ctypes
    from ctypes import wintypes
    k32 = ctypes.WinDLL("kernel32", use_last_error=True)
    k32.CreateFileW.restype = wintypes.HANDLE
    k32.CreateFileW.argtypes = [wintypes.LPCWSTR, wintypes.DWORD, wintypes.DWORD,
                                wintypes.LPVOID, wintypes.DWORD, wintypes.DWORD,
                                wintypes.HANDLE]
    k32.CloseHandle.argtypes = [wintypes.HANDLE]
    k32.GetFinalPathNameByHandleW.restype = wintypes.DWORD
    k32.GetFinalPathNameByHandleW.argtypes = [wintypes.HANDLE, wintypes.LPWSTR,
                                              wintypes.DWORD, wintypes.DWORD]
    k32.GetVolumeNameForVolumeMountPointW.restype = wintypes.BOOL
    k32.GetVolumeNameForVolumeMountPointW.argtypes = [wintypes.LPCWSTR, wintypes.LPWSTR,
                                                      wintypes.DWORD]
    k32.DeviceIoControl.restype = wintypes.BOOL
    k32.DeviceIoControl.argtypes = [wintypes.HANDLE, wintypes.DWORD, wintypes.LPVOID,
                                    wintypes.DWORD, wintypes.LPVOID, wintypes.DWORD,
                                    ctypes.POINTER(wintypes.DWORD), wintypes.LPVOID]
    return k32


_INVALID_HANDLE = -1 & 0xFFFFFFFFFFFFFFFF


def _open_handle(k32, path: str, flags: int):
    # Zugriff 0: nur Abfragen, keine Lese- oder Schreibrechte noetig.
    handle = k32.CreateFileW(path, 0, 0x7, None, 3, flags, None)
    if handle in (None, 0, _INVALID_HANDLE, -1):
        return None
    return handle


def _win_final_volume(path: str) -> str | None:
    r"""Volume-GUID-Pfad (``\\?\Volume{...}\``), auf dem ``path`` wirklich liegt."""
    if not sys.platform.startswith("win"):
        return None
    try:
        import ctypes
        k32 = _kernel32()
        handle = _open_handle(k32, path, 0x02000000)   # FILE_FLAG_BACKUP_SEMANTICS
        if handle is None:
            return None
        try:
            buf = ctypes.create_unicode_buffer(1024)
            n = k32.GetFinalPathNameByHandleW(handle, buf, 1024, 0x1)   # VOLUME_NAME_GUID
        finally:
            k32.CloseHandle(handle)
        if not n or n >= 1024:
            return None
        m = re.match(r"^\\\\\?\\Volume\{[0-9A-Fa-f-]+\}", buf.value)
        return m.group(0) + "\\" if m else None
    except Exception:
        return None


def _win_volume_of_letter(letter: str) -> str | None:
    if not sys.platform.startswith("win"):
        return None
    try:
        import ctypes
        k32 = _kernel32()
        buf = ctypes.create_unicode_buffer(64)
        if not k32.GetVolumeNameForVolumeMountPointW(f"{letter}:\\", buf, 64):
            return None
        return buf.value
    except Exception:
        return None


def _win_volume_disks(volume: str) -> set[int] | None:
    """Nummern der physischen Platten, auf denen ein Volume liegt."""
    if not sys.platform.startswith("win"):
        return None
    try:
        import ctypes
        import struct
        from ctypes import wintypes
        k32 = _kernel32()
        handle = _open_handle(k32, volume.rstrip("\\"), 0)
        if handle is None:
            return None
        try:
            out = ctypes.create_string_buffer(8 + 24 * 32)
            returned = wintypes.DWORD(0)
            ok = k32.DeviceIoControl(handle, 0x00560000, None, 0, out, len(out),
                                     ctypes.byref(returned), None)
        finally:
            k32.CloseHandle(handle)
        if not ok:
            return None
        raw = out.raw
        count = struct.unpack_from("<I", raw, 0)[0]
        if count == 0 or count > 32:
            return None
        return {struct.unpack_from("<I", raw, 8 + 24 * i)[0] for i in range(count)}
    except Exception:
        return None


def windows_disk_letters(disk_number: int) -> list[str]:
    """Laufwerksbuchstaben aller Partitionen einer physischen Platte."""
    ps = (f"Get-Partition -DiskNumber {int(disk_number)} | "
          "Where-Object { $_.DriveLetter } | ForEach-Object { $_.DriveLetter }")
    out = _run_powershell(ps) or ""
    return [line.strip().upper() for line in out.splitlines() if len(line.strip()) == 1]


def _output_on_source_linux(source_path: str, out_dir: str) -> str | None:
    if not source_path.startswith("/dev/"):
        return None
    src_disk = _linux_disk_of(os.path.basename(os.path.realpath(source_path)))
    st = os.stat(out_dir if os.path.exists(out_dir) else os.path.dirname(os.path.abspath(out_dir)))
    link = f"/sys/dev/block/{os.major(st.st_dev)}:{os.minor(st.st_dev)}"
    if not os.path.exists(link):
        return None
    out_disk = _linux_disk_of(os.path.basename(os.path.realpath(link)))
    if src_disk and src_disk == out_disk:
        return f"Der Ausgabeordner liegt auf /dev/{out_disk}, also auf der Quelle selbst."
    return None


def _linux_disk_of(devname: str) -> str | None:
    """'sdb1' -> 'sdb', 'nvme0n1p2' -> 'nvme0n1'; ganze Platten bleiben."""
    real = os.path.realpath(f"/sys/class/block/{devname}")
    if not os.path.exists(real):
        return None
    if os.path.exists(os.path.join(real, "partition")):
        return os.path.basename(os.path.dirname(real))
    return os.path.basename(real)


def _parse_csv(text: str) -> list[dict]:
    import csv
    import io
    reader = csv.DictReader(io.StringIO(text))
    return [row for row in reader]


def _to_int(value) -> int | None:
    try:
        return int(str(value).strip())
    except (TypeError, ValueError):
        return None


def _read_int(path: str) -> int | None:
    try:
        with open(path, "r", encoding="ascii") as fh:
            return int(fh.read().strip())
    except (OSError, ValueError):
        return None


def _read_str(path: str) -> str | None:
    try:
        with open(path, "r", encoding="utf-8", errors="replace") as fh:
            return fh.read().strip()
    except OSError:
        return None
