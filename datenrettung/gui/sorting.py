"""Sortier-Logik der Trefferliste.

Bewusst ohne tkinter, damit sie unabhaengig von der Oberflaeche getestet werden
kann. Sortiert wird nach den echten Fund-Daten, nicht nach dem angezeigten Text
– so ordnet die Spalte "Groesse" numerisch statt alphabetisch und "Herkunft"
nach der Position auf dem Datentraeger.
"""

from __future__ import annotations

# Reihenfolge der Zustaende von "sicher" bis "fraglich".
STATE_ORDER = {
    "gut": 0,
    "vollständig": 0,
    "vorhanden": 1,
    "zusammengesetzt": 2,
    "vorhanden (FAT-Kette beschädigt)": 3,
    "teilweise überschrieben": 4,
    "unvollständig": 4,
    "überschrieben": 5,
    "unbekannt": 6,
}


def state_of(finding) -> str:
    return finding.extra.get("state") or ""


def sort_key(finding, col: str):
    if col == "groesse":
        return finding.size
    if col == "typ":
        return finding.type_name.lower()
    if col == "name":
        return finding.path().lower()
    if col == "geaendert":
        return finding.extra.get("modified") or ""
    if col == "zustand":
        state = state_of(finding)
        return (STATE_ORDER.get(state, 9), state)
    if col == "quelle":
        return (finding.describe_source().split(" @")[0].lower(), finding.offset)
    return finding.describe_source().lower()


def order_indices(findings: list, col: str, reverse: bool) -> list[int]:
    """Alle Fund-Indizes, sortiert nach Spalte ``col`` (stabil)."""
    return sorted(range(len(findings)), key=lambda i: sort_key(findings[i], col),
                  reverse=reverse)


def order_iids(findings: list, iids, col: str, reverse: bool) -> list[str]:
    """Ordnet die Zeilen-IDs (Indizes in ``findings``) nach der Spalte ``col``.

    Nicht-numerische IDs (z.B. die Ueberlauf-Zeile) werden ausgelassen.
    """
    valid = [i for i in iids if i.isdigit() and int(i) < len(findings)]
    return sorted(valid, key=lambda i: sort_key(findings[int(i)], col),
                  reverse=reverse)
