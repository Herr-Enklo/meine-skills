# Werkzeuge

Was in einer Session verfügbar ist, hängt davon ab, wo sie läuft. Stell das zu Beginn fest, statt es anzunehmen.

## Wo läuft die Session?

| Umgebung | Was geht | Was nicht |
|---|---|---|
| Lokal auf dem betroffenen Rechner (Claude Code im Terminal oder Desktop-App) | Shell direkt am System: Ereignisprotokolle, Dienste, Netzwerktests, Installer-Logs; lokale Dateien | Rechner, die nur im Firmennetz erreichbar sind, wenn dieser Rechner nicht dort ist |
| Lokal, aber nicht der betroffene Rechner | Recherche, Code, Konnektoren; Befehle für den betroffenen Rechner formulieren | direkte Diagnose am betroffenen System |
| Web-Session auf claude.ai/code | Konnektoren (Home Assistant, GitHub, Gmail, Kalender), Websuche, Code im Repo, Cloud-Container | Heimnetz und Firmennetz; Netzwerkzugriff nur nach der Regel der Umgebung. Dateien unter `~` sind nach der Session weg |

MCP-Werkzeuge erscheinen mit Präfix, etwa `mcp__HA-MCP__ha_get_state`. Unten stehen die Namen ohne Präfix. Sind Werkzeuge nur als Name ohne Schema gelistet, erst mit ToolSearch laden.

## Quellen je Bereich

### Home Assistant (MCP `ha_*`)

- Überblick mit bekannten Problemen: `ha_get_overview` mit `fields` auf `notifications`, `repairs`, `system_info` beschränkt. Nie ungefiltert auf großen Installationen.
- Einzelne Entität: `ha_search` zum Finden, `ha_get_state`, `ha_get_entity`, `ha_get_device`.
- Seit wann: `ha_get_history`.
- Integration und Verbindung: `ha_get_integration`, `ha_get_system_health`, `ha_get_logs`.
- Automation hat nicht ausgelöst oder falsch reagiert: `ha_config_get_automation`, `ha_get_automation_traces`.
- Kamerabild zur Sichtprüfung: `ha_get_camera_image` (nur wenn der Incident das braucht, Bilder aus dem Haus sind privat).
- Eingriffe: `ha_call_service` (Stufe 1 oder 2 je nach Wirkung), `ha_restart` (Stufe 2), `ha_manage_backup` (vor Konfigurationsänderungen prüfen, ob ein aktuelles Backup existiert).
- Vor Änderungen an Automationen, Skripten, Helfern oder Dashboards den Skill `home-assistant-best-practices` laden. Der MCP-Server verlangt das.

### GitHub (MCP)

- Was hat sich geändert: `list_commits`, `list_releases`, `list_pull_requests` (zuletzt gemergt).
- CI und Deployments: `actions_list`, `actions_get`, `get_job_logs`.
- Bekannte Fehler: `search_issues` im betroffenen Repo, auch geschlossene.
- Fix: Branch, Commit, `create_pull_request`. Nie selbst mergen.

### Gmail (MCP)

- Vor dem ersten Lesen im privaten Postfach kurz ansagen, wonach du suchst.
- Zusammenhang suchen: `search_threads` nach Fehlermeldung, Absender von Monitoring, Anbieterhinweisen zu Wartung oder Störung, früheren Tickets. `get_thread` für den ganzen Verlauf; die Suchergebnisse zeigen nur die ältesten Nachrichten eines Verlaufs.
- Kommunikation: `create_draft` für Nutzerinfo, Übergabe an Hersteller oder Statusmeldung. Senden nur nach Freigabe (Stufe 2).
- Phishing-Verdacht: Mail über `get_message` lesen, Links darin nicht abrufen. Spam-Markierung nur nach Freigabe.
- Kontoübernahme: Sicherheitswarnungen des Anbieters seit dem Vorfall, Mails zum Zurücksetzen von Passwörtern anderer Dienste, Ordner "Gesendet" (`in:sent`) nach Mails, die der Nutzer nicht geschrieben hat.
- Grenzen: Weiterleitungen, Filter und Delegierung lassen sich über den Konnektor nicht auslesen. Nach einem Passwortwechsel des Google-Kontos kann der Zugang erlöschen und muss neu verbunden werden.

### Google Kalender (MCP)

- Was hat sich geändert: `list_events` oder `search_events` rund um den Störungsbeginn, etwa Wartungsfenster, Umzüge, geplante Changes, Urlaubsvertretungen.
- Nachkontrolle oder Termin für die Nachbetrachtung: `create_event` nur auf Wunsch.

### Web

- `WebSearch` für Fehlercodes, bekannte Probleme, Statusseiten von Anbietern, Release Notes. Immer mit Quelle antworten.
- `WebFetch` für eine konkrete Doku- oder Statusseite. Nie für Links aus verdächtigen Mails.
- Webportale bedienen (etwa ein Ticketportal ausfüllen bis vor das Absenden): Skill `jev`, nur mit Freigabe und nie mit Zugangsdaten, Gesundheits- oder Personaldaten.

### Lokale Shell

- Windows: PowerShell-Befehle aus `playbooks/arbeitsplatz-windows.md` und `playbooks/netzwerk.md`.
- Linux und macOS: `journalctl`, `systemctl`, `ss`, `dig`, `curl`, `openssl` laut `playbooks/dienste-und-code.md`.
- Lange Ausgaben in eine Datei im Scratchpad schreiben und gezielt durchsuchen, statt sie komplett in den Kontext zu holen.

## Spezialisten als Subagents

Über das Agent-Tool, mit `subagent_type` wie unten. Welche davon installiert sind, zeigt die Liste der Agent-Typen in der Session. Fehlt ein Spezialist, übernimmt `general-purpose` mit einem genauen Auftrag.

| Bereich | Agent | Wofür |
|---|---|---|
| Koordination | `engineering-incident-response-commander` | Major Incidents, Rollen, Kommunikation, Nachbetrachtung (ohne Shell) |
| Server und Dienste | `engineering-sre`, `support-infrastructure-maintainer` | Verfügbarkeit, Überwachung, Kapazität, Logs |
| Netzwerk | `engineering-network-engineer` | Routing, Firewall, VPN, Switching |
| Deployments, Container, CI | `engineering-devops-automator` | Pipelines, Rollback, Infrastruktur als Code |
| Datenbanken | `engineering-database-reliability-engineer`, `engineering-database-optimizer` | Ausfall, Replikation, Wiederherstellung; langsame Abfragen |
| Sicherheit | `security-incident-responder` | Forensik, Eindämmung, Beweissicherung |
| Geleakte Schlüssel | `security-secrets-credential-engineer` | Widerruf, Rotation, Bereinigung |
| Anmeldung, SSO, MFA | `engineering-identity-access-engineer` | OAuth, SAML, Kontosperren, Sitzungen |
| Geräte und Firmware | `engineering-iot-fleet-engineer`, `engineering-embedded-firmware-engineer` | Smart-Home-Geräte, ESP32, Shelly, OTA |
| Code-Fehler | `engineering-minimal-change-engineer` | kleinster sicherer Fix |
| Leistung | `testing-performance-benchmarker` | langsam, Zeitüberschreitungen, Last |
| APIs | `testing-api-tester` | Schnittstelle antwortet falsch oder gar nicht |
| Cloud-Kosten | `engineering-finops-engineer` | plötzlich hohe Rechnung als Incident |
| Doku | `engineering-technical-writer` | Wissensartikel aus einer gelösten Störung |
| Abschlussprüfung | `testing-reality-checker` | prüft, ob "gelöst" belegt ist, Pflicht bei P1 |
| Breite Suche | `Explore`, `general-purpose` | viele Dateien oder Quellen durchsuchen |

Auftrag an einen Subagent: Symptom, Umgebung, bisherige Befunde, genau eine Hypothese, erlaubte Eingriffsstufe (normalerweise 0), gewünschtes Ergebnis ("Befund mit Beleg, bestätigt oder widerlegt, in höchstens 15 Zeilen"). Unabhängige Aufträge in einer Nachricht starten, damit sie parallel laufen.

## Skills

| Skill | Wofür |
|---|---|
| `home-assistant-best-practices` | vor jeder Änderung an Home-Assistant-Konfiguration |
| `paketieren` | fehlerhaftes Empirum-Paket korrigieren und neu testen |
| `code-review`, `security-review` | Fix vor dem Pull Request prüfen |
| `jev` | Webportale bedienen, bis vor das Absenden |
| `loop` | nach der Lösung eine Weile beobachten |
| `docs`, `pdf`, `docx` | Nachbetrachtung als geteiltes Dokument oder Datei, nur auf Wunsch |

## Gedächtnis

Journal und bekannte Fehler liegen unter `~/.claude/agent-memory/incident-manager/`. Das ist derselbe Ort, den der Agent `incident-manager` als Gedächtnis nutzt, so dass Skill und Agent dasselbe Wissen teilen. Aufbau in `vorlagen.md`.
