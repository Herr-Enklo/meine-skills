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
wird gelesen); als Rueckfall das Herausschneiden einzelner Datensaetze aus dem
Rohdatenstrom (findet auch Reste in unallokiertem Raum).
"""

from __future__ import annotations

import struct
from typing import Callable, Iterator, Optional

from .models import Finding
from . import ntfs

ProgressCb = Callable[[str, float, int], None]
CancelCb = Callable[[], bool]

REASON_FILE_DELETE = 0x00000200

_REASON_FLAGS = {
    0x00000001: "DATA_OVERWRITE",
    0x00000002: "DATA_EXTEND",
    0x00000100: "FILE_CREATE",
    0x00000200: "FILE_DELETE",
    0x00000800: "RENAME_OLD_NAME",
    0x00001000: "RENAME_NEW_NAME",
    0x80000000: "CLOSE",
}


def reason_text(reason: int) -> str:
    parts = [name for bit, name in _REASON_FLAGS.items() if reason & bit]
    return "|".join(parts) or f"0x{reason:X}"


def _parse_one(buf: bytes, off: int) -> Optional[dict]:
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
    if name_len == 0 or name_off < 0x3C or name_off + name_len > rec_len:
        return None
    name = buf[off + name_off:off + name_off + name_len].decode("utf-16-le", "replace")
    if "\x00" in name or not name.strip():
        return None
    return {"name": name, "reason": reason, "timestamp": timestamp,
            "ref": ref, "parent": parent, "length": rec_len}


def parse_usn_records(buf: bytes, only_delete: bool = True) -> Iterator[dict]:
    """Iteriert die Datensaetze eines zusammenhaengenden ``$J``-Puffers."""
    i = 0
    n = len(buf)
    while i + 0x3C <= n:
        rec_len = struct.unpack_from("<I", buf, i)[0]
        if rec_len == 0:                     # spaerlicher Bereich am Anfang
            i += 8
            continue
        rec = _parse_one(buf, i)
        if rec is None:
            i += 8
            continue
        if (not only_delete) or (rec["reason"] & REASON_FILE_DELETE):
            yield rec
        i += (rec["length"] + 7) & ~7


def _safe(name: str) -> str:
    keep = ["_" if (ch in '<>:"\\|?*/' or ord(ch) < 32) else ch for ch in name]
    return "".join(keep).strip(" .") or "unbenannt"


def _finding(rec: dict, index: int) -> Finding:
    return Finding(
        kind="usn",
        type_name="USN-Journal (geloescht)",
        ext="txt",
        name=f"{index:06d}_{_safe(rec['name'])}.usn.txt",
        offset=0,
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
             allow_carve: bool = True) -> Iterator[Finding]:
    """Liefert geloeschte Dateien aus dem USN-Journal als informative Funde.

    Zuerst wird der ``$J``-Stream ueber die MFT gesucht; gelingt das nicht und
    ist ``allow_carve`` gesetzt, werden USN-Datensaetze aus dem Rohdatenstrom
    herausgeschnitten (ein zusaetzlicher Durchlauf).
    """
    records = _read_from_mft(source, base_offset, only_delete)
    if records is None:
        if not allow_carve:
            return
        records = _carve(source, only_delete, progress_cb, should_cancel)

    seen: set = set()
    index = 0
    for rec in records:
        if should_cancel and should_cancel():
            break
        key = (rec["ref"] & 0xFFFFFFFFFFFF, rec["name"])
        if key in seen:
            continue
        seen.add(key)
        index += 1
        yield _finding(rec, index)


def _read_from_mft(source, base_offset: int, only_delete: bool):
    """Liest den ``$J``-Stream ueber die MFT. Gibt Datensaetze oder None zurueck."""
    try:
        boot = ntfs.BootSector(source.read(base_offset, 512))
        reader = ntfs.MftReader(source, boot, base_offset)
    except Exception:
        return None
    try:
        count = reader.record_count()
    except Exception:
        return None

    for n in range(min(count, 200000)):
        record = reader.read_record(n)
        if record is None:
            continue
        entry = ntfs._record_name_entry(record)
        if not entry or entry[0] != "$UsnJrnl":
            continue
        runs = _named_data_runs(record, "$J")
        if runs is None:
            return None
        data = _read_allocated(source, runs, boot.cluster_size, base_offset)
        return parse_usn_records(data, only_delete)
    return None


def _named_data_runs(record: bytes, wanted: str):
    """Data-Runs des benannten ``$DATA``-Stroms ``wanted`` (nur nicht-resident)."""
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
        runs_off = struct.unpack_from("<H", record, off + 0x20)[0]
        return ntfs.parse_data_runs(bytes(record[off + runs_off: off + length]))
    return None


def _read_allocated(source, runs, cluster_size: int, base_offset: int) -> bytes:
    """Liest nur die belegten Runs des (grossteils spaerlichen) ``$J``."""
    out = bytearray()
    for lcn, count in runs:
        if lcn is None:                       # spaerlich -> keine Daten
            continue
        span = count * cluster_size
        if len(out) + span > 512 * 1024 * 1024:
            break                             # Sicherheitsgrenze
        out += source.read(base_offset + lcn * cluster_size, span)
    return bytes(out)


def _carve(source, only_delete: bool, progress_cb, should_cancel) -> Iterator[dict]:
    """Schneidet einzelne USN-Datensaetze aus dem Rohdatenstrom heraus."""
    total = source.size or 0
    carry = b""
    carry_base = 0
    for offset, data in source.stream(chunk_size=8 * 1024 * 1024):
        if should_cancel and should_cancel():
            break
        if progress_cb and total:
            progress_cb("USN-Journal suchen", min(1.0, (offset + len(data)) / total), 0)
        buf = carry + data
        buf_base = carry_base if carry else offset
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
            if rec and ((not only_delete) or (rec["reason"] & REASON_FILE_DELETE)):
                yield rec
        keep = 4096
        carry = buf[-keep:]
        carry_base = buf_base + len(buf) - len(carry)
