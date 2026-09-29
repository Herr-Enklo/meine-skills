# Prüft windows-lagebild.ps1 ohne Windows: Die Windows-Cmdlets werden durch Attrappen ersetzt,
# die feste Ereignisse, Registry-Einträge, Prozesse, Dienste und Aufgaben liefern; Programmordner,
# Empirum-Skriptkopie und -Protokoll liegen als echte Dateien in einem Temp-Ordner. Geprüft wird,
# dass das Skript alles richtig auswertet (Zeitfenster, Gruppierung, Absturzcodes und -pfade,
# Startfehler, Softwaresuche, Signaturen, Softwareverteilung).
#
# Aufruf: pwsh -NoProfile -File plugins/incident-manager/tests/lagebild-test.ps1
# Mit LAGEBILD_TEST_JETZT="2026-09-29 09:38" liegen alle Zeiten fest (für Testdaten der Evals).
# Mit LAGEBILD_TEST_BERICHT=<Datei> wird der Bericht des ersten Laufs dort abgelegt.

$ErrorActionPreference = 'Stop'
$skript = Join-Path $PSScriptRoot '../skills/incident/scripts/windows-lagebild.ps1'
if ($env:LAGEBILD_TEST_JETZT) { $global:jetzt = [datetime]$env:LAGEBILD_TEST_JETZT } else { $global:jetzt = Get-Date }

# Dateien, die das Skript wirklich liest
$global:basis = Join-Path ([IO.Path]::GetTempPath()) ('lagebild-' + [guid]::NewGuid().ToString('N'))
$global:npp = Join-Path $basis 'Notepad++'
$empirum = Join-Path $basis 'ProgramData/$Matrix42Scripts$/Notepad++ Team/Notepad++/8.8.5/Install'
foreach ($o in (Join-Path $npp 'plugins/NppPlugin'), (Join-Path $npp 'updater'), $empirum, (Join-Path $basis 'windows/Temp')) {
    New-Item -ItemType Directory -Path $o -Force | Out-Null
}
'x' | Set-Content (Join-Path $npp 'notepad++.exe')
'x' | Set-Content (Join-Path $npp 'SciLexer.dll')
(Get-Item (Join-Path $npp 'notepad++.exe')).LastWriteTime = $jetzt.AddMinutes(-693)
(Get-Item (Join-Path $npp 'SciLexer.dll')).LastWriteTime = $jetzt.AddDays(-77)
'x' | Set-Content (Join-Path $npp 'plugins/NppPlugin/NppPlugin.dll')
(Get-Item (Join-Path $npp 'plugins/NppPlugin/NppPlugin.dll')).LastWriteTime = $jetzt.AddHours(-3)
'x' | Set-Content (Join-Path $npp 'updater/gup.exe')
(Get-Item (Join-Path $npp 'updater/gup.exe')).LastWriteTime = $jetzt.AddDays(-60)
@(
    '[Set:InstallMSI]'
    'Set ErrorLogMessage=Fehler beim Installieren von npp.8.8.5.Installer.x64.msi.'
    'Call MsiExec /I "%Src%\Files\npp.8.8.5.Installer.x64.msi" /qn /Li "%MSILogFile%"'
) | Set-Content (Join-Path $empirum 'Setup.inf')
@(
    'Start Paket Notepad++ 8.8.5'
    'Fehler beim Installieren von npp.8.8.5.Installer.x64.msi. ErrorLevel: 1618'
) | Set-Content (Join-Path $basis 'windows/Temp/Notepad++.8.8.5.1.log')
$alteUmgebung = @{ ProgramData = $env:ProgramData; windir = $env:windir }
$env:ProgramData = Join-Path $basis 'ProgramData'
$env:windir = Join-Path $basis 'windows'

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

$nppWin = 'C:\Program Files\Notepad++'
$global:Ereignisse = @(
    Neues-Ereignis 'Application' 'Application Error' 1000 2 $jetzt.AddMinutes(-157) 'Name der fehlerhaften Anwendung: notepad++.exe, Version: 8.8.5.0' @('notepad++.exe', '8.8.5.0', '689d8f21', 'ntdll.dll', '10.0.22621.4111', 'a1b2c3d4', 'c0000005', '00000000000a1b2c', '0x3a10', '0x1db3104', "$nppWin\notepad++.exe", 'C:\Windows\SYSTEM32\ntdll.dll', '6f0c1f52-1e4b-4b1f-9a51-3c0e5d8e2a11', '', '')
    Neues-Ereignis 'Application' 'Application Error' 1000 2 $jetzt.AddMinutes(-96) 'Name der fehlerhaften Anwendung: notepad++.exe, Version: 8.8.5.0' @('notepad++.exe', '8.8.5.0', '689d8f21', 'NppPlugin.dll', '1.0.0.0', '66b0a911', 'c0000005', '0000000000004f2e', '0x37d0', '0x1db3110', "$nppWin\notepad++.exe", "$nppWin\plugins\NppPlugin\NppPlugin.dll", '0b7e9c4d-2a6f-4c3e-8d1a-7f5b2e9c0d34', '', '')
    Neues-Ereignis 'Application' '.NET Runtime' 1026 2 $jetzt.AddMinutes(-183) "Anwendung: Tool.exe`r`nBeschreibung: Der Prozess wurde aufgrund einer unbehandelten Ausnahme beendet.`r`nAusnahmeinformationen: System.IO.FileNotFoundException" @()
    Neues-Ereignis 'System' 'Application Popup' 26 4 $jetzt.AddHours(-20) 'Anwendungs-Popup: LohnPro.exe - Anwendungsfehler : Die Anwendung konnte nicht korrekt gestartet werden (0xc000007b). Klicken Sie auf "OK", um die Anwendung zu schließen.' @()
    Neues-Ereignis 'Application' 'MsiInstaller' 1040 4 $jetzt.AddMinutes(-336) 'Beginnen einer Windows Installer-Transaktion: C:\Windows\Temp\Anderes.msi. Client-Prozess-ID: 1234.' @()
    Neues-Ereignis 'Application' 'MsiInstaller' 1033 4 $jetzt.AddMinutes(-330) 'Windows Installer hat das Produkt installiert. Produktname: Notepad++. Produktversion: 8.8.5. Produktsprache: 1031. Hersteller: Notepad++ Team. Erfolg- bzw. Fehlerstatus der Installation: 1618.' @()
    Neues-Ereignis 'Application' 'MsiInstaller' 11708 2 $jetzt.AddMinutes(-330) 'Produkt: Notepad++ -- Installationsvorgang fehlgeschlagen.' @()
    Neues-Ereignis 'Application' 'MsiInstaller' 1042 4 $jetzt.AddMinutes(-324) 'Beenden einer Windows Installer-Transaktion: C:\Windows\Temp\Anderes.msi. Client-Prozess-ID: 1234.' @()
    Neues-Ereignis 'System' 'Microsoft-Windows-WindowsUpdateClient' 20 2 $jetzt.AddMinutes(-395) 'Installationsfehler: Fehler 0x80073712 beim Installieren eines Updates.' @()
    Neues-Ereignis 'System' 'Service Control Manager' 7031 2 $jetzt.AddMinutes(-452) 'Der Dienst Druckwarteschlange wurde unerwartet beendet.' @()
    Neues-Ereignis 'System' 'Service Control Manager' 7031 2 $jetzt.AddMinutes(-421) 'Der Dienst Druckwarteschlange wurde unerwartet beendet, zweites Mal.' @()
    Neues-Ereignis 'Microsoft-Windows-Windows Defender/Operational' 'Microsoft-Windows-Windows Defender' 1116 3 $jetzt.AddMinutes(-158) 'Microsoft Defender Antivirus hat Schadsoftware erkannt. Name: Trojan:Win32/Wacatac.B!ml Pfad: file:_C:\Users\mmuster\Downloads\plugin.dll Prozessname: C:\Program Files\Notepad++\notepad++.exe' @()
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
        'Win32_OperatingSystem' { [pscustomobject]@{ CSName = 'PC01'; Caption = 'Microsoft Windows 11 Enterprise'; BuildNumber = '22631'; OSArchitecture = '64-Bit'; MUILanguages = @('de-DE'); FreePhysicalMemory = 4194304; LastBootUpTime = $jetzt.AddDays(-12).AddMinutes(-47) } }
        'Win32_ComputerSystem' { [pscustomobject]@{ PartOfDomain = $true; Domain = 'firma.local'; Workgroup = $null; Manufacturer = 'Lenovo'; Model = 'T14'; TotalPhysicalMemory = 17179869184 } }
        'Win32_LogicalDisk' { [pscustomobject]@{ DeviceID = 'C:'; Size = 256GB; FreeSpace = 5GB } }
        'Win32_Service' {
            $alle = @(
                [pscustomobject]@{ Name = 'Spooler'; DisplayName = 'Druckwarteschlange'; State = 'Stopped'; StartMode = 'Auto'; ExitCode = 1067; StartName = 'LocalSystem'; PathName = 'C:\Windows\System32\spoolsv.exe' }
                [pscustomobject]@{ Name = 'NppUpdater'; DisplayName = 'Notepad++ Updater'; State = 'Running'; StartMode = 'Manual'; ExitCode = 0; StartName = 'LocalSystem'; PathName = '"C:\Program Files\Notepad++\updater\gup.exe" -service' }
            )
            if ($Filter -like "*StartMode='Auto'*") { $alle | Where-Object { $_.StartMode -eq 'Auto' -and $_.State -ne 'Running' } } else { $alle }
        }
        'Win32_Process' {
            $alle = @(
                [pscustomobject]@{ Name = 'msiexec.exe'; ProcessId = 1184; ParentProcessId = 812; CreationDate = $jetzt.AddDays(-3).AddMinutes(-12); CommandLine = 'C:\Windows\system32\msiexec.exe /V'; WorkingSetSize = 10MB; ExecutablePath = 'C:\Windows\System32\msiexec.exe' }
                [pscustomobject]@{ Name = 'notepad++.exe'; ProcessId = 14320; ParentProcessId = 6004; CreationDate = $jetzt.AddMinutes(-95); CommandLine = '"C:\Program Files\Notepad++\notepad++.exe"'; WorkingSetSize = 85MB; ExecutablePath = 'C:\Program Files\Notepad++\notepad++.exe' }
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
            [pscustomobject]@{ DisplayName = 'Notepad++ (64-bit x64)'; DisplayVersion = '8.8.4'; Publisher = 'Notepad++ Team'; InstallDate = $null; PSChildName = 'Notepad++'; WindowsInstaller = $null; SystemComponent = $null; InstallLocation = $npp; DisplayIcon = (Join-Path $npp 'notepad++.exe'); UninstallString = (Join-Path $npp 'uninstall.exe') }
            [pscustomobject]@{ DisplayName = '7-Zip 24.08'; DisplayVersion = '24.08'; PSChildName = '7-Zip' }
        }
        'HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*' {
            [pscustomobject]@{ DisplayName = 'Notepad++ 8.8.5'; DisplayVersion = '8.8.5'; Publisher = 'Notepad++ Team'; InstallDate = '20260928'; PSChildName = '{11111111-2222-3333-4444-555555555555}'; WindowsInstaller = 1; SystemComponent = $null; InstallLocation = ''; DisplayIcon = $null; UninstallString = 'MsiExec.exe /X{11111111-2222-3333-4444-555555555555}' }
        }
        default { Write-Error "Pfad nicht vorhanden: $Path" }
    }
}

function global:Test-Path {
    param([Parameter(Position = 0)][string]$Path, [string]$LiteralPath, [string]$PathType)
    $ziel = $Path
    if ($LiteralPath) { $ziel = $LiteralPath }
    if ($ziel -like 'HK*:*') { return $ziel -like '*RebootRequired' }
    if ($PathType) { return Microsoft.PowerShell.Management\Test-Path -LiteralPath $ziel -PathType $PathType }
    Microsoft.PowerShell.Management\Test-Path -LiteralPath $ziel
}

function global:New-Object {
    param([Parameter(Position = 0)][string]$TypeName, [Parameter(Position = 1)][object[]]$ArgumentList, [string]$ComObject)
    if ($ComObject -eq 'Microsoft.Update.Session') {
        # 0x80073712 als vorzeichenbehaftete 32-Bit-Zahl, wie der COM-Verlauf sie liefert
        $eintrag = [pscustomobject]@{ Date = $jetzt.AddMinutes(-395); ResultCode = 4; HResult = -2147010798; Title = '2026-09 Kumulatives Update für Windows 11 (KB5030000)' }
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

function global:Get-MpComputerStatus { [CmdletBinding()] param() [pscustomobject]@{ AMRunningMode = 'Normal'; RealTimeProtectionEnabled = $true; AntivirusSignatureLastUpdated = $jetzt.AddMinutes(-211) } }
function global:Get-MpThreatDetection {
    [CmdletBinding()] param()
    [pscustomobject]@{ InitialDetectionTime = $jetzt.AddMinutes(-158); ThreatID = 2147735503; ThreatStatusID = 3; ActionSuccess = $true; DomainUser = 'FIRMA\mmuster'; ProcessName = 'C:\Program Files\Notepad++\notepad++.exe'; Resources = @('file:_C:\Users\mmuster\Downloads\plugin.dll') }
}
function global:Get-MpThreat { [CmdletBinding()] param() [pscustomobject]@{ ThreatID = 2147735503; ThreatName = 'Trojan:Win32/Wacatac.B!ml' } }
function global:Get-NetIPConfiguration {
    [CmdletBinding()] param()
    [pscustomobject]@{ InterfaceAlias = 'Ethernet'; NetAdapter = [pscustomobject]@{ Status = 'Up' }; IPv4Address = @([pscustomobject]@{ IPAddress = '10.0.0.5' }); IPv4DefaultGateway = @([pscustomobject]@{ NextHop = '10.0.0.1' }); DNSServer = @([pscustomobject]@{ ServerAddresses = @('10.0.0.2', '10.0.0.3') }) }
}
function global:netsh { 'Direkter Zugriff (kein Proxyserver).' }
function global:Get-AppxPackage { [CmdletBinding()] param([string]$Name) }
function global:Get-ScheduledTask {
    [CmdletBinding()] param()
    [pscustomobject]@{ TaskName = 'Notepad++ Update'; TaskPath = '\'; State = 'Ready'; Author = 'FIRMA\svc-empirum'; Actions = @([pscustomobject]@{ Execute = 'C:\Program Files\Notepad++\updater\gup.exe'; Arguments = '-silent' }) }
}
function global:Get-ScheduledTaskInfo {
    [CmdletBinding()] param([Parameter(ValueFromPipeline)]$InputObject)
    process { [pscustomobject]@{ LastRunTime = $jetzt.AddDays(-1).AddMinutes(-23); LastTaskResult = [uint32]2147942402 } }
}
function global:Get-AuthenticodeSignature {
    [CmdletBinding()] param([string]$LiteralPath)
    if ($LiteralPath -like '*NppPlugin*') { [pscustomobject]@{ Status = 'NotSigned' } } else { [pscustomobject]@{ Status = 'Valid' } }
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

try {
    $datei = Join-Path $basis 'bericht.txt'
    $bericht = & $skript -Software 'Notepad++' -Ausgabe $datei | Out-String
    if ($env:LAGEBILD_TEST_BERICHT) { Copy-Item $datei $env:LAGEBILD_TEST_BERICHT }

    Pruefe $bericht 'nicht abrufbar' 'kein Abschnitt bricht ab' -Nicht
    Pruefe $bericht 'ZU-ALT-DARF-NICHT-ERSCHEINEN' 'Ereignisse außerhalb des Zeitfensters fehlen' -Nicht
    Pruefe $bericht '\d\d/\d\d/\d{4}' 'keine US-Datumsangaben' -Nicht
    Pruefe (Abschnitt $bericht 'Bericht') 'UTC[+-]\d\d:\d\d' 'Kopf mit UTC-Versatz'
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
    Pruefe $abstuerze 'plugins\\NppPlugin\\NppPlugin\.dll' 'Absturz mit Modulpfad'
    Pruefe $abstuerze '\d{4}-\d\d-\d\d \d\d:\d\d:\d\d' 'Zeiten im ISO-Format'
    Pruefe $abstuerze 'FileNotFoundException' '.NET-Ausnahme mit Typ'
    Pruefe (Abschnitt $bericht 'Startfehler') '0xc000007b' 'Startfehler aus Application Popup 26'
    $msi = Abschnitt $bericht 'Windows Installer'
    Pruefe $msi '1040' 'Installer-Transaktion Beginn'
    Pruefe $msi '1042' 'Installer-Transaktion Ende'
    Pruefe $msi 'Fehlerstatus der Installation: 1618' 'Rückgabewert aus 1033'
    Pruefe $msi 'Den Rückgabewert nennen 1033' 'Hinweis auf 1033 und 1034'
    Pruefe (Abschnitt $bericht 'Windows Update im Zeitraum') '0x80073712' 'Update-Fehlerereignis'
    $wu = Abschnitt $bericht 'Windows Update, letzte'
    Pruefe $wu 'fehlgeschlagen' 'Update-Verlauf mit Ergebnis'
    Pruefe $wu '0x80073712' 'negativer HResult als 0x80073712'
    $defender = Abschnitt $bericht 'Microsoft Defender'
    Pruefe $defender 'Trojan:Win32/Wacatac\.B!ml' 'Defender-Fund mit Namen'
    Pruefe $defender 'Status\s*:\s*3' 'Defender-Fund mit Status'
    Pruefe $defender 'plugin\.dll' 'Defender-Fund mit Datei'
    $netz = Abschnitt $bericht 'Netzwerk'
    Pruefe $netz '10\.0\.0\.5\s+10\.0\.0\.1\s+10\.0\.0\.2, 10\.0\.0\.3' 'Adresse, Gateway und DNS lesbar'
    Pruefe $netz 'Direkter Zugriff' 'WinHTTP-Proxy'
    Pruefe $bericht '== Umgebung: PATH' 'PATH-Abschnitt vorhanden'
    $installiert = Abschnitt $bericht 'Installiert'
    Pruefe $installiert 'Rechner 64-Bit' '64-Bit-Eintrag'
    Pruefe $installiert 'Rechner 32-Bit' '32-Bit-Eintrag'
    Pruefe $installiert '\{11111111-2222-3333-4444-555555555555\}' 'Produktcode als Schlüssel'
    Pruefe $installiert 'Mehrere Einträge' 'Hinweis auf mehrere Einträge'
    Pruefe $installiert '7-Zip' 'fremde Software nicht aufgeführt' -Nicht
    $ordner = Abschnitt $bericht 'Programmordner'
    Pruefe $ordner 'notepad\+\+\.exe.*Valid' 'Programmdatei mit Signatur'
    Pruefe $ordner 'NppPlugin\.dll.*NotSigned' 'kürzlich geändertes Plugin mit fehlender Signatur'
    Pruefe $ordner 'gup\.exe' 'alte Datei im Unterordner nicht aufgeführt' -Nicht
    $prozesse = Abschnitt $bericht 'Laufende Prozesse'
    Pruefe $prozesse 'notepad\+\+\.exe' 'laufender Prozess'
    Pruefe $prozesse 'ParentProcessId\s*:\s*6004' 'Elternprozess'
    Pruefe $prozesse 'msiexec' 'fremder Prozess nicht aufgeführt' -Nicht
    Pruefe (Abschnitt $bericht 'Dienste:') 'PathName\s*:.*gup\.exe' 'Dienst mit Programmpfad'
    $aufgaben = Abschnitt $bericht 'Geplante Aufgaben'
    Pruefe $aufgaben 'Aktion\s*:.*gup\.exe -silent' 'Aufgabe mit Aktion'
    Pruefe $aufgaben 'Autor\s*:\s*FIRMA' 'Aufgabe mit Autor'
    Pruefe $aufgaben '0x80070002' 'Aufgabe mit Ergebnis als Hex'
    $verteilung = Abschnitt $bericht 'Softwareverteilung'
    Pruefe $verteilung 'Skriptkopie: .*Setup\.inf' 'Empirum-Skriptkopie gefunden'
    Pruefe $verteilung 'Call MsiExec' 'Aufrufe aus der Skriptkopie'
    Pruefe $verteilung 'ErrorLevel: 1618' 'Fehlerzeile aus dem Paketprotokoll'
    $bezug = Abschnitt $bericht 'Ereignisse mit Bezug'
    Pruefe $bezug 'Installationsvorgang fehlgeschlagen' 'Ereignis mit Programmnamen'
    Pruefe $bezug 'Wacatac' 'Defender-Ereignis mit Programmnamen'
    Pruefe (Get-Content $datei -Raw) '== Ende' 'Bericht in Datei geschrieben'

    $spaet = & $skript -Seit $jetzt.AddHours(-2) | Out-String
    Pruefe (Abschnitt $spaet 'Programmabstürze') 'NppPlugin' 'mit -Seit: neuer Absturz enthalten'
    Pruefe (Abschnitt $spaet 'Programmabstürze') 'ntdll' 'mit -Seit: älterer Absturz ausgeschlossen' -Nicht
    Pruefe (Abschnitt $spaet 'Windows Installer') '(nichts gefunden)' 'mit -Seit: keine Installer-Ereignisse'

    $klammern = & $skript -Software 'Tool [x64]' | Out-String
    Pruefe $klammern 'nicht abrufbar' 'Programmname mit eckigen Klammern' -Nicht
}
finally {
    $env:ProgramData = $alteUmgebung.ProgramData
    $env:windir = $alteUmgebung.windir
    Remove-Item $basis -Recurse -Force -ErrorAction SilentlyContinue
}

if ($fehler) { "$fehler Prüfung(en) fehlgeschlagen"; exit 1 }
'Alle Prüfungen bestanden'
