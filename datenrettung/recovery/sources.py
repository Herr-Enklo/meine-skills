"""Lesender Byte-Zugriff auf eine Quelle (Image-Datei oder physisches Laufwerk).

Zentrale Sicherheitsregel: Eine ``ByteSource`` wird ausschliesslich zum Lesen
geoeffnet. Es gibt bewusst keine Schreibmethode. Damit kann das Werkzeug die
Quelle niemals veraendern, egal welcher Teil der Engine sie benutzt.

Zwei Eigenschaften sind fuer die Praxis entscheidend:

- **Echte Groessenerkennung.** Rohe Geraete melden ihre Groesse nicht ueber
  ``lseek``. Deshalb wird sie ueber Betriebssystem-Aufrufe abgefragt
  (Windows: ``IOCTL_DISK_GET_LENGTH_INFO``; Linux: ``BLKGETSIZE64``). Ohne
  korrekte Groesse laeuft ein Scan ins Leere oder bricht zu frueh ab.
- **Fehlertolerantes Lesen.** Ein einzelner defekter oder gesperrter Sektor
  darf den Scan nicht stillschweigend beenden. Lesefehler werden pro Sektor
  aufgefangen, der Bereich wird mit Nullen ueberbrueckt und gezaehlt, der Scan
  laeuft bis zum Ende weiter.
"""

from __future__ import annotations

import os
import sys

DEFAULT_SECTOR = 512


class ByteSource:
    """Quelle, aus der byteweise gelesen werden kann.

    Parameter
    ---------
    path:
        Pfad zur Image-Datei oder zum Geraet (z.B. ``disk.dd`` oder
        ``\\\\.\\PhysicalDrive0``).
    size:
        Bekannte Groesse in Bytes. Wird ``None`` uebergeben, ermittelt die
        Klasse die Groesse selbst.
    sector_size:
        Ausrichtung fuer rohe Zugriffe. 512 passt fuer 512e-Datentraeger; 4Kn
        wird ueber ``sector_size=4096`` unterstuetzt.
    """

    def __init__(self, path: str, size: int | None = None,
                 sector_size: int = DEFAULT_SECTOR):
        self.path = path
        self.sector_size = sector_size if sector_size and sector_size > 0 else DEFAULT_SECTOR
        self._size = size
        self._fd: int | None = None
        # Betriebskennzahlen, nach dem Scan auswertbar.
        self.bytes_read = 0
        self.bad_sectors = 0

    # -- Lebenszyklus ----------------------------------------------------

    def open(self) -> "ByteSource":
        flags = os.O_RDONLY | getattr(os, "O_BINARY", 0)
        self._fd = os.open(self.path, flags)
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
        Defekte Sektoren werden mit Nullen ueberbrueckt (und in ``bad_sectors``
        gezaehlt), statt den Zugriff scheitern zu lassen. Am Ende der Quelle
        koennen weniger Bytes zurueckkommen als angefordert.
        """
        if self._fd is None:
            raise RuntimeError("ByteSource ist nicht geoeffnet")
        if length <= 0:
            return b""
        if offset < 0:
            raise ValueError("offset darf nicht negativ sein")

        sector = self.sector_size
        start = (offset // sector) * sector
        end_aligned = ((offset + length + sector - 1) // sector) * sector
        raw = self._raw_read(start, end_aligned - start)
        rel = offset - start
        return raw[rel:rel + length]

    def _raw_read(self, offset: int, want: int) -> bytes:
        """Liest ``want`` Bytes ab dem (sektorweise ausgerichteten) ``offset``.

        Erst ein schneller Blockversuch; erst bei einem Fehler wird sektorweise
        nachgelesen, damit defekte Sektoren einzeln ueberbrueckt werden.
        """
        assert self._fd is not None
        os.lseek(self._fd, offset, os.SEEK_SET)
        try:
            data = os.read(self._fd, want)
            self.bytes_read += len(data)
            return data
        except OSError:
            return self._read_sectorwise(offset, want)

    def _read_sectorwise(self, offset: int, want: int) -> bytes:
        sector = self.sector_size
        out = bytearray()
        pos = offset
        end = offset + want
        while pos < end:
            os.lseek(self._fd, pos, os.SEEK_SET)
            try:
                chunk = os.read(self._fd, sector)
            except OSError:
                chunk = None
            if chunk is None:
                out += b"\x00" * sector       # defekter Sektor -> Nullen
                self.bad_sectors += 1
                pos += sector
                continue
            if not chunk:
                break                          # echtes Ende der Quelle
            out += chunk
            self.bytes_read += len(chunk)
            pos += len(chunk)
            if len(chunk) < sector:
                break
        return bytes(out)

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
            yield offset, data
            offset += len(data)


# -- Groessenermittlung --------------------------------------------------

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


def _ioctl_size_windows(fd: int) -> int | None:
    import ctypes
    import msvcrt
    from ctypes import wintypes

    IOCTL_DISK_GET_LENGTH_INFO = 0x0007405C
    handle = msvcrt.get_osfhandle(fd)
    out = ctypes.c_longlong(0)
    returned = wintypes.DWORD(0)
    ok = ctypes.windll.kernel32.DeviceIoControl(
        wintypes.HANDLE(handle), IOCTL_DISK_GET_LENGTH_INFO,
        None, 0, ctypes.byref(out), ctypes.sizeof(out),
        ctypes.byref(returned), None)
    if ok and out.value > 0:
        return int(out.value)
    return None


def _ioctl_size_linux(fd: int) -> int | None:
    import array
    import fcntl
    import struct

    BLKGETSIZE64 = 0x80081272
    buf = array.array("B", b"\x00" * 8)
    fcntl.ioctl(fd, BLKGETSIZE64, buf, True)
    size = struct.unpack("<Q", buf.tobytes())[0]
    return size or None


def _linux_block_size(path: str) -> int | None:
    """Ermittelt die Groesse eines Linux-Blockgeraets ueber sysfs."""
    if not path.startswith("/dev/"):
        return None
    name = os.path.basename(path)
    try:
        with open(f"/sys/class/block/{name}/size", "r", encoding="ascii") as fh:
            return int(fh.read().strip()) * 512
    except (OSError, ValueError):
        return None
