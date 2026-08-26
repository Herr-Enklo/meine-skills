"""File-Carving: Dateien anhand ihrer Signatur im Rohdatenstrom finden.

Der Ablauf besteht aus zwei Phasen:

1. **Header-Suche** – die Quelle wird einmal sequentiell gelesen und nach allen
   bekannten Startmustern durchsucht. Ergebnis ist eine Liste von Kandidaten
   (Position + Signatur).
2. **Grenzenbestimmung** – fuer jeden Kandidaten wird das Dateiende ermittelt:
   ueber ein Endmuster (Footer), eine im Kopf hinterlegte Groesse, oder – als
   Rueckfall – ueber eine feste Obergrenze.

Carving braucht kein intaktes Dateisystem und funktioniert daher auch nach einer
Formatierung. Der Preis dafuer: Originalnamen und Ordnerstruktur sind verloren,
und stark fragmentierte Dateien koennen unvollstaendig sein.
"""

from __future__ import annotations

import re
from typing import Callable, Iterator, Optional

from .models import Finding
from .signatures import SIGNATURES, Signature, max_header_span

ProgressCb = Callable[[str, float, int], None]
CancelCb = Callable[[], bool]


def _build_pattern(signatures: list[Signature]):
    """Erzeugt ein kombiniertes Regex ueber alle Header und eine Zuordnung
    von Header-Bytes zur passenden Signatur."""
    header_to_sig: dict[bytes, Signature] = {}
    for sig in signatures:
        # Bei identischem Header gewinnt die erste Signatur.
        header_to_sig.setdefault(sig.header, sig)
    # Laengere Muster zuerst, damit bei Ueberschneidungen das speziellere passt.
    headers = sorted(header_to_sig, key=len, reverse=True)
    pattern = re.compile(b"|".join(re.escape(h) for h in headers))
    return pattern, header_to_sig


def find_headers(source, signatures, progress_cb, should_cancel):
    """Phase 1: sammelt alle ``(start, signatur)``-Kandidaten."""
    pattern, header_to_sig = _build_pattern(signatures)
    overlap = max(0, max_header_span() - 1)
    candidates: list[tuple[int, Signature]] = []
    total = source.size or 0

    carry = b""
    carry_base = 0
    for offset, data in source.stream(chunk_size=8 * 1024 * 1024):
        if should_cancel and should_cancel():
            break
        buf = carry + data
        buf_base = carry_base if carry else offset
        for m in pattern.finditer(buf):
            sig = header_to_sig.get(m.group())
            if sig is None:
                continue
            file_rel = m.start() - sig.header_offset
            if file_rel < 0:
                continue
            # Guenstiger Vorabtest, um Fehltreffer kurzer Header frueh zu verwerfen.
            if sig.quick_check is not None:
                if not sig.quick_check(buf[file_rel:file_rel + 64]):
                    continue
            candidates.append((buf_base + file_rel, sig))
        keep = buf[-overlap:] if overlap else b""
        carry = keep
        carry_base = (offset + len(data)) - len(keep)
        if progress_cb and total:
            frac = min(1.0, (offset + len(data)) / total)
            progress_cb("Signaturen suchen", frac, len(candidates))

    # Nach Startposition sortieren; bei gleichem Start die frueher gelistete
    # (spezialisiertere) Signatur bevorzugen.
    candidates.sort(key=lambda c: c[0])
    # Duplikate entfernen: derselbe Header kann an Blockgrenzen doppelt
    # gefunden werden (Ueberlappungsbereich).
    deduped: list[tuple[int, Signature]] = []
    last: tuple[int, str] | None = None
    for start, sig in candidates:
        key = (start, sig.ext)
        if key != last:
            deduped.append((start, sig))
            last = key
    return deduped


def _find_footer(source, start: int, footer: bytes, max_size: int,
                 source_size: Optional[int]) -> int:
    """Sucht das Endmuster ab ``start`` innerhalb von ``max_size`` Bytes.

    Liest in Teilbloecken, damit auch grosse Suchfenster wenig Speicher
    brauchen. Gibt die absolute Position des Footer-Anfangs zurueck oder -1.
    """
    step = 8 * 1024 * 1024
    overlap = len(footer) - 1
    limit = start + max_size
    if source_size is not None:
        limit = min(limit, source_size)
    pos = start
    carry = b""
    carry_base = start
    while pos < limit:
        want = min(step, limit - pos)
        data = source.read(pos, want)
        if not data:
            break
        buf = carry + data
        idx = buf.find(footer)
        if idx != -1:
            return carry_base + idx
        keep = buf[-overlap:] if overlap else b""
        carry = keep
        carry_base = pos + len(data) - len(keep)
        pos += len(data)
        if len(data) < want:
            break
    return -1


# Obergrenze fuer eine Teil-Wiederherstellung (Footer nicht gefunden), damit ein
# einzelner verirrter Header nicht gleich Gigabytes einsammelt.
PARTIAL_MAX = 64 * 1024 * 1024


def _resolve_size(source, start: int, sig: Signature, source_size: Optional[int],
                  next_start: Optional[int],
                  recover_partial: bool) -> Optional[tuple[int, bool]]:
    """Bestimmt Groesse und Vollstaendigkeit eines Kandidaten.

    Rueckgabe ``(size, partial)`` oder ``None``, wenn kein sinnvoller Bereich
    bestimmbar ist. ``partial`` markiert eine unvollstaendige Datei (Footer nicht
    gefunden), die dennoch bestmoeglich herausgeschnitten wird.
    """
    header_len = sig.header_offset + len(sig.header)

    if sig.size_from_header is not None:
        # Genug fuer Formate, deren Groesse in einem Verzeichnis steht (z.B. ICO).
        head = source.read(start, 4096)
        declared = sig.size_from_header(head)
        if declared and header_len < declared <= sig.max_size:
            if source_size is not None:
                declared = min(declared, source_size - start)
            return (declared, False) if declared > header_len else None
        return None

    if sig.footer is not None:
        foot_start = _find_footer(source, start + header_len, sig.footer,
                                  sig.max_size, source_size)
        if foot_start < 0:
            if not recover_partial:
                return None
            # Footer fehlt: bis zum naechsten Header bzw. einer Obergrenze retten.
            end = start + min(sig.max_size, PARTIAL_MAX)
            if next_start is not None:
                end = min(end, next_start)
            if source_size is not None:
                end = min(end, source_size)
            size = end - start
            return (size, True) if size > header_len else None
        if sig.footer_size is not None:
            tail = source.read(foot_start, 64)
            end = foot_start + sig.footer_size(tail)
        elif sig.include_footer:
            end = foot_start + len(sig.footer)
        else:
            end = foot_start
        size = end - start
        if source_size is not None:
            size = min(size, source_size - start)
        return (size, False) if size > header_len else None

    # Weder Footer noch Groessenangabe: feste Obergrenze als bestmoegliche Schaetzung.
    size = sig.max_size
    if source_size is not None:
        size = min(size, source_size - start)
    return (size, False) if size > header_len else None


def carve(source, signatures: Optional[list[Signature]] = None,
          progress_cb: Optional[ProgressCb] = None,
          should_cancel: Optional[CancelCb] = None,
          max_files: Optional[int] = None,
          recover_partial: bool = True) -> Iterator[Finding]:
    """Durchsucht ``source`` und liefert die gefundenen Dateien als ``Finding``.

    Es werden keine Daten im Speicher gehalten – jeder Fund traegt nur Position
    und Groesse; die eigentlichen Bytes werden erst beim Wiederherstellen gelesen.
    ``recover_partial`` rettet Dateien mit fehlendem Endmuster bestmoeglich als
    unvollstaendig, statt sie zu verwerfen.
    """
    signatures = signatures or SIGNATURES
    source_size = source.size

    candidates = find_headers(source, signatures, progress_cb, should_cancel)
    total = len(candidates)

    carved_until = 0           # Ende des letzten Funds mit belegtem Ende
    produced = 0
    index = 0
    for i, (start, sig) in enumerate(candidates):
        if should_cancel and should_cancel():
            break
        if progress_cb and total:
            progress_cb("Dateigrenzen bestimmen", (i + 1) / total, produced)

        # Innerhalb einer bereits herausgeschnittenen Datei (z.B. Vorschaubild
        # in einem Office-Dokument) liegende Treffer ueberspringen.
        if start < carved_until:
            continue

        next_start = candidates[i + 1][0] if i + 1 < total else None
        resolved = _resolve_size(source, start, sig, source_size, next_start,
                                 recover_partial)
        if resolved is None:
            continue
        size, partial = resolved
        if size <= 0:
            continue

        index += 1
        # Nur vollstaendige, footer-basierte Funde duerfen darin liegende
        # Treffer unterdruecken. Geratene Groessen und Teilfunde nicht.
        if sig.footer is not None and not partial:
            carved_until = start + size

        ext = sig.ext
        if sig.ext_from_header is not None:
            resolved_ext = sig.ext_from_header(source.read(start, 16))
            if resolved_ext:
                ext = resolved_ext

        suffix = "_unvollstaendig" if partial else ""
        name = f"{index:06d}_0x{start:X}{suffix}.{ext}"
        type_name = sig.name + (" (unvollstaendig)" if partial else "")
        yield Finding(
            kind="carve",
            type_name=type_name,
            ext=ext,
            name=name,
            offset=start,
            size=size,
            extra={"partial": partial},
        )
        produced += 1
        if max_files and produced >= max_files:
            break
