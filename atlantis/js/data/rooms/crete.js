/* Kapitel 4: Kreta. Fischerdorf, Taverne, Knossos, Pfeilerkrypta, Halle des Stiers. */
(function (ATL) {
  const A = ATL.A;
  const R = ATL.rooms.define;
  const SC = { y0: 400, s0: 0.75, y1: 585, s1: 1.05 };

  // ---------------------------------------------------------------- Kodex-Ergänzungen
  Object.assign(ATL.codex, {
    labrys: { title: 'Die Doppelaxt', origin: 'Minoische Kunst; Plutarch, Griechische Fragen 45', text: 'Die Doppelaxt ist eines der häufigsten Zeichen der minoischen Kultur. Sie erscheint als Ritzung auf Pfeilern und Steinblöcken in Knossos, als Weihegeschenk aus Bronze und Gold in Höhlenheiligtümern wie Arkalochori und als Motiv auf Gefäßen und Siegeln. Praktisch benutzbar waren die meisten Weihe-Äxte nicht; ihre Blätter sind zu dünn.\nDas Wort „labrys“ überliefert Plutarch als lydische Bezeichnung für die Axt. Arthur Evans verband es mit dem Namen Labyrinth, „Haus der Doppelaxt“. Die Deutung ist verbreitet, aber nicht bewiesen.' },
    knossos: { title: 'Knossos und Evans', origin: 'Archäologiegeschichte', text: 'Der Palast von Knossos bei Heraklion wurde ab 1900 von Arthur Evans ausgegraben, nachdem der kretische Kaufmann Minos Kalokairinos 1878 erste Magazine mit Pithoi freigelegt hatte. Evans fand ein Gebäude mit Hunderten von Räumen um einen zentralen Hof, Wandmalereien, Tontafeln in Linear A und Linear B und den steinernen Thron im sogenannten Thronsaal.\nEvans ließ Teile des Palastes mit Beton und bemalten Säulen wiederaufbauen. Diese Rekonstruktionen sind bis heute umstritten, weil sie seine Deutung festschreiben. Die „Pfeilerkrypten“ im Westflügel, deren Pfeiler mit Doppeläxten geritzt sind, hielt er für Kulträume.' },
  });

  // ---------------------------------------------------------------- Hilfen
  // Plan lesen: setzt eine Aufgabe, sobald Falk die Anmerkung kennt.
  const planItem = ATL.items.get('plan');
  if (planItem) {
    const origUse = planItem.use;
    planItem.use = async (g) => {
      if (origUse) await origUse(g);
      if (!g.flag('plan_gelesen')) {
        g.set('plan_gelesen');
        await g.say('falk', 'Krypta, drei Doppeläxte, die mittlere drücken. Bramwell nennt es Aberglauben und hat es aufgeschrieben. Das ist der ehrlichste Satz im ganzen Plan.');
        if (!g.flag('krypta_offen')) g.objective('Die Pfeilerkrypta unter Knossos finden und die mittlere Doppelaxt am Pfeiler drücken.');
      }
    };
  }

  // Weißes Haus mit blauen Fensterläden
  function house(ctx, x, y, w, h, o) {
    o = o || {};
    A.wall(ctx, x, y, w, h, '#f2ede2', o.seed || 3);
    A.rect(ctx, x - 5, y - 8, w + 10, 10, '#e2dacb');
    A.rect(ctx, x + w - 14, y, 14, h, 'rgba(0,0,0,0.10)');
    A.rect(ctx, x, y + h - 6, w, 6, 'rgba(0,0,0,0.12)');
    for (const [wx, wy] of o.windows || []) {
      A.rect(ctx, wx - 18, wy - 4, 72, 54, '#e0d8c8');
      A.window(ctx, wx, wy, 36, 46, { frame: '#2e5fa8', light: '#3a4a5a' });
      A.rect(ctx, wx - 16, wy - 2, 13, 50, '#2e5fa8'); A.rect(ctx, wx + 39, wy - 2, 13, 50, '#2e5fa8');
      for (let i = 0; i < 5; i++) { A.line(ctx, wx - 14, wy + 4 + i * 9, wx - 5, wy + 4 + i * 9, 'rgba(0,0,0,0.25)', 1); A.line(ctx, wx + 41, wy + 4 + i * 9, wx + 50, wy + 4 + i * 9, 'rgba(0,0,0,0.25)', 1); }
    }
    if (o.door) { const d = o.door; A.door(ctx, d[0], d[1], d[2], d[3], '#2e5fa8', { frame: '#dcd4c4', arch: true, knob: '#e8d090' }); }
  }

  // Ziege (Hotspot mit paint)
  function goat(ctx, x, y, withHat, t) {
    const sway = Math.sin(t * 2.2) * 2;
    A.ell(ctx, x, y - 2, 30, 6, 'rgba(0,0,0,0.25)');
    for (const lx of [-16, -6, 8, 18]) A.line(ctx, x + lx, y - 26, x + lx + (lx > 0 ? 2 : -2), y - 2, '#d8d0c0', 5);
    A.ell(ctx, x, y - 30, 30, 16, '#e6e0d2');
    A.ell(ctx, x - 6, y - 32, 18, 11, '#ded6c6');
    A.line(ctx, x - 30, y - 34, x - 38, y - 24, '#d8d0c0', 4);
    A.ell(ctx, x + 32, y - 44 + sway, 12, 9, '#e6e0d2');
    A.poly(ctx, [x + 40, y - 46 + sway, x + 52, y - 40 + sway, x + 42, y - 36 + sway], '#e6e0d2');
    A.line(ctx, x + 30, y - 52 + sway, x + 24, y - 66 + sway, '#8a7a5a', 3); A.line(ctx, x + 36, y - 52 + sway, x + 40, y - 66 + sway, '#8a7a5a', 3);
    A.line(ctx, x + 40, y - 36 + sway, x + 40, y - 26 + sway, '#c8c0b0', 3);
    A.circle(ctx, x + 36, y - 46 + sway, 1.8, '#1a1a1a');
    if (withHat) { A.ell(ctx, x + 56, y - 34 + sway, 18, 5, '#6b4a2b'); A.rr(ctx, x + 46, y - 48 + sway, 22, 15, 5, '#6b4a2b'); A.rect(ctx, x + 46, y - 38 + sway, 22, 3, '#3a2a1a'); }
  }

  // Doppelaxt (Labrys) als Zeichnung
  function labrys(ctx, x, y, s, color, dark) {
    A.line(ctx, x, y - s * 0.55, x, y + s * 0.55, dark || '#5a4a3a', Math.max(2, s * 0.08));
    A.poly(ctx, [x - s * 0.06, y - s * 0.3, x - s * 0.45, y - s * 0.42, x - s * 0.5, y, x - s * 0.45, y + s * 0.42, x - s * 0.06, y + s * 0.3], color);
    A.poly(ctx, [x + s * 0.06, y - s * 0.3, x + s * 0.45, y - s * 0.42, x + s * 0.5, y, x + s * 0.45, y + s * 0.42, x + s * 0.06, y + s * 0.3], color);
  }

  // Kulthörner
  function horns(ctx, x, y, w, color) {
    A.poly(ctx, [x - w / 2, y, x + w / 2, y, x + w * 0.42, y - w * 0.1, x - w * 0.42, y - w * 0.1], color);
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.moveTo(x - w * 0.42, y - w * 0.1); ctx.quadraticCurveTo(x - w * 0.5, y - w * 0.55, x - w * 0.34, y - w * 0.62); ctx.quadraticCurveTo(x - w * 0.3, y - w * 0.3, x - w * 0.12, y - w * 0.1); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(x + w * 0.42, y - w * 0.1); ctx.quadraticCurveTo(x + w * 0.5, y - w * 0.55, x + w * 0.34, y - w * 0.62); ctx.quadraticCurveTo(x + w * 0.3, y - w * 0.3, x + w * 0.12, y - w * 0.1); ctx.closePath(); ctx.fill();
  }

  // ---------------------------------------------------------------- Ausschmückungshilfen
  // Bougainvillea: grüne Ranken, darüber Blüten in Magenta
  function bougainvillea(ctx, x, y, h, seed) {
    A.vines(ctx, x, y, h, seed, '#4a7a3a');
    A.vines(ctx, x + 4, y + 6, h - 10, seed + 1, '#c8287a');
    const r = ATL.U.rng(seed + 2);
    for (let i = 0; i < h / 9; i++) A.ell(ctx, x + (r() - 0.5) * 34, y + 8 + r() * (h - 12), 3 + r() * 3, 2.5 + r() * 2, r() < 0.5 ? '#d83a8a' : '#b8206a');
  }
  // Tontopf mit Basilikum
  function basilPot(ctx, x, baseY, w) {
    A.ell(ctx, x, baseY, w * 0.6, 3, 'rgba(0,0,0,0.2)');
    A.pot(ctx, x, baseY, w, w, '#b8683a');
    A.bush(ctx, x, baseY - w - 2, w * 1.1, '#3f7a34', Math.floor(x));
  }
  // Getrockneter Oktopus an der Leine (y = Aufhängepunkt)
  function octopus(ctx, x, y, s, color) {
    color = color || '#b08070';
    A.line(ctx, x, y, x, y + s * 0.3, '#6a5a4a', 1);
    A.ell(ctx, x, y + s * 0.65, s * 0.32, s * 0.4, color);
    A.circle(ctx, x - s * 0.12, y + s * 0.6, s * 0.05, '#3a2a2a'); A.circle(ctx, x + s * 0.12, y + s * 0.6, s * 0.05, '#3a2a2a');
    ctx.strokeStyle = A.shade(color, -0.15); ctx.lineWidth = Math.max(1.5, s * 0.07); ctx.lineCap = 'round';
    for (let i = 0; i < 7; i++) { const dx = (i - 3) * s * 0.11; ctx.beginPath(); ctx.moveTo(x + dx * 0.6, y + s * 0.95); ctx.quadraticCurveTo(x + dx * 1.6, y + s * 1.4, x + dx * 1.2 + (i % 2 ? 3 : -3), y + s * 1.9); ctx.stroke(); }
  }
  // Katze, liegend (x,y = Bodenpunkt; dir 1 = Kopf rechts)
  function cat(ctx, x, y, color, dir) {
    dir = dir || 1; color = color || '#c88a4a';
    A.ell(ctx, x, y, 18, 4, 'rgba(0,0,0,0.2)');
    A.ell(ctx, x, y - 7, 17, 8, color);
    A.circle(ctx, x + dir * 15, y - 11, 7, color);
    A.poly(ctx, [x + dir * 10, y - 16, x + dir * 12, y - 23, x + dir * 15, y - 17], color);
    A.poly(ctx, [x + dir * 17, y - 17, x + dir * 20, y - 23, x + dir * 21, y - 16], color);
    ctx.strokeStyle = A.shade(color, -0.2); ctx.lineWidth = 3; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x - dir * 15, y - 5); ctx.quadraticCurveTo(x - dir * 28, y - 8, x - dir * 26, y - 18); ctx.stroke();
    A.line(ctx, x + dir * 12, y - 11, x + dir * 14, y - 11, '#2a1a10', 1); A.line(ctx, x + dir * 17, y - 11, x + dir * 19, y - 11, '#2a1a10', 1);
  }
  // Eidechse auf warmem Stein
  function lizard(ctx, x, y, dir, color) {
    dir = dir || 1; color = color || '#6a7a3a';
    ctx.strokeStyle = A.shade(color, -0.2); ctx.lineWidth = 2; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x - dir * 8, y); ctx.quadraticCurveTo(x - dir * 18, y + 1, x - dir * 26, y + 5); ctx.stroke();
    A.ell(ctx, x, y, 9, 3, color); A.ell(ctx, x + dir * 10, y - 0.5, 4, 2.5, color);
    for (const [lx, ly] of [[-5, -3], [-5, 3], [5, -3], [5, 3]]) A.line(ctx, x + lx, y, x + lx + (lx < 0 ? -3 : 3) * dir, y + ly * 1.4, A.shade(color, -0.2), 1.5);
    A.circle(ctx, x + dir * 11, y - 1.5, 0.8, '#101008');
  }
  // Vögel, die über den Himmel ziehen und wiederkommen (Möwen oder Schwalben)
  function gulls(ctx, t, n, y0, color) {
    ctx.strokeStyle = color || 'rgba(70,80,90,0.75)'; ctx.lineWidth = 1.5;
    for (let i = 0; i < n; i++) {
      const bx = ((i * 260 + t * (12 + i * 3)) % 1150) - 90;
      const by = y0 + i * 18 + Math.sin(t * 1.1 + i) * 6;
      const f = Math.sin(t * 5 + i * 1.7) * 3;
      const s = 6 + (i % 2) * 2;
      ctx.beginPath(); ctx.moveTo(bx - s, by + f); ctx.quadraticCurveTo(bx - s * 0.4, by - 2, bx, by); ctx.quadraticCurveTo(bx + s * 0.4, by - 2, bx + s, by + f); ctx.stroke();
    }
  }
  // Wurzeln, die von oben hereinwachsen
  function roots(ctx, x, y, len, seed, color) {
    const r = ATL.U.rng(seed);
    color = color || '#4a3a28';
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (let v = 0; v < 4; v++) {
      const l = len * (0.5 + r() * 0.5), c = v % 2 ? A.shade(color, 0.12) : color;
      let px = x + (r() - 0.5) * 30, py = y, dx = (r() - 0.5) * 6;
      for (let k = 1; k <= 10; k++) {
        dx = (dx + (r() - 0.5) * 5) * 0.8;
        const nx = px + dx, ny = y + (l * k) / 10;
        ctx.strokeStyle = c; ctx.lineWidth = Math.max(0.8, 4.5 - k * 0.4);
        ctx.beginPath(); ctx.moveTo(px, py); ctx.quadraticCurveTo(px + dx * 0.5, (py + ny) / 2, nx, ny); ctx.stroke();
        if (k > 2 && r() < 0.35) { ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(nx, ny); ctx.quadraticCurveTo(nx + (r() - 0.5) * 20, ny + 8, nx + (r() - 0.5) * 26, ny + 10 + r() * 12); ctx.stroke(); }
        px = nx; py = ny;
      }
    }
  }
  // Wassertropfen: fällt von y0 nach y1 und spritzt auf
  function drip(ctx, t, x, y0, y1, phase) {
    const k = (t * 0.45 + phase) % 1;
    if (k < 0.75) { const q = k / 0.75; A.ell(ctx, x, y0 + (y1 - y0) * q * q, 1.5, 3.5, 'rgba(210,230,250,0.75)'); }
    else { const s = (k - 0.75) / 0.25; A.ell(ctx, x, y1, 3 + s * 9, 1 + s * 3, null, `rgba(210,230,250,${(0.5 * (1 - s)).toFixed(2)})`, 1); }
  }

  // Livias Hinweis je nach Stand
  async function liviaHint(g) {
    if (g.has('stiersiegel')) { await deuteSiegel(g); return; }
    if (g.flag('krypta_offen')) {
      if (g.flag('faden')) await g.talk([['livia', 'Der Faden hängt am Ring, sagst du. Dann ist der Rest Laufen. Und der Stier am Ende will etwas, das man ihm gibt, nicht etwas, das man ihm nimmt.'], ['falk', 'Du klingst wie ein Orakel.'], ['livia', 'Ich klinge wie jemand, der die Rhyta im Museum gesehen hat. Trankopfer, Adrian. Man gießt etwas hinein.']]);
      else if (g.has('wolle')) await g.talk([['livia', 'Du hast ein Knäuel. Theseus hat das Ende am Eingang festgebunden, nicht in der Tasche behalten. Das ist der ganze Trick.']]);
      else await g.talk([['livia', 'Da unten ohne Faden? Dann sehen wir uns in einer Woche, wenn du Glück hast.'], ['livia', 'Kyria Eleni in der Taverne strickt seit vierzig Jahren. Sie gibt einem Fremden Wolle, wenn er ihr zuhört. Nur zuhören, Adrian. Nicht dozieren.']]);
      return;
    }
    if (g.flag('plan_gelesen') || g.flag('yannis_legende')) {
      const lines = [['livia', 'Krypta, drei Äxte, die mittlere. Ich würde dem alten Yannis eher glauben als dem Colonel, aber sie sagen dasselbe.']];
      if (!g.has('doppelaxt')) lines.push(['livia', 'Und sieh dir die Magazine an. Evans hat die Pithoi geleert, sagt er. Ich habe noch nie einen Engländer bis auf den Grund eines Vorratskrugs greifen sehen.']);
      await g.talk(lines);
      return;
    }
    if (g.has('plan')) { await g.talk([['livia', 'Der Colonel hat dir seinen Plan gegeben? Dann lies ihn. Er hat dreißig Jahre daran geschrieben, der Rand ist interessanter als die Mitte.']]); return; }
    await g.talk([['livia', 'In der Taverne sitzt ein Engländer, der seit Evans hier ist. Er trinkt, er redet, meistens gleichzeitig. Wenn jemand den Palast kennt, dann er.'], ['livia', 'Und die Ziege vor der Kapelle kaut auf einem Hut, der ihr nicht gehört. Ich sage das nur, weil es dich sonst später ärgert.']]);
  }

  async function deuteSiegel(g) {
    if (g.flag('siegel_gedeutet')) { await g.talk([['livia', 'Der Stier ist in deiner Tasche. Was fehlt, liegt woanders. Gehen wir.']]); return; }
    g.set('siegel_gedeutet');
    await g.talk([
      ['livia', 'Zeig her.'],
      'Falk hält ihr die Bronzescheibe hin. Livia dreht sie um, hält sie ins Licht.',
      ['livia', 'Der Stierkopf, wie auf den Rhyta. Und auf der Rückseite acht Kerben, genau wie beim Siegel der Sonne. Sie sind nicht zum Anschauen da. Sie greifen in etwas ein.'],
      ['falk', 'Ein Schloss. Das Tor unter dem brennenden Berg, sagt die Stele.'],
      ['livia', 'Thera. Drei Ringe, drei Siegel, und Solon hat aufgeschrieben, wie man sie dreht.'],
      ['falk', 'Und Kessler war hier unten. Vesper weiß, wo wir sind.'],
      ['livia', 'Dann sollten wir schneller sein als er.'],
    ]);
    if (g.has('flutsiegel')) { await g.say('livia', 'Sonne, Stier, Flut. Wir haben alle drei. Nach Thera.'); g.objective('Nach Thera reisen. Das Tor unter dem brennenden Berg mit den drei Siegeln öffnen.'); }
    else { await g.say('livia', 'Das Siegel der Flut fehlt noch. Die Weisen aus dem Meer, das Haus des süßen Wassers: Eridu.'); g.objective('Nach Eridu reisen und das Siegel der Flut finden.'); }
  }

  // ---------------------------------------------------------------- Fischerdorf
  R({
    id: 'cr_village', name: 'Fischerdorf an der Nordküste', ambient: 'crete',
    start: [160, 520, 'r'],
    walk: [[30, 400, 250, 400, 250, 430, 350, 430, 350, 400, 930, 400, 940, 585, 20, 585]],
    scale: SC,
    paint(ctx, g) {
      A.sky(ctx, 960, 270, '#5f9fd8', '#d6ebf6');
      A.clouds(ctx, 960, 70, 4, 12);
      A.sun(ctx, 130, 64, 24);
      // Bergkette bis zum Horizont (Fuß der Berge liegt auf der Wasserlinie)
      A.mountains(ctx, 960, 262, '#a9b8c6', 31, 70, 150);
      A.mountains(ctx, 960, 262, '#8ea0ad', 35, 38, 110);
      A.sea(ctx, 0, 262, 960, 96, '#2b6f9e', '#1c7fa6', 21);
      A.poly(ctx, [700, 268, 960, 262, 960, 300, 720, 300], 'rgba(255,255,255,0.05)');
      // Boote im Wasser: das große mit Mast, das kleine weiter draußen (beide links, wo das Meer frei liegt)
      A.boat(ctx, 8, 306, 46, '#3a6a8a');
      A.ell(ctx, 31, 317, 26, 2.5, 'rgba(0,0,0,0.18)');
      A.boat(ctx, 60, 318, 120, '#7a5a3a', true);
      A.ell(ctx, 120, 346, 70, 4, 'rgba(0,0,0,0.15)');
      // Fernes Segel, klein und blass, in der Lücke zwischen Haus und Kapelle
      A.poly(ctx, [362, 288, 362, 276, 370, 288], 'rgba(235,240,240,0.75)'); A.rect(ctx, 358, 288, 14, 2, '#7f96a6');
      // Kaimauer und Dorfstraße
      A.stones(ctx, 0, 350, 960, 26, '#b9a98a', 33, 22);
      A.rect(ctx, 0, 374, 960, 6, '#8a7a60');
      A.ground(ctx, 0, 380, 960, 220, '#cdb88f', '#a8906a');
      const r = ATL.U.rng(44);
      for (let i = 0; i < 90; i++) { const x = r() * 960, y = 385 + r() * 210; A.ell(ctx, x, y, 4 + r() * 8, 2 + r() * 2, `rgba(90,70,40,${0.08 + r() * 0.1})`); }
      A.poly(ctx, [860, 400, 960, 380, 960, 440, 900, 470], '#bfa87c');
      // Moos und Kies an der Kaimauer, Zisternendeckel im Weg, Poller mit Möwe
      A.moss(ctx, 4, 372, 180, 15, '#5a6a3a'); A.moss(ctx, 508, 372, 60, 16, '#5a6a3a'); A.moss(ctx, 892, 372, 60, 18, '#5a6a3a');
      A.pebbles(ctx, 0, 379, 190, 10, 17, '#9a9080'); A.pebbles(ctx, 506, 379, 110, 8, 18, '#9a9080');
      A.ell(ctx, 760, 482, 26, 9, 'rgba(0,0,0,0.18)'); A.ell(ctx, 760, 480, 24, 8, '#6f665a'); A.ell(ctx, 760, 480, 17, 5.5, null, '#4a423a', 1.5); A.rect(ctx, 754, 477, 12, 3, '#3a3430');
      A.rr(ctx, 54, 352, 16, 28, 3, '#3a3a3c'); A.ell(ctx, 62, 352, 8, 3, '#55555a'); A.rope(ctx, [62, 360, 30, 366, 0, 362], '#b8a078', 2);
      A.ell(ctx, 63, 344, 8, 4.5, '#f0f0ec'); A.ell(ctx, 58, 345, 5, 3, '#b0b4b8'); A.circle(ctx, 69, 340, 3.5, '#f0f0ec'); A.poly(ctx, [72, 340, 77, 341, 72, 342], '#e0a030'); A.line(ctx, 63, 348, 62, 352, '#e0a030', 1.5);
      // Haus links hinten, Kapelle, Taverne
      house(ctx, 190, 170, 170, 210, { seed: 5, windows: [[230, 210], [305, 210]], door: [252, 290, 46, 90] });
      A.rect(ctx, 200, 160, 40, 10, '#e0d8c8');
      A.rect(ctx, 380, 244, 120, 136, '#f2ede2');
      A.rect(ctx, 488, 244, 12, 136, 'rgba(0,0,0,0.1)');
      A.rect(ctx, 374, 236, 132, 10, '#e6dfd0');
      A.rect(ctx, 398, 212, 84, 26, '#f2ede2'); A.rect(ctx, 472, 212, 10, 26, 'rgba(0,0,0,0.1)');
      for (let i = 0; i < 4; i++) A.rr(ctx, 406 + i * 20, 218, 8, 14, 3, '#2f62ad');
      ctx.fillStyle = '#2f62ad'; ctx.beginPath(); ctx.arc(440, 212, 44, Math.PI, 0); ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.14)'; ctx.beginPath(); ctx.arc(430, 212, 32, Math.PI * 1.05, Math.PI * 1.6); ctx.lineTo(430, 212); ctx.closePath(); ctx.fill();
      A.rect(ctx, 434, 190, 12, 12, '#f2ede2'); A.rect(ctx, 430, 186, 20, 4, '#e6dfd0');
      A.rect(ctx, 438, 162, 4, 26, '#f2ede2'); A.rect(ctx, 432, 170, 16, 4, '#f2ede2');
      A.door(ctx, 418, 300, 44, 80, '#2f62ad', { frame: '#e0d8c8', arch: true, planks: false });
      A.rect(ctx, 400, 260, 14, 22, '#2f62ad'); A.rect(ctx, 466, 260, 14, 22, '#2f62ad');
      // Glockenstuhl neben der Kapelle: Pfeiler mit Giebel und Kreuz, Glocke in der Öffnung
      A.rect(ctx, 512, 260, 34, 120, '#f2ede2'); A.rect(ctx, 540, 260, 6, 120, 'rgba(0,0,0,0.1)');
      A.rect(ctx, 508, 256, 42, 6, '#e6dfd0'); A.poly(ctx, [508, 256, 550, 256, 529, 244], '#e6dfd0');
      A.rect(ctx, 528, 232, 2, 12, '#e0d8c8'); A.rect(ctx, 525, 235, 8, 2, '#e0d8c8');
      A.rect(ctx, 518, 270, 22, 30, '#0d1a2a'); A.line(ctx, 529, 270, 529, 278, '#5a4a30', 2); A.circle(ctx, 529, 288, 6, '#8a7a50'); A.circle(ctx, 529, 293, 1.5, '#5a4a30');
      house(ctx, 610, 150, 280, 230, { seed: 9, windows: [[650, 200], [820, 200]], door: [722, 250, 62, 130] });
      A.rr(ctx, 700, 190, 106, 30, 4, '#3a2a1a');
      A.text(ctx, 'ΤΑΒΕΡΝΑ', 753, 212, { font: 'bold 18px Georgia', color: '#e8d090', align: 'center' });
      // Wandlaternen an Haken links und rechts der Tavernentür
      for (const lx of [704, 802]) { A.line(ctx, lx, 232, lx, 240, '#3a2a1a', 2); A.line(ctx, lx - 8, 232, lx + 8, 232, '#3a2a1a', 2); A.lantern(ctx, lx, 262, 0, false); }
      A.bush(ctx, 610, 384, 50, '#7a4a5a', 6); A.bush(ctx, 890, 386, 46, '#a04a5a', 7);
      // Bougainvillea an den Hauswänden, Töpfe mit Basilikum, Katze in der Sonne
      bougainvillea(ctx, 200, 176, 200, 21);
      bougainvillea(ctx, 622, 158, 216, 24);
      bougainvillea(ctx, 882, 156, 220, 27);
      basilPot(ctx, 240, 384, 22); basilPot(ctx, 312, 384, 20); basilPot(ctx, 708, 384, 22);
      cat(ctx, 336, 384, '#c88a4a', -1);
      // Wäscheleine unter dem Dach des weißen Hauses (die Wäsche bewegt sich in animate)
      ctx.strokeStyle = '#6a5a48'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(192, 176); ctx.quadraticCurveTo(275, 188, 358, 176); ctx.stroke();
      // Schornstein der Taverne
      A.rect(ctx, 854, 116, 20, 36, '#e8e0d0'); A.rect(ctx, 851, 112, 26, 6, '#c8bca8'); A.rect(ctx, 856, 118, 16, 4, '#2a2420');
      // Zypressen
      A.cypress(ctx, 560, 384, 220, '#233f21'); A.cypress(ctx, 590, 386, 170, '#2b4a27');
      A.cypress(ctx, 930, 390, 210, '#233f21'); A.cypress(ctx, 905, 392, 150, '#2b4a27');
      A.cypress(ctx, 170, 382, 130, '#2b4a27');
      // Ikonenkasten am Weg, Eselskarren ohne Esel vor der Taverne
      A.rect(ctx, 596, 338, 6, 54, '#7a6a58'); A.rr(ctx, 582, 302, 34, 40, 3, '#e8e0d0', '#8a7a68', 1.5); A.poly(ctx, [578, 304, 620, 304, 599, 292], '#2f62ad');
      A.rect(ctx, 590, 310, 18, 24, '#3a2a4a'); A.circle(ctx, 599, 318, 4, '#e8c890'); A.rect(ctx, 594, 322, 10, 10, '#7a2e2e'); A.circle(ctx, 599, 337, 2, '#ffd070');
      A.ell(ctx, 848, 398, 44, 5, 'rgba(0,0,0,0.2)');
      A.line(ctx, 818, 386, 796, 397, '#5a4028', 4);
      A.poly(ctx, [816, 356, 882, 356, 878, 392, 820, 392], '#7a5a38');
      A.sack(ctx, 838, 376, 26, 22, '#c8b48a'); A.amphora(ctx, 866, 378, 32, '#b0703f');
      A.rect(ctx, 816, 372, 66, 20, '#8a6a44'); A.rect(ctx, 816, 372, 66, 3, '#a08050');
      for (let i = 1; i < 4; i++) A.line(ctx, 816 + i * 16, 374, 816 + i * 16, 392, 'rgba(0,0,0,0.25)', 1);
      A.circle(ctx, 852, 384, 16, '#4a3a2a'); A.circle(ctx, 852, 384, 12, null, '#8a7a5a', 2);
      for (let i = 0; i < 6; i++) { const a = (i * Math.PI) / 3; A.line(ctx, 852, 384, 852 + Math.cos(a) * 12, 384 + Math.sin(a) * 12, '#8a7a5a', 1.5); }
      A.circle(ctx, 852, 384, 3, '#2a2018');
      // Netze auf dem Trockengestell
      A.rect(ctx, 40, 388, 6, 60, '#6b4a2b'); A.rect(ctx, 150, 388, 6, 60, '#6b4a2b'); A.rect(ctx, 38, 386, 120, 5, '#6b4a2b');
      ctx.strokeStyle = 'rgba(80,60,30,0.7)'; ctx.lineWidth = 1;
      for (let i = 0; i < 12; i++) { ctx.beginPath(); ctx.moveTo(44 + i * 9, 390); ctx.lineTo(54 + i * 9, 446); ctx.stroke(); ctx.beginPath(); ctx.moveTo(150 - i * 9, 390); ctx.lineTo(140 - i * 9, 446); ctx.stroke(); }
      for (let i = 0; i < 6; i++) A.circle(ctx, 60 + i * 16, 392 + (i % 2) * 6, 4, '#c8a858');
      // Brunnen
      A.stones(ctx, 262, 396, 76, 36, '#a09070', 12, 14);
      A.ell(ctx, 300, 396, 38, 9, '#3a3020'); A.ell(ctx, 300, 396, 30, 6, '#1a2a30');
      A.rect(ctx, 268, 350, 5, 50, '#5a3f28'); A.rect(ctx, 327, 350, 5, 50, '#5a3f28'); A.rect(ctx, 262, 346, 76, 6, '#5a3f28');
      A.rope(ctx, [300, 352, 300, 378], '#b89a68', 2); A.rr(ctx, 292, 378, 16, 12, 3, '#5a5a5a');
      // Oktopusse zum Trocknen zwischen Netzgestell und Brunnen, Bojen am Pfosten, Gras an den Mauern
      A.rope(ctx, [154, 388, 210, 372, 266, 354], '#b8a078', 1.5);
      octopus(ctx, 186, 379, 30); octopus(ctx, 232, 365, 26, '#a87868');
      A.rope(ctx, [36, 388, 36, 436], '#8a7a60', 1.5);
      for (let i = 0; i < 3; i++) A.circle(ctx, 36, 402 + i * 16, 6.5, i % 2 ? '#e8e0d0' : '#d8602a');
      A.grass(ctx, 506, 382, 60, 31, '#8a9a48'); A.grass(ctx, 892, 386, 60, 32, '#8a9a48'); A.grass(ctx, 190, 384, 40, 33, '#8a9a48');
      // Pfosten der Ziege
      A.rect(ctx, 520, 430, 6, 50, '#6b4a2b');
      A.vignette(ctx, 960, 600, 0.32);
      A.grain(ctx, 960, 600, 5, 0.04);
    },
    paintFront(ctx, g) {
      // Bougainvillea-Zweig oben links, Amphore am rechten Bildrand
      ctx.strokeStyle = '#5a3a24'; ctx.lineWidth = 4; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(-6, 96); ctx.quadraticCurveTo(40, 54, 98, 18); ctx.stroke();
      const r = ATL.U.rng(77);
      for (let i = 0; i < 26; i++) {
        const k = r(), bx = -6 + 104 * k + (r() - 0.5) * 30, by = 96 - 78 * k + (r() - 0.5) * 30;
        if (r() < 0.35) A.ell(ctx, bx, by, 6, 3.5, '#3f7a34');
        else A.ell(ctx, bx, by, 5 + r() * 3, 4 + r() * 2, r() < 0.5 ? '#d83a8a' : '#b8206a');
      }
      A.ell(ctx, 942, 596, 26, 6, 'rgba(0,0,0,0.3)');
      A.amphora(ctx, 944, 598, 92, '#b0703f');
    },
    animate(ctx, t) {
      A.waterAnim(ctx, 0, 262, 960, 88, t, 'rgba(255,255,255,0.16)');
      gulls(ctx, t, 4, 92);
      A.smoke(ctx, 864, 114, t, 'rgba(225,225,220,0.3)', 0.6);
      // Wäsche im Wind
      const pieces = [[206, 22, 26, '#f4f0e6'], [238, 18, 30, '#3a5a9a'], [268, 20, 28, '#a8383a'], [300, 30, 22, '#f0ece2'], [338, 16, 30, '#2a2a2a']];
      pieces.forEach(([x, w, h, c], i) => {
        const y = 178 + (1 - Math.abs(x + w / 2 - 275) / 85) * 5;
        const s = Math.sin(t * 1.7 + i * 1.3) * 3;
        A.poly(ctx, [x, y, x + w, y, x + w + s * 1.5, y + h, x + s * 1.5, y + h], c);
        A.rect(ctx, x + 1, y - 2, 3, 5, '#a08050'); A.rect(ctx, x + w - 4, y - 2, 3, 5, '#a08050');
      });
    },
    hotspots: [
      { id: 'ziege', name: 'Ziege', rect: [520, 400, 130, 80], at: [470, 500, 'r'], z: 478,
        paint: (ctx, g, t) => { goat(ctx, 570, 478, !g.flag('hut_genommen'), t); A.rope(ctx, [523, 440, 545, 452], '#b89a68', 2); },
        look: (g) => g.flag('hut_genommen') ? 'Die Ziege. Sie hat die Oliven gefressen und sieht aus, als erwarte sie Nachschlag.' : 'Eine Ziege, angebunden am Pfosten. Sie kaut auf einem Tropenhut, als wäre es Salat. Der Hut wehrt sich nicht.',
        take: 'Sie hat Hörner. Ich habe keinen Grund.', talk: 'Sie sieht mich an. Sie kaut weiter. Das Gespräch ist beendet.',
        use: (g) => g.flag('hut_genommen') ? 'Sie hat schon alles gegeben, was sie hatte.' : 'Ich versuche, ihr den Hut wegzunehmen. Sie zieht. Sie ist stärker, und sie weiß es.',
        pull: (g) => g.flag('hut_genommen') ? 'Ich lasse sie in Ruhe.' : 'Ich ziehe am Hut. Sie zieht zurück. Unentschieden, mit Vorteil Ziege.',
        push: 'Sie stemmt sich dagegen. Vier Beine gegen zwei.',
        open: 'Das Maul ist beschäftigt.',
        giveWith: {
          oliven: async (g) => {
            if (g.flag('hut_genommen')) return 'Sie hatte schon. Ich behalte die Oliven.';
            await g.say('falk', 'Oliven. Sieh her.');
            g.hero.anim = 'reach'; await g.wait(500); g.hero.anim = 'stand';
            await g.message('Die Ziege lässt den Hut fallen und frisst Falk die Oliven aus der Hand. Alle.', 2400);
            g.drop('oliven'); g.set('hut_genommen'); g.take('hut'); g.repaint();
            await g.say('falk', 'Der Hut. Feucht, angeknabbert, und er riecht nach Ziege. Der Colonel wird sich freuen. Vielleicht.');
          },
          raki: 'Ich gebe keinem Tier Schnaps. Auch keinem, das einen Hut frisst.',
          hut: 'Sie hat ihn schon einmal gehabt. Das reicht.',
          wolle: 'Sie würde die Wolle fressen. Und dann Eleni mich.',
          default: 'Die Ziege ist wählerisch. Für Hüte und Oliven, nicht für so etwas.',
        },
        useWith: { taschenmesser: 'Nein. Ich bin Archäologe, kein Metzger.', seil: 'Sie ist schon angebunden. Ein zweites Seil ändert nichts.', default: 'Die Ziege hat kein Interesse.' } },
      { id: 'kapelle', name: 'Kapelle', rect: [374, 150, 132, 230], at: [440, 440, 'u'],
        look: 'Eine Kapelle mit blauer Kuppel, weiß gekalkt. Der Heilige über der Tür ist von der Sonne ausgeblichen; ich tippe auf Nikolaus, der Schutzpatron der Seeleute.',
        open: 'Die Tür ist verschlossen. Der Pope kommt sonntags aus der Nachbargemeinde, sagt das Schild.',
        use: 'Ich habe nichts zu beichten. Jedenfalls nichts, was hierhergehört.' },
      { id: 'glocke', name: 'Glocke', rect: [512, 260, 34, 60], at: [529, 440, 'u'],
        look: 'Eine Bronzeglocke im Glockenstuhl. Klein, aber laut, vermute ich.',
        pull: 'Das Seil ist hochgebunden. Und ich will nicht das ganze Dorf zusammenläuten.', use: 'Das Seil ist hochgebunden.' },
      { id: 'haus', name: 'Weißes Haus', rect: [190, 160, 170, 220], at: [275, 440, 'u'],
        look: 'Weiß gekalkt, blaue Läden, ein Hof mit Feigenbaum dahinter. Auf der Insel sieht jedes Haus so aus, und jedes hat einen anderen Grund dafür.',
        open: 'Die Läden sind zu. Mittagsruhe.', use: 'Da wohnt jemand. Ich klopfe nicht bei Fremden.' },
      { id: 'brunnen', name: 'Brunnen', rect: [258, 344, 84, 90], at: [300, 450, 'u'],
        look: 'Ein Ziehbrunnen. Das Wasser unten ist schwarz und kühl. Das Dorf trinkt daraus, seit es das Dorf gibt.',
        use: async (g) => { if (g.has('flasche') && g.flag('flasche_leer')) { g.set('flasche_leer', false); g.fx('water'); return 'Ich fülle die Feldflasche. Kalt, ein bisschen erdig.'; } return 'Ich lasse den Eimer hinunter, trinke einen Schluck. Kalt. Gut.'; },
        pull: 'Der Eimer kommt hoch. Wasser. Nichts weiter.', open: 'Er ist offen. Es ist ein Brunnen.',
        useWith: { flasche: async (g) => { g.set('flasche_leer', false); g.fx('water'); return 'Ich fülle die Feldflasche. Man weiß nie.'; }, seil: 'Der Brunnen hat schon ein Seil. Und mein Seil ist besser.', default: 'Das gehört nicht in einen Brunnen.' } },
      { id: 'netze', name: 'Fischernetze', rect: [36, 384, 124, 66], at: [100, 470, 'u'],
        look: 'Netze zum Trocknen, mit Korkschwimmern. Yannis flickt sie mit einer Holznadel, die älter ist als ich.',
        take: 'Yannis säße heute Abend ohne Netz da. Nein.', use: 'Ich kann nicht flicken. Ich kann nicht einmal stopfen.',
        pull: 'Die Maschen halten. Gute Arbeit.' },
      { id: 'boote', name: 'Boote', rect: [4, 290, 296, 66], at: [160, 440, 'u'],
        look: 'Zwei Fischerboote, das Segel eingeholt. Mit dem größeren sind wir gekommen. Der Kapitän wartet, sagt er. Er hat es dreimal gesagt.',
        use: 'Erst das Siegel. Dann das Boot.', take: 'Ich kann kein Boot in die Tasche stecken.' },
      { id: 'meer', name: 'Meer', rect: [300, 262, 660, 90], at: [480, 440, 'u'],
        look: 'Die Ägäis. Nach Norden, hinter dem Horizont, liegt Thera. Man sieht es nicht, aber Livia zeigt trotzdem jedes Mal hin.',
        use: 'Zum Baden ist keine Zeit.', take: 'Ich nehme das Meer nicht mit. Es kommt sowieso überall hin.' },
      { id: 'berge', name: 'Berge', rect: [560, 200, 400, 62], at: [700, 440, 'u'],
        look: 'Das Ida-Gebirge, im Dunst. In einer Höhle dort soll Zeus aufgewachsen sein. Die Kreter haben ihm auch ein Grab gezeigt, was die anderen Griechen für eine Lüge hielten.' },
      { id: 'zypressen', name: 'Zypressen', rect: [540, 170, 70, 214], at: [560, 440, 'u'],
        look: 'Zypressen. Sie stehen hier wie Ausrufezeichen, und das Dorf braucht keine.', take: 'Zu groß, zu verwurzelt.' },
      { id: 'pfosten', name: 'Pfosten', rect: [514, 426, 18, 56], at: [470, 500, 'r'],
        look: 'Ein Pfosten, an dem die Ziege angebunden ist. Der Strick ist länger, als dem Dorf lieb sein kann.',
        pull: 'Er sitzt tief. Und die Ziege lasse ich nicht frei; sie würde als Nächstes mich fressen.', use: 'Ich bin nicht angebunden. Noch nicht.' },
      { id: 'oktopus', name: 'Oktopusse', rect: [168, 356, 88, 46], at: [210, 470, 'u'],
        look: 'Oktopusse, an der Leine getrocknet. Heute Abend liegen sie auf dem Grill, und morgen erzählt jemand, es sei Kalamari gewesen.' },
      { id: 'karren', name: 'Eselskarren', rect: [810, 342, 72, 58], at: [846, 440, 'u'],
        look: 'Ein Eselskarren ohne Esel. Ein Sack, eine Amphore, und der Esel hat Mittagsruhe, wie der Rest des Dorfes.' },
      { id: 'katze', name: 'Katze', rect: [316, 356, 38, 30], at: [335, 440, 'u'], z: 2,
        look: 'Eine Katze, in der Sonne, mit geschlossenen Augen. Sie hat keine Fragen an mich. Ich beneide sie.' },
    ],
    exits: [
      { id: 'karte', name: 'Zum Boot', rect: [0, 380, 40, 200], at: [50, 520, 'l'],
        look: (g) => g.has('stiersiegel') ? 'Zurück zum Boot. Wir haben, was wir wollten.' : 'Der Weg zum Boot. Der Kapitän wartet. Ohne das Siegel wäre die Fahrt umsonst gewesen.',
        before: async (g) => {
          if (g.has('stiersiegel') && !g.flag('siegel_gedeutet') && g.inRoom('livia')) {
            await g.scene(async () => { await g.walk('livia', g.hero.x + 70, g.hero.y - 6, 'l'); g.face('falk', 'r'); await g.say('livia', 'Warte. Lass mich das Siegel sehen, bevor wir fahren.'); await deuteSiegel(g); });
          } else if (!g.has('stiersiegel') && !g.flag('abreise_ohne')) {
            g.set('abreise_ohne');
            await g.say('falk', 'Ohne das Siegel? Wir können wiederkommen. Aber Kessler wartet nicht.');
          }
          await ATL.story.openMap(g, 'kreta');
          return false;
        } },
      { id: 'taverne', name: 'Taverne', rect: [716, 190, 90, 190], at: [753, 440, 'u'], to: 'cr_taverna', pos: [266, 470], dir: 'd',
        look: 'Die Taverne des Dorfes. Ein Schild, ein Tisch draußen, und drinnen ist es kühler als hier.',
        open: (g) => g.travel(g.hs('taverne')) },
      { id: 'weg', name: 'Weg nach Knossos', rect: [880, 380, 80, 110], at: [900, 470, 'r'], to: 'cr_knossos', pos: [90, 520], dir: 'r',
        look: 'Ein Feldweg zwischen Zypressen, landeinwärts. Eine Stunde bis zu den Ruinen, sagt Livia. Sie sagt so etwas gern.',
        before: async (g) => { if (!g.flag('knossos_weg')) { g.set('knossos_weg'); await g.message('Eine Stunde zu Fuß, durch Olivenhaine, bergauf. Dann die Ruinen.', 2400); } return true; } },
    ],
    actors: [
      { id: 'livia', x: 420, y: 505, dir: 'l', cond: (g) => g.flag('kreta_intro'), talk: (g) => g.dialog('livia_kreta'), at: [360, 520, 'r'],
        look: 'Livia. Sie hat sich mit dem Kapitän, der Wirtin und der Ziege angefreundet, in dieser Reihenfolge.',
        giveWith: { stiersiegel: async (g) => { await deuteSiegel(g); }, raki: [['livia', 'Um zehn Uhr morgens? Adrian.']], oliven: 'Sie nimmt zwei. „Für die Ziege sind die gedacht, nicht für mich. Ich weiß.“', hut: [['livia', 'Der Colonel wartet darauf. Ich nicht.']], wolle: [['livia', 'Behalt sie. Du bist derjenige, der hineingeht.']], plan: [['livia', 'Ich habe ihn gesehen. Der Rand ist besser als die Mitte.']], default: [['livia', 'Das brauche ich nicht, Adrian. Du vielleicht.']] } },
      { id: 'yannis', x: 130, y: 475, dir: 'r', talk: (g) => g.dialog('yannis'), at: [190, 500, 'l'],
        look: 'Yannis, der älteste Fischer im Dorf. Er flickt Netze und sieht dabei aufs Meer, als hätte es ihm etwas versprochen.',
        giveWith: {
          raki: async (g) => {
            if (g.flag('yannis_legende')) { await g.say('yannis', 'Noch einer? Sie sind ein guter Mensch. Aber die Geschichte habe ich nur einmal.'); await g.say('yannis', 'Behalten Sie ihn. Da, wo Sie hingehen, braucht man vielleicht einen Schluck.'); return; }
            await g.say('yannis', 'Raki. Von Maria. Der Nachbar brennt ihn, aber das darf man nicht sagen.');
            g.drop('raki'); g.fx('water');
            await g.message('Yannis trinkt, sieht aufs Meer, trinkt noch einmal.', 2000);
            await g.talk([
              ['yannis', 'Mein Großvater, 1900. Der Engländer hat sie graben lassen, dreißig Mann mit Hacken. Sie haben die Krypta freigelegt, die mit dem Pfeiler.'],
              ['yannis', 'Drei Äxte im Stein, nebeneinander. Er war allein da unten, am Abend, und er hat auf die mittlere gedrückt. So. Mit der flachen Hand.'],
              ['yannis', 'Der Boden hat sich bewegt. Neben dem Pfeiler ist eine Platte weggesackt, und darunter war es schwarz. Er ist gerannt.'],
              ['falk', 'Und hat es dem Engländer nicht gesagt.'],
              ['yannis', 'Am nächsten Morgen war die Platte wieder oben. Der Engländer hätte gelacht. Oder ihn entlassen. Er hat vier Kinder gehabt.'],
              ['falk', 'Warum erzählen Sie es mir?'],
              ['yannis', 'Weil Sie Raki mitgebracht haben. Und weil Sie nicht lachen.'],
            ]);
            g.set('yannis_legende'); g.codex('labrys');
            if (!g.flag('krypta_offen')) g.objective('Die Pfeilerkrypta unter Knossos finden und die mittlere Doppelaxt am Pfeiler drücken.');
          },
          oliven: [['yannis', 'Ich habe einen Baum davon. Zwölf Bäume.']], muenzen: [['yannis', 'Ich verkaufe nichts. Ich flicke.']], hut: [['yannis', 'Der gehört dem Engländer. Er wird ihn vermissen, wenn er wieder nüchtern ist.']],
          default: ['Yannis sieht das Ding an, sieht Falk an, flickt weiter.'],
        } },
    ],
    async enter(g) {
      if (g.flag('kreta_intro')) return;
      g.set('kreta_intro');
      await g.scene(async () => {
        await g.message('Kreta, Nordküste. Ein Fischerdorf, zwei Stunden westlich von Heraklion.', 2600);
        g.place('livia', 100, 530, 'r');
        await g.walk('livia', 300, 522, 'r');
        await g.walk('falk', 230, 528, 'r');
        await g.say('livia', 'Knossos liegt landeinwärts, eine Stunde zu Fuß. Evans hat dort dreißig Jahre gegraben und nie ein Labyrinth gefunden.');
        await g.say('falk', 'Evans hat Beton gefunden. Und ihn großzügig verwendet.');
        await g.say('livia', 'Sei nicht ungerecht. Er hat einen Palast aus einem Hügel geholt. Und die Stele in Sais sagt: Das Siegel des Stiers ruht im Haus des Minos, hinter dem Faden.');
        await g.say('falk', 'Hinter dem Faden. Ariadne. Ich habe die Geschichte als Kind gelesen, das reicht mir.');
        await g.say('livia', 'Dann weißt du ja, was man braucht, bevor man hineingeht.');
        await g.say('livia', 'Ich bleibe im Dorf und frage herum. Die Leute reden lieber mit einer Frau, die Griechisch spricht, als mit einem Mann, der Hüte trägt.');
        await g.say('falk', 'Ich trage einen Hut, weil die Sonne scheint.');
        await g.say('livia', 'Sag das der Ziege.');
        await g.walk('livia', 420, 505, 'l');
        g.objective('Herausfinden, wie man unter den Palast von Knossos kommt. Im Dorf herumfragen.');
      });
    },
  });

  ATL.dialogs.define('livia_kreta', {
    nodes: {
      root: {
        options: [
          { text: 'Was weißt du über das Labyrinth?', once: true,
            say: [['livia', 'Bei Homer ist das Labyrinth ein Tanzplatz, den Daidalos in Knossos für Ariadne baute. Das Gefängnis des Minotauros wird es erst bei den Späteren.'], ['livia', 'Minos, Pasiphae, der Stier des Poseidon, das Kind, das keiner haben wollte. Du kennst das.'], ['falk', 'Ein Ungeheuer, halb Mensch, halb Stier, und ein Vater, der es in den Keller sperrt.'], ['livia', 'Familien.']],
            action: (g) => g.codex('minotaurus') },
          { text: 'Und der Faden der Ariadne?', once: true,
            say: [['livia', 'Ariadne gab Theseus ein Knäuel. Er band das Ende am Eingang fest und rollte es beim Hineingehen ab. Das ist die ganze Technik. Sie funktioniert bis heute.'], ['falk', 'Und dann hat er sie auf Naxos sitzen lassen.'], ['livia', 'Männer, die Ungeheuer erschlagen, sind selten gut im Danach.']],
            action: (g) => g.codex('ariadne') },
          { text: 'Warum ausgerechnet ein Stier?', once: true,
            say: [['livia', 'Der Stier ist hier überall. Fresken, Trinkgefäße in Stierform, die Hörner auf den Mauern. Platon lässt die Könige von Atlantis Stiere jagen, ohne Waffen, mit Stangen und Schlingen, und dann über einer Säule opfern.'], ['livia', 'Als hätte er ein minoisches Fresko beschrieben, zweitausend Jahre nachdem es übermalt war.'], ['falk', 'Oder als hätte er Herodot gelesen und Fantasie gehabt.'], ['livia', 'Beides ist möglich. Nur eines davon führt uns nach Thera.']],
            action: (g) => g.codex('stier') },
          { text: 'Was waren das für Leute, die Minoer?', once: true,
            say: [['livia', 'Der Name ist von Evans, nach dem König aus der Sage. Wie sie sich selbst nannten, wissen wir nicht; ihre Schrift ist nicht entziffert.'], ['livia', 'Paläste ohne Stadtmauern, Magazine voller Öl, Bilder von Delfinen und Lilien. Und dann, um 1450, ist alles verbrannt. Thera, die Mykener, beides. Man streitet noch.']],
            action: (g) => g.codex('minoer') },
          { text: (g) => g.has('stiersiegel') ? 'Sieh dir das Siegel an.' : 'Was jetzt?', action: liviaHint },
          { text: 'Bis später.', end: true, say: [['livia', 'Pass auf dich auf, Adrian. Und auf den Hut.']] },
        ],
      },
    },
  });

  ATL.dialogs.define('yannis', {
    nodes: {
      root: {
        options: [
          { text: 'Kalimera. Schöne Netze.', once: true, say: [['yannis', 'Alt. Wie ich. Wir halten beide noch.']] },
          { text: 'Kennen Sie den Palast von Knossos?',
            say: (g) => g.flag('yannis_legende')
              ? [['yannis', 'Das habe ich Ihnen erzählt. Mehr weiß ich nicht, und mehr wollte mein Großvater nicht wissen.']]
              : [['yannis', 'Mein Großvater hat ihn ausgegraben. Mit den Händen. Der Engländer hat zugeschaut und Notizen gemacht.'], ['falk', 'Hat er Ihnen davon erzählt?'], ['yannis', 'Eine Geschichte. Aber trocken erzählt sie sich schlecht.'], ['falk', 'Trocken.'], ['yannis', 'Maria hat Raki. Ich habe Zeit.']] },
          { text: 'Was ist mit der Ziege los?', once: true, say: [['yannis', 'Die gehört der Kapelle. Sie frisst, was auf dem Boden liegt, und was nicht auf dem Boden liegt, holt sie sich vom Tisch. Den Hut vom Engländer zum Beispiel.'], ['yannis', 'Sie mag Oliven. Alles andere mag sie auch, aber Oliven mag sie lieber.']] },
          { text: 'War in letzter Zeit ein Fremder hier?', once: true, say: [['yannis', 'Sie. Und die Frau, die Griechisch spricht wie eine Athenerin.'], ['yannis', 'Und heute früh einer im schwarzen Mantel, der den Weg zum Palast wollte und nicht Guten Morgen gesagt hat.']], action: (g) => g.set('kessler_gesehen') },
          { text: 'Bis später, Yannis.', end: true, say: [['yannis', 'Kalo taxidi.']] },
        ],
      },
    },
  });

  // ---------------------------------------------------------------- Taverne
  // Theke mit Gläsern, Olivenschale, Tavli-Brett und Tonkrug. Wird als z-sortierter Hotspot gezeichnet
  // (Fußlinie 484): Maria steht dahinter, Falk davor.
  function tavernaCounter(ctx) {
    A.rect(ctx, 700, 402, 260, 80, '#5a3f28');
    A.rect(ctx, 700, 396, 260, 10, '#8a6a48');
    A.rect(ctx, 700, 480, 260, 4, 'rgba(0,0,0,0.35)');
    for (let i = 0; i < 4; i++) A.rr(ctx, 712 + i * 62, 414, 48, 56, 3, null, 'rgba(0,0,0,0.3)', 2);
    A.rr(ctx, 730, 380, 10, 18, 2, 'rgba(220,230,240,0.85)'); A.rr(ctx, 746, 382, 10, 16, 2, 'rgba(220,230,240,0.85)');
    A.ell(ctx, 900, 392, 18, 6, '#8a7350'); for (let i = 0; i < 5; i++) A.ell(ctx, 892 + i * 4, 388 - (i % 2) * 3, 3, 4, i % 2 ? '#3a4a2a' : '#5a6a3a');
    A.rr(ctx, 788, 380, 64, 16, 2, '#d8b070', '#4a3320', 2);
    for (let i = 0; i < 12; i++) { const tx = 791 + i * 5 + (i > 5 ? 3 : 0); A.poly(ctx, [tx, 381, tx + 4, 381, tx + 2, 387], i % 2 ? '#7a2e2e' : '#3a2a1a'); A.poly(ctx, [tx, 395, tx + 4, 395, tx + 2, 389], i % 2 ? '#3a2a1a' : '#7a2e2e'); }
    A.rect(ctx, 819, 380, 2, 16, '#4a3320');
    for (let i = 0; i < 5; i++) A.circle(ctx, 796 + i * 9, 384 + (i % 2) * 8, 2, i % 2 ? '#f0e8d8' : '#2a1a10');
    A.rect(ctx, 856, 386, 6, 6, '#f4f0e8'); A.rect(ctx, 864, 385, 6, 6, '#f4f0e8'); A.circle(ctx, 859, 389, 1, '#222'); A.circle(ctx, 866, 387, 1, '#222'); A.circle(ctx, 868, 389, 1, '#222');
    A.amphora(ctx, 878, 398, 28, '#b0703f');
  }

  R({
    id: 'cr_taverna', name: 'Taverne', ambient: 'crete',
    start: [266, 470, 'd'],
    walk: [[40, 440, 296, 440, 296, 484, 512, 484, 512, 440, 690, 440, 690, 488, 940, 488, 940, 585, 40, 585]],
    scale: SC,
    paint(ctx, g) {
      A.wall(ctx, 0, 0, 960, 400, '#ebe4d3', 7);
      A.rect(ctx, 0, 0, 960, 34, '#4a3320');
      for (let x = 20; x < 960; x += 96) A.rect(ctx, x, 0, 14, 34, '#382616');
      A.rect(ctx, 0, 34, 960, 6, 'rgba(0,0,0,0.2)');
      A.rect(ctx, 0, 384, 960, 16, '#5a4a3a');
      A.floorTiles(ctx, 960, 400, 600, '#ab9a7c', '#6d5d47', 12, 480);
      ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(0, 400, 960, 8);
      // Fenster mit Meerblick, Läden offen
      A.rect(ctx, 44, 78, 18, 160, '#2f62ad'); A.rect(ctx, 218, 78, 18, 160, '#2f62ad');
      for (let i = 0; i < 8; i++) { A.line(ctx, 47, 88 + i * 18, 59, 88 + i * 18, 'rgba(0,0,0,0.25)', 1); A.line(ctx, 221, 88 + i * 18, 233, 88 + i * 18, 'rgba(0,0,0,0.25)', 1); }
      A.window(ctx, 70, 84, 140, 148, { frame: '#2f62ad', view: (c) => { A.sky(c, 960, 170, '#6fa8dc', '#cfe6f5', 84); A.sea(c, 70, 168, 140, 66, '#2b6f9e', '#1c7fa6', 8); A.boat(c, 96, 196, 52, '#7a5a3a', true); A.rect(c, 70, 224, 140, 10, '#b9a98a'); } });
      A.lightBeam(ctx, 100, 232, 220, 280, 'rgba(255,240,200,0.15)');
      // Tür zum Dorf (offen, Licht von draußen)
      A.rect(ctx, 234, 164, 88, 222, '#5a4a3a');
      A.rect(ctx, 240, 170, 76, 216, '#cfe0ea');
      A.rect(ctx, 240, 300, 76, 86, '#c8b48a');
      A.cypress(ctx, 296, 300, 90, '#2b4a27');
      A.rect(ctx, 240, 170, 26, 216, '#3a5a8a'); A.line(ctx, 253, 176, 253, 380, 'rgba(0,0,0,0.25)', 2);
      // Doppelaxt-Deko an der Wand
      A.rr(ctx, 336, 66, 88, 130, 6, '#5a4a3a'); A.rr(ctx, 342, 72, 76, 118, 4, '#7a2e2e');
      labrys(ctx, 380, 131, 96, '#c8a050', '#4a3a2a');
      // Fotografien unter der Doppelaxt: Grabungsmannschaft 1901, sepia
      const photo = (x, y, w, h, seed) => {
        A.rect(ctx, x - 3, y - 3, w + 6, h + 6, '#3a2a1a'); A.rect(ctx, x, y, w, h, '#c8b088');
        const r = ATL.U.rng(seed);
        A.rect(ctx, x, y, w, h * 0.45, '#d8c8a0'); A.rect(ctx, x, y + h * 0.45, w, h * 0.55, '#a89068');
        for (let i = 0; i < 4 + Math.floor(r() * 3); i++) { const px = x + 4 + r() * (w - 8), ph = 8 + r() * 6; A.rect(ctx, px - 2, y + h - ph - 3, 4, ph, '#5a4a3a'); A.circle(ctx, px, y + h - ph - 4, 2, '#8a7a6a'); }
        A.rect(ctx, x, y, w, h, 'rgba(200,170,120,0.25)');
      };
      photo(340, 222, 36, 28, 81); photo(384, 218, 34, 28, 82); photo(356, 268, 48, 34, 83);
      // Fischernetz an der Wand, mit Korkschwimmern
      ctx.strokeStyle = 'rgba(80,60,30,0.6)'; ctx.lineWidth = 1;
      for (let i = 0; i < 14; i++) { ctx.beginPath(); ctx.moveTo(446 + i * 12, 50); ctx.quadraticCurveTo(460 + i * 12, 150, 500 + i * 12, 230); ctx.stroke(); ctx.beginPath(); ctx.moveTo(614 - i * 12, 50); ctx.quadraticCurveTo(600 - i * 12, 150, 560 - i * 12, 230); ctx.stroke(); }
      for (let i = 0; i < 7; i++) A.circle(ctx, 452 + i * 26, 52 + (i % 2) * 8, 5, '#c8a858');
      A.rect(ctx, 440, 44, 190, 5, '#6b4a2b');
      // Knoblauchzopf und Kräuterbündel am Balken, Petroleumlampe auf dem Wandbrett, Paprikaschnur links
      A.line(ctx, 660, 34, 660, 60, '#8a7a50', 2);
      for (let i = 0; i < 6; i++) { const gx = 660 + (i % 2 ? 4 : -4), gy = 64 + i * 10; A.circle(ctx, gx, gy, 6.5, '#efe8dc'); A.circle(ctx, gx + 2, gy - 1, 4, 'rgba(160,120,150,0.35)'); A.line(ctx, gx, gy - 6, gx, gy - 9, '#b8a878', 1.5); }
      A.line(ctx, 688, 34, 688, 46, '#8a7a50', 2); A.rect(ctx, 684, 44, 8, 5, '#b8a060');
      ctx.strokeStyle = '#5a7a4a'; ctx.lineWidth = 1.5;
      for (let i = 0; i < 9; i++) { ctx.beginPath(); ctx.moveTo(688, 48); ctx.quadraticCurveTo(688 + (i - 4) * 3, 70, 688 + (i - 4) * 5.5, 92 + (i % 3) * 4); ctx.stroke(); }
      A.rect(ctx, 648, 204, 32, 4, '#6b4a2b'); A.poly(ctx, [676, 208, 680, 208, 680, 222], '#6b4a2b');
      A.ell(ctx, 664, 204, 9, 3, '#8a7040'); A.rr(ctx, 657, 188, 14, 16, 3, '#b08a40'); A.rect(ctx, 655, 186, 18, 3, '#8a6a30');
      A.rr(ctx, 659, 164, 10, 23, 4, 'rgba(220,230,235,0.75)'); A.rect(ctx, 661, 168, 2, 14, 'rgba(255,255,255,0.5)');
      A.line(ctx, 24, 34, 24, 98, '#8a7a50', 1.5);
      for (let i = 0; i < 7; i++) { ctx.save(); ctx.translate(24 + (i % 2 ? 5 : -5), 44 + i * 8); ctx.rotate(i % 2 ? 0.5 : -0.5); A.ell(ctx, 0, 0, 3, 7, i % 3 ? '#b8302a' : '#8a2a22'); ctx.restore(); }
      // Regal mit Flaschen hinter der Theke, Ikone in der Ecke
      A.rect(ctx, 700, 110, 236, 196, '#3e2a18');
      for (let r = 0; r < 3; r++) {
        A.rect(ctx, 700, 166 + r * 62, 236, 6, '#6b4a2b');
        for (let i = 0; i < 9; i++) { const bx = 712 + i * 25, col = ['#dfe8e0', '#7a2e2e', '#c8a050', '#4a6a3a', '#2f62ad'][(i + r) % 5]; A.rr(ctx, bx, 128 + r * 62, 14, 38, 4, col); A.rect(ctx, bx + 4, 120 + r * 62, 6, 10, A.shade(col, -0.3)); }
      }
      A.rect(ctx, 872, 40, 60, 58, '#a08040'); A.rr(ctx, 878, 46, 48, 46, 3, '#3a2a4a'); A.circle(ctx, 902, 62, 9, '#e8c890'); A.rect(ctx, 892, 70, 20, 20, '#7a2e2e');
      // Öllämpchen auf einem kleinen Wandbrett unter der Ikone
      A.rect(ctx, 888, 108, 28, 4, '#6b4a2b'); A.poly(ctx, [912, 112, 916, 112, 916, 122], '#6b4a2b');
      A.ell(ctx, 902, 106, 8, 4, '#8a6a30'); A.ell(ctx, 902, 103, 5, 2.5, '#5a4020'); A.circle(ctx, 908, 103, 1.5, '#ffd070');
      // Wanduhr und Glücksauge über der Tür, Porträt über dem Regal
      A.rr(ctx, 256, 74, 44, 58, 4, '#4a3320'); A.circle(ctx, 278, 98, 19, '#efe6d0'); A.circle(ctx, 278, 98, 19, null, '#2a1a10', 2);
      for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; A.line(ctx, 278 + Math.cos(a) * 15, 98 + Math.sin(a) * 15, 278 + Math.cos(a) * 17, 98 + Math.sin(a) * 17, '#2a1a10', i % 3 ? 1 : 2); }
      A.line(ctx, 278, 98, 270, 88, '#2a1a10', 2); A.line(ctx, 278, 98, 288, 106, '#2a1a10', 1.5); A.circle(ctx, 278, 98, 1.5, '#2a1a10');
      A.rect(ctx, 270, 120, 16, 9, '#2a1a10'); A.circle(ctx, 278, 126, 2.5, '#c8a050');
      A.line(ctx, 278, 132, 278, 146, '#8a7a50', 1); A.circle(ctx, 278, 150, 5.5, '#2f62ad'); A.circle(ctx, 278, 150, 3.8, '#f0f0f0'); A.circle(ctx, 278, 150, 2.4, '#5a9ad8'); A.circle(ctx, 278, 150, 1.2, '#101010');
      A.rect(ctx, 794, 46, 48, 58, '#8a6a30'); A.rect(ctx, 798, 50, 40, 50, '#c8b898'); A.rect(ctx, 806, 76, 24, 24, '#3a3a3a'); A.circle(ctx, 818, 68, 9, '#c8a888'); A.rect(ctx, 812, 71, 12, 3, '#5a4a3a'); A.rect(ctx, 809, 56, 18, 6, '#6a5a4a');
      // Fässer
      A.barrel(ctx, 560, 302, 62, 82, '#7a5a3a'); A.barrel(ctx, 626, 302, 62, 82, '#6f5034'); A.barrel(ctx, 592, 222, 60, 80, '#8a6a4a');
      A.rect(ctx, 556, 380, 136, 6, '#3a2a1a');
      // Tonkrüge auf den Fässern, Besen an der Wand
      A.amphora(ctx, 574, 302, 34, '#b0703f'); A.pot(ctx, 670, 302, 20, 18, '#a8703f'); A.ell(ctx, 670, 284, 10, 3, '#5a3a20');
      A.line(ctx, 474, 250, 466, 384, '#8a6a40', 3); A.poly(ctx, [458, 350, 476, 348, 486, 386, 450, 386], '#c8a860');
      for (let i = 0; i < 6; i++) A.line(ctx, 452 + i * 6, 386, 460 + i * 4, 356, 'rgba(0,0,0,0.2)', 1);
      // Bramwells Tisch: Glas, Flasche, Aschenbecher, Zeitung
      A.chair(ctx, 300, 478, 30, '#6b4a2b'); A.chair(ctx, 482, 478, 30, '#6b4a2b');
      A.table(ctx, 330, 396, 150, 28, '#6b4a2b', 56);
      A.rr(ctx, 350, 368, 12, 30, 3, '#dfe8e0'); A.rect(ctx, 353, 362, 6, 8, '#7a3a2a');
      A.rr(ctx, 372, 380, 14, 16, 2, 'rgba(220,230,240,0.8)');
      A.ell(ctx, 420, 392, 14, 6, '#3a3a3a'); A.rect(ctx, 440, 384, 34, 12, '#e8e0d0'); A.line(ctx, 444, 388, 470, 388, '#666', 1); A.line(ctx, 444, 392, 462, 392, '#666', 1);
      // Katze unter Bramwells Tisch, Stuhl mit Binsengeflecht unter dem Fenster
      cat(ctx, 402, 476, '#6a6a66', 1);
      A.rect(ctx, 176, 392, 26, 4, '#6b4a2b'); A.rect(ctx, 177, 396, 4, 26, '#6b4a2b'); A.rect(ctx, 197, 396, 4, 26, '#6b4a2b'); A.rect(ctx, 187, 398, 3, 22, '#6b4a2b');
      A.rect(ctx, 172, 420, 34, 12, '#c8a860');
      for (let i = 0; i < 8; i++) A.line(ctx, 174 + i * 4, 420, 178 + i * 4, 432, 'rgba(90,60,20,0.35)', 1);
      for (let i = 0; i < 3; i++) A.line(ctx, 172, 423 + i * 4, 206, 423 + i * 4, 'rgba(90,60,20,0.3)', 1);
      A.rect(ctx, 174, 432, 4, 12, '#5a3f28'); A.rect(ctx, 200, 432, 4, 12, '#5a3f28'); A.rect(ctx, 180, 432, 3, 10, '#5a3f28');
      // Elenis Hocker und Wollkorb
      A.rect(ctx, 90, 444, 42, 8, '#6b4a2b'); A.rect(ctx, 94, 452, 5, 26, '#5a3f28'); A.rect(ctx, 123, 452, 5, 26, '#5a3f28');
      A.ell(ctx, 160, 472, 26, 11, '#b08a50'); A.ell(ctx, 160, 468, 24, 8, '#8a6a30');
      A.circle(ctx, 150, 462, 8, '#c8c0b0'); A.circle(ctx, 166, 460, 8, '#3a3a3a'); A.circle(ctx, 158, 466, 6, '#d8c8a8');
      A.vignette(ctx, 960, 600, 0.45);
      A.grain(ctx, 960, 600, 6, 0.04);
    },
    paintFront(ctx, g) {
      // Amphore am linken Bildrand
      A.ell(ctx, 20, 596, 22, 5, 'rgba(0,0,0,0.3)'); A.amphora(ctx, 22, 598, 84, '#a86a3c');
    },
    animate(ctx, t) {
      A.dust(ctx, 90, 240, 220, 240, t, 20);
      // Vorhang in der offenen Tür bewegt sich im Luftzug
      A.curtain(ctx, 292, 170, 24, 216, '#c8b090', t, 3);
    },
    animateFront(ctx, t) { A.insects(ctx, 880, 372, 50, 20, t, 2, 'rgba(30,20,10,0.7)'); },
    hotspots: [
      { id: 'fenster', name: 'Fenster', rect: [44, 74, 192, 168], at: [140, 500, 'u'],
        look: 'Meerblick. Blau, mit einem Boot darin. In fünfzig Jahren nimmt Maria dafür Geld.', open: 'Es ist offen. Die Läden auch. Der Wind kommt von selbst.', close: 'Dann wird es stickig. Maria würde es wieder aufmachen und mich ansehen.' },
      { id: 'deko', name: 'Doppelaxt an der Wand', rect: [332, 62, 96, 140], at: [380, 500, 'u'],
        look: async (g) => { await g.say('falk', 'Eine Doppelaxt aus Blech, goldbronze bemalt, auf rotem Grund. Die Labrys. Die Minoer haben sie in jeden zweiten Stein geritzt, Evans hat daraus das Wort Labyrinth gemacht.'); await g.say('falk', 'Haus der Doppelaxt. Die Herleitung ist wackelig, aber sie gefällt den Leuten. Maria zum Beispiel.'); g.codex('labrys'); },
        take: 'Sie ist angenagelt. Und sie ist aus Blech; die echten sind aus Bronze und in Museen.', use: 'Ich habe keinen Baum zu fällen. Und die schneidet keinen.', pull: 'Angenagelt. Vier Nägel, gut gesetzt.' },
      { id: 'netz', name: 'Fischernetz', rect: [438, 42, 194, 194], at: [535, 500, 'u'],
        look: 'Ein Netz an der Wand, mit Korkschwimmern. Es hat seinen letzten Fisch vor langer Zeit gesehen und ist seither Dekoration.', take: 'Maria würde es mir über den Kopf ziehen.', use: 'Hier drin gibt es nichts zu fangen. Außer Bramwell, und der geht freiwillig ins Netz.', pull: 'Es hängt an drei Nägeln. Ich lasse es hängen.' },
      { id: 'faesser', name: 'Fässer', rect: [554, 218, 140, 168], at: [624, 500, 'u'],
        look: 'Drei Fässer. Wein vom Vorjahr, Raki vom Nachbarn, und eines, in dem Oliven schwimmen. Alles, was ein Dorf braucht.',
        open: 'Die Zapfhähne sind mit Draht gesichert. Maria vertraut ihren Gästen, aber nicht so weit.', use: 'Der Zapfhahn ist gesichert. Ich frage Maria.', take: 'Zu schwer, zu voll, zu sehr Marias.', push: 'Sie sind voll. Sie rühren sich nicht.' },
      { id: 'regal', name: 'Flaschenregal', rect: [700, 110, 236, 196], at: [800, 520, 'u'],
        look: 'Flaschen in vier Farben und ohne Etikett. Maria weiß, was drin ist. Das muss reichen.', take: 'Maria steht davor. Ich frage.', use: 'Ich frage Maria. Das ist hier der Weg zu einer Flasche.' },
      { id: 'ikone', name: 'Ikone', rect: [868, 36, 68, 74], at: [880, 520, 'u'],
        look: 'Eine Ikone in der Ecke, mit einem Öllämpchen davor. Der Heilige sieht aus, als hätte er den Colonel schon länger im Blick.', take: 'Nein. Der Heilige hat hier einen Job.', use: 'Ich zünde keine Kerzen an. Nicht für das, was ich vorhabe.' },
      { id: 'theke', name: 'Theke', rect: [700, 380, 260, 100], at: [800, 520, 'u'],
        look: 'Die Theke. Holz, von tausend Ellbogen poliert. Darauf zwei Gläser, eine Schale Oliven und Marias Ellbogen.',
        use: 'Ich lehne mich an. Maria sieht mich an. Ich lehne mich wieder weg.', take: 'Die Oliven auf der Theke sind Marias. Ich frage sie.', open: 'Die Klappe ist auf Marias Seite. Und Maria auch.' },
      { id: 'tisch', name: 'Bramwells Tisch', rect: [326, 360, 160, 66], at: [400, 508, 'u'],
        look: 'Bramwells Tisch. Ein Glas, eine Flasche, ein Aschenbecher voller Stummel und ein Zeitungsblatt von 1934. Er hat es noch nicht fertig gelesen.',
        take: 'Bramwell würde die Flasche vermissen. Das Glas nicht, aber ich brauche kein Glas.', use: 'Ich setze mich nicht. Wer sich hier hinsetzt, bleibt dreißig Jahre.', open: 'Die Flasche ist offen. Seit Stunden.' },
      { id: 'korb', name: 'Wollkorb', rect: [132, 454, 56, 30], at: [190, 510, 'l'],
        look: 'Elenis Korb: Wolle in Grau, Wolle in Schwarz, ein Knäuel Naturweiß und eine Schere, die aussieht, als könnte sie Draht schneiden.',
        take: 'Ich nehme keiner alten Frau die Wolle weg. Ich frage sie. Sie sitzt direkt daneben.', open: 'Er ist offen. Es ist ein Korb.', use: 'Die Schere ist verlockend. Aber Eleni sieht alles, auch ohne hinzusehen.' },
      { id: 'hocker', name: 'Hocker', rect: [88, 442, 46, 40], at: [190, 510, 'l'], look: 'Elenis Hocker. Drei Beine, keines gerade, und er steht trotzdem.', take: 'Sie sitzt darauf.', use: 'Da sitzt schon jemand.' },
      { id: 'uhr', name: 'Wanduhr', rect: [254, 72, 48, 62], at: [278, 500, 'u'],
        look: 'Eine Wanduhr. Sie geht nach, zwanzig Minuten. Auf Kreta ist das pünktlich.' },
      { id: 'fotos', name: 'Fotografien', rect: [336, 214, 88, 92], at: [380, 500, 'u'],
        look: 'Fotografien, sepia: Männer mit Hacken vor einer Mauer, 1901. Einer davon ist Bramwell, sagt Bramwell. Er zeigt jedes Mal auf einen anderen.' },
      { id: 'tavli', name: 'Tavli-Brett', rect: [786, 378, 86, 20], at: [800, 520, 'u'], z: 484,
        // Zeichnet die ganze Theke samt Aufsatz: z-sortiert, damit Maria dahinter und Falk davor steht
        paint: (ctx) => tavernaCounter(ctx),
        look: 'Ein Tavli-Brett, aufgeklappt, die Würfel daneben. Maria gewinnt, heißt es. Gegen jeden, auch gegen den Popen.' },
    ],
    exits: [
      { id: 'tuer', name: 'Tür zum Dorf', rect: [232, 160, 92, 228], at: [278, 500, 'u'], to: 'cr_village', pos: [753, 470], dir: 'd',
        look: 'Die Tür steht offen. Draußen Sonne, eine Ziege und Livia, in dieser Reihenfolge.' },
    ],
    actors: [
      { id: 'maria', x: 820, y: 446, dir: 'd', at: [800, 520, 'u'], talk: (g) => g.dialog('maria'),
        look: 'Maria, die Wirtin. Sie hat die Arme verschränkt und sieht trotzdem freundlich aus. Das kann nicht jeder.',
        giveWith: { muenzen: async (g) => { await g.say('maria', 'Geld nehme ich gern. Sagen Sie nur, wofür.'); await g.dialog('maria'); }, hut: [['maria', 'Der gehört dem Colonel. Geben Sie ihn ihm, dann hört er auf zu jammern.']], raki: [['maria', 'Den habe ich Ihnen verkauft. Zurücknehmen tue ich nichts.']], oliven: [['maria', 'Meine Oliven. Behalten Sie sie, die Ziege wartet.']], wolle: [['maria', 'Elenis Wolle. Ich stricke nicht.']], plan: [['maria', 'Bramwells Zettel. Ich habe ihn oft genug unter dem Tisch aufgehoben.']], default: [['maria', 'Das brauche ich nicht. Was ich brauche, steht hinter mir im Regal.']] } },
      { id: 'bramwell', x: 546, y: 480, dir: 'l', at: [610, 508, 'l'], talk: (g) => g.dialog('bramwell'),
        look: (g) => g.flag('bramwell_plan') ? 'Colonel Bramwell, a. D., mit Hut. Der Hut hat Bissspuren. Er trägt ihn trotzdem wie eine Auszeichnung.' : 'Colonel Bramwell, a. D. Britischer Amateurarchäologe, sonnenrot, ohne Hut. Er hält sich am Tisch fest und der Tisch an ihm.',
        giveWith: {
          hut: async (g) => {
            await g.say('bramwell', 'Mein Hut! Er hat gelitten. Wir haben alle gelitten.');
            g.drop('hut');
            await g.message('Bramwell setzt den Hut auf, feucht wie er ist, und steht einen Moment gerade.', 2200);
            await g.say('bramwell', 'Hier, Sir, wie versprochen. Mein Plan der Westmagazine und der Pfeilerkrypta. Mit Anmerkungen. Die Anmerkungen sind der Teil, der stimmt.');
            g.take('plan'); g.set('bramwell_plan');
            await g.say('bramwell', 'Die Sache mit Yannis\' Großvater habe ich auch aufgeschrieben. Unsinn, natürlich. Aber Unsinn hält sich besser als Fakten, das habe ich in der Armee gelernt.');
            await g.say('falk', 'Danke, Colonel.');
            await g.say('bramwell', 'Bringen Sie mir etwas aus der Krypta mit. Eine Scherbe. Eine Geschichte. Egal.');
            g.objective('Bramwells Plan lesen und den Palast von Knossos ansehen.');
          },
          raki: ['Bramwell nimmt die Flasche, trinkt, gibt sie zurück.', ['bramwell', 'Grässlich. Danke, Sir.']], oliven: [['bramwell', 'Oliven? Ich habe Prinzipien, Sir. Und einen Magen.']], muenzen: [['bramwell', 'Ich bin kein Bettler, Sir. Ich bin ein Colonel mit Durst. Das ist ein Unterschied.']], plan: [['bramwell', 'Der ist jetzt Ihrer. Ich habe ihn im Kopf. Ungefähr.']], wolle: [['bramwell', 'Wolle? Ich stricke nicht, Sir. Ich habe es in Indien versucht.']],
          default: ['Bramwell sieht das Ding an, dann Falk.', ['bramwell', 'Nein, Sir. Aber danke für den Gedanken.']],
        } },
      { id: 'eleni', x: 110, y: 478, dir: 'r', at: [190, 508, 'l'], talk: (g) => g.dialog('eleni'),
        look: 'Kyria Eleni. Schwarz gekleidet, ein Kopftuch, und sie strickt, ohne hinzusehen. Sie sieht stattdessen mich an.',
        giveWith: { oliven: ['Eleni nimmt eine Olive, nickt, strickt weiter.', ['falk', 'Die anderen behalte ich.']], wolle: [['eleni', 'Die habe ich Ihnen gegeben. Behalten Sie sie, bis Sie wieder draußen sind.']], raki: [['eleni', 'Um diese Zeit? Geben Sie das dem Colonel, der hat schon angefangen.']], hut: [['eleni', 'Der gehört dem Engländer. Er sieht ohne besser aus, aber sagen Sie ihm das nicht.']], muenzen: [['eleni', 'Ich verkaufe nichts. Ich gebe, oder ich gebe nicht.']], default: ['Eleni sieht nicht einmal hin. Die Nadeln klappern weiter.'] } },
    ],
    async enter(g) {
      if (g.flag('taverna_intro')) return;
      g.set('taverna_intro');
      await g.say('falk', 'Kühl, dunkel, und es riecht nach Anis und altem Holz. Drei Gäste, wenn man die Wirtin mitzählt, und alle drei sehen mich an.');
    },
  });

  ATL.dialogs.define('maria', {
    nodes: {
      root: {
        say: (g) => g.flag('maria_gruss') ? [] : [['maria', 'Kalimera. Sie sind der mit der Frau, die Griechisch kann. Was darf es sein?']],
        action: (g) => g.set('maria_gruss'),
        options: [
          { text: 'Eine Flasche Raki, bitte.', cond: (g) => !g.has('raki'), say: [['maria', 'Vom Nachbarn gebrannt. Fragen Sie nicht, wo.'], ['falk', 'Ich lege ein paar Münzen auf die Theke. Sie zählt nicht nach.']], action: (g) => { g.take('raki'); } },
          { text: 'Eine Handvoll Oliven.', cond: (g) => !g.has('oliven'), say: [['maria', 'Aus dem Garten hinter der Kapelle. Die schwarzen, die guten.'], ['falk', 'Ich zahle. Kleingeld reicht; sie hat aufgerundet, nach unten.']], action: (g) => { g.take('oliven'); } },
          { text: 'Wer ist der Engländer da drüben?', once: true, say: [['maria', 'Colonel Bramwell. Er hat bei Evans gegraben, vor dreißig Jahren, und ist nie abgereist. Er zahlt seine Rechnung, meistens.'], ['maria', 'Heute nicht. Die Ziege hat seinen Hut, und ohne Hut ist er kein Gentleman, sagt er. Ohne Hut zahlt er auch nicht, sage ich.']] },
          { text: 'Und die Dame mit dem Strickzeug?', once: true, say: [['maria', 'Kyria Eleni. Sie hat Geschichten für alle Fremden. Aber sie erzählt sie nicht. Sie fragt sie ab.'], ['falk', 'Wie in der Schule.'], ['maria', 'Schlimmer. In der Schule konnte man abschreiben.']] },
          { text: 'War in letzter Zeit jemand Fremdes hier?', once: true, say: [['maria', 'Ein Mann, heute Morgen. Kein Grieche. Schwarzer Mantel bei dreißig Grad. Hat nach dem Weg zum Palast gefragt und keinen Kaffee bestellt.'], ['falk', 'Kessler.'], ['maria', 'Er hat sich nicht vorgestellt. Der Colonel hat mit ihm geredet. Der Colonel redet mit jedem, der einen Raki bezahlt.']], action: (g) => g.set('kessler_gesehen') },
          { text: 'Was wissen Sie über den Palast?', once: true, say: [['maria', 'Steine. Mein Mann hat da als Junge Wasser getragen, für die Engländer. Er sagt, unten im Westflügel ist ein Raum mit einem Pfeiler, in den keiner gern geht.'], ['maria', 'Der Colonel weiß, welcher. Und der alte Yannis am Kai weiß mehr, als er sagt. Das ist bei Yannis immer so.']] },
          { text: 'Das war\'s, danke.', end: true, say: [['maria', 'Efcharistó. Kommen Sie wieder, wenn Sie Durst haben. Oder eine Ziege füttern müssen.']] },
        ],
      },
    },
  });

  ATL.dialogs.define('bramwell', {
    nodes: {
      root: {
        say: (g) => g.flag('bramwell_gruss') ? [] : [['bramwell', 'Sir! Ein neues Gesicht. Bleiben Sie stehen oder setzen Sie sich, ganz wie Sie wollen. Ich lehne. Das ist eine Entscheidung.']],
        action: (g) => g.set('bramwell_gruss'),
        options: [
          { text: 'Sie haben in Knossos gegraben?', once: true, say: [['bramwell', 'Mit Evans, 1901 bis 1905. Ich war jung, er war Evans. Ich habe Erde geschaufelt und er hat Geschichte gefunden. So ist die Verteilung.'], ['bramwell', 'Danach die Armee, Indien, und dann wieder hierher. Die Insel lässt einen nicht los. Der Raki auch nicht.']] },
          { text: 'Gibt es eine Krypta unter dem Palast?',
            say: (g) => g.flag('bramwell_plan')
              ? [['bramwell', 'Der Plan ist bei Ihnen, Sir. Lesen Sie den Rand. Die Mitte ist Evans, der Rand bin ich.']]
              : [['bramwell', 'Krypten, zwei. Pfeilerkrypten, mit Doppeläxten in den Stein geritzt. Ich habe einen Plan davon, den besten, der existiert, weil ich ihn gezeichnet habe.'], ['bramwell', 'Ich zeige Ihnen alles, Sir, sobald ich meinen Hut wiederhabe. Ein Gentleman verhandelt nicht ohne Hut.'], ['falk', 'Wo ist der Hut?'], ['bramwell', 'Draußen. In einer Ziege.']],
            action: (g) => { if (!g.flag('bramwell_plan')) g.set('bramwell_hut_wunsch'); } },
          { text: 'Ein Fremder soll heute Morgen hier gewesen sein.', once: true, cond: (g) => g.flag('kessler_gesehen'), say: [['bramwell', 'Ein Deutscher. Hat mir einen Raki bezahlt und nach der Krypta gefragt. Ich habe ihm von der Krypta erzählt. Von der Axt nicht. Glaube ich.'], ['falk', 'Sie glauben.'], ['bramwell', 'Der zweite Raki, Sir. Er trübt die Erinnerung an den ersten.']] },
          { text: 'Was halten Sie von der Sache mit dem Labyrinth?', once: true, say: [['bramwell', 'Evans hielt den ganzen Palast für das Labyrinth. Tausend Räume, Gänge, Treppen; ein Athener verläuft sich darin auch ohne Ungeheuer.'], ['bramwell', 'Der alte Yannis sagt, es ist darunter. Yannis sagt auch, sein Großvater hat den Boden geöffnet. Yannis sagt viel, wenn man ihm Raki gibt.'], ['falk', 'Sie auch, Colonel.'], ['bramwell', 'Ich bin Brite, Sir. Ich sage viel, auch ohne.']] },
          { text: 'Ich sehe zu, dass ich den Hut bekomme.', end: true, say: [['bramwell', 'Gott segne Sie, Sir. Und die Ziege verdamme er.']] },
        ],
      },
    },
  });

  ATL.dialogs.define('eleni', {
    nodes: {
      root: {
        say: (g) => g.flag('eleni_gruss') ? [] : [['eleni', 'Setzen Sie sich nicht auf den Korb. Alle setzen sich auf den Korb.']],
        action: (g) => g.set('eleni_gruss'),
        options: [
          { text: 'Was stricken Sie da?', once: true, say: [['eleni', 'Socken. Für den Winter. Der Winter kommt jedes Jahr, und jedes Jahr sind die Männer überrascht.']] },
          { text: 'Ich bräuchte ein Knäuel Wolle.', cond: (g) => !g.flag('eleni_wolle'), say: [['eleni', 'Wolle. Für das Labyrinth, nehme ich an. Alle Fremden wollen ins Labyrinth, und keiner weiß, wie die Geschichte geht.'], ['eleni', 'Erzählen Sie sie mir. Richtig. Dann sehen wir weiter.']], next: 'q1' },
          { text: 'Ich lasse Sie in Ruhe.', end: true, say: [['eleni', 'Tun Sie das. Und grüßen Sie die Frau, die Griechisch spricht. Sie hat Manieren.']] },
        ],
      },
      q1: {
        say: [['eleni', 'Wer ging ins Labyrinth?']],
        options: [
          { text: 'Theseus, der Sohn des Königs von Athen.', say: [['eleni', 'Theseus. Gut. Freiwillig, mit den anderen dreizehn, die Athen als Tribut schicken musste.']], next: 'q2' },
          { text: 'Herakles.', once: true, say: [['eleni', 'Herakles hat den Stier gefangen und übers Meer gebracht. Ins Labyrinth ist er nie gegangen, er hatte andere Aufträge. Noch einmal.']] },
          { text: 'Odysseus.', once: true, say: [['eleni', 'Der hat sich woanders verlaufen. Zehn Jahre lang, auf dem Meer. Noch einmal.']] },
        ],
      },
      q2: {
        say: [['eleni', 'Und wer gab ihm den Faden?']],
        options: [
          { text: 'Ariadne, die Tochter des Minos.', say: [['eleni', 'Ariadne. Sie hat ihn gesehen, als die Athener von Bord gingen, und das war es dann für sie. Und weiter?']], next: 'q3' },
          { text: 'Pasiphae, die Königin.', once: true, say: [['eleni', 'Die Mutter des Ungeheuers? Die hätte ihm den Weg hinein gezeigt, nicht hinaus. Noch einmal.']] },
          { text: 'Daidalos, der das Labyrinth gebaut hat.', once: true, say: [['eleni', 'Daidalos hat ihr vielleicht gesagt, wie es geht. Aber gegeben hat den Faden jemand, der einen Grund hatte. Noch einmal.']] },
        ],
      },
      q3: {
        say: [['eleni', 'Und was hat er mit dem Faden gemacht?']],
        options: [
          { text: 'Das Ende am Eingang festgebunden und ihn beim Hineingehen abgerollt.', say: [['eleni', 'Am Eingang festgebunden. Nicht in der Tasche. Nicht um den Hals von irgendwem.']], next: 'done' },
          { text: 'Ihn dem Minotaurus um den Hals geworfen.', once: true, say: [['eleni', 'Mit einem Wollfaden? Dann wäre er der Erste gewesen, der so gestorben ist. Noch einmal.']] },
          { text: 'In der Tasche gelassen. Er hat den Weg auch so gefunden.', once: true, say: [['eleni', 'Dann säße er heute noch da drin, bei den anderen. Noch einmal.']] },
        ],
      },
      done: {
        say: [['eleni', 'Gut. Sie können zuhören. Das ist selten bei Männern mit Hüten.'], 'Eleni greift in den Korb, ohne hinzusehen, und hält Falk ein graues Knäuel hin.', ['eleni', 'Das reicht für einen Weg hinein und einen heraus. Für mehr hat auch der Faden der Ariadne nicht gereicht.'], ['falk', 'Danke, Kyria Eleni.'], ['eleni', 'Und was er danach mit dem Mädchen gemacht hat, auf Naxos, das erzählen Sie besser niemandem. Es macht die Geschichte nicht besser.']],
        action: async (g) => { g.take('wolle'); g.set('eleni_wolle'); g.codex('ariadne'); if (g.flag('krypta_offen') && !g.flag('faden')) g.objective('Den Faden am Bronzering in der Krypta festbinden und ins Labyrinth gehen.'); },
        end: true,
      },
    },
  });

  // ---------------------------------------------------------------- Knossos
  R({
    id: 'cr_knossos', name: 'Palast von Knossos', ambient: 'crete',
    start: [90, 520, 'r'],
    walk: [[60, 440, 900, 440, 940, 585, 20, 585]],
    scale: SC,
    paint(ctx, g) {
      A.sky(ctx, 960, 330, '#5f9fd8', '#e2eef5');
      A.clouds(ctx, 960, 56, 3, 15);
      A.sun(ctx, 830, 66, 26);
      A.hills(ctx, 960, 300, '#a4b088', 17, 46);
      A.hills(ctx, 960, 328, '#86965f', 19, 34);
      for (let i = 0; i < 10; i++) A.tree(ctx, 20 + i * 104, 338 + (i % 3) * 6, 56 + (i % 2) * 10, '#6f7f4f', '#5a4a3a', i + 3);
      // Zypressen und Grabungszelt an den Rändern, weiter hinten und blasser
      A.cypress(ctx, 22, 344, 150, '#3d5a38'); A.cypress(ctx, 46, 348, 96, '#4a6a44');
      A.tent(ctx, 930, 342, 46, 30, '#d8cfb0'); A.cypress(ctx, 952, 350, 130, '#3d5a38');
      // Westflügel: Mauer aus Kalksteinquadern
      A.stones(ctx, 60, 200, 840, 240, '#c9b99b', 27, 34);
      A.rect(ctx, 60, 196, 840, 8, '#8a7a60');
      A.rect(ctx, 60, 190, 840, 6, '#e0d4bc');
      // Portikus mit minoischen Säulen
      A.rect(ctx, 96, 118, 392, 26, '#262626');
      A.rect(ctx, 96, 144, 392, 12, '#b34a3a');
      A.rect(ctx, 100, 156, 384, 8, '#d8c8a8');
      // Schatten des Portikus auf der Rückwand (nur auf der Mauer, nicht im Himmel darüber)
      A.rect(ctx, 110, 196, 364, 204, 'rgba(0,0,0,0.22)');
      // Freskenreste an der Rückwand des Portikus (Lilien, blaues Band, vom Stein angefressen)
      const frag = (x, y, w, h, seed) => {
        const r = ATL.U.rng(seed);
        A.rr(ctx, x, y, w, h, 6, '#d8c8a8');
        A.rect(ctx, x, y + h * 0.7, w, h * 0.3, '#2f5f8a');
        for (let i = 0; i < 4; i++) { const fx = x + w * (0.15 + i * 0.24); A.line(ctx, fx, y + h * 0.7, fx, y + h * 0.3, '#3d6e4a', 2); A.ell(ctx, fx, y + h * 0.26, 5, 7, i % 2 ? '#b34a3a' : '#e7d5b0'); }
        for (let i = 0; i < 6; i++) A.ell(ctx, x + r() * w, y + r() * h, 6 + r() * 10, 4 + r() * 8, A.shade('#c9b99b', -0.28));
      };
      frag(164, 232, 54, 62, 61); frag(262, 296, 56, 44, 62); frag(364, 250, 54, 40, 63);
      // Stylobat: zwei Stufen, auf denen die Säulen stehen
      A.rect(ctx, 92, 400, 400, 18, '#cfc2a4'); A.rect(ctx, 92, 400, 400, 3, '#e4d9c0'); A.rect(ctx, 92, 415, 400, 3, 'rgba(0,0,0,0.18)');
      A.rect(ctx, 84, 418, 416, 18, '#c0b294'); A.rect(ctx, 84, 418, 416, 3, '#dcd0b6'); A.rect(ctx, 84, 433, 416, 3, 'rgba(0,0,0,0.2)');
      for (const x of [140, 240, 340, 440]) { A.ell(ctx, x, 401, 20, 4, 'rgba(0,0,0,0.25)'); A.column(ctx, x, 400, 236, 40, '#b8402e', 'minoan'); }
      horns(ctx, 452, 118, 52, '#e0d6c4');
      // Stierfresko rechts des Portikus (schmaler als der Abgang breit ist, damit sich beides nicht überschneidet)
      A.rect(ctx, 592, 196, 160, 133, '#8a7a60');
      ctx.save(); ctx.translate(598, 202); ctx.scale(148 / 232, 121 / 142); ctx.translate(-514, -202);
      A.fresco(ctx, 514, 202, 232, 142, 3, ['#e6d2a8', '#d8c090', '#cfb383']);
      A.rect(ctx, 514, 202, 232, 142, 'rgba(220,200,160,0.5)');
      A.rect(ctx, 514, 202, 232, 14, '#2f5f8a'); A.rect(ctx, 514, 330, 232, 14, '#2f5f8a');
      A.meander(ctx, 518, 205, 224, 9, '#e6d5b0');
      A.ell(ctx, 630, 282, 74, 30, '#8a4a3a'); A.ell(ctx, 700, 268, 24, 18, '#8a4a3a');
      A.poly(ctx, [712, 258, 740, 236, 732, 262], '#e6d5b0'); A.poly(ctx, [704, 254, 716, 226, 716, 258], '#e6d5b0');
      for (const lx of [578, 600, 660, 682]) A.line(ctx, lx, 300, lx + (lx < 630 ? -8 : 10), 324, '#7a3a2a', 6);
      A.line(ctx, 556, 280, 528, 300, '#7a3a2a', 4);
      A.line(ctx, 616, 250, 646, 236, '#b34a3a', 6); A.line(ctx, 646, 236, 672, 250, '#b34a3a', 6); A.circle(ctx, 676, 256, 6, '#b34a3a');
      A.line(ctx, 616, 250, 606, 268, '#b34a3a', 5);
      A.line(ctx, 708, 284, 728, 306, '#efe4c8', 5); A.line(ctx, 728, 306, 722, 326, '#efe4c8', 5); A.circle(ctx, 704, 280, 6, '#efe4c8');
      A.line(ctx, 548, 296, 540, 320, '#efe4c8', 5); A.circle(ctx, 550, 288, 6, '#efe4c8');
      ctx.restore();
      // Thronsaal (Nische rechts) und Kulthörner auf der Mauer
      A.rect(ctx, 760, 232, 136, 168, '#2c2418');
      A.rect(ctx, 768, 240, 120, 100, '#b34a3a'); A.rect(ctx, 768, 240, 120, 100, 'rgba(0,0,0,0.35)');
      A.spirals(ctx, 772, 246, 112, 22, 'rgba(230,210,170,0.6)');
      A.rr(ctx, 806, 300, 46, 100, 6, '#d8d0c0'); A.poly(ctx, [806, 300, 852, 300, 848, 282, 838, 292, 829, 278, 820, 292, 810, 282], '#d8d0c0');
      A.rect(ctx, 796, 366, 66, 12, '#c8c0b0'); A.rect(ctx, 800, 378, 58, 22, '#b8b0a0');
      horns(ctx, 828, 196, 120, '#e8dfcc');
      // Stufen unter der Thronsaal-Nische, Riss in der Mauer, Eidechse
      for (let i = 0; i < 5; i++) { A.rect(ctx, 762 + i * 6, 432 - i * 8, 132 - i * 12, 8, A.shade('#b8a888', i * 0.04)); A.rect(ctx, 762 + i * 6, 432 - i * 8, 132 - i * 12, 2, '#d8cbb0'); }
      A.cracks(ctx, 560, 352, 180, 80, 5, 'rgba(0,0,0,0.28)');
      lizard(ctx, 612, 366, 1);
      // Grabungsausrüstung: Sieb, Schubkarre, nummerierte Kisten
      ctx.save(); ctx.translate(616, 440); ctx.rotate(-0.18);
      A.rr(ctx, -18, -36, 36, 36, 2, '#7a5a3a'); A.rect(ctx, -15, -33, 30, 30, '#c8c0a8');
      for (let i = 1; i < 6; i++) { A.line(ctx, -15 + i * 5, -33, -15 + i * 5, -3, 'rgba(0,0,0,0.3)', 1); A.line(ctx, -15, -33 + i * 5, 15, -33 + i * 5, 'rgba(0,0,0,0.3)', 1); }
      ctx.restore();
      A.ell(ctx, 668, 440, 40, 5, 'rgba(0,0,0,0.25)');
      A.poly(ctx, [640, 410, 700, 410, 694, 434, 648, 434], '#6a6e5a'); A.rect(ctx, 640, 410, 60, 3, '#8a8e7a');
      A.ell(ctx, 670, 410, 26, 6, '#8a7250');
      A.line(ctx, 700, 412, 718, 406, '#4a3a2a', 3); A.line(ctx, 694, 434, 694, 440, '#4a3a2a', 3);
      A.circle(ctx, 646, 436, 9, '#2a2a2a'); A.circle(ctx, 646, 436, 3, '#8a8a8a');
      A.crate(ctx, 720, 410, 38, 30, '#a08a60', 'K 12'); A.crate(ctx, 724, 384, 30, 26, '#a89060', '7');
      // Abgang zur Krypta (Mitte): Türöffnung, dahinter Stufen, die nach unten ins Dunkel führen
      A.rect(ctx, 480, 300, 100, 140, '#100c08');
      for (let i = 0; i < 6; i++) A.rect(ctx, 484 + i * 3, 418 - i * 20, 92 - i * 6, 18, A.shade('#7a6a56', -i * 0.14));
      A.rect(ctx, 474, 292, 112, 10, '#8a7a60'); A.rect(ctx, 474, 300, 6, 140, '#7a6a52'); A.rect(ctx, 580, 300, 6, 140, '#6a5a44');
      // Kniehohe Kette der Britischen Schule vor dem Abgang, an zwei Pfosten
      for (const px of [466, 588]) { A.rect(ctx, px, 380, 6, 56, '#5a4a3a'); A.rect(ctx, px - 1, 378, 8, 4, '#7a6a5a'); A.ell(ctx, px + 3, 436, 7, 2.5, 'rgba(0,0,0,0.3)'); }
      A.chain(ctx, 472, 412, 588, 414, '#777');
      // Magazin mit Pithoi links: niedrige Mauer eines Vorratsraums vor dem Portikus
      A.stones(ctx, 40, 326, 230, 110, '#b3a388', 29, 24); A.rect(ctx, 40, 322, 230, 6, '#d8ccb0');
      A.rect(ctx, 40, 428, 230, 8, 'rgba(0,0,0,0.18)');
      const pithos = (x, y, w, h, color, lid) => {
        const jar = () => { ctx.beginPath(); ctx.moveTo(x + w * 0.26, y + 6); ctx.lineTo(x + w * 0.74, y + 6); ctx.quadraticCurveTo(x + w * 1.06, y + h * 0.3, x + w * 0.86, y + h * 0.72); ctx.quadraticCurveTo(x + w * 0.76, y + h * 0.96, x + w * 0.62, y + h); ctx.lineTo(x + w * 0.38, y + h); ctx.quadraticCurveTo(x + w * 0.24, y + h * 0.96, x + w * 0.14, y + h * 0.72); ctx.quadraticCurveTo(x - w * 0.06, y + h * 0.3, x + w * 0.26, y + 6); ctx.closePath(); };
        jar(); ctx.fillStyle = color; ctx.fill();
        jar(); ctx.fillStyle = A.grad(ctx, x, 0, x + w, 0, ['rgba(0,0,0,0.35)', 'rgba(255,255,255,0.14)', 'rgba(0,0,0,0.4)']); ctx.fill();
        ctx.save(); jar(); ctx.clip();
        for (let i = 1; i < 5; i++) { ctx.strokeStyle = 'rgba(60,30,10,0.45)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x - 10, y + (i * h) / 5.2); ctx.quadraticCurveTo(x + w / 2, y + (i * h) / 5.2 + 6, x + w + 10, y + (i * h) / 5.2); ctx.stroke(); }
        for (let i = 0; i < 3; i++) A.line(ctx, x + w * 0.2 + i * w * 0.3, y + h * 0.12, x + w * 0.1 + i * w * 0.3, y + h * 0.3, 'rgba(60,30,10,0.35)', 2);
        ctx.restore();
        A.ell(ctx, x + w / 2, y + 6, w * 0.26, 6, A.shade(color, -0.35)); A.ell(ctx, x + w / 2, y + 4, w * 0.3, 6, null, A.shade(color, 0.15), 3);
        if (lid) { A.ell(ctx, x + w / 2, y + 2, w * 0.36, 8, '#6a4a2a'); A.ell(ctx, x + w / 2, y - 2, w * 0.1, 4, '#4a3020'); }
      };
      pithos(66, 326, 74, 108, '#a8703f', !g.flag('doppelaxt_genommen'));
      pithos(160, 330, 70, 104, '#9a6a40', false);
      A.line(ctx, 172, 360, 196, 412, 'rgba(0,0,0,0.4)', 2);
      // Kleinerer Pithos weiter hinten, Amphore in der Ecke, Scherben am Boden
      pithos(236, 372, 34, 62, '#a88a68', false);
      A.amphora(ctx, 52, 436, 40, '#a8703f');
      for (const [sx, sy, sa] of [[148, 428, 0.3], [156, 433, -0.6], [246, 432, 1.1]]) { ctx.save(); ctx.translate(sx, sy); ctx.rotate(sa); A.poly(ctx, [-6, 0, 6, -2, 3, 4], '#9a6a40'); ctx.restore(); }
      // Hof: Steinplatten, Gras in den Fugen
      A.floorTiles(ctx, 960, 436, 600, '#c8b48f', '#8f7d60', 10, 480);
      ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(0, 436, 960, 6);
      const r = ATL.U.rng(58);
      for (let i = 0; i < 40; i++) A.ell(ctx, r() * 960, 445 + r() * 150, 6 + r() * 10, 2 + r() * 2, `rgba(90,110,50,${0.2 + r() * 0.3})`);
      // Oleander an der Mauer, Grasbüschel an der Mauerkante
      A.bush(ctx, 928, 440, 56, '#4a6a3a', 9);
      for (let i = 0; i < 14; i++) A.circle(ctx, 908 + r() * 44, 412 + r() * 24, 2.5, i % 3 ? '#e07898' : '#f0a8c0');
      for (const gx of [300, 424, 606, 704, 862]) A.grass(ctx, gx, 441, 30, gx, '#7a8a48');
      // Schild
      A.rect(ctx, 902, 330, 6, 106, '#5a4a3a'); A.rr(ctx, 866, 300, 78, 40, 2, '#e8e0d0', '#6a5a48', 1.5);
      A.text(ctx, 'ΚΝΩΣΟΣ', 905, 318, { font: 'bold 12px Georgia', color: '#3a2a1a', align: 'center' });
      A.text(ctx, 'B.S.A.', 905, 332, { font: '10px Georgia', color: '#3a2a1a', align: 'center' });
      A.vignette(ctx, 960, 600, 0.3);
      A.grain(ctx, 960, 600, 7, 0.04);
    },
    paintFront(ctx, g) {
      // Zypressenzweig oben links, Rand eines großen Pithos am rechten Bildrand
      ctx.strokeStyle = '#2a4a26'; ctx.lineWidth = 5; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(-8, 26); ctx.quadraticCurveTo(50, 40, 124, 84); ctx.stroke();
      const r = ATL.U.rng(88);
      for (let i = 0; i < 40; i++) {
        const k = r(), bx = -8 + 132 * k, by = 26 + 58 * k * k + (r() - 0.5) * 6, a = (r() - 0.5) * 2.4;
        ctx.strokeStyle = r() < 0.5 ? '#1f3a1e' : '#2e5a2c'; ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx + Math.cos(a) * 22, by + Math.sin(a) * 22 + 6); ctx.stroke();
      }
      A.ell(ctx, 970, 598, 60, 10, 'rgba(0,0,0,0.35)');
      ctx.fillStyle = A.grad(ctx, 920, 0, 1000, 0, ['#5a3a22', '#a8703f']);
      ctx.beginPath(); ctx.moveTo(928, 600); ctx.quadraticCurveTo(916, 540, 934, 500); ctx.lineTo(944, 508); ctx.lineTo(952, 496); ctx.lineTo(960, 504); ctx.lineTo(960, 600); ctx.closePath(); ctx.fill();
      for (let i = 0; i < 3; i++) { ctx.strokeStyle = 'rgba(60,30,10,0.4)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(918 + i * 2, 520 + i * 26); ctx.quadraticCurveTo(940, 526 + i * 26, 960, 522 + i * 26); ctx.stroke(); }
    },
    animate(ctx, t) {
      A.dust(ctx, 480, 300, 100, 130, t, 12, 'rgba(255,240,200,0.2)');
      gulls(ctx, t, 5, 66, 'rgba(30,30,45,0.75)');
    },
    hotspots: [
      { id: 'saeulen', name: 'Säulen', rect: [96, 110, 392, 300], at: [290, 470, 'u'],
        look: async (g) => { await g.say('falk', 'Säulen, rot bemalt, oben breiter als unten. Zedernstämme, verkehrt herum gesetzt, sagt Evans, damit sie nicht wieder austreiben. Diese hier sind aus Beton.'); await g.say('falk', 'Evans hat rekonstruiert, was er zu wissen glaubte. Das Ergebnis ist ein Palast, wie ihn ein Engländer von 1900 gebaut hätte, wenn er Minoer gewesen wäre.'); g.codex('knossos'); },
        take: 'Beton. Evans hat für die Ewigkeit gebaut, mindestens.', push: 'Beton mit Eisen drin. Nicht mit mir.', use: 'Ich lehne mich an. Der Schatten ist das Beste an dieser Säule.' },
      { id: 'fresko', name: 'Stierfresko', rect: [592, 196, 160, 133], at: [630, 470, 'u'],
        look: async (g) => {
          await g.say('falk', 'Das Stierfresko. Ein Stier im gestreckten Galopp, ein Springer über seinem Rücken, einer an den Hörnern, einer dahinter, der ihn auffängt. Die Frauen weiß, der Mann rot, wie es die Ägypter auch gemalt haben.');
          await g.say('falk', 'Evans hat es aus Bruchstücken zusammengesetzt. Wie viel davon minoisch ist und wie viel Evans, weiß niemand so genau. Es ist trotzdem das beste Bild, das wir von ihnen haben.');
          await g.say('falk', 'Ein Palast ohne Mauern, tausend Räume, überall Stiere. Und darunter, wenn Livia recht hat, ein Labyrinth. Der Minotaurus hätte hier gute Nachbarn gehabt.');
          g.codex('stier'); g.codex('minoer'); g.codex('minotaurus');
        },
        take: 'Es ist eine Kopie auf Putz. Das Original hängt in Heraklion, und selbst das ist zur Hälfte Vermutung.', use: 'Ich fasse keine Fresken an. Auch keine Kopien. Berufskrankheit.', push: 'Die Wand bleibt, wo sie ist.' },
      { id: 'kulthoerner', name: 'Kulthörner', rect: [766, 120, 124, 80], at: [828, 470, 'u'],
        look: async (g) => { await g.say('falk', 'Kulthörner. Stilisierte Stierhörner aus Stein, wie sie auf den Mauern des Palastes standen. Evans hat sie aufgestellt; ob genau hier, weiß nur er.'); await g.say('falk', 'Man findet sie auf Altären, auf Dächern, auf Siegeln. Wer hier lebte, hat den Stier nicht nur gemalt.'); g.codex('stier'); },
        take: 'Ein halber Zentner Stein. Und der Wächter, den es hier nicht gibt, würde es trotzdem merken.', push: 'Sie sind mit der Mauer vermörtelt.', use: 'Sie sind Stein. Und sie haben kein Geheimnis, nur Gewicht.' },
      { id: 'thron', name: 'Thronsaal', rect: [760, 232, 136, 168], at: [828, 470, 'u'],
        look: async (g) => { await g.say('falk', 'Der Thronsaal. Ein Sitz aus Gips mit welligem Rücken, an den Wänden Greifen, rot und blau. Evans nannte ihn den ältesten Thron Europas.'); await g.say('falk', 'Wer darauf saß, weiß niemand. Ein König, eine Priesterin, oder jemand, der einfach müde war.'); g.codex('knossos'); g.codex('minoer'); },
        use: 'Ich setze mich nicht auf dreieinhalbtausend Jahre alte Möbel. Nicht in meinem Alter.', take: 'Er ist aus dem Fels gehauen. Das würde auffallen.', open: 'Ein Thron hat keinen Deckel.', push: 'Er steht seit der Bronzezeit da. Er bleibt.' },
      { id: 'pithos', name: 'Pithos', rect: [60, 320, 88, 118], at: [104, 472, 'u'],
        look: (g) => g.flag('doppelaxt_genommen') ? 'Der Pithos. Ohne Deckel, ohne Axt. Ich habe ihm sein Geheimnis genommen; er hat es mit Würde getragen.' : 'Ein Pithos, mannshoch, für Öl oder Getreide. Der Deckel liegt noch darauf. Evans\' Leute haben die Magazine geleert, sagt Bramwell. Bramwell sagt viel.',
        open: async (g) => {
          if (g.flag('doppelaxt_genommen')) return 'Er ist offen. Und leer, bis auf dreitausend Jahre.';
          await g.say('falk', 'Der Deckel ist schwer, aber er bewegt sich.');
          g.hero.anim = 'reach'; await g.wait(500); g.hero.anim = 'stand';
          g.fx('stone');
          await g.say('falk', 'Darunter: Staub, ein paar Olivenkerne, und ganz unten, in der Wölbung, etwas Grünes. Bronze.');
          g.hero.anim = 'crouch'; await g.wait(600); g.hero.anim = 'stand';
          g.take('doppelaxt'); g.set('doppelaxt_genommen'); g.repaint();
          await g.say('falk', 'Eine Doppelaxt. Dünn wie Blech, ein Weihegeschenk, nie benutzt. Evans\' Leute haben nicht bis auf den Grund gegriffen.');
          await g.say('falk', 'Ich leihe sie mir. Das Museum in Heraklion bekommt sie zurück, wenn ich fertig bin. Wahrscheinlich.');
          g.codex('labrys');
        },
        use: (g) => g.hs('pithos').open(g), take: 'Zwei Meter hoch, hundert Kilo leer. Nein.',
        push: (g) => g.flag('doppelaxt_genommen') ? 'Er wackelt. Nichts klirrt mehr.' : 'Er wackelt. Etwas klirrt darin, ganz unten.',
        useWith: { schaufel: 'Ich grabe nicht in Museumsgut. Ich hebe den Deckel, wie ein zivilisierter Mensch.', taschenmesser: 'Ton. Das Messer würde nur kratzen.', default: 'Das gehört nicht in einen Pithos.' } },
      { id: 'pithos2', name: 'Pithos mit Sprung', rect: [154, 324, 82, 114], at: [196, 472, 'u'],
        look: 'Ein zweiter Pithos, mit einem Sprung von oben bis unten. Evans\' Leute haben ihn geleert und wieder hingestellt. Der Sprung ist älter als sie.',
        open: 'Kein Deckel. Ich sehe hinein: leer, bis auf eine Eidechse, die mich ansieht, als hätte ich sie geweckt.', use: 'Die Eidechse ist zuerst dagewesen.', take: 'Er würde in zwei Teilen ankommen.', push: 'Er wackelt. Die Eidechse ist nicht begeistert.' },
      { id: 'schild', name: 'Schild', rect: [862, 296, 84, 50], at: [900, 470, 'u'],
        look: '„Knossos. Ausgrabung der Britischen Schule in Athen. Zutritt nur mit Erlaubnis.“ Livia hat eine Erlaubnis, sagt sie. Sie hat sie nicht gezeigt.', take: 'Das Schild bleibt. Ohne Schild wäre der Zutritt nicht verboten, und das wäre ein Verlust.' },
      { id: 'olivenhain', name: 'Olivenhain', rect: [0, 300, 960, 42], at: [480, 470, 'u'],
        look: 'Olivenbäume bis zum Horizont. Die Minoer hatten hier Magazine voll Öl. Manche Dinge auf dieser Insel ändern sich nicht.' },
      { id: 'kette', name: 'Kette', rect: [462, 376, 136, 64], at: [530, 470, 'u'],
        look: 'Eine Kette vor dem Abgang, kniehoch. Sie bedeutet: nicht hinuntergehen. Sie hindert niemanden daran.', pull: 'Sie hängt an zwei Pfosten. Ich steige darüber, das ist einfacher.', take: 'Eine Kette der Britischen Schule. Nein.' },
      { id: 'grabung', name: 'Grabungsausrüstung', rect: [594, 378, 164, 62], at: [676, 470, 'u'],
        look: 'Schubkarre, Sieb, Kisten mit Nummern. Die Britische Schule ist im Urlaub, das Werkzeug nicht.' },
      { id: 'eidechse', name: 'Eidechse', rect: [596, 358, 44, 18], at: [616, 470, 'u'],
        look: 'Eine Eidechse auf dem warmen Stein. Sie ist hier länger zu Hause als Evans und macht weniger Lärm.' },
      { id: 'oleander', name: 'Oleander', rect: [900, 406, 60, 34], at: [900, 470, 'u'],
        look: 'Oleander, rosa, giftig, und er blüht, als wäre das kein Widerspruch.' },
    ],
    exits: [
      { id: 'dorf', name: 'Weg zum Dorf', rect: [0, 440, 50, 160], at: [60, 520, 'l'], to: 'cr_village', pos: [880, 500], dir: 'l',
        look: 'Der Weg zurück ins Dorf. Bergab, durch die Olivenhaine.' },
      { id: 'abgang', name: 'Abgang zur Pfeilerkrypta', rect: [474, 292, 112, 150], at: [530, 470, 'u'], to: 'cr_crypt', pos: [110, 500], dir: 'r',
        look: (g) => g.has('plan') ? 'Eine Treppe hinunter in den Westflügel. Die Pfeilerkrypta, laut Bramwells Plan. Unten ist es dunkel und kühl.' : 'Eine Treppe hinunter, in den Westflügel. Eine Kette davor. Unten ist es dunkel und kühl.',
        before: async (g) => { if (!g.flag('krypta_intro')) await g.say('falk', 'Ich steige über die Kette. Die Britische Schule wird es mir verzeihen. Oder auch nicht.'); return true; } },
    ],
    async enter(g) {
      if (g.flag('knossos_intro')) return;
      g.set('knossos_intro');
      await g.say('falk', 'Knossos. Evans\' Palast, oder der von Minos, je nachdem, wen man fragt. Ein Drittel Ruine, ein Drittel Beton, ein Drittel Vermutung.');
      await g.say('falk', 'Kein Wächter. Mittag. Auf Kreta ist das dasselbe.');
    },
  });

  // ---------------------------------------------------------------- Pfeilerkrypta
  async function openCrypt(g) {
    if (g.flag('krypta_offen')) return 'Sie ist gedrückt. Der Boden ist offen. Einmal reicht.';
    await g.say('falk', g.flag('yannis_legende') ? 'Die flache Hand. Wie der Großvater.' : 'Also gut. Die mittlere.');
    g.hero.anim = 'reach'; await g.wait(600); g.hero.anim = 'stand';
    g.fx('click'); await g.wait(400); g.fx('stone');
    g.set('krypta_offen'); g.repaint();
    await g.message('Ein Klacken im Stein. Dann ein Rumpeln unter dem Boden, und die große Platte neben dem Pfeiler sinkt ab, Kante um Kante, bis sie eine Treppe ist.', 3200);
    await g.say('falk', 'Yannis\' Großvater ist gerannt. Ich verstehe ihn. Ich bleibe trotzdem.');
    await g.say('falk', 'Unten ein Gang, und an der Kante ein Ring aus Bronze. Als hätte jemand gewusst, dass man hier etwas festbinden will.');
    g.codex('minotaurus');
    if (g.flag('faden')) g.objective('Ins Labyrinth gehen.');
    else if (g.has('wolle')) g.objective('Den Faden am Bronzering festbinden und ins Labyrinth gehen.');
    else g.objective('Einen Faden besorgen und ins Labyrinth unter der Krypta gehen.');
  }

  async function enterMaze(g) {
    if (!g.flag('faden')) {
      if (!g.flag('faden_gewarnt')) {
        g.set('faden_gewarnt');
        await g.say('falk', 'Ohne Faden verlaufe ich mich da drin. Das ist keine Vermutung, das ist Arithmetik.');
        await g.say('falk', 'Ich sollte erst einen besorgen. Oder es darauf ankommen lassen.');
        return;
      }
      const c = await g.puzzle('choose', { title: 'Ohne Faden?', text: 'Der Gang verzweigt sich nach wenigen Schritten. Ohne Faden findet Falk vielleicht nicht zurück.', options: ['Trotzdem hineingehen.', 'Lieber nicht.'], testAnswer: 0, cancel: false });
      if (c !== 0) { await g.say('falk', 'Lieber nicht. Theseus hatte auch keine Eile.'); return; }
      await g.say('falk', 'Also gut. Immer links halten, hat mir ein Kind erklärt. Kinder wissen so etwas.');
    } else await g.say('falk', 'Der Faden läuft ab. Los.');
    const r = await g.puzzle('maze', { thread: !!g.flag('faden'), seed: 4242 });
    if (r === true) { g.set('labyrinth_durch'); await g.goto('cr_bullchamber', 120, 520, 'r'); return; }
    if (r === 'lost') {
      await g.message('Gänge, die sich gleichen. Abzweigungen, die vorhin noch nicht da waren. Irgendwann, nach zu langer Zeit: Licht.', 3000);
      await g.say('falk', 'Die Krypta. Ich bin im Kreis gelaufen. Ohne Faden ist das da unten kein Rätsel, sondern eine Wette.');
    } else await g.say('falk', g.flag('faden') ? 'Umgekehrt. Der Faden hat mich zurückgebracht. Das war der Sinn der Sache.' : 'Umgekehrt, solange ich den Eingang noch gesehen habe. Klug. Feige, aber klug.');
  }

  R({
    id: 'cr_crypt', name: 'Pfeilerkrypta', ambient: 'none',
    start: [110, 500, 'r'],
    walk: [[50, 436, 900, 436, 940, 585, 30, 585]],
    scale: SC,
    paint(ctx, g) {
      const offen = g.flag('krypta_offen');
      A.rect(ctx, 0, 0, 960, 600, '#1a1510');
      A.stones(ctx, 0, 60, 960, 370, '#5c5042', 41, 46);
      A.rect(ctx, 0, 40, 960, 24, '#3a3028');
      for (let x = 0; x < 960; x += 120) A.rect(ctx, x, 40, 120, 24, x % 240 ? '#3a3028' : '#332a22');
      ctx.fillStyle = A.grad(ctx, 0, 60, 0, 260, ['rgba(0,0,0,0.7)', 'rgba(0,0,0,0)']); ctx.fillRect(0, 60, 960, 200);
      A.floorTiles(ctx, 960, 430, 600, '#6d5f4b', '#3a3126', 8, 480);
      ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(0, 430, 960, 8);
      // Treppe nach oben (links), Licht von oben
      A.rect(ctx, 30, 70, 140, 360, '#0e0b08');
      // Tageslicht am oberen Ende der Treppe, Wange an der Wand, dann die Stufen
      ctx.fillStyle = A.grad(ctx, 0, 70, 0, 300, ['rgba(255,240,210,0.3)', 'rgba(255,240,210,0)']); ctx.fillRect(110, 70, 60, 230);
      A.rect(ctx, 160, 74, 10, 356, '#2a2419');
      A.stairs(ctx, 40, 430, 120, 9, 18, '#5a5044', 'l');
      A.rect(ctx, 30, 66, 140, 8, '#2a2218');
      A.lightBeam(ctx, 60, 80, 170, 360, 'rgba(255,240,210,0.14)');
      // Opferrinne im Boden vor dem Pfeiler
      A.rect(ctx, 380, 438, 210, 8, '#2a2219'); A.rect(ctx, 380, 438, 210, 2, 'rgba(255,255,255,0.08)');
      // Zweiter Pfeiler rechts hinten
      ctx.fillStyle = A.grad(ctx, 730, 0, 800, 0, ['#4a3f33', '#6f6252', '#3f362c']); ctx.fillRect(730, 96, 70, 334);
      A.rect(ctx, 722, 90, 86, 12, '#4a3f33'); A.rect(ctx, 722, 418, 86, 12, '#4a3f33');
      // Nische mit Tonlampe
      A.rect(ctx, 246, 196, 68, 90, '#1e1812'); A.rect(ctx, 246, 196, 68, 6, '#2e2620');
      A.ell(ctx, 280, 266, 16, 7, '#8a7040'); A.poly(ctx, [294, 264, 306, 262, 296, 268], '#8a7040');
      // Der Pfeiler der drei Doppeläxte
      ctx.fillStyle = A.grad(ctx, 420, 0, 540, 0, ['#5a4e40', '#8a7c68', '#4a4034']); ctx.fillRect(420, 90, 120, 340);
      A.rect(ctx, 408, 82, 144, 14, '#5a4e40'); A.rect(ctx, 408, 416, 144, 14, '#5a4e40');
      for (let i = 0; i < 6; i++) A.line(ctx, 420, 96 + i * 56, 540, 96 + i * 56, 'rgba(0,0,0,0.25)', 1.5);
      for (const [x, k] of [[451, 'l'], [481, 'm'], [511, 'r']]) {
        const pressed = k === 'm' && offen;
        labrys(ctx, x, 290, 46, pressed ? 'rgba(0,0,0,0.55)' : 'rgba(0,0,0,0.42)', 'rgba(0,0,0,0.5)');
        labrys(ctx, x - 1, 289, 44, pressed ? 'rgba(160,140,110,0.18)' : 'rgba(200,180,150,0.22)', 'rgba(200,180,150,0.25)');
      }
      // Wurzeln durch die Decke, feuchte Streifen darunter
      for (const [rx, rl, rs] of [[208, 130, 71], [640, 150, 72], [880, 200, 73]]) {
        ctx.fillStyle = A.grad(ctx, 0, 64, 0, 64 + rl * 1.6, ['rgba(0,0,0,0.35)', 'rgba(0,0,0,0)']); ctx.fillRect(rx - 26, 64, 52, rl * 1.6);
        roots(ctx, rx, 62, rl, rs);
      }
      // Nische mit Kultgefäßen, Ritzzeichnungen im Stein (Doppelaxt, Schiff, Stern, Kreuz)
      A.rect(ctx, 598, 176, 58, 58, '#1e1812'); A.rect(ctx, 598, 176, 58, 5, '#2e2620');
      for (let i = 0; i < 3; i++) A.poly(ctx, [606 + i * 18, 224, 618 + i * 18, 224, 615 + i * 18, 232, 609 + i * 18, 232], '#8a6a40');
      const sc = 'rgba(210,190,160,0.22)';
      labrys(ctx, 636, 286, 22, sc, sc);
      ctx.strokeStyle = sc; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(664, 306); ctx.quadraticCurveTo(682, 318, 700, 306); ctx.moveTo(682, 306); ctx.lineTo(682, 290); ctx.moveTo(670, 296); ctx.lineTo(694, 296); ctx.stroke();
      for (let i = 0; i < 4; i++) { const a = (i / 4) * Math.PI; A.line(ctx, 616 + Math.cos(a) * 8, 322 + Math.sin(a) * 8, 616 - Math.cos(a) * 8, 322 - Math.sin(a) * 8, sc, 1.5); }
      A.line(ctx, 650, 330, 662, 330, sc, 1.5); A.line(ctx, 656, 324, 656, 336, sc, 1.5);
      // Spinnweben in den Ecken, herabgefallene Steine
      A.cobweb(ctx, 552, 96, 44, 'tl', 'rgba(255,255,255,0.22)'); A.cobweb(ctx, 722, 102, 36, 'tr', 'rgba(255,255,255,0.2)'); A.cobweb(ctx, 246, 202, 26, 'tl', 'rgba(255,255,255,0.18)');
      A.rubble(ctx, 822, 408, 110, 30, 44, '#5c5042'); A.rubble(ctx, 178, 414, 60, 22, 45, '#5c5042');
      // Bodenplatte / Öffnung mit Treppe und Bronzering
      // Platte und Öffnung folgen der Bodenperspektive (oben schmaler als unten)
      if (!offen) {
        A.poly(ctx, [606, 440, 744, 440, 750, 510, 600, 510], '#5e5242', 'rgba(0,0,0,0.6)', 3);
      } else {
        A.poly(ctx, [602, 436, 748, 436, 754, 514, 596, 514], '#050403');
        ctx.save(); A.poly(ctx, [602, 436, 748, 436, 754, 514, 596, 514]); ctx.clip();
        for (let i = 0; i < 6; i++) A.rect(ctx, 600 + i * 5, 440 + i * 12, 150 - i * 10, 12, A.shade('#4a4034', -i * 0.13));
        ctx.restore();
        A.rect(ctx, 602, 436, 146, 4, '#2a2219');
        A.circle(ctx, 620, 452, 9, null, '#5f8a6a', 4); A.rect(ctx, 616, 440, 8, 8, '#4f7a5a');
        if (g.flag('faden')) { A.path(ctx, [620, 458, 640, 470, 660, 490, 690, 506], '#d8c8a8', 1.5); }
      }
      // Scherben, Staub
      const r = ATL.U.rng(63);
      for (let i = 0; i < 30; i++) A.rect(ctx, r() * 960, 440 + r() * 150, 3 + r() * 8, 2 + r() * 3, `rgba(200,180,150,${0.08 + r() * 0.12})`);
      // Pfützen unter den Wurzeln, Moos, Risse, Kreidemarke der Grabung, Scherben, zerbrochene Amphore
      A.puddle(ctx, 212, 448, 44, 12, 'rgba(120,150,190,0.28)'); A.puddle(ctx, 882, 470, 60, 16, 'rgba(120,150,190,0.28)');
      A.moss(ctx, 176, 432, 70, 47, '#3a5a2a'); A.moss(ctx, 846, 430, 100, 48, '#3a5a2a');
      A.cracks(ctx, 200, 470, 220, 90, 9, 'rgba(0,0,0,0.4)'); A.cracks(ctx, 780, 490, 150, 70, 10, 'rgba(0,0,0,0.4)'); A.cracks(ctx, 580, 110, 140, 120, 11, 'rgba(0,0,0,0.3)');
      A.text(ctx, 'W 14', 352, 408, { font: '11px Georgia', color: 'rgba(230,225,210,0.5)' });
      A.line(ctx, 350, 411, 378, 411, 'rgba(230,225,210,0.4)', 1);
      for (const [sx, sy, sa] of [[184, 428, 0.3], [198, 434, -0.7], [222, 430, 1.2], [210, 426, 2.1]]) { ctx.save(); ctx.translate(sx, sy); ctx.rotate(sa); A.poly(ctx, [-6, 0, 6, -2, 3, 4], '#8a6a48'); ctx.restore(); }
      A.amphora(ctx, 910, 436, 54, '#7a5a3a'); A.line(ctx, 904, 396, 914, 420, 'rgba(0,0,0,0.6)', 1.5); A.poly(ctx, [898, 382, 906, 384, 903, 392, 896, 390], '#241e18');
      ctx.fillStyle = A.rgrad(ctx, 150, 470, 10, 150, ['rgba(255,240,210,0.12)', 'rgba(255,240,210,0)']); ctx.fillRect(0, 436, 320, 120);
      A.vignette(ctx, 960, 600, 0.72);
      A.grain(ctx, 960, 600, 8, 0.06);
    },
    paintFront(ctx, g) {
      // Wurzeln vorn oben links, gestürzter Block unten links
      roots(ctx, 44, 30, 200, 74, '#2a2018'); roots(ctx, 100, 30, 140, 75, '#221a12');
      A.poly(ctx, [0, 540, 34, 546, 38, 600, 0, 600], '#4a4036'); A.poly(ctx, [0, 540, 34, 546, 30, 552, 0, 548], '#6a5e50');
      A.cracks(ctx, 2, 548, 34, 50, 12, 'rgba(0,0,0,0.5)');
    },
    animate(ctx, t) {
      A.dust(ctx, 60, 100, 160, 320, t, 24, 'rgba(255,240,200,0.22)');
      // Wassertropfen von den Wurzeln
      drip(ctx, t, 212, 190, 446, 0); drip(ctx, t, 882, 262, 468, 0.55);
    },
    hotspots: [
      { id: 'pfeiler', name: 'Pfeiler mit drei Doppeläxten', rect: [408, 82, 144, 180], at: [480, 480, 'u'],
        look: async (g) => { await g.say('falk', 'Ein Pfeiler aus Kalkstein, ohne Kapitell, ohne Schmuck, bis auf drei Doppeläxte, nebeneinander in den Stein geritzt. Evans hat hier Rinnen im Boden gefunden und einen Kult vermutet.'); await g.say('falk', 'Yannis\' Großvater hat etwas anderes gefunden.'); g.codex('labrys'); },
        push: 'Der ganze Pfeiler? Ich drücke. Er bleibt, wo er ist. Die Äxte sind kleiner und vermutlich gemeint.', pull: 'Ein Pfeiler ist nicht zum Ziehen da.', use: 'Drei Äxte. Man drückt nicht auf den Pfeiler, man drückt auf eine davon.', take: 'Das Dach würde es merken.' },
      { id: 'axt_l', name: 'Linke Doppelaxt', rect: [436, 262, 30, 56], at: [480, 480, 'u'],
        look: 'Eine Doppelaxt, fingertief in den Stein geritzt. Die linke von dreien.',
        push: (g) => g.flag('krypta_offen') ? 'Nicht nötig. Der Boden ist schon offen.' : 'Ich drücke. Stein. Kühl, hart, und ohne jede Meinung dazu.', use: (g) => g.hs('axt_l').push(g),
        pull: 'Da ist nichts zu ziehen. Sie ist eingeritzt, nicht eingesetzt.', take: 'Sie ist Teil des Pfeilers.' },
      { id: 'axt_m', name: 'Mittlere Doppelaxt', rect: [466, 262, 30, 56], at: [480, 480, 'u'],
        look: (g) => g.flag('krypta_offen') ? 'Die mittlere. Sie sitzt jetzt einen Finger tiefer als die anderen. Der Boden hat es gemerkt.' : (g.flag('yannis_legende') || g.flag('plan_gelesen')) ? 'Die mittlere von dreien. Yannis\' Großvater hat hier die flache Hand aufgelegt. Bramwell hat es nie probiert; Denkmalschutz, sagt er.' : 'Die mittlere von dreien. Der Stein ist hier glatter als bei den anderen. Als hätte oft jemand die Hand darauf gelegt.',
        push: openCrypt, use: openCrypt, pull: 'Ziehen? Nein. Drücken, sagt die Geschichte.', take: 'Sie ist Teil des Pfeilers.' },
      { id: 'axt_r', name: 'Rechte Doppelaxt', rect: [496, 262, 30, 56], at: [480, 480, 'u'],
        look: 'Eine Doppelaxt, in den Stein geritzt. Die rechte. Sie sieht aus wie die linke, und das ist vermutlich Absicht.',
        push: (g) => g.flag('krypta_offen') ? 'Nicht nötig. Der Boden ist schon offen.' : 'Ich drücke. Nichts. Der Pfeiler hat nur eine Meinung, und die sitzt in der Mitte, hoffe ich.', use: (g) => g.hs('axt_r').push(g),
        pull: 'Da ist nichts zu ziehen.', take: 'Sie ist Teil des Pfeilers.' },
      { id: 'platte', name: 'Bodenplatte', rect: [596, 436, 158, 78], at: [660, 530, 'u'], cond: (g) => !g.flag('krypta_offen'),
        look: 'Eine Bodenplatte neben dem Pfeiler, größer als die anderen, mit einer Fuge ringsum, die zu sauber ist für Zufall.',
        push: 'Sie rührt sich nicht. Sie wiegt mehr als ich und hat es nicht eilig.', pull: 'Es gibt nichts, woran ich ziehen könnte.', open: 'Keine Griffe, keine Scharniere. Wenn sie aufgeht, dann von woanders.',
        use: 'Ich stelle mich darauf. Nichts. Sie will nicht mich, sie will etwas anderes.',
        useWith: { schaufel: 'Die Fuge ist zu eng für den Spaten. Und die Platte zu schwer für mich.', doppelaxt: 'Die Axt ist aus Bronze, zu dünn zum Hebeln. Sie würde brechen, und das Museum wäre unglücklich.', seil: 'Woran binden? Und wer zieht? Livia ist im Dorf.', taschenmesser: 'Die Klinge passt in die Fuge. Und dann? Ich kann keine Tonne Stein mit einem Taschenmesser heben.', default: 'Das hilft der Platte nicht.' } },
      { id: 'ring', name: 'Bronzering', rect: [606, 436, 30, 30], at: [640, 530, 'u'], cond: (g) => g.flag('krypta_offen'),
        look: (g) => g.flag('faden') ? 'Der Bronzering. Der Faden ist daran festgeknotet, doppelt. Grau, und er hält.' : 'Ein Bronzering, in den Stein gegossen, grün vom Alter. Genau da, wo man ein Fadenende festbinden würde. Jemand hat mitgedacht, vor sehr langer Zeit.',
        pull: 'Er sitzt fest. Er ist dafür da, dass man etwas daran festmacht, nicht dass man ihn herauszieht.', take: 'Er ist eingegossen. Und ich brauche ihn genau hier.', use: 'Man bindet etwas daran. Das ist alles, was ein Ring kann.',
        useWith: {
          wolle: async (g) => { if (g.flag('faden')) return 'Der Faden hängt schon dran. Ein zweiter Knoten macht ihn nicht länger.'; await g.say('falk', 'Ich knote das Ende der Wolle an den Ring. Doppelt. Theseus hätte es genauso gemacht, wenn er Pfadfinder gewesen wäre.'); g.set('faden'); g.repaint(); g.codex('ariadne'); await g.say('falk', 'Das Knäuel bleibt in der Hand. Es rollt ab, während ich gehe, und zurück muss ich nur aufwickeln.'); g.objective('Ins Labyrinth gehen und dem Gang bis zur Halle folgen.'); },
          seil: 'Zehn Meter Seil. Das Labyrinth ist länger, da bin ich sicher. Ich brauche etwas Dünneres und viel Längeres.', taschenmesser: 'Ich schneide keinen Bronzering durch. Ich wüsste auch nicht, wozu.', default: 'Das lässt sich nicht an einen Ring binden.',
        } },
      { id: 'nische', name: 'Nische', rect: [246, 196, 68, 90], at: [280, 480, 'u'],
        look: 'Eine Nische mit einer Tonlampe. Leer, seit dreitausend Jahren oder seit Evans; das ist hier dasselbe.', take: 'Die Lampe ist Museumsgut. Ich habe meine eigene.', use: 'Kein Öl, kein Docht. Sie hat ihre Schuldigkeit getan.', useWith: { oellampe: 'Meine Lampe bleibt in meiner Hand. Ich stelle nichts in Nischen, das ich noch brauche.', default: 'Das gehört nicht in die Nische.' } },
      { id: 'pfeiler2', name: 'Zweiter Pfeiler', rect: [722, 90, 86, 340], at: [765, 480, 'u'],
        look: 'Der zweite Pfeiler. Ohne Ritzung, ohne Geschichte. Der Langweiler der Familie.', push: 'Nichts. Er trägt nur das Dach, und das reicht ihm.', use: 'Er hat keine Äxte. Er hat nichts.' },
      { id: 'rinne', name: 'Rinne im Boden', rect: [380, 436, 210, 12], at: [480, 480, 'u'],
        look: 'Eine Rinne, in den Boden gehauen, vor dem Pfeiler. Evans hielt sie für Opferrinnen: Öl, Wein, Blut. Ich halte sie für eine Rinne.', use: 'Ich habe nichts zu opfern. Noch nicht.' },
      { id: 'wurzeln', name: 'Wurzeln', rect: [846, 64, 90, 190], at: [880, 480, 'u'],
        look: 'Wurzeln, durch die Decke gewachsen. Oben steht ein Olivenbaum, der nicht weiß, was er hier unten anrichtet.' },
      { id: 'ritzungen', name: 'Ritzzeichnungen', rect: [598, 272, 110, 70], at: [650, 480, 'u'],
        look: 'Ritzzeichnungen im Stein: eine Doppelaxt, ein Schiff, ein Zeichen, das ich nicht lesen kann. Niemand kann es. Das beruhigt mich nicht.' },
      { id: 'scherben', name: 'Scherben', rect: [176, 418, 60, 20], at: [206, 480, 'u'],
        look: 'Scherben. Evans\' Leute haben die großen Stücke mitgenommen und die kleinen liegengelassen. Die Wahrheit ist meistens klein und scharfkantig.' },
    ],
    exits: [
      { id: 'treppe', name: 'Treppe nach oben', rect: [30, 66, 140, 364], at: [110, 480, 'l'], to: 'cr_knossos', pos: [530, 470], dir: 'd',
        look: 'Die Treppe zurück ans Licht. Neun Stufen, und oben ist Mittag.' },
      { id: 'gang', name: 'Gang ins Labyrinth', rect: [596, 436, 158, 78], at: [660, 530, 'u'], cond: (g) => g.flag('krypta_offen'),
        look: (g) => g.flag('faden') ? 'Die Öffnung im Boden. Stufen, dann ein Gang, und der Faden läuft hinunter in die Dunkelheit.' : 'Die Platte ist abgesunken. Stufen, ein Dutzend, dann ein Gang. Kalte Luft kommt herauf; sie riecht nach Stein und nach nichts.',
        open: 'Sie ist offen. Ich muss nur hinuntergehen.', close: 'Ich weiß nicht, wie sie zugeht. Yannis\' Großvater wusste es auch nicht; sie hat es allein gemacht.',
        before: async (g) => { await enterMaze(g); return false; } },
    ],
    async enter(g) {
      if (g.flag('krypta_intro')) return;
      g.set('krypta_intro');
      await g.say('falk', 'Die Pfeilerkrypta. Kühl, still, und ein Pfeiler, der aussieht, als wüsste er etwas.');
      if (g.flag('plan_gelesen') || g.flag('yannis_legende')) await g.say('falk', 'Drei Doppeläxte, nebeneinander. Wie Yannis gesagt hat. Wie Bramwell aufgeschrieben hat, um es nicht zu glauben.');
    },
  });

  // ---------------------------------------------------------------- Halle des Stiers
  async function kesslerDone(g) {
    g.set('kessler_kreta');
    await g.say('falk', g.flag('faden') ? 'Der Faden liegt noch da. Zurück ist einfacher als hin.' : 'Und jetzt zurück. Ohne Faden. Ich hätte auf Livia hören sollen, aber das sage ich ihr nicht.');
    g.objective('Zurück ins Dorf. Livia soll sich das Siegel ansehen.');
  }

  async function fightKessler(g) {
    g.face('falk', 'kessler'); g.face('kessler', 'falk');
    const won = await g.puzzle('fight', { enemy: 'Kessler' });
    if (won) {
      g.fx('punch');
      await g.message('Kessler taumelt, greift nach dem Altar und verfehlt ihn. Dann liegt er.', 2600);
      g.hide('kessler'); g.set('kessler_liegt'); g.repaint();
      await g.say('falk', 'Er atmet. Er wird Kopfschmerzen haben und eine Geschichte für Vesper. Beides gönne ich ihm.');
      await kesslerDone(g);
      return;
    }
    const n = g.inc('kessler_runden');
    g.fx('punch');
    await g.message('Falk geht zu Boden. Die Decke dreht sich, dann steht sie wieder still.', 2400);
    g.hero.anim = 'crouch';
    const taunts = ['Bleiben Sie liegen, Falk. Es war nie Ihr Kampf.', 'Sie können das nicht, Doktor. Sie haben es studiert. Ich habe es gemacht.', 'Das Siegel, und ich lasse Sie hier sitzen. Mit den Fackeln. Bis sie ausgehen.', 'Ich habe Zeit. Sie haben Zähne. Noch.'];
    await g.say('kessler', taunts[(n - 1) % taunts.length]);
    await g.wait(700); g.hero.anim = 'stand';
    await g.say('falk', ['Ich stehe trotzdem auf. Gewohnheit.', 'Noch nicht, Kessler.', 'Mein Kiefer sagt Nein. Der Rest von mir hat noch nicht abgestimmt.'][(n - 1) % 3]);
    if (n === 1) await g.say('falk', 'Mit den Fäusten ist er besser. Vielleicht gibt es hier etwas, das ihn zu Fall bringt, bevor er mich zu Fall bringt.');
  }

  async function kesslerArrives(g) {
    await g.scene(async () => {
      g.fx('step');
      await g.message('Schritte im Gang. Nicht Falks.', 1800);
      g.place('kessler', 70, 500, 'r');
      await g.walk('kessler', 260, 512, 'r');
      g.face('falk', 'l');
      await g.say('kessler', 'Dr. Falk. Sie haben ein Talent dafür, Dinge zu finden, die anderen gehören.');
      await g.say('falk', 'Kessler. Wie sind Sie hier hereingekommen?');
      await g.say('kessler', g.flag('faden') ? 'Hinter Ihnen her. Sie haben einen Faden gelegt. Sehr aufmerksam von Ihnen.' : 'Hinter Ihnen her. Sie reden beim Gehen mit sich selbst. Man hört Sie durch drei Wände.');
      await g.say('kessler', 'Das Siegel. Herr Vesper hat es sich gewünscht, und er wünscht sich selten etwas zweimal.');
      await g.say('falk', 'Dann wird er lernen müssen, zu verzichten.');
      g.set('kessler_da');
      g.objective('Kessler loswerden. Er steht zwischen Falk und dem Ausgang.');
    });
    await g.dialog('kessler_halle');
  }

  async function takeSeal(g) {
    if (g.flag('stiersiegel_genommen')) return 'Ich habe es schon.';
    g.hero.anim = 'reach'; await g.wait(500); g.hero.anim = 'stand';
    g.set('stiersiegel_genommen'); g.take('stiersiegel'); g.repaint();
    await g.say('falk', 'Dunkle Bronze, ein Stierkopf, und auf der Rückseite acht Kerben. Wie beim Siegel der Sonne.');
    await g.say('falk', 'Zwei von drei. Livia wird unerträglich sein.');
    await kesslerArrives(g);
  }

  async function pourRaki(g) {
    if (g.flag('maul_offen')) return 'Das Maul ist offen und bleibt es. Den Raki spare ich mir.';
    if (g.flag('stiersiegel_genommen')) return 'Nicht nötig. Ich habe, was ich wollte.';
    await g.say('falk', 'Ich gieße den Raki in die Schale. Ein Trankopfer. Meine Großmutter wäre entsetzt.');
    g.drop('raki'); g.fx('water');
    await g.wait(600); g.fx('stone');
    await g.message('Irgendwo in der Wand gluckert es. Dann knirscht Bronze: Das Maul des Stiers öffnet sich, langsam, Zahn um Zahn.', 2800);
    g.set('maul_auf_kurz'); g.repaint();
    if (g.has('doppelaxt')) {
      await g.say('falk', 'Jetzt oder nie.');
      g.hero.anim = 'reach'; await g.wait(500); g.hero.anim = 'stand';
      g.drop('doppelaxt'); g.set('maul_offen'); g.set('maul_auf_kurz', false); g.repaint(); g.fx('stone');
      await g.message('Das Gluckern hört auf. Das Maul senkt sich, trifft auf Bronze, und bleibt stehen.', 2400);
      await g.say('falk', 'Die Doppelaxt steckt zwischen den Zähnen. Sie hält. Ein Weihegeschenk, das endlich Arbeit hat.');
      await g.say('falk', 'Und da liegt es. Auf der Zunge, wie eine Münze für den Fährmann.');
      g.objective('Das Siegel des Stiers aus dem Maul nehmen.');
    } else {
      await g.wait(800);
      await g.say('falk', 'Im Maul: eine Scheibe aus Bronze. Das Siegel.');
      await g.wait(600); g.fx('stone');
      g.set('maul_auf_kurz', false); g.repaint();
      await g.message('Das Gluckern hört auf. Das Maul schließt sich wieder, so langsam, wie es aufgegangen ist.', 2600);
      await g.say('falk', 'Es bleibt nur offen, solange die Schale abläuft. Ich brauche etwas, das ich dazwischenklemmen kann. Und neuen Raki.');
      g.set('maul_gesehen');
    }
  }

  R({
    id: 'cr_bullchamber', name: 'Halle des Stiers', ambient: 'none',
    start: [120, 520, 'r'],
    walk: [[60, 456, 900, 456, 900, 466, 686, 466, 686, 552, 900, 552, 940, 585, 20, 585]],
    scale: SC,
    paint(ctx, g) {
      A.rect(ctx, 0, 0, 960, 600, '#120d08');
      A.stones(ctx, 0, 40, 960, 410, '#4c3c2e', 51, 48);
      ctx.fillStyle = A.grad(ctx, 0, 0, 0, 240, ['rgba(0,0,0,0.9)', 'rgba(0,0,0,0)']); ctx.fillRect(0, 0, 960, 240);
      A.floorTiles(ctx, 960, 446, 600, '#5c4c3a', '#281f16', 8, 480);
      ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fillRect(0, 446, 960, 10);
      // Reliefbänder und Mäander an den Seitenwänden
      for (const [bx, bw] of [[0, 176], [783, 177]]) {
        A.rect(ctx, bx, 354, bw, 26, '#3e3024'); A.rect(ctx, bx, 354, bw, 2, 'rgba(255,220,170,0.15)'); A.rect(ctx, bx, 378, bw, 2, 'rgba(0,0,0,0.4)');
        A.spirals(ctx, bx, 357, bw, 20, 'rgba(200,170,120,0.4)');
        A.meander(ctx, bx, 236, bw, 12, 'rgba(200,170,120,0.28)');
      }
      // Fackelnischen mit Rußfahnen, Pfeiler mit Stierkopf, Bronzeketten mit Ringen
      A.rect(ctx, 60, 96, 44, 64, '#0a0705'); ctx.fillStyle = A.grad(ctx, 0, 40, 0, 100, ['rgba(0,0,0,0.6)', 'rgba(0,0,0,0)']); ctx.fillRect(66, 40, 32, 60); A.rect(ctx, 79, 120, 6, 40, '#3a2a1a'); A.ell(ctx, 82, 120, 6, 4, '#2a1a10');
      A.rect(ctx, 800, 250, 40, 62, '#0a0705'); ctx.fillStyle = A.grad(ctx, 0, 196, 0, 254, ['rgba(0,0,0,0.6)', 'rgba(0,0,0,0)']); ctx.fillRect(806, 196, 28, 58); A.rect(ctx, 817, 274, 6, 38, '#3a2a1a'); A.ell(ctx, 820, 274, 6, 4, '#2a1a10');
      ctx.fillStyle = A.grad(ctx, 850, 0, 894, 0, ['#3a2e22', '#5c4a38', '#2e2419']); ctx.fillRect(850, 110, 44, 336);
      A.rect(ctx, 846, 104, 52, 10, '#4a3c2e'); A.rect(ctx, 846, 440, 52, 6, '#3a2e22');
      horns(ctx, 872, 150, 40, '#6a5a48'); A.ell(ctx, 872, 160, 12, 10, '#5a4a38'); A.circle(ctx, 867, 158, 2, '#1a1008'); A.circle(ctx, 877, 158, 2, '#1a1008');
      labrys(ctx, 872, 220, 26, 'rgba(0,0,0,0.4)', 'rgba(0,0,0,0.45)'); labrys(ctx, 871, 219, 24, 'rgba(200,170,120,0.2)', 'rgba(200,170,120,0.25)');
      for (const cx of [918, 942]) { A.chain(ctx, cx, 40, cx, 196 + (cx - 918), '#6a5a3a'); A.circle(ctx, cx, 206 + (cx - 918), 7, null, '#8a6a34', 3); A.rect(ctx, cx - 5, 36, 10, 6, '#5a4a30'); }
      A.cracks(ctx, 790, 100, 60, 140, 15, 'rgba(0,0,0,0.4)'); A.cobweb(ctx, 850, 116, 30, 'tr', 'rgba(255,255,255,0.14)');
      // Ausgang: Torbogen links
      A.arch(ctx, 40, 176, 104, 274, '#5a4a3a', '#040302');
      A.cobweb(ctx, 142, 188, 30, 'tr', 'rgba(255,255,255,0.16)');
      A.rubble(ctx, 0, 418, 60, 30, 52, '#4c3c2e');
      A.cracks(ctx, 80, 470, 200, 100, 13, 'rgba(0,0,0,0.5)'); A.cracks(ctx, 520, 470, 160, 90, 14, 'rgba(0,0,0,0.5)');
      if (g.flag('faden')) A.path(ctx, [92, 446, 150, 470, 220, 486, 300, 500], '#d8c8a8', 1.5);
      // Podest und Altar
      A.rect(ctx, 300, 406, 360, 40, '#4a3c2e'); A.rect(ctx, 300, 406, 360, 4, '#6a5a48');
      A.rect(ctx, 330, 386, 300, 20, '#54463a'); A.rect(ctx, 330, 386, 300, 4, '#746452');
      // Bronzestier
      const bz = '#8a6a34', bd = A.shade(bz, -0.35), bl = A.shade(bz, 0.22);
      ctx.fillStyle = bz;
      ctx.beginPath(); ctx.moveTo(392, 168); ctx.quadraticCurveTo(300, 150, 236, 56); ctx.quadraticCurveTo(310, 120, 402, 148); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(568, 168); ctx.quadraticCurveTo(660, 150, 724, 56); ctx.quadraticCurveTo(650, 120, 558, 148); ctx.closePath(); ctx.fill();
      ctx.fillStyle = bl;
      ctx.beginPath(); ctx.moveTo(392, 162); ctx.quadraticCurveTo(310, 140, 250, 66); ctx.quadraticCurveTo(320, 128, 400, 152); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(568, 162); ctx.quadraticCurveTo(650, 140, 710, 66); ctx.quadraticCurveTo(640, 128, 560, 152); ctx.closePath(); ctx.fill();
      A.ell(ctx, 480, 216, 122, 106, bz);
      ctx.fillStyle = A.rgrad(ctx, 440, 170, 20, 200, ['rgba(255,230,170,0.35)', 'rgba(0,0,0,0)']); A.ell(ctx, 480, 216, 122, 106, ctx.fillStyle);
      ctx.fillStyle = A.rgrad(ctx, 480, 216, 60, 130, ['rgba(0,0,0,0)', 'rgba(0,0,0,0.45)']); A.ell(ctx, 480, 216, 122, 106, ctx.fillStyle);
      A.ell(ctx, 480, 150, 74, 34, bl);
      for (let i = 0; i < 7; i++) A.circle(ctx, 452 + i * 10, 140 + Math.sin(i) * 4, 6, null, bd, 1.5);
      A.ell(ctx, 386, 186, 26, 16, bd); A.ell(ctx, 574, 186, 26, 16, bd);
      A.ell(ctx, 420, 222, 20, 13, '#120a06'); A.ell(ctx, 540, 222, 20, 13, '#120a06');
      A.ell(ctx, 420, 222, 9, 7, '#2a1a10'); A.ell(ctx, 540, 222, 9, 7, '#2a1a10');
      A.circle(ctx, 416, 218, 2.5, '#ffd8a0'); A.circle(ctx, 536, 218, 2.5, '#ffd8a0');
      A.ell(ctx, 480, 286, 84, 52, bd);
      ctx.fillStyle = A.rgrad(ctx, 470, 270, 10, 90, ['rgba(255,230,170,0.25)', 'rgba(0,0,0,0)']); A.ell(ctx, 480, 286, 84, 52, ctx.fillStyle);
      A.ell(ctx, 448, 278, 11, 8, '#140c06'); A.ell(ctx, 512, 278, 11, 8, '#140c06');
      const open = g.flag('maul_offen') || g.flag('maul_auf_kurz');
      if (open) {
        A.ell(ctx, 480, 314, 58, 20, '#0a0604');
        for (let i = 0; i < 7; i++) { A.poly(ctx, [430 + i * 16, 300, 438 + i * 16, 312, 446 + i * 16, 300], '#e8dcc0'); A.poly(ctx, [432 + i * 16, 330, 438 + i * 16, 320, 444 + i * 16, 330], '#d8ccb0'); }
        A.ell(ctx, 480, 322, 34, 8, '#4a2018');
        if (g.flag('maul_offen')) { ctx.save(); ctx.translate(452, 314); ctx.rotate(0.35); labrys(ctx, 0, 0, 44, '#c8a050', '#5a4a2a'); ctx.restore(); }
      } else {
        A.line(ctx, 426, 316, 534, 316, '#1a1008', 5);
        A.line(ctx, 426, 316, 534, 316, 'rgba(255,220,150,0.12)', 1);
      }
      A.line(ctx, 480, 334, 480, 372, '#2a1c10', 8); A.line(ctx, 480, 334, 480, 372, 'rgba(0,0,0,0.5)', 3);
      // Altar mit Libationsschale
      A.rect(ctx, 404, 346, 152, 44, '#6a5a48'); A.rect(ctx, 396, 340, 168, 10, '#7c6c5a');
      A.rect(ctx, 404, 346, 152, 44, 'rgba(0,0,0,0.15)');
      A.ell(ctx, 480, 342, 42, 12, bz); A.ell(ctx, 480, 340, 32, 8, '#1a1008'); A.circle(ctx, 480, 340, 5, '#050302');
      A.meander(ctx, 408, 366, 144, 12, 'rgba(0,0,0,0.35)');
      // Opferschalen, Rhyton und alte Flecken auf dem Podest
      A.ell(ctx, 480, 428, 44, 7, 'rgba(50,15,10,0.35)');
      for (const [bx, by, br] of [[334, 426, 18], [612, 430, 15], [372, 434, 10]]) {
        A.ell(ctx, bx, by + 2, br + 2, br * 0.4, 'rgba(0,0,0,0.35)'); A.ell(ctx, bx, by, br, br * 0.36, '#7a5a2c'); A.ell(ctx, bx, by - 1, br * 0.8, br * 0.26, '#2a1a10'); A.ell(ctx, bx, by, br, br * 0.36, null, '#5f8a6a', 1);
      }
      A.poly(ctx, [640, 412, 654, 412, 649, 438, 645, 438], '#a07840');
      for (let i = 0; i < 3; i++) A.line(ctx, 641 + i, 418 + i * 6, 653 - i, 418 + i * 6, 'rgba(0,0,0,0.3)', 1);
      A.ell(ctx, 647, 412, 7, 2.5, '#c89850');
      // Säulen links und rechts
      A.column(ctx, 200, 446, 400, 46, '#7a3a2a', 'minoan'); A.column(ctx, 760, 446, 400, 46, '#7a3a2a', 'minoan');
      // Fackelhalter
      A.rect(ctx, 296, 250, 8, 40, '#3a2a1a'); A.rect(ctx, 656, 250, 8, 40, '#3a2a1a');
      for (const tx of [300, 660]) { ctx.fillStyle = A.grad(ctx, 0, 160, 0, 250, ['rgba(0,0,0,0)', 'rgba(0,0,0,0.5)']); ctx.fillRect(tx - 12, 160, 24, 90); }
      // Grube rechts vorne
      A.ell(ctx, 792, 508, 104, 40, '#3a2c20'); A.ell(ctx, 792, 508, 96, 34, '#050302');
      ctx.fillStyle = A.rgrad(ctx, 792, 508, 40, 96, ['rgba(0,0,0,0)', 'rgba(60,45,30,0.5)']); A.ell(ctx, 792, 508, 96, 34, ctx.fillStyle);
      for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; A.rr(ctx, 792 + Math.cos(a) * 100 - 8, 508 + Math.sin(a) * 38 - 5, 16, 10, 3, A.shade('#5a4a38', (i % 3) * 0.08)); }
      // Knochen am Schachtrand und in der Ecke
      A.bones(ctx, 700, 448, 5, '#d8ccb0'); A.bones(ctx, 904, 436, 6, '#cfc3a6');
      // Kessler am Boden
      if (g.flag('kessler_liegt') && !g.flag('kessler_kreta_weg')) {
        A.ell(ctx, 330, 500, 90, 10, 'rgba(0,0,0,0.3)');
        A.rect(ctx, 236, 486, 66, 16, '#2a2a34'); A.ell(ctx, 232, 494, 10, 6, '#111');
        A.rr(ctx, 290, 476, 110, 30, 12, '#3a3a44'); A.rr(ctx, 296, 470, 60, 14, 6, '#3a3a44');
        A.line(ctx, 360, 488, 400, 512, '#3a3a44', 10); A.circle(ctx, 402, 514, 5, '#e0b090');
        A.circle(ctx, 414, 486, 15, '#e0b090'); A.rect(ctx, 418, 470, 12, 18, '#2a2a2a'); A.line(ctx, 406, 490, 412, 490, '#4a1f1a', 1.5);
      }
      A.vignette(ctx, 960, 600, 0.75);
      A.grain(ctx, 960, 600, 12, 0.06);
    },
    paintFront(ctx, g) {
      // Pfeilerkante am linken Bildrand, Bronzedreifuß unten rechts
      ctx.fillStyle = A.grad(ctx, 0, 0, 28, 0, ['#241a12', '#3a2c20', '#1a120c']); ctx.fillRect(0, 0, 28, 600);
      A.rect(ctx, 26, 0, 3, 600, 'rgba(255,190,120,0.18)');
      for (let y = 60; y < 600; y += 90) A.line(ctx, 0, y, 28, y + 4, 'rgba(0,0,0,0.35)', 1.5);
      A.ell(ctx, 950, 598, 34, 7, 'rgba(0,0,0,0.4)');
      for (const lx of [928, 950, 972]) A.line(ctx, lx, 596, 950, 548, '#6a4e28', 5);
      A.ell(ctx, 950, 546, 34, 12, '#7a5c2c'); A.ell(ctx, 950, 543, 28, 8, '#2a1a10'); A.ell(ctx, 950, 546, 34, 12, null, 'rgba(95,138,106,0.45)', 1.5);
    },
    animate(ctx, t, g) {
      A.torch(ctx, 300, 250, t, 1.2, false); A.torch(ctx, 660, 250, t, 1.2, false);
      A.glow(ctx, 480, 210, 250 + Math.sin(t * 5) * 12, 'rgba(255,140,60,0.5)', 0.22);
      if (g.flag('maul_offen') || g.flag('maul_auf_kurz')) A.glow(ctx, 480, 316, 46, 'rgba(255,210,130,0.8)', 0.4);
      A.dust(ctx, 260, 180, 440, 240, t, 10, 'rgba(255,200,140,0.18)');
    },
    hotspots: [
      { id: 'stierkopf', name: 'Bronzestier', rect: [236, 50, 488, 260], at: [480, 490, 'u'],
        look: async (g) => { await g.say('falk', 'Ein Stierkopf aus Bronze, drei Meter hoch, die Hörner bis an die Decke. Die Augen sind schwarzer Stein. So etwas hat kein Museum. So etwas hat auch kein Minoer gegossen, nicht in dieser Größe.'); await g.say('falk', 'Und trotzdem: die Form ist minoisch. Wie die Trinkgefäße aus Heraklion, nur zehnmal größer, und mit einem Maul, das zu ist.'); g.codex('stier'); },
        use: 'Ich streichle keine Bronze.', talk: 'Er hat schon Leute gesehen, die ihn angeredet haben. Er hat keinem geantwortet.', take: 'Drei Tonnen. Nein.', push: 'Er ist mit der Wand verwachsen. Oder die Wand mit ihm.' },
      { id: 'maul', name: 'Maul des Stiers', rect: [424, 296, 112, 40], at: [480, 490, 'u'], cond: (g) => !g.flag('stiersiegel_genommen'),
        look: (g) => g.flag('maul_offen') ? 'Das Maul steht offen, die Doppelaxt zwischen den Zähnen. Dahinter, auf der Zunge: das Siegel.' : 'Das Maul ist geschlossen, Bronze auf Bronze. Dazwischen ein Spalt, kaum fingerbreit. Etwas glänzt darin. Unter dem Maul läuft eine Rinne hinab in die Schale auf dem Altar.',
        open: (g) => g.flag('maul_offen') ? 'Es ist offen. Weiter geht es nicht, und weiter muss es nicht.' : 'Ich ziehe an der Unterlippe. Zwei Tonnen Bronze und ein Scharnier, das nicht für Hände gebaut ist. Es gibt nicht nach.',
        pull: (g) => g.flag('maul_offen') ? 'Es ist offen.' : 'Ich ziehe. Bronze. Es gibt nicht nach, nicht einen Millimeter.', push: 'Es ist zu. Drücken macht es nicht offener.',
        take: (g) => g.flag('maul_offen') ? takeSeal(g) : 'Ich komme nicht hinein. Der Spalt ist zu schmal für Finger, und Finger sind alles, was ich habe.',
        use: (g) => g.flag('maul_offen') ? takeSeal(g) : 'Ich klopfe. Es klingt hohl. Da ist etwas drin, und es will nicht heraus.',
        useWith: {
          doppelaxt: (g) => g.flag('maul_offen') ? 'Sie steckt schon.' : 'Ich setze die Axt in den Spalt und hebele. Sie biegt sich. Bronze gegen Bronze, die dünnere verliert. Das Maul muss offen sein, dann kann sie hinein.',
          raki: 'Nicht ins Maul. In die Schale davor, wo die Rinne endet. Ein Trankopfer war nie für das Maul bestimmt.',
          taschenmesser: 'Die Klinge passt in den Spalt. Der Rest von mir nicht. Und hebeln lässt sich damit nichts.',
          seil: 'Woran binden? An die Zähne? Und dann ziehen zwei Tonnen Bronze an mir, nicht umgekehrt.',
          schaufel: 'Der Spaten ist aus Stahl, aber der Spalt ist zu schmal.', wolle: 'Ich könnte einen Faden hineinfädeln. Und dann?', flasche: 'Nicht ins Maul. In die Schale.',
          default: 'Das hilft dem Maul nicht auf.',
        } },
      { id: 'siegel', name: 'Siegel des Stiers', rect: [456, 304, 48, 22], at: [480, 490, 'u'], cond: (g) => g.flag('maul_offen') && !g.flag('stiersiegel_genommen'),
        paint: (ctx) => { A.seal(ctx, 484, 316, 12, 'bull', '#9a7a4a'); },
        look: 'Eine Scheibe aus dunkler Bronze mit einem Stierkopf. Sie liegt auf der Zunge des Stiers wie eine Münze für den Fährmann.',
        take: takeSeal, use: takeSeal, pull: takeSeal },
      { id: 'schale', name: 'Libationsschale', rect: [434, 328, 92, 24], at: [480, 490, 'u'],
        look: 'Eine Schale aus Bronze, in den Altar eingelassen. In der Mitte ein Loch, und darunter, irgendwo in der Wand, gluckert es leise, wenn man den Kopf hinhält. Wer hier etwas eingießt, füttert die Wand.',
        use: 'Sie ist leer. Man gießt etwas hinein, das ist der Sinn einer Schale.', take: 'Eingelassen. Sie gehört zum Altar, und der Altar zum Boden.', open: 'Sie ist offen. Nach oben.',
        useWith: {
          raki: pourRaki,
          flasche: (g) => g.flag('flasche_leer') ? 'Die Flasche ist leer.' : 'Ich gieße etwas Wasser hinein. Es versickert, und das Maul bleibt zu. Vielleicht braucht es mehr. Oder etwas, das mehr ist als Wasser; ein Trankopfer war nie Wasser.',
          oellampe: 'Öl? Nein. Das wäre eine Lampe, kein Opfer, und ich brauche das Öl vielleicht noch.',
          muenzen: 'Münzen passen nicht durch das Loch. Und der Stier nimmt kein Kleingeld.',
          wolle: 'Wolle in die Schale? Der Stier ist kein Kätzchen.', doppelaxt: 'Die Axt gehört nicht in die Schale. Sie gehört dahin, wo etwas offen gehalten werden muss.',
          default: 'Das gehört nicht in die Schale.',
        } },
      { id: 'altar', name: 'Altar', rect: [396, 340, 168, 66], at: [480, 490, 'u'],
        look: 'Ein Altarblock aus Stein, glatt vom Alter, mit einem Mäander an der Kante. In der Mitte die Schale, davor zwei Stufen. Wer hier gestanden hat, hat nach oben gesehen, in ein Maul.',
        use: 'Auf dem Altar liegt nichts. In der Schale auch nicht.', push: 'Der Altar ist Teil des Bodens.', take: 'Eine Tonne Stein. Und ich sammle keine Altäre.', open: 'Er ist massiv.' },
      { id: 'fackel_l', name: 'Fackel', rect: [278, 200, 44, 96], at: [300, 490, 'u'],
        look: 'Eine Fackel im Bronzehalter. Pech und Werg, trocken wie Zunder, bis ich das Streichholz drangehalten habe. Jetzt brennt sie, als hätte sie darauf gewartet.',
        take: 'Ich lasse sie im Halter. Hier drin will ich beide Hände frei haben.', use: 'Sie brennt. Mehr kann eine Fackel nicht.', useWith: { oellampe: 'Sie brennt schon.', raki: 'Raki in die Flamme? Das gäbe eine Stichflamme und keinen Nutzen.', default: 'Das verbrenne ich nicht.' } },
      { id: 'fackel_r', name: 'Fackel', rect: [638, 200, 44, 96], at: [660, 490, 'u'],
        look: 'Die zweite Fackel. Sie flackert. Irgendwo zieht Luft, und ich weiß nicht, woher.',
        take: 'Ich lasse sie im Halter.', use: 'Sie brennt. Das reicht.', useWith: { oellampe: 'Sie brennt schon.', default: 'Das verbrenne ich nicht.' } },
      { id: 'grube', name: 'Schacht', rect: [688, 468, 208, 82], at: [670, 530, 'r'],
        look: (g) => g.flag('kessler_grube') ? (g.flag('kessler_kreta_weg') ? 'Der Schacht. Leer. Er ist herausgeklettert. Zäh, das muss man ihm lassen.' : 'Kessler liegt vier Meter tiefer auf einem Sims und flucht auf Deutsch. Der Sturz hat ihm nichts gebrochen, außer dem Stolz. Er wird eine Weile brauchen.') : 'Ein Schacht im Boden, rund, mit glattem Rand. Ich werfe einen Stein hinein. Er braucht lange. Kein Geländer; die Minoer hatten keine Anwälte.',
        use: 'Ich springe nicht in Löcher, deren Boden ich nicht gesehen habe.', take: 'Ein Loch nimmt man nicht mit.', open: 'Es ist offen. Das ist das Problem.',
        useWith: { seil: 'Zehn Meter Seil. Der Stein war länger unterwegs. Nein.', wolle: 'Ich lasse den Faden nicht in den Schacht. Er soll mich hinausführen, nicht hinunter.', muenzen: 'Ich werfe keine Münzen in Löcher. Das ist ein Brunnen, keine Grube.', default: 'Das werfe ich nicht hinunter.' } },
      { id: 'kessler_liegt', name: 'Kessler', rect: [230, 460, 200, 60], at: [330, 540, 'u'], cond: (g) => g.flag('kessler_liegt') && !g.flag('kessler_kreta_weg'),
        look: 'Kessler. Er atmet. Er wird einen Kopf haben wie eine Kirchenglocke und eine Geschichte für Vesper. Beides gönne ich ihm.',
        take: 'Ich nehme ihn nicht mit. Er ist schwer und schlecht gelaunt.', use: 'Ich lasse ihn liegen. Er hat es sich ausgesucht.', push: 'Er rollt ein Stück und schnarcht weiter.', talk: 'Er schnarcht. Das ist die beste Unterhaltung, die ich von ihm bekomme.',
        useWith: { seil: 'Ich könnte ihn fesseln. Aber ich brauche das Seil vielleicht noch, und er braucht Stunden, bis er aufwacht.', raki: 'Ein Schluck würde ihn wecken. Dann hätte ich zwei Probleme.', default: 'Das lasse ich ihm nicht da.' } },
      { id: 'saeulen', name: 'Säulen', rect: [176, 40, 48, 410], at: [230, 500, 'l'],
        look: 'Zwei Säulen, rot, oben breiter als unten. Wie in Knossos, nur echt. Der Beton fehlt.', push: 'Sie tragen die Decke. Ich lasse sie.' },
      { id: 'schalen', name: 'Opferschalen', rect: [312, 404, 76, 40], at: [350, 490, 'u'],
        look: 'Opferschalen aus Bronze, grün angelaufen. Was darin war, ist seit dreitausend Jahren verdunstet. Mehr will ich über den Inhalt nicht wissen.' },
      { id: 'knochen', name: 'Knochen', rect: [696, 444, 52, 22], at: [670, 500, 'r'],
        look: 'Knochen am Rand des Schachts. Zu groß für einen Menschen, zu klein für einen Stier. Ziege, hoffe ich. Ich hoffe es sehr.' },
      { id: 'ketten', name: 'Bronzeketten', rect: [906, 36, 50, 186], at: [670, 500, 'r'],
        look: 'Bronzeketten an der Wand, mit Ringen am Ende. Für Tiere, die nicht freiwillig hier standen. Ich frage nicht weiter, was sonst.' },
    ],
    exits: [
      { id: 'ausgang', name: 'Gang zurück', rect: [30, 170, 122, 286], at: [110, 500, 'l'],
        look: (g) => g.flag('faden') ? 'Der Gang zurück. Der Faden liegt am Boden und verschwindet in der Dunkelheit. Aufwickeln, und ich bin draußen.' : 'Der Gang zurück. Ohne Faden sieht jede Abzweigung aus wie die vorige.',
        before: async (g) => {
          if (g.inRoom('kessler') && !g.flag('kessler_kreta')) { g.face('kessler', 'falk'); await g.say('kessler', 'Sie gehen nirgendwohin, Falk. Nicht mit dem Siegel.'); return false; }
          if (g.flag('faden')) {
            await g.message('Falk wickelt den Faden auf, Abzweigung um Abzweigung, bis Licht kommt.', 2600);
            await g.goto('cr_crypt', 640, 540, 'd');
            return false;
          }
          await g.say('falk', 'Ohne Faden. Dann eben noch einmal raten.');
          const r = await g.puzzle('maze', { thread: false, seed: 4243 });
          if (r === true) await g.goto('cr_crypt', 640, 540, 'd');
          else await g.say('falk', 'Wieder die Halle. Der Stier sieht aus, als hätte er das erwartet.');
          return false;
        } },
    ],
    actors: [
      { id: 'kessler', x: 260, y: 512, dir: 'r', at: [370, 522, 'l'], cond: (g) => g.flag('kessler_da') && !g.flag('kessler_kreta'), talk: (g) => g.dialog('kessler_halle'),
        look: 'Kessler. Breite Schultern, der Mantel trotz der Hitze, und ein Gesicht, das den Weg hierher auswendig gelernt hat.',
        giveWith: {
          stiersiegel: async (g) => { await g.say('kessler', 'Sie könnten es mir einfach geben.'); await g.say('falk', 'Könnte ich. Ich habe zu lange dafür gebraucht.'); },
          raki: [['kessler', 'Ich trinke nicht im Dienst.']], muenzen: [['kessler', 'Kleingeld? Vesper zahlt besser.']], wolle: ['Kessler sieht das Knäuel an.', ['kessler', 'Sie sind ein seltsamer Mann, Falk.']],
          default: [['kessler', 'Behalten Sie das. Ich will nur eines von Ihnen.']],
        },
        useWith: {
          oellampe: async (g) => {
            await g.say('falk', 'Ich schraube den Deckel ab und gieße das Öl auf die Platten zwischen uns. Langsam. Unauffällig.');
            await g.say('kessler', 'Was soll das werden, Falk? Ein Picknick?');
            await g.say('falk', 'Kommen Sie doch her und sehen Sie nach.');
            g.set('oellampe_leer');
            await g.scene(async () => {
              await g.walk('falk', 560, 530, 'l');
              await g.walk('kessler', 400, 520, 'r');
              g.fx('whoosh'); await g.wait(300); g.fx('punch');
              await g.message('Kessler tritt ins Öl. Die Sohle rutscht, das Bein fährt weg, und der Hinterkopf trifft die Altarstufe mit einem Geräusch, das Falk noch eine Weile hören wird.', 3400);
              g.hide('kessler'); g.set('kessler_liegt'); g.repaint();
              await g.say('falk', 'Öl auf Stein. Die älteste Falle der Welt, und er ist hineingelaufen wie ein Tourist.');
              await kesslerDone(g);
            });
          },
          wolle: async (g) => {
            await g.say('falk', 'Ich ziehe den Faden straff, knöchelhoch, zwischen Säule und Altar. Und gehe rückwärts, Richtung Schacht.');
            await g.say('kessler', 'Sie laufen in die falsche Richtung, Falk. Da hinten ist Schluss.');
            await g.say('falk', 'Ich weiß.');
            await g.scene(async () => {
              await g.walk('falk', 660, 532, 'l');
              await g.walk('kessler', 560, 526, 'r');
              g.fx('whoosh');
              await g.message('Kessler stürmt los, der Faden fängt den Fuß, und der Schwung tut den Rest: an Falk vorbei, über den Rand, in den Schacht.', 3400);
              g.hide('kessler'); g.fx('drop'); g.set('kessler_grube');
              await g.wait(600);
              await g.say('kessler', 'FALK!');
              await g.say('falk', 'Er ist auf einem Sims gelandet, vier Meter tiefer. Es geht ihm gut. Man hört es.');
              await g.say('falk', 'Ariadne hätte das gefallen. Theseus wahrscheinlich auch.');
              await kesslerDone(g);
            });
          },
          seil: 'Ihn fesseln? Erst müsste er stillhalten, und das hat er nicht vor.', taschenmesser: 'Ein Taschenmesser gegen Kessler. Das würde ihn nur ärgern, und mich in Schwierigkeiten bringen.',
          schaufel: 'Ich bin Archäologe, kein Totengräber. Noch nicht.', flasche: 'Wasser? Er ist nicht durstig, er ist gefährlich.', stiersiegel: 'Ich zeige es ihm nicht. Er weiß, wie es aussieht.',
          default: 'Das bringt Kessler nicht zu Fall.',
        } },
    ],
    async enter(g) {
      if (g.flag('halle_intro')) return;
      await g.scene(async () => {
        await g.message('Der Gang endet. Eine Halle, größer als die Krypta, und stockdunkel, bis Falk die erste Fackel findet.', 3000);
        g.fx('glow');
        await g.walk('falk', 300, 520, 'u');
        await g.say('falk', 'Fackeln in den Haltern. Pech und Werg, trocken wie Zunder. Ich habe Streichhölzer, und offenbar hat jemand mit mir gerechnet.');
        await g.say('falk', 'Und das da vorn.');
        await g.walk('falk', 480, 500, 'u');
        await g.say('falk', 'Ein Stier. Ein Kopf aus Bronze, drei Meter hoch, und das Maul ist zu.');
        await g.say('falk', '„Das Siegel des Stiers ruht bei dem, der im Haus des Minos hinter dem Faden wartet.“ Er hat gewartet. Lange.');
        g.set('halle_intro'); g.codex('stier');
        g.objective('Das Siegel des Stiers aus dem Maul des Bronzestiers holen.');
      });
    },
    leave(g) { if (g.flag('kessler_kreta')) g.set('kessler_kreta_weg'); },
  });

  ATL.dialogs.define('kessler_halle', {
    nodes: {
      root: {
        say: (g) => g.flag('kessler_runden') ? [['kessler', 'Noch einmal, Falk? Sie sind zäh. Zäh ist nicht dasselbe wie klug.']] : [],
        options: [
          { text: 'Vesper schickt Sie? Er muss knapp an Leuten sein.', once: true, say: [['kessler', 'Er schickt mich, weil ich zurückkomme. Andere tun das nicht.']] },
          { text: 'Wie haben Sie uns gefunden?', once: true, say: [['kessler', 'Alexandria. Ein Bootsführer, der zu viel redet, wenn man ihm zuhört. Und hier eine Wirtin, die einen Fremden im Mantel nicht vergisst.'], ['falk', 'Sie hätten den Mantel zu Hause lassen sollen.'], ['kessler', 'Ich habe kein Zuhause. Ich habe Aufträge.']] },
          { text: 'Was will Vesper mit dem Siegel?', once: true, say: [['kessler', 'Ich frage nicht. Er zahlt.'], ['falk', 'In Whitmore hat er nicht gezahlt.'], ['kessler', 'Der Professor hat einen Scheck bekommen. Dass er nicht gedeckt war, ist Sache der Bank.']] },
          { text: 'Sie könnten umkehren. Der Weg ist noch frei.', once: true, say: [['kessler', 'Ich könnte. Sie könnten mir das Siegel geben. Wir könnten beide ein langes Leben haben.'], ['falk', 'Ich hänge nicht an langen Leben. Ich hänge an Bronze.']] },
          { text: 'Das Siegel bleibt bei mir. Kommen Sie und holen Sie es sich.', end: true, say: [['kessler', 'Gern.']], action: fightKessler },
          { text: 'Einen Augenblick. Ich muss nachdenken.', end: true, say: [['kessler', 'Denken Sie schnell. Ich bin nicht geduldig, und die Fackeln sind es auch nicht.']] },
        ],
      },
    },
  });
})(window.ATL);
