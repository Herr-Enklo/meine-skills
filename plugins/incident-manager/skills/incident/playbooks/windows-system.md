# Playbook: Windows-System

Für den Windows-Client selbst: Fehlermeldungen und Fehlercodes, Bluescreens und unerwartete Neustarts, Windows Update, Anmeldung und Profile, Gruppenrichtlinien, Zeit, Drucker, Outlook und Microsoft 365, langsamer oder voller Rechner. Programme und Softwareverteilung stehen in `windows-software.md`, Netzwerk in `netzwerk.md`.

## Lagebild

Erst das Skript, dann Fragen. Es liest nur und braucht keine Administratorrechte:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File "<skill-ordner>\scripts\windows-lagebild.ps1" -Ausgabe "$env:TEMP\lagebild.txt"
```

Es zeigt System und Build, Laufzeit seit dem letzten Start, ausstehenden Neustart und laufende Installationen, Datenträger, Speicherfresser, gestoppte Autostart-Dienste, gruppierte Fehlerereignisse, Abstürze mit Modulpfad, Startfehler, Windows-Installer- und Windows-Update-Vorgänge, Defender mit Name und Status eines Funds, Netzwerk und `PATH`. Optionen: `-Software <Name>` für ein Programm, `-Stunden <n>` oder `-Seit <Zeitpunkt>` für das Zeitfenster. Als der betroffene Benutzer ausführen. Wie das Skript auf den Rechner kommt, auch ohne Datei und aus der Ferne, steht in `windows-software.md` unter "Einstieg".

Vom Nutzer brauchst du dann nur noch: was passiert, Fehlermeldung wörtlich oder als Screenshot, seit wann, ein Rechner oder mehrere, und ob sich vorher etwas geändert hat.

## Fehlercodes nachschlagen

Nie raten. Windows löst Codes selbst auf:

```powershell
certutil -error 0x80070005
```

Aufbau, der beim Lesen hilft: `0x8007xxxx` ist ein Win32-Fehler, die letzten vier Stellen hexadezimal (`0x80070005` ist Win32-Fehler 5, Zugriff verweigert). `0xC...` sind NTSTATUS-Codes, meist aus Abstürzen oder Treibern. `0x8024xxxx` stammen von Windows Update. Ohne Windows (etwa in einer Web-Session) gibt es kein `certutil`; dann ist die Referenz [MS-ERREF] von Microsoft die Quelle für Win32-, HRESULT- und NTSTATUS-Codes. Was beide nicht kennen, mit dem genauen Code und dem Produkt suchen.

## Ereignisse

| Protokoll | Quelle und ID | Bedeutung |
|---|---|---|
| System | Kernel-Power 41 | Neustart ohne sauberes Herunterfahren (Absturz, Strom, Taste) |
| System | EventLog 6008 | voriges Herunterfahren war unerwartet |
| System | BugCheck 1001 | Neustart nach Bluescreen, mit Stopcode und Pfad der Speicherabbilddatei |
| System | Service Control Manager 7000, 7009, 7011 | Dienst startet nicht oder antwortet nicht rechtzeitig |
| System | Service Control Manager 7031, 7034 | Dienst unerwartet beendet |
| System | Disk 7, Disk 153, Ntfs 55 | Datenträger- oder Dateisystemfehler, Hardware prüfen |
| System | GroupPolicy 1085 | eine Richtlinienerweiterung konnte nicht angewendet werden |
| System | WindowsUpdateClient 19, 20, 43 | Update installiert, fehlgeschlagen, gestartet |
| Application | Application Error 1000, Application Hang 1002, .NET Runtime 1026 | Programmabsturz, Hänger, .NET-Ausnahme |
| Application | MsiInstaller 1033, 1040, 1042, 11707, 11708 | Installationsergebnis, Beginn und Ende einer Installer-Transaktion |
| Application | SideBySide 33 | benötigte Laufzeitumgebung fehlt |
| Application | User Profile Service 1511, 1515 | Anmeldung mit temporärem Profil |
| Security | 4625, 4740 | fehlgeschlagene Anmeldung, Kontosperre (4740 auf dem Domänencontroller) |

Rauschen, das fast immer harmlos ist: DistributedCOM 10016 (Berechtigungsmeldungen, die Microsoft ausdrücklich als ignorierbar beschreibt), einzelne Zeitdienst-Warnungen nach dem Start, einzelne Dienst-Zeitüberschreitungen beim Hochfahren. Zählt, wenn es mit dem Symptom zeitlich zusammenfällt oder gehäuft auftritt.

## Bluescreen und unerwartete Neustarts

- Das Lagebild zeigt im Abschnitt "Bluescreens, unerwartete Neustarts und Treiber" die Ereignisse BugCheck 1001, Kernel-Power 41 und EventLog 6008, die vorhandenen Speicherabbilder und die im Zeitraum installierten Treiber (UserPnp 20001). Für diesen Fall kein eigener Befehlsblock nötig.
- Kernel-Power 41 ohne BugCheck 1001 spricht eher für Strom, Netzteil, Überhitzung oder langes Drücken der Einschalttaste; mit BugCheck für einen Bluescreen.
- Stopcode aus BugCheck 1001 oder aus der Zuverlässigkeitsüberwachung (`perfmon /rel`) lesen und mit Treibername suchen. Wechselnde Stopcodes sprechen für Hardware (Arbeitsspeicher, Datenträger), gleichbleibende mit demselben Treiber für diesen Treiber.
- Speicherabbilder liegen unter `C:\Windows\Minidump`. Auswerten kann man sie mit WinDbg (`!analyze -v`); das installiert der Nutzer oder die IT.
- Kürzlich installierte Treiber und Updates prüfen (Lagebild, Windows-Update-Verlauf).

## Windows Update

- Fehlercode aus dem Lagebild oder dem Updateverlauf mit `certutil -error` auflösen.
- Häufige Codes: `0x80070070` zu wenig Speicherplatz, `0x80073712` Komponentenspeicher beschädigt, `0x800f081f` Quelldateien nicht gefunden, `0x8024402c` Server nicht erreichbar (Proxy, DNS; WinHTTP-Proxy steht im Lagebild), `0x80070005` Zugriff verweigert.
- Beschädigte Systemdateien oder Komponentenspeicher, als Administrator, dauert 10 bis 30 Minuten, Stufe 1 nach Ansage:

  ```
  DISM /Online /Cleanup-Image /RestoreHealth
  sfc /scannow
  ```

  Ergebnis in `C:\Windows\Logs\CBS\CBS.log`.
- `Get-WindowsUpdateLog` erzeugt eine lesbare `WindowsUpdate.log` auf dem Desktop.
- Im Unternehmen kommen Updates oft über WSUS, Intune oder die Softwareverteilung. Dann ist die Quelle der Updates die erste Frage, nicht der Client.

## Anmeldung, Konto, Profil

- Temporäres Profil (User Profile Service 1511, 1515): Das Profil ist beschädigt oder gesperrt. Nichts im Profilordner löschen; Sicherung und Reparatur sind Stufe 2 und im Unternehmen Sache der IT.
- Konto gesperrt: mit RSAT `$pdc = (Get-ADDomain).PDCEmulator` und `Get-ADUser <name> -Server $pdc -Properties LockedOut, BadLogonCount, LastBadPasswordAttempt, PasswordExpired`. Der Fehlversuchszähler wird nicht repliziert, deshalb den PDC-Emulator fragen. Die Quelle wiederholter Sperren zeigt Ereignis 4740 im Sicherheitsprotokoll des PDC-Emulators, Feld "Aufrufername" bzw. "Caller Computer Name". Häufig sind es alte Passwörter auf dem Handy, in Laufwerkszuordnungen, gespeicherten Anmeldeinformationen oder geplanten Aufgaben. Entsperren nur mit den Rechten und nach den Regeln des Nutzers.
- Zeit: Weicht die Uhr mehr als fünf Minuten vom Domänencontroller ab, scheitert die Kerberos-Anmeldung. `w32tm /query /status` zeigt Quelle und letzte Synchronisierung.

## Gruppenrichtlinien

- Was angewendet wurde: `gpresult /r` (Übersicht), `gpresult /h "$env:TEMP\gp.html"` (ausführlich, für Computereinstellungen als Administrator).
- Neu anwenden: `gpupdate /force`, Stufe 1.
- Fehler beim Anwenden: GroupPolicy 1085 im Systemprotokoll und das Protokoll `Microsoft-Windows-GroupPolicy/Operational`.

## Häufige Einzelfälle

- Drucker druckt nicht: `Get-Service Spooler`, `Get-Printer | Select-Object Name, PrinterStatus, PortName`, `Get-PrintJob -PrinterName "<Name>"`. Spooler neu starten ist am eigenen Rechner Stufe 1, auf einem Druckserver Stufe 2. Das Protokoll `Microsoft-Windows-PrintService/Operational` ist standardmäßig aus.
- Outlook oder Microsoft 365: erst prüfen, ob der Dienst gestört ist (Dienststatus im Microsoft 365 Admin Center oder per Websuche), dann Anmeldung, dann Add-ins (`outlook.exe /safe`), dann Profil und Cache. Betrifft es mehrere Nutzer, ist es selten der Client.
- Rechner langsam: Speicherfresser und Laufzeit seit dem letzten Start aus dem Lagebild, freier Platz, Virenscanner im Vollscan, Updates im Hintergrund. Seit Wochen nicht neu gestartet ist eine eigene Ursache.
- Datenträger voll: große Ordner finden, das dauert auf großen Platten, vorher ankündigen:

  ```powershell
  Get-ChildItem C:\ -Directory -ErrorAction SilentlyContinue | ForEach-Object {
    [pscustomobject]@{ Ordner = $_.FullName; GB = [math]::Round((Get-ChildItem $_.FullName -Recurse -File -ErrorAction SilentlyContinue | Measure-Object Length -Sum).Sum / 1GB, 1) }
  } | Sort-Object GB -Descending
  ```

  Nichts löschen ohne Freigabe (Stufe 3). Windows bringt mit der Datenträgerbereinigung und der Speicheroptimierung eigene, sichere Wege mit.

## Eingriffe unter Windows

| Eingriff | Stufe |
|---|---|
| Lagebild, Ereignisse, `certutil -error`, `gpresult`, Registry lesen | 0 |
| Einzelnen hängenden Dienst am eigenen Rechner neu starten, `gpupdate /force`, `DISM` und `sfc` | 1 |
| Neustart des Rechners, während jemand daran arbeitet | 2 |
| Registry-Werte ändern (vorher `reg export <Schlüssel> <Datei>`), Treiber zurücksetzen, Virenscanner-Ausnahmen | 2 |
| Profil zurücksetzen, Dateien oder Ordner löschen, Windows zurücksetzen | 3 |

## Eskalation

Verdacht auf Hardwaredefekt (Datenträgerfehler, wechselnde Stopcodes), fehlende Rechte, Server im Firmennetz: Übergabe nach `vorlagen.md` mit dem Lagebild als Anhang.
