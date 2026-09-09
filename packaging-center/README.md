# Packaging Center

Ein Nachbau des Empirum Packaging Center 24.0 von Matrix42, um Setup.inf-Pakete
ohne Empirum-Server lokal zu testen. Geschrieben in Python mit Tkinter, ohne
externe Abhängigkeiten. Kein Produkt von Matrix42; der Name Empirum gehört
Matrix42.

Das Original besteht aus dem Package Wizard (Paket aus Vorlage anlegen) und dem
Empirum Package Editor (Setup.inf bearbeiten, mit DEBUG und EINZELSCHRITT
durchlaufen). Beides ist hier nachgebaut. Dazu kommt, was das Original nicht
hat, beim lokalen Test aber hilft: eine Simulation, die nichts am Rechner
verändert, eine statische Paketprüfung und eine Testumgebung, in der man die
Empirum-Variablen von Hand setzt.

## Was der Interpreter kann

Der eingebaute Interpreter bildet Setup.exe nach, so weit die Vorlagen, die
Beispielpakete und die öffentliche Dokumentation es belegen:

- Variablen mit `%Name%`, aufgeschobene Ersetzung mit `%%...%%` und
  `ReplaceEnv`, Registry-Lesen mit `%HKLM,"Schlüssel","Wert"%`, INI-Lesen aus
  den Values$-Dateien, vordefinierte Variablen wie `%ProgramFilesDir%`,
  `%CommonAppData%`, `%Src%`, `%App%`, `%SetupBits%`, `%ComputerName%`.
- `[Options]` mit den Dateisektionen `[Installer]` und `[Product]`,
  automatisch dazu `[Reg:Product]`, `[Ini:Product]`, `[Shell:Product]`,
  `[Security:Product]`.
- Sektionsaufrufe `#Sektion, FLAGS` mit DONTDELETE, DELETE, WINDOWS64,
  WINDOWS32, MACHINE und CLIENT; eine Sektion läuft je Lauf einmal, `#!`
  erzwingt die Wiederholung.
- Deinstallation (`/U`): Sektionen von unten nach oben, nur Zeilen mit `-`,
  dazu `If`, `For`, `#`-Aufrufe und Variablenzuweisungen. Kopierzeilen löschen
  ihre Ziele wieder, Registryzeilen nehmen ihre Werte zurück, Verknüpfungen
  verschwinden.
- `If ... Then "Sektion" Else "Sektion" EndIf` mit `|` und `&`, den Vergleichen
  `==`, `<>`, `!=`, `<`, `>`, `<=`, `>=` und den Funktionen DoesRegKeyExist,
  DoesFileExist, DoesPathExist, DoesTextInFileExist.
- `Set` mit den Funktionen GetUninstallKeyName, Tokenize, Len, RemoveFromLeft,
  RemoveFromRight, Left, Right, Mid, UpperCase, LowerCase, Trim, Replace,
  ReadXmlText, GetFileVersion, IsProcessRunning; `For`, `Increment`,
  `Decrement`.
- Call, CallHidden, CallAsync, Echo, Sleep, AddMeter, ErrorLogMsg, Exit, Abort,
  AbortSilent, AbortReboot, SetReboot, SystemShutdown, KillProcess,
  AskKillProcesses, Copy, Del, DelTree, MkDir, RmDir, Rename, Prompt,
  StartService, StopService. Zeilen ohne bekannten Befehl gelten als
  Programmaufruf, wie bei Setup.exe (`Cmd /C ...`, `MsiExec ...`).
- Kopierzeilen `1:Quelle, Ziel, FLAGS, Größe`, Registryzeilen in
  `[Reg:...]`-Sektionen (auch `-HKLM,...` zum Löschen), Verknüpfungen in
  `[Shell:...]`-Sektionen.
- Am Ende registriert der Lauf das Paket wie Setup.exe: Uninstall-Schlüssel mit
  DisplayName, UninstallString, NoRemove/NoModify/NoRepair, dazu
  MachineKeyName und im Benutzerteil UserKeyName. Die Deinstallation entfernt
  das wieder.

Zwei Punkte sind Annahmen, weil die Dokumentation sie nicht klärt. Erstens der
Vergleich von Versionen: Standard ist numerisch (`8.10.0 > 8.9.8`), umschaltbar
auf Zeichenkettenvergleich; wenn beide Arten ein anderes Ergebnis liefern
würden, schreibt der Lauf eine Warnung ins Protokoll. Zweitens die Regel, dass
`Set` und `ReplaceEnv` auch bei der Deinstallation laufen. Die Vorlagen rufen
`[Set:Win64]` am Ende von `[Product]` mit DELETE ein zweites Mal auf; das
ergibt nur Sinn, wenn die Set-Zeilen darin beim Rückwärtslauf ausgeführt
werden.

## Echter Testlauf, Simulation, Mischmodus

Der echte Testlauf ist unter Windows der Normalfall. Er tut, was Setup.exe
täte: Installer starten, Registry und Dateien schreiben, Verknüpfungen anlegen,
das Paket registrieren. Der Lauf mit `/U` nimmt alles wieder zurück. So lässt
sich ein Paket am Testrechner hin und zurück prüfen, mit Einzelschritt und
Haltepunkten. Dazu das Programm als Administrator starten; ohne erhöhte
Rechte warnt der Editor, weil HKLM und Program Files sonst nicht beschreibbar
sind. SystemShutdown wird auch im echten Lauf unterdrückt, ein angeforderter
Neustart erscheint nur im Ergebnis.

Die Simulation ist der Trockenlauf. Sie startet keine Programme, schreibt keine
Registry und keine Dateien. Lesende Zugriffe gehen ans echte System, damit
Bedingungen wie `DoesRegKeyExist` realistisch ausfallen; unter Windows auch die
Registry. Was das Skript schreibt, landet in einer Überlagerung, die spätere
Lesezugriffe sehen. Für jeden Programmaufruf fragt der Editor nach dem
Rückgabewert (0, 3010, 1603 ...), damit sich auch die Fehlerpfade prüfen
lassen; das lässt sich abschalten.

Weil der Installer in der Simulation nicht läuft, bildet sie seine Wirkung
nach: Nach einem Aufruf mit Rückgabewert 0, 3010 oder 1641 legt sie einen
Uninstall-Schlüssel mit DisplayName (aus `V_MSIDisplayName` oder
`V_UnattendDisplayName`), DisplayVersion, InstallLocation und UninstallString
an, dazu die üblichen Deinstallationsprogramme im simulierten Dateisystem.
Ein Deinstallationsaufruf entfernt beides wieder. Die simulierte Registry
bleibt zwischen den Läufen einer Editorsitzung erhalten, so gehen Installation,
Reparatur und Deinstallation hintereinander; „Simulierte Registry
zurücksetzen“ im Menü Extras leert sie. Ohne diese Nachbildung würden die
Prüfungen der Vorlagen nach dem Installeraufruf (`If "%V_MSIGUID%" == ""`)
immer in den Fehlerzweig laufen.

Bricht ein Lauf ab, nennt das Ergebnis die Zeile des Abort und die If-Zeile,
die dorthin verzweigt hat, mit den ausgewerteten Bedingungen.

Der Mischmodus liegt dazwischen: Programmaufrufe (Call, CallHidden, MsiExec)
laufen echt, die Registry-, Datei- und Verknüpfungszeilen des Skripts bleiben
simuliert. Im Rückgabewert-Dialog gibt es außerdem je Aufruf den Knopf
„Wirklich ausführen“. Auf der Kommandozeile heißt der Mischmodus
`--programme`.

## Voraussetzungen

Python 3.9 oder neuer. Für die Oberfläche wird `tkinter` gebraucht, das beim
offiziellen Python-Installer für Windows dabei ist; unter Debian und Ubuntu
heißt das Paket `python3-tk`.

## Starten

```
python main.py
```

Das Startfenster zeigt die Werkzeuge und die Pakete im eingestellten Package
Store (ein Ordner mit `<Hersteller>\<Produkt>\<Version>\Install\Setup.inf`).

Der Package Wizard fragt Methode (Unattended-EXE oder MSI), Hersteller, Produkt,
Version, Installer, Parameter, DisplayName, Architektur und Prozesse ab, legt
den Paketordner mit `Install\Setup.inf` und `Files\` an und öffnet die Datei im
Editor. Die Vorlagen liegen unter `empirum/templates/` (`EXE.inf`, `MSI.inf`,
Windows-1252 mit CRLF, wie im Paketierungs-Repo). Eigene Vorlagen kann man
dort ablegen oder im Wizard auswählen.

Für eine neue Version eines vorhandenen Pakets wählt man im Wizard „Update“
und die Setup.inf der Vorversion. Sie ist dann die Basis: Die neue Version
kommt in `[Application]`, die Vorversion wird an jede `Set V_OldVersion=`-Zeile
angehängt, Installernamen mit der alten Version werden umbenannt, in
`[SetupInfo]` werden Build hochgezählt, „Last Change“ gesetzt, „Tested on“ auf
„Test ausstehend“ gestellt und eine Historienzeile angehängt. Alles andere,
auch Kodierung und CRLF, bleibt unverändert; die alte Datei wird nicht
angefasst. Dasselbe geht in der Automatik („Update: Setup.inf ist die
Vorversion“) und auf der Kommandozeile mit `update` oder `auto --update-auf`.

Der Package Editor hat links den Baum „Alle Abschnitte“ und rechts die
Setup.inf in zwei Ansichten, umschaltbar mit Strg+W: die Normalansicht mit
Schlüssel-Wert-Tabelle beziehungsweise Anweisungsliste je Sektion, die
Erweiterte Ansicht als Text mit Syntaxhervorhebung, Zeilennummern,
Haltepunkten (F9 oder Klick auf die Zeilennummer) und Vervollständigung
(Strg+Leertaste). Die Datei wird byteerhaltend zurückgeschrieben, also mit
ihrer Kodierung und CRLF.

DEBUG (F5) und EINZELSCHRITT (F12) fragen wie das Original zuerst nach dem
Setup-Befehl, vorbelegt mit den „Command line options“ aus `[SetupInfo]`.
`/U` schaltet auf Deinstallation, `/R` auf Neuinstallation, `/AW` auf den
Benutzerteil, `/S0` bis `/S4` setzt die Anzeigestufe von Setup.exe; der
Nachbau zeigt kein Setup-Fenster, der Wert ändert am Ablauf nichts. Im selben
Dialog wählt man echten Testlauf oder Simulation, 32 oder 64 Bit und den
Vergleichsmodus. Während des Laufs zeigt der Editor die aktuelle Zeile,
Protokoll, Variablen, Aufrufstapel und danach die Liste aller Aktionen; ein
Doppelklick im Protokoll oder in der Prüfung springt zur Zeile. Das Protokoll
landet zusätzlich unter `%Temp%\PackagingCenter\`.

Die Paketprüfung (F7) findet fehlende Sektionen, kaputte If-Zeilen, nirgends
definierte Variablen, `%%`-Aufschübe ohne ReplaceEnv, Kopierzeilen auf
fehlende Dateien, doppelte Sektionen, falsche Registrytypen und nie
aufgerufene Sektionen.

Die Testumgebung (Extras) ersetzt, was sonst der Server liefert: Werte für
`VM_`- und `VU_`-Variablen, ComputerName, EmpirumServer, Pfade. Die
Registry-Annahmen füllen die simulierte Registry vor dem Lauf, zum Beispiel
mit einer installierten Vorversion, um Reparatur und Update zu prüfen.

„Registrierung importieren“ wandelt eine `.reg`-Datei in Registryzeilen für
eine `[Reg:...]`-Sektion um.

## Automatik: bauen und hin und zurück testen

Die Kachel „Automatik: bauen + testen“ im Startfenster nimmt eine Setup.inf
(zum Beispiel aus dem Paketierungs-Repo, wo sie ohne `Install\`-Ordner liegt),
einen Ordner mit den Installerdateien und den Package Store. Sie legt daraus
`<Hersteller>\<Produkt>\<Version>\Install\Setup.inf` samt `Files\` an, kopiert
Setup.ico und Logo.bmp neben der Quelle mit, öffnet die Datei im Package
Editor und startet dort den automatischen Testlauf: Installation, wahlweise
erneute Installation über den Reparaturpfad, Deinstallation. Nach jeder Phase
prüft sie den Registry-Zustand: Uninstall-Schlüssel der Software (über den
DisplayName aus `V_MSIDisplayName` bzw. `V_UnattendDisplayName`),
Empirum-Registrierung (`UninstallKeyName`) und `MachineKeyName`, jeweils
vorhanden nach der Installation und entfernt nach der Deinstallation.

Der Testbericht landet als Markdown im Versionsordner des Pakets
(`Testbericht_<Datum>.md`) mit einer Tabelle je Phase, den Prüfungen, den
Warnungen und Fehlern aus den Protokollen und dem Ergebnis der Paketprüfung.
Er passt zur `paket.md` im Paketierungs-Repo.

Im Editor gibt es denselben Lauf über „Hin und zurück“ (F6) für die gerade
geöffnete Setup.inf. In der Simulation bleibt die Registry zwischen den Phasen
erhalten; im echten Testlauf bleibt nach der Deinstallation ein sauberer
Rechner. Ein Klick auf Stopp bricht die laufende Phase ab, die folgenden
laufen nicht mehr.

Ohne Fenster:

```
python main.py build  Repo\software\firefox\releases\155.0.1\setup.inf --store D:\Pakete --files D:\Installer\Firefox
python main.py roundtrip "D:\Pakete\Mozilla\Firefox (64Bit) DE\155.0.1\Install\Setup.inf" --echt --reinstall
python main.py auto   Repo\software\firefox\releases\155.0.1\setup.inf --store D:\Pakete --files D:\Installer\Firefox --echt
```

`auto` macht beides hintereinander; Rückgabewert 0 heißt, alle Phasen und
Prüfungen sind bestanden.

## Kommandozeile

```
python main.py check  Pfad\zur\Setup.inf
python main.py run    Pfad\zur\Setup.inf /S1            # Simulation
python main.py run    Pfad\zur\Setup.inf /U --aktionen   # Deinstallation, Aktionen zeigen
python main.py run    Pfad\zur\Setup.inf --var VM_Umgebung=Test --exit-code 3010
python main.py run    Pfad\zur\Setup.inf --echt          # echte Ausführung, nur Windows
python main.py vars   Pfad\zur\Setup.inf
python main.py list   Ordner
python main.py new    --vorlage EXE.inf --hersteller Acme --produkt Tool --version 1.0 --installer setup.exe --parameter /S --store D:\Pakete
```

`run` liefert Rückgabewert 0 bei Erfolg und 1 sonst, so lässt sich der Test in
Skripte einbauen.

## Tests

```
cd packaging-center
python -m unittest tests.test_engine
```

Die Tests decken Parser, byteerhaltendes Speichern, Variablenexpansion,
Vergleiche, Installations- und Deinstallationsläufe, Reparaturpfad, Abbruch,
Haltepunkt-Hook, Paketprüfung, Wizard und `.reg`-Import ab.

## Aufbau

```
main.py                 Einstieg: Oberfläche oder Kommandozeile
empirum/inf.py          Parser für Setup.inf (Sektionen, Zeilen, Kodierung, CRLF)
empirum/script.py       zerlegt Skriptzeilen in Anweisungen
empirum/variables.py    Variablen und %...%-Expansion
empirum/runner.py       Interpreter
empirum/backend.py      Simulation und Windows-Ausführung
empirum/validator.py    Paketprüfung
empirum/package.py      Paketordner, Vorlagen, ZIP-Export, .reg-Import
empirum/commands.py     Befehlskatalog für Referenz und Vervollständigung
gui/app.py              Startfenster
gui/editor.py           Package Editor
gui/wizard.py           Package Wizard
gui/dialogs.py          Dialoge
gui/highlight.py        Syntaxhervorhebung, Vervollständigung
tests/test_engine.py    Tests
```

## Grenzen

Der Interpreter kennt nur, was belegt ist. Befehle, die die Hilfe von Setup.exe
(SetupDeu.chm) zusätzlich anbietet, werden als Programmaufruf behandelt und im
Protokoll als unbekannt gemeldet. `[Security:...]`- und `[Ini:...]`-Sektionen
werden nur protokolliert. Prompts, Anzeigestufen und die Dialoge des
Installationsassistenten werden nicht dargestellt. Ein Test in der Simulation
ersetzt nicht den Lauf auf einem Windows-Testrechner mit dem echten Setup.exe;
er zeigt vorher, ob Ablauf, Bedingungen und Variablen stimmen.
