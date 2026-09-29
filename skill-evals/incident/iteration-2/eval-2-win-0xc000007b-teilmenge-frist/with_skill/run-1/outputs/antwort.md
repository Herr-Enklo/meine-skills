`INC-20260929-1005 | P2 | Windows-Software | wartet auf Nutzer | LohnPro startet seit Patchday-Rollout auf 3 von 23 Buchhaltungs-PCs nicht (0xc000007b)`

**Einordnung**
P2: Die Auswirkung ist mittel (3 von 23 Plätzen, aber genau die Lohnabrechnung), die Dringlichkeit hoch (die drei können gar nicht arbeiten, Abrechnung am Donnerstag). Eure Prioritätsregeln kenne ich nicht, die Einstufung ist deshalb eine Annahme. Gibt es bis Mittwochmorgen weder Workaround noch Lösung, stufe ich auf P1 hoch.

0xc000007b heißt STATUS_INVALID_IMAGE_FORMAT: Beim Start lädt LohnPro eine EXE oder DLL, die nicht zum 32-Bit-Prozess passt (meist eine 64-Bit-DLL) oder beschädigt ist. Da 20 Rechner mit demselben Rollout laufen, suchen wir, was bei den dreien anders ist. Einen bekannten Fehler der September-Updates zu 0xc000007b habe ich nicht gefunden, zu LohnPro 12.4 gibt es öffentlich nichts (Herstellerhinweise ungeprüft). Das Incident-Gedächtnis ist leer, der Ordner fehlt in dieser Sitzung.

**Sofortmaßnahme**
1. Workaround: Die drei arbeiten heute an Plätzen, an denen LohnPro startet, mit ihrer eigenen Anmeldung (freie Plätze, Kollegen in Pause oder Teilzeit, Terminalserver, falls es einen gibt). Startet LohnPro dort, können sie rechnen, und es ist belegt, dass es am Rechner liegt, nicht an Konto oder Profil. Ob LohnPro pro Platz lizenziert ist, weiß ich nicht, bitte kurz prüfen.
2. Die drei Rechner bis zur Klärung nicht neu aufsetzen und kein Paket erneut verteilen. Vor einem Neustart erst den Block unten laufen lassen, sonst sind Belege weg. Ein Rollback kommt erst in Frage, wenn das schuldige Paket feststeht, und nur nach Absprache.

**Hypothesen** (und woran man sie in der Ausgabe erkennt)
- H1, falsche DLL über den PATH: Ein Paket hat einen Ordner mit 64-Bit-DLLs in den PATH gehängt, Windows lädt von dort eine DLL, deren 32-Bit-Fassung fehlt. Im Startcheck steht unter "Probleme" `FALSCHE ARCHITEKTUR` mit Fundort `PATH: ...`, und im Abschnitt "PATH" ein Eintrag, den der funktionierende Rechner nicht hat.
- H2, Visual-C++-Laufzeit x86 beim Rollout entfernt oder beschädigt: Unter "Installierte Visual-C++-Laufzeiten" fehlt der x86-Eintrag oder die Version weicht vom Referenzrechner ab; im Lagebild MsiInstaller-Ereignisse zu Visual C++ mit Code ungleich 0.
- H3, Dateien im LohnPro-Ordner geändert oder defekt: Der Startcheck-Abschnitt "Programmordner" zeigt x64, `DEFEKT` oder ein Änderungsdatum nach Rollout-Beginn.
- H4, Rollout auf den dreien nur halb durch (Neustart ausstehend, Abbruch, 1618 durch Überschneidung mit Windows Update oder einem anderen Paket): Im Lagebild "Neustart ausstehend" mit Treffer, MsiInstaller 1033 mit Code ungleich 0 oder WindowsUpdateClient 20.

**Nächster Schritt**
Ich komme an eure Rechner nicht heran. Der Block liest nur und braucht die zwei Skripte aus dem Skill-Ordner (`scripts\`), etwa auf einer Freigabe. Zuerst auf einem der drei Rechner als der betroffene Benutzer (nicht als Admin) in PowerShell ausführen, dann denselben Block auf einem Buchhaltungsrechner, auf dem LohnPro startet:

```powershell
$skripte = "<Ordner mit windows-lagebild.ps1 und windows-startcheck.ps1>"
$seit    = "2026-09-28 16:00"   # Annahme: Beginn des Rollouts, bitte anpassen
$ziel    = "$env:TEMP\INC-20260929-1005_$env:COMPUTERNAME"
New-Item -ItemType Directory -Path $ziel -Force | Out-Null

# Warum startet LohnPro nicht: DLLs, Architektur, PATH, VC++-Laufzeiten, Startfehler-Ereignisse
powershell -NoProfile -ExecutionPolicy Bypass -File "$skripte\windows-startcheck.ps1" -Programm "LohnPro" -Seit $seit -Ausgabe "$ziel\startcheck.txt"

# Was lief seit dem Rollout: Installer, Windows Update, Neustart ausstehend, LohnPro-Installation
powershell -NoProfile -ExecutionPolicy Bypass -File "$skripte\windows-lagebild.ps1" -Software "LohnPro" -Seit $seit -Ausgabe "$ziel\lagebild.txt"

# Installierte Software zum Vergleich betroffen/funktionierend
Get-ItemProperty 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*',
                 'HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*',
                 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*' -ErrorAction SilentlyContinue |
  Where-Object DisplayName | Sort-Object DisplayName |
  Select-Object DisplayName, DisplayVersion, InstallDate, Publisher |
  Export-Csv "$ziel\software.csv" -NoTypeInformation -Encoding UTF8

explorer $ziel
```

Meldet der Startcheck "Programm nicht gefunden", statt `"LohnPro"` den vollen Pfad zur EXE aus der Verknüpfung eintragen. Blockiert eine Richtlinie die Skripte, sag Bescheid, dann schicke ich die Variante ohne Datei.

**Was ich von dir brauche**
1. Die Dateien aus beiden Ordnern `INC-20260929-1005_<Rechnername>` (sie enthalten Rechner- und Benutzernamen).
2. Was war im Rollout gestern Abend drin (nur Windows-Updates oder auch Visual-C++-Laufzeit, Java, Treiber, andere Software), wann lief er, und was zeigt die Konsole der Softwareverteilung für die drei Rechner im Vergleich zu den anderen: Status, Fehlerzeile wörtlich, Pakete, die nur die drei bekommen haben?
3. Fällt dir schon eine Gemeinsamkeit der drei auf, etwa gleiches Gerätemodell, gleiche Zusatzsoftware, oder dass LohnPro während des Rollouts geöffnet war?

Soll ich eine kurze Info für die drei Kollegen schreiben (was los ist und wo sie heute arbeiten können)?

Quellen:
- [Microsoft Learn: Diagnosing STATUS_INVALID_IMAGE_FORMAT (C000007B) Errors](https://learn.microsoft.com/en-us/archive/blogs/dsvc/diagnosing-status_invalid_image_format-c000007b-errors)
- [Microsoft Learn: Windows release health](https://learn.microsoft.com/en-us/windows/release-health/)
