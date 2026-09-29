`INC-20260929-1040 | P3 | Windows-Software | wartet auf Nutzer | Empirum-Rollout Notepad++ 8.8.5: Rückgabewert 1618 auf 14 von 230 Clients`

**Einordnung**
1618 heißt: Windows Installer war gerade mit einer anderen Installation beschäftigt und hat die zweite abgewiesen (ERROR_INSTALL_ALREADY_RUNNING, Mutex `_MSIExecute`). Auf 216 Clients lief das Paket durch. Gesucht ist also, was auf den 14 zur selben Zeit lief und auf den anderen nicht.

P3: Auswirkung mittel (14 Clients, Arbeit geht weiter), Dringlichkeit mittel (Frist morgen). Annahmen: eure Prioritätsregeln kenne ich nicht, und auf den 14 läuft noch die alte Version. Die Paketvorlagen deinstallieren aber erst die Vorversion und installieren dann neu; fehlt Notepad++ deshalb auf einigen ganz und wird gebraucht, wird es P2. Ein Journal früherer Fälle gibt es in dieser Sitzung nicht.

**Sofort**
Nichts nötig. Das Paket bitte nicht tagsüber neu anstoßen: Ohne geklärte Ursache kommt derselbe Fehler, und bei offenem Notepad++ scheitert der Installer anders.

**Hypothesen**
1. Anderes Paket oder anderer MSI-Installer lief parallel (zweites Empirum-Paket, Selbstupdater eines anderen Programms): in `MsiNacht` ein 1040 (Beginn) eines fremden Produkts vor der Fehlerzeit, das 1042 (Ende) danach.
2. Windows Update oder WSUS/Intune in derselben Nacht: `WUNacht` zeigt 43/19/20 um die Fehlerzeit, gehäuft auf den 14.
3. Hängende Installation von früher: `MsiAktiv` zeigt jetzt noch ein `msiexec` mit `/i` oder `/x` und altem Start, oft mit `Neustart = True` (`msiexec /V` ist nur der Dienst).
4. Das Paket kollidiert mit sich selbst: Die Deinstallation der Vorversion läuft noch, während 8.8.5 startet. Erkennbar an einem Notepad++-Eintrag mit 1040/1042 um die Fehlerzeit, und die 14 haben dieselbe Vorversion oder Quelle (`NotepadPP`, MSI oder EXE).

**Was ich brauche**
1. Empirum-Konsole: die 14 gegen die erfolgreichen halten (Fehlerzeitpunkte, Standort oder Gruppe, andere Zuweisungen derselben Nacht). Die Namen in `C:\Temp\npp-1618.txt`, einer pro Zeile.
2. Die Fehlerzeile aus dem Empirum-Protokoll eines betroffenen Clients wörtlich (`... ErrorLevel: 1618`). Sie zeigt, ob die Deinstallation der Vorversion oder die Installation von 8.8.5 scheiterte.
3. Den Block unten auf einem Admin-Rechner mit WinRM-Zugriff ausführen, er ändert nichts. Mir die CSV und die beiden `lagebild-*.txt` schicken (enthalten Rechner- und Benutzernamen). Fenster ab 28.09. 18:00 ist eine Annahme, sonst `$seit` anpassen.

```powershell
# Nur lesend. Admin-PowerShell auf einem Rechner mit WinRM-Zugriff auf die Clients.
$betroffen = @(Get-Content 'C:\Temp\npp-1618.txt' | Where-Object { $_.Trim() })   # die 14 aus der Empirum-Konsole
$referenz  = '<ein Client, auf dem 8.8.5 erfolgreich lief>'
$skript    = '<Pfad>\windows-lagebild.ps1'                                        # Lagebild-Skript aus dem Skill-Ordner
$seit      = '2026-09-28 18:00'                                                   # Beginn der Rollout-Nacht

# 1) Kurzbild aller 14: Notepad++ noch da? Wer hat in der Nacht installiert? Hängt etwas?
Invoke-Command -ComputerName $betroffen -ArgumentList $seit -ErrorAction Continue -ScriptBlock {
    param($seit)
    $ab  = [datetime]$seit
    $npp = Get-ItemProperty 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*',
                            'HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*' -ErrorAction SilentlyContinue |
           Where-Object DisplayName -like '*Notepad++*'
    $msi = Get-WinEvent -FilterHashtable @{ LogName = 'Application'; ProviderName = 'MsiInstaller'; Id = 1033, 1034, 1040, 1042; StartTime = $ab } -ErrorAction SilentlyContinue
    $wu  = Get-WinEvent -FilterHashtable @{ LogName = 'System'; ProviderName = 'Microsoft-Windows-WindowsUpdateClient'; Id = 19, 20, 43; StartTime = $ab } -ErrorAction SilentlyContinue
    [pscustomobject]@{
        NotepadPP    = ($npp | ForEach-Object { '{0} {1}' -f $_.DisplayVersion, $(if ($_.WindowsInstaller) { 'MSI' } else { 'EXE' }) }) -join ', '
        Neustart     = (Test-Path 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Component Based Servicing\RebootPending') -or
                       (Test-Path 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\WindowsUpdate\Auto Update\RebootRequired')
        LetzterStart = (Get-CimInstance Win32_OperatingSystem).LastBootUpTime
        MsiAktiv     = (Get-CimInstance Win32_Process -Filter "Name='msiexec.exe'" | Where-Object CommandLine -notmatch '/V\b' |
                        ForEach-Object { '{0:dd.MM. HH:mm} {1}' -f $_.CreationDate, $_.CommandLine }) -join ' | '
        MsiNacht     = ($msi | Sort-Object TimeCreated | ForEach-Object {
                           $m = $_.Message -replace '\s+', ' '
                           '{0:HH:mm:ss} {1} {2}' -f $_.TimeCreated, $_.Id, $m.Substring(0, [math]::Min(110, $m.Length)) }) -join ' | '
        WUNacht      = ($wu | Sort-Object TimeCreated | ForEach-Object { '{0:HH:mm} {1}' -f $_.TimeCreated, $_.Id }) -join ', '
    }
} | Select-Object PSComputerName, NotepadPP, Neustart, LetzterStart, MsiAktiv, MsiNacht, WUNacht |
    Export-Csv "$env:TEMP\npp-1618-kurzbild.csv" -NoTypeInformation -Delimiter ';' -Encoding UTF8

# 2) Volles Lagebild: ein betroffener Client und der Referenz-Client
foreach ($pc in $betroffen[0], $referenz) {
    Invoke-Command -ComputerName $pc -FilePath $skript -ArgumentList 'Notepad++', 48, $seit |
        Out-File "$env:TEMP\lagebild-$pc.txt" -Encoding utf8
}
"Fertig: $env:TEMP\npp-1618-kurzbild.csv und $env:TEMP\lagebild-*.txt"
```

Ohne WinRM reicht zunächst das Lagebild direkt auf einem betroffenen Client (Admin-PowerShell, `-Software "Notepad++" -Seit "2026-09-28 18:00"`).

**Weg zu „sauber bis morgen“**
- Ursache 1 bis 3: heute Nacht die 14 in Empirum erneut ausführen, ohne parallele Pakete und Windows Update, bei 3 vorher Neustart. Stufe 2, dafür brauche ich dein OK. Scheitert es wieder, bleibt der heutige Stand, außer die Deinstallation läuft durch und die Installation nicht; deshalb vorher die Fehlerzeile.
- Ursache 4: Das Paket muss auf das Ende der Deinstallation warten und bei 1618 nach einer Pause einmal wiederholen. Das wird im Paket behoben, nicht auf den Clients. Den Skill `paketieren` habe ich hier nicht, die Änderung an der `setup.inf` bekommst du als Vorschlag, sobald ich die Aufrufe im Lagebild sehe.
- Morgen früh prüfen: Empirum-Status der 14 grün, Kurzbild erneut: `NotepadPP` nur 8.8.5, `MsiAktiv` leer.
- Dauerhaft: 1618 im Paket abfangen, Rollout-Fenster nicht mit anderen Paketen oder Windows Update überlappen.

**Hinweis zur Version** (kein Sicherheitsvorfall, aber wichtig für heute Nacht)
Vor 8.8.9 prüft der Notepad++-Updater (WinGUp) Updates nicht kryptografisch (CVE-2025-15556); das wurde 2025 über die gekaperte Hosting-Infrastruktur des Projekts gegen ausgewählte Ziele ausgenutzt. Aktuell ist laut Hersteller 8.9.8.1 mit weiteren Sicherheitskorrekturen. Überleg, ob die 14 noch 8.8.5 bekommen oder gleich alle 230 ein Paket der aktuellen Version. Mindestens prüfen, ob euer Paket `updater\GUP.exe` mit ausrollt.

Quellen:
- [_MSIExecute Mutex, Microsoft Learn](https://learn.microsoft.com/en-us/windows/win32/msi/-msiexecute-mutex)
- [MsiExec.exe error codes, Microsoft Learn](https://learn.microsoft.com/en-us/windows/win32/msi/error-codes)
- [CVE-2025-15556, NVD](https://nvd.nist.gov/vuln/detail/CVE-2025-15556)
- [Notepad++ v8.9.8.1](https://notepad-plus-plus.org/news/v8981-released/)
- [Unit 42 zum Notepad++-Angriff](https://unit42.paloaltonetworks.com/notepad-infrastructure-compromise/)
