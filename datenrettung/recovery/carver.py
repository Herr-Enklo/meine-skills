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


def _resolve_size(source, start: int, sig: Signature,
                  source_size: Optional[int]) -> Optional[int]:
    """Bestimmt die Groesse eines Kandidaten. ``None`` = kein plausibles Ende."""
    header_len = sig.header_offset + len(sig.header)

    if sig.size_from_header is not None:
        head = source.read(start, 64)
        declared = sig.size_from_header(head)
        if declared and header_len < declared <= sig.max_size:
            if source_size is not None:
                declared = min(declared, source_size - start)
            return declared if declared > header_len else None
        return None

    if sig.footer is not None:
        foot_start = _find_footer(source, start + header_len, sig.footer,
                                  sig.max_size, source_size)
        if foot_start < 0:
            return None
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
        return size if size > header_len else None

    # Weder Footer noch Groessenangabe: feste Obergrenze als bestmoegliche Schaetzung.
    size = sig.max_size
    if source_size is not None:
        size = min(size, source_size - start)
    return size if size > header_len else None


def carve(source, signatures: Optional[list[Signature]] = None,
          progress_cb: Optional[ProgressCb] = None,
          should_cancel: Optional[CancelCb] = None,
          max_files: Optional[int] = None) -> Iterator[Finding]:
    """Durchsucht ``source`` und liefert die gefundenen Dateien als ``Finding``.

    Es werden keine Daten im Speicher gehalten – jeder Fund traegt nur Position
    und Groesse; die eigentlichen Bytes werden erst beim Wiederherstellen gelesen.
    """
    signatures = signatures or SIGNATURES
    source_size = source.size

    candidates = find_headers(source, signatures, progress_cb, should_cancel)
    total = len(candidates)

    carved_until = 0           # Ende des letzten Funds mit bekanntem Ende
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

        size = _resolve_size(source, start, sig, source_size)
        if not size or size <= 0:
            continue

        index += 1
        # Nur footer-basierte Funde haben ein durch ein echtes Endmuster
        # belegtes Ende und duerfen darin liegende Treffer (z.B. eingebettete
        # Vorschaubilder) unterdruecken. Aus dem Header geratene Groessen
        # (BMP/WAV) koennen falsch und riesig sein und duerfen nachfolgende
        # echte Dateien nicht verschlucken.
        if sig.footer is not None:
            carved_until = start + size

        name = f"{index:06d}_0x{start:X}.{sig.ext}"
        yield Finding(
            kind="carve",
            type_name=sig.name,
            ext=sig.ext,
            name=name,
            offset=start,
            size=size,
        )
        produced += 1
        if max_files and produced >= max_files:
            break
