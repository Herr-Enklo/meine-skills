# Werbefrei

Browser-Erweiterung für Chrome und Edge, die Werbung rund um Artikel ausblendet: Billboards über
dem Artikel, Skyscraper in der Seitenleiste, Werbeplätze zwischen den Absätzen, klebende Leisten am
unteren Rand und Empfehlungs-Widgets wie Taboola und Outbrain unter dem Artikel. Werbeserver werden
blockiert, bevor eine Anfrage das Netz verlässt, und die Lücken, die blockierte Werbung hinterlässt,
klappt Werbefrei zu. Gewöhnliche Cookie-Hinweise blendet es ebenfalls aus, ohne etwas zuzustimmen.

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

Pause, Ausnahmen und neue Regeln wirken sofort in allen offenen Tabs, nicht erst nach dem Neuladen:
Gesperrte Server sind dort ab der nächsten Anfrage erreichbar oder wieder gesperrt, und Ausgeblendetes
erscheint oder verschwindet. Nur der Tab, in dem man das Popup benutzt, lädt neu, damit schon
blockierte Inhalte nachkommen. Eine gelöschte Regel wirkt in offenen Tabs bis zum nächsten Laden weiter.

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
- Werbeplatz-Erkennung, Cookie-Hinweise und Zähler am Symbol ein- und ausschalten, Abo-Abfragen
  automatisch beantworten lassen (siehe unten, standardmäßig aus).
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
- Ersatzanzeigen. Einige Seiten (beobachtet auf spiegel.de, sueddeutsche.de, t-online.de,
  merkur.de und golem.de) merken, dass ein Werbeblocker läuft, und blenden dann Anzeigen als Bild über
  die eigene Domain ein. Die umgebenden Container tragen Namen, die bei jedem Laden neu ausgewürfelt
  werden (etwa `pszFwpCl`), damit keine feste Regel sie trifft. Werbefrei erkennt sie an der
  Kombination aus einem Bild in Anzeigengröße und solchen Zufallsnamen und blendet den äußersten
  dieser Container aus. Als Inhalt gelten dabei Bilder mit Beschreibung (`alt`), Bilder in `figure`
  oder `picture` und Kästen mit mehr als ein paar Wörtern Text.

Für diese Erkennung gelten feste Schutzregeln. Sie blendet nie etwas aus, das eine Hauptüberschrift
(`h1`), den Artikeltext (`itemprop="articleBody"`), `main`, ein Eingabefeld oder das gerade fokussierte
Element enthält, und nichts, das höher als anderthalb Bildschirme und mehr als halb so breit wie das
Fenster ist. Das Wort „Werbung“ in Links, Menüs, Formularen, der Hauptüberschrift und Einwilligungsdialogen
gilt nicht als Kennzeichnung. Die Erkennung lässt sich in den Einstellungen abschalten.

Ausgeblendet wird immer per CSS, gelöscht wird nichts. Skripte der Seite laufen dadurch weiter wie
vorgesehen, und „Auf dieser Seite aus“ stellt alles wieder her. Jede eingefügte CSS-Regel hängt an
einem Attribut am `<html>`-Element, dessen Name für jede geladene Seite neu ausgewürfelt wird. Setzt
das Inhaltsskript es (Pause, Ausnahme), greift keine Regel mehr; die Seite selbst kennt den Namen
nicht und kann das nicht nachahmen.

Chrome erlaubt eine feste Zahl dynamischer Netzregeln (ab Version 121 30.000, davor 5.000). Werbefrei
hält diese Grenze auch bei sehr vielen eigenen Regeln ein, sonst würde Chrome den ganzen Regelsatz
ablehnen. Eigene Regeln haben Vorrang vor den Listen; was nicht mehr hineinpasst, nennt die
Einstellungsseite.

## Cookie-Hinweise

Werbefrei blendet die Einwilligungsbanner verbreiteter Anbieter aus: OneTrust, Cookiebot,
Usercentrics, Didomi, consentmanager, Borlabs, Complianz, CookieYes, Quantcast, TrustArc, Sourcepoint
und einige weitere, dazu den eigenen Hinweis von check24. Es klickt dabei nichts an und speichert
keine Auswahl. Die Seite verhält sich so, als hätte man den Hinweis nicht beantwortet, und das gilt
bei diesen Anbietern nicht als Einwilligung. Sperrt die Seite das Scrollen, solange der Hinweis offen
ist, gibt Werbefrei es wieder frei.

Stehen bleiben Dialoge, die statt der Zustimmung ein Abo anbieten, also „Mit Werbung lesen oder
Pur-Abo abschließen“ und contentpass. Werbefrei erkennt sie am sichtbaren Text (Pur, Abo,
contentpass, ein Preis in Euro). Erscheint das Angebot erst, nachdem der Dialog schon ausgeblendet
war, wird er wieder gezeigt, und die Scrollsperre bleibt dann ebenfalls. Solche Dialoge auszublenden
hieße, die Bezahlschranke zu umgehen. Das betrifft die meisten großen Nachrichtenseiten: Auf
spiegel.de, bild.de, welt.de, faz.net, sueddeutsche.de, t-online.de, focus.de, n-tv.de, heise.de,
golem.de, chip.de und tagesspiegel.de blieb der Dialog im Test stehen.

Wer solche Abfragen nicht auf jeder Seite selbst beantworten will, schaltet in den Einstellungen
„Abo-Abfragen automatisch beantworten“ ein (standardmäßig aus). Werbefrei klickt dann im Dialog auf „Einwilligen“
beziehungsweise „Zustimmen“. Die Seite speichert die Wahl, auf spiegel.de, heise.de und t-online.de
kam der Dialog beim nächsten Besuch nicht wieder. Das ist eine echte Einwilligung in das Tracking
der Seite. Die Werbeserver sperrt Werbefrei trotzdem; gegen Tracker hilft zusätzlich die Liste
EasyPrivacy, die man dafür einschalten sollte. Beantwortet werden nur Abo-Abfragen, gewöhnliche
Cookie-Hinweise blendet Werbefrei weiter aus, ohne zuzustimmen. Auf ausgenommenen Seiten und im
Pausenmodus klickt Werbefrei nichts. Unterstützt sind Dialoge von Sourcepoint (der Knopf mit der
Klasse `sp_choice_type_11`), consentmanager (`.cmpboxbtnyes`) und OneTrust
(`#onetrust-accept-btn-handler`). Der Schalter wirkt sofort, auch auf eine Abfrage, die beim
Einschalten schon offen ist. Im Test verschwand die Abfrage auf spiegel.de, bild.de, welt.de, faz.net,
sueddeutsche.de, t-online.de, focus.de, n-tv.de, heise.de, golem.de, chip.de und tagesspiegel.de,
und die Seite ließ sich scrollen. bild.de zeigt danach allerdings seine Sperre für Werbeblocker.

Sourcepoint lädt seinen Dialog in einen Rahmen von einer fremden Domain, in den das Inhaltsskript
der Seite nicht hineinsehen kann. In solchen Rahmen (erkennbar an `message_id=` in der Adresse)
läuft deshalb ein kleines Skript, `content/cmp-rahmen.js`, das nur den Text des Dialogs liest und
meldet, ob es ein gewöhnlicher Hinweis oder ein Abo-Angebot ist. Bis diese Meldung kommt, bleibt der
Dialog sichtbar; kommt sie nicht, bleibt er ganz stehen. Manche Seiten bauen den Dialog selbst und
holen aus dem Rahmen nur den Zustimmungsknopf (golem.de). Dann prüft das Inhaltsskript den Kasten
der Seite um den Rahmen herum, aber nur Kästen mit höchstens 4.000 Zeichen Text, damit ein „Abo“ im
Menü der Seite nicht zählt. Steht dort ein Abo-Angebot, gilt der Dialog als Abo-Abfrage; sonst bleibt
er unverändert stehen.

Gewöhnliche Cookie-Hinweise, die eine Seite selbst gebaut hat, erkennt Werbefrei nicht. Sie lassen
sich mit „Element ausblenden …“ entfernen. Das Ausblenden ist eingeschaltet und lässt sich unter
Einstellungen → Allgemein abschalten.

## Grenzen

- Werbefrei umgeht keine Bezahlschranken und keine Abfragen der Art „Mit Werbung lesen oder Abo
  abschließen“. Diese Abfragen bleiben stehen, auch wenn Cookie-Hinweise ausgeblendet werden. Auf
  Wunsch beantwortet Werbefrei sie mit „Einwilligen“, siehe „Cookie-Hinweise“.
- Manche Seiten mit eigener Abfrage (etwa merkur.de) kennt Werbefrei nicht; dort
  bleibt die Abfrage auch mit eingeschaltetem Schalter stehen.
- Ist ein Cookie-Hinweis ausgeblendet, hat man nichts erlaubt. Inhalte, die eine Einwilligung
  voraussetzen, etwa eingebettete Videos oder Karten, zeigen dann oft nur einen Platzhalter. Wer sie
  braucht, schaltet „Cookie-Hinweise ausblenden“ kurz ab und trifft seine Wahl im Hinweis.
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
| Zugriff auf alle http- und https-Seiten | Werbeplätze und Cookie-Hinweise ausblenden, Filterlisten laden |
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
diese Anfragen blockiert die Erweiterung, bevor sie das Netz erreichen. Geprüft wird in 77 Punkten,
dass elf typische Werbeplätze verschwinden (Billboard mit „Anzeige“, zwei Werbeplätze im Text, einer
davon mit Inline-Skript, leerer Skyscraper, klebende Leiste, Taboola, gesponserter Teaser,
nachgeladener Werbeplatz, ein Element, das erst nachträglich die Klasse `adsbygoogle` bekommt, zwei
Ersatzanzeigen mit Zufallsnamen) und dass achtzehn Fallen sichtbar
bleiben: Überschrift, Absätze mit den Wörtern „Werbung“ und „Anzeige“, eine Dachzeile „Werbung“, ein
Kasten mit der Klasse `ad-hoc-note`, ein Kasten mit der Klasse `billboard` und einem verzögert
ladenden Bild, ein Knopf „Anzeigen“, drei Fotos in Anzeigengröße (zwei davon in Containern mit
zufällig klingendem Namen), ein eingebettetes Video, echte Teaser, der Einwilligungszweck „Werbung“,
Menü- und Fußzeilenlinks „Werbung“. Dazu kommen die Element-Auswahl, das Popup und das Ausnehmen einer
Seite. Ein eigener Block prüft, dass Pause, Fortsetzen, Ausnahmen und neue Regeln in offenen Tabs ohne
Neuladen wirken, sowohl für Netzanfragen als auch für Ausgeblendetes, und dass eine während der Pause
geöffnete Seite beim Fortsetzen nachträglich eingerichtet wird. Der Block „Cookie-Hinweise“ prüft
einen nachgebauten OneTrust-Banner mit Scrollsperre und versteckter Anbieterliste, einen
consentmanager-Dialog mit Pur-Abo (auch mit spät nachgeladenem Angebot und versteckt eingefügt) und
Sourcepoint-Rahmen: einen gewöhnlichen, einen mit Abo-Angebot, einen, in dem das Angebot erst nach
dreieinhalb Sekunden erscheint, und zwei, die wie auf golem.de nur den Knopf liefern, einmal in einem
Seitendialog mit Abo-Angebot und einmal ohne. Außerdem, dass der Schalter in den Einstellungen ohne Neuladen
wirkt. Mit eingeschaltetem „Abo-Abfragen automatisch beantworten“ wird geprüft, dass Sourcepoint- und
consentmanager-Abfragen mit „Zustimmen“ beantwortet werden (auch die Knopf-Variante) und die Seite
danach scrollt, dass ein gewöhnlicher Hinweis nur ausgeblendet und nicht beantwortet wird, dass ohne
Abo-Angebot nichts geklickt wird und dass auf einer ausgenommenen Seite nichts geklickt wird. Dazu:
Wird der Schalter eingeschaltet, während eine Abfrage offen ist, wird sie sofort beantwortet. Bildschirmfotos landen in `test-ergebnisse/`.

`npm run e2e:echt` öffnet auf 14 Nachrichtenseiten einen aktuellen Artikel, einmal ohne und einmal mit
Werbefrei, bestätigt die Einwilligung (ohne sie laden diese Seiten keine Werbung), scrollt durch den
Artikel und zählt sichtbare Werberahmen, Werbeplätze, Ersatzanzeigen und Kennzeichnungen. Ergebnis:
`test-ergebnisse/echte-seiten.md` und ein Vergleichsbild pro Seite. Einzelne Seiten:
`node tests/e2e/echte-seiten.mjs spiegel.de zeit.de`.

`node tests/e2e/pruefen.mjs <Adresse>` listet für eine Seite jedes Element, das die eigene Erkennung
ausgeblendet hat, mit Grund (`kennzeichnung`, `leer`, `rahmen`, `ersatz`). Damit lässt sich ein
Fehlalarm schnell eingrenzen. Mit `FOTO=pfad/name` davor entstehen zusätzlich zwei Bildschirmfotos.

`node tests/e2e/cookie-seiten.mjs [--einwilligen] [Adresse …]` öffnet Seiten mit Werbefrei und meldet
für jede, ob ein bekannter Cookie-Hinweis ausgeblendet oder sichtbar ist und ob sich die Seite scrollen
lässt. Ohne Adressen nimmt es eine feste Auswahl, von den Anbietern selbst bis zu Nachrichtenseiten
mit Pur-Abo. `--einwilligen` schaltet „Abo-Abfragen automatisch beantworten“ ein. Bildschirmfotos:
`test-ergebnisse/cookie-<seite>.png`.

## Aufbau

| Datei | Inhalt |
|---|---|
| `extension/manifest.json` | Manifest V3 |
| `extension/background.js` | Service Worker: Regeln, Listen, Stylesheets, Nachrichten |
| `extension/lib/filters.js` | Übersetzer für Filterlisten (Adblock-Plus-Format → Chrome-Regeln und CSS) |
| `extension/lib/catalog.js` | Bekannte Listen und Grundeinstellungen |
| `extension/content/content.js` | Inhaltsskript: Klassen melden, Werbeplätze und Cookie-Hinweise erkennen, zählen |
| `extension/content/cmp-rahmen.js` | Läuft in Sourcepoint-Rahmen, meldet, ob der Dialog ein Abo anbietet, und klickt auf Wunsch „Einwilligen“ |
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
