Das ist eine Großstörung mit höchster Priorität: ein ganzer Standort, rund 60 Leute, seit 8 Uhr. Die beiden Meldungen zusammen sprechen nicht für 60 einzelne kaputte PCs, sondern für ein gemeinsames Problem in Leipzig. Am wahrscheinlichsten liegt es am dortigen Domänencontroller (DC) oder an der Verbindung dorthin.

- **„Es ist momentan kein Anmeldeserver verfügbar“**: Der PC erreicht keinen DC, und der Benutzer hat auf diesem Gerät keine zwischengespeicherte Anmeldung.
- **„Die Vertrauensstellung … konnte nicht hergestellt werden“**: Der PC erreicht einen DC, aber der lehnt das Computerkonto ab. Das passiert typischerweise, wenn der DC einen veralteten Datenstand hat (aus Snapshot oder Backup zurückgesetzt, Replikation länger kaputt) oder wenn Computerkonten gelöscht oder deaktiviert wurden.

**Bitte vorerst keine PCs aus der Domäne nehmen und neu aufnehmen.** Liegt es am DC, machst du die Lage damit schlimmer. Ist der DC repariert, melden sich die meisten PCs von selbst wieder normal an.

## Erste Prüfungen von der Zentrale aus

**1. Welche DCs bedienen Leipzig, und sind sie erreichbar?**

```
nltest /dclist:<domäne>
Test-NetConnection <DC-Leipzig> -Port 389
```

Steht die WAN- bzw. VPN-Strecke nach Leipzig? Ist der DC dort ein normaler DC oder ein RODC?

**2. Zustand des Leipziger DCs**

```
dcdiag /s:<DC-Leipzig> /q
repadmin /replsummary
repadmin /showrepl <DC-Leipzig>
w32tm /stripchart /computer:<DC-Leipzig> /samples:3 /dataonly
```

In der Ereignisanzeige des Leipziger DCs:

- Verzeichnisdienst, ID 2095 oder 2103: USN-Rollback, die AD-Datenbank wurde auf nicht unterstütztem Weg zurückgesetzt (z. B. Snapshot oder Image-Restore). Netlogon ist dann meist angehalten.
- System, Netlogon 5722 oder 5805: Computerkonten scheitern bei der Anmeldung am DC. Das ist das Gegenstück zur Vertrauensstellungs-Meldung auf den Clients.
- Weicht die Uhrzeit mehr als 5 Minuten von der Zentrale ab, scheitert Kerberos.

**3. Hat der Leipziger DC alte Daten?** Nimm einen betroffenen PC und vergleiche:

```powershell
Get-ADComputer <PC-Leipzig> -Server <DC-Leipzig> -Properties PasswordLastSet,Enabled
Get-ADComputer <PC-Leipzig> -Server <DC-Zentrale> -Properties PasswordLastSet,Enabled
```

Weicht `PasswordLastSet` ab, arbeitet der Leipziger DC mit einem alten Stand. Fehlt das Objekt auf beiden oder steht `Enabled` auf False, liegt es am Computerkonto selbst.

**4. Wurden Computerkonten gelöscht oder deaktiviert?**

```powershell
Get-ADObject -Filter 'isDeleted -eq $true -and objectClass -eq "computer"' -IncludeDeletedObjects -Properties whenChanged,lastKnownParent |
  Where-Object { $_.whenChanged -gt (Get-Date).AddDays(-2) }

Search-ADAccount -AccountDisabled -ComputersOnly | Where-Object { $_.DistinguishedName -like '*Leipzig*' }
```

(Den OU-Namen im zweiten Befehl ggf. anpassen.)

**5. Was hat sich seit gestern Abend geändert?** Updates oder Neustart am DC, Wiederherstellung aus Backup oder Snapshot, Arbeiten am Hypervisor oder Storage in Leipzig, Änderungen an Firewall oder VPN, Skripte zum Aufräumen alter Computerkonten, neue GPOs.

Falls sich jemand in Leipzig mit einem lokalen Admin-Konto (z. B. LAPS) an einem betroffenen PC anmelden kann, helfen diese drei Ausgaben sehr:

```
ipconfig /all
nltest /dsgetdc:<domäne>
nltest /sc_query:<domäne>
```

Daran siehst du, welche DNS-Server der PC hat, welchen DC er findet und was der sichere Kanal meldet.

## Was je nach Befund zu tun ist

- **Leipziger DC hat einen alten Stand** (Punkt 3 weicht ab, Event 2095/2103): DC sofort vom Netz nehmen (herunterfahren oder Netzwerk trennen), nicht einfach neu starten. Die Clients weichen dann auf die DCs der Zentrale aus, sofern die WAN-Strecke steht und per DHCP ein DNS-Server der Zentrale als zweiter DNS verteilt wird. Den DC danach nicht einfach wieder einschalten, sondern zwangsweise herabstufen, Metadaten bereinigen und neu hochstufen.
- **DC aus oder Dienste gestoppt** (NTDS, Netlogon, KDC, DNS): Server bzw. Dienste starten und die Ursache im Log suchen. Prüfen, ob die Clients einen zweiten DNS-Server in der Zentrale haben, sonst finden sie ohne den Leipziger DC gar keinen DC.
- **WAN/VPN nach Leipzig gestört, und dort steht kein eigener DC oder nur ein RODC**: Provider bzw. Firewall angehen. Bei einem RODC kommen nur Konten durch, deren Kennwörter dort zwischengespeichert sind. Das würde das gemischte Fehlerbild gut erklären.
- **Computerkonten gelöscht**: Aus dem AD-Papierkorb wiederherstellen (AD-Verwaltungscenter oder `Restore-ADObject`, bei gelöschter OU zuerst die OU). Danach stimmt die Vertrauensstellung wieder, eine Neuaufnahme ist nicht nötig.
- **Computerkonten deaktiviert**: Wieder aktivieren.
- **Uhrzeit auf dem DC falsch**: Zeitquelle korrigieren und mit `w32tm /resync` nachziehen, bei einer VM die Zeitsynchronisation des Hypervisors prüfen.

Einzelne PCs, die danach noch hängen, reparierst du ohne Neuaufnahme. Als lokaler Admin in Windows PowerShell:

```powershell
Test-ComputerSecureChannel -Repair -Credential <domäne>\<admin>
```

## Überbrückung, falls es länger dauert

Wer sich an seinem PC schon früher angemeldet hat, kommt bei der Vertrauensstellungs-Meldung oft mit den zwischengespeicherten Anmeldedaten hinein, wenn vor der Anmeldung das Netzwerkkabel gezogen bzw. das WLAN aus ist. Danach Kabel wieder einstecken. Browser und Cloud-Dienste gehen dann meist, Netzlaufwerke und Drucker eher nicht.

## Kommunikation

- Die Leute in Leipzig kommen gerade nicht an ihre Mails. Informiere sie deshalb telefonisch über die Standortleitung: Störung ist bekannt und in Arbeit, bitte nicht selbst an den PCs herumreparieren, nächste Info um 9:00 Uhr.
- Leg einen Ansprechpartner vor Ort fest, der für dich an einem PC oder im Serverraum nachsehen kann.
- Ticket mit Priorität 1 anlegen und Beginn (ca. 8:00), Meldung (8:25) sowie jeden Schritt mit Uhrzeit notieren. Das brauchst du später für die Nachbetrachtung.

Schick mir die Ergebnisse von Punkt 1 bis 3 und sag mir, ob in Leipzig ein normaler DC oder ein RODC steht und ob dort heute Nacht etwas gemacht wurde. Dann grenzen wir die Ursache weiter ein.
