`INC-20260929-0830 | P3 | Windows-System | wartet auf Nutzer | Bluescreen DRIVER_IRQL_NOT_LESS_OR_EQUAL beim Andocken, Dell Latitude`

DRIVER_IRQL_NOT_LESS_OR_EQUAL ist Stopcode 0xD1: Ein Kernel-Treiber hat auf ungültigen oder auslagerbaren Speicher zugegriffen, meist ist also ein Treiber die Ursache [1]. Beim Andocken lädt Windows die Treiber für alles am Dock (Netzwerk, USB-C/Thunderbolt, Monitore), das passt. Welcher es ist, zeigt nur die .sys-Datei auf dem Bluescreen oder im Speicherabbild. P3 als Annahme, deine Prioritätsregeln kenne ich nicht: ein Nutzer, aber das Arbeitsgerät stürzt wiederholt ab. Frühere Fälle dazu habe ich keine gespeichert.

**Damit du weiterarbeiten kannst**

1. Bis zur Klärung ohne Dock arbeiten.
2. Musst du ans Dock: vorher alles speichern. Einen Versuch wert, bei dir ungeprüft: Laptop herunterfahren, andocken, dann einschalten. So entfällt das Einstecken im laufenden Betrieb. Stürzt er beim Start ab, abziehen und ohne Dock starten.
3. Kommt der Bluescreen wieder, fotografier ihn vor dem Neustart. Unter dem Stopcode steht oft die .sys-Datei.

Bitte nichts in `C:\Windows\Minidump` löschen, auch nicht per Datenträgerbereinigung oder Aufräumprogramm: Die Speicherabbilder sind neben einem Foto die einzige Quelle für den Treibernamen. Keine Treiber auf Verdacht deinstallieren, keine „Treiber-Updater“ installieren.

**Vermutungen** (Treiberklassen, solange keine .sys-Datei bekannt ist)

1. Netzwerktreiber des Docks: Treiberinstallation für einen Netzwerkadapter kurz vor dem ersten Bluescreen, oder ein neues Datum in `treiber.txt`.
2. USB-C/Thunderbolt, BIOS oder Dock-Firmware: Firmware-, BIOS- oder Thunderbolt-Einträge im Update-Verlauf der letzten Tage.
3. Grafik- oder DisplayLink-Treiber für die Monitore am Dock: neuer Grafiktreiber im Zeitraum, Anzeigefehler kurz vor den Bluescreens.
4. Hardware oder ein Treiber ohne Dock-Bezug: wechselnde Stopcodes, Bluescreens ohne Dock, Datenträgerfehler (Disk 7, Disk 153, Ntfs 55).

**Geprüft**

Dell empfiehlt bei Dock-Problemen zuerst aktuelle Windows-Updates, BIOS, Dock-Firmware und Treiber [2]; das gilt für Dell-Docks, dein Modell kenne ich noch nicht. Einen aktuell bekannten Windows-Fehler mit Bluescreens beim Andocken habe ich per Websuche nicht gefunden. Mit deinem Build aus dem Lagebild suche ich gezielt nach.

**Nächster Schritt: Lagebild vom Laptop**

Gestern war Montag. Ein Update von letzter Woche oder vom Wochenende fällt oft erst beim ersten Andocken auf, deshalb reicht das Zeitfenster bis 21.09. zurück. Das Skript `windows-lagebild.ps1` liegt in deinem Repo `meine-skills` unter `plugins/incident-manager/skills/incident/scripts/`. Nach „Downloads“ kopieren, dann in PowerShell ausführen, ohne Dock und als du selbst, nicht mit einem Admin-Konto. Der Block liest nur.

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File "$env:USERPROFILE\Downloads\windows-lagebild.ps1" -Seit "2026-09-21" -Ausgabe "$env:TEMP\lagebild.txt"
& {
  Get-CimInstance Win32_BIOS | Select-Object Manufacturer, SMBIOSBIOSVersion, ReleaseDate | Format-List
  Get-CimInstance Win32_PnPSignedDriver |
    Where-Object { $_.DeviceClass -in 'NET','DISPLAY' -or $_.DeviceName -match 'Thunderbolt|USB4|DisplayLink' } |
    Sort-Object DriverDate -Descending |
    Select-Object DeviceName, DriverProviderName, DriverVersion, DriverDate | Format-Table -AutoSize
} | Out-File "$env:TEMP\treiber.txt" -Encoding utf8 -Width 250
notepad "$env:TEMP\lagebild.txt"; notepad "$env:TEMP\treiber.txt"
```

Schick mir beide Dateien; Rechner- und Benutzernamen darin kannst du schwärzen. Am wichtigsten sind die Abschnitte „Bluescreens, unerwartete Neustarts und Treiber“ und Windows Update. Steht bei jedem Absturz derselbe Stopcode, spricht das für einen einzelnen Treiber. Blockiert eine Richtlinie das Skript, sag Bescheid, dann geht es ohne Datei.

Danach wird mit Adminrechten das neueste Speicherabbild mit WinDbg ausgewertet (`!analyze -v`) [3], die Schritte schicke ich dir dann. Auf einem Firmenrechner (das Lagebild zeigt die Domäne) macht das und die Korrektur meist eure IT. Je nach Befund folgt Zurücksetzen des zuletzt geänderten Treibers oder BIOS, Firmware und Treiber auf Herstellerstand, vorher abgestimmt mit dir.

**Was ich von dir brauche**

1. Welches Dock ist es genau (Hersteller und Modell, steht auf der Unterseite)?
2. Kam ein Bluescreen auch schon, als der Laptop nicht am Dock hing?
3. Hat sich vor gestern etwas am Arbeitsplatz geändert, etwa ein anderes Dock, Kabel oder ein neuer Monitor?

**Quellen**

[1] Microsoft Learn, Bug Check 0xD1: https://learn.microsoft.com/en-us/windows-hardware/drivers/debugger/bug-check-0xd1--driver-irql-not-less-or-equal
[2] Dell, USB-C and Thunderbolt Docks, BIOS Settings and Driver Installation for Troubleshooting: https://www.dell.com/support/kbdoc/en-us/000124220/dell-usb-c-and-thunderbolt-docks-wd15-tb16-tb18dc-wd19-wd19tb-wd19dc-d6000-bios-settings-and-driver-installation-for-troubleshooting
[3] Microsoft Learn, Analyze a Kernel-Mode Dump File by Using WinDbg: https://learn.microsoft.com/en-us/windows-hardware/drivers/debugger/analyzing-a-kernel-mode-dump-file-with-windbg
