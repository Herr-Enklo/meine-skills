# Playbook: Sicherheit

Dieses Playbook hat Vorrang vor allen anderen. Es gilt, sobald einer dieser Fälle vorliegt oder vermutet wird:

- Link in einer verdächtigen Mail geklickt, Zugangsdaten eingegeben oder Anhang geöffnet
- MFA-Anfragen, die der Nutzer nicht ausgelöst hat
- Warnung über unbekannte Anmeldung, geänderte Wiederherstellungsdaten, neue Weiterleitungsregeln
- Virenscanner schlägt an, fremde Prozesse, verschlüsselte Dateien, Erpressernachricht
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

Im beruflichen Umfeld zuerst die IT-Sicherheit des Arbeitgebers informieren (lassen). Sie entscheidet über Eindämmung, Forensik und Meldungen. Bei personenbezogenen Daten muss der Verantwortliche eine Datenpanne nach Art. 33 DSGVO in der Regel binnen 72 Stunden der Aufsichtsbehörde melden; das entscheidet der Arbeitgeber mit dem Datenschutzbeauftragten. Du hilfst mit Zeitleiste und Meldungsentwurf.

## Nicht tun

- Verdächtige Links nicht abrufen, auch nicht per WebFetch oder Browser-Agent. Tracking-Parameter verraten dem Absender, dass die Mail gelesen wurde.
- Verdächtige Dateien nicht zu VirusTotal oder ähnlichen Diensten hochladen, dort sind Uploads für andere einsehbar. Nur den Hash suchen: `Get-FileHash <datei> -Algorithm SHA256` bzw. `sha256sum <datei>`.
- Betroffene Rechner nicht ausschalten und nicht neu aufsetzen, bevor geklärt ist, ob Beweise gebraucht werden. Vom Netz trennen reicht zum Eindämmen.
- Keine Gegenangriffe, kein Kontakt zu Erpressern, kein Lösegeld.
- Mails, Logs und Dateien nicht löschen, auch nicht "zur Sicherheit".
- Keine Zugangsdaten in den Chat kopieren lassen.

## Einzelfälle

### Zugangsdaten auf einer Phishing-Seite eingegeben

1. Passwort sofort ändern, auf der echten Seite (Adresse selbst eintippen) und von einem Gerät, das nicht betroffen ist. Ebenso überall, wo dasselbe Passwort verwendet wird.
2. Alle aktiven Sitzungen abmelden, soweit der Dienst das anbietet.
3. Prüfen und bereinigen: MFA-Methoden, Wiederherstellungs-Mail und -Telefon, Weiterleitungen und Filterregeln im Postfach (Angreifer richten gern eine stille Weiterleitung ein), App-Passwörter, verbundene Apps mit OAuth-Zugriff.
4. Anmeldeaktivität des Kontos auf fremde Orte und Geräte prüfen.
5. Firmenkonto: sofort an die IT-Sicherheit melden, die kann Sitzungen und Tokens zentral widerrufen.

### Unerwartete MFA-Anfragen

Ablehnen, nie bestätigen. Wer MFA-Anfragen auslösen kann, kennt vermutlich das Passwort: weiter wie oben ab Schritt 1.

### Link geklickt, nichts eingegeben

Geschah nur ein Seitenaufruf ohne Download, ist das Risiko meist gering. Prüfen, ob etwas heruntergeladen oder ausgeführt wurde (Download-Ordner, Browserverlauf). Wurde eine Datei geöffnet, weiter wie bei Schadsoftware. Im beruflichen Umfeld trotzdem melden, andere haben dieselbe Mail vielleicht auch bekommen.

### Mail auf Phishing prüfen

Die Mail lesen (Gmail `get_message`), nicht die Links. Merkmale: Absenderadresse und Domain im Vergleich zum Anzeigenamen, Antwortadresse, Zeitdruck, Linkziele (Text zeigt anderes Ziel als der Link). Kopfzeilen mit SPF-, DKIM- und DMARC-Ergebnis (`Authentication-Results`) helfen; liefert das Werkzeug sie nicht, den Nutzer in Gmail "Original anzeigen" öffnen lassen. Spam markieren oder löschen erst nach Freigabe.

### Schadsoftware, Verschlüsselung, Erpressernachricht

1. Gerät vom Netz trennen (Kabel ziehen, WLAN aus). Nicht ausschalten.
2. Erpressernachricht und Warnungen fotografieren oder als Screenshot sichern.
3. Prüfen, ob Netzlaufwerke, Cloud-Sync-Ordner oder angeschlossene Backup-Platten betroffen sind. Backup-Medien sofort trennen.
4. Im beruflichen Umfeld: IT-Sicherheit, P1. Privat: saubere Wiederherstellung aus einem Backup von vor dem Befall, Passwörter von einem sauberen Gerät aus ändern.
5. Agent `security-incident-responder` für Analyse und Plan, Befunde mit Beleg.

### Geheimnis geleakt (Repository, Chat, Log)

1. Zuerst widerrufen oder rotieren. Den Commit zu entfernen hilft nicht, öffentliche Repositories werden binnen Minuten automatisch nach Schlüsseln durchsucht.
2. In den Protokollen des Anbieters prüfen, ob der Schlüssel seit dem Leak benutzt wurde.
3. Erst danach Historie bereinigen, wenn überhaupt nötig. Force-Push auf fremde Branches nie.
4. Auf GitHub hilft `run_secret_scanning`, weitere Funde im selben Repository zu finden.
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
