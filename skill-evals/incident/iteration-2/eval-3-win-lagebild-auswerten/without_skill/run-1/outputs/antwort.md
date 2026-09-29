Danke für die Ausgabe, damit lässt sich viel anfangen. Das sind zwei getrennte Probleme, und eins davon hat Vorrang:

- **Die Abstürze** kommen sehr wahrscheinlich von einem Plugin, das heute um 06:38 neu im Notepad++-Ordner aufgetaucht ist und keine Signatur hat. Um 07:00 hat Defender außerdem eine `plugin.dll` in deinem Downloads-Ordner als Trojaner erkannt, und zwar beim Zugriff durch Notepad++. Das behandle ich als möglichen Sicherheitsvorfall, bis jemand das Gegenteil geklärt hat.
- **Das Empirum-Update** ist an Fehler 1618 gescheitert: Zur gleichen Zeit lief eine andere Installation. Das ist ärgerlich, aber harmlos.

## Bitte jetzt gleich

1. **Notepad++ schließen.** Es läuft seit 08:03 wieder (Prozess 14320) und hat das Plugin vermutlich geladen.
2. **Nichts selbst aufräumen:** die `plugin.dll` nicht aus der Quarantäne holen, keine Dateien löschen, den Rechner nicht herunterfahren oder neu starten. Die Spuren braucht die Prüfung noch.
3. **IT-Sicherheit bzw. euren Admin informieren** und ihnen diese Diagnoseausgabe mitgeben. Wenn es bei euch eine Regel für Schadsoftwareverdacht gibt (oft: Netzwerkkabel ziehen, Rechner eingeschaltet lassen), dann gilt die.
4. **Zum Weiterarbeiten** bis zur Klärung den Windows-Editor nehmen. Sobald die Sicherheit den Rechner freigibt und du Notepad++ vor der Bereinigung brauchst, kannst du es mit `notepad++.exe -noPlugin` starten. Dann lädt es keine Plugins, und die Abstürze sollten weg sein.

## Was heute passiert ist

| Zeit | Ereignis |
|---|---|
| 02:06, 02:37 | Druckwarteschlange zweimal abgestürzt (Nebenbaustelle, siehe unten) |
| 03:03 | Windows-Update KB5030000 scheitert mit 0x80073712 |
| 04:02 bis 04:14 | Eine andere MSI-Installation läuft (`C:\Windows\Temp\Anderes.msi`) |
| 04:08 | Empirum will Notepad++ 8.8.5 installieren: Fehler 1618 |
| 06:35 | Ein Programm `Tool.exe` stürzt ab (.NET, Datei nicht gefunden) |
| 06:38 | `plugins\NppPlugin\NppPlugin.dll` erscheint im Notepad++-Ordner, nicht signiert |
| 07:00 | Defender findet `Trojan:Win32/Wacatac.B!ml` in `Downloads\plugin.dll`, Prozess notepad++.exe, in Quarantäne verschoben |
| 07:01 | Notepad++ stürzt ab, Modul ntdll.dll, 0xc0000005 |
| 08:02 | Notepad++ stürzt ab, Modul **NppPlugin.dll**, 0xc0000005 |
| 08:03 | Notepad++ wieder gestartet, läuft noch |

## Die Abstürze

Der Absturz um 08:02 nennt `NppPlugin.dll` direkt als fehlerhaftes Modul. Die Datei hat Version 1.0.0.0, keine Signatur und ist seit 06:38 da, also kurz bevor die Abstürze anfingen. Der Absturz um 07:01 in ntdll.dll mit derselben Zugriffsverletzung passt dazu, weil ein fehlerhaftes Plugin oft Speicher beschädigt und Windows den Fehler dann erst in ntdll bemerkt. Das Update auf 8.8.5 halte ich als Ursache für weniger wahrscheinlich, ganz ausschließen kann ich es wegen des halbfertigen Update-Stands (siehe unten) aber nicht.

Warum ich das nicht als normales Plugin-Problem abtue:

- `Wacatac.B!ml` ist eine Erkennung per maschinellem Lernen, die auch bei harmlosen, unsignierten DLLs anschlagen kann. Allein wäre das kein Beweis.
- Du hast laut Bericht keine Administratorrechte. Nach `C:\Program Files` kann ein normaler Benutzer nicht schreiben. Die DLL hat also etwas mit höheren Rechten dort abgelegt, oder die Berechtigungen auf dem Ordner sind aufgeweicht. Beides muss geklärt werden.
- Drei Minuten vorher ist `Tool.exe` abgestürzt, und das kann ich keinem Programm zuordnen.
- Auf PC01 läuft ein Dienst **NppUpdater** als LocalSystem (`gup.exe -service`). Notepad++ bringt meines Wissens keinen Dienst mit, der Updater gup.exe wird normalerweise von Notepad++ selbst beim Start aufgerufen. Falls euer Empirum-Paket diesen Dienst nicht anlegt, gehört er mit in die Prüfung.
- Hintergrund: 2025 haben Angreifer den Update-Weg von Notepad++ gezielt missbraucht, um manipulierte Dateien auszuliefern. Erst ab Version 8.8.9 prüft der Updater Zertifikat und Signatur. Auf PC01 sind 8.8.4 und 8.8.5 installiert, beide älter. Ob das hier eine Rolle spielt, lässt sich aus dem Bericht nicht ablesen. Es ist aber ein Grund mehr, genau hinzuschauen.

Was die Sicherheit bzw. der Admin prüfen sollte (braucht Adminrechte):

- Hash von `C:\Program Files\Notepad++\plugins\NppPlugin\NppPlugin.dll` (`Get-FileHash`) mit dem Defender-Fund vergleichen (`Get-MpThreatDetection`). Ist es dieselbe Datei wie die `plugin.dll` aus Downloads?
- Vollscan mit Defender, mindestens aber den Notepad++-Ordner und deinen Downloads-Ordner scannen.
- Woher die DLL kommt: Rechte auf dem Ordner (`icacls "C:\Program Files\Notepad++\plugins"`), wann und von wem der Dienst NppUpdater angelegt wurde (System-Ereignis 7045), und was `Tool.exe` ist und wo es liegt.
- Erst danach den Plugin-Ordner entfernen.

## Das Empirum-Update

Die Ursache ist eindeutig. ErrorLevel 1618 heißt „Eine andere Installation wird bereits ausgeführt“. Das Lagebild zeigt auch, welche: Von 04:02 bis 04:14 lief eine Installer-Transaktion für `Anderes.msi`, und genau in diesem Fenster um 04:08 wollte Empirum Notepad++ installieren. Ein Zeitproblem, kein Fehler im Paket. Der msiexec-Prozess mit `/V`, der noch läuft, ist nur der Installer-Dienst, da hängt nichts mehr.

Sauber ist der Stand trotzdem nicht:

- In der Softwareliste stehen zwei Einträge: Notepad++ 8.8.4 als klassische exe-Installation (64-Bit, mit `uninstall.exe`) und Notepad++ 8.8.5 als MSI (installiert am 28.09., ohne Installationsort).
- Im Programmordner ist `notepad++.exe` schon Version 8.8.5 (geändert 28.09., 22:05), `SciLexer.dll` aber noch 8.8.4.
- Zusätzlich zu Empirum aktualisiert sich Notepad++ selbst: Es gibt die geplante Aufgabe „Notepad++ Update“ (`gup.exe -silent`, zuletzt am 28.09. mit 0x80070002 „Datei nicht gefunden“) und den Dienst NppUpdater.

Das ist ein halb aktualisierter Stand aus zwei Installationsarten. Wie genau er am 28.09. entstanden ist, zeigt der Bericht nicht, zwei parallele Update-Wege führen aber typischerweise zu so etwas. Vorschlag für den Empirum-Admin, sobald die Sicherheitsfrage geklärt ist:

1. Notepad++ vollständig entfernen (beide Einträge), dann neu verteilen.
2. Eine aktuelle Version paketieren statt 8.8.5, also mindestens eine mit dem gehärteten Updater.
3. Den eingebauten Updater im Paket abschalten, damit nur noch Empirum aktualisiert.
4. Das Paket vorher die alte exe-Installation entfernen lassen, sonst gibt es wieder zwei Einträge.
5. Für 1618 eine Wiederholung einplanen oder den Job so legen, dass er nicht mit anderen MSI-Jobs zusammenfällt.

## Weitere Baustellen auf PC01

Diese Punkte verursachen deine Abstürze nicht, sollten aber mit erledigt werden:

- **Laufwerk C: ist fast voll:** 5 GB frei von 256 GB, also 2 %. Damit scheitern Updates und Installationen früher oder später sowieso. Das zuerst beheben.
- **Windows Update:** KB5030000 ist mit 0x80073712 gescheitert, das heißt, der Komponentenspeicher ist beschädigt oder es fehlen Dateien darin. Laut Build 22631.4169 steht der Rechner auf dem Patchstand von September 2024, hat also lange keine kumulativen Updates mehr bekommen. Außerdem bekommt Windows 11 23H2 Enterprise nur noch bis zum 10.11.2026 Sicherheitsupdates. Für den Admin, nach Freigabe durch die Sicherheit: Platz schaffen, neu starten (ein Neustart für Windows Update steht aus, der Rechner läuft seit 12 Tagen), dann `DISM /Online /Cleanup-Image /RestoreHealth` und `sfc /scannow`, danach das Update erneut. Den Umstieg auf eine neuere Windows-Version bald einplanen.
- **Druckwarteschlange:** heute Nacht zweimal abgestürzt, steht jetzt (Exitcode 1067). Drucken geht vermutlich gerade nicht. Häufige Ursache ist ein Druckertreiber, das wäre ein eigenes Ticket.
- **LohnPro.exe** ließ sich gestern um 13:38 nicht starten (0xc000007b, typisch bei einer 32-/64-Bit-Mischung von DLLs oder fehlenden Laufzeitbibliotheken). Falls das noch auftritt, ebenfalls ein eigenes Ticket.
- Unauffällig sind Netzwerk, Proxy und Arbeitsspeicher. Auch die CPU-Zeit von Defender (rund 90 Minuten über 12 Tage) ist normal.

## Drei Fragen an dich

1. Hast du heute früh selbst eine `plugin.dll` heruntergeladen oder versucht, ein Plugin zu installieren? Wenn ja, von wo?
2. Weißt du, was `Tool.exe` ist?
3. Hat heute früh jemand anderes an PC01 gearbeitet, etwa ein Admin oder per Fernwartung?

Mit den Antworten kann die Sicherheit schneller einschätzen, ob das ein Fehlalarm war oder mehr dahintersteckt.

Quellen:
- [Microsoft: KB5043076, OS Build 22631.4169 (10.09.2024)](https://support.microsoft.com/en-us/topic/september-10-2024-kb5043076-os-builds-22621-4169-and-22631-4169-215aad1e-3f3f-44bd-9868-91a2bd450a07)
- [Microsoft Q&A: Supportende Windows 11 23H2](https://learn.microsoft.com/en-us/answers/questions/5654535/hat-last-secure-date-for-using-windows-11-23h2)
- [Notepad++ Handbuch: Kommandozeile (-noPlugin)](https://github.com/notepad-plus-plus/npp-usermanual/blob/master/content/docs/command-prompt.md)
- [Notepad++: Hijacked Incident Info](https://notepad-plus-plus.org/news/hijacked-incident-info-update/)
- [Notepad++ v8.8.9: Vulnerability-fix](https://notepad-plus-plus.org/news/v889-released/)
