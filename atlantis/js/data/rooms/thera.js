/* Kapitel 6: Thera, Juni 1938. Vier Räume: Hafen von Fira, Bucht bei Akrotiri,
   die Ausgrabung mit dem schwarzen Tor, die Lavaröhre mit der Hebebühne. */
(function (ATL) {
  const A = ATL.A;
  const R = ATL.rooms.define;
  const SYM = () => ATL.puzzles.SYMBOLS;

  Object.assign(ATL.codex, {
    fresken: { title: 'Die Fresken von Akrotiri', origin: 'Archäologie von Santorin', text: 'In den Häusern von Akrotiri fanden die Ausgräber ab 1967 Wandmalereien, die unter dem Bimsstein fast unversehrt geblieben waren. Im sogenannten Westhaus zeigt ein schmaler Fries eine Flotte von Schiffen, die zwischen zwei Küstenstädten fährt, dazu Fischer mit ihrem Fang. Im Haus Delta blühen auf einer felsigen Landschaft rote Lilien, über denen Schwalben fliegen; das Bild heißt heute Frühlingsfresko. Aus anderen Gebäuden stammen boxende Knaben, Antilopen, blaue Affen und Frauen beim Safranpflücken.\nDie Malereien wurden auf Kalkputz ausgeführt, in Rot, Gelb, Blau, Schwarz und Weiß, und stehen der minoischen Kunst Kretas nahe. Menschliche Überreste wurden in der Siedlung nicht gefunden; die Bewohner hatten sie vor dem Ausbruch offenbar verlassen. Die meisten Fresken sind heute im Nationalmuseum in Athen und im Museum für prähistorisches Thera in Fira zu sehen.' },
  });

  // ---------------------------------------------------------------- Hafen von Fira
  const STEG_BLOCK = [660, 478, 950, 478, 950, 552, 660, 552];
  R({
    id: 'th_harbor', name: 'Hafen von Fira', ambient: 'thera',
    start: [200, 520, 'r'],
    walk: [[30, 368, 244, 368, 244, 466, 420, 466, 420, 424, 586, 424, 586, 478, 625, 478, 625, 585, 30, 585], [600, 490, 935, 490, 935, 542, 600, 542]],
    scale: { y0: 340, s0: 0.72, y1: 585, s1: 1.05 },
    paint(ctx, g) {
      // Himmel, Dunst, Horizont
      A.sky(ctx, 960, 300, '#8fb8e0', '#e6d9c4');
      A.sun(ctx, 860, 70, 26, '#fff4d0');
      A.clouds(ctx, 960, 120, 4, 6, 'rgba(255,255,255,0.45)');
      // Caldera: Wasser rechts, Vulkaninsel am Horizont
      A.sea(ctx, 640, 300, 320, 300, '#2f5f8a', '#0f2a44', 12);
      A.poly(ctx, [860, 300, 900, 284, 930, 288, 960, 296, 960, 302, 860, 302], '#3a3230');
      A.poly(ctx, [700, 300, 760, 292, 800, 296, 840, 300, 840, 303, 700, 303], '#5a4a48');
      // Jacht Meridian draußen
      A.ship(ctx, 700, 350, 150, '#3a3a44');
      A.rect(ctx, 762, 300, 3, 30, '#222'); A.poly(ctx, [765, 300, 785, 306, 765, 312], '#8a2a2a');
      A.text(ctx, 'MERIDIAN', 775, 364, { font: 'bold 8px Georgia', color: '#c8c8d0', align: 'center' });
      // Steilwand der Caldera: Schichten aus Asche, Bims und Lava
      const layers = [['#4a3a34', 60], ['#7a5a48', 110], ['#c9b89a', 150], ['#8a6a58', 185], ['#3a2e2a', 230], ['#a08878', 265], ['#2a2220', 310]];
      for (let i = 0; i < layers.length; i++) { const y0 = layers[i][1], y1 = i + 1 < layers.length ? layers[i + 1][1] : 360; A.poly(ctx, [0, y0, 640 - i * 6, y0 + 4, 660 - i * 4, y1 + 6, 0, y1 + 6], layers[i][0]); }
      const rk = ATL.U.rng(21);
      for (let i = 0; i < 70; i++) { const x = rk() * 620, y = 70 + rk() * 280; A.rock(ctx, x, y, 14 + rk() * 40, 8 + rk() * 18, ['#5a4a44', '#6a5048', '#3a302c', '#b8a890'][Math.floor(rk() * 4)], Math.floor(rk() * 90)); }
      ctx.fillStyle = A.grad(ctx, 0, 60, 0, 360, ['rgba(0,0,0,0)', 'rgba(20,10,10,0.45)']); ctx.fillRect(0, 60, 660, 300);
      // Fira oben auf dem Rand: weiße Würfel, blaue Kuppeln
      A.rect(ctx, 0, 52, 600, 12, '#e8e0d4');
      const hr = ATL.U.rng(8);
      for (let x = 0; x < 590; x += 34) { const h = 14 + hr() * 22; A.rect(ctx, x, 60 - h, 30, h, hr() < 0.5 ? '#f4f0e8' : '#e6e0d6'); A.rect(ctx, x + 10, 60 - h + 6, 6, 8, '#3a5a8a'); }
      for (const x of [120, 330, 470]) { A.circle(ctx, x, 34, 12, '#3a6aa8'); A.rect(ctx, x - 12, 34, 24, 26, '#f4f0e8'); A.rect(ctx, x - 2, 14, 4, 10, '#e8e0d4'); }
      // Eselspfad im Zickzack
      const seg = [[430, 350], [220, 300], [400, 250], [180, 200], [360, 150], [150, 100], [300, 62]];
      for (let i = 0; i + 1 < seg.length; i++) { A.line(ctx, seg[i][0], seg[i][1], seg[i + 1][0], seg[i + 1][1], '#c8b898', 5 - i * 0.4); A.line(ctx, seg[i][0], seg[i][1] + 2, seg[i + 1][0], seg[i + 1][1] + 2, 'rgba(0,0,0,0.25)', 2); }
      for (let i = 0; i < 40; i++) { const k = i / 40; A.rect(ctx, 430 - k * 210 + Math.sin(i) * 3, 350 - k * 50, 3, 1.5, 'rgba(0,0,0,0.3)'); }
      // Kai aus dunklem Vulkangestein
      A.stones(ctx, 0, 340, 640, 60, '#4a4240', 33, 22);
      A.ground(ctx, 0, 398, 640, 202, '#5a524c', '#2e2a28');
      A.floorTiles(ctx, 640, 400, 600, 'rgba(255,255,255,0)', 'rgba(255,255,255,0)', 9, 320);
      A.rect(ctx, 636, 340, 8, 260, '#2a2624');
      for (let y = 350; y < 600; y += 40) A.rect(ctx, 630, y, 12, 6, '#1a1614');
      // Kaimauer zum Wasser: Poller, Netze, Tauwerk
      for (const [x, y] of [[560, 560], [610, 420], [330, 575]]) { A.rr(ctx, x - 7, y - 18, 14, 18, 4, '#2a2624'); A.ell(ctx, x, y - 18, 7, 3, '#4a4440'); }
      A.rope(ctx, [560, 545, 600, 552, 640, 548], '#a89060', 2.5);
      A.ell(ctx, 470, 570, 60, 14, '#6a5a3a'); A.ell(ctx, 470, 570, 44, 9, '#8a7a4a'); for (let i = 0; i < 9; i++) A.line(ctx, 420 + i * 12, 560, 440 + i * 12, 582, '#4a3a22', 1);
      // Stavros' Boot am Kai
      A.boat(ctx, 660, 418, 150, '#7a5a3a', true);
      A.rect(ctx, 665, 396, 140, 12, '#4a6a8a'); A.rr(ctx, 770, 384, 34, 20, 4, '#5a5a5a'); A.text(ctx, 'ΑΓ. ΕΙΡΗΝΗ', 720, 445, { font: 'bold 8px Georgia', color: '#e8d8b0', align: 'center' });
      // Kiosk
      A.rect(ctx, 250, 330, 160, 130, '#6a5a3a'); A.rect(ctx, 256, 336, 148, 60, '#2a2018');
      A.poly(ctx, [240, 336, 420, 336, 412, 314, 248, 314], '#a03030'); for (let i = 0; i < 9; i++) A.rect(ctx, 248 + i * 20, 314, 10, 22, '#e8d8b0');
      A.rect(ctx, 256, 396, 148, 14, '#8a7a5a'); A.rect(ctx, 250, 410, 160, 50, '#5a4a30');
      for (let i = 0; i < 6; i++) A.rect(ctx, 262 + i * 24, 344, 18, 22, ['#f4efe0', '#b34a3a', '#e0b84a', '#4a7a5a', '#f4efe0', '#b34a3a'][i]);
      for (let i = 0; i < 4; i++) { A.rect(ctx, 262 + i * 14, 372, 8, 22, '#b34a3a'); A.line(ctx, 266 + i * 14, 372, 268 + i * 14, 366, '#888', 1); }
      A.rr(ctx, 336, 372, 60, 22, 3, '#3a6aa8'); A.text(ctx, 'ΚΑΠΝΟΣ', 366, 387, { font: 'bold 9px Georgia', color: '#f0e8d0', align: 'center' });
      A.rect(ctx, 414, 344, 34, 44, '#f4efe0'); A.rect(ctx, 416, 346, 30, 10, '#b34a3a'); A.text(ctx, 'ΠΑΝΗΓΥΡΙ', 431, 366, { font: 'bold 6px Georgia', color: '#2a2a2a', align: 'center' }); A.circle(ctx, 431, 378, 6, '#e0b84a');
      // Esel am Fuß des Pfads
      A.ell(ctx, 480, 396, 26, 13, '#7a6a5a'); A.rect(ctx, 458, 396, 5, 20, '#5a4a3a'); A.rect(ctx, 496, 396, 5, 20, '#5a4a3a'); A.rect(ctx, 468, 398, 5, 18, '#6a5a4a'); A.rect(ctx, 490, 398, 5, 18, '#6a5a4a');
      A.rr(ctx, 496, 372, 14, 22, 5, '#7a6a5a'); A.poly(ctx, [498, 372, 494, 358, 502, 370], '#6a5a4a'); A.poly(ctx, [508, 372, 512, 358, 510, 370], '#6a5a4a'); A.rect(ctx, 470, 384, 22, 8, '#a03030');
      // Kohlenbecken am Fuß des Stegs
      A.line(ctx, 596, 470, 604, 440, '#2a2a2a', 3); A.line(ctx, 626, 470, 618, 440, '#2a2a2a', 3); A.line(ctx, 611, 468, 611, 442, '#2a2a2a', 3);
      A.ell(ctx, 611, 440, 22, 8, '#3a3a3a'); A.rr(ctx, 589, 428, 44, 14, 6, '#4a4a4a');
      // Steg
      for (let x = 660; x < 940; x += 60) { A.rect(ctx, x, 540, 8, 40, '#3a2e22'); A.rect(ctx, x + 30, 486, 6, 20, '#3a2e22'); }
      A.planks(ctx, 640, 482, 300, 62, '#8a6a48', 4, false, 7);
      for (let x = 650; x < 940; x += 26) A.line(ctx, x, 482, x, 544, 'rgba(0,0,0,0.25)', 1.5);
      A.rect(ctx, 640, 480, 300, 4, '#a08058');
      // Beiboot der Meridian am Stegende
      A.poly(ctx, [846, 556, 950, 552, 944, 580, 852, 584], '#c8c8c0'); A.poly(ctx, [852, 558, 944, 556, 940, 570, 856, 572], '#3a4a5a');
      A.rect(ctx, 930, 536, 12, 24, '#2a2a2a'); A.rr(ctx, 926, 528, 20, 12, 3, '#3a3a3a'); A.rr(ctx, 866, 560, 20, 10, 2, '#8a2a2a');
      A.rope(ctx, [900, 540, 905, 556], '#a89060', 2);
      A.text(ctx, 'MERIDIAN', 890, 568, { font: 'bold 7px Georgia', color: '#2a2a2a', align: 'center' });
      // Fähranleger links
      A.rect(ctx, 0, 380, 70, 220, '#3a3634'); A.rect(ctx, 0, 376, 70, 6, '#5a5654');
      A.rr(ctx, 14, 400, 30, 40, 3, '#7a6a48'); A.text(ctx, 'ΠΟΡΘΜΕΙΟ', 29, 424, { font: 'bold 6px Georgia', color: '#2a2018', align: 'center' });
      A.vignette(ctx, 960, 600, 0.4);
      A.grain(ctx, 960, 600, 4, 0.04);
    },
    animate(ctx, t, g) {
      A.waterAnim(ctx, 640, 300, 320, 300, t, 'rgba(200,230,255,0.12)');
      const f = 1 + Math.sin(t * 9) * 0.15;
      A.glow(ctx, 611, 432, 40 * f, 'rgba(255,120,30,0.9)', 0.5);
      for (let i = 0; i < 5; i++) A.circle(ctx, 598 + i * 6, 430 + (i % 2) * 3, 3, i % 2 ? '#ff7a30' : '#ffb060');
      if (g.flag('kracher_brennen')) { for (let i = 0; i < 6; i++) { const a = t * 20 + i; A.circle(ctx, 611 + Math.cos(a) * 12 * (i + 1), 420 - Math.abs(Math.sin(a * 1.7)) * 30 - i * 4, 2.5, i % 2 ? '#ffe080' : '#ff6030'); } }
    },
    hotspots: [
      { id: 'jacht', name: 'Jacht „Meridian“', rect: [696, 300, 160, 70], at: [620, 500, 'r'],
        look: (g) => g.flag('stavros_erzaehlt') ? 'Die Meridian. Weiß, schnell, und laut Stavros seit einer Woche hier. Vesper wartet an Bord oder oben bei der Grabung.' : 'Eine weiße Motorjacht, vor Anker in der Caldera. „Meridian“ steht am Bug. Vesper reist nicht mit der Fähre.',
        use: 'Ich habe kein Boot, und schwimmen möchte ich in diesem Wasser nicht. Es ist vierhundert Meter tief.', take: 'Etwas groß für die Jackentasche.', talk: 'Zu weit weg, um zu rufen. Und ich habe ihr nichts zu sagen.' },
      { id: 'vulkan', name: 'Vulkaninsel', rect: [856, 276, 104, 28], at: [620, 500, 'r'],
        look: async (g) => { await g.say('falk', 'Die schwarze Insel in der Mitte der Caldera. Der Vulkan. 1925 hat er zuletzt gehustet, sagen die Leute hier.'); await g.say('falk', 'Wo er jetzt raucht, stand vor dreitausend Jahren die Mitte der Insel. Der Ausbruch hat sie weggesprengt.'); g.codex('thera'); } },
      { id: 'wasser', name: 'Caldera', rect: [640, 300, 320, 176], at: [560, 470, 'r'],
        look: 'Das Wasser der Caldera. Dunkel, weil es tief ist. Die Seekarten sagen vierhundert Meter.',
        useWith: { flasche: 'Salzwasser. Nein danke.', default: 'Das werfe ich nicht ins Wasser.' } },
      { id: 'klippe', name: 'Steilwand', rect: [0, 64, 600, 270], at: [200, 440, 'u'],
        look: 'Dreihundert Meter Fels, in Schichten: Lava, Asche, Bims, wieder Lava. Jede Schicht ein Ausbruch. Die Insel ist ein aufgeschnittener Berg.',
        use: 'Klettern? Dafür gibt es den Eselspfad.' },
      { id: 'fira', name: 'Fira', rect: [0, 10, 600, 54], at: [200, 440, 'u'],
        look: 'Fira, oben auf dem Kraterrand. Weiße Würfel und blaue Kuppeln. 1932 haben wir dort in einer Pension gewohnt und nachts über Platon gestritten.' },
      { id: 'eselspfad', name: 'Eselspfad', poly: [430, 350, 220, 300, 400, 250, 180, 200, 360, 150, 150, 100, 300, 62, 330, 62, 180, 110, 380, 160, 200, 210, 420, 260, 250, 310, 450, 355], at: [470, 430, 'u'],
        look: 'Der Pfad nach Fira hinauf. Fünfhundertachtzig Stufen, sagt der Reiseführer. Der Esel kennt jede einzelne.',
        use: 'Nach Fira hinauf? Da oben wartet niemand auf mich. Vesper ist hier unten, oder bei Akrotiri.', walk: 'Da oben ist nichts für mich.' },
      { id: 'esel', name: 'Esel', rect: [452, 356, 62, 62], at: [470, 440, 'u'],
        look: 'Ein Esel. Er trägt Reisende nach oben und wartet auf den nächsten. Sein Blick sagt, dass er von uns beiden der Klügere ist.',
        use: 'Ich gehe zu Fuß, wenn es sein muss.', take: 'Er gehört jemandem. Und er würde nicht mitkommen.', talk: 'Er kaut. Das ist seine Antwort.', push: 'Man schiebt keinen Esel. Das lernt man hier am ersten Tag.',
        giveWith: { oliven: 'Er nimmt sie. Sonst ändert sich nichts.', default: 'Das frisst er nicht.' } },
      { id: 'kiosk_stand', name: 'Kiosk', rect: [244, 314, 176, 100], at: [330, 480, 'u'],
        look: 'Ein Bretterverschlag mit Zigaretten, Limonade, Postkarten und einem Bündel roter Kracher für das Fest. Die Besitzerin sitzt davor und sieht alles.',
        take: 'Die Besitzerin sitzt direkt davor.', open: 'Er ist offen. Man kauft.', use: 'Wenn ich etwas will, rede ich mit der Frau davor.' },
      { id: 'plakat', name: 'Plakat', rect: [412, 342, 38, 48], at: [400, 480, 'u'],
        look: 'Ein Plakat für das Panigyri, das Fest des Heiligen. Morgen Abend, mit Musik und Feuerwerk. Deshalb die Kracher am Kiosk.',
        take: 'Es ist angenagelt, und ich sammle keine Plakate.' },
      { id: 'boot_stavros', name: 'Stavros\' Boot', rect: [650, 380, 160, 70], at: [560, 470, 'r'],
        look: (g) => g.flag('stavros_faehrt') ? 'Stavros\' Kaïki. Der Motor läuft wieder. Er klingt wie eine Nähmaschine mit Husten, aber er läuft.' : 'Ein Kaïki, ein Fischerboot mit Mast und Motor. „Agia Irini“ steht am Heck. Der Motor hat eine Klappe offen, und Stavros steht daneben und flucht.',
        use: (g) => g.flag('stavros_faehrt') ? 'Stavros bringt mich rüber. Ich sollte einsteigen.' : 'Ohne Zündkerze fährt der Kahn nirgendwohin. Das hat Stavros deutlich gesagt.',
        take: 'Boote stiehlt man nicht. Nicht bei Tageslicht.',
        useWith: { zuendkerze: async (g) => { await g.say('falk', 'Ich sollte sie Stavros geben. Es ist sein Motor.'); }, default: 'Das gehört nicht in Stavros\' Boot.' } },
      { id: 'kohlenbecken', name: 'Kohlenbecken', rect: [586, 424, 50, 50], at: [570, 500, 'r'],
        look: (g) => g.flag('wache_abgelenkt') ? 'Das Kohlenbecken. Die Kracher haben ein paar Kohlen über den Kai verstreut. Sonst ist nichts passiert.' : 'Ein eisernes Kohlenbecken auf einem Dreifuß, am Fuß des Stegs. Die Wache wärmt sich die Hände daran, wenn es abends kalt wird. Es glüht.',
        use: 'Ich habe nichts, was ich hineinwerfen möchte. Noch nicht.', take: 'Es ist heiß, und es gehört Vespers Leuten.', open: 'Es ist ein Becken. Es ist offen.', push: 'Es glüht. Ich fasse es nicht an.',
        useWith: {
          feuerwerk: async (g) => {
            if (g.flag('wache_abgelenkt')) return 'Das hat einmal gereicht.';
            await g.scene(async () => {
              await g.say('falk', 'Ein ganzes Bündel Kracher. Die Lunte ist kurz.');
              g.anim('falk', 'reach'); await g.wait(500); g.anim('falk', 'stand');
              g.drop('feuerwerk'); g.set('kracher_brennen');
              await g.walk('falk', 500, 520, 'r');
              await g.wait(600);
              g.fx('thunder'); await g.wait(200); g.fx('punch'); g.fx('thunder');
              await g.message('Es knallt. Sechsmal, siebenmal, dann ein Schauer aus Funken und Kohlen.', 2400);
              g.set('kracher_brennen', false);
              await g.say('wache', 'Was zum…');
              g.unblockWalk('wache');
              await g.walk('wache', 620, 500, 'l');
              await g.say('wache', 'Kracher. Wer war das?');
              g.face('wache', 'falk');
              await g.say('falk', 'Kinder. Sie sind da hinten zum Pfad hoch.');
              await g.say('wache', 'Ich kriege euch, ihr Bälger.');
              g.actor('wache').speed = 240;
              await g.walk('wache', 470, 400, 'u');
              g.hide('wache');
              g.set('wache_abgelenkt');
              await g.say('falk', 'Er sucht die Kinder auf dem Eselspfad. Fünfhundertachtzig Stufen. Das gibt mir Zeit.');
              g.objective('Die Zündkerze aus dem Beiboot der Meridian holen.');
            });
          },
          zigaretten: 'Ich rauche nicht. Und die Wache bekommt sie nicht.',
          flasche: 'Warum sollte ich das Feuer löschen? Es tut mir nichts.',
          stein: 'Ein Stein im Feuer bleibt ein Stein.', bimsstein: 'Bims brennt nicht. Er ist schon einmal durchs Feuer gegangen.',
          default: 'Das gehört nicht ins Feuer.',
        } },
      { id: 'steg', name: 'Steg', rect: [640, 478, 200, 70], at: [640, 515, 'r'],
        look: (g) => g.flag('wache_abgelenkt') ? 'Ein Holzsteg über dem Wasser. Er ist jetzt frei.' : 'Ein Holzsteg über dem Wasser. Die Wache steht darauf, als hätte sie ihn gepachtet.',
        use: (g) => g.flag('wache_abgelenkt') ? 'Ich kann darauf gehen.' : 'Die Wache lässt niemanden auf den Steg. Ich habe es an ihrem Gesicht abgelesen.' },
      { id: 'beiboot', name: 'Beiboot der Meridian', rect: [842, 548, 112, 42],
        get at() { return ATL.game && ATL.game.flag('wache_abgelenkt') ? [896, 520, 'd'] : [640, 515, 'r']; },
        look: (g) => g.flag('zuendkerze_genommen') ? 'Das Beiboot der Meridian. Ohne Zündkerze fährt es nirgendwohin. Das ist jetzt Vespers Problem.' : g.flag('wache_abgelenkt') ? 'Das Beiboot der Meridian. Ein Außenbordmotor, ein Kanister, ein Tau. Der Motor hat eine Zündkerze, die Stavros brauchen könnte.' : 'Das Beiboot der Meridian, am Ende des Stegs. Ein Außenbordmotor, blank geputzt. Die Wache steht davor und sieht mich an.',
        take: (g) => g.hs('beiboot').use(g), open: (g) => g.hs('beiboot').use(g),
        use: async (g) => {
          if (!g.flag('wache_abgelenkt')) return 'Die Wache steht auf dem Steg und sieht jeden an, der näher kommt. Ich komme nicht an das Boot.';
          if (g.flag('zuendkerze_genommen')) return 'Mehr brauche ich nicht daraus. Das Tau lasse ich, sonst treibt es ab, und das fällt auf.';
          g.anim('falk', 'crouch'); await g.wait(600); g.fx('click'); await g.wait(300); g.anim('falk', 'stand');
          g.take('zuendkerze'); g.set('zuendkerze_genommen');
          await g.say('falk', 'Die Zündkerze. Zwei Umdrehungen mit dem Taschenmesser, und der Motor ist Schrott, bis jemand eine neue bringt.');
          await g.say('falk', 'Stavros wird sich freuen. Vesper weniger.');
          g.objective('Die Zündkerze zu Stavros bringen.');
        },
        useWith: { taschenmesser: (g) => g.hs('beiboot').use(g), zuendkerze: 'Die bleibt bei mir. Stavros braucht sie dringender als Vesper.', default: 'Das lasse ich nicht in Vespers Boot liegen.' } },
      { id: 'netze', name: 'Fischernetze', rect: [408, 552, 124, 34], at: [470, 545, 'd'],
        look: 'Netze zum Trocknen. Sie riechen nach dem, was sie gefangen haben.', take: 'Ich fische nicht.', use: 'Ich habe nicht vor, jemanden zu fangen. Noch nicht.' },
      { id: 'poller', name: 'Poller', rect: [600, 398, 22, 26], at: [560, 470, 'r'],
        look: 'Ein eiserner Poller. Stavros\' Tau ist daran festgemacht.', pull: 'Er sitzt fest im Kai. Seit hundert Jahren.', use: 'Das Tau ist fest. Stavros kann Knoten.' },
    ],
    exits: [
      { id: 'anleger', name: 'Fähranleger', rect: [0, 376, 70, 224], at: [60, 520, 'l'],
        look: 'Hier hat uns die Fähre aus Piräus abgesetzt. Sie kommt morgen wieder.',
        before: async (g) => { await ATL.story.openMap(g, 'thera'); return false; } },
      { id: 'boot', name: 'Zu Stavros\' Boot', rect: [650, 380, 100, 40], at: [560, 470, 'r'], to: 'th_cliff', pos: [160, 520], dir: 'r', cond: (g) => g.flag('stavros_faehrt'),
        look: 'Stavros\' Boot. Der Motor läuft.',
        before: async (g) => {
          if (!g.flag('th_bucht_besucht')) {
            g.set('th_bucht_besucht');
            await g.scene(async () => {
              await g.say('stavros', 'Einsteigen. Und halten Sie sich fest, das Ding lenkt wie ein Esel.');
              await g.say('livia', 'Ich bleibe hier und behalte die Jacht im Auge. Wenn sie ablegt, weißt du, wo Vesper ist.');
              await g.say('falk', 'Und wenn Kessler hier auftaucht?');
              await g.say('livia', 'Dann ist er nicht bei dir. Fahr.');
              await g.message('Das Kaïki tuckert aus dem Hafen, an der Jacht vorbei, nach Süden. Die Klippen werden rot.', 2800);
            });
          }
          return true;
        } },
    ],
    actors: [
      { id: 'livia', x: 480, y: 500, dir: 'l', cond: (g) => !g.flag('livia_gefangen'), talk: (g) => g.dialog('livia_thera'), at: [420, 505, 'r'],
        look: 'Livia. Sie sieht zur Jacht, als könnte sie Vesper damit versenken.',
        giveWith: { medaillon: 'Ich behalte es. Sie hat es mir gegeben, damit es nicht in ihrer Handtasche gefunden wird.', perle: 'Sie sagt, sie ist bei mir sicherer. Das ist entweder Vertrauen oder Vorsicht.', zigaretten: 'Livia raucht nicht. Sie hat 1931 aufgehört, um mich zu ärgern.', default: 'Livia schüttelt den Kopf.' } },
      { id: 'stavros', x: 585, y: 405, dir: 'r', talk: (g) => g.dialog('stavros'), at: [540, 440, 'r'],
        look: (g) => g.flag('stavros_faehrt') ? 'Stavros. Er wischt sich die Hände am Hemd ab und sieht zufrieden aus.' : 'Stavros, der Bootsführer. Er steht neben seinem Motor wie ein Arzt neben einem Patienten, dem er nicht mehr helfen kann.',
        giveWith: {
          zuendkerze: async (g) => {
            await g.say('stavros', 'Eine Zündkerze. Woher…? Nein. Sagen Sie es nicht.');
            g.drop('zuendkerze');
            await g.say('stavros', 'Moment.');
            g.anim('stavros', 'crouch'); await g.wait(900); g.fx('click'); await g.wait(400); g.anim('stavros', 'stand');
            g.fx('hum');
            await g.message('Der Motor hustet, hustet noch einmal und läuft.', 2200);
            g.set('stavros_faehrt');
            await g.say('stavros', 'Er läuft. Wohin?');
            await g.say('falk', 'Akrotiri. Die Bucht unter der Grabung.');
            await g.say('stavros', 'Zu den Deutschen. Gut. Ich setze Sie in der Bucht ab und warte am Strand. Steigen Sie ein, wenn Sie so weit sind.');
            g.objective('Mit Stavros zur Bucht bei Akrotiri fahren.');
          },
          zigaretten: async (g) => {
            if (g.flag('stavros_erzaehlt')) return 'Er hat schon eine Schachtel von mir. Mehr Geschichten hat er nicht.';
            await g.say('stavros', 'Für mich? Sie sind ein Ehrenmann.');
            g.drop('zigaretten'); g.set('stavros_erzaehlt');
            await g.message('Stavros riecht an der Schachtel und steckt sie ein.', 1800);
            await g.say('stavros', 'Die Deutschen. Sie graben unten bei Akrotiri, wo die Amerikanerin 1932 aufgehört hat. Am schwarzen Tor.');
            await g.say('falk', 'Das schwarze Tor.');
            await g.say('stavros', 'Ein Tor aus schwarzem Stein, mit Ringen darauf. Mein Cousin hat für sie geschleppt. Er sagt, sie haben es mit Sprengstoff versucht. Nicht ein Kratzer.');
            await g.say('falk', 'Und dann?');
            await g.say('stavros', 'Dann haben sie aufgehört und gewartet. Auf einen, der die Schlüssel bringt, hat der Große gesagt. Der mit dem Mantel.');
            await g.say('falk', 'Auf mich.');
            await g.say('stavros', 'Das sage ich nicht. Ich sage nur, was mein Cousin sagt.');
          },
          muenzen: 'Geld hilft mir nicht, wenn der Motor nicht anspringt, sagt er. Und Rudern ist nicht sein Beruf.',
          feuerwerk: 'Stavros sieht die Kracher an und dann mich. „Ich habe schon einen Motor, der knallt.“',
          flasche: 'Er hat eigenes Wasser. Und Wein.',
          default: 'Stavros winkt ab.',
        } },
      { id: 'kiosk', x: 330, y: 455, dir: 'd', talk: (g) => g.dialog('kiosk'), at: [330, 500, 'u'],
        look: 'Die Kioskbesitzerin. Sie hat den halben Hafen im Blick und die andere Hälfte im Ohr.',
        giveWith: {
          muenzen: async (g) => {
            if (!g.has('feuerwerk') && !g.flag('kracher_gekauft')) { g.take('feuerwerk'); g.set('kracher_gekauft'); await g.say('kiosk', 'Die Kracher? Zwei Drachmen. Für das Fest, ja?'); return 'Für das Fest. Sicher.'; }
            if (!g.has('zigaretten') && !g.flag('zigaretten_gekauft')) { g.take('zigaretten'); g.set('zigaretten_gekauft'); await g.say('kiosk', 'Zigaretten. Griechische, die guten.'); return 'Nicht für mich. Aber danke.'; }
            if (!g.has('feuerwerk')) { g.take('feuerwerk'); await g.say('kiosk', 'Noch ein Bündel? Sie feiern gern.'); return; }
            if (!g.has('zigaretten')) { g.take('zigaretten'); await g.say('kiosk', 'Noch eine Schachtel. Bitte.'); return; }
            return 'Ich habe schon alles, was sie hat und ich brauche.';
          },
          default: 'Sie verkauft. Sie kauft nicht.',
        } },
      { id: 'wache', x: 700, y: 516, dir: 'l', cond: (g) => !g.flag('wache_abgelenkt'), talk: (g) => g.dialog('wache_steg'), at: [640, 515, 'r'],
        look: 'Einer von Vespers Männern. Schwarze Mütze, schwarze Jacke, und ein Blick, der sagt, dass er den Steg mit seinem Leben verteidigt. Oder zumindest mit meinem.',
        giveWith: { zigaretten: 'Er nimmt sie nicht einmal an. Vesper zahlt offenbar gut.', muenzen: 'Er sieht die Münzen an und sieht mich an. Er lacht nicht einmal.', feuerwerk: 'Ich glaube nicht, dass er sie mir anzünden würde.', default: 'Er will nichts von mir. Außer, dass ich verschwinde.' } },
    ],
    async enter(g) {
      if (!g.flag('wache_abgelenkt')) g.blockWalk('wache', STEG_BLOCK);
      if (g.flag('th_angekommen')) return;
      g.set('th_angekommen');
      await g.scene(async () => {
        await g.message('Thera. Juni 1938.', 2400);
        g.place('livia', 130, 530, 'r');
        await g.walk('livia', 480, 500, 'r');
        await g.walk('falk', 420, 510, 'r');
        g.face('livia', 'falk');
        await g.say('livia', 'Da liegt sie. Die Meridian.');
        await g.say('falk', 'Vesper ist vor uns hier. Natürlich ist er das.');
        await g.say('livia', 'Er hat das Tor, und wir haben die Siegel. Ohne die Siegel ist das Tor ein Stein.');
        await g.say('falk', 'Und mit den Siegeln ist es ein Stein mit Löchern. Wir werden sehen.');
        await g.say('livia', 'Akrotiri liegt im Süden, über Land sind das Stunden. Mit einem Boot eine halbe. Das da vorn ist das einzige, das nicht Vesper gehört.');
        g.face('livia', 'r');
        await g.say('falk', 'Dann rede ich mit dem Mann daneben.');
        g.objective('Nach Akrotiri kommen. Stavros hat das einzige Boot, das nicht Vesper gehört.');
      });
    },
  });

  const stavrosStory = ATL.rooms.get('th_harbor').actors.find((a) => a.id === 'stavros').giveWith.zigaretten;

  ATL.dialogs.define('livia_thera', {
    nodes: {
      root: {
        options: [
          { text: 'Was weißt du über das Tor bei Akrotiri?', once: true,
            say: [['livia', '1932, in der letzten Woche der Grabung, haben wir einen Stein freigelegt. Schwarz, glatt, drei Ringe darauf, ineinander. Du hast gesagt, das sei eine Laune der Lava.'], ['falk', 'Ich habe gesagt, wir sollten es publizieren, bevor wir es deuten.'], ['livia', 'Du hast gesagt, ich sähe Atlantis in jedem Loch. Dann war das Geld aus, und wir sind gegangen. Getrennt.'], ['livia', 'Drei Ringe, Adrian. Platon beschreibt die Stadt genau so: drei Ringe aus Wasser um einen Hügel. Ich habe das damals gesagt, und ich sage es heute.']],
            action: (g) => { g.codex('ringe'); } },
          { text: 'Orichalkum. Was ist das eigentlich?', once: true,
            say: [['livia', 'Bei Platon ein Metall, das in Atlantis abgebaut wurde. „Im Wert nur dem Gold nachstehend.“ Sie haben die Mauern damit verkleidet und die Wände des Tempels.'], ['livia', 'Das Wort heißt Bergkupfer. Die Römer nannten so eine Messinglegierung. Nichts, was leuchtet.'], ['falk', 'Die Perle leuchtet.'], ['livia', 'Ja. Und Vesper glaubt, das sei erst der Anfang. Er glaubt, die Atlanter hätten daraus Kraft gewonnen. Wie aus Kohle, nur besser.']],
            action: (g) => { g.codex('orichalkum'); } },
          { text: 'Wie kommen wir nach Akrotiri?',
            say: (g) => g.flag('stavros_faehrt') ? [['livia', 'Stavros wartet mit laufendem Motor. Worauf wartest du?']]
              : g.has('zuendkerze') ? [['livia', 'Du hast die Zündkerze. Gib sie Stavros, bevor die Wache zurückkommt.']]
              : g.flag('wache_abgelenkt') ? [['livia', 'Die Wache ist weg. Das Beiboot liegt am Ende des Stegs, und sein Motor hat genau das, was Stavros fehlt.']]
              : [['livia', 'Stavros hat das einzige Boot, das nicht Vesper gehört. Sein Motor ist kaputt, er braucht eine Zündkerze.'], ['livia', 'Das Beiboot der Meridian hat einen Motor. Aber davor steht ein Mann, der nicht wegsehen wird. Es sei denn, etwas ist lauter als du.']] },
          { text: 'Was ist mit Vesper?', once: true,
            say: [['livia', 'An Bord oder oben bei der Grabung. Kessler auch. Sie haben seit einer Woche Zelte bei Akrotiri, sagt die Frau am Kiosk.'], ['falk', 'Er wartet auf uns.'], ['livia', 'Er wartet auf die Siegel. Wir sind ihm egal. Das ist das Beruhigende daran, und das Beunruhigende.']] },
          { text: 'Und wenn das Tor aufgeht?', once: true,
            say: [['livia', 'Dann siehst du, dass ich recht hatte.'], ['falk', 'Oder wir sehen eine Höhle. Höhlen gibt es hier viele.'], ['livia', 'Dann sehen wir eine Höhle, in der jemand vor dreitausend Jahren ein Schloss mit drei Ringen eingebaut hat. Erklär mir das.']] },
          { text: 'Ich sehe mich um.', end: true, say: [['livia', 'Ich bleibe hier und behalte die Jacht im Auge.']] },
        ],
      },
    },
  });

  ATL.dialogs.define('stavros', {
    nodes: {
      root: {
        options: [
          { text: 'Können Sie mich nach Akrotiri bringen?', cond: (g) => !g.flag('stavros_faehrt'),
            say: [['stavros', 'Mit dem Boot? Der Motor ist tot. Zündkerze. Seit drei Tagen warte ich auf eine aus Piräus.'], ['falk', 'Und mit dem Segel?'], ['stavros', 'Bei dem Wind? Da rudere ich schneller. Und ich rudere nicht. Ich bin Kapitän.']],
            action: (g) => { g.set('stavros_gefragt'); } },
          { text: 'Wo bekommt man hier eine Zündkerze?', once: true, cond: (g) => g.flag('stavros_gefragt') && !g.flag('stavros_faehrt'),
            say: [['stavros', 'Auf der Insel? Es gibt drei Motoren auf Thera, und zwei davon gehören den Deutschen.'], ['stavros', 'Ihr Beiboot da hinten hat einen. Nagelneu. Aber der Kerl auf dem Steg lässt niemanden ran, nicht einmal die Katzen.']] },
          { text: 'Wann fahren wir?', cond: (g) => g.flag('stavros_faehrt'),
            say: [['stavros', 'Wenn Sie einsteigen. Ich bin fertig, das Boot ist fertig, nur Sie stehen noch am Kai.']] },
          { text: 'Kennen Sie die Leute von der Jacht?', once: true,
            say: [['stavros', 'Die Deutschen. Sie zahlen gut und reden nicht. Seit einer Woche liegen sie hier, und seit einer Woche schleppen sie Kisten nach Akrotiri.'], ['falk', 'Was für Kisten?'], ['stavros', 'Schwere. Mehr sage ich nicht, solange meine Kehle trocken ist und meine Tasche leer.']] },
          { text: 'Was wissen Sie über die Grabung bei Akrotiri?', once: true, cond: (g) => g.flag('stavros_erzaehlt'),
            say: [['stavros', 'Was ich weiß, habe ich gesagt. Ein schwarzes Tor, Ringe darauf, Sprengstoff, der nichts genützt hat. Und ein Mann im Mantel, der auf Schlüssel wartet.'], ['stavros', 'Mein Cousin schläft seither schlecht. Ich auch, wenn ich ehrlich bin.']] },
          { text: 'Bis später, Stavros.', end: true,
            say: (g) => g.flag('stavros_faehrt') ? [['stavros', 'Ich warte. Aber nicht bis Weihnachten.']] : [['stavros', 'Ich bin hier. Wo soll ich hin, ohne Motor.']] },
        ],
      },
    },
  });

  ATL.dialogs.define('kiosk', {
    nodes: {
      root: {
        say: (g) => g.flag('kiosk_begruesst') ? [] : [['kiosk', 'Kalimera. Zigaretten? Limonade? Postkarten für die Daheimgebliebenen?']],
        action: (g) => { g.set('kiosk_begruesst'); },
        options: [
          { text: 'Was kosten die Kracher?', cond: (g) => !g.has('feuerwerk'),
            say: [['kiosk', 'Zwei Drachmen das Bündel. Für das Fest, ja? Morgen Abend knallt die ganze Insel.'], ['falk', 'Für das Fest. Sicher.']],
            action: async (g) => { g.take('feuerwerk'); g.set('kracher_gekauft'); await g.say('kiosk', 'Nicht in der Hand zünden. Das sage ich jedem, und jedes Jahr fehlt einem ein Finger.'); } },
          { text: 'Eine Schachtel Zigaretten, bitte.', cond: (g) => !g.has('zigaretten'),
            say: [['kiosk', 'Griechische, die guten. Eine Drachme.']],
            action: (g) => { g.take('zigaretten'); g.set('zigaretten_gekauft'); } },
          { text: 'Was ist das für ein Fest auf dem Plakat?', once: true,
            say: [['kiosk', 'Das Panigyri. Der Heilige der Kapelle oben hat seinen Tag. Musik, Lamm, Wein, und dann Feuerwerk, bis die Esel durchdrehen.'], ['kiosk', 'Die Kracher verkaufe ich seit einer Woche. Die Kinder zünden sie hinter den Eseln. Die Esel haben es verdient, sagen die Kinder.']] },
          { text: 'Kennen Sie die Männer vom Steg?', once: true,
            say: [['kiosk', 'Die Deutschen. Sie kaufen nichts. Nicht einmal Zigaretten. Der auf dem Steg steht seit Tagen da wie ein Poller und starrt.'], ['kiosk', 'Abends, wenn es kalt wird, wärmt er sich die Hände am Becken. Dann sieht er nichts außer dem Feuer.']] },
          { text: 'Danke, das war alles.', end: true, say: [['kiosk', 'Kommen Sie wieder. Ich bin immer hier.']] },
        ],
      },
    },
  });

  ATL.dialogs.define('wache_steg', {
    nodes: {
      root: {
        say: [['wache', 'Privatsteg. Weitergehen.']],
        options: [
          { text: 'Ich wollte nur das Boot ansehen.', once: true, say: [['wache', 'Ansehen kann man von da, wo Sie stehen.']] },
          { text: 'Gehört das Boot zur Meridian?', once: true, say: [['wache', 'Weitergehen, habe ich gesagt.'], ['falk', 'Sie haben einen großen Wortschatz.'], ['wache', 'Und große Hände. Weitergehen.']] },
          { text: 'Ist Herr Vesper an Bord?', once: true, say: [['wache', 'Wer?'], ['falk', 'Vergessen Sie es.']] },
          { text: 'Schon gut.', end: true, say: [['wache', 'Eben.']] },
        ],
      },
    },
  });

  ATL.dialogs.define('stavros_bucht', {
    nodes: {
      root: {
        options: [
          { text: 'Warten Sie hier auf mich?', once: true, say: [['stavros', 'Ich warte. Aber nicht bis Weihnachten. Und wenn die Deutschen kommen, bin ich ein Fischer, der Netze flickt.']] },
          { text: 'Wo ist die Grabung?', once: true, say: [['stavros', 'Oben. Den Pfad hoch, dann links, hinter dem Grat. Und der Kerl da oben ist keiner von uns.']] },
          { text: 'Was ist das für ein roter Fels?', once: true, say: [['stavros', 'Der Berg hat ihn ausgespuckt, als er noch jung war. Rot, schwarz, weiß, alles vom Berg. Wir leben auf seiner Asche und bauen Wein darauf an. Guten Wein.']] },
          { text: 'Ich gehe dann.', end: true, say: [['stavros', 'Gehen Sie. Ich schaue aufs Meer.']] },
        ],
      },
    },
  });

  // ---------------------------------------------------------------- Bucht bei Akrotiri
  const clipPoly = (ctx, pts) => { ctx.beginPath(); for (let i = 0; i < pts.length; i += 2) i ? ctx.lineTo(pts[i], pts[i + 1]) : ctx.moveTo(pts[i], pts[i + 1]); ctx.closePath(); ctx.clip(); };
  const CLIFF = [360, 300, 400, 180, 440, 110, 520, 60, 700, 40, 960, 30, 960, 470, 730, 466, 640, 436, 520, 446, 400, 410, 360, 360];
  R({
    id: 'th_cliff', name: 'Bucht bei Akrotiri', ambient: 'thera',
    start: [160, 520, 'r'],
    walk: [[40, 458, 700, 458, 780, 472, 900, 472, 940, 585, 30, 585]],
    scale: { y0: 440, s0: 0.8, y1: 585, s1: 1.05 },
    paint(ctx, g) {
      A.sky(ctx, 960, 320, '#7fb0e0', '#f0dcc0');
      A.sun(ctx, 110, 80, 24, '#fff2c8');
      A.clouds(ctx, 960, 90, 3, 14, 'rgba(255,255,255,0.4)');
      // Meer und ferne Küste
      A.sea(ctx, 0, 300, 560, 180, '#3a7aa8', '#1a4a78', 15);
      A.poly(ctx, [0, 300, 140, 294, 300, 297, 380, 300, 380, 303, 0, 303], '#6a5a58');
      // Rote Klippen mit Bims- und Aschebändern
      A.poly(ctx, CLIFF, '#8a3a2a');
      ctx.save(); clipPoly(ctx, CLIFF);
      const bands = [[70, '#c9b49a', 18], [120, '#5a2a1e', 10], [160, '#d8c8a8', 26], [215, '#a04a34', 14], [250, '#3a2a26', 12], [290, '#c4b090', 20], [340, '#6a2e22', 10], [372, '#b8846a', 16]];
      for (const [y, c, h] of bands) A.poly(ctx, [300, y + 34, 960, y - 12, 960, y - 12 + h, 300, y + 34 + h], c);
      const rk = ATL.U.rng(31);
      for (let i = 0; i < 90; i++) { const x = 360 + rk() * 600, y = 40 + rk() * 400; A.rock(ctx, x, y, 10 + rk() * 34, 6 + rk() * 16, ['#7a3226', '#a04a34', '#5a2a1e', '#c8b090'][Math.floor(rk() * 4)], Math.floor(rk() * 80)); }
      ctx.fillStyle = A.grad(ctx, 0, 40, 0, 470, ['rgba(255,220,180,0.12)', 'rgba(30,10,10,0.4)']); ctx.fillRect(360, 30, 600, 440);
      ctx.restore();
      // Bimsschicht am Fuß, Geröll
      A.poly(ctx, [380, 404, 700, 394, 720, 446, 640, 452, 520, 456, 400, 444], '#d8ccb0');
      for (let i = 0; i < 40; i++) A.rock(ctx, 380 + rk() * 340, 398 + rk() * 44, 8 + rk() * 22, 5 + rk() * 12, rk() < 0.5 ? '#e0d8c0' : '#b8ac90', Math.floor(rk() * 50));
      // Sims der Ziegen
      A.poly(ctx, [490, 372, 690, 356, 700, 370, 500, 386], '#6a2e22'); A.poly(ctx, [490, 372, 690, 356, 690, 351, 490, 366], '#a05a40');
      for (let i = 0; i < 8; i++) A.line(ctx, 500 + i * 24, 366 - i * 1.6, 504 + i * 24, 352 - i * 1.6, '#7a8a3a', 2);
      // Pfad nach oben
      const seg = [[740, 468], [870, 414], [770, 352], [890, 300], [830, 262]];
      for (let i = 0; i + 1 < seg.length; i++) { A.line(ctx, seg[i][0], seg[i][1], seg[i + 1][0], seg[i + 1][1], '#d8c4a0', 8 - i); A.line(ctx, seg[i][0], seg[i][1] + 3, seg[i + 1][0], seg[i + 1][1] + 3, 'rgba(0,0,0,0.3)', 2); }
      // Grat oben mit Zeltspitzen
      A.poly(ctx, [700, 266, 960, 238, 960, 274, 700, 284], '#a07858');
      for (const x of [760, 812, 900]) { const y = 262 - (x - 700) * 0.1; A.poly(ctx, [x - 16, y, x + 16, y, x, y - 24], '#c8b48a'); A.poly(ctx, [x - 4, y, x + 4, y, x, y - 14], '#5a4a3a'); }
      // Strand aus schwarzem Sand
      A.poly(ctx, [0, 470, 120, 458, 260, 464, 400, 450, 480, 444, 720, 444, 960, 462, 960, 600, 0, 600], '#2a2624');
      const sr = ATL.U.rng(37);
      for (let i = 0; i < 500; i++) { const x = sr() * 960, y = 450 + sr() * 150; if (y > 470 - (x < 480 ? (480 - x) * 0.05 : 0)) ctx.fillStyle = sr() < 0.5 ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.3)', ctx.fillRect(x, y, 2, 2); }
      ctx.fillStyle = A.grad(ctx, 0, 470, 0, 600, ['rgba(0,0,0,0)', 'rgba(0,0,0,0.35)']); ctx.fillRect(0, 470, 960, 130);
      // Stavros' Boot auf den Sand gezogen
      A.boat(ctx, 30, 506, 180, '#7a5a3a', true); A.rect(ctx, 38, 486, 166, 12, '#4a6a8a'); A.rr(ctx, 170, 476, 30, 18, 4, '#5a5a5a');
      A.rope(ctx, [200, 512, 240, 528, 262, 540], '#a89060', 2); A.rock(ctx, 250, 530, 34, 20, '#4a4a44', 5);
      // Treibholz, Steine, Tang
      A.line(ctx, 580, 566, 660, 556, '#8a7a5a', 6); A.line(ctx, 600, 566, 612, 550, '#8a7a5a', 4);
      A.rock(ctx, 800, 536, 40, 22, '#3a3632', 9); A.rock(ctx, 850, 556, 26, 14, '#4a4440', 10); A.rock(ctx, 700, 500, 22, 12, '#3a3632', 11);
      for (let i = 0; i < 6; i++) A.ell(ctx, 320 + i * 40, 478 + (i % 2) * 6, 14, 3, '#3a4a2a');
      A.vignette(ctx, 960, 600, 0.42);
      A.grain(ctx, 960, 600, 5, 0.04);
    },
    animate(ctx, t) {
      A.waterAnim(ctx, 0, 300, 560, 180, t, 'rgba(220,240,255,0.14)');
      const f = Math.sin(t * 1.5);
      A.path(ctx, [0, 471 + f * 2, 120, 459 + f * 2, 260, 465 + f, 400, 451 + f * 2, 480, 445], `rgba(255,255,255,${0.35 + f * 0.15})`, 4);
    },
    hotspots: [
      { id: 'meer', name: 'Meer', rect: [0, 300, 380, 150], at: [200, 480, 'u'],
        look: 'Die Südküste. Von hier ist es nach Kreta nicht weit. Die Minoer haben diese Strecke gesegelt, und ihre Schiffe stehen auf den Fresken da oben.',
        useWith: { flasche: 'Salzwasser hilft mir nicht.', default: 'Das werfe ich nicht ins Meer.' } },
      { id: 'klippen', name: 'Rote Klippen', rect: [380, 30, 580, 300], at: [560, 480, 'u'],
        look: async (g) => { await g.say('falk', 'Rote Lava, schwarze Asche, dazwischen weiße Bänder aus Bims. Jedes Band ein Ausbruch, und das dickste ganz oben ist der, der Akrotiri begraben hat.'); await g.say('falk', 'Dreißig Meter Bims an einem Tag. Die Leute in den Häusern hatten Zeit zu gehen. Man hat keine Toten gefunden. Noch nicht.'); g.codex('thera'); },
        use: 'Ich klettere nicht in Lava. Es gibt einen Pfad.', take: 'Ich nehme einen Stein, wenn ich einen brauche. Nicht die Klippe.' },
      { id: 'bimsschicht', name: 'Bimsschicht', rect: [380, 394, 340, 62], at: [560, 480, 'u'],
        look: 'Eine Schicht Bimsstein am Fuß der Klippe. Weiß, leicht, voller Löcher. Der Berg hat ihn gespuckt, und das Meer hat ihn nicht einmal weggetragen, so leicht ist er.',
        take: async (g) => { if (g.has('bimsstein')) return 'Einer reicht. Er wiegt nichts, aber er ist unhandlich.'; g.anim('falk', 'crouch'); await g.wait(500); g.anim('falk', 'stand'); g.take('bimsstein'); g.set('bims_genommen'); return 'Ein Brocken Bims. Leicht wie Brot. Man kann damit werfen, aber nicht treffen.'; },
        use: (g) => g.hs('bimsschicht').take(g) },
      { id: 'stein', name: 'Stein', rect: [286, 528, 38, 26], at: [300, 560, 'u'], z: 546, cond: (g) => !g.flag('stein_genommen'),
        paint: (ctx) => { A.rock(ctx, 288, 530, 34, 22, '#5a5854', 6); },
        look: 'Ein faustgroßer Stein aus schwarzer Lava. Schwer und rund. Gut zum Werfen, wenn man jemanden hat, den man treffen will.',
        take: async (g) => { g.anim('falk', 'crouch'); await g.wait(500); g.anim('falk', 'stand'); g.take('stein'); g.set('stein_genommen'); return 'Der liegt gut in der Hand.'; },
        use: (g) => g.hs('stein').take(g) },
      { id: 'strand', name: 'Strand', rect: [0, 470, 960, 130], at: [480, 540, 'd'], noWalk: true,
        look: 'Schwarzer Sand. Er ist warm, obwohl die Sonne schon tief steht. Der Berg heizt von unten.',
        take: async (g) => { if (g.has('stein')) return 'Einen Stein habe ich schon.'; g.anim('falk', 'crouch'); await g.wait(500); g.anim('falk', 'stand'); g.take('stein'); return 'Noch ein Stein. Hier liegen Tausende.'; },
        use: 'Ich habe keine Zeit, im Sand zu sitzen.' },
      { id: 'ziegen', name: 'Ziegen', rect: [500, 320, 190, 62], at: [590, 480, 'u'],
        paint(ctx, g, t) {
          const goat = (x, y, s, ph, c) => {
            const bob = Math.sin(t * 2 + ph) * 2 * s;
            A.rect(ctx, x - 12 * s, y + 4 * s, 3 * s, 10 * s, A.shade(c, -0.25)); A.rect(ctx, x + 9 * s, y + 4 * s, 3 * s, 10 * s, A.shade(c, -0.25));
            A.ell(ctx, x, y, 16 * s, 9 * s, c);
            A.rect(ctx, x - 6 * s, y + 5 * s, 3 * s, 9 * s, c); A.rect(ctx, x + 3 * s, y + 5 * s, 3 * s, 9 * s, c);
            A.line(ctx, x - 16 * s, y - 2 * s, x - 21 * s, y - 9 * s, c, 2 * s);
            A.rr(ctx, x + 11 * s, y - 13 * s + bob, 10 * s, 13 * s, 3 * s, c);
            A.line(ctx, x + 14 * s, y - 13 * s + bob, x + 10 * s, y - 22 * s + bob, '#3a2a1a', 2 * s); A.line(ctx, x + 19 * s, y - 13 * s + bob, x + 23 * s, y - 22 * s + bob, '#3a2a1a', 2 * s);
            A.circle(ctx, x + 16 * s, y - 1 * s + bob, 2.6 * s, '#c8a848');
          };
          if (!g.flag('pfad_frei')) { goat(534, 356, 1, 0, '#e8e0d0'); goat(592, 352, 0.9, 1.3, '#5a4a3a'); goat(650, 347, 0.85, 2.1, '#d8c8b0'); }
          else { goat(905, 244, 0.5, 0, '#e8e0d0'); goat(935, 241, 0.45, 1.3, '#5a4a3a'); }
        },
        look: (g) => g.flag('pfad_frei') ? 'Die Ziegen stehen jetzt oben auf dem Grat und fressen weiter. Die Wache sucht irgendwo dahinter nach dem, der sie erschreckt hat.' : 'Drei Ziegen auf einem Sims, zwanzig Meter über mir. Jede hat eine Glocke um den Hals. Wenn sie sich bewegen, hört man es bis nach Fira.',
        take: 'Sie stehen auf einem Sims, der mich nicht tragen würde. Und sie gehören jemandem.',
        talk: 'Mäh. Das ist alles, was sie zum Thema zu sagen haben.', use: 'Ich komme nicht hinauf. Aber ich könnte etwas hinaufwerfen.',
        useWith: {
          stein: async (g) => {
            if (g.flag('pfad_frei')) return 'Die Ziegen sind weg. Ich werfe nicht auf leere Simse.';
            await g.scene(async () => {
              await g.say('falk', 'Tut mir leid, Mädels.');
              g.anim('falk', 'reach'); await g.wait(500); g.anim('falk', 'stand'); g.drop('stein'); g.fx('stone');
              await g.wait(300); g.fx('bell'); await g.wait(250); g.fx('bell');
              await g.message('Der Stein schlägt auf dem Sims auf. Drei Ziegen springen gleichzeitig, und drei Glocken bimmeln den halben Berg hinauf.', 2600);
              await g.say('wache', 'He! Was ist da…');
              await g.message('Die Wache oben tritt an den Rand, sieht die Ziegen den Grat entlangrennen und läuft ihnen nach.', 2400);
              const w = g.actor('wache'); if (g.fast) w.setPos(970, 246, 'r'); else { w.speed = 220; await w.walkPath([[970, 246]]); }
              g.hide('wache'); g.set('pfad_frei'); g.fx('bell');
              await g.say('falk', 'Er glaubt, jemand hat die Ziegen aufgescheucht, und sucht diesen Jemand auf der falschen Seite. Der Pfad ist frei.');
              g.objective('Den Klippenpfad hinauf zur Grabung.');
            });
          },
          bimsstein: 'Bims wiegt nichts. Er fliegt drei Meter und die Ziegen lachen.',
          oliven: 'Zu weit oben. Und Ziegen fressen alles, das ist kein Anreiz.',
          feuerwerk: 'Damit mache ich die Wache auf mich aufmerksam, nicht auf die Ziegen.',
          flasche: 'Ich werfe meine Flasche nicht nach Ziegen.',
          default: 'Das werfe ich nicht nach Ziegen.',
        } },
      { id: 'grat', name: 'Grat', rect: [700, 230, 260, 50], at: [780, 490, 'u'],
        look: (g) => g.flag('pfad_frei') ? 'Der Grat. Man sieht die Spitzen von Zelten. Die Wache ist irgendwo dahinter und verflucht Ziegen.' : 'Oben auf dem Grat stehen Zelte, man sieht die Spitzen. Und ein Mann, der nicht zum Vergnügen dort steht.' },
      { id: 'boot_strand', name: 'Stavros\' Boot', rect: [20, 460, 200, 60], at: [240, 520, 'l'],
        look: 'Das Kaïki, auf den Sand gezogen. Stavros sitzt daneben und tut, als flicke er Netze.',
        use: (g) => g.travel(g.hs('boot')), take: 'Es gehört Stavros.' },
    ],
    exits: [
      { id: 'boot', name: 'Zurück zum Hafen', rect: [20, 520, 200, 40], at: [240, 540, 'l'], to: 'th_harbor', pos: [580, 480], dir: 'l', z: 3,
        look: 'Mit dem Boot zurück nach Fira.',
        before: async (g) => { if (g.flag('livia_gefangen')) return true; await g.say('stavros', 'Zurück? Sicher. Der Motor läuft, solange er läuft.'); return true; } },
      { id: 'pfad', name: 'Klippenpfad', poly: [720, 476, 880, 410, 760, 356, 900, 296, 830, 250, 870, 246, 920, 300, 790, 356, 900, 410, 760, 480], at: [760, 490, 'u'], to: 'th_akrotiri', pos: [120, 520], dir: 'r', z: 3,
        look: (g) => g.flag('pfad_frei') ? 'Der Pfad zur Grabung. Steil, aber frei.' : 'Ein Ziegenpfad, der im Zickzack nach oben führt. Oben steht ein Mann und sieht auf genau diesen Pfad.',
        before: async (g) => {
          if (!g.flag('pfad_frei')) { await g.say('falk', 'Die Wache oben sieht jeden, der den Pfad hochkommt. Ich brauche einen Moment, in dem sie woanders hinsieht.'); return false; }
          if (!g.flag('th_pfad_hoch')) { g.set('th_pfad_hoch'); await g.message('Der Pfad ist steil und die Sonne steht tief. Oben liegt die Grabung, in der Falk und Livia vor sechs Jahren aufgehört haben.', 2600); }
          return true;
        } },
    ],
    actors: [
      { id: 'stavros', x: 120, y: 470, dir: 'r', talk: (g) => g.dialog('stavros_bucht'), at: [190, 500, 'l'],
        look: 'Stavros. Er sitzt neben dem Boot, raucht und sieht aufs Meer, als hätte er nie etwas anderes getan.',
        giveWith: { zigaretten: stavrosStory, muenzen: 'Er winkt ab. „Nachher. Wenn Sie wieder unten sind.“', default: 'Stavros schüttelt den Kopf.' } },
      { id: 'wache', x: 836, y: 262, dir: 'l', scale: 0.42, noWalk: true, cond: (g) => !g.flag('pfad_frei'),
        look: 'Vespers zweite Wache, oben am Ende des Pfads. Sie hat den Strand im Blick, das Boot und mich. Sie hat noch nichts unternommen. Das heißt, sie hat Befehle.',
        talk: () => 'Zu weit weg. Und ich will nicht, dass er mich bemerkt, bevor ich oben bin.',
        giveWith: { default: 'Er ist fünfzig Meter über mir.' } },
    ],
    async enter(g) {
      if (g.flag('th_bucht_angekommen')) return;
      g.set('th_bucht_angekommen');
      await g.say('falk', 'Die Bucht. Rote Klippen, schwarzer Sand. 1932 haben wir hier jeden Morgen angelegt.');
      await g.say('falk', 'Und oben, am Ende des Pfads, steht einer von Vespers Leuten. Er sieht auf den Strand. Auf mich.');
      g.objective('An der Wache oben am Klippenpfad vorbeikommen.');
    },
  });

  // ---------------------------------------------------------------- Ausgrabung Akrotiri
  const placeSeal = (id, flag, text) => async (g) => {
    if (g.flag('tor_offen')) return 'Das Tor ist offen. Die Siegel haben ihre Arbeit getan.';
    g.drop(id); g.set(flag); const n = g.inc('siegel_im_tor'); g.fx('stone'); g.repaint();
    await g.say('falk', text);
    if (n === 3) {
      g.fx('hum');
      await g.message('Ein Ruck geht durch den Stein. Die drei Ringe lösen sich aus ihrer Fassung, kaum einen Fingerbreit, und stehen frei.', 2600);
      await g.say('falk', 'Jetzt drehen sie sich. Die Frage ist, wohin.');
    } else await g.say('falk', n === 1 ? 'Es sitzt fest. Zwei Vertiefungen sind noch leer.' : 'Noch eine Vertiefung.');
  };
  async function gateOpens(g) {
    g.set('tor_offen'); g.repaint(); g.fx('stone');
    await g.message('Die Ringe drehen sich ein letztes Mal von selbst, dann fährt ein Riss durch den Stein. Das Tor teilt sich in der Mitte und weicht zurück, als wäre es nie schwer gewesen.', 3200);
    await g.say('falk', 'Ein Gang. Dahinter Dunkelheit, und Luft, die nach heißem Stein riecht.');
    await g.say('falk', 'Livia hätte das sehen sollen.');
    await g.scene(async () => {
      g.place('vesper', -40, 520, 'r'); g.place('kessler', -100, 545, 'r'); g.place('livia', -70, 540, 'r');
      await g.say('vesper', 'Sie hat es gesehen, Dr. Falk. Von hier.');
      g.face('falk', 'l');
      await g.walk('vesper', 520, 520, 'r');
      await g.walk('kessler', 380, 548, 'r'); await g.walk('livia', 430, 542, 'r');
      g.face('kessler', 'r'); g.face('livia', 'r');
      await g.say('livia', 'Adrian. Sie waren im Hafen, drei Minuten nachdem du weg warst. Mit dem zweiten Beiboot.');
      await g.say('kessler', 'Stavros hat uns sehr wohl gesehen. Er hat nur nichts gesagt. Kluger Mann.');
      await g.say('vesper', 'Konrad Vesper. Wir sind uns nie begegnet, aber ich kenne Ihre Arbeit. Die Keramik von Phylakopi, 1929. Ordentlich. Vorsichtig.');
      await g.say('falk', 'Und ich kenne Ihre. Whitmore, New York, Kreta. Auch ordentlich. Weniger vorsichtig.');
      await g.say('vesper', 'Ich habe zwei Jahre an diesem Stein gestanden. Mit Sprengstoff, mit Säure, mit Geduld. Sie haben zwanzig Minuten gebraucht. Ich bin nicht zu stolz, das anzuerkennen.');
      await g.say('falk', 'Was wollen Sie da unten?');
      await g.say('vesper', 'Was die Atlanter konnten, gehört dem, der es sich nimmt. Sie haben Kraft aus Metall gewonnen, Dr. Falk. Nicht aus Kohle, nicht aus Öl. Aus einem Metall, das man in der Hand halten kann.');
      await g.say('vesper', 'Die Welt wird in wenigen Jahren um Kohle und Öl kämpfen. Ich möchte dann etwas Besseres in der Hand haben.');
      await g.say('falk', 'Platon sagt, die Atlanter sind untergegangen.');
      await g.say('vesper', 'Platon sagt vieles. Das Medaillon, bitte. Dr. Marsh hat mir versichert, dass Sie es tragen.');
      await g.say('livia', 'Ich habe nichts versichert.');
      await g.say('kessler', 'Sie haben es gesagt, als ich den Arm etwas höher genommen habe.');
      await g.dialog('vesper_tor');
      await g.walk('falk', 570, 526, 'l');
      g.drop('medaillon'); g.fx('drop');
      await g.message('Falk legt das Medaillon in Vespers Hand. Es ist kalt.', 2000);
      await g.say('vesper', 'Danke. Die Perle aus der Wächterfigur behalten Sie. Dr. Marsh sagt, unten wartet eine Bühne, die ohne sie nicht fährt. Ich glaube ihr. Diesmal.');
      await g.say('vesper', 'Sie gehen voraus. Sie haben die Siegel gefunden; Sie haben ein Gespür für diese Dinge. Ich habe Kessler.');
      await g.say('falk', 'Und wenn da unten etwas wartet?');
      await g.say('vesper', 'Dann wartet es zuerst auf Sie. Das ist der Sinn der Sache. Dr. Marsh bleibt bei uns, bis Sie zurück sind. Oder bis wir nachkommen.');
      await g.say('livia', 'Geh. Und lass dir Zeit. Ich komme klar.');
      await g.say('falk', 'Du kommst nie klar. Deshalb bin ich hier.');
      g.set('livia_gefangen'); g.set('th_fertig');
      g.objective('Vorausgehen. Livia ist in Kesslers Hand.');
      await g.walk('falk', 820, 472, 'u');
      await g.goto('th_descent', 140, 520, 'r');
    });
  }

  ATL.dialogs.define('vesper_tor', {
    nodes: {
      root: {
        options: [
          { text: 'Sie bekommen es nicht.', once: true, say: [['vesper', 'Herr Kessler.'], ['kessler', 'Der Arm geht noch höher.'], ['livia', 'Adrian. Gib es ihm. Es ist ein Stück Metall.']] },
          { text: 'Lassen Sie Livia gehen, dann gebe ich es Ihnen.', once: true, say: [['vesper', 'Dr. Marsh bleibt, wo sie ist. Sie ist meine Versicherung. Das Medaillon ist nur ein Schlüssel, und Schlüssel kann man ersetzen.']] },
          { text: 'Was, wenn ich es ins Meer werfe?', once: true, say: [['vesper', 'Dann tauche ich danach. Ich habe Zeit, Dr. Falk. Dr. Marsh hat weniger.']] },
          { text: 'Hier. Nehmen Sie es.', end: true, silent: true },
        ],
      },
    },
  });

  R({
    id: 'th_akrotiri', name: 'Ausgrabung Akrotiri', ambient: 'thera',
    start: [120, 520, 'r'],
    walk: [[40, 446, 920, 446, 940, 585, 30, 585]],
    scale: { y0: 430, s0: 0.78, y1: 585, s1: 1.05 },
    paint(ctx, g) {
      A.sky(ctx, 960, 200, '#8ab8e0', '#e8dcc8');
      // Bimswand: die Grabungskante, dreißig Meter Asche in Bändern
      A.rect(ctx, 0, 40, 960, 280, '#d8ccb0');
      const bands = ['#e8e0cc', '#c8bca0', '#b0a488', '#d0c4a8', '#9a8e78', '#e0d4b8'];
      for (let i = 0; i < 12; i++) A.poly(ctx, [0, 40 + i * 24, 960, 34 + i * 24 + (i % 3) * 4, 960, 46 + i * 24 + (i % 3) * 4, 0, 52 + i * 24], bands[i % bands.length]);
      const rk = ATL.U.rng(44);
      for (let i = 0; i < 160; i++) A.circle(ctx, rk() * 960, 44 + rk() * 270, 1 + rk() * 3, 'rgba(90,80,60,0.35)');
      A.rect(ctx, 0, 36, 960, 6, '#7a6a50');
      for (let x = 10; x < 960; x += 37) A.line(ctx, x, 38, x + 4, 24, '#6a7a3a', 2);
      ctx.fillStyle = A.grad(ctx, 0, 120, 0, 320, ['rgba(0,0,0,0)', 'rgba(40,30,20,0.35)']); ctx.fillRect(0, 120, 960, 200);
      // Boden der Grabung: gestampfte Asche, die alte Straße
      A.ground(ctx, 0, 320, 960, 280, '#a89a80', '#6a5e4c');
      A.poly(ctx, [0, 320, 960, 320, 960, 440, 0, 440], 'rgba(120,100,80,0.35)');
      A.floorTiles(ctx, 960, 440, 600, 'rgba(0,0,0,0)', 'rgba(0,0,0,0)', 10, 480);
      // Häuser der Bronzezeit
      const house = (x, y, w, h, seed) => { A.stones(ctx, x, y, w, h, '#a89878', seed, 18); A.rect(ctx, x, y, w, 6, '#7a6a50'); for (let bx = x + 14; bx < x + w - 10; bx += 28) A.rect(ctx, bx, y + 10, 8, 8, '#3a2e22'); };
      house(300, 150, 210, 290, 51);
      A.rect(ctx, 320, 330, 44, 110, '#1a1410'); A.rect(ctx, 316, 326, 52, 8, '#5a4a3a');
      A.rect(ctx, 440, 320, 30, 30, '#1a1410'); A.line(ctx, 455, 320, 455, 350, '#5a4a3a', 3);
      house(520, 170, 170, 270, 52);
      A.rect(ctx, 540, 330, 40, 110, '#1a1410'); A.rect(ctx, 536, 326, 48, 8, '#5a4a3a');
      A.rect(ctx, 620, 320, 30, 30, '#1a1410'); A.line(ctx, 635, 320, 635, 350, '#5a4a3a', 3);
      A.stairs(ctx, 660, 440, 60, 6, 12, '#8a7a60', 'l');
      // Fresko der Schiffe
      A.fresco(ctx, 330, 196, 150, 104, 3, ['#2f5f8a', '#d8b56a', '#e7d5b0', '#b34a3a']);
      A.rect(ctx, 336, 202, 138, 32, 'rgba(216,181,106,0.7)');
      for (let k = 0; k < 7; k++) A.rect(ctx, 342 + k * 19, 206 + (k % 2) * 6, 12, 22 - (k % 2) * 6, k % 3 ? '#e7d5b0' : '#b34a3a');
      A.rect(ctx, 336, 236, 138, 60, 'rgba(47,95,138,0.55)');
      for (let i = 0; i < 3; i++) { const sx = 344 + i * 44, sy = 254 + (i % 2) * 16; A.poly(ctx, [sx, sy, sx + 36, sy, sx + 32, sy + 8, sx + 4, sy + 8], '#3a2a1a'); A.line(ctx, sx + 18, sy, sx + 18, sy - 16, '#3a2a1a', 2); A.poly(ctx, [sx + 18, sy - 16, sx + 30, sy - 6, sx + 18, sy - 4], '#e7d5b0'); for (let k = 0; k < 5; k++) A.line(ctx, sx + 4 + k * 7, sy + 8, sx + 2 + k * 7, sy + 14, '#3a2a1a', 1); }
      for (let i = 0; i < 6; i++) A.path(ctx, [340 + i * 22, 290, 348 + i * 22, 286, 356 + i * 22, 290], '#8fb8d8', 2);
      // Frühlingsfresko: Lilien und Schwalben
      A.fresco(ctx, 530, 190, 140, 100, 5, ['#e7d5b0', '#d8b56a', '#e7d5b0', '#c9a86a']);
      A.poly(ctx, [530, 290, 550, 272, 580, 282, 610, 262, 640, 276, 670, 268, 670, 290], '#c08a5a'); A.poly(ctx, [530, 290, 560, 280, 600, 286, 640, 280, 670, 290], '#a06a4a');
      for (let i = 0; i < 5; i++) { const lx = 545 + i * 26; A.line(ctx, lx, 280, lx + 2, 246, '#3d6e4a', 2); for (let k = 0; k < 3; k++) { const a = -2.2 + k * 1.1; A.ell(ctx, lx + 2 + Math.cos(a) * 7, 244 + Math.sin(a) * 5, 6, 3, '#b34a3a'); } }
      const swallow = (x, y) => { A.path(ctx, [x - 11, y - 5, x, y, x + 11, y - 5], '#2a3a5a', 2.5); A.path(ctx, [x, y, x + 3, y + 8, x - 3, y + 8], '#2a3a5a', 1.5); };
      swallow(560, 208); swallow(598, 222); swallow(640, 204);
      // Pithoi
      for (const [px, ph] of [[470, 0], [500, 6]]) { A.rr(ctx, px, 390 + ph, 30, 50 - ph, 12, '#9a7a52'); A.ell(ctx, px + 15, 390 + ph, 15, 5, '#7a5a3a'); A.spirals(ctx, px + 2, 402 + ph, 26, 10, '#5a3a2a'); }
      // Vespers Lager auf der Terrasse links
      A.tent(ctx, 125, 420, 130, 110, '#c8c0a8');
      if (g.flag('zelt_offen')) { A.poly(ctx, [105, 420, 145, 420, 125, 360], '#1a1410'); A.rect(ctx, 110, 398, 30, 5, '#5a4a3a'); A.rect(ctx, 112, 403, 4, 14, '#5a4a3a'); A.rect(ctx, 134, 403, 4, 14, '#5a4a3a'); A.rect(ctx, 114, 390, 22, 8, '#e8e0c8'); if (!g.flag('brecheisen_genommen')) { A.line(ctx, 108, 416, 132, 404, '#666', 3); A.line(ctx, 132, 404, 136, 408, '#666', 3); } }
      A.tent(ctx, 250, 424, 130, 100, '#8a8a6a');
      A.crate(ctx, 176, 406, 52, 34, '#7a5e40', 'M.-G.'); A.crate(ctx, 186, 374, 44, 32, '#8a6a48', 'BERLIN'); A.crate(ctx, 232, 412, 40, 28, '#6a5a3a', '');
      A.rect(ctx, 40, 376, 6, 64, '#3a2e22'); A.lantern(ctx, 43, 378, 0, false);
      A.table(ctx, 56, 396, 70, 8, '#6a5a3a', 34); A.rect(ctx, 62, 388, 40, 8, '#e8e0c8'); A.rect(ctx, 100, 386, 20, 10, '#3a3a3a');
      // Das schwarze Tor
      A.poly(ctx, [696, 470, 696, 116, 740, 96, 900, 96, 944, 116, 944, 470], '#3a3a3c');
      A.stones(ctx, 700, 100, 240, 36, '#2e2e30', 61, 24);
      if (!g.flag('tor_offen')) {
        ctx.fillStyle = A.grad(ctx, 720, 130, 920, 470, ['#1c1c20', '#2c2a30', '#141416']); A.rr(ctx, 720, 130, 200, 340, 10, ctx.fillStyle);
        for (let r = 0; r < 3; r++) { const ro = 92 - r * 30; A.circle(ctx, 820, 300, ro, null, '#0a0a0c', 7); A.circle(ctx, 820, 300, ro, null, '#4a4a54', 2); }
        const S = SYM();
        for (let r = 0; r < 3; r++) { const rm = 92 - r * 30 - 15; for (let i = 0; i < 8; i++) { const a = -Math.PI / 2 + (i / 8) * Math.PI * 2 + r * 0.35; ctx.fillStyle = '#7a7a84'; S[i].draw(ctx, 820 + Math.cos(a) * rm, 300 + Math.sin(a) * rm, 6.5 - r * 1.5); } }
        A.circle(ctx, 820, 300, 12, '#0a0a0c'); A.circle(ctx, 820, 300, 12, null, '#4a4a54', 2);
        const seals = [['tor_sonne', 'sun', '#e0b84a'], ['tor_stier', 'bull', '#b8956a'], ['tor_flut', 'flood', '#6fa8c8']];
        seals.forEach(([f, k, c], i) => { const sx = 770 + i * 50; A.circle(ctx, sx, 424, 15, '#0a0a0c'); A.circle(ctx, sx, 424, 15, null, '#4a4a54', 1.5); if (g.flag(f)) A.seal(ctx, sx, 424, 12, k, c); });
        A.ell(ctx, 820, 466, 70, 8, 'rgba(0,0,0,0.35)');
      } else {
        A.rect(ctx, 720, 130, 200, 340, '#050506');
        ctx.fillStyle = A.grad(ctx, 740, 130, 900, 470, ['rgba(255,120,60,0.18)', 'rgba(0,0,0,0)']); ctx.fillRect(720, 130, 200, 340);
        A.poly(ctx, [720, 130, 762, 142, 762, 470, 720, 470], '#26262a'); A.poly(ctx, [878, 142, 920, 130, 920, 470, 878, 470], '#26262a');
        for (let r = 0; r < 3; r++) { const ro = 92 - r * 30; ctx.strokeStyle = '#4a4a54'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(762, 300, ro * 0.45, Math.PI * 0.5, Math.PI * 1.5); ctx.stroke(); ctx.beginPath(); ctx.arc(878, 300, ro * 0.45, -Math.PI * 0.5, Math.PI * 0.5); ctx.stroke(); }
        A.stairs(ctx, 740, 470, 160, 4, 10, '#1a1a1c', 'r');
      }
      A.vignette(ctx, 960, 600, 0.42);
      A.grain(ctx, 960, 600, 8, 0.04);
    },
    animate(ctx, t, g) {
      if (g.flag('tor_offen')) A.glow(ctx, 820, 300, 180, 'rgba(255,120,60,0.6)', 0.28 + Math.sin(t * 2) * 0.08);
      else if ((g.flag('siegel_im_tor') || 0) === 3) A.glow(ctx, 820, 300, 120 + Math.sin(t * 3) * 10, 'rgba(120,255,220,0.5)', 0.22);
    },
    hotspots: [
      { id: 'bimswand', name: 'Bimswand', rect: [0, 36, 960, 110], at: [480, 470, 'u'],
        look: async (g) => { await g.say('falk', 'Die Grabungskante. Dreißig Meter Bims und Asche, in Bändern, Ausbruch für Ausbruch. Die Häuser standen darunter wie in einer Schachtel.'); g.codex('thera'); },
        take: 'Bims habe ich gesehen. Ich brauche nicht die ganze Wand.' },
      { id: 'haus_west', name: 'Haus mit den Schiffen', rect: [300, 150, 210, 40], at: [405, 480, 'u'],
        look: 'Zwei Stockwerke, Fensterhöhlen, Balkenlöcher. 1932 stand hier der Bims noch bis zum Dach. Livia hat das Fresko freigelegt, mit einem Pinsel und drei Wochen Geduld.',
        open: 'Die Tür ist offen. Seit dreitausend Jahren.', use: 'Ich habe die Häuser 1932 vermessen. Sie haben sich nicht bewegt.' },
      { id: 'tuer_west', name: 'Türöffnung', rect: [316, 326, 52, 114], at: [342, 480, 'u'],
        look: 'Eine Tür ohne Tür. Dahinter ein Raum mit einer Steinbank und einem Fenster zur Straße. Die Leute hatten Zeit zu packen. Sie haben nichts vergessen, das sich lohnen würde.',
        use: 'Da drin ist nichts, was ich nicht 1932 schon inventarisiert hätte.' },
      { id: 'fresko_schiffe', name: 'Fresko der Schiffe', rect: [330, 196, 150, 104], at: [405, 480, 'u'],
        look: async (g) => { await g.say('falk', 'Ein Fries: Schiffe, mit Rudern und Sonnensegeln, fahren von einer Stadt zu einer anderen. Delphine dazwischen. Leute auf den Dächern, die winken.'); await g.say('falk', 'Wer immer das gemalt hat, ist zur See gefahren. Die Schiffe sind richtig gebaut. Das Meer ist blau, wie es hier blau ist.'); g.codex('fresken'); },
        take: 'Es sitzt auf dem Putz. Ich müsste die Wand mitnehmen.', use: 'Ich habe es angesehen. Mehr kann man mit einem Fresko nicht tun.' },
      { id: 'fresko_fruehling', name: 'Fresko der Schwalben', rect: [530, 190, 140, 100], at: [600, 480, 'u'],
        look: async (g) => { await g.say('falk', 'Rote Lilien auf roten Felsen, und darüber Schwalben. Zwei davon im Flug, Schnabel an Schnabel. Frühling, vor dreitausend Jahren.'); await g.say('falk', 'Livia hat 1932 vor diesem Bild gestanden und geweint. Ich habe es fotografiert. Das war unser Unterschied, in einem Satz.'); g.codex('fresken'); },
        take: 'Nein.', use: 'Ich sehe es an. Das reicht.' },
      { id: 'haus_ost', name: 'Haus mit den Schwalben', rect: [520, 170, 170, 20], at: [600, 480, 'u'],
        look: 'Das zweite Haus. Innen eine Treppe aus Stein, die ins Obergeschoss führt. Das Obergeschoss ist der Bims.' },
      { id: 'treppe', name: 'Steintreppe', rect: [660, 380, 60, 60], at: [640, 480, 'u'],
        look: 'Eine Treppe aus Steinplatten, sechs Stufen, dann Bims. Sie führte in ein Obergeschoss, das es nicht mehr gibt.',
        use: 'Sechs Stufen und dann Fels. Nichts zu holen.' },
      { id: 'pithoi', name: 'Pithoi', rect: [466, 384, 70, 56], at: [500, 480, 'u'],
        look: 'Vorratsgefäße, mannshoch, mit Spiralen verziert. Sie standen an der Straße, wie Mülltonnen heute. Sie enthielten Öl, Getreide, Wein.',
        open: 'Leer, bis auf dreitausend Jahre alten Staub. Ich habe 1932 nachgesehen.', take: 'Zu groß und zu alt.', use: 'Ich brauche kein Öl. Ich habe eine Lampe mit Öl.',
        useWith: { flasche: 'Ich fülle keine Museumsstücke.', default: 'Das gehört nicht in einen Pithos.' } },
      { id: 'zelt_vesper', name: 'Vespers Zelt', rect: [60, 310, 130, 110], at: [125, 480, 'u'],
        look: (g) => g.flag('zelt_offen') ? 'Vespers Zelt. Ein Feldbett, ein Tisch, ein Koffer mit Monogramm. Alles gerade ausgerichtet, wie mit dem Lineal.' : 'Ein Zelt mit geschlossenem Vorhang, sauber gespannt wie ein Offizierszelt. Vor dem Eingang ist der Boden gefegt. Gefegt.',
        open: async (g) => { if (g.flag('zelt_offen')) return 'Es ist offen.'; g.set('zelt_offen'); g.repaint(); g.fx('whoosh'); await g.say('falk', 'Ein Feldbett, ein Tisch, ein Koffer mit Monogramm. Auf dem Tisch Notizen, darunter Werkzeug. Ein Brecheisen.'); },
        use: (g) => g.hs('zelt_vesper').open(g), close: (g) => g.flag('zelt_offen') ? 'Ich lasse es offen. Er soll wissen, dass jemand hier war.' : 'Es ist zu.',
        take: (g) => g.flag('zelt_offen') && !g.flag('brecheisen_genommen') ? g.hs('brecheisen').take(g) : 'Das Zelt bleibt hier. Ich zelte nicht.' },
      { id: 'notizen', name: 'Vespers Notizen', rect: [108, 386, 30, 14], at: [125, 480, 'u'], cond: (g) => g.flag('zelt_offen'),
        look: 'Ein Notizbuch, aufgeschlagen. Eine kleine, sehr gleichmäßige Handschrift.',
        use: async (g) => { await g.puzzle('note', { title: 'Notizen, K. V.', text: 'Tor: Basalt, Oberfläche unversehrt. Sprengung 3. Juni ohne Wirkung. Säure ohne Wirkung.\nDrei Vertiefungen, Durchmesser 9 cm, Tiefe 2 cm. Die Ringe sitzen fest, solange die Vertiefungen leer sind. Wir haben es mit Abgüssen versucht. Nichts.\n\nFalk hat Sais verlassen, mit dem, was wir suchen. K. meldet: Kreta erledigt, Eridu vermutlich. Er wird kommen. Die Marsh bringt ihn her, ob er will oder nicht.\n\nWir warten. Es ist das Einfachste, was wir je getan haben.' }); if (!g.flag('notizen_gelesen')) { g.set('notizen_gelesen'); await g.say('falk', '„Er wird kommen.“ Er hat recht behalten. Das ist das Ärgerliche an Leuten wie Vesper.'); } },
        open: (g) => g.hs('notizen').use(g), take: 'Ich lasse sie liegen. Das Brecheisen wird er nicht vermissen, die Notizen schon.' },
      { id: 'brecheisen', name: 'Brecheisen', rect: [104, 400, 36, 20], at: [125, 480, 'u'], cond: (g) => g.flag('zelt_offen') && !g.flag('brecheisen_genommen'),
        look: 'Ein Brecheisen, sechzig Zentimeter, gutes Stahl. Es hat Kratzer, als hätte jemand damit auf Stein eingeschlagen.',
        take: async (g) => { g.anim('falk', 'crouch'); await g.wait(500); g.anim('falk', 'stand'); g.take('brecheisen'); g.set('brecheisen_genommen'); g.repaint(); return 'Das nehme ich. Vesper hat es am Tor nicht gebraucht, und ich habe das Gefühl, ich brauche es noch.'; },
        use: (g) => g.hs('brecheisen').take(g) },
      { id: 'zelt_mannschaft', name: 'Mannschaftszelt', rect: [190, 324, 120, 100], at: [250, 480, 'u'],
        look: 'Ein größeres Zelt. Feldbetten, ein Kanister, ein Kochtopf. Die Mannschaft. Sie sind nicht da.',
        open: 'Vier Feldbetten, ein Kartenspiel, ein Gewehr an der Zeltstange. Ich fasse nichts davon an.',
        take: 'Das Gewehr? Ich bin Archäologe. Ich würde mir in den Fuß schießen.', use: 'Ich habe keinen Bedarf an Feldbetten.' },
      { id: 'kisten', name: 'Kisten', rect: [164, 350, 100, 74], at: [214, 480, 'u'],
        look: '„Meridian-Gesellschaft, Berlin.“ Werkzeug, Seile, Lampen. Und eine leere Kiste mit der Aufschrift „Sprengstoff“. Leer.',
        open: 'Seile, Lampen, Spaten. Alles, was man für ein Tor braucht, das nicht aufgeht.', take: 'Ich habe, was ich brauche.',
        useWith: { brecheisen: 'Sie sind nicht zugenagelt. Man hebt den Deckel.', default: 'Das lasse ich nicht in Vespers Kisten.' } },
      { id: 'laterne', name: 'Laterne', rect: [30, 350, 26, 50], at: [70, 480, 'u'],
        look: 'Eine Sturmlaterne an einem Pfahl. Für die Nächte, in denen Vesper vor dem Tor gesessen hat.', take: 'Ich habe eine Lampe.', use: 'Es ist noch hell.' },
      { id: 'tisch', name: 'Tisch', rect: [56, 384, 70, 20], at: [90, 480, 'u'],
        look: 'Ein Klapptisch mit Karten von Thera, einem Zirkel und einem Feldstecher. Vesper arbeitet ordentlich. Das macht es nicht besser.',
        take: 'Den Feldstecher? Ich sehe auch so, was ich sehen muss.', use: 'Die Karten kenne ich. Ich habe die Hälfte davon gezeichnet.' },
      { id: 'tor', name: 'Das schwarze Tor', rect: [700, 100, 244, 372], at: [820, 490, 'u'],
        look: (g) => {
          if (g.flag('tor_offen')) return 'Das Tor steht offen. Dahinter Stufen, die nach unten führen, und ein Geruch nach heißem Stein.';
          const n = g.flag('siegel_im_tor') || 0;
          if (n === 3) return 'Drei Siegel in drei Vertiefungen, und die Ringe stehen frei. Acht Zeichen auf jedem Ring: Sonne, Mond, Welle, Berg, Stern, Auge, Spirale, Dreizack.';
          if (n > 0) return `Das schwarze Tor. ${n === 1 ? 'Ein Siegel steckt, zwei Vertiefungen sind leer.' : 'Zwei Siegel stecken, eine Vertiefung ist leer.'}`;
          return 'Ein Tor aus schwarzem Stein, glatt wie Glas. Drei Ringe darauf, ineinander, mit Zeichen. Darunter drei runde Vertiefungen. Ich habe es 1932 zuletzt gesehen, unter Bims. Vesper hat es freigelegt und mit Sprengstoff versucht. Nicht ein Kratzer.';
        },
        use: async (g) => {
          if (g.flag('tor_offen')) return 'Es ist offen. Ich sollte hineingehen, bevor ich es mir anders überlege.';
          const n = g.flag('siegel_im_tor') || 0;
          if (n === 0) return 'Drei Vertiefungen, drei Siegel. Ohne die Siegel rühren sich die Ringe nicht. Das hat Vesper mit Sprengstoff herausgefunden, ich glaube es ihm.';
          if (n < 3) return n === 1 ? 'Zwei Siegel fehlen noch. Die Ringe sitzen fest.' : 'Ein Siegel fehlt noch. Die Ringe sitzen fest.';
          if (!g.flag('tor_hinweis')) {
            g.set('tor_hinweis');
            await g.say('falk', 'Die Ringe lassen sich drehen. Drei Ringe, drei Siegel: Sonne außen, Stier in der Mitte, Flut innen. Und acht Zeichen auf jedem.');
            await g.say('falk', g.has('solontext') ? 'Solon hat aufgeschrieben, wohin jedes Siegel weisen muss. Die Abschrift der Stele habe ich bei mir. Ich sollte sie lesen, bevor ich drehe.' : 'Solon hat aufgeschrieben, wohin jedes Siegel weisen muss. Ich hätte die Stele abschreiben sollen.');
          }
          const ok = await g.puzzle('dial', { solution: ATL.story.solution(g) });
          if (!ok) return 'Ich trete zurück. Die Ringe stehen, wie sie stehen.';
          await gateOpens(g);
        },
        open: (g) => g.hs('tor').use(g),
        push: (g) => (g.flag('siegel_im_tor') || 0) < 3 ? 'Die Ringe sitzen fest. Nicht einmal Vespers Sprengstoff hat sie bewegt.' : 'Mit Bedacht, nicht mit Gewalt. Ich sollte sie drehen.',
        pull: (g) => g.hs('tor').push(g), close: 'Es ist zu. Seit dreitausend Jahren.',
        take: 'Das Tor wiegt so viel wie das Haus daneben.',
        useWith: {
          sonnensiegel: placeSeal('sonnensiegel', 'tor_sonne', 'Das Siegel der Sonne passt in die linke Vertiefung, als wäre es gestern herausgenommen worden.'),
          stiersiegel: placeSeal('stiersiegel', 'tor_stier', 'Der Stier in die Mitte. Es rastet ein, mit einem Klang wie eine Glocke unter Wasser.'),
          flutsiegel: placeSeal('flutsiegel', 'tor_flut', 'Die Flut rechts. Das blaue Siegel wird kalt in der Hand, bevor es einrastet.'),
          solontext: async (g) => { await g.say('falk', 'Ich lese sie noch einmal.'); await ATL.items.get('solontext').use(g); },
          brecheisen: 'Vesper hat es mit Sprengstoff versucht. Ein Brecheisen wird es nicht besser machen.',
          perle: 'Die Perle wird warm, wenn ich sie ans Tor halte. Aber sie passt in keine der Vertiefungen. Sie ist zu klein.',
          medaillon: 'Das Medaillon hat drei Ringe, das Tor hat drei Ringe. Aber hier ist kein Platz dafür. Noch nicht.',
          default: 'Das passt in keine der Vertiefungen.',
        } },
    ],
    exits: [
      { id: 'pfad', name: 'Pfad zur Bucht', rect: [0, 200, 40, 360], at: [50, 520, 'l'], to: 'th_cliff', pos: [780, 490], dir: 'd',
        look: 'Der Pfad zurück zur Bucht. Stavros wartet unten.',
        before: async (g) => { if (g.flag('tor_offen')) { await g.say('falk', 'Nicht jetzt. Das Tor ist offen.'); return false; } return true; } },
      { id: 'torgang', name: 'Gang hinter dem Tor', rect: [762, 140, 116, 330], at: [820, 490, 'u'], to: 'th_descent', pos: [140, 520], dir: 'r', z: 4, cond: (g) => g.flag('tor_offen'),
        look: 'Stufen hinunter in den Berg.' },
    ],
    async enter(g) {
      if (g.flag('th_akrotiri_besucht')) return;
      g.set('th_akrotiri_besucht');
      await g.say('falk', 'Die Grabung. 1932 haben wir hier gestanden, mit zwei Arbeitern und einem Zelt. Vesper hat drei Zelte und keinen Arbeiter. Sie sind alle weg.');
      await g.say('falk', 'Und da hinten, wo wir aufgehört haben: das Tor. Freigelegt bis zum Boden.');
      g.objective('Das Tor mit den drei Siegeln öffnen.');
    },
  });

  // ---------------------------------------------------------------- Lavaröhre mit der Hebebühne
  R({
    id: 'th_descent', name: 'Lavaröhre unter Akrotiri', ambient: 'atlantis',
    start: [140, 520, 'r'],
    walk: [[40, 452, 900, 452, 920, 585, 852, 585, 840, 556, 560, 556, 548, 585, 40, 585]],
    scale: { y0: 430, s0: 0.8, y1: 585, s1: 1.05 },
    paint(ctx, g) {
      ctx.fillStyle = A.grad(ctx, 0, 0, 0, 600, ['#120e0e', '#2a1e1a', '#1a1412']); ctx.fillRect(0, 0, 960, 600);
      // Röhre: Fließrillen der Lava an den Wänden
      for (let i = 0; i < 16; i++) { const y = 30 + i * 28; A.path(ctx, [0, y, 160, y + 12 + (i % 3) * 6, 340, y - 8, 470, y + 6, 560, y + 2], `rgba(110,80,66,${0.2 + (i % 4) * 0.08})`, 3); }
      for (let i = 0; i < 12; i++) { const y = 60 + i * 34; A.path(ctx, [840, y + 4, 900, y - 6, 960, y + 8], `rgba(110,80,66,${0.2 + (i % 3) * 0.1})`, 3); }
      ctx.fillStyle = '#0d0909'; ctx.beginPath(); ctx.moveTo(-40, 470); ctx.quadraticCurveTo(260, -90, 640, 110); ctx.lineTo(640, -10); ctx.lineTo(-40, -10); ctx.closePath(); ctx.fill();
      for (let i = 0; i < 4; i++) { ctx.strokeStyle = `rgba(70,52,46,${0.5 - i * 0.1})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-40, 470 - i * 30); ctx.quadraticCurveTo(260 - i * 40, -90 + i * 60, 640, 110 - i * 20); ctx.stroke(); }
      ctx.strokeStyle = '#3e302a'; ctx.lineWidth = 16; ctx.beginPath(); ctx.moveTo(-40, 470); ctx.quadraticCurveTo(260, -90, 640, 110); ctx.stroke();
      ctx.strokeStyle = '#2e2420'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(-30, 430); ctx.quadraticCurveTo(250, -40, 600, 130); ctx.stroke();
      // Gang zurück nach oben (links)
      A.poly(ctx, [0, 200, 60, 230, 90, 320, 90, 460, 0, 470], '#0a0808');
      A.stairs(ctx, 0, 460, 90, 6, 14, '#2a2220', 'l');
      // Boden: erkaltete Lava, Risse
      A.ground(ctx, 0, 450, 960, 150, '#2c2422', '#120e0e');
      const rk = ATL.U.rng(71);
      for (let i = 0; i < 70; i++) A.ell(ctx, rk() * 960, 452 + rk() * 140, 10 + rk() * 40, 2 + rk() * 5, `rgba(70,58,50,${0.3 + rk() * 0.4})`);
      const cracks = [[120, 520, 200, 540, 260, 530, 330, 562], [40, 480, 90, 500, 150, 490], [380, 566, 440, 578, 520, 572], [860, 500, 900, 532, 940, 522], [300, 470, 360, 460, 420, 468]];
      for (const c of cracks) { A.path(ctx, c, '#3a0c08', 5); A.path(ctx, c, '#7a2010', 2); }
      // Der Schacht: Öffnung in der Rückwand, Führungsschienen, Säulen
      A.rect(ctx, 560, 100, 280, 480, '#050505');
      for (let y = 110; y < 470; y += 22) A.line(ctx, 566, y, 834, y, 'rgba(120,150,150,0.12)', 1);
      A.rect(ctx, 556, 100, 6, 480, '#4a5a58'); A.rect(ctx, 838, 100, 6, 480, '#4a5a58');
      for (let y = 120; y < 560; y += 40) { A.rect(ctx, 554, y, 10, 4, '#7a8a88'); A.rect(ctx, 836, y, 10, 4, '#7a8a88'); }
      A.column(ctx, 540, 470, 380, 30, '#6a7a78', 'atlantis'); A.column(ctx, 860, 470, 380, 30, '#6a7a78', 'atlantis');
      A.rect(ctx, 520, 78, 360, 14, '#5a6a68'); A.rect(ctx, 520, 92, 360, 4, 'rgba(120,255,220,0.35)');
      // Inschriftenband um den Schacht
      A.rect(ctx, 560, 196, 280, 44, '#22302e');
      ctx.strokeStyle = 'rgba(120,255,220,0.65)'; ctx.lineWidth = 1.5;
      for (let i = 0; i < 7; i++) { const x = 580 + i * 40; for (let r = 0; r < 3; r++) { ctx.beginPath(); ctx.arc(x, 218, 4 + r * 4, 0, Math.PI * 2); ctx.stroke(); } A.circle(ctx, x + 20, 212, 1.5, 'rgba(120,255,220,0.65)'); A.circle(ctx, x + 20, 224, 1.5, 'rgba(120,255,220,0.65)'); }
      // Schachtrand vor der Bühne
      A.rect(ctx, 556, 552, 288, 6, '#3a3a3c');
      A.vignette(ctx, 960, 600, 0.7);
      A.grain(ctx, 960, 600, 7, 0.06);
    },
    animate(ctx, t, g) {
      const p = 0.5 + Math.sin(t * 1.6) * 0.25;
      for (const [x, y, r] of [[200, 540, 80], [90, 492, 44], [450, 572, 60], [900, 522, 50], [360, 464, 40]]) A.glow(ctx, x, y, r, 'rgba(255,80,20,0.9)', p * 0.5);
      const dy = g.flag('buehne_dy') || 0;
      A.glow(ctx, 700, 520 + dy, 180, 'rgba(80,255,200,0.6)', g.flag('perle_im_sockel') ? 0.3 + Math.sin(t * 5) * 0.1 : 0.1);
      if (g.flag('perle_im_sockel')) A.glow(ctx, 700, 390 + dy, 50 + Math.sin(t * 6) * 6, 'rgba(120,255,200,1)', 0.6);
    },
    hotspots: [
      { id: 'buehne', name: 'Hebebühne', rect: [560, 476, 280, 80], at: [700, 522, 'd'],
        paint(ctx, g) {
          const dy = g.flag('buehne_dy') || 0, y = 515 + dy;
          A.ell(ctx, 700, y + 14, 140, 40, '#0a0c0c');
          ctx.fillStyle = A.grad(ctx, 560, y, 840, y, ['#2a3a3a', '#5a6a68', '#2a3a3a']); A.ell(ctx, 700, y, 140, 40, ctx.fillStyle);
          A.ell(ctx, 700, y, 140, 40, null, 'rgba(120,255,220,0.55)', 3); A.ell(ctx, 700, y, 90, 25, null, 'rgba(120,255,220,0.3)', 2); A.ell(ctx, 700, y, 40, 11, null, 'rgba(120,255,220,0.3)', 2);
          // Sockel
          A.rect(ctx, 684, y - 125, 32, 92, '#4a5a58'); A.rect(ctx, 678, y - 36, 44, 8, '#3a4a48'); A.ell(ctx, 700, y - 125, 16, 5, '#6a7a78'); A.circle(ctx, 700, y - 126, 6, '#0a0c0c');
          for (let yy = y - 110; yy < y - 45; yy += 16) A.line(ctx, 686, yy, 714, yy + 5, 'rgba(120,255,220,0.3)', 2);
          if (g.flag('perle_im_sockel')) A.circle(ctx, 700, y - 127, 6, '#5fd8b0');
          // Hebel
          A.rect(ctx, 792, y - 92, 16, 62, '#4a5a58'); A.rect(ctx, 786, y - 34, 28, 8, '#3a4a48');
          const pulled = g.flag('th_abgestiegen');
          A.line(ctx, 800, y - 82, 812, pulled ? y - 40 : y - 122, '#8a9a98', 5); A.circle(ctx, 812, pulled ? y - 40 : y - 122, 6, '#c8a848');
        },
        look: (g) => g.flag('perle_im_sockel') ? 'Die Scheibe zittert leicht, seit die Perle im Sockel sitzt. Der Schimmer am Rand ist jetzt ein Leuchten.' : 'Eine runde Scheibe aus dunklem Metall, sechs Schritt breit, in einem Schacht, der senkrecht nach unten geht. Am Rand ein grünlicher Schimmer, wie bei der Perle. Darauf ein Sockel und ein Hebel.',
        use: (g) => g.flag('perle_im_sockel') ? 'Ich stehe darauf. Jetzt der Hebel.' : 'Ich stehe darauf. Nichts passiert. Sie braucht etwas, das sie in Gang setzt.',
        push: 'Sie wiegt Tonnen. Und sie hängt an nichts, das ich sehen könnte.', pull: 'Sie wiegt Tonnen.', take: 'Sechs Schritt Metall. Nein.',
        useWith: { perle: 'Nicht auf die Bühne. In den Sockel dort; die Vertiefung passt.', seil: 'Ich brauche kein Seil, wenn die Bühne fährt. Und wenn sie nicht fährt, hilft es auch nicht.', default: 'Das gehört nicht auf die Bühne.' } },
      { id: 'sockel', name: 'Sockel', rect: [676, 386, 48, 96], at: [700, 500, 'u'],
        look: (g) => g.flag('perle_im_sockel') ? 'Die Perle sitzt im Sockel und leuchtet. Der Sockel summt, und das Summen geht durch die Schuhsohlen.' : 'Ein Sockel aus dem gleichen Metall, hüfthoch, mit einer Vertiefung oben. Rund, groß wie eine Haselnuss. Leer.',
        use: (g) => g.flag('perle_im_sockel') ? 'Ich lasse sie drin.' : 'Die Vertiefung ist leer. Etwas fehlt darin. Etwas Rundes, Warmes.',
        take: (g) => g.flag('perle_im_sockel') ? 'Sie sitzt fest, als wäre sie angewachsen. Und ehrlich gesagt: Ich will nicht, dass das Summen aufhört.' : 'Der Sockel ist Teil der Bühne.',
        push: 'Er ist Teil der Bühne.', open: 'Er ist massiv. Nur die Vertiefung oben ist offen.',
        useWith: {
          perle: async (g) => {
            if (g.flag('perle_im_sockel')) return 'Da sitzt schon eine.';
            g.drop('perle'); g.set('perle_im_sockel'); g.fx('glow'); g.fx('hum');
            await g.say('falk', 'Sie passt. Natürlich passt sie.');
            await g.message('Die Perle sinkt in die Vertiefung, als würde sie gezogen. Ein Summen beginnt, tief, unter der Hörgrenze. Der Rand der Scheibe leuchtet.', 2800);
            await g.say('falk', 'Sechs Jahre hat sie in einer Kiste in Vermont gelegen. Jetzt weiß ich, wofür sie gemacht wurde.');
            g.codex('orichalkum');
            g.objective('Den Hebel ziehen.');
          },
          stein: 'Ein Stein passt hinein. Er tut nichts. Ich nehme ihn wieder heraus.',
          bimsstein: 'Bims in einer atlantischen Maschine. Nein.',
          flasche: 'Wasser hilft hier nicht.',
          default: 'Das passt nicht in die Vertiefung.',
        } },
      { id: 'hebel', name: 'Hebel', rect: [782, 388, 40, 94], at: [800, 500, 'u'],
        look: 'Ein Hebel aus Metall, in einer Führung, die nach unten zeigt. Man muss kein Atlanter sein, um zu verstehen, was er tut.',
        pull: async (g) => {
          if (g.flag('th_abgestiegen')) return;
          if (!g.flag('perle_im_sockel')) { g.fx('click'); await g.say('falk', 'Der Hebel geht nach unten. Nichts passiert.'); await g.say('falk', 'Kein Ruck, kein Summen, nichts. Was diese Bühne antreibt, ist nicht da. Der Sockel ist leer.'); return; }
          g.set('th_abgestiegen');
          await g.scene(async () => {
            g.fx('click');
            await g.say('falk', 'Also gut.');
            await g.walk('falk', 700, 522, 'd');
            g.hero.fixedScale = g.hero.scale;
            g.fx('hum');
            await g.message('Das Summen wird tiefer. Die Scheibe zittert, dann sinkt sie.', 2200);
            g.codex('ringe');
            for (let i = 1; i <= 16 && !g.fast; i++) { g.set('buehne_dy', i * 9); g.hero.offsetY = i * 9; g.dark = Math.min(0.9, i * 0.055); await g.wait(110); }
            g.dark = 0.95;
            await g.message('Der Schacht schluckt das Licht der Risse. Es wird dunkel, und es wird warm. Dann setzt die Bühne auf.', 2800);
            g.fx('stone'); g.fx('thunder');
            await g.message('Hinter Falk löst sich Gestein aus der Schachtwand und verschüttet den Weg nach oben. Wer ihm folgen will, muss einen anderen finden.', 3000);
            g.set('buehne_dy', 0); g.dark = 0; g.hero.offsetY = 0; g.hero.fixedScale = null;
            await g.goto('at_outer', 200, 520, 'r');
          });
        },
        use: (g) => g.hs('hebel').pull(g), push: 'Er geht nur in eine Richtung: nach unten.', take: 'Er ist Teil der Bühne.',
        useWith: { seil: 'Ich muss ihn nicht aus der Ferne ziehen. Ich stehe daneben.', default: 'Der Hebel braucht eine Hand, sonst nichts.' } },
      { id: 'schacht', name: 'Schacht', rect: [560, 100, 280, 280], at: [700, 500, 'u'],
        look: 'Der Schacht. Glatt, rund, senkrecht. Zwei Schienen führen die Bühne. Im Licht der Risse sieht man zwanzig Meter weit nach unten, dann nichts mehr.',
        use: 'Ohne die Bühne? Ich bin kein Fallschirmspringer.',
        useWith: { seil: 'Zehn Meter Seil. Der Schacht ist tiefer, als ich sehen kann.', stein: 'Ich lasse einen Stein fallen und zähle. Bei zwölf höre ich auf zu zählen. Der Stein ist noch unterwegs.', default: 'Das werfe ich nicht in den Schacht.' } },
      { id: 'inschrift', name: 'Inschriftenband', rect: [560, 194, 280, 48], at: [700, 500, 'u'],
        look: async (g) => { await g.say('falk', 'Ein Band mit Zeichen, rund um den Schacht. Drei Ringe ineinander, dann Punkte, dann wieder drei Ringe. Wie auf dem Tor. Wie auf dem Medaillon.'); await g.say('falk', 'Platon lässt Kritias die Stadt beschreiben: drei Ringe aus Wasser, zwei aus Land, in der Mitte der Tempel. Livia hat das immer als Bauplan gelesen. Vielleicht ist es einer.'); g.codex('ringe'); },
        take: 'Es ist in das Metall geschnitten.' },
      { id: 'saeulen', name: 'Säulen', rect: [524, 78, 44, 392], at: [560, 500, 'u'],
        look: async (g) => { await g.say('falk', 'Zwei Säulen aus einem Metall, das im Licht grün schimmert, mit schrägen Rillen. Keine Kannelur, wie ich sie kenne. Nicht griechisch, nicht minoisch, nicht ägyptisch.'); await g.say('falk', 'Orichalkum, würde Livia sagen. „Bergkupfer.“ Ich sage: Ich weiß nicht, was es ist. Und das ist selten.'); g.codex('orichalkum'); },
        take: 'Sie tragen die Decke.', push: 'Sie tragen die Decke. Ich lasse sie stehen.',
        useWith: { brecheisen: 'Ich hebele nicht an Säulen, die eine Decke tragen.', default: 'Das bringt nichts.' } },
      { id: 'roehre', name: 'Lavaröhre', rect: [0, 0, 520, 200], at: [300, 500, 'u'],
        look: async (g) => { await g.say('falk', 'Eine Lavaröhre. Außen wird die Lava fest, innen fließt sie weiter, und wenn sie abläuft, bleibt ein Rohr. Die Wände sind glatt wie Glas, mit Rillen wie Fließspuren.'); await g.say('falk', 'Und jemand hat sie erweitert. Diese Kanten sind nicht von der Lava.'); },
        use: 'Ich kann sie nicht benutzen. Ich stehe darin.' },
      { id: 'risse', name: 'Glühende Risse', rect: [30, 470, 500, 110], at: [330, 500, 'd'], noWalk: true,
        look: 'Risse im Boden, aus denen es rot glüht. Der Berg schläft nicht, er döst. Und er ist näher, als mir lieb ist.',
        use: 'Ich stecke die Hand nicht hinein.', take: 'Glühende Lava? Ich habe keine Tasche dafür.',
        useWith: { flasche: 'Ich gieße kein Wasser auf glühenden Stein. Dampf, Splitter, keine Hand mehr.', oellampe: 'Sie brennt schon, wenn ich sie brauche. Hier brauche ich sie nicht.', bimsstein: 'Bims ins Feuer? Er ist schon einmal durchs Feuer gegangen.', default: 'Das gehört nicht in den Riss.' } },
    ],
    exits: [
      { id: 'zurueck', name: 'Gang nach oben', rect: [0, 200, 90, 270], at: [80, 520, 'l'],
        look: 'Die Stufen zurück zum Tor. Oben wartet Kessler, mit Livia.',
        before: async (g) => { await g.say('falk', 'Kessler steht am Tor, mit Livia. Der Weg zurück ist keiner.'); return false; } },
    ],
    async enter(g) {
      g.dark = 0;
      if (g.flag('th_descent_besucht')) return;
      g.set('th_descent_besucht');
      await g.say('falk', 'Eine Röhre im Berg, und am Ende ein Schacht mit einer Scheibe darin. Metall, in einer Lavaröhre. Das ist nicht minoisch.');
      await g.say('falk', 'Die Perle wird warm in der Tasche.');
      g.objective('Die Hebebühne in Gang bringen.');
    },
    leave(g) { g.dark = 0; },
  });
})(window.ATL);
