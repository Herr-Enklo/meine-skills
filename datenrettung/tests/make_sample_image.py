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
                           last_vcn: int, name: str = "",
                           start_vcn: int = 0) -> bytes:
    name16 = name.encode("utf-16-le")
    runs_off = _align8(0x40 + len(name16))
    length = _align8(runs_off + len(runs))
    attr = bytearray(length)
    struct.pack_into("<I", attr, 0x00, 0x80)           # $DATA
    struct.pack_into("<I", attr, 0x04, length)
    attr[0x08] = 1                                      # nicht resident
    attr[0x09] = len(name)                              # Namenslaenge (Zeichen)
    struct.pack_into("<H", attr, 0x0A, 0x40)           # Namensoffset
    struct.pack_into("<Q", attr, 0x10, start_vcn)      # Start-VCN
    struct.pack_into("<Q", attr, 0x18, last_vcn)       # letzte VCN
    struct.pack_into("<H", attr, 0x20, runs_off)       # Offset Mapping Pairs
    struct.pack_into("<Q", attr, 0x28, (last_vcn + 1) * CLUSTER)  # alloziert
    struct.pack_into("<Q", attr, 0x30, real_size)      # echte Groesse
    struct.pack_into("<Q", attr, 0x38, real_size)      # initialisierte Groesse
    attr[0x40:0x40 + len(name16)] = name16
    attr[runs_off:runs_off + len(runs)] = runs
    return bytes(attr)


def _attribute_list_entry(atype: int, name: str, start_vcn: int, ref: int) -> bytes:
    """Ein Eintrag der ``$ATTRIBUTE_LIST`` (verweist auf einen MFT-Eintrag)."""
    name16 = name.encode("utf-16-le")
    length = _align8(0x1A + len(name16))
    entry = bytearray(length)
    struct.pack_into("<I", entry, 0x00, atype)
    struct.pack_into("<H", entry, 0x04, length)
    entry[0x06] = len(name)
    entry[0x07] = 0x1A
    struct.pack_into("<Q", entry, 0x08, start_vcn)
    struct.pack_into("<Q", entry, 0x10, ref)            # MFT-Referenz (ohne Sequenz)
    entry[0x1A:0x1A + len(name16)] = name16
    return bytes(entry)


def make_usn_record(name: str, reason: int, timestamp: int, ref: int = 100,
                    parent: int = 5) -> bytes:
    """Ein USN_RECORD_V2, wie er im ``$J``-Strom liegt."""
    name16 = name.encode("utf-16-le")
    name_off = 0x3C
    rec_len = (name_off + len(name16) + 7) & ~7
    rec = bytearray(rec_len)
    struct.pack_into("<I", rec, 0, rec_len)
    struct.pack_into("<H", rec, 4, 2)                   # MajorVersion
    struct.pack_into("<Q", rec, 0x08, ref)
    struct.pack_into("<Q", rec, 0x10, parent)
    struct.pack_into("<Q", rec, 0x20, timestamp)
    struct.pack_into("<I", rec, 0x28, reason)
    struct.pack_into("<H", rec, 0x38, len(name16))
    struct.pack_into("<H", rec, 0x3A, name_off)
    rec[name_off:name_off + len(name16)] = name16
    return bytes(rec)


def _put_attrs(rec: bytearray, attrs: list[bytes]) -> None:
    off = 0x38
    for attr in attrs:
        rec[off:off + len(attr)] = attr
        off += len(attr)
    struct.pack_into("<I", rec, off, 0xFFFFFFFF)       # Attribut-Ende
    struct.pack_into("<I", rec, 0x18, off + 8)         # genutzte Groesse


USN_FILE_DELETE = 0x00000200
USN_CLOSE = 0x80000000


def build_ntfs_image(file_name: str = "geheim.txt",
                     file_data: bytes = b"Vertrauliche Notizen. Bitte wiederherstellen!\n",
                     usn: str = "",
                     ) -> tuple[bytes, dict]:
    """Baut ein NTFS-Volume mit einer geloeschten Datei in MFT-Eintrag 2.

    ``usn`` ergaenzt ein ``$UsnJrnl`` mit einem ``$J``-Strom, der eine Loeschung
    von ``weg.docx`` protokolliert: ``"direct"`` legt die Data-Runs direkt in
    den Eintrag, ``"attrlist"`` verteilt sie ueber eine ``$ATTRIBUTE_LIST`` auf
    zwei Erweiterungseintraege (wie bei grossen Journalen).
    """
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
    num_records = NUM_RECORDS + (3 if usn else 0)       # + $UsnJrnl (+ Erweiterungen)
    mft_bytes = num_records * RECORD_SIZE               # 2 Cluster je Eintrag
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

    if usn:
        # $J: zwei Cluster hinter der MFT, je ein USN-Datensatz pro Cluster.
        j_lcn = MFT_LCN + mft_clusters + 2
        j_bytes = 2 * CLUSTER
        rec_a = make_usn_record("alt.txt", 0x100 | USN_CLOSE, modified_ft, ref=40)
        rec_b = make_usn_record("weg.docx", USN_FILE_DELETE | USN_CLOSE,
                                modified_ft, ref=41)
        image[j_lcn * CLUSTER: j_lcn * CLUSTER + len(rec_a)] = rec_a
        image[(j_lcn + 1) * CLUSTER: (j_lcn + 1) * CLUSTER + len(rec_b)] = rec_b

        rec4 = _blank_record(flags=0x01)                # $UsnJrnl (Basis-Eintrag)
        name_attr = _resident_attr(0x30, _file_name_content("$UsnJrnl", parent_ref=11))
        if usn == "direct":
            runs = bytes([0x11, 2, j_lcn, 0x00])
            _put_attrs(rec4, [name_attr,
                              _nonresident_data_attr(runs, j_bytes, 1, name="$J")])
            ext = [_blank_record(0x00), _blank_record(0x00)]
        else:
            # Zwei Teilstuecke in den Erweiterungseintraegen 5 und 6, die
            # $ATTRIBUTE_LIST im Basiseintrag verweist darauf.
            alist = (_attribute_list_entry(0x80, "$J", 0, 5)
                     + _attribute_list_entry(0x80, "$J", 1, 6))
            _put_attrs(rec4, [_resident_attr(0x20, alist), name_attr])
            rec5 = _blank_record(flags=0x01)
            _put_attrs(rec5, [_nonresident_data_attr(bytes([0x11, 1, j_lcn, 0x00]),
                                                     j_bytes, 0, name="$J",
                                                     start_vcn=0)])
            rec6 = _blank_record(flags=0x01)
            _put_attrs(rec6, [_nonresident_data_attr(bytes([0x11, 1, j_lcn + 1, 0x00]),
                                                     j_bytes, 1, name="$J",
                                                     start_vcn=1)])
            ext = [rec5, rec6]
        records += [rec4] + ext

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
        "usn_deleted": "weg.docx",
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
    boot[0x15] = 0xF8                                     # Medien-Deskriptor
    boot[0x36:0x3B] = b"FAT12"
    struct.pack_into("<H", boot, bps - 2, 0xAA55)       # Boot-Signatur
    image[0:bps] = boot

    # Layout: reservierte(1) + FAT(1) + Wurzel(1) -> erster Datensektor = 3.
    image[bps:bps + 3] = b"\xf8\xff\xff"                 # FAT[0]/FAT[1] (FAT12)
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


def _lfn_entry(seq: int, chars: str, checksum: int, deleted: bool) -> bytes:
    """Ein LFN-Verzeichniseintrag (13 Zeichen) fuer FAT."""
    text = (chars + "\x00").ljust(13, "￿")[:13].encode("utf-16-le")
    entry = bytearray(32)
    entry[0] = 0xE5 if deleted else seq
    entry[1:11] = text[0:10]
    entry[0x0B] = 0x0F
    entry[0x0D] = checksum
    entry[14:26] = text[10:22]
    entry[28:32] = text[22:26]
    return bytes(entry)


def build_fat32_image(long_name: str = "Urlaubsfoto 2021.jpg",
                      file_data: bytes = b"FAT32 geloeschte Datei mit langem Namen.\n"
                      ) -> tuple[bytes, dict]:
    """Baut ein FAT32-Volume (nur der belegte Anfang) mit einer geloeschten Datei.

    FAT32 hat kein festes Wurzelverzeichnis, sondern eine Cluster-Kette ab
    ``root_cluster``; ausserdem liegt in Sektor 6 eine Kopie des Boot-Sektors.
    Die Datei traegt einen langen Namen (LFN), der auch nach dem Loeschen
    erhalten bleibt. Die Datei ist auf ``total_sectors`` deklariert, die
    Bytes hinter dem letzten belegten Cluster werden aber nicht geschrieben.
    """
    bps = 512
    reserved = 32
    cluster_count = 66000                                # > 65525 -> FAT32
    fat_sectors = (cluster_count * 4 + bps - 1) // bps
    total_sectors = reserved + fat_sectors + cluster_count
    data_sector = reserved + fat_sectors                 # Cluster 2

    boot = bytearray(bps)
    boot[3:11] = b"MSDOS5.0"
    struct.pack_into("<H", boot, 0x0B, bps)
    boot[0x0D] = 1                                        # Sektoren/Cluster
    struct.pack_into("<H", boot, 0x0E, reserved)
    boot[0x10] = 1                                        # Anzahl FATs
    boot[0x15] = 0xF8                                     # Medien-Deskriptor
    struct.pack_into("<I", boot, 0x20, total_sectors)
    struct.pack_into("<I", boot, 0x24, fat_sectors)      # Sektoren/FAT (FAT32)
    struct.pack_into("<I", boot, 0x2C, 2)               # Wurzel-Cluster
    struct.pack_into("<H", boot, 0x32, 6)               # Backup-Boot-Sektor
    boot[0x52:0x5A] = b"FAT32   "
    struct.pack_into("<H", boot, bps - 2, 0xAA55)

    image = bytearray((data_sector + 2) * bps)
    image[0:bps] = boot
    image[6 * bps:7 * bps] = boot                        # Kopie in Sektor 6
    fat_off = reserved * bps
    struct.pack_into("<III", image, fat_off, 0x0FFFFFF8, 0x0FFFFFFF, 0x0FFFFFFF)

    # Wurzelverzeichnis (Cluster 2): LFN-Teile + geloeschter 8.3-Eintrag.
    short = b"URLAUB~1JPG"
    checksum = 0
    for b in short:
        checksum = (((checksum & 1) << 7) + (checksum >> 1) + b) & 0xFF
    parts = [long_name[i:i + 13] for i in range(0, len(long_name), 13)]
    entries = b""
    for k in range(len(parts) - 1, -1, -1):
        seq = (k + 1) | (0x40 if k == len(parts) - 1 else 0)
        entries += _lfn_entry(seq, parts[k], checksum, deleted=True)
    entry = bytearray(32)
    entry[0:11] = b"\xe5" + short[1:]
    entry[0x0B] = 0x20
    struct.pack_into("<H", entry, 0x14, 0)              # Cluster high
    struct.pack_into("<H", entry, 0x16, 24576)          # 12:00:00
    struct.pack_into("<H", entry, 0x18, 21199)          # 2021-06-15
    struct.pack_into("<H", entry, 0x1A, 3)              # Startcluster 3
    struct.pack_into("<I", entry, 0x1C, len(file_data))
    entries += bytes(entry)
    root_off = data_sector * bps
    image[root_off:root_off + len(entries)] = entries
    data_off = (data_sector + 1) * bps
    image[data_off:data_off + len(file_data)] = file_data

    expected = {"name": long_name, "data": file_data,
                "modified": "2021-06-15 12:00:00", "backup_offset": 6 * bps}
    return bytes(image), expected


def build_exfat_image(name: str = "geheim.txt",
                      file_data: bytes = b"exFAT geloeschte Datei.\n",
                      with_backup: bool = False,
                      ) -> tuple[bytes, dict]:
    """Baut ein winziges exFAT-Volume mit einer geloeschten Datei im Wurzelverzeichnis.

    ``with_backup`` schreibt zusaetzlich die Backup-Boot-Region in Sektor 12,
    wie sie echte exFAT-Volumes tragen.
    """
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
    image[4 * bps:4 * bps + 8] = b"\xf8\xff\xff\xff\xff\xff\xff\xff"  # FAT[0], FAT[1]
    if with_backup:
        image[12 * bps:13 * bps] = boot

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
