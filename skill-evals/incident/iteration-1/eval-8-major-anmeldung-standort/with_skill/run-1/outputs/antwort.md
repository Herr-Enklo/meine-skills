`INC-20260929-0825 | P1 | Windows-System | wartet auf Nutzer | Leipzig: Domänenanmeldung scheitert, ca. 60 Nutzer`

**Einordnung:** Das ist P1 und ein Major Incident, weil ein ganzer Standort nicht arbeiten kann (Auswirkung hoch, Dringlichkeit hoch). Eingestuft habe ich nach der Standardmatrix, eure eigenen Prioritätsregeln kenne ich nicht, und ein Journal früherer Incidents gibt es in dieser Sitzung nicht. Die beiden Meldungen passen zusammen. „Kein Anmeldeserver“ heißt: Der Rechner erreicht keinen DC, und für diesen Nutzer ist auf dem Rechner keine Anmeldung zwischengespeichert. „Vertrauensstellung“ heißt: Ein DC antwortet, lehnt aber das Computerkonto ab. Weil nur Leipzig betroffen ist, liegt die Ursache fast sicher an einer zentralen Stelle (DC am Standort, Leitung, AD, Update oder Richtlinie für Leipzig) und nicht an 60 einzelnen Rechnern. Euer Netz erreiche ich von hier nicht. Die Befehle führst du aus, sie lesen alle nur.

**1. Rollen und erste Info (jetzt)**
Du übernimmst die Technik. Eine zweite Person (Service Desk oder Teamleitung) übernimmt die Kommunikation und entscheidet mit dir über Eingriffe. In Leipzig brauchst du jemanden vor Ort, der sich mit dem lokalen Admin-Konto (z. B. LAPS) an betroffenen Rechnern anmelden kann. Die Zeitleiste führe ich mit: 08:00 Beginn, 08:25 Meldung, INC eröffnet. Mail liest in Leipzig gerade kaum jemand, also die Info über die Standortleitung, per Telefon, Aushang oder Teams auf dem Handy verteilen:

```
Betreff: Anmeldung am PC in Leipzig – gestört

Was ist los: Seit etwa 8 Uhr können sich viele Kolleginnen und Kollegen in Leipzig nicht am PC anmelden.
Was wir tun: Die IT sucht die Ursache mit Vorrang.
Was Sie tun können: Den Rechner bitte nicht wiederholt neu starten und nichts auf eigene Faust reparieren lassen. Eine Übergangslösung folgt, sobald sie getestet ist.
Nächste Information: 09:15 Uhr
```

**2. Nichts reparieren, bevor die Ursache feststeht**
Nehmt vorerst keine Rechner neu in die Domäne auf, setzt keine Computerkonten zurück und lasst `Test-ComputerSecureChannel -Repair` weg. Einen DC in Leipzig, falls es einen gibt, bitte weder neu starten noch aus Backup oder Snapshot zurückholen. Bei mehreren der Ursachen unten hält so eine Reparatur nicht oder macht es schlimmer, außerdem verwischt sie Spuren.

**3. Übergangslösung an einem Rechner testen (Person vor Ort)**
Nimm einen Rechner mit der Vertrauensstellungs-Meldung, an dem die Person schon einmal angemeldet war. Netzwerkkabel ziehen oder WLAN am Anmeldebildschirm trennen, anmelden, danach wieder verbinden und nicht neu starten. Windows nutzt dann die zwischengespeicherte Anmeldung. Für den bekannten Update-Fehler unter A schreibt Microsoft, dass diese Offline-Anmeldung weiter funktionieren kann. Ob danach Netzlaufwerke, Drucker und Fachanwendungen gehen, habe ich nicht geprüft, das hängt von der Ursache ab. Bei „kein Anmeldeserver“ hilft es nur an einem Rechner, an dem die Person früher schon angemeldet war. Wenn es klappt, schreibe ich dir die Anleitung für alle.

**4. Zentrale: auf deinem Admin-PC mit RSAT, Windows PowerShell 5.1 als Domänen-Admin** (dauert ein paar Minuten)

```powershell
Import-Module ActiveDirectory
$seit = (Get-Date).Date.AddHours(-6)            # ab gestern 18:00
"Domänenmodus: " + (Get-ADDomain).DomainMode
$dcs = Get-ADDomainController -Filter *
$dcs | Sort-Object Site | Format-Table Name, Site, IPv4Address, IsReadOnly, OperatingSystem -AutoSize
$le = $dcs | Where-Object Site -like '*Leip*'    # AD-Standortname ggf. anpassen
if (-not $le) { 'Kein DC im AD-Standort Leipzig gefunden' }
foreach ($dc in $le) {
  "===== $($dc.HostName)"
  foreach ($p in 53,88,389,445) { "Port {0}: {1}" -f $p, (Test-NetConnection $dc.HostName -Port $p -WarningAction SilentlyContinue).TcpTestSucceeded }
  Get-Service -ComputerName $dc.HostName Netlogon, NTDS, KDC, DNS -ErrorAction SilentlyContinue | Format-Table Name, Status -AutoSize
  w32tm /stripchart /computer:$($dc.HostName) /samples:3 /dataonly
  dcdiag /s:$($dc.HostName) /test:Advertising /test:NetLogons /test:Services /test:Replications
  "-- Verzeichnisdienst 2095/2103/1988 (USN-Rollback, Wiederherstellung):"
  Get-WinEvent -ComputerName $dc.HostName -FilterHashtable @{LogName='Directory Service'; Id=2095,2103,1988; StartTime=$seit} -ErrorAction SilentlyContinue | Format-Table TimeCreated, Id -AutoSize
  "-- Neustarts 1074/6005/6008:"
  Get-WinEvent -ComputerName $dc.HostName -FilterHashtable @{LogName='System'; Id=1074,6005,6008; StartTime=$seit} -ErrorAction SilentlyContinue | Format-Table TimeCreated, Id -AutoSize
  "-- NETLOGON-Ereignisse nach ID:"
  Get-WinEvent -ComputerName $dc.HostName -FilterHashtable @{LogName='System'; ProviderName='NETLOGON'; StartTime=$seit} -ErrorAction SilentlyContinue | Group-Object Id | Format-Table Count, Name -AutoSize
}
repadmin /replsummary
"-- Gelöschte Computerkonten seit gestern Abend:"
Get-ADObject -Filter 'objectClass -eq "computer" -and isDeleted -eq $true' -IncludeDeletedObjects -Properties whenChanged, lastKnownParent | Where-Object whenChanged -ge $seit | Group-Object lastKnownParent | Format-Table Count, Name -AutoSize
"-- Geänderte Computerkonten nach OU:"
Get-ADComputer -Filter 'whenChanged -ge $seit' -Properties whenChanged | Group-Object { "$(($_.DistinguishedName -split ',',2)[1]) | aktiv: $($_.Enabled)" } | Sort-Object Count -Descending | Select-Object -First 10 Count, Name | Format-Table -AutoSize
"-- Ereignis 4743 (Computerkonto gelöscht) je DC:"
foreach ($dc in $dcs) { Get-WinEvent -ComputerName $dc.HostName -FilterHashtable @{LogName='Security'; Id=4743; StartTime=$seit} -MaxEvents 5 -ErrorAction SilentlyContinue | Format-Table MachineName, TimeCreated, Id -AutoSize }
```

**5. Leipzig: auf je einem Rechner mit jeder der beiden Meldungen, angemeldet mit dem lokalen Admin-Konto, Windows PowerShell als Administrator**
Wie der Block auf den Rechner kommt (Fernwartung mit lokalem Konto, USB-Stick), entscheidest du.

```powershell
$dom = (Get-CimInstance Win32_ComputerSystem).Domain
Get-Date; w32tm /query /status
Get-ItemProperty 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion' | Select-Object DisplayVersion, CurrentBuild, UBR
Get-HotFix | Sort-Object InstalledOn -Descending | Select-Object -First 5 HotFixID, InstalledOn
"Credential Guard aktiv, wenn 1 enthalten: " + ((Get-CimInstance -Namespace root\Microsoft\Windows\DeviceGuard -ClassName Win32_DeviceGuard).SecurityServicesRunning -join ',')
foreach ($k in 'HKLM:\SYSTEM\CurrentControlSet\Control\Lsa','HKLM:\SOFTWARE\Policies\Microsoft\Windows\DeviceGuard') {
  "-- $k"; Get-ItemProperty $k -ErrorAction SilentlyContinue | Select-Object *Isolation* | Format-List
  Get-ItemProperty "$k\MachineIdentityIsolation" -ErrorAction SilentlyContinue | Format-List
}
Get-NetIPConfiguration | Format-List InterfaceAlias, IPv4Address, IPv4DefaultGateway, DNSServer
$srv = Resolve-DnsName "_ldap._tcp.dc._msdcs.$dom" -Type SRV -ErrorAction SilentlyContinue | Where-Object Type -eq 'SRV'
$srv | Format-Table NameTarget, Priority, Weight -AutoSize
foreach ($d in ($srv.NameTarget | Select-Object -First 3)) { foreach ($p in 88,389,445) { "{0}:{1} {2}" -f $d, $p, (Test-NetConnection $d -Port $p -WarningAction SilentlyContinue).TcpTestSucceeded } }
nltest /dsgetsite
nltest /dsgetdc:$dom
nltest /sc_query:$dom
Test-ComputerSecureChannel -Verbose
Get-WinEvent -FilterHashtable @{LogName='System'; ProviderName='NETLOGON'; StartTime=(Get-Date).Date} -MaxEvents 20 -ErrorAction SilentlyContinue | Format-Table TimeCreated, Id, Message -Wrap
```

**6. Woran du die Ursache erkennst**
- **A: September-Update mit „Machine Identity Isolation“ (bei Microsoft bekanntes Problem).** Das erkennst du daran, dass in Leipzig kürzlich KB5124008 (Windows 11 24H2/25H2), KB5124012 (26H1) oder ein späteres kumulatives Update installiert wurde, `SecurityServicesRunning` eine `1` enthält, ein `MachineIdentityIsolation`-Wert auf `2` steht und der Domänenmodus unter Windows Server 2025 liegt. Dann ist Microsofts Workaround der Weg: Einstellung auf demselben Weg zurücknehmen, auf dem sie gesetzt wurde, Neustart, danach den Kanal reparieren. Das ist Stufe 2, das planen wir zusammen, auch wie es ohne Domänenanmeldung auf 60 Rechner kommt.
- **B: DC in Leipzig gestört oder aus Snapshot oder Backup zurückgesetzt.** Das zeigen Ereignis 2095 oder 2103, ein gestoppter oder pausierter Netlogon-Dienst, ein fehlgeschlagener dcdiag-Test „Advertising“ oder ein Neustart in der Nacht. Am schnellsten wäre es dann, diesen DC vom Netz zu trennen (Netzwerkkarte am Hypervisor, nichts löschen), damit die Clients über die Leitung die DCs der Zentrale nutzen. Das ist Stufe 2 und nur mit deinem Okay, die eigentliche Reparatur folgt nach Microsofts USN-Rollback-Anleitung.
- **C: Netzweg zwischen Leipzig und den DCs (Leitung, VPN, Firewall, DNS am Standort).** Du siehst Ports auf `False`, eine leere SRV-Abfrage, einen Fehler statt DC-Namen bei `nltest /dsgetdc` oder `0x51f` (kein Anmeldeserver) bei `nltest /sc_query`. Dann ist die Frage, was an Firewall, VPN oder Leitung seit gestern geändert wurde.
- **D: Computerkonten der Leipziger Rechner gelöscht, deaktiviert oder zurückgesetzt.** Dafür sprechen gelöschte Objekte oder eine Häufung geänderter Konten in der Leipziger OU, Ereignis 4743 auf einem DC, NETLOGON 5722 oder 5723 auf dem DC und am Client `0x5` (Zugriff verweigert) bei erreichbarem DC ohne die Update-Merkmale aus A. Gab es dafür keinen Auftrag, behandeln wir das als Sicherheitsvorfall und die IT-Sicherheit kommt sofort dazu. Gelöschte Konten holt man dann aus dem AD-Papierkorb zurück, statt die Rechner neu aufzunehmen.
- **E: Uhrzeit.** Weichen Client, Leipziger DC und Zentrale in `w32tm` um mehr als 300 Sekunden voneinander ab, scheitert Kerberos. Dann muss die Zeitquelle am Standort korrigiert werden.

**7. Zurückmelden**
Füg die Ausgaben beider Blöcke hier ein, dazu das Ergebnis des Tests aus Schritt 3. Danach grenze ich die Ursache ein und sage dir, was du mit welcher Wirkung und welchem Weg zurück freigeben musst.

**Fragen**
1. Was hat sich seit gestern Nachmittag für Leipzig geändert? Mich interessieren verteilte Updates oder erzwungene Neustarts, Arbeiten an Server oder Hypervisor dort (Snapshot, Wiederherstellung), Firewall, VPN, Leitung, neue Richtlinien und Aufräumaktionen an Computerkonten.
2. Lassen sich die beiden Meldungen einer Gruppe zuordnen? Zum Beispiel „kein Anmeldeserver“ eher bei Leuten an fremden oder geteilten Rechnern, oder eine Aufteilung nach Gebäude, Stockwerk, LAN oder WLAN.
3. Wer ist in Leipzig vor Ort und kommt an das lokale Admin-Passwort, oder habt ihr Fernzugriff auf die Clients, der ohne Domänenanmeldung funktioniert?

**Quellen**
- Microsoft Support, KB5129194 (14.09.2026), bekanntes Problem „Domain-joined devices might lose their secure trust relationship with the domain“: https://support.microsoft.com/en-us/servicing/os/windows-11/2026/09/kb5129194-windows-11-26h1-security-update
- BleepingComputer (17.09.2026), Workaround mit den Registry-Orten für Machine Identity Isolation: https://www.bleepingcomputer.com/news/microsoft/microsoft-releases-workaround-for-windows-domain-login-authentication-issues/
- Microsoft Learn, gestörte Vertrauensstellung und sicherer Kanal: https://learn.microsoft.com/en-us/troubleshoot/windows-server/windows-security/broken-trust-relationship-domain-joined-device-its-domain-secure-channel-issues
- Microsoft Learn, „No logon servers are available“: https://learn.microsoft.com/en-us/troubleshoot/windows-server/active-directory/no-logon-servers-are-available
- Microsoft Learn, Ereignis 5722 auf dem DC: https://learn.microsoft.com/en-us/troubleshoot/windows-server/active-directory/event-id-5722-logged-on-domain-controller
- Microsoft Learn, USN-Rollback erkennen und beheben: https://learn.microsoft.com/en-us/troubleshoot/windows-server/active-directory/detect-and-recover-from-usn-rollback
