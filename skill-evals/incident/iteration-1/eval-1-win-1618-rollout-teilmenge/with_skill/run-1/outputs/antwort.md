`INC-20260929-1040 | P3 | Windows-Software | wartet auf Nutzer | Rollout Notepad++ 8.8.5: 1618 auf 14 von 230 Clients`

**Einordnung**

P3: Die Auswirkung ist mittel, weil 14 von 230 Clients betroffen sind und dort laut dir weitergearbeitet werden kann. Vermutlich läuft auf ihnen die Vorversion weiter. Die Dringlichkeit ist ebenfalls mittel, denn das Ziel ist morgen und bis dahin trägt der jetzige Zustand. Eure eigenen Prioritätsregeln kenne ich nicht, deshalb habe ich nach der ITIL-Matrix eingestuft (Annahme). Falls Notepad++ auf den 14 ganz fehlt und dort gebraucht wird, stufe ich auf P2 hoch.

1618 ist `ERROR_INSTALL_ALREADY_RUNNING`. Windows Installer lässt nur eine Installation gleichzeitig zu, und auf diesen 14 Clients war er beim Paketlauf schon belegt. Auf 216 Clients ist das Paket durchgelaufen, grundsätzlich funktioniert es also. Gesucht ist, was die 14 gemeinsam haben und die anderen nicht. Ich arbeite in einer Cloud-Sitzung ohne Zugriff auf eure Clients und die Empirum-Konsole. Die Belege sammelst deshalb du, ich werte sie aus. Über eure Umgebung habe ich noch nichts gespeichert (der Gedächtnisordner fehlt).

**Sofortmaßnahme**

Solange alle arbeiten können, ist keine nötig. Stoß das Paket tagsüber nicht einfach neu an. Die Ursache ist noch offen, und wenn Notepad++ geöffnet ist, scheitert der Installer oft auf andere Weise.

**Hypothesen**

1. **Eine andere Installation lief im selben Zeitfenster**, zum Beispiel Windows Update/WSUS, ein anderes Empirum-Paket oder ein Agent- oder Virenscanner-Update. Daran erkennst du es: Im Lagebild des betroffenen Clients schließt ein MsiInstaller-Paar 1040/1042 mit einem anderen Produkt die Fehlerzeit ein, oder dort steht WindowsUpdateClient 43/19. Beim erfolgreichen Client fehlt das. In diesem Fall reicht es, die Installation heute Nacht zu wiederholen.
2. **Eine Installer-Transaktion hängt.** Im Abschnitt "Neustart ausstehend, laufende Installationen" steht ein `msiexec` mit `/i` oder `/x` und einem alten Startzeitpunkt (ein `msiexec /V` ist nur der Dienst). Oft steht dort auch ein ausstehender Neustart oder ein 1040 ohne passendes 1042. Dann scheitert auch eine Wiederholung, vorher ist ein Neustart nötig.
3. **Das Paket kollidiert mit sich selbst, aber nur bei abweichender Vorversion.** Ist euer Paket ein EXE-Installer, kommt die 1618 aus einem `msiexec`-Aufruf im Ablauf, meist aus der Deinstallation einer MSI-Vorversion. Daran erkennst du es: Unter "Installiert: Notepad++" zeigt der betroffene Client eine MSI-Vorversion (`MSI: True`) oder doppelte Einträge, der erfolgreiche nicht. Außerdem nennt die Empirum-Fehlerzeile den Deinstallationsschritt. Dann läuft die Deinstallation vermutlich noch, während die Installation schon startet. Das wird im Paket behoben, nicht auf den Clients.

**Was du jetzt tust (nur lesend)**

a) Vergleich in der Empirum-Konsole, die 14 gegen den Rest:
- Fehlerzeitpunkte: Liegen alle innerhalb weniger Minuten (spricht für 1) oder über die Nacht verteilt?
- Gemeinsamkeiten: Standort oder Depot, Gerätetyp, Windows-Build, weitere Pakete in derselben Nacht, inventarisierte Notepad++-Vorversion und woher sie stammt.

b) Lagebild von einem der 14 und von einem erfolgreichen Client, am besten mit gleichem Standort und Gerätetyp. Führe das von einem Admin-Rechner mit WinRM aus, und zwar in dem Ordner, in dem `windows-lagebild.ps1` aus dem Skill (`scripts\`) liegt:

```powershell
$seit = '2026-09-28 18:00'   # Annahme: vor Beginn des Rollout-Fensters, bei Bedarf anpassen
foreach ($pc in '<PC-mit-1618>', '<PC-erfolgreich>') {
    Invoke-Command -ComputerName $pc -FilePath .\windows-lagebild.ps1 -ArgumentList 'Notepad++', 48, $seit |
        Out-File "$env:TEMP\lagebild-$pc.txt" -Encoding utf8
}
```

Das Skript liest nur und ändert nichts. Ohne WinRM geht es direkt am Client als Administrator: `powershell -NoProfile -ExecutionPolicy Bypass -File .\windows-lagebild.ps1 -Software "Notepad++" -Seit "2026-09-28 18:00" -Ausgabe "$env:TEMP\lagebild.txt"`. In den Berichten stehen Rechner- und Benutzernamen. Schwärz sie vor dem Einfügen, wenn nötig.

Schick mir beide Dateien, mindestens aber diese Abschnitte: "Neustart ausstehend, laufende Installationen", "Windows Installer (MsiInstaller)", "Windows Update im Zeitraum", "Installiert: Notepad++" und "Softwareverteilung (Empirum): Notepad++". Im letzten stehen die Skriptkopie mit den `Call`- und `MsiExec`-Zeilen und die Fehlerzeile aus dem Paketprotokoll unter `C:\Windows\Temp`.

**Plan bis morgen**

- Heute: Belege auswerten und die Ursache festlegen.
- Heute Abend nach Arbeitsende: Das Paket nur den 14 erneut zuweisen, außerhalb eines Update-Fensters. Das ist ein Eingriff der Stufe 2, deshalb frage ich dich vorher mit genauer Aktion und dem Weg zurück. Bei Hypothese 2 kommt vorher ein Neustart, bei 3 erst die Paketkorrektur und ein Test auf einem der 14. Wenn das Paket Notepad++ dabei beendet, schreibe ich dir auf Wunsch eine kurze Info für die 14 Nutzer, damit sie abends speichern und schließen.
- Morgen früh prüfen: Die Konsole zeigt alle 14 ohne Fehler, und das Lagebild eines der Clients zeigt Notepad++ 8.8.5 genau einmal und keine neue 1618. Danach bekommst du den Tickettext.
- Dauerhaft als Change: Das Rollout-Fenster von Windows Update und anderen Paketen trennen oder das Paket bei 1618 warten und einmal wiederholen lassen. Pakete werden über den Skill `paketieren` korrigiert, der in dieser Sitzung nicht verfügbar ist. Die Änderung an der setup.inf bekommst du deshalb als Vorschlag, der Paketierlauf bleibt eine Folgeaufgabe.

**Was ich von dir brauche**

1. Die Fehlerzeile aus dem Empirum-Protokoll eines der 14, wörtlich (Form `<Meldung> ErrorLevel: 1618`). Scheitern alle 14 im selben Schritt?
2. Wann lief das Rollout-Fenster? War für diese Clients in derselben Nacht ein WSUS- oder Update-Fenster oder ein anderes Paket geplant?

**Nebenbefund**

- Notepad++ 8.8.5 stammt vom 14.08.2025. Aktuell ist 8.9.8.1 vom 24.09.2026, das laut Release Notes fünf Schwachstellen behebt. Erst ab 8.8.9 prüft der eingebaute Updater (WinGUp) Zertifikat und Signatur der Updates. Die Update-Infrastruktur des Projekts war von Juni bis Dezember 2025 kompromittiert. Solange es keine Anzeichen für eine Kompromittierung gibt, ist das kein Sicherheitsvorfall. Es sollte aber ein Change werden: eine aktuelle Version paketieren und den Updater im Paket abschalten, falls er aktiv ist.

**Quellen**

- Microsoft Learn, MsiExec-Fehlercodes (1618): https://learn.microsoft.com/en-us/windows/win32/msi/error-codes
- Microsoft Learn, _MSIExecute Mutex: https://learn.microsoft.com/en-au/windows/win32/msi/-msiexecute-mutex
- Notepad++ v8.8.5: https://notepad-plus-plus.org/news/v885-released/
- Notepad++ v8.9.8.1: https://notepad-plus-plus.org/news/v8981-released/
- Notepad++ zur kompromittierten Update-Infrastruktur: https://notepad-plus-plus.org/news/hijacked-incident-info-update/
