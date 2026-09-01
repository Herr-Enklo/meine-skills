/* Prolog: Whitmore College, Vermont, Mai 1938. Vier Räume. */
(function (ATL) {
  const A = ATL.A;
  const R = ATL.rooms.define;

  // ---------------------------------------------------------------- Arbeitszimmer
  R({
    id: 'p_office', name: 'Falks Arbeitszimmer', ambient: 'college',
    start: [480, 520, 'd'],
    walk: [[40, 425, 300, 425, 300, 445, 610, 445, 610, 425, 920, 425, 940, 585, 20, 585]],
    scale: { y0: 400, s0: 0.8, y1: 585, s1: 1.05 },
    paint(ctx, g) {
      A.wall(ctx, 0, 0, 960, 400, '#c9b48a', 1);
      A.rect(ctx, 0, 0, 960, 40, '#8a7a5a');
      A.rect(ctx, 0, 330, 960, 70, '#5a3f28');
      for (let x = 0; x < 960; x += 60) A.rect(ctx, x + 4, 336, 52, 58, '#6a4a30');
      A.floorTiles(ctx, 960, 400, 600, '#8a6a48', '#5a4230', 10, 480);
      A.planks(ctx, 0, 400, 960, 200, '#7a5a3c', 14, false, 2);
      ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(0, 400, 960, 8);
      // Fenster mit Blick auf den Campus
      A.window(ctx, 650, 90, 150, 200, { frame: '#e8e0d0', view: (c) => { A.sky(c, 960, 290, '#9fc8ee', '#d8ecf8', 90); A.hills(c, 960, 250, '#5f8a4a', 4, 30); A.rect(c, 650, 250, 150, 40, '#6f9a52'); A.tree(c, 700, 258, 60, '#3f6a2e', '#4a3624', 3); } });
      A.lightBeam(ctx, 700, 290, 240, 300, 'rgba(255,240,200,0.18)');
      // Bücherregal
      A.shelf(ctx, 40, 110, 200, 290, '#5a3f28', 5, 11);
      // Foto an der Wand
      A.rect(ctx, 300, 120, 90, 70, '#3a2a1a'); A.rect(ctx, 305, 125, 80, 60, '#d8c8a0');
      A.dune(ctx, 385, 165, '#b8a070', 3, 8); A.rect(ctx, 305, 125, 80, 25, '#a8c8e0');
      A.rect(ctx, 330, 150, 8, 30, '#6b4a2b'); A.rect(ctx, 350, 152, 8, 28, '#8a3a4a');
      // Landkarte an der Wand
      A.rect(ctx, 430, 100, 190, 130, '#d9c9a0'); ctx.strokeStyle = '#8a7a58'; ctx.lineWidth = 2; ctx.strokeRect(430, 100, 190, 130);
      A.poly(ctx, [440, 110, 520, 115, 500, 160, 470, 200, 445, 180], '#c8b890'); A.poly(ctx, [540, 130, 610, 120, 605, 200, 560, 210], '#c8b890');
      A.text(ctx, 'MARE ATLANTICVM', 525, 220, { font: 'italic 11px Georgia', color: '#6a5a3a', align: 'center' });
      // Globus
      A.rect(ctx, 250, 340, 8, 70, '#3a2a1a'); A.ell(ctx, 254, 410, 22, 6, '#3a2a1a');
      A.circle(ctx, 254, 310, 32, A.grad(ctx, 230, 280, 280, 340, ['#8fb8d8', '#3a6a9a']));
      A.poly(ctx, [235, 300, 262, 292, 268, 322, 245, 330], '#8a9a5a'); A.poly(ctx, [265, 330, 280, 316, 284, 335], '#8a9a5a');
      A.circle(ctx, 254, 310, 32, null, '#c8a848', 3);
      // Garderobe
      A.rect(ctx, 806, 200, 6, 220, '#3a2a1a'); A.rect(ctx, 790, 200, 38, 6, '#3a2a1a');
      A.rr(ctx, 792, 210, 34, 110, 8, '#4a3a3a');
      // Tür zum Flur
      A.door(ctx, 860, 190, 70, 230, '#6a4a2e', { panel: true, frame: '#3a2a1a' });
      // Teppich
      A.rug(ctx, 300, 470, 380, 100, '#7a2e2e', '#c9a86a');
      // Schreibtisch
      A.table(ctx, 300, 335, 310, 40, '#5a3f28', 80);
      A.rect(ctx, 300, 375, 310, 45, '#4a3220');
      A.rect(ctx, 320, 385, 120, 30, '#3a2a1a'); A.rect(ctx, 460, 385, 130, 30, '#3a2a1a');
      A.circle(ctx, 380, 400, 3, '#c8a848'); A.circle(ctx, 525, 400, 3, '#c8a848');
      // Lampe, Papiere, Thermoskanne
      A.rect(ctx, 560, 300, 6, 38, '#3a3a3a'); A.rr(ctx, 530, 290, 66, 18, 8, '#2e6a4a'); A.glow(ctx, 563, 310, 60, 'rgba(255,230,150,0.6)', 0.5);
      A.rect(ctx, 330, 322, 70, 16, '#efe4c8'); A.rect(ctx, 340, 318, 70, 16, '#f4ecd8'); A.line(ctx, 348, 326, 395, 326, '#666', 1); A.line(ctx, 348, 330, 385, 330, '#666', 1);
      if (!g.flag('kaffee_genommen')) { A.rr(ctx, 440, 300, 22, 38, 4, '#5a5a5a'); A.rect(ctx, 440, 296, 22, 6, '#333'); }
      A.rect(ctx, 470, 326, 40, 12, '#8a4a3a');
      A.vignette(ctx, 960, 600, 0.45);
    },
    animate(ctx, t) { A.dust(ctx, 660, 300, 200, 250, t, 25); },
    hotspots: [
      { id: 'regal', name: 'Bücherregal', rect: [40, 110, 200, 290], at: [140, 450, 'u'],
        look: 'Platon, Herodot, Evans\' Berichte aus Knossos und dreißig Jahre Grabungsberichte. Die Hälfte davon ungelesen.',
        use: async (g) => { await g.say('falk', 'Ich ziehe Platons „Kritias“ heraus und blättere zur Beschreibung von Atlantis.'); await g.say('falk', 'Ringe aus Wasser und Land, ein Tempel des Poseidon, Mauern aus Orichalkum. Und am Ende bricht der Text mitten im Satz ab.'); g.codex('platon'); },
        open: (g) => g.roomDef.hotspots[0].use(g), take: 'Ich weiß, wo die Bücher stehen. Das reicht.' },
      { id: 'foto', name: 'Fotografie', rect: [300, 120, 90, 70], at: [345, 450, 'u'],
        look: 'Thera, 1932. Livia und ich vor dem Grabungszelt. Damals haben wir noch miteinander geredet, nicht nur übereinander.' },
      { id: 'karte', name: 'Landkarte', rect: [430, 100, 190, 130], at: [525, 450, 'u'],
        look: 'Der Atlantik nach einer Karte des 16. Jahrhunderts. Irgendwo dazwischen soll sie gelegen haben, sagt Platon.' },
      { id: 'globus', name: 'Globus', rect: [222, 278, 64, 135], at: [254, 450, 'u'],
        look: 'Ein Globus von 1900. Die Kolonien sind seither ein paar Mal umgemalt worden.',
        use: 'Ich drehe ihn. Er quietscht bei Afrika.', push: 'Ich drehe ihn. Er quietscht bei Afrika.', pull: 'Ich drehe ihn. Er quietscht bei Afrika.' },
      { id: 'fenster', name: 'Fenster', rect: [646, 86, 158, 208], at: [725, 450, 'u'],
        look: 'Der Campus im Mai. Studenten auf dem Rasen, die so tun, als würden sie lernen.', open: 'Es klemmt seit dem Winter.' },
      { id: 'schreibtisch', name: 'Schreibtisch', rect: [300, 290, 310, 45], at: [455, 450, 'u'],
        look: 'Mein Schreibtisch. Papiere, die Lampe, und ein Brief, den ich schon dreimal gelesen habe.' },
      { id: 'brief', name: 'Brief', rect: [328, 316, 84, 24], at: [370, 450, 'u'], z: undefined,
        look: 'Ein Brief von Livia. Zwei Wochen alt.',
        use: async (g) => { await g.puzzle('note', { title: 'Brief von Livia Marsh', text: 'Adrian,\n\nich halte im Mai in New York eine Vortragsreihe, „Atlantis: Mythos oder Erinnerung“. Du wirst sagen, ich verkaufe Märchen an Leute mit zu viel Geld. Vielleicht. Aber seit Thera lässt mich die Sache nicht los, und du weißt, warum.\n\nDie Kiste mit der Figur steht noch bei euch, nehme ich an. Lass sie dort. Und lass niemanden daran.\n\nLivia' }); g.set('brief_gelesen'); if (!g.flag('brief_kommentar')) { g.set('brief_kommentar'); await g.say('falk', '„Lass niemanden daran.“ Sie hat Gründe, die sie mir nicht sagt. Wie immer.'); } },
        take: 'Der bleibt hier. Ich weiß, was drinsteht.', open: (g) => g.roomDef.hotspots[6].use(g) },
      { id: 'thermos', name: 'Thermoskanne', rect: [438, 294, 26, 46], at: [451, 450, 'u'], cond: (g) => !g.flag('kaffee_genommen'),
        look: 'Kaffee von heute Morgen. Hank vom Hausmeisterbüro würde dafür morden.',
        take: (g) => { g.set('kaffee_genommen'); g.take('kaffee'); g.repaint(); return 'Nehme ich mit. Kaffee öffnet Türen.'; },
        use: 'Ich hatte schon drei Tassen.' },
      { id: 'schublade', name: 'Schublade', rect: [320, 385, 120, 30], at: [380, 450, 'u'],
        look: 'Die Schublade meines Schreibtischs.',
        open: async (g) => { if (g.flag('flasche_genommen')) return 'Bleistifte, Büroklammern, ein halbes Sandwich. Sonst nichts mehr.'; await g.say('falk', 'Bleistifte, Büroklammern und meine Feldflasche vom letzten Sommer.'); g.take('flasche'); g.set('flasche_genommen'); await g.say('falk', 'Die Flasche nehme ich. Gewohnheit.'); },
        use: (g) => g.roomDef.hotspots[8].open(g), close: 'Sie ist zu.' },
      { id: 'lampe', name: 'Schreibtischlampe', rect: [528, 288, 70, 50], at: [563, 450, 'u'],
        look: 'Eine Lampe mit grünem Schirm. Sie brennt, seit ich um sechs gekommen bin.', use: 'Ich lasse sie an. Es wird noch ein langer Tag.' },
      { id: 'seil', name: 'Seil', rect: [788, 205, 40, 120], at: [808, 450, 'u'], cond: (g) => !g.flag('seil_genommen'),
        look: 'Ein Kletterseil von der Tour im Herbst. Es hängt an der Garderobe, weil ich es nie weggeräumt habe.',
        take: (g) => { g.set('seil_genommen'); g.take('seil'); g.repaint(); return 'Zehn Meter gutes Seil. Kann nicht schaden.'; } },
      { id: 'garderobe', name: 'Garderobe', rect: [786, 196, 44, 224], at: [808, 450, 'u'], cond: (g) => g.flag('seil_genommen'),
        look: 'Mein Mantel. Das Seil habe ich mitgenommen.' },
    ],
    exits: [
      { id: 'tuer', name: 'Tür zum Flur', rect: [856, 186, 78, 236], at: [893, 450, 'u'], to: 'p_hall', pos: [110, 505], dir: 'r',
        look: 'Die Tür zum Flur des Instituts.', open: (g) => g.travel(g.roomDef.exits[0]) },
    ],
    async enter(g) {
      if (g.flag('intro')) return;
      g.set('intro');
      await g.scene(async () => {
        await g.message('Whitmore College, Vermont. Mai 1938.', 2600);
        await g.say('falk', 'Drei Semester Vorlesungen über Keramikscherben. Und dann kommt ein Brief, und alles fängt wieder an.');
        g.place('greaves', 900, 470, 'l');
        await g.walk('greaves', 700, 480, 'l');
        await g.say('greaves', 'Falk! Gut, dass Sie da sind. Im Hof wartet ein Herr Kessler. Vom Museum in Boston, sagt er.');
        await g.walk('falk', 600, 490, 'r');
        await g.say('falk', 'Und was will Boston von uns?');
        await g.say('greaves', 'Die Figur aus Thera. Die Kiste von Livia Marshs Grabung. Er möchte sie sehen, heute noch.');
        await g.say('falk', 'Die steht seit sechs Jahren auf dem Dachboden. Livia hat mich gerade erst gebeten, niemanden daran zu lassen.');
        await g.say('greaves', 'Livia Marsh hat das College verlassen, um Märchen zu verkaufen. Boston zahlt Ankaufspreise. Holen Sie die Kiste herunter.');
        await g.say('greaves', 'Hank hat den Schlüssel zum Dachboden. Ich gehe zu Kessler in den Hof.');
        await g.walk('greaves', 900, 470, 'r');
        g.hide('greaves');
        g.set('greaves_im_flur');
        g.objective('Die Kiste aus Thera vom Dachboden holen. Hank hat den Schlüssel.');
      });
    },
  });

  // ---------------------------------------------------------------- Flur
  R({
    id: 'p_hall', name: 'Flur des Instituts', ambient: 'college',
    start: [110, 505, 'r'],
    walk: [[60, 430, 780, 430, 780, 405, 960, 405, 960, 585, 20, 585]],
    scale: { y0: 400, s0: 0.78, y1: 585, s1: 1.05 },
    paint(ctx, g) {
      A.wall(ctx, 0, 0, 960, 400, '#b8a888', 2);
      A.rect(ctx, 0, 0, 960, 30, '#6a5a4a');
      A.rect(ctx, 0, 340, 960, 60, '#4a3a2a');
      A.floorTiles(ctx, 960, 400, 600, '#c8bca0', '#8a7e66', 14, 480);
      ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.fillRect(0, 400, 960, 6);
      // Durchgang zum Hof links
      A.rect(ctx, 0, 150, 60, 250, '#3a2a1a'); A.rect(ctx, 0, 160, 50, 240, '#c8dcf0');
      A.lightBeam(ctx, 50, 170, 120, 280, 'rgba(255,240,210,0.2)');
      // Tür zu Falks Zimmer
      A.door(ctx, 60, 190, 70, 210, '#6a4a2e', { panel: true, frame: '#3a2a1a' });
      A.text(ctx, 'DR. A. FALK', 95, 180, { font: 'bold 10px Georgia', color: '#3a2a1a', align: 'center' });
      // Vitrinen
      const vitrine = (x, w, draw) => { A.rect(ctx, x, 200, w, 200, '#3a2a1a'); A.rect(ctx, x + 6, 206, w - 12, 150, '#1a1a22'); ctx.fillStyle = 'rgba(200,220,255,0.12)'; ctx.fillRect(x + 6, 206, w - 12, 150); draw(); A.rect(ctx, x + 6, 356, w - 12, 44, '#4a3a2a'); ctx.fillStyle = 'rgba(255,255,255,0.08)'; A.poly(ctx, [x + 8, 208, x + 40, 208, x + 8, 300], ctx.fillStyle); };
      vitrine(170, 130, () => { A.rect(ctx, 215, 300, 40, 50, '#5a4a3a'); A.ell(ctx, 235, 300, 20, 8, '#5a4a3a'); A.rr(ctx, 205, 245, 60, 60, 20, '#b5865a'); A.spirals(ctx, 210, 265, 50, 16, '#3a2a1a'); A.ell(ctx, 235, 245, 16, 6, '#8a6a4a'); });
      vitrine(450, 130, () => { A.rect(ctx, 470, 230, 90, 110, '#9a8a6a'); A.rect(ctx, 480, 250, 30, 80, '#7a6a4a'); A.circle(ctx, 495, 250, 12, '#7a6a4a'); A.poly(ctx, [495, 236, 512, 232, 500, 244], '#7a6a4a'); A.cuneiform(ctx, 518, 240, 38, 80, '#4a3a2a', 3); });
      vitrine(620, 130, () => { A.rr(ctx, 665, 250, 40, 90, 14, '#3a7a6a'); A.circle(ctx, 685, 250, 14, '#3a7a6a'); A.hieroglyphs(ctx, 668, 270, 34, 60, 'rgba(0,0,0,0.4)', 4); A.ell(ctx, 720, 300, 12, 15, '#3a7a6a'); });
      // Greaves' Tür
      A.door(ctx, 340, 190, 70, 210, '#6a4a2e', { panel: true, frame: '#3a2a1a' });
      A.text(ctx, 'PROF. GREAVES', 375, 180, { font: 'bold 10px Georgia', color: '#3a2a1a', align: 'center' });
      // Treppe nach oben rechts
      A.rect(ctx, 780, 100, 180, 300, '#8a7a68');
      A.stairs(ctx, 790, 400, 150, 9, 18, '#7a6656', 'r');
      A.rect(ctx, 775, 250, 10, 160, '#3a2a1a');
      A.door(ctx, 880, 90, 60, 150, '#5a3e28', { frame: '#3a2a1a' });
      A.text(ctx, 'DACHBODEN', 910, 82, { font: 'bold 9px Georgia', color: '#3a2a1a', align: 'center' });
      // Eimer und Wischmopp
      A.rr(ctx, 758, 500, 30, 34, 4, '#5a6a7a'); A.ell(ctx, 773, 500, 15, 5, '#7a8a9a');
      A.line(ctx, 795, 400, 785, 520, '#8a6a4a', 4); A.rect(ctx, 775, 515, 24, 14, '#c8c0a0');
      A.vignette(ctx, 960, 600, 0.45);
    },
    hotspots: [
      { id: 'vitrine1', name: 'Vitrine mit Vase', rect: [170, 200, 130, 200], at: [235, 450, 'u'],
        look: async (g) => { await g.say('falk', 'Eine minoische Vase aus Knossos, um 1600 vor Christus. Spiralen und Tintenfische. Evans hat sie dem College geschenkt.'); g.codex('minoer'); },
        open: 'Die Vitrine ist abgeschlossen.', take: 'Das gäbe Ärger mit dem Kurator.' },
      { id: 'vitrine2', name: 'Vitrine mit Relief', rect: [450, 200, 130, 200], at: [515, 450, 'u'],
        look: async (g) => { await g.say('falk', 'Ein assyrisches Relief. Ein Mann in einem Fischgewand, der Fischkopf als Kapuze: einer der sieben Weisen, die vor der Flut aus dem Meer kamen.'); if (g.has('figur') || g.flag('figur_genommen')) await g.say('falk', 'Die Figur vom Dachboden sieht genauso aus. Nur älter. Viel älter.'); g.codex('apkallu'); },
        open: 'Die Vitrine ist abgeschlossen.' },
      { id: 'vitrine3', name: 'Vitrine mit Uschebti', rect: [620, 200, 130, 200], at: [685, 450, 'u'],
        look: async (g) => { await g.say('falk', 'Ein Uschebti und ein Herzskarabäus aus Ägypten. Der Skarabäus lag auf der Brust des Toten, damit das Herz beim Totengericht nicht gegen ihn aussagt.'); g.codex('maat'); },
        open: 'Die Vitrine ist abgeschlossen.' },
      { id: 'tuer_greaves', name: 'Tür zu Greaves\' Büro', rect: [336, 186, 78, 214], at: [375, 450, 'u'],
        look: 'Das Büro von Professor Greaves. Er ist der Institutsleiter, seit ich denken kann.',
        open: (g) => g.inRoom('greaves') ? 'Er steht doch direkt daneben.' : 'Abgeschlossen. Greaves ist im Hof.' },
      { id: 'eimer', name: 'Eimer', rect: [755, 495, 36, 40], at: [730, 520, 'r'],
        look: 'Hanks Eimer. Das Wasser ist grau.', take: 'Hank braucht ihn. Und ich will keinen Streit mit dem Hausmeister.', use: 'Ich habe nicht vor, den Boden zu wischen.' },
      { id: 'mopp', name: 'Wischmopp', rect: [775, 400, 28, 130], at: [730, 520, 'r'],
        look: 'Ein Wischmopp. Hanks Zepter.', take: 'Den lasse ich Hank.' },
    ],
    exits: [
      { id: 'tuer_falk', name: 'Tür zu Falks Zimmer', rect: [56, 186, 78, 214], at: [95, 450, 'u'], to: 'p_office', pos: [880, 470], dir: 'l', look: 'Mein Arbeitszimmer.' },
      { id: 'hof', name: 'Durchgang zum Hof', rect: [0, 150, 60, 250], at: [70, 500, 'l'], to: 'p_courtyard', pos: [120, 520], dir: 'r', look: 'Der Durchgang zum Innenhof. Man hört Vögel.' },
      { id: 'treppe', name: 'Treppe zum Dachboden', rect: [780, 90, 180, 310], at: [820, 440, 'u'], to: 'p_attic', pos: [880, 520], dir: 'l',
        look: (g) => g.flag('dachboden_offen') ? 'Die Treppe zum Dachboden. Die Tür oben ist offen.' : 'Die Treppe zum Dachboden. Oben eine Tür mit einem Schloss, so alt wie das College.',
        before: async (g) => { if (g.flag('dachboden_offen')) return true; await g.say('falk', 'Die Tür oben ist abgeschlossen.'); return false; },
        useWith: { schluessel: async (g) => { g.set('dachboden_offen'); await g.say('falk', 'Der Schlüssel dreht sich schwer, aber er dreht sich.'); g.fx('door'); await g.goto('p_attic', 880, 520, 'l'); } },
        open: (g) => g.flag('dachboden_offen') ? g.travel(g.roomDef.exits[2]) : 'Abgeschlossen.' },
    ],
    actors: [
      { id: 'hank', x: 700, y: 500, dir: 'l', talk: (g) => g.dialog('hank'), look: 'Hank, der Hausmeister. Er ist länger hier als die meisten Professoren und weiß es.',
        giveWith: {
          notiz: async (g) => { await g.say('hank', '„Dr. Falk darf auf den Dachboden.“ Na schön. Wenn der Professor das sagt.'); await g.say('hank', 'Hier. Bringen Sie ihn zurück, wenn Sie fertig sind, sonst gibt es Ärger.'); g.drop('notiz'); g.take('schluessel'); g.set('hank_schluessel'); g.objective('Auf den Dachboden gehen und die Kiste aus Thera finden.'); },
          kaffee: async (g) => { await g.say('hank', 'Kaffee? Sie sind ein Ehrenmann, Dr. Falk.'); g.drop('kaffee'); g.set('hank_kaffee'); await g.say('hank', 'Wo wir gerade dabei sind: Vor zwei Wochen war einer hier, der nach dem Dachboden gefragt hat. Schwarzer Mantel, kein Lächeln. Ich habe ihn weggeschickt.'); await g.say('falk', 'Hat er einen Namen genannt?'); await g.say('hank', 'Er hat eine Karte dagelassen. Ich habe sie weggeworfen. Irgendwas mit Meridian.'); },
          muenzen: async (g) => { await g.say('hank', 'Ich nehme kein Geld, Dr. Falk. Nur Kaffee.'); },
        } },
      { id: 'greaves', x: 375, y: 470, dir: 'd', cond: (g) => g.flag('greaves_im_flur') && !g.flag('greaves_im_hof'), talk: (g) => g.dialog('greaves_flur'), look: 'Professor Greaves. Er sieht aus, als hätte er es eilig, und das hat er.',
        giveWith: { kaffee: 'Greaves trinkt nur Tee.' } },
    ],
  });

  ATL.dialogs.define('hank', {
    nodes: {
      root: {
        options: [
          { text: 'Hank, ich brauche den Schlüssel zum Dachboden.', cond: (g) => !g.flag('hank_schluessel'), say: [['hank', 'Hab ich mir gedacht. Der Professor hat mir aber gesagt: Niemand auf den Dachboden ohne seine Erlaubnis. Schriftlich.'], ['falk', 'Greaves hat mich selbst geschickt.'], ['hank', 'Dann kann er es auch aufschreiben. Ich habe hier einen Ruf zu verlieren.']], action: (g) => { g.set('hank_will_notiz'); } },
          { text: 'Was machen Sie da?', once: true, say: [['hank', 'Wischen. Dreihundert Studenten und keiner kann sich die Füße abtreten.']] },
          { text: 'Wissen Sie, was auf dem Dachboden steht?', once: true, say: [['hank', 'Kisten. Kisten mit Steinen, Kisten mit Scherben, Kisten mit Kisten. Und Mäuse.'], ['hank', 'Und das Licht ist an einer Schnur. Nicht am Schalter. Der Schalter ist seit 1929 kaputt.']] },
          { text: 'Ist Ihnen in letzter Zeit jemand Fremdes aufgefallen?', once: true, cond: (g) => !g.flag('hank_kaffee'), say: [['hank', 'Hier fällt mir jeder auf. Aber solche Sachen erzähle ich nicht trocken.']] },
          { text: 'Bis später, Hank.', end: true, say: [['hank', 'Mhm.']] },
        ],
      },
    },
  });
  ATL.dialogs.define('greaves_flur', {
    nodes: {
      root: {
        options: [
          { text: 'Hank will es schriftlich, dass ich auf den Dachboden darf.', cond: (g) => !g.flag('notiz_erhalten'), say: [['greaves', 'Hank. Natürlich.'], ['greaves', 'Hier. Zeigen Sie ihm das, und dann beeilen Sie sich. Kessler wartet nicht gern, das sieht man ihm an.']], action: async (g) => { g.take('notiz'); g.set('notiz_erhalten'); } },
          { text: 'Was wissen Sie über diesen Kessler?', once: true, say: [['greaves', 'Er hat Empfehlungsschreiben. Und er hat einen Scheck dabei. Mehr muss ich nicht wissen.'], ['falk', 'Sie meinen: mehr wollen Sie nicht wissen.'], ['greaves', 'Das Dach des Ostflügels ist undicht, Falk. Wissen kostet Geld.']] },
          { text: 'Livia hat geschrieben, dass niemand an die Figur soll.', once: true, say: [['greaves', 'Dr. Marsh hat dieses Institut verlassen. Ihre Wünsche sind hier nicht mehr maßgeblich.'], ['greaves', 'Und mit Verlaub: Sie haben ihr damals auch nicht widersprochen, als sie ging.']] },
          { text: 'Ich gehe dann mal.', end: true, say: [['greaves', 'Tun Sie das.']], action: async (g) => { if (g.flag('notiz_erhalten') && !g.flag('greaves_im_hof')) { await g.say('greaves', 'Ich bin im Hof.'); await g.walk('greaves', 40, 500, 'l'); g.hide('greaves'); g.set('greaves_im_hof'); } } },
        ],
      },
    },
  });

  // ---------------------------------------------------------------- Dachboden
  const atticLit = (g) => !!g.flag('licht');
  R({
    id: 'p_attic', name: 'Dachboden', ambient: 'college',
    start: [880, 520, 'l'],
    walk: [[40, 430, 560, 430, 560, 410, 940, 410, 940, 585, 40, 585]],
    scale: { y0: 400, s0: 0.8, y1: 585, s1: 1.05 },
    paint(ctx, g) {
      A.rect(ctx, 0, 0, 960, 600, '#2a2018');
      // Dachschrägen
      A.poly(ctx, [0, 400, 0, 200, 480, 20, 960, 200, 960, 400], '#4a3a2a');
      for (let i = 0; i < 9; i++) { const x = 60 + i * 105; A.line(ctx, x, 400, 480, 30, '#3a2a1a', 8); }
      A.line(ctx, 0, 200, 480, 20, '#5a4a3a', 6); A.line(ctx, 480, 20, 960, 200, '#5a4a3a', 6);
      A.planks(ctx, 0, 400, 960, 200, '#5a4632', 12, false, 5);
      ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(0, 400, 960, 6);
      // Fenster
      A.rect(ctx, 856, 136, 68, 90, '#3a2a1a'); A.rect(ctx, 862, 142, 56, 78, '#9fb8d0');
      A.line(ctx, 890, 142, 890, 220, '#3a2a1a', 3); A.line(ctx, 862, 181, 918, 181, '#3a2a1a', 3);
      A.lightBeam(ctx, 862, 220, 160, 250, 'rgba(255,240,210,0.16)');
      // Regalbrett oben mit Kisten
      A.rect(ctx, 100, 175, 340, 12, '#6a5a4a');
      A.rect(ctx, 110, 187, 8, 60, '#5a4a3a'); A.rect(ctx, 425, 187, 8, 60, '#5a4a3a');
      A.crate(ctx, 110, 120, 80, 55, '#8a6a48', 'UR 1928'); A.crate(ctx, 200, 100, 90, 75, '#7a5e40', 'GIZEH');
      if (!g.flag('kiste_gefallen')) A.crate(ctx, 300, 95, 110, 80, '#9a7a52', 'THERA 1932');
      // Zugschnur mit Glühbirne
      A.line(ctx, 480, 60, 480, 150, '#333', 2);
      A.circle(ctx, 480, 160, 12, g.flag('licht') ? '#ffe9a0' : '#5a5a4a');
      A.line(ctx, 486, 165, 500, 260, '#8a8a7a', 1.5);
      A.circle(ctx, 500, 262, 4, '#8a7a5a');
      if (g.flag('licht')) A.glow(ctx, 480, 160, 260, 'rgba(255,220,150,0.7)', 0.5);
      // Truhe
      A.rr(ctx, 60, 330, 140, 75, 6, '#4a3020'); A.rect(ctx, 60, 330, 140, 14, '#5a4030'); A.rect(ctx, 122, 355, 16, 18, '#c8a848');
      // Kistenstapel
      const kx = g.flag('kisten_verschoben') ? 660 : 560;
      if (!g.flag('kisten_verschoben') || !g.flag('leiter_genommen')) {
        if (!g.flag('leiter_genommen')) A.ladder(ctx, 700, 210, 200, '#a08050', 40);
      }
      A.crate(ctx, kx, 330, 110, 80, '#7a5e40', 'KERAMIK');
      A.crate(ctx, kx + 115, 340, 90, 70, '#8a6a48', 'SCHERBEN');
      A.crate(ctx, kx + 30, 260, 100, 70, '#9a7a52', 'BÜCHER');
      // Leiter am Regal, wenn angestellt
      if (g.flag('leiter_platziert')) { ctx.save(); ctx.translate(360, 420); ctx.rotate(-0.12); A.ladder(ctx, 0, -240, 240, '#a08050', 40); ctx.restore(); }
      // Zerbrochene Kiste und Figur
      if (g.flag('kiste_gefallen')) {
        A.poly(ctx, [300, 440, 360, 420, 400, 445, 380, 470, 310, 465], '#7a5e40');
        A.poly(ctx, [380, 430, 430, 425, 440, 455, 395, 460], '#6a4e30');
        A.rect(ctx, 320, 445, 60, 8, '#9a7a52');
        for (let i = 0; i < 8; i++) A.rect(ctx, 300 + i * 18, 470 + (i % 3) * 5, 14, 4, '#c8b890');
      }
      // Mauseloch
      A.poly(ctx, [40, 400, 62, 400, 58, 386, 44, 386], '#0a0806');
      A.vignette(ctx, 960, 600, 0.55);
      A.grain(ctx, 960, 600, 6, 0.05);
    },
    animate(ctx, t, g) { if (g.flag('licht')) A.dust(ctx, 300, 200, 500, 300, t, 40); },
    get hotspots() {
      const lit = [
        { id: 'schnur', name: 'Zugschnur', rect: [470, 140, 40, 130], at: [500, 470, 'u'],
          look: (g) => g.flag('licht') ? 'Die Schnur der Glühbirne. Das Licht brennt.' : 'Eine Schnur, die von der Decke hängt. Daran hängt vermutlich das Licht.',
          pull: async (g) => { if (g.flag('licht')) { g.set('licht', false); g.dark = 0.85; g.repaint(); return 'Dunkel.'; } g.set('licht'); g.dark = 0; g.repaint(); g.fx('click'); await g.say('falk', 'Licht. Vierzig Watt und ein paar tausend Motten.'); },
          use: (g) => g.roomDef.hotspots.find((h) => h.id === 'schnur').pull(g) },
        { id: 'fenster', name: 'Dachfenster', rect: [856, 136, 68, 90], at: [890, 440, 'u'], look: 'Ein kleines Fenster. Man sieht das Dach des Ostflügels. Es ist tatsächlich undicht.', open: 'Es ist zugenagelt.' },
        { id: 'regal', name: 'Regalbrett', rect: [100, 90, 340, 100], at: [360, 460, 'u'],
          look: (g) => g.flag('kiste_gefallen') ? 'Das Brett. Die Kiste aus Thera liegt jetzt unten, in Einzelteilen.' : 'Ein Brett unter dem Dach, viel zu hoch. Darauf drei Kisten: Ur 1928, Gizeh, und Thera 1932. Die brauche ich.',
          take: (g) => g.flag('kiste_gefallen') ? 'Da oben ist nichts mehr, was ich brauche.' : 'Zu hoch. Ich komme nicht heran, nicht einmal auf Zehenspitzen.',
          use: (g) => g.flag('kiste_gefallen') ? 'Da ist nichts mehr.' : 'Zu hoch. Ich bräuchte eine Leiter.',
          useWith: {
            leiter: async (g) => {
              g.drop('leiter'); g.set('leiter_platziert'); g.repaint();
              await g.say('falk', 'Die Leiter steht. Mehr oder weniger.');
              await g.scene(async () => {
                await g.walk('falk', 372, 440, 'u');
                g.hero.fixedScale = g.hero.scale;
                for (let i = 1; i <= 10 && !g.fast; i++) { g.hero.offsetY = -i * 22; await g.wait(120); }
                g.hero.offsetY = -220;
                await g.say('falk', 'Thera 1932. Da ist sie. Nur ein bisschen näher…');
                g.hero.anim = 'reach';
                await g.wait(700);
                g.fx('stone');
                await g.say('falk', 'Hoppla.');
                g.hero.anim = 'stand';
                g.set('kiste_gefallen'); g.repaint();
                g.fx('drop');
                await g.message('Die Kiste kippt, fällt und zerspringt auf den Dielen.', 2200);
                for (let i = 9; i >= 0 && !g.fast; i--) { g.hero.offsetY = -i * 22; await g.wait(90); }
                g.hero.offsetY = 0; g.hero.fixedScale = null;
                await g.say('falk', 'Sechs Jahre Staub, und ich mache in zehn Sekunden Kleinholz daraus. Livia hätte ihre Freude.');
                await g.say('falk', 'Aber da liegt sie. Die Figur. Heil, soweit ich sehe.');
              });
            },
          } },
        { id: 'truhe', name: 'Truhe', rect: [60, 330, 140, 75], at: [130, 440, 'u'],
          look: 'Eine Seemannstruhe. Jemand hat „Zeitungen“ darauf geschrieben.',
          open: async (g) => { await g.say('falk', 'Zeitungen von 1932. „Amerikanische Grabung auf Thera: Dr. Livia Marsh findet Häuser unter der Asche.“'); await g.say('falk', 'Und ein Foto von ihr, wie sie vor einem Fresko steht. Sie sieht glücklich aus. Das war, bevor wir uns gestritten haben.'); g.codex('thera'); },
          use: (g) => g.roomDef.hotspots.find((h) => h.id === 'truhe').open(g), take: 'Zu schwer, und ich sammle keine alten Zeitungen.' },
        { id: 'kisten', name: 'Kistenstapel', rect: [560, 260, 230, 150], at: [520, 470, 'r'], cond: (g) => !g.flag('kisten_verschoben'),
          look: 'Keramik, Scherben, Bücher. Hinter den Kisten lehnt etwas an der Wand.',
          push: async (g) => { g.fx('stone'); await g.say('falk', 'Mit Schwung…'); g.set('kisten_verschoben'); g.repaint(); await g.say('falk', 'Die Kisten rutschen zur Seite. Dahinter: eine Leiter.'); },
          pull: 'Ziehen bringt nichts, ich muss sie wegschieben.', take: 'Zu schwer. Und zu viele.', open: 'Scherben. Ich habe genug Scherben gesehen.' },
        { id: 'kisten2', name: 'Kistenstapel', rect: [660, 260, 230, 150], at: [620, 470, 'r'], cond: (g) => g.flag('kisten_verschoben'),
          look: 'Die Kisten stehen jetzt an der Wand. Der Staub darauf hat sich kaum bewegt.', push: 'Das reicht. Sie stehen gut.', open: 'Scherben. Ich habe genug Scherben gesehen.' },
        { id: 'leiter', name: 'Leiter', rect: [695, 205, 55, 200], at: [660, 470, 'r'], cond: (g) => g.flag('kisten_verschoben') && !g.flag('leiter_genommen'),
          look: 'Eine Holzleiter. Zwei Sprossen wackeln.',
          take: (g) => { g.set('leiter_genommen'); g.take('leiter'); g.repaint(); return 'Die nehme ich.'; },
          use: (g) => g.roomDef.hotspots.find((h) => h.id === 'leiter').take(g) },
        { id: 'leiter2', name: 'Leiter', rect: [330, 180, 80, 240], at: [372, 460, 'u'], cond: (g) => g.flag('leiter_platziert'),
          look: 'Die Leiter lehnt am Regal.', take: (g) => { g.set('leiter_platziert', false); g.take('leiter'); g.repaint(); return 'Ich nehme sie wieder mit.'; },
          use: (g) => g.flag('kiste_gefallen') ? 'Da oben ist nichts mehr, was ich brauche.' : 'Ich sollte sie ans Regal stellen.' },
        { id: 'truemmer', name: 'Zerbrochene Kiste', rect: [300, 420, 140, 60], at: [372, 500, 'u'], cond: (g) => g.flag('kiste_gefallen'),
          look: (g) => g.flag('figur_genommen') ? 'Was von der Kiste übrig ist. Holzwolle und Bretter.' : 'Holzwolle, Bretter, und dazwischen die Figur. Sie sieht unversehrt aus.',
          take: (g) => g.flag('figur_genommen') ? 'Bretter brauche ich keine.' : g.roomDef.hotspots.find((h) => h.id === 'figur').take(g) },
        { id: 'figur', name: 'Wächterfigur', rect: [380, 425, 60, 40], at: [400, 500, 'u'], z: 500, cond: (g) => g.flag('kiste_gefallen') && !g.flag('figur_genommen'),
          paint: (ctx) => { A.rr(ctx, 400, 428, 14, 30, 4, '#6a7a6a'); A.circle(ctx, 407, 426, 7, '#7a8a7a'); A.poly(ctx, [407, 423, 416, 421, 413, 428], '#6a7a6a'); },
          look: 'Eine Steinfigur, kaum zwei Handbreit hoch. Ein Mann mit einem Fischkopf als Kapuze. Ich habe sie 1932 zuletzt gesehen, in Livias Zelt.',
          take: async (g) => { g.set('figur_genommen'); g.take('figur'); g.repaint(); await g.say('falk', 'Schwerer, als sie aussieht. Und beim Aufheben klappert etwas darin.'); await g.say('falk', 'Sie ist hohl. Bevor ich sie irgendwem in die Hand drücke, will ich wissen, was da drin ist.'); g.objective('Herausfinden, was in der Figur klappert, und sie dann zu Greaves und Kessler in den Hof bringen.'); } },
        { id: 'mauseloch', name: 'Mauseloch', rect: [36, 380, 30, 22], at: [80, 470, 'l'], look: 'Ein Mauseloch. Die Bewohner sind ausgegangen.', use: 'Ich passe da nicht durch.' },
      ];
      return lit;
    },
    exits: [
      { id: 'treppe', name: 'Treppe nach unten', rect: [840, 400, 120, 200], at: [900, 540, 'd'], to: 'p_hall', pos: [830, 470], dir: 'l', look: 'Die Treppe zurück in den Flur.' },
    ],
    async enter(g) {
      g.dark = g.flag('licht') ? 0 : 0.85;
      if (!g.flag('dachboden_besucht')) { g.set('dachboden_besucht'); await g.say('falk', 'Stockdunkel. Hank sagte etwas von einer Schnur.'); }
    },
    leave(g) { g.dark = 0; },
  });
  // Im Dunkeln antworten die meisten Objekte nicht
  const attic = ATL.rooms.get('p_attic');
  const origGetter = Object.getOwnPropertyDescriptor(attic, 'hotspots').get;
  Object.defineProperty(attic, 'hotspots', { get() {
    const g = ATL.game;
    const list = origGetter.call(this);
    if (!g || g.flag('licht')) return list;
    return list.map((h) => (h.id === 'schnur' || h.id === 'fenster') ? h : Object.assign({}, h, { name: 'Dunkelheit', look: 'Zu dunkel, um etwas zu erkennen.', use: 'Ich sehe die Hand vor Augen nicht.', take: 'Zu dunkel.', push: 'Zu dunkel.', pull: 'Zu dunkel.', open: 'Zu dunkel.', useWith: { default: 'Zu dunkel.' } }));
  } });

  // ---------------------------------------------------------------- Innenhof
  R({
    id: 'p_courtyard', name: 'Innenhof des Colleges', ambient: 'college',
    start: [120, 520, 'r'],
    walk: [[60, 440, 900, 440, 940, 585, 20, 585]],
    scale: { y0: 420, s0: 0.75, y1: 585, s1: 1.05 },
    paint(ctx, g) {
      A.sky(ctx, 960, 400, '#7fb3e6', '#cfe4f5');
      A.clouds(ctx, 960, 70, 5, 2);
      A.sun(ctx, 820, 70, 30);
      // Gebäude im Hintergrund
      A.bricks(ctx, 0, 120, 960, 300, '#9a5a44', 34, 14, 3, '#6a4034');
      A.rect(ctx, 0, 110, 960, 14, '#d8d0c0');
      for (let i = 0; i < 6; i++) { const x = 60 + i * 160; A.window(ctx, x, 160, 60, 110, { frame: '#e8e0d0', light: '#3a4a5a' }); A.rect(ctx, x - 6, 272, 72, 8, '#d8d0c0'); }
      A.rect(ctx, 400, 240, 160, 180, '#4a3a2a'); A.arch(ctx, 410, 250, 140, 170, '#d8d0c0', '#2a2018');
      A.text(ctx, 'WHITMORE COLLEGE', 480, 140, { font: 'bold 18px Georgia', color: '#e8e0d0', align: 'center' });
      A.text(ctx, 'MCMII', 480, 160, { font: '12px Georgia', color: '#e8e0d0', align: 'center' });
      // Rasen und Weg
      A.ground(ctx, 0, 420, 960, 180, '#6f9a52', '#4f7a3a');
      A.poly(ctx, [380, 420, 580, 420, 760, 600, 200, 600], '#b8a888');
      A.poly(ctx, [0, 480, 960, 480, 960, 520, 0, 520], 'rgba(184,168,136,0.9)');
      // Bäume, Bank, Statue
      A.tree(ctx, 120, 470, 200, '#3f6a2e', '#4a3624', 8);
      A.tree(ctx, 860, 470, 220, '#4a7a35', '#4a3624', 9);
      A.bush(ctx, 250, 430, 60, '#3f6a2e', 3); A.bush(ctx, 700, 430, 70, '#3f6a2e', 4);
      A.rect(ctx, 220, 445, 100, 8, '#5a3f28'); A.rect(ctx, 220, 455, 100, 6, '#5a3f28'); A.rect(ctx, 228, 461, 6, 22, '#3a2a1a'); A.rect(ctx, 306, 461, 6, 22, '#3a2a1a');
      A.statue(ctx, 640, 470, 110, '#a8a8a0', 'standing');
      // Tor rechts
      A.rect(ctx, 900, 300, 12, 190, '#3a3a3a'); A.rect(ctx, 946, 300, 12, 190, '#3a3a3a');
      for (let i = 0; i < 4; i++) A.rect(ctx, 914 + i * 8, 310, 3, 170, '#3a3a3a');
      A.rect(ctx, 900, 296, 58, 8, '#3a3a3a');
      A.vignette(ctx, 960, 600, 0.3);
    },
    hotspots: [
      { id: 'bank', name: 'Bank', rect: [218, 440, 104, 45], at: [270, 500, 'u'], look: 'Eine Bank. Hier habe ich 1931 Livia zum ersten Mal gesagt, dass ihre Atlantis-Theorie Unsinn ist. Sie hat gelacht. Damals.', use: 'Keine Zeit zum Sitzen.' },
      { id: 'statue', name: 'Statue', rect: [610, 360, 60, 115], at: [640, 500, 'u'], look: 'Ezra Whitmore, Gründer des Colleges. Er sieht aus, als hätte er Hank eingestellt.', use: 'Ich lasse ihn stehen.' },
      { id: 'baum', name: 'Ahorn', rect: [60, 280, 130, 200], at: [140, 500, 'u'], look: 'Ein alter Ahorn. Im Herbst rot, im Mai voller Vögel.' },
      { id: 'gebaeude', name: 'Institutsgebäude', rect: [0, 110, 960, 130], at: [480, 470, 'u'], look: 'Das Institut für Archäologie. Backstein, 1902, undichtes Dach.' },
    ],
    exits: [
      { id: 'durchgang', name: 'Durchgang zum Institut', rect: [400, 240, 160, 180], at: [480, 460, 'u'], to: 'p_hall', pos: [80, 500], dir: 'r', look: 'Der Durchgang zurück ins Institut.' },
      { id: 'tor', name: 'Tor zur Straße', rect: [896, 296, 64, 200], at: [880, 500, 'r'], look: (g) => g.flag('kessler_geflohen') ? 'Das Tor zur Straße. Von hier fährt der Bus nach Boston, von Boston der Zug nach New York.' : 'Das Tor zur Straße.',
        before: async (g) => {
          if (!g.flag('kessler_geflohen')) { await g.say('falk', 'Ich habe hier noch zu tun.'); return false; }
          g.set('prolog_fertig');
          g.objective('Nach New York fahren und Livia Marsh finden.', { silent: true });
          await ATL.story.openMap(g, 'whitmore');
          return false;
        } },
    ],
    actors: [
      { id: 'kessler', x: 620, y: 500, dir: 'l', cond: (g) => !g.flag('kessler_geflohen'), talk: (g) => g.dialog('kessler_hof'), look: 'Herr Kessler aus Boston. Breite Schultern, teurer Mantel, und ein Gesicht, das noch nie ein Museum von innen gesehen hat.',
        giveWith: { figur: async (g) => { await g.say('falk', 'Nicht, bevor ich weiß, was da drin klappert.'); } } },
      { id: 'greaves', x: 540, y: 505, dir: 'r', cond: (g) => g.flag('greaves_im_hof'), talk: (g) => g.dialog(g.flag('kessler_geflohen') ? 'greaves_danach' : 'greaves_hof'), look: 'Professor Greaves. Er wirkt nervös. Bei ihm heißt das: Er zupft an der Krawatte.' },
    ],
    async enter(g) {
      if (g.flag('kessler_geflohen') || !g.has('figur')) return;
      if (!g.has('perle') && !g.flag('perle_entnommen')) {
        await g.say('falk', 'Moment. Bevor ich sie hergebe, will ich wissen, was da drin klappert.');
        return;
      }
      if (!g.flag('greaves_im_hof')) { g.set('greaves_im_hof'); g.place('greaves', 540, 505, 'r'); }
      await g.scene(async () => {
        await g.walk('falk', 470, 515, 'r');
        await g.say('kessler', 'Dr. Falk. Sie haben sie also gefunden.');
        await g.say('falk', 'Sie ist hohl, wussten Sie das? Da klapperte etwas darin.');
        await g.say('kessler', 'Klapperte?');
        await g.say('falk', 'Ein Stein. Ich habe ihn weggeworfen.');
        await g.say('kessler', 'Geben Sie her.');
        await g.walk('kessler', 520, 512, 'l');
        g.fx('punch');
        await g.message('Kessler reißt Falk die Figur aus der Hand und stößt ihn zurück.', 2200);
        g.drop('figur'); g.set('figur_verloren');
        await g.say('greaves', 'Herr Kessler! Was soll das?');
        await g.say('kessler', 'Der Scheck ist auf dem Tisch in Ihrem Büro, Professor. Er ist nicht gedeckt.');
        g.actor('kessler').speed = 260;
        await g.walk('kessler', 930, 540, 'r');
        g.hide('kessler');
        g.set('kessler_geflohen');
        g.fx('drop');
        await g.message('Beim Laufen fällt ihm eine Karte aus dem Mantel.', 2000);
        await g.walk('falk', 560, 530, 'r');
        g.hero.anim = 'crouch'; await g.wait(600); g.hero.anim = 'stand';
        g.take('visitenkarte');
        await g.say('falk', '„Meridian-Gesellschaft, Berlin. Konrad Vesper.“');
        await g.say('greaves', 'Vesper. Um Himmels willen.');
        await g.say('falk', 'Sie kennen ihn?');
        await g.say('greaves', 'Berlin, 1931, der Kongress. Er hielt einen Vortrag über „die verlorene Wissenschaft der Vorzeit“. Kraftquellen der Atlanter, Metall, das denkt. Man hat ihn ausgelacht.');
        await g.say('greaves', 'Offenbar hat er seither Geld gefunden. Und Leute wie diesen Kessler.');
        await g.say('falk', 'Die Figur kam aus Livias Grabung. Wenn jemand weiß, was Vesper damit will, dann sie.');
        await g.say('greaves', 'Livia Marsh hält in New York Vorträge. Über Atlantis, für Leute mit Geld.');
        await g.say('falk', 'Dann fahre ich nach New York.');
        await g.say('greaves', 'Falk. Das College zahlt keine Spesen.');
        await g.say('falk', 'Das College hat gerade eine Figur an einen Schläger verschenkt, Professor. Ich schicke die Rechnung.');
        g.objective('Nach New York fahren und Livia Marsh finden.');
      });
    },
  });

  ATL.dialogs.define('kessler_hof', {
    nodes: {
      root: {
        options: [
          { text: 'Herr Kessler? Vom Museum in Boston?', once: true, say: [['kessler', 'Richtig.'], ['falk', 'Welche Abteilung?'], ['kessler', 'Ankäufe.'], ['falk', 'Ich kenne den Leiter der Ankäufe. Er heißt Whitcombe.'], ['kessler', 'Er hat viele Mitarbeiter.']] },
          { text: 'Was wollen Sie mit der Figur?', once: true, say: [['kessler', 'Ausstellen. Wofür sind Museen sonst da.'], ['falk', 'Sie ist nicht katalogisiert, nicht publiziert und nicht schön.'], ['kessler', 'Wir zahlen trotzdem.']] },
          { text: 'Ich hole die Figur.', end: true, say: [['kessler', 'Beeilen Sie sich.']] },
        ],
      },
    },
  });
  ATL.dialogs.define('greaves_hof', {
    nodes: {
      root: {
        options: [
          { text: 'Dieser Kessler ist kein Museumsmann.', once: true, say: [['greaves', 'Er hat Empfehlungsschreiben.'], ['falk', 'Er hat Fäuste wie Schinken.'], ['greaves', 'Das schließt sich nicht aus. Holen Sie die Figur.']] },
          { text: 'Ich bin gleich zurück.', end: true },
        ],
      },
    },
  });
  ATL.dialogs.define('greaves_danach', {
    nodes: {
      root: {
        options: [
          { text: 'Was wissen Sie noch über Vesper?', once: true, say: [['greaves', 'Er glaubt, die Atlanter hätten eine Kraftquelle besessen. Orichalkum, nach Platon. Und dass man sie wiederfinden kann.'], ['greaves', 'Ein Spinner mit Geld ist gefährlicher als ein Spinner ohne.']] },
          { text: 'Warum wollte Livia die Figur unter Verschluss halten?', once: true, say: [['greaves', 'Fragen Sie sie selbst. Sie hat es mir nie gesagt. Sie hat mir überhaupt wenig gesagt, nachdem Sie beide sich zerstritten hatten.']] },
          { text: 'Ich fahre nach New York.', end: true, say: [['greaves', 'Grüßen Sie Dr. Marsh. Und bringen Sie die Figur zurück, wenn es geht.']] },
        ],
      },
    },
  });
})(window.ATL);
