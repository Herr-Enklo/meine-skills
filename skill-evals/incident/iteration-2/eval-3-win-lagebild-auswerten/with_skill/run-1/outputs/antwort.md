`INC-20260929-0940 | P2 | Sicherheit | wartet auf Nutzer | PC01: Notepad++ stürzt in unsigniertem Plugin ab, Defender-Fund`
`INC-20260929-0940-2 | P4 | Windows-Software | wartet auf Nutzer | PC01: Empirum-Update Notepad++ 8.8.5 mit 1618 gescheitert`

Zwei getrennte Störungen: Das Update hat heute Nacht nichts installiert und erklärt die Abstürze nicht. Die kommen sehr wahrscheinlich von einem Plugin, das um 06:38 dazukam, und dabei hat Defender angeschlagen. Daher P2 (Sicherheitsverdacht), P1, falls sich Schadsoftware bestätigt; das Update P4, weil Notepad++ weiter da ist. Eure Prioritätsregeln kenne ich nicht (Annahme), ein Journal früherer Fälle gibt es hier nicht.

**Jetzt, in dieser Reihenfolge**

1. IT-Sicherheit informieren, sie entscheidet über alles Weitere. Kern: Defender-Fund Trojan:Win32/Wacatac.B!ml am 29.09. um 07:00 in `Downloads\plugin.dll` (Quarantäne), Prozess notepad++.exe; unsignierte `plugins\NppPlugin\NppPlugin.dll` seit 06:38, Notepad++ stürzt darin ab; Dienst NppUpdater als LocalSystem.
2. Den Block unten auf PC01 als du selbst ausführen. Er liest nur, das Ergebnis landet auch in `%TEMP%\npp-pruefung.txt`.
3. Danach Notepad++ schließen und bis zur Freigabe nicht öffnen. Solange den Windows-Editor nehmen.
4. Nichts löschen oder umbenennen, PC nicht neu starten, am Netz lassen, bis die IT-Sicherheit anders entscheidet.
5. Softwareverteilung bitten, das Notepad++-Paket für PC01 anzuhalten, damit keine Neuinstallation Spuren überschreibt.

```powershell
& {
$npp = 'C:\Program Files\Notepad++'
$dll = "$npp\plugins\NppPlugin\NppPlugin.dll"
'== Geladene Plugins im laufenden Notepad++'
Get-Process notepad++ -ErrorAction SilentlyContinue | ForEach-Object { $_.Modules | Where-Object FileName -like '*\plugins\*' | Select-Object FileName }
'== Hash, Signierer, Besitzer'
$dll, "$npp\notepad++.exe", "$npp\updater\gup.exe" | Where-Object { Test-Path $_ } | ForEach-Object {
  $s = Get-AuthenticodeSignature $_; $i = Get-Item $_
  [pscustomobject]@{ Datei = $_; SHA256 = (Get-FileHash $_ -Algorithm SHA256).Hash; Signatur = $s.Status
    Signierer = $s.SignerCertificate.Subject; Besitzer = (Get-Acl $_).Owner; Erstellt = $i.CreationTime; Geaendert = $i.LastWriteTime }
} | Format-List
'== Herkunftsvermerk der DLL (eine Adresse darin nicht aufrufen)'
Get-Content $dll -Stream Zone.Identifier -ErrorAction SilentlyContinue
'== Plugins im Programmordner und im Profil, Ordnerrechte'
Get-ChildItem "$npp\plugins", "$env:APPDATA\Notepad++", "$env:LOCALAPPDATA\Notepad++" -Recurse -File -Include *.dll, *.exe -ErrorAction SilentlyContinue |
  Select-Object FullName, CreationTime, LastWriteTime | Format-Table -AutoSize
icacls "$npp\plugins"
'== Downloads seit 28.09.'
Get-ChildItem "$env:USERPROFILE\Downloads" -File | Where-Object LastWriteTime -ge ([datetime]'2026-09-28') |
  Select-Object Name, Length, LastWriteTime | Format-Table -AutoSize
'== Dienst NppUpdater: Konfiguration, angelegt (7045), Statuswechsel (7036)'
Get-CimInstance Win32_Service -Filter "Name='NppUpdater'" | Select-Object State, StartMode, StartName, ProcessId, PathName, Description | Format-List
Get-WinEvent -FilterHashtable @{ LogName = 'System'; ProviderName = 'Service Control Manager'; Id = 7045, 7036; StartTime = [datetime]'2026-09-01' } -ErrorAction SilentlyContinue |
  Where-Object Message -match 'Notepad|NppUpdater|gup\.exe' | Select-Object -First 20 TimeCreated, Id, Message | Format-List
'== Ereignisse 29.09. 06:30-06:45 (Tool.exe) und 28.09. 21:55-22:15 (notepad++.exe 8.8.5)'
foreach ($f in @(@('2026-09-29 06:30', '2026-09-29 06:45'), @('2026-09-28 21:55', '2026-09-28 22:15'))) {
  Get-WinEvent -FilterHashtable @{ LogName = 'Application', 'System'; StartTime = [datetime]$f[0]; EndTime = [datetime]$f[1] } -ErrorAction SilentlyContinue |
    Select-Object TimeCreated, ProviderName, Id, Message | Format-List
}
'== Ausstehende Dateiumbenennungen'
(Get-ItemProperty 'HKLM:\SYSTEM\CurrentControlSet\Control\Session Manager' -ErrorAction SilentlyContinue).PendingFileRenameOperations
} *>&1 | Out-String -Width 300 | Tee-Object -FilePath "$env:TEMP\npp-pruefung.txt"
```

**Abstürze und Defender-Fund**

- Abstürze um 07:01 in ntdll.dll, eine Minute nach der Quarantäne, und um 08:02 direkt in `NppPlugin.dll`, beide 0xc0000005 (Abschnitte Programmabstürze, Programmordner). Die DLL ist Version 1.0.0.0, unsigniert, von 06:38, also nicht aus Empirum. In der Defender-Fundliste steht sie nicht, die ist ohne Adminrechte aber unvollständig.
- Ohne Adminrechte darfst du normalerweise nicht nach `C:\Program Files` schreiben. Also sind die Ordnerrechte offen, oder etwas mit mehr Rechten hat die DLL abgelegt: etwa der Dienst NppUpdater (`gup.exe -service`, LocalSystem, läuft trotz Starttyp „Manuell“; das Hersteller-Setup legt meines Wissens keinen Dienst an, ungeprüft) oder Tool.exe, abgestürzt um 06:35.
- Der Notepad++-Updater prüfte vor 8.8.9 heruntergeladene Installer nicht, 2025 wurde das für gezielte Angriffe genutzt. Kein Beweis für PC01, aber Grund genug, den Dienst mitzuprüfen.

Hypothesen und woran du sie in der Ausgabe erkennst:

- H1 Schädliches Plugin aus Downloads: Besitzer der DLL ist dein Konto, der Herkunftsvermerk zeigt einen Download. Den Hash schlägt die IT-Sicherheit nach, die Datei nicht hochladen.
- H2 Abgelegt mit Systemrechten: Besitzer ist SYSTEM oder Administratoren, NppUpdater wurde laut 7045 kürzlich angelegt oder kurz vor 06:38 gestartet, oder gup.exe ist nicht vom Notepad++-Team signiert. Dann P1: Netzkabel ziehen, WLAN aus, PC nicht ausschalten.
- H3 Echtes, fehlerhaftes Plugin und Fehlalarm: bewusst aus bekannter Quelle installiert, Hash unauffällig. Dann P3.

**Empirum-Update**

- Ursache bestätigt: 1618 heißt, eine andere Installation lief bereits. Das war `Anderes.msi` von 04:02 bis 04:14 (MsiInstaller 1040/1042), der Notepad++-Aufruf um 04:08 fiel hinein.
- Die Installation ist trotzdem gemischt: `notepad++.exe` 8.8.5 vom 28.09. 22:05, `SciLexer.dll` 8.8.4, zwei Einträge (NSIS 8.8.4 64-Bit, MSI 8.8.5 32-Bit). Für den 28.09. gibt es kein Installer-Ereignis, die Herkunft der 8.8.5-Dateien ist offen.
- Neu verteilen erst nach Freigabe. Fürs Paket (Folgeaufgabe): Nachtfenster entzerren oder bei 1618 warten und wiederholen, NSIS-Vorversion entfernen, aktuelle Version statt 8.8.5 (Signaturprüfung im Updater ab 8.9.2 Pflicht), eingebauten Updater abschalten.

**Fragen**

1. Hast du oder jemand anderes heute früh ein Notepad++-Plugin heruntergeladen oder installiert, und woher?
2. Gehören der Dienst NppUpdater und die Aufgabe „Notepad++ Update“ (Autor svc-empirum) zu eurem Empirum-Paket?
3. Ist das Update nur auf PC01 gescheitert, und welches Paket ist `Anderes.msi`?

Haben Kollegen dasselbe Plugin, schreibe ich ihnen eine kurze Info.

**Nebenbefunde**

- C: hat nur noch 5 GB frei (2 %).
- Windows Update KB5030000 um 03:03 mit 0x80073712 gescheitert (Komponentenspeicher beschädigt), Neustart steht aus.
- Druckwarteschlange zweimal abgestürzt (02:06, 02:37), jetzt gestoppt.
- LohnPro.exe startete am 28.09. nicht (0xc000007b), eigener Fall, falls noch aktuell.

Quellen: [1618 bei Microsoft](https://learn.microsoft.com/en-us/windows/win32/msi/error-codes), [Notepad++ zur Updater-Kompromittierung](https://notepad-plus-plus.org/news/hijacked-incident-info-update/), [BleepingComputer](https://www.bleepingcomputer.com/news/security/notepad-plus-plus-update-feature-hijacked-by-chinese-state-hackers-for-months/)
