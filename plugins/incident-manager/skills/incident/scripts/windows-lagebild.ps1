<#
.SYNOPSIS
    Sammelt ein Lagebild eines Windows-Rechners für die Störungsdiagnose. Ändert nichts.

.DESCRIPTION
    Liest System, ausstehenden Neustart, Datenträger, Speicher, Dienste, Fehlerereignisse,
    Programmabstürze und Startfehler, Windows-Installer-Ereignisse, Windows-Update-Verlauf,
    Defender, Netzwerk und PATH. Mit -Software zusätzlich alles zu einem Programm:
    Installationen in allen Registry-Ansichten, Dateien im Programmordner mit Version und
    Signatur, Store-Apps, Prozesse, Dienste, geplante Aufgaben, Empirum-Skriptkopie und
    -Protokolle sowie Ereignisse einschließlich Defender.

    Läuft unter Windows PowerShell 5.1 und PowerShell 7, ohne Administratorrechte. Als der
    betroffene Benutzer ausführen, sonst zeigen Benutzerteil der Registry und Profilpfade
    auf das falsche Konto. Mit Administratorrechten sind Defender-Funde und Protokolle unter
    C:\Windows\Temp vollständiger.

    Der Bericht enthält Rechner- und Benutzernamen. Vor dem Weitergeben prüfen.

.PARAMETER Software
    Teil des Programmnamens, zum Beispiel "Notepad++" oder "Acrobat".

.PARAMETER Stunden
    Zeitraum für Ereignisse in Stunden, Standard 48.

.PARAMETER Seit
    Beginn des Zeitraums als Zeitpunkt, zum Beispiel "2026-09-28 18:00". Hat Vorrang vor -Stunden.

.PARAMETER Ausgabe
    Datei, in die der Bericht zusätzlich geschrieben wird (UTF-8).

.EXAMPLE
    powershell -NoProfile -ExecutionPolicy Bypass -File .\windows-lagebild.ps1 -Software "Notepad++" -Ausgabe "$env:TEMP\lagebild.txt"
#>
[CmdletBinding()]
param(
    [string]$Software,
    [ValidateRange(1, 720)][int]$Stunden = 48,
    [datetime]$Seit,
    [string]$Ausgabe
)

$start = Get-Date
if ($PSBoundParameters.ContainsKey('Seit')) { $seit = $Seit } else { $seit = $start.AddHours(-$Stunden) }
$bericht = New-Object System.Collections.Generic.List[string]

function Kurz {
    param([string]$Text, [int]$Laenge = 160)
    if (-not $Text) { return '' }
    $t = ($Text -replace '\s+', ' ').Trim()
    if ($t.Length -gt $Laenge) { return $t.Substring(0, $Laenge) + ' ...' }
    return $t
}

function Hex {
    param($Wert)
    if ($null -eq $Wert -or $Wert -eq '') { return '' }
    if ($Wert -is [string]) {
        if ($Wert -match '^0x') { return $Wert }
        return '0x' + $Wert
    }
    $zahl = [int64]$Wert
    if ($zahl -lt 0) { $zahl += 4294967296 }
    return '0x{0:X8}' -f $zahl
}

function Zeit {
    param($Wert)
    if (-not $Wert) { return '' }
    return ([datetime]$Wert).ToString('yyyy-MM-dd HH:mm:ss')
}

function Abschnitt {
    param([string]$Titel, [scriptblock]$Inhalt)
    $bericht.Add('')
    $bericht.Add("== $Titel")
    $ErrorActionPreference = 'Stop'
    try {
        $text = & $Inhalt | Out-String -Width 250
        if ([string]::IsNullOrWhiteSpace($text)) { $text = '(nichts gefunden)' }
        $bericht.Add($text.TrimEnd())
    }
    catch {
        $bericht.Add("(nicht abrufbar: $(Kurz $_.Exception.Message 200))")
    }
}

$istAdmin = $false
try {
    $identitaet = [Security.Principal.WindowsIdentity]::GetCurrent()
    $istAdmin = (New-Object Security.Principal.WindowsPrincipal $identitaet).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}
catch { $istAdmin = $false }

Abschnitt 'Bericht' {
    $versatz = [TimeZoneInfo]::Local.GetUtcOffset($start)
    "Erstellt:         $(Zeit $start) (UTC$(if ($versatz -lt [TimeSpan]::Zero) { '-' } else { '+' })$($versatz.ToString('hh\:mm')), $([TimeZoneInfo]::Local.Id))"
    "Ereigniszeitraum: seit $(Zeit $seit)"
    "Benutzer:         $env:USERDOMAIN\$env:USERNAME, Administratorrechte: $istAdmin"
    "PowerShell:       $($PSVersionTable.PSVersion), 64-Bit-Prozess: $([Environment]::Is64BitProcess)"
    if ($Software) { "Software:         $Software" }
    'Hinweis:          enthält Rechner- und Benutzernamen, vor dem Weitergeben prüfen. Alle Zeiten Ortszeit.'
}

Abschnitt 'System' {
    $os = Get-CimInstance Win32_OperatingSystem -ErrorAction Stop
    $cs = Get-CimInstance Win32_ComputerSystem -ErrorAction Stop
    $cv = Get-ItemProperty 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion' -ErrorAction SilentlyContinue
    [pscustomobject]@{
        Rechner       = $os.CSName
        System        = $os.Caption
        Version       = "$($cv.DisplayVersion) Build $($os.BuildNumber).$($cv.UBR)"
        Architektur   = $os.OSArchitecture
        Sprache       = $os.MUILanguages -join ', '
        Domaene       = $(if ($cs.PartOfDomain) { $cs.Domain } else { "Arbeitsgruppe $($cs.Workgroup)" })
        Modell        = "$($cs.Manufacturer) $($cs.Model)"
        RAM_GB        = [math]::Round([double]$cs.TotalPhysicalMemory / 1GB, 1)
        RAM_frei_GB   = [math]::Round([double]$os.FreePhysicalMemory / 1MB, 1)
        LetzterStart  = Zeit $os.LastBootUpTime
        Laufzeit_Tage = [math]::Round(((Get-Date) - $os.LastBootUpTime).TotalDays, 1)
    } | Format-List
}

Abschnitt 'Neustart ausstehend, laufende Installationen' {
    $sm = Get-ItemProperty 'HKLM:\SYSTEM\CurrentControlSet\Control\Session Manager' -ErrorAction SilentlyContinue
    [pscustomobject]@{
        Komponentenwartung       = Test-Path 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Component Based Servicing\RebootPending'
        WindowsUpdate            = Test-Path 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\WindowsUpdate\Auto Update\RebootRequired'
        Dateiumbenennungen       = [bool]$sm.PendingFileRenameOperations
        InstallerUnterbrochen    = Test-Path 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Installer\InProgress'
    } | Format-List
    'Dateiumbenennungen allein ist ein schwaches Zeichen, viele Programme hinterlassen dort Einträge.'
    $msi = Get-CimInstance Win32_Process -Filter "Name='msiexec.exe'" -ErrorAction Stop
    if ($msi) {
        'msiexec-Prozesse (/V ist der Dienst und harmlos, /i oder /x mit altem Start ist verdächtig):'
        $msi | Select-Object ProcessId, ParentProcessId, @{ n = 'Gestartet'; e = { Zeit $_.CreationDate } }, @{ n = 'Aufruf'; e = { Kurz $_.CommandLine 200 } } | Format-Table -AutoSize -Wrap
    }
    else { 'Kein msiexec-Prozess aktiv.' }
}

Abschnitt 'Datenträger' {
    Get-CimInstance Win32_LogicalDisk -Filter 'DriveType=3' -ErrorAction Stop | ForEach-Object {
        [pscustomobject]@{
            Laufwerk    = $_.DeviceID
            GroesseGB   = [math]::Round([double]$_.Size / 1GB, 1)
            FreiGB      = [math]::Round([double]$_.FreeSpace / 1GB, 1)
            FreiProzent = $(if ($_.Size) { [int](100 * [double]$_.FreeSpace / $_.Size) } else { $null })
        }
    } | Format-Table -AutoSize
}

Abschnitt 'Prozesse: meiste CPU-Zeit seit Start und meister Arbeitsspeicher' {
    $prozesse = Get-Process -ErrorAction Stop
    $prozesse | Sort-Object CPU -Descending | Select-Object -First 10 Name, Id,
        @{ n = 'CPU_s'; e = { [int]$_.CPU } },
        @{ n = 'RAM_MB'; e = { [int]($_.WorkingSet64 / 1MB) } } | Format-Table -AutoSize
    $prozesse | Sort-Object WorkingSet64 -Descending | Select-Object -First 10 Name, Id,
        @{ n = 'RAM_MB'; e = { [int]($_.WorkingSet64 / 1MB) } } | Format-Table -AutoSize
    'Momentaufnahme zu Beginn des Laufs; spätere Abschnitte können andere Prozess-IDs zeigen.'
}

Abschnitt 'Automatisch startende Dienste, die nicht laufen' {
    Get-CimInstance Win32_Service -Filter "StartMode='Auto' AND State<>'Running'" -ErrorAction Stop |
        Select-Object Name, DisplayName, State, ExitCode | Format-Table -AutoSize -Wrap
    'Dienste mit Trigger-Start oder verzögertem Start stehen hier oft, ohne dass etwas fehlt.'
}

Abschnitt 'Kritisch und Fehler in System und Application, gruppiert' {
    $ereignisse = Get-WinEvent -FilterHashtable @{ LogName = 'System', 'Application'; Level = 1, 2; StartTime = $seit } -ErrorAction SilentlyContinue
    $ereignisse | Group-Object ProviderName, Id | Sort-Object Count -Descending | Select-Object -First 25 | ForEach-Object {
        $gruppe = @($_.Group | Sort-Object TimeCreated)
        [pscustomobject]@{
            Anzahl  = $_.Count
            Quelle  = $gruppe[0].ProviderName
            Id      = $gruppe[0].Id
            Erstes  = Zeit $gruppe[0].TimeCreated
            Letztes = Zeit $gruppe[-1].TimeCreated
            Meldung = Kurz $gruppe[-1].Message 150
        }
    } | Format-Table -AutoSize -Wrap
}

Abschnitt 'Programmabstürze, Hänger und .NET-Fehler' {
    $filter = @{ LogName = 'Application'; ProviderName = 'Application Error', 'Application Hang', '.NET Runtime'; Id = 1000, 1002, 1026; StartTime = $seit }
    Get-WinEvent -FilterHashtable $filter -ErrorAction SilentlyContinue | Sort-Object TimeCreated -Descending | Select-Object -First 30 | ForEach-Object {
        $p = $_.Properties
        $art = switch ($_.Id) { 1000 { 'Absturz' } 1002 { 'Hänger' } 1026 { '.NET' } }
        $programm = ''
        $modul = ''
        $code = ''
        $modulpfad = ''
        if ($_.Id -in 1000, 1002 -and $p.Count -gt 1) { $programm = "$($p[0].Value) $($p[1].Value)" }
        if ($_.Id -eq 1000 -and $p.Count -gt 6) {
            $modul = "$($p[3].Value) $($p[4].Value)"
            $code = Hex $p[6].Value
        }
        # Ab Windows 10 stehen Programm- und Modulpfad an Position 10 und 11
        if ($_.Id -eq 1000 -and $p.Count -gt 11) { $modulpfad = "$($p[11].Value)" }
        [pscustomobject]@{
            Zeit      = Zeit $_.TimeCreated
            Art       = $art
            Programm  = $programm
            Modul     = $modul
            Code      = $code
            Modulpfad = $modulpfad
            Meldung   = $(if ($_.Id -eq 1026) { Kurz $_.Message 300 } else { '' })
        }
    } | Format-Table -AutoSize -Wrap
}

Abschnitt 'Startfehler (Application Popup 26, etwa 0xc000007b oder fehlende DLL)' {
    $filter = @{ LogName = 'System'; ProviderName = 'Application Popup'; Id = 26; StartTime = $seit }
    Get-WinEvent -FilterHashtable $filter -ErrorAction SilentlyContinue | Sort-Object TimeCreated -Descending | Select-Object -First 20 |
        Select-Object @{ n = 'Zeit'; e = { Zeit $_.TimeCreated } }, @{ n = 'Meldung'; e = { Kurz $_.Message 220 } } | Format-Table -AutoSize -Wrap
    'Startet ein Programm gar nicht, gibt es oft kein Absturzereignis, nur diesen Eintrag. Weiter mit windows-startcheck.ps1.'
}

Abschnitt 'Bluescreens, unerwartete Neustarts und Treiber' {
    $filter = @{ LogName = 'System'; ProviderName = 'Microsoft-Windows-WER-SystemErrorReporting', 'Microsoft-Windows-Kernel-Power', 'EventLog'; Id = 1001, 41, 6008; StartTime = $seit }
    $neustarts = Get-WinEvent -FilterHashtable $filter -ErrorAction SilentlyContinue |
        Where-Object { ($_.Id -eq 1001 -and $_.ProviderName -like '*SystemErrorReporting') -or ($_.Id -eq 41 -and $_.ProviderName -like '*Kernel-Power') -or ($_.Id -eq 6008 -and $_.ProviderName -eq 'EventLog') }
    if ($neustarts) {
        $neustarts | Sort-Object TimeCreated -Descending | Select-Object -First 15 @{ n = 'Zeit'; e = { Zeit $_.TimeCreated } },
            @{ n = 'Art'; e = { switch ($_.Id) { 1001 { 'Bluescreen' } 41 { 'Neustart ohne Herunterfahren' } 6008 { 'unerwartet beendet' } } } },
            @{ n = 'Meldung'; e = { Kurz $_.Message 220 } } | Format-Table -AutoSize -Wrap
    }
    else { 'Keine Bluescreens oder unerwarteten Neustarts im Zeitraum.' }
    $ordner = Join-Path $env:windir 'Minidump'
    try {
        $abbilder = @(Get-ChildItem -LiteralPath $ordner -Filter '*.dmp' -File -ErrorAction Stop | Sort-Object LastWriteTime -Descending | Select-Object -First 10)
        if ($abbilder) {
            "Speicherabbilder in ${ordner}:"
            $abbilder | Select-Object Name, @{ n = 'Zeit'; e = { Zeit $_.LastWriteTime } }, @{ n = 'KB'; e = { [int]($_.Length / 1KB) } } | Format-Table -AutoSize
        }
        else { "Keine Speicherabbilder in $ordner." }
    }
    catch { "Speicherabbilder in $ordner nicht lesbar (meist fehlen Administratorrechte oder der Ordner existiert nicht)." }
    $treiber = Get-WinEvent -FilterHashtable @{ LogName = 'System'; ProviderName = 'Microsoft-Windows-UserPnp'; Id = 20001; StartTime = $seit } -ErrorAction SilentlyContinue
    if ($treiber) {
        'Treiberinstallationen im Zeitraum (UserPnp 20001):'
        $treiber | Sort-Object TimeCreated -Descending | Select-Object -First 20 @{ n = 'Zeit'; e = { Zeit $_.TimeCreated } },
            @{ n = 'Meldung'; e = { Kurz $_.Message 220 } } | Format-Table -AutoSize -Wrap
    }
    else { 'Keine Treiberinstallationen im Zeitraum.' }
}

Abschnitt 'Windows Installer (MsiInstaller)' {
    $filter = @{ LogName = 'Application'; ProviderName = 'MsiInstaller'; Id = 1025, 1033, 1034, 1035, 1040, 1042, 11707, 11708, 11724, 11725; StartTime = $seit }
    $ereignisse = Get-WinEvent -FilterHashtable $filter -ErrorAction SilentlyContinue
    if ($ereignisse) {
        $ereignisse | Sort-Object TimeCreated -Descending | Select-Object -First 40 @{ n = 'Zeit'; e = { Zeit $_.TimeCreated } }, Id,
            @{ n = 'Meldung'; e = { Kurz $_.Message 200 } } | Format-Table -AutoSize -Wrap
        'Den Rückgabewert nennen 1033 (Installation) und 1034 (Entfernung); 11708 allein nennt keinen. 1025: Datei war von einem Prozess belegt.'
        '1040 und 1042 sind Beginn und Ende einer Installer-Transaktion; schließen sie die Zeit eines 1618 ein, lief dort die andere Installation.'
    }
}

Abschnitt 'Windows Update im Zeitraum (Ereignis-IDs: 43 = gestartet, 19 = installiert, 20 = fehlgeschlagen)' {
    $filter = @{ LogName = 'System'; ProviderName = 'Microsoft-Windows-WindowsUpdateClient'; Id = 19, 20, 43; StartTime = $seit }
    Get-WinEvent -FilterHashtable $filter -ErrorAction SilentlyContinue | Sort-Object TimeCreated -Descending | Select-Object -First 30 @{ n = 'Zeit'; e = { Zeit $_.TimeCreated } }, Id,
        @{ n = 'Meldung'; e = { Kurz $_.Message 160 } } | Format-Table -AutoSize -Wrap
}

Abschnitt 'Windows Update, letzte Vorgänge' {
    $suche = (New-Object -ComObject Microsoft.Update.Session).CreateUpdateSearcher()
    $anzahl = $suche.GetTotalHistoryCount()
    if ($anzahl -gt 0) {
        $suche.QueryHistory(0, [math]::Min($anzahl, 15)) | ForEach-Object {
            $ergebnis = switch ($_.ResultCode) { 1 { 'läuft' } 2 { 'erfolgreich' } 3 { 'mit Fehlern' } 4 { 'fehlgeschlagen' } 5 { 'abgebrochen' } default { "$_" } }
            [pscustomobject]@{
                Datum    = Zeit $_.Date
                Ergebnis = $ergebnis
                Code     = Hex $_.HResult
                Titel    = Kurz $_.Title 110
            }
        } | Format-Table -AutoSize -Wrap
    }
}

Abschnitt 'Microsoft Defender' {
    $status = Get-MpComputerStatus -ErrorAction Stop
    [pscustomobject]@{
        Modus          = $status.AMRunningMode
        Echtzeitschutz = $status.RealTimeProtectionEnabled
        Signaturen     = Zeit $status.AntivirusSignatureLastUpdated
    } | Format-List
    $funde = Get-MpThreatDetection -ErrorAction SilentlyContinue | Where-Object { $_.InitialDetectionTime -ge $seit }
    if ($funde) {
        $namen = @{}
        Get-MpThreat -ErrorAction SilentlyContinue | ForEach-Object { $namen["$($_.ThreatID)"] = $_.ThreatName }
        'Funde im Zeitraum:'
        $funde | Select-Object -First 10 | ForEach-Object {
            [pscustomobject]@{
                Zeit      = Zeit $_.InitialDetectionTime
                Name      = $namen["$($_.ThreatID)"]
                ThreatID  = $_.ThreatID
                Status    = $_.ThreatStatusID
                Erfolg    = $_.ActionSuccess
                Benutzer  = $_.DomainUser
                Prozess   = $_.ProcessName
                Dateien   = Kurz ($_.Resources -join '; ') 200
            }
        } | Format-List
        'Status ist die ThreatStatusID von Defender (etwa 2 bereinigt, 3 in Quarantäne, 6 blockiert); Erfolg sagt, ob die Aktion geklappt hat.'
    }
    else { 'Keine Funde im Zeitraum (ohne Administratorrechte unvollständig).' }
}

Abschnitt 'Netzwerk' {
    Get-NetIPConfiguration -ErrorAction Stop | Where-Object { $_.NetAdapter.Status -eq 'Up' } | Select-Object InterfaceAlias,
        @{ n = 'IPv4'; e = { $_.IPv4Address.IPAddress -join ', ' } },
        @{ n = 'Gateway'; e = { $_.IPv4DefaultGateway.NextHop -join ', ' } },
        @{ n = 'DNS'; e = { $_.DNSServer.ServerAddresses -join ', ' } } | Format-Table -AutoSize -Wrap
    'WinHTTP-Proxy (gilt für Dienste, Windows Update und viele Installer):'
    netsh winhttp show proxy
}

Abschnitt 'Umgebung: PATH (Rechner, dann Benutzer)' {
    foreach ($ebene in 'Machine', 'User') {
        [Environment]::GetEnvironmentVariable('Path', $ebene) -split ';' | Where-Object { $_ -and $_.Trim() } | ForEach-Object {
            $eintrag = [Environment]::ExpandEnvironmentVariables($_.Trim().Trim('"'))
            '{0,-8} {1,-5} {2}' -f $ebene, $(if (Test-Path -LiteralPath $eintrag) { '' } else { 'fehlt' }), $eintrag
        }
    }
}

if ($Software) {
    $muster = '*' + [System.Management.Automation.WildcardPattern]::Escape($Software) + '*'
    $quellen = @(
        @{ Pfad = 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*'; Ansicht = 'Rechner 64-Bit' },
        @{ Pfad = 'HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*'; Ansicht = 'Rechner 32-Bit' },
        @{ Pfad = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*'; Ansicht = 'nur Benutzer' }
    )
    $installationen = @(foreach ($q in $quellen) {
            Get-ItemProperty $q.Pfad -ErrorAction SilentlyContinue | Where-Object { $_.DisplayName -like $muster } | ForEach-Object {
                [pscustomobject]@{
                    Ansicht        = $q.Ansicht
                    Name           = $_.DisplayName
                    Version        = $_.DisplayVersion
                    Hersteller     = $_.Publisher
                    InstalliertAm  = $_.InstallDate
                    Schluessel     = $_.PSChildName
                    MSI            = [bool]$_.WindowsInstaller
                    Ausgeblendet   = [bool]$_.SystemComponent
                    Ort            = $_.InstallLocation
                    Symbol         = $_.DisplayIcon
                    Deinstallation = $_.UninstallString
                }
            }
        })

    Abschnitt "Installiert: $Software" {
        $installationen | Select-Object Ansicht, Name, Version, Hersteller, InstalliertAm, Schluessel, MSI, Ausgeblendet, Ort, Deinstallation | Format-List
        if ($installationen.Count -gt 1) { 'Mehrere Einträge: auf parallele Versionen, 32/64-Bit-Mischung oder Reste alter Installationen achten.' }
    }

    Abschnitt "Programmordner: $Software (Version und Signatur)" {
        # Ordner aus InstallLocation, sonst aus DisplayIcon oder UninstallString, soweit das auf eine Datei zeigt
        $ordner = @(foreach ($i in $installationen) {
                if ($i.Ort) { $i.Ort.Trim('"') }
                foreach ($angabe in $i.Symbol, $i.Deinstallation) {
                    if ($angabe -and $angabe -notmatch '(?i)msiexec') {
                        $datei = ($angabe -replace ',\s*-?\d+$', '').Trim().Trim('"')
                        if ($datei -match '^(.+?\.exe)') { $datei = $Matches[1].Trim('"') }
                        if ($datei) { Split-Path -Parent $datei }
                    }
                }
            }) | Where-Object { $_ -and (Test-Path -LiteralPath $_ -PathType Container) } | Select-Object -Unique
        foreach ($o in $ordner) {
            "Ordner: $o"
            $oben = @(Get-ChildItem -LiteralPath $o -File -ErrorAction SilentlyContinue | Where-Object { $_.Extension -in '.exe', '.dll' } | Select-Object -First 25)
            $neu = @(Get-ChildItem -LiteralPath $o -Recurse -File -ErrorAction SilentlyContinue |
                    Where-Object { $_.Extension -in '.exe', '.dll' -and $_.DirectoryName -ne $o -and $_.LastWriteTime -ge $seit } | Select-Object -First 15)
            $oben + $neu | ForEach-Object {
                $signatur = ''
                try { $signatur = [string](Get-AuthenticodeSignature -LiteralPath $_.FullName -ErrorAction Stop).Status } catch { $signatur = '?' }
                [pscustomobject]@{
                    Datei     = $_.FullName.Substring($o.Length).TrimStart('\', '/')
                    Version   = $_.VersionInfo.FileVersion
                    Geaendert = Zeit $_.LastWriteTime
                    Signatur  = $signatur
                }
            } | Format-Table -AutoSize -Wrap
        }
        if (-not $ordner) { 'Kein Programmordner aus der Registry ableitbar.' }
        else { 'Unterordner nur mit Dateien, die im Zeitraum geändert wurden (etwa Plugins).' }
    }

    Abschnitt "Store- und MSIX-Apps: $Software" {
        Get-AppxPackage -Name $muster -ErrorAction Stop | Select-Object Name, Version, Architecture, Status, InstallLocation | Format-List
    }

    Abschnitt "Laufende Prozesse: $Software" {
        Get-CimInstance Win32_Process -ErrorAction Stop | Where-Object { $_.Name -like $muster -or $_.ExecutablePath -like $muster } |
            Select-Object Name, ProcessId, ParentProcessId, @{ n = 'Gestartet'; e = { Zeit $_.CreationDate } }, @{ n = 'RAM_MB'; e = { [int]($_.WorkingSetSize / 1MB) } },
            ExecutablePath, @{ n = 'Aufruf'; e = { Kurz $_.CommandLine 150 } } | Format-List
    }

    Abschnitt "Dienste: $Software" {
        Get-CimInstance Win32_Service -ErrorAction Stop | Where-Object { $_.Name -like $muster -or $_.DisplayName -like $muster -or $_.PathName -like $muster } |
            Select-Object Name, DisplayName, State, StartMode, StartName, ExitCode, PathName | Format-List
    }

    Abschnitt "Geplante Aufgaben: $Software" {
        Get-ScheduledTask -ErrorAction Stop | Where-Object { $_.TaskName -like $muster -or $_.TaskPath -like $muster } | ForEach-Object {
            $info = $null
            try { $info = $_ | Get-ScheduledTaskInfo -ErrorAction Stop } catch { $info = $null }
            [pscustomobject]@{
                Aufgabe     = $_.TaskPath + $_.TaskName
                Zustand     = $_.State
                Autor       = $_.Author
                Aktion      = (@($_.Actions) | ForEach-Object { "$($_.Execute) $($_.Arguments)".Trim() }) -join '; '
                LetzterLauf = Zeit $info.LastRunTime
                Ergebnis    = $(if ($info) { Hex $info.LastTaskResult } else { '' })
            }
        } | Format-List
    }

    Abschnitt "Softwareverteilung (Empirum): $Software" {
        $skripte = Join-Path $env:ProgramData '$Matrix42Scripts$'
        if (Test-Path -LiteralPath $skripte) {
            Get-ChildItem -LiteralPath $skripte -Recurse -Filter 'Setup.inf' -File -ErrorAction SilentlyContinue | Where-Object { $_.FullName -like $muster } | Select-Object -First 5 | ForEach-Object {
                "Skriptkopie: $($_.FullName) (geändert $(Zeit $_.LastWriteTime))"
                Select-String -LiteralPath $_.FullName -Pattern '^\s*-?\s*Call\b|MsiExec' -ErrorAction SilentlyContinue | Select-Object -First 15 | ForEach-Object { "  $($_.LineNumber): $($_.Line.Trim())" }
            }
        }
        else { 'Kein Ordner $Matrix42Scripts$ unter ProgramData.' }
        $temp = Join-Path $env:windir 'Temp'
        Get-ChildItem -LiteralPath $temp -Filter '*.log' -File -ErrorAction SilentlyContinue | Where-Object { $_.Name -like $muster } |
            Sort-Object LastWriteTime -Descending | Select-Object -First 5 | ForEach-Object {
                "Protokoll: $($_.FullName) (geändert $(Zeit $_.LastWriteTime))"
                Select-String -LiteralPath $_.FullName -Pattern 'ErrorLevel|Return value 3|ckgabewert 3|Fehler' -ErrorAction SilentlyContinue | Select-Object -Last 8 | ForEach-Object { "  $($_.LineNumber): $(Kurz $_.Line 200)" }
            }
        'Protokolle unter C:\Windows\Temp sind ohne Administratorrechte oft nicht lesbar.'
    }

    Abschnitt "Ereignisse mit Bezug zu $Software (System, Application, Defender; höchstens 5000 je Protokoll durchsucht)" {
        $allgemein = @(Get-WinEvent -FilterHashtable @{ LogName = 'System', 'Application'; StartTime = $seit } -MaxEvents 5000 -ErrorAction SilentlyContinue)
        $defender = @(Get-WinEvent -FilterHashtable @{ LogName = 'Microsoft-Windows-Windows Defender/Operational'; Id = 1116, 1117; StartTime = $seit } -MaxEvents 5000 -ErrorAction SilentlyContinue)
        $allgemein + $defender | Where-Object { $_.Message -like $muster } | Sort-Object TimeCreated -Descending | Select-Object -First 30 @{ n = 'Zeit'; e = { Zeit $_.TimeCreated } }, LevelDisplayName, ProviderName, Id,
            @{ n = 'Meldung'; e = { Kurz $_.Message 200 } } | Format-Table -AutoSize -Wrap
    }
}

$bericht.Add('')
$bericht.Add("== Ende, Dauer $([math]::Round(((Get-Date) - $start).TotalSeconds)) s")
$text = $bericht -join [Environment]::NewLine
$text
if ($Ausgabe) {
    $text | Out-File -FilePath $Ausgabe -Encoding utf8
    "Bericht gespeichert: $Ausgabe"
}
