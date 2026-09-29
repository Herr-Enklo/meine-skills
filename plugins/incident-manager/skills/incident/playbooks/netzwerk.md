# Playbook: Netzwerk

Für "Internet geht nicht", "Seite lädt nicht", WLAN, DNS, DHCP, VPN, einzelne Geräte ohne Verbindung.

## Eingrenzen

Erst klären: ein Gerät oder alle? Ein Dienst oder alles? LAN, WLAN oder beides? Zuhause, Büro oder unterwegs? Die Antwort halbiert die Suche schon: alle Geräte betroffen heißt Router, Leitung oder Anbieter; ein Gerät heißt Gerät, Treiber, Kindersicherung oder Adresse.

Dann Schicht für Schicht von unten, und bei der ersten Schicht stehen bleiben, die versagt:

| Schicht | Windows (PowerShell) | Linux und macOS | Befund |
|---|---|---|---|
| Verbindung | `Get-NetAdapter` | `ip link` bzw. `ifconfig` | Adapter aus oder getrennt |
| Adresse | `ipconfig /all` | `ip addr` bzw. `ifconfig` | Adresse `169.254.x.x` heißt: kein DHCP |
| Gateway | `Test-Connection <Gateway> -Count 3` | `ping -c 3 <Gateway>` | Gateway nicht erreichbar: lokales Netz oder Router |
| Internet per IP | `Test-Connection 1.1.1.1 -Count 3` | `ping -c 3 1.1.1.1` | geht per IP, aber nicht per Name: DNS |
| Namensauflösung | `Resolve-DnsName example.com` und `Resolve-DnsName example.com -Server 1.1.1.1` | `dig example.com` und `dig @1.1.1.1 example.com` | nur mit fremdem DNS-Server erfolgreich: eigener DNS-Server gestört |
| Dienst | `Test-NetConnection example.com -Port 443` | `curl -sS -o /dev/null -w '%{http_code}\n' https://example.com` | Port zu oder Dienst antwortet falsch |
| Weg | `tracert -d 1.1.1.1` | `traceroute -n 1.1.1.1` | wo die Pakete hängen bleiben |

`example.com` durch den betroffenen Dienst ersetzen. Ping kann von Firewalls gesperrt sein; ein fehlendes Echo allein beweist keinen Ausfall.

## Router und Anbieter

- Ist eine FRITZ!Box in Home Assistant eingebunden, zeigt die Integration den Verbindungsstatus zum Internet, die externe IP und zwei Betriebszeiten. Die Betriebszeit des Geräts springt nur bei einem Neustart des Routers zurück (Stromausfall, Firmware-Update). Die Betriebszeit der Verbindung springt bei jeder Neueinwahl zurück, auch bei der Zwangstrennung durch den Anbieter. Über `ha_search` nach der Integration suchen, nicht nach geratenen Entitätsnamen.
- Hat nur ein einzelnes Gerät kein Internet, bei eingebundener FRITZ!Box den Schalter für den Internetzugang dieses Geräts prüfen (Kindersicherung, Zugangsprofil). Einschalten ist Stufe 1, wenn der Nutzer das Gerät selbst betreut; sonst fragen, denn jemand hat die Sperre vielleicht mit Absicht gesetzt.
- Router neu starten unterbricht das ganze Haus oder Büro: Stufe 2, vorher fragen.
- Anbieterstörung: Websuche nach "Störung <Anbieter> <Ort>" und nach der Störungsseite des Anbieters. Den Anbieter vom Nutzer erfragen, wenn er nicht im Gedächtnis steht.

## WLAN

Nur WLAN betroffen, LAN geht: Frequenzband (2,4 oder 5 GHz), Abstand, Kanal, zu viele Geräte, Mesh-Repeater. Unter Windows zeigt `netsh wlan show interfaces` Signalstärke, Band und Übertragungsrate. Bei einzelnen Geräten: WLAN vergessen und neu verbinden, Treiber, Energiesparmodus des Adapters.

## VPN

Geht die Verbindung auf, aber Dienste dahinter nicht: Routen (`route print` bzw. `ip route`) und DNS-Server im Tunnel prüfen. Verbindet sich der Client gar nicht: Zertifikat abgelaufen, Konto gesperrt, MFA, Uhrzeit des Geräts falsch. Bei Firmen-VPN früh an den zuständigen Support übergeben, weil die Gegenstelle nur dort sichtbar ist.

## Spezialist

Router, Switches und Firewalls im Unternehmen (Cisco, Juniper, Palo Alto): Agent `engineering-network-engineer`, mit der Befundtabelle von oben als Übergabe.
