# Skill Benchmark: incident

**Model**: gleiches Modell wie die Sitzung
**Date**: 2026-09-29T10:20:29Z
**Evals**: 1, 2, 3, 4, 5, 6, 7, 8 (1 runs each per configuration)

## Summary

| Metric | With Skill | Without Skill | Delta |
|--------|------------|---------------|-------|
| Pass Rate | 92% ± 7% | 72% ± 14% | +0.20 |
| Time | 362.2s ± 157.5s | 138.4s ± 51.5s | +223.8s |
| Tokens | 128851 ± 29218 | 65091 ± 7813 | +63760 |

## Notes

- Mit Skill 61 von 66 Kriterien (92 %), ohne Skill 48 von 66 (73 %). Von den 18 Fehlern ohne Skill sind 9 Formatfragen (Statuszeile, P-Stufe, Bereich Sicherheit im Statuskopf). Nur die 57 Sachkriterien gezählt: mit Skill 52/57 (91 %), ohne Skill 48/57 (84 %). Im ersten Durchlauf waren es 54/54 gegenüber 46/54.
- Die Längenregel wirkt. Ohne Codeblöcke haben die Antworten mit Skill im Mittel 4 554 Zeichen statt 6 870, die längste 5 055 statt 10 432. Szenario 3 schrumpft von 10 432 auf 4 795 Zeichen, die Antwort ohne Skill hat dort 9 040.
- Drei der fünf Fehler mit Skill hatte der erste Durchlauf bestanden: höchstens drei Rückfragen (Szenario 2, mehrere Fragen in einem Punkt und ein Angebot als Frage), Warnung vor dem eingefrorenen letzten Wert (7) und Workaround vor der Diagnose (8, steht jetzt als Schritt 5 hinter den Diagnoseblöcken). Die Regeln stehen im Skill, gingen beim Kürzen aber verloren oder rutschten nach hinten. Bei einem Lauf je Szenario kann das auch Streuung sein.
- Szenario 6 mit Skill folgt dem Playbook, das vor dem Ablehnen einen Screenshot der Anmeldeanfrage verlangt. Das Kriterium wertet das als Beweissicherung vor der Eindämmung, und das Playbook ist hier zu ändern. Szenario 5 mit Skill nennt als erste Hypothese einen Realtek-Treiber im Dell-Dock, obwohl der Nutzer das Dock nicht genannt hat; das neue, schärfere Kriterium fängt genau das.
- Szenario 3 trennt jetzt (11/11 gegenüber 9/11). Der Prüf-Agent merkt an, dass die Antwort ohne Skill den Defender-Fund inhaltlich als Sicherheitsvorfall behandelt; das Kriterium zur Sicherheitseinstufung misst deshalb eher das Format.
- Szenario 6 lief mit neuem Testrahmen (Recherche erlaubt, der Link aus der Nachricht nicht). Beide Seiten 7/8, der Abruf-Test trennt weiter nicht, weil keiner der Läufe den Link aufrief.
- Sieben der acht Läufe ohne Skill sind unverändert aus dem ersten Durchlauf übernommen und gegen die neuen Kriterien frisch bewertet. Szenario 2 hat dieselbe Antwort und dieselben Kriterien, bekam aber 6/9 statt 5/9 (Priorität 'hoch' diesmal als P1/P2 gewertet). Die Bewertung streut also um etwa ein Kriterium.
- Die Läufe haben zwei Sachfehler im Skill gefunden. Google widerruft App-Passwörter beim Passwortwechsel, das Playbook zählte sie zu den Hintertüren, die offen bleiben. Und zur Aussage über Gmail-Tokens fehlte die Quelle (inzwischen nachgetragen: Googles OAuth-2.0-Doku).
- Kosten: mit Skill im Mittel 128 851 Tokens und 362 s, fast wie im ersten Durchlauf. Kürzere Antworten sparen nichts, weil die Läufe mehr recherchieren (im Mittel 20 statt 16 Werkzeugaufrufe). Ohne Skill sinkt die mittlere Zeit auf 138 s, weil der neue Lauf zu Szenario 6 nur 72 s statt 900 s brauchte.
- Das Transkript kürzt Werkzeugergebnisse auf 700 Zeichen. Der Prüf-Agent zu Szenario 8 hielt deshalb Einzelheiten zu KB5124008 für unbelegt. Im vollständigen Protokoll stehen sie (Credential Guard, 24H2/25H2, Funktionsebene Windows Server 2025, MachineIdentityIsolation = 2). Das Out-of-band-Update KB5129195 aus den Suchergebnissen erwähnt die Antwort nicht.