# Jev einrichten

Einmalig pro Rechner. Der Nutzer erledigt die Schritte mit Schlüsseln selbst; Claude erklärt und prüft danach mit `status`.

## Was gebraucht wird

- uv (lädt Python 3.12 und die Pakete selbst)
- Google Chrome, Chromium oder Microsoft Edge
- ein API-Schlüssel, entweder von OpenRouter oder von TypeSafe

OpenRouter ist der einfachere Weg: ein Schlüssel reicht für beides, die Entscheidungen von Jev (`typesafe/jev-1.13` über `POST https://openrouter.ai/api/alpha/decisions`) und das kleine Textmodell zum Ausfüllen von Feldern (`inception/mercury-2.5`). Abgerechnet wird über das OpenRouter-Guthaben.

## Schlüssel bei OpenRouter anlegen

Stand der Oberfläche: 23.09.2026.

1. Auf openrouter.ai anmelden. Die linke Leiste hat oben die Einträge des Workspace und darunter unter „Account“ die des Kontos. Richtig ist **API Keys** im Workspace-Teil, direkt unter „Overview“. Ist die Leiste abgeschnitten, ist das Fenster zu schmal; mit Strg und Minus herauszoomen.

   Nicht verwechseln: „Management Keys“ unter „Account“ verwalten andere Schlüssel per API und rufen keine Modelle auf. Unter „BYOK“ trägt man Schlüssel anderer Anbieter ein. Beides braucht Jev nicht.

2. Neuen Schlüssel anlegen und das Formular so ausfüllen:

   - Name: zum Beispiel `JEV`
   - Expiration: zum Beispiel 90 Tage. Ist der Schlüssel abgelaufen, endet jeder Lauf mit einem Anmeldefehler; dann einen neuen anlegen und in `.env` tauschen.
   - Credit limit: zum Beispiel 5 $
   - Reset limit every: Monthly. Bleibt das Feld leer, ist der Schlüssel gesperrt, sobald das Limit einmal verbraucht ist.

   Den gelben Hinweis auf „Workload Identity Federation“ übergehen, der gilt für Server.

3. Nach „Create“ zeigt OpenRouter den vollständigen Schlüssel (`sk-or-v1-…`) genau einmal. Sofort kopieren und in die Schlüsseldatei einfügen (Windows, Schritt 2). Die Liste zeigt danach nur eine gekürzte Fassung ohne Kopierknopf. Wurde das Fenster vor dem Kopieren geschlossen, den Schlüssel löschen und einen neuen anlegen.

4. Guthaben unter **Account → Credits** aufladen. Das Limit am Schlüssel ist nur eine Obergrenze und bringt kein Guthaben mit.

Ein Limit für den ganzen Workspace gibt es zusätzlich unter „Settings“, Abschnitt „Workspace budget“, Knopf „Add budget“.

Der Schlüssel gehört nicht in den Chat. Ist er doch dort gelandet, bei OpenRouter löschen, einen neuen anlegen und die Zeile in `.env` tauschen.

## Windows

1. uv installieren, in PowerShell:

   ```
   winget install --id=astral-sh.uv -e
   ```

   Danach ein neues Terminal öffnen, damit `uv` im Pfad ist.

2. Schlüsseldatei anlegen:

   ```
   New-Item -ItemType Directory -Force "$HOME\.jev" | Out-Null
   notepad "$HOME\.jev\.env"
   ```

   Notepad fragt, ob die Datei angelegt werden soll. Inhalt:

   ```
   OPENROUTER_API_KEY=sk-or-...
   ```

   Speichern und schließen. Die Datei liegt unter `C:\Users\<name>\.jev\.env` und gehört nicht in ein Repository. Leerzeichen um das `=` und Anführungszeichen um den Schlüssel stören nicht.

   Die Datei muss genau `.env` heißen. Notepad und „Neu → Textdokument“ im Explorer machen leicht `.env.txt` daraus, und der Explorer blendet das `.txt` aus. Zum Prüfen im Explorer **Anzeigen → Einblenden → Dateinamenerweiterungen** einschalten. Steht dort `.env.txt`, in `.env` umbenennen. Als Typ zeigt der Explorer dann „ENV-Datei“ statt „Textdokument“.

3. Prüfen. Am einfachsten in Claude Code:

   ```
   /jev-ultrafast:jev status
   ```

   Meldet Claude Code „Unknown command: /jev-ultrafast:jev“, ist das Plugin nicht installiert. `/reload-plugins` hilft dann nicht, es lädt nur Installiertes neu. Stattdessen:

   ```
   /plugin marketplace update meine-skills
   /plugin install jev-ultrafast@meine-skills
   /reload-plugins
   ```

   Das `update` braucht es, wenn der Marketplace schon vor dem Jev-Plugin hinzugefügt wurde; seine lokale Kopie kennt Jev dann noch nicht. Fehlt der Marketplace ganz, vorher `/plugin marketplace add Herr-Enklo/meine-skills`. Ist das Plugin schon installiert und im Repo neuer, holen es `claude plugin marketplace update meine-skills` und `claude plugin update jev-ultrafast@meine-skills` im Terminal; danach `/reload-plugins`.

   Von Hand in PowerShell geht es auch. Im Ordner `.jev` liegen nur Schlüssel und Chrome-Profil; das Skript liegt nach der Plugin-Installation unter `.claude\plugins` oder im eigenen Klon von meine-skills. Finden lässt es sich so:

   ```
   Get-ChildItem $HOME -Recurse -Filter jev.py -ErrorAction SilentlyContinue | Select-Object FullName
   ```

   Dann:

   ```
   uv run --script "<pfad>\jev.py" status
   ```

   Erwartet: `"provider": "openrouter"` und ein Pfad unter `chrome_binary`. Findet das Skript keinen Browser, den Pfad in der Umgebungsvariable `JEV_CHROME` angeben. Beim ersten Aufruf lädt uv einmalig Python und die Pakete, das dauert etwa eine halbe Minute.

4. Einen kostenlosen Probelauf ohne Modell:

   ```
   uv run --script "<pfad>\...\jev.py" inspect --url https://en.wikipedia.org/wiki/Main_Page
   ```

   Ein eigenes Chrome-Fenster geht auf, die Ausgabe listet die Bedienelemente der Seite. Das Fenster bleibt offen und wird für weitere Läufe wiederverwendet; `stop` schließt es.

5. Der erste echte Lauf ist das Wikipedia-Beispiel aus `SKILL.md`. Er kostet einige Entscheidungen bei OpenRouter, also vorher Guthaben aufladen. In Claude Code reicht ein Satz wie „Jev soll auf Wikipedia den Artikel zu Berlin öffnen“.

   Steht in der Fehlermeldung 402 oder „insufficient credits“, fehlt Guthaben. Bei 401 oder „invalid key“ passt der Schlüssel in `.env` nicht, etwa weil er bei OpenRouter gelöscht oder ersetzt wurde.

   So am 23.09.2026 unter Windows durchgespielt: `status` fand Schlüssel und Chrome, beim ersten Lauf ging ein eigenes Chrome-Fenster auf und Jev öffnete den Berlin-Artikel.

## macOS und Linux

Gleiche Schritte. uv kommt mit `curl -LsSf https://astral.sh/uv/install.sh | sh`. Die Schlüsseldatei ist `~/.jev/.env`; danach `chmod 600 ~/.jev/.env`.

## TypeSafe direkt statt OpenRouter

```
TYPESAFE_API_KEY=...
TYPESAFE_MODEL=jev-latest
TEXT_MODEL_API_KEY=...
TEXT_MODEL_BASE_URL=https://openrouter.ai/api/v1
TEXT_MODEL=inception/mercury-2.5
TEXT_MODEL_REASONING=none
```

Steht `TYPESAFE_API_KEY` in der Datei, geht Jev direkt an api.typesafe.ai. Für das Textmodell taugt jeder OpenAI-kompatible Anbieter. Fehlt `TEXT_MODEL_BASE_URL`, nimmt Jev DeepSeek. Ohne Textmodell bricht ein Lauf ab, sobald Jev tippen will.

## Anmeldungen im Automatisierungs-Chrome

Das Profil unter `~/.jev/chrome-profile` startet leer: keine Logins, keine Cookies, keine Erweiterungen. Braucht eine Aufgabe ein Konto, meldet sich der Nutzer dort einmal selbst an (`chrome` starten, anmelden, Fenster offen lassen). Jev kann danach alles, was dieses Konto kann. Deshalb nur Konten anmelden, bei denen ein Fehlklick nicht wehtut, und kein Passwortmanager in diesem Profil.

Der DevTools-Port 9333 ist nur auf 127.0.0.1 offen. Jedes Programm auf dem eigenen Rechner kann diesen Chrome darüber steuern, solange er läuft. Wer das nicht will, ruft nach getaner Arbeit `stop` auf.

## Web-Session auf claude.ai/code

Die Cloud-Umgebung hat Chromium, das Skript startet ihn headless. Was fehlt, sind Netz und Schlüssel. Beides stellt der Nutzer in den Einstellungen der Umgebung ein: auf claude.ai/code links „Neu“, über dem Eingabefeld den Wolken-Knopf mit dem Namen der Umgebung öffnen, mit der Maus auf die Umgebung, dann das Zahnrad rechts. Das Menü neben dem Sessiontitel gehört nur zum Repository. Im Dialog „Cloud-Umgebung bearbeiten“:

1. Netzwerkzugriff: `openrouter.ai` zu den erlaubten Domains hinzufügen (bei TypeSafe direkt `api.typesafe.ai`). GitHub und PyPI braucht uv für die Installation; in der Umgebung für meine-skills waren beide am 23.09.2026 schon erreichbar, openrouter.ai und api.typesafe.ai dagegen gesperrt.
2. Netzwerkzugriff auch für jede Seite, die Jev öffnen soll. Chromium geht über denselben Proxy wie alles andere im Container; am 23.09.2026 war auch `de.wikipedia.org` gesperrt. Entweder Netzwerkzugriff „Benutzerdefiniert“ mit einer Domain pro Zeile, etwa `de.wikipedia.org` und `en.wikipedia.org`, und dem Häkchen bei der Standardliste der Paketmanager (braucht uv), oder „Vollständig“ für jede Seite. „Vollständig“ gilt für alle Sessions der Umgebung; wer das nur für Jev will, legt dafür eine eigene Umgebung an. Anfragen, die Chromium von sich aus an Google schickt (`www.google.com`, `redirector.gvt1.com`), dürfen gesperrt bleiben.
3. Unter „Umgebungsvariablen“ die Zeile `OPENROUTER_API_KEY=sk-or-v1-...` eintragen, in einer Zeile. Eine `.env`-Datei gibt es in der Cloud nicht; das Skript liest die Variable direkt. „API-Anmeldedaten“ taugen dafür nicht: Dort sieht die Session den Schlüssel nicht, das Skript braucht ihn aber als Variable.

Eine gesperrte Seite erkennt man an `inspect`: Der Titel ist nur der Hostname, und die Elementliste ist leer, weil Chromium seine Fehlerseite zeigt. Ein gesperrtes openrouter.ai zeigt sich im `run` als „Model connection failed“.

Die Änderung gilt ab der nächsten neuen Session. Den laufenden Chrome sieht man in der Cloud nicht; `--screenshot` liefert ein Bild der Endseite.

Der Proxy der Cloud stellt Chromium für HTTPS eigene Zertifikate aus, ausgestellt von seiner CA („CCR Upstream Proxy CA“). curl und Python vertrauen ihr über `SSL_CERT_FILE`, Chromium nicht; bis 1.2.1 endete deshalb jede HTTPS-Seite mit `ERR_CERT_AUTHORITY_INVALID`. Das Skript liest die CA aus `~/.ccr/agent-proxy-ca.crt` und gibt Chromium beim Start ihren Fingerabdruck mit (`--ignore-certificate-errors-spki-list`). Chromium nimmt dann zusätzlich genau die Zertifikate dieser CA an. `status` zeigt unter `proxy_ca`, wie viele CAs gefunden wurden. Für einen eigenen Proxy mit eigener CA den Pfad zur PEM-Datei in `JEV_PROXY_CA` setzen. Läuft Chromium schon von vorher, einmal `stop`, damit er mit dem Fingerabdruck neu startet.

Seiten mit Bot-Schutz sperren den Chromium in der Cloud fast immer: Er kommt aus einem Rechenzentrum, läuft ohne Fenster und hat ein leeres Profil. Skyscanner leitete am 23.09.2026 auf eine Captcha-Seite von PerimeterX um. Solche Seiten lokal laufen lassen, wo der Nutzer ein Captcha selbst lösen kann; umgangen wird es nicht.

Die Beschreibung der Zugriffsstufen und des Dialogs steht unter https://code.claude.com/docs/en/cloud-environments.
