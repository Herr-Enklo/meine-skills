`INC-20260929-0825 | P1 | Windows-System | wartet auf Nutzer | Leipzig: ca. 60 Nutzer können sich nicht an der Domäne anmelden`

P1 und Major Incident: ein ganzer Standort steht (Annahme nach ITIL-Matrix, eure Regeln kenne ich nicht). Beide Meldungen zeigen auf die DCs, die Leipzig bedienen, nicht auf 60 Rechner: "Kein Anmeldeserver" heißt, kein DC erreichbar und keine zwischengespeicherte Anmeldung. "Vertrauensstellung" heißt, ein DC antwortet, kennt aber das Computerkennwort nicht. 08:00 ist wohl nur Arbeitsbeginn, die Ursache kann nachts liegen.

**1. Sofort unterlassen**, auch in Leipzig: keine Rechner neu in die Domäne aufnehmen, kein `Test-ComputerSecureChannel -Repair` oder `Reset-ComputerMachinePassword`, keinen DC aus Backup oder Snapshot zurückholen, am DC nichts in der Registry ändern. Hat ein Leipziger DC einen alten Datenstand, landet ein repariertes Kennwort genau dort, und die Rechner fallen später wieder heraus.

**2. Überbrückung**, nur wer an diesem Rechner schon angemeldet war: Netzwerkkabel ziehen bzw. WLAN aus, anmelden (zwischengespeicherte Anmeldung), Kabel wieder stecken. Lokale Programme laufen, Netzlaufwerke und Serverdrucker eventuell nicht. Wenn du willst, schreibe ich dazu eine kurze Nutzerinfo für Leipzig.

**3. Rollen (Vorschlag):** Du entscheidest und arbeitest technisch. Eine Person in Leipzig führt Block B aus und informiert die Kollegen. Die Standortleitung bekommt halbstündlich einen Stand. Zeitleiste: 08:00 Beginn, 08:25 Meldung.

**4. Block A, Admin-PC in der Zentrale** (PowerShell als Domänen-Admin mit RSAT, nur lesend; bei nicht erreichbarem DC dauern die Porttests Minuten). Oben Standortnamen und einen betroffenen Rechner eintragen:

```powershell
$standort = 'Leipzig'      # exakter Name in "Active Directory-Standorte und -Dienste"
$pc       = 'PC-NAME'      # ein Leipziger Rechner mit der Vertrauensstellungs-Meldung
$seit     = (Get-Date).AddHours(-24)
$domain   = (Get-ADDomain).DNSRoot
$alle     = Get-ADDomainController -Filter *
$alle | Sort-Object Site | Format-Table Name, Site, IPv4Address, IsReadOnly, IsGlobalCatalog -AutoSize
"--- PasswordLastSet von $pc je DC"
foreach ($s in $alle.HostName) {
  try { '{0,-35} {1}' -f $s, (Get-ADComputer $pc -Server $s -Properties PasswordLastSet).PasswordLastSet }
  catch { '{0,-35} nicht abfragbar: {1}' -f $s, $_.Exception.Message }
}
foreach ($dc in ($alle | Where-Object Site -eq $standort)) {
  "===== $($dc.HostName)"
  foreach ($p in 53, 88, 135, 389, 445, 5985) { '{0,-5} {1}' -f $p, (Test-NetConnection $dc.HostName -Port $p -InformationLevel Quiet) }
  w32tm /stripchart /computer:$($dc.HostName) /samples:1 /dataonly
  Invoke-Command -ComputerName $dc.HostName -ArgumentList $seit -ScriptBlock {
    param($seit)
    Get-Service Netlogon, NTDS, Kdc, DNS, DHCPServer -ErrorAction SilentlyContinue | Format-Table Name, Status -AutoSize | Out-String
    'Dsa Not Writable: ' + (Get-ItemProperty 'HKLM:\SYSTEM\CurrentControlSet\Services\NTDS\Parameters' -ErrorAction SilentlyContinue).'Dsa Not Writable'
    'Letzter Start:    ' + (Get-CimInstance Win32_OperatingSystem).LastBootUpTime
    foreach ($log in 'Directory Service', 'System') {
      "--- $log, Fehler und Warnungen seit $seit"
      Get-WinEvent -FilterHashtable @{ LogName = $log; Level = 1, 2, 3; StartTime = $seit } -MaxEvents 25 -ErrorAction SilentlyContinue |
        Format-Table TimeCreated, Id, ProviderName, @{ n = 'Text'; e = { ($_.Message -split "`n")[0] } } -AutoSize -Wrap | Out-String -Width 220
    }
  }
  repadmin /showrepl $dc.HostName
}
repadmin /replsummary
Resolve-DnsName "_ldap._tcp.$standort._sites.dc._msdcs.$domain" -Type SRV -ErrorAction SilentlyContinue | Format-Table Name, Type, NameTarget, IPAddress -AutoSize
Get-ADReplicationSubnet -Filter * -Properties Site | Where-Object Site -like "CN=$standort,*" | Format-Table Name -AutoSize
```

**5. Block B, in Leipzig an je einem Rechner pro Meldung**, angemeldet als lokaler Administrator (etwa LAPS), PowerShell als Administrator, nur lesend. Oben einen DC der Zentrale eintragen:

```powershell
$dcZentrale = 'DC-ZENTRALE.firma.local'   # ein DC der Zentrale
$domain = (Get-CimInstance Win32_ComputerSystem).Domain
nltest /dsgetsite
nltest /dsgetdc:$domain
nltest /sc_query:$domain
Test-ComputerSecureChannel -Verbose        # nur Test, NICHT mit -Repair
Get-DnsClientServerAddress -AddressFamily IPv4 | Where-Object ServerAddresses | Format-Table InterfaceAlias, ServerAddresses -AutoSize
Resolve-DnsName "_ldap._tcp.dc._msdcs.$domain" -Type SRV | Format-Table Name, Type, NameTarget, IPAddress -AutoSize
foreach ($p in 53, 88, 389, 445) { '{0,-4} {1}' -f $p, (Test-NetConnection $dcZentrale -Port $p -InformationLevel Quiet) }
w32tm /query /status
Get-WinEvent -FilterHashtable @{ LogName = 'System'; ProviderName = 'NETLOGON'; StartTime = (Get-Date).AddHours(-24) } -MaxEvents 10 -ErrorAction SilentlyContinue | Format-List TimeCreated, Id, Message
```

**6. Woran du die Hypothesen erkennst:**
- **H1, Leipziger DC mit altem Datenstand** (Snapshot oder Backup zurückgespielt, USN-Rollback, Replikation seit Tagen kaputt): in A `Dsa Not Writable: 4`, Netlogon `Paused`, Ereignis 2095/2103, Fehler 8456/8457 oder letzte Replikation vor Tagen, für `$pc` ein älteres `PasswordLastSet` auf dem Leipziger DC; in B nennt NETLOGON 3210 diesen DC.
- **H2, Verbindung zur Zentrale gestört** (VPN, WAN, Firewall), eventuell mit ausgefallenem DC oder einem RODC vor Ort, der nur einen Teil der Kennwörter kennt: Porttests `False`, in A `IsReadOnly True` und Replikationsfehler seit der Nacht, in B `/sc_query` mit 1311 (0x51f).
- **H3, falscher DNS-Server oder Standortzuordnung** (DHCP-Änderung, alter DC in den SRV-Einträgen): in B fremde DNS-Server, `dsgetsite` nicht Leipzig oder ein nicht mehr existierender DC im SRV-Eintrag.
- **H4, Uhr des Leipziger DC** mehr als fünf Minuten daneben, Kerberos scheitert: `w32tm /stripchart` in A über 300 s.

Unbekannte Admin-Anmeldungen, verschlüsselte Dateien oder Erpresserhinweise am DC bitte sofort melden, dann gilt es als Sicherheitsvorfall.

**7. Sofortmaßnahme nach A und B:** Bei H1 den Leipziger DC vom Netz nehmen, damit die Clients die DCs der Zentrale nutzen. Voraussetzung: Porttests aus B zur Zentrale `True`. Macht der DC auch DNS oder DHCP (Dienstliste in A), vorher Ersatz schaffen. Liegt das neuere `PasswordLastSet` in der Zentrale, kommen die Vertrauensstellungs-Rechner danach ohne Reparatur wieder rein. Weg zurück: DC wieder anschließen. Nach einem USN-Rollback ist laut Microsoft nur Herabstufen und Neuaufbau des DC sicher. Bei H2 ist die Verbindung die Baustelle (Anbieter, Firewall-Änderung zurücknehmen). Die Entscheidung liegt bei dir, den genauen Ablauf schreibe ich nach den Ausgaben.

**Fragen:**
1. Was hat sich seit gestern Abend in Leipzig geändert oder lief nachts (Wartung, Strom- oder Hostausfall, Neustart oder Rücksicherung des DC oder seines VM-Hosts, Firewall, VPN, DHCP, DNS)?
2. Sind die ca. 60 alle Nutzer in Leipzig, oder melden sich dort manche normal an?

Quellen:
- Microsoft, USN-Rollback erkennen und beheben: https://learn.microsoft.com/en-us/troubleshoot/windows-server/active-directory/detect-and-recover-from-usn-rollback
- Microsoft, gestörte Vertrauensstellung: https://learn.microsoft.com/en-us/troubleshoot/windows-server/windows-security/broken-trust-relationship-domain-joined-device-its-domain-secure-channel-issues
- Microsoft, Replikationsfehler 8456/8457: https://learn.microsoft.com/en-us/troubleshoot/windows-server/active-directory/replication-error-8456-8457
- Microsoft, Nltest: https://learn.microsoft.com/en-us/previous-versions/windows/it-pro/windows-server-2012-r2-and-2012/cc731935(v=ws.11)
