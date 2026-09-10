---
name: paketieren
description: Software für Matrix42 Empirum paketieren, aus einem Guss. Nutzen, wenn der Nutzer eine Software nennt, die als Empirum-Paket entstehen oder aktualisiert werden soll ("paketiere X", "neues Paket für X", "X auf Version Y heben"). Deckt Recherche, Download mit Prüfung, setup.inf aus Template, Simulation und echten Test im Packaging Center, Dokumentation und Übernahme ins GitHub-Repo matrix42-paketierung per Branch und Pull Request ab.
---

# Software paketieren

Ziel: Aus einem Softwarenamen ein getestetes Empirum-Paket samt Dokumentation im Repo. Der Nutzer nennt die Software (und optional Version, Architektur, Sprache, Sonderwünsche), bestätigt unterwegs nur die UAC-Abfragen und am Ende die Freigabe.

## Orte und Werkzeuge

- Repo und Paketablage in einem: `C:\Users\Pauld\Documents\Projects\matrix42-paketierung` (GitHub Herr-Enklo/matrix42-paketierung). Jedes Paket unter `<DeveloperName>\<ProductName>\<Version>\` mit `Install\setup.inf`, `Files\<Installer>` (per .gitignore ausgeschlossen, nur `Files\README.md` ist versioniert), `changes.diff`, `paket.md`, Testberichte. Ordnernamen sind die Werte aus `[Application]`. Regeln in `AGENTS.md`, Templates in `templates/`. Der frühere Ordner `OneDrive\Desktop\Matrix42` ist nur noch Altbestand.
- Packaging Center (Nachbau des Empirum Package Editors): `C:\temp\packagingcenter\packaging-center`, Aufruf `python main.py check|run|roundtrip ...`.
- Werkzeuge im Repo: `tools/simulation-szenarien.py` (Simulation mit Produktprofil), `tools/echter-test.ps1` (erhöhter echter Lauf mit Rückstandsprüfung), Profile unter `tools/profile/`.
- Beispiele für Stil und Tiefe: vorhandene Pakete im Repo (Chrome, Firefox, Notepad++, Opera, 7-Zip).

## Ablauf

Die Phasen der Reihe nach. Nach jeder Phase kurz melden, was herauskam. Nichts erfinden: Parameter, Registry-Werte und Testergebnisse stammen aus Quellen oder aus dem echten Lauf, und die Herkunft steht in paket.md.

### 1. Klären

- Neues Paket oder Update? Bei Update die zuletzt freigegebene setup.inf aus dem Repo als Basis nehmen, Vorversion in `V_OldVersion` eintragen.
- Architektur, Sprache, Installertyp (MSI bevorzugt, sonst EXE) und Sonderwünsche (Verknüpfungen, Autoupdate, Standardbrowser) festhalten. Bei echten Alternativen eine kurze Rückfrage, sonst die Konvention der vorhandenen Pakete übernehmen: alle Benutzer, keine Desktopverknüpfung, kein Autostart, keine Telemetrie, Startmenü bleibt.

### 2. Recherche

- Aktuelle Stable-Version und offizielle Download-URL vom Hersteller (Release-Notes, Download-Verzeichnis, Enterprise-Seite). Keine Drittanbieter-Downloads.
- Silent-Parameter für Installation und Deinstallation, Uninstall-Registrierung (Schlüsselname, DisplayName, UninstallString, Registry-Ansicht), bekannte Eigenheiten (asynchrone Uninstaller, Autoupdate-Dienste und -Aufgaben, Per-User-Installationen).
- Quellen mit URL notieren. Recherchierte Werte gelten als Annahme, bis der echte Lauf sie bestätigt.

### 3. Download und Prüfung

- Installer nach `Files\` laden, dazu die Hersteller-Prüfsumme, falls angeboten.
- SHA-256 gegen die Herstellerangabe prüfen, Authenticode-Signatur mit `Get-AuthenticodeSignature` (Status, Signierer), Versionsinfo der Datei auslesen. Bei MSI die Property ProductVersion.
- Alles in paket.md dokumentieren. Installer nicht starten, außer im echten Test über das Paket.

### 4. Paket bauen

- Template aus `templates/EXE.inf` oder `templates/MSI.inf`. Nur die benötigte Architektur, die übrigen Zweige entfernen. Platzhalter vollständig ersetzen.
- setup.inf als Windows-1252 mit CRLF schreiben (UTF-8-Quelle mit `iconv -f UTF-8 -t CP1252` und `unix2dos`). Keine Umlaute in neu geschriebenen Zeilen, das Template selbst behält seine.
- Template-Logik erhalten (Erkennung, Versionsüberspringen, Reparatur, Deinstallation, SystemComponent). Abweichungen begründen, in Kommentaren in der setup.inf und in paket.md. Nach der Installation Rückgabecode und registrierte Zielversion prüfen.
- Bei Sektionen, die in beide Richtungen laufen (Reparaturpfad und Deinstallation), an die Ausführung von unten nach oben mit `-`-Zeilen denken: Sleep vor If, gespiegelte `-`-Zeilen, keine verschachtelten If-Aufrufe derselben Sektion.
- `changes.diff` als Unified Diff gegen das Template (UTF-8, Labels `templates/EXE.inf` und `<Hersteller>/<Produkt>/<Version>/Install/setup.inf`).
- `paket.md` nach dem Muster der vorhandenen Pakete: Status, Produkt, Hersteller und Download mit Hash und Signatur, beobachtetes Verhalten, Anpassungen mit Begründung, Quellen, Tests, offene Punkte, lokaler Aufbau.

### 5. Theoretischer Test (Simulation)

- `python main.py check <setup.inf>`: 0 Fehler ist Pflicht. Warnung zu fehlender Setup.ico ist bekannt.
- `python tools\simulation-szenarien.py <setup.inf> [--profil tools\profile\<produkt>.json]`: Neuinstallation, erneuter Aufruf, Update von Vorversion, neuere Version vorhanden, Installer-Fehler, Deinstallation mit und ohne Uninstaller. Ohne Profil nutzt die Simulation ihre eigene Nachbildung des Installers; ein Profil beschreibt den real beobachteten Zustand (Schlüsselname, DisplayName, Ansicht, Dateien, Rückgabewert und Verhalten des Uninstallers) und wird nach dem ersten echten Lauf angelegt oder korrigiert.
- Die Simulation liest standardmäßig die echte Registry; das Werkzeug schaltet das ab, damit installierte Software das Ergebnis nicht verfälscht.

### 6. Echter Test auf dem Laptop

- `powershell -File tools\echter-test.ps1 -SetupInf "<Pfad>\Install\setup.inf" -SetupExe "C:\temp\Packaging Center\24.0\Setup.exe"`; das Skript erhöht sich selbst (UAC durch den Nutzer), läuft Installation, erneuten Aufruf und Deinstallation, beobachtet neue Prozesse und prüft Rückstände in beiden Registry-Ansichten, im Programmordner, bei geplanten Aufgaben und Verknüpfungen. Log und Testbericht landen im Versionsordner. Mit `-SetupExe` läuft das echte Matrix42 Setup.exe (Maschinenteil `/AW /S0`, erneut `/AW /S0`, `/AW /S0 /U`, Debug- und Fehlerprotokolle per /B und /E); ohne den Schalter der Nachbau. Das Original ist maßgeblich, sobald es vorliegt.
- Benutzerteil (Sektionen mit CLIENT, z. B. HKCU-Einträge): läuft bei Empirum aus der Skriptkopie `%ProgramData%\$Matrix42Scripts$\<Hersteller>\<Produkt>\<Version>\Install\Setup.inf` mit `/C /S0`; Sektionen mit nur MACHINE werden dort übersprungen, im Maschinenteil (`/AW`) die mit nur CLIENT. Separat prüfen, wenn das Paket einen Benutzerteil hat.
- Vor dem ersten Lauf den Ausgangszustand prüfen (Software nicht installiert, keine Altreste). Der Nutzer wird vor dem Start informiert, dass die Software real installiert wird.
- Abweichungen zur Recherche (Registry-Ansicht, Uninstaller-Name, Rückgabewerte, asynchrone Kindprozesse, liegen gebliebene Schlüssel oder Ordner) in die setup.inf einarbeiten, Profil anpassen, Simulation und echten Lauf wiederholen, bis Installation, erneuter Aufruf und Deinstallation ohne Rückstände bestehen.
- Ergebnis in paket.md: was beobachtet wurde, was geändert wurde, was offen bleibt. Der echte Lauf im Packaging Center ersetzt den Test mit dem echten Empirum-Setup.exe nicht; das bleibt als offener Punkt stehen.
- Danach ist die Software wieder deinstalliert. Benutzerprofile bleiben, wenn das Paket sie erhält; das erwähnen.

### 7. Freigabemetadaten

- Erst nach bestandenem echten Lauf: `Tested on` mit Windows-Build, Werkzeug und Datum; Historieneintrag ohne "Test ausstehend"; Description ohne "Entwurf". Nichts behaupten, was nicht gelaufen ist.
- Testberichte im Versionsordner aufräumen: bestandener Endlauf und Simulationsberichte bleiben, Zwischenläufe weg.

### 8. Übernahme ins Repo

- Vor Branch-Arbeit den Klon mit `git fetch origin && git reset --hard origin/main` auf den aktuellen Stand bringen. Branch `claude/<produkt-slug>-<version>` von `main`. Der Paketordner `<DeveloperName>\<ProductName>\<Version>\` liegt bereits im Repo; committet werden `Install\setup.inf`, `Files\README.md` (erwartete Installerdateien), `changes.diff`, `paket.md` und der bestandene Testbericht als Markdown. Keine Installer, keine Logs.
- `.gitattributes` schützt `*.inf` vor Normalisierung; vor dem Commit `grep -c $'\xc3' setup.inf` muss 0 liefern (keine UTF-8-Bytes).
- Commit mit kurzer Beschreibung, Push, Pull Request mit `gh pr create` (Titel `<Produkt> <Version>`, Text: Herkunft, Prüfsumme, Anpassungen, Testergebnis, offene Punkte). Wenn `gh` nicht angemeldet ist, Branch pushen und den Compare-Link nennen.
- Nicht selbst mergen. Die Freigabe ist die Entscheidung des Nutzers; danach paket.md-Status auf "Freigegeben" setzen.

### 9. Abschluss

Kurz zusammenfassen: Version und Quelle, was das Paket tut, Testergebnis mit Rückständen, PR-Link, offene Punkte und Entscheidungen des Nutzers. Neue Erkenntnisse über Werkzeuge oder Ablauf ins Gedächtnis übernehmen.

## Häufige Stolpersteine

- Uninstall-Schlüssel in der 32-Bit-Ansicht (WOW6432Node) trotz x64-Installation: dann `V_RegWin=\WOW6432Node` und `V_Arch=x86` wie im Win32-Zweig des Templates.
- UninstallString mit Parametern: fester Uninstaller-Pfad statt Registry-Wert, weil der Template-Mechanismus (RemoveFromLeft + DoesFileExist) sonst fehlschlägt.
- Uninstaller kehrt sofort zurück und arbeitet als Kindprozess weiter: Rückgabewert akzeptieren, in Stufen warten (Datei und DisplayName weg), Nachlauf, dann Reste entfernen.
- Fremder Wert im Uninstall-Schlüssel (SystemComponent) verhindert, dass der Uninstaller seinen Schlüssel löscht: Wert vor dem Aufruf entfernen.
- DisplayName mit Version: Wildcard in `V_UnattendDisplayName`, GetUninstallKeyName kann `*` am Ende.
- Autoupdate-Aufgaben mit variablem Namen: PowerShell `Get-ScheduledTask -TaskName 'Name*' | Unregister-ScheduledTask -Confirm:$false`, Ergebnis prüfen.
- Simulation und Tool-Warnungen wie "Programmdatei nicht gefunden: powershell.exe" sind Artefakte der Vorprüfung ohne PATH-Auflösung, kein Paketfehler.
