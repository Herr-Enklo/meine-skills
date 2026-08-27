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

import datetime
import struct
from dataclasses import dataclass
from typing import Callable, Iterator, Optional

from .models import Finding

ProgressCb = Callable[[str, float, int], None]
CancelCb = Callable[[], bool]

# Attributtypen
ATTR_STANDARD_INFORMATION = 0x10
ATTR_FILE_NAME = 0x30
ATTR_DATA = 0x80
ATTR_END = 0xFFFFFFFF

# Wurzelverzeichnis der MFT (".") – Endpunkt der Pfad-Rekonstruktion.
ROOT_RECORD = 5


def filetime_to_iso(value: int) -> Optional[str]:
    """Wandelt einen NTFS-Zeitstempel (100-ns-Einheiten seit 1601) in Text um."""
    if not value:
        return None
    try:
        seconds = value / 10_000_000 - 11644473600
        dt = datetime.datetime.fromtimestamp(seconds, tz=datetime.timezone.utc)
        return dt.strftime("%Y-%m-%d %H:%M:%S")
    except (OverflowError, OSError, ValueError):
        return None

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

    def phys_of(self, voff: int) -> Optional[int]:
        """Physischer Quell-Offset einer virtuellen MFT-Position."""
        if not self._runs:
            return (self._linear_start or 0) + voff
        cluster = self.boot.cluster_size
        pos = 0
        for lcn, count in self._runs:
            run_bytes = count * cluster
            if voff < pos + run_bytes:
                if lcn is None:
                    return None
                return self._phys(lcn) + (voff - pos)
            pos += run_bytes
        return None


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


def _parse_file_name(record: bytes, off: int) -> Optional[dict]:
    """Liest Name, Namensraum und Elternreferenz aus ``$FILE_NAME``."""
    non_resident = record[off + 0x08]
    if non_resident:
        return None
    content_off = struct.unpack_from("<H", record, off + 0x14)[0]
    base = off + content_off
    if base + 0x42 > len(record):
        return None
    # Elternreferenz: die unteren 48 Bit sind die Datensatznummer des Ordners.
    parent_ref = struct.unpack_from("<Q", record, base + 0x00)[0] & 0xFFFFFFFFFFFF
    name_len = record[base + 0x40]
    namespace = record[base + 0x41]
    name_bytes = record[base + 0x42: base + 0x42 + name_len * 2]
    try:
        name = name_bytes.decode("utf-16-le", errors="replace")
    except Exception:
        return None
    return {"name": name, "namespace": namespace, "parent": parent_ref}


def _parse_standard_information(record: bytes, off: int) -> dict:
    """Liest die Zeitstempel aus ``$STANDARD_INFORMATION``."""
    content_off = struct.unpack_from("<H", record, off + 0x14)[0]
    base = off + content_off
    if base + 0x20 > len(record):
        return {}
    created = struct.unpack_from("<Q", record, base + 0x00)[0]
    modified = struct.unpack_from("<Q", record, base + 0x08)[0]
    accessed = struct.unpack_from("<Q", record, base + 0x18)[0]
    return {
        "created": filetime_to_iso(created),
        "modified": filetime_to_iso(modified),
        "accessed": filetime_to_iso(accessed),
    }


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


def _best_name_entry(names: list[dict]) -> Optional[dict]:
    """Waehlt aus mehreren ``$FILE_NAME``-Eintraegen den besten aus.

    Win32-Namen werden dem verkuerzten DOS-8.3-Namen vorgezogen.
    """
    if not names:
        return None
    for wanted in (NS_WIN32_DOS, NS_WIN32, NS_POSIX):
        for entry in names:
            if entry["namespace"] == wanted:
                return entry
    return names[0]


def scan_ntfs(source, base_offset: int,
              progress_cb: Optional[ProgressCb] = None,
              should_cancel: Optional[CancelCb] = None,
              deleted_only: bool = True,
              boot: Optional["BootSector"] = None) -> Iterator[Finding]:
    """Durchsucht ein NTFS-Volume ab ``base_offset`` nach Eintraegen.

    ``boot`` kann ein bereits (z.B. aus dem Backup-Boot-Sektor) rekonstruierter
    Boot-Sektor sein. Fehlt er, wird er am Volume-Anfang gelesen.
    """
    if boot is None:
        boot = BootSector(source.read(base_offset, 512))
    reader = MftReader(source, boot, base_offset)
    count = reader.record_count()

    # Erst alle Eintraege durchgehen: Namensindex fuer die Pfad-Rekonstruktion
    # aufbauen (auch Ordner und noch vorhandene Eintraege) und Funde sammeln.
    name_map: dict[int, tuple[str, int]] = {}
    findings: list[Finding] = []
    produced = 0
    for n in range(count):
        if should_cancel and should_cancel():
            break
        if progress_cb and count and (n % 256 == 0 or n == count - 1):
            progress_cb("MFT durchsuchen", (n + 1) / count, produced)

        record = reader.read_record(n)
        if record is None:
            continue
        entry = _record_name_entry(record)
        if entry:
            name_map[n] = entry
        rec_off = reader.phys_of(n * reader.record_size)
        finding = _finding_from_record(record, boot.cluster_size, base_offset,
                                       rec_off, n, deleted_only)
        if finding is not None:
            findings.append(finding)
            produced += 1

    # Pfade aufloesen und die Funde ausgeben.
    for finding in findings:
        _apply_path(finding, name_map)
        yield finding


def _record_name_entry(record: bytes) -> Optional[tuple[str, int]]:
    """Bester Name und Elternreferenz eines Eintrags fuer den Namensindex."""
    names = []
    for off, atype, _length in _iter_attributes(record):
        if atype == ATTR_FILE_NAME:
            parsed = _parse_file_name(record, off)
            if parsed:
                names.append(parsed)
    best = _best_name_entry(names)
    if not best:
        return None
    return best["name"], best["parent"]


def _resolve_path(name_map: dict, parent: Optional[int]) -> str:
    """Baut den Ordnerpfad ueber die Elternreferenzen zusammen."""
    parts: list[str] = []
    seen: set[int] = set()
    while parent is not None and parent != ROOT_RECORD and parent not in seen:
        seen.add(parent)
        entry = name_map.get(parent)
        if not entry:
            break
        parts.append(entry[0])
        parent = entry[1]
        if len(parts) > 64:        # Schutz vor Zyklen
            break
    return "/".join(reversed(parts))


def _apply_path(finding: Finding, name_map: dict) -> None:
    """Setzt den vollstaendigen Pfad eines NTFS-Funds anhand des Namensindex."""
    if finding.kind != "ntfs":
        return
    raw = finding.extra.get("name_raw")
    if not raw:
        return
    folder = _resolve_path(name_map, finding.extra.get("parent"))
    full = f"{folder}/{raw}" if folder else raw
    finding.extra["path"] = full
    number = finding.name.split("_", 1)[0]
    finding.name = f"{number}_{_safe_name(full)}"


def _finding_from_record(record: bytes, cluster_size: int, base_offset: int,
                         record_offset: Optional[int], number: int,
                         deleted_only: bool) -> Optional[Finding]:
    """Wertet einen einzelnen MFT-Eintrag aus und baut daraus einen ``Finding``.

    Gemeinsam genutzt vom MFT-Durchlauf und vom geraeteweiten Orphan-Scan.
    """
    flags = struct.unpack_from("<H", record, 0x16)[0]
    in_use = bool(flags & FLAG_IN_USE)
    if flags & FLAG_DIRECTORY:
        return None
    if deleted_only and in_use:
        return None

    names: list[dict] = []
    times: dict = {}
    for off, atype, _length in _iter_attributes(record):
        if atype == ATTR_FILE_NAME:
            parsed = _parse_file_name(record, off)
            if parsed:
                names.append(parsed)
        elif atype == ATTR_STANDARD_INFORMATION and not times:
            times = _parse_standard_information(record, off)
    best = _best_name_entry(names)
    if not best:
        return None
    name = best["name"]

    data_attr = _find_data_attribute(record)
    if data_attr is None:
        return None
    real_size = data_attr.get("real_size", 0)
    if not real_size or real_size <= 0:
        return None

    ext = name.rsplit(".", 1)[-1].lower() if "." in name else "bin"
    extra: dict = {
        "base_offset": base_offset,
        "cluster_size": cluster_size,
        "real_size": real_size,
        "record_offset": record_offset,
        "parent": best.get("parent"),
        "name_raw": name,
        "created": times.get("created"),
        "modified": times.get("modified"),
        "accessed": times.get("accessed"),
    }
    if data_attr.get("resident"):
        extra["resident_data"] = data_attr["resident_data"]
    else:
        extra["data_runs"] = data_attr["data_runs"]

    return Finding(
        kind="ntfs",
        type_name="NTFS-Datei" + ("" if in_use else " (geloescht)"),
        ext=ext,
        name=f"{number:06d}_{_safe_name(name)}",
        offset=record_offset if record_offset is not None else base_offset,
        size=real_size,
        extra=extra,
    )


def scan_orphan_mft(source, cluster_size: int = 4096, base_offset: int = 0,
                    progress_cb: Optional[ProgressCb] = None,
                    should_cancel: Optional[CancelCb] = None,
                    deleted_only: bool = True,
                    record_size: int = 1024) -> Iterator[Finding]:
    """Sucht MFT-Eintraege ueber den gesamten Datentraeger.

    Anders als ``scan_ntfs`` verlaesst sich dieser Durchlauf nicht auf einen
    intakten Boot-Sektor oder eine intakte ``$MFT``. Er durchsucht die Rohdaten
    an Sektorgrenzen nach ``FILE``-Eintraegen und wertet jeden einzeln aus. Das
    findet geloeschte Dateien auch nach einer Formatierung, solange ihre
    MFT-Eintraege noch vorhanden sind.

    ``cluster_size`` und ``base_offset`` werden fuer nicht-residente Inhalte
    gebraucht; sind sie unbekannt, liefern residente (kleine) Dateien trotzdem
    zuverlaessige Ergebnisse.
    """
    total = source.size or 0
    produced = 0
    number = 0
    seen: set[int] = set()

    for chunk_off, data in source.stream(chunk_size=8 * 1024 * 1024):
        if should_cancel and should_cancel():
            break
        if progress_cb and total:
            progress_cb("Datentraeger nach MFT-Eintraegen durchsuchen",
                        min(1.0, (chunk_off + len(data)) / total), produced)
        # ``FILE`` nur an Sektorgrenzen pruefen – dort liegen MFT-Eintraege.
        limit = len(data) - 4
        i = 0
        while i <= limit:
            if data[i:i + 4] == b"FILE":
                abs_off = chunk_off + i
                if abs_off not in seen:
                    seen.add(abs_off)
                    finding = _try_orphan_record(source, abs_off, record_size,
                                                 cluster_size, base_offset,
                                                 number, deleted_only)
                    if finding is not None:
                        number += 1
                        produced += 1
                        yield finding
            i += 512


def _try_orphan_record(source, abs_off: int, record_size: int,
                       cluster_size: int, base_offset: int, number: int,
                       deleted_only: bool) -> Optional[Finding]:
    raw = bytearray(source.read(abs_off, record_size))
    if len(raw) < record_size or raw[0:4] != b"FILE":
        return None
    # Grober Plausibilitaetstest: der Update-Sequence-Offset muss im Eintrag liegen.
    usa_offset = struct.unpack_from("<H", raw, 0x04)[0]
    if usa_offset == 0 or usa_offset > record_size - 4:
        return None
    bytes_per_sector = 512
    _apply_fixup(raw, bytes_per_sector)
    try:
        return _finding_from_record(raw, cluster_size, base_offset, abs_off,
                                    number, deleted_only)
    except Exception:
        return None


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


def partition_offsets(source) -> list[int]:
    """Byte-Offsets aller Partitionsanfaenge (MBR/GPT) inklusive Offset 0.

    Typunabhaengig – dient der FAT/exFAT-Erkennung, die nicht nur NTFS sucht.
    """
    offsets = [0]
    seen = {0}

    def add(off: int) -> None:
        if off > 0 and off not in seen:
            seen.add(off)
            offsets.append(off)

    sector0 = source.read(0, 512)
    if len(sector0) >= 512 and sector0[510:512] == b"\x55\xAA":
        gpt = False
        for start_lba, ptype in _parse_mbr(sector0):
            if ptype == 0xEE:
                gpt = True
                continue
            add(start_lba * 512)
        if gpt:
            for off in _parse_gpt(source):
                add(off)
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


# -- Partitionsrekonstruktion (TestDisk-Ansatz) -------------------------

@dataclass
class VolumeInfo:
    """Ein erkanntes Volume, egal ob aus der Tabelle oder rekonstruiert."""
    offset: int              # Byte-Offset des Volume-Anfangs auf der Quelle
    size: Optional[int]      # Groesse in Bytes, falls bekannt
    cluster_size: Optional[int]
    fs_type: str             # "ntfs" oder "fat"
    origin: str              # "tabelle", "boot", "backup", "fat-boot"
    # Rekonstruierter Boot-Sektor. Wichtig, wenn der originale am Volume-Anfang
    # zerstoert ist und die Kennzahlen aus der Kopie stammen.
    boot: Optional["BootSector"] = None


def _mft_present(source, base: int, boot: BootSector) -> bool:
    """Prueft, ob an der aus dem Boot-Sektor erwarteten Stelle eine MFT liegt."""
    off = base + boot.mft_cluster * boot.cluster_size
    try:
        return source.read(off, 4) == b"FILE"
    except Exception:
        return False


def _reconstruct_ntfs(source, found_offset: int, boot: BootSector) -> Optional[VolumeInfo]:
    """Bestimmt aus einem gefundenen NTFS-Boot-Sektor den Volume-Anfang.

    Der Boot-Sektor kann der originale (am Volume-Anfang) oder die Kopie (am
    Volume-Ende) sein. In beiden Faellen wird der echte Anfang ueber die im
    Boot-Sektor genannte Lage der MFT bestaetigt.
    """
    size = boot.total_sectors * boot.bytes_per_sector
    # Fall 1: gefundener Sektor ist der originale Boot-Sektor am Anfang.
    if _mft_present(source, found_offset, boot):
        return VolumeInfo(found_offset, size, boot.cluster_size, "ntfs", "boot", boot)
    # Fall 2: gefundener Sektor ist die Kopie am Ende -> Anfang zurueckrechnen.
    bps = boot.bytes_per_sector
    total = boot.total_sectors
    for k in (total, total - 1, total + 1, total - 2, total + 2):
        base = found_offset - k * bps
        if base < 0:
            continue
        if _mft_present(source, base, boot):
            return VolumeInfo(base, size, boot.cluster_size, "ntfs", "backup", boot)
    return None


def _fat_size(sector: bytes) -> Optional[int]:
    """Groesse eines FAT-Volumes aus dem Boot-Sektor, oder None wenn kein FAT."""
    if len(sector) < 512 or sector[510:512] != b"\x55\xAA":
        return None
    bps = struct.unpack_from("<H", sector, 0x0B)[0]
    if bps not in (512, 1024, 2048, 4096):
        return None
    is_fat32 = sector[0x52:0x57] == b"FAT32"
    is_fat1x = sector[0x36:0x3B] in (b"FAT12", b"FAT16", b"FAT  ")
    if not (is_fat32 or is_fat1x):
        return None
    total16 = struct.unpack_from("<H", sector, 0x13)[0]
    total32 = struct.unpack_from("<I", sector, 0x20)[0]
    total = total16 or total32
    return total * bps if total else None


def _ntfs_boot(sector: bytes) -> Optional[BootSector]:
    try:
        return BootSector(sector)
    except NtfsError:
        return None


def reconstruct_volumes(source, thorough: bool = True,
                        progress_cb: Optional[ProgressCb] = None,
                        should_cancel: Optional[CancelCb] = None) -> list[VolumeInfo]:
    """Rekonstruiert Volumes ueber eine Boot-Sektor-Suche (TestDisk-Ansatz).

    Auch ohne intakte Partitionstabelle findet dieser Durchlauf NTFS-Volumes,
    indem er den Datentraeger nach Boot-Sektoren (Original und Kopie) absucht und
    aus deren BPB den Volume-Anfang und die Groesse errechnet. FAT-Volumes werden
    erkannt und gemeldet (mangels FAT-Parser aber nicht ausgelesen).

    ``thorough=True`` durchsucht die gesamte Quelle Sektor fuer Sektor.
    ``thorough=False`` prueft nur die ueblichen Startsektoren und ist damit
    sehr schnell, findet aber nur Standard-Layouts.
    """
    vols: dict[int, VolumeInfo] = {}

    def add(v: Optional[VolumeInfo]) -> None:
        if v is not None and v.offset not in vols:
            vols[v.offset] = v

    def check_sector(sector: bytes, abs_off: int) -> None:
        if sector[3:11] == b"NTFS    ":
            boot = _ntfs_boot(sector)
            if boot:
                add(_reconstruct_ntfs(source, abs_off, boot))
        elif sector[3:11] == b"EXFAT   ":
            bps_shift = sector[0x6C]
            vol_len = struct.unpack_from("<Q", sector, 0x48)[0]
            size = (vol_len << bps_shift) if 9 <= bps_shift <= 12 else None
            add(VolumeInfo(abs_off, size, None, "exfat", "exfat-boot"))
        else:
            size = _fat_size(sector)
            if size is not None:
                add(VolumeInfo(abs_off, size, None, "fat", "fat-boot"))

    if not thorough:
        candidates = {0, 63 * 512, 2048 * 512, 34 * 512}
        candidates.update(find_ntfs_volumes(source))
        for off in sorted(candidates):
            sector = source.read(off, 512)
            if len(sector) >= 512:
                check_sector(sector, off)
        return list(vols.values())

    total = source.size or 0
    for chunk_off, data in source.stream(chunk_size=8 * 1024 * 1024):
        if should_cancel and should_cancel():
            break
        if progress_cb and total:
            progress_cb("Nach Boot-Sektoren suchen",
                        min(1.0, (chunk_off + len(data)) / total), len(vols))
        # Seltene Signaturen gezielt anspringen, statt jeden Sektor zu pruefen.
        for needle, delta in ((b"NTFS    ", 3), (b"EXFAT   ", 3),
                              (b"FAT32", 0x52), (b"FAT16", 0x36), (b"FAT12", 0x36)):
            start = 0
            while True:
                idx = data.find(needle, start)
                if idx < 0:
                    break
                start = idx + 1
                sec_start = idx - delta
                if sec_start < 0 or sec_start + 512 > len(data):
                    continue
                if (chunk_off + sec_start) % 512 != 0:
                    continue
                check_sector(bytes(data[sec_start:sec_start + 512]), chunk_off + sec_start)

    return list(vols.values())
