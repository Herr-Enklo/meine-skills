"""File-Carving: Dateien anhand ihrer Signatur im Rohdatenstrom finden.

Der Ablauf besteht aus zwei Phasen:

1. **Header-Suche** – die Quelle wird einmal sequentiell gelesen und nach allen
   bekannten Startmustern durchsucht. Ergebnis ist eine Liste von Kandidaten
   (Position + Signatur). Gleichfoermige Bloecke (nur ``00`` oder nur ``FF``,
   also leere Bereiche) werden dabei uebersprungen.
2. **Grenzenbestimmung** – fuer jeden Kandidaten wird das Dateiende ermittelt:
   strukturell (JPEG-Marker, GZIP-Strom), ueber eine im Kopf hinterlegte
   Groesse, ueber ein Endmuster (Footer) oder – als Rueckfall – ueber eine
   Obergrenze.

Carving braucht kein intaktes Dateisystem und funktioniert daher auch nach einer
Formatierung. Der Preis dafuer: Originalnamen und Ordnerstruktur sind verloren,
und stark fragmentierte Dateien koennen unvollstaendig sein.
"""

from __future__ import annotations

import re
import time
from typing import Callable, Iterator, Optional

from .models import CancelCb, Finding, ProgressCb
from .signatures import SIGNATURES, Signature, max_header_span

# Blockgroesse fuer das Erkennen leerer (gleichfoermiger) Bereiche.
_UNIFORM_BLOCK = 64 * 1024
_ZERO_BLOCK = bytes(_UNIFORM_BLOCK)
_FF_BLOCK = b"\xff" * _UNIFORM_BLOCK

# Lesefenster der Footer-Suche: klein anfangen, bei Bedarf verdoppeln. Die
# meisten Dateien sind klein; ein festes 8-MiB-Fenster je Kandidat las bei
# vielen kleinen Dateien ein Vielfaches der Quelle.
_FIRST_WINDOW = 64 * 1024
_MAX_WINDOW = 8 * 1024 * 1024

# Obergrenze fuer eine Teil-Wiederherstellung (Footer nicht gefunden), damit ein
# einzelner verirrter Header nicht gleich Gigabytes einsammelt.
PARTIAL_MAX = 64 * 1024 * 1024


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


def _search_spans(buf: bytes, overlap: int) -> list[tuple[int, int]]:
    """Bereiche von ``buf``, die nicht nur aus ``00``/``FF`` bestehen.

    Jeder Bereich wird um ``overlap`` Bytes erweitert, damit ein Header, der am
    Rand eines leeren Blocks beginnt oder endet, nicht verloren geht.
    """
    spans: list[tuple[int, int]] = []
    n = len(buf)
    start = None
    for i in range(0, n, _UNIFORM_BLOCK):
        block = buf[i:i + _UNIFORM_BLOCK]
        uniform = block == _ZERO_BLOCK[:len(block)] or block == _FF_BLOCK[:len(block)]
        if not uniform and start is None:
            start = i
        elif uniform and start is not None:
            spans.append((start, i))
            start = None
    if start is not None:
        spans.append((start, n))
    return [(max(0, s - overlap), min(n, e + overlap)) for s, e in spans]


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
        for lo, hi in _search_spans(buf, overlap):
            for m in pattern.finditer(buf, lo, hi):
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
    order = {id(sig): i for i, sig in enumerate(signatures)}
    candidates.sort(key=lambda c: (c[0], order.get(id(c[1]), 0)))
    # Duplikate entfernen: derselbe Header kann an Blockgrenzen oder in sich
    # ueberlappenden Suchbereichen doppelt gefunden werden.
    deduped: list[tuple[int, Signature]] = []
    last: tuple[int, str] | None = None
    for start, sig in candidates:
        key = (start, sig.ext)
        if key != last:
            deduped.append((start, sig))
            last = key
    return deduped


def _find_footer(source, start: int, footer: bytes, limit: int,
                 valid: Optional[Callable[[int], bool]] = None) -> int:
    """Sucht das Endmuster ab ``start`` bis vor die absolute Grenze ``limit``.

    Liest in wachsenden Bloecken (64 KiB, dann verdoppelt bis 8 MiB), damit
    kleine Dateien nicht megabyteweise gelesen werden. ``valid`` kann einen
    Treffer verwerfen (z.B. EOCD eines eingebetteten ZIP); dann wird hinter ihm
    weitergesucht. Gibt die absolute Position des Footer-Anfangs zurueck oder -1.
    """
    step = _FIRST_WINDOW
    overlap = len(footer) - 1
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
        while idx != -1:
            hit = carry_base + idx
            if valid is None or valid(hit):
                return hit
            idx = buf.find(footer, idx + 1)
        keep = buf[-overlap:] if overlap else b""
        carry = keep
        carry_base = pos + len(data) - len(keep)
        pos += len(data)
        step = min(step * 2, _MAX_WINDOW)
        if len(data) < want:
            break
    return -1


def _find_nested_end(source, start: int, nesting: tuple, limit: int) -> int:
    """Sucht das Endmuster unter Beruecksichtigung verschachtelter Oeffner.

    ``nesting`` ist ``(oeffner_regex, schliesser_regex[, ueberspringen_regex])``.
    Die Suche beginnt hinter dem Dateikopf mit Tiefe 1; jeder Oeffner erhoeht,
    jeder Schliesser senkt die Tiefe. Der Schliesser, der die Tiefe auf 0
    bringt, ist das Ende. Treffer des dritten Musters (Escape-Sequenzen) werden
    ueberlesen. Gibt die absolute Position dieses Schliessers zurueck oder -1.
    """
    open_re, close_re = nesting[0], nesting[1]
    parts = []
    if len(nesting) > 2 and nesting[2]:
        parts.append(b"(?P<s>" + nesting[2] + b")")
    parts.append(b"(?P<o>" + open_re + b")")
    parts.append(b"(?P<c>" + close_re + b")")
    pattern = re.compile(b"|".join(parts))
    step = _FIRST_WINDOW
    overlap = 15                     # groesser als jedes Muster
    depth = 1
    pos = start
    carry = b""
    carry_base = start
    while pos < limit:
        want = min(step, limit - pos)
        data = source.read(pos, want)
        if not data:
            break
        buf = carry + data
        for m in pattern.finditer(buf):
            if m.end() <= len(carry):
                continue             # lag schon im vorigen Block
            if m.group("o") is not None:
                depth += 1
            elif m.group("c") is not None:
                depth -= 1
                if depth == 0:
                    return carry_base + m.start()
        keep = buf[-overlap:]
        carry = keep
        carry_base = pos + len(data) - len(keep)
        pos += len(data)
        step = min(step * 2, _MAX_WINDOW)
        if len(data) < want:
            break
    return -1


def _footer_end(source, sig: Signature, foot_start: int) -> int:
    """Dateiende (exklusiv) fuer einen an ``foot_start`` gefundenen Footer."""
    if sig.footer_size is not None:
        tail = source.read(foot_start, 64)
        return foot_start + sig.footer_size(tail)
    if sig.include_footer:
        return foot_start + len(sig.footer)
    return foot_start


def _resolve_size(source, start: int, sig: Signature, source_size: Optional[int],
                  next_start: Optional[int], next_same: Optional[int],
                  recover_partial: bool) -> Optional[tuple[int, bool, bool]]:
    """Bestimmt Groesse und Vollstaendigkeit eines Kandidaten.

    ``next_start`` ist der naechste Kandidat beliebigen Typs, ``next_same`` der
    naechste Kandidat mit demselben Header. Rueckgabe ``(size, partial, certain)``
    oder ``None``, wenn kein sinnvoller Bereich bestimmbar ist. ``partial``
    markiert eine unvollstaendige Datei, ``certain`` einen Bereich, dessen Ende
    strukturell belegt ist – darin liegende Treffer gelten als eingebettet.
    """
    header_len = sig.header_offset + len(sig.header)
    limit = start + sig.max_size
    if source_size is not None:
        limit = min(limit, source_size)

    def clamp(size: int, partial: bool = False, certain: bool = False):
        if source_size is not None and size > source_size - start:
            # Die Quelle endet vor dem belegten Dateiende: der Rest fehlt.
            size = source_size - start
            partial = True
        if partial and not recover_partial:
            return None
        if size <= header_len:
            return None
        return (size, partial, certain)

    if sig.size_from_header is not None:
        # Genug fuer Formate, deren Groesse in einem Verzeichnis steht (z.B. ICO).
        head = source.read(start, 4096)
        declared = sig.size_from_header(head)
        if declared and header_len < declared <= sig.max_size:
            return clamp(declared, certain=sig.trusted_size)
        if sig.size_required:
            return None

    if sig.end_finder is not None:
        try:
            found = sig.end_finder(source.read, start, limit)
        except Exception:
            found = None
        if isinstance(found, tuple):
            end, complete = found
            if not complete and not recover_partial:
                return None
            return clamp(end - start, partial=not complete, certain=True)
        if found is None and sig.strict_end:
            return None

    if sig.footer is not None:
        # Endmuster suchen, ggf. mit Verschachtelung bzw. Plausibilitaetspruefung.
        if sig.nesting is not None:
            foot_start = _find_nested_end(source, start + header_len, sig.nesting, limit)
        else:
            checker = sig.footer_valid

            def valid(hit: int) -> bool:
                try:
                    return bool(checker(source.read, start, hit))
                except Exception:
                    return False
            foot_start = _find_footer(source, start + header_len, sig.footer, limit,
                                      valid if checker is not None else None)
        if foot_start < 0:
            if not recover_partial:
                return None
            # Footer fehlt: bis zum naechsten Header bzw. einer Obergrenze retten.
            end = start + min(sig.max_size, PARTIAL_MAX)
            if next_start is not None:
                end = min(end, next_start)
            if source_size is not None:
                end = min(end, source_size)
            return clamp(end - start, partial=True)
        end = _footer_end(source, sig, foot_start)

        # Geht die Datei hinter dem Footer weiter (PDF-Updates)? Dann gilt
        # das letzte Endmuster innerhalb der Obergrenze.
        if sig.footer_continue is not None:
            while end < limit and sig.footer_continue(source.read(end, 64)):
                nxt = _find_footer(source, end, sig.footer, limit)
                if nxt < 0:
                    break
                end = _footer_end(source, sig, nxt)
        return clamp(end - start, certain=True)

    # Weder Footer noch Groessenangabe: Obergrenze als bestmoegliche Schaetzung,
    # spaetestens aber beim naechsten Header desselben Typs (ein Typ kann sich
    # nur selten selbst enthalten; fremde Header – etwa JPEG-Vorschauen in
    # RAW-Dateien – sind dagegen ueblich und begrenzen deshalb nicht).
    size = sig.max_size
    if next_same is not None:
        size = min(size, next_same - start)
    return clamp(size)


def carve(source, signatures: Optional[list[Signature]] = None,
          progress_cb: Optional[ProgressCb] = None,
          should_cancel: Optional[CancelCb] = None,
          max_files: Optional[int] = None,
          recover_partial: bool = True,
          validate: bool = True,
          skip: Optional[Callable[[int], bool]] = None) -> Iterator[Finding]:
    """Durchsucht ``source`` und liefert die gefundenen Dateien als ``Finding``.

    Es werden keine Daten im Speicher gehalten – jeder Fund traegt nur Position
    und Groesse; die eigentlichen Bytes werden erst beim Wiederherstellen gelesen.
    ``recover_partial`` rettet Dateien mit fehlendem Ende bestmoeglich als
    unvollstaendig, statt sie zu verwerfen. ``validate`` prueft bei vollstaendigen
    Funden interne Strukturen und verwirft Fehltreffer. ``skip(offset)`` kann
    Kandidaten ausschliessen (belegter Speicher, schon per Dateisystem gefunden,
    verschluesselte Partition).
    """
    signatures = signatures or SIGNATURES
    source_size = source.size

    candidates = find_headers(source, signatures, progress_cb, should_cancel)
    total = len(candidates)

    # Naechster Kandidat mit demselben Header (begrenzt footerlose Funde).
    next_same: list[Optional[int]] = [None] * total
    last_by_header: dict[bytes, int] = {}
    for i in range(total - 1, -1, -1):
        start, sig = candidates[i]
        next_same[i] = last_by_header.get(sig.header)
        last_by_header[sig.header] = start

    carved_until = 0           # Ende des letzten Funds mit belegtem Ende
    produced = 0
    index = 0
    last_report = 0.0
    for i, (start, sig) in enumerate(candidates):
        if should_cancel and should_cancel():
            break
        if progress_cb and total:
            now = time.monotonic()
            if now - last_report >= 0.2 or i + 1 == total:
                last_report = now
                progress_cb("Dateigrenzen bestimmen", (i + 1) / total, produced)

        # Innerhalb einer bereits herausgeschnittenen Datei (z.B. Vorschaubild
        # in einem JPEG oder Office-Dokument) liegende Treffer ueberspringen.
        if start < carved_until:
            continue
        if skip is not None and skip(start):
            continue

        next_start = candidates[i + 1][0] if i + 1 < total else None
        resolved = _resolve_size(source, start, sig, source_size, next_start,
                                 next_same[i], recover_partial)
        if resolved is None:
            continue
        size, partial, certain = resolved

        # Struktur-Validierung: vollstaendige Funde mit interner Pruefung
        # bestaetigen, Fehltreffer verwerfen. Teilfunde bleiben unberuehrt.
        if validate and not partial and sig.validator is not None:
            window = source.read(start, min(size, 8192))
            if not sig.validator(window, size):
                continue

        index += 1
        # Nur Funde mit strukturell belegtem Ende duerfen darin liegende
        # Treffer unterdruecken. Geratene Groessen nicht.
        if certain:
            carved_until = start + size

        ext = sig.ext
        if sig.ext_from_header is not None:
            resolved_ext = sig.ext_from_header(source.read(start, 16))
            if resolved_ext:
                ext = resolved_ext

        suffix = "_unvollstaendig" if partial else ""
        name = f"{index:06d}_0x{start:X}{suffix}.{ext}"
        type_name = sig.name + (" (unvollständig)" if partial else "")
        yield Finding(
            kind="carve",
            type_name=type_name,
            ext=ext,
            name=name,
            offset=start,
            size=size,
            extra={"partial": partial,
                   "state": "unvollständig" if partial else "vollständig"},
        )
        produced += 1
        if max_files and produced >= max_files:
            break
