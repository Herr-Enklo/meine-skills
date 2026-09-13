# Tutto im Browser

Das Würfelspiel Tutto (Reiner Knizia, Abacusspiele) als Webversion in einer einzelnen HTML-Datei. Kein Build, keine Abhängigkeiten, kein Server: `index.html` im Browser öffnen und spielen.

## Spielen

- Datei `tutto/index.html` öffnen (Doppelklick oder per Webserver ausliefern).
- Zwei bis sechs Spieler, jeder wahlweise Mensch oder Computer. Mehrere Menschen spielen am selben Gerät reihum.
- Zielpunkte wählbar (3000 bis 10000), Standard sind 6000.
- Der Spielstand wird im Browser gespeichert. Nach einem Neuladen geht es an derselben Stelle weiter.

Die Oberfläche passt sich der Bildschirmbreite an: Auf dem Handy liegen Karte, Würfel und Knöpfe untereinander, auf breiten Bildschirmen nebeneinander. Würfel und Knöpfe sind groß genug für Fingerbedienung.

## Als App auf dem Handy

Das Spiel ist eine installierbare Web-App (PWA). Dafür muss es über eine Webadresse mit HTTPS erreichbar sein, zum Beispiel über GitHub Pages:

1. Im Repo unter Settings → Pages die Quelle „Deploy from a branch“ wählen, Branch `main`, Ordner `/ (root)`.
2. Nach ein bis zwei Minuten liegt das Spiel unter `https://<benutzer>.github.io/meine-skills/tutto/`.
3. iPhone: Seite in Safari öffnen, Teilen → „Zum Home-Bildschirm“. Android: Chrome bietet „App installieren“ an.

Nach dem ersten Öffnen legt der Service Worker (`sw.js`) alle Dateien und die Schriften im Browser ab. Danach startet das Spiel auch ohne Internet vom Home-Bildschirm, randlos und ohne Adressleiste. Bei einer neuen Version die Nummer `CACHE` in `sw.js` erhöhen, damit die Geräte sie beim nächsten Start übernehmen.

Zum Ausprobieren im eigenen WLAN reicht ein lokaler Server im Ordner `tutto`, etwa `python3 -m http.server 8000`, und auf dem Handy die IP des Rechners mit Port 8000. Ohne HTTPS funktioniert dann alles außer dem Offline-Betrieb.

Dateien: `manifest.webmanifest` (Name, Farben, Symbole), `sw.js` (Offline-Cache), `icon.svg` (Vorlage) und die daraus erzeugten `icon-180.png`, `icon-192.png`, `icon-512.png`.

## Regeln

Umgesetzt sind die Regeln der Abacus-Ausgabe mit 6 Würfeln und 56 Karten:

- Punkte: eine 1 = 100, eine 5 = 50, drei gleiche = Zahl × 100, drei Einsen = 1000. Drillinge müssen in einem Wurf fallen. Ein vierter gleicher Würfel zählt nur als einzelne 1 oder 5.
- Nach jedem Wurf muss mindestens ein Würfel mit Punktwert beiseitegelegt werden. Welche, entscheidet der Spieler.
- Null: Ein Wurf ohne Punktwert beendet den Zug, alle Punkte des Zuges gehen verloren.
- Tutto: Alle sechs Würfel liegen beiseite. Der Spieler darf eine neue Karte aufdecken und mit sechs Würfeln weitermachen oder aufhören.
- Karten: 25 × Bonus (200 bis 600, je 5), 5 × Verdopplung, 5 × Feuerwerk, 5 × Straße, 5 × Plus/Minus, 1 × Kleeblatt, 10 × Stop.
- Spielende: Wer das Ziel erreicht, löst die letzte Runde aus, damit alle gleich oft am Zug waren. Danach gewinnt der höchste Punktestand. Zwei Tutto hintereinander mit dem Kleeblatt gewinnen sofort.

Die vollständigen Regeln mit Kartenübersicht stehen im Spiel unter „Regeln“.

## Grafik und eigene Bilder

Die Original-Illustrationen der Abacus-Ausgabe sind urheberrechtlich geschützt und deshalb nicht im Repo. Karten und Würfel sind als SVG im Stil des Originals gezeichnet und direkt in die Datei eingebettet. Die Schriften Baloo 2 und Nunito kommen von Google Fonts; ohne Internet greift die Systemschrift.

Wer die Originalkarten besitzt, kann sie für den eigenen Gebrauch einscannen und in den Ordner `tutto/img/` legen. Sobald dort eine `back.png` liegt, sucht das Spiel beim Start nach folgenden Dateien und verwendet jede vorhandene statt der gezeichneten Grafik:

- Karten: `back.png`, `stop.png`, `bonus200.png`, `bonus300.png`, `bonus400.png`, `bonus500.png`, `bonus600.png`, `x2.png`, `feuerwerk.png`, `strasse.png`, `plusminus.png`, `kleeblatt.png` (Seitenverhältnis 2:3)
- Würfel: `die1.png` bis `die6.png` (quadratisch, am besten mit transparentem Hintergrund)

Fehlende Dateien werden weiter gezeichnet, es müssen also nicht alle vorhanden sein. Der Ordner steht in `.gitignore`, damit die Scans nicht versehentlich veröffentlicht werden.

## Computerspieler

Der Computer nimmt Einsen und Drillinge immer, lässt einzelne Fünfen aber liegen, wenn danach noch mindestens drei Würfel frei sind. Er würfelt weiter, solange vier oder mehr Würfel frei sind, und wird mit sinkender Würfelzahl und steigendem Risiko vorsichtiger. Nach einem Tutto zieht er eine neue Karte, wenn im Zug weniger als 800 Punkte liegen.
