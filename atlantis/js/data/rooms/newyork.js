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
      // Oberleitung quer über die Straße
      A.path(ctx, [0, 46, 480, 58, 960, 44], 'rgba(0,0,0,0.6)', 1.5);
      // Theaterfassade
      A.bricks(ctx, 120, 60, 720, 380, '#5a4a48', 36, 14, 4, '#3a2e2c');
      A.rect(ctx, 120, 60, 720, 12, '#7a6a68');
      // Feuerleiter links mit zwei Fenstern dahinter
      A.rect(ctx, 138, 78, 44, 60, '#1a1a28'); A.rect(ctx, 142, 82, 36, 52, '#2a2a40'); A.line(ctx, 160, 82, 160, 134, '#1a1a28', 2);
      A.rect(ctx, 138, 158, 44, 60, '#1a1a28'); A.rect(ctx, 142, 162, 36, 52, '#6a5030'); A.line(ctx, 160, 162, 160, 214, '#1a1a28', 2); A.rect(ctx, 142, 162, 36, 22, 'rgba(255,220,150,0.25)');
      A.railing(ctx, 124, 118, 74, 28, '#2a2a30'); A.rect(ctx, 124, 144, 74, 5, '#2a2a30');
      A.railing(ctx, 124, 200, 74, 28, '#2a2a30'); A.rect(ctx, 124, 226, 74, 5, '#2a2a30');
      A.line(ctx, 192, 149, 132, 226, '#2a2a30', 3); for (let i = 0; i < 6; i++) A.rect(ctx, 184 - i * 10, 156 + i * 12, 12, 3, '#3a3a40');
      A.line(ctx, 130, 231, 130, 300, '#2a2a30', 3); A.line(ctx, 194, 231, 194, 300, '#2a2a30', 3); A.line(ctx, 194, 296, 214, 296, '#2a2a30', 3);
      A.pot(ctx, 176, 144, 14, 12, '#9a5a44'); A.bush(ctx, 176, 132, 14, '#3a5a2e', 2); A.bottle(ctx, 140, 226, 12, '#4a6a4a');
      // Neonschild rechts, senkrecht: das O ist kaputt
      A.rect(ctx, 782, 66, 40, 218, '#1a1420'); A.rect(ctx, 770, 76, 12, 4, '#3a3a40'); A.rect(ctx, 770, 270, 12, 4, '#3a3a40');
      ['B', 'I', 'J', 'O', 'U'].forEach((ch, i) => { const on = ch !== 'O'; A.text(ctx, ch, 802, 104 + i * 42, { font: 'bold 28px Georgia', color: on ? '#ff7a8a' : '#5a2a30', align: 'center' }); if (on) A.glow(ctx, 802, 94 + i * 42, 34, 'rgba(255,90,120,0.7)', 0.4); });
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
      // zerrissener Anschlag links neben dem Plakat
      A.rect(ctx, 202, 298, 34, 74, '#c8b890'); A.text(ctx, 'HEUTE', 219, 322, { font: 'bold 8px Georgia', color: '#5a2a30', align: 'center' }); for (let i = 0; i < 5; i++) A.line(ctx, 207, 334 + i * 6, 231, 334 + i * 6, '#8a7a68', 1);
      A.poly(ctx, [202, 350, 224, 372, 202, 372], '#4e403e'); A.poly(ctx, [226, 298, 236, 298, 236, 316], '#4e403e');
      // Kasse mit Markise
      A.rect(ctx, 610, 260, 90, 180, '#3a2a28'); A.rect(ctx, 618, 268, 74, 90, '#1a2030');
      A.rect(ctx, 622, 300, 66, 40, '#e8d8b0'); A.text(ctx, 'AUSVERKAUFT', 655, 325, { font: 'bold 9px Georgia', color: '#7a1a20', align: 'center' });
      A.awning(ctx, 598, 242, 112, 14, '#6a1e2a', '#3a1420', 5);
      // Drahtpapierkorb neben dem Eingang, Zeitungsständer an der Wand
      A.poly(ctx, [580, 406, 606, 406, 603, 444, 583, 444], '#3a3a40'); for (let i = 0; i < 4; i++) A.line(ctx, 581, 412 + i * 9, 605, 412 + i * 9, '#55555f', 1); for (let i = 1; i < 4; i++) A.line(ctx, 580 + i * 6.5, 406, 583 + i * 5, 444, '#55555f', 1);
      A.rect(ctx, 586, 398, 14, 10, '#d8d0c0'); A.rect(ctx, 594, 400, 10, 9, '#c8c0b0');
      A.rect(ctx, 188, 386, 46, 56, '#4a3a30'); A.rect(ctx, 192, 392, 38, 14, '#e8e0d0'); A.rect(ctx, 192, 412, 38, 14, '#d8d0c0'); A.rect(ctx, 192, 430, 38, 10, '#e0d8c8');
      A.line(ctx, 196, 398, 226, 398, '#555', 1); A.line(ctx, 196, 418, 226, 418, '#555', 1); A.sign(ctx, 186, 372, 50, 14, 'ZEITUNGEN', '#8a2a2a', '#f0e0d0', 'bold 7px Georgia');
      // Gasse rechts, ganz hinten zwei Passanten unter einer fernen Laterne
      A.rect(ctx, 840, 60, 120, 380, '#0a0a12');
      A.rect(ctx, 850, 200, 100, 240, '#101018');
      A.glow(ctx, 900, 330, 44, 'rgba(255,220,160,0.5)', 0.22); A.rect(ctx, 898, 296, 4, 40, '#1a1a22');
      A.rr(ctx, 884, 392, 12, 36, 4, '#06060c'); A.circle(ctx, 890, 386, 5, '#06060c'); A.rr(ctx, 904, 396, 10, 32, 4, '#06060c'); A.circle(ctx, 909, 391, 4, '#06060c');
      // Gehweg und Straße
      A.rect(ctx, 0, 440, 960, 30, '#6a6a72');
      A.ground(ctx, 0, 470, 960, 130, '#4a4a52', '#2a2a30');
      A.rect(ctx, 0, 466, 960, 6, '#8a8a90');
      for (let x = 0; x < 960; x += 60) A.rect(ctx, x, 466, 30, 3, '#a0a0a8');
      // Gehwegrisse, Flecken, Gullydeckel, Fahrbahnstreifen, Pfütze im Schein der Reklame
      A.cracks(ctx, 200, 442, 320, 24, 8, 'rgba(0,0,0,0.3)'); A.cracks(ctx, 620, 442, 260, 24, 9, 'rgba(0,0,0,0.3)');
      { const r = ATL.U.rng(33); for (let i = 0; i < 10; i++) A.circle(ctx, r() * 960, 444 + r() * 24, 2 + r() * 2, 'rgba(0,0,0,0.25)'); }
      A.rect(ctx, 300, 462, 26, 8, '#222'); for (let i = 0; i < 4; i++) A.rect(ctx, 303 + i * 6, 464, 3, 4, '#444');
      A.ell(ctx, 420, 545, 26, 9, '#3a3a40', '#222', 1.5); A.ell(ctx, 420, 545, 18, 6, null, '#222', 1); A.line(ctx, 420, 537, 420, 553, '#222', 1);
      for (let x = 10; x < 960; x += 60) A.rect(ctx, x, 556, 28, 3, 'rgba(230,220,180,0.32)');
      A.puddle(ctx, 500, 502, 150, 14, 'rgba(255,220,160,0.1)'); A.ell(ctx, 640, 452, 60, 10, 'rgba(255,225,160,0.12)');
      ctx.save(); ctx.translate(250, 530); ctx.rotate(-0.4); A.rect(ctx, -14, -9, 28, 18, 'rgba(216,208,192,0.7)'); ctx.restore();
      // Laterne
      A.rect(ctx, 636, 200, 8, 250, '#2a2a30'); A.rr(ctx, 622, 180, 36, 28, 6, '#3a3a40'); A.rect(ctx, 628, 186, 24, 18, '#ffe9a0');
      A.glow(ctx, 640, 200, 180, 'rgba(255,230,160,0.7)', 0.4);
      // Sonnenschirm des Würstchenwagens
      A.rect(ctx, 848, 300, 6, 140, '#8a8a90');
      A.poly(ctx, [700, 340, 960, 340, 930, 300, 730, 300], '#b34a3a');
      for (let i = 0; i < 6; i++) A.poly(ctx, [700 + i * 44, 340, 722 + i * 44, 340, 726 + i * 44, 300, 712 + i * 44, 300], '#f0e0d0');
      // Hydrant
      A.ell(ctx, 90, 446, 22, 4, 'rgba(0,0,0,0.35)');
      A.rr(ctx, 80, 400, 20, 44, 5, '#a3312a'); A.rect(ctx, 72, 412, 36, 8, '#a3312a'); A.circle(ctx, 90, 398, 10, '#a3312a');
      // Zeitungsstapel
      A.ell(ctx, 155, 444, 28, 4, 'rgba(0,0,0,0.3)');
      A.rect(ctx, 130, 425, 50, 18, '#e8e0d0'); A.rect(ctx, 134, 420, 46, 6, '#d8d0c0');
      A.vignette(ctx, 960, 600, 0.5);
      A.grain(ctx, 960, 600, 7, 0.04);
    },
    paintFront(ctx) {
      // Taxi vorn links, angeschnitten; Briefkasten vorn rechts
      A.rr(ctx, -40, 548, 270, 70, 14, '#e0b030'); A.rr(ctx, 10, 528, 172, 44, 12, '#e8c040');
      A.rect(ctx, 22, 534, 62, 32, '#222a3a'); A.rect(ctx, 92, 534, 82, 32, '#222a3a'); A.rect(ctx, 26, 538, 54, 10, 'rgba(255,255,255,0.12)'); A.rect(ctx, 96, 538, 74, 10, 'rgba(255,255,255,0.12)');
      A.rect(ctx, 84, 534, 8, 32, '#c8a828'); A.rect(ctx, 10, 568, 172, 4, '#c8a828');
      for (let i = 0; i < 22; i++) A.rect(ctx, -40 + i * 12, 574, 6, 6, i % 2 ? '#1a1a1a' : '#f0f0f0'), A.rect(ctx, -34 + i * 12, 580, 6, 6, i % 2 ? '#1a1a1a' : '#f0f0f0');
      A.rr(ctx, 70, 514, 52, 16, 4, '#1a1a20'); A.text(ctx, 'TAXI', 96, 526, { font: 'bold 10px Georgia', color: '#ffe9a0', align: 'center' });
      A.rect(ctx, 160, 588, 14, 6, '#ffe9a0');
      ctx.fillStyle = A.grad(ctx, -40, 0, 230, 0, ['rgba(0,0,0,0.45)', 'rgba(0,0,0,0.05)']); ctx.fillRect(-40, 514, 270, 90);
      A.rect(ctx, 906, 586, 8, 20, '#2a3a2a'); A.rect(ctx, 934, 586, 8, 20, '#2a3a2a');
      A.rr(ctx, 896, 500, 56, 96, 14, '#3a4e3a'); A.rect(ctx, 906, 520, 36, 9, '#2a3a2a'); A.rect(ctx, 904, 516, 40, 4, '#4a5e4a');
      A.text(ctx, 'U.S. MAIL', 924, 552, { font: 'bold 8px Georgia', color: '#c8c8b0', align: 'center' }); A.rect(ctx, 906, 560, 36, 1.5, '#c8c8b0');
      ctx.fillStyle = A.grad(ctx, 0, 500, 0, 600, ['rgba(0,0,0,0.1)', 'rgba(0,0,0,0.5)']); ctx.fillRect(890, 500, 70, 110);
    },
    animate(ctx, t) {
      // Dampf aus dem Gully, kaputtes O der Neonreklame zuckt hin und wieder auf
      A.smoke(ctx, 420, 540, t, 'rgba(180,180,190,0.22)', 0.6);
      if (Math.sin(t * 7) * Math.sin(t * 1.3) > 0.88) { A.text(ctx, 'O', 802, 230, { font: 'bold 28px Georgia', color: '#ff7a8a', align: 'center' }); A.glow(ctx, 802, 220, 34, 'rgba(255,90,120,0.7)', 0.4); }
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
      // Ausschmückung, nur anschauen
      { id: 'feuerleiter', name: 'Feuerleiter', rect: [124, 76, 74, 226], at: [160, 480, 'u'], look: 'Eine Feuerleiter. In dieser Stadt hängen die Treppen außen, damit drinnen mehr Platz für Miete ist.' },
      { id: 'neon', name: 'Neonschild', rect: [780, 64, 44, 222], at: [800, 480, 'u'], noWalk: true, look: '„BIJOU“, in rotem Neon. Das O ist kaputt. Da steht also „BIJU“, und keiner kümmert sich.' },
      { id: 'muelleimer', name: 'Papierkorb', rect: [578, 396, 30, 50], at: [592, 480, 'u'], look: 'Ein Drahtkorb voller Programmhefte. Atlantis, gelesen und weggeworfen. So schnell geht das.' },
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
      // feuchte Wandkante, Risse, Moos
      A.rect(ctx, 0, 405, 960, 35, 'rgba(0,0,0,0.22)'); A.cracks(ctx, 470, 220, 160, 130, 6, 'rgba(0,0,0,0.3)'); A.moss(ctx, 340, 434, 220, 3, '#2e3e26'); A.moss(ctx, 690, 436, 100, 4, '#2e3e26');
      // vernageltes Fenster und ein beleuchtetes mit Silhouette
      A.rect(ctx, 404, 94, 102, 102, '#1a1a20'); A.rect(ctx, 410, 100, 90, 90, '#0e0e16');
      [[-0.12, 118], [0.08, 150], [-0.05, 178]].forEach(([a, y]) => { ctx.save(); ctx.translate(455, y); ctx.rotate(a); A.rect(ctx, -52, -6, 104, 12, '#5a4a3a'); A.line(ctx, -50, -3, 50, -3, 'rgba(255,255,255,0.08)', 1); ctx.restore(); });
      A.rect(ctx, 596, 66, 58, 58, '#1a1a20'); A.rect(ctx, 600, 70, 50, 50, '#e8c878'); A.rect(ctx, 612, 84, 14, 36, '#3a2a20'); A.circle(ctx, 619, 79, 6, '#3a2a20');
      A.line(ctx, 625, 70, 625, 120, '#1a1a20', 3); A.line(ctx, 600, 95, 650, 95, '#1a1a20', 3); A.glow(ctx, 625, 95, 60, 'rgba(255,220,150,0.6)', 0.28);
      // Rohrleitungen mit Ventil, Regenrinne rechts
      A.rect(ctx, 702, 0, 10, 440, '#3a3a44'); A.rect(ctx, 724, 0, 8, 440, '#2e2e38'); A.rect(ctx, 712, 250, 72, 8, '#3a3a44');
      for (let y = 40; y < 440; y += 95) A.rect(ctx, 698, y, 38, 6, '#4e4e58');
      A.circle(ctx, 707, 300, 9, null, '#7a3a3a', 3); A.line(ctx, 707, 291, 707, 309, '#7a3a3a', 2); A.line(ctx, 698, 300, 716, 300, '#7a3a3a', 2);
      A.rect(ctx, 900, 60, 50, 380, 'rgba(0,0,0,0.15)'); A.rect(ctx, 932, 0, 12, 420, '#2a2a34'); A.rr(ctx, 926, 416, 24, 12, 4, '#2a2a34'); A.rect(ctx, 928, 120, 20, 5, '#3a3a44'); A.rect(ctx, 928, 300, 20, 5, '#3a3a44');
      // zerrissenes Plakat mit aufgeklebtem Flugblatt, Kreidezeichnungen
      A.rect(ctx, 356, 200, 74, 86, '#b8a888'); A.text(ctx, 'ATLANTIS', 393, 226, { font: 'bold 10px Georgia', color: '#5a2a30', align: 'center' }); A.text(ctx, '20 UHR', 393, 244, { font: '8px Georgia', color: '#5a2a30', align: 'center' });
      A.poly(ctx, [356, 262, 402, 286, 356, 286], '#3a302e'); A.poly(ctx, [412, 200, 430, 200, 430, 224], '#3a302e');
      ctx.save(); ctx.translate(394, 258); ctx.rotate(0.1); A.rect(ctx, -22, -18, 44, 36, '#e8e0d0'); A.text(ctx, 'MERIDIAN', 0, -6, { font: 'bold 6px Georgia', color: '#222', align: 'center' }); for (let i = 0; i < 3; i++) A.line(ctx, -16, 2 + i * 5, 16, 2 + i * 5, '#777', 1); ctx.restore();
      const chalk = 'rgba(255,255,255,0.42)';
      ctx.strokeStyle = chalk; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(380, 330); ctx.bezierCurveTo(380, 316, 398, 316, 398, 330); ctx.bezierCurveTo(398, 316, 416, 316, 416, 330); ctx.quadraticCurveTo(416, 344, 398, 356); ctx.quadraticCurveTo(380, 344, 380, 330); ctx.stroke();
      A.text(ctx, 'JOE + MAY', 398, 376, { font: '11px Georgia', color: chalk, align: 'center' });
      for (let i = 0; i < 7; i++) A.line(ctx, 430 + i * 6, 300, 430 + i * 6, 316, chalk, 1.5); A.line(ctx, 428, 312, 470, 304, chalk, 1.5);
      A.circle(ctx, 452, 336, 6, null, chalk, 1.5); A.line(ctx, 452, 342, 452, 362, chalk, 1.5); A.line(ctx, 440, 350, 464, 350, chalk, 1.5); A.line(ctx, 452, 362, 444, 378, chalk, 1.5); A.line(ctx, 452, 362, 460, 378, chalk, 1.5);
      ctx.strokeStyle = chalk; ctx.lineWidth = 1.5; ctx.strokeRect(372, 386, 18, 14); ctx.strokeRect(390, 386, 18, 14); ctx.strokeRect(381, 372, 18, 14);
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
      // Pappkartons, aufgeweicht
      A.rect(ctx, 460, 400, 60, 42, '#8a6a48'); A.line(ctx, 490, 400, 490, 442, 'rgba(0,0,0,0.25)', 2); A.rect(ctx, 462, 404, 56, 4, 'rgba(200,190,170,0.5)');
      A.text(ctx, 'ZERBRECHLICH', 490, 428, { font: 'bold 6px Georgia', color: '#4a3020', align: 'center' });
      A.rect(ctx, 470, 372, 50, 30, '#9a7a58'); A.line(ctx, 470, 380, 520, 380, 'rgba(0,0,0,0.2)', 1); A.rect(ctx, 480, 372, 30, 4, 'rgba(200,190,170,0.5)');
      A.poly(ctx, [520, 424, 548, 414, 550, 442, 520, 442], '#7a5a3a'); A.line(ctx, 522, 430, 546, 424, 'rgba(0,0,0,0.25)', 1.5);
      // Boden
      A.ground(ctx, 0, 440, 960, 160, '#3a3a42', '#1a1a20');
      for (let i = 0; i < 12; i++) A.ell(ctx, 100 + i * 80, 470 + (i % 3) * 30, 40, 6, 'rgba(120,140,170,0.15)');
      // Pfützen, Gully, Schälchen für die Katze, Katzenspuren, Flaschen und Kies bei den Tonnen
      A.puddle(ctx, 300, 522, 100, 18, 'rgba(120,150,190,0.22)'); A.puddle(ctx, 730, 566, 150, 22, 'rgba(120,150,190,0.2)'); A.puddle(ctx, 938, 458, 40, 10, 'rgba(120,150,190,0.28)');
      A.ell(ctx, 835, 480, 34, 5, 'rgba(255,230,160,0.12)');
      A.ell(ctx, 480, 500, 20, 7, '#222', '#111', 1); for (let i = -2; i <= 2; i++) A.line(ctx, 480 + i * 7, 496, 480 + i * 7, 504, '#111', 1);
      A.ell(ctx, 240, 452, 10, 3, '#c8c0b0'); A.ell(ctx, 240, 451, 6, 1.5, '#e8e0d0');
      for (let i = 0; i < 8; i++) { const x = 250 + i * 24, y = 466 + Math.sin(i * 1.3) * 8 + i * 5; A.ell(ctx, x, y, 3, 2.5, 'rgba(180,190,210,0.2)'); A.ell(ctx, x - 3, y - 4, 1.2, 1.2, 'rgba(180,190,210,0.2)'); A.ell(ctx, x + 3, y - 4, 1.2, 1.2, 'rgba(180,190,210,0.2)'); }
      A.pebbles(ctx, 560, 444, 170, 18, 4, '#55555f'); A.bottle(ctx, 704, 444, 26, '#3a5a3a');
      ctx.save(); ctx.translate(690, 452); ctx.rotate(1.3); A.bottle(ctx, 0, 0, 22, '#6a5a3a'); ctx.restore();
      ctx.save(); ctx.translate(420, 505); ctx.rotate(0.3); A.rect(ctx, -14, -9, 28, 18, 'rgba(200,192,176,0.55)'); ctx.restore();
      A.vignette(ctx, 960, 600, 0.6);
      A.grain(ctx, 960, 600, 8, 0.05);
    },
    paintFront(ctx) {
      // Müllsack vorn links, Kistenkante vorn rechts
      A.ell(ctx, 30, 596, 60, 22, '#1e1e26'); A.ell(ctx, 10, 572, 44, 30, '#26262e'); A.ell(ctx, 52, 578, 36, 24, '#22222a'); A.ell(ctx, 4, 560, 10, 6, '#3a3a44');
      A.line(ctx, -6, 560, 30, 566, 'rgba(255,255,255,0.06)', 6);
      A.crate(ctx, 896, 548, 90, 70, '#3e3229', ''); ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fillRect(896, 548, 70, 60);
    },
    animate(ctx, t) {
      // Wäscheleine hoch über der Gasse, Tropfen aus der Regenrinne
      A.line(ctx, 340, 62, 700, 46, '#b8b0a0', 1.2);
      [[400, 0, '#d8d0c0', 24, 34], [470, 1, '#5a6a8a', 20, 40], [548, 2, '#e8e0d0', 46, 38], [630, 3, '#8a6a5a', 14, 22]].forEach(([x, i, c, w, h]) => {
        const y = 62 - ((x - 340) * 16) / 360, s = Math.sin(t * 1.1 + i) * 3;
        A.poly(ctx, [x - w / 2, y, x + w / 2, y, x + w / 2 + s, y + h, x - w / 2 + s, y + h], c);
        if (i === 1) A.poly(ctx, [x - 2 + s * 0.6, y + h * 0.5, x + 2 + s * 0.6, y + h * 0.5, x + 2 + s, y + h, x - 2 + s, y + h], '#2a2a36');
        A.rect(ctx, x - w / 2 - 1, y - 3, 3, 6, '#8a6a4a'); A.rect(ctx, x + w / 2 - 2, y - 3, 3, 6, '#8a6a4a');
      });
      const k = (t * 1.4) % 1; A.circle(ctx, 938, 426 + k * 28, 1.5, `rgba(180,200,230,${0.9 - k * 0.5})`);
      if (k > 0.94) A.ell(ctx, 938, 458, 10 + (k - 0.94) * 120, 3, 'rgba(180,200,230,0.25)');
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
      // Ausschmückung, nur anschauen
      { id: 'waescheleine', name: 'Wäscheleine', rect: [340, 30, 360, 56], at: [520, 490, 'u'], noWalk: true, look: 'Wäsche über der Gasse. Wer sie dort aufhängt, hat mehr Vertrauen in diese Stadt als ich.' },
      { id: 'kartons', name: 'Pappkartons', rect: [458, 370, 92, 72], at: [500, 490, 'u'], look: 'Pappkartons, aufgeweicht. „Zerbrechlich“, steht darauf. Das war einmal.' },
      { id: 'kreide', name: 'Kreidezeichnungen', rect: [356, 294, 116, 108], at: [410, 490, 'u'], look: 'Kreide an der Wand. Ein Herz, zwei Namen, und ein Strichmännchen, das dem Türsteher ähnlich sieht.' },
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
      // Rohre unter der Decke, nackte Glühbirne, Risse, abgetretener Boden
      A.rect(ctx, 0, 32, 960, 6, '#3a3a44'); for (let x = 60; x < 960; x += 180) A.rect(ctx, x, 30, 8, 10, '#4a4a54');
      A.line(ctx, 500, 38, 500, 68, '#222', 1.5); A.circle(ctx, 500, 76, 9, '#ffe9a0'); A.rect(ctx, 496, 64, 8, 6, '#555'); A.glow(ctx, 500, 76, 90, 'rgba(255,230,160,0.6)', 0.35);
      A.cracks(ctx, 520, 44, 200, 70, 7, 'rgba(0,0,0,0.18)'); A.ell(ctx, 420, 470, 120, 24, 'rgba(255,240,220,0.05)');
      // Tür links mit Uhr darüber
      A.door(ctx, 30, 190, 70, 230, '#4a3a4a', { panel: true, frame: '#2a1a2a' });
      A.text(ctx, 'BÜHNE', 65, 182, { font: 'bold 9px Georgia', color: '#e8d8b0', align: 'center' });
      A.circle(ctx, 65, 134, 23, '#2a2a30'); A.circle(ctx, 65, 134, 19, '#e8dcc0'); A.line(ctx, 65, 134, 54, 131, '#222', 2); A.line(ctx, 65, 134, 65, 148, '#222', 1.5); A.circle(ctx, 65, 134, 1.5, '#222');
      // Plakat und Kostümstange an der Wand
      A.rect(ctx, 362, 136, 106, 158, '#2a1a2a'); A.rect(ctx, 366, 140, 98, 150, '#e8d8b0');
      A.text(ctx, 'BIJOU', 415, 158, { font: 'bold 11px Georgia', color: '#3a1a20', align: 'center' }); A.text(ctx, 'DR. LIVIA MARSH', 415, 172, { font: '8px Georgia', color: '#3a1a20', align: 'center' });
      A.sea(ctx, 366, 196, 98, 94, '#3a6a8a', '#1a3a5a', 3); for (let i = 0; i < 3; i++) A.ell(ctx, 415, 240, 30 - i * 9, 8 - i * 2, null, '#c8b070', 2);
      A.text(ctx, 'ATLANTIS', 415, 188, { font: 'bold 12px Georgia', color: '#3a1a20', align: 'center' });
      A.rect(ctx, 484, 144, 4, 274, '#5a5a60'); A.rect(ctx, 626, 144, 4, 274, '#5a5a60'); A.rect(ctx, 480, 140, 154, 5, '#7a7a80'); A.circle(ctx, 486, 418, 4, '#3a3a40'); A.circle(ctx, 628, 418, 4, '#3a3a40');
      [[500, '#c8a040', 26, 120], [530, '#2a3a5a', 30, 140], [566, '#efe4c8', 24, 100], [596, '#3a6a4a', 28, 130]].forEach(([x, c, w, h]) => { A.path(ctx, [x, 145, x, 152, x - 8, 160, x + 8, 160], '#8a8a90', 1.5); A.rr(ctx, x - w / 2, 160, w, h, 6, c); A.line(ctx, x, 164, x, 160 + h - 6, 'rgba(0,0,0,0.15)', 1); });
      // Hutschachteln auf dem Schrank
      A.rr(ctx, 660, 100, 60, 30, 6, '#8a6a7a'); A.rr(ctx, 656, 96, 68, 8, 4, '#7a5a6a'); for (let i = 0; i < 4; i++) A.rect(ctx, 664 + i * 14, 106, 6, 22, 'rgba(255,255,255,0.12)');
      A.rr(ctx, 664, 74, 52, 24, 6, '#6a4a5a'); A.rr(ctx, 660, 70, 60, 8, 4, '#5a3a4a'); A.rr(ctx, 740, 104, 50, 26, 5, '#4a6a5a'); A.rr(ctx, 736, 100, 58, 8, 4, '#3a5a4a');
      // Spiegel mit Glühbirnen, Foto vom Fresko und Telegramm im Rahmen
      A.rect(ctx, 120, 110, 220, 230, '#2a2a30'); A.rect(ctx, 130, 120, 200, 210, '#8a90a8');
      ctx.fillStyle = 'rgba(255,255,255,0.15)'; A.poly(ctx, [132, 122, 200, 122, 132, 260], ctx.fillStyle);
      A.rect(ctx, 134, 124, 58, 44, '#f0e8d0'); A.rect(ctx, 138, 128, 50, 36, '#4a7a9a'); for (let i = 0; i < 3; i++) { A.poly(ctx, [146 + i * 14, 152, 158 + i * 14, 152, 156 + i * 14, 156, 148 + i * 14, 156], '#3a2a1a'); A.line(ctx, 152 + i * 14, 152, 152 + i * 14, 142, '#3a2a1a', 1); } A.line(ctx, 140, 160, 186, 160, 'rgba(255,255,255,0.3)', 1);
      ctx.save(); ctx.translate(313, 136); ctx.rotate(0.08); A.rect(ctx, -20, -13, 40, 26, '#f0e0a0'); A.rect(ctx, -18, -11, 36, 5, '#c8b060'); for (let i = 0; i < 3; i++) A.line(ctx, -16, 0 + i * 5, 16, 0 + i * 5, '#666', 1); ctx.restore();
      for (let i = 0; i < 8; i++) { A.circle(ctx, 130 + i * 28, 114, 5, '#ffe9a0'); A.circle(ctx, 130 + i * 28, 336, 5, '#ffe9a0'); }
      for (let i = 0; i < 6; i++) { A.circle(ctx, 124, 140 + i * 36, 5, '#ffe9a0'); A.circle(ctx, 336, 140 + i * 36, 5, '#ffe9a0'); }
      A.glow(ctx, 230, 225, 220, 'rgba(255,230,160,0.5)', 0.35);
      // Schminktisch mit Rosen, Perücke, Puderstaub; Schuhe darunter; umgeworfener Stuhl
      A.table(ctx, 110, 340, 240, 26, '#6a4a3a', 60);
      A.shadeRect(ctx, 110, 420, 240, 7, 0.25); A.ell(ctx, 160, 416, 12, 4, '#3a2a2a'); A.ell(ctx, 186, 416, 12, 4, '#3a2a2a'); A.rect(ctx, 150, 404, 6, 12, '#3a2a2a'); A.rect(ctx, 176, 404, 6, 12, '#3a2a2a');
      A.rect(ctx, 140, 320, 30, 20, '#e8d8b0'); A.rect(ctx, 180, 326, 40, 14, '#d8c8a0'); A.rr(ctx, 250, 316, 14, 24, 4, '#c8a848');
      A.ell(ctx, 206, 344, 18, 4, 'rgba(240,220,220,0.45)'); A.ell(ctx, 230, 348, 8, 2, 'rgba(240,220,220,0.35)');
      A.rr(ctx, 283, 306, 14, 34, 4, '#8fb8d8'); A.line(ctx, 288, 306, 282, 292, '#3a6a3a', 1.5); A.line(ctx, 290, 306, 292, 288, '#3a6a3a', 1.5); A.line(ctx, 292, 306, 300, 296, '#3a6a3a', 1.5);
      A.circle(ctx, 281, 290, 5, '#a3312a'); A.circle(ctx, 292, 285, 5, '#b03a34'); A.circle(ctx, 301, 294, 5, '#a3312a'); A.ell(ctx, 296, 300, 4, 2, '#3a6a3a');
      A.rect(ctx, 327, 306, 6, 34, '#5a4a3a'); A.ell(ctx, 330, 340, 9, 3, '#5a4a3a'); A.ell(ctx, 330, 294, 11, 14, '#e8d0b0'); A.ell(ctx, 330, 286, 14, 11, '#7a3a1a'); A.circle(ctx, 320, 292, 5, '#7a3a1a'); A.circle(ctx, 340, 292, 5, '#7a3a1a'); A.circle(ctx, 318, 300, 4, '#7a3a1a'); A.circle(ctx, 342, 300, 4, '#7a3a1a');
      ctx.save(); ctx.translate(420, 430); ctx.rotate(1.2); A.chair(ctx, 0, 0, 40, '#5a3a2a'); ctx.restore();
      // Kleiderschrank, aufgerissen
      A.shadeRect(ctx, 640, 420, 240, 6, 0.3);
      A.rect(ctx, 640, 130, 170, 290, '#4a3020');
      A.rect(ctx, 648, 138, 154, 274, '#2a1a10');
      A.rect(ctx, 652, 150, 146, 6, '#6a5a4a');
      A.rr(ctx, 660, 156, 30, 120, 6, '#8a3a4a'); A.rr(ctx, 700, 156, 30, 130, 6, '#3a4a6a'); A.rr(ctx, 740, 156, 26, 110, 6, '#e8d8b0');
      A.poly(ctx, [810, 130, 880, 150, 880, 400, 810, 420], '#5a4030'); // offene Tür
      // Fenster rechts (offen)
      A.rect(ctx, 856, 150, 90, 160, '#2a1a2a'); A.rect(ctx, 862, 156, 78, 148, '#0d1024');
      A.stars(ctx, 78, 60, 8, 3); ctx.save(); ctx.translate(862, 156); A.stars(ctx, 78, 70, 10, 5); ctx.restore();
      A.rect(ctx, 856, 150, 90, 8, '#e8d8b0'); A.rect(ctx, 850, 144, 110, 4, '#8a6a4a');
      // Stiefel vor dem Schrank
      A.rr(ctx, 890, 426, 34, 12, 4, '#4a3020'); A.rr(ctx, 914, 410, 12, 26, 4, '#4a3020'); A.rect(ctx, 916, 414, 8, 3, '#8a6a4a');
      // Koffer umgekippt mit Reiseaufklebern, Papiere
      A.ell(ctx, 535, 424, 72, 6, 'rgba(0,0,0,0.3)');
      A.rr(ctx, 470, 360, 130, 60, 6, '#5a3a2a'); A.rect(ctx, 470, 360, 130, 8, '#8a6a4a'); A.rect(ctx, 520, 350, 30, 12, '#c8a848');
      A.rr(ctx, 480, 378, 28, 14, 2, '#c8a848'); A.text(ctx, 'ATHEN', 494, 388, { font: 'bold 6px Georgia', color: '#3a2a1a', align: 'center' });
      A.circle(ctx, 562, 392, 9, '#a3312a'); A.circle(ctx, 562, 392, 6, null, '#e8d8b0', 1); A.rr(ctx, 518, 396, 32, 12, 2, '#3a6a8a'); A.text(ctx, 'THERA', 534, 405, { font: 'bold 6px Georgia', color: '#e8e0d0', align: 'center' });
      A.rr(ctx, 590, 385, 50, 40, 4, '#e8d8b0');
      for (let i = 0; i < 9; i++) { ctx.save(); ctx.translate(300 + i * 60, 470 + (i % 3) * 30); ctx.rotate((i * 0.7) % 1.2 - 0.6); A.rect(ctx, -16, -10, 32, 20, '#efe4c8'); ctx.restore(); }
      A.path(ctx, [640, 507, 660, 500, 680, 507, 640, 507], '#8a8a90', 1.5); A.path(ctx, [660, 500, 660, 495, 664, 493], '#8a8a90', 1.5); // Kleiderbügel am Boden
      A.rr(ctx, 520, 400, 60, 40, 3, '#3a2a1a'); // Notizbuch
      A.vignette(ctx, 960, 600, 0.5);
    },
    paintFront(ctx) {
      // Hutschachtel auf einem Hocker vorn links, Sessellehne vorn rechts
      A.rect(ctx, -10, 560, 80, 8, '#4a3a3a'); A.rect(ctx, 4, 568, 6, 40, '#3a2a2a'); A.rect(ctx, 54, 568, 6, 40, '#3a2a2a');
      A.rr(ctx, -12, 510, 84, 50, 10, '#8a6a7a'); A.rr(ctx, -16, 502, 92, 14, 6, '#6a4a5a'); for (let i = 0; i < 5; i++) A.rect(ctx, -4 + i * 16, 520, 7, 36, 'rgba(255,255,255,0.1)');
      A.rr(ctx, 892, 520, 110, 100, 20, '#5a2a3a'); A.rr(ctx, 904, 532, 84, 44, 12, '#6a3a4a');
      ctx.fillStyle = A.grad(ctx, 0, 500, 0, 600, ['rgba(0,0,0,0.05)', 'rgba(0,0,0,0.45)']); ctx.fillRect(-16, 500, 100, 110); ctx.fillRect(892, 520, 70, 90);
    },
    animate(ctx, t) {
      // eine Spiegelbirne flackert, der Vorhang am offenen Fenster bewegt sich im Zug
      const on = Math.sin(t * 9) + Math.sin(t * 23) > 0.6;
      A.circle(ctx, 214, 114, 5, on ? '#ffe9a0' : '#8a7a50');
      A.curtain(ctx, 934, 148, 26, 184, '#6a2a3a', t, 2);
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
      // Ausschmückung, nur anschauen
      { id: 'kleiderstange', name: 'Kostümstange', rect: [480, 140, 154, 200], at: [557, 480, 'u'], look: 'Livias Kostüme. Eines für Atlantis, eines für die Presse, eines für Leute mit Scheckbuch.' },
      { id: 'poster', name: 'Plakat', rect: [362, 136, 106, 158], at: [415, 480, 'u'], look: 'Ihr Plakat. Die Ringe hat der Zeichner hübscher gemacht als Platon. Platon hatte auch keinen Verleger.' },
      { id: 'uhr', name: 'Wanduhr', rect: [42, 111, 46, 46], at: [70, 470, 'u'], look: 'Halb zehn. Die Uhr geht vor, wie alle Uhren in Theatern. Damit keiner zu spät kommt.' },
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
      // Beleuchtungsbrücke mit Scheinwerfern
      A.rect(ctx, 180, 46, 600, 5, '#222'); [250, 400, 650].forEach((x) => { A.rr(ctx, x - 14, 50, 28, 22, 5, '#333'); A.rect(ctx, x - 10, 68, 20, 4, '#222'); A.circle(ctx, x, 76, 7, x === 400 ? '#8a8a70' : '#ffe9a0'); });
      // Seilzüge mit Sandsäcken links und rechts, Nagelleiste, Feuereimer
      A.line(ctx, 168, 44, 168, 300, '#b89a68', 2); A.line(ctx, 176, 44, 176, 262, '#b89a68', 2); A.line(ctx, 788, 44, 788, 240, '#b89a68', 2);
      A.sack(ctx, 168, 332, 18, 32, '#8a7a5a'); A.sack(ctx, 176, 292, 16, 30, '#9a8a6a'); A.sack(ctx, 788, 272, 18, 32, '#8a7a5a');
      A.rect(ctx, 160, 394, 26, 6, '#5a4a3a'); for (let i = 0; i < 3; i++) A.rect(ctx, 163 + i * 8, 400, 3, 10, '#8a7a5a');
      A.rr(ctx, 162, 406, 20, 22, 3, '#a3312a'); A.text(ctx, 'FEUER', 172, 421, { font: 'bold 5px Georgia', color: '#fff', align: 'center' }); A.path(ctx, [163, 408, 172, 400, 181, 408], '#555', 1.5);
      // Kulisse: Säule aus Pappe mit Stützstrebe, Requisitenkiste, Stuhl mit Jacke
      A.line(ctx, 742, 288, 772, 236, '#5a4a3a', 4); A.rect(ctx, 700, 288, 60, 8, '#5a4a3a');
      A.column(ctx, 725, 290, 190, 30, '#d8d0c0', 'doric'); A.line(ctx, 712, 120, 712, 280, 'rgba(0,0,0,0.25)', 1);
      A.crate(ctx, 690, 382, 72, 48, '#5a4a3a', 'REQUISITEN'); A.ell(ctx, 712, 380, 12, 8, '#8a8a90'); A.rect(ctx, 708, 366, 8, 12, '#a3312a'); A.poly(ctx, [734, 382, 754, 382, 752, 374, 748, 378, 744, 372, 740, 378, 736, 374], '#c8a848');
      A.chair(ctx, 806, 424, 40, '#5a3a2a'); A.rr(ctx, 808, 378, 36, 30, 6, '#3a3a4a'); A.line(ctx, 826, 382, 826, 404, 'rgba(0,0,0,0.3)', 1);
      // Bühnenboden mit Klebemarkierungen, Kabel, Schleifspuren
      A.planks(ctx, 0, 420, 960, 180, '#4a3a2a', 16, false, 3);
      ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(0, 420, 960, 6);
      A.line(ctx, 186, 430, 700, 430, '#111', 2); A.ell(ctx, 740, 458, 30, 9, null, '#161616', 3); A.ell(ctx, 740, 458, 18, 5, null, '#161616', 3);
      const tape = 'rgba(230,220,170,0.5)';
      A.line(ctx, 440, 462, 460, 478, tape, 3); A.line(ctx, 460, 462, 440, 478, tape, 3); A.line(ctx, 690, 512, 730, 512, tape, 3); A.line(ctx, 710, 512, 710, 532, tape, 3);
      A.line(ctx, 240, 556, 262, 570, tape, 3); A.line(ctx, 262, 556, 240, 570, tape, 3); for (let x = 20; x < 960; x += 40) A.rect(ctx, x, 578, 22, 3, tape);
      A.ell(ctx, 480, 480, 170, 20, 'rgba(255,255,255,0.03)'); A.line(ctx, 560, 540, 640, 560, 'rgba(0,0,0,0.2)', 2); A.line(ctx, 380, 500, 430, 512, 'rgba(0,0,0,0.2)', 2);
      // Rednerpult mit Wasserkaraffe, Notenständer daneben
      A.rect(ctx, 190, 300, 80, 130, '#3a2a1a'); A.rect(ctx, 180, 290, 100, 16, '#5a4a3a'); A.rect(ctx, 200, 280, 60, 12, '#e8e0d0');
      A.rr(ctx, 184, 256, 14, 28, 3, 'rgba(200,220,240,0.7)'); A.rect(ctx, 187, 250, 8, 8, 'rgba(200,220,240,0.7)'); A.rect(ctx, 202, 268, 10, 14, 'rgba(200,220,240,0.7)');
      A.line(ctx, 310, 428, 310, 350, '#3a3a3a', 3); A.line(ctx, 310, 428, 298, 440, '#3a3a3a', 2); A.line(ctx, 310, 428, 322, 440, '#3a3a3a', 2); A.line(ctx, 310, 428, 310, 442, '#3a3a3a', 2);
      A.poly(ctx, [296, 352, 324, 352, 326, 328, 294, 328], '#2a2a2a'); A.rect(ctx, 298, 332, 24, 14, '#e8e0d0'); for (let i = 0; i < 3; i++) A.line(ctx, 301, 336 + i * 4, 319, 336 + i * 4, '#777', 1);
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
    paintFront(ctx) {
      // Rampenlicht an der Bühnenkante
      A.rect(ctx, 0, 596, 960, 4, '#1a1a1a');
      for (let x = 60; x < 960; x += 80) { A.rr(ctx, x - 14, 588, 28, 14, 4, '#2a2a2a'); A.rect(ctx, x - 9, 591, 18, 6, '#ffe9a0'); }
    },
    animate(ctx, t, g) {
      A.dust(ctx, 580, 60, 180, 260, t, 18);
      for (let x = 60; x < 960; x += 80) A.glow(ctx, x, 592, 46 + Math.sin(t * 7 + x) * 2, 'rgba(255,225,150,0.6)', 0.18);
      if (g.flag('medaillon_leuchtet')) A.glow(ctx, 650, 320, 120 + Math.sin(t * 5) * 20, 'rgba(120,255,210,0.8)', 0.6);
    },
    animateFront(ctx, t) {
      // Ränder des Hauptvorhangs ganz vorn, leicht in Bewegung
      A.curtain(ctx, -14, 0, 70, 604, '#6a1a22', t, 3); A.curtain(ctx, 906, 0, 70, 604, '#6a1a22', t, 3);
      A.rect(ctx, -14, 0, 70, 12, '#3a0a10'); A.rect(ctx, 906, 0, 70, 12, '#3a0a10');
      ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(-14, 0, 70, 604); ctx.fillRect(906, 0, 70, 604);
    },
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
      // Ausschmückung, nur anschauen
      { id: 'seilzug', name: 'Seilzüge', rect: [162, 44, 22, 280], at: [200, 480, 'l'], look: 'Seile und Sandsäcke. Damit werden Kulissen hochgezogen. Oder Redner, wenn sie zu lange sprechen.' },
      { id: 'kulisse', name: 'Kulissensäule', rect: [696, 96, 70, 180], at: [730, 480, 'u'], look: 'Eine Säule aus Pappe. Von Weitem dorisch, von Nahem Pappe. Wie so manches hier.' },
      { id: 'requisiten', name: 'Requisitenkiste', rect: [688, 366, 76, 64], at: [726, 490, 'u'], look: 'Eine Requisitenkiste. Ein Helm, eine Krone aus Blech, ein Dreizack. Atlantis für zwei Dollar pro Kopf.' },
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
