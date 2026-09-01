/* Gegenstände. look: Text beim Anschauen; use: Aktion ohne Ziel; useWith: Kombination mit anderem Gegenstand. */
(function (ATL) {
  const D = ATL.items.define;
  const note = (title, textFn) => async (g) => { await g.puzzle('note', { title, text: typeof textFn === 'function' ? textFn(g) : textFn }); };

  // Prolog
  D({ id: 'taschenmesser', name: 'Taschenmesser', look: 'Mein altes Taschenmesser. Die Klinge ist stumpf, aber sie tut ihren Dienst.' });
  D({ id: 'notiz', name: 'Notiz von Greaves', look: 'Greaves hat Hank aufgeschrieben, dass ich auf den Dachboden darf.', use: note('Notiz', 'Hank,\n\nDr. Falk darf auf den Dachboden. Geben Sie ihm bitte den Schlüssel.\n\nA. Greaves') });
  D({ id: 'schluessel', name: 'Dachbodenschlüssel', look: 'Ein schwerer Eisenschlüssel mit einem Pappanhänger: „Dachboden“.' });
  D({ id: 'leiter', name: 'Leiter', look: 'Eine Holzleiter. Zwei Sprossen wackeln, aber sie trägt.' });
  D({ id: 'figur', name: 'Wächterfigur', look: 'Eine Steinfigur, kaum zwei Handbreit hoch: ein Mann mit einem Fischkopf als Kapuze. Im Inneren klappert etwas.', use: 'Ich sollte sie nicht einfach aufbrechen. Vielleicht vorsichtig mit einer Klinge.', useWith: { taschenmesser: async (g) => { await g.say('falk', 'Ich fahre mit der Klinge in die Fuge am Sockel…'); g.fx('stone'); await g.say('falk', 'Der Boden löst sich. Eine kleine Perle rollt heraus. Sie ist warm.'); g.take('perle'); g.set('perle_entnommen'); g.codex('orichalkum'); } } });
  D({ id: 'perle', name: 'Orichalkum-Perle', look: (g) => g.flag('perle_erklaert') ? 'Die Perle aus der Wächterfigur. Sie ist warm und schimmert grün, als brenne etwas in ihr.' : 'Eine Perle, groß wie eine Haselnuss. Sie ist warm. Metall, aber kein Metall, das ich kenne.', use: 'Sie schimmert. Sonst tut sie nichts, jedenfalls nicht in meiner Hand.' });
  D({ id: 'visitenkarte', name: 'Visitenkarte', look: 'Elfenbeinfarbener Karton. „Meridian-Gesellschaft, Berlin. Konrad Vesper.“ Unten mit Bleistift: „Whitmore, Figur, 12. Mai“.', use: note('Visitenkarte', 'MERIDIAN-GESELLSCHAFT\nBerlin, Tiergartenstraße\n\nKonrad Vesper\nVorsitzender\n\n(mit Bleistift:) Whitmore, Figur, 12. Mai') });
  D({ id: 'muenzen', name: 'Kleingeld', look: 'Ein paar Dollar in Münzen. Reicht für eine Zeitung oder etwas zu essen.' });
  D({ id: 'hotdog', name: 'Hotdog', look: 'Ein Hotdog mit Senf. Er riecht nach Straße und Zwiebeln.', use: 'Ich habe keinen Hunger. Ich hebe ihn lieber auf.' });
  D({ id: 'medaillon', name: 'Atlantisches Medaillon', look: 'Eine Scheibe aus dem gleichen grünlichen Metall wie die Perle, mit drei Ringen. Livia trägt sie seit Thera.', use: async (g) => { if (g.has('perle')) { await g.say('falk', 'Wenn ich die Perle in die Nähe halte, wird das Medaillon warm. Als würden sie einander kennen.'); } else await g.say('falk', 'Es liegt schwer in der Hand. Kälter als es sein sollte.'); } });
  D({ id: 'seil', name: 'Seil', look: 'Zehn Meter gutes Hanfseil. Man weiß nie.' });
  D({ id: 'kaffee', name: 'Thermoskanne', look: 'Kaffee vom Morgen. Noch warm.' });

  // Ägypten
  D({ id: 'uhr', name: 'Taschenuhr', look: 'Meine Taschenuhr. Ein Geschenk meines Vaters. Sie geht drei Minuten nach.' });
  D({ id: 'katalogkarte', name: 'Katalogkarte', look: 'Eine Karte aus dem Zettelkasten des Instituts: „Sais, Grabung 1911, Bericht. Regal IV, Fach 7.“ Jemand hat sie mitgenommen, damit niemand den Bericht findet.' });
  D({ id: 'feder', name: 'Straußenfeder', look: 'Eine weiße Straußenfeder. Die Feder der Maat, sagt Farid. Er sagt viel, wenn er verkaufen will.' });
  D({ id: 'skarabaeus', name: 'Herzskarabäus', look: 'Ein Skarabäus aus grünem Stein, so groß wie eine Faust. Die Ägypter legten ihn den Toten aufs Herz, damit es beim Totengericht schweigt.' });
  D({ id: 'oellampe', name: 'Öllampe', look: 'Eine Tonlampe mit Öl und Docht. Sie brennt eine Weile.' });
  D({ id: 'schaufel', name: 'Klappspaten', look: 'Ein Klappspaten aus Armeebeständen. Für Sand reicht er.' });
  D({ id: 'papier', name: 'Papier', look: 'Ein Bogen dünnes Papier.' , useWith: { kohle: 'Ich brauche etwas, worauf ich reiben kann. Eine Inschrift.' } });
  D({ id: 'kohle', name: 'Kohlestift', look: 'Ein Stück Zeichenkohle.' });
  D({ id: 'abrieb', name: 'Abrieb der Inschrift', look: 'Der Abrieb der Wandinschrift aus dem Tempel. Vier Zeilen Hieroglyphen. Ich kann einzelne Zeichen lesen, aber nicht den Zusammenhang.' });
  D({ id: 'uebersetzung', name: 'Übersetzung', look: 'Yusufs Übersetzung der Inschrift.', use: note('Übersetzung der Inschrift', (g) => g.flag('inschrift_text') || '…') });
  D({ id: 'bericht', name: 'Bericht über Sais', look: 'Ein dünner Grabungsbericht von 1911. Mit einer Skizze der Ruinen.', use: note('Grabung Sais, 1911', 'Die Tempelanlage der Neith liegt größtenteils unter Flugsand. Im Westen der Umfassungsmauer steht der Torso einer Statue der Göttin. Ihre Blickrichtung weist auf eine Vertiefung, die wir für den verschütteten Zugang zu einem Untergeschoss halten. Die Grabung wurde wegen Geldmangels abgebrochen.\n\nAnmerkung am Rand, andere Handschrift: „Solon hörte die Geschichte hier. Von den Priestern der Neith. Wenn sie etwas aufgeschrieben haben, dann unten.“') });
  D({ id: 'flasche', name: 'Feldflasche', look: (g) => g.flag('flasche_leer') ? 'Meine Feldflasche. Leer.' : 'Meine Feldflasche. Voll mit Wasser.' });
  D({ id: 'solontext', name: 'Abschrift der Solon-Tafel', icon: 'uebersetzung', look: 'Was ich von der Stele in der Kammer abgeschrieben habe. Griechisch, in Solons Zeit geschrieben.', use: note('Abschrift der Solon-Tafel', (g) => ATL.story.riddle(g)) });
  D({ id: 'sonnensiegel', name: 'Siegel der Sonne', look: 'Eine goldene Scheibe mit einer Sonne. Schwerer, als sie aussieht. Auf der Rückseite acht Kerben.' });

  // Kreta
  D({ id: 'oliven', name: 'Oliven', look: 'Eine Handvoll schwarzer Oliven aus der Taverne.' , use: 'Ich mag Oliven. Aber ich brauche sie vielleicht noch.' });
  D({ id: 'hut', name: 'Zerknautschter Hut', look: 'Ein Tropenhut, angeknabbert und feucht. Er gehört dem Colonel.' });
  D({ id: 'plan', name: 'Plan von Knossos', look: 'Bramwells Plan der Palastruinen mit handschriftlichen Anmerkungen.', use: note('Plan von Knossos', 'Skizze der Westmagazine, des Thronsaals und der Pfeilerkrypta.\n\nAnmerkung Bramwell: „Krypta, Pfeiler mit drei Doppeläxten. Der alte Yannis schwört, sein Großvater habe die mittlere gedrückt und dann sei der Boden aufgegangen. Aberglaube. Habe es nie probiert, der Pfeiler steht unter Denkmalschutz.“') });
  D({ id: 'wolle', name: 'Wollknäuel', look: 'Ein Knäuel grauer Schafwolle. Ariadne gab Theseus einen Faden, damit er aus dem Labyrinth zurückfand.' });
  D({ id: 'raki', name: 'Flasche Raki', look: 'Tresterschnaps aus der Taverne. Klar wie Wasser und ungefähr so harmlos wie Petroleum.' , use: 'Nicht jetzt. Ich brauche einen klaren Kopf.' });
  D({ id: 'doppelaxt', name: 'Bronzene Doppelaxt', look: 'Eine Doppelaxt aus Bronze, eine Labrys. Zu dünn, um damit zu schlagen. Ein Weihegeschenk, kein Werkzeug.' });
  D({ id: 'stiersiegel', name: 'Siegel des Stiers', look: 'Eine Scheibe aus dunkler Bronze mit einem Stierkopf. Auf der Rückseite acht Kerben.' });

  // Mesopotamien
  D({ id: 'syllabar', name: 'Silbentafel', look: 'Toms Liste der häufigsten Keilschriftzeichen mit ihren Silbenwerten.', use: async (g) => { await g.say('falk', 'Acht Zeichen mit Silbenwerten. Damit kann man einfache Zeilen buchstabieren.'); } });
  D({ id: 'kanister', name: 'Benzinkanister', look: 'Zwanzig Liter Benzin. Genug für den Jeep.' });
  D({ id: 'tafeltext', name: 'Abschrift der Fluttafel', look: 'Meine Abschrift der Zeilen von der Tafel im Archiv.', use: note('Von der Fluttafel', 'Ea hob die Weisen aus dem Meer.\nWo das süße Wasser der Tiefe steht, ruht das Zeichen der Flut.\nSieben Weise wachen an der Tür.\nDer vierte hält den Schlüssel.') });
  D({ id: 'flutsiegel', name: 'Siegel der Flut', look: 'Eine Scheibe aus blauem Stein mit drei Wellen. Auf der Rückseite acht Kerben.' });
  D({ id: 'schilf', name: 'Schilfbündel', look: 'Trockenes Schilf, zu einem Bündel gebunden. Die Sumerer bauten daraus Boote.' });

  // Thera
  D({ id: 'feuerwerk', name: 'Feuerwerkskörper', look: 'Ein Bündel Kracher für das Fest des Heiligen. Laut, aber harmlos.' });
  D({ id: 'zuendkerze', name: 'Zündkerze', look: 'Eine Zündkerze. Aus dem Beiboot der Meridian.' });
  D({ id: 'stein', name: 'Stein', look: 'Ein faustgroßer Stein aus Lava.' });
  D({ id: 'bimsstein', name: 'Bimsstein', look: 'Ein Brocken Bimsstein. Leicht wie Brot und voller Löcher. Der Berg hat ihn ausgespuckt, vor sehr langer Zeit.' });
  D({ id: 'zigaretten', name: 'Zigaretten', look: 'Eine Schachtel griechischer Zigaretten.' });

  // Atlantis
  D({ id: 'perlen', name: 'Orichalkum-Perlen', look: (g) => `${g.flag('perlen') || 0} Orichalkum-Perlen aus dem Maschinenkrebs. Sie summen leise.` });
  D({ id: 'schriftrolle', name: 'Atlantische Tafel', look: 'Eine dünne Metalltafel mit Zeichen, die keiner Schrift gleichen, die ich kenne. Livia könnte sie vielleicht lesen.', use: async (g) => { await g.say('falk', 'Zeilen aus Spiralen und Punkten. Nichts, was ich lesen könnte.'); } });
  D({ id: 'brecheisen', name: 'Brecheisen', look: 'Ein Brecheisen aus Vespers Ausrüstung.' });
})(window.ATL);
