<#
.SYNOPSIS
    Prüft, warum ein Windows-Programm nicht startet: fehlende DLLs und falsche Architektur. Ändert nichts.

.DESCRIPTION
    Für Startfehler wie 0xc000007b (ungültiges Image-Format), 0xc0000135 (DLL nicht gefunden)
    oder Meldungen wie "MSVCP140.dll fehlt". Liest die Importtabelle des Programms und der
    DLLs aus seinem Ordner, sucht jede benötigte DLL in der Reihenfolge, in der Windows sie
    sucht (Programmordner, Systemordner, Windows-Ordner, PATH), und meldet, was fehlt oder
    die falsche Architektur hat. Dazu: Dateien im Programmordner mit anderer Architektur
    oder jüngerem Datum, installierte Visual-C++-Laufzeiten, PATH und Startfehler-Meldungen
    (Application Popup 26) im Systemprotokoll.

    Läuft unter Windows PowerShell 5.1 und PowerShell 7, ohne Administratorrechte.

.PARAMETER Programm
    Pfad zur EXE oder ein Teil des Programmnamens. Beim Namen wird unter App Paths, in
    Startmenü- und Desktop-Verknüpfungen und im Installationsordner laut Registry gesucht.

.PARAMETER Seit
    Zeitpunkt, ab dem geänderte Dateien im Programmordner gemeldet werden, etwa der Rollout.

.PARAMETER Ausgabe
    Datei, in die der Bericht zusätzlich geschrieben wird (UTF-8).

.PARAMETER SystemOrdner
    Nur für Tests: Systemordner statt System32 bzw. SysWOW64.

.PARAMETER WindowsOrdner
    Nur für Tests: Windows-Ordner statt %WINDIR%.

.PARAMETER Suchpfad
    Nur für Tests: Ordnerliste statt PATH.

.EXAMPLE
    powershell -NoProfile -ExecutionPolicy Bypass -File .\windows-startcheck.ps1 -Programm "LohnPro" -Seit "2026-09-28 12:00" -Ausgabe "$env:TEMP\startcheck.txt"
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string]$Programm,
    [datetime]$Seit,
    [string]$Ausgabe,
    [string]$SystemOrdner,
    [string]$WindowsOrdner,
    [string[]]$Suchpfad
)

$start = Get-Date
$mitSeit = $PSBoundParameters.ContainsKey('Seit')
$bericht = New-Object System.Collections.Generic.List[string]
$maschinen = @{ 0x14c = 'x86'; 0x8664 = 'x64'; 0xAA64 = 'ARM64'; 0x1c4 = 'ARM' }

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
        $bericht.Add("(nicht abrufbar: $($_.Exception.Message))")
    }
}

function LiesZeichenkette {
    param([byte[]]$Daten, [int64]$Position)
    if ($Position -lt 0 -or $Position -ge $Daten.Length) { return $null }
    $ende = $Position
    while ($ende -lt $Daten.Length -and $Daten[$ende] -ne 0 -and ($ende - $Position) -lt 260) { $ende++ }
    return [Text.Encoding]::ASCII.GetString($Daten, [int]$Position, [int]($ende - $Position))
}

function LiesPE {
    # Liefert Architektur, .NET-Kennzeichen und importierte DLLs einer EXE oder DLL.
    param([string]$Pfad)
    $ergebnis = [pscustomobject]@{ Pfad = $Pfad; Arch = $null; DotNet = $false; Importe = @(); Verzoegert = @(); Fehler = $null }
    try {
        $daten = [IO.File]::ReadAllBytes($Pfad)
        if ($daten.Length -lt 64 -or [BitConverter]::ToUInt16($daten, 0) -ne 0x5A4D) { $ergebnis.Fehler = 'keine EXE oder DLL'; return $ergebnis }
        $pe = [BitConverter]::ToInt32($daten, 0x3C)
        if ($pe -le 0 -or $pe + 24 -gt $daten.Length -or [BitConverter]::ToUInt32($daten, $pe) -ne 0x4550) { $ergebnis.Fehler = 'kein PE-Kopf'; return $ergebnis }
        $maschine = [int][BitConverter]::ToUInt16($daten, $pe + 4)
        if ($maschinen.ContainsKey($maschine)) { $ergebnis.Arch = $maschinen[$maschine] } else { $ergebnis.Arch = '0x{0:X}' -f $maschine }
        $abschnitte = [BitConverter]::ToUInt16($daten, $pe + 6)
        $optGroesse = [BitConverter]::ToUInt16($daten, $pe + 20)
        $opt = $pe + 24
        $magic = [BitConverter]::ToUInt16($daten, $opt)
        if ($magic -eq 0x20B) { $verzeichnisse = $opt + 112; $basis = [BitConverter]::ToUInt64($daten, $opt + 24) }
        else { $verzeichnisse = $opt + 96; $basis = [uint64][BitConverter]::ToUInt32($daten, $opt + 28) }
        $tabelle = $opt + $optGroesse
        $sektionen = for ($i = 0; $i -lt $abschnitte; $i++) {
            $s = $tabelle + 40 * $i
            [pscustomobject]@{
                VA     = [BitConverter]::ToUInt32($daten, $s + 12)
                Groesse = [Math]::Max([BitConverter]::ToUInt32($daten, $s + 8), [BitConverter]::ToUInt32($daten, $s + 16))
                Datei  = [BitConverter]::ToUInt32($daten, $s + 20)
            }
        }
        $zuOffset = {
            param([uint64]$Rva)
            foreach ($s in $sektionen) {
                if ($Rva -ge $s.VA -and $Rva -lt ($s.VA + $s.Groesse)) { return [int64]($Rva - $s.VA + $s.Datei) }
            }
            return [int64]-1
        }
        $ergebnis.DotNet = ([BitConverter]::ToUInt32($daten, $verzeichnisse + 8 * 14) -ne 0)

        $importRva = [BitConverter]::ToUInt32($daten, $verzeichnisse + 8)
        $namen = New-Object System.Collections.Generic.List[string]
        if ($importRva) {
            $pos = & $zuOffset $importRva
            while ($pos -ge 0 -and $pos + 20 -le $daten.Length -and $namen.Count -lt 500) {
                $nameRva = [BitConverter]::ToUInt32($daten, [int]$pos + 12)
                $thunk = [BitConverter]::ToUInt32($daten, [int]$pos + 16)
                if ($nameRva -eq 0 -and $thunk -eq 0) { break }
                $name = LiesZeichenkette $daten (& $zuOffset $nameRva)
                if ($name) { $namen.Add($name) }
                $pos += 20
            }
        }
        $ergebnis.Importe = @($namen)

        $verzRva = [BitConverter]::ToUInt32($daten, $verzeichnisse + 8 * 13)
        $verz = New-Object System.Collections.Generic.List[string]
        if ($verzRva) {
            $pos = & $zuOffset $verzRva
            while ($pos -ge 0 -and $pos + 32 -le $daten.Length -and $verz.Count -lt 500) {
                $attribute = [BitConverter]::ToUInt32($daten, [int]$pos)
                $wert = [uint64][BitConverter]::ToUInt32($daten, [int]$pos + 4)
                if ($wert -eq 0) { break }
                if (($attribute -band 1) -eq 0 -and $wert -ge $basis) { $wert = $wert - $basis }
                $name = LiesZeichenkette $daten (& $zuOffset $wert)
                if ($name) { $verz.Add($name) }
                $pos += 32
            }
        }
        $ergebnis.Verzoegert = @($verz)
    }
    catch {
        $ergebnis.Fehler = "nicht lesbar: $($_.Exception.Message)"
    }
    return $ergebnis
}

function FindeProgramm {
    param([string]$Angabe)
    if (Test-Path -LiteralPath $Angabe -PathType Leaf) { return @((Resolve-Path -LiteralPath $Angabe).Path) }
    $muster = '*' + [Management.Automation.WildcardPattern]::Escape($Angabe) + '*'
    $treffer = New-Object System.Collections.Generic.List[string]
    foreach ($schluessel in 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths', 'HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths') {
        Get-ChildItem $schluessel -ErrorAction SilentlyContinue | Where-Object { $_.PSChildName -like $muster } | ForEach-Object {
            $wert = (Get-ItemProperty $_.PSPath -ErrorAction SilentlyContinue).'(default)'
            if ($wert) { $treffer.Add($wert.Trim('"')) }
        }
    }
    try {
        $shell = New-Object -ComObject WScript.Shell
        $orte = 'Desktop', 'CommonDesktopDirectory', 'StartMenu', 'CommonStartMenu' | ForEach-Object { [Environment]::GetFolderPath($_) } | Where-Object { $_ }
        Get-ChildItem $orte -Recurse -Filter '*.lnk' -ErrorAction SilentlyContinue | Where-Object { $_.BaseName -like $muster } | ForEach-Object {
            $ziel = $shell.CreateShortcut($_.FullName).TargetPath
            if ($ziel -like '*.exe') { $treffer.Add($ziel) }
        }
    }
    catch { $treffer = $treffer }
    foreach ($pfad in 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*', 'HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*', 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*') {
        Get-ItemProperty $pfad -ErrorAction SilentlyContinue | Where-Object { $_.DisplayName -like $muster -and $_.InstallLocation } | ForEach-Object {
            Get-ChildItem -LiteralPath $_.InstallLocation.Trim('"') -Filter '*.exe' -File -ErrorAction SilentlyContinue |
                Where-Object { $_.BaseName -like $muster } | ForEach-Object { $treffer.Add($_.FullName) }
        }
    }
    return @($treffer | Where-Object { $_ -and (Test-Path -LiteralPath $_ -PathType Leaf) } | Select-Object -Unique)
}

$kandidaten = @(FindeProgramm $Programm)
if ($kandidaten.Count -eq 0) {
    "Programm nicht gefunden: $Programm. Bitte mit -Programm den vollen Pfad zur EXE angeben."
    exit 1
}
$exe = $kandidaten[0]
$ordner = Split-Path -Parent $exe
$haupt = LiesPE $exe
$is64Os = [Environment]::Is64BitOperatingSystem

if (-not $WindowsOrdner) { $WindowsOrdner = $env:windir }
if (-not $SystemOrdner) {
    if ($haupt.Arch -eq 'x86' -and $is64Os) { $SystemOrdner = Join-Path $WindowsOrdner 'SysWOW64' }
    elseif ($is64Os -and -not [Environment]::Is64BitProcess) { $SystemOrdner = Join-Path $WindowsOrdner 'Sysnative' }
    else { $SystemOrdner = Join-Path $WindowsOrdner 'System32' }
}
if (-not $PSBoundParameters.ContainsKey('Suchpfad')) {
    $Suchpfad = @([Environment]::GetEnvironmentVariable('Path', 'Machine') -split ';') + @([Environment]::GetEnvironmentVariable('Path', 'User') -split ';') |
        Where-Object { $_ -and $_.Trim() } | ForEach-Object { [Environment]::ExpandEnvironmentVariables($_.Trim().Trim('"')) }
}
$bekannte = @()
try {
    $kd = Get-ItemProperty 'HKLM:\SYSTEM\CurrentControlSet\Control\Session Manager\KnownDLLs' -ErrorAction Stop
    $bekannte = @($kd.PSObject.Properties | Where-Object { $_.Value -is [string] -and $_.Value -like '*.dll' } | ForEach-Object { $_.Value.ToLower() })
}
catch { $bekannte = @() }

function FindeDll {
    # Suchreihenfolge für Desktop-Programme mit SafeDllSearchMode: KnownDLLs, Programmordner,
    # Systemordner, Windows-Ordner, PATH. Das aktuelle Verzeichnis ist beim Start meist der
    # Programmordner und wird deshalb nicht eigens geprüft.
    param([string]$Name)
    if ($bekannte -contains $Name.ToLower()) {
        $p = Join-Path $SystemOrdner $Name
        if (Test-Path -LiteralPath $p) { return [pscustomobject]@{ Ort = 'System (KnownDLLs)'; Pfad = $p } }
    }
    $p = Join-Path $ordner $Name
    if (Test-Path -LiteralPath $p) { return [pscustomobject]@{ Ort = 'Programmordner'; Pfad = $p } }
    $p = Join-Path $SystemOrdner $Name
    if (Test-Path -LiteralPath $p) { return [pscustomobject]@{ Ort = 'System'; Pfad = $p } }
    $p = Join-Path $WindowsOrdner $Name
    if (Test-Path -LiteralPath $p) { return [pscustomobject]@{ Ort = 'Windows'; Pfad = $p } }
    foreach ($d in $Suchpfad) {
        $p = Join-Path $d $Name
        if (Test-Path -LiteralPath $p) { return [pscustomobject]@{ Ort = 'PATH'; Pfad = $p } }
    }
    return $null
}

$zeilen = New-Object System.Collections.Generic.List[object]
$gesehen = @{}
$warteschlange = New-Object System.Collections.Generic.Queue[object]
$warteschlange.Enqueue($haupt)
$gesehen[$exe.ToLower()] = $true
while ($warteschlange.Count -gt 0 -and $gesehen.Count -lt 300) {
    $modul = $warteschlange.Dequeue()
    $liste = @($modul.Importe | ForEach-Object { @{ Name = $_; Art = 'direkt' } }) + @($modul.Verzoegert | ForEach-Object { @{ Name = $_; Art = 'verzögert' } })
    foreach ($import in $liste) {
        $name = $import.Name
        $fund = $null
        $arch = ''
        if ($name -match '^(api|ext)-ms-') {
            $bewertung = 'API-Set, löst Windows selbst auf'
        }
        else {
            $fund = FindeDll $name
            if (-not $fund) {
                if ($name -match '^msvc[rp](80|90)\.dll$') { $bewertung = 'nicht im Suchpfad, evtl. Side-by-Side (WinSxS)' }
                else { $bewertung = 'FEHLT' }
            }
            else {
                $info = LiesPE $fund.Pfad
                $arch = $info.Arch
                if ($info.Fehler) { $bewertung = "DEFEKT ($($info.Fehler))" }
                elseif ($info.Arch -ne $haupt.Arch) { $bewertung = "FALSCHE ARCHITEKTUR (Programm ist $($haupt.Arch))" }
                else { $bewertung = 'ok' }
                $schluessel = $fund.Pfad.ToLower()
                if ($fund.Ort -in 'Programmordner', 'PATH' -and -not $gesehen.ContainsKey($schluessel) -and -not $info.Fehler) {
                    $gesehen[$schluessel] = $true
                    $warteschlange.Enqueue($info)
                }
            }
        }
        $zeilen.Add([pscustomobject]@{
                Bewertung = $bewertung
                DLL       = $name
                Art       = $import.Art
                Von       = Split-Path -Leaf $modul.Pfad
                Fundort   = $(if ($fund) { "$($fund.Ort): $($fund.Pfad)" } else { '' })
                Arch      = $arch
            })
    }
}

Abschnitt 'Programm' {
    "Datei:        $exe"
    "Architektur:  $($haupt.Arch)$(if ($haupt.DotNet) { ' (.NET-Assembly)' })"
    if ($haupt.Fehler) { "FEHLER:       $($haupt.Fehler)" }
    "Systemordner: $SystemOrdner"
    "Geprüft:      $($gesehen.Count) Dateien, $($zeilen.Count) Importe"
    if ($kandidaten.Count -gt 1) {
        'Weitere Treffer für den Namen (bei Bedarf mit -Programm <Pfad> gezielt prüfen):'
        $kandidaten | Select-Object -Skip 1 | ForEach-Object { "  $_" }
    }
    if ($haupt.DotNet) { '.NET-Programme laden ihre Assemblys selbst; hier geprüft sind nur native DLLs.' }
}

Abschnitt 'Probleme bei benötigten DLLs' {
    $zeilen | Where-Object { $_.Bewertung -ne 'ok' -and $_.Bewertung -notlike 'API-Set*' } | Sort-Object Bewertung, DLL -Unique |
        Format-Table Bewertung, DLL, Art, Von, Fundort, Arch -AutoSize -Wrap
}

Abschnitt 'Benötigte DLLs, gefunden' {
    $zeilen | Where-Object { $_.Bewertung -eq 'ok' } | Sort-Object DLL -Unique | Format-Table DLL, Art, Von, Fundort, Arch -AutoSize -Wrap
}

Abschnitt 'Programmordner: andere Architektur oder kürzlich geändert' {
    Get-ChildItem -LiteralPath $ordner -Recurse -File -Include '*.dll', '*.exe', '*.ocx' -ErrorAction SilentlyContinue | Select-Object -First 2000 | ForEach-Object {
        $info = LiesPE $_.FullName
        $neu = $mitSeit -and ($_.LastWriteTime -ge $Seit -or $_.CreationTime -ge $Seit)
        if ($info.Arch -ne $haupt.Arch -or $info.Fehler -or $neu) {
            [pscustomobject]@{
                Arch      = $(if ($info.Fehler) { "DEFEKT ($($info.Fehler))" } else { $info.Arch })
                Geaendert = $_.LastWriteTime
                Version   = $_.VersionInfo.FileVersion
                Datei     = $_.FullName.Substring($ordner.Length).TrimStart('\', '/')
            }
        }
    } | Format-Table -AutoSize -Wrap
    'Andere Architektur ist nicht immer ein Fehler (Hilfsprogramme, Plugins für den jeweils anderen Prozesstyp), aber bei 0xc000007b die erste Spur.'
}

Abschnitt 'Installierte Visual-C++-Laufzeiten' {
    $quellen = @(
        @{ Pfad = 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*'; Ansicht = '64-Bit-Registry' },
        @{ Pfad = 'HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*'; Ansicht = '32-Bit-Registry' }
    )
    $treffer = foreach ($q in $quellen) {
        Get-ItemProperty $q.Pfad -ErrorAction SilentlyContinue | Where-Object { $_.DisplayName -like '*Visual C++*' } | ForEach-Object {
            [pscustomobject]@{ Name = $_.DisplayName; Version = $_.DisplayVersion; Registry = $q.Ansicht }
        }
    }
    $treffer | Sort-Object Name | Format-Table -AutoSize -Wrap
    'Maßgeblich ist die Architektur im Namen (x86 oder x64); 32-Bit-Programme brauchen die x86-Fassung, auch auf 64-Bit-Windows.'
}

Abschnitt 'PATH' {
    foreach ($d in $Suchpfad) { '{0}  {1}' -f $(if (Test-Path -LiteralPath $d) { '   ' } else { 'fehlt' }), $d }
}

Abschnitt 'Startfehler im Systemprotokoll (Application Popup 26)' {
    $filter = @{ LogName = 'System'; ProviderName = 'Application Popup'; Id = 26 }
    if ($mitSeit) { $filter.StartTime = $Seit } else { $filter.StartTime = (Get-Date).AddDays(-7) }
    $name = [IO.Path]::GetFileName($exe)
    Get-WinEvent -FilterHashtable $filter -ErrorAction SilentlyContinue | Where-Object { $_.Message -like "*$name*" -or $_.Message -like '*0xc0*' } |
        Select-Object -First 20 TimeCreated, @{ n = 'Meldung'; e = { ($_.Message -replace '\s+', ' ').Trim() } } | Format-Table -AutoSize -Wrap
}

$bericht.Add('')
$bericht.Add("== Ende, Dauer $([math]::Round(((Get-Date) - $start).TotalSeconds)) s")
$text = $bericht -join [Environment]::NewLine
$text
if ($Ausgabe) {
    $text | Out-File -FilePath $Ausgabe -Encoding utf8
    "Bericht gespeichert: $Ausgabe"
}
