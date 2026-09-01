# Die Siegel von Atlantis – Spieldesign

Ein Zeigen-und-Klicken-Abenteuer im Stil von 1992, spielbar im Browser. Sprache: Deutsch.
Die Handlung ist erfunden, die Mythen und Kulturen sind echt und werden im Kodex sachlich erklärt.

## Figuren

- **Dr. Adrian Falk** (`falk`): Archäologe am Whitmore College, Vermont. Trocken, skeptisch, nicht unfreundlich. Sagt Dinge wie „Das ist nicht weiter interessant.“ statt Ausrufe.
- **Dr. Livia Marsh** (`livia`): Mythologin, Falks frühere Grabungspartnerin. Sie glaubt an eine Wahrheit hinter Platons Erzählung, er nicht. Die beiden haben sich 1932 auf Thera zerstritten. Sie ist schlagfertig und gibt in jedem Kapitel Hinweise, wenn man mit ihr redet.
- **Professor Aldous Greaves** (`greaves`): Institutsleiter, geldknapp.
- **Konrad Vesper** (`vesper`): Vorsitzender der Meridian-Gesellschaft in Berlin. Glaubt, die Atlanter hätten eine Kraftquelle besessen (Orichalkum), und will sie sich aneignen. Kühl, gebildet, spricht in ganzen Sätzen, nie laut.
- **Kessler** (`kessler`): Vespers Mann fürs Grobe. Taucht in mehreren Kapiteln auf.
- Nebenfiguren je Kapitel siehe unten. Alle sind in `js/data/chars.js` angelegt.

## Die drei Siegel

Solon hörte in Sais, dass ein Tor „unter dem brennenden Berg“ (Thera) von drei Siegeln gehütet wird:
Sonne (Ägypten), Stier (Kreta), Flut (Mesopotamien). Auf der Stele in Sais steht, wie die Ringe
des Tors zu drehen sind; der Text ist je Spielstand zufällig (`ATL.story.riddle(g)`, Lösung
`ATL.story.solution(g)`), die Lösung wird erst auf Thera gebraucht.

## Roter Faden

1. **Prolog, Whitmore College**: Kessler holt die Wächterfigur (Apkallu-Figur aus Livias Grabung auf Thera) ab, in der eine Orichalkum-Perle steckt. Falk behält die Perle. (Fertig.)
2. **New York**: Falk findet Livia nach ihrem Vortrag. Vespers Leute haben ihre Garderobe durchsucht; sie hat das atlantische Medaillon versteckt. Perle und Medaillon reagieren aufeinander. Livia: Solon hörte alles in Sais, also Ägypten.
3. **Ägypten**: Bericht über Sais in der Bibliothek, Tempel der Neith, Totengerichts-Waage, Kammer der Aufzeichnungen mit Solons Stele und dem Siegel der Sonne.
4. **Kreta** und **Mesopotamien** (Reihenfolge frei): Siegel des Stiers im Labyrinth unter Knossos; Siegel der Flut im Abzu unter der Zikkurat von Eridu.
5. **Thera**: Vespers Jacht liegt im Hafen. Das Tor bei Akrotiri öffnet sich mit den drei Siegeln. Vesper nimmt Livia gefangen und zwingt Falk, vorauszugehen.
6. **Atlantis**: äußerer Ring, Tempel des Poseidon mit den zehn Königen, Livias Befreiung, die Maschine im Inneren. Vesper tritt in die Verwandlungskammer und wird vernichtet, Atlantis stürzt ein, Falk und Livia entkommen. Epilog auf dem Boot.

## Verträge zwischen den Kapiteln

Reisekarte (`js/data/story.js`, `ATL.story.locations`): Ziele werden freigeschaltet durch

| Ziel | Bedingung | Ankunftsraum, Position |
|---|---|---|
| New York | `kessler_geflohen` | `ny_street`, [200,520], r |
| Alexandria | `ny_fertig` | `eg_harbor`, [200,520], r |
| Kreta | `eg_fertig` | `cr_village`, [160,520], r |
| Eridu | `eg_fertig` | `me_camp`, [160,520], r |
| Thera | drei Siegel im Inventar | `th_harbor`, [200,520], r |

Zurück zur Karte geht es aus dem jeweiligen Ankunftsraum über einen Ausgang mit
`before: async (g) => { await ATL.story.openMap(g, '<kartenziel>'); return false; }`.
Kartenziele heißen `whitmore, newyork, alexandria, kreta, eridu, thera`.

Gegenstände, die Falk aus dem Prolog und New York mitbringt: `taschenmesser, uhr, muenzen, flasche,
seil, perle, visitenkarte, medaillon`. `muenzen` (Kleingeld) wird nie verbraucht; es reicht für
Kleinigkeiten (Feder, Oliven, Raki, Kracher), nicht für Bestechung. `uhr` wird in Ägypten getauscht.
Aus Ägypten bleiben `oellampe` und `schaufel` erhalten und dürfen später benutzt werden.

Kapitelende-Flags: `ny_fertig`, `eg_fertig`, `th_fertig`. Kreta und Mesopotamien gelten als
fertig, wenn das Siegel im Inventar ist. Livia reist immer mit, sie ist aber nur in den unten
genannten Räumen als Figur zu sehen und ansprechbar (Hinweis-Dialoge: was als Nächstes zu tun ist,
je nach Flags; dazu ein oder zwei Mythos-Anmerkungen mit `g.codex`).

Kodex-Kennungen (in `codex.js`): platon, solon, neith, thoth, maat, hieroglyphen, orichalkum,
minotaurus, minoer, stier, thera, gilgamesch, apkallu, eridu, keilschrift, zehnkoenige,
poseidon, ringe, pharos, ariadne. Neue Einträge legt ein Kapitel in seiner Datei über
`Object.assign(ATL.codex, { id: { title, origin, text } })` an; Texte sachlich, keine Ausschmückung,
keine erfundenen Quellen.

## Kapitel 2: New York (`ny_`)

Räume: `ny_street` (Straße vor dem Theater), `ny_alley` (Gasse mit Bühneneingang),
`ny_dressing` (Garderobe), `ny_stage` (Bühne). Nebenfiguren: Türsteher, Würstchenverkäufer,
Zeitungsjunge, Livia.

Lösung: Der Türsteher lässt niemanden ohne Karte hinein, die Karten sind ausverkauft. In der Gasse
ist der Bühneneingang zu; eine Feuerleiter ist hochgeklappt, eine Katze sitzt darauf. Hotdog beim
Verkäufer kaufen (muenzen), Hotdog der Katze geben: sie springt herunter, die Leiter klappt aus,
Falk steigt zum Garderobenfenster hinauf. Garderobe: durchwühlt. Livia kommt nach dem Vortrag
herein (Wiedersehen, Streit, Bündnis). Das Medaillon steckt im Bühnenmodell von Atlantis (Bühne),
Modell mit dem Taschenmesser öffnen, Medaillon nehmen; Perle und Medaillon reagieren; Vision
(Stimme `anaksar`). Kessler und ein Wachmann tauchen auf, Flucht durch die Falltür. Ende:
`ny_fertig`, Livia erklärt Solon und Sais. Aufgabe: „Nach Alexandria reisen und die Aufzeichnungen
von Sais finden.“

## Kapitel 3: Ägypten (`eg_`)

Räume: `eg_harbor` (Hafen von Alexandria, scrollend, Breite 1400), `eg_bazaar` (Basar),
`eg_library` (Bibliothek des Altertumsinstituts), `eg_sais` (Ruinen von Sais im Nildelta),
`eg_temple` (Tempelhalle der Neith, unterirdisch, dunkel), `eg_crypt` (Kammer der Aufzeichnungen).

Nebenfiguren: `hassan` (Bootsführer am Hafen, bringt nach Sais; verleiht `oellampe` und
`schaufel` aus seinem Boot, sobald man ihn angeheuert hat), `farid` (Händler im Basar: verkauft
`feder` für muenzen; hat die gestohlene `katalogkarte` und einen `skarabaeus`, beides gegen Falks
`uhr`), `yusuf` (Schreiber im Basar, übersetzt den `abrieb` gegen ein Gespräch, gibt
`uebersetzung`), `amina` (Bibliothekarin; gibt `papier` und `kohle`, wenn Falk den Bericht hat
und nach dem Kopieren von Inschriften fragt), `livia` (in `eg_library` und `eg_sais`).

Ablauf:
1. Hafen: Livia geht in die Bibliothek. Hassan anheuern (Dialog; er fährt, sobald Falk bereit
   ist). Aus dem Boot `oellampe` und `schaufel` nehmen (nur nach dem Anheuern).
2. Bibliothek: Zettelkasten (`g.puzzle('catalog', ...)`: Schubladen „Nildelta“, „Sais“,
   „Solon“ …); die Karte „Sais, Grabung 1911“ fehlt. Amina: ein Mann in schwarzem Mantel war da,
   und Farid kauft alles, auch Papier.
3. Basar: `uhr` an Farid geben → `katalogkarte` und `skarabaeus`. `feder` kaufen (muenzen).
4. Bibliothek: mit Karte zum Regal IV, Fach 7 → `bericht` (Leiter benutzen). Bericht lesen:
   Statue der Neith blickt auf die Vertiefung. Amina nach Papier fragen → `papier`, `kohle`.
   Kodex: solon, neith, pharos, hieroglyphen.
5. Hafen: Hassan → nach Sais (Ausgang „Boot“, Bedingung: angeheuert).
6. Sais: Statue anschauen, Sandhügel mit `schaufel` freilegen → Steintür mit Waage. Schalen sind
   voll Sand: mit `feder` abfegen. Dann `feder` in die rechte Schale, `skarabaeus` in die linke
   („Herz“). Ausgeglichen → Tür öffnet sich (Kodex maat). Falsche Kombinationen kommentieren.
7. Tempel: dunkel (`g.dark`), `oellampe` benutzen. Thot-Statue, Wandinschrift. `papier` mit der
   Inschrift benutzen (braucht `kohle`) → `abrieb`. Tür mit vier Symbolblöcken
   (`g.puzzle('symbols', ...)`, sechs Symbole: Sonne, Welle, Stier, Ibis, Auge, Schlange;
   Lösung Sonne–Welle–Stier–Ibis). Ohne Übersetzung darf man raten; mit `uebersetzung` steht
   der Text: „Zuerst Re, die Sonne. Dann Nun, das Wasser. Dann Apis, der Stier. Zuletzt Thot, der
   Ibis.“ (`g.set('inschrift_text', ...)` wird beim Übersetzen gesetzt, `uebersetzung` liest es.)
   Kodex: thoth.
8. Basar, Yusuf: `abrieb` geben → `uebersetzung`. (Weg zurück: Sais → Boot → Hafen → Basar; Hassan
   pendelt beliebig oft.)
9. Kammer: Stele (benutzen → Text `ATL.story.riddle(g)` lesen, `solontext` nehmen, Kodex
   platon/solon), Altar mit `sonnensiegel`. Beim Nehmen rieselt Sand aus der Decke, die Tür
   fällt zu (`sand_faelle`). Ausweg: `seil` mit dem Lichtschacht in der Decke benutzen → Falk
   klettert hinaus nach `eg_sais` (Nacht). Livia wartet: Kessler war am Hafen und hat nach ihnen
   gefragt; Zeit zu gehen. Sie deutet den Stelentext: Stier → Knossos, „Weise aus dem Meer“ →
   Apkallu, Eridu. `eg_fertig`. Aufgabe: „Das Siegel des Stiers auf Kreta und das Siegel der
   Flut in Eridu finden.“

## Kapitel 4: Kreta (`cr_`)

Räume: `cr_village` (Fischerdorf an der Nordküste, Kapelle, Ziege), `cr_taverna`,
`cr_knossos` (Palastruinen: Stierfresko, Thronsaal, Kulthörner, Pithoi), `cr_crypt`
(Pfeilerkrypta mit dem Pfeiler der drei Doppeläxte und dem Labyrintheingang), `cr_bullchamber`
(Halle des Stiers am Ende des Labyrinths).

Nebenfiguren: `yannis` (alter Fischer, erzählt gegen `raki` die Geschichte seines Großvaters:
mittlere Doppelaxt drücken), `maria` (Wirtin; verkauft `raki` und `oliven` für muenzen, beliebig
oft), `bramwell` (Colonel a. D., britischer Amateurarchäologe, betrunken; will seinen `hut`
zurück, den die Ziege hat; gibt dafür den `plan`), `eleni` (Kyria Eleni, strickt; gibt das
`wolle`-Knäuel, wenn Falk im Gespräch die Theseus-Geschichte richtig erzählt, Kodex ariadne),
`livia` (in `cr_village`), `kessler` (in `cr_bullchamber`).

Ablauf:
1. Dorf: Ziege kaut auf einem Hut. `oliven` (Taverne) der Ziege geben → `hut`.
2. Taverne: `hut` an Bramwell → `plan` (lesen: Krypta, mittlere Doppelaxt). Eleni → `wolle`.
   `raki` kaufen. Yannis im Dorf mit `raki` → Legende (bestätigt den Plan).
3. Knossos: Fresko anschauen (Kodex stier, minotaurus, minoer). Pithos öffnen → `doppelaxt`.
   Abgang zur Pfeilerkrypta.
4. Krypta: mittlere Doppelaxt am Pfeiler drücken → Bodenplatte öffnet sich, Treppe. Am
   Eingang unten ein Bronzering: `wolle` mit Ring benutzen → `faden`. Gang betreten →
   `g.puzzle('maze', { thread: !!g.flag('faden') })`. true → `cr_bullchamber`; 'lost' oder false →
   zurück in der Krypta („wieder am Anfang“). Ohne Faden sagt Falk vorher, dass er sich ohne
   Faden verlaufen wird, geht aber, wenn man darauf besteht.
5. Halle des Stiers: bronzener Stierkopf, Altar mit Libationsschale, Siegel im geschlossenen
   Maul. `raki` in die Schale gießen → das Maul öffnet sich kurz und schließt sich wieder
   (Raki verbraucht). Hat Falk die `doppelaxt`, klemmt er sie beim Öffnen automatisch hinein
   (`maul_offen`). `stiersiegel` nehmen. Kessler taucht auf: Dialog mit Wahl. Kampf
   (`g.puzzle('fight')`; verloren → Falk rappelt sich auf, Kessler höhnt, neuer Versuch) oder
   List: `oellampe` (Öl auf den Boden, er rutscht aus) oder `wolle`/Faden (er stolpert und
   stürzt in den Schacht der Grube). Danach `kessler_kreta` gesetzt, Rückweg durch das
   Labyrinth automatisch (Faden). Livia im Dorf deutet das Siegel.
6. Rückweg: Dorf → Karte.

## Kapitel 5: Mesopotamien (`me_`)

Räume: `me_camp` (britisch-irakisches Grabungslager bei Eridu: Zelte, Jeep, Funkzelt,
Vorratszelt, Wassertank), `me_ziggurat` (Zikkurat von Eridu, Eingang verschüttet),
`me_archive` (Haus der Tafeln), `me_abzu` (unterirdische Zisterne, der Abzu).

Nebenfiguren: `nabil` (Vorarbeiter; misstrauisch, weil Vespers Leute den früheren Vorarbeiter
bestochen haben; gibt den `kanister` erst frei, wenn Falk die Inschrift des Gründungszylinders
an der Zikkurat gelesen hat), `tom` (Funker, gibt das `syllabar`, wenn man ihn fragt), `livia`
(in `me_camp`).

Ablauf:
1. Lager: Tom → `syllabar`. Nabil → Aufgabe (Zylinder lesen). Jeep hat kein Benzin.
2. Zikkurat (zu Fuß erreichbar): Gründungszylinder → `g.puzzle('cuneiform', ...)` mit dem
   Syllabar (5 Zeichen, Lösung z. B. „e-ri-du-ki“ als Silben) → Nabil im Lager berichten →
   `kanister`. Kodex eridu, keilschrift.
3. `kanister` mit Jeep → `jeep_betankt`. Jeep benutzen → Fahrt zur Zikkurat (Jeep steht dann
   dort, `jeep_an_zikkurat`). `seil` mit dem Ziegelblock vor dem Eingang, `seil` mit dem Jeep
   (oder umgekehrt), Jeep benutzen → Block wird weggezogen, Eingang frei.
4. Archiv: Regale mit Tontafeln, Apkallu-Statue, Fluttafel. `syllabar` mit der Fluttafel →
   zweites Keilschrift-Rätsel → `tafeltext` („Der vierte hält den Schlüssel“). Bronzetür mit
   sieben Weisen: den vierten drücken → Tür auf (Raten erlaubt). Kodex gilgamesch, apkallu.
5. Abzu: Wasserbecken, Podest, Schleusenrad (Zulauf), Abflusstor, Nische hoch in der Wand mit
   dem Siegel, Schilfboot auf einem Sims. Schilfboot ins Wasser schieben, Tor schließen, Rad
   drehen → Wasser steigt, Boot steigt mit → Boot benutzen → `flutsiegel` aus der Nische. Tor
   öffnen → Wasser sinkt. Andere Reihenfolgen kommentieren, nichts blockiert dauerhaft.
6. Lager: Tom hat über Funk gehört, dass Vespers Jacht „Meridian“ in der Ägäis Richtung Thera
   fährt. Livia deutet das Siegel.

## Kapitel 6: Thera (`th_`)

Räume: `th_harbor` (Hafen von Fira unter der Steilküste; Vespers Jacht „Meridian“ liegt draußen,
ihr Beiboot am Steg, bewacht), `th_cliff` (Bucht und Klippenpfad bei Akrotiri, Ziegen mit
Glocken, Wache oben), `th_akrotiri` (Ausgrabung: Häuser unter Bims, Fresken, Vespers Zelte,
das schwarze Tor mit drei Ringen), `th_descent` (Lavaröhre mit atlantischer Hebebühne).

Nebenfiguren: `stavros` (Bootsführer, Zündkerze seines Motors kaputt), `kiosk`
(Kioskbesitzerin: `feuerwerk` und `zigaretten` für muenzen), `wache` (am Steg und oben am
Pfad; zwei Einsätze desselben Figurentyps sind in Ordnung), `vesper`, `kessler`, `livia`
(in `th_harbor`, bis sie gefangen wird).

Ablauf:
1. Hafen: Kracher kaufen. Am Ende des Stegs steht ein Kohlenbecken; `feuerwerk` damit benutzen
   → Knall, die Wache läuft hin → `zuendkerze` aus dem Beiboot nehmen. `zuendkerze` an Stavros
   → er fährt zur Bucht (Ausgang). `zigaretten` an Stavros: er erzählt von den „Deutschen am
   schwarzen Tor“.
2. Bucht: `stein` nehmen, `bimsstein` nehmen. `stein` auf die Ziegen werfen → Glocken, die Wache
   oben geht nachsehen → Pfad frei. Kodex thera.
3. Akrotiri: Fresken (Kodex), in Vespers Zelt `brecheisen`. Tor: die drei Siegel damit benutzen
   (drei Flags oder ein Zähler), dann Tor benutzen → `g.puzzle('dial', { solution:
   ATL.story.solution(g) })`. Hinweis auf `solontext` im Inventar. Erfolg → Tor öffnet sich,
   Zwischensequenz: Vesper, Kessler mit Livia. Vesper erklärt kurz sein Ziel („Was die Atlanter
   konnten, gehört dem, der es sich nimmt.“), nimmt das `medaillon` (Falk verliert es), schickt
   Falk voraus. `livia_gefangen`, `th_fertig`.
4. Abstieg: Hebebühne mit leerem Sockel. `perle` in den Sockel → Summen, Hebel ziehen →
   Bühne fährt ab → `at_outer` (Ankunft [200,520] r). Perle bleibt im Sockel (Falk verliert sie).
   Kodex orichalkum, ringe. Unten trennt ein Steinschlag Falk vom Schacht; Vespers Leute kommen
   auf anderem Weg nach.

## Kapitel 7: Atlantis (`at_`)

Räume: `at_outer` (äußerer Ring, scrollend, Breite 1600: Kanal mit leuchtendem Wasser,
Zyklopenmauern, hochgezogene Brücke, Podest mit drei Sockeln, ein toter Maschinenkrebs),
`at_middle` (Tempel des Poseidon: Standbild auf dem Wagen mit sechs geflügelten Pferden, zehn
Königsstatuen mit Namen auf griechisch, Altar, Tür ins Innere, Seitentür zu den Zellen),
`at_prison` (Zellen; Livia hinter Energiegittern, Kessler wacht), `at_inner` (das Herz: die
Maschine, Konsole mit drei Siegelschlitzen und Hebel, die Verwandlungskammer), `at_escape`
(Zusammenbruch, Flucht zur Hebebühne; Zwischensequenz), `at_epilog` (Stavros' Boot bei
Sonnenuntergang; Abspann; danach zurück zum Titel mit `g.goto('title')` und Menü).

Ablauf:
1. Äußerer Ring: Maschinenkrebs mit `brecheisen` öffnen → `perlen` (Flag `perlen`=3). `perlen`
   mit dem Podest benutzen → Brücke senkt sich. `schriftrolle` am Boden (Kodex ringe).
2. Tempel: Statuen anschauen (Namen: Atlas, Gadeiros, Ampheres, Euaimon, Mneseus, Autochthon,
   Elasippos, Mestor, Azaes, Diaprepes; Kodex zehnkoenige, poseidon). Hand des Atlas drücken,
   dann Hand des Gadeiros → Tür ins Innere öffnet sich; andere Reihenfolge setzt zurück. Hinweis
   steht am Ende des `solontext`. Seitentür zu den Zellen ist offen.
3. Zellen: Kessler sitzt mit der Wächterfigur. `bimsstein` in den Gang werfen → er geht
   nachsehen → `perle` aus dem Sockel des Gitters nehmen → Gitter aus → Livia frei. Oder Kampf
   (`fight`, härter). Livia liest die `schriftrolle`: Die Maschine „vollendet“ den, der
   hineintritt, aber nur, wer von den Zehn gesegnet ist; alle anderen macht sie zu Ungeheuern.
   `livia_frei`. Livia folgt als Figur in `at_inner` mit.
4. Das Herz: Vesper wartet an der Konsole (mit `medaillon` und Wächterfigur). Vorher kleines
   Rätsel: Die Maschine ist ohne Strom; ein Wasserrad im Kanal steht, weil ein Gitter voll
   Geröll ist (`seil` oder `brecheisen`) – eine oder zwei Aktionen. Dann Sequenz: Vesper
   verlangt, dass Falk die Siegel einsetzt (drei `useWith` an der Konsole). Vesper tritt in
   die Kammer, befiehlt Kessler den Hebel; Dialogwahl für Falk (ziehen / weigern) endet gleich:
   Vesper wird verwandelt und vernichtet, die Maschine überlädt, alles bricht zusammen.
5. Flucht: Zwischensequenz durch `at_escape` (fallende Steine, steigendes Wasser), Hebebühne
   (die Perle steckt noch im Sockel), nach oben. Epilog auf Stavros' Boot: Livia: „Und?
   Glaubst du jetzt an Atlantis?“ Falk: „Ich glaube an Platon. Er hat gesagt, es sei nur eine
   Geschichte.“ Abspann als Erzählertext, dann Titelbild.

## Ton

Kurze Sätze, trockener Humor, keine Ausrufezeichen-Häufung. Falk kommentiert Dinge nüchtern.
Livia ist die Wärmere von beiden. Mythologische Erklärungen kommen von Livia oder aus dem Kodex,
nie als Vortrag von Falk. Keine Anspielungen auf reale Filmfiguren.
