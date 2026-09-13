# Tutto im Browser

Das Würfelspiel Tutto (Reiner Knizia, Abacusspiele) als Webversion in einer einzelnen HTML-Datei. Kein Build, keine Abhängigkeiten, kein Server: `index.html` im Browser öffnen und spielen.

## Spielen

- Datei `tutto/index.html` öffnen (Doppelklick oder per Webserver ausliefern).
- Zwei bis sechs Spieler, jeder wahlweise Mensch oder Computer. Mehrere Menschen spielen am selben Gerät reihum.
- Zielpunkte wählbar (3000 bis 10000), Standard sind 6000.
- Der Spielstand wird im Browser gespeichert. Nach einem Neuladen geht es an derselben Stelle weiter.

Die Oberfläche passt sich der Bildschirmbreite an: Auf dem Handy liegen Karte, Würfel und Knöpfe untereinander, auf breiten Bildschirmen nebeneinander. Würfel und Knöpfe sind groß genug für Fingerbedienung.

## Regeln

Umgesetzt sind die Regeln der Abacus-Ausgabe mit 6 Würfeln und 56 Karten:

- Punkte: eine 1 = 100, eine 5 = 50, drei gleiche = Zahl × 100, drei Einsen = 1000. Drillinge müssen in einem Wurf fallen. Ein vierter gleicher Würfel zählt nur als einzelne 1 oder 5.
- Nach jedem Wurf muss mindestens ein Würfel mit Punktwert beiseitegelegt werden. Welche, entscheidet der Spieler.
- Null: Ein Wurf ohne Punktwert beendet den Zug, alle Punkte des Zuges gehen verloren.
- Tutto: Alle sechs Würfel liegen beiseite. Der Spieler darf eine neue Karte aufdecken und mit sechs Würfeln weitermachen oder aufhören.
- Karten: 25 × Bonus (200 bis 600, je 5), 5 × Verdopplung, 5 × Feuerwerk, 5 × Straße, 5 × Plus/Minus, 1 × Kleeblatt, 10 × Stop.
- Spielende: Wer das Ziel erreicht, löst die letzte Runde aus, damit alle gleich oft am Zug waren. Danach gewinnt der höchste Punktestand. Zwei Tutto hintereinander mit dem Kleeblatt gewinnen sofort.

Die vollständigen Regeln mit Kartenübersicht stehen im Spiel unter „Regeln“.

## Grafik

Die Original-Illustrationen der Abacus-Ausgabe sind urheberrechtlich geschützt und deshalb nicht enthalten. Karten und Würfel sind als SVG im Stil des Originals nachgezeichnet und direkt in die Datei eingebettet. Die Schriften Baloo 2 und Nunito werden von Google Fonts geladen; ohne Internet greift die Systemschrift.

## Computerspieler

Der Computer nimmt Einsen und Drillinge immer, lässt einzelne Fünfen aber liegen, wenn danach noch mindestens drei Würfel frei sind. Er würfelt weiter, solange vier oder mehr Würfel frei sind, und wird mit sinkender Würfelzahl und steigendem Risiko vorsichtiger. Nach einem Tutto zieht er eine neue Karte, wenn im Zug weniger als 800 Punkte liegen.
