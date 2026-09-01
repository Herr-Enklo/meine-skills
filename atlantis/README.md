# Die Siegel von Atlantis

Ein Zeigen-und-Klicken-Abenteuer im Stil der frühen 1990er, spielbar im Browser. 1938 folgt
der Archäologe Adrian Falk einer gestohlenen Figur von Whitmore College über New York nach
Alexandria, Knossos, Eridu und Thera bis in die Ringe von Atlantis. Die Handlung ist erfunden,
die Mythen und Kulturen sind echt: Platons Atlantis, Solon in Sais, das Totengericht, das
Labyrinth von Knossos, die Sintflut des Gilgamesch-Epos, die Apkallu, der Ausbruch von Thera.
Ein Kodex im Spiel erklärt sie kurz und ohne Ausschmückung.

## Spielen

`index.html` im Browser öffnen. Es gibt keinen Build-Schritt und keine Abhängigkeiten; alle
Grafiken werden zur Laufzeit aus Formen gezeichnet. Ein lokaler Webserver ist nicht nötig, hilft
aber, falls der Browser lokale Dateien einschränkt:

```
cd atlantis
python3 -m http.server 8000
```

Dann `http://localhost:8000/` aufrufen. `dist/atlantis.html` ist dieselbe Fassung als einzelne
Datei mit eingebettetem CSS und JS, zum Weitergeben oder Öffnen ohne Webserver
(neu erzeugen mit `node tools/bundle.mjs`).

Bedienung wie bei den Klassikern: unten ein Verb wählen (Gib, Öffne, Schließe, Nimm, Schau an,
Rede mit, Benutze, Drücke, Ziehe), dann ein Objekt in der Szene oder im Inventar anklicken.
Ohne Verb läuft Falk zum angeklickten Punkt. Rechte Maustaste schaut an. Leertaste überspringt
Text, Esc öffnet das Menü mit Speichern und Laden, T das Tagebuch mit Aufgaben und Kodex.
Der Spielstand wird nach jeder Aktion automatisch gesichert („Fortsetzen“ im Menü), dazu gibt
es sechs Speicherplätze im Browserspeicher.

## Umfang

Sieben Kapitel mit 33 Räumen: Whitmore College, New York, Alexandria und Sais, Kreta,
Eridu, Thera, Atlantis. Rätsel mit Gegenständen, Gesprächen, einem Labyrinth, Keilschrift,
einem Ringschloss und einem Faustkampf. Die Lösung des Ringschlosses ist je Spielstand anders.

## Aufbau

```
index.html            Einstieg, lädt alle Skripte in fester Reihenfolge
css/style.css         Verbleiste, Inventar, Menü, Tagebuch
js/engine/            Spielkern: Räume, Figuren, Wegfindung, Dialoge, Oberfläche, Rätsel, Ton
js/art/               Zeichenbibliothek und Inventarsymbole
js/data/              Figuren, Gegenstände, Kodex, Story-Rahmen, Reisekarte
js/data/rooms/        ein Skript je Kapitel mit allen Räumen, Hotspots und Dialogen
docs/ENGINE.md        Referenz der Engine-API
docs/DESIGN.md        Story, Rätselketten und Verträge zwischen den Kapiteln
test/                 automatischer Durchlauf der Komplettlösung mit Playwright
```

## Tests

Der Durchlauf spielt das ganze Spiel im Testmodus (ohne Wartezeiten) durch und prüft nach jedem
Schritt Raum, Inventar und Flags. Er braucht Node, dazu global installiert `playwright`
(mit Chromium) und `http-server`.

```
./run-tests.sh                       # alle Kapitel hintereinander
./run-tests.sh --chapter=Kreta       # ein Kapitel mit vorbereitetem Spielstand
./run-tests.sh --shots               # dazu ein Screenshot je Raum
node test/preview.mjs                # Screenshots im normalen Spielmodus
node test/lint.mjs                   # statische Prüfung aller Räume (Ausgänge, Laufpunkte, Symbole)
```

Für die drei Node-Skripte muss `NODE_PATH` auf das globale `node_modules` zeigen
(`NODE_PATH=$(npm root -g)`), `run-tests.sh` setzt das selbst.

Die Schrittlisten in `test/steps_*.mjs` sind zugleich die Komplettlösung.
