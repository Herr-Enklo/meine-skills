`INC-20260929-0830 | P3 | Windows-System | wartet auf Nutzer | Bluescreen DRIVER_IRQL_NOT_LESS_OR_EQUAL beim Andocken, Dell Latitude`

**Einordnung**

DRIVER_IRQL_NOT_LESS_OR_EQUAL (0xD1) heißt: Ein Treiber im Kernel hat auf Speicher zugegriffen, den er in dem Moment nicht anfassen durfte. Schuld ist fast immer ein bestimmter Treiber, und das .sys unter dem Stopcode ist genau der Name, den wir brauchen. Dass es beim Andocken passiert, deutet (Vermutung) auf den Treiber eines Geräts, das dabei dazukommt: Netzwerkkarte im Dock, Grafik, Thunderbolt/USB.

Da es seit gestern (Montag) auftritt, suche ich zuerst eine Änderung davor. Am Wochenende war der Laptop vermutlich nicht gedockt, deshalb schaut die Diagnose eine Woche zurück.

P3: ein Gerät, aber wiederholte Abstürze ohne Vorwarnung, jedes Mal ist Ungespeichertes weg, und ob er ohne Dock stabil läuft, ist offen (Auswirkung niedrig, Dringlichkeit hoch; Annahme, da ich keine Prioritätsregeln deines Arbeitgebers kenne). Frühere Incidents habe ich keine, der Journal-Ordner fehlt in dieser Sitzung. Einen von Microsoft bestätigten Fehler „Bluescreen am Dock“ in aktuellen Windows-11-Updates habe ich per Websuche nicht gefunden (nicht erschöpfend).

**Sofort, bis die Ursache klar ist**

1. Vor dem Andocken alles speichern.
2. Wenn es geht, vorerst ohne Dock arbeiten oder nur im ausgeschalteten Zustand andocken und dann starten. Ob das hier hilft, ist ungeprüft.
3. Kommt der Bluescreen wieder: Handyfoto vom Bildschirm. Unter dem Stoppcode steht „Fehlerursache: <name>.sys“ (englisch „What failed“). Damit ist der Treiber meist schon gefunden.

**Hypothesen**, und woran man sie in der Ausgabe erkennt

- **H1 Realtek-USB-Netzwerktreiber im Dell-Dock** (`rtux64w10.sys`, unter neuerem Windows 11 auch `rtu53cx22x64.sys`), bekannt für genau diesen Stopcode beim Andocken: in Teil 2 ein „Realtek USB GbE“-Gerät mit altem oder gerade geändertem Treiber.
- **H2 Grafik- oder DisplayLink-Treiber** (Intel-Grafik `igdkmd64.sys`, DisplayLink `dlkmd.sys` bei USB-Docks wie dem D6000): im Lagebild eine Grafik- oder DisplayLink-Treiberinstallation kurz vor dem ersten Bluescreen.
- **H3 VPN- oder Sicherheitssoftware mit Netzwerkfilter**, die beim Wechsel von WLAN auf das LAN im Dock anspringt: Als Ursache taucht ein Windows-Netzwerktreiber (`tcpip.sys`, `ndis.sys`, `netio.sys`) oder ein Treiber des VPN- oder Virenschutzprodukts auf.
- **H4 Hardware, etwa Arbeitsspeicher**, weniger wahrscheinlich: wechselnde Stopcodes im Lagebild, Abstürze auch ohne Dock.

**Befehle für deinen Laptop**

Das Lagebild-Skript liegt in deinem Repo `meine-skills` unter `plugins/incident-manager/skills/incident/scripts/windows-lagebild.ps1`. Kopier es in deinen Downloads-Ordner und führ den Block in PowerShell als du selbst aus. Er liest nur und ändert nichts. Teil 2 am besten, während der Laptop gerade gedockt läuft.

```powershell
# 1) Lagebild seit letzter Woche: Bluescreens mit Stopcode, Speicherabbilder, neue Treiber, Windows Update
powershell -NoProfile -ExecutionPolicy Bypass -File "$env:USERPROFILE\Downloads\windows-lagebild.ps1" -Seit "2026-09-22 00:00" -Ausgabe "$env:TEMP\lagebild.txt"

# 2) Treiber der Geräte, die mit dem Dock kommen (Netzwerk, Grafik, DisplayLink, Thunderbolt/USB4, Audio, WLAN)
Get-CimInstance Win32_PnPSignedDriver |
  Where-Object { $_.DeviceName -match 'Dock|WD\d\d|GbE|Ethernet|Realtek|DisplayLink|Thunderbolt|USB4|Graphics|USB Audio|Wi-?Fi|Wireless' } |
  Sort-Object DriverDate -Descending |
  Format-Table DeviceName, DriverProviderName, DriverVersion, DriverDate -AutoSize
```

Aus `lagebild.txt` (in `%TEMP%`) brauche ich vor allem „Bluescreens, unerwartete Neustarts und Treiber“ und „Windows Update“, dazu die Tabelle aus Teil 2. Die Datei enthält Rechner- und Benutzernamen, vor dem Weitergeben kurz drüberschauen. Speicherabbilder listet das Skript nur mit Adminrechten. Blockiert eine Richtlinie das Skript, sag Bescheid, dann gibt es eine Variante ohne Datei.

**Nächster Schritt**

Mit dem .sys-Namen den Treiber und die Dock-Firmware aktualisieren (Dell Command | Update oder Dells Treiberanleitung für Docks) oder einen frisch installierten Treiber zurücksetzen. Das ändert das System, ich sage vorher genau, was passiert und wie es zurückgeht. Annahme: Firmenlaptop, dann macht das deine IT. Nennen weder Foto noch Lagebild den Treiber, werten wir ein Abbild aus `C:\Windows\Minidump` mit WinDbg und `!analyze -v` aus (Zeile `IMAGE_NAME`); WinDbg installieren gibst du oder die IT frei.

**Was ich von dir brauche**

1. Die Ausgabe von oben.
2. Welches Dock genau (Modell steht unten drauf, z. B. WD19S, WD22TB4, D6000)? Und ist es dasselbe Dock am selben Platz wie vorher, oder hat sich gestern etwas geändert, etwa ein anderer Arbeitsplatz oder ein neuer Monitor?
3. Gab es auch Bluescreens, während er nicht gedockt war?

**Quellen**

- Microsoft Learn, Bug Check 0xD1: https://learn.microsoft.com/en-us/windows-hardware/drivers/debugger/bug-check-0xd1--driver-irql-not-less-or-equal
- Microsoft Q&A, „What failed: rtux64w10.sys“: https://learn.microsoft.com/en-us/answers/questions/4239635/stop-code-driver-irql-not-less-or-equal-what-faile
- Microsoft Q&A, Bluescreen durch rtu53cx22x64.sys am Dock: https://learn.microsoft.com/en-us/answers/questions/3857520/windows-11-bsod-caused-by-rtu53cx22x64-sys
- Dell, Treiberinstallation für Docks WD22TB4, WD19 und andere: https://www.dell.com/support/kbdoc/en-td/000128783/driver-installation-guide-for-dell-docking-station-wd19
- DisplayLink-Forum, Bluescreen durch dlkmd.sys: https://www.displaylink.org/forum/showthread.php?p=73031
- Microsoft Learn, Speicherabbild mit WinDbg auswerten: https://learn.microsoft.com/en-us/windows-hardware/drivers/debugger/analyzing-a-kernel-mode-dump-file-with-windbg
