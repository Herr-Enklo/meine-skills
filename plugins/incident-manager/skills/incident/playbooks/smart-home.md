# Playbook: Smart Home

Für Home Assistant und die Geräte dahinter: Gerät reagiert nicht, Sensor zeigt nichts oder Unsinn, Automation löst nicht oder falsch aus, Integration ausgefallen, Home Assistant selbst langsam oder nicht erreichbar. Werkzeuge sind die `ha_*`-Tools des MCP-Servers (siehe `werkzeuge.md`).

## Vorgehen

1. Bekannte Probleme zuerst: `ha_get_overview` mit `fields` = `["notifications", "repairs", "system_info"]`. Repairs und Benachrichtigungen erklären oft schon alles, etwa eine abgelaufene Anmeldung einer Cloud-Integration. Vorher den Zeitpunkt der Repair mit dem Störungsbeginn vergleichen.
2. Betroffene Entität finden: `ha_search` mit dem Namen, den der Nutzer benutzt. Nie Entitätsnamen raten. Geht es um viele ("lauter Sensoren nicht verfügbar"), erst alle sammeln (`ha_search` mit `state_filter="unavailable"`), dann nach Gerät und Integration gruppieren und jede Gruppe für sich betrachten.
3. Zustand lesen: `ha_get_state`.
   - `unavailable`: Home Assistant bekommt von der Entität gerade keinen Wert. Das ist oft kein Fehler (siehe unten, "Erwartbar nicht verfügbar"). Sonst weiter bei Schritt 4.
   - `unavailable` mit Attribut `restored: true`: Die Entität steht noch in der Registry, die Integration legt sie aber nicht mehr an. Ein verwaister Eintrag, kein Verbindungsfehler.
   - `unknown`: Es liegt noch kein Wert vor, etwa nach einem Neustart oder bei einem Sensor, der selten meldet.
   - Plausibel, aber falsch: Einheit, Skalierung, falsche Entität in der Automation, veralteter Wert (Zeitstempel `last_updated` prüfen).
4. Umfang bestimmen: Sind nur diese Entität oder alle Entitäten desselben Geräts oder derselben Integration betroffen? `ha_get_device`, `ha_get_integration`. Viele gleichzeitig `unavailable` mit demselben Zeitstempel: zuerst prüfen, ob das ein Neustart von Home Assistant war, der `last_changed` neu setzt. Sonst heißt es: Integration, Verbindung, Bridge oder Coordinator, nicht das einzelne Gerät. Der Zustand der Integration sagt, ob Home Assistant sie überhaupt laden konnte: `loaded` läuft, `setup_retry` versucht es gerade erneut (meist Gerät oder Dienst nicht erreichbar), `setup_error` und `migration_error` sind gescheitert, `not_loaded` ist deaktiviert oder entladen, `failed_unload` hängt.
   Integrationen mit `not_loaded`, die der Nutzer ignoriert hat (Quelle `ignore`), sind harmlos.
5. Seit wann: `ha_get_history` für die Entität, der Verlauf reicht meist etwa zehn Tage zurück. Ein fester Zeitpunkt passt zu einer Änderung (Update, Stromausfall, Router-Neustart, Passwortwechsel). Ständiges Wechseln zwischen verfügbar und nicht verfügbar passt zu Funkproblemen oder schwacher Batterie. Die WLAN-Signalstärke (RSSI) legt die Shelly-Integration nur abgeschaltet an; einen Verlauf dazu gibt es erst, nachdem man die Entität aktiviert hat. Den Batteriestand des Geräts im Verlauf mit ansehen.
6. Logs: `ha_get_logs` mit `source="system"` und der Integration als Suchbegriff. Die erste Fehlermeldung zählt, Folgefehler danach sind Rauschen.
7. Was hat sich geändert: Update-Entitäten (`update.*`) und deren Verlauf, `ha_get_system_health`, neue oder umbenannte Entitäten. Eine geänderte Entitäts-ID bricht jede Automation und jedes Skript, das die alte ID verwendet; Home Assistant passt sie nicht an. Ein geänderter Anzeigename schadet nicht.
8. Wirkung: Wer benutzt die ausgefallene Entität? `ha_search` mit der genauen `entity_id` findet Automationen, Skripte und Helfer (etwa ein Thermostat, das einen Temperatursensor als Istwert nimmt). Erst danach lässt sich sagen, ob etwas Wichtiges betroffen ist, und die Priorität festlegen. Ein eingefrorener letzter Wert ist gefährlicher als ein fehlender, weil Regelungen dann mit ihm weiterarbeiten. Beispiel: Der Thermostat `generic_thermostat` übergeht einen Istwert `unavailable` und regelt mit der zuletzt gemeldeten Temperatur weiter, heizt also womöglich durch. Diese Warnung gehört in jede Antwort zu einem ausgefallenen Sensor, an dem eine Regelung hängen könnte.

## Erwartbar nicht verfügbar

Diese Fälle sehen aus wie Störungen, sind aber normal und brauchen höchstens Aufräumen:

- Entitäten, die es nur bei laufendem Programm gibt (Restlaufzeit, Programmfortschritt, Solltemperatur bei Hausgeräten), während kein Programm läuft.
- Geräte, die aus sind (Fernseher, Medienplayer über DLNA).
- Sensoren der Companion-App, die in der App nicht aktiviert sind oder denen eine Berechtigung fehlt. Meldet dasselbe Handy andere Werte normal, ist es das.
- Geräte, die sich länger nicht gemeldet haben (Tablet aus, Akku leer).
- Verwaiste Einträge mit `restored: true`.
- Deaktivierte Entitäten: `ha_get_device` listet sie, `ha_get_state` findet sie nicht.

## Automation hat nicht oder falsch ausgelöst

- `ha_config_get_automation` lesen und `ha_get_automation_traces` für den fraglichen Zeitpunkt holen.
- Kein Trace zum Zeitpunkt: Entweder hat der Auslöser nicht gefeuert, oder der Trace ist schon überschrieben, denn Home Assistant hebt standardmäßig nur die letzten fünf auf. Im Logbuch oder Verlauf gegenprüfen. Hat der Auslöser nicht gefeuert: Automation deaktiviert? Auslöser-Entität zu dem Zeitpunkt `unavailable`? Zustandswechsel, der gar nicht stattfand (etwa von `unknown` statt vom erwarteten Wert)?
- Trace vorhanden, aber abgebrochen: An welcher Bedingung ist er gestoppt, welche Aktion hat einen Fehler geworfen? Der Trace zeigt es.
- Modus der Automation: Bei `single` wird ein zweiter Auslöser verworfen, solange der erste läuft. Das steht dann als Warnung im Log.

## Eingriffe

| Eingriff | Stufe |
|---|---|
| Zustände, Verlauf, Logs, Traces lesen | 0 |
| Eine ausgefallene Integration neu laden (`ha_call_service` mit `homeassistant.reload_config_entry` und der `entry_id` aus `ha_get_integration`), wenn nur Geräte dieser Integration betroffen sind | 1 |
| Dasselbe bei einer Hub-Integration, an der viele Geräte hängen (Zigbee, Z-Wave, Matter, MQTT): alle Geräte daran sind kurz weg | 2 |
| Ein einzelnes hängendes Gerät über seinen Neustart-Knopf neu starten, wenn es nichts Wichtiges steuert | 1 |
| Aktionen, die im Haus etwas bewegen oder schalten: Rollos, Heizung, Licht bei Anwesenheit, Geräte wie Waschmaschine oder Backofen | 2 |
| Alarmanlage, Kameras, Sirene, Schlösser, Anwesenheitserkennung | 2, nie von dir aus entschärfen oder abschalten |
| Automation, Skript, Helfer, Dashboard ändern | 2, vorher Skill `home-assistant-best-practices` laden und prüfen, ob ein aktuelles Backup existiert |
| Home Assistant neu starten (`ha_restart`), Firmware- oder Core-Update | 2 |
| Entität deaktivieren oder ausblenden | 2 |
| Gerät, Entität oder Integration entfernen, Backup einspielen | 3 |
| Handgriffe vor Ort (Batterie tauschen, Gerät einschalten, Netzteil anschließen) | Vorschlag an den Nutzer |

Eine Automation zum Test manuell auszulösen (`automation.trigger`), führt ihre Aktionen wirklich aus, und zwar standardmäßig ohne ihre Bedingungen zu prüfen (`skip_condition` ist voreingestellt). Das ist so viel Stufe, wie die Aktionen haben.

## Häufige Ursachen

- Cloud-Integration: Anmeldung abgelaufen oder Dienst des Herstellers gestört. Repairs prüfen, Statusseite des Herstellers suchen.
- WLAN-Geräte: IP-Adresse hat sich geändert, Gerät hängt, Router hat den Zugang gesperrt. Siehe `netzwerk.md`.
- Funkgeräte (Zigbee, Z-Wave, Thread, Matter): schwache Batterie, Gerät außer Reichweite, Router-Geräte im Netz ausgeschaltet, Coordinator oder Bridge ausgefallen.
- Batteriegeräte mit WLAN oder Bluetooth, die zwischen den Meldungen schlafen (etwa Temperatursensoren): Batterie leer. Im Protokoll steht dann, dass sich das schlafende Gerät nicht im erwarteten Abstand gemeldet hat. Neuladen der Integration hilft hier nicht, nur eine neue Batterie oder ein Netzteil. Als Folgeaufgabe eine Warnung bei niedriger Batterie oder langer Funkstille vorschlagen.
- Wechselrichter, Zähler und andere lokale Integrationen: Gerät im Standby (etwa nachts), Verbindung zum Datenlogger verloren. Liefert die Integration dauerhaft alte Werte, hilft oft Neuladen; wiederholt sich das, eine Automation zur Selbstheilung vorschlagen statt jedes Mal von Hand neu zu laden.
- Nach einem Core-Update: Breaking Changes in den Release Notes der Version nachlesen, bevor irgendetwas geändert wird.

## Spezialisten

Firmware-Fragen (ESP32, ESPHome, Shelly, Tasmota): `engineering-embedded-firmware-engineer`. Viele Geräte gleichzeitig, Funknetz, OTA-Updates: `engineering-iot-fleet-engineer`.
