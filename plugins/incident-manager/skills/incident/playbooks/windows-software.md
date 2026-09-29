# Playbook: Software unter Windows

Für alles rund um Programme auf Windows-Clients: Installation, Update oder Deinstallation scheitert, Softwareverteilung (Empirum) meldet Fehler, Programm startet nicht, stürzt ab, hängt, bringt eine Fehlermeldung, läuft nur als Administrator, verhält sich nach einem Update anders. Das System drumherum (Ereignisse, Updates, Profile, Richtlinien) steht in `windows-system.md`.

## Einstieg

Frag nicht nach, was ein Befehl beantworten kann. Nötig vom Nutzer sind nur: welches Programm, was genau passiert (Fehlermeldung wörtlich oder Screenshot), seit wann, ein Rechner oder mehrere. Alles andere liefert das Lagebild-Skript:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File "<skill-ordner>\scripts\windows-lagebild.ps1" -Software "<Programmname>" -Ausgabe "$env:TEMP\lagebild.txt"
```

Mit `-Seit "2026-09-28 18:00"` statt der voreingestellten 48 Stunden lässt sich das Zeitfenster auf eine Rollout-Nacht legen. Startet ein Programm gar nicht, zusätzlich `windows-startcheck.ps1` (siehe "Startfehler" unten).

So kommt das Skript auf den Rechner:

- Läuft Claude lokal auf dem Rechner, direkt ausführen.
- Sonst liegt es im Skill-Ordner und muss auf den Rechner kopiert werden. Einen festen Ablageort im Firmennetz (Freigabe für IT-Werkzeuge, Empirum-Paket) einmal erfragen und im Gedächtnis ablegen.
- Ohne Datei: den Inhalt in einen Skriptblock einfügen und mit Parametern aufrufen, `& { <Inhalt des Skripts> } -Software "X" -Seit "2026-09-28 18:00"`. Das hilft auch, wenn eine per Gruppenrichtlinie gesetzte Ausführungsrichtlinie `-ExecutionPolicy Bypass` übersteuert.
- Im eingeschränkten Sprachmodus (AppLocker, WDAC) scheitern einzelne Abschnitte; sie stehen dann als "nicht abrufbar" im Bericht, der Rest ist verwertbar.
- Als der betroffene Benutzer ausführen, nicht mit einem separaten Admin-Konto, sonst zeigen Benutzerregistry und Profilpfade auf das falsche Konto. Einen zusätzlichen Lauf als Administrator nur für Defender- und Systemteile.
- Aus der Ferne mit WinRM und Administratorrechten: `Invoke-Command -ComputerName <PC> -FilePath <skript> -ArgumentList 'Notepad++', 48, '2026-09-28 18:00'`. Die Argumente gehen nach Position (Software, Stunden, Seit, Ausgabe); eine Datei aus `-Ausgabe` landet auf dem fernen Rechner.

Die wichtigsten Fragen an das Ergebnis:

- Was ist wirklich installiert, in welcher Ansicht (64-Bit, 32-Bit, nur Benutzer), wie oft? Doppelte Einträge und Reste alter Versionen sind eine häufige Ursache.
- Gibt es Absturz-, Hänger- oder .NET-Ereignisse zum Programm, und welches Modul und welcher Code stehen darin?
- Was hat Windows Installer im Zeitfenster getan, was Windows Update?
- Steht ein Neustart aus, läuft gerade eine Installation?

## Ein Rechner oder viele

Betrifft es einen Teil der Rechner (zum Beispiel 14 von 230 nach einem Rollout), funktioniert das Paket grundsätzlich. Gesucht ist, was die betroffenen Rechner gemeinsam haben und die anderen nicht: Zeitpunkt, was im selben Zeitfenster sonst lief (andere Pakete, Windows Update, Virenscanner-Updates), Standort, Gerätetyp, Windows-Build, vorher installierte Version und deren Quelle, ausstehender Neustart. Erst in der Konsole der Softwareverteilung vergleichen, dann einen betroffenen und einen erfolgreichen Rechner mit dem Skript gegenüberstellen.

Betrifft es alle, liegt es am Paket, an der Quelle, an einer Richtlinie oder an einem zentralen Dienst, nicht am einzelnen Client.

## Installation, Update, Deinstallation

### Rückgabewerte von Windows Installer

| Code | Bedeutung | Nächster Schritt |
|---|---|---|
| 0 | Erfolg | Symptom liegt woanders, etwa Erkennung, Benutzerteil, Verknüpfung |
| 1601 | Windows-Installer-Dienst nicht erreichbar | Dienst `msiserver`, Neustart ausstehend? |
| 1602 | vom Benutzer abgebrochen | Aufruf wirklich still (`/qn`)? |
| 1603 | schwerer Fehler während der Installation | ausführliches Log, siehe unten |
| 1605 | Aktion nur für installierte Produkte | Deinstallation eines nicht installierten Produkts, Erkennung prüfen |
| 1612 | Installationsquelle nicht verfügbar | Quelle oder Cache der Vorversion fehlt |
| 1618 | eine andere Installation läuft bereits | siehe eigener Abschnitt unten |
| 1619 | Paket konnte nicht geöffnet werden | Pfad, Rechte, Datei vollständig? |
| 1620 | ungültiges Paket | Datei beschädigt oder falscher Typ |
| 1622 | Logdatei kann nicht geöffnet werden | Ordner für `/l*v` existiert nicht oder keine Schreibrechte |
| 1624 | Transform fehlerhaft | Pfad oder Version der `.mst` passt nicht |
| 1625 | durch Richtlinie verboten | Gruppenrichtlinie, AppLocker, WDAC |
| 1633 | Plattform nicht unterstützt | falsche Architektur (x86, x64, ARM64) |
| 1638 | andere Version bereits installiert | Upgrade-Logik oder vorher deinstallieren |
| 1639 | ungültiges Befehlszeilenargument | Parameter prüfen |
| 1641 | Installer hat Neustart ausgelöst | Erfolg |
| 3010 | Neustart erforderlich | Erfolg, Neustart ausstehend |

Im Ereignisprotokoll steht der Rückgabewert in MsiInstaller 1033 (Installation) bzw. 1034 (Entfernung). 11708 ("Installationsvorgang fehlgeschlagen") allein nennt keinen Code. Fehlt 1033, den ErrorLevel aus der Softwareverteilung holen.

Unbekannte Codes nicht raten, sondern nachschlagen: `certutil -error <code>` (siehe `windows-system.md`). EXE-Installer (NSIS, Inno Setup, InstallShield und andere) haben eigene Codes und Logschalter; die Doku des Herstellers suchen.

### 1618: eine andere Installation läuft

Windows Installer lässt nur eine Installation zur Zeit zu. 1618 heißt, dass jemand anderes gerade installierte. Wer, zeigt das Anwendungsprotokoll: MsiInstaller 1040 (Beginn) und 1042 (Ende) mit einem fremden Produkt, das die Fehlerzeit einschließt, oder Windows Update (System, WindowsUpdateClient 43 Beginn, 19 installiert, 20 Fehler) zur selben Zeit. Das Lagebild-Skript zeigt beides. Ein laufender `msiexec.exe /V` ist nur der Dienst und harmlos; verdächtig ist ein `msiexec` mit `/i` oder `/x` und altem Startzeitpunkt. Liefert ein EXE-Installer 1618, stammt der Code aus einem `msiexec`-Aufruf im Ablauf, etwa der Deinstallation einer MSI-Vorversion oder einer Abhängigkeit.

Lösung meist: Wiederholen, wenn nichts anderes installiert. Dauerhaft: Rollout-Fenster nicht mit Windows Update oder anderen Paketen überlappen lassen oder im Paket auf 1618 warten und einmal wiederholen.

### 1603 und andere unklare Fehler

Ausführliches Log erzeugen. `msiexec` wartet in PowerShell nicht von selbst, deshalb über `Start-Process`:

```powershell
$log = "$env:TEMP\install.log"
$p = Start-Process msiexec.exe -ArgumentList "/i `"C:\Pfad\paket.msi`" /qn /l*v `"$log`"" -Wait -PassThru
$p.ExitCode
Select-String -Path $log -Pattern 'Return value 3|ckgabewert 3' -Context 30,2 | Select-Object -First 1
```

Das ist eine echte Installation: auf einem Testrechner Stufe 1, auf dem Rechner eines Nutzers Stufe 2. Die Ursache steht meist in den Zeilen direkt vor dem ersten `Return value 3` (deutsches Windows: `Rückgabewert 3`). Typisch: Datei in Benutzung, fehlende Rechte auf einem Ordner oder Registry-Schlüssel, fehlende Voraussetzung, Custom Action mit Fehler.

### Store- und MSIX-Apps, winget

- Installierte Apps: `Get-AppxPackage -Name *<teil>*` (Paketname, nicht Anzeigename). Fehler beim Bereitstellen stehen im Protokoll `Microsoft-Windows-AppXDeploymentServer/Operational`.
- winget: `winget list <name>` zeigt, was winget sieht; `winget --logs` öffnet den Ordner mit den Protokollen.

### Reparieren, Neuinstallieren, Reste

Reihenfolge nach Eingriffsstärke:

1. Neustart, wenn einer aussteht. Stufe 2, weil der Nutzer offene Arbeit verliert; Stufe 1 nur, wenn niemand angemeldet ist. Das Lagebild vorher ziehen, sonst ist "Neustart ausstehend" als Beleg weg.
2. Reparatur: bei MSI `msiexec /fa {ProductCode}`, der Produktcode ist der GUID-Schlüssel aus dem Lagebild; sonst die Reparaturfunktion des Programms. Stufe 1.
3. Deinstallieren und neu installieren. In einer Umgebung mit Softwareverteilung über die Verteilung, nicht von Hand, damit Zuweisung und Inventar stimmen. Stufe 2.
4. Reste entfernen (Ordner, Registry, Dienste, geplante Aufgaben). Registry vorher mit `reg export` sichern, Ordner umbenennen statt löschen. Stufe 3.

## Matrix42 Empirum

- Die Fehlerzeile im Empirum-Protokoll des Clients nennt den gescheiterten Schritt. In den Paketen nach den Vorlagen im Repo `packaging-center` lautet sie `<ErrorLogMessage> ErrorLevel: <Code>`, zum Beispiel `Fehler beim Deinstallieren (Repair) von {GUID}. ErrorLevel: 1618`. Sie wörtlich erfragen, das ist die wichtigste Angabe.
- Der Reparaturpfad der Vorlagen deinstalliert zuerst die gefundene Vorversion und installiert dann neu. Scheitert der zweite Teil, fehlt das Programm auf dem Client ganz. Dann ist ein Workaround für die Betroffenen nötig, nicht erst die nächste Nacht.
- Protokolle der Vorlagen: MSI-Pakete schreiben `%App%\<Hersteller>.<Produkt>.<Version>.<Revision>.MSI.log` und löschen es nur nach Erfolg; EXE-Pakete schreiben `%Temp%\<Produkt>.<Version>.<Revision>.log`, beim Agenten unter SYSTEM ist `%Temp%` in der Regel `C:\Windows\Temp`. Weitere Protokollorte des Agenten beim ersten Incident vom Nutzer erfragen und im Gedächtnis ablegen.
- Die Skriptkopie des ausgeführten Pakets liegt unter `%ProgramData%\$Matrix42Scripts$\<Hersteller>\<Produkt>\<Version>\Install\Setup.inf`. In PowerShell den Pfad mit einfachen Anführungszeichen bauen, sonst wird `$Matrix42Scripts` als Variable gelesen: `Join-Path $env:ProgramData '$Matrix42Scripts$'`. Daran sieht man, welche Fassung und welche Aufrufe tatsächlich liefen: `Select-String -Path <Setup.inf> -Pattern 'Call|MsiExec'`.
- Fehler im Paket selbst (Erkennung, Uninstall-Schlüssel in der falschen Registry-Ansicht, Uninstaller arbeitet asynchron weiter, Reste bleiben liegen) werden im Paket behoben: Skill `paketieren`, Packaging Center mit `python main.py check <setup.inf>` und die Simulation im Repo `matrix42-paketierung`. Ist `paketieren` in der Session nicht verfügbar, die Änderung an der setup.inf als begründeten Vorschlag liefern und den Paketierlauf als Folgeaufgabe nennen.
- Wer einen Hersteller-Installer (EXE) als eigenes MSI nachbaut, verliert dessen Upgrade-Logik und hinterlässt doppelte Einträge, wenn die EXE-Vorversion nicht entfernt wird. Bei Notepad++ etwa sortiert nur der Herstellerinstaller inkompatible Plugins nach `plugins\disabled` aus.
- Erneut ausführen erst, wenn die Ursache klar ist, sonst kommt derselbe Fehler. Tagsüber scheitern Installer oft anders, weil das Programm offen ist (viele Installer brechen dann still ab). Also außerhalb der Arbeitszeit wiederholen oder das Paket die Anwendung schließen lassen (`AskKillProcesses` oder `KillProcess` im Abschnitt `CloseApplication` der Vorlage). Wiederholen ist Stufe 2.
- Bei Rollout-Incidents nebenbei prüfen, ob die ausgerollte Version noch aktuell ist und keine bekannte Schwachstelle hat. Das ist ein Hinweis oder ein Change, kein Sicherheitsvorfall, solange es keine Zeichen einer Kompromittierung gibt.

## Programm startet nicht, stürzt ab, hängt

### Absturzereignisse lesen

Das Lagebild zeigt Anwendungsfehler (Application Error 1000), Hänger (Application Hang 1002) und .NET-Fehler (.NET Runtime 1026) mit Programm, fehlerhaftem Modul, Modulpfad und Ausnahmecode. Der Modulpfad zeigt, ob das Modul zum Programm gehört, ein Plugin ist oder von einem anderen Produkt stammt. Einen Überblick über Wochen zeigt die Zuverlässigkeitsüberwachung: `perfmon /rel`.

| Ausnahmecode | Bedeutung | Typische Richtung |
|---|---|---|
| `0xc0000005` | Zugriffsverletzung | Programmfehler, fehlerhaftes Add-in oder fremdes Modul (Virenscanner, Shell-Erweiterung, Overlay) |
| `0xc0000135` | DLL nicht gefunden | fehlende Laufzeitumgebung oder Abhängigkeit |
| `0xc000007b` | ungültiges Image-Format | 32- und 64-Bit gemischt, falsche oder beschädigte DLL |
| `0xc0000142` | DLL-Initialisierung fehlgeschlagen | Laufzeitumgebung, Sitzung, Rechte |
| `0xc0000374` | Heap beschädigt | Programmfehler oder fremdes Modul |
| `0xc0000409` | Stack-Pufferüberlauf oder bewusster Sofortabbruch | Programm hat sich selbst beendet; Absturzbericht ansehen |
| `0xe0434352` | unbehandelte .NET-Ausnahme | Ereignis 1026 zur selben Zeit nennt Ausnahmetyp und Stack |
| `0xe06d7363` | unbehandelte C++-Ausnahme | Programmfehler, oft durch fehlende Datei oder Konfiguration ausgelöst |
| `0x80000003` | Haltepunkt | Programm hat absichtlich angehalten, oft ein Assert |

Das fehlerhafte Modul sagt, wo man sucht: eine DLL des Programms selbst spricht für einen Programmfehler (Update, bekannte Probleme beim Hersteller), eine fremde DLL für das Produkt, zu dem sie gehört, `ntdll.dll` und `KERNELBASE.dll` sind oft nur der Ort, an dem ein Fehler sichtbar wird, nicht die Ursache. Absturzberichte liegen unter `C:\ProgramData\Microsoft\Windows\WER\ReportArchive`.

### Startfehler: 0xc000007b, 0xc0000135, fehlende DLL

Startet ein Programm gar nicht, entsteht meist kein Absturzereignis 1000. Windows schreibt nur einen Eintrag "Application Popup" (Ereignis 26) ins Systemprotokoll; das Lagebild zeigt ihn im Abschnitt "Startfehler". Die Ursache sucht `windows-startcheck.ps1`:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File "<skill-ordner>\scripts\windows-startcheck.ps1" -Programm "<Name oder Pfad der EXE>" -Seit "<Rollout-Zeitpunkt>" -Ausgabe "$env:TEMP\startcheck.txt"
```

Es liest die Importtabelle des Programms und der DLLs aus seinem Ordner und sucht jede benötigte DLL dort, wo Windows sie sucht: bekannte System-DLLs, Programmordner, Systemordner, Windows-Ordner, dann `PATH`. Gemeldet werden fehlende DLLs, DLLs in falscher Architektur mit Fundort, beschädigte Dateien, Dateien im Programmordner mit anderer Architektur oder jüngerem Datum, installierte Visual-C++-Laufzeiten und der `PATH`. Ein Klassiker für 0xc000007b: Die 32-Bit-Fassung einer DLL fehlt, und über einen neuen `PATH`-Eintrag findet Windows die 64-Bit-Fassung.

Für 32-Bit-Programme auf 64-Bit-Windows ist der Systemordner `SysWOW64`, nicht `System32`; das Skript berücksichtigt das. Bleibt es ohne Befund (etwa weil das Programm DLLs erst zur Laufzeit nachlädt), zeigt Process Monitor mit Filter auf den Prozess die letzte DLL vor dem Abbruch. Process Monitor erst nach Rückfrage starten.

Wer die Befunde vergleichen will: Startcheck auf einem betroffenen und einem funktionierenden Rechner laufen lassen und die Abschnitte "Probleme" und "PATH" gegenüberstellen.

### Fehlende Laufzeitumgebungen

- Meldung zu `MSVCP140.dll`, `VCRUNTIME140.dll` oder `VCRUNTIME140_1.dll`: die Visual-C++-Laufzeit (aktuell "Visual C++ v14 Redistributable", früher als "2015–2022" geführt) fehlt in der Architektur des Programms oder ist beschädigt. In Listen nach `*Visual C++*` suchen, nicht nach einer Jahreszahl. 32-Bit-Programme brauchen die x86-Fassung, auch auf 64-Bit-Windows.
- Ereignis SideBySide 33 im Anwendungsprotokoll: eine im Manifest verlangte Laufzeit fehlt; die Meldung nennt Name und Version.
- .NET Framework 4.x: `(Get-ItemProperty 'HKLM:\SOFTWARE\Microsoft\NET Framework Setup\NDP\v4\Full').Release` liefert die installierte Stufe. Neueres .NET: `dotnet --list-runtimes`.

### Eingrenzen

- Anderer Benutzer auf demselben Rechner: Geht es dort, liegt es am Profil (Einstellungen unter `%APPDATA%` und `%LOCALAPPDATA%`, Benutzerteil der Registry). Einstellungen durch Umbenennen des Ordners zurücksetzen, nicht löschen (Stufe 2).
- Start ohne Erweiterungen, wo es das gibt (Office: `outlook.exe /safe`, `winword.exe /safe`; Notepad++: `-noPlugin`): geht es dann, ist ein Add-in oder Plugin schuld. Deaktivierte Add-ins zeigt Office unter Optionen, Add-Ins.
- Läuft nur als Administrator: fehlende Schreibrechte auf Programmordner, Registry oder Daten. "Als Administrator ausführen" ist ein Test, keine Lösung. Die fehlende Berechtigung findet Process Monitor (Sysinternals, von Microsoft) mit Filter auf den Prozess und Ergebnis `ACCESS DENIED` oder `NAME NOT FOUND`. Ein Werkzeug auf einem Firmenrechner zu starten, fragt man vorher. Die Lösung so eng wie möglich: Schreibrecht auf die eine Datei oder einen reinen Datenordner. Liegen im Ordner Programme, DLLs oder Skripte, die ein Dienst oder ein Administrator startet, wird Schreibrecht für alle Benutzer zur Rechteausweitung.
- Seit einem Update kaputt: Versionshistorie und bekannte Probleme beim Hersteller, Release Notes; Rückkehr zur Vorversion über die Softwareverteilung ist Stufe 2.
- Virenscanner blockiert: Defender-Funde im Lagebild; bei fremden Produkten deren Protokoll. Ausnahmen einzurichten ist Stufe 2 und im Unternehmen Sache der IT-Sicherheit.
- Hängt beim Start: Netzlaufwerke oder Lizenzserver, die nicht antworten, sind häufige Ursachen. Hängerereignis 1002 und Process Monitor zeigen, worauf das Programm wartet.

## Spezialisten

Für Paketfehler der Skill `paketieren`. Für Code-Fehler in eigener Software `engineering-minimal-change-engineer`. Für Leistungsprobleme `testing-performance-benchmarker`. Subagents lohnen sich hier nur, wenn sie Belege selbst erreichen (Websuche nach bekannten Fehlern, Hersteller-Doku, Repositories); am Firmenrechner sammelt der Nutzer die Belege, dann ist ein gemeinsamer Befehlsblock besser.
