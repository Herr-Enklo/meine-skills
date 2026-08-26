"""Minimaler NTFS-/MFT-Parser zum Wiederherstellen geloeschter Dateien.

NTFS verwaltet jede Datei in einem Eintrag der *Master File Table* (MFT). Beim
Loeschen wird der Eintrag nur als "nicht in Benutzung" markiert – Name, Groesse
und der Verweis auf die Datencluster bleiben zunaechst erhalten. Genau diese
Eintraege sucht der Parser.

Umfang bewusst auf das Wesentliche beschraenkt, dafuer sauber implementiert:

- Boot-Sektor auswerten (Sektor-/Clustergroesse, Lage und Groesse der MFT)
- MFT ueber ihre eigenen Data-Runs durchlaufen (auch bei Fragmentierung)
- Update-Sequence-Fixups anwenden
- Attribute ``$FILE_NAME`` (Name) und ``$DATA`` (Inhalt) auslesen
- Inhalt resident (im Eintrag) oder ueber Data-Runs (Cluster) rekonstruieren

Physische Datentraeger mit mehreren Partitionen werden unterstuetzt: ueber
``find_ntfs_volumes`` werden MBR/GPT abgesucht und alle NTFS-Volumes gefunden.
"""

from __future__ import annotations

import struct
from typing import Callable, Iterator, Optional

from .models import Finding

ProgressCb = Callable[[str, float, int], None]
CancelCb = Callable[[], bool]

# Attributtypen
ATTR_FILE_NAME = 0x30
ATTR_DATA = 0x80
ATTR_END = 0xFFFFFFFF

# MFT-Eintrags-Flags
FLAG_IN_USE = 0x01
FLAG_DIRECTORY = 0x02

# $FILE_NAME-Namensraeume
NS_POSIX = 0
NS_WIN32 = 1
NS_DOS = 2
NS_WIN32_DOS = 3


class NtfsError(Exception):
    pass


class BootSector:
    """Ausgewertete Kennzahlen des NTFS-Boot-Sektors."""

    def __init__(self, data: bytes):
        if len(data) < 512 or data[3:11] != b"NTFS    ":
            raise NtfsError("kein NTFS-Boot-Sektor")
        self.bytes_per_sector = struct.unpack_from("<H", data, 0x0B)[0]
        spc = data[0x0D]
        # Grosse Cluster werden als negativer Wert kodiert: 2^abs(wert).
        self.sectors_per_cluster = spc if spc <= 0x7F else 1 << (0x100 - spc)
        self.total_sectors = struct.unpack_from("<Q", data, 0x28)[0]
        self.mft_cluster = struct.unpack_from("<Q", data, 0x30)[0]
        clusters_per_record = struct.unpack_from("<b", data, 0x40)[0]  # signed

        if self.bytes_per_sector == 0 or self.sectors_per_cluster == 0:
            raise NtfsError("ungueltige Sektor-/Clustergroesse")
        self.cluster_size = self.bytes_per_sector * self.sectors_per_cluster

        if clusters_per_record >= 0:
            self.record_size = clusters_per_record * self.cluster_size
        else:
            self.record_size = 1 << (-clusters_per_record)
        if self.record_size <= 0:
            self.record_size = 1024


def _apply_fixup(record: bytearray, bytes_per_sector: int) -> None:
    """Stellt die Update-Sequence-Fixups eines MFT-Eintrags wieder her.

    NTFS ersetzt die letzten zwei Bytes jedes Sektors durch eine Pruefzahl und
    sichert die Originalbytes in einem Array. Zum korrekten Lesen muessen die
    Originalbytes zurueckgeschrieben werden.
    """
    usa_offset = struct.unpack_from("<H", record, 0x04)[0]
    usa_count = struct.unpack_from("<H", record, 0x06)[0]
    if usa_count == 0 or usa_offset == 0:
        return
    usn = record[usa_offset:usa_offset + 2]
    array = record[usa_offset + 2: usa_offset + 2 * usa_count]
    for i in range(usa_count - 1):
        sector_end = (i + 1) * bytes_per_sector
        if sector_end > len(record):
            break
        # Pruefzahl muss mit der USN uebereinstimmen (sonst beschaedigt).
        if record[sector_end - 2:sector_end] != usn:
            # Trotzdem versuchen wir die Reparatur nicht zu erzwingen.
            pass
        original = array[i * 2:i * 2 + 2]
        if len(original) == 2:
            record[sector_end - 2:sector_end] = original


def parse_data_runs(buf: bytes) -> list[tuple[Optional[int], int]]:
    """Parst die Data-Runs eines nicht-residenten Attributs.

    Rueckgabe: Liste aus ``(lcn, cluster_anzahl)``. ``lcn is None`` markiert
    einen "sparse" Bereich (Nullen, kein physischer Speicher).
    """
    runs: list[tuple[Optional[int], int]] = []
    i = 0
    prev_lcn = 0
    n = len(buf)
    while i < n:
        header = buf[i]
        if header == 0:
            break
        len_size = header & 0x0F
        off_size = (header >> 4) & 0x0F
        i += 1
        if len_size == 0 or i + len_size + off_size > n:
            break
        run_len = int.from_bytes(buf[i:i + len_size], "little")
        i += len_size
        if off_size == 0:
            runs.append((None, run_len))  # sparse
        else:
            # Offset ist vorzeichenbehaftet und relativ zum vorigen LCN.
            delta = int.from_bytes(buf[i:i + off_size], "little", signed=True)
            i += off_size
            prev_lcn += delta
            runs.append((prev_lcn, run_len))
            continue
        i += off_size
    return runs


class MftReader:
    """Liest einzelne MFT-Eintraege ueber die Data-Runs der ``$MFT`` selbst."""

    def __init__(self, source, boot: BootSector, base_offset: int):
        self.source = source
        self.boot = boot
        self.base = base_offset
        self.record_size = boot.record_size
        # Data-Runs von $MFT (Eintrag 0) bestimmen die Lage aller Eintraege.
        self._runs: list[tuple[Optional[int], int]] = []
        self._mft_bytes = 0
        self._map_mft()

    def _phys(self, lcn: int) -> int:
        return self.base + lcn * self.boot.cluster_size

    def _map_mft(self) -> None:
        mft_phys = self._phys(self.boot.mft_cluster)
        raw = bytearray(self.source.read(mft_phys, self.record_size))
        if raw[0:4] != b"FILE":
            raise NtfsError("MFT-Eintrag 0 nicht gefunden")
        _apply_fixup(raw, self.boot.bytes_per_sector)
        data_attr = _find_data_attribute(raw)
        if data_attr is None or data_attr.get("resident", True):
            # Ohne nicht-residente $DATA koennen wir die MFT nicht sicher
            # abbilden; als Rueckfall die Eintraege linear ab mft_phys lesen.
            self._runs = []
            self._mft_bytes = 0
            self._linear_start = mft_phys
            return
        self._runs = data_attr["data_runs"]
        self._mft_bytes = data_attr["real_size"]
        self._linear_start = None

    def record_count(self) -> int:
        if self._mft_bytes:
            return self._mft_bytes // self.record_size
        # Rueckfall: bis zum Volumeende schaetzen.
        vol_bytes = self.boot.total_sectors * self.boot.bytes_per_sector
        start_rel = (self._linear_start or 0) - self.base
        remaining = max(0, vol_bytes - start_rel)
        return remaining // self.record_size

    def _read_virtual(self, voff: int, length: int) -> bytes:
        """Liest ``length`` Bytes an virtueller MFT-Position ``voff``.

        Die virtuelle Position wird ueber die Data-Runs auf physische Offsets
        abgebildet. Ein Eintrag kann theoretisch eine Run-Grenze kreuzen; das
        wird durch stueckweises Lesen abgedeckt.
        """
        if not self._runs:
            return self.source.read(self._linear_start + voff, length)

        out = bytearray()
        cluster = self.boot.cluster_size
        # Aktuelle virtuelle Byte-Position innerhalb der Run-Kette suchen.
        pos = 0
        for lcn, count in self._runs:
            run_bytes = count * cluster
            if voff < pos + run_bytes:
                # Innerhalb dieses Runs starten.
                inner = voff - pos
                take = min(length - len(out), run_bytes - inner)
                if lcn is None:
                    out += b"\x00" * take
                else:
                    out += self.source.read(self._phys(lcn) + inner, take)
                voff += take
                if len(out) >= length:
                    break
            pos += run_bytes
        return bytes(out[:length])

    def read_record(self, n: int) -> Optional[bytearray]:
        raw = bytearray(self._read_virtual(n * self.record_size, self.record_size))
        if len(raw) < self.record_size or raw[0:4] != b"FILE":
            return None
        _apply_fixup(raw, self.boot.bytes_per_sector)
        return raw


def _iter_attributes(record: bytes):
    """Iteriert die Attribute eines (bereits fixup-korrigierten) Eintrags."""
    first = struct.unpack_from("<H", record, 0x14)[0]
    off = first
    n = len(record)
    while off + 8 <= n:
        atype = struct.unpack_from("<I", record, off)[0]
        if atype == ATTR_END:
            break
        length = struct.unpack_from("<I", record, off + 4)[0]
        if length == 0 or off + length > n:
            break
        yield off, atype, length
        off += length


def _parse_file_name(record: bytes, off: int) -> Optional[tuple[str, int]]:
    """Liest Name und Namensraum aus einem ``$FILE_NAME``-Attribut."""
    non_resident = record[off + 0x08]
    if non_resident:
        return None
    content_off = struct.unpack_from("<H", record, off + 0x14)[0]
    base = off + content_off
    if base + 0x42 > len(record):
        return None
    name_len = record[base + 0x40]
    namespace = record[base + 0x41]
    name_bytes = record[base + 0x42: base + 0x42 + name_len * 2]
    try:
        name = name_bytes.decode("utf-16-le", errors="replace")
    except Exception:
        return None
    return name, namespace


def _find_data_attribute(record: bytes) -> Optional[dict]:
    """Findet das unbenannte ``$DATA``-Attribut und beschreibt seinen Inhalt."""
    for off, atype, length in _iter_attributes(record):
        if atype != ATTR_DATA:
            continue
        name_len = record[off + 0x09]
        if name_len != 0:
            continue  # benannte Datenstroeme (ADS) ignorieren
        non_resident = record[off + 0x08]
        if not non_resident:
            content_len = struct.unpack_from("<I", record, off + 0x10)[0]
            content_off = struct.unpack_from("<H", record, off + 0x14)[0]
            data = bytes(record[off + content_off: off + content_off + content_len])
            return {"resident": True, "resident_data": data, "real_size": content_len}
        real_size = struct.unpack_from("<Q", record, off + 0x30)[0]
        runs_off = struct.unpack_from("<H", record, off + 0x20)[0]
        runs = parse_data_runs(bytes(record[off + runs_off: off + length]))
        return {"resident": False, "data_runs": runs, "real_size": real_size}
    return None


def _best_name(names: list[tuple[str, int]]) -> Optional[str]:
    """Waehlt aus mehreren ``$FILE_NAME``-Eintraegen den besten Namen.

    Win32-Namen werden dem verkuerzten DOS-8.3-Namen vorgezogen.
    """
    if not names:
        return None
    for wanted in (NS_WIN32_DOS, NS_WIN32, NS_POSIX):
        for name, ns in names:
            if ns == wanted:
                return name
    return names[0][0]


def scan_ntfs(source, base_offset: int,
              progress_cb: Optional[ProgressCb] = None,
              should_cancel: Optional[CancelCb] = None,
              deleted_only: bool = True) -> Iterator[Finding]:
    """Durchsucht ein NTFS-Volume ab ``base_offset`` nach Eintraegen."""
    boot = BootSector(source.read(base_offset, 512))
    reader = MftReader(source, boot, base_offset)
    count = reader.record_count()

    produced = 0
    for n in range(count):
        if should_cancel and should_cancel():
            break
        if progress_cb and count and (n % 256 == 0 or n == count - 1):
            progress_cb("MFT durchsuchen", (n + 1) / count, produced)

        record = reader.read_record(n)
        if record is None:
            continue

        flags = struct.unpack_from("<H", record, 0x16)[0]
        in_use = bool(flags & FLAG_IN_USE)
        is_dir = bool(flags & FLAG_DIRECTORY)
        if is_dir:
            continue
        if deleted_only and in_use:
            continue

        names: list[tuple[str, int]] = []
        for off, atype, _length in _iter_attributes(record):
            if atype == ATTR_FILE_NAME:
                parsed = _parse_file_name(record, off)
                if parsed:
                    names.append(parsed)
        name = _best_name(names)
        if not name:
            continue

        data_attr = _find_data_attribute(record)
        if data_attr is None:
            continue
        real_size = data_attr.get("real_size", 0)
        if not real_size or real_size <= 0:
            continue

        ext = name.rsplit(".", 1)[-1].lower() if "." in name else "bin"
        safe = _safe_name(name)
        display = f"{n:06d}_{safe}"

        extra: dict = {
            "base_offset": base_offset,
            "cluster_size": boot.cluster_size,
            "real_size": real_size,
        }
        if data_attr.get("resident"):
            extra["resident_data"] = data_attr["resident_data"]
        else:
            extra["data_runs"] = data_attr["data_runs"]

        yield Finding(
            kind="ntfs",
            type_name="NTFS-Datei" + ("" if in_use else " (geloescht)"),
            ext=ext,
            name=display,
            offset=base_offset,
            size=real_size,
            extra=extra,
        )
        produced += 1


def _safe_name(name: str) -> str:
    """Entschaerft einen Dateinamen fuer die Ablage im Ausgabeordner."""
    keep = []
    for ch in name:
        if ch in '<>:"/\\|?*' or ord(ch) < 32:
            keep.append("_")
        else:
            keep.append(ch)
    cleaned = "".join(keep).strip(" .")
    return cleaned or "unbenannt"


# -- Volume-Erkennung (MBR/GPT) -----------------------------------------

def find_ntfs_volumes(source) -> list[int]:
    """Findet Byte-Offsets aller NTFS-Volumes auf der Quelle.

    Reihenfolge der Pruefung:
    1. Beginnt die Quelle direkt mit einem NTFS-Boot-Sektor? -> Offset 0.
    2. Sonst MBR-Partitionstabelle auswerten.
    3. Bei GPT (Schutz-MBR) die GPT-Eintraege auswerten.
    Jeder Kandidat wird durch Pruefen des Boot-Sektors bestaetigt.
    """
    offsets: list[int] = []
    seen: set[int] = set()

    def consider(offset: int) -> None:
        if offset in seen or offset < 0:
            return
        seen.add(offset)
        try:
            if source.read(offset, 512)[3:11] == b"NTFS    ":
                offsets.append(offset)
        except Exception:
            pass

    sector0 = source.read(0, 512)
    consider(0)

    if len(sector0) >= 512 and sector0[510:512] == b"\x55\xAA":
        entries = _parse_mbr(sector0)
        gpt = False
        for start_lba, ptype in entries:
            if ptype == 0xEE:
                gpt = True
                continue
            if start_lba > 0:
                consider(start_lba * 512)
        if gpt:
            for off in _parse_gpt(source):
                consider(off)

    return offsets


def _parse_mbr(sector0: bytes) -> list[tuple[int, int]]:
    """Liefert ``(start_lba, partitionstyp)`` der vier MBR-Eintraege."""
    result = []
    for i in range(4):
        base = 0x1BE + i * 16
        ptype = sector0[base + 4]
        start_lba = struct.unpack_from("<I", sector0, base + 8)[0]
        if ptype != 0 and start_lba != 0:
            result.append((start_lba, ptype))
    return result


def _parse_gpt(source) -> list[int]:
    """Liefert Byte-Offsets der GPT-Partitionsanfaenge (Sektorgroesse 512)."""
    offsets: list[int] = []
    header = source.read(512, 512)  # GPT-Header liegt in LBA 1
    if header[0:8] != b"EFI PART":
        return offsets
    part_lba = struct.unpack_from("<Q", header, 72)[0]
    num_parts = struct.unpack_from("<I", header, 80)[0]
    entry_size = struct.unpack_from("<I", header, 84)[0]
    if entry_size == 0 or num_parts == 0 or num_parts > 4096:
        return offsets
    table = source.read(part_lba * 512, num_parts * entry_size)
    zero_guid = b"\x00" * 16
    for i in range(num_parts):
        base = i * entry_size
        if base + 56 > len(table):
            break
        type_guid = table[base:base + 16]
        if type_guid == zero_guid:
            continue
        first_lba = struct.unpack_from("<Q", table, base + 32)[0]
        if first_lba > 0:
            offsets.append(first_lba * 512)
    return offsets
