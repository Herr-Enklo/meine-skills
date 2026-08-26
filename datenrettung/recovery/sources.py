"""Lesender Byte-Zugriff auf eine Quelle (Image-Datei oder physisches Laufwerk).

Zentrale Sicherheitsregel: Eine ``ByteSource`` wird ausschliesslich zum Lesen
geoeffnet. Es gibt bewusst keine Schreibmethode. Damit kann das Werkzeug die
Quelle niemals veraendern, egal welcher Teil der Engine sie benutzt.

Rohe Geraete (unter Windows ``\\\\.\\PhysicalDrive0`` bzw. ``\\\\.\\C:``,
unter Linux ``/dev/sdX``) verlangen sektorweise ausgerichtete Zugriffe. Deshalb
richtet ``read`` jeden Zugriff intern an der Sektorgroesse aus und schneidet den
angeforderten Bereich anschliessend heraus.
"""

from __future__ import annotations

import os

DEFAULT_SECTOR = 512


class ByteSource:
    """Quelle, aus der byteweise gelesen werden kann.

    Parameter
    ---------
    path:
        Pfad zur Image-Datei oder zum Geraet (z.B. ``disk.dd`` oder
        ``\\\\.\\PhysicalDrive0``).
    size:
        Bekannte Groesse in Bytes. Wird ``None`` uebergeben, versucht die Klasse
        die Groesse selbst zu bestimmen (funktioniert bei Dateien zuverlaessig,
        bei Geraeten nicht immer).
    sector_size:
        Ausrichtung fuer rohe Zugriffe. 512 passt praktisch immer; moderne
        Datentraeger mit 4K-Sektoren funktionieren damit ebenfalls, weil 4096
        ein Vielfaches von 512 ist.
    """

    def __init__(self, path: str, size: int | None = None,
                 sector_size: int = DEFAULT_SECTOR):
        self.path = path
        self.sector_size = sector_size if sector_size and sector_size > 0 else DEFAULT_SECTOR
        self._size = size
        self._fd: int | None = None

    # -- Lebenszyklus ----------------------------------------------------

    def open(self) -> "ByteSource":
        flags = os.O_RDONLY
        # Unter Windows sorgt O_BINARY dafuer, dass keine Zeilenendeumwandlung
        # stattfindet. Auf anderen Plattformen existiert das Flag nicht.
        flags |= getattr(os, "O_BINARY", 0)
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
        try:
            end = os.lseek(self._fd, 0, os.SEEK_END)
            os.lseek(self._fd, 0, os.SEEK_SET)
            if end > 0:
                return end
        except OSError:
            pass
        # Fallback fuer Linux-Blockgeraete: Groesse aus sysfs lesen.
        return _linux_block_size(self.path)

    # -- Lesen -----------------------------------------------------------

    def read(self, offset: int, length: int) -> bytes:
        """Liest ``length`` Bytes ab ``offset``.

        Der Zugriff wird intern an der Sektorgroesse ausgerichtet, damit auch
        rohe Geraete gelesen werden koennen. Am Dateiende koennen weniger Bytes
        zurueckkommen als angefordert.
        """
        if self._fd is None:
            raise RuntimeError("ByteSource ist nicht geoeffnet")
        if length <= 0:
            return b""
        if offset < 0:
            raise ValueError("offset darf nicht negativ sein")

        sector = self.sector_size
        start = (offset // sector) * sector
        end = offset + length
        end_aligned = ((end + sector - 1) // sector) * sector
        to_read = end_aligned - start

        os.lseek(self._fd, start, os.SEEK_SET)
        buf = bytearray()
        while len(buf) < to_read:
            try:
                chunk = os.read(self._fd, to_read - len(buf))
            except OSError:
                break
            if not chunk:
                break
            buf += chunk

        rel = offset - start
        return bytes(buf[rel:rel + length])

    def stream(self, start: int = 0, chunk_size: int = 4 * 1024 * 1024):
        """Liefert die Quelle sequentiell als ``(offset, daten)``-Bloecke.

        Ideal fuer das Carving, das den gesamten Datentraeger einmal linear
        durchlaeuft. ``chunk_size`` wird auf die Sektorgroesse gerundet.
        """
        if self._fd is None:
            raise RuntimeError("ByteSource ist nicht geoeffnet")
        sector = self.sector_size
        chunk_size = max(sector, (chunk_size // sector) * sector)
        offset = (start // sector) * sector
        while True:
            if self._size is not None and offset >= self._size:
                break
            want = chunk_size
            if self._size is not None:
                want = min(want, self._size - offset)
                if want <= 0:
                    break
            # Vor jedem Block neu positionieren: so bleibt der Stream korrekt,
            # auch wenn zwischendurch read() an anderer Stelle gelesen hat.
            os.lseek(self._fd, offset, os.SEEK_SET)
            try:
                data = os.read(self._fd, want)
            except OSError:
                break
            if not data:
                break
            yield offset, data
            offset += len(data)


def _linux_block_size(path: str) -> int | None:
    """Ermittelt die Groesse eines Linux-Blockgeraets ueber sysfs."""
    if not path.startswith("/dev/"):
        return None
    name = os.path.basename(path)
    sysfs = f"/sys/class/block/{name}/size"
    try:
        with open(sysfs, "r", encoding="ascii") as fh:
            sectors = int(fh.read().strip())
        return sectors * 512
    except (OSError, ValueError):
        return None
