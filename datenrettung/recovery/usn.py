"""$UsnJrnl-Change-Journal auswerten (Kategorie 1, forensische Ergaenzung).

NTFS fuehrt in ``\\$Extend\\$UsnJrnl`` ein Aenderungsjournal. Der Datenstrom
``$J`` enthaelt fortlaufende Datensaetze (USN_RECORD_V2) mit Dateiname,
Zeitpunkt und Grund einer Aenderung – auch Loeschungen. Damit lassen sich die
Namen kuerzlich geloeschter Dateien wiederfinden, selbst wenn der MFT-Eintrag
schon wiederverwendet wurde.

Wichtig: Das Journal liefert Metadaten (Name, Zeit, Grund, MFT-Referenz), nicht
den Dateiinhalt. Die Funde sind daher informativ – sie zeigen, was geloescht
wurde, und ergaenzen die inhaltlichen Funde der anderen Verfahren.

Zwei Wege: bevorzugt der ``$J``-Stream ueber die MFT (guenstig, nur das Journal
wird gelesen, auch wenn seine Data-Runs ueber ``$ATTRIBUTE_LIST`` auf mehrere
MFT-Eintraege verteilt sind); als Rueckfall das Herausschneiden einzelner
Datensaetze aus dem Rohdatenstrom (findet auch Reste in unallokiertem Raum).
"""

from __future__ import annotations

import struct
from typing import Iterable, Iterator, Optional

from .models import CancelCb, Finding, ProgressCb, safe_name
from . import ntfs

REASON_FILE_DELETE = 0x00000200

# USN_REASON_* laut Microsoft-Dokumentation (winioctl.h).
_REASON_FLAGS = {
    0x00000001: "DATA_OVERWRITE",
    0x00000002: "DATA_EXTEND",
    0x00000004: "DATA_TRUNCATION",
    0x00000010: "NAMED_DATA_OVERWRITE",
    0x00000020: "NAMED_DATA_EXTEND",
    0x00000040: "NAMED_DATA_TRUNCATION",
    0x00000100: "FILE_CREATE",
    0x00000200: "FILE_DELETE",
    0x00000400: "EA_CHANGE",
    0x00000800: "SECURITY_CHANGE",
    0x00001000: "RENAME_OLD_NAME",
    0x00002000: "RENAME_NEW_NAME",
    0x00004000: "INDEXABLE_CHANGE",
    0x00008000: "BASIC_INFO_CHANGE",
    0x00010000: "HARD_LINK_CHANGE",
    0x00020000: "COMPRESSION_CHANGE",
    0x00040000: "ENCRYPTION_CHANGE",
    0x00080000: "OBJECT_ID_CHANGE",
    0x00100000: "REPARSE_POINT_CHANGE",
    0x00200000: "STREAM_CHANGE",
    0x00400000: "TRANSACTED_CHANGE",
    0x00800000: "INTEGRITY_CHANGE",
    0x80000000: "CLOSE",
}

# Obergrenze fuer das Lesen des Journals (belegte Runs); schuetzt vor
# beschaedigten Run-Listen, die auf den ganzen Datentraeger zeigen.
MAX_JOURNAL_BYTES = 4 * 1024 * 1024 * 1024
_ZERO_BLOCK = bytes(512)


def reason_text(reason: int) -> str:
    """Lesbare Liste der Gruende; unbekannte Bits bleiben als Hexwert sichtbar."""
    parts = [name for bit, name in _REASON_FLAGS.items() if reason & bit]
    rest = reason & ~sum(_REASON_FLAGS)
    if rest:
        parts.append(f"0x{rest:X}")
    return "|".join(parts) or "0x0"


def _parse_one(buf, off: int) -> Optional[dict]:
    """Prueft und liest einen einzelnen USN_RECORD_V2 an ``off``."""
    if off + 0x3C > len(buf):
        return None
    rec_len = struct.unpack_from("<I", buf, off)[0]
    if rec_len < 0x3C or rec_len > 0x1000 or off + rec_len > len(buf):
        return None
    major = struct.unpack_from("<H", buf, off + 4)[0]
    if major != 2:
        return None
    ref = struct.unpack_from("<Q", buf, off + 0x08)[0]
    parent = struct.unpack_from("<Q", buf, off + 0x10)[0]
    timestamp = struct.unpack_from("<Q", buf, off + 0x20)[0]
    reason = struct.unpack_from("<I", buf, off + 0x28)[0]
    name_len = struct.unpack_from("<H", buf, off + 0x38)[0]
    name_off = struct.unpack_from("<H", buf, off + 0x3A)[0]
    # Der Name ist UTF-16, seine Laenge also immer gerade.
    if name_len == 0 or name_len & 1 or name_off < 0x3C or name_off + name_len > rec_len:
        return None
    name = bytes(buf[off + name_off:off + name_off + name_len]).decode("utf-16-le", "replace")
    if "\x00" in name or not name.strip():
        return None
    return {"name": name, "reason": reason, "timestamp": timestamp,
            "ref": ref, "parent": parent, "length": rec_len}


def iter_usn_stream(chunks: Iterable[bytes], only_delete: bool = True) -> Iterator[dict]:
    """Iteriert die Datensaetze eines blockweise gelieferten ``$J``-Stroms.

    Ein Datensatz, der eine Blockgrenze kreuzt, wird mit dem naechsten Block
    vervollstaendigt. So braucht das Journal nie komplett im Speicher zu liegen.
    """
    buf = bytearray()
    for data in chunks:
        buf += data
        i = 0
        n = len(buf)
        while i + 0x3C <= n:
            rec_len = struct.unpack_from("<I", buf, i)[0]
            if rec_len == 0:                 # spaerlicher/ungenutzter Bereich
                i += 512 if buf[i:i + 512] == _ZERO_BLOCK else 8
                continue
            if rec_len < 0x3C or rec_len > 0x1000:
                i += 8
                continue
            if i + rec_len > n:              # unvollstaendig -> naechster Block
                break
            rec = _parse_one(buf, i)
            if rec is None:
                i += 8
                continue
            if (not only_delete) or (rec["reason"] & REASON_FILE_DELETE):
                yield rec
            i += (rec_len + 7) & ~7
        del buf[:i]


def parse_usn_records(buf: bytes, only_delete: bool = True) -> Iterator[dict]:
    """Iteriert die Datensaetze eines zusammenhaengenden ``$J``-Puffers."""
    return iter_usn_stream([buf], only_delete)


def _finding(rec: dict, index: int) -> Finding:
    deleted = bool(rec["reason"] & REASON_FILE_DELETE)
    return Finding(
        kind="usn",
        type_name="USN-Journal (geloescht)" if deleted else "USN-Journal (Aenderung)",
        ext="txt",
        name=f"{index:06d}_{safe_name(rec['name'])}.usn.txt",
        offset=rec.get("offset", 0),
        size=0,
        extra={
            "modified": ntfs.filetime_to_iso(rec["timestamp"]),
            "reason": reason_text(rec["reason"]),
            "usn_name": rec["name"],
            "usn_ref": rec["ref"] & 0xFFFFFFFFFFFF,
            "path": rec["name"],
        },
    )


def scan_usn(source, base_offset: int = 0, only_delete: bool = True,
             progress_cb: Optional[ProgressCb] = None,
             should_cancel: Optional[CancelCb] = None,
             allow_carve: bool = True,
             boot: Optional[ntfs.BootSector] = None) -> Iterator[Finding]:
    """Liefert Dateien aus dem USN-Journal als informative Funde.

    Zuerst wird der ``$J``-Stream ueber die MFT gesucht; gelingt das nicht und
    ist ``allow_carve`` gesetzt, werden USN-Datensaetze aus dem Rohdatenstrom
    herausgeschnitten (ein zusaetzlicher Durchlauf). ``boot`` kann ein bereits
    rekonstruierter Boot-Sektor sein (Kopie am Volume-Ende).
    """
    records = _read_from_mft(source, base_offset, only_delete, progress_cb,
                             should_cancel, boot)
    if records is None:
        if not allow_carve:
            return
        records = _carve(source, only_delete, progress_cb, should_cancel)

    seen: set = set()
    index = 0
    for rec in records:
        if should_cancel and should_cancel():
            break
        # Je Datei ein Fund – und ein weiterer, falls sie geloescht wurde.
        key = (rec["ref"] & 0xFFFFFFFFFFFF, rec["name"],
               bool(rec["reason"] & REASON_FILE_DELETE))
        if key in seen:
            continue
        seen.add(key)
        index += 1
        yield _finding(rec, index)


def _read_from_mft(source, base_offset: int, only_delete: bool,
                   progress_cb, should_cancel, boot):
    """Liest den ``$J``-Stream ueber die MFT. Gibt Datensaetze oder None zurueck."""
    try:
        if boot is None:
            boot = ntfs.BootSector(source.read(base_offset, 512))
        reader = ntfs.MftReader(source, boot, base_offset)
        count = reader.record_count()
    except Exception:
        return None

    limit = min(count, 200000)
    for n in range(limit):
        if should_cancel and should_cancel():
            return None
        if progress_cb and limit and (n % 1024 == 0 or n == limit - 1):
            progress_cb("USN-Journal in der MFT suchen", (n + 1) / limit, 0)
        record = reader.read_record(n)
        if record is None:
            continue
        entry = ntfs._record_name_entry(record)
        if not entry or entry[0] != "$UsnJrnl":
            continue
        runs = _journal_runs(reader, record, boot, base_offset)
        if not runs:
            return None
        chunks = _iter_allocated(source, runs, boot.cluster_size, base_offset,
                                 progress_cb, should_cancel)
        return iter_usn_stream(chunks, only_delete)
    return None


def _journal_runs(reader: ntfs.MftReader, record: bytes, boot: ntfs.BootSector,
                  base_offset: int):
    """Alle Data-Runs von ``$J`` in VCN-Reihenfolge.

    Ein grosses Journal passt nicht in einen MFT-Eintrag: dann verweist eine
    ``$ATTRIBUTE_LIST`` im Basiseintrag auf Erweiterungseintraege, die je ein
    Teilstueck (ab einer Start-VCN) der Run-Liste tragen.
    """
    alist = _attribute_list(reader, record, boot, base_offset)
    if alist is None:
        return _named_data_runs(record, "$J")

    fragments: list[tuple[int, int]] = []       # (start_vcn, mft_eintrag)
    off = 0
    while off + 0x1A <= len(alist):
        atype = struct.unpack_from("<I", alist, off)[0]
        entry_len = struct.unpack_from("<H", alist, off + 4)[0]
        if entry_len < 0x1A:
            break
        name_len = alist[off + 6]
        name_off = alist[off + 7]
        start_vcn = struct.unpack_from("<Q", alist, off + 8)[0]
        ref = struct.unpack_from("<Q", alist, off + 0x10)[0] & 0xFFFFFFFFFFFF
        name = alist[off + name_off: off + name_off + name_len * 2].decode(
            "utf-16-le", "replace")
        if atype == ntfs.ATTR_DATA and name == "$J":
            fragments.append((start_vcn, ref))
        off += entry_len

    runs = []
    cache: dict[int, Optional[bytearray]] = {}
    for start_vcn, ref in sorted(fragments):
        if ref not in cache:
            cache[ref] = reader.read_record(ref)
        rec = cache[ref]
        if rec is None:
            continue
        part = _named_data_runs(rec, "$J", start_vcn)
        if part:
            runs.extend(part)
    return runs or None


def _attribute_list(reader: ntfs.MftReader, record: bytes, boot: ntfs.BootSector,
                    base_offset: int) -> Optional[bytes]:
    """Inhalt von ``$ATTRIBUTE_LIST`` (resident oder ueber Data-Runs), sonst None."""
    for off, atype, length in ntfs._iter_attributes(record):
        if atype != ntfs.ATTR_ATTRIBUTE_LIST:
            continue
        if not record[off + 0x08]:                     # resident
            content_len = struct.unpack_from("<I", record, off + 0x10)[0]
            content_off = struct.unpack_from("<H", record, off + 0x14)[0]
            return bytes(record[off + content_off: off + content_off + content_len])
        real_size = struct.unpack_from("<Q", record, off + 0x30)[0]
        runs_off = struct.unpack_from("<H", record, off + 0x20)[0]
        runs = ntfs.parse_data_runs(bytes(record[off + runs_off: off + length]))
        return ntfs.read_runs(reader.source, runs, boot.cluster_size, base_offset,
                              min(real_size, 1024 * 1024))
    return None


def _named_data_runs(record: bytes, wanted: str, start_vcn: Optional[int] = None):
    """Data-Runs des benannten ``$DATA``-Stroms ``wanted`` (nur nicht-resident).

    Mit ``start_vcn`` wird gezielt das Teilstueck mit dieser Start-VCN gewaehlt
    (Erweiterungseintraege koennen mehrere Teilstuecke tragen).
    """
    for off, atype, length in ntfs._iter_attributes(record):
        if atype != ntfs.ATTR_DATA:
            continue
        name_len = record[off + 0x09]
        if name_len == 0:
            continue
        name_off = struct.unpack_from("<H", record, off + 0x0A)[0]
        aname = record[off + name_off: off + name_off + name_len * 2].decode(
            "utf-16-le", "replace")
        if aname != wanted:
            continue
        if not record[off + 0x08]:            # resident -> hier nicht relevant
            return None
        if start_vcn is not None:
            if struct.unpack_from("<Q", record, off + 0x10)[0] != start_vcn:
                continue
        runs_off = struct.unpack_from("<H", record, off + 0x20)[0]
        return ntfs.parse_data_runs(bytes(record[off + runs_off: off + length]))
    return None


def _iter_allocated(source, runs, cluster_size: int, base_offset: int,
                    progress_cb, should_cancel) -> Iterator[bytes]:
    """Liefert die belegten Runs des (grossteils spaerlichen) ``$J`` blockweise.

    Blockweise statt am Stueck, damit auch ein grosses Journal wenig Speicher
    braucht – und damit die juengsten Eintraege (am Ende) nicht einer
    Obergrenze zum Opfer fallen.
    """
    step = 8 * 1024 * 1024
    total = sum(count * cluster_size for lcn, count in runs if lcn is not None)
    done = 0
    for lcn, count in runs:
        if lcn is None:                       # spaerlich -> keine Daten
            continue
        pos = base_offset + lcn * cluster_size
        remaining = count * cluster_size
        while remaining > 0:
            if should_cancel and should_cancel():
                return
            if done >= MAX_JOURNAL_BYTES:
                return
            want = min(step, remaining)
            data = source.read(pos, want)
            if not data:
                return
            yield data
            pos += len(data)
            remaining -= len(data)
            done += len(data)
            if progress_cb and total:
                progress_cb("USN-Journal lesen", min(1.0, done / total), 0)


def _carve(source, only_delete: bool, progress_cb, should_cancel) -> Iterator[dict]:
    """Schneidet einzelne USN-Datensaetze aus dem Rohdatenstrom heraus."""
    total = source.size or 0
    keep = 4096                               # Ueberlappung fuer Blockgrenzen
    carry = b""
    for offset, data in source.stream(chunk_size=8 * 1024 * 1024):
        if should_cancel and should_cancel():
            break
        if progress_cb and total:
            progress_cb("USN-Journal suchen", min(1.0, (offset + len(data)) / total), 0)
        buf = carry + data
        buf_base = offset - len(carry)
        # Kandidaten: MajorVersion 2, MinorVersion 0 an Record-Offset+4.
        start = 0
        while True:
            idx = buf.find(b"\x02\x00\x00\x00", start)
            if idx < 0:
                break
            start = idx + 1
            rec_off = idx - 4
            if rec_off < 0:
                continue
            rec = _parse_one(buf, rec_off)
            if rec is None:
                continue
            # Datensaetze, die komplett im Ueberlappungsbereich liegen, wurden
            # schon im vorigen Block geliefert.
            if rec_off + rec["length"] <= len(carry):
                continue
            if (not only_delete) or (rec["reason"] & REASON_FILE_DELETE):
                rec["offset"] = buf_base + rec_off
                yield rec
        carry = buf[-keep:]
