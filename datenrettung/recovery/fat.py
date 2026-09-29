"""FAT12/16/32-Undelete (Metadaten-Analyse, Kategorie 1).

FAT verwaltet Dateien in Verzeichniseintraegen zu je 32 Byte. Wird eine Datei
geloescht, ersetzt Windows nur das erste Namensbyte durch ``0xE5`` und gibt die
FAT-Kette frei; Name, Groesse und Startcluster bleiben im Eintrag erhalten.

Rekonstruktion:

- Vorhandene Dateien (Modus "alle Dateien") folgen ihrer intakten FAT-Kette.
- Geloeschte Dateien werden ab dem Startcluster aus *freien* Clustern
  zusammengesetzt; Cluster, die inzwischen einer anderen Datei gehoeren,
  werden uebersprungen. Das ist dasselbe Verfahren wie bei The Sleuth Kit und
  rettet auch Dateien, die um noch vorhandene Dateien herum gespeichert waren.
- Geloeschte Ordner werden ebenfalls durchsucht: ihr Inhalt liegt noch im
  ersten Cluster (und meist den folgenden freien Clustern).

Der Zustand jedes Funds sagt, wie verlaesslich die Rekonstruktion ist.
"""

from __future__ import annotations

import struct
import time
from typing import Iterator, Optional

from .models import CancelCb, Finding, ProgressCb, safe_name

ATTR_LFN = 0x0F
ATTR_DIRECTORY = 0x10
ATTR_VOLUME_ID = 0x08
DELETED = 0xE5
END_OF_DIR = 0x00

MAX_DIR_BYTES = 64 * 1024 * 1024       # Obergrenze fuer ein einzelnes Verzeichnis
MAX_DELETED_DIR_CLUSTERS = 256          # geloeschte Ordner: so weit wird gelesen


class FatError(Exception):
    pass


class FatBoot:
    """Ausgewertetes und geprueftes BPB eines FAT-Boot-Sektors."""

    def __init__(self, data: bytes, base_offset: int = 0):
        if len(data) < 512 or data[510:512] != b"\x55\xAA":
            raise FatError("keine Boot-Signatur")
        if data[3:11] in (b"NTFS    ", b"EXFAT   ", b"-FVE-FS-"):
            raise FatError("kein FAT (NTFS/exFAT/BitLocker)")
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
        spc = self.sectors_per_cluster
        if spc == 0 or spc & (spc - 1):
            raise FatError("ungueltige Clustergroesse")
        if self.num_fats not in (1, 2):
            raise FatError("ungueltige FAT-Anzahl")
        if self.reserved_sectors == 0:
            raise FatError("keine reservierten Sektoren")

        self.fat_size = fat16_size or fat32_size
        self.total_sectors = total16 or total32
        if self.fat_size == 0 or self.total_sectors == 0:
            raise FatError("kein FAT-Layout")

        self.cluster_size = self.bytes_per_sector * spc
        root_dir_bytes = self.root_entries * 32
        self.root_dir_sectors = (root_dir_bytes + self.bytes_per_sector - 1) // self.bytes_per_sector
        self.first_data_sector = (self.reserved_sectors
                                  + self.num_fats * self.fat_size
                                  + self.root_dir_sectors)
        data_sectors = self.total_sectors - self.first_data_sector
        if data_sectors <= 0:
            raise FatError("kein Datenbereich")
        self.cluster_count = data_sectors // spc
        self.max_cluster = self.cluster_count + 1

        # Der FAT-Typ ergibt sich laut Spezifikation aus der Clusterzahl. Manche
        # Formatierer legen aber auch kleine Volumes im FAT32-Layout an (kein
        # FAT16-Groessenfeld, kein festes Wurzelverzeichnis); Linux entscheidet
        # dann ebenfalls nach dem Layout.
        if fat16_size == 0 and self.root_entries == 0:
            self.fat_type = "fat32"
        elif self.cluster_count < 4085:
            self.fat_type = "fat12"
        elif self.cluster_count < 65525:
            self.fat_type = "fat16"
        else:
            self.fat_type = "fat32"
        if self.fat_type == "fat32" and not (2 <= self.root_cluster <= self.max_cluster):
            raise FatError("ungueltiger Wurzel-Cluster")

    def cluster_offset(self, cluster: int) -> int:
        sector = self.first_data_sector + (cluster - 2) * self.sectors_per_cluster
        return self.base + sector * self.bytes_per_sector

    def fat_offset(self) -> int:
        return self.base + self.reserved_sectors * self.bytes_per_sector

    def data_offset(self) -> int:
        return self.cluster_offset(2)

    def valid_cluster(self, cluster: int) -> bool:
        return 2 <= cluster <= self.max_cluster


class FatTable:
    """Zugriff auf die FAT mit Zwischenspeicher (auch als Belegungskarte)."""

    _BLOCK = 64 * 1024

    def __init__(self, source, boot: FatBoot):
        self.source = source
        self.boot = boot
        self._cache: dict[int, bytes] = {}
        self._end_marker = {"fat12": 0xFF8, "fat16": 0xFFF8, "fat32": 0x0FFFFFF8}[boot.fat_type]

    def _bytes(self, rel: int, n: int) -> bytes:
        out = b""
        while n > 0:
            block = rel // self._BLOCK
            data = self._cache.get(block)
            if data is None:
                data = self.source.read(self.boot.fat_offset() + block * self._BLOCK, self._BLOCK)
                if len(self._cache) > 256:
                    self._cache.clear()
                self._cache[block] = data
            inner = rel - block * self._BLOCK
            part = data[inner:inner + n]
            if not part:
                break
            out += part
            rel += len(part)
            n -= len(part)
        return out

    def entry(self, cluster: int) -> Optional[int]:
        """Roher FAT-Eintrag eines Clusters, ``None`` wenn nicht lesbar."""
        kind = self.boot.fat_type
        if kind == "fat32":
            raw = self._bytes(cluster * 4, 4)
            return struct.unpack("<I", raw)[0] & 0x0FFFFFFF if len(raw) == 4 else None
        if kind == "fat16":
            raw = self._bytes(cluster * 2, 2)
            return struct.unpack("<H", raw)[0] if len(raw) == 2 else None
        raw = self._bytes(cluster + cluster // 2, 2)
        if len(raw) < 2:
            return None
        value = struct.unpack("<H", raw)[0]
        return (value >> 4) if (cluster & 1) else (value & 0x0FFF)

    def is_free(self, cluster: int) -> bool:
        return self.entry(cluster) == 0

    def next_cluster(self, cluster: int) -> Optional[int]:
        """Naechster Cluster in der Kette, oder None bei Ende/frei/defekt."""
        value = self.entry(cluster)
        if value is None or value < 2 or value >= self._end_marker:
            return None
        if not self.boot.valid_cluster(value):
            return None
        return value

    def chain(self, start: int, limit: int) -> list[int]:
        """Folgt der Kette ab ``start`` (hoechstens ``limit`` Cluster)."""
        out: list[int] = []
        seen: set[int] = set()
        cluster: Optional[int] = start
        while cluster is not None and cluster not in seen and len(out) < limit:
            if not self.boot.valid_cluster(cluster):
                break
            seen.add(cluster)
            out.append(cluster)
            cluster = self.next_cluster(cluster)
        return out

    def free_run(self, start: int, needed: int, window: int) -> tuple[list[int], int]:
        """Sammelt ab ``start`` freie Cluster und ueberspringt belegte.

        Rueckgabe: ``(cluster_liste, anzahl_uebersprungener)``. Gesucht wird in
        einem Fenster von ``window`` Clustern.
        """
        out: list[int] = []
        skipped = 0
        cluster = start
        end = min(self.boot.max_cluster, start + window)
        while len(out) < needed and cluster <= end:
            if self.is_free(cluster):
                out.append(cluster)
            else:
                skipped += 1
            cluster += 1
        return out, skipped

    def is_allocated_offset(self, abs_offset: int) -> Optional[bool]:
        """Belegungsstatus der Stelle ``abs_offset`` (None = nicht im Datenbereich)."""
        rel = abs_offset - self.boot.data_offset()
        if rel < 0:
            return None
        cluster = rel // self.boot.cluster_size + 2
        if cluster > self.boot.max_cluster:
            return None
        value = self.entry(cluster)
        return None if value is None else value != 0


def clusters_to_runs(boot, clusters: list[int]) -> list[tuple[int, int]]:
    """Wandelt eine Clusterliste in Bereiche ``(offset, laenge)`` um."""
    runs: list[tuple[int, int]] = []
    for cluster in clusters:
        off = boot.cluster_offset(cluster)
        if runs and runs[-1][0] + runs[-1][1] == off:
            runs[-1] = (runs[-1][0], runs[-1][1] + boot.cluster_size)
        else:
            runs.append((off, boot.cluster_size))
    return runs


def _short_name(entry: bytes, deleted: bool, first_char: Optional[str] = None) -> str:
    base = entry[0:8].decode("ascii", "replace").rstrip(" ")
    ext = entry[8:11].decode("ascii", "replace").rstrip(" ")
    if entry[0] == 0x05:
        base = "å" + base[1:]           # 0x05 steht fuer ein echtes 0xE5
    if deleted and base:
        base = (first_char or "_") + base[1:]   # verlorenes erstes Zeichen
    # Windows NT merkt sich reine Kleinschreibung in Byte 0x0C statt eines LFN.
    case = entry[0x0C]
    if case & 0x08:
        base = base.lower()
    if case & 0x10:
        ext = ext.lower()
    return f"{base}.{ext}" if ext else base


def _lfn_checksum(short11: bytes) -> int:
    value = 0
    for byte in short11:
        value = (((value & 1) << 7) + (value >> 1) + byte) & 0xFF
    return value


def _lfn_chars(entry: bytes) -> str:
    raw = entry[1:11] + entry[14:26] + entry[28:32]
    text = raw.decode("utf-16-le", "replace")
    return text.split("\x00", 1)[0].replace("￿", "")


def _match_lfn(lfn: str, checksums: set, entry: bytes, deleted: bool) -> tuple[bool, Optional[str]]:
    """Gehoert der gesammelte Langname zu diesem 8.3-Eintrag?

    Jeder LFN-Teil traegt eine Pruefsumme ueber den 8.3-Namen. Bei geloeschten
    Eintraegen fehlt dessen erstes Zeichen; es wird aus dem Langnamen erraten
    und bei passender Pruefsumme zurueckgewonnen.
    """
    if not lfn or len(checksums) != 1:
        return False, None
    want = next(iter(checksums))
    if not deleted:
        return _lfn_checksum(entry[0:11]) == want, None
    first = lfn[0].upper()
    if first.isascii():
        candidate = bytes([ord(first)]) + entry[1:11]
        if _lfn_checksum(candidate) == want:
            return True, first
        return False, None
    return True, None                         # nicht pruefbar: wie bisher annehmen


def _fat_datetime(entry: bytes) -> tuple[Optional[str], Optional[float]]:
    """Aenderungszeit (lokale Zeit) als Text und als Unix-Zeit."""
    tm = struct.unpack_from("<H", entry, 0x16)[0]
    date = struct.unpack_from("<H", entry, 0x18)[0]
    if date == 0:
        return None, None
    year = 1980 + (date >> 9)
    month = (date >> 5) & 0x0F
    day = date & 0x1F
    hour = tm >> 11
    minute = (tm >> 5) & 0x3F
    second = (tm & 0x1F) * 2
    if not (1 <= month <= 12 and 1 <= day <= 31 and hour < 24 and minute < 60 and second < 60):
        return None, None
    text = f"{year:04d}-{month:02d}-{day:02d} {hour:02d}:{minute:02d}:{second:02d}"
    try:
        epoch = time.mktime((year, month, day, hour, minute, second, 0, 0, -1))
    except (OverflowError, ValueError):
        epoch = None
    return text, epoch


def _looks_like_directory(data: bytes) -> bool:
    """Grobe Pruefung, ob ein Cluster Verzeichniseintraege enthaelt."""
    if len(data) < 64:
        return False
    for i in range(0, min(len(data), 512), 32):
        entry = data[i:i + 32]
        first = entry[0]
        if first == END_OF_DIR:
            return i > 0
        attr = entry[0x0B]
        if attr == ATTR_LFN:
            continue
        if attr & 0xC0:
            return False
        if first != DELETED and first != 0x2E and (first < 0x20 or first in b'"*+,/:;<=>?[\\]|'):
            return False
    return True


class _Walker:
    def __init__(self, source, boot: FatBoot, deleted_only: bool, should_cancel):
        self.source = source
        self.boot = boot
        self.table = FatTable(source, boot)
        self.deleted_only = deleted_only
        self.should_cancel = should_cancel
        self.findings: list[Finding] = []
        self.visited: set[int] = set()
        self.errors = 0

    def cancelled(self) -> bool:
        return bool(self.should_cancel and self.should_cancel())

    # -- Verzeichnisse lesen ---------------------------------------------

    def root_directory(self) -> bytes:
        boot = self.boot
        if boot.fat_type == "fat32":
            return self.chain_directory(boot.root_cluster)
        root_sector = boot.reserved_sectors + boot.num_fats * boot.fat_size
        offset = boot.base + root_sector * boot.bytes_per_sector
        return self.source.read(offset, boot.root_entries * 32)

    def chain_directory(self, start: int) -> bytes:
        limit = MAX_DIR_BYTES // self.boot.cluster_size
        out = bytearray()
        for cluster in self.table.chain(start, limit):
            out += self.source.read(self.boot.cluster_offset(cluster), self.boot.cluster_size)
        return bytes(out)

    def deleted_directory(self, start: int) -> bytes:
        """Inhalt eines geloeschten Ordners: erster Cluster plus folgende freie,
        solange sie nach Verzeichniseintraegen aussehen."""
        boot = self.boot
        first = self.source.read(boot.cluster_offset(start), boot.cluster_size)
        if first[0:11] != b".          ":
            return b""                          # Cluster wurde neu belegt
        out = bytearray(first)
        if END_OF_DIR in first[0::32]:
            return bytes(out)
        cluster = start + 1
        while cluster <= boot.max_cluster and len(out) < MAX_DELETED_DIR_CLUSTERS * boot.cluster_size:
            if not self.table.is_free(cluster):
                cluster += 1
                continue
            data = self.source.read(boot.cluster_offset(cluster), boot.cluster_size)
            if not _looks_like_directory(data):
                break
            out += data
            if END_OF_DIR in data[0::32]:
                break
            cluster += 1
        return bytes(out)

    # -- Durchlauf -------------------------------------------------------

    def walk(self, data: bytes, path: str, depth: int, parent_deleted: bool) -> None:
        if depth > 32 or self.cancelled():
            return
        lfn_parts: list[str] = []
        lfn_sums: set = set()
        for i in range(0, len(data) - 31, 32):
            entry = data[i:i + 32]
            first = entry[0]
            if first == END_OF_DIR:
                break
            attr = entry[0x0B]
            if attr == ATTR_LFN:
                # Teile liegen in umgekehrter Reihenfolge vor dem 8.3-Eintrag.
                lfn_parts.insert(0, _lfn_chars(entry))
                lfn_sums.add(entry[0x0D])
                continue
            lfn = "".join(lfn_parts).strip()
            sums = lfn_sums
            lfn_parts, lfn_sums = [], set()
            if attr & ATTR_VOLUME_ID and not (attr & ATTR_DIRECTORY):
                continue
            if entry[0:1] == b".":
                continue                                    # "." und ".."
            deleted = first == DELETED or parent_deleted
            use_lfn, restored = _match_lfn(lfn, sums, entry, first == DELETED)
            short = _short_name(entry, first == DELETED, restored)
            name = lfn if use_lfn else short
            name = name.replace("/", "_").replace("\\", "_")
            full = f"{path}/{name}" if path else name

            cluster = (struct.unpack_from("<H", entry, 0x14)[0] << 16) \
                | struct.unpack_from("<H", entry, 0x1A)[0]
            if self.boot.fat_type != "fat32":
                cluster &= 0xFFFF
            size = struct.unpack_from("<I", entry, 0x1C)[0]

            if attr & ATTR_DIRECTORY:
                self._descend(cluster, full, depth, first == DELETED, deleted)
                continue
            if self.deleted_only and not deleted:
                continue
            if size <= 0 or not self.boot.valid_cluster(cluster):
                continue
            self._add_file(entry, full, name, cluster, size, deleted, first == DELETED)

    def _descend(self, cluster: int, full: str, depth: int, entry_deleted: bool,
                 deleted: bool) -> None:
        if not self.boot.valid_cluster(cluster) or cluster in self.visited:
            return
        self.visited.add(cluster)
        try:
            if entry_deleted or deleted:
                data = self.deleted_directory(cluster)
            else:
                data = self.chain_directory(cluster)
            self.walk(data, full, depth + 1, deleted)
        except Exception:
            self.errors += 1

    def _add_file(self, entry: bytes, full: str, name: str, cluster: int, size: int,
                  deleted: bool, entry_deleted: bool) -> None:
        boot = self.boot
        needed = (size + boot.cluster_size - 1) // boot.cluster_size
        if not deleted:
            clusters = self.table.chain(cluster, needed)
            state = "vorhanden"
            if len(clusters) < needed:
                clusters = list(range(cluster, cluster + needed))
                state = "vorhanden (FAT-Kette beschädigt)"
        elif not self.table.is_free(cluster):
            # Der Startcluster gehoert schon einer anderen Datei: der Anfang ist weg.
            clusters = list(range(cluster, cluster + needed))
            state = "überschrieben"
        else:
            clusters, skipped = self.table.free_run(cluster, needed, needed * 4 + 1024)
            if len(clusters) < needed:
                clusters = list(range(cluster, cluster + needed))
                state = "teilweise überschrieben"
            elif skipped:
                state = "zusammengesetzt"
            else:
                state = "gut"
        clusters = [c for c in clusters if boot.valid_cluster(c)]
        if not clusters:
            return
        modified, epoch = _fat_datetime(entry)
        ext = name.rsplit(".", 1)[-1].lower() if "." in name else "bin"
        number = len(self.findings) + 1
        self.findings.append(Finding(
            kind="fat",
            type_name="FAT-Datei" + (" (gelöscht)" if deleted else ""),
            ext=ext,
            name=f"{number:06d}_{safe_name(full)}",
            offset=boot.cluster_offset(clusters[0]),
            size=size,
            extra={"path": full, "modified": modified, "mtime_epoch": epoch,
                   "fs": boot.fat_type, "runs": clusters_to_runs(boot, clusters),
                   "state": state, "deleted": deleted},
        ))


def scan_fat(source, base_offset: int = 0, deleted_only: bool = True,
             progress_cb: Optional[ProgressCb] = None,
             should_cancel: Optional[CancelCb] = None,
             warnings: Optional[list] = None) -> Iterator[Finding]:
    """Durchsucht ein FAT-Volume ab ``base_offset`` nach (geloeschten) Dateien."""
    boot = FatBoot(source.read(base_offset, 512), base_offset)
    if progress_cb:
        progress_cb("FAT-Verzeichnisse lesen", 0.0, 0)
    walker = _Walker(source, boot, deleted_only, should_cancel)
    try:
        walker.walk(walker.root_directory(), "", 0, False)
    except Exception:
        walker.errors += 1
    if walker.errors and warnings is not None:
        warnings.append(f"FAT-Volume bei Offset {base_offset:#x}: {walker.errors} "
                        "Verzeichnis(se) nicht lesbar.")
    if progress_cb:
        progress_cb("FAT-Verzeichnisse lesen", 1.0, len(walker.findings))
    yield from walker.findings


def allocation_map(source, base_offset: int = 0) -> Optional[FatTable]:
    """Belegungskarte (FAT) eines Volumes, fuer das Carving im freien Bereich."""
    try:
        return FatTable(source, FatBoot(source.read(base_offset, 512), base_offset))
    except FatError:
        return None


def is_fat(source, base_offset: int = 0) -> bool:
    try:
        FatBoot(source.read(base_offset, 512), base_offset)
        return True
    except FatError:
        return False
