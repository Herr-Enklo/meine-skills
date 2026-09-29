# Datenrettung

Ein Werkzeug, das Windows-Datenträger (NTFS, FAT, exFAT) und Disk-Images nach
wiederherstellbaren Dateien durchsucht. Es hat eine kleine grafische Oberfläche
zum Auswählen der Quelle und eine Kommandozeile für den Betrieb ohne Fenster.
Geschrieben in Python, ohne externe Abhängigkeiten.

Das Programm liest die Quelle ausschließlich. Es gibt keine Funktion, die auf
den untersuchten Datenträger schreibt.

## Wie es Dateien findet

Es kombiniert mehrere Verfahren, weil sie unterschiedliche Stärken haben.

Der NTFS-Weg liest die Master File Table des Dateisystems. Wird eine Datei
gelöscht, markiert Windows ihren Eintrag nur als frei; Name, Größe und der
Verweis auf die Datencluster bleiben zunächst erhalten. Solange der Eintrag
nicht überschrieben wurde, lässt sich die Datei mit ihrem Originalnamen
zurückholen. Dabei werden auch der Ordnerpfad (über die Elternverweise der MFT)
und die Zeitstempel rekonstruiert. NTFS-komprimierte Dateien werden entpackt.
Sehr große oder stark fragmentierte Dateien, deren Verwaltungsdaten über mehrere
MFT-Einträge verteilt sind (`$ATTRIBUTE_LIST`), werden vollständig
zusammengesetzt, auch wenn die Liste selbst unvollständig ist.

Der FAT/exFAT-Weg macht dasselbe für Wechselmedien wie SD-Karten und USB-Sticks.
Er liest die Verzeichniseinträge, erkennt gelöschte Einträge (erstes Namensbyte
`0xE5` bei FAT, gelöschtes InUse-Bit bei exFAT) und rekonstruiert Name, Pfad,
Größe und Zeit, auch für Dateien in gelöschten Ordnern. Vorhandene Dateien folgen
ihrer FAT-Kette. Bei gelöschten Dateien ist die Kette meist freigegeben; sie
werden ab dem Startcluster aus freien Clustern zusammengesetzt, Cluster anderer
(noch vorhandener) Dateien werden dabei übersprungen.

Das File-Carving braucht kein intaktes Dateisystem. Es durchsucht die Rohdaten
nach bekannten Signaturen: Ein JPEG beginnt mit `FF D8 FF`, ein PNG mit
`89 50 4E 47`, eine PDF mit `%PDF`. Das Ende wird je nach Format bestimmt (siehe
unten). Vollständige Treffer werden über ihre interne Struktur geprüft (etwa die
PNG-CRC, die JPEG-Marker oder das GZIP-Entpacken), um Fehltreffer zu verwerfen.
Das funktioniert auch nach einer Formatierung, verliert aber Dateinamen, und
stark fragmentierte Dateien können unvollständig sein.

Im Standard laufen die Verfahren nacheinander: erst die Dateisysteme (NTFS,
FAT/exFAT) für Namen und Pfade, dann Carving für alles Übrige. Das Carving
durchsucht dabei nur den freien Speicher erkannter Dateisysteme und lässt
Dateien aus, die das Dateisystem schon geliefert hat. So erscheinen weder alle
vorhandenen Dateien noch jede gelöschte Datei doppelt.

## Zustand der Funde

Jeder Fund trägt einen Zustand, der sagt, wie verlässlich der Inhalt ist:

| Zustand | Bedeutung |
|---|---|
| gut | Die Daten liegen noch unverändert an ihrer Stelle. |
| vollständig | Carving: Anfang und Ende der Datei wurden gefunden. |
| vorhanden | Die Datei ist nicht gelöscht (Modus „auch vorhandene Dateien“). |
| zusammengesetzt | FAT/exFAT: Die gelöschte Datei wurde über belegte Cluster hinweg aus freien Clustern zusammengesetzt. Meist richtig, aber nicht garantiert. |
| teilweise überschrieben | Ein Teil der Cluster gehört inzwischen einer anderen Datei. |
| unvollständig | Carving: Das Ende fehlt, gerettet wird der vorhandene Teil. |
| überschrieben | Die Cluster sind neu belegt; der Inhalt stammt sehr wahrscheinlich von einer anderen Datei. |
| unbekannt | Nicht prüfbar (z.B. Funde aus der Suche nach verwaisten MFT-Einträgen). |

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
Liste oder über „Image-Datei …“ eine `.dd`/`.img`-Datei), darunter einen
Ausgabeordner auf einem anderen Datenträger, dann „Scannen“. Die Funde
erscheinen währenddessen in der Liste. Am Ende schreibt „Alle wiederherstellen“
oder „Auswahl wiederherstellen“ die Dateien in den Ausgabeordner. Gelesen wird
dabei immer die Quelle, die gescannt wurde, auch wenn man die Auswahl oben
inzwischen geändert hat.

Die Liste lässt sich über die Spaltenköpfe oder das Kontextmenü (Rechtsklick,
Umschalt+F10) sortieren; Strg+A wählt alle Zeilen, Umschalt+Pfeil erweitert die
Auswahl. Angezeigt werden höchstens 20.000 Zeilen, sortiert wird aber über alle
Funde, und „Alle wiederherstellen“ rettet auch die ausgeblendeten.

Bricht man eine Wiederherstellung ab, bleibt die Trefferliste erhalten. Ein
erneuter Klick setzt fort und überspringt die schon geschriebenen Dateien; ein
neuer Scan ist dafür nicht nötig. Welche Funde fertig sind, steht in der Datei
`.datenrettung.json` im Ausgabeordner, getrennt nach Quelle. Die Quelle erkennt
das Werkzeug an Größe, Anfang und Ende des Datenträgers, nicht am Pfad; eine
Platte, die Windows nach einem Neustart unter anderer Nummer führt, gilt also
weiter als dieselbe. Übersprungen wird eine Datei nur, wenn sie noch die
protokollierte Länge hat und ihr Anfang mit dem Fund in der Quelle
übereinstimmt. Andernfalls wird sie unter neuem Namen geschrieben, vorhandene
Dateien werden nie überschrieben. So landen auch zwei Funde mit gleichem Namen
und gleicher Größe, etwa aus zwei Partitionen, beide im Ausgabeordner. Die
Änderungszeit der geretteten Dateien wird vom Original übernommen, soweit sie
bekannt ist.

Schließt man das Fenster, während ein Scan oder eine Wiederherstellung läuft,
fragt das Programm nach. Bestätigt man, bricht es den Lauf zuerst geordnet ab
und schließt dann; eine halb geschriebene Datei bleibt dabei nicht zurück.

Auf der Kommandozeile geht dasselbe ohne Fenster:

```
python main.py list                                  # Laufwerke anzeigen
python main.py scan --source disk.dd --out ./gerettet
python main.py scan --source \\.\C: --out D:\gerettet --no-carve
python main.py scan --source /dev/sdb1 --out ~/gerettet --no-ntfs
```

Ohne `--out` wird nur gezählt und aufgelistet, nichts geschrieben. Weitere
Schalter: `--no-ntfs`, `--no-fat` und `--no-carve` schalten je ein Verfahren ab,
`--carve-all` lässt das Carving auch belegte Bereiche durchsuchen,
`--no-validate` schaltet die Struktur-Prüfung der Carving-Treffer aus, `--all`
listet auch die noch vorhandenen Dateien, `--orphan` sucht den ganzen
Datenträger nach MFT-Einträgen ab (findet auch nach einer Formatierung, dauert
aber deutlich länger), `--reconstruct` rekonstruiert eine verlorene
Partitionstabelle über eine Boot-Sektor-Suche, `--usn` wertet das
USN-Journal aus, `--no-partial` lässt unvollständige Dateien weg, `--sector`
erzwingt eine Sektorgröße (sonst wird sie erkannt), `--max N` begrenzt die Zahl
der Carving-Treffer. Strg+C bricht geordnet ab und zeigt die Funde bis dahin;
ein zweites Strg+C bricht sofort ab.

Nach jedem Scan zeigt das Werkzeug „Durchsucht: X von Y“. Diese Zeile ist die
wichtigste Kontrolle: Steht dort ein winziger Bruchteil, wurde der Datenträger
gar nicht vollständig gelesen (meist fehlende Administratorrechte oder ein
Zugriffsproblem), und dann kann auch nichts gefunden werden. Hinweise, etwa auf
beschädigte Strukturen oder verschlüsselte Partitionen, erscheinen nach dem Scan
gesammelt. Dazu gehören auch FAT- und exFAT-Einträge mit unmöglicher
Größenangabe: Sie werden einzeln übersprungen, die übrigen Dateien im selben
Ordner werden weiter gefunden.

## Warum ein Scan Zeit braucht

Ein gründlicher Scan liest den kompletten Datenträger einmal. Bei 2 TB sind das
mehrere Stunden, egal mit welchem Werkzeug. Ein Durchlauf, der nach Sekunden
fertig ist, hat den Datenträger nicht wirklich gelesen. Leere Bereiche (nur
Nullen oder `FF`) überspringt die Signatursuche allerdings sehr schnell, eine
wenig belegte Platte ist also deutlich schneller durch als eine volle.

Damit ein einzelner Lesefehler den Durchlauf nicht vorzeitig beendet, überbrückt
das Werkzeug defekte oder gesperrte Sektoren, zählt sie und liest weiter bis zum
Ende. Liegen acht defekte Sektoren hintereinander, wird der Rest des Bereichs
(1 MiB) übersprungen, statt jeden Sektor einzeln anzufragen. Auf einer
sterbenden Platte kann jeder Fehlversuch Sekunden dauern und die Mechanik weiter
belasten.

## Sicherer Umgang

Zwei Regeln entscheiden über den Erfolg einer Rettung.

Sobald eine Datei versehentlich gelöscht wurde, sollte auf den betroffenen
Datenträger nichts mehr geschrieben werden. Jeder neue Schreibvorgang kann genau
die Blöcke überschreiben, die noch zu retten wären. Das gilt auch für den
Rechner selbst, wenn das Systemlaufwerk betroffen ist.

Der Ausgabeordner gehört auf einen anderen Datenträger als die Quelle. Das
Werkzeug prüft das vor dem Schreiben: Liegt der Ausgabeordner auf dem gewählten
Laufwerk oder auf einer Partition der gewählten Platte, verweigert es die
Wiederherstellung (auf der Kommandozeile lässt sich das mit `--allow-same-disk`
übergehen). Unter Windows fragt es dazu das System, auf welchem Volume der
Ordner tatsächlich liegt. Erweiterte Pfade wie `\\?\C:\…`, Junctions,
symbolische Links und in Ordner eingehängte Volumes werden so richtig
zugeordnet. Bei einer physisch defekten Platte ist der übliche Weg, zuerst ein
Image zu ziehen (etwa mit `ddrescue`) und danach nur noch mit diesem Image zu
arbeiten.

## BitLocker

Ist eine Partition mit BitLocker verschlüsselt (unter Windows 11 bei vielen
Geräten ab Werk), liefert das physische Laufwerk (`PhysicalDriveN`) nur
verschlüsselte Daten. Das Werkzeug erkennt solche Partitionen, meldet sie und
lässt sie beim Carving aus. Für die Rettung wählt man stattdessen das entsperrte
Laufwerk über seinen Buchstaben (z.B. `C:`); darüber liefert Windows die
entschlüsselten Daten.

## Unterstützte Dateitypen beim Carving

Bilder (JPEG, PNG, GIF, BMP, TIFF und darauf aufbauende Kamera-RAW-Formate wie
CR2, NEF, ARW, DNG, dazu CR3, RAF und RW2, außerdem WebP, HEIC, AVIF, JPEG 2000
und ICO), Dokumente und Archive (PDF, RTF, die alten Office-Formate doc/xls/ppt
über den OLE-Container, ZIP und damit DOCX/XLSX/PPTX, RAR, 7z, GZIP), Audio und
Video (WAV, AVI, OGG, MP3, FLAC, MP4, MOV, HEIC, Matroska/WebM) sowie PSD und
SQLite-Datenbanken. Container wie ftyp (MP4/MOV/HEIC) und RIFF (WAV/AVI/WebP)
bekommen die passende Endung anhand ihrer Marke. Die Signaturen stehen in
`recovery/signatures.py` und lassen sich dort erweitern.

Das Dateiende wird je nach Typ unterschiedlich bestimmt. Bei JPEG folgt das
Werkzeug der Marker-Struktur und überspringt so das in EXIF eingebettete
Vorschaubild, das ein eigenes Endmuster trägt. Bricht ein JPEG ab, weil es
fragmentiert oder teilweise überschrieben ist, endet der Fund an der letzten
sicheren Stelle, und ein direkt folgendes Bild wird eigenständig gefunden. ZIP-
und Office-Dateien enden an dem Abschluss, der zu ihrem eigenen
Inhaltsverzeichnis passt, sodass eingebettete Archive (JAR, DOCX in einem ZIP)
die Datei nicht abschneiden. Das gilt auch für ZIP64, das schon bei mehr als
65.535 Einträgen nötig ist. PDFs mit inkrementellen Updates enden am letzten
`%%EOF` samt Zeilenende, RTF-Dokumente an der äußersten Klammergruppe. GZIP wird
probeweise entpackt; das liefert das exakte Ende und verwirft zufällige Treffer.
7z und SQLite bekommen ihre exakte Größe aus dem Dateikopf. Endet die Quelle
vor der angegebenen Größe, gilt der Fund als unvollständig. Typen ohne
Endmuster (TIFF/RAW, RAR, Videos) enden spätestens am nächsten Kopf desselben
Typs.

Fehlt einer Datei das Ende (etwa weil sie teilweise überschrieben wurde), wird
sie als unvollständig bestmöglich gerettet, statt sie zu verwerfen. Solche Funde
tragen `_unvollstaendig` im Namen.

## Grenzen

Das ist ein kompaktes Werkzeug, kein Ersatz für kommerzielle Recovery-Software.
Kommerzielle Tools kennen mehrere Hundert Dateitypen und setzen fragmentierte
Dateien auch ohne Dateisystem-Informationen wieder zusammen. Dieses Werkzeug
deckt die häufigsten Typen ab.

Beim Carving hängt die Vollständigkeit von der Fragmentierung ab. Eine am Stück
gespeicherte Datei kommt sauber heraus; eine über die Platte verteilte endet an
der ersten Lücke.

Das NTFS-Modul liest residente, über Data-Runs verteilte und NTFS-komprimierte
Dateien, verarbeitet fragmentierte MFT, beschädigte Einzeleinträge und mehrere
Partitionen über MBR (auch logische Laufwerke in erweiterten Partitionen) und
GPT. Ist der Boot-Sektor beschädigt, nutzt es die Kopie am Volume-Ende. Mit
`--orphan` bzw. der entsprechenden Option durchsucht es den ganzen Datenträger
nach MFT-Einträgen und findet gelöschte Dateien so auch nach einer Formatierung.
Mit `--usn` wertet es das USN-Change-Journal (`$UsnJrnl`) aus und listet die
Namen und Zeitpunkte gelöschter Dateien, auch wenn der MFT-Eintrag schon
wiederverwendet wurde. Diese Funde sind informativ: Sie zeigen, was gelöscht
wurde, enthalten aber keinen Dateiinhalt. Mit EFS verschlüsselte Dateien werden
als solche markiert; ihren Inhalt kann das Werkzeug nicht entschlüsseln. Dateien,
die Windows mit „CompactOS“/WOF komprimiert hat, und das `$LogFile`-Journal
wertet es nicht aus.

Ist die Partitionstabelle verloren oder überschrieben, rekonstruiert
`--reconstruct` die Volumes über eine Boot-Sektor-Suche (der Ansatz von TestDisk,
in Python nachgebaut). Das Werkzeug durchsucht den Datenträger nach NTFS-, FAT-
und exFAT-Boot-Sektoren, zieht bei NTFS bei Bedarf die Kopie am Volume-Ende heran
und errechnet aus dem BPB Anfang und Größe der Partition. Die Boot-Sektor-Kopien
von FAT32 (Sektor 6) und exFAT (Sektor 12) werden dabei erkannt und nicht als
eigene Volumes gemeldet.

Die logische Sektorgröße (512 Byte oder 4096 Byte bei 4Kn-Platten) fragt das
Werkzeug beim Öffnen eines Laufwerks ab; sie bestimmt die Ausrichtung der
Lesezugriffe und die Umrechnung der MBR-/GPT-Einträge. Passt sie nicht zur
Partitionstabelle, wird die GPT trotzdem gefunden. Die MFT-Einträge sind
unabhängig davon immer in 512-Byte-Abschnitten geschützt.

Große Funde (Videos, Archive) werden blockweise geschrieben und liegen nie
komplett im Speicher. Jede Datei entsteht erst unter der Endung `.part` und wird
zum Schluss umbenannt; ein Abbruch mitten in einer Datei hinterlässt also keine
halbe Datei. Sehr lange Namen (tiefe Ordnerpfade) werden in der Mitte gekürzt,
Nummer und Endung bleiben erhalten. Ist der Zieldatenträger voll, bricht die
Wiederherstellung mit einer klaren Meldung ab.

## Projektaufbau

```
datenrettung/
  main.py                 Einstiegspunkt (GUI und CLI)
  recovery/
    sources.py            lesender Byte-Zugriff auf Image oder Gerät
    drives.py             Laufwerke auflisten, Ausgabeordner gegen Quelle prüfen
    signatures.py         Datei-Signaturen, Ende-Finder und Struktur-Validatoren
    carver.py             Carving-Engine
    ntfs.py               NTFS-/MFT-Parser, Partitionstabellen, Rekonstruktion
    lznt1.py              Entpacken NTFS-komprimierter Dateien
    usn.py                USN-Change-Journal ($UsnJrnl) auswerten
    fat.py                FAT12/16/32-Undelete
    exfat.py              exFAT-Undelete
    runs.py               Clusterbereiche für FAT und exFAT
    scanner.py            Orchestrierung und Wiederherstellung
    models.py             gemeinsamer Fund-Typ
  gui/
    app.py                tkinter-Oberfläche
    sorting.py            Sortier-Logik der Trefferliste (tkinter-frei, testbar)
  tests/
    make_sample_image.py  baut synthetische Test-Images
    fixtures/             kleine Images echter Dateisysteme (ntfs-3g, mtools, exfat-fuse)
    test_engine.py        Tests für Carving, NTFS, FAT, exFAT, USN
    test_befunde.py       Regressionstests zu den Befunden des Reviews
    test_gegenpruefung.py Regressionstests zu den Befunden der Gegenprüfung
    test_gui.py           Rauchtest der Oberfläche (braucht eine Anzeige)
    windows_geraete.py    Prüfung der Windows-Gerätezugriffe (nur unter Windows)
```

## Tests

Die Tests bauen synthetische Images (Carving, NTFS, FAT12/32, exFAT) und nutzen
zusätzlich kleine Images echter Dateisysteme, die mit ntfs-3g, mtools und
exfat-fuse angelegt wurden; darauf wurden Dateien gelöscht (normal, komprimiert,
stark fragmentiert, in gelöschten Ordnern, auf 4K-Sektoren). Geprüft wird, dass
Namen, Pfade und Inhalte byte-genau zurückkommen. Wie die Images entstehen,
steht in `tests/fixtures/erzeuge_fixtures.py`.

```
python -m unittest discover -s datenrettung/tests -t .
```

Die Oberfläche testet `test_gui.py`; unter Linux ohne Bildschirm etwa mit
`xvfb-run python -m unittest datenrettung.tests.test_gui`. Die GitHub-Actions-CI
führt alles unter Linux und Windows aus, unter Windows zusätzlich
`tests/windows_geraete.py` mit echten Laufwerken.
