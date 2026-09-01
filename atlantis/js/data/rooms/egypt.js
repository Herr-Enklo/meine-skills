/* Kapitel 3: Ägypten. Alexandria, Juni 1938. Sechs Räume: Hafen, Basar, Bibliothek,
   Sais, Tempel der Neith, Kammer der Aufzeichnungen. */
(function (ATL) {
  const A = ATL.A;
  const R = ATL.rooms.define;
  const TAU = Math.PI * 2;

  // ---------------------------------------------------------------- Kodex-Ergänzungen
  Object.assign(ATL.codex, {
    apis: { title: 'Apis', origin: 'Ägyptische Religion', text: 'Apis war der heilige Stier von Memphis. Er galt als lebendes Abbild des Gottes Ptah und wurde an bestimmten Zeichen erkannt, unter anderem an einer weißen Blesse auf schwarzem Fell. Zu Lebzeiten wurde er im Tempel versorgt, nach dem Tod einbalsamiert und im Serapeum von Sakkara beigesetzt, einem unterirdischen Gang mit riesigen Steinsarkophagen, den Auguste Mariette 1851 fand.\nIn der Ptolemäerzeit verschmolz der tote Apis mit Osiris zum Gott Serapis, der in Alexandria einen großen Tempel hatte.' },
    nun: { title: 'Nun, das Urwasser', origin: 'Ägyptische Religion', text: 'Nun ist in der ägyptischen Vorstellung das Wasser, das vor der Schöpfung alles erfüllte und das die Welt noch immer umgibt. Aus ihm erhob sich der erste Hügel, auf dem der Schöpfergott erschien; in Heliopolis war das Atum, an anderen Orten andere Götter.\nDie jährliche Nilflut und das Grundwasser galten als Teil des Nun. Heilige Seen in den Tempeln stellten es dar.' },
  });

  // ---------------------------------------------------------------- Symbole der Tempeltür
  const SYMS = [
    { name: 'Sonne', draw: (c, x, y, r) => { const f = c.fillStyle; A.circle(c, x, y - r * 0.1, r * 0.42, f); for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU; A.line(c, x + Math.cos(a) * r * 0.58, y - r * 0.1 + Math.sin(a) * r * 0.58, x + Math.cos(a) * r * 0.88, y - r * 0.1 + Math.sin(a) * r * 0.88, f, 2.5); } A.line(c, x - r * 0.85, y + r * 0.85, x + r * 0.85, y + r * 0.85, f, 3); c.fillStyle = f; } },
    { name: 'Welle', draw: (c, x, y, r) => { const f = c.fillStyle; for (let k = -1; k <= 1; k++) { const p = []; for (let i = 0; i <= 8; i++) p.push(x - r * 0.85 + (i / 8) * r * 1.7, y + k * r * 0.45 + (i % 2 ? -r * 0.14 : r * 0.14)); A.path(c, p, f, 2.5); } c.fillStyle = f; } },
    { name: 'Stier', draw: (c, x, y, r) => { const f = c.fillStyle; A.ell(c, x, y + r * 0.2, r * 0.42, r * 0.5, f); A.ell(c, x, y + r * 0.55, r * 0.3, r * 0.2, A.shade('#000000', 0.16)); c.strokeStyle = f; c.lineWidth = 3.5; c.beginPath(); c.moveTo(x - r * 0.3, y - r * 0.15); c.quadraticCurveTo(x - r * 0.95, y - r * 0.4, x - r * 0.55, y - r * 0.9); c.moveTo(x + r * 0.3, y - r * 0.15); c.quadraticCurveTo(x + r * 0.95, y - r * 0.4, x + r * 0.55, y - r * 0.9); c.stroke(); A.circle(c, x - r * 0.16, y + r * 0.1, r * 0.06, '#2a2016'); A.circle(c, x + r * 0.16, y + r * 0.1, r * 0.06, '#2a2016'); c.fillStyle = f; } },
    { name: 'Ibis', draw: (c, x, y, r) => { const f = c.fillStyle; A.ell(c, x - r * 0.1, y + r * 0.25, r * 0.5, r * 0.3, f); c.strokeStyle = f; c.lineWidth = 3; c.beginPath(); c.moveTo(x + r * 0.25, y + r * 0.1); c.quadraticCurveTo(x + r * 0.55, y - r * 0.3, x + r * 0.4, y - r * 0.6); c.stroke(); A.circle(c, x + r * 0.4, y - r * 0.62, r * 0.14, f); c.lineWidth = 2.5; c.beginPath(); c.moveTo(x + r * 0.5, y - r * 0.6); c.quadraticCurveTo(x + r * 0.95, y - r * 0.5, x + r * 0.85, y - r * 0.1); c.stroke(); A.line(c, x - r * 0.2, y + r * 0.5, x - r * 0.25, y + r * 0.9, f, 2); A.line(c, x, y + r * 0.5, x + r * 0.05, y + r * 0.9, f, 2); c.fillStyle = f; } },
    { name: 'Auge', draw: (c, x, y, r) => { const f = c.fillStyle; c.strokeStyle = f; c.lineWidth = 2.8; c.beginPath(); c.moveTo(x - r * 0.9, y - r * 0.05); c.quadraticCurveTo(x, y - r * 0.85, x + r * 0.9, y - r * 0.05); c.quadraticCurveTo(x, y + r * 0.65, x - r * 0.9, y - r * 0.05); c.stroke(); A.circle(c, x, y - r * 0.1, r * 0.26, f); c.beginPath(); c.moveTo(x - r * 0.9, y - r * 0.05); c.lineTo(x - r * 1, y - r * 0.4); c.moveTo(x + r * 0.35, y + r * 0.35); c.quadraticCurveTo(x + r * 0.4, y + r * 0.85, x + r * 0.1, y + r * 0.9); c.moveTo(x - r * 0.3, y + r * 0.4); c.lineTo(x - r * 0.45, y + r * 0.9); c.stroke(); c.fillStyle = f; } },
    { name: 'Schlange', draw: (c, x, y, r) => { const f = c.fillStyle; c.strokeStyle = f; c.lineWidth = 3.5; c.beginPath(); c.moveTo(x - r * 0.85, y + r * 0.8); c.bezierCurveTo(x - r * 0.3, y + r * 0.9, x - r * 0.1, y + r * 0.1, x + r * 0.35, y + r * 0.2); c.bezierCurveTo(x + r * 0.7, y + r * 0.3, x + r * 0.6, y - r * 0.2, x + r * 0.3, y - r * 0.35); c.stroke(); A.ell(c, x + r * 0.25, y - r * 0.5, r * 0.3, r * 0.38, f); A.circle(c, x + r * 0.2, y - r * 0.9, r * 0.14, f); A.circle(c, x + r * 0.26, y - r * 0.92, r * 0.04, '#2a2016'); c.fillStyle = f; } },
  ];
  const SOLUTION = [0, 1, 2, 3];
  const DOOR_START = [4, 5, 3, 0];
  const INSCHRIFT = 'Wer eintreten will, ordne die Zeichen, wie die Welt geordnet ist. Zuerst Re, die Sonne. Dann Nun, das Wasser. Dann Apis, der Stier. Zuletzt Thot, der Ibis.';

  // ---------------------------------------------------------------- Gemeinsame Abläufe
  async function sailToSais(g) {
    await g.scene(async () => {
      const first = !g.flag('livia_in_sais');
      await g.walk('falk', 1090, 462, 'u');
      if (first) await g.message('Livia wartet schon im Boot. Sie hat den Staub des Instituts noch an den Händen.', 2600);
      g.set('livia_in_sais');
      if (g.flag('eg_nacht')) await g.message('Hassan fährt bei Nacht. Er kennt den Kanal, sagt er, und der Kanal kennt ihn.', 2600);
      else await g.message('Hassans Boot geht den Mahmudiya-Kanal hinauf und durch die Arme des Deltas. Gegen Abend liegt Sais vor ihnen: Sand, Mauerreste, eine Palme.', 3600);
      await g.goto('eg_sais', 250, 520, 'r');
    });
  }
  async function sailBack(g) {
    await g.scene(async () => {
      await g.walk('falk', 250, 520, 'l');
      if (g.flag('eg_nacht')) await g.message('Zurück nach Alexandria, im Dunkeln. Niemand redet. Livia sitzt im Bug und hält die Scheibe fest, als könnte sie wegfliegen.', 3200);
      else await g.message('Zurück nach Alexandria. Hassan fragt nicht, was Falk gefunden hat, und Falk sagt es nicht.', 2800);
      await g.goto('eg_harbor', 1060, 500, 'l');
    });
  }
  async function lightLamp(g) {
    g.set('lampe_brennt');
    g.dark = g.roomDef.id === 'eg_crypt' ? 0.1 : 0.22;
    g.fx('glow');
    g.repaint();
    await g.say('falk', 'Der Docht fängt. Ein kleiner Kreis aus Licht.');
    if (g.roomDef.id === 'eg_temple' && !g.flag('tempel_gesehen')) {
      g.set('tempel_gesehen');
      await g.say('falk', 'Eine Halle. Säulen, eine Statue mit dem Kopf eines Vogels, eine Wand voller Schrift. Und rechts eine Tür.');
    }
  }
  // Die Öllampe aus items.js bekommt hier ihre Verwendung.
  const lampDef = ATL.items.get('oellampe');
  if (lampDef) lampDef.use = async (g) => {
    const r = g.roomDef.id;
    if (g.flag('lampe_brennt')) return 'Sie brennt.';
    if (r === 'eg_temple' || r === 'eg_crypt') { await lightLamp(g); return; }
    return 'Es ist hell genug. Das Öl spare ich mir.';
  };

  async function readStele(g) {
    await g.puzzle('note', { title: 'Die Stele von Sais', text: ATL.story.riddle(g) });
    if (g.flag('stele_gelesen')) return;
    g.set('stele_gelesen');
    await g.say('falk', 'Griechisch. Alt, ionisch, die Buchstaben aus Solons Jahrhundert. Jemand hat hier aufgeschrieben, was Solon gehört hat. Oder was er hören sollte.');
    await g.say('falk', 'Drei Siegel, ein Tor unter dem brennenden Berg, Ringe, die man dreht. Ich schreibe es ab. Wort für Wort.');
    g.take('solontext');
    g.codex('platon'); g.codex('solon');
    if (!g.has('sonnensiegel')) g.objective('Das Siegel der Sonne. Es muss hier in der Kammer sein.');
  }

  // ---------------------------------------------------------------- Hafen von Alexandria
  R({
    id: 'eg_harbor', name: 'Hafen von Alexandria', ambient: 'egypt', width: 1400,
    start: [200, 520, 'r'],
    walk: [[40, 446, 1360, 446, 1380, 585, 20, 585]],
    scale: { y0: 430, s0: 0.78, y1: 585, s1: 1.05 },
    paint(ctx, g) {
      const W = 1400, night = !!g.flag('eg_nacht');
      if (night) { A.sky(ctx, W, 272, '#070b22', '#2a2a4a'); A.stars(ctx, W, 230, 220, 21); A.moon(ctx, 1180, 80, 26); }
      else { A.sky(ctx, W, 272, '#5f9fd8', '#f0dfb8'); A.sun(ctx, 1210, 84, 34, '#fff3c8'); A.clouds(ctx, W, 96, 6, 4, 'rgba(255,255,255,0.45)'); }
      // Nordufer mit Stadt in der Ferne
      const far = night ? '#181a30' : '#b8a890';
      A.rect(ctx, 380, 240, 700, 32, far);
      for (let i = 0; i < 14; i++) {
        const x = 400 + i * 48;
        A.rect(ctx, x, 214 + (i % 3) * 8, 34, 60, night ? '#1e1e34' : A.shade(far, (i % 2) * -0.08));
        if (i % 4 === 1) { A.rect(ctx, x + 14, 176, 5, 60, far); A.circle(ctx, x + 16, 176, 4, far); }
        if (i % 5 === 2) A.ell(ctx, x + 17, 216, 18, 10, far);
        if (night && i % 2) A.rect(ctx, x + 12, 232, 4, 5, '#ffd890');
      }
      // Qait-Bey auf der Mole
      const fort = night ? '#161628' : '#cbb68c';
      A.rect(ctx, 1030, 262, 320, 12, A.shade(fort, -0.25));
      A.rect(ctx, 1080, 226, 200, 40, fort); A.rect(ctx, 1150, 196, 60, 72, A.shade(fort, 0.06)); A.rect(ctx, 1165, 180, 30, 20, A.shade(fort, 0.06));
      for (let x = 1082; x < 1280; x += 16) A.rect(ctx, x, 219, 8, 8, fort);
      for (let x = 1152; x < 1210; x += 14) A.rect(ctx, x, 189, 7, 8, A.shade(fort, 0.06));
      A.rect(ctx, 1176, 236, 8, 30, A.shade(fort, -0.4));
      // Meer
      A.sea(ctx, 0, 270, W, 166, night ? '#0e1a34' : '#4f93bc', night ? '#060a18' : '#22607f', 4);
      A.ship(ctx, 190, 306, 170, night ? '#1a1a26' : '#3a3a44');
      A.boat(ctx, 520, 322, 70, '#8a6a4a', true); A.boat(ctx, 760, 352, 110, '#6a4a2e', true);
      // Kai
      A.rect(ctx, 0, 426, W, 14, night ? '#3a3428' : '#8a7a5a'); A.shadeRect(ctx, 0, 436, W, 4, 0.3);
      A.floorTiles(ctx, W, 440, 600, night ? '#4a4235' : '#cdb891', night ? '#1e1a14' : '#8a7a5a', 18, 700);
      ctx.fillStyle = A.grad(ctx, 0, 440, 0, 600, ['rgba(0,0,0,0.04)', 'rgba(0,0,0,0.22)']); ctx.fillRect(0, 440, W, 160);
      // Hafenamt links
      const wallC = night ? '#3a3040' : '#e4d2a8';
      A.wall(ctx, 0, 110, 232, 330, wallC, 3); A.rect(ctx, 0, 104, 232, 10, A.shade(wallC, -0.3));
      for (let i = 0; i < 5; i++) A.rect(ctx, 10 + i * 46, 116, 30, 8, A.shade(wallC, -0.2));
      A.door(ctx, 40, 250, 74, 178, night ? '#2a2018' : '#5a3e28', { frame: '#3a2a1a', arch: true, panel: true });
      A.window(ctx, 150, 128, 52, 66, { frame: '#5a4a3a', light: night ? '#ffd890' : '#3a4a5a' });
      A.window(ctx, 40, 128, 52, 66, { frame: '#5a4a3a', light: night ? '#3a3a4a' : '#3a4a5a' });
      A.rect(ctx, 140, 198, 72, 6, '#5a4a3a'); A.rect(ctx, 30, 198, 72, 6, '#5a4a3a');
      A.rect(ctx, 22, 212, 112, 28, '#2a2a3a'); A.text(ctx, 'HAFENAMT', 78, 232, { font: 'bold 14px Georgia', color: '#e8d8a0', align: 'center' });
      // Gasse zum Institut
      A.rect(ctx, 232, 140, 72, 300, '#1a1610');
      ctx.fillStyle = A.grad(ctx, 0, 150, 0, 440, [night ? '#1c1c30' : '#8a7a62', night ? '#0c0c16' : '#3a3020']); ctx.fillRect(244, 150, 48, 290);
      A.poly(ctx, [244, 150, 292, 150, 280, 440, 256, 440], night ? 'rgba(255,220,150,0.06)' : 'rgba(255,240,200,0.22)');
      A.rect(ctx, 236, 200, 64, 16, '#3a2a1a'); A.text(ctx, 'RUE DU MUSÉE', 268, 212, { font: 'bold 8px Georgia', color: '#e8d8a0', align: 'center' });
      // Lagerhaus
      A.wall(ctx, 304, 150, 112, 290, A.shade(wallC, -0.12), 5); A.rect(ctx, 304, 144, 112, 10, A.shade(wallC, -0.35));
      A.door(ctx, 330, 300, 60, 130, '#4a3a2a', { frame: '#3a2a1a', planks: true }); A.rect(ctx, 316, 170, 88, 40, '#2a2a3a');
      A.text(ctx, 'DÉPÔT', 360, 196, { font: 'bold 13px Georgia', color: '#c8b890', align: 'center' });
      // Palmen an der Mole
      A.palm(ctx, 470, 442, 178, 3); A.palm(ctx, 900, 442, 150, 8);
      // Kisten, Fässer, Netze
      A.crate(ctx, 560, 452, 82, 60, '#9a7a52', 'MANCHESTER'); A.crate(ctx, 648, 466, 60, 46, '#8a6a48', 'TRIEST');
      A.barrel(ctx, 716, 458, 36, 54, '#6a4a30');
      A.rect(ctx, 770, 440, 6, 78, '#5a4a3a'); A.rect(ctx, 868, 440, 6, 78, '#5a4a3a'); A.rect(ctx, 770, 442, 104, 4, '#5a4a3a');
      ctx.strokeStyle = 'rgba(60,50,30,0.7)'; ctx.lineWidth = 1;
      for (let i = 0; i < 10; i++) { ctx.beginPath(); ctx.moveTo(776 + i * 10, 446); ctx.lineTo(786 + i * 8, 508); ctx.stroke(); ctx.beginPath(); ctx.moveTo(776, 450 + i * 6); ctx.lineTo(868, 452 + i * 6); ctx.stroke(); }
      // Poller und Hassans Boot
      A.rr(ctx, 990, 442, 22, 32, 7, '#3a3a3a'); A.ell(ctx, 1001, 442, 11, 5, '#5a5a5a');
      A.rope(ctx, [1004, 452, 1020, 430, 1040, 412], '#b89a68', 3);
      A.boat(ctx, 1012, 406, 190, '#6a4a2e', true);
      A.rect(ctx, 1030, 392, 150, 10, '#4a3620');
      A.rr(ctx, 1150, 370, 40, 26, 4, '#8a7a5a');
      if (!g.flag('lampe_genommen')) { A.ell(ctx, 1052, 400, 12, 6, '#b08a40'); A.poly(ctx, [1062, 398, 1072, 396, 1064, 402], '#b08a40'); A.circle(ctx, 1050, 397, 2.5, '#7a5a20'); }
      if (!g.flag('schaufel_genommen')) { A.line(ctx, 1110, 382, 1150, 396, '#8a6a4a', 4); A.poly(ctx, [1148, 392, 1170, 388, 1176, 400, 1156, 404], '#9a9a9a'); }
      // Tor zum Basar rechts
      A.wall(ctx, 1300, 120, 100, 320, wallC, 7); A.rect(ctx, 1300, 114, 100, 10, A.shade(wallC, -0.3));
      A.arch(ctx, 1320, 240, 68, 200, '#8a7a5a', night ? '#1a1410' : '#7a5a40');
      ctx.fillStyle = A.grad(ctx, 0, 250, 0, 440, [night ? 'rgba(255,200,120,0.08)' : 'rgba(255,220,160,0.35)', 'rgba(0,0,0,0)']); ctx.fillRect(1324, 250, 60, 190);
      A.rect(ctx, 1310, 196, 80, 30, '#7a2e2e'); A.text(ctx, 'SUQ', 1350, 218, { font: 'bold 16px Georgia', color: '#f0e0b0', align: 'center' });
      for (let i = 0; i < 4; i++) A.poly(ctx, [1300 + i * 25, 226, 1325 + i * 25, 226, 1318 + i * 25, 244, 1307 + i * 25, 244], i % 2 ? '#e8e0d0' : '#b34a3a');
      if (night) { A.lantern(ctx, 130, 250, 0, true); A.lantern(ctx, 1300, 236, 0, true); A.glow(ctx, 1354, 300, 80, 'rgba(255,190,100,0.6)', 0.35); }
      A.vignette(ctx, W, 600, 0.35); A.grain(ctx, W, 600, 9, 0.035);
    },
    animate(ctx, t, g) { A.waterAnim(ctx, 0, 270, 1400, 166, t, g.flag('eg_nacht') ? 'rgba(200,220,255,0.08)' : 'rgba(255,255,255,0.13)'); },
    hotspots: [
      { id: 'festung', name: 'Festung Qait-Bey', rect: [1040, 176, 260, 92], at: [1150, 470, 'u'], walkToLook: true,
        look: async (g) => { await g.say('falk', 'Qait-Bey. Eine Festung aus dem 15. Jahrhundert, gebaut aus den Steinen des Leuchtturms, der hier stand. Eines der sieben Weltwunder, als Steinbruch.'); g.codex('pharos'); } },
      { id: 'stadt', name: 'Nordufer', rect: [380, 170, 640, 100], at: [700, 470, 'u'], look: 'Alexandria. Minarette, Kuppeln und die Fassaden der Baumwollhändler. Alexander hat sie gegründet und nie gesehen.' },
      { id: 'meer', name: 'Hafenbecken', rect: [420, 270, 980, 150], noWalk: true, look: 'Der Osthafen. Das Wasser ist grün und riecht nach Fisch und Teer.', use: 'Ich habe nicht vor zu schwimmen.', useWith: { flasche: 'Salzwasser. Nein.', default: 'Das werfe ich nicht ins Hafenbecken.' }, take: 'Wasser nehme ich nicht mit. Nicht dieses.' },
      { id: 'dampfer', name: 'Dampfer', rect: [180, 250, 200, 60], noWalk: true, look: 'Unser Dampfer aus Neapel. Er läuft morgen weiter nach Beirut, mit oder ohne uns.' },
      { id: 'hafenamt_schild', name: 'Hafenamt', rect: [0, 104, 232, 100], at: [78, 470, 'u'], look: 'Das Hafenamt. Hier haben wir heute Morgen Pässe gezeigt und Fragen beantwortet, die niemanden interessierten.' },
      { id: 'lagerhaus', name: 'Lagerhaus', rect: [304, 144, 112, 150], at: [360, 470, 'u'], look: 'Ein Lagerhaus. Baumwolle rein, Baumwolle raus.', open: 'Abgeschlossen. Und ich brauche keine Baumwolle.' },
      { id: 'palme', name: 'Dattelpalmen', rect: [420, 260, 120, 180], at: [470, 470, 'u'], look: 'Dattelpalmen entlang der Mole. Der Wind vom Meer geht hindurch, und sonst nichts.', take: 'Die Datteln sind noch grün.' },
      { id: 'kisten', name: 'Kisten', rect: [556, 448, 156, 66], at: [640, 530, 'u'], look: 'Kisten mit Aufschriften: Manchester, Triest. Baumwolle geht hinaus, Maschinen kommen herein.', open: 'Zoll, Zeugen, Zollzeugen. Nein.', take: 'Zu schwer, und nicht meine.', push: 'Sie stehen gut.' },
      { id: 'fass', name: 'Fass', rect: [712, 454, 44, 60], at: [734, 530, 'u'], look: 'Ein Fass. Es riecht nach Öl, nicht nach Wein.', open: 'Es ist zu. Und ich brauche kein Öl. Jedenfalls nicht fassweise.' },
      { id: 'netze', name: 'Fischernetze', rect: [766, 438, 112, 82], at: [822, 530, 'u'], look: 'Netze zum Trocknen. Es riecht danach.', take: 'Die Fischer würden das falsch verstehen.', use: 'Ich fische nicht.' },
      { id: 'poller', name: 'Poller', rect: [986, 438, 30, 40], at: [1000, 500, 'u'], look: 'Ein eiserner Poller. Daran hängt Hassans Boot.', pull: 'Der Poller bleibt. Das Boot auch.', use: 'Ich mache das Boot nicht los. Das ist Hassans Sache.' },
      { id: 'boot', name: 'Hassans Boot', rect: [1012, 380, 190, 66], at: [1090, 462, 'u'],
        look: (g) => g.flag('hassan_angeheuert') ? 'Hassans Boot. Ein Segel, ein Ruder, ' + (g.flag('lampe_genommen') && g.flag('schaufel_genommen') ? 'und Platz für zwei Passagiere.' : 'und im Bug sein Werkzeug: ' + [!g.flag('lampe_genommen') ? 'eine Öllampe' : null, !g.flag('schaufel_genommen') ? 'ein Klappspaten' : null].filter(Boolean).join(', ') + '.') : 'Ein Nilboot mit Lateinsegel. Im Bug eine Öllampe und ein Klappspaten. Der Mann daneben gehört vermutlich dazu.',
        take: (g) => g.flag('hassan_angeheuert') ? 'Was genau? Die Lampe oder den Spaten?' : 'Das ist ein fremdes Boot in einem Hafen voller Zeugen. Ich frage erst den Besitzer.',
        use: async (g) => { if (!g.flag('hassan_angeheuert')) return 'Ich sollte erst mit dem Bootsführer reden.'; await sailToSais(g); },
        open: 'Ein Boot hat keine Tür.', push: 'Es schaukelt. Sonst nichts.' },
      { id: 'lampe', name: 'Öllampe', rect: [1036, 388, 40, 20], at: [1060, 462, 'u'], z: 405, cond: (g) => g.flag('hassan_angeheuert') && !g.flag('lampe_genommen'),
        look: 'Eine Öllampe aus Ton. Sie liegt im Bug, neben dem Spaten.',
        take: (g) => { g.take('oellampe'); g.set('lampe_genommen'); g.repaint(); return 'Eine Tonlampe mit Öl und Docht. Hassan hat gesagt, ich soll sie nehmen.'; },
        use: (g) => g.hs('lampe').take(g) },
      { id: 'spaten', name: 'Klappspaten', rect: [1106, 376, 74, 30], at: [1140, 462, 'u'], z: 405, cond: (g) => g.flag('hassan_angeheuert') && !g.flag('schaufel_genommen'),
        look: 'Ein Klappspaten. Britische Armee, vermutlich, wie alles hier, was funktioniert.',
        take: (g) => { g.take('schaufel'); g.set('schaufel_genommen'); g.repaint(); return 'Der Spaten. Hassan sagt, in Sais gräbt man, bevor man etwas sieht.'; },
        use: (g) => g.hs('spaten').take(g) },
    ],
    exits: [
      { id: 'hafenamt', name: 'Anleger der Dampfer', rect: [34, 244, 86, 186], at: [78, 462, 'u'],
        look: (g) => g.flag('eg_fertig') ? 'Der Durchgang zum Anleger. Von hier gehen die Dampfer nach Kreta, Beirut und Piräus.' : 'Der Durchgang zum Anleger. Wir sind gerade erst angekommen.',
        before: async (g) => {
          if (!g.flag('eg_fertig')) { await g.say('falk', 'Wir sind hier noch nicht fertig.'); return false; }
          await ATL.story.openMap(g, 'alexandria');
          return false;
        } },
      { id: 'gasse', name: 'Gasse zum Institut', rect: [232, 140, 72, 300], at: [268, 458, 'u'], to: 'eg_library', pos: [60, 510], dir: 'r',
        look: 'Eine Gasse, die vom Hafen in die Stadt führt. Am Ende das Altertumsinstitut, sagt das Schild.' },
      { id: 'suq', name: 'Tor zum Basar', rect: [1310, 196, 90, 244], at: [1354, 460, 'u'], z: 2, to: 'eg_bazaar', pos: [90, 520], dir: 'r',
        look: 'Das Tor zum Basar. Dahinter Stimmen, Gewürze und alles, was jemand verkaufen will.' },
      { id: 'fahrt', name: 'Nach Sais fahren', rect: [1096, 236, 90, 142], at: [1090, 462, 'u'], z: 2, cond: (g) => g.flag('hassan_angeheuert'),
        look: 'Hassans Segel. Er sagt, bis Sais sind es sechs Stunden mit gutem Wind und acht ohne.',
        before: async (g) => { await sailToSais(g); return false; } },
    ],
    actors: [
      { id: 'hassan', x: 1090, y: 470, dir: 'l', at: [1040, 486, 'r'], look: 'Hassan, der Bootsführer. Er lehnt am Poller, als hätte er ihn erfunden.',
        talk: async (g) => { await g.dialog('eg_hassan'); if (g.flag('hassan_ablegen')) { g.set('hassan_ablegen', false); await sailToSais(g); } },
        giveWith: {
          muenzen: async (g) => { await g.say('hassan', 'Kleingeld? Effendi, ich bin Bootsführer, kein Bettler. Wir machen das mit Papiergeld, hinterher.'); },
          flasche: 'Wasser hat Hassan selbst. Der Kanal ist voll davon.',
          default: async (g, t, item) => { await g.say('hassan', 'Behalten Sie das. Ich habe ein Boot, ich brauche nichts.'); },
        } },
    ],
    async enter(g) {
      if (g.flag('eg_intro')) return;
      g.set('eg_intro');
      await g.scene(async () => {
        await g.message('Alexandria. Juni 1938. Der Dampfer aus Neapel hat vier Tage gebraucht und Livia drei davon geredet.', 3600);
        g.place('livia', 262, 528, 'r');
        await g.say('livia', 'Das Altertumsinstitut liegt am Ende dieser Gasse. Wenn es einen Bericht über Sais gibt, dann steht er dort.');
        await g.say('falk', 'Und ich?');
        await g.say('livia', 'Du suchst ein Boot. Ins Delta fährt kein Zug, und ich verhandle nicht mit Bootsführern. Das machst du besser. Du klingst, als hättest du kein Geld.');
        await g.say('falk', 'Ich habe kein Geld.');
        await g.say('livia', 'Siehst du.');
        await g.walk('livia', 268, 456, 'u');
        g.hide('livia');
        g.objective('Ein Boot nach Sais finden. Livia sucht im Institut nach dem Bericht über die Grabung von 1911.');
      });
    },
  });

  ATL.dialogs.define('eg_hassan', {
    nodes: {
      root: {
        options: [
          { text: 'Ich brauche ein Boot nach Sais, ins Delta.', cond: (g) => !g.flag('hassan_angeheuert'),
            say: [['hassan', 'Sais. Sa el-Hagar. Da ist nichts, Effendi. Sand, Ziegen, ein paar Mauern.'], ['falk', 'Genau die Mauern.'], ['hassan', 'Sie sind Archäologe.'], ['falk', 'Sieht man das?'], ['hassan', 'Man sieht es. Mein Onkel hat 1911 für die Engländer dort gegraben. Sie haben nichts gefunden und nicht bezahlt.'], ['falk', 'Ich zahle vorher. Das Institut hat mir einen Vorschuss gegeben. Es weiß es nur noch nicht.'], ['hassan', 'Dann fahren wir, wann Sie wollen. Nehmen Sie aus dem Boot, was Sie brauchen: Lampe, Spaten. Unter die Erde geht in Sais keiner ohne Licht.']],
            action: async (g) => { g.set('hassan_angeheuert'); g.objective('Lampe und Spaten aus Hassans Boot holen. Dann in der Bibliothek des Instituts nach dem Bericht über Sais suchen.'); } },
          { text: 'Fahren wir nach Sais.', cond: (g) => g.flag('hassan_angeheuert'), end: true, say: [['hassan', 'Steigen Sie ein.']], action: async (g) => { g.set('hassan_ablegen'); } },
          { text: 'Was ist das für eine Festung da drüben?', once: true, say: [['hassan', 'Qait-Bey. Der Sultan hat sie gebaut, auf den Steinen des Leuchtturms. Vom Leuchtturm ist nichts mehr da, nur die Steine in der Mauer.'], ['falk', 'So geht es den meisten Weltwundern.']], action: async (g) => { g.codex('pharos'); } },
          { text: 'War hier ein Mann in schwarzem Mantel?', once: true, cond: (g) => g.flag('abrieb_gemacht'),
            say: [['hassan', 'Heute Morgen. Schwarzer Mantel, bei der Hitze. Er hat nach einem Amerikaner mit einer Frau gefragt, die Vorträge hält.'], ['falk', 'Was haben Sie gesagt?'], ['hassan', 'Dass ich Fische fange. Er hat mir nicht geglaubt. Er hat mir ein Pfund gegeben und ist zum Hotel gegangen.'], ['falk', 'Kessler. Er hat einen langen Atem.']],
            action: async (g) => { g.set('kessler_gefragt'); } },
          { text: 'Bis später, Hassan.', end: true, say: [['hassan', 'Ich bin am Boot. Ich bin immer am Boot.']] },
        ],
      },
    },
  });

  // ---------------------------------------------------------------- Basar
  R({
    id: 'eg_bazaar', name: 'Basar', ambient: 'egypt',
    start: [90, 520, 'r'],
    walk: [[96, 448, 900, 448, 940, 585, 30, 585]],
    scale: { y0: 430, s0: 0.78, y1: 585, s1: 1.05 },
    paint(ctx, g) {
      A.sky(ctx, 960, 200, '#6fa8dc', '#e8dcb8');
      // Häuserwände
      A.wall(ctx, 0, 120, 960, 320, '#d9c39a', 11); A.rect(ctx, 0, 114, 960, 8, '#8a7a5a');
      A.bricks(ctx, 0, 380, 960, 60, '#c8b088', 36, 14, 12, '#a08a60');
      // Straße zum Institut (Mitte, ansteigend)
      A.rect(ctx, 462, 120, 128, 320, '#3a2c1c');
      ctx.fillStyle = A.grad(ctx, 0, 130, 0, 440, ['#f0e2c0', '#a08a64']); A.poly(ctx, [498, 130, 556, 130, 582, 440, 470, 440], ctx.fillStyle);
      A.rect(ctx, 472, 130, 26, 310, '#8a7250'); A.rect(ctx, 556, 130, 26, 310, '#7a6448');
      for (let i = 0; i < 5; i++) { A.rect(ctx, 476, 150 + i * 56, 16, 22, '#2a2018'); A.rect(ctx, 562, 160 + i * 56, 16, 22, '#2a2018'); }
      A.poly(ctx, [498, 130, 556, 130, 540, 200, 512, 200], 'rgba(255,240,200,0.5)');
      // Fenster und Balkon
      A.window(ctx, 120, 150, 60, 80, { frame: '#5a4a3a', light: '#2a3040' }); A.rect(ctx, 112, 150, 76, 6, '#5a4a3a');
      A.window(ctx, 300, 160, 60, 80, { frame: '#5a4a3a', light: '#2a3040' });
      A.rect(ctx, 660, 140, 120, 110, '#5a4a3a'); A.rect(ctx, 664, 144, 112, 102, '#2a2018');
      ctx.strokeStyle = '#a08a60'; ctx.lineWidth = 1.5;
      for (let i = 0; i < 8; i++) { ctx.beginPath(); ctx.moveTo(664 + i * 16, 144); ctx.lineTo(664 + i * 16, 246); ctx.stroke(); ctx.beginPath(); ctx.moveTo(664, 144 + i * 14); ctx.lineTo(776, 144 + i * 14); ctx.stroke(); }
      A.rect(ctx, 650, 250, 140, 8, '#5a4a3a');
      // Gasse zum Hafen links
      A.rect(ctx, 0, 170, 76, 270, '#1a1610'); ctx.fillStyle = A.grad(ctx, 0, 180, 0, 440, ['#7fb0d8', '#4a5a60']); ctx.fillRect(8, 180, 60, 260);
      A.poly(ctx, [8, 180, 68, 180, 60, 440, 16, 440], 'rgba(255,240,200,0.18)');
      // Sonnensegel
      const canopy = (x0, x1, y, sag, c1, c2, n) => {
        ctx.save(); ctx.beginPath(); ctx.moveTo(x0, y); ctx.quadraticCurveTo((x0 + x1) / 2, y + sag, x1, y); ctx.lineTo(x1, y - 90); ctx.lineTo(x0, y - 90); ctx.closePath(); ctx.clip();
        for (let i = 0; i < n; i++) A.rect(ctx, x0 + ((x1 - x0) / n) * i, y - 100, (x1 - x0) / n + 1, 200, i % 2 ? c1 : c2);
        ctx.restore();
        ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x0, y); ctx.quadraticCurveTo((x0 + x1) / 2, y + sag, x1, y); ctx.stroke();
        A.line(ctx, x0, y, x0, 0, '#5a4a3a', 2); A.line(ctx, x1, y, x1, 0, '#5a4a3a', 2);
      };
      canopy(0, 440, 118, 40, '#b34a3a', '#f0e6d0', 10); canopy(600, 960, 104, 34, '#2f5f8a', '#f0e6d0', 8);
      A.shadeRect(ctx, 0, 122, 440, 60, 0.18); A.shadeRect(ctx, 600, 122, 360, 50, 0.18);
      // Boden
      A.floorTiles(ctx, 960, 440, 600, '#cdb88e', '#8a7a5a', 12, 520);
      ctx.fillStyle = 'rgba(90,70,40,0.25)'; ctx.fillRect(0, 440, 960, 6);
      // Teppiche rechts
      const rugs = [['#7a2e2e', '#e0b84a'], ['#2f5f8a', '#e8dcc0'], ['#3d6e4a', '#d8b56a']];
      for (let i = 0; i < 3; i++) { A.rect(ctx, 812, 262 + i * 10, 136, 178 - i * 10, rugs[i][0]); A.rect(ctx, 820 + i * 8, 274 + i * 10, 120 - i * 16, 150 - i * 10, rugs[i][1]); A.rect(ctx, 830 + i * 8, 288 + i * 10, 100 - i * 16, 120 - i * 10, rugs[i][0]); }
      A.rect(ctx, 800, 256, 160, 8, '#5a4a3a');
      A.rug(ctx, 840, 430, 100, 26, '#7a2e2e', '#e0b84a');
      // Katze auf dem Teppich
      A.ell(ctx, 890, 428, 18, 8, '#3a3028'); A.circle(ctx, 906, 422, 6, '#3a3028'); A.poly(ctx, [902, 418, 904, 411, 907, 418], '#3a3028'); A.poly(ctx, [908, 418, 911, 411, 912, 418], '#3a3028'); A.line(ctx, 872, 428, 862, 420, '#3a3028', 3);
      // Gewürzsäcke
      const sack = (x, y, c) => { A.rr(ctx, x, y, 44, 40, 8, '#b8a078'); A.ell(ctx, x + 22, y + 4, 18, 6, c); };
      sack(400, 404, '#c8402a'); sack(430, 414, '#e0a020'); sack(396, 430, '#6a4a20');
      // Krüge
      for (let i = 0; i < 3; i++) { A.ell(ctx, 612 + i * 22, 424, 12, 16, '#9a6a48'); A.ell(ctx, 612 + i * 22, 410, 7, 4, '#5a3a28'); }
      A.vignette(ctx, 960, 600, 0.38); A.grain(ctx, 960, 600, 7, 0.04);
    },
    animate(ctx, t) { A.dust(ctx, 480, 140, 120, 280, t, 14, 'rgba(255,240,200,0.5)'); },
    hotspots: [
      { id: 'stand', name: 'Farids Stand', rect: [100, 290, 300, 130], at: [250, 490, 'u'], z: 436,
        paint: (ctx, g) => {
          A.table(ctx, 100, 372, 300, 18, '#8a6a48', 56); A.rect(ctx, 100, 390, 300, 50, '#7a5a3a'); A.rug(ctx, 110, 398, 280, 34, '#7a2e2e', '#e0b84a');
          A.rect(ctx, 106, 366, 288, 8, '#c8b48a');
          // Federn im Krug
          A.ell(ctx, 140, 364, 14, 10, '#9a6a48'); if (!g.flag('feder_gekauft')) { ctx.save(); ctx.translate(140, 352); ctx.rotate(-0.25); A.ell(ctx, 0, -20, 5, 22, '#f4f4f4'); A.line(ctx, 0, -42, 0, 2, '#bbb', 1); ctx.restore(); }
          ctx.save(); ctx.translate(152, 354); ctx.rotate(0.3); A.ell(ctx, 0, -18, 5, 20, '#e8e8e0'); ctx.restore();
          // Skarabäen, Amulette, Papiere, Lampen
          A.ell(ctx, 200, 366, 9, 6, '#3a7a6a'); A.ell(ctx, 220, 364, 8, 5, '#2a5a8a'); A.ell(ctx, 238, 367, 9, 6, '#7a6a3a');
          if (!g.flag('katalogkarte_erhalten')) A.ell(ctx, 262, 358, 12, 8, '#3a7a6a');
          A.rect(ctx, 290, 350, 40, 22, '#efe4c8'); A.rect(ctx, 296, 346, 40, 22, '#e6dcc0'); A.line(ctx, 302, 354, 326, 354, '#7a7a8a', 1);
          A.ell(ctx, 360, 362, 14, 7, '#b08a40'); A.poly(ctx, [372, 360, 384, 358, 374, 364], '#b08a40');
          A.rect(ctx, 96, 240, 8, 100, '#5a4a3a'); A.rect(ctx, 396, 240, 8, 100, '#5a4a3a');
          A.rect(ctx, 96, 234, 308, 14, '#e0b84a'); for (let i = 0; i < 12; i++) A.poly(ctx, [100 + i * 25, 248, 120 + i * 25, 248, 110 + i * 25, 262], '#e0b84a');
          A.text(ctx, 'FARID · ANTIQUITÉS', 250, 245, { font: 'bold 10px Georgia', color: '#5a3a1a', align: 'center' });
        },
        look: (g) => 'Farids Stand. Straußenfedern, Skarabäen in vier Farben, Amulette, Papier' + (g.flag('katalogkarte_erhalten') ? '. Alles echt, sagt er.' : ' und, halb unter einem Tuch, etwas, das wie eine Karteikarte aussieht.'),
        take: 'Hier nimmt man nichts. Hier kauft man, und Farid schaut zu.', use: 'Farid steht direkt dahinter. Ich rede lieber mit ihm.',
        useWith: { muenzen: (g) => g.roomDef.actors.find((a) => a.id === 'farid').giveWith.muenzen(g), uhr: (g) => g.roomDef.actors.find((a) => a.id === 'farid').giveWith.uhr(g), default: 'Farid würde es mir abkaufen. Ich will aber nichts verkaufen.' } },
      { id: 'schreibpult', name: 'Yusufs Pult', rect: [640, 380, 150, 50], at: [715, 490, 'u'], z: 438,
        paint: (ctx) => { A.rug(ctx, 630, 400, 170, 40, '#3d6e4a', '#d8b56a'); A.rect(ctx, 650, 386, 130, 12, '#6a4a30'); A.rect(ctx, 656, 398, 6, 30, '#5a3a20'); A.rect(ctx, 768, 398, 6, 30, '#5a3a20'); A.rect(ctx, 660, 374, 50, 14, '#efe4c8'); A.line(ctx, 666, 380, 700, 380, '#2a3a7a', 1); A.line(ctx, 666, 384, 692, 384, '#2a3a7a', 1); A.rr(ctx, 730, 372, 14, 16, 3, '#2a2a3a'); A.line(ctx, 745, 368, 758, 386, '#8a6a4a', 2); A.rect(ctx, 720, 368, 40, 4, '#8a7a5a'); },
        look: 'Ein niedriges Pult mit Tinte, Rohrfedern und Papier. Yusuf schreibt Briefe für Leute, die nicht schreiben können, und liest, was andere nicht lesen können.',
        take: 'Yusuf braucht das. Ich nicht.', use: 'Ich habe nichts zu schreiben. Lesen wäre mir lieber.' },
      { id: 'teppiche', name: 'Teppiche', rect: [800, 256, 160, 180], at: [880, 490, 'u'], look: 'Teppiche aus Anatolien und Persien, sagt das Schild. Aus Kairo, sagt das Muster.', take: 'Ich habe kein Kamel dabei.', use: 'Ich brauche keinen Teppich. Ich brauche einen Bericht.' },
      { id: 'katze', name: 'Katze', rect: [864, 412, 60, 26], at: [880, 490, 'u'], look: 'Eine Katze schläft auf dem besten Teppich des Basars. Das ist seit dreitausend Jahren ihr Recht.', take: 'Sie würde es mir übel nehmen. Und die Ägypter auch.', talk: 'Sie öffnet ein Auge. Das reicht als Antwort.', use: 'Ich lasse sie schlafen.' },
      { id: 'saecke', name: 'Gewürzsäcke', rect: [392, 400, 90, 70], at: [440, 500, 'u'], look: 'Paprika, Kurkuma, Kreuzkümmel. Der ganze Basar riecht danach.', take: 'Ich nehme keine Gewürze mit in ein Grab.', use: 'Ich niese schon vom Hinsehen.' },
      { id: 'kruege', name: 'Wasserkrüge', rect: [596, 404, 76, 40], at: [634, 500, 'u'], look: 'Tonkrüge mit Wasser. Der Ton schwitzt und hält das Wasser kühl.', use: 'Ich trinke nichts, was hier länger als eine Stunde steht.', useWith: { flasche: 'Meine Flasche ist voll. Und ich bin nicht durstig.', default: 'Das kommt nicht in den Krug.' }, take: 'Zu schwer und nicht meiner.' },
      { id: 'balkon', name: 'Balkon', rect: [650, 138, 140, 120], at: [720, 470, 'u'], look: 'Ein Balkon mit einem Gitter aus gedrechseltem Holz. Wer dahinter sitzt, sieht alles und wird nicht gesehen.' },
      { id: 'segel', name: 'Sonnensegel', rect: [0, 40, 960, 80], noWalk: true, look: 'Sonnensegel über der Gasse. Rot und weiß, blau und weiß, und darüber ein Himmel, der es ernst meint.' },
    ],
    exits: [
      { id: 'hafen', name: 'Gasse zum Hafen', rect: [0, 170, 76, 270], at: [90, 500, 'l'], to: 'eg_harbor', pos: [1290, 500], dir: 'l', look: 'Die Gasse zurück zum Hafen. Man riecht das Meer.' },
      { id: 'institut', name: 'Straße zum Institut', rect: [466, 126, 120, 314], at: [524, 455, 'u'], to: 'eg_library', pos: [930, 500], dir: 'l', look: 'Eine Straße, die aus dem Basar hinauf in die Stadt führt. Das Institut liegt am oberen Ende.' },
    ],
    actors: [
      { id: 'farid', x: 250, y: 433, dir: 'd', at: [250, 492, 'u'], look: 'Farid. Fez, Schnurrbart, ein Lächeln, das jeden Preis kennt.',
        talk: (g) => g.dialog('eg_farid'),
        giveWith: {
          uhr: async (g) => {
            if (!g.flag('farid_will_uhr')) { await g.say('farid', 'Eine Uhr? Sie wollen etwas dafür. Die Karte, die der Herr im Mantel mir verkauft hat.'); await g.say('falk', 'Woher wissen Sie das?'); await g.say('farid', 'Sie sind der zweite Ausländer diese Woche, der nach Sais fragt. Der erste hat verkauft. Sie kaufen.'); }
            await g.say('farid', 'Gold?'); await g.say('falk', 'Vergoldet.'); await g.say('farid', 'Trotzdem. Die Karte, und der Herzskarabäus dazu, weil Sie mir sympathisch sind.');
            g.drop('uhr'); g.take('katalogkarte'); g.take('skarabaeus'); g.set('katalogkarte_erhalten'); g.repaint();
            await g.say('falk', 'Mein Vater hätte die Uhr lieber bei mir gesehen. Aber er hätte auch den Bericht lesen wollen.');
            await g.say('falk', '„Sais, Grabung 1911. Regal IV, Fach 7.“ Zurück ins Institut.');
            g.objective('Mit der Katalogkarte in der Bibliothek den Bericht holen: Regal IV, Fach 7.');
          },
          muenzen: async (g) => {
            if (g.flag('feder_gekauft')) { await g.say('farid', 'Noch eine Feder? Eine reicht für ein Gericht, Effendi.'); return; }
            await g.say('farid', 'Ein Piaster für die Feder der Maat. Sie haben Glück, heute ist Feiertag.');
            g.take('feder'); g.set('feder_gekauft'); g.repaint();
            await g.say('falk', 'Eine Straußenfeder. Wenn sie von der Maat wäre, hätte sie mehr gekostet.');
          },
          perle: async (g) => { await g.say('farid', 'Was… zeigen Sie mir das noch einmal.'); await g.say('falk', 'Nein.'); },
          medaillon: async (g) => { await g.say('farid', 'Grünes Metall. Nicht Kupfer, nicht Bronze. Farid würde sich das gern ansehen. Länger.'); await g.say('falk', 'Farid sieht sich meine Uhr an. Das reicht.'); },
          visitenkarte: async (g) => { await g.say('farid', 'Meridian-Gesellschaft. Der Herr im Mantel hatte dieselbe. Er hat sie nicht dagelassen.'); },
          default: async (g) => { await g.say('farid', 'Dafür gibt es keinen Markt. Nicht einmal hier.'); },
        } },
      { id: 'yusuf', x: 715, y: 428, dir: 'd', at: [715, 490, 'u'], look: 'Yusuf, der Schreiber. Turban, Brille, Finger voller Tinte. Er sitzt hier, seit es den Basar gibt, sagt Farid.',
        talk: (g) => g.dialog('eg_yusuf'),
        giveWith: {
          abrieb: async (g) => {
            await g.say('yusuf', 'Ein Abrieb. Sauber gemacht, das sieht man selten.');
            await g.wait(400);
            await g.say('yusuf', 'Spätzeit. Ein Tempeltext, sorgfältig gehauen. Vier Zeilen, und keine davon ist ein Gebet.');
            await g.say('falk', 'Können Sie ihn übersetzen?');
            await g.say('yusuf', 'Ich kann. Aber nicht für Geld. Für Geld schreibe ich Briefe.');
            await g.say('falk', 'Wofür dann?');
            await g.say('yusuf', 'Erzählen Sie mir, wo Sie das gefunden haben. Meine Knie tragen mich nicht mehr weit, meine Ohren schon.');
            await g.dialog('eg_yusuf_abrieb');
          },
          muenzen: async (g) => { await g.say('yusuf', 'Geld nehme ich für Briefe. Haben Sie einen Brief?'); await g.say('falk', 'Nein.'); await g.say('yusuf', 'Dann behalten Sie es.'); },
          uebersetzung: async (g) => { await g.say('yusuf', 'Das ist meine Übersetzung. Sie stimmt, ich habe sie zweimal gelesen.'); },
          papier: async (g) => { await g.say('yusuf', 'Papier habe ich. Was mir fehlt, sind Texte.'); },
          default: async (g) => { await g.say('yusuf', 'Ich lese. Ich sammle nicht.'); },
        } },
    ],
    async enter(g) {
      if (g.flag('basar_besucht')) return;
      g.set('basar_besucht');
      await g.say('falk', 'Der Basar. Gewürze, Teppiche, Amulette. Und alles, was aus Alexandria verschwindet, taucht hier wieder auf. Sagt Amina.');
    },
  });

  ATL.dialogs.define('eg_farid', {
    nodes: {
      root: {
        say: (g) => g.flag('farid_begruesst') ? [] : (g.set('farid_begruesst'), [['farid', 'Willkommen, willkommen. Farid hat alles: Amulette, Federn, Papyrus, echt wie die Pyramiden.']]),
        options: [
          { text: 'Was kostet die Straußenfeder?', cond: (g) => !g.flag('feder_gekauft'),
            say: [['farid', 'Die Feder der Maat. Für Sie: ein Piaster.'], ['falk', 'Für einen Piaster ist sie nicht von der Maat.'], ['farid', 'Für einen Piaster ist sie vom Strauß. Die Maat gibt es dazu.']],
            action: async (g) => { g.take('feder'); g.set('feder_gekauft'); g.repaint(); await g.say('falk', 'Ein Piaster. Der Strauß hat es nicht gemerkt.'); } },
          { text: 'Hat Ihnen jemand eine Karte aus dem Institut verkauft?', cond: (g) => (g.flag('karte_fehlt') || g.flag('amina_farid_hinweis')) && !g.flag('katalogkarte_erhalten') && !g.flag('farid_will_uhr'),
            say: [['farid', 'Papier, Karten, Uhren, Sorgen. Farid kauft alles.'], ['falk', 'Eine Karteikarte. Etwa so groß. „Sais, Grabung 1911.“'], ['farid', 'Diese hier? Ein Herr hat sie mir verkauft. Sehr vornehm, schwarzer Mantel, hat nicht gehandelt.'], ['falk', 'Was wollen Sie dafür?'], ['farid', 'Geld nehme ich für Federn. Für so eine Karte…'], ['farid', 'Die Uhr. Die Uhr, und Sie bekommen die Karte und den Herzskarabäus obendrauf, weil Sie mir sympathisch sind.'], ['falk', 'Die Uhr war ein Geschenk meines Vaters.'], ['farid', 'Dann hat Ihr Vater guten Geschmack gehabt. Die Karte oder die Uhr, Effendi. Beides geht nicht.']],
            action: async (g) => { g.set('farid_will_uhr'); } },
          { text: 'Die Karte gegen die Uhr. Ich denke darüber nach.', cond: (g) => g.flag('farid_will_uhr') && !g.flag('katalogkarte_erhalten'), once: true,
            say: [['farid', 'Denken Sie. Die Karte läuft nicht weg. Die Uhr auch nicht, sie geht ja nach.'], ['falk', 'Woher wissen Sie, dass sie nachgeht?'], ['farid', 'Alle Uhren gehen nach, wenn man sie verkaufen will.']] },
          { text: 'Was ist das für ein Skarabäus?', once: true,
            say: [['farid', 'Ein Herzskarabäus. Aus einem Grab bei Sakkara, oder aus einer Werkstatt in Kairo. Das Herz merkt keinen Unterschied.'], ['farid', 'Man legte ihn den Toten aufs Herz. Damit es beim Gericht den Mund hält. Das Beste, was man einem Herzen wünschen kann.']] },
          { text: 'Nur geschaut, danke.', end: true, say: [['farid', 'Schauen ist umsonst. Heute.']] },
        ],
      },
    },
  });

  ATL.dialogs.define('eg_yusuf', {
    nodes: {
      root: {
        say: (g) => g.flag('yusuf_begruesst') ? [] : (g.set('yusuf_begruesst'), [['yusuf', 'Briefe, Verträge, Grabsteine. Was soll gelesen werden?']]),
        options: [
          { text: 'Sie lesen Hieroglyphen?', once: true, say: [['yusuf', 'Seit vierzig Jahren. Ich habe für die Franzosen gelesen und für die Engländer, und keiner hat mir zugehört. Sie schreiben lieber selbst.'], ['falk', 'Ich höre zu.'], ['yusuf', 'Das werden wir sehen.']] },
          { text: 'Ich habe einen Abrieb, den ich nicht lesen kann.', cond: (g) => g.has('abrieb'), say: [['yusuf', 'Dann geben Sie ihn mir. Nicht erzählen. Geben.']] },
          { text: 'Was kostet eine Übersetzung?', once: true, say: [['yusuf', 'Kommt darauf an, was drinsteht. Manche Texte bezahlt man mit Geld. Manche mit einer Geschichte.']] },
          { text: 'Was war hinter der Tür, fragen Sie sich sicher.', cond: (g) => g.flag('inschrift_text') && g.has('sonnensiegel'), once: true, say: [['yusuf', 'Ich frage mich seit Jahren, was hinter allen Türen ist. Erzählen Sie.'], ['falk', 'Eine Kammer. Eine Stele auf Griechisch. Und etwas aus Gold, das wir nicht behalten dürfen, aber behalten.'], ['yusuf', 'Dann ist es wie immer. Danke.']] },
          { text: 'Ich muss weiter.', end: true, say: [['yusuf', 'Alle müssen weiter. Ich sitze hier.']] },
        ],
      },
    },
  });

  ATL.dialogs.define('eg_yusuf_abrieb', {
    nodes: {
      root: {
        options: [
          { text: 'Aus Sais. Unter dem Tempel der Neith.', say: [['yusuf', 'Sais. Ich habe die Schreibweise gleich gesehen, sie ist aus dem Delta. Unter dem Tempel, sagen Sie. Also gibt es ihn noch.'], ['falk', 'Es gibt eine Halle und eine Tür. Und diese Wand.']], next: 'ende' },
          { text: 'Das kann ich nicht sagen.', say: [['yusuf', 'Dann sagen Sie es nicht. Sais, nehme ich an. Die Schreibweise ist aus dem Delta, und Sie haben Sand an den Schuhen, keinen Staub.'], ['falk', 'Sais.'], ['yusuf', 'Sehen Sie. Es geht doch.']], next: 'ende' },
        ],
      },
      ende: {
        say: [['yusuf', 'Vier Zeilen. „Wer eintreten will, ordne die Zeichen, wie die Welt geordnet ist.“'], ['yusuf', '„Zuerst Re, die Sonne. Dann Nun, das Wasser. Dann Apis, der Stier. Zuletzt Thot, der Ibis.“'], ['yusuf', 'Re, das ist die Sonne, das brauche ich Ihnen nicht zu sagen. Nun ist das Wasser, aus dem am Anfang alles kam. Apis ist der Stier von Memphis. Und Thot schreibt.'], ['falk', 'Eine Anweisung. Für jemanden, der vor einer Tür steht.'], ['yusuf', 'Für jemanden, der lesen kann. Das war früher eine kleine Gruppe. Heute auch.'], ['falk', 'Danke, Yusuf.'], ['yusuf', 'Danken Sie mir, indem Sie mir erzählen, was dahinter war. Irgendwann.']],
        action: async (g) => { g.set('inschrift_text', INSCHRIFT); g.drop('abrieb'); g.take('uebersetzung'); g.codex('nun'); g.codex('apis'); g.objective('Zurück nach Sais. Die Blöcke an der Tempeltür ordnen: Sonne, Wasser, Stier, Ibis.'); },
        end: true,
      },
    },
  });

  // ---------------------------------------------------------------- Bibliothek des Altertumsinstituts
  async function climbShelf(g) {
    if (g.flag('bericht_genommen')) return 'Den Bericht habe ich schon. Fach 7 ist jetzt leer.';
    if (!g.has('katalogkarte')) return 'Zwanzig Fächer, zweihundert Berichte, alle gleich grau. Ohne die Karte weiß ich nicht, wo ich anfangen soll.';
    await g.scene(async () => {
      await g.walk('falk', 786, 452, 'u');
      g.hero.fixedScale = g.hero.scale;
      for (let i = 1; i <= 10 && !g.fast; i++) { g.hero.offsetY = -i * 22; await g.wait(110); }
      g.hero.offsetY = -220;
      await g.say('falk', 'Fach 7. Delta-Berichte, nach Jahr. 1909, 1910… „Sais, Grabung 1911.“ Dünn, staubig, nie ausgeliehen.');
      g.hero.anim = 'reach'; await g.wait(600);
      g.take('bericht'); g.set('bericht_genommen'); g.repaint();
      g.hero.anim = 'stand';
      for (let i = 9; i >= 0 && !g.fast; i--) { g.hero.offsetY = -i * 22; await g.wait(80); }
      g.hero.offsetY = 0; g.hero.fixedScale = null;
      await g.say('falk', 'Der Mann im Mantel hat ihn gelesen und dann die Karte mitgenommen, damit niemand nach ihm liest. Bücher bleiben im Haus, sagt Amina. Er hat sich daran gehalten.');
      g.objective('Den Bericht lesen. Dann Papier und Kohle bei Amina holen und mit Hassan nach Sais fahren.');
    });
  }
  const CATALOG = {
    drawers: [
      { label: 'Nildelta', cards: [
        { id: 'delta_karte', text: 'Karte des westlichen Deltas, 1:100 000. Regal I, Fach 2.' },
        { id: 'delta_kanal', text: 'Die Kanäle des Deltas. Bericht der Bewässerungsbehörde, 1922. Regal I, Fach 5.' },
        { id: 'delta_naukratis', text: 'Naukratis, Grabungen 1884–1886. Regal III, Fach 1.' } ] },
      { label: 'Sais', cards: [
        { id: 'sais_topo', text: 'Sais (Sa el-Hagar), Lage und Topographie. Regal IV, Fach 5.' },
        { id: 'luecke', text: '(Zwischen den Karten klafft eine Lücke. Hier hat eine weitere gesteckt.)' },
        { id: 'sais_muenzen', text: 'Sais, Münzfunde 1902. Regal IV, Fach 9.' } ] },
      { label: 'Solon', cards: [
        { id: 'solon_gesetze', text: 'Solon, Gesetze und Fragmente. Regal II, Fach 1.' },
        { id: 'solon_platon', text: 'Platon, Timaios und Kritias, griechisch und deutsch. Regal II, Fach 2.' } ] },
      { label: 'Neith', cards: [
        { id: 'neith_kult', text: 'Neith von Sais, Kult und Fest. Regal IV, Fach 1.' },
        { id: 'neith_athena', text: 'Neith und Athena. Aufsatz, 1904. Regal IV, Fach 2.' } ] },
      { label: 'Alexandria', cards: [
        { id: 'alex_pharos', text: 'Der Leuchtturm von Pharos, Rekonstruktionen. Regal V, Fach 3.' },
        { id: 'alex_bibliothek', text: 'Die Bibliothek der Ptolemäer, Quellen. Regal V, Fach 4.' } ] },
    ],
    answer: 'luecke',
  };
  async function useCatalog(g) {
    if (g.has('katalogkarte')) return 'Die Karte, die hier fehlt, habe ich in der Tasche. Regal IV, Fach 7.';
    if (g.flag('bericht_genommen')) return 'Den Kasten brauche ich nicht mehr.';
    const r = await g.puzzle('catalog', Object.assign({ title: 'Zettelkasten des Instituts', text: 'Schublade wählen, dann eine Karte ziehen.' }, CATALOG));
    if (r === null || r === undefined) return 'Ich schiebe die Schublade zu.';
    if (r === 'luecke') {
      if (!g.flag('karte_fehlt')) {
        g.set('karte_fehlt');
        await g.say('falk', 'Sais, Topographie. Sais, Münzfunde. Und dazwischen: nichts. Ein Zwischenraum, in dem eine Karte gesteckt hat.');
        await g.say('falk', 'Die Grabung von 1911 steht in jedem Handbuch. Wenn ihre Karte fehlt, dann nicht aus Versehen.');
        g.objective('Herausfinden, wer die Katalogkarte zu Sais 1911 genommen hat. Amina fragen.');
      } else await g.say('falk', 'Die Lücke ist noch da. Die Karte auch nicht.');
      return;
    }
    const txt = { delta_karte: 'Eine Karte des Deltas. Sais liegt am Rosette-Arm, ein Punkt mit einem Fragezeichen daneben.', delta_kanal: 'Kanäle, Schleusen, Bewässerung. Trockener als das Delta selbst.', delta_naukratis: 'Naukratis, die griechische Handelsstadt im Delta. Petrie hat dort gegraben. Nicht mein Ziel.', sais_topo: 'Sais, Topographie. Eine Umfassungsmauer, ein Tempelbezirk, alles unter Flugsand. Das hilft, aber es sagt nicht, wo man gräbt.', sais_muenzen: 'Münzen aus Sais. Ptolemäisch, römisch. Zu spät für Solon.', solon_gesetze: 'Solons Gesetze. Er hat Athen die Schulden erlassen und ist dann verreist, damit man ihn nicht umstimmen konnte.', solon_platon: 'Timaios und Kritias. Die zwei Dialoge, in denen Atlantis vorkommt, und die Stelle, an der Kritias mitten im Satz aufhört.', neith_kult: 'Neith von Sais. Schöpferin, Jägerin, Weberin. Die Griechen haben in ihr Athena gesehen.', neith_athena: 'Ein Aufsatz über Neith und Athena. Der Verfasser hält die Gleichsetzung für alt. Vielleicht hat er recht.', alex_pharos: 'Der Leuchtturm. Rekonstruktionen aus drei Jahrhunderten, und jede sieht anders aus.', alex_bibliothek: 'Die Bibliothek der Ptolemäer. Wann sie unterging, weiß niemand. Man hat sich auf einen Brand geeinigt, weil ein Brand eine Geschichte ist.' }[r];
    if (txt) await g.say('falk', txt);
    if (r === 'solon_platon') g.codex('platon');
    if (r === 'solon_gesetze') g.codex('solon');
    if (r === 'neith_kult' || r === 'neith_athena') g.codex('neith');
    if (r === 'alex_pharos' || r === 'alex_bibliothek') g.codex('pharos');
  }
  R({
    id: 'eg_library', name: 'Bibliothek des Altertumsinstituts', ambient: 'egypt',
    start: [60, 510, 'r'],
    walk: [[40, 446, 920, 446, 940, 585, 20, 585]],
    scale: { y0: 430, s0: 0.78, y1: 585, s1: 1.05 },
    paint(ctx, g) {
      A.wall(ctx, 0, 0, 960, 440, '#d8c8a8', 13);
      A.rect(ctx, 0, 0, 960, 26, '#8a7a5a'); A.rect(ctx, 0, 26, 960, 6, '#b8a888');
      A.rect(ctx, 0, 410, 960, 30, '#6a5238');
      A.planks(ctx, 0, 440, 960, 160, '#8a6a48', 14, false, 3);
      ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(0, 440, 960, 8);
      ctx.fillStyle = A.grad(ctx, 0, 440, 0, 600, ['rgba(0,0,0,0)', 'rgba(0,0,0,0.25)']); ctx.fillRect(0, 440, 960, 160);
      // Tür zur Straße
      A.door(ctx, 24, 220, 66, 200, '#5a3e28', { panel: true, frame: '#3a2a1a' });
      A.rect(ctx, 20, 196, 74, 18, '#3a2a1a'); A.text(ctx, 'AUSGANG', 57, 209, { font: 'bold 9px Georgia', color: '#e8d8a0', align: 'center' });
      // Zettelkasten
      A.rect(ctx, 118, 226, 154, 190, '#5a3f28'); A.rect(ctx, 114, 222, 162, 8, '#6a4f38');
      for (let r = 0; r < 6; r++) for (let c = 0; c < 4; c++) { const x = 124 + c * 37, y = 236 + r * 29; A.rr(ctx, x, y, 33, 24, 2, '#7a5a3a'); A.rect(ctx, x + 6, y + 6, 21, 8, '#efe4c8'); A.circle(ctx, x + 16, y + 18, 2.5, '#c8a848'); }
      A.rr(ctx, 168, 186, 54, 40, 4, '#8a8a80'); A.ell(ctx, 195, 190, 14, 10, '#8a8a80'); A.rect(ctx, 176, 176, 38, 12, '#7a7a70');
      // Regale II/III und IV
      A.shelf(ctx, 300, 40, 220, 372, '#5a3f28', 7, 21);
      A.shelf(ctx, 690, 40, 200, 372, '#5a3f28', 7, 23);
      A.rr(ctx, 380, 44, 60, 18, 3, '#e8dcc0'); A.text(ctx, 'II · III', 410, 57, { font: 'bold 11px Georgia', color: '#3a2a1a', align: 'center' });
      A.rr(ctx, 760, 44, 60, 18, 3, '#e8dcc0'); A.text(ctx, 'IV', 790, 57, { font: 'bold 11px Georgia', color: '#3a2a1a', align: 'center' });
      for (let i = 0; i < 7; i++) A.text(ctx, String(7 - i), 884, 74 + i * 53, { font: '9px Georgia', color: '#c8b890', align: 'right' });
      if (g.flag('bericht_genommen')) A.rect(ctx, 830, 48, 30, 40, A.shade('#5a3f28', -0.55));
      // Leiter auf Schiene
      A.rect(ctx, 690, 38, 200, 6, '#3a2a1a');
      ctx.save(); ctx.translate(786, 412); ctx.rotate(-0.06); A.ladder(ctx, -22, -368, 368, '#a08050', 38); ctx.restore();
      // Fenster mit Licht
      A.window(ctx, 548, 44, 108, 160, { frame: '#e8e0d0', light: A.grad(ctx, 0, 44, 0, 204, ['#dfeefa', '#b8d4ea']) });
      A.rect(ctx, 540, 204, 124, 8, '#e8e0d0');
      A.lightBeam(ctx, 560, 204, 200, 240, 'rgba(255,240,200,0.2)');
      // Gerahmter Papyrus
      A.rect(ctx, 540, 226, 124, 70, '#3a2a1a'); A.rect(ctx, 546, 232, 112, 58, '#d8c8a0'); A.hieroglyphs(ctx, 552, 238, 100, 48, 'rgba(60,40,20,0.7)', 31);
      // Aminas Schreibtisch
      A.table(ctx, 520, 340, 160, 30, '#5a3f28', 70); A.rect(ctx, 520, 370, 160, 40, '#4a3220');
      A.rect(ctx, 530, 322, 40, 20, '#efe4c8'); A.rect(ctx, 536, 318, 40, 20, '#f4ecd8'); A.rr(ctx, 600, 318, 50, 22, 3, '#2a3a5a'); A.rr(ctx, 606, 312, 50, 22, 3, '#7a2e2e');
      A.rect(ctx, 660, 300, 6, 40, '#3a3a3a'); A.rr(ctx, 640, 292, 46, 14, 7, '#2e6a4a'); A.glow(ctx, 663, 310, 50, 'rgba(255,230,150,0.6)', 0.4);
      A.rect(ctx, 574, 330, 14, 10, '#3a2a1a'); A.circle(ctx, 581, 328, 4, '#8a8a8a');
      // Lesetisch mit Buch
      A.table(ctx, 318, 372, 150, 22, '#6a4f38', 52); A.chair(ctx, 300, 430, 30, '#5a3f28');
      A.rect(ctx, 360, 356, 56, 20, '#efe4c8'); A.rect(ctx, 388, 356, 2, 20, '#8a7a5a'); A.line(ctx, 366, 362, 384, 362, '#555', 1); A.line(ctx, 366, 367, 382, 367, '#555', 1); A.line(ctx, 394, 362, 410, 362, '#555', 1);
      A.rr(ctx, 424, 352, 30, 22, 2, '#7a2e2e');
      // Hoftür
      A.door(ctx, 908, 240, 46, 176, '#4a3a2a', { frame: '#3a2a1a', planks: true });
      A.text(ctx, 'HOF', 931, 232, { font: 'bold 9px Georgia', color: '#3a2a1a', align: 'center' });
      A.rug(ctx, 200, 500, 440, 70, '#2f4f6a', '#c9a86a');
      A.vignette(ctx, 960, 600, 0.45); A.grain(ctx, 960, 600, 5, 0.04);
    },
    animate(ctx, t) { A.dust(ctx, 560, 210, 180, 220, t, 22); },
    hotspots: [
      { id: 'zettelkasten', name: 'Zettelkasten', rect: [114, 176, 162, 240], at: [195, 468, 'u'],
        look: (g) => g.flag('karte_fehlt') ? 'Der Zettelkasten. In der Schublade Sais fehlt eine Karte.' : 'Ein Zettelkasten aus Eichenholz, vierundzwanzig Schubladen. Alles, was das Institut besitzt, steht hier auf Karten. Was es nicht besitzt, auch.',
        use: useCatalog, open: (g) => g.hs('zettelkasten').use(g), take: 'Vierundzwanzig Schubladen. Amina würde es bemerken.', push: 'Er ist schwerer als ich.' },
      { id: 'bueste', name: 'Büste', rect: [166, 172, 60, 54], at: [195, 468, 'u'], look: 'Eine Gipsbüste auf dem Zettelkasten. Ein Pharao ohne Nase. Sie haben alle keine Nase, das ist bei Gips so.', take: 'Gips. Wertlos, und Amina hängt daran.' },
      { id: 'regal23', name: 'Regal II und III', rect: [300, 40, 220, 372], at: [410, 468, 'u'], look: 'Griechische und römische Autoren, dann die Reiseberichte des 19. Jahrhunderts. Alles, was über Ägypten geschrieben wurde, bevor jemand graben ging.', use: 'Ich suche keinen Reisebericht. Ich suche einen Grabungsbericht.', take: 'Bücher bleiben im Haus.' },
      { id: 'regal4', name: 'Regal IV', rect: [690, 40, 200, 372], at: [786, 468, 'u'],
        look: (g) => g.flag('bericht_genommen') ? 'Regal IV. Grabungsberichte aus dem Delta. Fach 7 hat jetzt eine Lücke, die ich verursacht habe.' : 'Regal IV. Grabungsberichte aus dem Delta, nach Jahr geordnet. Fach 7 ist ganz oben, unter der Decke.' + (g.has('katalogkarte') ? ' Da muss ich hinauf.' : ''),
        use: climbShelf, take: climbShelf, open: climbShelf,
        useWith: { katalogkarte: climbShelf, default: 'Das gehört nicht ins Regal.' } },
      { id: 'leiter', name: 'Leiter', rect: [756, 44, 60, 368], at: [786, 468, 'u'],
        look: 'Eine Leiter auf einer Schiene, wie in jeder Bibliothek, die etwas auf sich hält. Sie steht an Regal IV.',
        use: climbShelf, take: 'Sie läuft auf einer Schiene. Und Amina würde mich mit der Leiter erschlagen.', push: 'Sie steht am richtigen Regal.', pull: 'Sie steht am richtigen Regal.' },
      { id: 'fenster', name: 'Fenster', rect: [544, 40, 116, 170], at: [600, 468, 'u'], look: 'Ein hohes Fenster. Draußen ein Hof mit einem Feigenbaum und einem Mann, der nichts tut.', open: 'Zu hoch. Und die Bibliothek mag keinen Wind.' },
      { id: 'papyrus', name: 'Papyrus im Rahmen', rect: [540, 226, 124, 70], at: [600, 468, 'u'], look: async (g) => { await g.say('falk', 'Ein Stück Papyrus unter Glas. Ein Totenbuch, Spruch 125: das Herz auf der Waage, Thot mit der Schreibpalette, Ammit, die wartet.'); g.codex('maat'); } },
      { id: 'schreibtisch', name: 'Aminas Schreibtisch', rect: [520, 290, 170, 120], at: [600, 468, 'u'], look: 'Aminas Schreibtisch. Ein Stempel, ein Ausleihbuch, in dem seit Wochen niemand steht, und eine Lampe mit grünem Schirm.', open: 'Amina sieht her.', take: 'Amina sieht her.', use: 'Amina sieht her.' },
      { id: 'lesetisch', name: 'Lesetisch', rect: [318, 348, 150, 46], at: [390, 468, 'u'], look: 'Ein Lesetisch. Livias Notizen, ein Bleistift, und ein Buch, das sie aufgeschlagen liegen gelassen hat.', use: 'Ich setze mich nicht. Sitzen ist für Leute, die Zeit haben.' },
      { id: 'buch', name: 'Aufgeschlagenes Buch', rect: [356, 350, 64, 28], at: [390, 468, 'u'],
        look: async (g) => { await g.say('falk', 'Champollions Grammatik, in der Ausgabe von 1836. Livia hat sie aufgeschlagen bei den Zeichen für Sonne, Wasser und Rind.'); await g.say('falk', 'Champollion hat die Schrift 1822 gelesen, mit dem Stein von Rosette. Seither kann sie jeder lesen, der zehn Jahre Zeit hat.'); g.codex('hieroglyphen'); },
        take: 'Bücher bleiben im Haus. Und Livia würde es merken.', use: (g) => g.hs('buch').look(g), open: (g) => g.hs('buch').look(g) },
    ],
    exits: [
      { id: 'tuer', name: 'Tür zur Straße', rect: [18, 196, 78, 224], at: [57, 462, 'u'], to: 'eg_harbor', pos: [270, 470], dir: 'd', look: 'Die Tür zur Gasse, die zum Hafen hinunterführt.', open: (g) => g.travel(g.hs('tuer')) },
      { id: 'hoftuer', name: 'Hoftür', rect: [902, 232, 58, 190], at: [931, 462, 'u'], to: 'eg_bazaar', pos: [524, 470], dir: 'd', look: 'Eine schmale Tür in den Hof. Von dort kommt man in die Gasse zum Basar, sagt Amina.', open: (g) => g.travel(g.hs('hoftuer')) },
    ],
    actors: [
      { id: 'amina', x: 700, y: 466, dir: 'l', at: [640, 500, 'r'], look: 'Amina, die Bibliothekarin. Brille, Bleistift im Haar, und ein Blick, der Bücher zählt.',
        talk: (g) => g.dialog('eg_amina'),
        giveWith: {
          bericht: async (g) => { await g.say('amina', 'Behalten Sie ihn, bis Sie fertig sind. Aber er kommt zurück. Alles kommt zurück.'); },
          katalogkarte: async (g) => { await g.say('amina', 'Die Karte. Sie haben sie also gefunden.'); await g.say('falk', 'Gekauft. Sie war teurer als der Bericht.'); await g.say('amina', 'Stecken Sie sie wieder in den Kasten, wenn Sie oben waren. Sonst stiehlt sie der Nächste.'); },
          muenzen: async (g) => { await g.say('amina', 'Das Institut nimmt Spenden. Aber nicht in Münzen, und nicht von Leuten, die Papier wollen.'); },
          default: async (g) => { await g.say('amina', 'Das gehört nicht in eine Bibliothek.'); },
        } },
      { id: 'livia', x: 390, y: 470, dir: 'd', at: [450, 500, 'l'], cond: (g) => !g.flag('livia_in_sais'), look: 'Livia, zwischen Solon und Strabon. Sie liest, wie andere Leute atmen.',
        talk: (g) => g.dialog('eg_livia_lib'),
        giveWith: {
          bericht: async (g) => { await g.say('livia', 'Die Statue blickt auf die Vertiefung. Und die Randnotiz: „Wenn sie etwas aufgeschrieben haben, dann unten.“ Adrian, das ist von 1911. Jemand hat es damals schon gewusst.'); await g.say('falk', 'Und die Grabung abgebrochen. Geldmangel.'); await g.say('livia', 'Das sagt man immer, wenn man nicht sagen will, was man gefunden hat.'); },
          katalogkarte: async (g) => { await g.say('livia', 'Regal IV, Fach 7. Die Leiter ist gleich daneben. Ich halte sie nicht, ich habe schon einmal eine Leiter für dich gehalten.'); },
          medaillon: async (g) => { await g.say('livia', 'Behalte es. Bei dir ist es sicherer als bei mir, hat sich herausgestellt.'); },
          default: async (g) => { await g.say('livia', 'Nein danke. Ich habe genug zu tragen.'); },
        } },
    ],
    async enter(g) {
      if (g.flag('bib_besucht')) return;
      g.set('bib_besucht');
      await g.say('falk', 'Bücher bis zur Decke, eine Leiter, ein Zettelkasten. Und es riecht wie in jeder Bibliothek der Welt: nach Staub, der Geduld hat.');
    },
  });

  ATL.dialogs.define('eg_amina', {
    nodes: {
      root: {
        say: (g) => g.flag('amina_begruesst') ? [] : (g.set('amina_begruesst'), [['amina', 'Das Institut ist Lesern offen. Bücher bleiben im Haus.']]),
        options: [
          { text: 'Ich suche den Bericht über die Grabung von Sais, 1911.', cond: (g) => !g.flag('karte_fehlt'), say: [['amina', 'Wenn wir ihn haben, steht er im Zettelkasten. Schublade Sais. Alles, was wir haben, steht im Kasten.'], ['falk', 'Und was Sie nicht haben?'], ['amina', 'Steht auch im Kasten. Mit einem Vermerk.']] },
          { text: 'Im Zettelkasten fehlt die Karte zu Sais 1911.', cond: (g) => g.flag('karte_fehlt') && !g.flag('amina_farid_hinweis'),
            say: [['amina', 'Fehlt?'], ['falk', 'Zwischen Topographie und Münzfunden ist eine Lücke.'], ['amina', 'Vor zwei Wochen war ein Mann hier. Schwarzer Mantel, bei dreißig Grad. Hat nach Sais gefragt und den halben Tag am Kasten gestanden.'], ['falk', 'Und die Karte mitgenommen.'], ['amina', 'Ich hätte es ihm nicht zugetraut. Er sah aus wie jemand, der Karten schreibt, nicht wie einer, der sie stiehlt.'], ['amina', 'Wenn Papier aus diesem Haus verschwindet, taucht es bei Farid im Basar auf. Farid kauft alles. Auch Papier.']],
            action: async (g) => { g.set('amina_farid_hinweis'); g.objective('Die fehlende Katalogkarte beschaffen. Amina sagt: Farid im Basar kauft alles.'); } },
          { text: 'Ich habe die Karte. Regal IV, Fach 7.', cond: (g) => g.has('katalogkarte') && !g.flag('bericht_genommen'), once: true, say: [['amina', 'Fach 7 ist ganz oben. Die Leiter steht am Regal. Fallen Sie nicht, ich habe kein Formular dafür.']] },
          { text: 'Haben Sie Papier und Kohle? Ich möchte Inschriften abreiben.', cond: (g) => g.has('bericht') && !g.flag('papier_erhalten'),
            say: [['amina', 'Papier haben wir. Kohle auch, die Zeichner lassen sie überall liegen.'], ['amina', 'Hier. Und wenn Sie etwas abreiben, schicken Sie uns eine Kopie. Das ist der Preis.'], ['falk', 'Abgemacht.']],
            action: async (g) => { g.take('papier'); g.take('kohle'); g.set('papier_erhalten'); g.objective('Mit Hassan nach Sais fahren. Bericht, Spaten, Lampe, Papier und Kohle sind an Bord.'); } },
          { text: 'Haben Sie Papier und Kohle? Für Inschriften.', cond: (g) => !g.has('bericht') && !g.flag('papier_erhalten'), once: true, say: [['amina', 'Welche Inschriften?'], ['falk', 'Die, die ich noch nicht gefunden habe.'], ['amina', 'Kommen Sie wieder, wenn Sie wissen, was Sie abreiben wollen. Papier ist teuer.']] },
          { text: 'Was ist das für ein Institut?', once: true, say: [['amina', 'Das Altertumsinstitut. Gegründet von Leuten, die fanden, Alexandria brauche wieder eine Bibliothek.'], ['falk', 'Die letzte ist nicht gut ausgegangen.'], ['amina', 'Deshalb bleiben die Bücher im Haus.']] },
          { text: 'Danke, Amina.', end: true, say: [['amina', 'Leise, bitte.']] },
        ],
      },
    },
  });

  const libHint = (g) => {
    if (!g.flag('karte_fehlt')) return [['livia', 'Der Zettelkasten. Wenn es einen Bericht über die Grabung von 1911 gibt, steht er dort. Schublade Sais.']];
    if (!g.has('katalogkarte') && !g.flag('bericht_genommen')) return g.flag('amina_farid_hinweis') ? [['livia', 'Farid im Basar. Amina sagt, er kauft alles. Dann verkauft er auch alles. Nimm etwas mit, das er haben will.'], ['falk', 'Ich habe Kleingeld.'], ['livia', 'Dann nimm etwas anderes mit.']] : [['livia', 'Jemand hat die Karte herausgenommen. Frag Amina, wer hier war. Sie sitzt am Eingang, sie sieht alles.']];
    if (!g.flag('bericht_genommen')) return [['livia', 'Regal IV, Fach 7. Ganz oben. Die Leiter steht da. Ich nicht.']];
    if (!g.flag('papier_erhalten')) return [['livia', 'Wenn unter Sais etwas geschrieben steht, will ich es lesen können. Frag Amina nach Papier und Kohle.']];
    if (!g.flag('hassan_angeheuert')) return [['livia', 'Ein Boot. Am Hafen lehnt ein Mann an einem Poller, der aussieht, als hätte er eins.']];
    return [['livia', 'Sais. Worauf wartest du? Auf mich? Ich komme mit.']];
  };
  ATL.dialogs.define('eg_livia_lib', {
    nodes: {
      root: {
        say: (g) => g.flag('livia_lib_begruesst') ? [] : (g.set('livia_lib_begruesst'), [['livia', 'Adrian. Staub, Karteikarten, kein Fenster, das aufgeht. Ich bin zu Hause.']]),
        options: [
          { text: 'Was machen wir als Nächstes?', say: libHint },
          { text: 'Erzähl mir von Sais.', once: true, say: [['livia', 'Sais war die Stadt der Neith. Im sechsten Jahrhundert vor Christus Hauptstadt Ägyptens, unter den Königen der 26. Dynastie.'], ['livia', 'Solon kam dorthin, sagt Platon, und ein Priester sagte ihm, die Griechen seien immer Kinder, weil sie nichts aufschrieben. Die Ägypter hätten alles aufgeschrieben.'], ['falk', 'Und das glaubst du.'], ['livia', 'Ich glaube, dass jemand etwas aufgeschrieben hat. Deshalb sind wir hier.']], action: async (g) => { g.codex('solon'); g.codex('neith'); } },
          { text: 'Warum eigentlich Alexandria?', once: true, say: [['livia', 'Weil man von hier ins Delta kommt. Und weil das die Stadt ist, die einmal alle Bücher der Welt hatte.'], ['falk', 'Und sie verbrannt hat.'], ['livia', 'Das sagt man. Die Quellen geben das nicht her. Sie ist verschwunden, Stück für Stück, wie der Leuchtturm.']], action: async (g) => { g.codex('pharos'); } },
          { text: 'Bis später.', end: true, say: [['livia', 'Ich bin hier. Zwischen Solon und Strabon.']] },
        ],
      },
    },
  });

  // ---------------------------------------------------------------- Sais
  async function digSenke(g) {
    await g.scene(async () => {
      await g.walk('falk', 640, 522, 'u');
      g.hero.anim = 'crouch';
      for (let i = 0; i < 3; i++) { g.fx('stone'); await g.wait(500); }
      await g.message('Falk gräbt. Der Sand rutscht nach, aber nach einer Stunde stößt der Spaten auf Stein.', 3000);
      g.hero.anim = 'stand';
      g.set('freigelegt'); g.repaint();
      await g.walk('falk', 566, 508, 'r');
      await g.say('falk', 'Eine Steinplatte, schräg in den Hang gesetzt. Eine Tür. Und darauf, in den Stein gehauen: eine Waage.');
      await g.say('falk', 'Keine Klinke, kein Riegel. Zwei Schalen, beide voll Sand. Über der linken ein Herz, über der rechten eine Feder.');
      g.objective('Die Steintür öffnen. Auf ihr ist eine Waage mit zwei Schalen, darüber ein Herz und eine Feder.');
    });
  }
  async function sweepPans(g) {
    g.set('schalen_sauber'); g.repaint();
    await g.say('falk', 'Ich fege den Sand aus beiden Schalen. Für etwas anderes ist die Feder heute nicht zu haben.');
    await g.say('falk', 'Die Schalen sind leer. Die Waage steht schief. Sie wartet auf Gewicht.');
  }
  async function checkScale(g) {
    if (!(g.flag('feder_rechts') && g.flag('skarabaeus_links'))) return;
    await g.scene(async () => {
      g.fx('stone');
      await g.message('Der Balken senkt sich, hebt sich, findet die Mitte. Ein Klicken im Stein.', 2600);
      await g.wait(400);
      g.fx('door');
      g.set('tuer_offen'); g.repaint();
      await g.say('falk', 'Die Platte gleitet zur Seite. Dahinter Stufen, und Luft, die seit Jahrhunderten niemand geatmet hat.');
      await g.say('falk', 'Ein Stein gegen eine Feder, und die Waage steht gerade. Livia würde sagen: Das Herz ist leicht. Ich sage: Gegengewicht im Mechanismus.');
      g.codex('maat');
      g.objective('In den Tempel unter Sais hinabsteigen. Hassans Lampe mitnehmen.');
    });
  }
  const panCommon = {
    perle: 'Die Perle? Sie ist warm, und ich habe keine Ahnung, was eine ägyptische Waage damit anfängt. Nein.',
    medaillon: 'Livias Medaillon lege ich in keine Steinwaage.',
    flasche: 'Wasser in die Schale. Dann habe ich Schlamm statt Sand. Nein.',
    muenzen: 'Kleingeld auf die Waage des Totengerichts. Nicht einmal ich bin so zynisch.',
    taschenmesser: 'Das Messer wiegt mehr als eine Feder und weniger als ein Herz. Es passt nirgends.',
    schaufel: 'Ich könnte den Sand herausschaufeln. Mit einem Spaten, der breiter ist als die Schale. Nein.',
    default: 'Das gehört nicht in eine Waage.',
  };
  R({
    id: 'eg_sais', name: 'Ruinen von Sais', ambient: 'egypt',
    start: [250, 520, 'r'],
    walk: [[230, 446, 930, 446, 950, 585, 240, 585]],
    scale: { y0: 430, s0: 0.78, y1: 585, s1: 1.05 },
    paint(ctx, g) {
      const night = !!g.flag('eg_nacht');
      if (night) { A.sky(ctx, 960, 340, '#060a22', '#2a2a48'); A.stars(ctx, 960, 300, 240, 19); A.moon(ctx, 760, 90, 28); }
      else { A.sky(ctx, 960, 340, '#e88a50', '#f8dcb0'); A.sun(ctx, 150, 262, 38, '#ffd8a0'); A.clouds(ctx, 960, 120, 4, 6, 'rgba(255,220,190,0.5)'); }
      const d0 = night ? '#2a2438' : '#d8b478', d1 = night ? '#3a3040' : '#caa468', d2 = night ? '#4a4048' : '#c09a5c';
      A.dune(ctx, 960, 300, d0, 3, 26); A.dune(ctx, 960, 336, d1, 5, 30); A.dune(ctx, 960, 372, d2, 8, 22);
      // Palme und ferne Mauerreste
      A.palm(ctx, 860, 350, 100, 5);
      const brick = night ? '#3a3230' : '#a88a5a';
      A.poly(ctx, [400, 330, 420, 262, 470, 250, 520, 270, 560, 252, 600, 280, 660, 262, 700, 290, 740, 275, 790, 300, 820, 288, 860, 330], brick);
      ctx.save(); ctx.beginPath(); ctx.moveTo(400, 330); ctx.lineTo(420, 262); ctx.lineTo(470, 250); ctx.lineTo(520, 270); ctx.lineTo(560, 252); ctx.lineTo(600, 280); ctx.lineTo(660, 262); ctx.lineTo(700, 290); ctx.lineTo(740, 275); ctx.lineTo(790, 300); ctx.lineTo(820, 288); ctx.lineTo(860, 330); ctx.closePath(); ctx.clip();
      A.bricks(ctx, 400, 250, 460, 80, brick, 30, 10, 6, A.shade(brick, -0.3)); ctx.restore();
      // Boden
      ctx.fillStyle = A.grad(ctx, 0, 380, 0, 600, [night ? '#4a4048' : '#dcbd80', night ? '#1e1a24' : '#a8844e']); ctx.fillRect(0, 380, 960, 220);
      const r = ATL.U.rng(17);
      for (let i = 0; i < 180; i++) { const x = r() * 960, y = 400 + r() * 200; ctx.fillStyle = `rgba(${night ? '40,30,50' : '120,90,40'},${0.08 + r() * 0.12})`; ctx.fillRect(x, y, 6 + r() * 20, 1.5); }
      A.rock(ctx, 500, 400, 60, 30, night ? '#3a3238' : '#9a8a6a', 4); A.rock(ctx, 780, 420, 40, 24, night ? '#3a3238' : '#a09070', 7);
      // Nilarm und Hassans Boot links
      ctx.fillStyle = A.grad(ctx, 0, 470, 0, 600, [night ? '#0e1424' : '#5a7a6a', night ? '#050810' : '#2a4a3a']); A.poly(ctx, [0, 470, 200, 480, 230, 520, 240, 600, 0, 600], ctx.fillStyle);
      A.poly(ctx, [0, 462, 210, 474, 232, 512, 226, 520, 200, 486, 0, 476], night ? '#2a2830' : '#8a7a58');
      for (let i = 0; i < 12; i++) A.line(ctx, 40 + i * 15, 500 + i * 7, 60 + i * 15, 500 + i * 7, night ? 'rgba(200,220,255,0.15)' : 'rgba(255,255,255,0.18)', 1);
      A.boat(ctx, 40, 500, 150, '#6a4a2e', true);
      if (night) { A.lantern(ctx, 100, 500, 0, true); A.glow(ctx, 100, 488, 90, 'rgba(255,190,100,0.6)', 0.35); }
      // Statue der Neith (Torso)
      const st = night ? '#4a4450' : '#b8a888';
      A.rect(ctx, 250, 402, 100, 44, A.shade(st, -0.2)); A.rect(ctx, 246, 398, 108, 8, A.shade(st, -0.05));
      A.line(ctx, 275, 428, 289, 428, A.shade(st, -0.5), 3); A.line(ctx, 282, 418, 282, 438, A.shade(st, -0.5), 3); A.line(ctx, 311, 418, 325, 438, A.shade(st, -0.5), 3); A.line(ctx, 325, 418, 311, 438, A.shade(st, -0.5), 3);
      ctx.fillStyle = A.grad(ctx, 262, 0, 338, 0, [A.shade(st, -0.3), A.shade(st, 0.12), A.shade(st, -0.35)]);
      A.poly(ctx, [266, 402, 334, 402, 330, 330, 336, 300, 322, 268, 278, 268, 264, 300, 270, 330], ctx.fillStyle);
      A.poly(ctx, [278, 268, 322, 268, 318, 256, 306, 248, 292, 250, 282, 258], A.shade(st, -0.15));
      A.poly(ctx, [270, 300, 258, 320, 262, 336, 272, 330], A.shade(st, -0.25)); A.poly(ctx, [334, 300, 348, 318, 344, 334, 332, 330], A.shade(st, -0.25));
      A.hieroglyphs(ctx, 284, 336, 34, 60, 'rgba(40,30,20,0.35)', 44);
      // Senke oder Tür
      if (!g.flag('freigelegt')) {
        A.ell(ctx, 640, 478, 90, 30, night ? 'rgba(0,0,0,0.3)' : 'rgba(90,60,20,0.25)');
        A.ell(ctx, 640, 474, 70, 20, night ? 'rgba(0,0,0,0.2)' : 'rgba(90,60,20,0.18)');
      } else {
        A.poly(ctx, [560, 460, 720, 460, 740, 500, 540, 500], night ? '#2a2430' : '#b89460');
        A.rect(ctx, 586, 322, 116, 130, night ? '#3a3230' : '#8a7a5a');
        A.rect(ctx, 578, 314, 132, 12, night ? '#4a4240' : '#9a8a6a');
        if (g.flag('tuer_offen') && !g.flag('sand_faelle')) {
          A.rect(ctx, 594, 330, 100, 122, '#0a0806');
          for (let i = 0; i < 5; i++) A.rect(ctx, 598, 372 + i * 16, 92, 6, `rgba(120,100,70,${0.5 - i * 0.09})`);
          A.rect(ctx, 690, 330, 6, 122, night ? '#4a4240' : '#a89a7a');
        } else {
          A.rect(ctx, 594, 330, 100, 122, night ? '#4a4240' : '#a09070');
          const sc = night ? '#2a2420' : '#5a4a30';
          A.line(ctx, 644, 346, 644, 360, sc, 4); A.line(ctx, 606, 360, 682, 360, sc, 4);
          const tiltL = g.flag('skarabaeus_links') && !g.flag('feder_rechts') ? 6 : 0;
          if (g.flag('sand_faelle')) { A.ell(ctx, 618, 378, 8, 5, '#3a7a6a'); ctx.save(); ctx.translate(670, 376); ctx.rotate(-0.9); A.ell(ctx, 0, -8, 3.5, 10, '#d8d8d0'); ctx.restore(); }
          A.line(ctx, 610, 360, 618, 378 + tiltL, sc, 2); A.line(ctx, 626, 360, 618, 378 + tiltL, sc, 2); A.line(ctx, 662, 360, 670, 378, sc, 2); A.line(ctx, 678, 360, 670, 378, sc, 2);
          A.ell(ctx, 618, 382 + tiltL, 16, 6, sc); A.ell(ctx, 670, 382, 16, 6, sc);
          if (!g.flag('schalen_sauber')) { A.ell(ctx, 618, 378 + tiltL, 13, 4, '#d8b478'); A.ell(ctx, 670, 378, 13, 4, '#d8b478'); }
          if (g.flag('skarabaeus_links')) A.ell(ctx, 618, 378, 8, 5, '#3a7a6a');
          if (g.flag('feder_rechts')) { ctx.save(); ctx.translate(670, 376); ctx.rotate(-0.9); A.ell(ctx, 0, -8, 3.5, 10, '#f4f4f4'); ctx.restore(); }
          A.ell(ctx, 618, 342, 6, 5, sc); A.line(ctx, 614, 340, 618, 336, sc, 1.5); A.line(ctx, 622, 340, 618, 336, sc, 1.5);
          ctx.save(); ctx.translate(670, 341); ctx.rotate(-0.4); A.ell(ctx, 0, 0, 2.5, 8, sc); ctx.restore();
          A.hieroglyphs(ctx, 600, 398, 88, 48, `rgba(60,40,20,${night ? 0.6 : 0.4})`, 52);
        }
      }
      if (!night) { ctx.fillStyle = 'rgba(255,150,60,0.12)'; ctx.fillRect(0, 0, 960, 600); }
      A.vignette(ctx, 960, 600, night ? 0.6 : 0.35); A.grain(ctx, 960, 600, 11, 0.04);
    },
    animate(ctx, t, g) {
      A.waterAnim(ctx, 0, 480, 235, 120, t, g.flag('eg_nacht') ? 'rgba(200,220,255,0.08)' : 'rgba(255,255,255,0.1)');
      if (!g.flag('eg_nacht')) A.dust(ctx, 300, 380, 600, 200, t, 12, 'rgba(255,230,180,0.35)');
    },
    hotspots: [
      { id: 'statue', name: 'Statuentorso', rect: [244, 246, 112, 200], at: [300, 480, 'u'], walkToLook: true,
        look: async (g) => { await g.say('falk', 'Der Torso einer Statue. Eine Frau, die Krone abgeschlagen, die Arme fehlen. Auf dem Sockel zwei gekreuzte Pfeile über einem Schild.'); await g.say('falk', 'Neith. Und sie blickt nach Osten, auf die Senke im Sand. Der Bericht hatte recht.'); g.set('statue_gesehen'); g.codex('neith'); },
        use: 'Sie hat Erdbeben und Steinräuber überstanden. Mich übersteht sie auch.', push: 'Zwei Tonnen Granit. Nein.', take: 'Zwei Tonnen Granit. Nein.', talk: 'Sie hat seit zweitausend Jahren keinem geantwortet. Ich fange nicht damit an.',
        useWith: { default: 'Die Statue braucht nichts. Sie hat schon alles verloren.' } },
      { id: 'mauer', name: 'Umfassungsmauer', rect: [400, 246, 460, 88], at: [630, 470, 'u'], look: 'Reste der Umfassungsmauer. Lehmziegel, seit Jahrhunderten von den Bauern der Umgebung als Baumaterial abgetragen. Was übrig ist, reicht gerade für die Vorstellung.', take: 'Die Bauern waren schneller.', push: 'Der Wind hat mehr Geduld als ich.' },
      { id: 'duenen', name: 'Dünen', rect: [0, 280, 380, 100], at: [300, 470, 'u'], look: 'Dünen bis zum Horizont. Irgendwo darunter liegt eine Hauptstadt.', use: 'Ich habe einen Spaten, aber nicht so viel Zeit.' },
      { id: 'palme', name: 'Palme', rect: [820, 240, 80, 120], at: [860, 470, 'u'], look: 'Eine Dattelpalme, die einzige weit und breit. Sie weiß etwas über Wasser, das ich nicht weiß.' },
      { id: 'steine', name: 'Steinbrocken', rect: [496, 396, 68, 40], at: [530, 480, 'u'], look: 'Ein Block aus Kalkstein, an einer Kante geglättet. Ein Stück vom Tempel, das niemand tragen wollte.', take: 'Zu schwer. Und ich bin kein Steinräuber. Nicht bei Tageslicht.', push: 'Er liegt gut.' },
      { id: 'nil', name: 'Nilarm', rect: [0, 522, 236, 78], at: [250, 530, 'l'], look: 'Ein Arm des Nils, der von Rosette. Braun, langsam, voller Delta.', useWith: { flasche: 'Nilwasser. Nicht in meine Flasche.', default: 'Das werfe ich nicht in den Nil.' }, use: 'Ich habe nicht vor zu schwimmen. Hier gibt es Krokodile, sagt Hassan. Er sagt viel.', take: 'Wasser nehme ich nicht mit. Nicht dieses.' },
      { id: 'senke', name: 'Senke im Sand', rect: [550, 440, 180, 70], at: [640, 522, 'u'], cond: (g) => !g.flag('freigelegt'),
        look: (g) => (g.flag('statue_gesehen') || g.has('bericht')) ? 'Eine flache Senke im Sand, genau dort, wohin die Statue blickt. Der Wind hat sie ausgeblasen, oder etwas darunter hält den Sand fest.' : 'Eine flache Senke im Sand. Nichts Besonderes, wenn man nicht weiß, wonach man sucht.',
        use: 'Mit den Händen? Das dauert bis zum Winter.', take: 'Sand. Davon habe ich schon genug in den Schuhen.', open: 'Sand hat keine Tür. Jedenfalls keine sichtbare.',
        useWith: { schaufel: digSenke, flasche: 'Wasser in den Sand. Das Delta hat davon genug.', taschenmesser: 'Mit dem Taschenmesser graben. Nein.', default: 'Damit grabe ich nicht.' } },
      { id: 'tuer', name: 'Steintür', rect: [586, 322, 116, 130], at: [566, 508, 'r'], cond: (g) => g.flag('freigelegt') && !g.flag('tuer_offen'),
        look: 'Eine Tür aus Stein, ohne Griff. In der Mitte eine Waage: Balken, zwei Schalen, darüber ein Herz und eine Feder. Darunter eine Zeile Hieroglyphen, die ich nicht lesen kann.',
        open: 'Sie rührt sich nicht. Die Waage ist das Schloss.', push: 'Sie rührt sich nicht. Die Waage ist das Schloss.', pull: 'Nichts zum Ziehen.',
        useWith: { feder: (g) => g.hs('schale_r').useWith.feder(g), skarabaeus: (g) => g.hs('schale_l').useWith.skarabaeus(g), schaufel: 'Ich habe sie freigelegt. Aufbrechen werde ich sie nicht.', default: 'Das öffnet keine Tür. Die Waage öffnet sie.' } },
      { id: 'schale_l', name: 'Linke Schale', rect: [600, 364, 40, 30], at: [566, 508, 'r'], cond: (g) => g.flag('freigelegt') && !g.flag('tuer_offen'),
        look: (g) => g.flag('skarabaeus_links') ? 'Die linke Schale. Der Skarabäus liegt darin, das Herz.' : g.flag('schalen_sauber') ? 'Die linke Schale, leer. Über ihr ein Herz.' : 'Die linke Schale, voll Sand. Über ihr ein Herz.',
        take: (g) => g.flag('skarabaeus_links') ? 'Ich lasse ihn liegen. Die Waage braucht beides.' : 'Sand. Ich könnte ihn herausfegen, wenn ich etwas Passendes hätte.',
        useWith: Object.assign({}, panCommon, {
          feder: async (g) => { if (!g.flag('schalen_sauber')) return sweepPans(g); return 'Über dieser Schale ist ein Herz eingeritzt. Die Feder gehört auf die andere Seite.'; },
          skarabaeus: async (g) => { if (!g.flag('schalen_sauber')) return 'Die Schale ist voll Sand. Da geht nichts hinein, was nicht Sand ist.'; g.drop('skarabaeus'); g.set('skarabaeus_links'); g.repaint(); g.fx('stone'); await g.say('falk', 'Der Skarabäus in die linke Schale. Das Herz. Sie senkt sich.'); await checkScale(g); },
        }) },
      { id: 'schale_r', name: 'Rechte Schale', rect: [650, 364, 40, 30], at: [566, 508, 'r'], cond: (g) => g.flag('freigelegt') && !g.flag('tuer_offen'),
        look: (g) => g.flag('feder_rechts') ? 'Die rechte Schale. Die Feder liegt darin.' : g.flag('schalen_sauber') ? 'Die rechte Schale, leer. Über ihr eine Feder.' : 'Die rechte Schale, voll Sand. Über ihr eine Feder.',
        take: (g) => g.flag('feder_rechts') ? 'Ich lasse sie liegen. Die Waage braucht beides.' : 'Sand. Ich könnte ihn herausfegen, wenn ich etwas Passendes hätte.',
        useWith: Object.assign({}, panCommon, {
          feder: async (g) => { if (!g.flag('schalen_sauber')) return sweepPans(g); g.drop('feder'); g.set('feder_rechts'); g.repaint(); await g.say('falk', 'Die Feder in die rechte Schale. Sie wiegt nichts, aber der Balken bewegt sich.'); await checkScale(g); },
          skarabaeus: async (g) => { if (!g.flag('schalen_sauber')) return 'Die Schale ist voll Sand. Da geht nichts hinein, was nicht Sand ist.'; return 'Über dieser Schale ist eine Feder. Der Skarabäus ist das Herz, nicht die Feder. Farid hat wenigstens das richtig erklärt.'; },
        }) },
      { id: 'tuer_zu', name: 'Steintür', rect: [586, 322, 116, 130], at: [566, 508, 'r'], cond: (g) => g.flag('sand_faelle'),
        look: 'Die Tür ist wieder zu. Der Sand hat sie von innen zugeschoben. Was drin ist, bleibt drin.', open: 'Von außen nicht. Und ich habe da unten nichts vergessen.', push: 'Von außen nicht.', useWith: { default: 'Die Tür ist zu, und das ist gut so.' } },
    ],
    exits: [
      { id: 'boot', name: 'Hassans Boot', rect: [30, 430, 190, 90], at: [250, 522, 'l'], z: 2,
        look: 'Hassans Boot am Ufer. Hassan sitzt drin und tut nichts, so gründlich wie niemand sonst.',
        before: async (g) => { await sailBack(g); return false; } },
      { id: 'tempel', name: 'Treppe in den Tempel', rect: [586, 322, 116, 130], at: [644, 512, 'u'], z: 2, cond: (g) => g.flag('tuer_offen') && !g.flag('sand_faelle'), to: 'eg_temple', pos: [90, 500], dir: 'r',
        look: 'Stufen, die in den Sand hinabführen. Unten ist es dunkel.',
        before: async (g) => { if (!g.has('oellampe') && !g.flag('lampe_brennt') && !g.flag('tempel_besucht')) { await g.say('falk', 'Da unten ist es stockdunkel. Ich sollte Hassans Lampe dabeihaben, bevor ich hinuntergehe.'); await g.say('falk', 'Andererseits: Man sieht auch im Dunkeln, wie dunkel es ist.'); } return true; } },
    ],
    actors: [
      { id: 'livia', x: 400, y: 505, dir: 'r', at: [460, 520, 'l'], cond: (g) => g.flag('livia_in_sais'), look: (g) => g.flag('eg_nacht') ? 'Livia. Sie hat im Sand gesessen und gewartet, und sie sieht aus, als hätte sie nicht damit gerechnet, dass es länger dauert.' : 'Livia. Sie zeichnet die Mauerreste in ein Notizbuch, als könnten sie weglaufen.',
        talk: (g) => g.dialog('eg_livia_sais'),
        giveWith: {
          bericht: async (g) => { await g.say('livia', 'Ich habe ihn gelesen. Dreimal. Die Statue blickt auf die Vertiefung. Du hast den Spaten.'); },
          abrieb: async (g) => { await g.say('livia', 'Sonne, Wasser, Rind, Vogel. Und dazwischen Zeichen, die ich in einer Woche vielleicht hätte. Yusuf im Basar braucht eine Stunde.'); },
          uebersetzung: async (g) => { await g.say('livia', '„Wie die Welt geordnet ist.“ Sonne, Urwasser, Stier, Thot. Das ist keine Theologie, Adrian, das ist ein Schloss.'); },
          sonnensiegel: async (g) => { await g.say('livia', 'Behalte es bei dir. Ich habe schon ein Medaillon verloren und wiedergefunden. Einmal reicht.'); },
          solontext: async (g) => { await g.say('livia', 'Ich habe es gelesen. Knossos und Eridu. Wir reden gleich darüber.'); },
          medaillon: async (g) => { await g.say('livia', 'Behalte es. Bei dir ist es sicherer, hat sich herausgestellt.'); },
          default: async (g) => { await g.say('livia', 'Nein danke. Ich habe genug zu tragen.'); },
        } },
      { id: 'hassan', x: 120, y: 508, dir: 'r', at: [250, 522, 'l'], cond: (g) => g.flag('livia_in_sais'), look: 'Hassan im Boot. Er raucht und sieht dem Fluss zu.',
        talk: async (g) => { await g.dialog('eg_hassan_sais'); if (g.flag('hassan_ablegen')) { g.set('hassan_ablegen', false); await sailBack(g); } },
        giveWith: { default: async (g) => { await g.say('hassan', 'Behalten Sie es, Effendi. Ich habe alles, was ich brauche, und das Boot hat den Rest.'); } } },
    ],
    async enter(g) {
      if (g.flag('aus_schacht') && !g.flag('eg_fertig')) {
        await g.scene(async () => {
          await g.message('Nacht über dem Delta. Der Sand ist noch warm.', 2400);
          await g.say('falk', 'Das Seil nehme ich mit. Es hat sich bewährt.');
          await g.walk('livia', 700, 500, 'r');
          await g.say('livia', 'Adrian. Ich habe die Tür zugehen gehört. Von hier draußen klang es endgültig.');
          await g.say('falk', 'War es auch. Es gibt einen Schacht, und ich hatte ein Seil. Der Rest war Klettern.');
          await g.say('livia', 'Hast du es?');
          await g.say('falk', 'Eine Scheibe aus Gold, mit einer Sonne. Und die Abschrift einer Stele. Griechisch, aus Solons Zeit, oder aus der Zeit von jemandem, der so tun wollte.');
          await g.say('livia', 'Zeig.');
          await g.wait(600);
          await g.say('livia', 'Bevor ich das lese: Hassan sagt, am Hafen hat heute ein Mann nach uns gefragt. Ein Amerikaner und eine Frau, die Vorträge hält. Schwarzer Mantel.');
          await g.say('falk', 'Kessler. Er ist uns von New York aus gefolgt, und er weiß, wo Sais liegt, weil er den Bericht vor uns gelesen hat.');
          await g.say('livia', 'Dann ist es Zeit zu gehen. Aber erst das hier.');
          await g.say('livia', '„Das Siegel des Stiers ruht bei dem, der im Haus des Minos hinter dem Faden wartet.“ Das Haus des Minos ist Knossos. Hinter dem Faden: das Labyrinth.');
          await g.say('livia', '„Das Siegel der Flut ruht bei den Weisen, die aus dem Meer kamen, im Haus des süßen Wassers.“ Die Apkallu, die sieben Weisen. Und das Haus des süßen Wassers ist der Abzu, der Tempel des Enki in Eridu.');
          await g.say('falk', 'Kreta und der Irak. Du hast das alles im Kopf.');
          await g.say('livia', 'Ich habe es sechs Jahre im Kopf gehabt. Du hast in der Zeit Scherben gezählt.');
          await g.say('falk', 'Die Scherben waren wenigstens da.');
          await g.say('livia', 'Das hier auch.');
          g.codex('apkallu');
          g.set('eg_fertig');
          g.objective('Das Siegel des Stiers auf Kreta und das Siegel der Flut in Eridu finden.');
          await g.say('falk', 'Hassan bringt uns zurück. Und morgen früh gehen wir an Bord, bevor Kessler frühstückt.');
        });
        return;
      }
      if (!g.flag('sais_besucht')) {
        g.set('sais_besucht');
        await g.say('falk', 'Sais. Eine Hauptstadt, von der eine Palme übrig ist, ein paar Mauern und eine Statue ohne Kopf.');
        if (g.has('bericht')) await g.say('falk', 'Der Bericht sagt: Die Statue blickt auf eine Vertiefung. Sehen wir nach, wohin sie blickt.');
      }
    },
  });

  ATL.dialogs.define('eg_hassan_sais', {
    nodes: {
      root: {
        options: [
          { text: 'Zurück nach Alexandria.', end: true, say: [['hassan', 'Steigen Sie ein. Der Fluss läuft ohnehin in die Richtung.']], action: async (g) => { g.set('hassan_ablegen'); } },
          { text: 'Was wissen Sie über die Ruinen?', once: true, say: [['hassan', 'Die Leute im Dorf holen sich die Ziegel für ihre Häuser. Seit tausend Jahren. Deshalb ist so wenig übrig.'], ['hassan', 'Mein Onkel sagt, die Engländer haben 1911 eine Tür gefunden und wieder zugeschüttet. Mein Onkel sagt viel.']] },
          { text: 'Warten Sie hier.', end: true, say: [['hassan', 'Ich warte. Das Boot läuft nicht weg, und ich auch nicht.']] },
        ],
      },
    },
  });

  const saisHint = (g) => {
    if (g.flag('eg_fertig')) return [['livia', 'Kreta oder Eridu. Von Alexandria gehen Dampfer in beide Richtungen. Hassan bringt uns zurück, wann du willst.']];
    if (!g.flag('freigelegt')) return g.flag('statue_gesehen') ? [['livia', 'Die Statue blickt auf die Senke. Wir haben einen Spaten. Ich sehe nicht, was dich aufhält.']] : [['livia', 'Der Bericht: Die Statue blickt auf eine Vertiefung. Sieh dir die Statue an, dann weißt du, wohin sie sieht.']];
    if (!g.flag('tuer_offen')) return !g.flag('schalen_sauber') ? [['livia', 'Eine Waage in der Tür. Die Schalen sind voll Sand. Das Totengericht fängt offenbar mit Aufräumen an.']] : [['livia', 'Herz gegen Feder, Adrian. Das Herz links, die Feder rechts, so steht es über den Schalen. Du hast beides gekauft.']];
    if (!g.flag('abrieb_gemacht')) return [['livia', 'Da unten ist ein Tempel. Nimm die Lampe und sieh dir die Wände an. Wenn etwas geschrieben steht, reib es ab.']];
    if (!g.flag('inschrift_text')) return [['livia', 'Yusuf im Basar liest Hieroglyphen. Hassan fährt dich, so oft du willst. Er wird bezahlt, sagt er, irgendwann.']];
    if (!g.flag('tuer2_offen')) return [['livia', 'Re, Nun, Apis, Thot. Sonne, Wasser, Stier, Ibis. In dieser Reihenfolge, an der Tür unten.']];
    if (!g.has('sonnensiegel')) return [['livia', 'Die Kammer hinter der Tür. Wenn Solon hier war, dann dort. Und wenn das Siegel hier ist, dann auch.']];
    return [['livia', 'Zeit zu gehen.']];
  };
  ATL.dialogs.define('eg_livia_sais', {
    nodes: {
      root: {
        say: (g) => g.flag('livia_sais_begruesst') ? [] : (g.set('livia_sais_begruesst'), [['livia', 'Sais. Ich habe davon geträumt, seit ich lesen kann. Ich hatte es mir größer vorgestellt.']]),
        options: [
          { text: 'Was jetzt?', say: saisHint },
          { text: 'Erklär mir die Waage.', once: true, say: [['livia', 'Das Totengericht. Das Herz des Toten auf der einen Schale, die Feder der Maat auf der anderen. Maat ist Wahrheit, Ordnung, das, was richtig ist.'], ['livia', 'Ist das Herz schwerer als die Feder, frisst es Ammit. Ist es gleich schwer, darf der Tote weiter. Anubis bedient die Waage, Thot schreibt auf.'], ['falk', 'Und der Skarabäus?'], ['livia', 'Liegt auf dem Herzen und bittet es, den Mund zu halten. Spruch 30 des Totenbuchs. Die Ägypter waren Realisten.']], action: async (g) => { g.codex('maat'); } },
          { text: 'Und Thot?', once: true, say: [['livia', 'Thot schreibt das Ergebnis auf. Ibiskopf, Schreibpalette. Der Gott der Schrift, der Rechnung und des Mondes.'], ['livia', 'Wenn die Priester von Sais etwas aufgeschrieben haben, dann unter seinen Augen. Ich wäre nicht überrascht, wenn er da unten steht.'], ['falk', 'Ich wäre überrascht, wenn er es nicht täte.']], action: async (g) => { g.codex('thoth'); } },
          { text: 'Bis gleich.', end: true, say: (g) => [['livia', g.flag('eg_nacht') ? 'Ich warte am Boot. Beeil dich, ich habe keinen Mantel.' : 'Ich bin hier. Ich zeichne die Mauer, bevor die Bauern sie holen.']] },
        ],
      },
    },
  });

  // ---------------------------------------------------------------- Tempelhalle der Neith
  async function rubInscription(g) {
    if (g.flag('abrieb_gemacht')) return 'Den Abrieb habe ich schon gemacht.';
    if (!g.has('papier')) return 'Ich bräuchte Papier, das ich auflegen kann.';
    if (!g.has('kohle')) return 'Papier allein hilft nicht. Ich brauche etwas zum Reiben. Kohle.';
    await g.scene(async () => {
      await g.walk('falk', 480, 460, 'u');
      g.hero.anim = 'reach';
      await g.say('falk', 'Ich lege das Papier auf und reibe mit der Kohle darüber. Zeile für Zeile.');
      await g.wait(900);
      g.hero.anim = 'stand';
      g.drop('papier'); g.take('abrieb'); g.set('abrieb_gemacht');
      await g.say('falk', 'Vier Zeilen, sauber. Lesen kann ich sie nicht. Aber ich kenne jemanden, der es kann. Im Basar, mit Tinte an den Fingern.');
      g.objective('Die Inschrift übersetzen lassen. Yusuf im Basar von Alexandria liest Hieroglyphen.');
    });
  }
  async function useSymbolDoor(g) {
    if (g.flag('tuer2_offen')) return 'Sie ist offen.';
    const res = await g.puzzle('symbols', {
      title: 'Die vier Blöcke', symbols: SYMS, solution: SOLUTION, start: DOOR_START,
      text: g.flag('inschrift_text') ? 'Yusufs Übersetzung: „' + g.flag('inschrift_text') + '“ Klick auf einen Block dreht ihn weiter.' : 'Vier Blöcke, sechs Zeichen. Ohne die Inschrift lesen zu können, bleibt nur Raten. Klick auf einen Block dreht ihn weiter.',
    });
    if (res === true) {
      g.set('tuer2_offen'); g.fx('stone'); g.repaint();
      await g.say('falk', 'Die Blöcke rasten ein, einer nach dem anderen. Dahinter bewegt sich Stein.');
      await g.say('falk', 'Sonne, Wasser, Stier, Ibis. Die Welt, wie die Priester sie geordnet haben. Und eine Tür, die ihnen glaubt.');
      g.objective('Die Kammer hinter der Tür betreten.');
    } else if (res === 'wrong') {
      await g.say('falk', ATL.U.pick(['Die Blöcke springen zurück in ihre Ausgangsstellung. Falsche Reihenfolge.', 'Nichts. Ein Klicken, dann drehen sich die Blöcke von selbst zurück.', 'Die Tür hält nichts von meiner Weltordnung.']));
    } else await g.say('falk', 'Ich lasse die Blöcke, wie sie sind.');
  }
  const darkOnly = { look: 'Zu dunkel, um etwas zu erkennen.', use: 'Ich sehe die Hand vor Augen nicht.', take: 'Zu dunkel.', push: 'Zu dunkel.', pull: 'Zu dunkel.', open: 'Zu dunkel.' };
  R({
    id: 'eg_temple', name: 'Tempelhalle der Neith', ambient: 'egypt',
    start: [90, 500, 'r'],
    walk: [[70, 446, 900, 446, 930, 585, 40, 585]],
    scale: { y0: 430, s0: 0.78, y1: 585, s1: 1.05 },
    paint(ctx, g) {
      const lit = !!g.flag('lampe_brennt');
      A.stones(ctx, 0, 0, 960, 440, '#4a3a2a', 27, 56);
      A.rect(ctx, 0, 0, 960, 30, '#2a2018'); A.rect(ctx, 0, 30, 960, 8, '#5a4a38');
      A.hieroglyphs(ctx, 20, 44, 920, 26, 'rgba(200,170,110,0.25)', 33);
      A.floorTiles(ctx, 960, 440, 600, '#6a5a44', '#2a2018', 10, 480);
      ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(0, 440, 960, 8);
      // Treppe nach oben links
      A.rect(ctx, 0, 150, 116, 290, '#1a1410');
      A.stairs(ctx, 0, 440, 116, 8, 18, '#5a4a38', 'l');
      ctx.fillStyle = A.grad(ctx, 0, 150, 0, 300, ['rgba(255,220,170,0.28)', 'rgba(255,220,170,0)']); ctx.fillRect(4, 150, 108, 150);
      // Wandinschrift
      A.rect(ctx, 392, 140, 176, 200, '#3a2c1e'); A.rect(ctx, 400, 148, 160, 184, '#8a7a5c');
      ctx.fillStyle = '#c9a86a';
      for (let i = 0; i < 4; i++) { SYMS[i].draw(ctx, 420, 172 + i * 42, 12); A.hieroglyphs(ctx, 440, 160 + i * 42, 116, 24, 'rgba(50,35,20,0.75)', 61 + i); }
      A.line(ctx, 404, 152, 556, 152, 'rgba(50,35,20,0.5)', 2); A.line(ctx, 404, 328, 556, 328, 'rgba(50,35,20,0.5)', 2);
      // Säulen
      for (const x of [150, 350, 600]) A.column(ctx, x, 440, 400, 56, '#8a7050', 'egypt');
      // Thot
      A.statue(ctx, 250, 440, 210, '#7a6a58', 'ibis');
      A.rect(ctx, 236, 330, 10, 40, '#5a4a38'); A.rect(ctx, 232, 326, 18, 8, '#d8c8a0');
      // Tür mit vier Blöcken
      const open = g.flag('tuer2_offen');
      A.rect(ctx, 690, 186, 150, 254, '#2a2018');
      A.door(ctx, 704, 232, 122, 208, '#5a4a3a', { frame: '#7a6a58', planks: false, open, inside: '#06040a', knob: '#5a4a3a' });
      A.hieroglyphs(ctx, 700, 190, 130, 22, 'rgba(200,170,110,0.4)', 71);
      const cur = open ? SOLUTION : DOOR_START;
      for (let i = 0; i < 4; i++) { const bx = 706 + i * 30; A.rr(ctx, bx, 200, 26, 26, 3, '#3a2c1c', open ? '#e0b84a' : '#8a7350', 1.5); ctx.fillStyle = open ? '#ffe28a' : '#c9a86a'; SYMS[cur[i]].draw(ctx, bx + 13, 213, 8); }
      // Pfütze und Bodenplatte
      A.ell(ctx, 480, 520, 50, 12, 'rgba(60,80,90,0.5)');
      A.rect(ctx, 720, 446, 100, 6, 'rgba(0,0,0,0.3)'); A.rect(ctx, 720, 500, 100, 4, 'rgba(0,0,0,0.25)');
      if (lit) { A.glow(ctx, 480, 240, 260, 'rgba(255,170,70,0.5)', 0.35); A.glow(ctx, 250, 300, 160, 'rgba(255,170,70,0.4)', 0.25); }
      A.vignette(ctx, 960, 600, 0.6); A.grain(ctx, 960, 600, 15, 0.05);
    },
    animate(ctx, t, g) {
      if (!g.flag('lampe_brennt')) return;
      const h = g.hero; const f = 1 + Math.sin(t * 13) * 0.06 + Math.sin(t * 5.1) * 0.04;
      A.glow(ctx, h.x, h.y - 70 * h.scale, 250 * f, 'rgba(255,170,70,0.75)', 0.45);
      A.ell(ctx, h.x + 18 * h.scale * (h.dir === 'l' ? -1 : 1), h.y - 66 * h.scale, 3, 7 * f, 'rgba(255,220,120,0.9)');
    },
    hotspots: [
      { id: 'dunkel', name: 'Dunkelheit', rect: [120, 0, 840, 440], noWalk: true, cond: (g) => !g.flag('lampe_brennt'),
        look: 'Stockdunkel. Irgendwo tropft Wasser. Ohne Licht sehe ich nicht einmal die Hand vor Augen.',
        use: 'Ich sehe die Hand vor Augen nicht.', take: 'Zu dunkel.', push: 'Zu dunkel.', pull: 'Zu dunkel.', open: 'Zu dunkel.',
        useWith: { oellampe: (g) => lightLamp(g), kohle: 'Im Dunkeln zeichne ich nichts.', papier: 'Im Dunkeln nützt mir Papier nichts.', default: 'Ich sehe nicht, was ich womit benutze.' } },
      { id: 'thot', name: 'Statue mit Ibiskopf', rect: [210, 240, 80, 200], at: [250, 490, 'u'], cond: (g) => g.flag('lampe_brennt'),
        look: async (g) => { await g.say('falk', 'Ein Mann mit dem Kopf eines Ibis. Thot, der Schreiber der Götter. Er hält eine Palette, als wollte er mitschreiben.'); await g.say('falk', 'Livia hatte recht. Sie hat meistens recht, das ist das Anstrengende.'); g.codex('thoth'); },
        use: 'Er steht seit zweieinhalbtausend Jahren. Ich lasse ihn.', take: 'Er ist größer als ich und aus Stein.', push: 'Er rührt sich nicht. Das ist bei Göttern so.', talk: 'Er schreibt auf. Er antwortet nicht.', useWith: { default: 'Thot braucht nichts von mir. Er schreibt nur auf, dass ich es versucht habe.' } },
      { id: 'inschrift', name: 'Wandinschrift', rect: [392, 140, 176, 200], at: [480, 470, 'u'], cond: (g) => g.flag('lampe_brennt'),
        look: async (g) => { if (g.flag('abrieb_gemacht')) { await g.say('falk', 'Die Inschrift. Ich habe sie auf Papier.'); return; } await g.say('falk', 'Vier Zeilen, sauber in den Stein gehauen. Am Anfang jeder Zeile ein Zeichen: Sonnenscheibe, Wasser, ein Rind, ein Ibis.'); await g.say('falk', 'Für den Rest bräuchte ich Wochen. Oder Papier, Kohle und jemanden, der das kann.'); g.codex('hieroglyphen'); },
        use: (g) => g.hs('inschrift').look(g), take: 'Die Wand bleibt hier. Ich kann sie abreiben, wenn ich Papier und Kohle habe.',
        useWith: { papier: rubInscription, kohle: rubInscription, uebersetzung: 'Re, Nun, Apis, Thot. Die Wand sagt es, Yusuf hat es gelesen. Jetzt die Tür.', abrieb: 'Der Abrieb stimmt mit der Wand überein. Das habe ich auch erwartet.', default: 'Das hilft mir beim Lesen nicht.' } },
      { id: 'saeulen', name: 'Säulen', rect: [120, 40, 60, 400], at: [150, 470, 'u'], cond: (g) => g.flag('lampe_brennt'), look: 'Säulen mit Papyrusbündeln als Kapitell, bemalt, die Farbe fast weg. Sie tragen den Sand von Sais.', push: 'Wenn sie nachgibt, gibt alles nach.', use: 'Ich lehne mich nicht an tragende Teile.' },
      { id: 'saeule2', name: 'Säule', rect: [572, 40, 56, 400], at: [600, 470, 'u'], cond: (g) => g.flag('lampe_brennt'), look: 'Eine Säule. Auf der Rückseite hat jemand vor langer Zeit eingeritzt, dass er hier war. Griechisch. Es ist nicht Solon.', push: 'Sie hält.' },
      { id: 'pfuetze', name: 'Pfütze', rect: [430, 508, 100, 26], at: [480, 545, 'u'], cond: (g) => g.flag('lampe_brennt'), look: 'Eine Pfütze. Das Delta ist nie weit, auch nicht unter der Erde.', use: 'Ich trinke das nicht.', useWith: { flasche: 'Das kommt nicht in meine Flasche.', default: 'Das bleibt trocken.' } },
      { id: 'boden', name: 'Rillen im Boden', rect: [720, 446, 100, 58], at: [770, 520, 'u'], cond: (g) => g.flag('lampe_brennt'), look: 'Rillen im Boden vor der Tür, wie von etwas Schwerem, das hier bewegt wurde. Oft.', use: 'Rillen. Man kann sie ansehen, mehr nicht.' },
      { id: 'tuer', name: 'Tür mit vier Blöcken', rect: [690, 186, 150, 254], at: [764, 490, 'u'], cond: (g) => g.flag('lampe_brennt') && !g.flag('tuer2_offen'),
        look: (g) => 'Eine Tür aus Stein. Darüber vier Blöcke, die sich drehen lassen, jeder mit einem Zeichen.' + (g.flag('inschrift_text') ? ' Yusufs Übersetzung sagt, welche.' : g.flag('abrieb_gemacht') ? ' Die Inschrift an der Wand sagt vermutlich, welche. Ich kann sie nicht lesen.' : ' Die Inschrift an der Wand hat mit derselben Art Zeichen angefangen.'),
        use: useSymbolDoor, push: useSymbolDoor, open: useSymbolDoor, pull: 'Ziehen hilft nicht. Die Blöcke sind das Schloss.',
        useWith: { uebersetzung: async (g) => { await g.say('falk', 'Re, Nun, Apis, Thot. Sonne, Wasser, Stier, Ibis. Jetzt die Blöcke.'); await useSymbolDoor(g); }, abrieb: 'Der Abrieb zeigt die Zeichen. Er sagt mir nicht, in welcher Reihenfolge. Yusuf könnte es.', schaufel: 'Eine Steintür mit einem Klappspaten. Nein.', default: 'Die Blöcke sind das Schloss. Damit drehe ich sie nicht.' } },
    ],
    exits: [
      { id: 'treppe', name: 'Treppe nach oben', rect: [0, 150, 116, 290], at: [80, 490, 'l'], to: 'eg_sais', pos: [644, 522], dir: 'd', look: 'Die Treppe zurück ans Licht. Oben ist es Abend.' },
      { id: 'kammer', name: 'Offene Tür', rect: [690, 186, 150, 254], at: [764, 490, 'u'], cond: (g) => g.flag('tuer2_offen'), to: 'eg_crypt', pos: [110, 500], dir: 'r', look: 'Die Tür steht offen. Dahinter ein Raum, kleiner als die Halle, und ein Streifen Licht von oben.' },
    ],
    async enter(g) {
      g.dark = g.flag('lampe_brennt') ? 0.22 : 0.85;
      if (g.flag('tempel_besucht')) return;
      g.set('tempel_besucht');
      await g.say('falk', 'Stufen, dann ebener Boden. Und Dunkelheit, die man anfassen kann.');
      if (g.has('oellampe')) await g.say('falk', 'Hassans Lampe. Jetzt wäre der Moment.');
      else await g.say('falk', 'Ohne Licht komme ich hier keinen Schritt weiter. Hassan hatte eine Lampe im Boot.');
    },
    leave(g) { g.dark = 0; },
  });

  // ---------------------------------------------------------------- Kammer der Aufzeichnungen
  R({
    id: 'eg_crypt', name: 'Kammer der Aufzeichnungen', ambient: 'egypt',
    start: [110, 500, 'r'],
    walk: [[100, 446, 900, 446, 920, 585, 60, 585]],
    scale: { y0: 430, s0: 0.78, y1: 585, s1: 1.05 },
    paint(ctx, g) {
      const night = !!g.flag('eg_nacht'), shut = !!g.flag('sand_faelle');
      A.stones(ctx, 0, 0, 960, 440, '#5a4a3a', 29, 48);
      ctx.fillStyle = A.grad(ctx, 0, 0, 0, 160, ['rgba(0,0,0,0.6)', 'rgba(0,0,0,0)']); ctx.fillRect(0, 0, 960, 160);
      A.floorTiles(ctx, 960, 440, 600, '#7a6a52', '#2a2018', 10, 480);
      ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(0, 440, 960, 8);
      // Lichtschacht
      A.rect(ctx, 440, 0, 80, 70, '#1a1610'); A.rect(ctx, 448, 0, 64, 62, night ? '#0a1030' : '#3a4a70');
      A.rect(ctx, 446, 20, 68, 5, '#3a3028'); A.rect(ctx, 446, 42, 68, 5, '#3a3028');
      if (night) { ctx.save(); ctx.translate(448, 0); A.stars(ctx, 64, 60, 8, 2); ctx.restore(); }
      A.lightBeam(ctx, 456, 62, 120, 440, night ? 'rgba(200,210,255,0.1)' : 'rgba(220,225,255,0.22)');
      // Eingang links
      A.rect(ctx, 0, 220, 96, 220, '#1a1410');
      if (shut) { A.rect(ctx, 4, 224, 88, 216, '#6a5a48'); A.stones(ctx, 4, 224, 88, 216, '#6a5a48', 31, 30); A.poly(ctx, [0, 440, 140, 440, 110, 420, 60, 410, 0, 424], '#c8a868'); }
      else { ctx.fillStyle = A.grad(ctx, 0, 220, 0, 440, ['#0a0806', '#2a2018']); ctx.fillRect(6, 226, 84, 214); }
      A.rect(ctx, 92, 214, 10, 232, '#7a6a58'); A.rect(ctx, 0, 214, 102, 10, '#7a6a58');
      // Regale mit Papyri
      A.rect(ctx, 120, 120, 220, 300, '#3a2c1e');
      for (let r = 0; r < 5; r++) for (let c = 0; c < 4; c++) {
        const x = 128 + c * 52, y = 128 + r * 58;
        A.rect(ctx, x, y, 46, 52, '#1a1410');
        for (let k = 0; k < 3; k++) A.ell(ctx, x + 10 + k * 13, y + 40, 6, 6, k % 2 ? '#c8b080' : '#b8a070');
        for (let k = 0; k < 2; k++) A.ell(ctx, x + 16 + k * 13, y + 29, 6, 6, '#a89060');
      }
      A.rect(ctx, 120, 420, 220, 8, '#5a4a38');
      // Stele
      A.rr(ctx, 426, 150, 108, 280, 40, '#3a2c1e'); A.rr(ctx, 432, 156, 96, 274, 36, '#9a8a6a');
      ctx.fillStyle = A.grad(ctx, 432, 0, 528, 0, ['#8a7a5a', '#a89878', '#8a7a5a']); A.rr(ctx, 432, 156, 96, 274, 36, ctx.fillStyle);
      A.text(ctx, 'ΣΟΛΩΝ', 480, 190, { font: 'bold 13px Georgia', color: '#3a2c1e', align: 'center' });
      const lines = ['ΤΡΙΑ ΣΦΡΑΓΙΣΜΑΤΑ', 'ΤΗΝ ΠΥΛΗΝ ΦΥΛΑΣΣΕΙ', 'ΥΠΟ ΤΩΙ ΟΡΕΙ', 'ΤΩΙ ΚΑΙΟΜΕΝΩΙ', 'ΗΛΙΟΣ ΤΑΥΡΟΣ', 'ΚΑΤΑΚΛΥΣΜΟΣ', 'ΣΤΡΕΦΕ ΤΟΥΣ', 'ΚΥΚΛΟΥΣ', 'ΜΙΝΩΣ ΜΙΤΟΣ', 'ΑΠΚΑΛΛΟΥ ΑΨΟΥ', 'ΠΡΩΤΟΤΟΚΟΣ', 'ΔΙΔΥΜΟΣ'];
      lines.forEach((l, i) => A.text(ctx, l, 480, 212 + i * 17, { font: '9px Georgia', color: 'rgba(40,30,20,0.8)', align: 'center' }));
      A.rect(ctx, 410, 424, 140, 22, '#5a4a38');
      // Altar mit Siegel
      A.rect(ctx, 640, 360, 140, 80, '#6a5a48'); A.rect(ctx, 634, 354, 152, 10, '#7a6a58'); A.rect(ctx, 634, 432, 152, 10, '#5a4a38');
      A.hieroglyphs(ctx, 650, 372, 120, 48, 'rgba(40,30,20,0.4)', 81);
      if (!g.flag('siegel_genommen')) { A.glow(ctx, 710, 344, 90, 'rgba(255,210,100,0.8)', 0.45); A.ell(ctx, 710, 350, 26, 9, '#3a2c1e'); A.seal(ctx, 710, 342, 22, 'sun', '#e0b84a'); }
      else A.ell(ctx, 710, 350, 26, 9, '#3a2c1e');
      // Sand nach dem Fall
      if (shut) { A.dune(ctx, 300, 500, '#c8a868', 9, 30); A.poly(ctx, [700, 470, 960, 470, 960, 600, 660, 600], '#c8a868'); A.dune(ctx, 960, 560, 'rgba(200,168,104,0.6)', 12, 20); }
      A.vignette(ctx, 960, 600, 0.6); A.grain(ctx, 960, 600, 17, 0.05);
    },
    animate(ctx, t, g) {
      A.dust(ctx, 456, 70, 100, 380, t, 24, 'rgba(230,230,255,0.35)');
      if (g.flag('sand_faelle')) {
        ctx.fillStyle = 'rgba(220,190,120,0.7)';
        for (let i = 0; i < 40; i++) { const x = 60 + ((i * 173) % 880); const y = ((i * 53 + t * 260) % 470); ctx.fillRect(x, y, 2, 6); }
      }
      if (g.flag('lampe_brennt')) { const h = g.hero; A.glow(ctx, h.x, h.y - 70 * h.scale, 220, 'rgba(255,170,70,0.6)', 0.35); }
    },
    hotspots: [
      { id: 'stele', name: 'Stele', rect: [426, 150, 108, 296], at: [480, 490, 'u'],
        look: (g) => g.flag('stele_gelesen') ? 'Die Stele. Ich habe sie abgeschrieben. Griechisch, in einer Kammer unter einem ägyptischen Tempel. Solon war hier, oder jemand wollte, dass man das glaubt.' : 'Eine Stele aus hellem Stein, oben gerundet. Die Schrift ist griechisch, nicht ägyptisch. Das ist hier unten die größere Überraschung.',
        use: readStele, open: readStele, take: 'Sie ist in den Boden eingelassen. Ich schreibe ab, was draufsteht, das muss reichen.', push: 'Sie steht, seit Solon hier war. Ich rüttle nicht an ihr.',
        useWith: { papier: 'Griechisch kann ich lesen. Das schreibe ich ab, dafür brauche ich keinen Abrieb.', default: 'Die Stele will gelesen werden, nicht benutzt.' } },
      { id: 'regale', name: 'Regale mit Papyri', rect: [120, 120, 220, 308], at: [230, 490, 'u'],
        look: 'Papyrusrollen in Fächern, Hunderte. Die Aufzeichnungen der Priester der Neith. Alles, was sie aufgeschrieben haben, sagte der Priester zu Solon. Er hat nicht übertrieben.',
        take: 'Sie zerfallen, wenn ich sie anfasse. Das ist Arbeit für zehn Jahre und ein Institut, nicht für einen Mann mit einer Öllampe.', use: 'Ich rühre sie nicht an. Ich bin Archäologe, kein Plünderer. Meistens.', open: 'Eine Rolle zerbröselt zwischen zwei Fingern. Ich lasse den Rest.',
        useWith: { oellampe: 'Eine Lampe an zweitausend Jahre altem Papyrus. Nein.', default: 'Die Rollen bleiben, wo sie sind.' } },
      { id: 'altar', name: 'Altar', rect: [634, 354, 152, 90], at: [710, 490, 'u'],
        look: (g) => g.flag('siegel_genommen') ? 'Der Altar. Die Vertiefung, in der das Siegel lag, ist leer. Der Sand hat aufgehört zu rieseln, größtenteils.' : 'Ein Altar aus Stein, mit Hieroglyphen an der Vorderseite. Darauf, in einer Vertiefung, eine goldene Scheibe. Sie glänzt, als wäre gestern jemand hier gewesen.',
        push: 'Er ist aus dem Fels gehauen.', use: 'Ich opfere nichts.', useWith: { default: 'Das lege ich nicht auf einen Altar.' } },
      { id: 'siegel', name: 'Siegel der Sonne', rect: [682, 316, 56, 40], at: [710, 490, 'u'], cond: (g) => !g.flag('siegel_genommen'),
        look: 'Eine goldene Scheibe mit einer Sonne, acht Strahlen. Sie liegt in einer Vertiefung, die genau für sie gemacht ist. Das ist selten ein gutes Zeichen.',
        take: async (g) => {
          await g.scene(async () => {
            g.hero.anim = 'reach'; await g.wait(500);
            g.take('sonnensiegel'); g.set('siegel_genommen'); g.repaint();
            g.hero.anim = 'stand';
            await g.say('falk', 'Schwerer, als sie aussieht. Auf der Rückseite acht Kerben. Das Siegel der Sonne.');
            g.fx('stone');
            await g.message('Ein Knirschen in der Decke. Sand rieselt, erst dünn, dann in Strömen.', 2600);
            g.set('sand_faelle'); g.repaint(); g.fx('stone');
            await g.message('Die Steinplatte am Eingang fällt. Der Boden zittert, dann ist es still, bis auf den Sand.', 2800);
            await g.say('falk', 'Das war zu einfach. Ich hätte es wissen müssen.');
            await g.say('falk', 'Die Tür ist zu. Bleibt der Schacht in der Decke. Und ein Seil, das ich seit Vermont mit mir herumtrage.');
            g.objective('Einen Weg aus der Kammer finden. Der Lichtschacht in der Decke.');
          });
        },
        use: (g) => g.hs('siegel').take(g), push: 'Ich schiebe kein Gold herum. Ich nehme es oder lasse es.' },
      { id: 'lichtschacht', name: 'Lichtschacht', rect: [436, 0, 88, 76], at: [480, 500, 'u'],
        look: (g) => g.flag('eg_nacht') ? 'Ein Schacht in der Decke. Weit oben ein Stück Himmel mit Sternen. Quer darüber liegt etwas, ein Balken oder ein Gitter.' : 'Ein Schacht in der Decke, grob gehauen. Weit oben ein Stück Himmel, schon grau vom Abend. Quer darüber liegt etwas, ein Balken oder ein Gitter.',
        use: (g) => g.flag('sand_faelle') ? 'Zu hoch zum Springen. Ich bräuchte ein Seil. Ich habe ein Seil.' : 'Die Tür ist offen. Ich klettere nicht durch einen Schacht, wenn es eine Tür gibt.',
        useWith: {
          seil: async (g) => {
            if (!g.flag('sand_faelle')) return 'Die Tür ist offen. Ich klettere nicht durch einen Schacht, wenn es eine Tür gibt.';
            if (!g.flag('stele_gelesen')) { await g.say('falk', 'Bevor ich gehe: die Stele. Wer weiß, wann hier wieder jemand steht.'); await readStele(g); }
            await g.scene(async () => {
              await g.walk('falk', 480, 500, 'u');
              await g.say('falk', 'Das Seil hinauf. Oben liegt etwas quer über dem Schacht. Ein Balken, ein Gitter, oder Glück.');
              g.fx('whoosh'); await g.wait(500); g.fx('whoosh'); await g.wait(500); g.fx('whoosh'); await g.wait(400);
              await g.say('falk', 'Beim dritten Wurf bleibt es hängen.');
              g.hero.fixedScale = g.hero.scale;
              for (let i = 1; i <= 12 && !g.fast; i++) { g.hero.offsetY = -i * 30; await g.wait(120); }
              g.set('aus_schacht'); g.set('eg_nacht'); g.set('lampe_brennt', false);
              g.hero.offsetY = 0; g.hero.fixedScale = null;
              await g.goto('eg_sais', 790, 490, 'l');
            });
          },
          default: 'Das hilft mir nicht nach oben.',
        } },
      { id: 'sand', name: 'Rieselnder Sand', rect: [100, 80, 320, 60], noWalk: true, cond: (g) => g.flag('sand_faelle'), look: 'Sand rieselt aus Fugen in der Decke. Ein alter Mechanismus, oder einfach ein alter Tempel. Der Unterschied ist mir gerade gleichgültig.', use: 'Ich kann den Sand nicht aufhalten. Ich kann nur schneller sein.' },
      { id: 'tuer_zu', name: 'Verschlossener Eingang', rect: [0, 214, 102, 232], at: [110, 500, 'l'], cond: (g) => g.flag('sand_faelle'),
        look: 'Ein Block Stein, wo eben noch die Tür war. Zwei Männer würden ihn nicht bewegen. Ich bin einer.', open: 'Keine Chance.', push: 'Er rührt sich nicht. Nicht einen Millimeter.', pull: 'Nichts zum Ziehen.', useWith: { schaufel: 'Ich kann Sand schaufeln, keinen Stein.', seil: 'Das Seil zieht keinen Steinblock. Aber es trägt einen Mann. Der Schacht.', default: 'Damit bewege ich keinen Stein.' } },
    ],
    exits: [
      { id: 'tuer', name: 'Tür zur Halle', rect: [0, 214, 102, 232], at: [110, 500, 'l'], cond: (g) => !g.flag('sand_faelle'), to: 'eg_temple', pos: [740, 490], dir: 'l', look: 'Die Tür zurück in die Halle.' },
    ],
    async enter(g) {
      g.dark = g.flag('lampe_brennt') ? 0.1 : 0.4;
      if (g.flag('kammer_besucht')) return;
      g.set('kammer_besucht');
      await g.say('falk', 'Eine Kammer. Regale voller Papyrus, ein Altar, und in der Mitte eine Stele. Von oben fällt Licht durch einen Schacht.');
      await g.say('falk', 'Die Aufzeichnungen von Sais. Livia sollte das sehen. Livia wird das sehen, ob ich will oder nicht.');
      g.objective('Die Kammer untersuchen: die Stele, der Altar.');
    },
    leave(g) { g.dark = 0; },
  });
})(window.ATL);
