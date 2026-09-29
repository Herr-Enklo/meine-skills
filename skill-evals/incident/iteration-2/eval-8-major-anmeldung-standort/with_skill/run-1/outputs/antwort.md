`INC-20260929-0825 | P1 | Windows-System | wartet auf Nutzer | Leipzig: ca. 60 Nutzer ohne Domänenanmeldung`

P1 und Major Incident: ein ganzer Standort kann nicht arbeiten (ITIL-Matrix, eure eigenen Prioritätsregeln kenne ich nicht; kein Journal früherer Incidents vorhanden).

1. Rollen festlegen: Du arbeitest technisch, Entscheidung (etwa IT-Leitung) und Kommunikation nach Leipzig übernimmt je jemand anderes. Zeitleiste: 08:00 erste Anmeldefehler, 08:25 Meldung, P1. Diese Info kann sofort an die Standortleitung:

   ```
   Betreff: Anmeldung an den PCs in Leipzig – gestört

   Was ist los: Seit etwa 8 Uhr können sich viele in Leipzig nicht am Rechner anmelden.
   Was wir tun: Die IT sucht die Ursache mit höchster Priorität.
   Was Sie tun können: Rechner eingeschaltet lassen. Ein neues Passwort hilft hier nicht.
   Nächste Information: spätestens 09:00 Uhr.
   ```

2. Vorerst nichts reparieren: kein `Test-ComputerSecureChannel -Repair`, keine Maschinenkennwörter zurücksetzen, nicht neu in die Domäne aufnehmen, am Leipziger DC kein Neustart und keine erzwungene Replikation. Liegt es am DC oder an gelöschten Konten, behebt man es zentral für alle 60; Reparaturen gegen einen DC mit altem Stand machen es schlimmer.

3. Block A auf deinem Admin-PC ausführen (nur lesend, einige Minuten). Oben je einen betroffenen Rechner pro Meldung eintragen und den AD-Standortnamen prüfen.

   ```powershell
   # Block A: nur lesend. Admin-PC Zentrale, Windows PowerShell 5.1 mit RSAT (AD, GPMC), als Domänen-Admin
   $pcs  = 'PC-VERTRAUENSSTELLUNG', 'PC-KEIN-ANMELDESERVER'   # je einen betroffenen Rechner eintragen
   $teil = '*Leip*'                                           # AD-Standortname Leipzig, anpassen falls anders
   Start-Transcript "$env:TEMP\INC-20260929-0825-zentrale.txt"
   $seit = (Get-Date).AddDays(-2)
   $ad   = Get-ADDomain
   "Domäne $($ad.DNSRoot), Funktionsebene $($ad.DomainMode)"
   $dcs  = Get-ADDomainController -Filter * | Sort-Object Site, Name
   $dcs | Format-Table Name, Site, IPv4Address, IsReadOnly, OperatingSystem -AutoSize
   $le   = @($dcs | Where-Object Site -like $teil)
   $ledc = @($le | ForEach-Object HostName)
   $hq   = ($dcs | Where-Object { $_.Site -notlike $teil -and -not $_.IsReadOnly } | Select-Object -First 1).HostName
   if (-not $ledc) { "Kein DC im Standort $teil" }

   "== Erreichbarkeit =="
   foreach ($z in $ledc) { foreach ($p in 53, 88, 389, 445) {
     "$z Port ${p}: " + (Test-NetConnection $z -Port $p -WarningAction SilentlyContinue).TcpTestSucceeded } }
   foreach ($z in $pcs) { "$z Port 445: " + (Test-NetConnection $z -Port 445 -WarningAction SilentlyContinue).TcpTestSucceeded }

   "== Replikation =="
   repadmin /replsummary
   foreach ($h in $ledc) { repadmin /showrepl $h }

   "== DCs in Leipzig: Zeit, Start, Dienste, dcdiag, Ereignisse =="
   foreach ($h in $ledc) {
     "---- $h"
     w32tm /stripchart "/computer:$h" /samples:1 /dataonly
     try { "Letzter Start: " + (Get-CimInstance Win32_OperatingSystem -ComputerName $h -ErrorAction Stop).LastBootUpTime }
     catch { "Letzter Start: $($_.Exception.Message)" }
     Get-Service -ComputerName $h -Name NTDS, Netlogon, DNS, Kdc, W32Time | Format-Table Name, Status -AutoSize
     dcdiag "/s:$h" /q
     foreach ($f in @{LogName='Directory Service'; Level=1,2}, @{LogName='System'; ProviderName='NETLOGON'}) {
       $f.StartTime = $seit
       try { Get-WinEvent -ComputerName $h -FilterHashtable $f -MaxEvents 25 -ErrorAction Stop |
               Format-Table TimeCreated, Id, @{n='Text'; e={($_.Message -split '\r?\n')[0]}} -Wrap }
       catch { "$($f.LogName): $($_.Exception.Message)" } } }

   "== Computerkonten auf jedem DC in Leipzig und in der Zentrale =="
   foreach ($pc in $pcs) { foreach ($s in $ledc + $hq) {
     try { Get-ADComputer $pc -Server $s -Properties Enabled, PasswordLastSet, whenChanged -ErrorAction Stop |
             Select-Object @{n='DC'; e={$s}}, Name, Enabled, PasswordLastSet, whenChanged, DistinguishedName | Format-List }
     catch { "$pc auf ${s}: $($_.Exception.Message)" } } }

   "== Seit vorgestern: gelöschte und deaktivierte Computer, geänderte GPOs =="
   $del = @(Get-ADObject -Server $hq -IncludeDeletedObjects -Filter 'isDeleted -eq $true -and objectClass -eq "computer"' -Properties whenChanged, lastKnownParent | Where-Object whenChanged -gt $seit)
   "Gelöscht: $($del.Count)"; $del | Group-Object lastKnownParent | Format-Table Count, Name -AutoSize
   $dis = @(Get-ADComputer -Server $hq -Filter 'Enabled -eq $false' -Properties whenChanged | Where-Object whenChanged -gt $seit)
   "Deaktiviert: $($dis.Count)"; $dis | Select-Object -First 20 Name, whenChanged, DistinguishedName | Format-Table -AutoSize
   try { Get-GPO -All -ErrorAction Stop | Where-Object ModificationTime -gt $seit | Format-Table DisplayName, ModificationTime -AutoSize }
   catch { "GPO: $($_.Exception.Message)" }

   "== DNS: DC-Einträge des Standorts =="
   foreach ($d in $le) {
     try { Resolve-DnsName "_ldap._tcp.$($d.Site)._sites.dc._msdcs.$($ad.DNSRoot)" -Type SRV -Server $d.HostName -ErrorAction Stop |
             Format-Table Name, NameTarget, Port -AutoSize }
     catch { "DNS auf $($d.Name): $($_.Exception.Message)" } }
   Stop-Transcript
   ```

4. Block B an diesen zwei Rechnern ausführen lassen, von jemandem vor Ort mit dem lokalen Administratorkonto (Kennwort aus LAPS), PowerShell als Administrator.

   ```powershell
   # Block B: nur lesend. Betroffener Rechner in Leipzig, als lokaler Administrator
   Start-Transcript "$env:TEMP\INC-20260929-0825-$env:COMPUTERNAME.txt"
   $dom = (Get-CimInstance Win32_ComputerSystem).Domain
   ipconfig /all
   nltest "/dsgetdc:$dom"
   nltest "/sc_query:$dom"
   Test-ComputerSecureChannel -Verbose
   w32tm /query /status
   $cv = Get-ItemProperty 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion'
   "Build $($cv.CurrentBuild).$($cv.UBR)"
   Get-HotFix | Sort-Object InstalledOn -Descending | Select-Object -First 5 HotFixID, InstalledOn | Format-Table -AutoSize
   "Sicherheitsdienste aktiv (1 = Credential Guard): " + ((Get-CimInstance -Namespace root\Microsoft\Windows\DeviceGuard -ClassName Win32_DeviceGuard).SecurityServicesRunning -join ',')
   reg query "HKLM\SYSTEM\CurrentControlSet\Control\Lsa" /v MachineIdentityIsolation
   reg query "HKLM\SOFTWARE\Policies\Microsoft\Windows\DeviceGuard" /s
   Get-WinEvent -FilterHashtable @{LogName='System'; ProviderName='NETLOGON'; StartTime=(Get-Date).AddDays(-2)} -MaxEvents 20 |
     Format-Table TimeCreated, Id, @{n='Text'; e={($_.Message -split '\r?\n')[0]}} -Wrap
   Stop-Transcript
   ```

5. Parallel Workaround an einem Rechner mit „Vertrauensstellung" testen: Netzwerkkabel ziehen bzw. am Anmeldebildschirm WLAN aus, anmelden, wieder verbinden. Windows nimmt dann die zwischengespeicherte Anmeldung. Geht nur, wo die Person schon angemeldet war, Netzlaufwerke können hängen; bei „kein Anmeldeserver" hat Windows das schon erfolglos versucht. Klappt es, kommt es in die nächste Nutzerinfo.

6. Beide Ausgaben an mich (Text oder die Dateien aus `%TEMP%`), dann kommen Ursache mit Beleg und Eingriff mit Weg zurück. „Kein Anmeldeserver": Der Rechner findet keinen DC (H1, H2). „Vertrauensstellung": Er erreicht einen DC, aber das Computerkonto passt nicht (H3–H5). Eine Ursache für beide ist möglich, etwa ein Leipziger DC mit altem Stand. Woran du die Hypothesen erkennst:
   - H1 DC in Leipzig ausgefallen oder gestört (etwa nach Update-Neustart): in A Ports `False`, Dienste nicht `Running`, `dcdiag`-Fehler, „Letzter Start" heute Nacht; in B findet `nltest /dsgetdc` keinen DC, Netlogon 5719.
   - H2 Leitung/Firewall nach Leipzig oder falscher DNS-Server per DHCP: A erreicht Leipzig nicht, `repadmin` meldet 1722 (RPC-Server nicht verfügbar), oder B zeigt in `ipconfig /all` keinen DC als DNS-Server.
   - H3 Leipziger DC mit altem Stand (Snapshot oder Backup zurückgespielt, Replikation lange kaputt): `PasswordLastSet` desselben Rechners weicht zwischen Leipzig und Zentrale ab, Ereignis 2095 in „Directory Service", Netlogon `Paused`.
   - H4 Computerkonten gelöscht oder deaktiviert (Aufräumskript, gelöschte OU): Rechner fehlt auf allen DCs oder `Enabled : False`, A zählt frisch gelöschte Computer. Mit aktiviertem AD-Papierkorb kommen sie samt Kennwort zurück, ohne die Clients anzufassen.
   - H5 bekannter Fehler ab Update KB5124008: Windows 11 24H2/25H2 mit Credential Guard verliert die Vertrauensstellung, wenn Machine Identity Isolation an ist und die Domäne unter Funktionsebene Windows Server 2025 liegt. In B Build 26100/26200 mit UBR ab 9445, Credential Guard (1), `MachineIdentityIsolation` = 2. Passt zum Standortmuster nur, wenn Leipzig Update oder Richtlinie gerade erst bekam (A listet geänderte GPOs).

   War eine Löschung oder ein Zurückspielen nicht geplant, wird es ein Sicherheitsvorfall, dann kommt eure IT-Sicherheit dazu.

Fragen:
1. Was lief seit gestern Abend: Updates oder Neustarts in Leipzig, Snapshot oder Wiederherstellung einer DC-VM, Arbeiten an Leitung, Firewall oder DHCP, Aufräumen von Computerkonten, neue Richtlinie?
2. Ist ganz Leipzig betroffen (wie viele Rechner gibt es dort), und wer bekommt welche Meldung: LAN oder WLAN, Stockwerk, Laptop oder Desktop, eigenes Gerät oder Wechselplatz?
3. Wer in Leipzig kann Block B ausführen, und kommt die Person an das LAPS-Kennwort?

Quellen:
- [Microsoft Learn: Broken trust relationship](https://learn.microsoft.com/en-us/troubleshoot/windows-server/windows-security/broken-trust-relationship-domain-joined-device-its-domain-secure-channel-issues)
- [Microsoft Learn: USN rollback](https://learn.microsoft.com/en-us/troubleshoot/windows-server/active-directory/detect-and-recover-from-usn-rollback)
- [Microsoft Learn: Windows 11 25H2, bekannte Probleme](https://learn.microsoft.com/en-us/windows/release-health/status-windows-11-25h2)
- [Microsoft Support: KB5124008](https://support.microsoft.com/en-us/servicing/os/windows-11/2026/09/kb5124008-windows-11-24h2-25h2-security-update)
