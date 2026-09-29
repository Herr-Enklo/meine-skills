# Vorlagen

Platzhalter in spitzen Klammern werden ersetzt. Was nicht bekannt ist, bleibt als "unbekannt" stehen, nicht erfunden.

## Statuskopf

Steht über jeder Antwort zu einem Incident, eine Zeile:

```
<ID> | <P1–P4> | <Bereich> | <Status> | <Kurztitel>
```

Bereich ist einer von: Windows-Software, Windows-System, Netzwerk, Smart Home, Dienste und Code, Sicherheit, Sonstiges.

Status ist einer von: aufgenommen, in Diagnose, Workaround aktiv, in Lösung, Prüfung, gelöst, eskaliert, wartet auf Nutzer. Liegt der nächste Schritt beim Nutzer (Befehl ausführen, Freigabe, Handgriff vor Ort), gilt "wartet auf Nutzer".

Beispiel: `INC-20260312-0815 | P2 | Netzwerk | in Diagnose | VPN-Einwahl am Standort Nord scheitert`

Entstehen aus einer Nachricht zwei unabhängige Incidents, bekommt der zweite die Endung `-2` (`INC-20260312-0815-2`).

## Tickettext

Zum Kopieren in ein Ticketsystem. Knapp, sachlich, ohne Chat-Ton.

```
Titel: <Symptom in einem Satz, ohne Vermutung>
Priorität: <P1–P4> (Auswirkung <hoch|mittel|niedrig>, Dringlichkeit <hoch|mittel|niedrig>)
Kategorie: <Bereich / Unterbereich>
Bezug: <Change, Rollout, Paket und Version, falls vorhanden>
Betroffen: <System, Nutzer oder Gruppe, Anzahl; lange Gerätelisten als Anhang>
Beginn: <Datum Uhrzeit oder "unbekannt">   Erkannt: <...>   Behoben: <...>

Symptom:
<Was der Nutzer sieht, Fehlermeldung wörtlich>

Ursache:
<bestätigt | vermutet>: <Ursache>. Beleg: <Logzeile, Zustand, Messwert>
(Bei mehreren Befundgruppen je Gruppe eine Zeile.)

Maßnahmen:
- <Uhrzeit> <Was getan wurde, von wem, mit welchem Ergebnis>

Workaround:
<falls vorhanden, sonst "keiner">

Lösung:
<Was dauerhaft geändert wurde>

Prüfung:
<Wie belegt ist, dass es wieder geht>

Offen / Folgeaufgaben:
- <Problem-Ticket, Überwachung, Update ...>
```

Kurzfassung als Lösungsnotiz, wenn das Ticketsystem nur ein Feld hat: drei bis fünf Sätze mit Ursache, Lösung und Prüfung.

## Nutzerinfo

Für Betroffene, ohne Fachjargon. Als Mailentwurf nur auf Wunsch.

```
Betreff: <Dienst> – <gestört | eingeschränkt | wieder verfügbar>

Was ist los: <ein Satz aus Sicht der Betroffenen>
Was wir tun: <ein Satz>
Was Sie tun können: <Workaround oder "nichts, wir melden uns">
Nächste Information: <Uhrzeit oder Ereignis>
```

## Übergabe an zweiten Level, Hersteller oder Anbieter

```
Incident: <ID>, Priorität <P>
Symptom: <wörtlich>
Umgebung: <System, Version, Build, Standort>
Seit: <Zeit>, Änderungen davor: <...>
Reproduzierbar: <ja/nein, Schritte>
Bereits geprüft: <Liste mit Ergebnis>
Belege im Anhang: <Logs, Screenshots, Fehlercodes>
Wir brauchen: <konkrete Frage oder Aktion>
Erreichbarkeit: <wer, wie>
```

## Nachbetrachtung

Bei P1, P2, wiederkehrenden Störungen und auf Wunsch. Ohne Schuldzuweisung an Personen: gefragt wird, was dem System gefehlt hat.

```
# Nachbetrachtung <ID>: <Titel>

Zusammenfassung: <drei Sätze: was, wie lange, wie behoben>
Auswirkung: <wer, wie viele, wie lange, Folgen>

Zeitleiste:
| Zeit | Ereignis |
|---|---|

Ursache: <technische Ursache>
Warum konnte das passieren (fünfmal fragen):
1. ...
Beitragende Faktoren: <fehlende Überwachung, fehlender Test, unklare Zuständigkeit ...>

Was gut lief: ...
Was schlecht lief: ...

Maßnahmen:
| Maßnahme | Art (verhindern, früher erkennen, schneller beheben) | Zuständig | Termin |
|---|---|---|---|
```

## Wissensartikel

Aus einer gelösten Störung, die wiederkommen kann.

```
Titel: <Symptom, wie ein Nutzer es beschreiben würde>
Gilt für: <System, Versionen>
Symptom: ...
Ursache: ...
Workaround: ...
Lösung: <Schritte, Befehle>
Prüfung: ...
Quelle: <Incident-ID, Doku-Links>
```

## Journal

Ablage unter `~/.claude/agent-memory/incident-manager/`. Den Ordner bei Bedarf anlegen.

- `MEMORY.md`: kurzer Index, höchstens 200 Zeilen. Oben Umgebungswissen, das bei künftigen Incidents hilft, damit dieselbe Frage nur einmal gestellt wird: Systeme und Versionen, Anbieter, Softwareverteilung (Konsole, Protokollpfade des Agenten, Rollout-Fenster), Ablageort der Diagnoseskripte auf Firmenrechnern, Zuständige (IT-Sicherheit, Datenschutz, zweiter Level), Prioritätsregeln des Arbeitgebers. Darunter bekannte Fehler als je eine Zeile `Symptom → Ursache → Lösung (INC-ID)`, darunter die letzten Incidents als je eine Zeile `INC-ID | P | Bereich | Status | Titel`.
- `incidents/<ID>.md`: der Tickettext, ergänzt um die wichtigsten Belege.

Regeln: keine Passwörter, Schlüssel oder Tokens, keine Kamerabilder, Personendaten nur so weit nötig. Veraltetes Umgebungswissen korrigieren statt ergänzen. In einer Web-Session ist dieser Ordner flüchtig; dort das Journal nur fortschreiben, wenn der Nutzer einen dauerhaften Ort nennt (zum Beispiel ein privates Repository), sonst den Tickettext im Chat ausgeben.
