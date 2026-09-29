"""NTFS-/MFT-Parser zum Wiederherstellen geloeschter Dateien.

NTFS verwaltet jede Datei in einem Eintrag der *Master File Table* (MFT). Beim
Loeschen wird der Eintrag nur als "nicht in Benutzung" markiert – Name, Groesse
und der Verweis auf die Datencluster bleiben zunaechst erhalten. Genau diese
Eintraege sucht der Parser.

Umfang:

- Boot-Sektor auswerten und auf Plausibilitaet pruefen
- MFT ueber ihre eigenen Data-Runs durchlaufen (auch fragmentiert und ueber
  ``$ATTRIBUTE_LIST`` verteilt); bei beschaedigtem Eintrag 0 hilft ``$MFTMirr``
- Update-Sequence-Fixups anwenden (immer im Abstand von 512 Byte)
- Attribute ``$STANDARD_INFORMATION``, ``$FILE_NAME`` und ``$DATA`` auslesen,
  auch wenn sie in Erweiterungseintraegen liegen (``$ATTRIBUTE_LIST``)
- Inhalt resident, ueber Data-Runs oder NTFS-komprimiert (LZNT1) lesen
- Zustand geloeschter Dateien ueber ``$Bitmap`` bewerten (Cluster neu belegt?)

Physische Datentraeger mit mehreren Partitionen werden unterstuetzt: MBR samt
erweiterter Partitionen (EBR-Kette) und GPT werden ausgewertet.
"""

from __future__ import annotations

import datetime
import struct
from dataclasses import dataclass, field
from typing import Iterator, Optional

from .models import CancelCb, Finding, ProgressCb, safe_name

# Attributtypen
ATTR_STANDARD_INFORMATION = 0x10
ATTR_ATTRIBUTE_LIST = 0x20
ATTR_FILE_NAME = 0x30
ATTR_DATA = 0x80
ATTR_END = 0xFFFFFFFF

# Attribut-Flags (Offset 0x0C im Attributkopf)
ATTR_FLAG_COMPRESSED = 0x0001
ATTR_FLAG_ENCRYPTED = 0x4000
ATTR_FLAG_SPARSE = 0x8000

# Feste MFT-Eintraege
MFT_RECORD = 0
ROOT_RECORD = 5          # Wurzelverzeichnis – Endpunkt der Pfad-Rekonstruktion
BITMAP_RECORD = 6        # $Bitmap – Belegung der Cluster
EXTEND_RECORD = 11       # $Extend – enthaelt u.a. $UsnJrnl

# NTFS schuetzt MFT-Eintraege abschnittsweise alle 512 Byte, unabhaengig von der
# Sektorgroesse des Datentraegers (SEQUENCE_NUMBER_STRIDE). Auf 4Kn-Platten hat
# ein 4-KiB-Eintrag daher neun Eintraege im Update-Sequence-Array.
FIXUP_STRIDE = 512

# MFT-Eintrags-Flags
FLAG_IN_USE = 0x01
FLAG_DIRECTORY = 0x02

# $FILE_NAME-Namensraeume
NS_POSIX = 0
NS_WIN32 = 1
NS_DOS = 2
NS_WIN32_DOS = 3

_REF_MASK = 0xFFFFFFFFFFFF          # untere 48 Bit einer MFT-Referenz


def filetime_to_epoch(value: int) -> Optional[float]:
    """NTFS-Zeitstempel (100-ns-Einheiten seit 1601, UTC) als Unix-Zeit."""
    if not value:
        return None
    seconds = value / 10_000_000 - 11644473600
    if not (0 < seconds < 32503680000):          # vor 1970 oder nach 3000: unplausibel
        return None
    return seconds


def filetime_to_iso(value: int) -> Optional[str]:
    """Wandelt einen NTFS-Zeitstempel in Text um (UTC)."""
    seconds = filetime_to_epoch(value)
    if seconds is None:
        return None
    try:
        dt = datetime.datetime.fromtimestamp(seconds, tz=datetime.timezone.utc)
        return dt.strftime("%Y-%m-%d %H:%M:%S")
    except (OverflowError, OSError, ValueError):
        return None


class NtfsError(Exception):
    pass


class BootSector:
    """Ausgewertete und auf Plausibilitaet gepruefte Kennzahlen des Boot-Sektors.

    Die Pruefung verhindert, dass ein zufaellig passender Sektor (etwa beim
    Rekonstruieren) als Volume durchgeht oder dass absurde Werte zu riesigen
    Lesezugriffen fuehren.
    """

    def __init__(self, data: bytes):
        if len(data) < 512 or data[3:11] != b"NTFS    ":
            raise NtfsError("kein NTFS-Boot-Sektor")
        bps = struct.unpack_from("<H", data, 0x0B)[0]
        if bps not in (512, 1024, 2048, 4096):
            raise NtfsError("ungueltige Sektorgroesse")
        self.bytes_per_sector = bps
        spc = data[0x0D]
        if spc <= 0x80:
            sectors = spc
        else:
            shift = 0x100 - spc                  # grosse Cluster: 2^abs(wert)
            sectors = 1 << shift if shift <= 20 else 0
        if sectors == 0 or sectors & (sectors - 1):
            raise NtfsError("ungueltige Clustergroesse")
        self.sectors_per_cluster = sectors
        self.cluster_size = bps * sectors
        if self.cluster_size > 2 * 1024 * 1024:
            raise NtfsError("Cluster groesser als 2 MiB")

        self.total_sectors = struct.unpack_from("<Q", data, 0x28)[0]
        self.mft_cluster = struct.unpack_from("<Q", data, 0x30)[0]
        self.mft_mirror_cluster = struct.unpack_from("<Q", data, 0x38)[0]
        if self.total_sectors == 0:
            raise NtfsError("Volume ohne Sektoren")
        total_clusters = self.total_sectors // sectors
        if self.mft_cluster == 0 or self.mft_cluster >= max(total_clusters, 1):
            raise NtfsError("MFT liegt ausserhalb des Volumes")

        cpr = struct.unpack_from("<b", data, 0x40)[0]       # vorzeichenbehaftet
        if cpr > 0:
            record_size = cpr * self.cluster_size
        elif -16 <= cpr < 0:
            record_size = 1 << (-cpr)
        else:
            record_size = 0
        if record_size < 256 or record_size > 65536 or record_size & (record_size - 1):
            raise NtfsError("ungueltige Groesse der MFT-Eintraege")
        self.record_size = record_size

    @property
    def total_clusters(self) -> int:
        return self.total_sectors // self.sectors_per_cluster


def _apply_fixup(record: bytearray, stride: int = FIXUP_STRIDE) -> int:
    """Stellt die Update-Sequence-Fixups eines MFT-Eintrags wieder her.

    NTFS ersetzt die letzten zwei Bytes jedes 512-Byte-Abschnitts durch eine
    Pruefzahl und sichert die Originalbytes im Update-Sequence-Array. Zum
    korrekten Lesen muessen die Originalbytes zurueckgeschrieben werden.

    Rueckgabe: Anzahl der Abschnitte, deren Pruefzahl nicht passte (0 = der
    Eintrag wurde vollstaendig geschrieben).
    """
    if len(record) < 0x08:
        return 0
    usa_offset, usa_count = struct.unpack_from("<HH", record, 0x04)
    if usa_count < 2 or usa_offset < 0x08 or usa_offset + 2 * usa_count > len(record):
        return 0
    blocks = usa_count - 1
    if blocks * stride != len(record) and len(record) % blocks == 0:
        stride = len(record) // blocks
    usn = bytes(record[usa_offset:usa_offset + 2])
    originals = bytes(record[usa_offset + 2:usa_offset + 2 * usa_count])
    bad = 0
    for i in range(blocks):
        end = (i + 1) * stride
        if end > len(record):
            break
        if record[end - 2:end] != usn:
            bad += 1
        record[end - 2:end] = originals[i * 2:i * 2 + 2]
    return bad


def parse_data_runs(buf: bytes) -> list[tuple[Optional[int], int]]:
    """Parst die Data-Runs eines nicht-residenten Attributs.

    Rueckgabe: Liste aus ``(lcn, cluster_anzahl)``. ``lcn is None`` markiert
    einen "sparse" Bereich (Nullen, kein physischer Speicher). Eine
    beschaedigte Liste (negativer LCN, Laenge 0) wird an dieser Stelle beendet.
    """
    runs: list[tuple[Optional[int], int]] = []
    i = 0
    prev_lcn = 0
    n = len(buf)
    while i < n and len(runs) < 1_000_000:
        header = buf[i]
        if header == 0:
            break
        len_size = header & 0x0F
        off_size = (header >> 4) & 0x0F
        i += 1
        if len_size == 0 or len_size > 8 or off_size > 8 or i + len_size + off_size > n:
            break
        run_len = int.from_bytes(buf[i:i + len_size], "little", signed=True)
        i += len_size
        if run_len <= 0:
            break
        if off_size == 0:
            runs.append((None, run_len))  # sparse
            continue
        # Offset ist vorzeichenbehaftet und relativ zum vorigen LCN.
        delta = int.from_bytes(buf[i:i + off_size], "little", signed=True)
        i += off_size
        prev_lcn += delta
        if prev_lcn < 0:
            break
        runs.append((prev_lcn, run_len))
    return runs


def read_virtual(source, runs, cluster_size: int, base_offset: int,
                 voff: int, length: int) -> bytes:
    """Liest ``length`` Bytes ab der virtuellen Position ``voff`` eines Attributs.

    Die Position wird ueber die Data-Runs auf physische Offsets abgebildet;
    Sparse-Bereiche liefern Nullen. Reichen die Runs nicht, ist das Ergebnis
    entsprechend kuerzer.
    """
    out = bytearray()
    pos = 0
    for lcn, count in runs:
        if len(out) >= length:
            break
        run_bytes = count * cluster_size
        if voff < pos + run_bytes:
            inner = voff - pos
            take = min(length - len(out), run_bytes - inner)
            if lcn is None:
                out += bytes(take)
            else:
                data = source.read(base_offset + lcn * cluster_size + inner, take)
                out += data
                if len(data) < take:
                    break
            voff += take
        pos += run_bytes
    return bytes(out)


def read_runs(source, runs, cluster_size: int, base_offset: int,
              real_size: int) -> bytes:
    """Liest einen kleinen, ueber Data-Runs verteilten Inhalt in den Speicher."""
    return read_virtual(source, runs, cluster_size, base_offset, 0, real_size)


# -- Attribute --------------------------------------------------------------

def _iter_attributes(record: bytes) -> Iterator[tuple[int, int, int]]:
    """Iteriert die Attribute eines (fixup-korrigierten) Eintrags.

    Liefert ``(offset, typ, laenge)``. Jedes Attribut wird auf seine
    Mindestlaenge geprueft, damit die Leser danach nicht ueber das Ende eines
    beschaedigten Eintrags hinausgreifen.
    """
    n = len(record)
    if n < 0x18:
        return
    off = struct.unpack_from("<H", record, 0x14)[0]
    used = struct.unpack_from("<I", record, 0x18)[0]
    limit = used if 0x18 < used <= n else n
    guard = 0
    while 0x18 <= off and off + 0x10 <= limit and guard < 512:
        guard += 1
        atype = struct.unpack_from("<I", record, off)[0]
        if atype == ATTR_END:
            break
        length = struct.unpack_from("<I", record, off + 4)[0]
        if length < 0x18 or off + length > limit:
            break
        if record[off + 8] and length < 0x40:        # nicht-residenter Kopf: 0x40 Byte
            break
        yield off, atype, length
        off += length


def _attr_name(record: bytes, off: int, length: int) -> Optional[str]:
    """Name eines Attributs (leer fuer unbenannte), ``None`` wenn ungueltig."""
    name_len = record[off + 9]
    if not name_len:
        return ""
    name_off = struct.unpack_from("<H", record, off + 0x0A)[0]
    end = off + name_off + 2 * name_len
    if name_off < 0x10 or end > off + length:
        return None
    return bytes(record[off + name_off:end]).decode("utf-16-le", "replace")


def _resident_value(record: bytes, off: int, length: int) -> Optional[bytes]:
    if record[off + 8]:
        return None
    content_len = struct.unpack_from("<I", record, off + 0x10)[0]
    content_off = struct.unpack_from("<H", record, off + 0x14)[0]
    if content_off < 0x10 or content_off + content_len > length:
        return None
    return bytes(record[off + content_off:off + content_off + content_len])


def _parse_file_name(record: bytes, off: int, length: Optional[int] = None) -> Optional[dict]:
    """Liest Name, Namensraum und Elternreferenz aus ``$FILE_NAME``."""
    if length is None:
        length = struct.unpack_from("<I", record, off + 4)[0]
    value = _resident_value(record, off, length)
    if value is None or len(value) < 0x42:
        return None
    parent_ref = struct.unpack_from("<Q", value, 0)[0] & _REF_MASK
    name_len = value[0x40]
    namespace = value[0x41]
    raw = value[0x42:0x42 + name_len * 2]
    if len(raw) < name_len * 2 or not name_len:
        return None
    name = raw.decode("utf-16-le", errors="replace")
    return {"name": name, "namespace": namespace, "parent": parent_ref}


def _parse_standard_information(record: bytes, off: int, length: int) -> dict:
    """Liest die Zeitstempel aus ``$STANDARD_INFORMATION``."""
    value = _resident_value(record, off, length)
    if value is None or len(value) < 0x20:
        return {}
    created, modified, _mft_changed, accessed = struct.unpack_from("<QQQQ", value, 0)
    return {
        "created": filetime_to_iso(created),
        "modified": filetime_to_iso(modified),
        "accessed": filetime_to_iso(accessed),
        "mtime_epoch": filetime_to_epoch(modified),
        "atime_epoch": filetime_to_epoch(accessed),
    }


@dataclass
class DataExtent:
    """Ein Teilstueck (Attribut-Record) des unbenannten ``$DATA``-Attributs."""
    start_vcn: int
    runs: list
    real_size: int              # nur im Teilstueck mit VCN 0 gueltig
    flags: int
    cu_shift: int               # log2 der Kompressionseinheit in Clustern
    resident: Optional[bytes] = None


def _data_extent(record: bytes, off: int, length: int) -> Optional[DataExtent]:
    flags = struct.unpack_from("<H", record, off + 0x0C)[0]
    if not record[off + 8]:
        value = _resident_value(record, off, length)
        if value is None:
            return None
        return DataExtent(0, [], len(value), flags, 0, resident=value)
    start_vcn = struct.unpack_from("<Q", record, off + 0x10)[0]
    runs_off = struct.unpack_from("<H", record, off + 0x20)[0]
    cu_shift = record[off + 0x22]
    real_size = struct.unpack_from("<Q", record, off + 0x30)[0]
    if runs_off < 0x40 or runs_off >= length:
        return None
    runs = parse_data_runs(bytes(record[off + runs_off:off + length]))
    return DataExtent(start_vcn, runs, real_size, flags, cu_shift)


@dataclass
class RecordInfo:
    """Die fuer die Wiederherstellung relevanten Inhalte eines MFT-Eintrags."""
    number: int
    flags: int
    base_ref: int                           # 0 = Basiseintrag
    names: list = field(default_factory=list)
    times: dict = field(default_factory=dict)
    data: list = field(default_factory=list)   # DataExtent des unbenannten $DATA
    has_attribute_list: bool = False

    @property
    def in_use(self) -> bool:
        return bool(self.flags & FLAG_IN_USE)

    @property
    def is_directory(self) -> bool:
        return bool(self.flags & FLAG_DIRECTORY)


def gather(record: bytes, number: int, reader: Optional["MftReader"] = None) -> RecordInfo:
    """Sammelt Namen, Zeiten und ``$DATA`` eines Eintrags.

    Mit ``reader`` werden ueber ``$ATTRIBUTE_LIST`` auch die Attribute aus den
    Erweiterungseintraegen eingesammelt (grosse, stark fragmentierte Dateien,
    Ordner mit sehr vielen Eintraegen).
    """
    flags = struct.unpack_from("<H", record, 0x16)[0] if len(record) >= 0x18 else 0
    base_ref = (struct.unpack_from("<Q", record, 0x20)[0] & _REF_MASK) if len(record) >= 0x28 else 0
    info = RecordInfo(number, flags, base_ref)
    attr_list: Optional[tuple[int, int]] = None
    for off, atype, length in _iter_attributes(record):
        try:
            if atype == ATTR_FILE_NAME:
                parsed = _parse_file_name(record, off, length)
                if parsed:
                    info.names.append(parsed)
            elif atype == ATTR_STANDARD_INFORMATION and not info.times:
                info.times = _parse_standard_information(record, off, length)
            elif atype == ATTR_DATA and _attr_name(record, off, length) == "":
                extent = _data_extent(record, off, length)
                if extent is not None:
                    info.data.append(extent)
            elif atype == ATTR_ATTRIBUTE_LIST:
                attr_list = (off, length)
        except (struct.error, IndexError, ValueError):
            continue
    if attr_list is not None:
        info.has_attribute_list = True
        if reader is not None:
            try:
                _merge_attribute_list(info, record, attr_list, reader)
            except (struct.error, IndexError, ValueError, NtfsError):
                pass
    return info


def _attribute_list_value(record: bytes, off: int, length: int,
                          reader: "MftReader") -> Optional[bytes]:
    value = _resident_value(record, off, length)
    if value is not None:
        return value
    if not record[off + 8]:
        return None
    runs_off = struct.unpack_from("<H", record, off + 0x20)[0]
    real_size = struct.unpack_from("<Q", record, off + 0x30)[0]
    if runs_off < 0x40 or runs_off >= length:
        return None
    runs = parse_data_runs(bytes(record[off + runs_off:off + length]))
    return read_runs(reader.source, runs, reader.boot.cluster_size, reader.base,
                     min(real_size, 1024 * 1024))


def _merge_attribute_list(info: RecordInfo, record: bytes, where: tuple[int, int],
                          reader: "MftReader") -> None:
    value = _attribute_list_value(record, where[0], where[1], reader)
    if not value:
        return
    wanted: dict[int, set] = {}                  # Eintragsnummer -> Attributtypen
    sequences: dict[int, int] = {}
    pos = 0
    while pos + 0x1A <= len(value):
        atype = struct.unpack_from("<I", value, pos)[0]
        entry_len = struct.unpack_from("<H", value, pos + 4)[0]
        if entry_len < 0x1A or pos + entry_len > len(value):
            break
        name_len = value[pos + 6]
        name_off = value[pos + 7]
        full_ref = struct.unpack_from("<Q", value, pos + 0x10)[0]
        ref = full_ref & _REF_MASK
        name = value[pos + name_off:pos + name_off + 2 * name_len].decode("utf-16-le", "replace")
        pos += entry_len
        if ref == info.number:
            continue
        if atype in (ATTR_FILE_NAME, ATTR_STANDARD_INFORMATION) or (atype == ATTR_DATA and not name):
            wanted.setdefault(ref, set()).add(atype)
            sequences[ref] = full_ref >> 48
    known_vcns = {e.start_vcn for e in info.data}
    for ref in sorted(wanted)[:512]:
        ext = reader.read_record(ref)
        if ext is None:
            continue
        # Der Erweiterungseintrag muss auf diesen Basiseintrag zeigen und zur
        # Sequenznummer passen, sonst wurde er fuer eine andere Datei wiederverwendet.
        if (struct.unpack_from("<Q", ext, 0x20)[0] & _REF_MASK) != info.number:
            continue
        if not _sequence_matches(sequences.get(ref, 0), struct.unpack_from("<H", ext, 0x10)[0]):
            continue
        sub = gather(ext, ref)
        types = wanted[ref]
        if ATTR_FILE_NAME in types:
            info.names.extend(sub.names)
        if ATTR_STANDARD_INFORMATION in types and not info.times:
            info.times = sub.times
        if ATTR_DATA in types:
            for extent in sub.data:
                if extent.resident is None and extent.start_vcn not in known_vcns:
                    info.data.append(extent)
                    known_vcns.add(extent.start_vcn)


def _sequence_matches(expected: int, actual: int) -> bool:
    """Passt die Sequenznummer eines Eintrags zu einem Verweis darauf?

    Beim Loeschen erhoeht NTFS die Sequenznummer um eins; ein Verweis aus der
    Zeit vor dem Loeschen traegt also die alte Nummer. ``0`` bedeutet: unbekannt.
    """
    return expected == 0 or actual == expected or actual == (expected + 1) & 0xFFFF


def assemble_data(extents: list) -> Optional[dict]:
    """Fuegt die Teilstuecke von ``$DATA`` zu einer Beschreibung zusammen.

    Luecken zwischen Teilstuecken (fehlender Erweiterungseintrag) werden als
    Sparse-Bereich eingefuegt, damit die folgenden Daten an der richtigen
    Position landen.
    """
    if not extents:
        return None
    resident = next((e for e in extents if e.resident is not None), None)
    if resident is not None:
        return {"resident": True, "resident_data": resident.resident,
                "real_size": len(resident.resident), "flags": resident.flags}
    ordered = sorted({e.start_vcn: e for e in extents}.values(), key=lambda e: e.start_vcn)
    first = ordered[0]
    if first.start_vcn != 0:
        return None
    runs: list = []
    vcn = 0
    for extent in ordered:
        if extent.start_vcn < vcn:
            continue
        if extent.start_vcn > vcn:
            runs.append((None, extent.start_vcn - vcn))
            vcn = extent.start_vcn
        runs.extend(extent.runs)
        vcn += sum(count for _lcn, count in extent.runs)
    return {"resident": False, "data_runs": runs, "real_size": first.real_size,
            "flags": first.flags, "cu_shift": first.cu_shift}


def _find_data_attribute(record: bytes) -> Optional[dict]:
    """Beschreibt das unbenannte ``$DATA`` eines einzelnen Eintrags."""
    return assemble_data(gather(record, 0).data)


def _best_name_entry(names: list) -> Optional[dict]:
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


def _record_name_entry(record: bytes) -> Optional[tuple[str, int]]:
    """Bester Name und Elternreferenz eines Eintrags (nur der Eintrag selbst)."""
    best = _best_name_entry(gather(record, 0).names)
    if not best:
        return None
    return best["name"], best["parent"]


# -- MFT lesen -----------------------------------------------------------------

class MftReader:
    """Liest MFT-Eintraege ueber die Data-Runs der ``$MFT`` selbst.

    Eintraege werden blockweise (256 auf einmal) gelesen und zwischengespeichert:
    ein Lesezugriff je Eintrag waere auf USB-Platten und rohen Windows-Geraeten
    ohne Cache sehr langsam.
    """

    _BLOCK_RECORDS = 256
    _CACHE_BLOCKS = 8

    def __init__(self, source, boot: BootSector, base_offset: int):
        self.source = source
        self.boot = boot
        self.base = base_offset
        self.record_size = boot.record_size
        self._runs: list = []
        self._mft_bytes = 0
        self._linear_start = self._phys(boot.mft_cluster)
        self._cache: dict[int, bytes] = {}
        self._cache_order: list[int] = []
        self._map_mft()

    @property
    def linear(self) -> bool:
        """True, wenn die MFT mangels Run-Liste linear gelesen wird."""
        return not self._runs

    def _phys(self, lcn: int) -> int:
        return self.base + lcn * self.boot.cluster_size

    def _read_raw_record(self, phys: int) -> Optional[bytearray]:
        raw = bytearray(self.source.read(phys, self.record_size))
        if len(raw) < self.record_size or raw[0:4] != b"FILE":
            return None
        _apply_fixup(raw)
        return raw

    def _map_mft(self) -> None:
        rec0 = self._read_raw_record(self._phys(self.boot.mft_cluster))
        if rec0 is None and self.boot.mft_mirror_cluster:
            # Eintrag 0 beschaedigt: die Kopie in $MFTMirr beschreibt dieselben Runs.
            rec0 = self._read_raw_record(self._phys(self.boot.mft_mirror_cluster))
        if rec0 is None:
            raise NtfsError("MFT-Eintrag 0 nicht gefunden")
        info = gather(rec0, MFT_RECORD)
        data = assemble_data(info.data)
        if data is None or data["resident"] or not data["data_runs"]:
            return                              # Rueckfall: linear ab MFT-Cluster
        self._runs = data["data_runs"]
        self._mft_bytes = data["real_size"]
        if info.has_attribute_list:
            # Die $MFT selbst ist so zersplittert, dass ihre Runs in
            # Erweiterungseintraegen weitergehen. Diese liegen im bereits
            # abgebildeten Anfang der MFT und koennen jetzt gelesen werden.
            full = assemble_data(gather(rec0, MFT_RECORD, self).data)
            if full and not full["resident"] and full["data_runs"]:
                self._runs = full["data_runs"]
                self._cache.clear()
                self._cache_order.clear()

    def record_count(self) -> int:
        # Obergrenzen gegen beschaedigte Groessenfelder: nie mehr Eintraege, als
        # in Volume und Quelle Platz haben.
        vol_bytes = self.boot.total_sectors * self.boot.bytes_per_sector
        source_size = getattr(self.source, "size", None)
        if source_size is not None:
            vol_bytes = min(vol_bytes, max(0, source_size - self.base))
        if self._runs and self._mft_bytes:
            mapped = sum(count for _lcn, count in self._runs) * self.boot.cluster_size
            return min(self._mft_bytes, mapped, vol_bytes) // self.record_size
        # Rueckfall: bis zum Volumeende schaetzen.
        start_rel = self._linear_start - self.base
        return max(0, vol_bytes - start_rel) // self.record_size

    def _read_virtual(self, voff: int, length: int) -> bytes:
        if not self._runs:
            return self.source.read(self._linear_start + voff, length)
        return read_virtual(self.source, self._runs, self.boot.cluster_size,
                            self.base, voff, length)

    def read_record(self, n: int) -> Optional[bytearray]:
        if n < 0:
            return None
        block = n // self._BLOCK_RECORDS
        data = self._cache.get(block)
        if data is None:
            first = block * self._BLOCK_RECORDS
            data = self._read_virtual(first * self.record_size,
                                      self._BLOCK_RECORDS * self.record_size)
            self._cache[block] = data
            self._cache_order.append(block)
            if len(self._cache_order) > self._CACHE_BLOCKS:
                self._cache.pop(self._cache_order.pop(0), None)
        pos = (n % self._BLOCK_RECORDS) * self.record_size
        raw = bytearray(data[pos:pos + self.record_size])
        if len(raw) < self.record_size or raw[0:4] != b"FILE":
            return None
        _apply_fixup(raw)
        return raw

    def phys_of(self, voff: int) -> Optional[int]:
        """Physischer Quell-Offset einer virtuellen MFT-Position."""
        if not self._runs:
            return self._linear_start + voff
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


class NtfsBitmap:
    """Cluster-Belegung eines NTFS-Volumes aus ``$Bitmap`` (MFT-Eintrag 6).

    Wird bei Bedarf blockweise gelesen. Damit laesst sich pruefen, ob die
    Cluster einer geloeschten Datei inzwischen neu belegt sind (dann enthalten
    sie mit hoher Wahrscheinlichkeit fremde Daten).
    """

    _BLOCK = 64 * 1024

    def __init__(self, reader: MftReader):
        record = reader.read_record(BITMAP_RECORD)
        if record is None:
            raise NtfsError("$Bitmap nicht lesbar")
        data = assemble_data(gather(record, BITMAP_RECORD, reader).data)
        if data is None:
            raise NtfsError("$Bitmap ohne Daten")
        self.source = reader.source
        self.base = reader.base
        self.cluster_size = reader.boot.cluster_size
        self.total_clusters = reader.boot.total_clusters
        self._resident = data["resident_data"] if data["resident"] else None
        self._runs = None if data["resident"] else data["data_runs"]
        self._size = data["real_size"]
        self._cache: dict[int, bytes] = {}

    def _bytes(self, first: int, last: int) -> bytes:
        """Bitmap-Bytes ``first`` bis einschliesslich ``last``."""
        if self._resident is not None:
            return self._resident[first:last + 1]
        out = bytearray()
        block = first // self._BLOCK
        while block * self._BLOCK <= last:
            data = self._cache.get(block)
            if data is None:
                data = read_virtual(self.source, self._runs, self.cluster_size, self.base,
                                    block * self._BLOCK, self._BLOCK)
                if len(self._cache) > 64:
                    self._cache.clear()
                self._cache[block] = data
            lo = max(first, block * self._BLOCK) - block * self._BLOCK
            hi = min(last, block * self._BLOCK + self._BLOCK - 1) - block * self._BLOCK
            out += data[lo:hi + 1]
            block += 1
        return bytes(out)

    def allocated(self, lcn: int, count: int) -> int:
        """Anzahl belegter Cluster in ``[lcn, lcn + count)``."""
        if count <= 0 or lcn < 0:
            return 0
        last = lcn + count - 1
        raw = self._bytes(lcn // 8, last // 8)
        if not raw:
            return 0
        value = int.from_bytes(raw, "little")
        value >>= lcn % 8
        value &= (1 << count) - 1
        return bin(value).count("1")

    def is_allocated_offset(self, abs_offset: int) -> Optional[bool]:
        lcn = (abs_offset - self.base) // self.cluster_size
        if lcn < 0 or lcn >= self.total_clusters:
            return None
        return self.allocated(lcn, 1) > 0


def run_state(bitmap: Optional[NtfsBitmap], runs) -> str:
    """Zustand einer geloeschten Datei anhand der Belegung ihrer Cluster."""
    if bitmap is None:
        return "unbekannt"
    total = used = 0
    for lcn, count in runs:
        if lcn is None:
            continue
        total += count
        used += bitmap.allocated(lcn, count)
    if total == 0 or used == 0:
        return "gut"
    if used >= total:
        return "überschrieben"
    return "teilweise überschrieben"


# -- Durchlauf ueber die MFT ---------------------------------------------------

def scan_ntfs(source, base_offset: int,
              progress_cb: Optional[ProgressCb] = None,
              should_cancel: Optional[CancelCb] = None,
              deleted_only: bool = True,
              boot: Optional[BootSector] = None,
              warnings: Optional[list] = None,
              info: Optional[dict] = None) -> Iterator[Finding]:
    """Durchsucht ein NTFS-Volume ab ``base_offset`` nach Eintraegen.

    ``boot`` kann ein bereits (z.B. aus dem Backup-Boot-Sektor) rekonstruierter
    Boot-Sektor sein. Beschaedigte Eintraege werden einzeln uebersprungen und in
    ``warnings`` gezaehlt. In ``info`` landen Nebenergebnisse (Nummer des
    ``$UsnJrnl``-Eintrags, Belegungs-Bitmap).
    """
    if boot is None:
        boot = BootSector(source.read(base_offset, 512))
    reader = MftReader(source, boot, base_offset)
    count = reader.record_count()

    # Erst alle Eintraege durchgehen: Namensindex fuer die Pfad-Rekonstruktion
    # aufbauen (auch Ordner und noch vorhandene Eintraege) und Funde sammeln.
    name_map: dict[int, tuple[str, int]] = {}
    extensions: dict[int, list] = {}           # Basiseintrag -> [(Erweiterung, Sequenz)]
    findings: list[Finding] = []
    produced = 0
    damaged = 0
    invalid_streak = 0
    for n in range(count):
        if should_cancel and should_cancel():
            break
        if progress_cb and count and (n % 1024 == 0 or n == count - 1):
            progress_cb("MFT durchsuchen", (n + 1) / count, produced)
        try:
            record = reader.read_record(n)
        except OSError:
            damaged += 1
            continue
        if record is None:
            invalid_streak += 1
            # Ohne Run-Liste wird linear gelesen; hinter der MFT folgen Daten.
            if reader.linear and invalid_streak > 16384:
                break
            continue
        invalid_streak = 0
        try:
            rinfo = gather(record, n, reader)
            best = _best_name_entry(rinfo.names)
            if rinfo.base_ref and rinfo.base_ref != n:
                # Erweiterungseintrag: ein ausgelagerter Name gehoert dem Basiseintrag;
                # enthaltene $DATA-Teilstuecke werden spaeter ergaenzt.
                if best:
                    name_map.setdefault(rinfo.base_ref, (best["name"], best["parent"]))
                base_seq = struct.unpack_from("<Q", record, 0x20)[0] >> 48
                extensions.setdefault(rinfo.base_ref, []).append((n, base_seq))
                continue
            if best:
                name_map[n] = (best["name"], best["parent"])
                if (info is not None and best["name"] == "$UsnJrnl"
                        and best["parent"] == EXTEND_RECORD):
                    info["usn_record"] = n
            rec_off = reader.phys_of(n * reader.record_size)
            finding = _finding_from_info(rinfo, boot.cluster_size, base_offset,
                                         rec_off, deleted_only)
        except Exception:                     # ein kaputter Eintrag stoppt nicht alles
            damaged += 1
            continue
        if finding is not None:
            findings.append(finding)
            produced += 1

    if damaged and warnings is not None:
        warnings.append(f"NTFS-Volume bei Offset {base_offset:#x}: {damaged} beschädigte "
                        "MFT-Einträge übersprungen.")

    bitmap = None
    try:
        bitmap = NtfsBitmap(reader)
    except Exception:
        bitmap = None
    if info is not None:
        info["bitmap"] = bitmap

    # Pfade aufloesen, fehlende Teilstuecke ergaenzen, Zustand bewerten, ausgeben.
    for finding in findings:
        _apply_path(finding, name_map)
        if finding.extra.get("record") in extensions and "data_runs" in finding.extra:
            try:
                _complete_extents(finding, extensions[finding.extra["record"]], reader)
            except Exception:
                pass
        extra = finding.extra
        if extra.get("resident_data") is not None:
            extra["state"] = "gut" if extra.get("deleted") else "vorhanden"
        elif extra.get("deleted"):
            extra["state"] = run_state(bitmap, extra.get("data_runs", []))
        else:
            extra["state"] = "vorhanden"
        yield finding


def _complete_extents(finding: Finding, candidates: list, reader: MftReader) -> None:
    """Ergaenzt $DATA-Teilstuecke aus Erweiterungseintraegen, die auf den
    Basiseintrag zeigen, aber in dessen $ATTRIBUTE_LIST fehlen (unvollstaendige
    oder beschaedigte Liste)."""
    number = finding.extra["record"]
    base = reader.read_record(number)
    if base is None:
        return
    base_seq = struct.unpack_from("<H", base, 0x10)[0]
    extents = gather(base, number, reader).data
    known = {e.start_vcn for e in extents}
    added = False
    for ext_no, ext_base_seq in candidates:
        if not _sequence_matches(ext_base_seq, base_seq) and ext_base_seq != base_seq:
            continue
        ext = reader.read_record(ext_no)
        if ext is None:
            continue
        for extent in gather(ext, ext_no).data:
            if extent.resident is None and extent.start_vcn not in known:
                extents.append(extent)
                known.add(extent.start_vcn)
                added = True
    if added:
        data = assemble_data(extents)
        if data and not data["resident"]:
            finding.extra["data_runs"] = data["data_runs"]


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
    finding.name = f"{number}_{safe_name(full)}"


def _finding_from_info(rinfo: RecordInfo, cluster_size: int, base_offset: int,
                       record_offset: Optional[int], deleted_only: bool,
                       number: Optional[int] = None) -> Optional[Finding]:
    """Baut aus einem ausgewerteten MFT-Eintrag einen ``Finding``."""
    if rinfo.is_directory:
        return None
    in_use = rinfo.in_use
    if deleted_only and in_use:
        return None
    data = assemble_data(rinfo.data)
    if data is None:
        return None
    real_size = data.get("real_size") or 0
    if real_size <= 0:
        return None

    best = _best_name_entry(rinfo.names)
    number = rinfo.number if number is None else number
    name = best["name"] if best else f"ohne_Namen_{rinfo.number}.bin"
    ext = name.rsplit(".", 1)[-1].lower() if "." in name else "bin"
    flags = data.get("flags", 0)
    compressed = bool(flags & ATTR_FLAG_COMPRESSED) and not data["resident"]
    encrypted = bool(flags & ATTR_FLAG_ENCRYPTED)

    times = rinfo.times
    extra: dict = {
        "base_offset": base_offset,
        "cluster_size": cluster_size,
        "real_size": real_size,
        "record": rinfo.number,
        "record_offset": record_offset,
        "parent": best.get("parent") if best else None,
        "name_raw": name if best else None,
        "path": None if best else f"(ohne Namen)/{name}",
        "created": times.get("created"),
        "modified": times.get("modified"),
        "accessed": times.get("accessed"),
        "mtime_epoch": times.get("mtime_epoch"),
        "atime_epoch": times.get("atime_epoch"),
        "deleted": not in_use,
    }
    if data["resident"]:
        extra["resident_data"] = data["resident_data"]
    else:
        extra["data_runs"] = data["data_runs"]
        if compressed:
            extra["compressed"] = True
            extra["cu_clusters"] = 1 << (data.get("cu_shift") or 4)
    if encrypted:
        extra["encrypted"] = True

    type_name = "NTFS-Datei" + ("" if in_use else " (gelöscht)")
    if encrypted:
        type_name += ", EFS-verschlüsselt"
    return Finding(
        kind="ntfs",
        type_name=type_name,
        ext=ext,
        name=f"{number:06d}_{safe_name(name)}",
        offset=record_offset if record_offset is not None else base_offset,
        size=real_size,
        extra=extra,
    )


def _finding_from_record(record: bytes, cluster_size: int, base_offset: int,
                         record_offset: Optional[int], number: int,
                         deleted_only: bool) -> Optional[Finding]:
    """Wertet einen einzelnen MFT-Eintrag ohne Zugriff auf die MFT aus."""
    rinfo = gather(record, number)
    if rinfo.base_ref and rinfo.base_ref != number:
        return None                              # Erweiterungseintrag
    return _finding_from_info(rinfo, cluster_size, base_offset, record_offset,
                              deleted_only, number=number)


# -- Suche ueber den ganzen Datentraeger -------------------------------------

@dataclass
class VolumeGeometry:
    """Lage und Kennzahlen eines bekannten NTFS-Volumes fuer den Orphan-Scan."""
    offset: int
    size: int
    cluster_size: int
    record_size: int


def scan_orphan_mft(source, cluster_size: int = 4096, base_offset: int = 0,
                    progress_cb: Optional[ProgressCb] = None,
                    should_cancel: Optional[CancelCb] = None,
                    deleted_only: bool = True,
                    record_size: int = 1024,
                    volumes: Optional[list] = None) -> Iterator[Finding]:
    """Sucht MFT-Eintraege ueber den gesamten Datentraeger.

    Anders als ``scan_ntfs`` verlaesst sich dieser Durchlauf nicht auf einen
    intakten Boot-Sektor oder eine intakte ``$MFT``. Er durchsucht die Rohdaten
    an Sektorgrenzen nach ``FILE``-Eintraegen und wertet jeden einzeln aus. Das
    findet geloeschte Dateien auch nach einer Formatierung, solange ihre
    MFT-Eintraege noch vorhanden sind.

    Fuer nicht-residente Inhalte zaehlt die Geometrie des Volumes, in dem der
    Eintrag liegt (``volumes``: Liste von ``VolumeGeometry``). Liegt er in
    keinem bekannten Volume, gelten ``cluster_size``/``base_offset``/
    ``record_size`` als Vorgabe; residente (kleine) Dateien sind davon
    unabhaengig immer korrekt.
    """
    known = sorted(volumes or [], key=lambda v: v.offset)

    def geometry(abs_off: int) -> tuple[int, int, int]:
        for vol in known:
            if vol.offset <= abs_off < vol.offset + vol.size:
                return vol.cluster_size, vol.offset, vol.record_size
        return cluster_size, base_offset, record_size

    total = source.size or 0
    number = 0
    for chunk_off, data in source.stream(chunk_size=8 * 1024 * 1024):
        if should_cancel and should_cancel():
            break
        if progress_cb and total:
            progress_cb("Datentraeger nach MFT-Eintraegen durchsuchen",
                        min(1.0, (chunk_off + len(data)) / total), number)
        # ``FILE`` nur an Sektorgrenzen pruefen – dort liegen MFT-Eintraege.
        i = data.find(b"FILE")
        while i >= 0:
            abs_off = chunk_off + i
            if abs_off % 512 == 0:
                cs, base, rs = geometry(abs_off)
                finding = _try_orphan_record(source, abs_off, rs, cs, base, number,
                                             deleted_only)
                if finding is not None:
                    number += 1
                    yield finding
            i = data.find(b"FILE", i + 1)


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
    _apply_fixup(raw)
    try:
        finding = _finding_from_record(raw, cluster_size, base_offset, abs_off,
                                       number, deleted_only)
    except Exception:
        return None
    if finding is not None:
        finding.extra["state"] = "unbekannt"
    return finding


# -- Partitionen (MBR mit EBR-Kette, GPT) ----------------------------------------

@dataclass
class PartitionEntry:
    offset: int              # Byte-Offset des Partitionsanfangs
    size: Optional[int]      # Groesse in Bytes, falls bekannt
    ptype: str               # MBR-Typ ("0x07") oder GPT-Typ-GUID
    scheme: str              # "mbr", "ebr" oder "gpt"


EXTENDED_TYPES = (0x05, 0x0F, 0x85)


def _sector_size(source) -> int:
    """Logische Sektorgroesse der Quelle (LBA-Einheit fuer MBR/GPT)."""
    return getattr(source, "sector_size", 512) or 512


def partition_entries(source) -> list[PartitionEntry]:
    """Alle Partitionen aus MBR (inklusive logischer Laufwerke) und GPT."""
    ss = _sector_size(source)
    entries: list[PartitionEntry] = []
    sector0 = source.read(0, 512)
    if len(sector0) < 512 or sector0[510:512] != b"\x55\xAA":
        return _parse_gpt_entries(source)
    gpt = False
    for start_lba, ptype, count in _parse_mbr_entries(sector0):
        if ptype == 0xEE:
            gpt = True
            continue
        if ptype in EXTENDED_TYPES:
            entries.extend(_walk_ebr(source, start_lba, ss))
            continue
        entries.append(PartitionEntry(start_lba * ss, count * ss if count else None,
                                      f"0x{ptype:02X}", "mbr"))
    if gpt:
        entries.extend(_parse_gpt_entries(source))
    return entries


def partition_offsets(source) -> list[int]:
    """Byte-Offsets aller Partitionsanfaenge inklusive Offset 0.

    Typunabhaengig – dient der Erkennung von NTFS, FAT und exFAT. Erweiterte
    Partitionen werden aufgeloest (die logischen Laufwerke zaehlen, nicht der
    Container). LBA-Angaben werden mit der Sektorgroesse der Quelle umgerechnet.
    """
    offsets = [0]
    for entry in partition_entries(source):
        if entry.offset > 0 and entry.offset not in offsets:
            offsets.append(entry.offset)
    return offsets


def find_ntfs_volumes(source) -> list[int]:
    """Findet Byte-Offsets aller NTFS-Volumes auf der Quelle.

    Geprueft werden Offset 0 und alle Partitionen aus MBR/EBR/GPT; jeder
    Kandidat wird durch seinen Boot-Sektor bestaetigt.
    """
    offsets: list[int] = []
    try:
        candidates = partition_offsets(source)
    except Exception:
        candidates = [0]
    for offset in candidates:
        try:
            if source.read(offset, 512)[3:11] == b"NTFS    ":
                offsets.append(offset)
        except Exception:
            pass
    return offsets


def bitlocker_volumes(source) -> list[PartitionEntry]:
    """Partitionen mit BitLocker-Kennung (``-FVE-FS-``) im Boot-Sektor.

    Ueber das physische Laufwerk sind solche Partitionen nur verschluesselt
    lesbar. Entsperrt liefert Windows ueber den Laufwerksbuchstaben (``\\\\.\\C:``)
    die entschluesselten Daten.
    """
    result: list[PartitionEntry] = []
    try:
        entries = partition_entries(source)
    except Exception:
        entries = []
    candidates = [PartitionEntry(0, source.size, "", "raw")] + entries
    seen: set[int] = set()
    for entry in candidates:
        if entry.offset in seen:
            continue
        seen.add(entry.offset)
        try:
            if source.read(entry.offset, 512)[3:11] == b"-FVE-FS-":
                result.append(entry)
        except Exception:
            continue
    return result


def _parse_mbr_entries(sector0: bytes) -> list[tuple[int, int, int]]:
    """``(start_lba, typ, sektoranzahl)`` der vier MBR-Eintraege."""
    result = []
    for i in range(4):
        base = 0x1BE + i * 16
        ptype = sector0[base + 4]
        start_lba, count = struct.unpack_from("<II", sector0, base + 8)
        if ptype != 0 and start_lba != 0:
            result.append((start_lba, ptype, count))
    return result


def _parse_mbr(sector0: bytes) -> list[tuple[int, int]]:
    """Liefert ``(start_lba, partitionstyp)`` der vier MBR-Eintraege."""
    return [(lba, ptype) for lba, ptype, _count in _parse_mbr_entries(sector0)]


def _walk_ebr(source, ext_start_lba: int, ss: int) -> list[PartitionEntry]:
    """Folgt der Kette der Extended Boot Records einer erweiterten Partition.

    Jeder EBR beschreibt ein logisches Laufwerk (relativ zu sich selbst) und
    verweist auf den naechsten EBR (relativ zum Anfang der erweiterten
    Partition).
    """
    result: list[PartitionEntry] = []
    seen: set[int] = set()
    ebr_lba = ext_start_lba
    for _ in range(128):
        if ebr_lba in seen:
            break
        seen.add(ebr_lba)
        sector = source.read(ebr_lba * ss, 512)
        if len(sector) < 512 or sector[510:512] != b"\x55\xAA":
            break
        ptype = sector[0x1BE + 4]
        rel, count = struct.unpack_from("<II", sector, 0x1BE + 8)
        if ptype and rel and ptype not in EXTENDED_TYPES:
            result.append(PartitionEntry((ebr_lba + rel) * ss, count * ss if count else None,
                                         f"0x{ptype:02X}", "ebr"))
        next_type = sector[0x1CE + 4]
        next_rel = struct.unpack_from("<I", sector, 0x1CE + 8)[0]
        if next_type not in EXTENDED_TYPES or not next_rel:
            break
        ebr_lba = ext_start_lba + next_rel
    return result


def _parse_gpt_entries(source) -> list[PartitionEntry]:
    """Partitionen aus der GPT, mit Plausibilitaetspruefung des Kopfes.

    Der GPT-Kopf liegt in LBA 1. Passt die eingestellte Sektorgroesse nicht
    (4Kn-Platte mit 512er-Einstellung oder umgekehrt), wird die andere
    ausprobiert.
    """
    size = source.size
    first_ss = _sector_size(source)
    for ss in dict.fromkeys((first_ss, 512, 4096)):
        header = source.read(ss, 512)
        if len(header) < 92 or header[0:8] != b"EFI PART":
            continue
        part_lba = struct.unpack_from("<Q", header, 72)[0]
        num_parts = struct.unpack_from("<I", header, 80)[0]
        entry_size = struct.unpack_from("<I", header, 84)[0]
        if not (128 <= entry_size <= 4096) or entry_size % 8:
            continue
        if not (0 < num_parts <= 4096) or num_parts * entry_size > 4 * 1024 * 1024:
            continue
        if part_lba < 2 or (size is not None and part_lba * ss >= size):
            continue
        table = source.read(part_lba * ss, num_parts * entry_size)
        entries: list[PartitionEntry] = []
        for i in range(num_parts):
            base = i * entry_size
            if base + 56 > len(table):
                break
            type_guid = table[base:base + 16]
            if type_guid == bytes(16):
                continue
            first_lba, last_lba = struct.unpack_from("<QQ", table, base + 32)
            if first_lba == 0 or (last_lba and last_lba < first_lba):
                continue
            if size is not None and first_lba * ss >= size:
                continue
            length = (last_lba - first_lba + 1) * ss if last_lba else None
            entries.append(PartitionEntry(first_lba * ss, length, type_guid.hex(), "gpt"))
        return entries
    return []


def _parse_gpt(source) -> list[int]:
    """Byte-Offsets der GPT-Partitionsanfaenge."""
    return [entry.offset for entry in _parse_gpt_entries(source)]


# -- Partitionsrekonstruktion (TestDisk-Ansatz) -------------------------

@dataclass
class VolumeInfo:
    """Ein erkanntes Volume, egal ob aus der Tabelle oder rekonstruiert."""
    offset: int              # Byte-Offset des Volume-Anfangs auf der Quelle
    size: Optional[int]      # Groesse in Bytes, falls bekannt
    cluster_size: Optional[int]
    fs_type: str             # "ntfs", "fat" oder "exfat"
    origin: str              # "boot", "backup", "fat-boot", "exfat-boot"
    # Rekonstruierter Boot-Sektor. Wichtig, wenn der originale am Volume-Anfang
    # zerstoert ist und die Kennzahlen aus der Kopie stammen.
    boot: Optional[BootSector] = None


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


def _fat_volume(source, abs_off: int, sector: bytes) -> Optional[VolumeInfo]:
    """FAT-Volume aus einem Boot-Sektor, oder None wenn kein (echtes) FAT.

    FAT32 haelt in Sektor 6 eine Kopie des Boot-Sektors. Damit die Kopie nicht
    als eigenes Volume gemeldet wird, muss an der im BPB genannten Stelle die
    FAT beginnen: ihr erster Eintrag traegt den Medien-Deskriptor (``F8 FF``).
    """
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
    if not total:
        return None
    reserved = struct.unpack_from("<H", sector, 0x0E)[0]
    media = sector[0x15]
    try:
        fat0 = source.read(abs_off + reserved * bps, 2)
    except Exception:
        return None
    if len(fat0) < 2 or fat0[0] != media or fat0[1] != 0xFF:
        return None
    return VolumeInfo(abs_off, total * bps, None, "fat", "fat-boot")


def _exfat_volume(source, abs_off: int, sector: bytes) -> Optional[VolumeInfo]:
    """exFAT-Volume aus einem Boot-Sektor; die Backup-Region (Sektor 12) wird
    ueber den Anfang der FAT (``F8 FF FF FF``) ausgeschlossen."""
    bps_shift = sector[0x6C]
    if not (9 <= bps_shift <= 12):
        return None
    bps = 1 << bps_shift
    vol_len = struct.unpack_from("<Q", sector, 0x48)[0]
    fat_sector = struct.unpack_from("<I", sector, 0x50)[0]
    try:
        fat0 = source.read(abs_off + fat_sector * bps, 4)
    except Exception:
        return None
    if fat0 != b"\xf8\xff\xff\xff":
        return None
    return VolumeInfo(abs_off, vol_len * bps if vol_len else None, None,
                      "exfat", "exfat-boot")


def _ntfs_boot(sector: bytes) -> Optional[BootSector]:
    try:
        return BootSector(sector)
    except NtfsError:
        return None


def boot_with_backup(source, offset: int,
                     partition_size: Optional[int] = None) -> tuple[BootSector, bool]:
    """Boot-Sektor eines Volumes; ist er beschaedigt, die Kopie am Volume-Ende.

    NTFS legt im letzten Sektor der Partition eine Kopie des Boot-Sektors ab.
    Gesucht wird sie ueber die Partitionsgroesse (falls bekannt) und ueber die
    Sektorzahl aus dem beschaedigten Original. Rueckgabe ``(boot, aus_kopie)``;
    ``NtfsError``, wenn keine brauchbare Fassung existiert.
    """
    primary = source.read(offset, 512)
    try:
        boot = BootSector(primary)
        if _mft_present(source, offset, boot):
            return boot, False
        error: Exception = NtfsError("MFT nicht an der angegebenen Stelle")
    except NtfsError as exc:
        boot = None
        error = exc
    candidates = []
    if partition_size:
        candidates += [offset + partition_size - bps for bps in (512, 4096)]
    if len(primary) >= 0x30:
        total = struct.unpack_from("<Q", primary, 0x28)[0]
        for bps in (512, 1024, 2048, 4096):
            candidates.append(offset + total * bps)
    size = getattr(source, "size", None)
    for pos in dict.fromkeys(candidates):
        if pos <= offset or (size is not None and pos + 512 > size):
            continue
        backup = _ntfs_boot(source.read(pos, 512))
        if backup is not None and _mft_present(source, offset, backup):
            return backup, True
    if boot is not None:
        return boot, False                # Original ohne bestaetigte MFT: trotzdem versuchen
    raise error


def reconstruct_volumes(source, thorough: bool = True,
                        progress_cb: Optional[ProgressCb] = None,
                        should_cancel: Optional[CancelCb] = None) -> list[VolumeInfo]:
    """Rekonstruiert Volumes ueber eine Boot-Sektor-Suche (TestDisk-Ansatz).

    Auch ohne intakte Partitionstabelle findet dieser Durchlauf NTFS-Volumes,
    indem er den Datentraeger nach Boot-Sektoren (Original und Kopie) absucht und
    aus deren BPB den Volume-Anfang und die Groesse errechnet. FAT-/exFAT-Volumes
    werden ebenfalls erkannt und an den FAT-Parser weitergereicht.

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
            add(_exfat_volume(source, abs_off, sector))
        else:
            add(_fat_volume(source, abs_off, sector))

    if not thorough:
        ss = _sector_size(source)
        candidates = {0, 63 * ss, 2048 * ss, 34 * ss}
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
        for needle, delta in ((b"NTFS    ", 3), (b"EXFAT   ", 3), (b"FAT32   ", 0x52),
                              (b"FAT16   ", 0x36), (b"FAT12   ", 0x36), (b"FAT     ", 0x36)):
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
