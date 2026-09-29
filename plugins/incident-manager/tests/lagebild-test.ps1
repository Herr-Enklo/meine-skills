# Prüft windows-lagebild.ps1 ohne Windows: Die Windows-Cmdlets werden durch Attrappen ersetzt,
# die feste Ereignisse, Registry-Einträge, Prozesse und Dienste liefern. Geprüft wird, dass das
# Skript sie richtig auswertet (Zeitfenster, Gruppierung, Absturzcodes, Softwaresuche).
#
# Aufruf: pwsh -NoProfile -File plugins/incident-manager/tests/lagebild-test.ps1
# Läuft auch unter Windows; die Attrappen haben dort Vorrang vor den echten Cmdlets.

$ErrorActionPreference = 'Stop'
$skript = Join-Path $PSScriptRoot '../skills/incident/scripts/windows-lagebild.ps1'
$global:jetzt = Get-Date

function Neues-Ereignis($Log, $Quelle, $Id, $Stufe, $Zeit, $Meldung, $Werte) {
    [pscustomobject]@{
        LogName          = $Log
        ProviderName     = $Quelle
        Id               = $Id
        Level            = $Stufe
        LevelDisplayName = @{ 1 = 'Kritisch'; 2 = 'Fehler'; 3 = 'Warnung'; 4 = 'Informationen' }[$Stufe]
        TimeCreated      = $Zeit
        Message          = $Meldung
        Properties       = @($Werte | ForEach-Object { [pscustomobject]@{ Value = $_ } })
    }
}

$global:Ereignisse = @(
    Neues-Ereignis 'Application' 'Application Error' 1000 2 $jetzt.AddHours(-2) 'Name der fehlerhaften Anwendung: notepad++.exe' @('notepad++.exe', '8.8.5.0', '5f1a2b3c', 'ntdll.dll', '10.0.22621.1', 'abcdef', 'c0000005', '0000000000012345')
    Neues-Ereignis 'Application' 'Application Error' 1000 2 $jetzt.AddHours(-1) 'Name der fehlerhaften Anwendung: notepad++.exe' @('notepad++.exe', '8.8.5.0', 'x', 'NppPlugin.dll', '1.0.0.0', 'y', 'c0000005', '0')
    Neues-Ereignis 'Application' '.NET Runtime' 1026 2 $jetzt.AddHours(-3) "Anwendung: Tool.exe`r`nBeschreibung: Der Prozess wurde aufgrund einer unbehandelten Ausnahme beendet.`r`nAusnahmeinformationen: System.IO.FileNotFoundException" @()
    Neues-Ereignis 'Application' 'MsiInstaller' 1040 4 $jetzt.AddHours(-5) 'Beginnen einer Windows Installer-Transaktion: C:\Windows\Temp\Anderes.msi. Client-Prozess-ID: 1234.' @()
    Neues-Ereignis 'Application' 'MsiInstaller' 11708 2 $jetzt.AddHours(-4.9) 'Produkt: Notepad++ -- Installationsvorgang fehlgeschlagen.' @()
    Neues-Ereignis 'Application' 'MsiInstaller' 1042 4 $jetzt.AddHours(-4.8) 'Beenden einer Windows Installer-Transaktion: C:\Windows\Temp\Anderes.msi. Client-Prozess-ID: 1234.' @()
    Neues-Ereignis 'System' 'Microsoft-Windows-WindowsUpdateClient' 20 2 $jetzt.AddHours(-6) 'Installationsfehler: Fehler 0x80073712 beim Installieren eines Updates.' @()
    Neues-Ereignis 'System' 'Service Control Manager' 7031 2 $jetzt.AddHours(-7) 'Der Dienst Druckwarteschlange wurde unerwartet beendet.' @()
    Neues-Ereignis 'System' 'Service Control Manager' 7031 2 $jetzt.AddHours(-6.5) 'Der Dienst Druckwarteschlange wurde unerwartet beendet, zweites Mal.' @()
    Neues-Ereignis 'System' 'AlteQuelle' 1 2 $jetzt.AddDays(-10) 'ZU-ALT-DARF-NICHT-ERSCHEINEN' @()
)

function global:Get-WinEvent {
    [CmdletBinding()]
    param([hashtable]$FilterHashtable, [int]$MaxEvents = [int]::MaxValue)
    $f = $FilterHashtable
    $treffer = @($global:Ereignisse | Where-Object {
            ($null -eq $f.LogName -or $_.LogName -in @($f.LogName)) -and
            ($null -eq $f.ProviderName -or $_.ProviderName -in @($f.ProviderName)) -and
            ($null -eq $f.Id -or $_.Id -in @($f.Id)) -and
            ($null -eq $f.Level -or $_.Level -in @($f.Level)) -and
            ($null -eq $f.StartTime -or $_.TimeCreated -ge $f.StartTime)
        } | Select-Object -First $MaxEvents)
    # Das echte Cmdlet meldet einen Fehler, wenn nichts passt.
    if ($treffer.Count -eq 0) { Write-Error 'No events were found that match the specified selection criteria.' }
    $treffer
}

function global:Get-CimInstance {
    [CmdletBinding()]
    param([Parameter(Position = 0)][string]$ClassName, [string]$Filter)
    switch ($ClassName) {
        'Win32_OperatingSystem' { [pscustomobject]@{ CSName = 'PC01'; Caption = 'Microsoft Windows 11 Enterprise'; BuildNumber = '22631'; OSArchitecture = '64-Bit'; MUILanguages = @('de-DE'); FreePhysicalMemory = 4194304; LastBootUpTime = $jetzt.AddDays(-12) } }
        'Win32_ComputerSystem' { [pscustomobject]@{ PartOfDomain = $true; Domain = 'firma.local'; Workgroup = $null; Manufacturer = 'Lenovo'; Model = 'T14'; TotalPhysicalMemory = 17179869184 } }
        'Win32_LogicalDisk' { [pscustomobject]@{ DeviceID = 'C:'; Size = 256GB; FreeSpace = 5GB } }
        'Win32_Service' {
            $alle = @(
                [pscustomobject]@{ Name = 'Spooler'; DisplayName = 'Druckwarteschlange'; State = 'Stopped'; StartMode = 'Auto'; ExitCode = 1067; StartName = 'LocalSystem'; PathName = 'C:\Windows\System32\spoolsv.exe' }
                [pscustomobject]@{ Name = 'NppUpdater'; DisplayName = 'Notepad++ Updater'; State = 'Running'; StartMode = 'Manual'; ExitCode = 0; StartName = 'LocalSystem'; PathName = 'C:\Program Files\Notepad++\updater\gup.exe' }
            )
            if ($Filter -like "*StartMode='Auto'*") { $alle | Where-Object { $_.StartMode -eq 'Auto' -and $_.State -ne 'Running' } } else { $alle }
        }
        'Win32_Process' {
            $alle = @(
                [pscustomobject]@{ Name = 'msiexec.exe'; ProcessId = 10; ParentProcessId = 1; CreationDate = $jetzt.AddDays(-3); CommandLine = 'C:\Windows\system32\msiexec.exe /V'; WorkingSetSize = 10MB; ExecutablePath = 'C:\Windows\System32\msiexec.exe' }
                [pscustomobject]@{ Name = 'notepad++.exe'; ProcessId = 20; ParentProcessId = 2; CreationDate = $jetzt.AddHours(-1); CommandLine = 'notepad++.exe'; WorkingSetSize = 50MB; ExecutablePath = 'C:\Program Files\Notepad++\notepad++.exe' }
            )
            if ($Filter -eq "Name='msiexec.exe'") { $alle | Where-Object Name -EQ 'msiexec.exe' } else { $alle }
        }
    }
}

function global:Get-ItemProperty {
    [CmdletBinding()]
    param([Parameter(Position = 0)][string]$Path, [string]$Name)
    switch ($Path) {
        'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion' { [pscustomobject]@{ DisplayVersion = '23H2'; UBR = 4169 } }
        'HKLM:\SYSTEM\CurrentControlSet\Control\Session Manager' { [pscustomobject]@{ PendingFileRenameOperations = @('\??\C:\x') } }
        'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*' {
            [pscustomobject]@{ DisplayName = 'Notepad++ (64-bit x64)'; DisplayVersion = '8.8.4'; Publisher = 'Notepad++ Team'; InstallDate = $null; PSChildName = 'Notepad++'; WindowsInstaller = $null; SystemComponent = $null; InstallLocation = 'C:\Program Files\Notepad++'; UninstallString = 'C:\Program Files\Notepad++\uninstall.exe' }
            [pscustomobject]@{ DisplayName = '7-Zip 24.08'; DisplayVersion = '24.08'; PSChildName = '7-Zip' }
        }
        'HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*' {
            [pscustomobject]@{ DisplayName = 'Notepad++ 8.8.5'; DisplayVersion = '8.8.5'; Publisher = 'Notepad++ Team'; InstallDate = '20260928'; PSChildName = '{11111111-2222-3333-4444-555555555555}'; WindowsInstaller = 1; SystemComponent = $null; InstallLocation = ''; UninstallString = 'MsiExec.exe /X{11111111-2222-3333-4444-555555555555}' }
        }
        default { Write-Error "Pfad nicht vorhanden: $Path" }
    }
}

function global:Test-Path { param([string]$Path) $Path -like '*RebootRequired' }

function global:New-Object {
    param([Parameter(Position = 0)][string]$TypeName, [Parameter(Position = 1)][object[]]$ArgumentList, [string]$ComObject)
    if ($ComObject -eq 'Microsoft.Update.Session') {
        # 0x80073712 als vorzeichenbehaftete 32-Bit-Zahl, wie der COM-Verlauf sie liefert
        $eintrag = [pscustomobject]@{ Date = $jetzt.AddHours(-6); ResultCode = 4; HResult = -2147010798; Title = '2026-09 Kumulatives Update für Windows 11 (KB5030000)' }
        $suche = [pscustomobject]@{}
        $suche | Add-Member ScriptMethod GetTotalHistoryCount { 1 }
        $suche | Add-Member ScriptMethod QueryHistory ({ param($a, $b) @($eintrag) }.GetNewClosure())
        $sitzung = [pscustomobject]@{}
        $sitzung | Add-Member ScriptMethod CreateUpdateSearcher ({ $suche }.GetNewClosure())
        return $sitzung
    }
    if ($PSBoundParameters.ContainsKey('ArgumentList')) { return Microsoft.PowerShell.Utility\New-Object -TypeName $TypeName -ArgumentList $ArgumentList }
    Microsoft.PowerShell.Utility\New-Object -TypeName $TypeName
}

function global:Get-MpComputerStatus { [CmdletBinding()] param() [pscustomobject]@{ AMRunningMode = 'Normal'; RealTimeProtectionEnabled = $true; AntivirusSignatureLastUpdated = $jetzt.AddHours(-3) } }
function global:Get-MpThreatDetection { [CmdletBinding()] param() [pscustomobject]@{ InitialDetectionTime = $jetzt.AddHours(-2); ThreatID = 2147519003; ProcessName = 'C:\Program Files\Notepad++\notepad++.exe'; Resources = @('file:_C:\Users\x\Downloads\plugin.dll') } }
function global:Get-NetIPConfiguration {
    [CmdletBinding()] param()
    [pscustomobject]@{ InterfaceAlias = 'Ethernet'; NetAdapter = [pscustomobject]@{ Status = 'Up' }; IPv4Address = @([pscustomobject]@{ IPAddress = '10.0.0.5' }); IPv4DefaultGateway = @([pscustomobject]@{ NextHop = '10.0.0.1' }); DNSServer = @([pscustomobject]@{ ServerAddresses = @('10.0.0.2', '10.0.0.3') }) }
}
function global:netsh { 'Direkter Zugriff (kein Proxyserver).' }
function global:Get-AppxPackage { [CmdletBinding()] param([string]$Name) }
function global:Get-ScheduledTask { [CmdletBinding()] param() [pscustomobject]@{ TaskName = 'Notepad++ Update'; TaskPath = '\'; State = 'Ready' } }
function global:Get-ScheduledTaskInfo {
    [CmdletBinding()] param([Parameter(ValueFromPipeline)]$InputObject)
    process { [pscustomobject]@{ LastRunTime = $jetzt.AddDays(-1); LastTaskResult = [uint32]2147942402 } }
}

$fehler = 0
function Pruefe([string]$Text, [string]$Muster, [string]$Beschreibung, [switch]$Nicht) {
    $gefunden = $Text -match $Muster
    if ($Nicht) { $ok = -not $gefunden } else { $ok = $gefunden }
    if ($ok) { "ok      $Beschreibung" } else { "FEHLER  $Beschreibung (Muster: $Muster)"; $script:fehler++ }
}
function Abschnitt([string]$Text, [string]$Titel) {
    $teile = $Text -split '(?m)^== '
    ($teile | Where-Object { $_.StartsWith($Titel) } | Select-Object -First 1)
}

$datei = Join-Path ([IO.Path]::GetTempPath()) 'lagebild-test.txt'
$bericht = & $skript -Software 'Notepad++' -Ausgabe $datei | Out-String

Pruefe $bericht 'nicht abrufbar' 'kein Abschnitt bricht ab' -Nicht
Pruefe $bericht 'ZU-ALT-DARF-NICHT-ERSCHEINEN' 'Ereignisse außerhalb des Zeitfensters fehlen' -Nicht
Pruefe (Abschnitt $bericht 'System') '23H2 Build 22631\.4169' 'Version mit Build und UBR'
Pruefe (Abschnitt $bericht 'System') 'firma\.local' 'Domäne'
Pruefe (Abschnitt $bericht 'System') 'Laufzeit_Tage\s*:\s*12' 'Laufzeit seit dem Start'
$neustart = Abschnitt $bericht 'Neustart'
Pruefe $neustart 'WindowsUpdate\s*:\s*True' 'Neustart durch Windows Update erkannt'
Pruefe $neustart 'InstallerUnterbrochen\s*:\s*False' 'keine unterbrochene Installation'
Pruefe $neustart 'msiexec\.exe /V' 'msiexec-Dienst mit Aufrufzeile'
Pruefe (Abschnitt $bericht 'Datenträger') '(?m)C:\s+256(\.0+)?\s+5(\.0+)?\s+2\s*$' 'Datenträger mit 2 % frei'
Pruefe (Abschnitt $bericht 'Automatisch') 'Spooler.*1067' 'gestoppter Autostart-Dienst mit Exitcode'
$gruppiert = Abschnitt $bericht 'Kritisch'
Pruefe $gruppiert '(?m)^\s*2\s+Service Control Manager\s+7031' 'Ereignisse gruppiert und gezählt'
Pruefe $gruppiert '(?m)^\s*2\s+Application Error\s+1000' 'Abstürze in der Gruppierung'
$abstuerze = Abschnitt $bericht 'Programmabstürze'
Pruefe $abstuerze 'NppPlugin\.dll 1\.0\.0\.0\s+0xc0000005' 'Absturz mit Modul und Code'
Pruefe $abstuerze 'ntdll\.dll' 'zweiter Absturz mit anderem Modul'
Pruefe $abstuerze 'FileNotFoundException' '.NET-Ausnahme mit Typ'
$msi = Abschnitt $bericht 'Windows Installer'
Pruefe $msi '1040' 'Installer-Transaktion Beginn'
Pruefe $msi '1042' 'Installer-Transaktion Ende'
Pruefe $msi '11708' 'fehlgeschlagene Installation'
Pruefe (Abschnitt $bericht 'Windows Update im Zeitraum') '0x80073712' 'Update-Fehlerereignis'
$wu = Abschnitt $bericht 'Windows Update, letzte'
Pruefe $wu 'fehlgeschlagen' 'Update-Verlauf mit Ergebnis'
Pruefe $wu '0x80073712' 'negativer HResult als 0x80073712'
Pruefe (Abschnitt $bericht 'Microsoft Defender') 'plugin\.dll' 'Defender-Fund'
$netz = Abschnitt $bericht 'Netzwerk'
Pruefe $netz '10\.0\.0\.5\s+10\.0\.0\.1\s+10\.0\.0\.2, 10\.0\.0\.3' 'Adresse, Gateway und DNS lesbar'
Pruefe $netz 'Direkter Zugriff' 'WinHTTP-Proxy'
$installiert = Abschnitt $bericht 'Installiert'
Pruefe $installiert 'Rechner 64-Bit' '64-Bit-Eintrag'
Pruefe $installiert 'Rechner 32-Bit' '32-Bit-Eintrag'
Pruefe $installiert '\{11111111-2222-3333-4444-555555555555\}' 'Produktcode als Schlüssel'
Pruefe $installiert 'Mehrere Einträge' 'Hinweis auf mehrere Einträge'
Pruefe $installiert '7-Zip' 'fremde Software nicht aufgeführt' -Nicht
Pruefe (Abschnitt $bericht 'Laufende Prozesse') 'notepad\+\+\.exe' 'laufender Prozess'
Pruefe (Abschnitt $bericht 'Laufende Prozesse') 'msiexec' 'fremder Prozess nicht aufgeführt' -Nicht
Pruefe (Abschnitt $bericht 'Dienste:') 'NppUpdater' 'zugehöriger Dienst'
Pruefe (Abschnitt $bericht 'Geplante Aufgaben') '0x80070002' 'Aufgabe mit Ergebnis als Hex'
Pruefe (Abschnitt $bericht 'Ereignisse mit Bezug') 'Installationsvorgang fehlgeschlagen' 'Ereignis mit Programmnamen'
Pruefe (Get-Content $datei -Raw) '== Ende' 'Bericht in Datei geschrieben'

$spaet = & $skript -Seit $jetzt.AddHours(-1.5) | Out-String
Pruefe (Abschnitt $spaet 'Programmabstürze') 'NppPlugin' 'mit -Seit: neuer Absturz enthalten'
Pruefe (Abschnitt $spaet 'Programmabstürze') 'ntdll' 'mit -Seit: älterer Absturz ausgeschlossen' -Nicht
Pruefe (Abschnitt $spaet 'Windows Installer') '(nichts gefunden)' 'mit -Seit: keine Installer-Ereignisse'

$klammern = & $skript -Software 'Tool [x64]' | Out-String
Pruefe $klammern 'nicht abrufbar' 'Programmname mit eckigen Klammern' -Nicht

Remove-Item $datei -ErrorAction SilentlyContinue
if ($fehler) { "$fehler Prüfung(en) fehlgeschlagen"; exit 1 }
'Alle Prüfungen bestanden'
