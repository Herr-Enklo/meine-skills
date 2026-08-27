"""Sortier-Logik der Trefferliste.

Bewusst ohne tkinter, damit sie unabhaengig von der Oberflaeche getestet werden
kann. Sortiert wird nach den echten Fund-Daten, nicht nach dem angezeigten Text
– so ordnet die Spalte "Groesse" numerisch statt alphabetisch.
"""

from __future__ import annotations


def sort_key(finding, col: str):
    if col == "groesse":
        return finding.size
    if col == "typ":
        return finding.type_name.lower()
    if col == "name":
        return finding.name.lower()
    if col == "geaendert":
        return finding.extra.get("modified") or ""
    return finding.describe_source().lower()


def order_iids(findings: list, iids, col: str, reverse: bool) -> list[str]:
    """Ordnet die Zeilen-IDs (Indizes in ``findings``) nach der Spalte ``col``.

    Nicht-numerische IDs (z.B. die Ueberlauf-Zeile) werden ausgelassen.
    """
    valid = [i for i in iids if i.isdigit() and int(i) < len(findings)]
    return sorted(valid, key=lambda i: sort_key(findings[int(i)], col),
                  reverse=reverse)
