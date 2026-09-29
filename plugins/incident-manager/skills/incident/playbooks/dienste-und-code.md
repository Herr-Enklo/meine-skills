# Playbook: Dienste, Server und Code

Für Webseiten und APIs, die nicht antworten, Server, Datenbanken, Zertifikate, fehlgeschlagene Deployments, rote CI und Fehler im eigenen Code.

## Von außen prüfen

Zuerst aus Sicht der Nutzer messen, bevor man in den Server schaut. Aus einer Web-Session gehen diese Befehle nur, wenn die Netzwerkregel der Umgebung den Host erlaubt.

```bash
host=example.com
dig +short "$host"
curl -sS -o /dev/null -w 'HTTP %{http_code}, %{time_total}s\n' "https://$host/"
echo | openssl s_client -connect "$host:443" -servername "$host" 2>/dev/null | openssl x509 -noout -subject -dates
```

Die Ausgabe grenzt ein: kein DNS-Eintrag, keine Verbindung, Fehlercode (5xx heißt Serverseite, 4xx meist Konfiguration oder Anmeldung), Zeitüberschreitung, oder ein Zertifikat, dessen `notAfter` vorbei ist.

## Was hat sich geändert

Das ist bei Diensten fast immer die Ursache. Prüfen, was um den Störungsbeginn passiert ist:

- Deployments und Merges: GitHub `list_commits`, `list_pull_requests`, `actions_list` für Deploy-Workflows, `list_releases`.
- Konfiguration, Umgebungsvariablen, Secrets, DNS-Einträge.
- Abgelaufenes: Zertifikate, Domains, Tokens, API-Schlüssel, Testzeiträume, Zahlungsmittel beim Anbieter.
- Abhängigkeiten: Statusseiten der Cloud- und API-Anbieter, Paketupdates, Kontingente und Ratenlimits.
- Last: ungewöhnlich viele Anfragen, voller Datenträger, voller Speicher.

Kam die Störung mit einem Deployment, ist Zurückrollen oft schneller als Reparieren. Rollback ist Stufe 2: vorher fragen, danach prüfen, ob das Symptom verschwindet.

## Auf dem Server

Nur lesend, bis die Ursache feststeht:

```bash
systemctl --failed
systemctl status <dienst> --no-pager
journalctl -u <dienst> --since "1 hour ago" --no-pager | tail -n 200
df -h; free -m; uptime
ss -tlnp
```

Bei Containern entsprechend `docker ps -a`, `docker logs --since 1h <container>`. Bei Kubernetes `kubectl get pods -A` (auch Pods mit `Running`, aber nicht bereit, etwa `0/1`, beachten), `kubectl describe pod <pod> -n <namespace>`, `kubectl logs <pod> -n <namespace> --previous` für den abgestürzten Vorgänger.

Datenbanken: keine schreibenden Abfragen und keine Migrationen ohne Freigabe. Bei Verdacht auf Datenverlust zuerst prüfen, ob ein aktuelles Backup existiert und wiederherstellbar ist. Spezialist: `engineering-database-reliability-engineer`.

## Rote CI

- Den fehlgeschlagenen Job und seine Logs über GitHub `actions_list` und `get_job_logs` holen. Die erste echte Fehlermeldung suchen, nicht die letzte Zeile.
- Ist derselbe Job auf dem Basis-Branch auch rot, liegt es nicht an der Änderung.
- "Flaky" ist keine Ursache. Einmal neu starten ist erlaubt, um einen Abbruch vor dem ersten Test (Checkout, Installation, Runner verloren) auszuschließen. Scheitert es erneut, ist der Fehler echt.
- Tests werden nie übersprungen oder abgeschaltet, um grün zu werden.

## Fehler im eigenen Code

1. Reproduzieren, am besten als fehlschlagender Test.
2. Eingrenzen: `git log --since` um den Störungsbeginn, bei einer Regression `git bisect` mit dem Test.
3. Kleinsten sicheren Fix schreiben (Agent `engineering-minimal-change-engineer`), auf eigenem Branch, mit dem Test von Schritt 1.
4. `/code-review`, bei Sicherheitsbezug `/security-review`.
5. Pull Request mit Ursache, Fix und Test im Text. Nicht selbst mergen.

## Spezialisten

| Lage | Agent |
|---|---|
| Überwachung, SLOs, Kapazität | `engineering-sre` |
| Pipelines, Container, Infrastruktur | `engineering-devops-automator` |
| API antwortet falsch | `testing-api-tester` |
| langsam, Zeitüberschreitungen | `testing-performance-benchmarker` |
| Datenbank | `engineering-database-reliability-engineer`, `engineering-database-optimizer` |
| Kostenexplosion in der Cloud | `engineering-finops-engineer` |
