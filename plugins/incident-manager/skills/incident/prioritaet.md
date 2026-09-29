# Priorität

Die Priorität ergibt sich aus Auswirkung und Dringlichkeit, wie im ITIL-Incident-Management üblich. Gibt es beim Nutzer oder seinem Arbeitgeber eigene Prioritätsregeln oder SLAs, gelten die. Stehen sie nicht im Gedächtnis, nicht eigens danach fragen: mit der Matrix unten einstufen, das als Annahme markieren und die Regeln ins Gedächtnis aufnehmen, sobald der Nutzer sie nennt.

## Auswirkung

| Stufe | Beruflich | Zuhause |
|---|---|---|
| hoch | ganzer Dienst oder Standort, viele Nutzer, geschäftskritische Anwendung, Sicherheit oder Datenverlust | Übernahme eines Hauptkontos (Google, Apple, Microsoft, Mail), Online-Banking, Passwortmanager; Einbruchmeldung, Kameras, Schlösser; Heizung im Winter, Wasser oder Strom; Internet bei Homeoffice-Pflicht |
| mittel | eine Abteilung oder Gruppe, eine wichtige Funktion, ein Nutzer mit kritischer Rolle | eine Komfortfunktion für alle Bewohner, Energiedaten, Rollos, Kameras ohne Sicherheitsbezug |
| niedrig | ein einzelner Nutzer, Workaround vorhanden | ein einzelnes Gerät, eine Anzeige, ein Dashboard |

Maßgeblich ist, wie stark die Arbeit beeinträchtigt ist, nicht nur die Zahl der Betroffenen. Scheitert ein Rollout auf 14 von 230 Rechnern und läuft dort die alte Version weiter, ist die Auswirkung mittel. Fehlt das Programm danach ganz und wird es gebraucht, ist sie hoch.

## Dringlichkeit

| Stufe | Bedeutung |
|---|---|
| hoch | Schaden wächst schnell, Arbeit steht still, feste Frist in Stunden, Angreifer möglicherweise noch aktiv |
| mittel | Arbeit eingeschränkt, aber möglich; Frist in Tagen |
| niedrig | kann ohne Nachteil warten |

## Matrix

| Auswirkung \ Dringlichkeit | hoch | mittel | niedrig |
|---|---|---|---|
| hoch | P1 | P2 | P3 |
| mittel | P2 | P3 | P4 |
| niedrig | P3 | P4 | P4 |

## Was die Priorität bedeutet

Die Zeiten sind Richtwerte für die eigene Arbeit, keine Zusagen.

| Priorität | Reaktion | Statusmeldungen | Vorgehen |
|---|---|---|---|
| P1 | sofort | nach jedem wesentlichen Schritt | Sofortmaßnahme vor Rückfragen, Hypothesen parallel mit Subagents, Nachbetrachtung Pflicht, Abschluss erst nach Prüfung durch `testing-reality-checker`. Ist nur eine Person privat betroffen und kann nur sie selbst handeln: keine Subagents vor der Sofortmaßnahme, Nachbetrachtung als Kurzform, Abschlussprüfung nur, wenn es etwas zu prüfen gibt |
| P2 | innerhalb einer Stunde | bei jedem neuen Befund | parallele Diagnose, wenn mehrere Spuren offen sind, Nachbetrachtung Pflicht |
| P3 | am selben Tag | am Ende | der Reihe nach, Workaround reicht zunächst |
| P4 | planbar | am Ende | kann in eine Aufgabe oder ein Change überführt werden |

## Hochstufen

Eine Stufe höher, sobald eines davon eintritt:

- Der Kreis der Betroffenen wächst deutlich, oder ein zweiter Dienst fällt aus.
- Verdacht auf Sicherheitsvorfall oder Datenverlust. Das ist mindestens P2, bei aktivem Angreifer oder abfließenden Daten P1.
- Keine Ursache nach angemessener Zeit bei P1 oder P2.
- Eine Frist rückt näher, etwa ein Termin, eine Abgabe oder eine Meldepflicht.

## Major Incident

P1 mit breiter Wirkung (Standort, zentraler Dienst, Sicherheitsvorfall mit Außenwirkung) ist ein Major Incident. Dann zusätzlich: feste Rollen klären (wer entscheidet, wer kommuniziert, wer arbeitet technisch), Zeitleiste von Anfang an mitschreiben, Kommunikation an Betroffene und Verantwortliche nach der Vorlage in `vorlagen.md`, und den Agent `engineering-incident-response-commander` für Koordination und Nachbetrachtung hinzuziehen.
