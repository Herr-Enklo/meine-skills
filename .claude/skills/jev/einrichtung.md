# Jev einrichten

Einmalig pro Rechner. Der Nutzer erledigt die Schritte mit Schlüsseln selbst; Claude erklärt und prüft danach mit `status`.

## Was gebraucht wird

- uv (lädt Python 3.12 und die Pakete selbst)
- Google Chrome, Chromium oder Microsoft Edge
- ein API-Schlüssel, entweder von OpenRouter oder von TypeSafe

OpenRouter ist der einfachere Weg: ein Schlüssel reicht für beides, die Entscheidungen von Jev (`typesafe/jev-1.13` über `POST https://openrouter.ai/api/alpha/decisions`) und das kleine Textmodell zum Ausfüllen von Feldern (`inception/mercury-2.5`). Abgerechnet wird über das OpenRouter-Guthaben. Beim Anlegen des Schlüssels unter openrouter.ai/settings/keys ein Kreditlimit setzen.

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

   Speichern und schließen. Die Datei liegt unter `C:\Users\<name>\.jev\.env` und gehört nicht in ein Repository.

3. Prüfen. Den Pfad zum Skript kennt Claude; von Hand geht auch der Pfad im Klon von meine-skills:

   ```
   uv run --script "<pfad>\plugins\jev-ultrafast\skills\jev\scripts\jev.py" status
   ```

   Erwartet: `"provider": "openrouter"` und ein Pfad unter `chrome_binary`. Findet das Skript keinen Browser, den Pfad in der Umgebungsvariable `JEV_CHROME` angeben.

4. Einen kostenlosen Probelauf ohne Modell:

   ```
   uv run --script "<pfad>\...\jev.py" inspect --url https://en.wikipedia.org/wiki/Main_Page
   ```

   Ein eigenes Chrome-Fenster geht auf, die Ausgabe listet die Bedienelemente der Seite. Das Fenster bleibt offen und wird für weitere Läufe wiederverwendet; `stop` schließt es.

5. Der erste echte Lauf ist das Wikipedia-Beispiel aus `SKILL.md`. Er kostet einige Entscheidungen bei OpenRouter.

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

Die Cloud-Umgebung hat Chromium, das Skript startet ihn headless. Was fehlt, sind Netz und Schlüssel. Beides stellt der Nutzer in den Einstellungen der Umgebung ein (Umgebungsmenü in der Titelleiste der Session, dann Bearbeiten):

1. Netzwerkzugriff: `openrouter.ai` zu den erlaubten Domains hinzufügen (bei TypeSafe direkt `api.typesafe.ai`). GitHub und PyPI braucht uv für die Installation; in der Umgebung für meine-skills waren beide am 23.09.2026 schon erreichbar, openrouter.ai und api.typesafe.ai dagegen gesperrt.
2. Umgebungsvariable `OPENROUTER_API_KEY` mit dem Schlüssel anlegen. Eine `.env`-Datei gibt es in der Cloud nicht; das Skript liest die Variable direkt.

Die Änderung gilt ab der nächsten neuen Session. Den laufenden Chrome sieht man in der Cloud nicht; `--screenshot` liefert ein Bild der Endseite.

Die Beschreibung der Zugriffsstufen steht unter https://code.claude.com/docs/en/claude-code-on-the-web.
