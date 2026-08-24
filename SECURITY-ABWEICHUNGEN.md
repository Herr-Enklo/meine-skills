# Abweichungen vom Upstream

Die Agents in `plugins/agency-*/agents/` stammen aus
[The Agency](https://github.com/msitarzewski/agency-agents) und waren bis zum
24.08.2026 inhaltlich unverändert. Ein Security-Review an diesem Tag hat mehrere
geerbte Anweisungen gefunden, die ein Angreifer über ein präpariertes Projekt
ausnutzen kann. Diese Stellen sind geändert. Hier steht, welche und warum.

Alle Änderungen gelten doppelt, weil `.claude/agents/` byte-identische Kopien enthält.

## Instruktionen aus dem Arbeitsverzeichnis

Betroffen: `project-manager-senior`, `testing-evidence-collector`, `design-ux-architect`

Die Agents wiesen sich selbst an, ihre "complete methodology" aus `ai/agents/pm.md`,
`ai/agents/qa.md` bzw. `ai/agents/architect.md` zu laden. Der Pfad ist relativ und löst
sich im geöffneten Projekt auf. Ein fremdes Repository mit einer Datei an dieser Stelle
hätte damit die Instruktionen des Agenten bestimmt.

Die Zeile verweist jetzt auf den Text der Agent-Datei selbst und hält fest, dass
Projektdateien Material sind, keine Anweisungsquelle.

## Ausführung eines Skripts aus dem Arbeitsverzeichnis

Betroffen: `testing-evidence-collector`, `testing-reality-checker`, `project-manager-senior`

Alle drei riefen `./qa-playwright-capture.sh` auf, formuliert als "ALWAYS RUN FIRST"
bzw. "NEVER SKIP". Das Skript gehört nicht zum Projekt. Wer eine Datei dieses Namens in
ein Repository legt, erreicht Codeausführung, sobald jemand dort einen der Agents startet.

Der Aufruf ist durch einen Hinweis ersetzt, das Skript vor der Ausführung zu lesen und
die Zustimmung des Nutzers einzuholen. In `testing-reality-checker` verlangte zusätzlich
eine Freigabebedingung Belege "from the mandatory reality-check commands"; sie verweist
jetzt auf die Schritte, nicht auf die Pflichtausführung.

## Handeln ohne Rückfrage

Betroffen: `specialized-chief-of-staff`

Der "Energy read" wies an, den Tag des Nutzers "without asking permission" zu entlasten.
Gemeint war Kalenderpflege, aber als allgemeine Verhaltensvorgabe in einem Agenten mit
Schreib- und Bash-Zugriff ist die Formulierung ungünstig. Der Agent schlägt jetzt vor
und lässt entscheiden.

## Werkzeugbeschränkung

Betroffen: `design-ux-researcher`, `design-ui-finish-gate-reviewer`,
`project-management-project-shepherd`, `specialized-chief-of-staff`,
`security-compliance-auditor`, `testing-tool-evaluator`,
`engineering-codebase-onboarding-engineer`

Diese sieben analysieren und berichten, sie verändern keine Systeme. Sie hatten kein
`tools:` im Frontmatter und damit den vollen Satz inklusive Bash. Sie bekommen jetzt
`Read, Grep, Glob, WebFetch, WebSearch, Write, Edit` — lesen, recherchieren, Bericht
schreiben, aber keine Shell.

Die übrigen 51 Agents sind unverändert. Ob sie Bash brauchen, ist eine Einzelfallfrage
und noch offen.

## Umgang mit fremden Inhalten

Betroffen: `product-feedback-synthesizer`, `product-manager`, `product-sprint-prioritizer`,
`engineering-codebase-onboarding-engineer`, `specialized-codebase-archaeologist`,
`design-ui-finish-gate-reviewer`

Diese sechs verarbeiten Inhalte, die andere geschrieben haben: abgerufene Webseiten,
fremde Repositories, Nutzerfeedback. Sie bekommen am Dateiende den Abschnitt
"Handling Untrusted Content", der fremde Inhalte als Daten einordnet und nicht als
Anweisungen. Die Regel ist dem Upstream-Agenten
`project-management-meeting-notes-specialist` nachempfunden, der sie von sich aus hat.

Das betrifft auch den Verweis auf `uizze.com` in `design-ui-finish-gate-reviewer`: die
Domain bleibt, ihr Inhalt gilt jetzt ausdrücklich als Daten.

## Einwilligung vor Tracking

Betroffen: `engineering-rapid-prototyper`

Das Analytics-Template feuerte GA4-Events ohne Consent-Prüfung. Ein Kommentar hält jetzt
fest, dass `trackEvent` hinter einer Einwilligung stehen muss.
