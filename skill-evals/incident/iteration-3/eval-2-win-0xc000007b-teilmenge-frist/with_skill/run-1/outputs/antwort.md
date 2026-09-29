`INC-20260929-1005 | P2 | Windows-Software | wartet auf Nutzer | LohnPro 12.4 startet seit Patchday-Rollout auf 3 PCs der Buchhaltung nicht (0xc000007b)`

**Einordnung**

P2: Auswirkung mittel (3 von 23 Plätzen einer Abteilung), Dringlichkeit hoch, weil die drei gar nicht abrechnen können. Eure eigenen Prioritätsregeln kenne ich nicht, eingestuft ist nach ITIL-Matrix (Annahme). Steht bis Mittwochfrüh kein tragfähiger Workaround, stufe ich wegen Donnerstag auf P1 hoch. Frühere Fälle dazu gibt es in meinem Journal nicht.

0xc000007b heißt: Windows lädt beim Start eine Datei, die nicht zum Programm passt, bei 32-Bit-Programmen fast immer eine 64-Bit-DLL, seltener eine beschädigte. Da LohnPro auf 20 PCs läuft, suche ich, was die drei seit gestern Abend anders haben.

**Sofort**

1. Die drei heute an funktionierenden Plätzen mit ihrer eigenen Anmeldung arbeiten lassen (freier Platz, Urlaubsvertretung, Terminalserver, falls vorhanden). Startet LohnPro dort, liegt die Ursache am Rechner und der Ausweichplatz trägt bis Donnerstag. Scheitert es auch dort, hängt es am Benutzerkonto, dann bitte gleich melden. Annahme: Lohndaten liegen zentral, die Lizenz hängt nicht am Platz.
2. In der Softwareverteilung (Annahme: Empirum) prüfen, ob die 20 funktionierenden PCs die Patchday-Pakete schon erfolgreich haben. Stehen dort noch PCs aus, etwa weil sie nachts aus waren, können genau die als Nächstes ausfallen. Dann die Zuweisung für die Buchhaltung anhalten, bis die Ursache klar ist. Deine Entscheidung, rückgängig durch erneutes Aktivieren.
3. Nichts auf Verdacht reparieren: keine DLLs von Download-Seiten, keine "All-in-One"-Laufzeitpakete, LohnPro nicht tagsüber neu verteilen, die drei PCs erst nach dem Lagebild neu starten (sonst ist ein ausstehender Neustart als Beleg weg).

**Diagnose: ein Block auf einem betroffenen PC, derselbe zum Vergleich auf einem funktionierenden**

In PowerShell in der Sitzung des Kollegen (Fernwartung), nicht als Admin. Die Skripte aus `scripts\` im Skill vorher in einen erreichbaren Ordner legen. Beide lesen nur.

```powershell
$s    = '<Ordner mit den beiden Skripten>'
$seit = '2026-09-28 16:00'   # Annahme: Rollout ab gestern Nachmittag, bei Bedarf anpassen
powershell -NoProfile -ExecutionPolicy Bypass -File "$s\windows-startcheck.ps1" -Programm 'LohnPro' -Seit $seit -Ausgabe "$env:TEMP\startcheck.txt"
powershell -NoProfile -ExecutionPolicy Bypass -File "$s\windows-lagebild.ps1" -Software 'LohnPro' -Seit $seit -Ausgabe "$env:TEMP\lagebild.txt"
```

Findet der Startcheck LohnPro nicht, bei `-Programm` den vollen Pfad zur EXE angeben. Die Berichte enthalten Rechner- und Benutzernamen, aber nichts aus LohnPro.

**Hypothesen und woran man sie erkennt**

- H1, neuer PATH-Eintrag: Ein Paket nur auf den dreien bringt einen Ordner mit 64-Bit-DLLs in den PATH. Im Startcheck unter "Probleme" `FALSCHE ARCHITEKTUR` mit Fundort `PATH: …`, und unter "PATH" ein Eintrag, der beim funktionierenden PC fehlt.
- H2, Visual-C++-Laufzeit x86 beschädigt oder unvollständig aktualisiert: `MSVCP140.dll` oder `VCRUNTIME140.dll` mit `FEHLT`, `DEFEKT` oder `FALSCHE ARCHITEKTUR`, oder unter "Installierte Visual-C++-Laufzeiten" fehlt die x86-Zeile.
- H3, Dateien im LohnPro-Ordner ersetzt (Update, Schnittstellen- oder Druckmodul): Abschnitt "Programmordner: andere Architektur oder kürzlich geändert" zeigt Dateien ab gestern Abend mit `x64` oder `DEFEKT`.
- H4, Rollout nicht sauber durchgelaufen, etwa abgebrochen, weil gleichzeitig Windows Update lief, oder Neustart ausstehend: im Lagebild "Neustart ausstehend" mit `True`, Fehler von MsiInstaller oder Windows Update im Zeitfenster, im Empirum-Protokoll `ErrorLevel` ungleich 0.

**Geprüft**

Zu LohnPro 12.4 finde ich öffentlich keine bekannten Probleme, zum Microsoft-Patchday vom 8.9.2026 keine zu 0xc000007b oder 32-Bit-Programmen. Haben die übrigen 20 nachweislich denselben Rollout, liegt die Ursache vermutlich in etwas, das nur die drei haben.

**Was ich von dir brauche**

1. `startcheck.txt` und `lagebild.txt` aus `%TEMP%` von einem betroffenen und einem funktionierenden PC, dazu das Ergebnis vom Ausweichplatz.
2. Die Paketliste des Rollouts mit Status je PC, für die drei und zwei, drei funktionierende.
3. Was haben die drei gemeinsam, was die anderen 20 nicht haben (Zusatzprogramm, Aufgabe, Gerätetyp)?

Damit grenze ich auf eine Ursache ein; korrigiert wird dann über die Softwareverteilung, nicht von Hand am Client. Wenn du willst, schreibe ich eine kurze Info für die drei und die Leitung der Buchhaltung (Ausweichplatz, Stand, nächste Info).

**Quellen**

- Microsoft, STATUS_INVALID_IMAGE_FORMAT (C000007B): https://learn.microsoft.com/en-us/archive/blogs/dsvc/diagnosing-status_invalid_image_format-c000007b-errors
- Microsoft, Windows release health: https://learn.microsoft.com/en-us/windows/release-health/
- Microsoft, offizielle Visual-C++-Laufzeiten: https://learn.microsoft.com/en-us/cpp/windows/latest-supported-vc-redist?view=msvc-170
