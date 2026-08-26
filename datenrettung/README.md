# Datenrettung

Ein Werkzeug, das NTFS-Datenträger und Disk-Images nach wiederherstellbaren
Dateien durchsucht. Es hat eine kleine grafische Oberfläche zum Auswählen der
Quelle und eine Kommandozeile für den Betrieb ohne Fenster. Geschrieben in
Python, ohne externe Abhängigkeiten.

Das Programm liest die Quelle ausschließlich. Es gibt keine Funktion, die auf
den untersuchten Datenträger schreibt.

## Wie es Dateien findet

Es kombiniert zwei Verfahren, weil sie unterschiedliche Stärken haben.

Der NTFS-Weg liest die Master File Table des Dateisystems. Wird eine Datei
gelöscht, markiert Windows ihren Eintrag nur als frei; Name, Größe und der
Verweis auf die Datencluster bleiben zunächst erhalten. Solange der Eintrag
nicht überschrieben wurde, lässt sich die Datei mit ihrem Originalnamen und der
richtigen Größe zurückholen.

Das File-Carving braucht kein intaktes Dateisystem. Es durchsucht die Rohdaten
nach bekannten Signaturen: Ein JPEG beginnt mit `FF D8 FF` und endet mit
`FF D9`, ein PNG mit `89 50 4E 47`, eine PDF mit `%PDF`. Zwischen Anfang und
Ende wird der Bereich herausgeschnitten. Das funktioniert auch nach einer
Formatierung, verliert aber Dateinamen und Ordnerstruktur, und stark
fragmentierte Dateien können unvollständig sein.

Im Standard laufen beide Verfahren nacheinander: erst NTFS für die Namen, dann
Carving für alles, was die MFT nicht mehr hergibt.

## Voraussetzungen

Python 3.9 oder neuer. Für die grafische Oberfläche wird `tkinter` gebraucht,
das beim offiziellen Python-Installer für Windows und macOS bereits dabei ist.
Unter Linux liefern die Distributionen es meist als eigenes Paket
(`python3-tk` bei Debian/Ubuntu, `python3-tkinter` bei Fedora).

Der Zugriff auf ein ganzes Laufwerk verlangt erhöhte Rechte. Unter Windows
startet man das Programm dazu als Administrator, unter Linux mit `sudo`. Eine
Image-Datei lässt sich dagegen mit normalen Rechten öffnen.

## Starten

Grafische Oberfläche:

```
python main.py
```

Der Ablauf im Fenster: oben eine Quelle wählen (ein erkanntes Laufwerk aus der
Liste oder über „Image-Datei…" eine `.dd`/`.img`-Datei), darunter einen
Ausgabeordner auf einem anderen Datenträger, dann „Scannen". Die Funde
erscheinen währenddessen in der Liste. Am Ende schreibt „Alle wiederherstellen"
oder „Auswahl wiederherstellen" die Dateien in den Ausgabeordner.

Auf der Kommandozeile geht dasselbe ohne Fenster:

```
python main.py list                                  # Laufwerke anzeigen
python main.py scan --source disk.dd --out ./gerettet
python main.py scan --source \\.\C: --out D:\gerettet --no-carve
python main.py scan --source /dev/sdb1 --out ~/gerettet --no-ntfs
```

Ohne `--out` wird nur gezählt und aufgelistet, nichts geschrieben. Weitere
Schalter: `--no-ntfs` und `--no-carve` schalten je ein Verfahren ab, `--all`
listet bei NTFS auch die noch vorhandenen Dateien, `--max N` begrenzt die Zahl
der Carving-Treffer.

## Sicherer Umgang

Zwei Regeln entscheiden über den Erfolg einer Rettung.

Sobald eine Datei versehentlich gelöscht wurde, sollte auf den betroffenen
Datenträger nichts mehr geschrieben werden. Jeder neue Schreibvorgang kann genau
die Blöcke überschreiben, die noch zu retten wären. Das gilt auch für den
Rechner selbst, wenn das Systemlaufwerk betroffen ist.

Der Ausgabeordner gehört auf einen anderen Datenträger als die Quelle. Schreibt
man die geretteten Dateien zurück auf dieselbe Platte, überschreibt man
möglicherweise weitere noch nicht gerettete Daten. Bei einer physisch defekten
Platte ist der übliche Weg, zuerst ein Image zu ziehen (etwa mit `dd` oder
`ddrescue`) und danach nur noch mit diesem Image zu arbeiten.

## Unterstützte Dateitypen beim Carving

Bilder (JPEG, PNG, GIF, BMP), Dokumente und Archive (PDF, ZIP und damit auch
DOCX/XLSX/PPTX, RAR, 7z, GZIP), Audio und Video (WAV, OGG, MP3, MP4/MOV) sowie
SQLite-Datenbanken. Die Signaturen stehen in `recovery/signatures.py` und lassen
sich dort erweitern.

## Grenzen

Das NTFS-Modul deckt die verbreiteten Fälle ab: residente und über Data-Runs
verteilte Dateien, fragmentierte MFT, mehrere Partitionen über MBR und GPT. Es
wertet keine `$LogFile`-Journale aus und rekonstruiert keine beschädigten
Dateisystem-Metadaten. FAT und exFAT werden vom NTFS-Weg nicht gelesen; dort
bleibt das Carving.

Beim Carving hängt die Vollständigkeit von der Fragmentierung ab. Eine am Stück
gespeicherte Datei kommt sauber heraus; eine über die Platte verteilte kann an
der ersten Lücke abbrechen, weil das Verfahren die Fortsetzung nicht kennt.

Der Zugriff auf rohe Geräte geht von 512-Byte-Sektoren aus. Datenträger, die
ausschließlich 4K-Sektoren melden (4Kn), werden in dieser Fassung nicht
unterstützt.

Ein Scan über eine große Platte liest sie einmal vollständig und dauert
entsprechend. Für einen ersten Test empfiehlt sich ein kleines Image.

## Projektaufbau

```
datenrettung/
  main.py                 Einstiegspunkt (GUI und CLI)
  recovery/
    sources.py            lesender Byte-Zugriff auf Image oder Gerät
    drives.py             Laufwerke auflisten (Windows/Linux/macOS)
    signatures.py         Datei-Signaturen fürs Carving
    carver.py             Carving-Engine
    ntfs.py               NTFS-/MFT-Parser
    scanner.py            Orchestrierung und Wiederherstellung
    models.py             gemeinsamer Fund-Typ
  gui/
    app.py                tkinter-Oberfläche
  tests/
    make_sample_image.py  baut synthetische Test-Images
    test_engine.py        Tests für Carving und NTFS
```

## Tests

Die Tests bauen ein synthetisches Carving-Image mit echten kleinen Dateien und
ein von Hand konstruiertes NTFS-Volume mit einer gelöschten Datei. Sie prüfen,
dass beide Verfahren die eingebetteten Daten byte-genau zurückholen, dass die
Partitionserkennung ein NTFS-Volume hinter einer MBR-Tabelle findet und dass
Zufallsdaten keine Flut von Fehltreffern erzeugen.

```
python -m unittest datenrettung.tests.test_engine
```

oder direkt:

```
python datenrettung/tests/test_engine.py
```
