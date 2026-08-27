"""Datei-Signaturen fuer das File-Carving.

Jede Signatur beschreibt, wie sich ein Dateityp roh auf dem Datentraeger
erkennen laesst: an einem festen Startmuster (``header``) und – wo moeglich –
an einem Endmuster (``footer``) oder einer im Kopf hinterlegten Groesse
(``size_from_header``). Fehlt beides, wird bis zu ``max_size`` herausgeschnitten.

Bewusst kompakt und dafuer verlaesslich gehalten. Die Typen decken die Faelle
ab, die bei privater Datenrettung am haeufigsten gebraucht werden: Fotos,
Dokumente, Archive, Audio.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Callable, Optional

MB = 1024 * 1024


@dataclass(frozen=True)
class Signature:
    name: str                      # Anzeigename, z.B. "JPEG-Bild"
    ext: str                       # Dateiendung ohne Punkt, z.B. "jpg"
    header: bytes                  # Startmuster
    footer: Optional[bytes] = None  # optionales Endmuster
    max_size: int = 25 * MB        # Obergrenze fuer einen Treffer
    header_offset: int = 0         # Position des Headers relativ zum Dateianfang
    include_footer: bool = True    # Footer-Bytes mit ausschneiden
    # Optionale Funktion, die aus dem Dateianfang die exakte Groesse liest.
    size_from_header: Optional[Callable[[bytes], Optional[int]]] = None
    # Optionale Funktion, die ab dem Footer-Anfang dessen Gesamtlaenge liefert
    # (fuer Container mit variabel langem Abschluss, z.B. ZIP mit Kommentar).
    footer_size: Optional[Callable[[bytes], int]] = None
    # Optionaler, guenstiger Plausibilitaetstest schon bei der Header-Suche.
    # Bekommt die ersten Bytes ab Dateianfang; ``False`` verwirft den Treffer
    # sofort. Wichtig bei kurzen Headern (z.B. "BM"), die sonst massenhaft
    # Fehltreffer erzeugen. Bei zu wenigen Bytes soll er ``True`` liefern.
    quick_check: Optional[Callable[[bytes], bool]] = None
    # Optionale Funktion, die aus dem Dateianfang die passende Endung ableitet
    # (fuer Container, deren Marke den Typ bestimmt: ftyp -> mp4/mov/heic,
    # RIFF -> wav/avi/webp). Gibt sie None zurueck, bleibt es bei ``ext``.
    ext_from_header: Optional[Callable[[bytes], Optional[str]]] = None
    # Optionale Struktur-Validierung: bekommt den Dateianfang und die Groesse,
    # prueft interne Merkmale (z.B. PNG-CRC, ZIP-Kompressionsmethode) und
    # verwirft Fehltreffer. Gibt ``False`` zurueck, wird der Fund fallengelassen.
    validator: Optional[Callable[[bytes, int], bool]] = None


def _le_size_at(pos: int, width: int, add: int = 0):
    """Erzeugt eine ``size_from_header``-Funktion fuer eine Little-Endian-Zahl."""
    def reader(data: bytes) -> Optional[int]:
        if len(data) < pos + width:
            return None
        value = int.from_bytes(data[pos:pos + width], "little")
        return value + add if value > 0 else None
    return reader


def _zip_eocd_size(tail: bytes) -> int:
    """Gesamtlaenge des ZIP-Abschlusses (End of Central Directory).

    ``tail`` beginnt beim Muster ``PK\\x05\\x06``. Der feste Teil ist 22 Bytes
    lang; ein optionaler Kommentar am Ende wird ueber sein Laengenfeld ergaenzt.
    """
    if len(tail) >= 22:
        comment_len = int.from_bytes(tail[20:22], "little")
        return 22 + comment_len
    return 22


def _riff_size(data: bytes) -> Optional[int]:
    # RIFF-Container (WAV/AVI): 'RIFF' + uint32 Restgroesse + Typ.
    # Gesamtgroesse = 8 + Restgroesse.
    if len(data) < 8 or data[0:4] != b"RIFF":
        return None
    rest = int.from_bytes(data[4:8], "little")
    return rest + 8 if rest > 0 else None


def _bmp_quick(head: bytes) -> bool:
    # "BM" ist nur zwei Bytes und taucht zufaellig staendig auf. Wir behalten
    # einen Treffer nur, wenn die im Kopf angegebene Groesse plausibel ist.
    if len(head) < 6:
        return True
    size = int.from_bytes(head[2:6], "little")
    return 54 <= size <= 64 * MB


def _id3_quick(head: bytes) -> bool:
    # ID3-Tags haben die Hauptversion 2, 3 oder 4.
    if len(head) < 5:
        return True
    return head[3] in (2, 3, 4) and head[4] != 0xFF


# ftyp-Marken (Offset 8..12) den ueblichen Endungen zuordnen.
_FTYP_BRANDS = {
    b"isom": "mp4", b"iso2": "mp4", b"iso4": "mp4", b"iso5": "mp4",
    b"mp41": "mp4", b"mp42": "mp4", b"avc1": "mp4", b"dash": "mp4",
    b"M4V ": "m4v", b"M4A ": "m4a", b"M4P ": "m4p",
    b"qt  ": "mov",
    b"heic": "heic", b"heix": "heic", b"hevc": "heic", b"hevx": "heic",
    b"mif1": "heic", b"msf1": "heic", b"heim": "heic", b"heis": "heic",
    b"3gp4": "3gp", b"3gp5": "3gp", b"3gg6": "3gp",
    b"crx ": "cr3",
    b"avif": "avif", b"avis": "avif",
}


def _ftyp_ext(head: bytes) -> Optional[str]:
    if len(head) < 12:
        return None
    return _FTYP_BRANDS.get(head[8:12])


def _ftyp_quick(head: bytes) -> bool:
    # Nur bekannte Marken behalten; "ftyp" allein ist zu unspezifisch.
    return len(head) < 12 or head[8:12] in _FTYP_BRANDS


def _ico_quick(head: bytes) -> bool:
    # ICO-Header 00 00 01 00; das Bildzahl-Feld muss plausibel sein.
    if len(head) < 6:
        return True
    count = int.from_bytes(head[4:6], "little")
    return 1 <= count <= 50


def _ico_size(head: bytes) -> Optional[int]:
    """Gesamtgroesse einer ICO-Datei aus ihrem Verzeichnis (oder None)."""
    if len(head) < 6:
        return None
    count = int.from_bytes(head[4:6], "little")
    if not (1 <= count <= 50):
        return None
    needed = 6 + count * 16
    if len(head) < needed:
        return None
    end = needed
    for i in range(count):
        e = 6 + i * 16
        bytes_in_res = int.from_bytes(head[e + 8:e + 12], "little")
        image_offset = int.from_bytes(head[e + 12:e + 16], "little")
        if image_offset < needed:
            return None
        end = max(end, image_offset + bytes_in_res)
    return end if end > needed else None


def _riff_ext(head: bytes) -> Optional[str]:
    if len(head) < 12:
        return None
    kind = head[8:12]
    if kind == b"WAVE":
        return "wav"
    if kind == b"AVI ":
        return "avi"
    if kind == b"WEBP":
        return "webp"
    return None


def _riff_quick(head: bytes) -> bool:
    return len(head) < 12 or head[8:12] in (b"WAVE", b"AVI ", b"WEBP")


# -- Struktur-Validatoren (Kategorie 3) ---------------------------------
# Pruefen interne Merkmale eines Fundes und verwerfen Fehltreffer.

def _png_valid(data: bytes, size: int) -> bool:
    import zlib
    if len(data) < 33 or data[:8] != b"\x89PNG\r\n\x1a\n":
        return False
    length = int.from_bytes(data[8:12], "big")
    if data[12:16] != b"IHDR" or length != 13:
        return False
    body = data[12:16 + length]
    want = int.from_bytes(data[16 + length:20 + length], "big")
    return (zlib.crc32(body) & 0xFFFFFFFF) == want


def _jpeg_valid(data: bytes, size: int) -> bool:
    if len(data) < 4 or data[:2] != b"\xff\xd8":
        return False
    # Nach dem Startmarker muss ein gueltiger Marker folgen (0xFF + Typ).
    return data[2] == 0xFF and data[3] not in (0x00, 0xFF)


def _zip_valid(data: bytes, size: int) -> bool:
    if len(data) < 10 or data[:4] != b"PK\x03\x04":
        return False
    method = int.from_bytes(data[8:10], "little")
    return method in (0, 8, 9, 12, 14, 99)   # store, deflate, bzip2, lzma, AES


def _bmp_valid(data: bytes, size: int) -> bool:
    if len(data) < 14 or data[:2] != b"BM":
        return False
    pixel_off = int.from_bytes(data[10:14], "little")
    return 14 <= pixel_off <= size


def _ole_valid(data: bytes, size: int) -> bool:
    if len(data) < 0x20 or data[:8] != b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1":
        return False
    if data[0x1C:0x1E] != b"\xfe\xff":           # Byte-Order-Marke
        return False
    return int.from_bytes(data[0x1E:0x20], "little") in (9, 12)  # 512/4096


# Reihenfolge = grobe Prioritaet bei ueberlappenden Headern.
SIGNATURES: list[Signature] = [
    Signature("JPEG-Bild", "jpg",
              header=b"\xFF\xD8\xFF", footer=b"\xFF\xD9", max_size=30 * MB,
              validator=_jpeg_valid),
    Signature("PNG-Bild", "png",
              header=b"\x89PNG\r\n\x1a\n",
              footer=b"IEND\xaeB`\x82", max_size=30 * MB, validator=_png_valid),
    Signature("GIF-Bild", "gif",
              header=b"GIF89a", footer=b"\x00\x3B", max_size=10 * MB),
    Signature("GIF-Bild", "gif",
              header=b"GIF87a", footer=b"\x00\x3B", max_size=10 * MB),
    Signature("BMP-Bild", "bmp",
              header=b"BM", max_size=30 * MB,
              size_from_header=_le_size_at(2, 4), quick_check=_bmp_quick,
              validator=_bmp_valid),
    Signature("ICO-Symbol", "ico",
              header=b"\x00\x00\x01\x00", max_size=2 * MB,
              size_from_header=_ico_size, quick_check=_ico_quick),
    Signature("JPEG-2000-Bild", "jp2",
              header=b"\x00\x00\x00\x0cjP  \r\n\x87\n", max_size=100 * MB),
    Signature("Fujifilm-RAW", "raf",
              header=b"FUJIFILMCCD-RAW", max_size=100 * MB),
    Signature("Panasonic-RAW", "rw2",
              header=b"II\x55\x00", max_size=100 * MB),
    Signature("PDF-Dokument", "pdf",
              header=b"%PDF-", footer=b"%%EOF", max_size=100 * MB),
    Signature("ZIP/Office-Dokument", "zip",
              header=b"PK\x03\x04", footer=b"PK\x05\x06", max_size=200 * MB,
              footer_size=_zip_eocd_size, validator=_zip_valid),
    Signature("RAR-Archiv", "rar",
              header=b"Rar!\x1a\x07", max_size=500 * MB),
    Signature("7z-Archiv", "7z",
              header=b"7z\xbc\xaf\x27\x1c", max_size=500 * MB),
    Signature("GZIP-Archiv", "gz",
              header=b"\x1f\x8b\x08", max_size=200 * MB),
    Signature("SQLite-Datenbank", "sqlite",
              header=b"SQLite format 3\x00", max_size=200 * MB),
    # Alte Office-Formate und weitere OLE-Dokumente (doc, xls, ppt, msg).
    Signature("OLE-Dokument (doc/xls/ppt)", "ole",
              header=b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1", max_size=200 * MB,
              validator=_ole_valid),
    Signature("RTF-Dokument", "rtf",
              header=b"{\\rtf", footer=b"}", max_size=30 * MB),
    Signature("Photoshop-Datei", "psd",
              header=b"8BPS", max_size=500 * MB),
    # TIFF und die meisten Kamera-RAW-Formate (CR2, NEF, ARW, DNG, ORF ...).
    Signature("TIFF/RAW-Bild", "tif",
              header=b"II\x2a\x00", max_size=200 * MB),
    Signature("TIFF/RAW-Bild", "tif",
              header=b"MM\x00\x2a", max_size=200 * MB),
    Signature("Matroska/WebM-Video", "mkv",
              header=b"\x1a\x45\xdf\xa3", max_size=2048 * MB),
    Signature("FLAC-Audio", "flac",
              header=b"fLaC", max_size=200 * MB),
    Signature("RIFF-Container (wav/avi/webp)", "riff",
              header=b"RIFF", max_size=2048 * MB, size_from_header=_riff_size,
              quick_check=_riff_quick, ext_from_header=_riff_ext),
    Signature("OGG-Audio", "ogg",
              header=b"OggS", max_size=100 * MB),
    Signature("MP3-Audio", "mp3",
              header=b"ID3", max_size=50 * MB, quick_check=_id3_quick),
    Signature("ISO-Base-Media (mp4/mov/heic)", "mp4",
              header=b"ftyp", header_offset=4, max_size=2048 * MB,
              quick_check=_ftyp_quick, ext_from_header=_ftyp_ext),
]


def max_header_span() -> int:
    """Groesster Abstand von Dateianfang bis Header-Ende.

    Wird beim Streaming-Scan als Ueberlappung zwischen zwei Bloecken genutzt,
    damit kein Header an einer Blockgrenze uebersehen wird.
    """
    return max(sig.header_offset + len(sig.header) for sig in SIGNATURES)
