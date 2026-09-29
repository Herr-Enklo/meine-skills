# Playbook: Sicherheit

Dieses Playbook hat Vorrang vor allen anderen. Es gilt, sobald einer dieser Fälle vorliegt oder vermutet wird:

- Link in einer verdächtigen Mail geklickt, Zugangsdaten eingegeben oder Anhang geöffnet
- MFA-Anfragen, die der Nutzer nicht ausgelöst hat
- Warnung über unbekannte Anmeldung, geänderte Wiederherstellungsdaten, neue Weiterleitungsregeln
- Virenscanner schlägt an (ein Testmuster wie EICAR ist kein Vorfall, wird aber gemeldet), fremde Prozesse, verschlüsselte Dateien, Erpressernachricht
- Passwort, Token oder API-Schlüssel in einem Repository, Chat, Ticket oder Log gelandet
- Gerät verloren oder gestohlen
- Daten an falsche Empfänger gegangen
- Unbekanntes Gerät im Netz

Priorität mindestens P2. P1, wenn ein Angreifer vermutlich noch aktiv ist, Daten abfließen oder Schadsoftware sich ausbreiten kann.

## Reihenfolge

1. Eindämmen: den Schaden stoppen, ohne Spuren zu vernichten.
2. Beweise sichern: Zeitleiste, Screenshots, Original der Mail, Hashes verdächtiger Dateien, Anmeldeprotokolle.
3. Beseitigen: Zugänge ändern, Schadsoftware entfernen, Lücke schließen.
4. Wiederherstellen: Betrieb aus sauberem Zustand, verstärkt überwachen.
5. Nachbereiten: Nachbetrachtung, Meldungen, Maßnahmen.

Bei einer Kontoübernahme ist der Passwortwechsel Eindämmung, nicht Beseitigung, und kommt vor der Beweissicherung. Vorher nur sichern, was Sekunden dauert (Screenshot der Anmeldeanfrage). Fremde Regeln und Geräte erst per Screenshot festhalten, dann entfernen.

Im beruflichen Umfeld als allererstes die IT-Sicherheit des Arbeitgebers informieren (lassen). Sie entscheidet über Eindämmung, Forensik und Meldungen. Bei einer Verletzung des Schutzes personenbezogener Daten muss der Verantwortliche sie unverzüglich und möglichst binnen 72 Stunden, nachdem sie ihm bekannt wurde, der Aufsichtsbehörde melden, es sei denn, sie führt voraussichtlich nicht zu einem Risiko für die Betroffenen (Art. 33 DSGVO). Bei hohem Risiko sind auch die Betroffenen zu benachrichtigen (Art. 34), und jede Verletzung ist intern zu dokumentieren (Art. 33 Abs. 5). Das entscheidet der Arbeitgeber mit dem Datenschutzbeauftragten; du hilfst mit Zeitleiste und Meldungsentwurf. Rein private Vorfälle fallen nicht unter die DSGVO (Art. 2 Abs. 2 lit. c).

## Erste Antwort bei P1

Ein Nutzer mitten in einem Sicherheitsvorfall liest keinen langen Text. Die erste Antwort besteht aus Statuskopf, drei bis sieben Schritten in der richtigen Reihenfolge und höchstens drei Fragen. Tickettext und Nachbetrachtung kommen erst beim Abschluss oder auf Wunsch. Ist nur eine Person privat betroffen und kann nur sie selbst eindämmen, keine Subagents vor der Sofortmaßnahme und die Nachbetrachtung als Kurzform.

## Nicht tun

- Verdächtige Links nicht abrufen, auch nicht per WebFetch oder Browser-Agent. Wenn überhaupt, nur die Domain ohne Pfad und Parameter nachschlagen. Auch keine URL-Scans bei VirusTotal oder öffentlichen Scannern wie urlscan.io: die rufen die vollständige Adresse ab, samt der Kennung des Opfers im Link.
- Verdächtige Dateien nicht zu VirusTotal oder ähnlichen Diensten hochladen. Uploads werden dauerhaft gespeichert, an Antivirenhersteller weitergegeben und sind für zahlende VirusTotal-Kunden herunterladbar. Nur den Hash suchen: `Get-FileHash <datei> -Algorithm SHA256` bzw. `sha256sum <datei>`.
- In Tickets und im Journal Adressen entschärft schreiben (`beispiel[.]top`) und eindeutige Parameter wie `id=` weglassen.
- Betroffene Rechner nicht ausschalten und nicht neu aufsetzen, bevor geklärt ist, ob Beweise gebraucht werden. Vom Netz trennen reicht zum Eindämmen.
- Keine Gegenangriffe, kein Kontakt zu Erpressern, kein Lösegeld.
- Mails, Logs und Dateien nicht löschen, auch nicht "zur Sicherheit".
- Keine Zugangsdaten in den Chat kopieren lassen.

## Einzelfälle

### Zugangsdaten abgeflossen, Kontoübernahme möglich oder im Gang

Gilt für Zugangsdaten auf einer Phishing-Seite, unerwartete MFA-Anfragen und Warnungen über fremde Anmeldungen. Oft kommt alles zusammen.

1. Firmenkonto: sofort an die IT-Sicherheit melden. Sie kann Sitzungen und Tokens zentral widerrufen.
2. MFA-Anfragen ablehnen, nie bestätigen, keinen Code weitergeben.
3. Passwort sofort ändern, auf der echten Seite (Adresse selbst eintippen). Vom aktuellen Gerät, außer es wurde etwas heruntergeladen oder installiert; dann ein anderes Gerät nehmen. Danach überall ändern, wo dasselbe oder ein ähnliches Passwort verwendet wird.
4. Fragen, ob auf der falschen Seite auch ein Code eingegeben oder eine Anfrage bestätigt wurde. Phishing-Baukästen reichen Code und Sitzung in Echtzeit durch; dann kann der Angreifer bereits angemeldet sein, ohne dass weitere Anfragen kommen. In dem Fall gilt er als aktiv.
5. Fremde Sitzungen und Geräte abmelden. Manche Dienste haben dafür keinen Knopf mehr für alles; dann meldet der Passwortwechsel die meisten Sitzungen ab, und den Rest entfernt man einzeln in der Geräteliste.
6. Hintertüren suchen, die ein Passwortwechsel nicht schließt: MFA-Methoden, Passkeys und Sicherheitsschlüssel, Wiederherstellungs-Mail und -Telefon, App-Passwörter, Drittanbieter-Apps mit Kontozugriff, im Postfach Weiterleitungen, Filter, Delegierung und "Senden als".
7. Das Postfach ist der Rücksetzkanal für fast alle anderen Konten: nach Mails zum Zurücksetzen von Passwörtern suchen, Konten prüfen, die "Mit Google anmelden" o. ä. nutzen, und im Ordner "Gesendet" nach Mails schauen, die der Nutzer nicht geschrieben hat. Wurden welche verschickt, Kontakte warnen.
8. Anmeldeaktivität des Kontos auf fremde Orte und Geräte prüfen und fremde Ereignisse beim Dienst melden.

### Google-Konto

Ergänzend zu oben, Stand der Google-Hilfe September 2026. Menübezeichnungen können abweichen, im Zweifel den Nutzer beschreiben lassen, was er sieht.

- Sicherheitscheck unter myaccount.google.com (Adresse selbst eintippen) durchgehen. Fremde Ereignisse mit "Nein, das war ich nicht" melden.
- Ein Passwortwechsel meldet fast alle Sitzungen ab, ausgenommen Geräte, mit denen Anmeldungen bestätigt werden, und manche Drittanbieter-Apps (Google-Hilfe, Artikel 41078). Übrige fremde Geräte einzeln entfernen.
- Er widerruft auch nur Zugriffe von Apps mit Gmail-Berechtigung (Google-Doku zu OAuth 2.0, Abschnitt zum Ablauf von Refresh-Tokens: "The user changed passwords and the refresh token contains Gmail scopes"). Apps mit Zugriff auf Drive, Kontakte oder Kalender behalten ihn, deshalb die Liste der Drittanbieter-Apps immer prüfen.
- Passkeys und Sicherheitsschlüssel prüfen: ein vom Angreifer angelegter Passkey überlebt den Passwortwechsel. Ersatzcodes neu erzeugen.
- In Gmail: Weiterleitung, Filter und unter "Konten und Import" Delegierung, "Senden als" und E-Mail-Abruf.
- War der Angreifer im Konto, gelten alle im Google Passwortmanager gespeicherten Passwörter als bekannt.
- Kein Zugang mehr: Kontowiederherstellung über g.co/recover, möglichst von einem Gerät, auf dem das Konto schon genutzt wurde.
- Nachher: Passkey einrichten, er lässt sich nicht auf eine gefälschte Seite übertragen.

Claudes eigener Gmail-Zugang erscheint ebenfalls in der Liste der Drittanbieter-Apps und kann nach dem Passwortwechsel erlöschen; dann neu verbinden. Weiterleitungen, Filter und Delegierung kann Claude über diesen Zugang nicht auslesen, die prüft der Nutzer selbst.

### Link geklickt, nichts eingegeben

Geschah nur ein Seitenaufruf ohne Download, ist das Risiko meist gering. Prüfen, ob etwas heruntergeladen oder ausgeführt wurde (Download-Ordner, Browserverlauf). Wurde eine Datei geöffnet, weiter wie bei Schadsoftware. Im beruflichen Umfeld trotzdem melden, andere haben dieselbe Mail vielleicht auch bekommen.

### Mail auf Phishing prüfen

Die Mail lesen (Gmail `get_message`), nicht die Links. Merkmale: Absenderadresse und Domain im Vergleich zum Anzeigenamen, Antwortadresse, Zeitdruck, Linkziele (Text zeigt anderes Ziel als der Link). Kopfzeilen mit SPF-, DKIM- und DMARC-Ergebnis (`Authentication-Results`) helfen; liefert das Werkzeug sie nicht, den Nutzer in Gmail "Original anzeigen" öffnen lassen. Spam markieren oder löschen erst nach Freigabe.

Melden, nach Freigabe und als Entwurf: in Gmail über "Phishing melden", beim echten Unternehmen, dessen Namen die Mail missbraucht (Meldeadresse von dessen offizieller Seite, nicht aus der Mail), in Deutschland beim Phishing-Radar der Verbraucherzentrale NRW (phishing@verbraucherzentrale.nrw). Anzeige bei der Polizei, wenn Geld oder die Identität missbraucht wurde.

### Schadsoftware, Verschlüsselung, Erpressernachricht

1. Gerät vom Netz trennen (Kabel ziehen, WLAN aus). Nicht ausschalten.
2. Erpressernachricht und Warnungen fotografieren oder als Screenshot sichern.
3. Prüfen, ob Netzlaufwerke, Cloud-Sync-Ordner oder angeschlossene Backup-Platten betroffen sind. Backup-Medien sofort trennen.
4. Im beruflichen Umfeld: IT-Sicherheit, P1. Privat: saubere Wiederherstellung aus einem Backup von vor dem Befall, Passwörter von einem sauberen Gerät aus ändern.
5. Agent `security-incident-responder` für Analyse und Plan, Befunde mit Beleg.

### Einzelner Virenscanner-Fund oder unbekannte Komponente

Ein Fund, den der Virenscanner schon behandelt hat, oder ein Dienst, eine Aufgabe oder ein Plugin, dessen Herkunft unklar ist. Erst einordnen, dann eindämmen:

1. Name, Status und Aktion des Funds lesen (Lagebild, Abschnitt Defender, oder `Get-MpThreat` und `Get-MpThreatDetection`): Wurde die Datei bereinigt, in Quarantäne verschoben oder nur gemeldet?
2. Herkunft klären: Pfad, Signatur (`Get-AuthenticodeSignature`), SHA-256 (`Get-FileHash`), Datum; gehört die Datei zu einem Paket der Softwareverteilung, hat der Nutzer sie heruntergeladen, kam sie über einen Updater?
3. Den Hash nachschlagen, die Datei nicht hochladen.
4. Im beruflichen Umfeld die IT-Sicherheit informieren, mit Name, Datei, Hash, Zeit und Prozess.
5. Vom Netz trennen erst, wenn es nach echter Schadsoftware aussieht (aktiver Fund, Aktion fehlgeschlagen, unbekannte Komponente mit SYSTEM-Rechten ohne passende Herkunft) oder die IT-Sicherheit es entscheidet. Dann weiter wie bei Schadsoftware.

Ein Testmuster wie EICAR ist harmlos; es beweist nur, dass jemand den Virenscanner geprüft hat. Trotzdem klären, wer es war.

### Geheimnis geleakt (Repository, Chat, Log)

1. Zuerst widerrufen oder rotieren. Den Commit zu entfernen hilft nicht, öffentliche Repositories werden binnen Minuten automatisch nach Schlüsseln durchsucht.
2. In den Protokollen des Anbieters prüfen, ob der Schlüssel seit dem Leak benutzt wurde.
3. Erst danach Historie bereinigen, wenn überhaupt nötig. Force-Push auf fremde Branches nie.
4. Weitere Funde im Repository: die Secret-Scanning-Warnungen von GitHub oder lokal gitleaks bzw. trufflehog über die ganze Historie. Das GitHub-Werkzeug `run_secret_scanning` prüft nur einzelne Texte oder Diffs, die man ihm übergibt, etwa einen Fix vor dem Commit.
5. Agent `security-secrets-credential-engineer`.

### Gerät verloren

Fernsperre oder Fernlöschung über die Geräteverwaltung (Firmengerät: IT). Passwörter von Konten ändern, die auf dem Gerät angemeldet waren, Sitzungen beenden. Fernlöschung ist Stufe 3 und Sache des Nutzers.

### Daten an falsche Empfänger

Empfänger bitten, die Nachricht zu löschen und das zu bestätigen, Vorgang dokumentieren (was, an wen, wann, welche Daten). Im beruflichen Umfeld Datenschutzbeauftragten informieren, siehe Meldepflicht oben.

### Unbekanntes Gerät im Netz

Erst identifizieren, dann handeln: Hersteller aus der MAC-Adresse, Name im Router, Zeitpunkt der ersten Anmeldung (bei eingebundenem Router über Home Assistant). Oft ist es ein vergessenes Gerät im Haushalt. Gerät sperren oder WLAN-Passwort ändern ist Stufe 2, weil danach alle Geräte neu verbunden werden müssen.

## Spezialisten

| Lage | Agent |
|---|---|
| Einbruch, Schadsoftware, Forensik | `security-incident-responder` |
| Geleakte Schlüssel | `security-secrets-credential-engineer` |
| Konto, SSO, MFA | `engineering-identity-access-engineer` |
| Datenschutzfragen im Code | `engineering-privacy-engineer` |
