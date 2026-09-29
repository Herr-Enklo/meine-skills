# Playbook: Arbeitsplatz und Windows

Für Störungen an Windows-Clients: Software lässt sich nicht installieren oder starten, Softwareverteilung schlägt fehl, Drucker, Outlook, Anmeldung, langsamer oder voller Rechner, Updates.

## Erst erfragen

Rechnername, Benutzer, Windows-Version und Build, seit wann, ein Rechner oder mehrere, Fehlermeldung wörtlich oder als Screenshot, was sich geändert hat (Windows-Update, neues Paket, Passwortwechsel, Umzug, neuer Drucker). Mehrere Rechner mit demselben Fehler zeigen fast immer auf eine zentrale Ursache: Paket, Richtlinie, Server, Netz.

## Lagebild in einem Lauf

Nur lesend. Läuft Claude lokal auf dem Rechner, direkt ausführen; sonst dem Nutzer zum Kopieren in eine PowerShell geben und um die Ausgabe bitten.

```powershell
$seit = (Get-Date).AddHours(-24)
"== System"
Get-CimInstance Win32_OperatingSystem | Select-Object CSName, Caption, Version, BuildNumber, LastBootUpTime
"== Datenträger"
Get-PSDrive -PSProvider FileSystem | Select-Object Name, @{n='FreiGB';e={[math]::Round($_.Free/1GB,1)}}, @{n='BelegtGB';e={[math]::Round($_.Used/1GB,1)}}
"== Neustart ausstehend"
Test-Path 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Component Based Servicing\RebootPending'
Test-Path 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\WindowsUpdate\Auto Update\RebootRequired'
"== Kritisch und Fehler, letzte 24 Stunden"
Get-WinEvent -FilterHashtable @{LogName='System','Application'; Level=1,2; StartTime=$seit} -MaxEvents 40 -ErrorAction SilentlyContinue |
  Select-Object TimeCreated, LogName, ProviderName, Id, @{n='Meldung';e={($_.Message -split "`n")[0]}} | Format-Table -AutoSize -Wrap
"== Netzwerk"
Get-NetIPConfiguration | Format-List InterfaceAlias, IPv4Address, IPv4DefaultGateway, DNSServer
```

## Softwareverteilung und Installation

Rückgabecodes von Windows Installer (msiexec), die in Verteilungsprotokollen oft auftauchen:

| Code | Bedeutung | Typischer nächster Schritt |
|---|---|---|
| 0 | Erfolg | Symptom liegt woanders, etwa Erkennung oder Benutzerteil |
| 1602 | vom Benutzer abgebrochen | Aufruf wirklich still (`/qn`)? |
| 1603 | schwerer Fehler während der Installation | ausführliches Log erzeugen, siehe unten |
| 1605 | Aktion nur für installierte Produkte | Deinstallation eines nicht installierten Produkts, Erkennung prüfen |
| 1612 | Installationsquelle nicht verfügbar | Quelle oder Cache der Vorversion fehlt |
| 1618 | eine andere Installation läuft bereits | warten, laufende `msiexec`-Prozesse prüfen, Wiederholung einplanen |
| 1619 | Paket konnte nicht geöffnet werden | Pfad, Rechte, Datei vollständig? |
| 1620 | Paket konnte nicht geöffnet werden, ungültiges Paket | Datei beschädigt oder falscher Typ |
| 1625 | durch Richtlinie verboten | Gruppenrichtlinie oder AppLocker prüfen |
| 1633 | Plattform wird nicht unterstützt | falsche Architektur (x86/x64/ARM64) |
| 1638 | andere Version bereits installiert | Upgrade-Logik oder vorher deinstallieren |
| 1639 | ungültiges Befehlszeilenargument | Parameter prüfen |
| 1641 | Installer hat einen Neustart ausgelöst | Erfolg, Neustart war Teil davon |
| 3010 | Neustart erforderlich | Erfolg, Neustart ausstehend |

Bei 1603 und unklaren Fehlern ein ausführliches Log erzeugen und darin die erste Zeile mit `Return value 3` suchen. Die Ursache steht meist in den Zeilen direkt davor.

```powershell
msiexec /i "C:\Pfad\paket.msi" /qn /l*v "C:\temp\install.log"
Select-String -Path C:\temp\install.log -Pattern 'Return value 3' -Context 30,2 | Select-Object -First 1
```

Bei EXE-Installern hat jeder Hersteller eigene Rückgabecodes und Logschalter. Die Doku des Herstellers suchen, nicht raten.

### Matrix42 Empirum

- Frag nach dem Paket (Hersteller, Produkt, Version), dem Rückgabewert im Empirum-Protokoll und danach, ob es auf allen Clients oder nur auf einzelnen fehlschlägt. Den Speicherort der Client-Protokolle vom Nutzer erfragen oder in der Empirum-Doku nachsehen, nicht raten.
- Die Skriptkopie des Pakets liegt auf dem Client unter `%ProgramData%\$Matrix42Scripts$\<Hersteller>\<Produkt>\<Version>\Install\Setup.inf`. Daran lässt sich prüfen, welche Fassung tatsächlich ausgeführt wurde.
- Fehler im Paket selbst (falsche Erkennung, Uninstall-Schlüssel in der falschen Registry-Ansicht, Uninstaller arbeitet asynchron weiter, Reste bleiben liegen) werden im Paket behoben: Skill `paketieren`, Packaging Center mit `python main.py check <setup.inf>` und der Simulation im Repo `matrix42-paketierung`.
- Scheitert es nur auf einzelnen Clients: ausstehender Neustart, parallel laufende Installation (1618), voller Datenträger, Reste einer alten Version, abweichende Architektur.

## Häufige Einzelfälle

- Drucker druckt nicht: Warteschlange prüfen, `Get-Service Spooler`, `Get-Printer | Select-Object Name, PrinterStatus, PortName`, `Get-PrintJob -PrinterName "<Name>"`. Spooler neu starten ist am eigenen Rechner Stufe 1, auf einem Druckserver Stufe 2.
- Outlook oder Microsoft 365: erst prüfen, ob der Dienst gestört ist (Dienststatus im Microsoft 365 Admin Center oder per Websuche), dann Anmeldung, dann Profil und Cache. Betrifft es mehrere Nutzer, ist es selten der Client.
- Konto gesperrt: mit RSAT `Get-ADUser <name> -Properties LockedOut, BadLogonCount, LastBadPasswordAttempt, PasswordExpired`. Die Quelle wiederholter Sperren zeigt das Ereignis 4740 im Sicherheitsprotokoll eines Domänencontrollers; häufig sind es alte Passwörter auf Handy, in Laufwerkszuordnungen oder geplanten Aufgaben. Entsperren nur mit den Rechten und nach den Regeln des Nutzers.
- Windows-Update schlägt fehl: Fehlercode aus dem Updateverlauf, `Get-WindowsUpdateLog` erzeugt eine lesbare `WindowsUpdate.log` auf dem Desktop. Freier Platz und ausstehender Neustart sind die häufigsten Ursachen.
- Rechner langsam: `Get-Process | Sort-Object CPU -Descending | Select-Object -First 15 Name, Id, CPU, @{n='RAM_MB';e={[math]::Round($_.WS/1MB)}}`, freier Platz, Neustart seit wie vielen Tagen, Virenscanner beim Vollscan.
- Datenträger voll: `Get-ChildItem C:\ -Directory -ErrorAction SilentlyContinue | ForEach-Object { [pscustomobject]@{Ordner=$_.FullName; GB=[math]::Round((Get-ChildItem $_.FullName -Recurse -File -ErrorAction SilentlyContinue | Measure-Object Length -Sum).Sum/1GB,1)} } | Sort-Object GB -Descending`. Das dauert auf großen Platten, vorher ankündigen. Nichts löschen ohne Freigabe (Stufe 3).

## Eskalation

Verdacht auf Hardwaredefekt (Datenträgerfehler im Systemprotokoll, Bluescreens mit wechselnden Codes), fehlende Rechte, Server im Firmennetz: Übergabe an den zuständigen Support nach `vorlagen.md` mit dem Lagebild von oben.
