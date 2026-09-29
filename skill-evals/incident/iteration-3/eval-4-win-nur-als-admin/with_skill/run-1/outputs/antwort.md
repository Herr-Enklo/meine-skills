`INC-20260928-1420 | P4 | Windows-Software | wartet auf Nutzer | TimeTrack auf PC-117 nur mit "Als Administrator ausführen" nutzbar`

**Kurz: Nein, bitte keine lokalen Adminrechte.** Es fehlt das Schreibrecht auf eine einzige Datei. Adminrechte würden das überdecken und ihm dauerhaft volle Kontrolle über PC-117 geben, auch für jeden Mailanhang, den er öffnet. "Als Administrator ausführen" war ein guter Test (es ist ein Rechteproblem), aber keine Lösung.

P4 als Annahme, eure Prioritätsregeln kenne ich nicht: ein Nutzer, Zeiten lassen sich nachtragen. Ist es kurz vor dem Monatsabschluss noch offen, stufe ich hoch.

**Warnung zum jetzigen Umweg:** Mit deinem Admin-Passwort läuft TimeTrack unter deinem Konto, nicht unter seinem, also mit deinem Profil. Erkennt TimeTrack den Mitarbeiter an der Windows-Anmeldung, landen seine Zeiten womöglich bei dir. Prüf bitte, unter welchem Namen die bisher so erfassten Zeiten stehen. Bis zur Lösung notiert er seine Zeiten und trägt sie nach.

**Warum es bei den alten Kollegen geht**

1. **Andere Dateirechte auf PC-117.** In `C:\ProgramData` dürfen Benutzer neue Dateien anlegen, fremde aber nur lesen. Hat dort der Installer, die Softwareverteilung oder ein Admin-Konto `config.ini` angelegt, ist sie für ihn schreibgeschützt. Erkennbar: auf PC-117 nur `VORDEFINIERT\Benutzer:(I)(RX)`, Besitzer SYSTEM oder ein Admin-Konto; auf dem alten PC ein zusätzliches `(M)`/`(F)` oder der Kollege als Besitzer.
2. **Die alten Kollegen haben mehr Rechte, nicht ihre Rechner.** Erkennbar: `whoami /groups` zeigt bei ihnen `VORDEFINIERT\Administratoren` oder eine Gruppe, die in den Dateirechten steht.
3. **Stille Umleitung auf den alten Rechnern.** Bei älteren 32-Bit-Programmen ohne Manifest leitet Windows verweigerte Schreibzugriffe in eine Kopie pro Benutzer unter `%LOCALAPPDATA%\VirtualStore` um. Erkennbar: auf dem alten PC ein VirtualStore-Ordner für TimeTrack, auf PC-117 EnableVirtualization = 0 oder im Lagebild eine andere Version.

**Nächster Schritt: ein Block, nur lesend**

Auf PC-117 als der neue Kollege angemeldet, normale PowerShell (nicht als Administrator). Danach derselbe Block auf dem PC eines alten Kollegen, als dieser angemeldet. `windows-lagebild.ps1` stammt aus dem Skill-Ordner; Pfad anpassen oder die letzte Zeile weglassen.

```powershell
# Nur lesend. Normale PowerShell, NICHT als Administrator, angemeldet als der betroffene Benutzer.
& {
  $d = 'C:\ProgramData\TimeTrack'
  "== $env:COMPUTERNAME / $env:USERDOMAIN\$env:USERNAME"
  '== Gruppen des Benutzers'
  whoami /groups
  '== Rechte: Ordner, dann Dateien'
  icacls $d
  icacls "$d\*"
  '== Dateien, geaendert, Besitzer'
  Get-ChildItem $d -Force | ForEach-Object { '{0}  {1}  {2}' -f $_.Name, $_.LastWriteTime, (Get-Acl $_.FullName).Owner }
  '== Schreibtest config.ini (oeffnet nur, schreibt nichts)'
  try { [IO.File]::Open("$d\config.ini", 'Open', 'ReadWrite', 'ReadWrite').Close(); 'Schreiben erlaubt' }
  catch { "Schreiben verweigert: $($_.Exception.Message)" }
  '== UAC-Virtualisierung (leer oder 1 = an, 0 = aus)'
  (Get-ItemProperty 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Policies\System').EnableVirtualization
  $vs = "$env:LOCALAPPDATA\VirtualStore\ProgramData\TimeTrack"
  if (Test-Path $vs) { Get-ChildItem $vs -Force | ForEach-Object { '{0}  {1}' -f $_.FullName, $_.LastWriteTime } } else { 'kein VirtualStore-Ordner fuer TimeTrack' }
} *>&1 | Tee-Object "$env:TEMP\timetrack-rechte.txt"

# Lagebild zu TimeTrack: Version, Installationsweg, Dienste, Ereignisse. Pfad zum Skript anpassen.
powershell -NoProfile -ExecutionPolicy Bypass -File "<Pfad>\windows-lagebild.ps1" -Software "TimeTrack" -Ausgabe "$env:TEMP\lagebild-timetrack.txt"
```

Beide Berichte liegen danach in `%TEMP%` und enthalten Rechner- und Benutzernamen.

**Lösung bei Hypothese 1 oder 3** (Stufe 2, du führst aus): in einer Admin-PowerShell Ändern-Recht nur auf diese Datei, nur für ihn: `icacls "C:\ProgramData\TimeTrack\config.ini" /grant "<DOMÄNE>\<kollege>:(M)"`. Wirkung: TimeTrack startet bei ihm ohne Adminrechte. Prüfung: Er startet es normal, bucht einmal, die Buchung steht unter seinem Namen. Rückweg: dasselbe mit `/remove:g "<DOMÄNE>\<kollege>"` statt `/grant`.

Meckert TimeTrack danach über eine weitere Datei im Ordner, gilt dasselbe für diese. Schreibrecht auf den ganzen Ordner nur, wenn dort reine Daten liegen: Liegen dort .exe, .dll oder Skripte, die ein Dienst oder Admin startet, wird das zum Weg zu Adminrechten. Welche Dateien genau verweigert werden, zeigt Process Monitor (Sysinternals) mit Filter auf den Prozess und `ACCESS DENIED`; ob ihr das auf dem Firmenrechner startet, entscheidest du.

Bei Hypothese 2 ist der eigentliche Befund, dass TimeTrack bei den anderen nur dank Adminrechten läuft. Dann erst Dateirechte richten, danach die Adminrechte dort zurücknehmen.

**Was ich von dir brauche**

- Die Ausgabe des Blocks von PC-117 und von einem alten PC.
- Unter welchem Namen die per "Als Administrator" erfassten Zeiten gebucht sind.

Geprüft: keine bekannten Herstellerfehler zu TimeTrack mit dieser Meldung gefunden; Aufzeichnungen früherer Incidents liegen mir hier nicht vor.

Folgeaufgabe: Kommt TimeTrack über die Softwareverteilung, gehören die Rechte ins Paket, sonst trifft es den nächsten neuen Rechner genauso.

Quellen:
- Standardrechte von `C:\ProgramData`: [Microsoft Q&A](https://learn.microsoft.com/en-us/answers/questions/4328564/default-group-permissions-for-programdata-folder)
- UAC-Anmeldeaufforderung für Standardbenutzer: [Microsoft Learn, How User Account Control works](https://learn.microsoft.com/en-us/windows/security/application-security/application-control/user-account-control/how-it-works)
- UAC-Virtualisierung: [Microsoft-Blogarchiv, Demystifying UAC Virtualization](https://learn.microsoft.com/en-us/archive/blogs/patricka/tales-of-application-compatibility-weirdness-demystifying-uac-virtualization); virtualisierte Orte inkl. %ProgramData% laut Russinovich (TechNet Magazine 2007), zitiert in einer [Notiz auf GitHub](https://github.com/danzek/annotationis/blob/master/Operating%20Systems/Windows/UACVirtualization.md)
