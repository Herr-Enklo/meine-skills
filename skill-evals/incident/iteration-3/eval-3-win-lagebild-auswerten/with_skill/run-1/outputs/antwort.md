`INC-20260929-0940 | P2 | Sicherheit | wartet auf Nutzer | Notepad++ stürzt auf PC01 ab, unsigniertes Plugin und Defender-Fund`
`INC-20260929-0940-2 | P4 | Windows-Software | wartet auf Nutzer | Empirum-Update Notepad++ 8.8.5 auf PC01 scheitert mit 1618`

**Einordnung**

Die Abstürze kommen sehr wahrscheinlich von einem Plugin, nicht vom Update, und das behandle ich als Sicherheitsverdacht. Um 06:38 kam die unsignierte `plugins\NppPlugin\NppPlugin.dll` in den Programmordner, um 07:00 hat Defender `Downloads\plugin.dll` als Trojan:Win32/Wacatac.B!ml in Quarantäne geschoben (Prozess notepad++.exe), um 08:02 stürzte Notepad++ in NppPlugin.dll ab (0xc0000005). Diese DLL hat Defender nicht erfasst, sie wird bei jedem Start geladen. Offen ist, wie sie ohne Adminrechte dorthin kam und woher der Dienst `NppUpdater` stammt, der `gup.exe -service` als LocalSystem startet; einen Dienst bringt Notepad++ meines Wissens nicht mit (ungeprüft).

P2: Sicherheitsverdacht, ein Rechner, kein Zeichen eines aktiven Angreifers (Annahme: Standardmatrix, eure Regeln kenne ich nicht). P1, wenn die Herkunft von DLL oder Dienst ungeklärt bleibt oder der Hash als schädlich bekannt ist.

**Sofort**

1. IT-Sicherheit jetzt informieren, Text unten. Sie entscheidet über Netztrennung und Forensik.
2. Arbeit speichern, Notepad++ schließen und bis zur Freigabe nicht starten, so lange den Windows-Editor nehmen. `notepad++.exe -noPlugin` lädt keine Plugins, das gibt aber die IT-Sicherheit frei.
3. PC01 nicht neu starten oder ausschalten, auch wenn ein Neustart aussteht. Die DLL nicht löschen und nirgends hochladen.
4. Das Paket für PC01 nicht erneut laufen lassen, auch nachts nicht: Eine Installation überschreibt den Programmordner, der jetzt Beweis ist.
5. Stammt NppUpdater laut Block unten nicht aus eurem Paket: Netzwerkkabel ziehen, nicht ausschalten. Dann gilt P1.

```text
Sicherheitsmeldung INC-20260929-0940, PC01 (Windows 11 23H2), Benutzer FIRMA\mmuster, ohne Adminrechte
29.09. 07:00  Defender: Trojan:Win32/Wacatac.B!ml, Datei C:\Users\mmuster\Downloads\plugin.dll,
              Prozess C:\Program Files\Notepad++\notepad++.exe, Status 3 (Quarantäne), Aktion erfolgreich
29.09. 06:38  neu: C:\Program Files\Notepad++\plugins\NppPlugin\NppPlugin.dll 1.0.0.0, nicht signiert,
              kein Defender-Fund, von Notepad++ geladen; Abstürze 07:01 und 08:02 (0xc0000005, 08:02 in dieser DLL)
laufend       Dienst NppUpdater, LocalSystem, "C:\Program Files\Notepad++\updater\gup.exe" -service, Herkunft ungeklärt
29.09. 06:35  .NET-Absturz Tool.exe (FileNotFoundException), Pfad ungeklärt
Stand: Notepad++ wird geschlossen, nichts gelöscht, kein Neustart. SHA-256 der DLL folgt.
Bitte: Hash-Abgleich mit dem Quarantäne-Fund, Entscheidung über Netztrennung und Forensik.
```

**Hypothesen**

- H1, inkompatibles Plugin und ML-Fehlalarm (`!ml` meldet kleine unsignierte Dateien oft fälschlich): Herkunft bekannt, Hash unauffällig.
- H2, schädliches Plugin (Notepad++ lädt jede DLL im Plugin-Ordner, so haben Angreifer schon Schadcode eingenistet): Herkunft unklar, weitere neue Dateien, Verbindungen von gup.exe nach außen, Dienst ohne Paketbezug. Der Autor „svc-empirum" der Aufgabe ist nur ein Textfeld.
- H3, Benutzer dürfen in `C:\Program Files\Notepad++` schreiben, etwa durch euer MSI: Das erklärt die DLL und wäre selbst eine Lücke, weil der SYSTEM-Dienst gup.exe von dort startet. Erkennbar an `icacls` (Benutzer mit M, W oder F) und FIRMA\mmuster als Besitzer der DLL.

Nächster Schritt: den Block auf PC01 in einer normalen PowerShell ausführen, nicht als Admin. Er liest nur, speichert nach `%TEMP%\inc-0940.txt` und sucht auch `Tool.exe`, das um 06:35 abstürzte, drei Minuten vor der DLL.

```powershell
$npp = 'C:\Program Files\Notepad++'
& {
  '== Hash, Signatur, Besitzer'
  $(foreach ($f in "$npp\plugins\NppPlugin\NppPlugin.dll", "$npp\updater\gup.exe", "$npp\notepad++.exe") {
    $sig = Get-AuthenticodeSignature -LiteralPath $f
    [pscustomobject]@{
      Datei    = $f
      SHA256   = (Get-FileHash -LiteralPath $f -Algorithm SHA256).Hash
      Signatur = "$($sig.Status) $($sig.SignerCertificate.Subject)"
      Besitzer = (Get-Acl -LiteralPath $f).Owner
      Erstellt = (Get-Item -LiteralPath $f).CreationTime
    }
  }) | Format-List
  '== Rechte auf Programmordner, plugins, updater'
  icacls $npp; icacls "$npp\plugins"; icacls "$npp\updater"
  '== Dateien im Programmordner, geaendert seit 27.09.'
  Get-ChildItem -LiteralPath $npp -Recurse -File | Where-Object LastWriteTime -ge '2026-09-27' |
    Format-Table FullName, Length, CreationTime, LastWriteTime -AutoSize -Wrap
  '== Wann wurde der Dienst NppUpdater eingerichtet (System 7045)'
  Get-WinEvent -FilterHashtable @{ LogName = 'System'; ProviderName = 'Service Control Manager'; Id = 7045 } -ErrorAction SilentlyContinue |
    Where-Object Message -match 'NppUpdater|Notepad' | Format-List TimeCreated, UserId, Message
  '== Geplante Aufgabe Notepad++ Update'
  Get-ScheduledTask -TaskName 'Notepad++ Update' | ForEach-Object { $_.RegistrationInfo; $_.Principal } | Format-List
  '== Empirum-Skriptkopie: Dienst, Aufgabe, Plugins'
  $inf = Join-Path $env:ProgramData '$Matrix42Scripts$\Notepad++ Team\Notepad++\8.8.5\Install\Setup.inf'
  Select-String -LiteralPath $inf -Pattern 'NppUpdater|gup|Service|Task|plugin' | ForEach-Object { "$($_.LineNumber): $($_.Line.Trim())" }
  '== Downloads seit 28.09. mit Herkunftsadresse'
  Get-ChildItem "$env:USERPROFILE\Downloads" -File | Where-Object LastWriteTime -ge '2026-09-28' | ForEach-Object {
    [pscustomobject]@{
      Datei    = $_.Name
      Zeit     = $_.LastWriteTime
      Herkunft = ((Get-Content -LiteralPath $_.FullName -Stream Zone.Identifier -ErrorAction SilentlyContinue) -match 'HostUrl|ReferrerUrl') -join ' '
    }
  } | Format-List
  '== Netzwerkverbindungen von Notepad++ und gup.exe'
  $ids = @(Get-Process -Name 'notepad++', 'gup' -ErrorAction SilentlyContinue).Id
  Get-NetTCPConnection -ErrorAction SilentlyContinue | Where-Object OwningProcess -in $ids |
    Format-Table OwningProcess, LocalAddress, LocalPort, RemoteAddress, RemotePort, State -AutoSize
  '== Tool.exe von 06:35: Pfad und Ausnahme'
  Get-ChildItem 'C:\ProgramData\Microsoft\Windows\WER\ReportArchive' -Recurse -Filter Report.wer -ErrorAction SilentlyContinue |
    Select-String -Pattern 'AppPath=.*Tool\.exe' | Select-Object -First 3 -ExpandProperty Line
  Get-WinEvent -FilterHashtable @{ LogName = 'Application'; ProviderName = '.NET Runtime'; Id = 1026; StartTime = [datetime]'2026-09-29 06:30' } -MaxEvents 2 -ErrorAction SilentlyContinue |
    Format-List TimeCreated, Message
} *>&1 | Tee-Object -FilePath "$env:TEMP\inc-0940.txt"
```

**INC-20260929-0940-2, Empirum-Update**

P4, weil nur PC01 betroffen ist und Notepad++ dort läuft. Ursache belegt: 1618 um 04:08 (Empirum-Protokoll `C:\Windows\Temp\Notepad++.8.8.5.1.log`), weil von 04:02 bis 04:14 `C:\Windows\Temp\Anderes.msi` lief (MsiInstaller 1040 und 1042). Trotzdem ist notepad++.exe seit 28.09., 22:05 Uhr schon 8.8.5 (ohne Installer-Ereignis), SciLexer.dll noch 8.8.4, und es gibt zwei Einträge: EXE 8.8.4 und euer MSI 8.8.5 in der 32-Bit-Ansicht. Das MSI entfernt die EXE-Vorversion nicht und sortiert, anders als der Herstellerinstaller, keine inkompatiblen Plugins nach `plugins\disabled` aus. Das gehört nach Teil 1 ins Paket. Zudem ist 8.8.5 veraltet (aktuell 8.9.8.1 vom 24.09.2026), und erst ab 8.8.9 prüft gup.exe die Signatur seiner Downloads, was Angreifer 2025 ausgenutzt haben. Vorschlag für einen Change: aktuelle Version, Updater aus.

**Was ich von dir brauche**

1. Woher stammt die plugin.dll in deinen Downloads (Webseite, Mail, Kollege oder unbekannt)?
2. Welches Paket war `Anderes.msi` heute von 04:02 bis 04:14 laut Empirum-Konsole?
3. Richtet euer Notepad++-Paket den Dienst NppUpdater und die Aufgabe „\Notepad++ Update" ein?

Dazu die Ausgabe des Blocks.

**Nebenbefunde**

- C: hat nur 5 GB frei (2 %).
- Windows Update KB5030000 um 03:03 mit 0x80073712 gescheitert (Komponentenspeicher beschädigt); DISM und sfc erst nach Freigabe durch die IT-Sicherheit.
- Druckwarteschlange um 02:06 und 02:37 abgestürzt, steht (1067).
- LohnPro.exe startete am 28.09. um 13:38 nicht (0xc000007b); falls noch so, eigener Incident mit `windows-startcheck.ps1`.

Quellen:
- Updater-Angriff, Prüfung ab 8.8.9: https://notepad-plus-plus.org/news/hijacked-incident-info-update/
- Version 8.9.8.1: https://notepad-plus-plus.org/news/v8981-released/
- Plugins als Einfallstor: https://www.cybereason.com/blog/threat-analysis-report-abusing-notepad-plugins-for-evasion-and-persistence
- Wacatac.B!ml-Fehlalarme: https://learn.microsoft.com/en-us/answers/questions/4035275/windows-defender-win32-wacatac-b-ml-false-positive
- 0x80073712: https://learn.microsoft.com/en-us/troubleshoot/azure/virtual-machines/windows/windows-update-errors-requiring-in-place-upgrade
