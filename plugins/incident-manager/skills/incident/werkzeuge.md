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

### Windows

- Lagebild: `scripts/windows-lagebild.ps1` im Skill-Ordner, nur lesend, ohne Administratorrechte, Windows PowerShell 5.1 und PowerShell 7. Aufruf und Optionen in `playbooks/windows-system.md`. Mit `-Software <Name>` alles zu einem Programm, mit `-Seit <Zeitpunkt>` ein festes Zeitfenster, mit `-Ausgabe <Datei>` zusätzlich als Datei.
- Startfehler: `scripts/windows-startcheck.ps1 -Programm <Name oder Pfad>`, nur lesend. Findet fehlende DLLs und DLLs in falscher Architektur über die Importtabellen, siehe `playbooks/windows-software.md`.
- Ohne Datei, bei gesperrter Ausführungsrichtlinie oder aus der Ferne: siehe "Einstieg" in `playbooks/windows-software.md`.
- Läuft Claude Code lokal unter Windows, ist die Shell oft Git Bash. PowerShell dann über `powershell -NoProfile -Command "..."` aufrufen, das Skript über `powershell -NoProfile -ExecutionPolicy Bypass -File "<pfad>"`. `Bypass` gilt nur für diesen einen Aufruf.
- Sitzt der Nutzer am Rechner und Claude nicht: Befehl zum Kopieren geben, die Ausgabe zurückbekommen. Bei langen Ausgaben um die Datei aus `-Ausgabe` bitten.
- Fremde Rechner mit WinRM und Administratorrechten: `Invoke-Command -ComputerName <PC> -FilePath <skript> -ArgumentList '<Programm>', 48, '<Seit>'` (Argumente nach Position), erst ein Rechner, dann alle.
- Eingebaute Werkzeuge: `certutil -error <code>` für Fehlercodes, `Get-WinEvent` für Ereignisse, `perfmon /rel` für die Zuverlässigkeitsüberwachung, `gpresult` für Richtlinien, `msiexec /l*v` für Installer-Logs, `reg export` als Sicherung vor Registry-Änderungen. Process Monitor (Sysinternals) für Zugriffs- und Dateifehler, auf Firmenrechnern nur nach Rückfrage.

### Home Assistant (MCP `ha_*`)

- Überblick mit bekannten Problemen: `ha_get_overview` mit `fields` auf `notifications`, `repairs`, `system_info` beschränkt. Nie ungefiltert auf großen Installationen. Den Zeitpunkt einer Repair mit dem Störungsbeginn vergleichen, bevor du sie als Ursache nimmst.
- Viele Entitäten auf einmal: `ha_search` mit `state_filter="unavailable"` und `result_fields` (etwa `entity_id`, `friendly_name`, `area`), danach `ha_get_state` mit vielen IDs auf einmal für `last_changed` und Attribute.
- Einzelne Entität: `ha_search` zum Finden, `ha_get_state`, `ha_get_entity`, `ha_get_device` (auch mit `entity_id`, um Gerät und Integration zu finden).
- Wer hängt davon ab: `ha_search` mit der genauen `entity_id` findet Automationen, Skripte und Helfer, die sie benutzen.
- Seit wann: `ha_get_history`. Der Verlauf reicht standardmäßig etwa zehn Tage zurück; ältere Beginne sind nur als "seit mindestens" angebbar.
- Integration und Verbindung: `ha_get_integration`, `ha_get_system_health`. Fehler im Protokoll: `ha_get_logs` mit `source="system"` und `search=<Integration>`; ohne `source` liefert das Werkzeug das Logbuch mit Zustandswechseln, nicht die Fehler.
- Automation hat nicht ausgelöst oder falsch reagiert: `ha_config_get_automation`, `ha_get_automation_traces`.
- Kamerabild zur Sichtprüfung: `ha_get_camera_image` (nur wenn der Incident das braucht, Bilder aus dem Haus sind privat).
- Werkzeuge, die etwas verändern: `ha_call_service`, `ha_bulk_control`, `ha_restart`, `ha_reload_core`, `ha_set_*`, `ha_config_set_*`, `ha_remove_*`, `ha_config_remove_*` und die `ha_manage_*`-Werkzeuge. Stufe nach Wirkung, siehe `playbooks/smart-home.md`. Ob ein aktuelles Backup existiert, zeigt die Entität des automatischen Backups; `ha_manage_backup` nur mit einer lesenden Aktion benutzen.
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

- Windows: Lagebild-Skript und PowerShell-Befehle aus `playbooks/windows-software.md`, `playbooks/windows-system.md` und `playbooks/netzwerk.md`.
- Linux und macOS: `journalctl`, `systemctl`, `ss`, `dig`, `curl`, `openssl` laut `playbooks/dienste-und-code.md`.
- Lange Ausgaben in eine Datei im Scratchpad schreiben und gezielt durchsuchen, statt sie komplett in den Kontext zu holen.

## Spezialisten als Subagents

Über das Agent-Tool, mit `subagent_type` wie unten. Welche davon installiert sind, zeigt die Liste der Agent-Typen in der Session. Fehlt ein Spezialist, übernimmt `general-purpose` mit einem genauen Auftrag. Subagents lohnen sich nur, wenn sie die Belege selbst erreichen (Web, Repositories, Konnektoren). Liegen die Belege auf einem Rechner, den nur der Nutzer bedient, bringt ein Subagent nichts.

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
| `paketieren` | fehlerhaftes Empirum-Paket korrigieren und neu testen; nur lokal unter Windows mit dem Plugin `paketierung`, sonst Vorschlag und Folgeaufgabe |
| `code-review`, `security-review` | Fix vor dem Pull Request prüfen |
| `jev` | Webportale bedienen, bis vor das Absenden |
| `loop` | nach der Lösung eine Weile beobachten |
| `docs`, `pdf`, `docx` | Nachbetrachtung als geteiltes Dokument oder Datei, nur auf Wunsch |

## Gedächtnis

Journal und bekannte Fehler liegen unter `~/.claude/agent-memory/incident-manager/`. Das ist derselbe Ort, den der Agent `incident-manager` als Gedächtnis nutzt, so dass Skill und Agent dasselbe Wissen teilen. Aufbau in `vorlagen.md`.
