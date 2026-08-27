"""exFAT-Undelete (Metadaten-Analyse, Kategorie 1).

exFAT ist das Dateisystem grosser SD-Karten und USB-Sticks. Ein Verzeichnis
besteht aus 32-Byte-Eintraegen: ein File-Eintrag (Typ ``0x85``), ein
Stream-Extension-Eintrag (``0xC0``) mit Startcluster und Groesse sowie ein oder
mehrere Namens-Eintraege (``0xC1``). Beim Loeschen wird nur das InUse-Bit (0x80)
im Typ geloescht (aus ``0x85`` wird ``0x05`` usw.); Name, Groesse und
Startcluster bleiben erhalten.

Der Parser liest die Verzeichnisse, gruppiert die Eintraege ueber die
SecondaryCount-Angabe und rekonstruiert geloeschte Dateien. Der Inhalt wird
ab dem Startcluster gelesen – zusammenhaengend, wie bei exFAT ohne FAT-Kette
ueblich (Flag NoFatChain) oder als bestmoegliche Annahme.
"""

from __future__ import annotations

import struct
from typing import Callable, Iterator, Optional

from .models import Finding

ProgressCb = Callable[[str, float, int], None]
CancelCb = Callable[[], bool]

TYPE_FILE = 0x05          # 0x85 & 0x7F
TYPE_STREAM = 0x40        # 0xC0 & 0x7F
TYPE_NAME = 0x41          # 0xC1 & 0x7F
IN_USE = 0x80


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
        bps_shift = data[0x6C]
        spc_shift = data[0x6D]
        if not (9 <= bps_shift <= 12) or spc_shift > 25:
            raise ExfatError("ungueltige Geometrie")
        self.bytes_per_sector = 1 << bps_shift
        self.sectors_per_cluster = 1 << spc_shift
        self.cluster_size = self.bytes_per_sector * self.sectors_per_cluster
        if self.root_cluster < 2 or self.heap_sector == 0:
            raise ExfatError("ungueltiges Layout")

    def cluster_offset(self, cluster: int) -> int:
        sector = self.heap_sector + (cluster - 2) * self.sectors_per_cluster
        return self.base + sector * self.bytes_per_sector

    def fat_offset(self) -> int:
        return self.base + self.fat_sector * self.bytes_per_sector


def _next_cluster(source, boot: ExfatBoot, cluster: int) -> Optional[int]:
    val = struct.unpack_from("<I", source.read(boot.fat_offset() + cluster * 4, 4))[0]
    if val < 2 or val >= 0xFFFFFFF7:
        return None
    return val


def _read_directory(source, boot: ExfatBoot, first_cluster: int,
                    no_fat_chain: bool, length: int) -> bytes:
    if no_fat_chain and length:
        return source.read(boot.cluster_offset(first_cluster), length)
    out = bytearray()
    cluster = first_cluster
    seen: set[int] = set()
    while cluster and cluster >= 2 and cluster not in seen and len(out) < 64 * 1024 * 1024:
        seen.add(cluster)
        out += source.read(boot.cluster_offset(cluster), boot.cluster_size)
        cluster = _next_cluster(source, boot, cluster)
    return bytes(out)


def _exfat_time(val: int) -> Optional[str]:
    if val == 0:
        return None
    second = (val & 0x1F) * 2
    minute = (val >> 5) & 0x3F
    hour = (val >> 11) & 0x1F
    day = (val >> 16) & 0x1F
    month = (val >> 21) & 0x0F
    year = 1980 + ((val >> 25) & 0x7F)
    if not (1 <= month <= 12 and 1 <= day <= 31):
        return None
    return f"{year:04d}-{month:02d}-{day:02d} {hour:02d}:{minute:02d}:{second:02d}"


def scan_exfat(source, base_offset: int = 0, deleted_only: bool = True,
               progress_cb: Optional[ProgressCb] = None,
               should_cancel: Optional[CancelCb] = None) -> Iterator[Finding]:
    """Durchsucht ein exFAT-Volume ab ``base_offset`` nach (geloeschten) Dateien."""
    boot = ExfatBoot(source.read(base_offset, 512), base_offset)
    if progress_cb:
        progress_cb("exFAT-Verzeichnisse lesen", 0.0, 0)
    findings: list[Finding] = []
    counter = [0]
    _walk(source, boot, boot.root_cluster, False, 0, "", 0, findings, counter,
          deleted_only, set(), should_cancel)
    for f in findings:
        yield f


def _walk(source, boot: ExfatBoot, first_cluster: int, no_fat_chain: bool,
          length: int, path: str, depth: int, findings: list, counter: list,
          deleted_only: bool, visited: set, should_cancel) -> None:
    if depth > 32 or (should_cancel and should_cancel()):
        return
    data = _read_directory(source, boot, first_cluster, no_fat_chain, length)
    slots = len(data) // 32
    i = 0
    while i < slots:
        entry = data[i * 32:i * 32 + 32]
        etype = entry[0]
        base_type = etype & 0x7F
        if etype == 0x00:
            i += 1
            continue
        if base_type != TYPE_FILE:
            i += 1
            continue

        in_use = bool(etype & IN_USE)
        sec_count = entry[1]
        attrs = struct.unpack_from("<H", entry, 0x04)[0]
        is_dir = bool(attrs & 0x10)
        mtime = _exfat_time(struct.unpack_from("<I", entry, 0x0C)[0])

        stream = None
        name_bytes = bytearray()
        for k in range(sec_count):
            si = i + 1 + k
            if si >= slots:
                break
            se = data[si * 32:si * 32 + 32]
            st = se[0] & 0x7F
            if st == TYPE_STREAM:
                stream = se
            elif st == TYPE_NAME:
                name_bytes += se[2:32]
        i += 1 + sec_count

        if stream is None:
            continue
        name_len = stream[3]
        flags = stream[1]
        sub_no_fat = bool(flags & 0x02)
        sub_first = struct.unpack_from("<I", stream, 0x14)[0]
        data_len = struct.unpack_from("<Q", stream, 0x18)[0]
        name = name_bytes.decode("utf-16-le", "replace")[:name_len]
        deleted = not in_use

        if is_dir:
            if (not deleted and sub_first >= 2 and sub_first not in visited):
                visited.add(sub_first)
                sub = f"{path}/{name}" if path else name
                _walk(source, boot, sub_first, sub_no_fat, data_len, sub,
                      depth + 1, findings, counter, deleted_only, visited,
                      should_cancel)
            continue

        if deleted_only and not deleted:
            continue
        if data_len <= 0 or sub_first < 2:
            continue

        counter[0] += 1
        full = f"{path}/{name}" if path else name
        ext = name.rsplit(".", 1)[-1].lower() if "." in name else "bin"
        findings.append(Finding(
            kind="exfat",
            type_name="exFAT-Datei" + ("" if not deleted else " (geloescht)"),
            ext=ext,
            name=f"{counter[0]:06d}_{_safe(full)}",
            offset=boot.cluster_offset(sub_first),
            size=data_len,
            extra={"path": full, "modified": mtime, "fs": "exfat"},
        ))


def _safe(name: str) -> str:
    keep = []
    for ch in name:
        if ch in '<>:"\\|?*/' or ord(ch) < 32:
            keep.append("_")
        else:
            keep.append(ch)
    return "".join(keep).strip(" .") or "unbenannt"


def is_exfat(source, base_offset: int = 0) -> bool:
    try:
        ExfatBoot(source.read(base_offset, 512), base_offset)
        return True
    except ExfatError:
        return False
