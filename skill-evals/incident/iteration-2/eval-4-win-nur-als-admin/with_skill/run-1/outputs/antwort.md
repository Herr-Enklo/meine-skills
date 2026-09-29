`INC-20260928-1420 | P4 | Windows-Software | wartet auf Nutzer | TimeTrack auf PC-117 nur als Administrator: Zugriff verweigert auf config.ini`

**Kurz: Nein, bitte keine lokalen Adminrechte.** Seinem Konto fehlt das Schreibrecht auf eine Datei, und das lässt sich gezielt für diesen einen Ordner beheben.

- Adminrechte lösen es nicht: Bei eingeschalteter Benutzerkontensteuerung laufen Programme auch bei Admins ohne Adminrechte. Er müsste TimeTrack weiter über "Als Administrator ausführen" starten und jedes Mal bestätigen.
- Mit Adminrechten kann alles, was er startet, auch ein verseuchter Mailanhang, den Rechner übernehmen und den Virenschutz abschalten. Für eine Zeiterfassung steht das in keinem Verhältnis.

**Einordnung:** P4, ein Nutzer, und mit deiner Hilfe kann er buchen (Annahme nach Standardmatrix, eure Regeln kenne ich nicht). Sind weitere neue Rechner betroffen, stufe ich hoch. Ein Journal früherer Fälle gibt es in dieser Sitzung nicht.

**Bis zur Lösung:** Weiter so starten geht, aber nur kurz. Mit deiner Bestätigung läuft TimeTrack unter deinem Admin-Konto: Aus dem Programm heraus (etwa im Datei-öffnen-Dialog) hat er deine Rechte, und falls TimeTrack Buchungen dem Windows-Benutzer zuordnet, landen sie womöglich unter deinem Namen (Vermutung, bitte nachsehen).

**Hypothesen**
1. config.ini wurde von einem anderen Konto angelegt, etwa beim ersten Start als Administrator oder vom Installer. Unter `C:\ProgramData` hat nur der Ersteller einer Datei Vollzugriff (CREATOR OWNER), alle anderen dürfen sie nur lesen. Erkennbar: Besitzer ist nicht der Kollege, icacls zeigt für `Benutzer` nur `(RX)` oder `(R)`. Auf den alten Rechnern haben die Kollegen TimeTrack vermutlich selbst zuerst gestartet.
2. Auf den alten Rechnern sind Rechte ausdrücklich gesetzt (Paket, Handgriff, eigene Gruppe), auf PC-117 nicht. Erkennbar: dort ein Eintrag mit `(M)` oder `(F)`, der auf PC-117 fehlt, oder die Gruppe fehlt in seiner Gruppenliste.
3. Die alten Kollegen sind selbst lokale Admins bei abgeschalteter Benutzerkontensteuerung. Erkennbar: `Administratoren` in ihrer Gruppenliste, `EnableLUA` = 0. Dann ist "bei denen geht es" kein Vorbild.
4. Auf den alten Rechnern leitet Windows das Schreiben still in den VirtualStore um (UAC-Virtualisierung für ältere 32-Bit-Programme, gilt auch für ProgramData), auf PC-117 nicht, etwa wegen anderer Version. Erkennbar: `VirtualStore\ProgramData\TimeTrack` nur auf dem alten Rechner, abweichende Versionen.

Schreibschutz oder Dateisperre scheiden aus, sonst ginge es auch als Administrator nicht.

**Nächster Schritt:** Diesen Block auf PC-117 als der neue Kollege in einer normalen PowerShell ausführen (nicht als Administrator), denselben auf einem alten Rechner als der dortige Kollege. Er ändert nichts.

```powershell
$d = 'C:\ProgramData\TimeTrack'
"== Benutzer und Gruppen =="; whoami; whoami /groups
"== Rechte Ordner und config.ini =="; icacls $d; icacls "$d\config.ini"
"== Dateien, Besitzer =="
Get-ChildItem $d -Force -Recurse -ErrorAction SilentlyContinue |
  Select-Object FullName, CreationTime, LastWriteTime, Attributes, @{n='Besitzer';e={(Get-Acl $_.FullName).Owner}} | Format-List
"== VirtualStore =="
Get-ChildItem "$env:LOCALAPPDATA\VirtualStore\ProgramData\TimeTrack" -Force -Recurse -ErrorAction SilentlyContinue | Select-Object FullName, LastWriteTime
"== Installation =="
Get-ItemProperty 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*','HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*' -ErrorAction SilentlyContinue |
  Where-Object DisplayName -like '*TimeTrack*' | Select-Object DisplayName, DisplayVersion, Publisher, InstallDate
Get-ChildItem (Join-Path $env:ProgramData '$Matrix42Scripts$') -Recurse -Filter Setup.inf -ErrorAction SilentlyContinue |
  Where-Object FullName -like '*TimeTrack*' | Select-Object FullName, LastWriteTime
"== UAC =="
Get-ItemProperty 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Policies\System' | Select-Object EnableLUA, EnableVirtualization
```

**Lösungsvorschlag (Stufe 2, deine Entscheidung nach Blick auf die Ausgabe):** In einer Admin-PowerShell erst sichern mit `icacls "C:\ProgramData\TimeTrack" /save "$env:TEMP\timetrack-acl.txt" /t /c`, dann der lokalen Gruppe Benutzer Ändern-Rechte auf genau diesen Ordner geben: `icacls "C:\ProgramData\TimeTrack" /grant "*S-1-5-32-545:(OI)(CI)M"` (SID der Gruppe Benutzer, sprachunabhängig). Zeigt der alte Rechner eine eigene Gruppe, nehmen wir die.
- Wirkung: TimeTrack startet per Doppelklick. Alle Benutzer von PC-117 dürfen Dateien in diesem einen Ordner ändern.
- Prüfung: Er startet normal, ändert eine Einstellung, startet neu, sie ist noch da.
- Zurück: `icacls "C:\ProgramData" /restore "$env:TEMP\timetrack-acl.txt"` (am übergeordneten Ordner).
- Kommt TimeTrack über ein Paket, gehört das Rechtesetzen dorthin, sonst trifft es den nächsten neuen Kollegen wieder. Das nehme ich als Folgeaufgabe auf.

**Was ich von dir brauche**
1. Die Ausgabe von PC-117 und von einem alten Rechner.
2. Ob in der config.ini Zugangsdaten stehen (etwa zur Datenbank). Dann bekommt nur sein Konto Schreibrecht auf die eine Datei.

Quellen: [ProgramData-Standardrechte](https://learn.microsoft.com/en-us/answers/questions/4328564/default-group-permissions-for-programdata-folder), [UAC-Architektur](https://learn.microsoft.com/en-us/windows/security/application-security/application-control/user-account-control/architecture), [UAC-Virtualisierung](https://trainsec.net/library/windows-internals/understanding-uac-virtualization/), [icacls](https://learn.microsoft.com/en-us/windows-server/administration/windows-commands/icacls), [icacls /restore am übergeordneten Ordner](https://woshub.com/how-to-backup-and-restore-ntfs-permissions-using-icacls/). Herstellerhinweise zur config.ini von TimeTrack habe ich nicht gefunden.
