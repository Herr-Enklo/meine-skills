"""FAT12/16/32-Undelete (Metadaten-Analyse, Kategorie 1).

FAT verwaltet Dateien in Verzeichniseintraegen zu je 32 Byte. Wird eine Datei
geloescht, ersetzt Windows nur das erste Namensbyte durch ``0xE5`` und gibt die
FAT-Kette frei; Name, Groesse und Startcluster bleiben im Eintrag erhalten. Der
Parser liest die Verzeichnisse, sammelt diese Eintraege und rekonstruiert die
Datei unter der ueblichen Annahme, dass sie zusammenhaengend gespeichert war
(die freigegebene Cluster-Kette ist meist nicht mehr auslesbar).

Bewusst auf das Undelete beschraenkt: gelesen wird nur, Namen und Ordnerpfade
bleiben erhalten, Zeitstempel werden aus dem Eintrag uebernommen.
"""

from __future__ import annotations

import struct
from typing import Callable, Iterator, Optional

from .models import Finding

ProgressCb = Callable[[str, float, int], None]
CancelCb = Callable[[], bool]

ATTR_LFN = 0x0F
ATTR_DIRECTORY = 0x10
ATTR_VOLUME_ID = 0x08
DELETED = 0xE5
END_OF_DIR = 0x00


class FatError(Exception):
    pass


class FatBoot:
    """Ausgewertetes BPB eines FAT-Boot-Sektors."""

    def __init__(self, data: bytes, base_offset: int = 0):
        if len(data) < 512 or data[510:512] != b"\x55\xAA":
            raise FatError("keine Boot-Signatur")
        if data[3:11] == b"NTFS    " or data[3:11] == b"EXFAT   ":
            raise FatError("kein FAT (NTFS/exFAT)")
        self.base = base_offset
        self.bytes_per_sector = struct.unpack_from("<H", data, 0x0B)[0]
        self.sectors_per_cluster = data[0x0D]
        self.reserved_sectors = struct.unpack_from("<H", data, 0x0E)[0]
        self.num_fats = data[0x10]
        self.root_entries = struct.unpack_from("<H", data, 0x11)[0]
        total16 = struct.unpack_from("<H", data, 0x13)[0]
        fat16_size = struct.unpack_from("<H", data, 0x16)[0]
        total32 = struct.unpack_from("<I", data, 0x20)[0]
        fat32_size = struct.unpack_from("<I", data, 0x24)[0]
        self.root_cluster = struct.unpack_from("<I", data, 0x2C)[0]

        if self.bytes_per_sector not in (512, 1024, 2048, 4096):
            raise FatError("ungueltige Sektorgroesse")
        if self.sectors_per_cluster == 0 or (self.sectors_per_cluster & (self.sectors_per_cluster - 1)):
            raise FatError("ungueltige Clustergroesse")
        if self.num_fats not in (1, 2):
            raise FatError("ungueltige FAT-Anzahl")

        self.fat_size = fat16_size or fat32_size
        self.total_sectors = total16 or total32
        if self.fat_size == 0 or self.total_sectors == 0:
            raise FatError("kein FAT-Layout")

        self.cluster_size = self.bytes_per_sector * self.sectors_per_cluster
        root_dir_bytes = self.root_entries * 32
        self.root_dir_sectors = (root_dir_bytes + self.bytes_per_sector - 1) // self.bytes_per_sector
        self.first_data_sector = (self.reserved_sectors
                                  + self.num_fats * self.fat_size
                                  + self.root_dir_sectors)
        data_sectors = self.total_sectors - self.first_data_sector
        if data_sectors <= 0:
            raise FatError("kein Datenbereich")
        self.cluster_count = data_sectors // self.sectors_per_cluster

        if self.cluster_count < 4085:
            self.fat_type = "fat12"
        elif self.cluster_count < 65525:
            self.fat_type = "fat16"
        else:
            self.fat_type = "fat32"

    def cluster_offset(self, cluster: int) -> int:
        sector = self.first_data_sector + (cluster - 2) * self.sectors_per_cluster
        return self.base + sector * self.bytes_per_sector

    def fat_offset(self) -> int:
        return self.base + self.reserved_sectors * self.bytes_per_sector


def _next_cluster(source, boot: FatBoot, cluster: int) -> Optional[int]:
    """Naechster Cluster in der Kette, oder None bei Ende/frei/defekt."""
    base = boot.fat_offset()
    if boot.fat_type == "fat32":
        val = struct.unpack_from("<I", source.read(base + cluster * 4, 4))[0] & 0x0FFFFFFF
        end = 0x0FFFFFF8
    elif boot.fat_type == "fat16":
        val = struct.unpack_from("<H", source.read(base + cluster * 2, 2))[0]
        end = 0xFFF8
    else:  # fat12
        off = cluster + cluster // 2
        raw = struct.unpack_from("<H", source.read(base + off, 2))[0]
        val = (raw >> 4) if (cluster & 1) else (raw & 0x0FFF)
        end = 0xFF8
    if val < 2 or val >= end:
        return None
    return val


def _read_directory(source, boot: FatBoot, start_cluster: Optional[int]) -> bytes:
    """Liest die Bytes eines Verzeichnisses (Wurzel oder Cluster-Kette)."""
    if start_cluster is None:  # FAT12/16-Wurzelverzeichnis: fester Bereich
        root_sector = boot.reserved_sectors + boot.num_fats * boot.fat_size
        offset = boot.base + root_sector * boot.bytes_per_sector
        return source.read(offset, boot.root_entries * 32)

    out = bytearray()
    cluster = start_cluster
    seen: set[int] = set()
    while cluster and cluster not in seen and len(out) < 64 * 1024 * 1024:
        seen.add(cluster)
        out += source.read(boot.cluster_offset(cluster), boot.cluster_size)
        cluster = _next_cluster(source, boot, cluster)
    return bytes(out)


def _short_name(entry: bytes, deleted: bool) -> str:
    name = entry[0:8].decode("ascii", "replace").rstrip(" ")
    ext = entry[8:11].decode("ascii", "replace").rstrip(" ")
    if deleted and name:
        name = "_" + name[1:]     # verlorenes erstes Zeichen markieren
    return f"{name}.{ext}" if ext else name


def _lfn_chars(entry: bytes) -> str:
    raw = entry[1:11] + entry[14:26] + entry[28:32]
    text = raw.decode("utf-16-le", "replace")
    return text.split("\x00", 1)[0]


def _fat_datetime(entry: bytes) -> Optional[str]:
    time = struct.unpack_from("<H", entry, 0x16)[0]
    date = struct.unpack_from("<H", entry, 0x18)[0]
    if date == 0:
        return None
    year = 1980 + (date >> 9)
    month = (date >> 5) & 0x0F
    day = date & 0x1F
    hour = time >> 11
    minute = (time >> 5) & 0x3F
    second = (time & 0x1F) * 2
    if not (1 <= month <= 12 and 1 <= day <= 31):
        return None
    return f"{year:04d}-{month:02d}-{day:02d} {hour:02d}:{minute:02d}:{second:02d}"


def scan_fat(source, base_offset: int = 0, deleted_only: bool = True,
             progress_cb: Optional[ProgressCb] = None,
             should_cancel: Optional[CancelCb] = None) -> Iterator[Finding]:
    """Durchsucht ein FAT-Volume ab ``base_offset`` nach (geloeschten) Dateien."""
    boot = FatBoot(source.read(base_offset, 512), base_offset)
    if progress_cb:
        progress_cb("FAT-Verzeichnisse lesen", 0.0, 0)

    findings: list[Finding] = []
    counter = [0]
    _walk(source, boot, None, "", 0, findings, counter, deleted_only, set(),
          should_cancel)
    for f in findings:
        yield f


def _walk(source, boot: FatBoot, start_cluster: Optional[int], path: str,
          depth: int, findings: list, counter: list, deleted_only: bool,
          visited: set, should_cancel) -> None:
    if depth > 32 or (should_cancel and should_cancel()):
        return
    data = _read_directory(source, boot, start_cluster)
    lfn = ""
    for i in range(0, len(data) - 31, 32):
        entry = data[i:i + 32]
        first = entry[0]
        if first == END_OF_DIR:
            lfn = ""
            continue
        attr = entry[0x0B]
        if attr == ATTR_LFN:
            # Bei geloeschten Eintraegen ist die Reihenfolge unsicher; wir haengen
            # die Teile in physischer Reihenfolge an (beste Naeherung).
            if first == DELETED:
                lfn = _lfn_chars(entry) + lfn
            else:
                lfn = _lfn_chars(entry) + lfn
            continue
        if attr & ATTR_VOLUME_ID and not (attr & ATTR_DIRECTORY):
            lfn = ""
            continue

        deleted = (first == DELETED)
        short = _short_name(entry, deleted)
        name = (lfn.strip() or short) if not deleted else short
        lfn = ""
        if short.startswith(".") or entry[0:1] in (b".", b"\x2e"):
            continue

        first_cluster = (struct.unpack_from("<H", entry, 0x14)[0] << 16) \
            | struct.unpack_from("<H", entry, 0x1A)[0]
        size = struct.unpack_from("<I", entry, 0x1C)[0]

        if attr & ATTR_DIRECTORY:
            if not deleted and first_cluster >= 2 and first_cluster not in visited:
                visited.add(first_cluster)
                sub = f"{path}/{name}" if path else name
                _walk(source, boot, first_cluster, sub, depth + 1, findings,
                      counter, deleted_only, visited, should_cancel)
            continue

        if deleted_only and not deleted:
            continue
        if size <= 0 or first_cluster < 2:
            continue

        counter[0] += 1
        full = f"{path}/{name}" if path else name
        ext = name.rsplit(".", 1)[-1].lower() if "." in name else "bin"
        findings.append(Finding(
            kind="fat",
            type_name="FAT-Datei" + ("" if not deleted else " (geloescht)"),
            ext=ext,
            name=f"{counter[0]:06d}_{_safe(full)}",
            offset=boot.cluster_offset(first_cluster),
            size=size,
            extra={"path": full, "modified": _fat_datetime(entry),
                   "fs": boot.fat_type},
        ))


def _safe(name: str) -> str:
    keep = []
    for ch in name:
        if ch in '<>:"\\|?*' or ord(ch) < 32:
            keep.append("_")
        elif ch == "/":
            keep.append("_")
        else:
            keep.append(ch)
    return "".join(keep).strip(" .") or "unbenannt"


def is_fat(source, base_offset: int = 0) -> bool:
    try:
        FatBoot(source.read(base_offset, 512), base_offset)
        return True
    except FatError:
        return False
