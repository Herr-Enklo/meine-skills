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
}


def _ftyp_ext(head: bytes) -> Optional[str]:
    if len(head) < 12:
        return None
    return _FTYP_BRANDS.get(head[8:12])


def _ftyp_quick(head: bytes) -> bool:
    # Nur bekannte Marken behalten; "ftyp" allein ist zu unspezifisch.
    return len(head) < 12 or head[8:12] in _FTYP_BRANDS


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


# Reihenfolge = grobe Prioritaet bei ueberlappenden Headern.
SIGNATURES: list[Signature] = [
    Signature("JPEG-Bild", "jpg",
              header=b"\xFF\xD8\xFF", footer=b"\xFF\xD9", max_size=30 * MB),
    Signature("PNG-Bild", "png",
              header=b"\x89PNG\r\n\x1a\n",
              footer=b"IEND\xaeB`\x82", max_size=30 * MB),
    Signature("GIF-Bild", "gif",
              header=b"GIF89a", footer=b"\x00\x3B", max_size=10 * MB),
    Signature("GIF-Bild", "gif",
              header=b"GIF87a", footer=b"\x00\x3B", max_size=10 * MB),
    Signature("BMP-Bild", "bmp",
              header=b"BM", max_size=30 * MB,
              size_from_header=_le_size_at(2, 4), quick_check=_bmp_quick),
    Signature("PDF-Dokument", "pdf",
              header=b"%PDF-", footer=b"%%EOF", max_size=100 * MB),
    Signature("ZIP/Office-Dokument", "zip",
              header=b"PK\x03\x04", footer=b"PK\x05\x06", max_size=200 * MB,
              footer_size=_zip_eocd_size),
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
              header=b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1", max_size=200 * MB),
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
