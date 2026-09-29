`INC-20260929-0940 | P2 | Sicherheit | wartet auf Nutzer | PC01: Notepad++ stürzt ab (unsigniertes Plugin, Defender-Fund), Empirum-Update 1618`

P2, weil ein Sicherheitsverdacht im Firmennetz mindestens P2 ist. Der Fund liegt in Quarantäne, ein aktiver Angreifer ist nicht belegt, und du kannst mit einem anderen Editor weiterarbeiten. Eure eigenen Prioritätsregeln kenne ich nicht, deshalb gilt hier die Standardmatrix (Annahme). Frühere Fälle kann ich nicht nachschlagen, in dieser Sitzung gibt es kein Incident-Journal.

### Einordnung

Im Lagebild stecken zwei Störungen mit verschiedenen Ursachen.

1. Die Abstürze hängen an einem Plugin, das heute um 06:38 unter `C:\Program Files\Notepad++\plugins\NppPlugin\` aufgetaucht ist. `NppPlugin.dll` ist nicht signiert, und der Absturz um 08:02 passierte genau in diesem Modul. Um 07:00 hat Defender außerdem in `Downloads\plugin.dll` einen Trojaner gefunden, auf den notepad++.exe gerade zugriff. Deshalb geht das als Sicherheitsverdacht vor, nicht als Programmfehler.
2. Das Empirum-Update ist mit 1618 gescheitert, weil von 04:02 bis 04:14 eine andere Installation lief (`C:\Windows\Temp\Anderes.msi`) und der Notepad++-Aufruf um 04:08 genau in dieses Fenster fiel. Um 04:08 hat Windows Installer nichts verändert. Mit den Abstürzen hat das also nichts zu tun.

Warum ich das Plugin nicht einfach für fehlerhaft halte:

- Dein Konto hat keine Administratorrechte und kann nicht nach `C:\Program Files` schreiben. Die DLL hat also ein Prozess mit Admin- oder SYSTEM-Rechten abgelegt. Um 06:38 gibt es kein Installer-Ereignis, der Empirum-Lauf war um 04:08 vorbei.
- Drei Minuten vorher, um 06:35, ist ein unbekanntes `Tool.exe` mit einer .NET-Ausnahme abgestürzt.
- Der Dienst „NppUpdater“ (`gup.exe -service`, LocalSystem) läuft. gup.exe ist das Programm, mit dem Notepad++ Plugins mit erhöhten Rechten in den Programmordner kopiert. Einen Windows-Dienst dafür richtet der Hersteller-Installer nicht ein, und einen Schalter `-service` habe ich nirgends dokumentiert gefunden (ungeprüft). Läuft gup.exe als SYSTEM-Dienst, könnte die DLL auf diesem Weg ohne Adminrechte dorthin gekommen sein (Vermutung).
- Wacatac.B!ml ist eine Erkennung per maschinellem Lernen. Fehlalarme gibt es, Entwarnung aber erst nach einem Abgleich des Hashes.
- Entlastend: notepad++.exe selbst ist gültig signiert.

### Sofort

1. Informiere jetzt die IT-Sicherheit, der Text steht unten. Sie entscheidet über Netztrennung und Forensik.
2. Führ den Befehlsblock unten aus. Er liest nur und braucht keine Adminrechte. Er prüft auch, ob die DLL gerade im laufenden Notepad++ geladen ist, deshalb schließt du Notepad++ erst danach.
3. Dann Notepad++ schließen und bis zur Klärung nicht normal starten. Nimm zum Arbeiten den Windows-Editor. Wenn es Notepad++ sein muss, dann nur so: `"C:\Program Files\Notepad++\notepad++.exe" -noPlugin`. Damit lädt es keine Plugins, also auch NppPlugin.dll nicht.
4. Rechner nicht neu starten und nicht ausschalten, obwohl ein Neustart aussteht. Ein Neustart würde die ausstehenden Dateiumbenennungen ausführen und den laufenden Dienst beenden, dann sind Spuren weg. Außerdem: nichts löschen, nichts aus der Quarantäne holen und das Notepad++-Paket auf PC01 nicht erneut zuweisen.
5. Zieh das LAN-Kabel (nicht ausschalten), wenn die IT-Sicherheit das sagt oder wenn weder du noch sie die DLL erklären könnt. Ab dann ist es P1.

### Hypothesen

- H1, NppPlugin.dll lässt Notepad++ abstürzen. Dafür sprechen der Absturz im Modul um 08:02 und der Beginn nach 06:38. Bestätigt ist sie, wenn Abschnitt 2 die DLL im laufenden Prozess zeigt und Notepad++ mit `-noPlugin` ein paar Stunden stabil läuft.
- H2, die DLL ist schädlich oder eine Kopie von plugin.dll. Abschnitt 1 zeigt Besitzer und SHA-256. Liegt dort SYSTEM oder die Gruppe Administratoren statt eines bekannten Admin-Kontos und kann niemand die Datei erklären, wird es ernst. Den Hash gleicht die IT-Sicherheit mit dem Defender-Fund ab. Die Datei bitte nirgends hochladen, auch nicht zu VirusTotal, nur den Hash nachschlagen.
- H3, der Dienst NppUpdater stammt nicht aus eurem Paket. Erkennbar an Abschnitt 3 (Ereignis 7045: wann und von welchem Konto installiert) und an Abschnitt 8 (Setup.inf). Legt keins eurer Pakete den Dienst an, ist er eine SYSTEM-Komponente ohne Herkunft, dann P1.
- H4, der Absturz um 07:01 kam von der Quarantäne. Defender hat plugin.dll eine Minute vorher unter Notepad++ weggenommen. Das ist eine Vermutung, der Test aus H1 klärt sie mit.
- H5, die gemischte Installation (siehe Empirum) ist die Ursache. Eher unwahrscheinlich. Bestätigt wäre sie, wenn Notepad++ auch mit `-noPlugin` abstürzt.

### Zeitleiste aus dem Lagebild

| Zeit | Ereignis |
|---|---|
| 28.09. 09:15 | Aufgabe „\Notepad++ Update“ (Autor svc-empirum, `gup.exe -silent`) endet mit 0x80070002, Datei nicht gefunden |
| 28.09. 22:05 | notepad++.exe 8.8.5 im Programmordner (Dateidatum) |
| 29.09. 04:02–04:14 | Installer-Transaktion `C:\Windows\Temp\Anderes.msi` (1040/1042) |
| 04:08 | Empirum: `npp.8.8.5.Installer.x64.msi`, ErrorLevel 1618 (MsiInstaller 1033 mit 1618) |
| 06:35 | `Tool.exe` (.NET) beendet, `System.IO.FileNotFoundException` |
| 06:38 | `plugins\NppPlugin\NppPlugin.dll` 1.0.0.0 geschrieben, nicht signiert |
| 07:00 | Defender: Trojan:Win32/Wacatac.B!ml in `C:\Users\mmuster\Downloads\plugin.dll`, Prozess notepad++.exe, Status 3 (Quarantäne), Aktion erfolgreich |
| 07:01 | Absturz notepad++.exe 8.8.5, Modul ntdll.dll, 0xc0000005 (Zugriffsverletzung) |
| 08:02 | Absturz notepad++.exe 8.8.5, Modul NppPlugin.dll, 0xc0000005 |
| 08:03 | Notepad++ neu gestartet, läuft noch (PID 14320) |

### Befehlsblock für PC01

In PowerShell als mmuster ausführen. Abschnitt 6 durchsucht dein Profil und kann ein paar Minuten dauern.

```powershell
# INC-20260929-0940, nur lesend, ohne Adminrechte. Ergebnis zusätzlich in %TEMP%\inc-20260929-0940.txt
$npp  = 'C:\Program Files\Notepad++'
$seit = Get-Date '2026-09-27 00:00'
& {
  '== 1 Plugins und Updater: Version, Zeiten, Signatur, Besitzer, SHA-256'
  Get-ChildItem "$npp\plugins", "$npp\updater" -Recurse -File -ErrorAction SilentlyContinue | ForEach-Object {
    $sig = Get-AuthenticodeSignature -LiteralPath $_.FullName
    [pscustomobject]@{
      Datei     = $_.FullName.Substring($npp.Length + 1)
      Version   = $_.VersionInfo.FileVersion
      Erstellt  = $_.CreationTime
      Geaendert = $_.LastWriteTime
      Signatur  = "$($sig.Status) $($sig.SignerCertificate.Subject)"
      Besitzer  = (Get-Acl -LiteralPath $_.FullName).Owner
      SHA256    = (Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash
    } } | Format-List
  Get-Content "$npp\updater\gup.xml" -ErrorAction SilentlyContinue

  '== 2 Plugins im laufenden Notepad++'
  Get-Process -Name 'notepad++' -ErrorAction SilentlyContinue | ForEach-Object {
    $id = $_.Id; $_.Modules | Where-Object { $_.FileName -like '*\plugins\*' } | ForEach-Object { "PID $id  $($_.FileName)" } }

  '== 3 Dienst NppUpdater und neu installierte Dienste (7045)'
  $svc = Get-CimInstance Win32_Service -Filter "Name='NppUpdater'"
  $svc | Format-List Name, State, StartMode, StartName, ProcessId, PathName
  if ($svc.ProcessId) { Get-CimInstance Win32_Process -Filter "ProcessId=$($svc.ProcessId)" | Format-List ProcessId, CreationDate, ParentProcessId }
  Get-WinEvent -FilterHashtable @{ LogName = 'System'; Id = 7045 } -ErrorAction SilentlyContinue |
    Where-Object { $_.TimeCreated -ge $seit -or $_.Message -match 'Notepad|gup' } | Format-List TimeCreated, UserId, Message

  '== 4 Aufgabe Notepad++ Update: angelegt, Konto, Auslöser'
  Get-ScheduledTask -TaskName 'Notepad++ Update' -ErrorAction SilentlyContinue | ForEach-Object {
    "Angelegt: $($_.Date)  Konto: $($_.Principal.UserId)  Stufe: $($_.Principal.RunLevel)"; $_.Triggers | Format-List }

  '== 5 Defender-Meldungen vollständig'
  Get-WinEvent -FilterHashtable @{ LogName = 'Microsoft-Windows-Windows Defender/Operational'; Id = 1116, 1117; StartTime = $seit } -ErrorAction SilentlyContinue |
    Format-List TimeCreated, Id, Message

  '== 6 Tool.exe: vollständige .NET-Meldung und Fundorte'
  Get-WinEvent -FilterHashtable @{ LogName = 'Application'; ProviderName = '.NET Runtime'; Id = 1026; StartTime = $seit } -ErrorAction SilentlyContinue |
    Format-List TimeCreated, Message
  Get-ChildItem $env:USERPROFILE, $env:ProgramData, $env:PUBLIC -Recurse -Filter 'Tool.exe' -File -ErrorAction SilentlyContinue |
    Format-List FullName, CreationTime, LastWriteTime, Length

  '== 7 Downloads seit 27.09. mit Herkunftsvermerk'
  Get-ChildItem "$env:USERPROFILE\Downloads" -File -ErrorAction SilentlyContinue | Where-Object { $_.LastWriteTime -ge $seit } | ForEach-Object {
    [pscustomobject]@{ Datei = $_.Name; Geaendert = $_.LastWriteTime
      Herkunft = (Get-Content -LiteralPath $_.FullName -Stream Zone.Identifier -ErrorAction SilentlyContinue) -join ' ' } } | Format-List

  '== 8 Empirum-Skriptkopien zu Notepad++: Aufrufe, Dienst, Aufgabe'
  Get-ChildItem (Join-Path $env:ProgramData '$Matrix42Scripts$') -Recurse -Filter 'Setup.inf' -File -ErrorAction SilentlyContinue |
    Where-Object { $_.FullName -like '*Notepad*' } | ForEach-Object {
      "-- $($_.FullName) ($($_.LastWriteTime))"
      Select-String -LiteralPath $_.FullName -Pattern 'Call|MsiExec|uninstall|Service|schtasks|gup|plugin' | ForEach-Object { "  $($_.LineNumber): $($_.Line.Trim())" } }

  '== 9 Fehlercodes'
  foreach ($c in '1618', '0x80070002', '0x80073712', '1067') { certutil -error $c | Select-Object -First 2 }
} *>&1 | Out-String -Width 250 | Tee-Object -FilePath "$env:TEMP\inc-20260929-0940.txt"
```

Schick mir bitte die Datei `%TEMP%\inc-20260929-0940.txt`. Abschnitt 7 kann Webadressen enthalten, von denen die Dateien stammen. Die bitte nicht anklicken.

### Text für die IT-Sicherheit

```
Incident: INC-20260929-0940, Priorität P2 (Sicherheitsverdacht, Hochstufung auf P1 möglich)
Symptom: Notepad++ 8.8.5 auf PC01 stürzt seit 29.09. 07:01 wiederholt ab (0xc0000005, zuletzt im Modul NppPlugin.dll). Defender-Fund Trojan:Win32/Wacatac.B!ml am 29.09. um 07:00.
Umgebung: PC01, Lenovo T14, Windows 11 Enterprise 23H2 Build 22631.4169, Domäne firma.local, Benutzer FIRMA\mmuster ohne Adminrechte
Seit: 29.09.2026 06:38 (neue DLL), erster Absturz 07:01. Änderungen davor: Empirum-Paket Notepad++ 8.8.5, Lauf um 04:08 mit 1618 gescheitert
Reproduzierbar: Abstürze um 07:01 und 08:02, Notepad++ läuft seit 08:03 wieder
Bereits geprüft (Lagebild vom 29.09. 09:39, liegt bei):
- 07:00 Defender: C:\Users\mmuster\Downloads\plugin.dll, Prozess notepad++.exe, in Quarantäne, Aktion erfolgreich
- 06:38 neu: C:\Program Files\Notepad++\plugins\NppPlugin\NppPlugin.dll, Version 1.0.0.0, nicht signiert. Benutzer ohne Adminrechte, kein Installer-Ereignis zu dieser Zeit
- 06:35 unbekanntes Tool.exe (.NET, FileNotFoundException) beendet
- Dienst NppUpdater ("C:\Program Files\Notepad++\updater\gup.exe" -service) läuft als LocalSystem, Herkunft ungeklärt
- notepad++.exe ist gültig signiert
- Weitere Auffälligkeiten derselben Nacht: Druckwarteschlange 02:06 und 02:37 abgestürzt, Windows Update 03:03 mit 0x80073712 gescheitert
- Rechner bewusst nicht neu gestartet, nichts gelöscht, Notepad++ wird nicht mehr normal gestartet
Belege: Lagebild; Nachprüfung mit SHA-256 von NppPlugin.dll folgt
Wir brauchen: Entscheidung über Netztrennung und Forensik, Abgleich von NppPlugin.dll mit dem Defender-Fund, Suche nach NppPlugin.dll und dem Dienst NppUpdater auf weiteren Clients
Erreichbarkeit: FIRMA\mmuster, Telefon: bitte ergänzen
```

### Empirum-Update, für später

Die Ursache für 1618 ist belegt: Beginn (1040) und Ende (1042) der Transaktion von `Anderes.msi` schließen 04:08 ein. Welches Paket das war, zeigt die Empirum-Konsole.

Das Paket hat außerdem eigene Fehler, die im Paket behoben gehören, nicht am Client:

- Es ruft nur `MsiExec /I` auf und entfernt die vorhandene EXE-Installation 8.8.4 nicht. Jetzt gibt es zwei Einträge: 8.8.4 (EXE, 64-Bit-Ansicht) und 8.8.5 (MSI, 32-Bit-Ansicht, obwohl die Datei x64 heißt, und ohne Installationsort). Im Ordner liegen Dateien beider Versionen, notepad++.exe 8.8.5 neben SciLexer.dll 8.8.4.
- Der MSI-Eintrag trägt das Datum 28.09., im Protokoll steht für den 28.09. aber keine Installation. Wann 8.8.5 wirklich kam, zeigt die Konsole.
- Ein offizielles MSI gibt es erst seit 8.8.8. Das 8.8.5-MSI ist also selbst gebaut oder stammt aus einer fremden Quelle.
- 8.8.5 ist veraltet. Erst ab 8.8.9 prüft der Updater Signatur und Zertifikat heruntergeladener Installer. Das wurde nachgerüstet, nachdem Angreifer 2025 den Update-Weg von Notepad++ gekapert hatten. Die Download-Seite führt inzwischen 8.9.x. Ein Hinweis, dass PC01 davon betroffen war, ist das nicht.
- Die Aufgabe „\Notepad++ Update“ scheitert mit 0x80070002.

Mein Vorschlag, sobald die Sicherheitsfrage geklärt ist: aktuelles offizielles MSI, die EXE-Vorversion vorher still deinstallieren, bei 1618 warten und einmal wiederholen, Rollout-Fenster nicht mit anderen Paketen überlappen lassen. Wenn Dienst und Aufgabe aus eurem Paket stammen, fallen sie weg, weil Updates über Empirum kommen. Umgesetzt wird das über den Skill `paketieren`, der in dieser Sitzung nicht verfügbar ist, also als Folgeaufgabe.

### Nächster Schritt

Mit deiner Ausgabe und den Antworten entscheide ich: Ist die Herkunft der DLL geklärt und harmlos, stufe ich zurück auf Windows-Software. Dann wird das Plugin über die IT entfernt und das Paket korrigiert. Bleibt sie unklar oder ist der Hash bekannt schädlich, geht es auf P1 mit Netztrennung, und die IT-Sicherheit führt. Kamen Dienst oder DLL über ein Paket auf weitere Clients, schlage ich vor, den Rollout anzuhalten (frage ich vorher) und eine kurze Nutzerinfo zu schreiben. Tickettext und Nachbetrachtung kommen, wenn der Fall gelöst ist.

### Was ich von dir brauche

1. Hast du oder jemand aus der IT heute früh ein Notepad++-Plugin installiert? Woher stammen plugin.dll und Tool.exe?
2. Legt euer Notepad++-Paket, auch ein älteres, den Dienst NppUpdater und die Aufgabe „\Notepad++ Update“ an?
3. Welches Paket lief um 04:02–04:14 als `Anderes.msi`, und ist der Notepad++-Rollout noch auf anderen Clients gescheitert? (Das hat Zeit.)

### Nebenbefunde

- C: hat nur noch 5 GB frei (2 %). Das wird für Updates und Paketinstallationen knapp.
- Windows Update KB5030000 ist um 03:03 mit 0x80073712 gescheitert (Komponentenspeicher beschädigt). Nach Freigabe durch die IT-Sicherheit als Administrator `DISM /Online /Cleanup-Image /RestoreHealth` und `sfc /scannow` ausführen, dann neu starten. Der Rechner läuft seit dem 17.09.
- Die Druckwarteschlange steht seit 02:37, sie ist zweimal abgestürzt (7031, Exitcode 1067). Drucken geht vermutlich nicht.
- LohnPro.exe ließ sich am 28.09. um 13:38 nicht starten (0xc000007b). Wenn das noch so ist, machen wir dafür einen eigenen Incident mit `windows-startcheck.ps1`.

Quellen:
- [Notepad++ v8.8.9: Updater prüft Signatur und Zertifikat](https://notepad-plus-plus.org/news/v889-released/)
- [Notepad++: Hijacked Incident Info Update](https://notepad-plus-plus.org/news/hijacked-incident-info-update/)
- [Notepad++ Downloads](https://notepad-plus-plus.org/downloads/)
- [Notepad++ Community: Release 8.8.8 mit offiziellem MSI](https://community.notepad-plus-plus.org/topic/27250/notepad-8-8-8-release)
- [Master Packager: Notepad++ Now Has an Official MSI](https://www.masterpackager.com/blog/Notepad-plus-plus-MSI)
- [Notepad++ Community: gup.exe mit Adminrechten für Plugins Admin](https://community.notepad-plus-plus.org/topic/16720/launch-a-no-elevated-process-from-an-elevated-process-in-an-easy-way-win32-api)
- [Notepad++ User Manual: Command Line (`-noPlugin`)](https://npp-user-manual.org/docs/command-prompt/)
- [Microsoft Security Intelligence: Trojan:Win32/Wacatac.B!ml](https://www.microsoft.com/en-us/wdsi/threats/malware-encyclopedia-description?Name=Trojan%3AWin32%2FWacatac.B%21ml)
- [Microsoft Learn: Windows Installer Error Codes (1618)](https://learn.microsoft.com/en-us/windows/win32/msi/error-codes)
