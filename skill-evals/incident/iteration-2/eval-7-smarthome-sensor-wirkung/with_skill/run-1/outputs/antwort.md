`INC-20260929-1030 | P4 | Smart Home | wartet auf Nutzer | Temperatursensor Büro (Shelly H&T) seit Tagen nicht verfügbar`

**Ist das schlimm?** Der Sensor allein meist nicht. Ein Batteriesensor, der tagelang schweigt, hat meistens eine leere Batterie. Wichtig wird es, wenn etwas an ihm hängt: Nimmt ein Thermostat oder eine Heizungsautomation ihn als Istwert, oder hängt eine Lüftungs-, Schimmel- oder Frostwarnung daran, arbeiten die gerade ohne Wert. Sie lösen nicht aus oder bleiben im letzten Zustand. Kurz vor der Heizsaison würde ich das zuerst klären.

Priorität P4 (Annahme): ein einzelnes Gerät, Dringlichkeit niedrig. Hängt eine Heizungsregelung dran, wird es P3. Frühere Incidents dazu kenne ich nicht, in dieser Sitzung gibt es kein Journal.

**Sofortmaßnahme** nur, falls die Heizung im Büro über diesen Sensor geregelt wird: bis er wieder läuft, dort von Hand heizen.

**Hypothesen**
1. Batterie leer (am wahrscheinlichsten): Der Batteriewert fiel vor dem Ausfall ab, der Sensor reagiert nicht auf Tastendruck.
2. WLAN (Router, Repeater, Passwort oder Kanal geändert, Reichweite): Batterie war zuletzt gut, der Sensor wacht auf, taucht aber nicht in der Geräteliste des Routers auf.
3. Falsche Zieladresse: Schlafende Shellys melden sich selbst bei HA, der alte H&T (Gen1) über den CoIoT-Peer `<HA-IP>:5683`, Plus H&T und H&T Gen3 über den Outbound-WebSocket `ws://<HA-IP>:8123/api/shelly/ws`. Hat HA eine neue IP bekommen, kommt nichts mehr an. Erkennbar: Sensor im WLAN sichtbar, in HA kein Wert.
4. Shelly-Integration gestört, etwa nach einem Update: Andere Shelly-Sensoren sind auch weg, unter Einstellungen → System → Reparaturen steht etwas zu Shelly.

Geprüft habe ich ohne Zugriff auf dein HA nur Doku und bekannte Fehler. Eine aktuelle Sammelstörung der Shelly-Integration für H&T-Sensoren habe ich nicht gefunden.

**Was du prüfen solltest, in dieser Reihenfolge**
1. **Wer benutzt den Sensor?** Sensor in HA öffnen, oben rechts ⋮ → „Verwandt". Dort stehen Automationen, Skripte und Szenen, die ihn verwenden. Das beantwortet „schlimm oder nicht".
2. **Verlauf:** Einstellungen → Geräte & Dienste → Shelly → das Gerät (dort steht auch das Modell). Beim Temperatur- und Batteriesensor den Verlauf öffnen: Wann genau war der Ausfall, wie hoch war die Batterie zuletzt, gab es vorher Lücken?
3. **Umfang:** die Vorlage unten unter Entwicklerwerkzeuge → Vorlage einfügen. Sie liest nur und listet Temperatur, Luftfeuchte und Batterie aller Shelly-Geräte. Nur das Büro `unavailable`: Gerät. Alle weg: HA oder Netz. „seit" zeigt nach einem HA-Neustart dessen Startzeit, genauer ist der Verlauf.
4. **Am Gerät:** die Taste einmal kurz drücken (Plus H&T und Gen3: hinter der Rückabdeckung). Nicht halten, das öffnet den Access Point oder setzt ihn zurück (Gen1: 5 bzw. 10 Sekunden). Keine Reaktion (Display bleibt alt, Gen1-LED bleibt aus): Batterie. Wacht auf, in HA kommt nichts: Hypothese 2 oder 3. Wert kommt in HA an: Batteriestand ansehen.
5. **Batterie tauschen**, wenn nichts passiert oder der letzte Batteriewert niedrig war: Gen1 eine CR123A, Plus H&T und Gen3 vier AA. Integration neu laden oder HA neu starten hilft bei leerer Batterie nicht.
6. **Nur wenn er trotz frischer Batterie ausbleibt:** Einstellungen → System → Protokolle nach „shelly" durchsuchen („Sleeping device did not update within … seconds" heißt nur, dass nichts kam). Dann Router-Geräteliste und die im Sensor eingetragene HA-Adresse prüfen.

```jinja
{%- set shelly = integration_entities('shelly') %}
{%- for s in states.sensor if s.entity_id in shelly
    and s.attributes.device_class in ['temperature', 'humidity', 'battery'] %}
{{ s.name }} | {{ s.entity_id }} | {{ area_name(s.entity_id) or '-' }} | {{ s.state }} {{ s.attributes.unit_of_measurement | default('') }} | seit {{ as_local(s.last_changed).strftime('%d.%m. %H:%M') }}{{ ' | restored' if s.attributes.restored is defined else '' }}
{%- endfor %}
```

**Was ich von dir brauche**
- Was „Verwandt" zeigt, vor allem ob ein Thermostat oder eine Heizungsautomation dabei ist.
- Modell, letzter Batteriewert und Ausfallzeitpunkt aus dem Verlauf.
- Ob nach Tastendruck oder Batterietausch wieder Werte kommen; sonst die Ausgabe der Vorlage und die erste Shelly-Zeile aus dem Protokoll.

Folgeaufgabe: Benachrichtigung bei Batterie unter etwa 20 % oder wenn ein Sensor mehrere Stunden nicht verfügbar ist. Die richte ich dir gern ein.

Quellen:
- [Home Assistant: Shelly-Integration (schlafende Geräte, CoIoT-Peer, Outbound-WebSocket)](https://www.home-assistant.io/integrations/shelly/)
- [home-assistant/core #101570: „Sleeping device did not update within 7200 seconds interval"](https://github.com/home-assistant/core/issues/101570)
- [Shelly KB: Shelly H&T (Gen1), CR123A, Taste 5 s / 10 s](https://kb.shelly.cloud/knowledge-base/shelly-h-t)
- [Shelly KB: Shelly Plus H&T, 4× AA, Taste hinter der Abdeckung](https://kb.shelly.cloud/knowledge-base/shelly-plus-h-t)
- [Shelly KB: Shelly H&T Gen3, 4× AA, meldet sich spätestens alle zwei Stunden](https://kb.shelly.cloud/knowledge-base/shelly-h-t-gen3)
