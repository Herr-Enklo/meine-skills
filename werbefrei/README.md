# Werbefrei

Browser-Erweiterung für Chrome und Edge, die Werbung rund um Artikel ausblendet: Billboards über
dem Artikel, Skyscraper in der Seitenleiste, Werbeplätze zwischen den Absätzen, klebende Leisten am
unteren Rand und Empfehlungs-Widgets wie Taboola und Outbrain unter dem Artikel. Werbeserver werden
blockiert, bevor eine Anfrage das Netz verlässt, und die Lücken, die blockierte Werbung hinterlässt,
klappt Werbefrei zu.

Die Erweiterung nutzt Manifest V3 und läuft in Chrome und Edge ab Version 116. Die Oberfläche ist
deutsch.

## Installieren

1. Dieses Repository herunterladen oder klonen.
2. In Chrome `chrome://extensions` öffnen, in Edge `edge://extensions`.
3. Oben rechts (Edge: links unten) den **Entwicklermodus** einschalten.
4. **Entpackte Erweiterung laden** (Edge: **Entpackt laden**) und den Ordner `werbefrei/extension` wählen.
5. Über das Puzzle-Symbol in der Leiste Werbefrei anheften.

Die eingebaute Liste wirkt sofort. Im Hintergrund lädt Werbefrei gleich nach der Installation
EasyList Germany und EasyList von easylist.to; das dauert ein paar Sekunden.

Eine neue Fassung aus dem Repository holt man mit `git pull` und danach auf `chrome://extensions`
mit dem Pfeil **Neu laden** an der Erweiterung. Einstellungen und eigene Regeln bleiben erhalten.

## Bedienung

**Popup** (Klick auf das Symbol): Der Schalter „Auf dieser Seite aktiv“ nimmt die Seite aus, wenn sie
mit Werbefrei nicht richtig funktioniert; die Seite lädt dann neu. Darunter steht, wie viele Anfragen
blockiert und wie viele Werbeplätze ausgeblendet wurden. „Überall pausieren“ schaltet Werbefrei
komplett ab, bis man es wieder fortsetzt. Auf ausgenommenen Seiten und im Pausenmodus ist das Symbol
grau.

**Element ausblenden**: Für Werbung, die keine Liste erwischt. Start über das Popup, per Rechtsklick
„Element ausblenden …“ oder mit <kbd>Alt</kbd>+<kbd>Umschalt</kbd>+<kbd>E</kbd>. Auf die Werbung zeigen
und klicken; mit <kbd>↑</kbd> und <kbd>↓</kbd> (oder „Größer“/„Kleiner“) den Rahmen anpassen, bis die
ganze Werbefläche markiert ist. Der vorgeschlagene CSS-Selektor lässt sich bearbeiten, „Vorschau“
blendet probeweise aus, <kbd>Enter</kbd> oder „Ausblenden“ speichert. Die Regel gilt dann für die ganze
Website (etwa `spiegel.de##.werbekasten`) und steht in den Einstellungen unter „Eigene Regeln“, wo man
sie auch wieder löscht.

**Einstellungen** (Zahnrad im Popup):

- Filterlisten ein- und ausschalten, sofort aktualisieren, eigene Listen per https-Adresse abonnieren
  (Adblock-Plus-Format oder hosts-Datei). EasyPrivacy gegen Tracker ist dabei, aber aus.
- Eigene Regeln im EasyList-Format. Beim Speichern meldet Werbefrei Zeilen, die es nicht versteht,
  mit Zeilennummer und Grund.
- Ausnahmen: Seiten, auf denen Werbefrei aus ist.
- Werbeplatz-Erkennung und Zähler am Symbol ein- und ausschalten.
- Sicherung als JSON-Datei speichern und wiederherstellen, etwa für einen zweiten Rechner.

### Eigene Regeln

| Regel | Wirkung |
|---|---|
| `spiegel.de##.werbekasten` | Auf spiegel.de alle Elemente mit der Klasse `werbekasten` ausblenden |
| `##div[id^="werbung-"]` | Auf allen Seiten ausblenden, beliebiger CSS-Selektor |
| `\|\|werbeserver.example^` | Alle Anfragen an diesen Server und seine Subdomains sperren |
| `\|\|cdn.example/ads/*$script` | Nur Skripte unter diesem Pfad sperren |
| `@@\|\|example.com/player.js` | Ausnahme: diese Datei nie sperren |
| `zeit.de#@#.teaser` | Ausnahme: diesen Elementfilter auf zeit.de nicht anwenden |
| `! Notiz` | Kommentar |

## Wie Werbefrei arbeitet

Werbefrei setzt an drei Stellen an.

**Netz.** Anfragen an Werbeserver blockiert der Browser selbst über `declarativeNetRequest`. Die
eingebaute Liste (`extension/filters/werbefrei.txt`) enthält rund 80 Werbeserver, darunter die großen
Handelsplattformen und die Anbieter, die auf deutschen Nachrichtenseiten laufen (Yieldlab, Adition,
United Internet, ProSiebenSat.1, Yieldlove, Taboola, Outbrain). Jede Domain darin ist mit EasyList
abgeglichen. Beim Build wird sie zu einem statischen Regelwerk (`extension/rules/werbefrei.json`), das
ohne Download wirkt. Abonnierte Listen übersetzt der Service Worker zur Laufzeit in dynamische
Regeln. EasyList und EasyList Germany ergeben zusammen rund 5.600 Chrome-Regeln, weil die gut 45.000
Filter der Form `||domain^` zu Regeln mit je bis zu 1.000 Domains zusammengefasst werden. Chrome
erlaubt ab Version 121 bis zu 30.000 solcher Regeln, davor 5.000; was nicht hineinpasst, nennt die
Einstellungsseite.

**Elementfilter.** Die CSS-Selektoren der Listen fügt Werbefrei als Nutzer-Stylesheet ein
(`display:none!important`). Ein Nutzer-Stylesheet setzt sich gegen das CSS der Seite durch, auch
gegen deren `!important`. EasyList enthält gut 13.600 Selektoren, die auf allen Seiten gelten. Fast
alle hängen an einer bestimmten Klasse oder id; das Inhaltsskript meldet dem Service Worker, welche
Klassen und ids auf der Seite vorkommen, und bekommt nur die passenden Selektoren zurück. Pro Seite
sind das einige hundert statt 13.600.

**Eigene Erkennung.** Für Werbeplätze, die keine Liste kennt, prüft das Inhaltsskript die Seite nach
dem Laden und bei Änderungen:

- Kästen, die außer einer Kennzeichnung wie „Anzeige“, „Anzeigen“, „Werbung“ oder „Sponsored“ nur
  einen Werberahmen enthalten, und gekennzeichnete Beiträge in Teaserlisten.
- Werbecontainer (Klasse oder id wie `ad-slot`, `adSlot`, `skyscraper`, `billboard`), die leer
  zurückbleiben, weil ihr Inhalt blockiert wurde. Sie werden erst ausgeblendet, wenn sie über zwei
  Durchläufe im Abstand von mindestens 1,2 Sekunden leer bleiben. Füllt sich so ein Kasten später
  doch noch mit Text oder Bildern, wird er wieder gezeigt.
- Rahmen und Bilder von gesperrten Werbeservern. Ohne das bliebe an ihrer Stelle die Fehlerseite des
  Browsers stehen.
- Ersatzanzeigen. Einige Seiten (beobachtet auf spiegel.de und sueddeutsche.de) merken, dass ein
  Werbeblocker läuft, und blenden dann Anzeigen als Bild über die eigene Domain ein. Die umgebenden
  Container tragen Namen, die bei jedem Laden neu ausgewürfelt werden (etwa `pszFwpCl`), damit keine
  feste Regel sie trifft. Werbefrei erkennt sie an der Kombination aus einem Bild in einem
  Standard-Werbeformat (300×600, 970×250, 728×90 und weitere) und solchen Zufallsnamen und blendet den
  äußersten dieser Container aus. Ein Kasten mit mehr als ein paar Wörtern Text gilt dabei als Inhalt.

Für diese Erkennung gelten feste Schutzregeln. Sie blendet nie etwas aus, das eine Hauptüberschrift
(`h1`), den Artikeltext (`itemprop="articleBody"`), `main`, ein Eingabefeld oder das gerade fokussierte
Element enthält, und nichts, das höher als anderthalb Bildschirme und mehr als halb so breit wie das
Fenster ist. Das Wort „Werbung“ in Links, Menüs, Formularen, der Hauptüberschrift und Einwilligungsdialogen
gilt nicht als Kennzeichnung. Die Erkennung lässt sich in den Einstellungen abschalten.

Ausgeblendet wird immer per CSS, gelöscht wird nichts. Skripte der Seite laufen dadurch weiter wie
vorgesehen, und „Auf dieser Seite aus“ stellt alles wieder her.

## Grenzen

- Werbefrei umgeht keine Bezahlschranken und keine Abfragen der Art „Mit Werbung lesen oder Abo
  abschließen“. Die Einwilligungsabfrage bleibt, wie sie ist.
- Manche Seiten sperren sich, sobald sie einen Werbeblocker erkennen. bild.de zeigt dann nur
  „Aufgrund Ihres Blockers zeigen wir BILD.de nicht an.“ Werbefrei versucht nicht, solche Sperren
  zu umgehen. Wer die Seite lesen will, schaltet Werbefrei dort über den Schalter im Popup aus.
- Chrome-Erweiterungen mit Manifest V3 können keine Skripte in Seiten umschreiben. Filter, die das
  voraussetzen (Pop-up-Sperren, `$redirect`, `$csp`, Scriptlets, erweiterte Selektoren wie
  `:has-text()`), übersetzt Werbefrei nicht; die Einstellungsseite zeigt pro Liste, wie viele Zeilen
  übersprungen wurden. Bei EasyList sind das knapp 3.600 von 77.000, fast alle davon Pop-up-Filter.
- Reguläre Ausdrücke in Netzfiltern werden übersprungen (in EasyList 22 Zeilen).
- Firefox ist nicht getestet.

## Datenschutz

Werbefrei sammelt nichts und sendet nichts. Die einzigen Verbindungen, die die Erweiterung selbst
aufbaut, sind die Downloads der abonnierten Filterlisten. Werbefrei prüft alle drei Stunden, ob eine
Liste abgelaufen ist; wie lange eine Liste gilt, steht in ihrem Kopf (EasyList: 4 Tage). Einstellungen,
Listen und eigene Regeln liegen lokal im Browser.

Die Berechtigungen und wofür sie gebraucht werden:

| Berechtigung | Wofür |
|---|---|
| `declarativeNetRequest` | Anfragen an Werbeserver blockieren |
| Zugriff auf alle http- und https-Seiten | Werbeplätze ausblenden, Filterlisten laden |
| `scripting` | Stylesheet einfügen, Element-Auswahl starten |
| `storage`, `unlimitedStorage` | Einstellungen und übersetzte Listen speichern (einige MB) |
| `activeTab` | Zahl der blockierten Anfragen im Popup |
| `contextMenus`, `alarms` | Rechtsklick-Menü, regelmäßige Aktualisierung der Listen |

Chrome zeigt bei der Installation den Hinweis, dass die Erweiterung Daten auf allen Websites lesen
und ändern kann. Ohne diesen Zugriff lässt sich Werbung auf der Seite nicht ausblenden.

## Tests

```
cd werbefrei
npm install        # Playwright für die Browsertests
npm test           # Parser, Regelwerk und Manifest, ohne Browser
npm run e2e        # nachgebaute Artikelseite in Chromium mit geladener Erweiterung
npm run e2e:echt   # echte Nachrichtenseiten ohne und mit Werbefrei, braucht Internet
```

`npm run e2e` braucht keinen Internetzugang: Die Testseite lädt Werbung von echten Werbeservern, und
diese Anfragen blockiert die Erweiterung, bevor sie das Netz erreichen. Geprüft wird in 36 Punkten,
dass neun typische Werbeplätze verschwinden (Billboard mit „Anzeige“, zwei Werbeplätze im Text, einer
davon mit Inline-Skript, leerer Skyscraper, klebende Leiste, Taboola, gesponserter Teaser,
nachgeladener Werbeplatz, Ersatzanzeige mit Zufallsnamen) und dass siebzehn Fallen sichtbar bleiben:
Überschrift, Absätze mit den Wörtern „Werbung“ und „Anzeige“, eine Dachzeile „Werbung“, ein Kasten mit
der Klasse `ad-hoc-note`, ein Kasten mit der Klasse `billboard` und einem verzögert ladenden Bild, ein
Knopf „Anzeigen“, zwei Fotos im Format 300×250 (eines in einem Container mit zufällig klingendem
Namen), ein eingebettetes Video, echte Teaser, der Einwilligungszweck „Werbung“, Menü- und
Fußzeilenlinks „Werbung“. Dazu kommen die Element-Auswahl, das Popup und das Ausnehmen einer Seite.
Bildschirmfotos landen in `test-ergebnisse/`.

`npm run e2e:echt` öffnet auf 14 Nachrichtenseiten einen aktuellen Artikel, einmal ohne und einmal mit
Werbefrei, bestätigt die Einwilligung (ohne sie laden diese Seiten keine Werbung), scrollt durch den
Artikel und zählt sichtbare Werberahmen, Werbeplätze, Ersatzanzeigen und Kennzeichnungen. Ergebnis:
`test-ergebnisse/echte-seiten.md` und ein Vergleichsbild pro Seite. Einzelne Seiten:
`node tests/e2e/echte-seiten.mjs spiegel.de zeit.de`.

`node tests/e2e/pruefen.mjs <Adresse>` listet für eine Seite jedes Element, das die eigene Erkennung
ausgeblendet hat, mit Grund (`kennzeichnung`, `leer`, `rahmen`, `ersatz`). Damit lässt sich ein
Fehlalarm schnell eingrenzen. Mit `FOTO=pfad/name` davor entstehen zusätzlich zwei Bildschirmfotos.

## Aufbau

| Datei | Inhalt |
|---|---|
| `extension/manifest.json` | Manifest V3 |
| `extension/background.js` | Service Worker: Regeln, Listen, Stylesheets, Nachrichten |
| `extension/lib/filters.js` | Übersetzer für Filterlisten (Adblock-Plus-Format → Chrome-Regeln und CSS) |
| `extension/lib/catalog.js` | Bekannte Listen und Grundeinstellungen |
| `extension/content/content.js` | Inhaltsskript: Klassen melden, Werbeplätze erkennen, zählen |
| `extension/picker/picker.js` | Element-Auswahl |
| `extension/popup/`, `extension/options/`, `extension/ui/` | Popup, Einstellungen, gemeinsames Stylesheet |
| `extension/filters/werbefrei.txt` | Eingebaute Liste (Quelle) |
| `extension/rules/werbefrei.json` | Eingebaute Liste als Chrome-Regelwerk (erzeugt) |
| `tools/build.mjs` | Erzeugt `rules/werbefrei.json` aus der Liste |
| `tools/icons.mjs` | Zeichnet die Symbole |
| `tests/` | Unit-Tests und Browsertests |

Wer die eingebaute Liste ändert, führt danach `npm run build` aus; `npm test` schlägt fehl, solange
`rules/werbefrei.json` nicht zur Liste passt. Bei Änderungen an der Erweiterung die `version` in
`manifest.json` hochzählen.

## Filterlisten und Lizenzen

EasyList, EasyList Germany und EasyPrivacy stammen von der EasyList-Community
([easylist.to](https://easylist.to/)) und stehen unter GPLv3 oder CC BY-SA 3.0
([Lizenz](https://easylist.to/pages/licence.html)). Werbefrei liefert sie nicht mit, sondern lädt sie
zur Laufzeit von dort. Die eingebaute Liste und der Code stehen wie das übrige Repository unter der
MIT-Lizenz.
