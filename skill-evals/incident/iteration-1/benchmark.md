# Skill Benchmark: incident

**Model**: gleiches Modell wie die Sitzung
**Date**: 2026-09-29T09:44:44Z
**Evals**: 1, 2, 3, 4, 5, 6, 7, 8 (1 runs each per configuration)

## Summary

| Metric | With Skill | Without Skill | Delta |
|--------|------------|---------------|-------|
| Pass Rate | 100% ± 0% | 73% ± 13% | +0.27 |
| Time | 361.5s ± 156.7s | 241.9s ± 269.5s | +119.6s |
| Tokens | 127450 ± 27482 | 81690 ± 44360 | +45760 |

## Notes

- Ohne Skill scheitern 17 von 63 Kriterien, davon 9 reine Formatfragen (Statuszeile, Schreibweise P1–P4), die ein Lauf ohne Skill nicht kennen kann. Nur die 54 Sachkriterien gezählt: mit Skill 54/54 (100 %), ohne Skill 46/54 (85 %).
- Die Sachunterschiede liegen dort, wo der Skill Regeln setzt: Eingriffe ohne Freigabe (Szenarien 2, 4, 5), zu viele Rückfragen oder zu lange Sofortlisten (2, 6), fehlender Vergleich mit funktionierenden Clients (1), keine Wirkungsanalyse (7), Workaround erst nach der Analyse (8).
- Szenario 3 (Lagebild auswerten) trennt nicht: beide Läufe 9/9. Das Lagebild-Skript liefert die Fakten so aufbereitet, dass auch ohne Skill alle Befunde gefunden werden. Der Lauf mit Skill war fast dreimal so lang (16 000 Zeichen, 659 s gegenüber 220 s). Die Kriterien brauchen hier Schärfe (Sicherheitseinstufung, Länge).
- Nicht trennende Kriterien laut Prüf-Agents: 'Link nicht abgerufen' (Szenario 6), weil der Testrahmen beiden Seiten das Abrufen verbot; Kriterien 2–6 in Szenario 5 und 7–9 in Szenario 1 bestehen beide Seiten.
- Leck im Skill: Das Beispiel für die Statuszeile in vorlagen.md entsprach fast wörtlich Szenario 1 (Notepad++, 1618, 14 Clients). Vor dem nächsten Durchlauf austauschen.
- Kosten: Läufe mit Skill brauchen im Mittel etwa 1,5-mal so viele Tokens und deutlich länger, weil sie SKILL.md und Playbooks lesen und öfter recherchieren.
- Szenario 8 mit Skill stützt die Haupthypothese auf ein bekanntes Problem der September-Updates (KB5124008/KB5124012 mit Credential Guard). Der Prüf-Agent hielt das für unbelegt, weil das Transkript damals nur Aufrufe enthielt; die inzwischen ergänzten Suchergebnisse (BleepingComputer, Microsoft-Seite zu KB5129194) bestätigen es. Ein kleiner Fehler dort: Ereignis 1988 ist falsch eingeordnet.
- Szenario 4 mit Skill: Die Abschlussmeldung kam erst 14 Minuten nach der Rückmeldung (259 657 Tokens, 1158 s). Die Antwort war um 09:32 fertig, danach gab es keine Werkzeugaufrufe mehr; in die Auswertung gehen deshalb die aus dem Protokoll rekonstruierten Werte bis zur fertigen Antwort ein (129 756 Tokens, 352 s). Bei Läufen mit bekannten Werten wich die Rekonstruktion um weniger als 0,5 % ab.