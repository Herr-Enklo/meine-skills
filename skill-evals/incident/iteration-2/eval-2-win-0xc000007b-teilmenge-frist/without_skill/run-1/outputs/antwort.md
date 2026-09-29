Das ist dringend, lässt sich aber gut eingrenzen. 20 von 23 Rechnern laufen mit denselben Patches. Die Ursache liegt also sehr wahrscheinlich nicht im Patch selbst, sondern an etwas, das diese drei Rechner (oder Benutzer) von den anderen unterscheidet und erst durch den Patchday aufgefallen ist.

**Priorität: hoch.** Die Lohnabrechnung hat eine feste Frist am Donnerstag, und drei Anwender können nicht arbeiten. Deshalb laufen zwei Dinge parallel: zuerst die Leute wieder arbeitsfähig machen, dann die Ursache suchen.

## 1. Sofort: Arbeitsfähigkeit herstellen (heute Vormittag)

- **Die drei an funktionierenden Rechnern arbeiten lassen:** freie Plätze, Plätze von Kollegen im Urlaub oder in Teilzeit, ein Ersatzgerät oder versetzte Arbeitszeiten an einem Kollegen-PC. Falls es LohnPro auch auf einem Terminalserver gibt, geht es natürlich auch dort.
- **Dabei gleich testen:** Startet LohnPro, wenn sich ein Betroffener an einem funktionierenden Rechner anmeldet? Wenn ja, liegt es am Rechner und der Platzwechsel ist euer Workaround. Wenn nein, liegt es am Benutzerprofil (z. B. an der Benutzer-PATH-Variable). Dann hilft der Platzwechsel nicht und die Diagnose unten fängt bei 3c an.
- **Lizenz prüfen:** Falls LohnPro an Arbeitsplätze gebunden lizenziert ist, kurz klären, ob der Platzwechsel so geht.
- **Ticket beim LohnPro-Hersteller jetzt aufmachen** und den Abrechnungstermin nennen. Der Hersteller kennt die DLL-Abhängigkeiten seines Programms und weiß vielleicht schon von Problemen mit den aktuellen Updates.

## 2. Was der Fehler bedeutet

0xc000007b heißt `STATUS_INVALID_IMAGE_FORMAT`. Windows bricht den Start ab, weil das 32-Bit-Programm beim Laden an eine DLL mit der falschen Architektur gerät (meist eine 64-Bit-DLL) oder an eine beschädigte DLL. Typische Ursachen:

- Das **Visual C++ Redistributable (x86)** ist beschädigt oder wurde bei einer Installation überschrieben.
- Die **PATH-Variable** zeigt auf einen Ordner mit gleichnamigen 64-Bit-DLLs, und Windows findet diese zuerst. Typische Kandidaten sind Datenbank-Clients (Oracle, Firebird, PostgreSQL) oder OpenSSL-DLLs, die andere Programme mitbringen.
- Eine Aktualisierung ist **nicht vollständig installiert** (Neustart steht noch aus), oder eine Systemdatei in `SysWOW64` ist beschädigt.

Bei einer kurzen Suche habe ich für die September-Updates kein bekanntes Problem mit 0xc000007b gefunden. Das passt dazu, dass 20 Rechner problemlos laufen.

## 3. Diagnose auf einem betroffenen Rechner (die schnellen Schritte zuerst)

**a) Neustart und Vergleich (5 Minuten)**

Einmal richtig neu starten, also „Neu starten“ und nicht „Herunterfahren“, das wegen des Schnellstarts nicht ganz neu startet. Danach auf einem betroffenen und einem funktionierenden Rechner in PowerShell prüfen:

```powershell
# Zuletzt installierte Windows-Updates
Get-HotFix | Sort-Object InstalledOn -Descending | Select-Object -First 10

# Was sonst seit dem Wochenende installiert wurde
Get-ItemProperty HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*,
                 HKLM:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\* |
  Where-Object { $_.InstallDate -ge '20260927' } |
  Select-Object DisplayName, DisplayVersion, InstallDate
```

Die entscheidende Frage ist, was die drei gemeinsam haben und die anderen 20 nicht. Das kann ein anderes Gerätemodell sein, zusätzliche Software oder eine andere Gruppe in der Softwareverteilung. Wurden am Patchday außer den Windows-Updates auch andere Pakete verteilt (VC++, Java, Office, Datenbank-Client, Treiber)?

**b) Visual C++ Redistributables (x86) reparieren (10 Minuten, hilft am häufigsten)**

```powershell
Get-ItemProperty HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*,
                 HKLM:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\* |
  Where-Object DisplayName -like '*Visual C++*' |
  Select-Object DisplayName, DisplayVersion | Sort-Object DisplayName
```

Die Liste mit der eines funktionierenden Rechners vergleichen. Dann unter „Einstellungen > Apps > Installierte Apps“ bei „Microsoft Visual C++ 2015-2022 Redistributable (x86)“ auf „Ändern“ und dann auf „Reparieren“ gehen. Dasselbe bei älteren x86-Versionen machen, die LohnPro braucht. Fehlende x86-Pakete von Microsoft nachinstallieren. Danach neu starten und testen.

**c) PATH vergleichen (5 Minuten)**

```powershell
[Environment]::GetEnvironmentVariable('Path','Machine') -split ';'
[Environment]::GetEnvironmentVariable('Path','User') -split ';'
```

Auch hier mit einem funktionierenden Rechner vergleichen. Verdächtig sind neue oder weit vorne stehende Einträge von Datenbank-Clients, Java, Python oder Scan- und Drucksoftware. Zum Testen den verdächtigen Eintrag vorübergehend entfernen oder ans Ende schieben, neu anmelden und LohnPro starten.

**d) Die fehlerhafte DLL direkt finden (15 bis 20 Minuten)**

Wenn a bis c nichts ergeben, ist das der sicherste Weg: [Process Monitor](https://learn.microsoft.com/de-de/sysinternals/downloads/procmon) auf dem betroffenen Rechner starten, den Filter „Process Name is LohnPro.exe“ setzen und LohnPro starten, bis die Fehlermeldung kommt. Dann die letzten Zugriffe auf `.dll`-Dateien vor dem Prozessende ansehen. Eine DLL aus einem ungewöhnlichen Ordner ist fast immer die Ursache, zum Beispiel aus `C:\Windows\System32` statt `SysWOW64` oder aus einem fremden Programmordner im PATH.

**e) Systemdateien und LohnPro selbst**

In einer Eingabeaufforderung als Administrator:

```
DISM /Online /Cleanup-Image /RestoreHealth
sfc /scannow
```

Danach kommt bei Bedarf eine Reparaturinstallation von LohnPro. Vorher mit dem Hersteller klären, wo die Mandantendaten liegen, damit dabei nichts verloren geht.

**f) Ein Update zurücknehmen, nur als Test**

Wenn ein bestimmtes Paket unter Verdacht steht, es auf **einem** der drei Rechner deinstallieren und testen. Windows-Sicherheitsupdates nimmt man nur bewusst und befristet zurück. Das gehört dokumentiert, und die Softwareverteilung muss so eingestellt sein, dass sie das Update nicht sofort wieder installiert.

## 4. Zeitplan bis Donnerstag

- **Heute Vormittag:** Der Workaround steht und das Hersteller-Ticket ist offen.
- **Heute im Lauf des Tages:** Schritte a bis d auf einem betroffenen Rechner. Sobald die Lösung gefunden ist, auf die anderen zwei übertragen.
- **Mittwoch Mittag:** Entscheidung. Ist es bis dahin nicht gelöst, bleibt der Workaround bis nach der Abrechnung, oder die drei Rechner werden neu aufgesetzt. Am Donnerstagmorgen nicht mehr an den Rechnern herumprobieren.
- Falls der Patchday noch in weiteren Wellen läuft, prüfen, ob dort LohnPro-Rechner mit derselben Besonderheit dabei sind.

## Damit ich gezielter helfen kann

1. Welche Windows-Version läuft, und womit verteilt ihr Updates (WSUS, Intune, Empirum …)?
2. Wurden am Patchday nur Microsoft-Updates verteilt oder auch andere Pakete?
3. Was kam beim Test heraus, als sich ein Betroffener an einem funktionierenden Rechner angemeldet hat?
4. Bitte die Ausgabe der Befehle aus a) bis c) von einem betroffenen und einem funktionierenden Rechner schicken, oder das Ergebnis aus Process Monitor.
5. Braucht LohnPro einen lokal installierten Datenbank-Client?

Quelle zu bekannten Update-Problemen: [Windows release health (Microsoft)](https://learn.microsoft.com/en-us/windows/release-health/)
