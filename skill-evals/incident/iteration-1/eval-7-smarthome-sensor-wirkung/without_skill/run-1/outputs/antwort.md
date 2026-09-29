Meistens ist das nicht schlimm. Wenn ein batteriebetriebener Shelly H&T mehrere Tage am Stück „nicht verfügbar“ ist, sind in den allermeisten Fällen die Batterien leer oder er kommt nicht mehr ins WLAN. Kaputt ist selten etwas, und deinem Home Assistant schadet das nicht. Es fehlt einfach der Messwert.

Wichtig wird es nur, wenn etwas an dem Sensor hängt: eine Heizungsautomation fürs Büro, ein Lüftungs- oder Schimmelhinweis über die Luftfeuchte, ein Mittelwert über mehrere Räume. Solche Automationen laufen im Moment blind. Sie lösen nicht aus oder arbeiten mit einem alten Wert. Jetzt, wo die Heizsaison anfängt, würde ich das also nicht wochenlang liegen lassen. Dringend ist es aber nicht.

So würde ich vorgehen:

**1. In Home Assistant nachsehen (dauert zwei Minuten)**

- Öffne das Gerät (Einstellungen → Geräte & Dienste → Shelly → dein Büro-H&T) und schau dir den Verlauf der **Batterie-Entität** an. Ist der Wert vor dem Ausfall Richtung 0–10 % gefallen, ist die Sache praktisch klar.
- Achte darauf, **wann** der Sensor auf „nicht verfügbar“ gesprungen ist. Passt der Zeitpunkt zu etwas anderem, etwa einem HA-Update, einem neuen oder neu gestarteten Router, einem geänderten WLAN-Passwort oder einem Stromausfall?
- Sind **andere Shellys** auch weg, vor allem andere batteriebetriebene? Wenn ja, liegt es eher am Netzwerk oder an HA als am Sensor selbst.
- Schau unter Einstellungen → System → **Reparaturen**, ob dort ein Hinweis zu diesem Shelly steht (zum Beispiel zu „Outbound WebSocket“).

**2. Am Sensor selbst**

- Welches Modell hast du? Der H&T der ersten Generation hat kein Display und läuft mit einer CR123A-Batterie. Der Plus H&T und der H&T Gen3 haben ein E-Ink-Display und laufen mit 4× AA (oder per USB).
- Vorsicht beim Display: E-Ink zeigt den letzten Wert auch dann noch an, wenn die Batterien längst leer sind. Eine Zahl auf dem Display heißt also nicht, dass der Sensor noch arbeitet.
- Drück **kurz** den Knopf am Gerät. Damit wacht er auf und meldet sich sofort bei HA. Reagiert er gar nicht (keine LED, keine Änderung am Display), sind es fast sicher die Batterien. Den Knopf nicht lange gedrückt halten, das setzt je nach Modell die WLAN-Einstellungen oder das ganze Gerät zurück.

**3. Batterien tauschen**

- Neue Batterien rein, danach kurz den Knopf drücken, damit er sich gleich meldet und nicht erst beim nächsten regulären Aufwachen.
- Kurz darauf sollte der Sensor in HA wieder Werte zeigen. Dann bist du fertig.

**4. Falls er auch mit neuen Batterien nicht zurückkommt**

- Im Router nachsehen, ob sich der Shelly nach dem Knopfdruck ins WLAN verbindet. Er ist immer nur kurz online. Typische Ursachen: neues WLAN-Passwort, getauschter Router, ein WLAN, das nur noch 5 GHz oder nur WPA3 anbietet (der Shelly braucht 2,4 GHz), oder schlechter Empfang im Büro.
- Wenn er im WLAN auftaucht: Knopf drücken und sofort seine IP-Adresse im Browser öffnen (die Weboberfläche ist nur erreichbar, solange er wach ist).
  - **Plus H&T / Gen3:** Unter Settings → Outbound WebSocket muss die Verbindung aktiv sein und auf `ws://<IP deines HA>:8123/api/shelly/ws` zeigen. Hat sich die IP deines Home Assistant geändert, schickt der Sensor seine Daten ins Leere.
  - **H&T Gen1:** Unter den erweiterten Entwicklereinstellungen (CoIoT) prüfen, ob als Peer gegebenenfalls `<IP deines HA>:5683` eingetragen ist.
- In HA unter Einstellungen → System → Protokolle nach „shelly“ suchen. Eine Meldung wie „Sleeping device did not update within … seconds“ bedeutet nur, dass HA nichts vom Gerät gehört hat. Das passt zu Batterie- oder WLAN-Problemen.
- Die Shelly-Integration für dieses Gerät neu laden (drei Punkte → Neu laden) und danach wieder den Knopf am Sensor drücken.

**Für das nächste Mal:** Eine kleine Automation, die dich benachrichtigt, wenn die Batterie unter etwa 20 % fällt oder der Sensor länger als ein paar Stunden nicht verfügbar ist. Dann fällt dir so etwas früher auf.

Sag mir gern, welches Modell es ist und was der Batterieverlauf zeigt, dann kann ich es genauer eingrenzen.

Quellen:
- [Shelly-Integration, Home Assistant Doku](https://www.home-assistant.io/integrations/shelly/)
- [Plus-Batteriegeräte in Home Assistant einbinden (shelly.guide)](https://shelly.guide/home-assistant/add-plus-battery-devices-into-home-assistant/)
- [GitHub-Issue: „Sleeping device did not update within 7200 seconds interval“](https://github.com/home-assistant/core/issues/101570)
