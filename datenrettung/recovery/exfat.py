"""exFAT-Undelete (Metadaten-Analyse, Kategorie 1).

exFAT beschreibt jede Datei mit einem Satz von Verzeichniseintraegen: einem
File-Eintrag (0x85), einem Stream-Eintrag (0xC0) mit Startcluster, Groesse und
dem Flag *NoFatChain*, und einem oder mehreren Namens-Eintraegen (0xC1). Beim
Loeschen wird in jedem Eintrag das InUse-Bit (0x80) geloescht und die Belegung
in der Allocation Bitmap aufgehoben; Name, Groesse und Startcluster bleiben.

Rekonstruktion:

- *NoFatChain* gesetzt: die Datei lag am Stueck – exakt rekonstruierbar.
- Sonst folgt eine vorhandene Datei ihrer FAT-Kette. Bei geloeschten Dateien
  ist die Kette meist geloescht; dann wird ab dem Startcluster aus freien
  Clustern zusammengesetzt (belegte werden uebersprungen).
- Geloeschte Ordner werden durchsucht; ihre Groesse steht im Stream-Eintrag.
"""

from __future__ import annotations

import datetime
import struct
from typing import Iterator, Optional

from .models import CancelCb, Finding, ProgressCb, safe_name
from .runs import byte_runs, chain_to_runs, clamp_range, free_runs

TYPE_FILE = 0x05          # 0x85 & 0x7F
TYPE_STREAM = 0x40        # 0xC0 & 0x7F
TYPE_NAME = 0x41          # 0xC1 & 0x7F
TYPE_BITMAP = 0x81        # Allocation Bitmap (im Wurzelverzeichnis)
IN_USE = 0x80

MAX_DIR_BYTES = 64 * 1024 * 1024


class ExfatError(Exception):
    pass


class ExfatBoot:
    def __init__(self, data: bytes, base_offset: int = 0):
        if len(data) < 512 or data[3:11] != b"EXFAT   ":
            raise ExfatError("kein exFAT")
        self.base = base_offset
        self.volume_length = struct.unpack_from("<Q", data, 0x48)[0]
        self.fat_sector = struct.unpack_from("<I", data, 0x50)[0]
        self.fat_length = struct.unpack_from("<I", data, 0x54)[0]
        self.heap_sector = struct.unpack_from("<I", data, 0x58)[0]
        self.cluster_count = struct.unpack_from("<I", data, 0x5C)[0]
        self.root_cluster = struct.unpack_from("<I", data, 0x60)[0]
        # Bei zwei FATs sagt Bit 0 der VolumeFlags, welche FAT und welche
        # Allocation Bitmap gerade gelten (Spezifikation 3.1.13.1).
        self.number_of_fats = data[0x6E]
        volume_flags = struct.unpack_from("<H", data, 0x6A)[0]
        self.active_fat = 1 if (self.number_of_fats == 2 and volume_flags & 0x01) else 0
        bps_shift = data[0x6C]
        spc_shift = data[0x6D]
        # Laut Spezifikation: 512 bis 4096 Byte je Sektor, Cluster hoechstens 32 MiB.
        if not (9 <= bps_shift <= 12) or bps_shift + spc_shift > 25:
            raise ExfatError("ungueltige Geometrie")
        self.bytes_per_sector = 1 << bps_shift
        self.sectors_per_cluster = 1 << spc_shift
        self.cluster_size = self.bytes_per_sector * self.sectors_per_cluster
        if self.heap_sector == 0 or self.fat_sector == 0 or self.cluster_count == 0:
            raise ExfatError("ungueltiges Layout")
        self.max_cluster = self.cluster_count + 1
        if not (2 <= self.root_cluster <= self.max_cluster):
            raise ExfatError("ungueltiger Wurzel-Cluster")

    def cluster_offset(self, cluster: int) -> int:
        sector = self.heap_sector + (cluster - 2) * self.sectors_per_cluster
        return self.base + sector * self.bytes_per_sector

    def fat_offset(self) -> int:
        sector = self.fat_sector + self.active_fat * self.fat_length
        return self.base + sector * self.bytes_per_sector

    def valid_cluster(self, cluster: int) -> bool:
        return 2 <= cluster <= self.max_cluster


class ExfatVolume:
    """FAT und Allocation Bitmap eines exFAT-Volumes."""

    _BLOCK = 64 * 1024

    def __init__(self, source, boot: ExfatBoot):
        self.source = source
        self.boot = boot
        self._fat_cache: dict[int, bytes] = {}
        self._bitmap: Optional[bytes] = None
        self._load_bitmap()

    def _load_bitmap(self) -> None:
        root = self.read_chain(self.boot.root_cluster, 1 << 20)
        entries = []
        for i in range(0, len(root) - 31, 32):
            entry = root[i:i + 32]
            if entry[0] == 0x00:
                break
            if entry[0] == TYPE_BITMAP:
                entries.append(entry)
        if not entries:
            return
        # Die Bitmap zur aktiven FAT; fehlt sie, die erste vorhandene.
        entry = next((e for e in entries if (e[1] & 0x01) == self.boot.active_fat), entries[0])
        first = struct.unpack_from("<I", entry, 0x14)[0]
        length = struct.unpack_from("<Q", entry, 0x18)[0]
        needed = (self.boot.cluster_count + 7) // 8
        if not self.boot.valid_cluster(first) or not 0 < length <= 64 * 1024 * 1024:
            return
        nbytes = min(length, needed)
        clusters = (nbytes + self.boot.cluster_size - 1) // self.boot.cluster_size
        # Die Bitmap liegt in einer FAT-Kette und darf fragmentiert sein. Endet
        # die Kette zu frueh (FAT leer oder beschaedigt), geht es
        # zusammenhaengend weiter.
        chain = self.chain(first, clusters)
        runs = chain_to_runs(chain)
        if len(chain) < clusters:
            runs += clamp_range(self.boot, chain[-1] + 1, clusters - len(chain))
        data = bytearray()
        for offset, size in byte_runs(self.boot, runs):
            data += self.source.read(offset, size)
        self._bitmap = bytes(data[:nbytes])

    def fat_entry(self, cluster: int) -> Optional[int]:
        rel = cluster * 4
        block = rel // self._BLOCK
        data = self._fat_cache.get(block)
        if data is None:
            data = self.source.read(self.boot.fat_offset() + block * self._BLOCK, self._BLOCK)
            if len(self._fat_cache) > 256:
                self._fat_cache.clear()
            self._fat_cache[block] = data
        inner = rel - block * self._BLOCK
        raw = data[inner:inner + 4]
        return struct.unpack("<I", raw)[0] if len(raw) == 4 else None

    def next_cluster(self, cluster: int) -> Optional[int]:
        value = self.fat_entry(cluster)
        if value is None or value < 2 or value >= 0xFFFFFFF7:
            return None
        return value if self.boot.valid_cluster(value) else None

    def chain(self, start: int, limit: int) -> list[int]:
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

    def read_chain(self, start: int, max_bytes: int) -> bytes:
        out = bytearray()
        for cluster in self.chain(start, max(1, max_bytes // self.boot.cluster_size)):
            out += self.source.read(self.boot.cluster_offset(cluster), self.boot.cluster_size)
        return bytes(out)

    def is_allocated(self, cluster: int) -> Optional[bool]:
        if self._bitmap is None:
            return None
        idx = cluster - 2
        if idx < 0 or idx // 8 >= len(self._bitmap):
            return None
        return bool(self._bitmap[idx // 8] & (1 << (idx % 8)))

    def is_allocated_offset(self, abs_offset: int) -> Optional[bool]:
        rel = abs_offset - self.boot.cluster_offset(2)
        if rel < 0:
            return None
        cluster = rel // self.boot.cluster_size + 2
        if cluster > self.boot.max_cluster:
            return None
        return self.is_allocated(cluster)

    def free_run(self, start: int, needed: int, window: int):
        """Freie Cluster ab ``start``; Rueckgabe ``(bereiche, gefunden, uebersprungen)``."""
        return free_runs(lambda c: bool(self.is_allocated(c)), start, needed, window,
                         self.boot.max_cluster)


def _exfat_time(val: int, utc_offset: int = 0) -> tuple[Optional[str], Optional[float]]:
    """Zeitstempel als Text (lokale Zeit des Geraets) und als Unix-Zeit.

    ``utc_offset`` ist das UtcOffset-Byte: Bit 7 = gueltig, Bits 0-6 = Versatz
    in Viertelstunden (vorzeichenbehaftet). Fehlt es, gilt die lokale Zeitzone.
    """
    if val == 0:
        return None, None
    second = (val & 0x1F) * 2
    minute = (val >> 5) & 0x3F
    hour = (val >> 11) & 0x1F
    day = (val >> 16) & 0x1F
    month = (val >> 21) & 0x0F
    year = 1980 + ((val >> 25) & 0x7F)
    if not (1 <= month <= 12 and 1 <= day <= 31 and hour < 24 and minute < 60 and second < 60):
        return None, None
    text = f"{year:04d}-{month:02d}-{day:02d} {hour:02d}:{minute:02d}:{second:02d}"
    try:
        local = datetime.datetime(year, month, day, hour, minute, second)
        if utc_offset & 0x80:
            quarters = utc_offset & 0x7F
            if quarters & 0x40:
                quarters -= 0x80
            tz = datetime.timezone(datetime.timedelta(minutes=15 * quarters))
            epoch = local.replace(tzinfo=tz).timestamp()
        else:
            epoch = local.timestamp()
    except (OverflowError, ValueError, OSError):
        epoch = None
    return text, epoch


class _Walker:
    def __init__(self, source, boot: ExfatBoot, deleted_only: bool, should_cancel):
        self.source = source
        self.boot = boot
        self.volume = ExfatVolume(source, boot)
        self.deleted_only = deleted_only
        self.should_cancel = should_cancel
        self.findings: list[Finding] = []
        self.visited: set[int] = set()
        self.errors = 0
        self.bad_entries = 0

    def read_directory(self, first: int, no_fat_chain: bool, length: int,
                       deleted: bool) -> bytes:
        boot = self.boot
        length = min(length, MAX_DIR_BYTES) if length else 0
        if no_fat_chain and length:
            return self.source.read(boot.cluster_offset(first), length)
        if not deleted:
            return self.volume.read_chain(first, length or MAX_DIR_BYTES)
        # Geloeschter Ordner mit FAT-Kette: die Kette ist meist geloescht.
        chain = self.volume.chain(first, max(1, length // boot.cluster_size))
        needed = max(1, (length + boot.cluster_size - 1) // boot.cluster_size)
        if len(chain) < needed:
            runs, _found, _skipped = self.volume.free_run(first, needed, needed * 4 + 64)
        else:
            runs = chain_to_runs(chain)
        out = bytearray()
        for offset, size in byte_runs(boot, runs):
            out += self.source.read(offset, size)
        return bytes(out[:length] if length else out)

    def walk(self, data: bytes, path: str, depth: int, parent_deleted: bool) -> None:
        if depth > 32 or (self.should_cancel and self.should_cancel()):
            return
        slots = len(data) // 32
        i = 0
        while i < slots:
            entry = data[i * 32:i * 32 + 32]
            etype = entry[0]
            if etype == 0x00:
                break                                  # Ende des Verzeichnisses
            if etype & 0x7F != TYPE_FILE:
                i += 1
                continue
            sec_count = entry[1]
            if not (2 <= sec_count <= 18):
                i += 1
                continue
            in_use = bool(etype & IN_USE)
            attrs = struct.unpack_from("<H", entry, 0x04)[0]
            is_dir = bool(attrs & 0x10)
            modified, epoch = _exfat_time(struct.unpack_from("<I", entry, 0x0C)[0], entry[0x17])

            stream = None
            name_bytes = bytearray()
            for k in range(sec_count):
                si = i + 1 + k
                if si >= slots:
                    break
                se = data[si * 32:si * 32 + 32]
                st = se[0] & 0x7F
                if st == TYPE_STREAM and stream is None:
                    stream = se
                elif st == TYPE_NAME:
                    name_bytes += se[2:32]
                else:
                    break
            i += 1 + sec_count
            if stream is None:
                continue

            name_len = stream[3]
            no_fat_chain = bool(stream[1] & 0x02)
            first = struct.unpack_from("<I", stream, 0x14)[0]
            data_len = struct.unpack_from("<Q", stream, 0x18)[0]
            name = name_bytes.decode("utf-16-le", "replace")[:name_len]
            name = name.replace("/", "_").replace("\\", "_") or "unbenannt"
            deleted = (not in_use) or parent_deleted
            full = f"{path}/{name}" if path else name

            if is_dir:
                if self.boot.valid_cluster(first) and first not in self.visited:
                    self.visited.add(first)
                    try:
                        sub = self.read_directory(first, no_fat_chain, data_len, deleted)
                        self.walk(sub, full, depth + 1, deleted)
                    except Exception:
                        self.errors += 1
                continue

            if self.deleted_only and not deleted:
                continue
            if data_len <= 0 or not self.boot.valid_cluster(first):
                continue
            # Ein beschaedigter Eintrag darf die Geschwister nicht mitreissen.
            try:
                self._add_file(full, name, first, data_len, no_fat_chain, deleted,
                               modified, epoch)
            except Exception:
                self.bad_entries += 1

    def _add_file(self, full: str, name: str, first: int, size: int, no_fat_chain: bool,
                  deleted: bool, modified: Optional[str], epoch: Optional[float]) -> None:
        boot = self.boot
        vol = self.volume
        needed = (size + boot.cluster_size - 1) // boot.cluster_size
        # Groesser als das Volume (bzw. als der Platz ab dem Startcluster bei
        # zusammenhaengender Ablage) kann keine echte Datei sein.
        if needed > boot.cluster_count or (
                no_fat_chain and first + needed - 1 > boot.max_cluster):
            self.bad_entries += 1
            return
        if no_fat_chain:
            runs = [(first, needed)]
            if not deleted:
                state = "vorhanden"
            else:
                probe = range(first, first + min(needed, 4096))
                used = sum(1 for c in probe if vol.is_allocated(c))
                state = ("gut" if used == 0 else
                         "überschrieben" if vol.is_allocated(first) else "teilweise überschrieben")
        elif not deleted:
            chain = vol.chain(first, needed)
            runs = chain_to_runs(chain)
            state = "vorhanden"
            if len(chain) < needed:
                runs = clamp_range(boot, first, needed)
                state = "vorhanden (FAT-Kette beschädigt)"
        else:
            chain = vol.chain(first, needed)
            if len(chain) == needed and not any(vol.is_allocated(c) for c in chain):
                runs, state = chain_to_runs(chain), "gut"          # Kette blieb erhalten
            elif vol.is_allocated(first):
                runs, state = clamp_range(boot, first, needed), "überschrieben"
            else:
                runs, found, skipped = vol.free_run(first, needed, needed * 4 + 1024)
                if found < needed:
                    runs = clamp_range(boot, first, needed)
                    state = "teilweise überschrieben"
                else:
                    state = "zusammengesetzt" if skipped else "gut"
        if not runs:
            return
        ext = name.rsplit(".", 1)[-1].lower() if "." in name else "bin"
        number = len(self.findings) + 1
        self.findings.append(Finding(
            kind="exfat",
            type_name="exFAT-Datei" + (" (gelöscht)" if deleted else ""),
            ext=ext,
            name=f"{number:06d}_{safe_name(full)}",
            offset=boot.cluster_offset(runs[0][0]),
            size=size,
            extra={"path": full, "modified": modified, "mtime_epoch": epoch, "fs": "exfat",
                   "runs": byte_runs(boot, runs), "state": state,
                   "deleted": deleted},
        ))


def scan_exfat(source, base_offset: int = 0, deleted_only: bool = True,
               progress_cb: Optional[ProgressCb] = None,
               should_cancel: Optional[CancelCb] = None,
               warnings: Optional[list] = None) -> Iterator[Finding]:
    """Durchsucht ein exFAT-Volume ab ``base_offset`` nach (geloeschten) Dateien."""
    boot = ExfatBoot(source.read(base_offset, 512), base_offset)
    if progress_cb:
        progress_cb("exFAT-Verzeichnisse lesen", 0.0, 0)
    walker = _Walker(source, boot, deleted_only, should_cancel)
    try:
        root = walker.volume.read_chain(boot.root_cluster, MAX_DIR_BYTES)
        walker.walk(root, "", 0, False)
    except Exception:
        walker.errors += 1
    if walker.errors and warnings is not None:
        warnings.append(f"exFAT-Volume bei Offset {base_offset:#x}: {walker.errors} "
                        "Verzeichnis(se) nicht lesbar.")
    if walker.bad_entries and warnings is not None:
        warnings.append(f"exFAT-Volume bei Offset {base_offset:#x}: {walker.bad_entries} "
                        "beschädigte Dateieinträge übersprungen (z.B. unmögliche Größe).")
    if progress_cb:
        progress_cb("exFAT-Verzeichnisse lesen", 1.0, len(walker.findings))
    yield from walker.findings


def allocation_map(source, base_offset: int = 0) -> Optional[ExfatVolume]:
    """Belegungskarte eines exFAT-Volumes, fuer das Carving im freien Bereich."""
    try:
        return ExfatVolume(source, ExfatBoot(source.read(base_offset, 512), base_offset))
    except ExfatError:
        return None


def is_exfat(source, base_offset: int = 0) -> bool:
    try:
        ExfatBoot(source.read(base_offset, 512), base_offset)
        return True
    except ExfatError:
        return False
