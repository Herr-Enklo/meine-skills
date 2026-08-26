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
listet bei NTFS auch die noch vorhandenen Dateien, `--orphan` sucht den ganzen
Datenträger nach MFT-Einträgen ab (findet auch nach einer Formatierung, dauert
aber deutlich länger), `--reconstruct` rekonstruiert eine verlorene
Partitionstabelle über eine Boot-Sektor-Suche, `--no-partial` lässt
unvollständige Dateien weg, `--sector 4096` stellt auf 4K-Sektoren um,
`--max N` begrenzt die Zahl der Carving-Treffer.

Nach jedem Scan zeigt das Werkzeug „Gelesen: X von Y". Diese Zeile ist die
wichtigste Kontrolle: Steht dort ein winziger Bruchteil, wurde der Datenträger
gar nicht vollständig gelesen (meist fehlende Administratorrechte oder ein
Zugriffsproblem), und dann kann auch nichts gefunden werden.

## Warum ein Scan Zeit braucht

Ein gründlicher Scan liest den kompletten Datenträger einmal Sektor für Sektor.
Bei 2 TB sind das mehrere Stunden, egal mit welchem Werkzeug. Ein Durchlauf, der
nach Sekunden fertig ist, hat den Datenträger nicht wirklich gelesen. Genau
deshalb steht die „Gelesen"-Zeile am Ende jedes Scans: Sie macht sichtbar, ob
tatsächlich die ganze Fläche gelesen wurde.

Damit ein einzelner Lesefehler den Durchlauf nicht vorzeitig beendet, überbrückt
das Werkzeug defekte oder gesperrte Sektoren, zählt sie und liest weiter bis zum
Ende.

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

Bilder (JPEG, PNG, GIF, BMP, TIFF und darauf aufbauende Kamera-RAW-Formate wie
CR2, NEF, ARW, DNG, WebP), Dokumente und Archive (PDF, RTF, die alten
Office-Formate doc/xls/ppt über den OLE-Container, ZIP und damit DOCX/XLSX/PPTX,
RAR, 7z, GZIP), Audio und Video (WAV, AVI, OGG, MP3, FLAC, MP4, MOV, HEIC,
Matroska/WebM) sowie PSD und SQLite-Datenbanken. Container wie ftyp (MP4/MOV/HEIC)
und RIFF (WAV/AVI/WebP) bekommen die passende Endung anhand ihrer Marke. Die
Signaturen stehen in `recovery/signatures.py` und lassen sich dort erweitern.

Fehlt einer Datei das Endmuster (etwa weil sie teilweise überschrieben wurde),
wird sie als unvollständig bestmöglich gerettet, statt sie zu verwerfen. Solche
Funde tragen `_unvollstaendig` im Namen.

## Grenzen

Das ist ein kompaktes Werkzeug, kein Ersatz für kommerzielle Recovery-Software.
Der Unterschied liegt vor allem in drei Punkten: Kommerzielle Tools kennen
mehrere Hundert Dateitypen, sie setzen fragmentierte Dateien wieder zusammen, und
sie werten die Dateisystem-Strukturen tiefer aus (Journale, beschädigte
Metadaten). Dieses Werkzeug deckt die häufigsten Typen ab und schneidet
zusammenhängende Bereiche heraus.

Beim Carving hängt die Vollständigkeit von der Fragmentierung ab. Eine am Stück
gespeicherte Datei kommt sauber heraus; eine über die Platte verteilte kann an
der ersten Lücke abbrechen, weil das Verfahren die Fortsetzung nicht kennt.

Das NTFS-Modul liest residente und über Data-Runs verteilte Dateien, verarbeitet
fragmentierte MFT und mehrere Partitionen über MBR und GPT. Mit `--orphan` bzw.
der entsprechenden Option in der Oberfläche durchsucht es den ganzen Datenträger
nach MFT-Einträgen und findet gelöschte Dateien so auch nach einer Formatierung
oder bei beschädigtem Boot-Sektor. `$LogFile`-Journale wertet es nicht aus. FAT
und exFAT liest der NTFS-Weg nicht; dort bleibt das Carving.

Ist die Partitionstabelle verloren oder überschrieben, rekonstruiert `--reconstruct`
die Volumes über eine Boot-Sektor-Suche (der Ansatz von TestDisk, in Python
nachgebaut). Das Werkzeug durchsucht den Datenträger nach NTFS-Boot-Sektoren, zieht
bei Bedarf die Kopie am Volume-Ende heran und errechnet aus dem BPB Anfang und
Größe der Partition. Die so gefundenen Volumes werden anschließend normal über die
MFT ausgelesen. FAT-Volumes werden dabei erkannt und gemeldet, mangels FAT-Parser
aber nicht ausgelesen.

Standardmäßig wird von 512-Byte-Sektoren ausgegangen. Datenträger mit reinen
4K-Sektoren (4Kn) lassen sich über `--sector 4096` beziehungsweise die Option
„4K-Sektoren" verarbeiten.

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
