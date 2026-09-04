# Star Raider

Ein eigenständiger Retro-Weltraum-Shooter im Geist der alten Nokia-Handyspiele
("Space Impact" & Co.) – als einzelne, abhängigkeitsfreie HTML-Datei.

Einfach `index.html` im Browser öffnen, es wird nichts installiert oder
nachgeladen. Funktioniert auch offline und auf dem Handy (Touch-Steuerung
inklusive).

## Spielprinzip

Das Schiff bewegt sich frei im linken Teil des Bildschirms (wie beim Original),
schießt nach rechts und muss zehn unterschiedliche Sektoren durchqueren.

- **10 Sektoren** mit eigenem Hintergrund, eigenem Gegnermix und eigenem
  Endboss:

  | # | Sektor | Gegner | Boss |
  |---|---|---|---|
  | 1 | Asteroidenfeld | Drohnen, Asteroiden | Gesteinsbrecher (Bohrkopf, Rammangriff) |
  | 2 | Alien-Schwarm | Späher, Spinner | Bienenkönigin (spawnt Drohnen) |
  | 3 | Trümmerfeld | Geschütztürme, Kamikaze, Bomber | Wächter (nur bei offenem Kern verwundbar) |
  | 4 | Eisgürtel | Eissplitter, Drohnen, Späher | Frostkoloss (Panzerplatten, Splitterwelle) |
  | 5 | Plasmasturm | Plasmakugeln, Spinner, Jäger | Sturmauge (rotierendes Dauerfeuer) |
  | 6 | Schrottpresse | Geschütztürme, Bomber, Kamikaze | Schrottpresse (zuschlagende Backen) |
  | 7 | Biozone | Würmer, Plasmakugeln, Drohnen | Brutmutter (spawnt Würmer) |
  | 8 | Kriegsflotte | Jäger, Elite, Geschütztürme | Fregatte (drei zielende Geschütze) |
  | 9 | Singularität | Phantome, Kamikaze, Plasmakugeln | Singularität (zieht dich in sich hinein) |
  | 10 | Dunkle Zone | Elite, Phantome, Würmer, Kamikaze | Overmind (drei Phasen) |

  Eissplitter zerbrechen beim Abschuss in zwei kleinere Splitter, Phantome
  tarnen sich im Rhythmus, Kamikaze-Flieger zielen kurz und stürzen dann.
  Nach jedem dritten Sektor gibt es ein Schiff dazu.
- **Waffen-Extras** fallen von besiegten Gegnern und ersetzen bzw. verbessern
  die aktuelle Waffe (bis Stufe 3): Streuschuss, Schnellfeuer, Laser
  (durchschlagend) und homing Raketen (mit Explosionsradius). Dazu Schild
  (kurzzeitig unverwundbar), Reparatur und Extraleben.
- **Gegnerische Schüsse lassen sich abschießen.** Jeder Treffer neutralisiert
  ein Projektil und bringt Punkte. Schwere Geschosse (Minen, Boss-Brocken,
  gepanzerte Kugeln mit Ring) halten mehrere Treffer aus, der Laser räumt mit
  seiner Durchschlagskraft ganze Reihen ab.
- Bei einem Treffer bis auf 0 Energie geht ein Leben verloren und die Waffe
  wird auf die Standardwaffe zurückgesetzt – Risiko und Belohnung wie im
  Original.

## Steuerung

| Aktion | Tastatur | Touch |
|---|---|---|
| Bewegen | Pfeiltasten / WASD | D-Pad |
| Schießen | Leertaste / Z | FEUER-Knopf |
| Pause | P / Esc | PAUSE-Knopf |
| Ton an/aus | M | TON-Knopf |
| Start / Neustart | Enter | Aufs Display tippen |

Highscore wird lokal im Browser gespeichert (`localStorage`).

## Technik

Ein einziges `<canvas>` (320×200 Pixel, pixelig auf bis zu 960 Pixel Breite
hochskaliert) ohne externe Bibliotheken, Bilder oder Fonts. Alles wird zur
Laufzeit erzeugt:

- **Eigener 5×7-Bitmap-Font** (inklusive Umlaute) für HUD, Menü und Banner
- **Pixel-Sprites** für Schiff und Gegner, als Zeichen-Raster im Code definiert
  und einmalig in Offscreen-Canvas gerendert, dazu eine weiße Variante für den
  Trefferblitz
- **Prozedurale Bosse** mit rotierenden Teilen, öffnendem Kern, schlagenden
  Flügeln und einem Auge, das den Spieler verfolgt
- **Geschichtete Hintergründe** je Sektor: Farbverlauf, Nebelschwaden,
  Himmelskörper, treibende Trümmer und drei Sternenebenen
- Explosionen aus Ring, Blitz, Funken, Rauch und Trümmern, dazu Bildschirm-
  Wackeln und Trefferblitze

Sound sind kurze WebAudio-Bleeps, passend zum monophonen Nokia-Gefühl.
