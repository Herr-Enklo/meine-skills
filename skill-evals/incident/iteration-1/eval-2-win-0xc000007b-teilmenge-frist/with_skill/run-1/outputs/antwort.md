`INC-20260929-1005 | P2 | Windows-Software | wartet auf Nutzer | LohnPro startet nicht (0xc000007b) auf 3 von 23 Rechnern nach Patchday`

**Einordnung**

- P2: Auswirkung mittel (drei Personen, aber die Lohnabrechnung ist geschäftskritisch), Dringlichkeit hoch (die drei können gar nicht rechnen). Eure eigenen Prioritätsregeln kenne ich nicht, das ist meine Einstufung nach der üblichen Matrix (Annahme).
- Frist Donnerstag: Greift der Ausweich-Arbeitsplatz unten nicht und ist bis Mittwochfrüh keine Lösung da, stufe ich auf P1 hoch. Dasselbe gilt, wenn weitere Rechner ausfallen.
- 0xc000007b heißt STATUS_INVALID_IMAGE_FORMAT: Windows kann beim Start eine Programmdatei nicht laden. Bei einem 32-Bit-Programm ist das meist eine DLL in 64-Bit-Fassung oder eine beschädigte DLL.
- 20 von 23 laufen nach demselben Rollout (Annahme: alle 23 haben ihn bekommen). Das Update ist also nicht generell kaputt. Die Frage ist, was die drei anders haben oder was bei ihnen während des Rollouts anders gelaufen ist.
- Weitere Annahmen: LohnPro ist lokal auf den Clients installiert (kein Terminalserver), Windows 64-Bit. Ein Journal früherer Incidents gibt es in dieser Cloud-Sitzung nicht.

**Sofortmaßnahme**

1. Eine der drei meldet sich mit ihrem eigenen Konto an einem Rechner an, auf dem LohnPro läuft (freier Platz, Ersatz- oder Schulungsgerät), und startet LohnPro.
   - Startet es, arbeiten die drei bis zur Lösung dort, damit ist Donnerstag abgesichert. Außerdem wissen wir dann, dass die Ursache am Rechner liegt.
   - Startet es dort auch nicht, liegt die Ursache am Benutzerkonto oder Profil (H5). Dann bitte gleich Bescheid geben.
2. An den drei Rechnern bis zum Lagebild nichts reparieren, neu installieren oder neu starten, sonst sind die Spuren weg. Zeigt das Lagebild danach einen ausstehenden Neustart, ist ein Neustart des Rechners der erste billige Versuch (Stufe 2, die Person speichert vorher ihre Arbeit; erwartet: der Rollout wird fertig und LohnPro startet; ein Weg zurück ist nicht nötig).

**Hypothesen und woran du sie in der Ausgabe erkennst**

- **H1 PATH:** Ein Programm oder Paket hat auf den drei Rechnern einen Ordner mit 64-Bit-DLLs in den PATH eingetragen, und LohnPro lädt von dort eine DLL, die es nicht selbst mitbringt. Im Startcheck steht unter „Probleme“ `FALSCHE ARCHITEKTUR (Programm ist x86)` mit Fundort `PATH: …`, und diesen Eintrag hat der funktionierende Rechner nicht oder weiter hinten.
- **H2 Laufzeit:** Die x86-Fassung einer Laufzeitumgebung, meist Visual C++, ist beim Rollout auf den drei Rechnern nicht sauber durchgelaufen, zum Beispiel weil gleichzeitig eine andere Installation lief. Im Startcheck steht dann `FEHLT`, `DEFEKT` oder falsche Architektur bei `MSVCP140.dll` bzw. `VCRUNTIME140*.dll` mit Fundort `SysWOW64`, oder unter „Installierte Visual-C++-Laufzeiten“ fehlt x86. Im Lagebild findet sich MsiInstaller 1033 mit Fehlercode oder 11708.
- **H3 Programmordner:** Im LohnPro-Ordner ist eine Datei durch eine andere Architektur ersetzt worden oder beschädigt. Das zeigt der Startcheck unter „Programmordner: andere Architektur oder kürzlich geändert“ mit Dateien ab gestern Mittag oder als `DEFEKT`.
- **H4 Rollout unvollständig:** Auf den drei Rechnern ist der Patchday nicht fertig geworden. Im Lagebild steht dann `True` unter „Neustart ausstehend“, WindowsUpdateClient 20 oder „mit Fehlern“ im Updateverlauf, oder der Build (UBR) weicht vom funktionierenden Rechner ab.
- **H5 Benutzerkonto:** Die Ursache liegt im Profil, zum Beispiel in einem PATH-Eintrag, der nur für den Benutzer gilt. Dann scheitert der Ausweich-Test aus Schritt 1, und im Lagebild stehen PATH-Zeilen mit `User`, die der funktionierende Rechner nicht hat.

**Befehlsblock**

Einmal auf einem betroffenen und zum Vergleich auf einem funktionierenden Rechner der Abteilung laufen lassen, jeweils in der Sitzung der dort angemeldeten Person (etwa per Fernwartung), nicht unter deinem Admin-Konto. Der Block liest nur und ändert nichts, Laufzeit ein bis zwei Minuten. Die beiden Skripte liegen im Skill-Ordner unter `skills/incident/scripts/` und müssen vorher auf den Rechner oder eine IT-Freigabe kopiert werden.

```powershell
$s = 'C:\Temp\INC-20260929-1005'   # Ordner mit windows-lagebild.ps1 und windows-startcheck.ps1
$n = $env:COMPUTERNAME
powershell -NoProfile -ExecutionPolicy Bypass -File "$s\windows-lagebild.ps1" -Software 'LohnPro' -Seit '2026-09-28 12:00' -Ausgabe "$env:TEMP\lagebild-$n.txt"
powershell -NoProfile -ExecutionPolicy Bypass -File "$s\windows-startcheck.ps1" -Programm 'LohnPro' -Seit '2026-09-28 12:00' -Ausgabe "$env:TEMP\startcheck-$n.txt"
Get-ItemProperty 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*','HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*','HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*' -ErrorAction SilentlyContinue |
  Where-Object DisplayName | Sort-Object InstallDate -Descending |
  Select-Object InstallDate, DisplayName, DisplayVersion, Publisher | Format-Table -AutoSize | Out-String -Width 250 | Out-File "$env:TEMP\software-$n.txt"
```

- Hat der Rollout vor 12:00 begonnen, bitte die Zeit vorziehen.
- Meldet der Startcheck „Programm nicht gefunden“ oder startet LohnPro von einem Netzlaufwerk, bei `-Programm` den vollen Pfad der EXE aus der Verknüpfung angeben. Liegt die EXE für alle auf demselben Netzlaufwerk, kann H3 praktisch nicht die Ursache sein.
- Blockiert eine Richtlinie die Skripte, sag Bescheid. Dann schicke ich dir die Variante ohne Datei.

**Geprüft**

- 0xc000007b ist laut Microsoft-Referenz [MS-ERREF] STATUS_INVALID_IMAGE_FORMAT („Bad Image“). Microsoft nennt als typischen Fall eine DLL, deren Architektur nicht zum Prozess passt.
- Zu LohnPro 12.4 habe ich öffentlich weder Herstellerhinweise noch bekannte Fehler mit 0xc000007b gefunden.
- Falls euer Patchday das Windows-11-Update vom September enthielt (KB5124008 für 24H2/25H2): In den Übersichten zu dessen bekannten Problemen, die ich gefunden habe, kommt 0xc000007b bei Anwendungen nicht vor. Die Release-Health-Seite selbst habe ich nicht vollständig gelesen, das ist also ungeprüft.

**Nächster Schritt**

Mit den Dateien beider Rechner vergleiche ich im Startcheck „Probleme“ und „PATH“, außerdem Neustart- und Updatezustand und die Softwareliste. Die Lösung ist dann meist klein und für alle drei gleich, etwa einen PATH-Eintrag korrigieren, die x86-Laufzeit über die Softwareverteilung reparieren oder den Neustart bzw. das Update nachziehen. Jede Änderung stimme ich vorher mit dir ab, mit erwarteter Wirkung und Weg zurück.

**Was ich von dir brauche**

1. Wie der Ausweich-Test aus Schritt 1 ausgegangen ist.
2. Die Dateien `lagebild-*.txt`, `startcheck-*.txt` und `software-*.txt` aus `%TEMP%` von beiden Rechnern. Sie enthalten Rechner- und Benutzernamen, bitte vor dem Weitergeben kurz durchsehen.
3. Was war im Patchday-Rollout enthalten, nur Windows-Updates oder auch Softwarepakete wie Laufzeiten, Treiber oder Tools? Zeigt eure Softwareverteilung für die drei Rechner etwas anderes als für die 20 (zusätzliches Paket, Fehlerstatus, Neustart offen)? Wenn dir sonst etwas einfällt, das nur die drei gemeinsam haben, schreib es gleich dazu.

**Nutzerinfo für die drei, falls du sie brauchst**

```
Betreff: LohnPro – an drei Arbeitsplätzen gestört

Was ist los: Seit dem Update gestern Abend startet LohnPro an drei Arbeitsplätzen in der Buchhaltung nicht. Die übrigen Arbeitsplätze sind nicht betroffen.
Was wir tun: Die IT sucht die Ursache mit Vorrang, damit die Abrechnung am Donnerstag steht.
Was Sie tun können: LohnPro bis auf Weiteres an <Ausweich-Arbeitsplatz> mit Ihrer eigenen Anmeldung nutzen. Am eigenen Rechner bitte nichts neu installieren oder reparieren.
Nächste Information: heute bis <Uhrzeit>
```

Nebenbefund: Für KB5124008 werden andere Probleme berichtet, etwa der Verlust der Vertrauensstellung zur Domäne bei Credential Guard und USB-Audiogeräte mit Code 10. Falls ihr das Update ausgerollt habt und solche Meldungen kommen, hängt es damit zusammen.

**Quellen**

- [MS-ERREF: NTSTATUS Values (Microsoft Learn)](https://learn.microsoft.com/en-us/openspecs/windows_protocols/ms-erref/596a1078-e883-4972-9bbc-49e60bebca55)
- [Diagnosing STATUS_INVALID_IMAGE_FORMAT (C000007B) Errors (Microsoft Learn, Archiv)](https://learn.microsoft.com/en-us/archive/blogs/dsvc/diagnosing-status_invalid_image_format-c000007b-errors)
- [KB5124008, 8. September 2026 (Microsoft Support)](https://support.microsoft.com/en-us/servicing/os/windows-11/2026/09/kb5124008-windows-11-24h2-25h2-security-update)
- [Windows 11 KB5124008 update breaks domain trust for some users (BleepingComputer)](https://www.bleepingcomputer.com/news/microsoft/windows-11-kb5124008-update-breaks-domain-trust-for-some-users/)
- [KB5124008 Breaks USB Audio and More in Windows 11 (SecurityOnline)](https://securityonline.info/kb5124008-windows-11-issues/)
