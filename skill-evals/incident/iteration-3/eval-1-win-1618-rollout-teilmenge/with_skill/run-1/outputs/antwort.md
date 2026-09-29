`INC-20260929-1040 | P3 | Windows-Software | wartet auf Nutzer | Empirum-Rollout Notepad++ 8.8.5: Fehler 1618 auf 14 von 230 Clients`

**Einordnung:** P3: 14 von 230 betroffen, die Leute arbeiten weiter (Auswirkung mittel), Ziel ist morgen (Dringlichkeit mittel). Eure Prioritätsregeln kenne ich nicht, das ist eine Annahme; ein Journal früherer Fälle gibt es hier nicht.

1618 heißt ERROR_INSTALL_ALREADY_RUNNING: msiexec durfte nicht starten, weil auf dem Client gerade eine andere Windows-Installer-Installation lief. Das Paket selbst funktioniert, 216 Clients sind durch. Gesucht ist, was auf den 14 zur selben Zeit installierte.

Offen ist, welcher Schritt abgelehnt wurde. Ist das Paket nach euren Vorlagen gebaut, deinstalliert es erst die Vorversion und installiert dann neu. Scheiterte schon die Deinstallation, läuft auf den 14 die alte Version weiter und es bleibt P3. Scheiterte erst die Installation, fehlt Notepad++ dort ganz: dann P2 und Nachinstallation noch heute, abgesprochen mit den Leuten.

**Sofort:** Für die Nutzer nichts zu tun. Das Paket nicht jetzt tagsüber auf den 14 neu anstoßen und nicht neu an alle 230 zuweisen. Solange unklar ist, was blockiert, kommt wahrscheinlich wieder 1618, und bei geöffnetem Notepad++ scheitert der Installer oft auf andere Weise.

**Hypothesen** und woran du sie im Lagebild erkennst:

1. Andere Installation zur selben Zeit (anderes Paket, Windows Update, Selbstaktualisierer eines Programms): Unter „Windows Installer (MsiInstaller)“ schließen 1040 (Beginn) und 1042 (Ende) eines fremden Produkts die Fehlerzeit ein, oder unter „Windows Update im Zeitraum“ steht kurz davor eine 43. Dann reicht Wiederholen.
2. Hängender Installer: Unter „Neustart ausstehend, laufende Installationen“ steht ein msiexec mit /i oder /x und altem Startzeitpunkt (/V ist harmlos) oder InstallerUnterbrochen = True. Dann scheitert auch die Wiederholung bis zum Neustart.
3. Das Paket stört sich selbst, etwa weil die Deinstallation einer MSI-Vorversion noch läuft, wenn der nächste msiexec startet: Unter „Installiert: Notepad++“ stehen zwei Einträge oder ein MSI-Eintrag, anders als beim erfolgreichen Client, und 1040/1042 um die Fehlerzeit gehören zu Notepad++ selbst. Dann wird das Paket korrigiert, nicht der Client.

**Nächster Schritt:** In der Empirum-Konsole die Fehlerzeitpunkte der 14 ansehen. Liegen sie innerhalb weniger Minuten, spricht das für einen geplanten Job (1), verstreute Zeiten eher für 2 oder 3. Dann das Lagebild von zwei der 14 und einem erfolgreichen Client ziehen:

```powershell
# Auf deinem Admin-PC, mit einem Konto mit Adminrechten auf den Clients (WinRM). Nur lesend.
$skript  = '<Pfad zu meine-skills>\plugins\incident-manager\skills\incident\scripts\windows-lagebild.ps1'
$rechner = 'PC-FEHLER-1', 'PC-FEHLER-2', 'PC-OK-1'   # zwei der 14, ein erfolgreicher Client
foreach ($pc in $rechner) {
    Invoke-Command -ComputerName $pc -FilePath $skript -ArgumentList 'Notepad++', 48, '2026-09-28 18:00' |
        Out-File "$env:TEMP\lagebild-$pc.txt" -Encoding utf8
    "gespeichert: $env:TEMP\lagebild-$pc.txt"
}
```

Als Administrator statt als Benutzer passt hier, weil Empirum als SYSTEM installiert. Beginn 28.09. 18:00 ist angenommen, bei früherem Rollout vorziehen. Ohne WinRM: Skript auf den Client kopieren und dort als Administrator mit `-Software "Notepad++" -Seit "2026-09-28 18:00" -Ausgabe "$env:TEMP\lagebild.txt"` starten.

**Bis morgen:** Heute Ursache klären. Heute Nacht das Paket nur für die 14 erneut ausführen, nach deiner Freigabe: bei 1 außerhalb des Update-Fensters, bei 2 nach einem abendlichen Neustart, bei 3 erst nach Paketkorrektur. Erwartet: ErrorLevel 0 oder 3010. Fehlt Notepad++ danach, die Vorversion über Empirum zuweisen. Morgen früh gilt als gelöst: alle 14 in der Konsole ohne Fehler, und im Lagebild eines der 14 unter „Installiert: Notepad++“ genau ein Eintrag 8.8.5.

**Was ich von dir brauche:**

1. Die drei Dateien `lagebild-<PC>.txt`. Sie enthalten Rechner- und Benutzernamen; schwärze, was du nicht teilen willst.
2. Die Empirum-Fehlerzeile eines der 14 wörtlich (`… ErrorLevel: 1618`), falls sie nicht schon unter „Softwareverteilung (Empirum)“ im Lagebild steht.
3. Aus der Konsole für die 14 den Fehlerzeitpunkt und die anderen Jobs derselben Nacht.

Sollen die 14 nachts an bleiben oder Notepad++ abends geschlossen sein, schreibe ich dir eine kurze Info an die Betroffenen. Folgeaufgabe: im Paket bei 1618 warten und einmal wiederholen, Rollout-Fenster nicht mit Windows Update überlappen lassen.

Nebenbefund: 8.8.5 ist veraltet (aktuell 8.9.8.1 vom 24.09.2026, dazwischen Sicherheitskorrekturen, etwa CVE-2026-25926, behoben ab 8.9.2). Das ist ein Change, kein Sicherheitsvorfall; die 14 erst auf 8.8.5 bringen.

Quellen:
- Microsoft, MsiExec.exe error messages (1618): https://learn.microsoft.com/en-us/windows/win32/msi/error-codes
- CVE-2026-25926: https://www.cvedetails.com/cve/CVE-2026-25926/
- Notepad++ v8.9.8.1: https://notepad-plus-plus.org/news/v8981-released/
