# meine-skills

Persönlicher Claude-Code-Plugin-Marketplace. Enthält eigene Skills und eine kuratierte
Auswahl an Agents, versioniert und auf jedem Rechner installierbar.

## Installation

```
/plugin marketplace add Herr-Enklo/meine-skills
/plugin install paketierung@meine-skills
/plugin install grill-me@meine-skills
/plugin install jev-ultrafast@meine-skills
/plugin install incident-manager@meine-skills
```

Danach `/reload-plugins`, falls die Installation das meldet.

### Aktualisieren

Claude Code kopiert installierte Plugins in einen Cache und holt eine neue Fassung nur,
wenn die `version` in der `plugin.json` des Plugins gestiegen ist. Wer hier ein Plugin
ändert, zählt deshalb dort die Version hoch. Auf dem Rechner holt man die neue Fassung
im Terminal, nicht in Claude Code:

```
claude plugin marketplace update meine-skills
claude plugin update jev-ultrafast@meine-skills
```

Danach in einer laufenden Session `/reload-plugins` oder Claude Code neu starten.

Die Agent-Plugins installierst du einzeln, je nachdem was du brauchst:

```
/plugin install agency-dev@meine-skills
/plugin install agency-ops@meine-skills
/plugin install agency-security@meine-skills
/plugin install agency-qa@meine-skills
/plugin install agency-ki@meine-skills
/plugin install agency-produkt@meine-skills
/plugin install agency-ux@meine-skills
/plugin install agency-iot@meine-skills
```

Installiere nur, was du wirklich nutzt. Jeder aktive Agent belegt mit Name und
Beschreibung Platz im Systemprompt jeder Session.

## Plugins

| Plugin | Inhalt | Umfang |
|---|---|---|
| `paketierung` | Skills für das Paketierungsprojekt | 1 Skill |
| `grill-me` | Kritisches Nachfragen zu Plänen, Entscheidungen und Ideen | 1 Skill |
| `jev-ultrafast` | Browser-Agent Jev Ultrafast: Webseiten bedienen lassen, Ergebnis prüfen | 1 Skill mit Skript |
| `incident-manager` | Incident Manager mit Schwerpunkt Windows und Software: Störungen annehmen, diagnostizieren und mit Belegen lösen | 1 Skill mit Skript, 1 Agent |
| `agency-dev` | Entwicklung und Architektur | 12 Agents |
| `agency-ops` | Betrieb und Infrastruktur | 9 Agents |
| `agency-security` | Sicherheit | 10 Agents |
| `agency-qa` | Test und Qualität | 8 Agents |
| `agency-ki` | KI-Systeme | 6 Agents |
| `agency-produkt` | Produkt und Projekt | 8 Agents |
| `agency-ux` | Design und Frontend-Qualität | 6 Agents |
| `agency-iot` | IoT und Embedded | 3 Agents |

## Werkzeuge im Repo

Neben den Plugins liegen eigenständige Programme hier, jeweils mit eigener README:

| Ordner | Inhalt |
|---|---|
| `datenrettung/` | Sucht NTFS-, FAT- und exFAT-Datenträger nach gelöschten Dateien ab |
| `packaging-center/` | Nachbau des Empirum Packaging Center 24.0: Package Wizard, Package Editor mit Debugger und Paketprüfung, um Setup.inf-Pakete ohne Empirum-Server lokal zu testen |
| `werbefrei/` | Browser-Erweiterung für Chrome und Edge, die Werbebanner rund um Artikel ausblendet und Werbeserver blockiert, mit EasyList, eigener Erkennung von Werbeplätzen und Element-Auswahl |
| [Tutto im Repository Spiele](https://github.com/Herr-Enklo/Spiele/tree/main/tutto) | Das Würfelspiel wurde in das Repository `Spiele` verschoben. |

## Skills und Agents aufrufen

Skills rufst du als Slash-Befehl auf:

```
/paketierung:code-review <PR-URL oder Dateipfad>
/grill-me:grill-me <Plan oder Idee>
/jev-ultrafast:jev <Browseraufgabe>
/incident-manager:incident <Beschreibung der Störung>
```

In Web-Sessions auf diesem Repo heißen die beiden nur `/jev` und `/incident` (siehe unten).

Agents sprichst du im Gespräch an oder lässt Claude sie selbst auswählen:

```
Nutze engineering-code-reviewer für diesen Diff.
```

## jev-ultrafast

[Jev Ultrafast](https://github.com/browser-use/jev-ultrafast) von Browser Use und TypeSafe
ist ein Browser-Agent: Er liest die Bedienelemente einer Seite als nummerierte Tabelle,
das Entscheidungsmodell Jev wählt pro Schritt Operation und Element, ein kleines
Sprachmodell schreibt den Text für Eingabefelder. Der Skill macht daraus ein Werkzeug
für Claude: Claude formuliert das Ziel und die Prüfkriterien, Jev klickt, Claude prüft
das Ergebnis auf der Endseite.

Das Skript `plugins/jev-ultrafast/skills/jev/scripts/jev.py` läuft über
`uv run --script`. uv holt Python 3.12 und Jev in einer festen Version (Commit
`1231850`, alle Pakete mit Prüfsummen in `jev.py.lock`). Jev steuert einen eigenen
Chrome mit getrenntem Profil unter `~/.jev/chrome-profile`, nie den Alltags-Chrome.
Unter Windows und macOS öffnet sich das Fenster sichtbar, in der Cloud läuft Chromium
headless. Die Telemetrie von Browser Harness ist abgeschaltet.

Gebraucht wird ein OpenRouter-Schlüssel in `~/.jev/.env` (`OPENROUTER_API_KEY=...`).
Er deckt Jev (`typesafe/jev-1.13`) und das Textmodell ab. Ein TypeSafe-Schlüssel geht
auch. Einrichtung Schritt für Schritt: `plugins/jev-ultrafast/skills/jev/einrichtung.md`.

Getestet am 23.09.2026 in einer Web-Session mit Chromium 141: `status`, `chrome`,
`inspect`, `stop` und ein kompletter `run` gegen nachgebaute Modelle
(`plugins/jev-ultrafast/tests/e2e_offline.py`: tippen, Liste auswählen, zwei Klicks,
Abschlussprüfung). Mit den echten Modellen lief Jev am selben Tag unter Windows mit
Chrome und einem OpenRouter-Schlüssel: Der Wikipedia-Artikel zu Berlin war danach offen.
In der Cloud-Umgebung steht das noch aus, weil sie openrouter.ai und api.typesafe.ai
sperrt.

```
python -m unittest discover -s plugins/jev-ultrafast/tests
python plugins/jev-ultrafast/tests/e2e_offline.py
```

## incident-manager

Du beschreibst eine Störung, Claude arbeitet sie ab wie ein Incident Manager: ID und
Priorität vergeben, Hypothesen aufstellen, mit den Werkzeugen der Session prüfen,
Workaround und Lösung umsetzen oder als fertige Befehle liefern, das Ergebnis belegen
und einen Tickettext zum Kopieren schreiben. Bei P1 und P2 laufen unabhängige Prüfungen
parallel als Subagents, am Ende steht eine Nachbetrachtung.

Der Schwerpunkt liegt auf Windows-Clients und Software unter Windows. Dafür gibt es zwei
Playbooks: `windows-software.md` für Installation, Softwareverteilung mit Empirum und MSI,
Abstürze, fehlende Laufzeitumgebungen und Rechte, `windows-system.md` für Fehlercodes,
Ereignisse, Bluescreens, Windows Update, Profile und Gruppenrichtlinien. Dazu kommt
`scripts/windows-lagebild.ps1`, ein nur lesendes Skript, das in einem Lauf System,
ausstehenden Neustart, laufende Installationen, Fehlerereignisse, Abstürze mit Modul und
Code, Windows-Installer- und Update-Vorgänge, Defender und Netzwerk sammelt, mit
`-Software <Name>` auch Installationen in allen Registry-Ansichten, Prozesse, Dienste,
Aufgaben und Ereignisse zu einem Programm. Claude fragt erst nach, was das Skript nicht
zeigen kann.

```
powershell -NoProfile -ExecutionPolicy Bypass -File .\windows-lagebild.ps1 -Software "Notepad++" -Seit "2026-09-28 18:00"
```

Das Plugin hat zwei Teile. Der Skill `incident` enthält den Ablauf (`SKILL.md`), die
Prioritätsmatrix, die Zuordnung von Werkzeugen, Konnektoren und Agents zu Störungsarten,
die beiden Windows-Playbooks und das Skript, Playbooks für Netzwerk, Smart Home, Dienste
und Code sowie Sicherheit, und Vorlagen für Tickettext, Nutzerinfo, Übergabe und
Nachbetrachtung. Der Agent `incident-manager` lädt diesen Skill und hat ein Gedächtnis
unter `~/.claude/agent-memory/incident-manager/` mit Umgebungswissen, bekannten Fehlern
und den letzten Incidents. Der Skill schreibt in denselben Ordner.

```
/incident Notepad++-Rollout: auf 14 von 230 Clients Rückgabewert 1618
/incident-manager:incident <Beschreibung>
claude --agent incident-manager
claude --bg --agent incident-manager "VPN verbindet nicht, Fehler 809"
```

Die erste Zeile gilt in Web-Sessions auf diesem Repo, die zweite lokal mit installiertem
Plugin. Mit `--agent` wird die ganze Session zum Incident Manager, mit `--bg` läuft ein
Incident im Hintergrund, `claude agents` zeigt alle laufenden. Den genauen Agent-Namen
bei Installation als Plugin zeigt `/agents`.

Lesen und diagnostizieren darf Claude ohne Rückfrage. Kleine, umkehrbare Eingriffe am
defekten Teil (eine Integration neu laden, einen hängenden Dienst neu starten) kündigt
es an und führt sie aus. Alles, was andere betrifft oder unterbricht, etwas im Haus
schaltet, Nachrichten versendet oder dauerhaft umkonfiguriert, braucht eine Freigabe;
Löschen und Zurücksetzen nur auf ausdrückliche Anweisung.

### Getestet

Am 29.09.2026 in einer Web-Session mit vier Testläufen: ein Empirum-Rollout mit 1618 auf
einem Teil der Clients (erfunden, ohne Zugriff aufs Firmennetz), ein echter, nur lesender
Lauf gegen Home Assistant, ein Phishing-Fall mit laufender Kontoübernahme (erfunden) und
ein Faktencheck aller Playbooks gegen Microsoft-, Home-Assistant-, Kubernetes- und
DSGVO-Quellen. Die Befunde sind eingearbeitet: unter anderem die MSI-Logsuche auf deutschem
Windows, `msiexec` über `Start-Process -Wait`, die Suche nach der konkurrierenden
Installation bei 1618 (MsiInstaller 1040/1042 sind Informationsereignisse), die
Reihenfolge bei einer Kontoübernahme und das Erkennen verwaister oder erwartbar nicht
verfügbarer Entitäten in Home Assistant.

Das Lagebild-Skript lief mangels Windows unter PowerShell 7.6 auf Linux: Syntaxprüfung,
PSScriptAnalyzer mit Kompatibilitätsregeln für Windows PowerShell 5.1 ohne Befund, und ein
Test mit nachgebauten Windows-Cmdlets (39 Prüfungen: Zeitfenster, Gruppierung,
Absturzcodes, Softwaresuche in allen Registry-Ansichten, Update-Verlauf mit negativem
HResult). Ein Lauf auf echtem Windows steht noch aus.

```
pwsh -NoProfile -File plugins/incident-manager/tests/lagebild-test.ps1
```

### Wege zu einem Incident-Agent

Geprüft am 29.09.2026 gegen die Claude-Code-Doku und die Konnektoren dieses Kontos.

| Weg | Stand | Einschätzung |
|---|---|---|
| Skill `/incident` | gebaut | Kern des Ganzen. Die Session selbst wird Incident Manager, kann nachfragen, Konnektoren nutzen und Spezialisten parallel starten. Läuft lokal und in Web-Sessions. |
| Agent `incident-manager` | gebaut | Für mehrere Incidents gleichzeitig (ein Agent je Incident, auch im Hintergrund) und als ganze Session per `--agent`. Bringt das Gedächtnis mit, das Claude Code bei jedem Start lädt. Als Subagent kann er nicht direkt nachfragen und gibt Rückfragen gesammelt zurück. |
| Konnektoren | genutzt | Home Assistant für Diagnose und Reparatur zu Hause, GitHub für Code und CI, Gmail für Zusammenhänge und Antwortentwürfe, Kalender für die Frage, was sich geändert hat. Gesendet oder geschaltet wird erst nach Freigabe. |
| Routine auf claude.ai/code | nicht eingerichtet | Läuft zeitgesteuert ohne offenen Rechner, etwa als täglicher Gesundheitscheck von Home Assistant (neue Repairs, ausgefallene Geräte) oder um Mails mit einem Label „Incident“ abzuarbeiten. Lohnt sich, sobald Störungen regelmäßig auf einem dieser Wege ankommen. |
| Geplante Aufgabe in der Desktop-App | nicht eingerichtet | Wie eine Routine, aber auf dem eigenen Rechner und damit mit Zugriff aufs lokale Netz. |
| GitHub Action `anthropics/claude-code-action` | nicht gebaut | Issues mit Label `incident` in einem privaten Repo würden automatisch analysiert. Braucht einen API-Schlüssel oder OAuth-Token als Secret, und der Runner erreicht weder Heim- noch Firmennetz. |
| Eigenes Programm mit dem Agent SDK | nicht gebaut | Nur sinnvoll mit API-Zugang zum Ticketsystem, um Tickets selbst abzuholen und zurückzuschreiben. Größter Aufwand, eigene API-Kosten. |

Die Einstellung `"agent": "incident-manager"` in `.claude/settings.json` würde jede
Session in diesem Repo als Incident Manager starten. Sie ist nicht gesetzt, weil hier
auch an den anderen Skills gearbeitet wird.

## Agent-Katalog

### agency-dev – Entwicklung und Architektur

- `engineering-api-platform-engineer` – Expert API platform engineer for public and partner APIs
- `engineering-backend-architect` – Senior backend architect specializing in scalable system design, database architecture, API development …
- `engineering-code-reviewer` – Expert code reviewer who provides constructive, actionable feedback focused on correctness …
- `engineering-codebase-onboarding-engineer` – Expert developer onboarding specialist who helps new engineers understand unfamiliar codebases fast by …
- `engineering-developer-tooling-engineer` – Expert developer-tooling and CLI engineer
- `engineering-frontend-developer` – Expert frontend developer specializing in modern web technologies, React/Vue/Angular frameworks, UI …
- `engineering-git-workflow-master` – Expert in Git workflows, branching strategies, and version control best practices including conventional …
- `engineering-minimal-change-engineer` – Engineering specialist focused on minimum-viable diffs
- `engineering-rapid-prototyper` – Specialized in ultra-fast proof-of-concept development and MVP creation using efficient tools and …
- `engineering-software-architect` – Expert software architect specializing in system design, domain-driven design, architectural patterns …
- `engineering-technical-writer` – Expert technical writer specializing in developer documentation, API references, README files, and …
- `specialized-codebase-archaeologist` – Multi-session, multi-tool drift detection specialist who audits codebases touched by several AI coding …

### agency-ops – Betrieb und Infrastruktur

- `engineering-data-engineer` – Expert data engineer specializing in building reliable data pipelines, lakehouse architectures, and …
- `engineering-database-optimizer` – Expert database specialist focusing on schema design, query optimization, indexing strategies, and …
- `engineering-database-reliability-engineer` – Expert database reliability engineer (DBRE)
- `engineering-devops-automator` – Expert DevOps engineer specializing in infrastructure automation, CI/CD pipeline development, and cloud …
- `engineering-finops-engineer` – Expert cloud cost engineer for AWS/GCP/Azure
- `engineering-incident-response-commander` – Expert incident commander specializing in production incident management, structured response …
- `engineering-network-engineer` – Expert network engineer for Cisco IOS/IOS-XE, Cisco ASA/FTD, Juniper Junos, and Palo Alto PAN-OS …
- `engineering-sre` – Expert site reliability engineer specializing in SLOs, error budgets, observability, chaos engineering …
- `support-infrastructure-maintainer` – Expert infrastructure specialist focused on system reliability, performance optimization, and technical …

### agency-security – Sicherheit

- `engineering-identity-access-engineer` – Expert identity engineer for OAuth 2.0/OIDC flows, enterprise SSO (SAML/OIDC) and SCIM provisioning …
- `engineering-privacy-engineer` – Expert privacy engineer who implements privacy in code
- `security-ai-generated-code-auditor` – Security reviewer for AI-generated and vibe-coded apps
- `security-appsec-engineer` – AppSec specialist who secures the software development lifecycle through threat modeling, secure code …
- `security-architect` – Expert security architect specializing in threat modeling, secure-by-design architecture, trust-boundary …
- `security-compliance-auditor` – Expert technical compliance auditor specializing in SOC 2, ISO 27001, HIPAA, and PCI-DSS audits
- `security-incident-responder` – Digital forensics and incident response specialist who leads breach investigations, contains active …
- `security-penetration-tester` – Offensive security specialist conducting authorized penetration tests, red team operations, and …
- `security-secrets-credential-engineer` – Owns the full lifecycle of secrets and credentials
- `security-senior-secops` – Defensive application security specialist who scans every code submission for secrets and sensitive data …

### agency-qa – Test und Qualität

- `testing-accessibility-auditor` – Expert accessibility specialist who audits interfaces against WCAG standards, tests with assistive …
- `testing-api-tester` – Expert API testing specialist focused on comprehensive API validation, performance testing, and quality …
- `testing-evidence-collector` – Screenshot-obsessed, fantasy-allergic QA specialist - Default to finding 3-5 issues, requires visual …
- `testing-performance-benchmarker` – Expert performance testing and optimization specialist focused on measuring, analyzing, and improving …
- `testing-reality-checker` – Stops fantasy approvals, evidence-based certification - Default to "NEEDS WORK", requires overwhelming …
- `testing-test-automation-engineer` – Expert end-to-end test automation engineer for Playwright and Cypress
- `testing-test-results-analyzer` – Expert test analysis specialist focused on comprehensive test result evaluation, quality metrics …
- `testing-tool-evaluator` – Expert technology assessment specialist focused on evaluating, testing, and recommending tools …

### agency-ki – KI-Systeme

- `engineering-ai-engineer` – Expert AI/ML engineer specializing in machine learning model development, deployment, and integration …
- `engineering-multi-agent-systems-architect` – Systems architect specializing in the design, coordination, and governance of multi-agent AI pipelines
- `engineering-prompt-engineer` – Specialist in crafting, testing, and systematically optimizing prompts for LLMs
- `engineering-rag-pipeline-engineer` – Production RAG specialist focused on chunking strategy, retrieval quality, hybrid search, re-ranking …
- `specialized-mcp-builder` – Expert Model Context Protocol developer who designs, builds, and tests MCP servers that extend AI agent …
- `specialized-workflow-architect` – Workflow design specialist who maps complete workflow trees for every system, user journey, and agent …

### agency-produkt – Produkt und Projekt

- `product-feedback-synthesizer` – Expert in collecting, analyzing, and synthesizing user feedback from multiple channels to extract …
- `product-manager` – Holistic product leader who owns the full product lifecycle
- `product-sprint-prioritizer` – Expert product manager specializing in agile sprint planning, feature prioritization, and resource …
- `project-management-experiment-tracker` – Expert project manager specializing in experiment design, execution tracking, and data-driven decision …
- `project-management-meeting-notes-specialist` – Extract structured decisions, action items, and open questions from meeting transcripts or rough notes …
- `project-management-project-shepherd` – Expert project manager specializing in cross-functional project coordination, timeline management, and …
- `project-manager-senior` – Converts specs to tasks and remembers previous projects
- `specialized-chief-of-staff` – Master coordinator for founders and executives

### agency-ux – Design und Frontend-Qualität

- `design-ui-designer` – Expert UI designer specializing in visual design systems, component libraries, and pixel-perfect …
- `design-ui-finish-gate-reviewer` – Product-interface reviewer who catches generic, interchangeable UI before it ships by grounding critique …
- `design-ux-architect` – Technical architecture and UX specialist who provides developers with solid foundations, CSS systems …
- `design-ux-researcher` – Expert user experience researcher specializing in user behavior analysis, usability testing, and …
- `engineering-data-visualization-engineer` – Expert data visualization engineer
- `engineering-i18n-engineer` – Expert i18n engineer for ICU MessageFormat, CLDR plural rules, RTL and bidirectional layouts …

### agency-iot – IoT und Embedded

- `engineering-embedded-firmware-engineer` – Specialist in bare-metal and RTOS firmware - ESP32/ESP-IDF, PlatformIO, Arduino, ARM Cortex-M, STM32 …
- `engineering-iot-fleet-engineer` – Expert IoT and edge fleet engineer
- `engineering-voice-ai-integration-engineer` – Expert in building end-to-end speech transcription pipelines using Whisper-style models and cloud ASR …

## Herkunft der agency-Plugins

Die Agents stammen aus [The Agency](https://github.com/msitarzewski/agency-agents)
von msitarzewski, MIT-lizenziert. Aus den dort rund 265 enthaltenen Agents sind 62
übernommen; Marketing, Vertrieb, Paid Media, Games, GIS und regional oder branchen-
spezifische Rollen sind weggelassen.

Angepasst wurde nur das Frontmatter. Im Original steht in `name` Klartext mit
Leerzeichen (`AI Engineer`), Claude Code braucht dort einen Slug, deshalb steht jetzt
der Dateiname drin (`engineering-ai-engineer`). `color` enthielt oft Hexwerte oder
Fantasienamen wie `neon-green` und ist auf die acht von Claude Code unterstützten
Farben abgebildet. `emoji` und `vibe` sind entfernt, weil Claude Code sie nicht
auswertet. Der Text der Agents ist unverändert. Lizenztext und Quellenangabe liegen
in jedem Plugin unter `NOTICE.md`.

## Zwei Wege, wie die Agents in eine Session kommen

Beide sind getestet, keiner deckt alles ab.

**Plugins** (`/plugin install ...`) landen unter `~/.claude/plugins/` und gelten für
jede lokale Claude-Code-Session auf dem Rechner, unabhängig vom Projekt. In
Web-Sessions auf claude.ai/code greifen sie nicht: Getestet am 23.08.2026 mit einer
frischen Session auf `main` wurde keines der neun Plugins geladen, obwohl
`.claude/settings.json` sie aktiviert. Web-Sessions stellen Plugins und Skills aus
den claude.ai-Kontoeinstellungen zusammen, nicht aus den Repo-Settings.

**`.claude/agents/`** im Repo funktioniert dagegen in Web-Sessions. Gleicher Test,
gleicher Tag, Branch mit dem Ordner: 68 Agent-Typen geladen, davon alle 62 aus dem
Ordner. Der Preis ist, dass die Dateien doppelt im Repo liegen, einmal als
Plugin-Quelle und einmal als Kopie.

**`.claude/skills/`** ist das Gegenstück für Skills und funktioniert ebenfalls.
Getestet am 24.08.2026 mit einer neu gestarteten Web-Session auf dem Branch mit dem
Ordner: der Skill `paketierung-code-review` war geladen. Ein Neustart der Session
genügt, eine neue Unterhaltung ist nicht nötig, weil Skills beim Session-Start
eingelesen werden. Der Branch muss dabei stehen bleiben, auf `main` gibt es den
Ordner nicht.

### Was in diesem Repo eingestellt ist

`.claude/agents/` enthält die 62 agency-Agents und den `incident-manager`,
`.claude/skills/` den Paketierungs-Skill, den Jev-Skill und den Incident-Skill, damit
Web-Sessions sie haben. Damit lokale Sessions sie nicht zusätzlich über die global
installierten Plugins bekommen und dadurch doppelt führen, stehen diese elf Plugins in
`.claude/settings.json` auf `false`. Das Projekt-Setting sticht die
Nutzer-Einstellung, und zwar nur in diesem Repo: in anderen Projekten greifen die
global installierten Plugins weiter.

Die Kopie heißt `paketierung-code-review`, nicht `code-review`, weil es einen
eingebauten Skill dieses Namens gibt.

### Für ein anderes Projekt

Sollen die Agents dort auch in Web-Sessions verfügbar sein, kopier `.claude/agents/`
in das Projekt und setz die agency-Plugins in dessen `.claude/settings.json`
ebenfalls auf `false`. Reicht dir lokal, lass den Ordner weg – dann genügen die
global installierten Plugins.

### Kopie auffrischen

Nach Änderungen an den Plugin-Agents:

```
rm -rf .claude/agents && mkdir -p .claude/agents && cp plugins/agency-*/agents/*.md .claude/agents/
cp plugins/agency-dev/NOTICE.md .claude/agents/NOTICE.md
cp plugins/incident-manager/agents/incident-manager.md .claude/agents/
```

Der Skill wird von Hand nachgezogen: `plugins/paketierung/skills/code-review/SKILL.md`
nach `.claude/skills/paketierung-code-review/SKILL.md` kopieren und die Zeile
`name: paketierung-code-review` im Frontmatter wieder ergänzen.

Der Jev-Skill wird als ganzer Ordner kopiert, Skript und Lockfile gehören dazu:

```
rm -rf .claude/skills/jev && cp -r plugins/jev-ultrafast/skills/jev .claude/skills/jev
```

Der Incident-Skill ebenso, mit allen Playbooks und Vorlagen:

```
rm -rf .claude/skills/incident && cp -r plugins/incident-manager/skills/incident .claude/skills/incident
```

## Sicherheit

Ein Security-Review am 24.08.2026 hat mehrere geerbte Anweisungen in den Upstream-Agents
gefunden, über die ein präpariertes Projekt Codeausführung oder Kontrolle über die
Agent-Instruktionen erlangen konnte. Die betroffenen Stellen sind geändert,
`SECURITY-ABWEICHUNGEN.md` führt jede Änderung mit Begründung auf.

Zwei Einstellungen gehören dazu. `autoUpdate` steht in `.claude/settings.json` auf
`false`: das Repo ist öffentlich, und wer es klont, registriert den Marketplace auf
seinem Rechner. Updates zieht man bewusst mit `/plugin marketplace update meine-skills`,
so wie unten beschrieben.

Der Werkzeugsatz ist einzeln durchgegangen. 22 der 62 Agents haben ein `tools:` im
Frontmatter, 18 davon ohne Bash. Die Regel dahinter: Wer analysiert, entwirft oder
berichtet und dessen Umsetzung woanders liegt, braucht keine Shell. Wer baut, deployt,
migriert, misst oder forensisch untersucht, behält sie. Die Zuordnung im Einzelnen steht
in `SECURITY-ABWEICHUNGEN.md`.

Der eigene Agent `incident-manager` hat kein `tools:` und damit den vollen Satz, weil
Diagnose Shell und Konnektoren braucht. Er liest dabei viel fremden Text (Tickets, Logs,
Mails). Agent und Skill legen deshalb fest, dass Anweisungen in solchen Inhalten nicht
befolgt werden, und staffeln Eingriffe nach Wirkung: ohne Freigabe nur Lesen und kleine,
umkehrbare Schritte am defekten Teil.

## Änderungen ausrollen

1. Datei ändern, zum Beispiel `plugins/paketierung/skills/code-review/SKILL.md`
2. Commit und Push nach GitHub
3. Auf jedem Rechner: `/plugin marketplace update meine-skills`

## Neuen Skill zu einem Plugin hinzufügen

Neuen Ordner unter `plugins/<plugin>/skills/<name>/` mit eigener `SKILL.md` anlegen.
Kein weiterer Eintrag in `marketplace.json` nötig, ein Plugin lädt alle Skills in
seinem `skills/`-Ordner und alle Agents in seinem `agents/`-Ordner.

## Neues Plugin hinzufügen

1. Ordner `plugins/<name>/` mit eigener `.claude-plugin/plugin.json` anlegen, dazu
   `skills/` und bei Bedarf `agents/`
2. Eintrag in der Wurzel-`marketplace.json` unter `plugins` ergänzen, `source` zeigt
   auf den neuen Ordner
