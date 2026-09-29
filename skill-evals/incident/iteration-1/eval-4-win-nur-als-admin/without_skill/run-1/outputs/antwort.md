Nein, gib ihm keine lokalen Adminrechte. Das Problem ist eine einzelne Datei, in die er nicht schreiben darf. Das behebst du mit einer gezielten Rechteanpassung in ein paar Minuten.

## Warum Adminrechte hier die falsche Lösung sind

- Mit Adminrechten darf alles, was er startet, das System verändern, auch ein Makro oder Schadprogramm aus einer E-Mail. Er könnte außerdem Software installieren oder den Virenschutz abschalten. Ein lokales Admin-Konto ist bei Angriffen oft genau der Hebel, um sich weiter im Netz auszubreiten.
- Es löst das Problem nicht einmal bequem: Bei aktiver Benutzerkontensteuerung (UAC) starten Programme auch bei Admins ohne erhöhte Rechte. Er müsste TimeTrack also trotzdem jedes Mal per Rechtsklick "Als Administrator ausführen" starten und die Abfrage bestätigen.
- "Nur vorübergehend" bleibt in der Praxis meistens dauerhaft.

## Was vermutlich dahintersteckt

Unter `C:\ProgramData` gilt standardmäßig: Normale Benutzer dürfen Dateien lesen und neue anlegen. Wer eine Datei anlegt, wird ihr Besitzer und hat volle Rechte darauf. Alle anderen Benutzer dürfen sie nur lesen.

Das passt gut zu deinem Fall: Bei den alten Kollegen hat TimeTrack die `config.ini` wahrscheinlich beim ersten Start unter ihrem eigenen Konto angelegt, sie gehört also ihnen. Auf PC-117 wurde sie vermutlich vom Installer oder von dir beim Einrichten angelegt (zum Beispiel beim ersten Test "als Administrator"). Dann gehört sie den Administratoren oder SYSTEM, und der neue Kollege darf nur lesen. TimeTrack will beim Start aber hineinschreiben, und das scheitert.

Möglich ist auch, dass auf PC-117 eine neuere TimeTrack-Version oder ein anderes Installationspaket drauf ist, das die Rechte anders setzt.

## So prüfst du es

Auf PC-117 und zum Vergleich auf dem Rechner eines alten Kollegen in einer PowerShell:

```powershell
icacls "C:\ProgramData\TimeTrack"
icacls "C:\ProgramData\TimeTrack\config.ini"
(Get-Acl "C:\ProgramData\TimeTrack\config.ini").Owner
```

Steht beim alten Kollegen er selbst als Besitzer und auf PC-117 `VORDEFINIERT\Administratoren` oder `NT-AUTORITÄT\SYSTEM`, ist die Ursache klar.

Bei der Gelegenheit auch auf dem alten Rechner nachsehen, wer dort lokaler Admin ist:

```cmd
net localgroup Administratoren
```

Falls die alten Kollegen noch Adminrechte aus früheren Zeiten haben, wäre das ein eigenes Thema, das du aufräumen solltest.

## Beheben

Schau zuerst, was in dem Ordner liegt:

```powershell
Get-ChildItem "C:\ProgramData\TimeTrack" -Recurse | Select-Object FullName
```

**Nur Konfigurations-, Log- oder Datendateien:** Gib der lokalen Gruppe "Benutzer" Änderungsrechte auf den Ordner (Eingabeaufforderung als Administrator):

```cmd
icacls "C:\ProgramData\TimeTrack" /grant *S-1-5-32-545:(OI)(CI)M
```

`S-1-5-32-545` ist die Gruppe "Benutzer". Die SID funktioniert unabhängig von der Windows-Sprache. Damit klappt es auch für den nächsten Kollegen, der sich an dem Rechner anmeldet.

**Liegen dort auch .exe-, .dll- oder Skriptdateien:** Dann gib die Rechte nur auf die eine Datei. Sonst könnte ein normaler Benutzer eine Programmdatei austauschen, die später mit höheren Rechten läuft (etwa durch einen Update-Dienst):

```cmd
icacls "C:\ProgramData\TimeTrack\config.ini" /grant *S-1-5-32-545:M
```

Danach mit `icacls "C:\ProgramData\TimeTrack\config.ini"` kontrollieren, ob `VORDEFINIERT\Benutzer` jetzt `(M)` hat. Wenn nicht (manche Installer schalten die Vererbung an der Datei ab), den Befehl für die Datei zusätzlich ausführen.

Dann soll der Kollege TimeTrack ganz normal starten. Kommt danach eine Meldung zu einer anderen Datei oder einem Registry-Schlüssel, zeigt dir Process Monitor von Sysinternals alle Stellen auf einmal: Filter auf den TimeTrack-Prozess und `Result is ACCESS DENIED`.

## Damit es beim nächsten neuen Rechner nicht wieder passiert

- Nimm den `icacls`-Befehl in euer Installationspaket oder Einrichtungsskript für TimeTrack auf. Habt ihr eine Domäne, geht es auch per Gruppenrichtlinie unter Computerkonfiguration > Richtlinien > Windows-Einstellungen > Sicherheitseinstellungen > Dateisystem.
- Frag beim Hersteller nach, welche Rechte TimeTrack unter `ProgramData` braucht. Oft steht das in den Installationshinweisen, und dann weißt du auch, ob Schreibrecht auf die Datei reicht oder der ganze Ordner gemeint ist.

Wenn du mir die `icacls`-Ausgabe von beiden Rechnern schickst, sage ich dir, welcher Befehl genau passt.
