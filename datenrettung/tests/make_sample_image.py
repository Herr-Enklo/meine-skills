"""Baut synthetische Test-Images fuer die Engine.

Zwei Bauteile:

- ``build_carving_image`` legt echte kleine Dateien (PNG, JPEG, PDF, ZIP) mit
  Zwischenraeumen in einen Rohdatenstrom. Damit laesst sich pruefen, ob das
  Carving Anfang und Ende korrekt findet.
- ``build_ntfs_image`` erzeugt ein winziges, von Hand konstruiertes NTFS-Volume
  mit genau einer geloeschten Datei (residenter Inhalt). Damit wird der
  komplette MFT-Pfad getestet, ohne ein echtes Dateisystem anlegen zu muessen.
"""

from __future__ import annotations

import io
import struct
import zipfile
import zlib


# -- Carving-Testdaten ---------------------------------------------------

def make_png() -> bytes:
    def chunk(typ: bytes, data: bytes) -> bytes:
        body = typ + data
        return struct.pack(">I", len(data)) + body + struct.pack(">I", zlib.crc32(body) & 0xFFFFFFFF)

    sig = b"\x89PNG\r\n\x1a\n"
    ihdr = struct.pack(">IIBBBBB", 1, 1, 8, 2, 0, 0, 0)  # 1x1, 8 bit, RGB
    idat = zlib.compress(b"\x00\xff\x00\x00")            # Filterbyte + ein Pixel
    return sig + chunk(b"IHDR", ihdr) + chunk(b"IDAT", idat) + chunk(b"IEND", b"")


def make_jpeg() -> bytes:
    # Gueltiger Rahmen (Header + Footer); Inhalt ohne 0xFF, damit der Footer
    # eindeutig am Ende steht.
    header = b"\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x00\x00\x01\x00\x01\x00\x00"
    body = bytes(range(0, 200)) .replace(b"\xff", b"\x7f")
    return header + body + b"\xff\xd9"


def make_pdf() -> bytes:
    body = (b"%PDF-1.4\n"
            b"1 0 obj<< /Type /Catalog >>endobj\n"
            b"trailer<< /Root 1 0 R >>\n")
    return body + b"%%EOF"


def make_zip() -> bytes:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("hallo.txt", "Dies ist eine Testdatei im ZIP.\n")
        zf.writestr("ordner/notiz.txt", "Noch eine Datei.\n")
    return buf.getvalue()


def build_carving_image(gap: bytes = b"\x00") -> tuple[bytes, list[dict]]:
    """Baut ein Image mit eingebetteten Dateien.

    Rueckgabe: ``(image_bytes, erwartungen)`` mit je ``{ext, offset, data}``.
    """
    parts: list[dict] = [
        {"ext": "png", "data": make_png()},
        {"ext": "jpg", "data": make_jpeg()},
        {"ext": "pdf", "data": make_pdf()},
        {"ext": "zip", "data": make_zip()},
    ]
    out = bytearray()
    out += gap * 512                      # Vorlauf aus Fuellbytes
    expected: list[dict] = []
    for part in parts:
        offset = len(out)
        out += part["data"]
        expected.append({"ext": part["ext"], "offset": offset, "data": part["data"]})
        out += gap * 700                  # Zwischenraum
    out += gap * 512
    # Auf ein Vielfaches von 512 auffuellen.
    if len(out) % 512:
        out += gap * (512 - (len(out) % 512))
    return bytes(out), expected


# -- NTFS-Testdaten ------------------------------------------------------

RECORD_SIZE = 1024
SECTOR = 512
SPC = 1                       # Sektoren pro Cluster -> Clustergroesse 512
CLUSTER = SECTOR * SPC
MFT_LCN = 4                   # MFT beginnt bei Cluster 4 (Offset 2048)
NUM_RECORDS = 4


def _align8(n: int) -> int:
    return (n + 7) & ~7


def _blank_record(flags: int) -> bytearray:
    rec = bytearray(RECORD_SIZE)
    rec[0:4] = b"FILE"
    struct.pack_into("<H", rec, 0x04, 0x30)   # Offset Update-Sequence-Array
    struct.pack_into("<H", rec, 0x06, 3)      # Anzahl (USN + 2 Fixups)
    struct.pack_into("<H", rec, 0x14, 0x38)   # Offset erstes Attribut
    struct.pack_into("<H", rec, 0x16, flags)  # Flags (Bit0 = in Benutzung)
    struct.pack_into("<I", rec, 0x1C, RECORD_SIZE)  # allokierte Groesse
    # Update-Sequence: USN = 1, zwei Original-Bytes (hier 0x0000).
    struct.pack_into("<H", rec, 0x30, 1)
    struct.pack_into("<H", rec, 0x32, 0)
    struct.pack_into("<H", rec, 0x34, 0)
    # Sektorenden auf die USN setzen (werden vom Fixup zurueckgeschrieben).
    struct.pack_into("<H", rec, SECTOR - 2, 1)
    struct.pack_into("<H", rec, 2 * SECTOR - 2, 1)
    return rec


def _resident_attr(atype: int, content: bytes) -> bytes:
    content_off = 0x18
    length = _align8(content_off + len(content))
    attr = bytearray(length)
    struct.pack_into("<I", attr, 0x00, atype)
    struct.pack_into("<I", attr, 0x04, length)
    attr[0x08] = 0                                   # resident
    attr[0x09] = 0                                   # ohne Namen
    struct.pack_into("<H", attr, 0x0A, 0)
    struct.pack_into("<I", attr, 0x10, len(content))  # Inhaltslaenge
    struct.pack_into("<H", attr, 0x14, content_off)   # Inhaltsoffset
    attr[content_off:content_off + len(content)] = content
    return bytes(attr)


def _standard_information_content(created: int, modified: int, accessed: int) -> bytes:
    content = bytearray(0x48)
    struct.pack_into("<Q", content, 0x00, created)
    struct.pack_into("<Q", content, 0x08, modified)
    struct.pack_into("<Q", content, 0x10, modified)   # MFT-Aenderung
    struct.pack_into("<Q", content, 0x18, accessed)
    return bytes(content)


def _file_name_content(name: str, parent_ref: int = 5) -> bytes:
    name_utf16 = name.encode("utf-16-le")
    content = bytearray(0x42 + len(name_utf16))
    struct.pack_into("<Q", content, 0x00, parent_ref)  # Elternverzeichnis
    content[0x40] = len(name)                           # Namenslaenge (Zeichen)
    content[0x41] = 1                                   # Namensraum Win32
    content[0x42:0x42 + len(name_utf16)] = name_utf16
    return bytes(content)


def _nonresident_data_attr(runs: bytes, real_size: int,
                           last_vcn: int) -> bytes:
    runs_off = 0x40
    length = _align8(runs_off + len(runs))
    attr = bytearray(length)
    struct.pack_into("<I", attr, 0x00, 0x80)           # $DATA
    struct.pack_into("<I", attr, 0x04, length)
    attr[0x08] = 1                                      # nicht resident
    attr[0x09] = 0
    struct.pack_into("<H", attr, 0x0A, 0)
    struct.pack_into("<Q", attr, 0x10, 0)              # Start-VCN
    struct.pack_into("<Q", attr, 0x18, last_vcn)       # letzte VCN
    struct.pack_into("<H", attr, 0x20, runs_off)       # Offset Mapping Pairs
    struct.pack_into("<Q", attr, 0x28, (last_vcn + 1) * CLUSTER)  # alloziert
    struct.pack_into("<Q", attr, 0x30, real_size)      # echte Groesse
    struct.pack_into("<Q", attr, 0x38, real_size)      # initialisierte Groesse
    attr[runs_off:runs_off + len(runs)] = runs
    return bytes(attr)


def _put_attrs(rec: bytearray, attrs: list[bytes]) -> None:
    off = 0x38
    for attr in attrs:
        rec[off:off + len(attr)] = attr
        off += len(attr)
    struct.pack_into("<I", rec, off, 0xFFFFFFFF)       # Attribut-Ende
    struct.pack_into("<I", rec, 0x18, off + 8)         # genutzte Groesse


def build_ntfs_image(file_name: str = "geheim.txt",
                     file_data: bytes = b"Vertrauliche Notizen. Bitte wiederherstellen!\n"
                     ) -> tuple[bytes, dict]:
    """Baut ein NTFS-Volume mit einer geloeschten Datei in MFT-Eintrag 2."""
    total_sectors = 64
    image = bytearray(total_sectors * SECTOR)

    # Boot-Sektor.
    boot = bytearray(SECTOR)
    boot[3:11] = b"NTFS    "
    struct.pack_into("<H", boot, 0x0B, SECTOR)          # Bytes pro Sektor
    boot[0x0D] = SPC                                     # Sektoren pro Cluster
    struct.pack_into("<Q", boot, 0x28, total_sectors)   # Gesamtsektoren
    struct.pack_into("<Q", boot, 0x30, MFT_LCN)         # MFT-Cluster
    struct.pack_into("<b", boot, 0x40, -10)             # 2^10 = 1024 pro Eintrag
    struct.pack_into("<H", boot, SECTOR - 2, 0xAA55)    # Boot-Signatur
    image[0:SECTOR] = boot

    mft_offset = MFT_LCN * CLUSTER
    mft_bytes = NUM_RECORDS * RECORD_SIZE               # 4096 Bytes = 8 Cluster
    mft_clusters = mft_bytes // CLUSTER

    # Eintrag 0: $MFT mit nicht-residentem $DATA, das die MFT selbst abbildet.
    rec0 = _blank_record(flags=0x01)                    # in Benutzung
    # Ein Run: mft_clusters Cluster ab LCN 4. Header 0x11 = 1 Byte Laenge, 1 Byte Offset.
    runs = bytes([0x11, mft_clusters, MFT_LCN, 0x00])
    _put_attrs(rec0, [_nonresident_data_attr(runs, mft_bytes, mft_clusters - 1)])

    # Bekannter Aenderungszeitpunkt (2021-06-15 12:00:00 UTC) als NTFS-FILETIME.
    import datetime
    mod_dt = datetime.datetime(2021, 6, 15, 12, 0, 0, tzinfo=datetime.timezone.utc)
    epoch = datetime.datetime(1601, 1, 1, tzinfo=datetime.timezone.utc)
    modified_ft = int((mod_dt - epoch).total_seconds() * 10_000_000)

    # Eintrag 2: geloeschte Datei im Ordner "Ordner" (MFT-Eintrag 3).
    rec2 = _blank_record(flags=0x00)
    _put_attrs(rec2, [
        _resident_attr(0x10, _standard_information_content(modified_ft, modified_ft, modified_ft)),
        _resident_attr(0x30, _file_name_content(file_name, parent_ref=3)),
        _resident_attr(0x80, file_data),
    ])

    # Eintrag 3: Verzeichnis "Ordner" unter der Wurzel (Eintrag 5).
    rec3 = _blank_record(flags=0x03)                    # in Benutzung + Verzeichnis
    _put_attrs(rec3, [_resident_attr(0x30, _file_name_content("Ordner", parent_ref=5))])

    records = [rec0, _blank_record(0x00), rec2, rec3]
    for i, rec in enumerate(records):
        pos = mft_offset + i * RECORD_SIZE
        image[pos:pos + RECORD_SIZE] = rec

    expected = {
        "record": 2,
        "name": file_name,
        "data": file_data,
        "mft_offset": mft_offset,
        "path": f"Ordner/{file_name}",
        "modified": "2021-06-15 12:00:00",
    }
    return bytes(image), expected


def build_fat_image(file_name_83: bytes = b"HALLO   TXT",
                    file_data: bytes = b"FAT geloeschte Datei.\n"
                    ) -> tuple[bytes, dict]:
    """Baut ein winziges FAT12-Volume mit einer geloeschten Datei im Wurzelverzeichnis."""
    bps = 512
    total_sectors = 16
    image = bytearray(total_sectors * bps)

    boot = bytearray(bps)
    boot[3:11] = b"MSDOS5.0"
    struct.pack_into("<H", boot, 0x0B, bps)             # Bytes/Sektor
    boot[0x0D] = 1                                        # Sektoren/Cluster
    struct.pack_into("<H", boot, 0x0E, 1)               # reservierte Sektoren
    boot[0x10] = 1                                        # Anzahl FATs
    struct.pack_into("<H", boot, 0x11, 16)              # Wurzeleintraege
    struct.pack_into("<H", boot, 0x13, total_sectors)   # Gesamtsektoren
    struct.pack_into("<H", boot, 0x16, 1)               # Sektoren/FAT
    struct.pack_into("<H", boot, bps - 2, 0xAA55)       # Boot-Signatur
    image[0:bps] = boot

    # Layout: reservierte(1) + FAT(1) + Wurzel(1) -> erster Datensektor = 3.
    root_offset = (1 + 1) * bps                          # Sektor 2
    data_offset = 3 * bps                                # Cluster 2

    entry = bytearray(32)
    entry[0:11] = b"\xe5ALLO   TXT"                      # geloescht (0xE5)
    entry[0x0B] = 0x20                                    # Archiv
    struct.pack_into("<H", entry, 0x14, 0)              # Cluster high
    struct.pack_into("<H", entry, 0x16, 24576)          # Zeit 12:00:00
    struct.pack_into("<H", entry, 0x18, 21199)          # Datum 2021-06-15
    struct.pack_into("<H", entry, 0x1A, 2)              # Startcluster
    struct.pack_into("<I", entry, 0x1C, len(file_data))  # Groesse
    image[root_offset:root_offset + 32] = entry

    image[data_offset:data_offset + len(file_data)] = file_data

    expected = {
        "name": "_ALLO.TXT",
        "data": file_data,
        "modified": "2021-06-15 12:00:00",
    }
    return bytes(image), expected


def build_exfat_image(name: str = "geheim.txt",
                      file_data: bytes = b"exFAT geloeschte Datei.\n"
                      ) -> tuple[bytes, dict]:
    """Baut ein winziges exFAT-Volume mit einer geloeschten Datei im Wurzelverzeichnis."""
    bps = 512
    image = bytearray(32 * bps)

    boot = bytearray(bps)
    boot[3:11] = b"EXFAT   "
    struct.pack_into("<Q", boot, 0x48, 32)              # Volume-Laenge (Sektoren)
    struct.pack_into("<I", boot, 0x50, 4)               # FAT-Sektor
    struct.pack_into("<I", boot, 0x54, 1)               # FAT-Laenge
    struct.pack_into("<I", boot, 0x58, 8)               # Cluster-Heap-Sektor
    struct.pack_into("<I", boot, 0x5C, 8)               # Cluster-Anzahl
    struct.pack_into("<I", boot, 0x60, 2)               # Wurzel-Cluster
    boot[0x6C] = 9                                        # Bytes/Sektor-Shift (512)
    boot[0x6D] = 0                                        # Sektoren/Cluster-Shift (1)
    boot[0x6E] = 1                                        # Anzahl FATs
    struct.pack_into("<H", boot, bps - 2, 0xAA55)
    image[0:bps] = boot

    root_off = 8 * bps                                   # Cluster 2
    data_off = 9 * bps                                   # Cluster 3
    mtime = 1389322240                                   # 2021-06-15 12:00:00

    file_entry = bytearray(32)
    file_entry[0] = 0x05                                  # File-Eintrag, geloescht
    file_entry[1] = 2                                     # zwei Folgeeintraege
    struct.pack_into("<H", file_entry, 0x04, 0x20)      # Archiv
    struct.pack_into("<I", file_entry, 0x0C, mtime)     # LastModified

    stream = bytearray(32)
    stream[0] = 0x40                                     # Stream-Extension, geloescht
    stream[1] = 0x02                                     # NoFatChain (zusammenhaengend)
    stream[3] = len(name)                                # Namenslaenge
    struct.pack_into("<I", stream, 0x14, 3)             # Startcluster
    struct.pack_into("<Q", stream, 0x18, len(file_data))  # Datenlaenge

    name_entry = bytearray(32)
    name_entry[0] = 0x41                                 # Namens-Eintrag, geloescht
    name_utf16 = name.encode("utf-16-le")
    name_entry[2:2 + len(name_utf16)] = name_utf16

    image[root_off:root_off + 32] = file_entry
    image[root_off + 32:root_off + 64] = stream
    image[root_off + 64:root_off + 96] = name_entry
    image[data_off:data_off + len(file_data)] = file_data

    expected = {"name": name, "data": file_data, "modified": "2021-06-15 12:00:00"}
    return bytes(image), expected


if __name__ == "__main__":
    img, exp = build_carving_image()
    print(f"Carving-Image: {len(img)} Bytes, {len(exp)} Dateien eingebettet")
    nimg, nexp = build_ntfs_image()
    print(f"NTFS-Image: {len(nimg)} Bytes, geloeschte Datei '{nexp['name']}'")
