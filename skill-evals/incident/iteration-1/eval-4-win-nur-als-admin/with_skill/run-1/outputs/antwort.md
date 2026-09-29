`INC-20260928-1420 | P4 | Windows-Software | wartet auf Nutzer | TimeTrack auf PC-117 läuft nur als Administrator`

**Kurz: Nein, gib ihm keine lokalen Adminrechte.**

- Es würde nicht einmal helfen. Mit Benutzerkontensteuerung arbeitet auch ein lokaler Admin im Alltag mit eingeschränkten Rechten. TimeTrack bekäme weiter „Zugriff verweigert“, er müsste es jeden Tag über „Als Administrator ausführen“ starten und bestätigen. Dann läuft die Zeiterfassung dauerhaft mit vollen Rechten.
- Adminrechte wegen einer einzigen Datei sind ein großes Risiko: Schadsoftware, die er versehentlich öffnet, bekommt nach einem Klick auf „Ja“ den ganzen Rechner. Microsoft empfiehlt ausdrücklich Standardkonten für die tägliche Arbeit.
- Die Ursache bliebe. Der nächste neue Kollege hätte dasselbe Problem.

Die Meldung sagt schon ziemlich genau, was los ist: Sein Konto darf `C:\ProgramData\TimeTrack\config.ini` auf PC-117 nicht beschreiben. „Als Administrator ausführen“ bestätigt nur, dass es an Rechten liegt, und ist ein Test, keine Lösung. Die Lösung ist, ihm genau dieses eine Recht zu geben.

**Einordnung:** P4. Nur er ist betroffen, arbeiten kann er, Zeiten lassen sich nachtragen. Eure Prioritätsregeln kenne ich nicht, das ist eine Annahme. Wird TimeTrack zum Monatsende (Mittwoch, 30.09.) abgeschlossen, sollte es vorher laufen; nach der Prüfung unten ist das eine Sache von Minuten. Einen früheren Fall im Incident-Gedächtnis gibt es nicht (der Ordner fehlt in dieser Web-Session), und zu TimeTrack und config.ini habe ich im Netz keinen bekannten Fehler gefunden.

**Bis zur Lösung:** Er notiert seine Zeiten und trägt sie nach. Den Start als Administrator nur als Ausnahme nutzen. Falls du dabei deine eigenen Admin-Anmeldedaten eintippst, läuft TimeTrack unter deinem Konto, nicht unter seinem. Je nachdem, wie TimeTrack den Benutzer erkennt, landen seine Buchungen dann bei dir.

**Hypothesen** (alle ungeprüft)

1. **config.ini gehört auf PC-117 einem anderen Konto.** In `C:\ProgramData` dürfen normale Benutzer Dateien anlegen, Vollzugriff hat aber nur, wer die Datei angelegt hat; alle anderen dürfen nur lesen. Hat auf PC-117 der Installer, dein Admin-Konto bei der Einrichtung oder ein Vorbesitzer des Rechners die Datei angelegt, kann der Neue sie nur lesen. Die alten Kollegen haben sie auf ihren Rechnern vermutlich beim ersten Start selbst angelegt. Erkennbar an: Besitzer der Datei ist nicht er, `icacls` zeigt für ihn bzw. `Benutzer` nur `(RX)` oder `(R)`, Schreibtest „nein“. Auf dem alten Rechner ist der Kollege selbst Besitzer.
2. **Auf den alten Rechnern hat jemand Schreibrechte gesetzt**, etwa ein älteres Paket, ein früherer Handgriff oder eine AD-Gruppe. Erkennbar an: `icacls` zeigt dort zum Beispiel `Benutzer:(M)` oder eine Gruppe mit `(M)` oder `(F)`, die auf PC-117 fehlt oder in seiner Gruppenliste nicht vorkommt.
3. **Bei den alten Kollegen verdeckt Windows das Problem.** Ältere 32-Bit-Programme ohne Manifest leitet Windows bei fehlenden Schreibrechten still in eine eigene Kopie im Profil um (VirtualStore). Oder die alten Kollegen arbeiten als Admin ohne Benutzerkontensteuerung. Erkennbar an: Auf dem alten Rechner gibt es einen VirtualStore-Ordner für TimeTrack, `EnableLUA` oder `EnableVirtualization` unterscheiden sich, oder die TimeTrack-Versionen sind verschieden (eine neuere Version mit Manifest wird nicht mehr umgeleitet). Dann hat jeder alte Kollege seine eigene config.ini, das wäre für die Lösung wichtig.

**Was ich von dir brauche**

Diesen Block auf PC-117 als der neue Kollege in einer normalen PowerShell ausführen, nicht „Als Administrator“, sonst prüft er die falschen Rechte. Denselben Block auf dem Rechner eines alten Kollegen, angemeldet als dieser Kollege. TimeTrack vorher jeweils schließen.

```powershell
# Liest nur. Der Schreibtest öffnet config.ini kurz mit Schreibzugriff und schließt sie sofort wieder, ohne etwas hineinzuschreiben.
& {
  $ordner = 'C:\ProgramData\TimeTrack'
  $ini    = Join-Path $ordner 'config.ini'
  "== $env:COMPUTERNAME | $(whoami) | $(Get-Date -Format 'yyyy-MM-dd HH:mm')"
  '== Gruppen und Integritätsstufe (Auszug)'
  whoami /groups | Where-Object { $_ -match 'Administr|Benutzer|Users|Time|Zeit|Verbindlich|Mandatory' }
  '== Rechte: Ordner, dann config.ini'
  icacls $ordner
  icacls $ini
  "Besitzer Ordner: $((Get-Acl $ordner).Owner)"
  "Besitzer Datei:  $((Get-Acl $ini).Owner)"
  Get-Item $ini -Force | Select-Object Attributes, Length, CreationTime, LastWriteTime | Format-List
  '== Inhalt des Ordners'
  Get-ChildItem $ordner -Force | Select-Object Name, Length, LastWriteTime | Format-Table -AutoSize
  '== Schreibtest config.ini'
  try { $f = [IO.File]::Open($ini, 'Open', 'ReadWrite', 'ReadWrite'); $f.Close(); 'Schreibzugriff: ja' }
  catch { "Schreibzugriff: nein ($($_.Exception.GetBaseException().Message))" }
  '== UAC-Umleitung (VirtualStore) und UAC-Einstellungen'
  $vs = "$env:LOCALAPPDATA\VirtualStore\ProgramData\TimeTrack"
  if (Test-Path $vs) { Get-ChildItem $vs -Force | Select-Object Name, LastWriteTime | Format-Table -AutoSize } else { 'kein VirtualStore-Ordner für TimeTrack' }
  Get-ItemProperty 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Policies\System' | Select-Object EnableLUA, EnableVirtualization | Format-List
  '== Installierte TimeTrack-Version'
  $inst = Get-ItemProperty 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*', 'HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*', 'HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*' -ErrorAction SilentlyContinue |
    Where-Object { $_.DisplayName -match 'TimeTrack' }
  if ($inst) { $inst | Select-Object DisplayName, DisplayVersion, Publisher, InstallDate, InstallLocation | Format-List } else { 'kein Eintrag mit TimeTrack unter den installierten Programmen' }
} *>&1 | Tee-Object -FilePath "$env:TEMP\timetrack-rechte.txt"
```

Schick mir die Ausgabe beider Rechner oder die Datei `%TEMP%\timetrack-rechte.txt`. Sie enthält Rechner- und Benutzernamen.

Dazu zwei Fragen:

1. Tippst du bei „Als Administrator ausführen“ deine eigenen Admin-Anmeldedaten ein? Wenn ja: Unter welchem Namen stehen seine heutigen Buchungen in TimeTrack?
2. Arbeitet außer ihm noch jemand an PC-117 (Vertretung, Schicht)? Dann bekommt eine Gruppe das Recht, nicht nur er.

**Danach:** Bestätigt sich 1 oder 2, bekommt er (oder die Gruppe, die auf den alten Rechnern berechtigt ist) Änderungsrecht auf `config.ini`. Auf den ganzen Ordner nur, wenn dort keine Programmdateien liegen, die ein Dienst mit höheren Rechten ausführt, sonst könnte jeder Benutzer dort Code unterschieben. Vorher werden die bestehenden Rechte mit `icacls ... /save` gesichert, zurück geht es mit `icacls ... /restore`. Das ist eine dauerhafte Änderung am Rechner, deshalb bekommst du den genauen Befehl, sobald die Ausgabe zeigt, wer das Recht braucht. Erfolg erkennst du daran, dass er TimeTrack normal startet, ohne Meldung, und der Schreibtest „ja“ sagt. Zeigt der Vergleich keinen Unterschied, wäre der nächste Schritt Process Monitor mit Filter auf den TimeTrack-Prozess und das Ergebnis `ACCESS DENIED`. Das würde ich vorher mit dir absprechen.

Damit der nächste neue Kollege nicht wieder hängen bleibt, gehört das Recht anschließend in die Installation von TimeTrack (Paket oder Einrichtungsroutine). Das nehme ich als Folgeaufgabe mit, ebenso die Frage an den Hersteller, welche Rechte TimeTrack in `ProgramData` offiziell braucht.

**Quellen**

- [How User Account Control Works, Microsoft Learn](https://learn.microsoft.com/en-us/windows-server/security/user-account-control/how-user-account-control-works): Admins arbeiten ohne Erhöhung mit Standardrechten, Empfehlung für Standardkonten, Umleitung (Virtualisierung) nur für 32-Bit-Programme ohne Manifest
- [Default group permissions for ProgramData folder, Microsoft Q&A](https://learn.microsoft.com/en-us/answers/questions/4328564/default-group-permissions-for-programdata-folder): Standardrechte auf `C:\ProgramData` (Benutzer lesen und anlegen, `CREATOR OWNER` Vollzugriff)
- [icacls, Microsoft Learn](https://learn.microsoft.com/en-us/windows-server/administration/windows-commands/icacls): Rechte anzeigen, `/save` und `/restore`
- [Process Monitor, Microsoft Learn](https://learn.microsoft.com/en-us/sysinternals/downloads/procmon)
