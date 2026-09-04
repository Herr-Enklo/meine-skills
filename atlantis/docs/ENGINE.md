# Engine-Referenz

Alles hängt am globalen Objekt `ATL`. Es gibt keinen Build-Schritt, die Dateien werden in
`index.html` in fester Reihenfolge geladen: `engine/*`, `art/*`, dann `data/chars.js`,
`data/items.js`, `data/codex.js`, `data/story.js`, zuletzt `data/rooms/*.js`. Ein Raumkapitel
darf daher alles aus Engine, Art-Bibliothek, Figuren, Gegenständen und Story benutzen.

Die Szene ist 960×600 Pixel groß. Darunter liegt die Verbleiste (DOM). Koordinaten in
Raumdefinitionen sind Szenenkoordinaten; bei breiteren Räumen (`width` > 960) scrollt die
Kamera mit der Spielfigur.

## Raum definieren

```js
ATL.rooms.define({
  id: 'eg_harbor',            // eindeutig, Präfix je Kapitel: p_, ny_, eg_, cr_, me_, th_, at_
  name: 'Hafen von Alexandria',
  ambient: 'egypt',           // Hintergrundklang: college, city, egypt, crete, mesopotamia, thera, atlantis, map, none
  width: 1400,                // optional, für scrollende Räume
  start: [200, 520, 'r'],     // Startposition, wenn goto ohne Koordinaten aufgerufen wird
  walk: [[x0,y0, x1,y1, ...], ...],   // begehbare Polygone (flache Koordinatenlisten), Fußpunkt der Figur
  scale: { y0: 400, s0: 0.75, y1: 585, s1: 1.05 },  // Größe der Figur je nach y (linear)
  paint(ctx, g) { ... },      // statischer Hintergrund, wird beim Betreten und nach g.repaint() gemalt
  paintFront(ctx, g) { ... }, // optional: Vordergrund, der über den Figuren liegt (auch gecacht)
  animate(ctx, t, g) { ... }, // optional: jedes Bild nach dem Hintergrund (Fackeln, Wasser, Staub)
  animateFront(ctx, t, g) {}, // optional: jedes Bild über den Figuren
  update(g, dt) {},           // optional: Logik je Bild
  hotspots: [ ... ],          // siehe unten; kann auch ein Getter `get hotspots() { ... }` sein
  exits: [ ... ],
  actors: [ ... ],            // Nebenfiguren im Raum
  async enter(g) { ... },     // nach dem Einblenden; hier laufen Zwischensequenzen beim ersten Betreten
  leave(g) { ... },           // beim Verlassen
  noHero: true,               // Spielfigur nicht zeichnen (Karte, Titel)
  atmos: ['sea', 'birds'],    // optional: Klangatmosphären (sea wind cave birds city market fire lava machine water room); sonst Vorgabe je Raum in audio.js
  surface: 'sand',            // optional: Bodenart für Schritte (stone wood sand grass water metal)
  grade: { color: '#ffc058', alpha: 0.16 },  // optional: Farbstimmung über der Szene (null = keine); sonst Vorgabe je ambient in fx.js
  actorTint: 'rgba(60,190,210,0.3)',        // optional: Raumlicht auf den Figuren (null = keins)
  particles: { n: 30, color: 'rgba(255,200,120,A)', size: 2, vy: -12, vx: 4, alpha: 0.4, twinkle: true },  // optional: Partikel (A = Platzhalter für die Deckkraft)
});
```

Der Fußpunkt (x, y) der Spielfigur liegt am unteren Bildrand des Bodens. Eine Figur ist bei
Skalierung 1 rund 150 Pixel hoch. Typische Werte: Boden von y=400 bis 585, Skalierung 0,75
bis 1,05. Die Wegfindung rastert die Polygone in 8-Pixel-Zellen; sehr schmale Gänge (unter
16 Pixel) sind unpassierbar. Hindernisse werden durch die Polygonform ausgespart, oder zur
Laufzeit mit `g.blockWalk(id, poly)` / `g.unblockWalk(id)`.

### Hotspots

```js
{
  id: 'waage', name: 'Steinwaage',        // name darf auch (g) => string sein
  rect: [x, y, w, h],                    // oder poly: [x0,y0,x1,y1,...]
  at: [x, y, 'u'],                       // wohin die Figur läuft und wohin sie schaut (l r u d); ohne at: unter das Rechteck
  cond: (g) => !g.flag('tuer_offen'),    // optional: nur vorhanden, wenn wahr
  z: 500,                                // optional: Sortier-y für paint (dann wird der Hotspot zwischen den Figuren gezeichnet)
  paint(ctx, g, t) { ... },              // optional: dynamische Zeichnung je Bild (z. B. Gegenstand, solange er nicht genommen ist)
  noWalk: true,                          // optional: Figur läuft nicht hin
  walkToLook: true,                      // optional: auch bei „Schau an“ hinlaufen (Standard: nein)
  // Verben: Text (Falk sagt ihn), Array von Zeilen (siehe g.talk) oder async Funktion (g, ziel, gegenstandId)
  look: 'Eine Waage aus Stein.',
  take: 'Zu schwer.',
  use: async (g) => { ... },
  open, close, push, pull, talk, give,   // ebenso
  useWith: { feder: async (g) => { ... }, default: 'Das passt nicht.' },   // „Benutze <Gegenstand> mit Hotspot“
  giveWith: { muenzen: async (g) => { ... } },                          // „Gib <Gegenstand> an Hotspot“
}
```

Gibt eine Handler-Funktion einen String zurück, sagt Falk ihn. Fehlt ein Verb, kommt eine
Standardantwort („Das geht nicht.“ usw.). Ein Handler bekommt `(g, ziel, gegenstandId)`.

### Ausgänge

```js
{ id: 'tuer', name: 'Tür zum Basar', rect: [...], at: [x, y, 'u'],
  to: 'eg_bazaar', pos: [120, 520], dir: 'r',          // Zielraum, Position und Blickrichtung dort
  look: '...',
  before: async (g) => { ... return false; },          // optional: false verhindert den Wechsel
  useWith: { schluessel: async (g) => { ... } } }      // Ausgänge nehmen die gleichen Verben wie Hotspots
```

Überlappen sich Hotspot und Ausgang, gewinnt beim Klick der höhere `z`-Wert; Standard ist 1
für Hotspots, 0 für Ausgänge, 5 für Figuren. Ein Ausgang, der über einem Hotspot liegen soll,
bekommt also zum Beispiel `z: 2`.

Ein Ausgang zurück zur Reisekarte sieht so aus:

```js
{ id: 'karte', name: 'Zum Hafen', rect: [...], at: [...],
  before: async (g) => { await ATL.story.openMap(g, 'alexandria'); return false; } }
```

### Figuren im Raum

```js
actors: [
  { id: 'amina', x: 600, y: 480, dir: 'l', cond: (g) => !g.flag('amina_weg'),
    name: 'Amina',                     // optional, sonst Name aus chars.js
    look: 'Die Bibliothekarin.',
    talk: 'amina',                     // Dialog-Kennung, Text (Falk sagt ihn) oder Funktion (g) => g.dialog('amina')
    at: [560, 500, 'r'],               // optional: wo Falk stehen bleibt
    giveWith: { katalogkarte: async (g) => { ... } },
    useWith: { ... } }
]
```

Figuren sind in `js/data/chars.js` definiert (`ATL.chars.define(id, {name, color, look})`).
Neue Figuren kann ein Kapitel in seiner eigenen Datei ergänzen. Aussehen (`look`):
`skin, hair, hairStyle (short|long|bald|bun|slick|grey), hat (none|fedora|pith|cap|fez|turban|beret|officer|headscarf|crown|hood),
hatColor, top, topStyle (jacket|shirt|dress|robe|uniform|vest|coat), topInner, bottom, shoes, face (none|beard|moustache|goatee),
glasses, glassesColor, eyes (Irisfarbe), build (slim|normal|heavy), height (Faktor), tie, satchel (Umhängetasche), apron (Schürzenfarbe), scarf, necklace`.

## Skript-API (g = Spielobjekt)

```js
await g.say('falk', 'Text');                 // Sprechblase, klickbar überspringbar
await g.talk([['livia', 'Hallo.'], ['falk', 'Hallo.'], 'Erzählertext', async (g) => {...}]);
await g.message('Erzählertext', ms);         // Text unten in der Mitte
await g.wait(800);                           // Pause (im Testmodus 0)
await g.walk('falk', x, y, 'l');             // Figur laufen lassen (liefert false, wenn unterbrochen)
g.place('kessler', x, y, 'l');  g.hide('kessler');  g.inRoom('kessler');
g.face('falk', 'l');  g.face('falk', 'livia');  g.anim('falk', 'reach' | 'crouch' | 'stand');
await g.goto('eg_temple', x, y, 'u');        // Raumwechsel mit Ein-/Ausblenden
g.flag('x');  g.set('x');  g.set('x', 5);  g.set('x', false);  g.inc('zaehler');
g.has('feder');  g.hasAll('a', 'b');  g.take('feder');  g.drop('feder');
g.codex('maat');                             // Kodexeintrag freischalten (Kennungen in codex.js)
g.objective('Das Siegel der Sonne finden.'); // neue Aufgabe im Tagebuch, die vorige gilt als erledigt
g.repaint();                                 // Hintergrund neu malen (nach Zustandsänderung)
g.dark = 0.85;                               // Dunkelheit über der Szene (0 = hell); beim Raumwechsel zurücksetzen
g.fx('door');                                // click pickup drop door stone water success fail punch hum glow thunder bell step whoosh
g.hs('waage')                                // Hotspot-Definition des aktuellen Raums holen
g.hero                                       // die Spielfigur (Actor): x, y, dir, anim, offsetY, fixedScale
await g.scene(async () => { ... });          // Zwischensequenz: Verbleiste aus, Klick überspringt nur Text
await g.dialog('amina');                     // Gespräch führen
await g.puzzle('note', { title, text });     // Schriftstück lesen
```

Innerhalb von `enter` und Handlern immer `await` benutzen, sonst laufen Sequenzen durcheinander.
Im Testmodus (`g.fast`) sind alle Wartezeiten null, Laufen ist ein Sprung, Rätsel-Einblendungen
liefern sofort ihr Erfolgsergebnis. Skripte müssen damit auskommen (also keine Timer außerhalb
von `g.wait`).

## Dialoge

```js
ATL.dialogs.define('amina', {
  start: 'root',
  nodes: {
    root: {
      say: [['amina', 'Kann ich helfen?']],         // optional: Zeilen beim Betreten des Knotens
      options: [
        { text: 'Ich suche den Bericht über Sais.', once: true,
          cond: (g) => !g.has('bericht'),
          say: [['amina', 'Die Karte dazu fehlt.'], ['falk', 'Wer hat sie?']],
          action: async (g) => { g.set('amina_karte_fehlt'); },
          next: 'root' },                            // Folgeknoten (Standard: derselbe Knoten)
        { text: 'Auf Wiedersehen.', end: true, say: [['amina', 'Viel Glück.']] },
      ],
    },
  },
});
```

Falk spricht die gewählte Option selbst aus (`silent: true` unterdrückt das, `line: '...'` ersetzt
den gesprochenen Text). `once` blendet die Option nach Gebrauch dauerhaft aus. Ein Knoten ohne
wählbare Optionen beendet das Gespräch. Im Testmodus wählt `g.testChooser` aus den Optionen;
der Testlauf legt Antworten mit `['queue', 'regex', ...]` vor und nimmt sonst die Option mit `end`.

## Gegenstände

```js
ATL.items.define({ id: 'feder', name: 'Straußenfeder', look: 'Text oder (g) => Text',
  use: async (g) => {...},              // „Benutze Gegenstand“ ohne Ziel
  useWith: { kohle: async (g) => {...} } // Kombination zweier Inventargegenstände
});
ATL.icons.feder = (ctx, item) => { ... };   // 48×48-Symbol, sonst Platzhalter mit Anfangsbuchstabe
```

Die meisten Gegenstände des Spiels sind in `js/data/items.js` mit Symbolen in `js/art/icons.js`
vorhanden. Fehlende Gegenstände definiert das Kapitel in seiner Raumdatei (Icons ebenfalls dort
über `ATL.icons.<id> = ...`). Ein Gegenstand, der wie ein anderer aussieht, kann `icon: 'uebersetzung'` setzen.

## Rätsel-Einblendungen (`await g.puzzle(name, opts)`)

- `note` `{title, text}` – Schriftstück lesen. Liefert true.
- `symbols` `{title, text, symbols: [{name, draw(ctx,x,y,r)}], solution: [i,i,i,i], start?}` – Blöcke durchklicken. Liefert true, 'wrong' oder false (abgebrochen).
- `catalog` `{title, text, drawers: [{label, cards: [{id, text}]}], answer}` – Zettelkasten. Liefert die Karten-Kennung oder null; im Testmodus `answer`.
- `cuneiform` `{title, text, signs: [{glyph: 0..7, syl: 'e'}], choices: ['e','a',...], tableGlyphs: [{glyph, syl}]}` – Zeichen Silben zuordnen. Liefert true, 'wrong' oder false.
- `dial` `{solution: ATL.story.solution(g)}` – das Ringschloss der drei Siegel. Liefert true oder false.
- `maze` `{thread: true|false, seed}` – Labyrinth von oben. Liefert true (Mitte erreicht), false (umgekehrt) oder 'lost'.
- `fight` `{enemy: 'Kessler', enemyHp, damage, enemyDamage}` – Faustkampf. Liefert true (gewonnen) oder false.
- `choose` `{title, text, options: [...], testAnswer}` – einfache Auswahl. Liefert Index oder -1.

`ATL.puzzles.SYMBOLS` sind die acht Symbole des Ringschlosses (`id, name, riddle, draw`).
`ATL.puzzles.wedgeGlyph(ctx, x, y, size, kind)` zeichnet ein Keilschriftzeichen 0–7.

## Zeichenbibliothek `ATL.A` (Auszug)

Grundformen: `rect, rr (Rundrechteck), poly, ell, circle, line, path, text, grad, rgrad`.
Landschaft: `sky, stars, sun, moon, clouds, mountains, hills, sea, waterAnim(t), ground, floorTiles, planks, dune`.
Bauwerk: `wall, bricks, stones, column(style doric|egypt|minoan|atlantis), door({open, arch, panel, frame}), window({frame, light, view}), arch, stairs, ladder, pyramid, ziggurat`.
Einrichtung: `crate, barrel, table, chair, shelf, books, rug, rope, chain, gear, crystal, seal(kind sun|bull|flood)`.
Natur: `palm, tree, cypress, bush, rock`.
Licht: `glow, torch(t), candle(t), lantern(t, lit), lightBeam, dust(t), shadeRect, vignette, grain`.
Ornament: `hieroglyphs, cuneiform, meander, spirals, fresco, statue(style standing|seated|ibis|crown|trident)`.
Fahrzeuge: `boat, ship, jeep, tent`.
Ausschmückung: `amphora(x, baseY, h, color), pot, basket, sack, bottle, cobweb(x, y, r, 'tl'|'tr'|'bl'|'br'), cracks, moss, grass, pebbles, rubble, birds(x, y, n, t), smoke(x, y, t), flag(x, y, w, h, t), curtain(x, y, w, h, color, t), sign(x, y, w, h, text), lamppost(x, baseY, h, t, lit), papyrus, painting(x, y, w, h, seed), vines(x, y, h, seed), puddle, railing, awning(x, y, w, h, c1, c2), insects(x, y, w, h, t, n), bones`.
`ATL.A.shade('#rrggbb', -0.3)` dunkelt eine Farbe ab, positive Werte hellen auf.
`ATL.U.rng(seed)` liefert einen deterministischen Zufallsgenerator für Texturen.

Ein Raum sollte rund 60 bis 120 Zeilen Malcode haben: Himmel oder Wand, Boden mit Perspektive,
drei bis sechs große Formen, Details, dann `vignette` und `grain`. Objekte, die verschwinden
können (Gegenstände), werden abhängig von Flags gemalt, gefolgt von `g.repaint()` beim Nehmen,
oder als Hotspot mit `paint` und `cond`.

## Testlauf

`./run-tests.sh --chapter=<Name> --shots` startet einen Kopfloser-Browser, lädt das Spiel im
Testmodus und führt `setup` und `steps` aus `test/steps_<kapitel>.mjs` aus. Screenshots
landen im Verzeichnis aus `--shotdir=` (Standard: `$SCRATCH/atl-shots`). Ohne `--chapter`
laufen alle Kapitel hintereinander ohne `setup`. Schrittarten stehen in `test/steps_prolog.mjs`.
`setup` bereitet den Einzeltest vor, zum Beispiel:

```js
export const setup = [
  ['eval', "g.take('perle',{silent:true}); g.take('medaillon',{silent:true}); g.set('ny_fertig'); g.set('ort','alexandria');"],
  ['goto', 'eg_harbor', 200, 520, 'r'],
];
```

Der Testmodus lässt `g.say` sofort zurückkehren und protokolliert die Zeilen in `g.log`.
