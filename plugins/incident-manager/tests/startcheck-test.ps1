# Prüft windows-startcheck.ps1 mit echten Windows-Programmdateien, ohne Windows.
#
# Braucht x86-, x64- und ARM64-EXEs als Rohmaterial. Die Startprogramme aus dem Python-Paket
# distlib (t32.exe, t64.exe, w64-arm.exe) eignen sich: kleine, echte PE-Dateien mit Importtabelle.
# Pfad per Umgebungsvariable DISTLIB_ORDNER oder automatisch über Python.
#
# Aufruf: pwsh -NoProfile -File plugins/incident-manager/tests/startcheck-test.ps1

$ErrorActionPreference = 'Stop'
$skript = Join-Path $PSScriptRoot '../skills/incident/scripts/windows-startcheck.ps1'

$quelle = $env:DISTLIB_ORDNER
if (-not $quelle) {
    foreach ($py in 'python3', 'python') {
        try { $quelle = & $py -c 'import distlib, os; print(os.path.dirname(distlib.__file__))' 2>$null } catch { $quelle = $null }
        if ($quelle) { break }
    }
}
if (-not $quelle -or -not (Test-Path (Join-Path $quelle 't32.exe'))) {
    'Übersprungen: distlib mit t32.exe nicht gefunden (DISTLIB_ORDNER setzen).'
    exit 0
}

$basis = Join-Path ([IO.Path]::GetTempPath()) ("startcheck-" + [guid]::NewGuid().ToString('N'))
$app = Join-Path $basis 'app'
$sys = Join-Path $basis 'sys'
$win = Join-Path $basis 'win'
$pfad = Join-Path $basis 'pfad'
foreach ($o in $app, (Join-Path $app 'plugins'), $sys, $win, $pfad) { New-Item -ItemType Directory -Path $o | Out-Null }

# 32-Bit-Programm, das KERNEL32.dll und SHLWAPI.dll importiert
Copy-Item (Join-Path $quelle 't32.exe') (Join-Path $app 'LohnPro.exe')
# Copy-Item übernimmt das alte Änderungsdatum; das Programm soll als frisch geändert gelten
(Get-Item (Join-Path $app 'LohnPro.exe')).LastWriteTime = Get-Date
# KERNEL32.dll im Systemordner in passender Architektur
Copy-Item (Join-Path $quelle 't32.exe') (Join-Path $sys 'KERNEL32.dll')
# SHLWAPI.dll nur über PATH, und zwar als 64-Bit-Datei: der klassische 0xc000007b-Fall
Copy-Item (Join-Path $quelle 't64.exe') (Join-Path $pfad 'SHLWAPI.dll')
# ARM64-Datei im Programmordner
Copy-Item (Join-Path $quelle 'w64-arm.exe') (Join-Path $app 'plugins/fremd.dll')

$fehler = 0
function Pruefe([string]$Text, [string]$Muster, [string]$Beschreibung, [switch]$Nicht) {
    $gefunden = $Text -match $Muster
    if ($Nicht) { $ok = -not $gefunden } else { $ok = $gefunden }
    if ($ok) { "ok      $Beschreibung" } else { "FEHLER  $Beschreibung (Muster: $Muster)"; $script:fehler++ }
}
function Abschnitt([string]$Text, [string]$Titel) {
    ($Text -split '(?m)^== ' | Where-Object { $_.StartsWith($Titel) } | Select-Object -First 1)
}

try {
    $exe = Join-Path $app 'LohnPro.exe'
    $b1 = & $skript -Programm $exe -SystemOrdner $sys -WindowsOrdner $win -Suchpfad $pfad -Seit (Get-Date).AddMinutes(-5) | Out-String
    Pruefe (Abschnitt $b1 'Programm') 'Architektur:\s+x86' 'Programm als x86 erkannt'
    $probleme = Abschnitt $b1 'Probleme'
    Pruefe $probleme 'FALSCHE ARCHITEKTUR.*SHLWAPI\.dll.*PATH.*x64' '64-Bit-DLL über PATH gemeldet'
    Pruefe $probleme 'KERNEL32' 'passende Systemdatei nicht als Problem gemeldet' -Nicht
    Pruefe (Abschnitt $b1 'Benötigte DLLs, gefunden') 'KERNEL32\.dll.*System.*x86' 'Systemdatei gefunden und passend'
    $ordner = Abschnitt $b1 'Programmordner'
    Pruefe $ordner 'ARM64.*fremd\.dll' 'fremde Architektur im Programmordner'
    Pruefe $ordner 'LohnPro\.exe' 'kürzlich geänderte Datei mit -Seit gemeldet'
    Pruefe (Abschnitt $b1 'PATH') ([regex]::Escape($pfad)) 'PATH ausgegeben'

    Remove-Item (Join-Path $pfad 'SHLWAPI.dll')
    $b2 = & $skript -Programm $exe -SystemOrdner $sys -WindowsOrdner $win -Suchpfad $pfad | Out-String
    Pruefe (Abschnitt $b2 'Probleme') 'FEHLT\s+SHLWAPI\.dll' 'fehlende DLL gemeldet'
    Pruefe (Abschnitt $b2 'Programmordner') 'LohnPro\.exe' 'ohne -Seit keine Meldung wegen Datum' -Nicht

    Copy-Item (Join-Path $quelle 't32.exe') (Join-Path $sys 'SHLWAPI.dll')
    $b3 = & $skript -Programm $exe -SystemOrdner $sys -WindowsOrdner $win -Suchpfad $pfad | Out-String
    Pruefe (Abschnitt $b3 'Probleme') '(nichts gefunden)' 'alles passend: keine Probleme'

    'kein PE' | Set-Content (Join-Path $sys 'SHLWAPI.dll')
    $b4 = & $skript -Programm $exe -SystemOrdner $sys -WindowsOrdner $win -Suchpfad $pfad | Out-String
    Pruefe (Abschnitt $b4 'Probleme') 'DEFEKT.*SHLWAPI' 'beschädigte DLL gemeldet'

    $b5 = & $skript -Programm 'GibtEsNichtXYZ' | Out-String
    Pruefe $b5 'Programm nicht gefunden' 'unbekannter Name führt zu klarer Meldung'
}
finally {
    Remove-Item $basis -Recurse -Force -ErrorAction SilentlyContinue
}

if ($fehler) { "$fehler Prüfung(en) fehlgeschlagen"; exit 1 }
'Alle Prüfungen bestanden'
