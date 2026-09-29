`INC-20260929-1030 | P4 | Smart Home | wartet auf Nutzer | Temperatursensor Büro (Shelly H&T) seit Tagen nicht verfügbar`

**Ist das schlimm?** Meist nicht. Der batteriebetriebene H&T schläft zwischen seinen Meldungen. Meldet er sich zu lange nicht, steht er auf „nicht verfügbar“. Häufigste Ursache: leere Batterie. Ich stufe das als P4 ein (ein einzelner Sensor, kann warten), unter der Annahme, dass nichts mit seinem Wert regelt. Einen früheren Journaleintrag dazu gibt es nicht.

**Die eine Ausnahme:** Nimmt eine Heizungsregelung im Büro diesen Sensor als Istwert, arbeitet sie womöglich mit dem letzten Wert von vor ein paar Tagen weiter. Der Generic Thermostat etwa übergeht „nicht verfügbar“ und regelt mit der alten Temperatur, heizt also im Zweifel durch oder gar nicht. Dann wird daraus P3.

**Zuerst, zwei Minuten:**

1. Wer hängt dran? Sensor antippen, dann ⋮ → Verwandt. Taucht dort ein Thermostat oder eine Heizungsautomation auf, stell die Heizung im Büro bis zur Reparatur von Hand ein (Thermostat auf Aus oder Handbetrieb).
2. Die Taste im Gerät (hinter dem Deckel) kurz drücken. Das weckt den Sensor, er misst und meldet sofort. Nicht lange halten, sonst kann er sich auf Werkseinstellungen zurücksetzen.
   - Keine Reaktion (LED blinkt nicht, Display ändert sich nicht): Batterie tauschen. Die erste Generation nimmt eine CR123A, Plus H&T und H&T Gen3 nehmen vier AA-Zellen, Gen3 geht auch an USB-C. Vorsicht: Das E-Paper-Display von Plus und Gen3 zeigt den letzten Wert auch bei leerer Batterie weiter an.
   - Er wacht auf, Home Assistant zeigt aber weiter nichts: Dann liegt es an WLAN oder Verbindung (Hypothese 2 und 3).

Integration neu laden oder Home Assistant neu starten hilft bei leerer Batterie nicht, das bitte vorerst lassen.

**Hypothesen**

1. Batterie leer, am wahrscheinlichsten. Erkennbar im Verlauf an der Batterie-Entität des Geräts, die bis zum Ausfall sinkt, und im Protokoll (Einstellungen → System → Protokolle, Suche „shelly“) an „Sleeping device did not update within … seconds interval“.
2. WLAN geändert oder Sensor außer Reichweite (neuer Router oder Repeater, WLAN-Passwort). Erkennbar daran, dass der Sensor nach dem Tastendruck nicht in der Geräteliste des Routers auftaucht oder der letzte Signalwert (RSSI) im Verlauf schwach war, obwohl die Batterie noch voll war.
3. Der Sensor erreicht Home Assistant nicht mehr, etwa weil dessen IP-Adresse sich geändert hat. Erkennbar daran, dass der Sensor im Router auftaucht, Home Assistant aber nichts bekommt. Bei Plus und Gen3 muss in den Geräteeinstellungen unter Outbound WebSocket die aktuelle Adresse stehen (`ws://<IP von Home Assistant>:8123/api/shelly/ws`), bei der ersten Generation als CoIoT-Peer (`<IP>:5683`).
4. Eintrag in Home Assistant verwaist oder Integration hängt. Erkennbar an `restored: true` in der Ausgabe unten oder an einer Fehlermeldung beim Shelly-Eintrag unter Einstellungen → Geräte & Dienste.

**Zum Nachsehen** in Entwicklerwerkzeuge → Vorlage einfügen, in der ersten Zeile die Entitäts-ID des Sensors einsetzen. Nur lesend, zeigt alle Entitäten des Geräts mit Zustand und letzter Änderung:

```jinja
{% set sensor = 'sensor.ENTITAETS_ID_EINSETZEN' %}
{% for s in expand(device_entities(device_id(sensor))) %}
{{ s.entity_id }}: {{ s.state }} | seit {{ s.last_changed | as_local }} | restored: {{ s.attributes.restored | default(false) }}
{% endfor %}
```

Bei `unavailable` ist „seit“ der Ausfallzeitpunkt, sofern Home Assistant seitdem nicht neu gestartet wurde.

**Was ich von dir brauche**

- was beim Tastendruck passiert ist,
- die Ausgabe der Vorlage und das Modell von der Geräteseite (H&T, Plus H&T oder H&T Gen3),
- den letzten Batteriewert vor dem Ausfall aus dem Verlauf und die Protokollzeile, falls vorhanden,
- was unter „Verwandt“ steht.

Und eine Frage: Hat sich vor ein paar Tagen etwas geändert, etwa Router, WLAN-Passwort, ein Home-Assistant-Update oder die IP-Adresse von Home Assistant?

Wenn der Sensor wieder läuft, richte ich dir auf Wunsch eine Benachrichtigung bei niedriger Batterie oder längerer Funkstille ein, damit so ein Ausfall nicht erst nach Tagen auffällt.

Quellen:
- [Home Assistant: Shelly-Integration](https://www.home-assistant.io/integrations/shelly/)
- [home-assistant/core #101570](https://github.com/home-assistant/core/issues/101570) (Protokollmeldung)
- [Shelly Support: Aufwachschema des Plus H&T](https://support.shelly.cloud/en/support/solutions/articles/103000044262-what-are-the-wake-up-schemes-and-reports-of-shelly-plus-h-t)
- [Shelly Knowledge Base: H&T Gen3](https://kb.shelly.cloud/knowledge-base/shelly-h-t-gen3)
- [home-assistant/core #63419](https://github.com/home-assistant/core/issues/63419) (Generic Thermostat bei Sensorausfall)
