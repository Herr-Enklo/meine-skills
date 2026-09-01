/* Kapitel 2: New York. Straße, Gasse, Garderobe, Bühne. */
(function (ATL) {
  const A = ATL.A;
  const R = ATL.rooms.define;

  function cityNight(ctx) {
    A.sky(ctx, 960, 600, '#0a0d24', '#2a2340');
    A.stars(ctx, 960, 200, 60, 12);
    // Hochhäuser hinten
    const r = ATL.U.rng(21);
    for (let x = -20; x < 980; x += 70 + r() * 60) {
      const h = 140 + r() * 220, w = 60 + r() * 70;
      A.rect(ctx, x, 260 - h, w, h + 60, '#151a30');
      for (let wy = 270 - h; wy < 250; wy += 16) for (let wx = x + 6; wx < x + w - 8; wx += 14) if (r() < 0.35) A.rect(ctx, wx, wy, 7, 9, r() < 0.5 ? '#ffe9a0' : '#c8d8ff');
    }
  }

  // ---------------------------------------------------------------- Straße
  R({
    id: 'ny_street', name: 'Straße vor dem Theater', ambient: 'city',
    start: [200, 520, 'r'],
    walk: [[30, 445, 930, 445, 940, 585, 20, 585]],
    scale: { y0: 430, s0: 0.78, y1: 585, s1: 1.05 },
    paint(ctx, g) {
      cityNight(ctx);
      // Theaterfassade
      A.bricks(ctx, 120, 60, 720, 380, '#5a4a48', 36, 14, 4, '#3a2e2c');
      A.rect(ctx, 120, 60, 720, 12, '#7a6a68');
      // Marquee
      A.rect(ctx, 200, 110, 560, 70, '#1a1420');
      A.rect(ctx, 206, 116, 548, 58, '#f4e8c8');
      A.text(ctx, 'DR. LIVIA MARSH', 480, 142, { font: 'bold 22px Georgia', color: '#1a1420', align: 'center' });
      A.text(ctx, 'ATLANTIS: MYTHOS ODER ERINNERUNG?', 480, 166, { font: '15px Georgia', color: '#4a1a20', align: 'center' });
      for (let i = 0; i < 28; i++) { A.circle(ctx, 206 + i * 20, 112, 3, '#ffe9a0'); A.circle(ctx, 206 + i * 20, 178, 3, '#ffe9a0'); }
      A.glow(ctx, 480, 145, 320, 'rgba(255,230,160,0.5)', 0.35);
      // Eingang mit Türen
      A.rect(ctx, 370, 240, 200, 200, '#2a2028');
      A.door(ctx, 385, 250, 80, 190, '#6a1e2a', { panel: true, frame: '#3a1a20', knob: '#d8b858' });
      A.door(ctx, 475, 250, 80, 190, '#6a1e2a', { panel: true, frame: '#3a1a20', knob: '#d8b858' });
      A.rect(ctx, 360, 232, 220, 10, '#d8b858');
      // Plakat
      A.rect(ctx, 240, 260, 96, 150, '#3a2a28'); A.rect(ctx, 246, 266, 84, 138, '#e8d8b0');
      A.sea(ctx, 246, 330, 84, 74, '#3a6a8a', '#1a3a5a', 2);
      for (let i = 0; i < 3; i++) A.ell(ctx, 288, 340, 30 - i * 9, 8 - i * 2, null, '#c8b070', 2);
      A.text(ctx, 'ATLANTIS', 288, 290, { font: 'bold 13px Georgia', color: '#3a1a20', align: 'center' });
      A.text(ctx, 'Vortrag, 20 Uhr', 288, 310, { font: '10px Georgia', color: '#3a1a20', align: 'center' });
      // Kasse
      A.rect(ctx, 610, 260, 90, 180, '#3a2a28'); A.rect(ctx, 618, 268, 74, 90, '#1a2030');
      A.rect(ctx, 622, 300, 66, 40, '#e8d8b0'); A.text(ctx, 'AUSVERKAUFT', 655, 325, { font: 'bold 9px Georgia', color: '#7a1a20', align: 'center' });
      // Gasse rechts
      A.rect(ctx, 840, 60, 120, 380, '#0a0a12');
      A.rect(ctx, 850, 200, 100, 240, '#101018');
      // Gehweg und Straße
      A.rect(ctx, 0, 440, 960, 30, '#6a6a72');
      A.ground(ctx, 0, 470, 960, 130, '#4a4a52', '#2a2a30');
      A.rect(ctx, 0, 466, 960, 6, '#8a8a90');
      for (let x = 0; x < 960; x += 60) A.rect(ctx, x, 466, 30, 3, '#a0a0a8');
      // Laterne
      A.rect(ctx, 636, 200, 8, 250, '#2a2a30'); A.rr(ctx, 622, 180, 36, 28, 6, '#3a3a40'); A.rect(ctx, 628, 186, 24, 18, '#ffe9a0');
      A.glow(ctx, 640, 200, 180, 'rgba(255,230,160,0.7)', 0.4);
      // Sonnenschirm des Würstchenwagens
      A.rect(ctx, 848, 300, 6, 140, '#8a8a90');
      A.poly(ctx, [700, 340, 960, 340, 930, 300, 730, 300], '#b34a3a');
      for (let i = 0; i < 6; i++) A.poly(ctx, [700 + i * 44, 340, 722 + i * 44, 340, 726 + i * 44, 300, 712 + i * 44, 300], '#f0e0d0');
      // Hydrant
      A.rr(ctx, 80, 400, 20, 44, 5, '#a3312a'); A.rect(ctx, 72, 412, 36, 8, '#a3312a'); A.circle(ctx, 90, 398, 10, '#a3312a');
      // Zeitungsstapel
      A.rect(ctx, 130, 425, 50, 18, '#e8e0d0'); A.rect(ctx, 134, 420, 46, 6, '#d8d0c0');
      A.vignette(ctx, 960, 600, 0.5);
      A.grain(ctx, 960, 600, 7, 0.04);
    },
    hotspots: [
      { id: 'marquee', name: 'Leuchtreklame', rect: [200, 110, 560, 70], at: [480, 480, 'u'], noWalk: true,
        look: 'Dr. Livia Marsh. Atlantis: Mythos oder Erinnerung? Sie hat es weit gebracht mit dem Fragezeichen.' },
      { id: 'plakat', name: 'Plakat', rect: [240, 260, 96, 150], at: [288, 480, 'u'],
        look: async (g) => { await g.say('falk', 'Ringe im Meer, ein Tempel in der Mitte. Nach Platon gezeichnet, aber hübscher. Vortrag um 20 Uhr, heute.'); if (!g.flag('plakat_gelesen')) { g.set('plakat_gelesen'); await g.say('falk', 'Und unten klein: „Mit Fundstücken von Thera.“ Das wird Vesper gelesen haben.'); } },
        take: 'Der Türsteher sieht her.' },
      { id: 'kasse', name: 'Kasse', rect: [610, 260, 90, 180], at: [655, 480, 'u'],
        look: 'Ausverkauft. Seit Tagen, dem Staub auf dem Schild nach.', use: 'Niemand da. Und keine Karten.', open: 'Die Klappe ist zu.', talk: 'Hinter der Scheibe sitzt niemand.' },
      { id: 'laterne', name: 'Straßenlaterne', rect: [620, 178, 40, 270], at: [640, 490, 'u'], look: 'Gaslicht. Die Stadt stellt gerade auf Strom um, aber nicht in dieser Straße.', push: 'Sie steht fest.' },
      { id: 'wagen', name: 'Würstchenwagen', rect: [720, 340, 130, 100], at: [700, 500, 'r'], z: 462,
        paint: (ctx) => {
          A.rect(ctx, 720, 380, 130, 60, '#d8d0c0'); A.rect(ctx, 720, 372, 130, 10, '#b34a3a');
          for (let i = 0; i < 5; i++) A.rect(ctx, 724 + i * 26, 372, 13, 10, '#f0e0d0');
          A.rect(ctx, 728, 350, 50, 22, '#8a8a90'); A.rect(ctx, 792, 356, 40, 16, '#e0b84a');
          A.text(ctx, 'HOT DOGS', 785, 415, { font: 'bold 12px Georgia', color: '#b34a3a', align: 'center' });
          A.circle(ctx, 740, 448, 12, '#222'); A.circle(ctx, 830, 448, 12, '#222');
        },
        look: 'Ein Würstchenwagen. Der Senf ist älter als der Verkäufer.', open: 'Der Verkäufer würde das nicht mögen.', use: 'Ich kaufe lieber etwas, als selbst hineinzugreifen.',
        take: 'Ich nehme nichts ohne zu bezahlen.', giveWith: { muenzen: (g) => g.hs('wagen').buy(g) },
        buy: async (g) => { if (g.has('hotdog')) return 'Einer reicht.'; await g.say('verkaeufer', 'Einen mit Senf? Zehn Cent.'); await g.say('falk', 'Mit Senf.'); g.take('hotdog'); await g.say('falk', 'Ich habe keinen Hunger. Aber man weiß nie, wen man füttern muss.'); } },
      { id: 'hydrant', name: 'Hydrant', rect: [70, 390, 40, 55], at: [110, 500, 'l'], look: 'Ein Hydrant. Rot, wie alle in dieser Stadt.', open: 'Dann stünde die Straße unter Wasser, und ich im Gefängnis.' },
      { id: 'zeitungen', name: 'Zeitungsstapel', rect: [130, 418, 50, 26], at: [150, 480, 'u'],
        look: async (g) => { await g.say('falk', 'Die Abendausgabe. Unten auf der ersten Seite: „Berliner Gesellschaft chartert Jacht für Mittelmeerfahrt.“'); if (!g.flag('zeitung_gelesen')) { g.set('zeitung_gelesen'); await g.say('falk', 'Die Jacht heißt „Meridian“. Vesper reist also. Die Frage ist, wohin.'); } },
        take: 'Der Junge lebt davon.' },
    ],
    exits: [
      { id: 'eingang', name: 'Theatereingang', rect: [370, 240, 200, 200], at: [470, 480, 'u'], to: null,
        look: 'Zwei Türen, ein Türsteher, keine Karte.',
        before: async (g) => { if (g.flag('flucht')) { await g.say('falk', 'Da drin wartet Kessler. Ich habe genug von ihm für heute.'); return false; } await g.say('tuersteher', 'Karte?'); await g.say('falk', 'Keine.'); await g.say('tuersteher', 'Dann nicht.'); return false; },
        open: (g) => g.travel(g.hs('eingang')) },
      { id: 'gasse', name: 'Gasse', rect: [846, 200, 110, 240], at: [900, 480, 'r'], to: 'ny_alley', pos: [120, 520], dir: 'r', look: 'Eine Gasse neben dem Theater. Dunkel, feucht, nach Katze riechend.' },
      { id: 'taxi', name: 'Zur Bahnhofstraße', rect: [0, 440, 40, 150], at: [40, 520, 'l'], cond: (g) => g.flag('ny_fertig'),
        look: 'Von hier fahren Taxis zum Hafen. Livia sagt, die „Aquitania“ legt morgen früh ab.',
        before: async (g) => { await ATL.story.openMap(g, 'newyork'); return false; } },
    ],
    actors: [
      { id: 'tuersteher', x: 470, y: 470, dir: 'd', cond: (g) => !g.flag('flucht'), talk: (g) => g.dialog('tuersteher'), look: 'Ein Türsteher in Rot. Er füllt die Tür aus und weiß es.',
        giveWith: { muenzen: async (g) => { await g.say('tuersteher', 'Das ist kein Trinkgeld. Das ist eine Beleidigung.'); }, visitenkarte: async (g) => { await g.say('tuersteher', 'Meridian-Gesellschaft? Die zwei von denen sind schon drin. Und die hatten Karten.'); g.set('meridian_drin'); }, hotdog: 'Er schüttelt den Kopf, ohne hinzusehen.' } },
      { id: 'verkaeufer', x: 785, y: 452, dir: 'd', scale: 0.82, talk: (g) => g.dialog('verkaeufer'), look: 'Der Würstchenverkäufer. Er hat den ganzen Abend noch nicht gelächelt, aber die Würstchen sind heiß.',
        giveWith: { muenzen: (g) => g.hs('wagen').buy(g) } },
      { id: 'zeitungsjunge', x: 110, y: 470, dir: 'r', cond: (g) => !g.flag('flucht'), talk: (g) => g.dialog('zeitungsjunge'), look: 'Ein Zeitungsjunge, vielleicht zwölf. Er ruft Schlagzeilen, die keiner hören will.',
        giveWith: { muenzen: async (g) => { await g.say('zeitungsjunge', 'Danke, Mister! Die Abendausgabe ist da drüben, nehmen Sie eine.'); g.set('zeitung_bezahlt'); } } },
      { id: 'livia', x: 300, y: 500, dir: 'r', cond: (g) => g.flag('flucht'), talk: (g) => g.dialog('livia_ny'), look: 'Livia. Sie sieht aus, als hätte sie gerade einen Vortrag gehalten und ein Handgemenge überstanden. Beides stimmt.' },
    ],
    async enter(g) {
      if (!g.flag('ny_angekommen')) {
        g.set('ny_angekommen');
        await g.scene(async () => {
          await g.message('New York. Zwei Tage später.', 2400);
          await g.say('falk', 'Broadway, Ecke 47. Straße. Livia hält Vorträge in einem Theater. Über Atlantis. Ich hätte es wissen müssen.');
        });
        g.objective('Ins Theater kommen und Livia Marsh finden.');
      }
      if (g.flag('flucht') && !g.flag('ny_fertig')) {
        await g.scene(async () => {
          await g.say('livia', 'Das war knapp.');
          await g.say('falk', 'Das war Kessler. Der Mann, der die Figur hat.');
          await g.say('livia', 'Dann hat Vesper jetzt die Figur, und wir haben das Medaillon und die Perle. Er wird es nicht dabei belassen.');
          await g.say('falk', 'Was will er damit, Livia? Und sag jetzt nicht Atlantis.');
          await g.say('livia', 'Atlantis. Aber nicht so, wie du denkst. Platon schreibt, Solon habe die Geschichte in Ägypten gehört, in Sais, von Priestern der Neith.');
          await g.say('livia', 'Alle halten das für Platons Rahmenerzählung. Ich habe auf Thera etwas gefunden, das dagegen spricht. Wenn die Priester etwas aufgeschrieben haben, dann liegt es dort.');
          await g.say('falk', 'Sais ist ein Hügel im Nildelta. Da steht nichts mehr.');
          await g.say('livia', 'Über der Erde. Das Altertumsinstitut in Alexandria hat die Grabungsberichte. Wir fahren morgen früh.');
          await g.say('falk', 'Wir.');
          await g.say('livia', 'Du hast die Perle, ich das Medaillon. Und du kannst graben, ich kann lesen. Wir.');
          g.set('ny_fertig');
          g.objective('Nach Alexandria reisen und die Aufzeichnungen von Sais finden.');
        });
      }
    },
  });

  ATL.dialogs.define('tuersteher', {
    nodes: {
      root: {
        options: [
          { text: 'Ich muss zu Dr. Marsh. Es ist dringend.', once: true, say: [['tuersteher', 'Alle müssen zu Dr. Marsh. Deshalb gibt es Karten.'], ['falk', 'Ich bin ein Kollege.'], ['tuersteher', 'Kollegen haben Karten.']] },
          { text: 'Wo bekomme ich eine Karte?', once: true, say: [['tuersteher', 'Nirgends. Ausverkauft seit Dienstag.'], ['falk', 'Und der Bühneneingang?'], ['tuersteher', 'Ist für die Bühne.']] },
          { text: 'Waren heute Männer in schwarzen Mänteln hier?', once: true, say: [['tuersteher', 'Zwei. Deutsche, glaube ich. Mit Karten in der ersten Reihe.'], ['falk', 'Natürlich mit Karten.']], action: (g) => g.set('meridian_drin') },
          { text: 'Schönen Abend noch.', end: true, say: [['tuersteher', 'Mhm.']] },
        ],
      },
    },
  });
  ATL.dialogs.define('verkaeufer', {
    nodes: {
      root: {
        options: [
          { text: 'Einen Hotdog, bitte.', cond: (g) => !g.has('hotdog'), say: [['verkaeufer', 'Mit Senf? Zehn Cent.'], ['falk', 'Mit Senf.']], action: async (g) => { g.take('hotdog'); await g.say('falk', 'Ich habe keinen Hunger. Aber man weiß nie, wen man füttern muss.'); } },
          { text: 'Läuft das Geschäft?', once: true, say: [['verkaeufer', 'Vor dem Vortrag ja. Nach dem Vortrag reden alle über versunkene Städte und keiner hat Hunger.']] },
          { text: 'Kennen Sie den Bühneneingang?', once: true, say: [['verkaeufer', 'In der Gasse. Da kommt nur raus, wer drin war. Und die Katze.'], ['falk', 'Die Katze?'], ['verkaeufer', 'Sitzt jeden Abend auf der Feuerleiter und wartet, dass ich ihr was hinwerfe. Kriegt sie nicht.']] },
          { text: 'Danke.', end: true },
        ],
      },
    },
  });
  ATL.dialogs.define('zeitungsjunge', {
    nodes: {
      root: {
        say: [['zeitungsjunge', 'Abendausgabe! Berliner Jacht im Hafen! Bürgermeister dementiert!']],
        options: [
          { text: 'Welche Berliner Jacht?', once: true, say: [['zeitungsjunge', 'Die „Meridian“. Liegt am Pier 54. Ganz weiß, mit einem Herrn drauf, der aussieht, als wäre er aus Marmor.'], ['falk', 'Vesper. Er ist selbst hier.']], action: (g) => g.set('vesper_in_ny') },
          { text: 'Hast du Dr. Marsh gesehen?', once: true, say: [['zeitungsjunge', 'Die Atlantis-Dame? Klar. Kommt jeden Abend durch die Gasse, weil vorne die Leute stehen.']] },
          { text: 'Mach\'s gut.', end: true, say: [['zeitungsjunge', 'Abendausgabe!']] },
        ],
      },
    },
  });

  // ---------------------------------------------------------------- Gasse
  R({
    id: 'ny_alley', name: 'Gasse hinter dem Theater', ambient: 'city',
    start: [120, 520, 'r'],
    walk: [[40, 445, 920, 445, 940, 585, 20, 585]],
    scale: { y0: 430, s0: 0.8, y1: 585, s1: 1.05 },
    paint(ctx, g) {
      A.sky(ctx, 960, 600, '#0a0d24', '#1a1830');
      A.stars(ctx, 960, 120, 30, 14);
      // Wände
      A.bricks(ctx, 0, 0, 960, 440, '#4a3e3c', 36, 14, 5, '#2a2220');
      A.shadeRect(ctx, 0, 0, 960, 440, 0.35);
      // Feuerleiter links
      A.rect(ctx, 130, 200, 200, 8, '#2a2a30');
      for (let i = 0; i < 8; i++) A.rect(ctx, 134 + i * 26, 170, 4, 30, '#2a2a30');
      A.rect(ctx, 130, 166, 200, 4, '#2a2a30');
      A.rect(ctx, 150, 60, 160, 110, '#1a1a22'); // Fenster oben
      A.rect(ctx, 156, 66, 148, 98, '#3a3a50');
      if (g.flag('leiter_unten')) A.ladder(ctx, 200, 208, 232, '#3a3a40', 34);
      else { ctx.save(); ctx.translate(200, 208); ctx.rotate(Math.PI); A.ladder(ctx, -39, 0, 100, '#3a3a40', 34); ctx.restore(); }
      // Bühnentür rechts
      A.door(ctx, 800, 260, 70, 180, '#3a3a44', { frame: '#1a1a20', planks: false, knob: '#8a8a90' });
      A.text(ctx, 'BÜHNENEINGANG', 835, 250, { font: 'bold 9px Georgia', color: '#c8c0b0', align: 'center' });
      A.rr(ctx, 780, 300, 12, 20, 3, '#5a5a60'); A.circle(ctx, 786, 310, 3, '#d8b858');
      A.rect(ctx, 790, 200, 90, 30, '#1a1a20'); A.rect(ctx, 796, 206, 78, 18, '#ffe9a0'); A.glow(ctx, 835, 215, 120, 'rgba(255,230,160,0.5)', 0.3);
      // Mülltonnen
      A.barrel(ctx, 560, 360, 60, 80, '#5a5a60'); A.barrel(ctx, 630, 370, 56, 70, '#4a4a50');
      A.rect(ctx, 556, 356, 68, 8, '#6a6a70');
      // Kisten
      A.crate(ctx, 60, 380, 80, 60, '#5a4a3a', ''); A.crate(ctx, 80, 330, 60, 50, '#6a5a4a', '');
      // Boden
      A.ground(ctx, 0, 440, 960, 160, '#3a3a42', '#1a1a20');
      for (let i = 0; i < 12; i++) A.ell(ctx, 100 + i * 80, 470 + (i % 3) * 30, 40, 6, 'rgba(120,140,170,0.15)');
      A.vignette(ctx, 960, 600, 0.6);
      A.grain(ctx, 960, 600, 8, 0.05);
    },
    hotspots: [
      { id: 'buehnentuer', name: 'Bühneneingang', rect: [796, 256, 78, 188], at: [835, 480, 'u'],
        look: 'Der Bühneneingang. Stahl, verschlossen, mit einer Klingel, auf die niemand reagiert.',
        open: 'Verschlossen. Von innen verriegelt, dem Klang nach.', use: (g) => g.hs('buehnentuer').open(g), push: 'Stahl. Nein.', pull: 'Es gibt keinen Griff außen.',
        talk: async (g) => { await g.say('falk', 'Hallo? Dr. Falk für Dr. Marsh!'); await g.wait(600); await g.say('falk', 'Nichts. Entweder hört mich keiner, oder keiner will.'); },
        useWith: { taschenmesser: 'Das Schloss ist besser als mein Messer.', default: 'Die Tür bleibt zu.' } },
      { id: 'klingel', name: 'Klingel', rect: [778, 296, 16, 26], at: [820, 480, 'u'], look: 'Eine Klingel mit Messingknopf.', push: (g) => g.hs('buehnentuer').talk(g), use: (g) => g.hs('buehnentuer').talk(g) },
      { id: 'feuerleiter', name: 'Feuerleiter', rect: [130, 60, 200, 150], at: [220, 480, 'u'],
        look: (g) => g.flag('leiter_unten') ? 'Die Feuerleiter ist ausgeklappt. Sie führt zu einem Fenster im ersten Stock.' : 'Eine Feuerleiter. Die untere Leiter ist hochgeklappt, gut drei Meter über mir. Und obendrauf sitzt eine Katze.',
        use: (g) => g.flag('leiter_unten') ? g.travel(g.hs('hinauf')) : 'Zu hoch. Die Leiter ist hochgeklappt und die Katze denkt nicht daran, sie herunterzulassen.',
        pull: (g) => g.flag('leiter_unten') ? 'Sie ist schon unten.' : 'Ich komme nicht heran. Zwanzig Zentimeter fehlen, wie immer im Leben.',
        take: 'Die gehört zum Haus.' },
      { id: 'katze', name: 'Katze', rect: [220, 170, 50, 40], at: [220, 480, 'u'], cond: (g) => !g.flag('leiter_unten'), z: 190,
        paint: (ctx, g, t) => { A.ell(ctx, 245, 195, 20, 10, '#2a2a30'); A.circle(ctx, 228, 186, 9, '#2a2a30'); A.poly(ctx, [221, 180, 224, 170, 229, 179], '#2a2a30'); A.poly(ctx, [231, 179, 235, 170, 237, 180], '#2a2a30'); A.circle(ctx, 225, 186, 1.5, '#d8e040'); A.circle(ctx, 231, 186, 1.5, '#d8e040'); A.path(ctx, [264, 196, 278, 186 + Math.sin(t * 2) * 4, 272, 176], '#2a2a30', 4); },
        look: 'Eine schwarze Katze auf der hochgeklappten Leiter. Sie sieht auf mich herab, wie Katzen das tun.',
        talk: async (g) => { await g.say('falk', 'Miez.'); await g.wait(500); await g.say('falk', 'Sie blinzelt. Ich glaube, das war eine Absage.'); },
        take: 'Zu hoch. Und sie würde nicht mitkommen.', use: 'Ich habe nichts, was eine Katze interessiert.',
        useWith: { hotdog: (g) => g.hs('katze').giveWith.hotdog(g), default: 'Die Katze ist nicht beeindruckt.' },
        giveWith: { hotdog: async (g) => {
          await g.say('falk', 'Hier. Mit Senf.');
          g.hero.anim = 'reach'; await g.wait(500); g.hero.anim = 'stand';
          g.drop('hotdog');
          await g.message('Die Katze springt. Die Leiter klappt unter ihrem Gewicht herunter und rastet ein.', 2600);
          g.fx('stone');
          g.set('leiter_unten'); g.repaint();
          await g.say('falk', 'Zehn Cent für einen Weg nach oben. Ein fairer Preis.');
          g.objective('Über die Feuerleiter ins Theater klettern.');
        }, muenzen: 'Katzen nehmen kein Geld.' } },
      { id: 'muelltonnen', name: 'Mülltonnen', rect: [556, 356, 130, 90], at: [620, 490, 'u'],
        look: 'Zwei Mülltonnen. Programmhefte, Blumen und die Reste des Buffets.',
        open: async (g) => { await g.say('falk', 'Programmhefte, welke Rosen, und ein Stapel Flugblätter: „Die Wahrheit über Atlantis. Meridian-Gesellschaft.“'); if (!g.flag('flugblatt')) { g.set('flugblatt'); await g.say('falk', 'Vesper macht Werbung. Vor Livias Theater.'); } },
        take: 'Ich nehme keine welken Rosen mit.', use: (g) => g.hs('muelltonnen').open(g) },
      { id: 'kisten', name: 'Kisten', rect: [60, 330, 90, 110], at: [150, 500, 'l'], look: 'Leere Kisten. „Bühnenbild, zerbrechlich.“ Sie sind nicht mehr zerbrechlich, sie sind zerbrochen.',
        take: 'Zu sperrig, und morsch.', push: 'Sie stehen, wo sie stehen. Zu weit von der Leiter.', use: 'Draufsteigen? Sie tragen keine Katze, geschweige denn mich.' },
      { id: 'fenster_oben', name: 'Fenster', rect: [150, 60, 160, 110], at: [220, 480, 'u'], noWalk: true, look: 'Ein Fenster im ersten Stock. Dahinter brennt Licht. Garderoben, würde ich sagen.' },
    ],
    exits: [
      { id: 'strasse', name: 'Zur Straße', rect: [0, 300, 40, 290], at: [50, 520, 'l'], to: 'ny_street', pos: [880, 500], dir: 'l', look: 'Zurück zur Straße.' },
      { id: 'hinauf', name: 'Feuerleiter', rect: [196, 206, 44, 240], at: [220, 470, 'u'], cond: (g) => g.flag('leiter_unten'),
        look: 'Die Leiter führt zum Fenster im ersten Stock.',
        before: async (g) => {
          await g.scene(async () => {
            g.hero.fixedScale = g.hero.scale;
            for (let i = 1; i <= 12 && !g.fast; i++) { g.hero.offsetY = -i * 30; await g.wait(90); }
            g.hero.offsetY = 0; g.hero.fixedScale = null;
          });
          await g.goto('ny_dressing', 860, 500, 'l');
          return false;
        } },
    ],
  });

  // ---------------------------------------------------------------- Garderobe
  R({
    id: 'ny_dressing', name: 'Garderobe', ambient: 'city',
    start: [860, 500, 'l'],
    walk: [[40, 440, 920, 440, 940, 585, 20, 585]],
    scale: { y0: 420, s0: 0.8, y1: 585, s1: 1.05 },
    paint(ctx, g) {
      A.wall(ctx, 0, 0, 960, 420, '#6a5a6a', 9);
      A.rect(ctx, 0, 0, 960, 30, '#4a3a4a');
      A.rect(ctx, 0, 380, 960, 40, '#3a2a3a');
      A.planks(ctx, 0, 420, 960, 180, '#5a4a40', 12, false, 4);
      ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(0, 420, 960, 6);
      // Tür links
      A.door(ctx, 30, 190, 70, 230, '#4a3a4a', { panel: true, frame: '#2a1a2a' });
      A.text(ctx, 'BÜHNE', 65, 182, { font: 'bold 9px Georgia', color: '#e8d8b0', align: 'center' });
      // Spiegel mit Glühbirnen
      A.rect(ctx, 120, 110, 220, 230, '#2a2a30'); A.rect(ctx, 130, 120, 200, 210, '#8a90a8');
      ctx.fillStyle = 'rgba(255,255,255,0.15)'; A.poly(ctx, [132, 122, 200, 122, 132, 260], ctx.fillStyle);
      for (let i = 0; i < 8; i++) { A.circle(ctx, 130 + i * 28, 114, 5, '#ffe9a0'); A.circle(ctx, 130 + i * 28, 336, 5, '#ffe9a0'); }
      for (let i = 0; i < 6; i++) { A.circle(ctx, 124, 140 + i * 36, 5, '#ffe9a0'); A.circle(ctx, 336, 140 + i * 36, 5, '#ffe9a0'); }
      A.glow(ctx, 230, 225, 220, 'rgba(255,230,160,0.5)', 0.35);
      // Schminktisch, umgeworfener Stuhl
      A.table(ctx, 110, 340, 240, 26, '#6a4a3a', 60);
      A.rect(ctx, 140, 320, 30, 20, '#e8d8b0'); A.rect(ctx, 180, 326, 40, 14, '#d8c8a0'); A.rr(ctx, 250, 316, 14, 24, 4, '#c8a848');
      ctx.save(); ctx.translate(420, 430); ctx.rotate(1.2); A.chair(ctx, 0, 0, 40, '#5a3a2a'); ctx.restore();
      // Kleiderschrank, aufgerissen
      A.rect(ctx, 640, 130, 170, 290, '#4a3020');
      A.rect(ctx, 648, 138, 154, 274, '#2a1a10');
      A.rect(ctx, 652, 150, 146, 6, '#6a5a4a');
      A.rr(ctx, 660, 156, 30, 120, 6, '#8a3a4a'); A.rr(ctx, 700, 156, 30, 130, 6, '#3a4a6a'); A.rr(ctx, 740, 156, 26, 110, 6, '#e8d8b0');
      A.poly(ctx, [810, 130, 880, 150, 880, 400, 810, 420], '#5a4030'); // offene Tür
      // Fenster rechts (offen)
      A.rect(ctx, 856, 150, 90, 160, '#2a1a2a'); A.rect(ctx, 862, 156, 78, 148, '#0d1024');
      A.stars(ctx, 78, 60, 8, 3); ctx.save(); ctx.translate(862, 156); A.stars(ctx, 78, 70, 10, 5); ctx.restore();
      A.rect(ctx, 856, 150, 90, 8, '#e8d8b0');
      // Koffer umgekippt, Papiere
      A.rr(ctx, 470, 360, 130, 60, 6, '#5a3a2a'); A.rect(ctx, 470, 360, 130, 8, '#8a6a4a'); A.rect(ctx, 520, 350, 30, 12, '#c8a848');
      A.rr(ctx, 590, 385, 50, 40, 4, '#e8d8b0');
      for (let i = 0; i < 9; i++) { ctx.save(); ctx.translate(300 + i * 60, 470 + (i % 3) * 30); ctx.rotate((i * 0.7) % 1.2 - 0.6); A.rect(ctx, -16, -10, 32, 20, '#efe4c8'); ctx.restore(); }
      A.rr(ctx, 520, 400, 60, 40, 3, '#3a2a1a'); // Notizbuch
      A.vignette(ctx, 960, 600, 0.5);
    },
    hotspots: [
      { id: 'spiegel', name: 'Spiegel', rect: [120, 110, 220, 230], at: [230, 480, 'u'],
        look: 'Ein Schminkspiegel mit Glühbirnen. Im Rahmen steckt eine Fotografie: das Fresko von Thera, Schiffe auf einem blauen Meer. Livias Grabung.',
        use: 'Ich sehe müde aus. Das Spiegelbild sagt dasselbe.' },
      { id: 'schminktisch', name: 'Schminktisch', rect: [110, 316, 240, 50], at: [230, 480, 'u'],
        look: 'Puder, Lippenstift, ein Fläschchen Parfüm. Und alles durcheinander. Jemand hat gesucht, nicht geschminkt.',
        open: 'Die Schublade hängt schon heraus. Leer.', take: 'Ich lasse ihre Sachen, wo sie sind.' },
      { id: 'stuhl', name: 'Umgestürzter Stuhl', rect: [380, 380, 90, 60], at: [420, 490, 'u'], look: 'Ein umgestoßener Stuhl. Wer hier war, hatte es eilig.', push: 'Ich stelle ihn hin. Er fällt wieder um. Ein Bein fehlt.', take: 'Dreibeinig. Nein.' },
      { id: 'schrank', name: 'Kleiderschrank', rect: [640, 130, 240, 290], at: [720, 480, 'u'],
        look: 'Ein Kleiderschrank, aufgerissen. Kleider, ein Reisemantel, Stiefel für die Grabung. Alle Taschen nach außen gestülpt.',
        open: 'Er ist offen. Offener geht nicht.', close: 'Die Tür hängt schief in den Angeln.', take: 'Ich wühle nicht in Livias Kleidern. Das haben andere schon getan.' },
      { id: 'koffer', name: 'Koffer', rect: [470, 350, 130, 75], at: [535, 490, 'u'],
        look: 'Livias Reisekoffer, aufgebrochen. Das Futter ist aufgeschlitzt.',
        open: 'Er ist offen, und leer. Bis auf das Futter, das jemand mit einem Messer bearbeitet hat.', take: 'Ihr Koffer. Nein.' },
      { id: 'notizbuch', name: 'Notizbuch', rect: [520, 400, 60, 40], at: [550, 490, 'u'],
        look: 'Ein Notizbuch, aufgeschlagen. Livias Handschrift.',
        use: async (g) => { await g.puzzle('note', { title: 'Livias Notizbuch', text: 'Thera, Haus West, Raum 3. Unter dem Fresko der Schiffe: die Figur, das Medaillon, die Perle in der Figur. Metall unbekannt. Warm, wenn beide zusammen sind.\n\nSolon in Sais (Tim. 21e): „Ihr Griechen seid immer Kinder.“ Die Priester hatten ALLES aufgeschrieben. Wenn der Tempel der Neith Archive hatte, wo? Unter der Erde. Immer unter der Erde.\n\nDrei Siegel? Das Medaillon hat drei Ringe.' }); if (!g.flag('notizbuch')) { g.set('notizbuch'); await g.say('falk', '„Warm, wenn beide zusammen sind.“ Sie wusste also von der Perle. Und hat es mir nicht gesagt.'); g.codex('solon'); } },
        open: (g) => g.hs('notizbuch').use(g), take: 'Es gehört ihr. Ich habe gelesen, was ich lesen musste.' },
      { id: 'papiere', name: 'Papiere', rect: [280, 450, 560, 100], at: [480, 520, 'd'], look: 'Vortragsnotizen, Zeichnungen, Rechnungen des Hotels. Über den ganzen Boden verstreut.', take: 'Nichts davon ist mir nützlich.' },
      { id: 'fenster', name: 'Fenster', rect: [856, 150, 90, 160], at: [880, 470, 'u'], look: 'Das Fenster zur Gasse. Durch das bin ich gekommen. Die Katze ist nicht nachgekommen.',
        use: 'Ich bleibe lieber drin.', close: 'Ich lasse es offen. Für den Fall, dass ich schnell wieder hinausmuss.' },
    ],
    exits: [
      { id: 'tuer', name: 'Tür zur Bühne', rect: [26, 186, 78, 238], at: [70, 470, 'u'], to: 'ny_stage', pos: [880, 500], dir: 'l',
        look: 'Die Tür zur Bühne. Dahinter hört man Applaus.',
        before: async (g) => {
          if (g.flag('livia_getroffen')) return true;
          await g.scene(async () => {
            await g.say('falk', 'Der Applaus hört auf. Der Vortrag ist zu Ende.');
            g.fx('door');
            g.place('livia', 40, 480, 'r');
            await g.walk('livia', 150, 490, 'r');
            await g.say('livia', 'Adrian.');
            await g.say('falk', 'Livia.');
            await g.say('livia', 'Du stehst in meiner Garderobe. Durch das Fenster, nehme ich an, weil der Türsteher dich nicht hereingelassen hat.');
            await g.say('falk', 'Jemand war vor mir hier. Durch die Tür, nehme ich an.');
            await g.say('livia', 'Zwei Männer. Sie saßen in der ersten Reihe und sind in der Pause verschwunden. Ich habe es mir gedacht.');
            g.set('livia_getroffen');
          });
          await g.dialog('livia_wiedersehen');
          return false;
        } },
    ],
    actors: [
      { id: 'livia', x: 150, y: 490, dir: 'r', cond: (g) => g.flag('livia_getroffen') && !g.flag('livia_auf_buehne'), talk: (g) => g.dialog('livia_wiedersehen'), look: 'Livia Marsh. Sechs Jahre, und sie sieht aus, als wäre es letzte Woche gewesen. Ich vermutlich nicht.' },
    ],
    async enter(g) {
      if (g.flag('garderobe_besucht')) return;
      g.set('garderobe_besucht');
      await g.say('falk', 'Livias Garderobe. Jemand hat sie auf links gedreht. Koffer, Schrank, Schminktisch: alles durchsucht.');
      g.objective('Herausfinden, was in Livias Garderobe gesucht wurde.');
    },
  });

  ATL.dialogs.define('livia_wiedersehen', {
    nodes: {
      root: {
        options: [
          { text: 'Du siehst gut aus.', once: true, say: [['livia', 'Du auch. Für jemanden, der eben durch ein Fenster geklettert ist.'], ['livia', 'Aber du bist nicht wegen meines Aussehens gekommen.']] },
          { text: 'Ein Mann namens Kessler hat die Figur aus Thera mitgenommen. Mit Gewalt.', once: true, say: [['livia', 'Kessler. Groß, Mantel, kein Hals?'], ['falk', 'Der.'], ['livia', 'Er saß heute in der ersten Reihe. Neben einem Mann, der sich Vesper nennt.'], ['falk', 'Vesper ist hier?'], ['livia', 'Er hat mir nach dem Vortrag Blumen geschickt. Und die Frage, ob ich das Medaillon verkaufen würde.']], action: (g) => g.set('livia_kessler') },
          { text: 'Welches Medaillon?', once: true, cond: (g) => g.flag('livia_kessler'), say: [['livia', 'Thera, 1932. Ich habe es unter dem Fresko der Schiffe gefunden, neben der Figur. Du warst an dem Tag im Dorf.'], ['falk', 'Und hast es mir nicht gesagt.'], ['livia', 'Du hättest es katalogisiert und in die Vitrine gestellt. Ich wollte erst wissen, was es ist.'], ['falk', 'Und?'], ['livia', 'Ich weiß es immer noch nicht. Es ist aus demselben Metall wie die Perle in der Figur.']], action: (g) => g.set('livia_medaillon') },
          { text: 'Ich habe die Perle. Kessler hat nur die Figur.', once: true, cond: (g) => g.flag('livia_medaillon'), say: [['livia', 'Du hast sie? Zeig sie mir nicht hier. Wenn sie in die Nähe des Medaillons kommt, wird sie warm. Und leuchtet. Das habe ich 1932 nur einmal ausprobiert.'], ['falk', 'Wo ist das Medaillon jetzt?'], ['livia', 'Nicht in dieser Garderobe, wie du siehst. Ich habe es heute Nachmittag im Bühnenmodell versteckt, in der Mitte, unter dem Tempel. Falls jemand kommt. Es ist jemand gekommen.'], ['falk', 'Dann holen wir es.'], ['livia', 'Wir. Schön, dass du das sagst.']], action: async (g) => { g.set('livia_versteck'); g.objective('Das Medaillon aus dem Bühnenmodell holen.'); } },
          { text: 'Warum hast du damals das College verlassen?', once: true, say: [['livia', 'Weil du mir gesagt hast, ich soll aufhören, Märchen zu suchen, und Scherben zählen wie alle anderen.'], ['falk', 'Ich habe gesagt, ich könne dir nicht folgen.'], ['livia', 'Das ist dasselbe, Adrian. Nur höflicher.']] },
          { text: 'Gehen wir auf die Bühne.', end: true, cond: (g) => g.flag('livia_versteck'), say: [['livia', 'Nach dir. Du kennst den Weg ja jetzt.']], action: async (g) => { g.set('livia_auf_buehne'); g.hide('livia'); await g.goto('ny_stage', 880, 500, 'l'); } },
          { text: 'Ich schaue mich noch um.', end: true, cond: (g) => !g.flag('livia_versteck'), say: [['livia', 'Tu das. Ich habe hier auch nichts mehr zu suchen, offensichtlich.']] },
        ],
      },
    },
  });

  // ---------------------------------------------------------------- Bühne
  R({
    id: 'ny_stage', name: 'Bühne', ambient: 'city',
    start: [880, 500, 'l'],
    walk: [[60, 430, 900, 430, 920, 585, 40, 585]],
    scale: { y0: 420, s0: 0.8, y1: 585, s1: 1.05 },
    paint(ctx, g) {
      A.rect(ctx, 0, 0, 960, 600, '#0a0808');
      // Hintervorhang und Leinwand
      A.rect(ctx, 0, 40, 960, 380, '#2a1416');
      for (let x = 0; x < 960; x += 40) A.rect(ctx, x, 40, 20, 380, '#3a1a1c');
      A.rect(ctx, 300, 90, 360, 220, '#e8e0d0'); A.rect(ctx, 296, 86, 368, 228, null); ctx.strokeStyle = '#111'; ctx.lineWidth = 4; ctx.strokeRect(296, 86, 368, 228);
      A.sea(ctx, 300, 90, 360, 220, '#6a8aa8', '#3a5a78', 6);
      for (let i = 0; i < 5; i++) A.ell(ctx, 480, 200, 150 - i * 30, 60 - i * 12, i % 2 ? '#8aa870' : '#5a7aa0');
      A.rect(ctx, 470, 190, 20, 14, '#d8c8a0');
      A.text(ctx, 'Kritias 113c–121c', 480, 300, { font: 'italic 12px Georgia', color: '#2a2a2a', align: 'center' });
      // Seitenvorhänge
      ctx.fillStyle = A.grad(ctx, 0, 0, 160, 0, ['#5a1a20', '#8a2a30', '#4a1418']); ctx.fillRect(0, 0, 160, 440);
      ctx.fillStyle = A.grad(ctx, 800, 0, 960, 0, ['#4a1418', '#8a2a30', '#5a1a20']); ctx.fillRect(800, 0, 160, 440);
      for (let i = 0; i < 6; i++) { A.line(ctx, 20 + i * 24, 0, 30 + i * 24, 440, 'rgba(0,0,0,0.25)', 6); A.line(ctx, 820 + i * 24, 0, 830 + i * 24, 440, 'rgba(0,0,0,0.25)', 6); }
      A.rect(ctx, 0, 0, 960, 44, '#1a0a0c');
      // Bühnenboden
      A.planks(ctx, 0, 420, 960, 180, '#4a3a2a', 16, false, 3);
      ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(0, 420, 960, 6);
      // Rednerpult
      A.rect(ctx, 190, 300, 80, 130, '#3a2a1a'); A.rect(ctx, 180, 290, 100, 16, '#5a4a3a'); A.rect(ctx, 200, 280, 60, 12, '#e8e0d0');
      // Modelltisch mit Atlantis-Modell
      A.table(ctx, 520, 340, 260, 24, '#3a2a1a', 80);
      A.ell(ctx, 650, 330, 120, 40, '#3a6a8a');
      for (let i = 0; i < 4; i++) A.ell(ctx, 650, 330, 100 - i * 24, 34 - i * 8, i % 2 ? '#c8b070' : '#5a8aa8', '#2a3a4a', 1);
      if (!g.flag('modell_offen')) { A.rect(ctx, 640, 305, 20, 22, '#e8d8b0'); A.poly(ctx, [636, 306, 664, 306, 650, 296], '#c8b070'); }
      else { A.rect(ctx, 665, 312, 20, 10, '#e8d8b0'); A.ell(ctx, 650, 328, 8, 4, '#1a2a3a'); }
      // Falltür
      A.rect(ctx, 300, 522, 90, 44, '#3a2a1a'); ctx.strokeStyle = '#2a1a0a'; ctx.lineWidth = 3; ctx.strokeRect(300, 522, 90, 44); A.rect(ctx, 340, 540, 10, 6, '#8a8a90');
      // Scheinwerfer
      A.lightBeam(ctx, 650, 44, 220, 300, 'rgba(255,240,200,0.14)');
      A.lightBeam(ctx, 230, 44, 160, 260, 'rgba(255,240,200,0.12)');
      A.vignette(ctx, 960, 600, 0.55);
    },
    animate(ctx, t, g) { if (g.flag('medaillon_leuchtet')) A.glow(ctx, 650, 320, 120 + Math.sin(t * 5) * 20, 'rgba(120,255,210,0.8)', 0.6); },
    hotspots: [
      { id: 'leinwand', name: 'Leinwand', rect: [296, 86, 368, 228], at: [480, 470, 'u'],
        look: async (g) => { await g.say('falk', 'Livias letztes Bild: die Ringe der Stadt, nach Platons Beschreibung im Kritias. Drei Ringe Wasser, zwei Ringe Land, in der Mitte der Tempel.'); g.codex('ringe'); } },
      { id: 'vorhang', name: 'Vorhang', rect: [0, 0, 160, 440], at: [180, 480, 'l'], look: 'Roter Samt. Er riecht nach Staub und zweihundert Vorstellungen.', pull: 'Er hängt an Seilen, die irgendwo oben festgemacht sind. Nicht mein Vorhang.', open: 'Er ist offen.' },
      { id: 'pult', name: 'Rednerpult', rect: [180, 280, 100, 150], at: [230, 480, 'u'],
        look: async (g) => { await g.say('falk', 'Livias Vortragsnotizen. „Solon, Sais, Neith. Die Priester hatten alles aufgeschrieben. Timaios 22b.“ Sie zitiert richtig, das muss man ihr lassen.'); g.codex('solon'); g.codex('neith'); },
        take: 'Die Notizen gehören ihr.', open: 'Das Pult hat keine Tür.' },
      { id: 'modell', name: 'Bühnenmodell', rect: [520, 280, 260, 84], at: [650, 480, 'u'],
        look: (g) => g.flag('modell_offen') ? 'Das Modell von Atlantis. Der Tempel in der Mitte ist abgehoben.' : 'Ein Modell der Stadt Atlantis, aus Gips und Farbe. Ringe aus Wasser und Land, in der Mitte ein kleiner Tempel. Livia sagt, das Medaillon liegt darunter.',
        open: (g) => g.flag('modell_offen') ? 'Es ist offen.' : 'Der Tempel ist festgeklebt. Ich bräuchte etwas mit einer Klinge.',
        take: (g) => g.flag('medaillon_genommen') ? 'Das Modell bleibt hier. Es ist ihr Bühnenbild.' : 'Ich brauche nur, was darunter liegt.',
        use: (g) => g.hs('modell').open(g), push: 'Gips. Wenn ich schiebe, bricht es.', pull: 'Gips. Wenn ich ziehe, bricht es.',
        useWith: { taschenmesser: async (g) => {
          if (g.flag('modell_offen')) return 'Es ist schon offen.';
          await g.say('falk', 'Ich setze die Klinge unter den Tempel…');
          g.fx('click');
          g.set('modell_offen'); g.repaint();
          await g.say('falk', 'Er löst sich. Darunter: eine Mulde. Und in der Mulde ein Medaillon.');
        }, default: 'Damit beschädige ich nur das Modell.' } },
      { id: 'medaillon', name: 'Medaillon', rect: [636, 312, 28, 22], at: [650, 480, 'u'], cond: (g) => g.flag('modell_offen') && !g.flag('medaillon_genommen'),
        look: 'Eine Scheibe aus grünlichem Metall mit drei Ringen. Wie das Metall der Perle.',
        take: async (g) => {
          g.set('medaillon_genommen'); g.take('medaillon'); g.repaint();
          await g.scene(async () => {
            await g.say('falk', 'Es ist warm. Und die Perle in meiner Tasche wird auch warm.');
            g.set('medaillon_leuchtet'); g.fx('glow');
            await g.message('Das Medaillon leuchtet auf. Die Perle antwortet. Für einen Moment hört Falk eine Stimme, die nicht im Raum ist.', 3200);
            await g.say('anaksar', 'Dreimal versiegelt. Sonne, Stier und Flut. Wer die Ringe dreht, öffnet das Tor unter dem brennenden Berg.');
            g.set('medaillon_leuchtet', false);
            await g.say('falk', 'Was war das?');
            await g.say('livia', 'Das Medaillon. Es hat 1932 dasselbe getan, als ich es zum ersten Mal mit der Perle zusammen in der Hand hatte. Ich habe damals gedacht, ich hätte zu lange in der Sonne gestanden.');
            await g.say('falk', 'Dreimal versiegelt. Sonne, Stier und Flut.');
            await g.say('livia', 'Das ist neu. Zu mir hat es nur „Sonne“ gesagt.');
            g.fx('door');
            g.place('kessler', 900, 470, 'l'); g.place('schlaeger', 940, 500, 'l');
            await g.say('kessler', 'Dr. Marsh. Dr. Falk. Wie praktisch, Sie beide an einem Ort.');
            await g.walk('kessler', 760, 490, 'l'); await g.walk('schlaeger', 820, 520, 'l');
            await g.say('falk', 'Kessler. Haben Sie die Figur gut nach Hause gebracht?');
            await g.say('kessler', 'Sie ist an Bord. Das Medaillon kommt jetzt dazu. Und Sie beide auch, wenn Herr Vesper das wünscht.');
            await g.say('livia', 'Adrian. Die Falltür. Jetzt.');
            g.objective('Durch die Falltür fliehen.');
          });
        } },
      { id: 'falltuer', name: 'Falltür', rect: [300, 522, 90, 44], at: [345, 510, 'd'],
        look: 'Eine Falltür im Bühnenboden. Für Geister, Teufel und Leute, die schnell verschwinden müssen.',
        open: async (g) => {
          if (!g.flag('medaillon_genommen')) return 'Ich sollte erst holen, weswegen ich hier bin.';
          await g.scene(async () => {
            g.fx('door');
            await g.say('falk', 'Rein da.');
            await g.walk('livia', 345, 515, 'd');
            g.hide('livia');
            g.hero.fixedScale = g.hero.scale;
            for (let i = 1; i <= 8 && !g.fast; i++) { g.hero.offsetY = i * 18; await g.wait(60); }
            g.hide('falk');
            await g.say('kessler', 'Hinterher!');
            await g.message('Unter der Bühne: Seile, Kulissen, eine Tür zur Gasse. Und dann die Straße.', 2600);
            g.hero.offsetY = 0; g.hero.fixedScale = null; g.hero.visible = true;
            g.set('flucht');
            g.hide('kessler'); g.hide('schlaeger');
            await g.goto('ny_street', 200, 520, 'r');
          });
        },
        use: (g) => g.hs('falltuer').open(g), pull: (g) => g.hs('falltuer').open(g), push: 'Sie öffnet sich nach unten. Ziehen, nicht drücken.' },
      { id: 'scheinwerfer', name: 'Scheinwerfer', rect: [560, 40, 200, 30], at: [650, 480, 'u'], noWalk: true, look: 'Ein Scheinwerfer, auf das Modell gerichtet. Livia versteht etwas von Wirkung.' },
    ],
    exits: [
      { id: 'garderobe', name: 'Tür zur Garderobe', rect: [860, 200, 80, 240], at: [880, 470, 'u'], to: 'ny_dressing', pos: [70, 480], dir: 'r', look: 'Zurück zur Garderobe.', cond: (g) => !g.flag('medaillon_genommen') },
    ],
    actors: [
      { id: 'livia', x: 560, y: 500, dir: 'r', cond: (g) => !g.flag('flucht'), talk: (g) => g.dialog('livia_buehne'), look: 'Livia, neben ihrem Modell. Sie sieht aus, als würde sie jeden Moment einen Vortrag beginnen.' },
    ],
    async enter(g) {
      if (g.flag('buehne_besucht')) return;
      g.set('buehne_besucht');
      await g.say('livia', 'Das Modell. In der Mitte, unter dem Tempel. Ich habe den Tempel festgeklebt, sicher ist sicher.');
      await g.say('falk', 'Sicher ist sicher. Sagt die Frau, deren Garderobe aussieht wie nach einem Erdbeben.');
    },
  });

  ATL.dialogs.define('livia_buehne', {
    nodes: {
      root: {
        options: [
          { text: 'Wie öffne ich das Modell?', once: true, say: [['livia', 'Mit etwas Scharfem. Ich habe Bühnenleim genommen, der hält. Du hast doch immer dieses schreckliche Taschenmesser dabei.'], ['falk', 'Es ist ein gutes Messer.'], ['livia', 'Es ist stumpf. Aber es reicht für Leim.']] },
          { text: 'Was ist das für ein Metall?', once: true, say: [['livia', 'Ich habe es in Boston analysieren lassen. Kupfer, Zink, und ein Rest, den der Chemiker nicht bestimmen konnte. Er hat mich gefragt, ob ich ihn auf den Arm nehme.'], ['falk', 'Platon nennt es Orichalkum.'], ['livia', 'Platon nennt es ein Metall, das zu seiner Zeit nur noch dem Namen nach bekannt war. Ich nenne es das Ding, das Vesper haben will.']], action: (g) => g.codex('orichalkum') },
          { text: 'Warum hältst du Vorträge in einem Theater?', once: true, say: [['livia', 'Weil Universitäten keine Grabungen bezahlen, die nach Atlantis suchen. Theaterbesucher schon. Zwei Dollar pro Kopf.'], ['falk', 'Und Vesper hat zwei Dollar bezahlt.'], ['livia', 'Vesper hat einen Scheck über zwanzigtausend geschickt. Für das Medaillon. Ich habe ihn zurückgeschickt.']] },
          { text: 'Ich hole das Medaillon.', end: true, say: [['livia', 'Ich stehe hier und sehe zu. Das kann ich gut, sagst du immer.']] },
        ],
      },
    },
  });
  ATL.dialogs.define('livia_ny', {
    nodes: {
      root: {
        options: [
          { text: 'Erzähl mir von Sais.', once: true, say: [['livia', 'Im Nildelta, die Stadt der Neith. Platon lässt Solon dort mit einem Priester reden, der sagt, die Griechen hätten kein Gedächtnis, die Ägypter aber hätten alles aufgeschrieben.'], ['livia', 'Das Altertumsinstitut in Alexandria hat 1911 dort gegraben und aufgehört, als das Geld ausging. Die Berichte liegen in der Bibliothek.']], action: (g) => g.codex('solon') },
          { text: 'Was hat die Stimme gemeint, mit dem brennenden Berg?', once: true, say: [['livia', 'Thera. Der Vulkan. Da haben wir die Figur gefunden, und das Medaillon, unter zehn Metern Bims. Was auch immer das Tor ist, es liegt dort.'], ['falk', 'Und die drei Siegel?'], ['livia', 'Sonne, Stier, Flut. Wenn ich das wüsste, hätte ich keinen Vortrag gehalten, sondern gegraben.']] },
          { text: 'Sollen wir nicht die Polizei rufen?', once: true, say: [['livia', 'Und sagen was? Ein Berliner Verein hat meine Garderobe durchsucht und will ein Medaillon, das nach Platon aus einem Metall besteht, das es nicht gibt?'], ['falk', 'Klingt schlecht, wenn du es so sagst.']] },
          { text: 'Dann zum Hafen.', end: true, say: [['livia', 'Die „Aquitania“ um sieben. Ich habe zwei Kabinen. Getrennte.']] },
        ],
      },
    },
  });
})(window.ATL);
