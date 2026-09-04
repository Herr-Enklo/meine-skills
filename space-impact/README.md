# Star Raider

Ein eigenständiger Retro-Weltraum-Shooter im Geist der alten Nokia-Handyspiele
("Space Impact" & Co.) – als einzelne, abhängigkeitsfreie HTML-Datei.

Einfach `index.html` im Browser öffnen, es wird nichts installiert oder
nachgeladen. Funktioniert auch offline und auf dem Handy (Touch-Steuerung
inklusive).

## Spielprinzip

Das Schiff bewegt sich frei im linken Teil des Bildschirms (wie beim Original),
schießt nach rechts und muss vier unterschiedliche Sektoren durchqueren.

- **4 Sektoren** mit eigenem Hintergrund, eigenen Gegnertypen und einem
  eigenen Endboss:
  1. **Asteroidenfeld** – Drohnen und drehende Asteroiden, Boss: Gesteinsbrecher
  2. **Alien-Schwarm** – Späher im Zickzack und Spinner mit Streufeuer,
     Boss: Bienenkönigin (spawnt Drohnen nach)
  3. **Trümmerfeld** – zielende Geschütztürme, Kamikaze-Flieger und
     Minen-Bomber, Boss: Wächter (nur bei geöffnetem Schild verwundbar)
  4. **Dunkle Zone** – Elite-Jäger mit Doppelkanonen, Boss: Overmind
     (mehrere Phasen, wird bei sinkender Energie aggressiver)
- **Waffen-Extras** fallen von besiegten Gegnern und ersetzen bzw. verbessern
  die aktuelle Waffe (bis Stufe 3): Streuschuss, Schnellfeuer, Laser
  (durchschlagend) und homing Raketen (mit Explosionsradius). Dazu Schild
  (kurzzeitig unverwundbar), Reparatur und Extraleben.
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

Ein einziges `<canvas>` (240×160 Pixel, pixelig hochskaliert) ohne externe
Bibliotheken, Bilder oder Fonts – Gegner, Bosse, Schiff und Effekte werden
per 2D-Canvas-Zeichenbefehlen direkt gezeichnet. Sound sind kurze
WebAudio-Bleeps, passend zum monophonen Nokia-Gefühl.
