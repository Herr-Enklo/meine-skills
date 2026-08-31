---
name: empirum-msi-deinstallation
description: Muster für Empirum-Unattended-Pakete, deren Installation über eine Setup.exe läuft, die sich in der Registry als MSI registriert. Nutzen, wenn Deinstallation oder Repair eines Matrix42-Pakets fehlschlägt, der UninstallString "MsiExec.exe /I{GUID}" lautet, DoesFileExist im UninstallCheck scheitert oder gefragt wird, wie man in Setup.inf vorwärts die .exe und rückwärts das MSI anfasst.
---

# Setup.exe installieren, MSI deinstallieren

## Symptom

Ein Empirum-Paket installiert über eine `Setup.exe`. Die trägt sich in
`HKLM\SOFTWARE\[WOW6432Node\]Microsoft\Windows\CurrentVersion\Uninstall\{GUID}`
aber als MSI ein, mit `UninstallString = MsiExec.exe /I{GUID}`.

Die übliche UninstallCheck-Logik der Unattended-Vorlage scheitert daran zweimal:

1. `DoesFileExist` findet keine Datei namens `MsiExec.exe /I{GUID}`, die
   Deinstallation läuft in den Fehlerpfad und bricht ab.
2. Selbst mit korrigiertem Pfad wäre `/I` falsch. Das öffnet den
   Wartungsdialog, statt zu deinstallieren.

## Kern des Musters

`GetUninstallKeyName` liefert bei MSI-Produkten den Namen des Uninstall-Keys,
und der **ist** die ProductCode-GUID. Der kaputte `UninstallString` wird
deshalb gar nicht erst gelesen. Deinstalliert wird mit

```
Call "%V_MsiExec%" /x %V_UnattendGUID% /qn /norestart /l*v "%LogFile%"
```

Den Produktcode nicht fest ins Paket schreiben. Die meisten Hersteller vergeben
pro Minor-Release einen neuen, dann entfernt das Paket nichts mehr.

## Laufrichtung: die wichtigste Regel

Setup.inf wird bei der Installation vorwärts und bei der Deinstallation
rückwärts durchlaufen. Deshalb stehen in den Vorlagen die mit `-` präfixierten
Zeilen gespiegelt in umgekehrter Reihenfolge unter ihren unpräfixierten
Zwillingen, und `If ... Then "Sektion"` steht symmetrisch um die Mitte.

Daraus folgt für jede neue Sektion: **entweder** exakt das vorhandene, bereits
funktionierende Spiegelmuster kopieren, **oder** die Sektion auf eine einzige
ausführbare Zeile reduzieren. Eine Sektion mit mehreren voneinander abhängigen
Anweisungen und ohne Spiegelung läuft rückwärts in der falschen Reihenfolge.
Das ist die häufigste Ursache für Deinstallationen, die nur in einer Richtung
funktionieren.

## Aufbau

`[Set:UninstallCheck]` wird zum reinen Verteiler. Er ermittelt den GUID in
beiden Laufrichtungen und entscheidet in genau einer Zeile über den Weg:

```
[Set:UninstallCheck]
Set ErrorLogMessage=Fehler im UninstallCheck. Deinstallationsweg konnte nicht ermittelt werden.
Set V_UnattendGUID = GetUninstallKeyName("%V_UnattendDisplayName%", %V_Arch%)
ReplaceEnv V_UnattendGUID
If "%V_UnattendGUID%" == "" Then "Set:UninstallNothing" Else "Set:UninstallDispatch" EndIf
-ReplaceEnv V_UnattendGUID
-Set V_UnattendGUID = GetUninstallKeyName("%V_UnattendDisplayName%", %V_Arch%)
-Set ErrorLogMessage=Fehler im UninstallCheck. Deinstallationsweg konnte nicht ermittelt werden.

[Set:UninstallNothing]
; Kein Uninstall-Key vorhanden, das Produkt ist nicht (mehr) installiert.
; Bewusst kein Abort: Empirum soll den Rest des Pakets trotzdem aufräumen.

[Set:UninstallDispatch]
If "%V_UninstallMethod%" == "MSI" Then "Set:UninstallMsi" Else "Set:UninstallDispatchExe" EndIf

[Set:UninstallDispatchExe]
If "%V_UninstallMethod%" == "EXE" Then "Set:UninstallExe" Else "Set:UninstallMethodAuto" EndIf

[Set:UninstallMethodAuto]
If DoesRegKeyExist ("HKLM,SOFTWARE%V_RegWin%\Microsoft\Windows\CurrentVersion\Uninstall\%V_UnattendGUID%,WindowsInstaller") == "1" Then "Set:UninstallMsi" Else "Set:UninstallExe" EndIf
```

Die Erkennung hängt am Wert `WindowsInstaller` unter dem Uninstall-Key. Den
schreiben nur MSI-Installationen, auch dann, wenn installiert wurde mit einer
Setup.exe. Damit bleibt die Vorlage abwärtskompatibel: bestehende Pakete lassen
`V_UninstallMethod` leer und werden weiterhin als EXE erkannt.

Die bisherige UninstallString-Logik wandert unverändert nach `[Set:UninstallExe]`.
Neu ist `[Set:UninstallMsi]`, gebaut wie die vorhandene Uninstall-Sektion,
inklusive gespiegelter `-Call`-Zeile:

```
[Set:UninstallMsi]
#Reg:SystemComponent
-Del "%LogFile%"
Set ErrorLogMessage=Fehler beim Deinstallieren (MSI) von %V_UnattendGUID%.
Call "%V_MsiExec%" /x %V_UnattendGUID% %V_MsiUninstParameter%
If "%ErrorLevel%" == "3010" Then "RebootRequired" EndIf
If "%ErrorLevel%" <> "0" & "%ErrorLevel%" <> "3010" Then "Set:MsiExitCode" EndIf
If "%ErrorLevel%" <> "0" & "%ErrorLevel%" <> "3010" Then "Set:MsiExitCode" EndIf
If "%ErrorLevel%" == "3010" Then "RebootRequired" EndIf
-Call "%V_MsiExec%" /x %V_UnattendGUID% %V_MsiUninstParameter%
Set ErrorLogMessage=Fehler beim Deinstallieren (MSI) von %V_UnattendGUID%.
Del "%LogFile%"
```

## Rückgabecodes

Jeden Code einzeln prüfen, damit jede Sektion nur eine Anweisung enthält und in
beiden Laufrichtungen gleich funktioniert:

```
[Set:MsiExitCode]
If "%ErrorLevel%" == "1605" Then "Set:MsiCodeIgnore" Else "Set:MsiExitCode1614" EndIf

[Set:MsiExitCode1614]
If "%ErrorLevel%" == "1614" Then "Set:MsiCodeIgnore" Else "Set:MsiExitCode1641" EndIf

[Set:MsiExitCode1641]
If "%ErrorLevel%" == "1641" Then "RebootRequired" Else "Set:ErrorLogMsg" EndIf

[Set:MsiCodeIgnore]
; Produkt war nicht (mehr) installiert. Das ist kein Fehler.
```

0 ist Erfolg, 3010 und 1641 bedeuten Neustart und gehören nach `RebootRequired`,
1605 und 1614 heißen „war nicht mehr installiert" und sind kein Fehler. Alles
andere bricht ab und lässt das msiexec-Log stehen.

`/norestart` statt `REBOOT=ReallySuppress`, wenn der Wert per `Set` gesetzt wird:
das vermeidet ein zweites `=` im Variablenwert.

## Repair

Läuft die Repair-Sektion über denselben Verteiler, greift dort automatisch
msiexec statt der Setup.exe. Für eine echte MSI-Reparatur statt „deinstallieren
und neu installieren":

```
Call "%V_MsiExec%" /fomus %V_UnattendGUID% /qn /norestart /l*v "%LogFile%"
```

Das Flag `v` gehört nicht dazu. Es verlangt das Original-MSI als Quelle, und das
liegt bei einer Setup.exe-Installation nicht im Paket. `/fomus` arbeitet aus dem
MSI-Cache unter `%WinDir%\Installer`.

## Variablen, die pro Paket gepflegt werden

`V_UnattendDisplayName` muss den DisplayName des **MSI-Eintrags** treffen, nicht
den der Setup.exe. Daran hängt der ganze Weg, weil `GetUninstallKeyName` daraus
den Produktcode ableitet. Trifft er daneben, bleibt der GUID leer.

`V_UninstallMethod` leer bedeutet Automatik, `MSI` und `EXE` erzwingen einen Weg.
Dazu die Parameter-Variablen für Deinstallation und Repair, und der Pfad zu
msiexec (`%WinDir%\System32\msiexec.exe`; falls `%WinDir%` in der eingesetzten
Empirum-Version nicht gesetzt ist, `%SystemRoot%` oder fest eintragen).

## Vor dem Rollout prüfen

Auf einem Testclient installieren und nachsehen, was tatsächlich entsteht:

```powershell
Get-ChildItem HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall,
              HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall |
  Get-ItemProperty |
  Where-Object DisplayName -like '*Produkt*' |
  Select-Object DisplayName, DisplayVersion, WindowsInstaller, UninstallString, QuietUninstallString
```

Entsteht **mehr als ein** Eintrag, ist die Setup.exe ein Bundle (WiX Burn,
InstallShield Suite). Dann ist msiexec der falsche Weg, weil `/x` nur eines der
enthaltenen MSIs entfernt. In dem Fall auf den Bundle-Eintrag zeigen und
`V_UninstallMethod=EXE` setzen: dessen `QuietUninstallString` räumt alles ab.

Danach Deinstallation zweimal hintereinander laufen lassen. Der zweite Lauf muss
sauber durchgehen, entweder über den Zweig für den fehlenden Uninstall-Key oder
über 1605. Repair auf einer vorhandenen Installation separat testen.
