"""Datei-Signaturen fuer das File-Carving.

Jede Signatur beschreibt, wie sich ein Dateityp roh auf dem Datentraeger
erkennen laesst: an einem festen Startmuster (``header``) und – wo moeglich –
an einem Endmuster (``footer``), einer im Kopf hinterlegten Groesse
(``size_from_header``) oder einem strukturellen Ende (``end_finder``). Fehlt
all das, wird bis zu ``max_size`` herausgeschnitten, spaetestens aber bis zum
naechsten Kopf desselben Typs.

Bewusst kompakt und dafuer verlaesslich gehalten. Die Typen decken die Faelle
ab, die bei privater Datenrettung am haeufigsten gebraucht werden: Fotos,
Dokumente, Archive, Audio.
"""

from __future__ import annotations

import re
import struct
import zlib
from dataclasses import dataclass
from typing import Callable, Optional

MB = 1024 * 1024

# Rueckgabewert eines ``end_finder``: "keine strukturelle Aussage moeglich,
# bitte mit Footer-Suche weitermachen".
FALLBACK = object()


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
    # Liefert size_from_header nichts: Kandidat verwerfen (True) oder mit den
    # uebrigen Verfahren weitermachen (False).
    size_required: bool = True
    # Ist die Groesse aus dem Kopf so gut abgesichert (z.B. per CRC), dass darin
    # liegende Treffer als eingebettet gelten duerfen?
    trusted_size: bool = False
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
    # Optionaler struktureller Ende-Finder: bekommt ``read(offset, laenge)``,
    # den Dateianfang und eine Obergrenze. Rueckgabe ``(ende, vollstaendig)``,
    # ``FALLBACK`` (Footer-Suche uebernimmt) oder ``None`` (kein gueltiger
    # Fund; bei ``strict_end`` wird der Kandidat verworfen).
    end_finder: Optional[Callable] = None
    strict_end: bool = False
    # Optionale Verschachtelung ``(oeffner_regex, schliesser_regex[, ueberspringen])``:
    # das Endmuster zaehlt erst, wenn alle inneren Oeffner geschlossen sind.
    # Das dritte Muster (z.B. Escape-Sequenzen) wird ueberlesen.
    nesting: Optional[tuple] = None
    # Optionaler Test, ob die Datei hinter einem gefundenen Endmuster weitergeht
    # (PDF mit inkrementellen Updates hat mehrere ``%%EOF``). Bekommt die Bytes
    # direkt hinter dem Footer; ``True`` = weitersuchen.
    footer_continue: Optional[Callable[[bytes], bool]] = None
    # Optionale Pruefung eines gefundenen Endmusters ``(read, start, fundstelle)``;
    # ``False`` = gehoert nicht zu dieser Datei, weitersuchen (ZIP in ZIP).
    footer_valid: Optional[Callable] = None


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


def _zip_eocd_valid(read, start: int, eocd: int) -> bool:
    """Passt dieses End-of-Central-Directory zu der ZIP-Datei ab ``start``?

    Das EOCD liegt direkt hinter dem Zentralverzeichnis. Dessen Offset und
    Groesse stehen im EOCD relativ zum Dateianfang. Ein EOCD, bei dem die
    Rechnung nicht aufgeht, gehoert zu einem eingebetteten Archiv (JAR, DOCX
    oder ZIP als gespeicherte Datei) – dann wird weitergesucht.

    ZIP64 (APPNOTE 4.3.14/4.3.15): Steht direkt vor dem EOCD ein ZIP64-Locator
    oder enthaelt das EOCD Platzhalter (0xFFFF/0xFFFFFFFF), gelten die Werte des
    ZIP64-EOCD-Satzes. Das kommt auch ohne grosse Dateien vor, allein wegen
    mehr als 65.535 Eintraegen.
    """
    rec = read(eocd, 22)
    if len(rec) < 22:
        return False
    disk, cd_disk, on_disk, total, cd_size, cd_off = struct.unpack_from("<HHHHII", rec, 4)
    placeholder = (0xFFFF in (disk, cd_disk, on_disk, total)
                   or 0xFFFFFFFF in (cd_size, cd_off))
    loc = read(eocd - 20, 20) if eocd - start >= 20 else b""
    if len(loc) == 20 and loc[0:4] == b"PK\x06\x07":
        rec64_rel = struct.unpack_from("<Q", loc, 8)[0]
        rec64 = read(start + rec64_rel, 56)
        if len(rec64) < 56 or rec64[0:4] != b"PK\x06\x06":
            return False
        rec64_len = 12 + struct.unpack_from("<Q", rec64, 4)[0]
        cd_size, cd_off = struct.unpack_from("<QQ", rec64, 40)
        # Reihenfolge: Zentralverzeichnis, ZIP64-EOCD-Satz, Locator, EOCD.
        if rec64_rel != cd_off + cd_size or start + rec64_rel + rec64_len != eocd - 20:
            return False
    elif placeholder:
        return False
    elif eocd - start != cd_off + cd_size:
        return False
    if cd_size:
        return read(start + cd_off, 4) == b"PK\x01\x02"
    return True


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


def _sevenzip_size(head: bytes) -> Optional[int]:
    """Exakte Groesse eines 7z-Archivs aus dem CRC-geschuetzten Startkopf."""
    if len(head) < 32 or head[0:6] != b"7z\xbc\xaf\x27\x1c":
        return None
    start_crc = struct.unpack_from("<I", head, 8)[0]
    if zlib.crc32(head[12:32]) & 0xFFFFFFFF != start_crc:
        return None
    next_off, next_size = struct.unpack_from("<QQ", head, 12)
    total = 32 + next_off + next_size
    return total if next_size > 0 else None


def _sqlite_size(head: bytes) -> Optional[int]:
    """Groesse einer SQLite-Datei aus dem Kopf (ab Version 3.7.0 gepflegt)."""
    if len(head) < 100 or head[0:16] != b"SQLite format 3\x00":
        return None
    page = struct.unpack_from(">H", head, 16)[0]
    page = 65536 if page == 1 else page
    if page < 512 or page & (page - 1):
        return None
    change_counter = struct.unpack_from(">I", head, 24)[0]
    pages = struct.unpack_from(">I", head, 28)[0]
    valid_for = struct.unpack_from(">I", head, 92)[0]
    if pages == 0 or valid_for != change_counter:
        return None
    return page * pages


def _sqlite_quick(head: bytes) -> bool:
    # Feste Werte im Kopf: Nutzlast-Anteile 64/32/32.
    return len(head) < 24 or head[21:24] == b"\x40\x20\x20"


# -- JPEG ------------------------------------------------------------------

_ZERO_RUN = bytes(4096)

# Marker, die direkt auf SOI folgen koennen: APPn, DQT, DHT, SOF, DRI, COM.
_JPEG_FIRST = frozenset(list(range(0xE0, 0xF0)) + [0xDB, 0xC4, 0xDD, 0xFE]
                        + [m for m in range(0xC0, 0xD0) if m not in (0xC4, 0xC8, 0xCC)])


def _jpeg_quick(head: bytes) -> bool:
    """Nach SOI muss ein plausibles erstes Segment folgen."""
    if len(head) < 6:
        return True
    return head[3] in _JPEG_FIRST and int.from_bytes(head[4:6], "big") >= 2


def _jpeg_end(read, start: int, limit: int):
    """Verfolgt die Marker-Struktur eines JPEG bis zum ``FF D9``.

    Segmente mit Laengenfeld (APPn, DQT, SOF, DHT ...) werden uebersprungen –
    damit liegt ein in EXIF eingebettetes Vorschaubild samt eigenem ``FF D9``
    ausserhalb der Suche und beendet die Datei nicht vorzeitig. Nach einem
    SOS-Segment werden die Entropiedaten bis zum naechsten echten Marker
    ueberlesen (``FF 00`` und Restart-Marker ``FF D0..D7`` gehoeren zu den
    Daten). Progressive JPEGs mit mehreren SOS-Segmenten werden so ebenfalls
    verfolgt.

    Rueckgabe:
    - ``(ende, True)``: vollstaendig bis EOI.
    - ``(ende, False)``: Datei bricht ab (fremder Dateianfang ``FF D8`` mitten
      in der Struktur, ungueltiges Segment nach Bilddaten, Ende der Quelle);
      ``ende`` ist die letzte sichere Stelle.
    - ``FALLBACK``: Kopf plausibel, Struktur aber vor den Bilddaten gestoert
      (z.B. beschaedigtes Laengenfeld) – die Footer-Suche soll uebernehmen.
    - ``None``: schon die ersten Segmente sind unplausibel (Fehltreffer).
    """
    window = 64 * 1024
    pos = start + 2                                    # hinter FF D8
    buf = b""
    buf_pos = 0
    segments = 0                                       # gueltige Segmente vor SOS
    seen_sos = False

    def get(at: int, n: int) -> bytes:
        nonlocal buf, buf_pos
        if at < buf_pos or at + n > buf_pos + len(buf):
            want = min(max(n, window), limit - at)
            if want <= 0:
                return b""
            buf = read(at, want)
            buf_pos = at
        return buf[at - buf_pos:at - buf_pos + n]

    def broken(at: int):
        if seen_sos:
            return (at, False)
        return FALLBACK if segments >= 2 else None

    while pos + 2 <= limit:
        head = get(pos, 4)
        if len(head) < 2 or head[0] != 0xFF:
            return broken(pos)
        marker = head[1]
        if marker == 0xFF:                             # Fuellbyte
            pos += 1
            continue
        if marker == 0xD9:                             # EOI
            return (pos + 2, True)
        if marker == 0xD8:
            # Ein neuer Dateianfang mitten in der Struktur: diese Datei ist hier
            # zu Ende (fragmentiert/abgeschnitten), dort beginnt eine andere.
            return broken(pos)
        if 0xD0 <= marker <= 0xD7 or marker == 0x01:
            pos += 2                                   # Marker ohne Laengenfeld
            continue
        if marker == 0x00 or len(head) < 4:
            return broken(pos)
        seg_len = int.from_bytes(head[2:4], "big")
        if seg_len < 2:
            return broken(pos)
        pos += 2 + seg_len
        if marker != 0xDA:                             # kein SOS -> naechstes Segment
            segments += 1
            continue
        seen_sos = True
        # Entropiedaten: bis zum naechsten Marker, der nicht zu den Daten gehoert.
        while True:
            chunk = get(pos, window)
            if not chunk:
                return (min(pos, limit), False)
            # Ein leerer Bereich (4 KiB Nullen) kommt in komprimierten Bilddaten
            # praktisch nicht vor: hier endet eine abgeschnittene Datei.
            zeros = chunk.find(_ZERO_RUN)
            i = 0
            found = -1
            while True:
                i = chunk.find(b"\xff", i)
                if i < 0 or i + 1 >= len(chunk):
                    break                              # kein FF mehr / FF am Blockende
                nxt = chunk[i + 1]
                if nxt == 0x00 or 0xD0 <= nxt <= 0xD7:
                    i += 2
                    continue
                if nxt == 0xFF:
                    i += 1
                    continue
                found = i
                break
            if zeros >= 0 and (found < 0 or zeros < found):
                end = pos + zeros
                end = ((end + 511) // 512) * 512          # bis zur Sektorgrenze
                return (min(end, limit), False)
            if found >= 0:
                pos += found
                break
            if i < 0:                                  # kein FF im Block
                pos += len(chunk)
            elif len(chunk) < window:                  # FF am Quellenende
                return (pos + len(chunk), False)
            else:
                pos += i                               # FF an Blockgrenze: neu ansetzen
            if pos >= limit:
                return (limit, False)
    return (min(pos, limit), False) if seen_sos else broken(pos)


# -- GZIP ------------------------------------------------------------------

def _gzip_quick(head: bytes) -> bool:
    """Reservierte Flag-Bits frei, plausible Kompressionsstufe und OS-Kennung."""
    if len(head) < 10:
        return True
    flags, xfl, os_id = head[3], head[8], head[9]
    return not (flags & 0xE0) and xfl in (0, 2, 4) and (os_id <= 13 or os_id == 255)


def _gzip_end(read, start: int, limit: int):
    """Findet das Ende eines GZIP-Stroms durch Entpacken (ohne die Daten zu behalten).

    Zufaellige Treffer auf ``1F 8B 08`` scheitern sofort an der Deflate-Struktur;
    echte Dateien enden exakt hinter dem 8-Byte-Abschluss (CRC32 + Laenge), der
    zusaetzlich geprueft wird.
    """
    head = read(start, 10 + 1024)
    if len(head) < 18 or head[0:3] != b"\x1f\x8b\x08" or not _gzip_quick(head):
        return None
    flags = head[3]
    pos = 10
    if flags & 0x04:                                   # FEXTRA
        pos += 2 + int.from_bytes(head[pos:pos + 2], "little")
    for bit in (0x08, 0x10):                           # FNAME, FCOMMENT
        if flags & bit:
            end = head.find(b"\x00", pos)
            if end < 0:
                return None
            pos = end + 1
    if flags & 0x02:                                   # FHCRC
        pos += 2
    if pos >= len(head):
        return None
    inflater = zlib.decompressobj(-zlib.MAX_WBITS)
    crc = 0
    produced = 0
    offset = start + pos
    step = 64 * 1024
    while offset < limit:
        chunk = read(offset, min(step, limit - offset))
        if not chunk:
            break
        data = chunk
        while True:
            try:
                out = inflater.decompress(data, 1 << 20)
            except zlib.error:
                # Echte, aber beschaedigte Datei (viel entpackt) -> Teilfund.
                return (offset, False) if produced >= 64 * 1024 else None
            crc = zlib.crc32(out, crc)
            produced += len(out)
            if inflater.eof:
                end = offset + len(chunk) - len(inflater.unused_data)
                trailer = read(end, 8)
                if len(trailer) < 8:
                    return (end, False)
                want_crc, want_len = struct.unpack("<II", trailer)
                ok = want_crc == crc & 0xFFFFFFFF and want_len == produced & 0xFFFFFFFF
                return (end + 8, ok)
            if produced > 8 * 1024 * MB:
                return (offset + len(chunk), False)
            if not inflater.unconsumed_tail:
                break
            data = inflater.unconsumed_tail
        offset += len(chunk)
        step = min(step * 2, 8 * MB)
    return (offset, False) if produced else None


# -- PDF und RTF -------------------------------------------------------------

def _pdf_eof_size(tail: bytes) -> int:
    """``%%EOF`` samt folgendem Zeilenende (``\\r\\n``, ``\\n`` oder ``\\r``)."""
    if tail[5:7] == b"\r\n":
        return 7
    if tail[5:6] in (b"\n", b"\r"):
        return 6
    return 5


def _pdf_continues(tail: bytes) -> bool:
    """Geht ein PDF hinter ``%%EOF`` weiter (inkrementelles Update)?

    Nach einem Update folgen neue Objekte (``N G obj``), ``xref``, ``trailer``
    oder ``startxref``; Nullen, ein fremder Dateikopf oder ein neues PDF
    (``%PDF-``) bedeuten Ende.
    """
    text = tail.lstrip(b"\r\n\t ")
    if not text or text.startswith(b"%PDF-"):
        return False
    if text.startswith((b"xref", b"trailer", b"startxref", b"%")):
        return True
    return re.match(rb"\d+\s+\d+\s+obj", text) is not None


# -- Struktur-Validatoren (Kategorie 3) ---------------------------------
# Pruefen interne Merkmale eines Fundes und verwerfen Fehltreffer.

def _png_valid(data: bytes, size: int) -> bool:
    if len(data) < 33 or data[:8] != b"\x89PNG\r\n\x1a\n":
        return False
    length = int.from_bytes(data[8:12], "big")
    if data[12:16] != b"IHDR" or length != 13:
        return False
    body = data[12:16 + length]
    want = int.from_bytes(data[16 + length:20 + length], "big")
    return (zlib.crc32(body) & 0xFFFFFFFF) == want


def _jpeg_valid(data: bytes, size: int) -> bool:
    if len(data) < 6 or data[:3] != b"\xff\xd8\xff":
        return False
    return _jpeg_quick(data)


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
    # JPEG: der Marker-Struktur folgen (ueberspringt EXIF-Vorschaubilder,
    # erkennt abgeschnittene Dateien); nur bei gestoertem Kopf zaehlt die
    # Footer-Suche verschachtelte SOI/EOI.
    Signature("JPEG-Bild", "jpg",
              header=b"\xFF\xD8\xFF", footer=b"\xFF\xD9", max_size=30 * MB,
              quick_check=_jpeg_quick, validator=_jpeg_valid,
              end_finder=_jpeg_end, strict_end=True,
              nesting=(rb"\xFF\xD8\xFF", rb"\xFF\xD9")),
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
    # PDF: bei inkrementellen Updates gilt das letzte ``%%EOF``; das
    # abschliessende Zeilenende gehoert zur Datei.
    Signature("PDF-Dokument", "pdf",
              header=b"%PDF-", footer=b"%%EOF", max_size=100 * MB,
              footer_size=_pdf_eof_size, footer_continue=_pdf_continues),
    Signature("ZIP/Office-Dokument", "zip",
              header=b"PK\x03\x04", footer=b"PK\x05\x06", max_size=200 * MB,
              footer_size=_zip_eocd_size, footer_valid=_zip_eocd_valid,
              validator=_zip_valid),
    Signature("RAR-Archiv", "rar",
              header=b"Rar!\x1a\x07", max_size=500 * MB),
    Signature("7z-Archiv", "7z",
              header=b"7z\xbc\xaf\x27\x1c", max_size=2048 * MB,
              size_from_header=_sevenzip_size, trusted_size=True),
    # GZIP: nur echte Deflate-Stroeme; Ende exakt ueber das Entpacken.
    Signature("GZIP-Archiv", "gz",
              header=b"\x1f\x8b\x08", max_size=2048 * MB, quick_check=_gzip_quick,
              end_finder=_gzip_end, strict_end=True),
    Signature("SQLite-Datenbank", "sqlite",
              header=b"SQLite format 3\x00", max_size=2048 * MB,
              quick_check=_sqlite_quick, size_from_header=_sqlite_size,
              size_required=False),
    # Alte Office-Formate und weitere OLE-Dokumente (doc, xls, ppt, msg).
    Signature("OLE-Dokument (doc/xls/ppt)", "ole",
              header=b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1", max_size=200 * MB,
              validator=_ole_valid),
    # RTF: Klammergruppen zaehlen, das Ende ist die schliessende Klammer der
    # aeussersten Gruppe. Escape-Sequenzen (``\\{``, ``\\}``, ``\\\\``) zaehlen nicht.
    Signature("RTF-Dokument", "rtf",
              header=b"{\\rtf", footer=b"}", max_size=30 * MB,
              nesting=(rb"\{", rb"\}", rb"\\[\x00-\xff]")),
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
