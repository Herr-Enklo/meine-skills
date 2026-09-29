"""Lesender Byte-Zugriff auf eine Quelle (Image-Datei oder physisches Laufwerk).

Zentrale Sicherheitsregel: Eine ``ByteSource`` wird ausschliesslich zum Lesen
geoeffnet. Es gibt bewusst keine Schreibmethode. Damit kann das Werkzeug die
Quelle niemals veraendern, egal welcher Teil der Engine sie benutzt.

Drei Eigenschaften sind fuer die Praxis entscheidend:

- **Echte Groessenerkennung.** Rohe Geraete melden ihre Groesse nicht ueber
  ``lseek``. Deshalb wird sie ueber Betriebssystem-Aufrufe abgefragt
  (Windows: ``IOCTL_DISK_GET_LENGTH_INFO``; Linux: ``BLKGETSIZE64``). Ohne
  korrekte Groesse laeuft ein Scan ins Leere oder bricht zu frueh ab.
- **Sektorgroesse automatisch.** Rohe Geraete erlauben nur Zugriffe, die an
  ihrer logischen Sektorgroesse ausgerichtet sind (512 oder 4096 Byte bei
  4Kn). Sie wird beim Oeffnen abgefragt, kann aber vorgegeben werden.
- **Fehlertolerantes Lesen.** Ein defekter oder gesperrter Sektor darf den
  Scan nicht stillschweigend beenden. Lesefehler werden aufgefangen, der
  Bereich wird mit Nullen ueberbrueckt und gezaehlt. Liegen viele defekte
  Sektoren hintereinander, wird der Rest des Bereichs uebersprungen, statt
  jeden Sektor einzeln anzufragen – auf einer sterbenden Platte kann jeder
  Fehlversuch Sekunden dauern und belastet die Mechanik zusaetzlich.
"""

from __future__ import annotations

import os
import struct
import sys

DEFAULT_SECTOR = 512
_VALID_SECTORS = (512, 1024, 2048, 4096)

# Fehlerbehandlung beim Lesen.
_SUBBLOCK = 64 * 1024            # Blockgroesse fuer den zweiten Leseversuch
BAD_RUN_LIMIT = 8                # so viele defekte Sektoren in Folge ...
SKIP_AHEAD = 1024 * 1024         # ... dann wird dieser Bereich uebersprungen


class ByteSource:
    """Quelle, aus der byteweise gelesen werden kann.

    Parameter
    ---------
    path:
        Pfad zur Image-Datei oder zum Geraet (z.B. ``disk.dd`` oder
        ``\\\\.\\PhysicalDrive0``).
    size:
        Bekannte Groesse in Bytes. Wird ``None`` uebergeben, ermittelt die
        Klasse die Groesse selbst (bei Geraeten ueber das Betriebssystem).
    sector_size:
        Ausrichtung fuer rohe Zugriffe. ``None`` (Standard) fragt die logische
        Sektorgroesse des Geraets ab und nimmt fuer Image-Dateien 512.
        Ein fester Wert (512 oder 4096) ueberschreibt die Erkennung.
    """

    def __init__(self, path: str, size: int | None = None,
                 sector_size: int | None = None):
        self.path = path
        self._requested_sector = sector_size if sector_size in _VALID_SECTORS else None
        self.sector_size = self._requested_sector or DEFAULT_SECTOR
        self._size = size
        self._fd: int | None = None
        # Betriebskennzahlen, nach dem Scan auswertbar.
        self.bytes_read = 0
        self.bad_sectors = 0         # Leseversuche, die fehlschlugen
        self.skipped_sectors = 0     # nach einer Fehlerserie nicht mehr versucht
        # Weiteste Stelle, bis zu der ein linearer Durchlauf gekommen ist. Anders
        # als ``bytes_read`` zaehlt hier kein Bereich doppelt.
        self.scanned_until = 0

    # -- Lebenszyklus ----------------------------------------------------

    def open(self) -> "ByteSource":
        flags = os.O_RDONLY | getattr(os, "O_BINARY", 0)
        self._fd = os.open(self.path, flags)
        if self._requested_sector is None and _is_device(self.path):
            detected = _ioctl_sector_size(self._fd)
            if detected:
                self.sector_size = detected
        if self._size is None:
            self._size = self._determine_size()
        return self

    def close(self) -> None:
        if self._fd is not None:
            try:
                os.close(self._fd)
            finally:
                self._fd = None

    def __enter__(self) -> "ByteSource":
        return self.open()

    def __exit__(self, exc_type, exc, tb) -> None:
        self.close()

    # -- Groesse ---------------------------------------------------------

    @property
    def size(self) -> int | None:
        return self._size

    @property
    def unreadable_sectors(self) -> int:
        """Alle Sektoren, die mit Nullen ueberbrueckt wurden."""
        return self.bad_sectors + self.skipped_sectors

    def _determine_size(self) -> int | None:
        assert self._fd is not None
        is_dev = _is_device(self.path)

        # Bei echten Geraeten zuerst das Betriebssystem fragen – ``lseek`` liefert
        # dort meist 0 oder Muell.
        if is_dev:
            s = _ioctl_size(self._fd)
            if s:
                return s

        try:
            end = os.lseek(self._fd, 0, os.SEEK_END)
            os.lseek(self._fd, 0, os.SEEK_SET)
            if end > 0 and not is_dev:
                return end
            if end > 0 and is_dev:
                # Bei Geraeten nur als letzter Ausweg, falls ioctl versagte.
                fallback = end
            else:
                fallback = None
        except OSError:
            fallback = None

        if is_dev:
            s = _linux_block_size(self.path)
            if s:
                return s
        return fallback

    # -- Lesen -----------------------------------------------------------

    def read(self, offset: int, length: int) -> bytes:
        """Liest ``length`` Bytes ab ``offset``.

        Sektorweise ausgerichtet, damit auch rohe Geraete gelesen werden koennen.
        Defekte Sektoren werden mit Nullen ueberbrueckt (und gezaehlt), statt den
        Zugriff scheitern zu lassen. Am Ende der Quelle koennen weniger Bytes
        zurueckkommen als angefordert.
        """
        if self._fd is None:
            raise RuntimeError("ByteSource ist nicht geoeffnet")
        if length <= 0:
            return b""
        if offset < 0:
            raise ValueError("offset darf nicht negativ sein")
        if self._size is not None:
            if offset >= self._size:
                return b""
            length = min(length, self._size - offset)

        sector = self.sector_size
        start = (offset // sector) * sector
        end_aligned = ((offset + length + sector - 1) // sector) * sector
        raw = self._raw_read(start, end_aligned - start)
        rel = offset - start
        return raw[rel:rel + length]

    def _try_read(self, offset: int, want: int) -> bytes | None:
        """Ein einzelner Leseversuch; ``None`` bei einem Lesefehler."""
        assert self._fd is not None
        try:
            os.lseek(self._fd, offset, os.SEEK_SET)
            return os.read(self._fd, want)
        except OSError:
            return None

    def _raw_read(self, offset: int, want: int) -> bytes:
        """Liest ``want`` Bytes ab dem (sektorweise ausgerichteten) ``offset``.

        Erst ein schneller Blockversuch; erst bei einem Fehler wird in kleineren
        Bloecken und schliesslich sektorweise nachgelesen.
        """
        data = self._try_read(offset, want)
        if data is not None:
            self.bytes_read += len(data)
            return data
        return self._read_tolerant(offset, want)

    def _read_tolerant(self, offset: int, want: int) -> bytes:
        sector = self.sector_size
        sub = max(sector, (_SUBBLOCK // sector) * sector)
        out = bytearray()
        pos = offset
        end = offset + want
        bad_run = 0
        while pos < end:
            n = min(sub, end - pos)
            data = self._try_read(pos, n)
            if data is not None:
                if not data:
                    break                          # echtes Ende der Quelle
                out += data
                self.bytes_read += len(data)
                pos += len(data)
                bad_run = 0
                if len(data) < n:
                    break
                continue
            # Teilblock nicht lesbar: sektorweise, mit Abbruch bei Fehlerserien.
            block_end = pos + n
            while pos < block_end:
                if bad_run >= BAD_RUN_LIMIT:
                    skip = min(SKIP_AHEAD, end - pos)
                    skip = max(sector, (skip // sector) * sector)
                    out += bytes(skip)
                    self.skipped_sectors += skip // sector
                    pos += skip
                    bad_run = 0
                    continue
                chunk = self._try_read(pos, sector)
                if chunk is None:
                    out += bytes(sector)           # defekter Sektor -> Nullen
                    self.bad_sectors += 1
                    bad_run += 1
                    pos += sector
                    continue
                if not chunk:
                    return bytes(out)              # echtes Ende der Quelle
                out += chunk
                self.bytes_read += len(chunk)
                pos += len(chunk)
                bad_run = 0
                if len(chunk) < sector:
                    return bytes(out)
        return bytes(out[:want])

    def stream(self, start: int = 0, chunk_size: int = 8 * 1024 * 1024):
        """Liefert die Quelle sequentiell als ``(offset, daten)``-Bloecke.

        Fuer das Carving, das den Datentraeger einmal linear durchlaeuft. Ein
        Lesefehler beendet den Durchlauf nicht, sondern ueberbrueckt den Bereich
        und macht weiter. ``chunk_size`` wird auf die Sektorgroesse gerundet.
        """
        if self._fd is None:
            raise RuntimeError("ByteSource ist nicht geoeffnet")
        sector = self.sector_size
        chunk_size = max(sector, (chunk_size // sector) * sector)
        offset = (start // sector) * sector
        empty_streak = 0
        while True:
            if self._size is not None and offset >= self._size:
                break
            want = chunk_size
            if self._size is not None:
                want = min(want, self._size - offset)
                if want <= 0:
                    break

            data = self._raw_read(offset, want)
            if not data:
                if self._size is None:
                    break                      # unbekannte Groesse: leer = Ende
                # Groesse bekannt: unlesbaren Block ueberspringen, weitermachen.
                offset += want
                empty_streak += 1
                if empty_streak > 65536:       # Sicherheitsnetz gegen Endlosschleife
                    break
                continue
            empty_streak = 0
            self.scanned_until = max(self.scanned_until, offset + len(data))
            yield offset, data
            offset += len(data)


# -- Groesse und Sektorgroesse -------------------------------------------

def _is_device(path: str) -> bool:
    return path.startswith("\\\\.\\") or path.startswith("/dev/")


def _ioctl_size(fd: int) -> int | None:
    """Fragt die Geraetegroesse ueber das Betriebssystem ab."""
    try:
        if sys.platform.startswith("win"):
            return _ioctl_size_windows(fd)
        if sys.platform.startswith("linux"):
            return _ioctl_size_linux(fd)
    except Exception:
        return None
    return None


def _ioctl_sector_size(fd: int) -> int | None:
    """Logische Sektorgroesse des Geraets (512, 4096 ...) oder None."""
    try:
        if sys.platform.startswith("win"):
            value = _ioctl_sector_windows(fd)
        elif sys.platform.startswith("linux"):
            value = _ioctl_sector_linux(fd)
        else:
            value = None
    except Exception:
        return None
    return value if value in _VALID_SECTORS else None


def _device_io_control(fd: int, code: int, out_size: int) -> bytes | None:
    """Kleiner Wrapper um ``DeviceIoControl`` (nur Windows)."""
    import ctypes
    import msvcrt
    from ctypes import wintypes

    kernel32 = ctypes.WinDLL("kernel32", use_last_error=True)
    ioctl = kernel32.DeviceIoControl
    ioctl.argtypes = [wintypes.HANDLE, wintypes.DWORD, wintypes.LPVOID, wintypes.DWORD,
                      wintypes.LPVOID, wintypes.DWORD, ctypes.POINTER(wintypes.DWORD),
                      wintypes.LPVOID]
    ioctl.restype = wintypes.BOOL
    handle = msvcrt.get_osfhandle(fd)
    buf = ctypes.create_string_buffer(out_size)
    returned = wintypes.DWORD(0)
    ok = ioctl(wintypes.HANDLE(handle), code, None, 0, buf, out_size,
               ctypes.byref(returned), None)
    if not ok:
        return None
    return buf.raw[:returned.value]


def _ioctl_size_windows(fd: int) -> int | None:
    IOCTL_DISK_GET_LENGTH_INFO = 0x0007405C
    raw = _device_io_control(fd, IOCTL_DISK_GET_LENGTH_INFO, 8)
    if raw and len(raw) >= 8:
        value = struct.unpack_from("<q", raw, 0)[0]
        return value if value > 0 else None
    return None


def _ioctl_sector_windows(fd: int) -> int | None:
    # DISK_GEOMETRY: Cylinders (8), MediaType (4), TracksPerCylinder (4),
    # SectorsPerTrack (4), BytesPerSector (4) -> BytesPerSector bei Offset 20.
    IOCTL_DISK_GET_DRIVE_GEOMETRY_EX = 0x000700A0
    IOCTL_DISK_GET_DRIVE_GEOMETRY = 0x00070000
    for code in (IOCTL_DISK_GET_DRIVE_GEOMETRY_EX, IOCTL_DISK_GET_DRIVE_GEOMETRY):
        raw = _device_io_control(fd, code, 256)
        if raw and len(raw) >= 24:
            return struct.unpack_from("<I", raw, 20)[0]
    return None


def _ioctl_size_linux(fd: int) -> int | None:
    import array
    import fcntl

    BLKGETSIZE64 = 0x80081272
    buf = array.array("B", b"\x00" * 8)
    fcntl.ioctl(fd, BLKGETSIZE64, buf, True)
    size = struct.unpack("<Q", buf.tobytes())[0]
    return size or None


def _ioctl_sector_linux(fd: int) -> int | None:
    import array
    import fcntl

    BLKSSZGET = 0x1268
    buf = array.array("i", [0])
    fcntl.ioctl(fd, BLKSSZGET, buf, True)
    return int(buf[0]) or None


def _linux_block_size(path: str) -> int | None:
    """Ermittelt die Groesse eines Linux-Blockgeraets ueber sysfs."""
    if not path.startswith("/dev/"):
        return None
    name = os.path.basename(path)
    try:
        with open(f"/sys/class/block/{name}/size", encoding="ascii") as fh:
            return int(fh.read().strip()) * 512
    except (OSError, ValueError):
        return None
