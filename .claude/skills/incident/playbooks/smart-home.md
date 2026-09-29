# Playbook: Smart Home

Für Home Assistant und die Geräte dahinter: Gerät reagiert nicht, Sensor zeigt nichts oder Unsinn, Automation löst nicht oder falsch aus, Integration ausgefallen, Home Assistant selbst langsam oder nicht erreichbar. Werkzeuge sind die `ha_*`-Tools des MCP-Servers (siehe `werkzeuge.md`).

## Vorgehen

1. Bekannte Probleme zuerst: `ha_get_overview` mit `fields` = `["notifications", "repairs", "system_info"]`. Repairs und Benachrichtigungen erklären oft schon alles, etwa eine abgelaufene Anmeldung einer Cloud-Integration.
2. Betroffene Entität finden: `ha_search` mit dem Namen, den der Nutzer benutzt. Nie Entitätsnamen raten.
3. Zustand lesen: `ha_get_state`.
   - `unavailable`: Home Assistant erreicht das Gerät oder den Dienst nicht. Weiter bei Schritt 4.
   - `unknown`: Es liegt noch kein Wert vor, etwa nach einem Neustart oder bei einem Sensor, der selten meldet.
   - Plausibel, aber falsch: Einheit, Skalierung, falsche Entität in der Automation, veralteter Wert (Zeitstempel `last_updated` prüfen).
4. Umfang bestimmen: Sind nur diese Entität oder alle Entitäten desselben Geräts oder derselben Integration betroffen? `ha_get_device`, `ha_get_integration`. Viele gleichzeitig `unavailable` heißt: Integration, Verbindung, Bridge oder Coordinator, nicht das einzelne Gerät. Der Zustand der Integration (`loaded`, `setup_retry`, `setup_error`, `not_loaded`) sagt, ob Home Assistant sie überhaupt laden konnte.
5. Seit wann: `ha_get_history` für die Entität. Ein fester Zeitpunkt passt zu einer Änderung (Update, Stromausfall, Router-Neustart, Passwortwechsel). Ständiges Wechseln zwischen verfügbar und nicht verfügbar passt zu Funkproblemen oder schwacher Batterie.
6. Logs: `ha_get_logs`, nach Integration oder Gerät filtern. Die erste Fehlermeldung zählt, Folgefehler danach sind Rauschen.
7. Was hat sich geändert: Update-Entitäten (`update.*`) und deren Verlauf, `ha_get_system_health`, neue oder umbenannte Entitäten. Eine umbenannte Entität bricht jede Automation, die den alten Namen verwendet.

## Automation hat nicht oder falsch ausgelöst

- `ha_config_get_automation` lesen und `ha_get_automation_traces` für den fraglichen Zeitpunkt holen.
- Kein Trace zum Zeitpunkt: Der Auslöser hat nicht gefeuert. Automation deaktiviert? Auslöser-Entität zu dem Zeitpunkt `unavailable`? Zustandswechsel, der gar nicht stattfand (etwa von `unknown` statt vom erwarteten Wert)?
- Trace vorhanden, aber abgebrochen: An welcher Bedingung ist er gestoppt, welche Aktion hat einen Fehler geworfen? Der Trace zeigt es.
- Modus der Automation: Bei `single` wird ein zweiter Auslöser verworfen, solange der erste läuft. Das steht dann als Warnung im Log.

## Eingriffe

| Eingriff | Stufe |
|---|---|
| Zustände, Verlauf, Logs, Traces lesen | 0 |
| Eine ausgefallene Integration neu laden (`ha_call_service` mit `homeassistant.reload_config_entry`) | 1 |
| Ein einzelnes hängendes Gerät über seinen Neustart-Knopf neu starten, wenn es nichts Wichtiges steuert | 1 |
| Aktionen, die im Haus etwas bewegen oder schalten: Rollos, Heizung, Licht bei Anwesenheit, Geräte wie Waschmaschine oder Backofen | 2 |
| Alarmanlage, Kameras, Sirene, Schlösser, Anwesenheitserkennung | 2, nie von dir aus entschärfen oder abschalten |
| Automation, Skript, Helfer, Dashboard ändern | 2, vorher Skill `home-assistant-best-practices` laden und prüfen, ob ein aktuelles Backup existiert |
| Home Assistant neu starten (`ha_restart`), Firmware- oder Core-Update | 2 |
| Gerät, Entität oder Integration entfernen, Backup einspielen | 3 |

Eine Automation zum Test manuell auszulösen, führt ihre Aktionen wirklich aus. Das ist so viel Stufe, wie die Aktionen haben.

## Häufige Ursachen

- Cloud-Integration: Anmeldung abgelaufen oder Dienst des Herstellers gestört. Repairs prüfen, Statusseite des Herstellers suchen.
- WLAN-Geräte: IP-Adresse hat sich geändert, Gerät hängt, Router hat den Zugang gesperrt. Siehe `netzwerk.md`.
- Funkgeräte (Zigbee, Z-Wave, Thread, Matter): schwache Batterie, Gerät außer Reichweite, Router-Geräte im Netz ausgeschaltet, Coordinator oder Bridge ausgefallen.
- Wechselrichter, Zähler und andere lokale Integrationen: Gerät im Standby (etwa nachts), Verbindung zum Datenlogger verloren. Liefert die Integration dauerhaft alte Werte, hilft oft Neuladen; wiederholt sich das, eine Automation zur Selbstheilung vorschlagen statt jedes Mal von Hand neu zu laden.
- Nach einem Core-Update: Breaking Changes in den Release Notes der Version nachlesen, bevor irgendetwas geändert wird.

## Spezialisten

Firmware-Fragen (ESP32, ESPHome, Shelly, Tasmota): `engineering-embedded-firmware-engineer`. Viele Geräte gleichzeitig, Funknetz, OTA-Updates: `engineering-iot-fleet-engineer`.
