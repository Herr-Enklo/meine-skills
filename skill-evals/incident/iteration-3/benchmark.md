# Skill Benchmark: incident

**Model**: gleiches Modell wie die Sitzung
**Date**: 2026-09-29T11:08:51Z
**Evals**: 1, 2, 3, 4, 5, 6, 7, 8 (1 runs each per configuration)

## Summary

| Metric | With Skill | Without Skill | Delta |
|--------|------------|---------------|-------|
| Pass Rate | 100% ± 0% | 72% ± 14% | +0.28 |
| Time | 371.9s ± 142.4s | 138.4s ± 51.5s | +233.5s |
| Tokens | 133254 ± 23751 | 65091 ± 7813 | +68163 |

## Notes

- Mit Skill 66 von 66 Kriterien (100 %), ohne Skill 48 von 66 (73 %). Nur die 57 Sachkriterien gezählt: 57/57 gegenüber 48/57. Im zweiten Durchlauf stand es 61/66, in der Sache 52/57.
- Alle fünf Fehler aus dem zweiten Durchlauf sind weg: höchstens drei Rückfragen (Szenario 2), Treiber nur als Klassen ohne unterstelltes Dock (5), kein Screenshot vor dem Ablehnen der Anmeldeanfrage (6), Warnung vor dem eingefrorenen Messwert (7), Workaround vor der Diagnose (8). Jede Änderung nach dem zweiten Durchlauf hat damit im nächsten Lauf gegriffen. Bei einem Lauf je Szenario ist das ein Hinweis, kein Beweis.
- Die Antworten bleiben kurz: ohne Codeblöcke im Mittel 4 441 Zeichen (erster Durchlauf 6 870, zweiter 4 554), die längste 4 985. In Szenario 3 stehen rund 700 Zeichen einer Meldung an die IT-Sicherheit als Textblock zum Kopieren und zählen deshalb nicht mit. Das ist als Vorlage gewollt, macht die Messung aber etwas günstiger.
- Die Läufe ohne Skill wurden weder neu gefahren noch neu bewertet: Nachricht, Testrahmen und Kriterien sind seit dem zweiten Durchlauf gleich. Bewertet wurden nur die Läufe mit Skill. Die Strenge der Prüf-Agents kann leicht abweichen, im zweiten Durchlauf streute die Bewertung derselben Antwort um ein Kriterium.
- Der Katalog ist für den Skill damit ausgereizt: Bei 66 von 66 zeigt er keine weiteren Verbesserungen mehr an. Für die nächsten Schritte braucht es schwerere Szenarien (etwa Rückfragen über mehrere Runden, widersprüchliche Angaben, echte Protokolle) oder drei Läufe je Szenario, um Streuung zu sehen.
- Von den Kriterien nicht erfasst: Szenario 8 nennt diesmal den bekannten Fehler des September-Updates KB5124008 nicht (3 statt 5 Suchen), den der zweite Durchlauf als Hypothese hatte. Der Skill verlangt inzwischen, nach einem Patchday und bei Anmeldefehlern die bekannten Probleme in Windows Release Health zu prüfen. Außerdem beschreibt die Antwort die Wiederherstellung nach einem USN-Rollback unvollständig; Microsoft nennt neben Herabstufen und Neuaufbau auch das Zurückspielen einer gültigen Systemstatus-Sicherung.
- Kleinere Ungenauigkeiten laut Prüf-Agents: Szenario 1 schreibt 'Das Paket selbst funktioniert' und widerspricht damit der eigenen Hypothese, dass das Paket sich selbst blockiert. Szenario 4 erklärt nicht, dass Mitgliedschaft in der Gruppe Administratoren bei aktiver Benutzerkontensteuerung allein kein Schreibrecht gibt. Szenario 7 empfiehlt den Verlauf der Signalstärke, die bei Shelly-Geräten standardmäßig abgeschaltet ist (steht jetzt im Playbook).
- Die neue Regel gegen Innensicht widersprach der älteren Anweisung, ein fehlendes Journal in einem Halbsatz zu erwähnen. Szenario 8 hat die neue Regel befolgt, der Widerspruch ist nach dem Durchlauf im Skill aufgelöst.
- Kosten: mit Skill im Mittel 133 254 Tokens und 372 s, etwas mehr als in den ersten beiden Durchläufen (127 450 und 128 851 Tokens). Die Läufe machen im Mittel 21 Werkzeugaufrufe.