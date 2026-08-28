# Zahl 33 auf DIN A4 (Eukalyptus-Motiv)

Druckvorlage: die Zahl 33, gelegt aus Silberdollar-Eukalyptusblättern, nach dem
Layout eines Eukalyptus-Fotos (hängende Zweige, rundliche graugrüne Blätter).
Die Zahl nimmt etwa drei Viertel der Seitenhöhe ein.

## Dateien

| Datei | Zweck |
|---|---|
| `zahl-33-eukalyptus-a4.pdf` | Druckdatei, exakt DIN A4 hoch, randlos angelegt |
| `zahl-33-eukalyptus-a4-300dpi.png` | Pixelversion, 2480 × 3508 px (300 dpi) |
| `generator.html` | Quelle; erzeugt das Motiv beim Öffnen im Browser neu |

## Drucken

Das PDF ist randlos angelegt. Beim Druck mit Rand „An Seite anpassen"
deaktivieren und stattdessen „Tatsächliche Größe" wählen; der Drucker
schneidet dann am Papierrand einen schmalen Streifen Hintergrund ab, das
Motiv selbst liegt weit genug innen.

## Neu erzeugen

`generator.html` im Browser öffnen; das Bild wird beim Laden gezeichnet
(Canvas, 300 dpi, fester Zufalls-Seed, daher reproduzierbar). Mit dem
URL-Parameter `?seed=1234` entsteht eine andere Blattanordnung bei gleichem
Aufbau. Headless gerendert wird so:

```
chromium --headless=new --no-pdf-header-footer --virtual-time-budget=40000 \
  --print-to-pdf=zahl-33-eukalyptus-a4.pdf generator.html

chromium --headless=new --hide-scrollbars --window-size=2480,3508 \
  --virtual-time-budget=40000 --screenshot=zahl-33-eukalyptus-a4-300dpi.png \
  "generator.html?raw=1"
```
