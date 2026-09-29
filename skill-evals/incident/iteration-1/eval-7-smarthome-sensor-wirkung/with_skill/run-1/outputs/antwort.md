`INC-20260929-1030 | P4 | Smart Home | wartet auf Nutzer | Büro-Temperatursensor (Shelly H&T) seit Tagen nicht verfügbar`

**Ist das schlimm?** Der Sensor selbst wahrscheinlich nicht. Wenn ein batteriebetriebener Shelly H&T mehrere Tage am Stück fehlt, ist meistens die Batterie leer. Ob es schlimm ist, hängt davon ab, was den Wert benutzt. Nutzt eine Heizungsregelung oder Automation die Bürotemperatur, fehlt ihr gerade die Grundlage. Schlimmer ist, wenn sie mit dem letzten Wert weiterregelt: Der Generic Thermostat hat in älteren Versionen genau das gemacht und die letzte Temperatur behalten, also weitergeheizt, obwohl der Sensor weg war (Issue #63419). Ob das in deiner Version schon behoben ist, habe ich nicht geprüft. Vom selben Gerät fehlt auch die Luftfeuchte. Das ist wichtig, falls eine Lüftung oder Schimmelwarnung daran hängt.

Priorität P4 ist eine Annahme: ein einzelnes Gerät, das nur etwas anzeigt. Zeigt Schritt 1 eine Heizungsregelung, stufe ich auf P3 hoch, weil Ende September die Heizperiode anfängt. Dann solltest du als Sofortmaßnahme das betroffene Thermostat bis zur Reparatur auf feste Temperatur oder manuell stellen, damit es nicht mit einem alten Wert regelt. Das entscheidest du.

**Vermutungen, die wahrscheinlichste zuerst**

1. Batterie leer. Das passt, weil das Gerät dauerhaft weg ist und nicht mal da, mal weg. Du erkennst es daran, dass der Batteriewert im Verlauf vor dem Ausfall niedrig war oder deutlich gefallen ist und das Gerät nicht auf einen Tastendruck reagiert.
2. Etwas am WLAN hat sich geändert: neuer Router oder Repeater, neues WLAN-Passwort oder neue SSID, 2,4 GHz abgeschaltet (Shellys funken nur auf 2,4 GHz). Dafür spricht ein harter Abbruch zu einem festen Zeitpunkt, obwohl die Batterie vorher gut war. Oft fehlen dann auch andere Shellys.
3. Das Gerät funkt, aber Home Assistant bekommt nichts an. Schlafende Shellys schicken ihre Werte selbst an Home Assistant: der H&T der ersten Generation per CoIoT an `<HA-IP>:5683`, Plus H&T und H&T Gen3 per Outbound WebSocket an `ws://<HA-IP>:8123/api/shelly/ws`. Hat Home Assistant eine neue IP oder einen anderen Port bekommen, zeigt der Sensor in seiner eigenen Weboberfläche aktuelle Werte, in Home Assistant aber nicht.
4. Verwaiste Entität: Wurde das Gerät neu eingebunden, liefert eine neue Entität (oft mit `_2` am Ende) die Werte, und die alte bleibt stehen. Das erkennst du am Attribut `restored`.

**Was du prüfen sollst, in dieser Reihenfolge**

1. Wirkung und Zustand, nur lesend. Öffne Entwicklerwerkzeuge → Template, ersetz den Inhalt links durch den Block unten und trag in der ersten Zeile die Entitäts-ID des Bürosensors ein. Die ID siehst du, wenn du den Sensor anklickst und auf das Zahnrad gehst.

```jinja
{% set e = 'sensor.HIER_ENTITAETS_ID' %}
{% set dev = device_id(e) %}
Gerät: {{ device_attr(dev, 'name') }} | Modell: {{ device_attr(dev, 'model') }} | Firmware: {{ device_attr(dev, 'sw_version') }}
Automationen am Gerät: {{ automations_with_device(dev) | join(', ') or 'keine' }}
{% for s in expand(device_entities(dev) | select('match', 'sensor.')) %}
- {{ s.entity_id }}: {{ s.state }} seit {{ as_local(s.last_changed).strftime('%d.%m. %H:%M') }}{{ ' | restored' if s.attributes.get('restored') else '' }}
  Automationen: {{ automations_with_entity(s.entity_id) | join(', ') or 'keine' }} | Skripte: {{ scripts_with_entity(s.entity_id) | join(', ') or 'keine' }}
{% endfor %}
Shelly gesamt: {{ integration_entities('shelly') | select('is_state', 'unavailable') | list | count }} von {{ integration_entities('shelly') | count }} Entitäten nicht verfügbar
Thermostate:
{% for c in states.climate %}- {{ c.entity_id }}: {{ c.state }}, Ist {{ c.attributes.current_temperature }} °C
{% else %}- keine
{% endfor %}
```

   So liest du die Ausgabe:
   - Stehen bei Automationen oder Skripten Einträge, hängen diese am Sensor. Dann schau nach, was sie mit dem Wert machen.
   - Zeigt ein Thermostat als Ist genau den letzten Wert des Sensors und ändert sich dieser seit Tagen nicht, regelt es mit einem eingefrorenen Wert. Thermostat-, Min/Max- oder Template-Helfer tauchen in der Liste nicht auf. Die findest du unter Einstellungen → Geräte & Dienste → Helfer.
   - `restored` spricht für Vermutung 4.
   - Sind viele Shelly-Entitäten nicht verfügbar, liegt es wohl nicht am Sensor, sondern am WLAN oder an Home Assistant (Vermutung 2 oder 3).
   - Das Modell verrät, welche Batterie du brauchst.
   - Entspricht die Zeit bei „seit" dem letzten Neustart von Home Assistant, hat der Neustart sie überschrieben. Dann hilft Schritt 2.

2. Öffne den Verlauf in der Seitenleiste und wähl Temperatur, Luftfeuchte und Batterie dieses Geräts für die letzten zehn Tage. War die Batterie vor dem Ausfall niedrig oder ist sie gefallen, spricht das für Vermutung 1. Ist sie gut und bricht alles zu einem festen Zeitpunkt ab, spricht das für Vermutung 2 oder 3. Überleg dann, was an dem Tag war. Ein häufiges Hin und Her vor dem Ausfall passt zu schwachem WLAN oder einer schwachen Batterie.

3. Unter Einstellungen → System → Protokolle nach „shelly" filtern. Die Meldung „Sleeping device did not update within … seconds interval" heißt nur, dass sich das Gerät nicht gemeldet hat. Sie bestätigt die Funkstille, verrät aber nicht den Grund. Andere Fehler, in denen der Name oder die IP des Sensors steht, schick mir bitte mit. Schau auch kurz unter Einstellungen → System → Reparaturen, ob dort etwas zu Shelly steht.

4. Vor Ort: Drück die Taste am Sensor einmal kurz, halt sie aber nicht gedrückt, weil langes Drücken einen Shelly auf Werkseinstellungen zurücksetzen kann.
   - Reagiert er nicht (keine LED, keine Änderung an der Anzeige), tausch die Batterie. Der H&T der ersten Generation braucht eine CR123A, Plus H&T und H&T Gen3 brauchen 4× AA. Plus und Gen3 kannst du auch dauerhaft über USB-C versorgen.
   - Reagiert er und hat Home Assistant ein, zwei Minuten später wieder Werte, lebt er. Dann schau dir den Batteriewert an.
   - Reagiert er, aber Home Assistant zeigt weiter „nicht verfügbar", liegt Vermutung 2 oder 3 nahe. Prüf in der Geräteliste deines Routers, ob der Shelly im WLAN auftaucht. Wenn ja, öffne seine Weboberfläche über die IP, solange er wach ist, und prüf nur, ob die Adresse von Home Assistant stimmt. Bei der ersten Generation steht sie unter Internet & Security → CoIoT, bei Plus und Gen3 unter Settings → Connectivity → Outbound WebSocket. Ändere sie erst, wenn sie nachweislich falsch ist.
   - Beim H&T Gen3 schaltet ein Tastendruck laut Hersteller in den Setup-Modus und ein zweiter zurück in den Schlafmodus. Schalt ihn danach also wieder zurück.

Die Integration neu zu laden oder Home Assistant neu zu starten hilft bei einer leeren Batterie nicht. Das kannst du dir sparen.

**Woran du erkennst, dass es wieder läuft:** Temperatur, Luftfeuchte und Batterie zeigen in Home Assistant wieder Werte mit aktuellem Zeitstempel, nach einem Batteriewechsel mit hohem Batteriestand. Morgen sollten sie immer noch da sein, weil der Sensor sich zwischendurch selbst meldet.

**Was ich von dir brauche**

1. Die Ausgabe des Templates und aus dem Verlauf den letzten Batteriewert vor dem Ausfall mit Datum und Uhrzeit.
2. Hat sich in den Tagen davor etwas geändert: Router, WLAN-Passwort, Update von Home Assistant, neue IP von Home Assistant, Stromausfall?
3. Was beim Tastendruck passiert ist.

Folgeaufgabe: eine Benachrichtigung bei niedriger Batterie oder wenn der Sensor ein paar Stunden nicht verfügbar ist. Die richte ich dir gern ein, sobald ich Zugriff habe, vorher stimme ich sie mit dir ab.
Ein Incident-Journal gibt es in dieser Sitzung nicht, frühere gleiche Fälle kann ich also nicht nachsehen.

Quellen:
- Shelly-Integration in Home Assistant (batteriebetriebene Geräte per Taste wecken, Outbound WebSocket, CoIoT): https://www.home-assistant.io/integrations/shelly/
- Gen1-Batteriegeräte und CoIoT-Peer auf Port 5683: https://shelly.guide/home-assistant/add-gen1-battery-devices-into-home-assistant/
- Logmeldung „Sleeping device did not update within 7200 seconds interval": https://github.com/home-assistant/core/issues/101570
- Generic Thermostat regelt bei Sensorausfall mit dem letzten Wert weiter: https://github.com/home-assistant/core/issues/63419, Änderungsvorschlag dazu: https://github.com/home-assistant/core/pull/167290
- Shelly H&T Gen3 (4× AA oder USB-C, Tastenfunktionen): https://kb.shelly.cloud/knowledge-base/shelly-h-t-gen3
- Shelly Plus H&T (4× AA oder USB-C): https://kb.shelly.cloud/knowledge-base/shelly-plus-h-t
