/* Mesopotamien: Grabungslager bei Eridu, Zikkurat, Haus der Tafeln, der Abzu. Juni 1938. Vier Räume. */
(function (ATL) {
  const A = ATL.A;
  const R = ATL.rooms.define;
  const P = ATL.puzzles;

  // ---------------------------------------------------------------- Silbentafel und Keilschrift
  // Acht Zeichen (wedgeGlyph 0–7) mit Silbenwerten. Toms Liste.
  const SYL = [
    { glyph: 0, syl: 'e' }, { glyph: 1, syl: 'ri' }, { glyph: 2, syl: 'du' }, { glyph: 3, syl: 'ki' },
    { glyph: 4, syl: 'ab' }, { glyph: 5, syl: 'zu' }, { glyph: 6, syl: 'en' }, { glyph: 7, syl: 'a' },
  ];
  const CHOICES = SYL.map((s) => s.syl);
  const SIGN = (syl) => SYL.find((s) => s.syl === syl);
  const ZYLINDER = ['e', 'ri', 'du', 'ki', 'ab', 'zu'].map(SIGN);   // e-ri-du KI ab-zu: „Eridu, Ort, Abzu“
  const FLUTTAFEL = ['en', 'ki', 'a', 'ab', 'zu'].map(SIGN);        // en-ki a ab-zu: „Enki, Wasser, Abzu“

  // Die Silbentafel als eigene Einblendung. Im Testmodus nur ein Satz.
  async function showSyllabar(g) {
    if (g.fast) { await g.say('falk', 'Acht Zeichen, acht Silben. Toms Handschrift ist besser als meine.'); return; }
    await P.open(g, (box, close) => {
      box.appendChild(ATL.U.el('h2', { text: 'Toms Silbentafel' }));
      box.appendChild(ATL.U.el('p', { text: 'Die acht häufigsten Zeichen aus den Fundlisten von Eridu, mit ihrem Lautwert. Bleistift auf Packpapier.' }));
      const cv = ATL.U.el('canvas', { width: 90 * SYL.length + 20, height: 120 });
      box.appendChild(cv);
      const c = cv.getContext('2d');
      A.rect(c, 0, 0, cv.width, 120, '#b89060');
      for (let i = 0; i < 40; i++) A.rect(c, (i * 97) % cv.width, (i * 53) % 120, 3, 1, 'rgba(0,0,0,0.12)');
      SYL.forEach((s, i) => {
        A.rr(c, 12 + i * 90, 10, 76, 100, 6, '#a07a4a', '#6a4a2a', 1.5);
        c.fillStyle = '#2a1a0a';
        P.wedgeGlyph(c, 50 + i * 90, 48, 44, s.glyph);
        A.text(c, s.syl, 50 + i * 90, 98, { font: 'bold 20px Georgia', color: '#2a1a0a', align: 'center' });
      });
      box.appendChild(ATL.U.el('p', { text: 'Anmerkung Tom: „KI hinter einem Namen heißt: ein Ort. A ist Wasser. EN ist Herr. Mehr weiß ich auch nicht.“' }));
      const b = ATL.U.el('button', { text: 'Weglegen', class: 'primary' });
      b.addEventListener('click', () => close(true));
      box.appendChild(b);
    });
  }

  // Die Silbentafel aus items.js bekommt hier ihre Einblendung. Ein useWith-Eintrag sorgt dafür,
  // dass „Benutze Silbentafel mit …“ in der Oberfläche möglich bleibt.
  ATL.items.define({
    id: 'syllabar', name: 'Silbentafel',
    look: 'Toms Liste der acht häufigsten Keilschriftzeichen mit ihren Silbenwerten. Bleistift auf Packpapier, mit Kaffeeflecken. Ich kann sie aufschlagen.',
    use: showSyllabar, open: showSyllabar,
    useWith: { syllabar: showSyllabar, tafeltext: 'Die Abschrift ist fertig. Die Liste hat ihren Dienst getan.', default: 'Die Liste hilft beim Lesen, sonst bei nichts.' },
  });

  Object.assign(ATL.codex, {
    zikkurat: { title: 'Die Zikkurat', origin: 'Mesopotamische Baugeschichte', text: 'Eine Zikkurat ist ein Stufenbau aus Lehmziegeln mit einem Mantel aus gebrannten Ziegeln; auf der obersten Terrasse stand ein Tempel. Das Wort kommt vom akkadischen ziqqurratu, zu zaqāru, „hoch bauen“. Die besterhaltene steht in Ur. Ur-Nammu ließ sie um 2100 v. Chr. errichten, Leonard Woolley legte sie zwischen 1922 und 1934 frei.\nIn Eridu begann Amar-Sin von Ur, ein Nachfolger Ur-Nammus, um 2040 v. Chr. eine Zikkurat über den älteren Tempeln des Enki. Sie blieb unvollendet. Der Turmbau zu Babel in der Bibel geht nach verbreiteter Ansicht auf die Zikkurat Etemenanki in Babylon zurück.' },
  });

  // ---------------------------------------------------------------- Grabungslager
  const sandDots = (ctx, x, y, w, h, seed, n) => { const r = ATL.U.rng(seed); for (let i = 0; i < n; i++) { ctx.fillStyle = `rgba(0,0,0,${0.03 + r() * 0.06})`; ctx.fillRect(x + r() * w, y + r() * h, 2 + r() * 4, 1 + r() * 2); } };

  // ---- Ausschmückungshelfer für das Kapitel (Grabung 1938, Wüste, Zisterne)
  // Vermessungsstange, rot-weiß, Spitze unten
  const surveyPole = (ctx, x, y0, y1) => { const n = 8, seg = (y1 - y0) / n; for (let i = 0; i < n; i++) A.rect(ctx, x - 3, y0 + i * seg, 6, seg, i % 2 ? '#ece4d4' : '#b8382e'); A.poly(ctx, [x - 3, y1, x + 3, y1, x, y1 + 6], '#555'); A.rect(ctx, x - 4, y0 - 4, 8, 4, '#333'); };
  // Spitzhacke und Schaufel: Ursprung ist der Fußpunkt, a neigt das Werkzeug (Bogenmaß)
  const pickaxe = (ctx, x, y, a) => { ctx.save(); ctx.translate(x, y); ctx.rotate(a || 0); A.rect(ctx, -2, -52, 4, 52, '#8a6a48'); ctx.strokeStyle = '#4a4a48'; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-17, -46); ctx.quadraticCurveTo(0, -58, 17, -46); ctx.stroke(); ctx.restore(); };
  const shovel = (ctx, x, y, a) => { ctx.save(); ctx.translate(x, y); ctx.rotate(a || 0); A.rect(ctx, -2, -56, 4, 44, '#8a6a48'); A.rect(ctx, -6, -60, 12, 5, '#6a5238'); A.poly(ctx, [-7, -14, 7, -14, 6, 0, 0, 4, -6, 0], '#6e6e6a'); A.line(ctx, -3, -12, -3, 0, 'rgba(255,255,255,0.25)', 1); ctx.restore(); };
  // Siebrahmen aus Holz mit Drahtgeflecht
  const sieve = (ctx, x, y, s) => { A.rr(ctx, x, y, s, s, 2, '#a07a4a', '#6a5238', 2); ctx.strokeStyle = 'rgba(40,30,20,0.45)'; ctx.lineWidth = 1; ctx.beginPath(); for (let i = 5; i < s; i += 5) { ctx.moveTo(x + i, y + 2); ctx.lineTo(x + i, y + s - 2); ctx.moveTo(x + 2, y + i); ctx.lineTo(x + s - 2, y + i); } ctx.stroke(); };
  // Geier, der langsam auf einer Ellipse kreist
  const vulture = (ctx, t, cx, cy, rx, ry, speed, size, phase) => {
    const a = t * speed + (phase || 0); const x = cx + Math.cos(a) * rx, y = cy + Math.sin(a) * ry;
    const s = size * (0.8 + Math.sin(a) * 0.2), f = Math.sin(t * 1.1 + a) * 2;
    ctx.strokeStyle = 'rgba(40,35,30,0.75)'; ctx.lineWidth = 1.6; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x - 10 * s, y + f); ctx.quadraticCurveTo(x - 4 * s, y - 3 * s, x, y); ctx.quadraticCurveTo(x + 4 * s, y - 3 * s, x + 10 * s, y + f); ctx.stroke();
    A.ell(ctx, x, y + 1, 2.6 * s, 1.4 * s, 'rgba(40,35,30,0.75)');
  };
  // Sandschleier, die der Wind über den Boden treibt
  const windSand = (ctx, t, y0, h, n) => {
    ctx.lineWidth = 1.2; ctx.lineCap = 'round';
    for (let i = 0; i < n; i++) {
      const x = ((i * 173 + t * (50 + (i % 3) * 20)) % 1100) - 70, y = y0 + ((i * 47) % h), l = 24 + (i % 4) * 12;
      ctx.strokeStyle = `rgba(240,225,190,${0.16 + (i % 2) * 0.1})`;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + l / 2, y - 2, x + l, y); ctx.stroke();
    }
  };
  // Fußspuren entlang einer Linienkette
  const footprints = (ctx, pts, color) => {
    for (let i = 0; i + 3 < pts.length; i += 2) {
      const x0 = pts[i], y0 = pts[i + 1], x1 = pts[i + 2], y1 = pts[i + 3]; const n = Math.max(1, Math.floor(Math.hypot(x1 - x0, y1 - y0) / 14));
      for (let k = 0; k < n; k++) { const f = k / n; A.ell(ctx, x0 + (x1 - x0) * f + (k % 2 ? 4 : -4), y0 + (y1 - y0) * f, 3, 1.6, color || 'rgba(90,70,40,0.14)'); }
    }
  };
  const scorpion = (ctx, x, y, c) => {
    c = c || '#3a2a18'; A.ell(ctx, x, y, 7, 3, c); A.ell(ctx, x - 8, y, 3, 2, c);
    for (let i = 0; i < 3; i++) { A.line(ctx, x - 3 + i * 3, y, x - 5 + i * 3, y + 5, c, 1); A.line(ctx, x - 3 + i * 3, y, x - 1 + i * 3, y - 5, c, 1); }
    A.line(ctx, x - 11, y, x - 15, y - 3, c, 1.2); A.line(ctx, x - 11, y, x - 15, y + 3, c, 1.2);
    ctx.strokeStyle = c; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x + 6, y); ctx.quadraticCurveTo(x + 14, y - 1, x + 13, y - 9); ctx.stroke(); A.circle(ctx, x + 13, y - 9, 1.5, c);
  };
  const lizard = (ctx, x, y, c) => {
    c = c || '#7a6a48'; A.ell(ctx, x, y, 8, 3, c); A.circle(ctx, x + 9, y - 0.5, 2.5, c);
    ctx.strokeStyle = c; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x - 8, y); ctx.quadraticCurveTo(x - 16, y + 2, x - 22, y - 4); ctx.stroke();
    for (const s of [-1, 1]) { A.line(ctx, x + 4, y, x + 8, y + 5 * s, c, 1); A.line(ctx, x - 4, y, x - 8, y + 5 * s, c, 1); }
  };
  // Feldbett: x, y ist die linke obere Ecke der Liegefläche
  const cot = (ctx, x, y, w, color) => {
    A.line(ctx, x + 6, y + 2, x + 16, y + 22, '#5a4a3a', 2); A.line(ctx, x + 16, y + 2, x + 6, y + 22, '#5a4a3a', 2);
    A.line(ctx, x + w - 16, y + 2, x + w - 6, y + 22, '#5a4a3a', 2); A.line(ctx, x + w - 6, y + 2, x + w - 16, y + 22, '#5a4a3a', 2);
    ctx.fillStyle = color || '#8a8a6a'; ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + w / 2, y + 8, x + w, y); ctx.lineTo(x + w, y + 5); ctx.quadraticCurveTo(x + w / 2, y + 13, x, y + 5); ctx.closePath(); ctx.fill();
    A.rect(ctx, x - 2, y - 1, w + 4, 3, '#6a5238');
    A.rr(ctx, x + 4, y - 9, 18, 10, 4, '#a8a088');
  };
  // Fahrradgenerator für den Funk: x, y ist der Boden unter dem Rad
  const pedalGenerator = (ctx, x, y) => {
    A.ell(ctx, x + 14, y + 1, 36, 4, 'rgba(0,0,0,0.15)');
    A.rect(ctx, x - 20, y - 3, 62, 3, '#4a4a48');
    A.circle(ctx, x, y - 18, 15, null, '#3a3a3a', 3);
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI; A.line(ctx, x - Math.cos(a) * 13, y - 18 - Math.sin(a) * 13, x + Math.cos(a) * 13, y - 18 + Math.sin(a) * 13, '#777', 1); }
    A.line(ctx, x, y - 18, x + 22, y - 40, '#3a3a3a', 3); A.line(ctx, x + 22, y - 40, x + 34, y - 20, '#3a3a3a', 3); A.line(ctx, x + 34, y - 20, x, y - 18, '#3a3a3a', 3);
    A.rr(ctx, x + 13, y - 46, 18, 6, 3, '#4a3a2a');
    A.circle(ctx, x + 34, y - 20, 4, '#3a3a3a'); A.line(ctx, x + 34, y - 20, x + 40, y - 12, '#777', 2);
    A.rr(ctx, x + 40, y - 15, 20, 12, 2, '#5a5a58'); A.rect(ctx, x + 42, y - 10, 16, 3, '#8a7a3a');
    A.line(ctx, x + 14, y - 22, x + 50, y - 9, 'rgba(0,0,0,0.5)', 1.5);
  };
  const stalactite = (ctx, x, y, w, h, color) => { A.poly(ctx, [x - w / 2, y, x + w / 2, y, x + w * 0.08, y + h * 0.85, x, y + h], color); A.poly(ctx, [x - w / 2, y, x - w * 0.15, y, x - w * 0.05, y + h * 0.7], A.shade(color, 0.12)); };
  // Fisch als Ritzzeichnung: dir 1 schaut nach rechts
  const fishGlyph = (ctx, x, y, w, color, dir) => {
    const d = dir || 1; ctx.strokeStyle = color; ctx.lineWidth = 1.4; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x - w * 0.5 * d, y); ctx.quadraticCurveTo(x - w * 0.1 * d, y - w * 0.28, x + w * 0.3 * d, y); ctx.quadraticCurveTo(x - w * 0.1 * d, y + w * 0.28, x - w * 0.5 * d, y); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x - w * 0.5 * d, y); ctx.lineTo(x - w * 0.68 * d, y - w * 0.2); ctx.lineTo(x - w * 0.68 * d, y + w * 0.2); ctx.closePath(); ctx.stroke();
    A.circle(ctx, x + w * 0.16 * d, y - w * 0.05, 1.2, color);
  };
  // Enki im Relief: Hörnerkrone, Falbelgewand; die Wasserströme malt der Raum selbst
  function enkiRelief(ctx, x, baseY, h, color) {
    const w = h * 0.36;
    const draw = (dx, dy, c) => {
      A.rr(ctx, x - w * 0.4 + dx, baseY - h * 0.62 + dy, w * 0.8, h * 0.62, 4, c);
      for (let i = 0; i < 5; i++) A.line(ctx, x - w * 0.38 + dx, baseY - h * 0.55 + i * h * 0.1 + dy, x + w * 0.38 + dx, baseY - h * 0.55 + i * h * 0.1 + dy, A.shade(c, -0.12), 1);
      A.circle(ctx, x + dx, baseY - h * 0.72 + dy, w * 0.2, c);
      A.poly(ctx, [x - w * 0.14 + dx, baseY - h * 0.66 + dy, x + w * 0.14 + dx, baseY - h * 0.66 + dy, x + dx, baseY - h * 0.52 + dy], A.shade(c, -0.1));
      A.poly(ctx, [x - w * 0.26 + dx, baseY - h * 0.8 + dy, x + w * 0.26 + dx, baseY - h * 0.8 + dy, x + w * 0.2 + dx, baseY - h * 0.98 + dy, x - w * 0.2 + dx, baseY - h * 0.98 + dy], c);
      A.line(ctx, x - w * 0.26 + dx, baseY - h * 0.82 + dy, x - w * 0.36 + dx, baseY - h * 0.94 + dy, c, 2); A.line(ctx, x + w * 0.26 + dx, baseY - h * 0.82 + dy, x + w * 0.36 + dx, baseY - h * 0.94 + dy, c, 2);
    };
    draw(2, 2, A.shade(color, -0.45)); draw(0, 0, color);
  }
  // Tonöllampe (Schnabelform) mit Rußfahne an der Wand darüber
  const clayLamp = (ctx, x, y, soot) => { if (soot) A.ell(ctx, x + 12, y - 28, 8, 20, 'rgba(0,0,0,0.35)'); A.ell(ctx, x, y - 3, 9, 4, '#8a6a48'); A.poly(ctx, [x + 8, y - 4, x + 15, y - 3, x + 8, y - 1], '#8a6a48'); A.ell(ctx, x - 1, y - 5, 4, 1.8, '#3a2a18'); };

  R({
    id: 'me_camp', name: 'Grabungslager bei Eridu', ambient: 'mesopotamia',
    start: [160, 520, 'r'],
    walk: [[20, 455, 940, 455, 940, 585, 20, 585]],
    scale: { y0: 455, s0: 0.8, y1: 585, s1: 1.05 },
    paint(ctx, g) {
      // Gleißender Himmel, Sonne fast weiß
      A.sky(ctx, 960, 350, '#cfdde8', '#f7ead0');
      A.glow(ctx, 760, 80, 300, 'rgba(255,250,225,0.9)', 0.55);
      A.sun(ctx, 760, 80, 30, '#fffbea');
      // Dunst über dem Horizont, ferne Ruinenhügel
      A.dune(ctx, 960, 342, '#dccaa0', 12, 10);
      A.ziggurat(ctx, 880, 340, 220, 92, '#c8aa78', 3);
      A.rect(ctx, 0, 300, 960, 45, A.grad(ctx, 0, 300, 0, 345, ['rgba(247,234,208,0)', 'rgba(240,222,180,0.55)']));
      A.dune(ctx, 960, 352, '#d3bc8e', 5, 8);
      // Boden
      A.ground(ctx, 0, 352, 960, 250, '#dac49a', '#b6976a');
      sandDots(ctx, 0, 352, 960, 250, 21, 700);
      // Grabungsschnitt im Hintergrund links, mit Schnüren und Abraum
      A.rect(ctx, 30, 356, 240, 26, '#a88a5e'); A.rect(ctx, 36, 360, 228, 18, '#7a6040');
      for (let i = 0; i < 5; i++) A.line(ctx, 30 + i * 60, 354, 30 + i * 60, 384, '#f0e8d0', 1);
      A.line(ctx, 30, 354, 270, 354, '#f0e8d0', 1); A.line(ctx, 30, 384, 270, 384, '#f0e8d0', 1);
      A.dune(ctx, 330, 356, '#c8ae80', 8, 14);
      // Reifenspuren zur Piste rechts
      for (let i = 0; i < 26; i++) { A.rect(ctx, 700 + i * 10, 556 - i * 1.6, 6, 3, 'rgba(90,70,40,0.25)'); A.rect(ctx, 700 + i * 10, 574 - i * 1.6, 6, 3, 'rgba(90,70,40,0.25)'); }
      // Wegweiser an der Piste links
      A.rect(ctx, 44, 400, 8, 120, '#6a5238');
      A.poly(ctx, [20, 412, 96, 412, 96, 432, 20, 432, 10, 422], '#e8dcb8'); A.text(ctx, 'BASRA 200', 58, 427, { font: 'bold 10px Georgia', color: '#3a2a1a', align: 'center' });
      A.poly(ctx, [20, 440, 96, 440, 106, 450, 96, 460, 20, 460], '#e8dcb8'); A.text(ctx, 'ERIDU', 56, 455, { font: 'bold 10px Georgia', color: '#3a2a1a', align: 'center' });
      // Funkmast mit Abspannung
      A.line(ctx, 140, 445, 140, 100, '#3a3a3a', 5);
      for (let i = 0; i < 5; i++) A.line(ctx, 128, 130 + i * 60, 152, 130 + i * 60, '#3a3a3a', 2);
      A.line(ctx, 140, 100, 90, 445, 'rgba(60,60,60,0.7)', 1); A.line(ctx, 140, 100, 190, 445, 'rgba(60,60,60,0.7)', 1);
      A.line(ctx, 140, 100, 120, 92, '#3a3a3a', 3); A.line(ctx, 140, 100, 160, 92, '#3a3a3a', 3);
      // (der Wimpel am Mast flattert in animate)
      A.line(ctx, 140, 130, 250, 320, 'rgba(60,60,60,0.5)', 1);
      // Erdanker der Abspannseile, Isolatoren am Kabel
      A.poly(ctx, [84, 440, 96, 440, 92, 452, 88, 452], '#4a4a48'); A.poly(ctx, [184, 440, 196, 440, 192, 452, 188, 452], '#4a4a48');
      A.circle(ctx, 172, 185, 2.5, '#e8e8e0'); A.circle(ctx, 206, 244, 2.5, '#e8e8e0');
      // Abraumhalden und ferne Zelte der Arbeiter
      A.dune(ctx, 960, 350, '#c4a878', 19, 12);
      A.tent(ctx, 470, 352, 40, 22, '#cbbb92'); A.tent(ctx, 520, 354, 46, 26, '#c4b48a'); A.tent(ctx, 585, 350, 36, 20, '#cbbb92');
      // Am Grabungsschnitt: Maßstab, Schubkarre, Sieb, zwei Arbeiter in der Ferne
      surveyPole(ctx, 282, 344, 386);
      A.poly(ctx, [296, 372, 330, 372, 326, 386, 300, 386], '#6a6a66'); A.circle(ctx, 300, 388, 5, '#3a3a3a'); A.line(ctx, 330, 372, 344, 378, '#5a4a3a', 2);
      sieve(ctx, 316, 356, 26);
      for (const [wx, wy] of [[120, 372], [205, 368]]) { A.rect(ctx, wx - 3, wy - 10, 6, 10, '#7a6650'); A.circle(ctx, wx, wy - 13, 3, '#c8a888'); A.ell(ctx, wx, wy - 15, 4, 1.5, '#e8e0d0'); }
      A.basket(ctx, 60, 384, 18, 12, '#b8955a'); A.basket(ctx, 250, 386, 16, 11, '#a8854a');
      // Lange Zeltschatten nach links unten (Sonne steht rechts oben)
      A.poly(ctx, [130, 448, 250, 448, 232, 462, 40, 474], 'rgba(60,40,20,0.1)');
      A.poly(ctx, [645, 445, 750, 445, 704, 460, 556, 458], 'rgba(60,40,20,0.1)');
      // Funkzelt und Vorratszelt, mit Schatten und Abspannschnüren
      A.ell(ctx, 250, 450, 150, 12, 'rgba(0,0,0,0.18)');
      A.tent(ctx, 250, 448, 240, 140, '#d2c39c');
      A.poly(ctx, [250, 308, 370, 448, 250, 448], 'rgba(0,0,0,0.12)');
      A.line(ctx, 130, 448, 160, 380, '#8a7a5a', 1); A.line(ctx, 370, 448, 340, 380, '#8a7a5a', 1);
      A.rect(ctx, 300, 392, 60, 14, '#6a5238'); A.text(ctx, 'W/T', 330, 403, { font: 'bold 10px Georgia', color: '#efe4c8', align: 'center' });
      // Flickstellen und Nähte auf der Zeltbahn, Petroleumlampe an der Stange im Eingang
      A.rr(ctx, 168, 396, 22, 16, 2, '#c4b48a'); A.rr(ctx, 300, 350, 14, 20, 2, '#c8b890');
      A.line(ctx, 200, 448, 250, 320, 'rgba(0,0,0,0.08)', 1); A.line(ctx, 300, 448, 250, 320, 'rgba(0,0,0,0.08)', 1);
      A.line(ctx, 250, 366, 250, 380, '#3a3a3a', 1); A.lantern(ctx, 250, 402, 0, false);
      // Wäscheleine vom Mast zur Zeltstange
      ctx.strokeStyle = '#8a7a5a'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(140, 316); ctx.quadraticCurveTo(195, 334, 250, 302); ctx.stroke();
      const lineY = (x) => { const k = (x - 140) / 110, a = 1 - k; return a * a * 316 + 2 * a * k * 334 + k * k * 302; };
      [[156, 20, 24, '#efe8d8', true], [186, 14, 20, '#7a8aa0', false], [212, 18, 22, '#c8b48a', true]].forEach(([lx, lw, lh, c, shirt]) => {
        const ly = lineY(lx + lw / 2);
        A.rect(ctx, lx, ly, lw, lh, c); if (shirt) { A.rect(ctx, lx - 5, ly + 2, 5, 8, c); A.rect(ctx, lx + lw, ly + 2, 5, 8, c); }
        A.rect(ctx, lx, ly, lw, 2, A.shade(c, -0.2)); A.rect(ctx, lx + 2, ly - 3, 2, 5, '#5a4a3a'); A.rect(ctx, lx + lw - 4, ly - 3, 2, 5, '#5a4a3a');
      });
      // Fahrradgenerator neben dem Funkzelt, Kabel ins Zelt
      pedalGenerator(ctx, 196, 456);
      A.line(ctx, 250, 446, 236, 452, 'rgba(30,30,30,0.6)', 1);
      // Feldbett vor dem Funkzelt, Klappstuhl daneben
      A.ell(ctx, 322, 474, 32, 5, 'rgba(0,0,0,0.15)'); cot(ctx, 294, 452, 56, '#8e8c6c');
      A.ell(ctx, 750, 447, 130, 10, 'rgba(0,0,0,0.18)');
      A.tent(ctx, 750, 445, 210, 125, '#c6b088');
      A.poly(ctx, [750, 320, 855, 445, 750, 445], 'rgba(0,0,0,0.12)');
      A.line(ctx, 645, 445, 665, 390, '#8a7a5a', 1);
      A.rr(ctx, 790, 372, 18, 24, 2, '#b8a078'); A.line(ctx, 800, 445, 750, 335, 'rgba(0,0,0,0.07)', 1);
      // Säcke, Sieb und Werkzeug am Vorratszelt
      A.ell(ctx, 716, 458, 34, 5, 'rgba(0,0,0,0.15)'); A.sack(ctx, 702, 458, 28, 32, '#cbb890'); A.sack(ctx, 728, 460, 24, 26, '#c0ac84');
      sieve(ctx, 762, 424, 28);
      shovel(ctx, 804, 452, 0.14); shovel(ctx, 814, 454, 0.2); pickaxe(ctx, 830, 454, 0.26);
      A.chair(ctx, 352, 470, 22, '#8a6a48');
      A.crate(ctx, 812, 400, 70, 45, '#8a6a48', 'ERIDU 38'); A.crate(ctx, 886, 408, 56, 37, '#9a7a52', 'IX');
      A.crate(ctx, 892, 376, 44, 32, '#9a7a52', 'XII'); A.rect(ctx, 812, 398, 70, 2, 'rgba(255,240,200,0.3)');
      A.lantern(ctx, 838, 400, 0, false);
      for (let i = 0; i < 3; i++) A.ell(ctx, 866, 404 - i * 2, 9 - i, 3, i % 2 ? '#a89060' : '#8a7448');
      // Fußspuren im Sand, die zwischen Zelten, Tisch und Tank hin und her laufen
      footprints(ctx, [270, 478, 380, 496, 470, 500, 600, 474]); footprints(ctx, [160, 470, 250, 462]);
      // Sonnensegel über dem Fundtisch, mit Stangen, Spannschnüren und Schatten darunter
      A.rect(ctx, 380, 456, 176, 18, 'rgba(60,40,20,0.08)');
      A.line(ctx, 374, 384, 350, 458, '#8a7a5a', 1); A.line(ctx, 558, 384, 584, 458, '#8a7a5a', 1);
      A.rect(ctx, 372, 384, 4, 88, '#6a5238'); A.rect(ctx, 556, 384, 4, 88, '#6a5238');
      A.awning(ctx, 360, 378, 208, 12, '#dccaa2', '#c8b48a', 8);
      A.rect(ctx, 364, 378, 204, 3, '#a8987a');
      // Fundtisch mit Scherben, Tafeln, Notizbuch
      A.rect(ctx, 380, 460, 170, 28, 'rgba(0,0,0,0.12)');
      A.table(ctx, 380, 425, 170, 12, '#8a6a48', 50);
      A.crate(ctx, 398, 456, 40, 30, '#8a6a48', '7'); A.basket(ctx, 520, 486, 34, 24, '#b8955a');
      A.poly(ctx, [510, 466, 520, 460, 528, 466], '#a8794a'); A.poly(ctx, [526, 466, 536, 461, 540, 467], '#8a5a3a');
      A.rr(ctx, 392, 405, 30, 22, 4, '#b89468'); A.cuneiform(ctx, 395, 408, 24, 16, '#5a3a20', 4);
      A.rr(ctx, 428, 409, 26, 18, 3, '#b08a5a'); A.cuneiform(ctx, 431, 412, 20, 12, '#5a3a20', 9);
      A.ell(ctx, 480, 418, 16, 8, '#8a5a3a'); A.ell(ctx, 480, 411, 10, 4, '#5a3a20');
      A.rect(ctx, 505, 412, 36, 14, '#efe4c8'); A.line(ctx, 510, 417, 536, 417, '#666', 1); A.line(ctx, 510, 421, 530, 421, '#666', 1);
      // Fundzettel mit roter Linie, Scherbenhäufchen, Pinsel, Lupe
      for (const [tx, ty] of [[458, 421], [500, 405], [544, 416]]) { A.rect(ctx, tx, ty, 12, 7, '#f4ecd8'); A.rect(ctx, tx + 2, ty + 3, 8, 1, '#b8382e'); }
      A.poly(ctx, [455, 412, 462, 404, 468, 411], '#a8794a'); A.poly(ctx, [466, 414, 472, 407, 476, 414], '#8a5a3a'); A.poly(ctx, [446, 416, 452, 409, 456, 416], '#b08a5a');
      A.line(ctx, 430, 430, 452, 428, '#5a4a3a', 2); A.rect(ctx, 452, 425, 8, 5, '#d8c8a0');
      A.circle(ctx, 522, 404, 5, 'rgba(200,220,230,0.5)', '#3a3a3a', 1.5); A.line(ctx, 526, 407, 534, 412, '#3a3a3a', 2);
      // Wassertank auf Böcken
      A.rect(ctx, 600, 430, 8, 22, '#4a3a2a'); A.rect(ctx, 682, 430, 8, 22, '#4a3a2a'); A.rect(ctx, 596, 428, 98, 5, '#5a4a3a');
      A.rr(ctx, 594, 348, 102, 82, 14, A.grad(ctx, 594, 0, 696, 0, ['#6a7a7a', '#a8b4b0', '#5a6a6a']));
      A.rect(ctx, 594, 372, 102, 4, '#4a5a5a'); A.rect(ctx, 594, 402, 102, 4, '#4a5a5a');
      A.rect(ctx, 636, 340, 18, 10, '#3a4a4a');
      A.rect(ctx, 690, 412, 14, 5, '#8a7a3a'); A.rect(ctx, 702, 412, 4, 12, '#8a7a3a');
      A.rr(ctx, 694, 432, 22, 20, 3, '#7a8a8a'); A.ell(ctx, 705, 432, 11, 4, '#9aa8a8');
      A.text(ctx, 'WATER', 645, 393, { font: 'bold 12px Georgia', color: '#e8e8e0', align: 'center' });
      // Rost und Tropfspur am Tank, Wasserkrüge aus Ton daneben
      A.rect(ctx, 600, 376, 6, 22, 'rgba(120,70,30,0.35)'); A.ell(ctx, 654, 455, 18, 3, 'rgba(60,80,90,0.25)');
      A.ell(ctx, 566, 464, 16, 4, 'rgba(0,0,0,0.18)'); A.ell(ctx, 586, 466, 14, 3, 'rgba(0,0,0,0.18)');
      A.pot(ctx, 566, 463, 24, 32, '#a8794a'); A.pot(ctx, 586, 465, 20, 24, '#b08050');
      A.rect(ctx, 556, 452, 6, 3, '#8a7a5a');
      // Ölfleck an der Stelle, wo der Jeep steht
      A.ell(ctx, 792, 553, 26, 6, 'rgba(40,30,20,0.25)');
      // Feuerstelle links vorn
      A.ell(ctx, 110, 546, 34, 12, '#8a7a60');
      for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; A.ell(ctx, 110 + Math.cos(a) * 32, 546 + Math.sin(a) * 11, 7, 4, '#7a6a5a'); }
      A.ell(ctx, 110, 545, 16, 6, '#3a3230'); A.rr(ctx, 100, 522, 20, 18, 4, '#3a3a3a'); A.rect(ctx, 96, 520, 28, 3, '#2a2a2a');
      // Teegläser, Teekanne und ein Holzstapel neben der Feuerstelle
      A.rr(ctx, 62, 552, 6, 9, 1, 'rgba(220,200,150,0.8)'); A.rr(ctx, 72, 554, 6, 9, 1, 'rgba(220,200,150,0.8)');
      A.rr(ctx, 82, 556, 12, 10, 3, '#8a8a86'); A.line(ctx, 94, 558, 100, 556, '#8a8a86', 2); A.rect(ctx, 86, 553, 4, 3, '#8a8a86');
      A.ell(ctx, 162, 566, 16, 3, 'rgba(0,0,0,0.2)');
      for (let i = 0; i < 4; i++) A.rect(ctx, 150 + (i % 2) * 3, 560 - i * 4, 22, 4, i % 2 ? '#7a5a3a' : '#6a4a2e');
      // Kanister am Vorratszelt, solange Nabil ihn nicht freigibt
      if (!g.flag('kanister_erhalten')) { A.rr(ctx, 652, 452, 24, 32, 3, '#5a6a3a'); A.rect(ctx, 658, 447, 8, 6, '#3a3a3a'); A.rect(ctx, 656, 462, 16, 10, '#3a4a2a'); }
      A.vignette(ctx, 960, 600, 0.3);
      A.grain(ctx, 960, 600, 4, 0.035);
    },
    paintFront(ctx) {
      // Zeltplane, die oben links ins Bild hängt
      ctx.fillStyle = A.grad(ctx, 0, 0, 120, 100, ['#cdbd93', '#a8987a']);
      A.poly(ctx, [0, 0, 176, 0, 0, 128], ctx.fillStyle);
      A.line(ctx, 176, 0, 0, 128, '#7a6a4a', 3); A.line(ctx, 150, 8, 12, 108, 'rgba(0,0,0,0.12)', 6);
      A.circle(ctx, 30, 96, 4, '#5a4a3a'); A.circle(ctx, 30, 96, 2, '#2a2a2a'); A.line(ctx, 30, 96, 0, 140, '#8a7a5a', 2);
      // Wasserkrug rechts vorn
      A.ell(ctx, 936, 604, 40, 7, 'rgba(0,0,0,0.25)');
      A.pot(ctx, 938, 606, 64, 58, '#a8794a'); A.line(ctx, 916, 560, 912, 598, 'rgba(255,240,200,0.25)', 2);
      // Blecheimer und Schaufel links vorn
      A.ell(ctx, 18, 604, 26, 5, 'rgba(0,0,0,0.25)');
      A.pot(ctx, 16, 606, 38, 36, '#7c7c78'); A.ell(ctx, 16, 570, 19, 4, '#5a5a58');
      ctx.strokeStyle = '#5a5a58'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(16, 570, 17, Math.PI, 0); ctx.stroke();
      shovel(ctx, 44, 596, 1.3);
    },
    animate(ctx, t) {
      // Hitzeflimmern über dem Horizont: helle Streifen, die langsam wandern
      for (let i = 0; i < 6; i++) { const y = 300 + i * 9 + Math.sin(t * 1.7 + i) * 2; A.rect(ctx, 0, y, 960, 1, `rgba(255,255,240,${0.05 + (i % 2) * 0.04})`); }
      A.dust(ctx, 0, 380, 960, 200, t, 14, 'rgba(120,100,60,0.25)');
      // Zwei Geier über der Ebene, der Wimpel am Mast, Rauch vom Kochfeuer der Arbeiter, Sand im Wind
      vulture(ctx, t, 600, 150, 120, 26, 0.35, 1.1, 0); vulture(ctx, t, 400, 110, 70, 14, 0.28, 0.7, 2);
      A.flag(ctx, 141, 107, 28, 12, t, '#b8473a');
      A.smoke(ctx, 548, 350, t, 'rgba(210,200,180,0.3)', 0.45);
      windSand(ctx, t, 470, 110, 7);
    },
    hotspots: [
      { id: 'sonnensegel', name: 'Sonnensegel', rect: [372, 372, 190, 22], at: [465, 480, 'u'],
        look: 'Ein Sonnensegel über dem Fundtisch. Der einzige Schatten im Lager, der nicht zu einem Zelt gehört. Nabil hat ihn für die Scherben aufgespannt, nicht für uns.' },
      { id: 'generator', name: 'Fahrradgenerator', rect: [174, 408, 60, 48], at: [206, 480, 'u'], z: 2,
        look: 'Ein Fahrrad ohne Räder, das einen Generator treibt. Wer mit Tom funken will, tritt vorher zwanzig Minuten in die Pedale. Die Nachrichten werden dadurch kürzer.' },
      { id: 'kruege', name: 'Wasserkrüge', rect: [552, 436, 38, 30], at: [578, 480, 'u'],
        look: 'Tonkrüge, wie sie hier seit fünftausend Jahren gebrannt werden. Das Wasser bleibt darin kühl. Der Tank aus Stahl schafft das nicht.' },
      { id: 'zikkurat_fern', name: 'Zikkurat in der Ferne', rect: [770, 245, 190, 95], at: [880, 470, 'u'],
        look: async (g) => { await g.say('falk', 'Die Zikkurat von Eridu. Ein Hügel aus Lehmziegeln, drei Stufen, viertausend Jahre. Von hier sieht sie aus wie ein Sandhaufen mit Ambitionen.'); g.codex('zikkurat'); },
        use: 'Zu Fuß sind es zwanzig Minuten. Der Weg geht rechts aus dem Lager.', take: 'Nein.' },
      { id: 'funkmast', name: 'Funkmast', rect: [86, 90, 108, 355], at: [140, 470, 'u'],
        look: 'Ein Stahlmast mit Antenne und Abspannseilen. Toms Verbindung nach Bagdad, Basra und, wenn der Wind stimmt, London.',
        use: 'Tom lässt niemanden an seinen Mast.', pull: 'Wenn ich daran ziehe, fällt er um, und Tom redet nie wieder mit mir.', push: 'Er steht. Das soll er auch.', take: 'Er ist mit Stahlseilen im Boden verankert.' },
      { id: 'funkzelt', name: 'Funkzelt', rect: [140, 310, 220, 140], at: [250, 475, 'u'],
        look: 'Das Funkzelt. Ein Tisch, ein Gerät mit Röhren, Batterien und ein Stapel Meldungen, die Tom auf Packpapier schreibt.',
        open: 'Es steht offen. Tom sitzt davor.', use: 'Ohne Tom fasse ich das Gerät nicht an. Ich würde damit höchstens Nachbarn stören.' },
      { id: 'vorratszelt', name: 'Vorratszelt', rect: [650, 322, 200, 125], at: [750, 480, 'u'],
        look: 'Konserven, Mehl, Werkzeug, Gips für Abgüsse. Und Benzin, aber davon wenig.',
        open: 'Es ist offen. Nabil hat trotzdem ein Auge darauf.', take: 'Ich nehme nichts, ohne zu fragen. Nabil zählt.' },
      { id: 'kisten', name: 'Fundkisten', rect: [808, 396, 140, 52], at: [870, 475, 'u'],
        look: 'Fundkisten. Scherben, Tafeln, Lehmkegel mit Inschriften. Alles nummeriert, alles in Watte. Ordentlicher als mein Büro.',
        open: 'Nabil hat sie vernagelt. Nach der Sache mit Mahmud.', take: 'Nein. Ich habe genug Ärger mit einer Figur gehabt.' },
      { id: 'fundtisch', name: 'Fundtisch', rect: [378, 400, 176, 40], at: [465, 480, 'u'],
        look: 'Der Tisch der Grabung. Zwei Tontafeln, eine Schale, ein Notizbuch mit Fundnummern. Die Tafeln sind Wirtschaftstexte: Gerste, Schafe, Namen.',
        take: 'Die Tafeln sind Nabils Fundstücke. Ich lese, ich nehme nicht.',
        use: (g) => g.has('syllabar') ? 'Gerste, Schafe, Namen. Mit Toms Liste komme ich bis „Gerste“, dann wird es dünn.' : 'Keile in Ton. Ohne Silbenliste sehe ich Muster, keine Wörter.' },
      { id: 'wassertank', name: 'Wassertank', rect: [590, 338, 116, 116], at: [648, 475, 'u'],
        look: 'Ein Tank auf Böcken, eine Tonne Wasser aus dem Euphrat, dreimal gefiltert. Es schmeckt trotzdem nach Euphrat.',
        use: 'Ich trinke einen Schluck aus dem Hahn. Warm, aber nass. Tom hat recht, man vergisst es.',
        open: 'Der Hahn ist unten. Ich brauche keinen Deckel.',
        useWith: { flasche: async (g) => { if (g.flag('flasche_leer')) { g.set('flasche_leer', false); g.fx('water'); return 'Ich fülle die Feldflasche. Warmes Euphratwasser. Besser als nichts.'; } return 'Die Flasche ist noch voll. Ich nehme einen Schluck aus dem Hahn, das reicht.'; }, default: 'Das gehört nicht in den Tank.' } },
      { id: 'feuerstelle', name: 'Feuerstelle', rect: [70, 515, 80, 45], at: [160, 550, 'l'],
        look: 'Eine Feuerstelle aus Steinen, ein verrußter Kessel. Hier gibt es morgens Tee und abends Tee. Mittags ist es zu heiß für Tee.',
        use: 'Es ist aus. Bei dieser Hitze braucht niemand Feuer.', take: 'Der Kessel gehört dem Koch, und der Koch hat ein Messer.', open: 'Der Kessel ist leer. Teeblätter, sonst nichts.' },
      { id: 'kanister', name: 'Benzinkanister', rect: [648, 444, 32, 42], at: [660, 500, 'u'], cond: (g) => !g.flag('kanister_erhalten'),
        look: 'Ein Kanister aus Armeebeständen. Zwanzig Liter, wenn er voll ist. Er sieht voll aus.',
        take: (g) => g.flag('zylinder_gelesen') ? 'Erst sage ich Nabil, was ich gelesen habe. Dann frage ich. Er hat schon einen Vorarbeiter an Leute verloren, die einfach nehmen.' : 'Nabil steht zehn Meter weiter und sieht mich an. Ich habe keine Lust auf Streit an meinem ersten Tag.',
        use: 'Nicht meiner. Noch nicht.', open: 'Ich rieche es von hier: Benzin. Der Deckel bleibt zu.' },
      { id: 'jeep', name: 'Jeep', rect: [700, 490, 172, 62], at: [680, 552, 'r'], z: 549, cond: (g) => !g.flag('jeep_an_zikkurat'),
        paint: (ctx) => { A.jeep(ctx, 700, 548, 170, '#6b6a3c'); A.rect(ctx, 706, 512, 30, 12, '#3a3a2a'); A.text(ctx, 'IRAQ', 812, 540, { font: 'bold 8px Georgia', color: '#e8e0c8', align: 'center' }); },
        look: (g) => g.flag('jeep_betankt') ? 'Der Jeep der Grabung. Vorn eine Seilwinde, hinten Sand. Jetzt ist Benzin drin.' : 'Der Jeep der Grabung. Staub, Beulen, eine Winde am Kühler. Die Tankanzeige steht auf null, wenn sie überhaupt geht.',
        use: async (g) => {
          if (!g.flag('jeep_betankt')) { await g.say('falk', 'Ich drehe den Schlüssel. Der Anlasser orgelt, der Motor bleibt still. Kein Tropfen im Tank.'); if (!g.flag('kanister_erhalten')) await g.say('falk', 'Im Vorratszelt steht ein Kanister. Und davor steht Nabil.'); return; }
          await g.scene(async () => {
            await g.walk('falk', 680, 552, 'r');
            g.fx('door');
            await g.say('falk', 'Der Motor springt an. Beim dritten Versuch.');
            g.set('jeep_an_zikkurat');
            await g.message('Der Jeep holpert über die Piste, zwischen Grabungsschnitten und Abraumhalden, bis die Zikkurat über ihm steht.', 3000);
            await g.goto('me_ziggurat', 500, 556, 'r');
          });
        },
        open: 'Die Motorhaube. Ein Motor, staubig, aber vollständig. Der Fehler liegt nicht hier, sondern im Tank.',
        push: 'Bis zur Zikkurat schieben? Nein.', pull: 'Er soll ziehen, nicht ich.', take: 'Ich nehme ihn. Aber er muss selbst fahren.',
        useWith: {
          kanister: async (g) => { await g.say('falk', 'Ich schraube den Tank auf und gieße. Zwanzig Liter, zwei davon auf meine Schuhe.'); g.drop('kanister'); g.set('jeep_betankt'); g.fx('water'); await g.say('falk', 'Das reicht bis zur Zikkurat und zurück. Und noch einmal, wenn es sein muss.'); g.objective('Mit dem Jeep zur Zikkurat fahren und den Eingang freilegen.'); },
          seil: 'Hier gibt es nichts zu ziehen. Der Block liegt an der Zikkurat.',
          flasche: 'Wasser in den Tank? Das ist nicht das, was ihm fehlt.',
          default: 'Das hilft dem Jeep nicht.',
        } },
    ],
    exits: [
      { id: 'piste', name: 'Piste nach Basra', rect: [0, 380, 100, 150], at: [60, 545, 'l'],
        look: 'Die Piste zurück nach Basra, zum Zug, zum Schiff. Zweihundert Kilometer Staub.',
        before: async (g) => {
          if (!g.has('flutsiegel') && !g.flag('piste_kommentar')) { g.set('piste_kommentar'); await g.say('falk', 'Ohne das Siegel. Aber Eridu läuft nicht weg, es liegt seit sechstausend Jahren hier.'); }
          await ATL.story.openMap(g, 'eridu');
          return false;
        } },
      { id: 'weg', name: 'Weg zur Zikkurat', rect: [900, 340, 60, 200], at: [925, 500, 'r'], to: 'me_ziggurat', pos: [80, 530], dir: 'r',
        look: 'Ein Fußweg über die Abraumhalden zur Zikkurat. Zwanzig Minuten, wenn man nicht stehen bleibt.' },
    ],
    actors: [
      { id: 'tom', x: 300, y: 492, dir: 'r', talk: (g) => g.dialog('tom'), look: 'Tom, der Funker. Sonnenbrand, Brille, ein Bleistift hinter jedem Ohr.',
        giveWith: { muenzen: 'Tom nimmt kein Geld. Er nimmt Nachrichten.', syllabar: 'Die brauche ich noch. Tom bekommt sie zurück, wenn wir fertig sind.', flasche: 'Tom hat seinen eigenen Tee.' } },
      { id: 'nabil', x: 470, y: 512, dir: 'd', talk: (g) => g.dialog('nabil'), look: 'Nabil, der Vorarbeiter. Er sieht mich an, wie man einen Kredit ansieht, den man nicht geben will.',
        giveWith: {
          muenzen: [['nabil', 'Stecken Sie das weg. Der Letzte, der hier Geld gezeigt hat, hat meinen Vorarbeiter gekauft.'], ['falk', 'Verstanden.']],
          visitenkarte: [['nabil', 'Meridian-Gesellschaft. Ja. So hieß es auf dem Brief, den Mahmud in seinem Zelt liegen ließ.'], ['nabil', 'Wenn Sie zu denen gehören, gehen Sie jetzt.'], ['falk', 'Ich gehöre zu denen, die von denen bestohlen wurden.'], ['nabil', 'Dann sind wir schon zwei.']],
          syllabar: 'Nabil kann Keilschrift besser lesen als Tom und ich zusammen. Er braucht die Liste nicht.',
          flutsiegel: [['nabil', 'Ein Stein aus dem Abzu. Mein Großvater hätte sich gefreut, ich freue mich nicht. Nehmen Sie ihn mit, und nehmen Sie den Ärger gleich mit.']],
        } },
      { id: 'livia', x: 560, y: 548, dir: 'l', talk: (g) => g.dialog('livia_me'), look: 'Livia. Sie hat den Hut in die Stirn gezogen und schaut zur Zikkurat, als würde sie ihr gleich etwas erzählen.',
        giveWith: {
          flutsiegel: [['livia', 'Behalte du es. Ich verliere Dinge, wenn ich aufgeregt bin.']],
          flasche: [['livia', 'Danke. Ich habe meine eigene. Du solltest trinken, du siehst aus wie ein Sonnenbrand mit Hut.']],
          syllabar: [['livia', 'Toms Liste? Nett. Ich lese Keilschrift seit Oxford, Adrian. Behalte sie, du brauchst sie nötiger.']],
          medaillon: [['livia', 'Es wird warm hier. Wärmer als in New York. Wir kommen näher, an was auch immer.']],
        } },
    ],
    async enter(g) {
      if (!g.flag('jeep_an_zikkurat')) g.blockWalk('jeep', [690, 486, 876, 486, 876, 556, 690, 556]);
      if (!g.flag('me_intro')) {
        g.set('me_intro');
        await g.scene(async () => {
          await g.message('Eridu, Südirak. Juni 1938.', 2600);
          await g.say('falk', 'Vierzig Grad, und es ist noch nicht Mittag.');
          await g.say('livia', 'Da. Die Zikkurat von Eridu. Die älteste Stadt der Welt, sagen die Sumerer. Hier kam das Königtum vom Himmel herab.');
          await g.say('falk', 'Es sieht aus, als wäre es gleich wieder gegangen.');
          await g.walk('nabil', 400, 530, 'l');
          await g.say('nabil', 'Sie sind die Amerikaner. Der Professor aus Bagdad hat gefunkt, dass Sie kommen.');
          await g.say('falk', 'Falk. Das ist Dr. Marsh. Wir suchen den Eingang der Zikkurat.');
          await g.say('nabil', 'Das hat der Letzte auch gesagt. Er hatte Geld, gute Manieren und einen deutschen Akzent. Seitdem fehlt mir ein Vorarbeiter und eine Kiste Tafeln.');
          await g.say('nabil', 'Also verzeihen Sie, wenn ich Ihnen nichts gebe, bevor ich weiß, was Sie können.');
          await g.walk('nabil', 470, 512, 'd');
          await g.say('livia', 'Er hat recht, Adrian. Vespers Leute waren zuerst hier.');
          await g.say('falk', 'Dann reden wir mit ihm. Und mit dem Funker. Irgendwer muss hier Keilschrift lesen.');
          g.objective('Den Eingang der Zikkurat finden. Erst mit Nabil und Tom reden.');
        });
        return;
      }
      if (g.has('flutsiegel') && !g.flag('me_fertig')) {
        g.set('me_fertig');
        await g.scene(async () => {
          await g.walk('falk', 400, 540, 'r');
          await g.walk('tom', 340, 520, 'r');
          await g.say('tom', 'Falk. Ich habe etwas aufgefangen, das Sie angeht.');
          await g.say('tom', 'Ein Schiff namens Meridian. Es hat gestern Piräus verlassen, Kurs Süd. Der Funker fragt in Thera nach einem Liegeplatz, und er fragt laut.');
          await g.walk('livia', 470, 548, 'l');
          await g.say('livia', 'Thera. Vesper weiß, wo das Tor ist. Er wartet nur noch auf die Schlüssel.');
          await g.say('falk', 'Dann soll er warten. Hier, sieh dir das an.');
          await g.say('livia', 'Drei Wellen in blauem Stein. Lapislazuli, das kommt aus Afghanistan, über tausend Kilometer. Und die Arbeit ist nicht sumerisch, Adrian. Das ist älter als Eridu.');
          await g.say('falk', 'Du sagst das, als wäre es eine gute Nachricht.');
          await g.say('livia', 'Es ist eine Nachricht.');
          await g.say('tom', 'Ich funke Basra, dass Sie einen Wagen brauchen.');
          await g.walk('tom', 300, 492, 'r');
          g.set('tom_meridian');
          if (g.has('stiersiegel')) g.objective('Nach Thera reisen. Vespers Jacht ist schon unterwegs.');
          else g.objective('Das Siegel des Stiers auf Kreta finden. Dann nach Thera.');
        });
      }
    },
  });

  // ---------------------------------------------------------------- Gespräche im Lager
  ATL.dialogs.define('tom', {
    nodes: {
      root: {
        options: [
          { text: 'Sie sind der Funker?', once: true, say: [['tom', 'Tom Reilly. Funk und Buchhaltung, beides schlecht bezahlt.'], ['falk', 'Falk, Whitmore College.'], ['tom', 'Ich weiß. Bagdad hat gefunkt, dass Sie kommen. Nabil glaubt es trotzdem nicht. Nabil glaubt seit drei Wochen niemandem mehr.']] },
          { text: 'Haben Sie eine Liste der Keilschriftzeichen? Eine Silbentafel.', cond: (g) => !g.flag('syllabar_erhalten'),
            say: [['tom', 'Ich habe mir eine gemacht. Die acht häufigsten Zeichen, damit ich die Fundnummern von Nabils Leuten lesen kann. Packpapier und Bleistift.'], ['tom', 'Nehmen Sie sie. Aber bringen Sie sie zurück, ich habe hier sonst nichts zu lesen.']],
            action: async (g) => { g.take('syllabar'); g.set('syllabar_erhalten'); g.codex('keilschrift'); await g.say('falk', 'Acht Zeichen. Damit buchstabiert man keine Epen. Aber vielleicht einen Namen.'); } },
          { text: 'Was ist hier vorgefallen? Nabil sieht mich an wie einen Dieb.', once: true,
            say: [['tom', 'Vor drei Wochen war ein Herr hier. Deutscher Akzent, gutes Englisch, Geld. Hat sich Tafeln angesehen und lange mit Mahmud geredet, dem alten Vorarbeiter.'], ['tom', 'Zwei Tage später war Mahmud weg. Und die Kiste mit den besten Tafeln auch.'], ['falk', 'Hat der Herr gesagt, was er sucht?'], ['tom', 'Den Eingang der Zikkurat. Alle fragen das. Er hat es freundlicher gefragt als die meisten, das war das Unangenehme.']] },
          { text: 'Gibt es Neues über Funk?', once: true, cond: (g) => !g.flag('tom_meridian'),
            say: [['tom', 'Bagdad meldet Hitze. London meldet Regen. Ein Frachter mit Datteln ist in Basra festgefahren.'], ['tom', 'Und irgendein Schiff in der Ägäis fragt alle drei Stunden nach Wetter und Liegeplätzen. Reiche Leute, nervös. Sie hören sich an wie Sie.']] },
          { text: 'Ihre Silbentafel bringe ich zurück, wenn wir fertig sind.', cond: (g) => g.flag('syllabar_erhalten') && g.has('syllabar'), once: true,
            say: [['tom', 'Behalten Sie sie, solange Sie hier sind. Ich habe den Durchschlag.']] },
          { text: 'Bis später, Tom.', end: true, say: [['tom', 'Trinken Sie Wasser. Alle vergessen das.']] },
        ],
      },
    },
  });

  ATL.dialogs.define('nabil', {
    nodes: {
      root: {
        options: [
          { text: 'Ich bin Falk, vom Whitmore College. Wir suchen den Eingang der Zikkurat.', cond: (g) => !g.flag('nabil_auftrag'),
            say: [['nabil', 'Das hat der andere auch gesagt. Der mit dem Geld.'], ['nabil', 'Er sagte, er sei Assyriologe. Dann hat er auf einer Tafel das Zeichen für Ort mit dem für Wasser verwechselt. Mahmud hat es nicht gemerkt. Ich schon.'], ['falk', 'Und dann?'], ['nabil', 'Dann war Mahmud weg, mit einer Kiste Tafeln und dem Lohn seiner Leute. Also: Beweisen Sie mir, dass Sie lesen können.'], ['nabil', 'Am Fuß der Zikkurat, Westseite, steckt ein Gründungszylinder im Mauerwerk. Sagen Sie mir, was darauf steht. Dann reden wir weiter.']],
            action: async (g) => { g.set('nabil_auftrag'); g.objective('Den Gründungszylinder an der Zikkurat lesen. Tom hat vielleicht eine Silbentafel.'); } },
          { text: 'Ich habe den Zylinder gelesen.', cond: (g) => g.flag('zylinder_gelesen') && !g.flag('kanister_erhalten'),
            say: [['nabil', 'Und?'], ['falk', 'E-ri-du, dann das Ortszeichen, dann Abzu. Der Zylinder nennt den Tempel: das Haus des Abzu in Eridu.'], ['nabil', 'Das Haus des Abzu. Ja.'], ['nabil', 'Gut. Sie können lesen, und Sie raten nicht. Der Kanister am Vorratszelt gehört Ihnen. Zwanzig Liter, mehr haben wir nicht.'], ['nabil', 'Der Jeep zieht mehr als zwanzig Männer. Wenn Sie den Block wegbekommen, ist der Eingang Ihrer. Was dahinter ist, gehört dem Museum in Bagdad. Das sage ich einmal.']],
            action: async (g) => { g.take('kanister'); g.set('kanister_erhalten'); g.repaint(); g.objective('Den Jeep betanken und zur Zikkurat fahren.'); } },
          { text: 'Ich brauche Benzin für den Jeep.', cond: (g) => !g.flag('kanister_erhalten'),
            say: (g) => g.flag('nabil_auftrag') ? [['nabil', 'Erst der Zylinder. Dann das Benzin.']] : [['nabil', 'Benzin ist für die Arbeit. Und Sie haben mir noch nicht gezeigt, dass Sie arbeiten.']] },
          { text: 'Wo ist der Eingang der Zikkurat?', once: true,
            say: [['nabil', 'Westseite, neben der großen Treppe. Vor zwei Jahren ist ein Ziegelblock von der oberen Terrasse davorgestürzt. Zwanzig Männer haben gezogen. Er liegt noch da.'], ['falk', 'Und mit dem Jeep?'], ['nabil', 'Mit dem Jeep vielleicht. Mit dem Jeep und Benzin.']] },
          { text: 'Was wissen Sie über den Abzu?', once: true, cond: (g) => g.flag('nabil_auftrag'),
            say: [['nabil', 'Enki wohnt darin, sagen die alten Texte. Unter dem Tempel, im süßen Wasser.'], ['nabil', 'Mein Großvater sagte, unter dem Hügel ist eine Zisterne, die nie leer wird. Er hat sie nie gesehen. Ich auch nicht. Vielleicht Sie.']] },
          { text: 'Bis später.', end: true, say: [['nabil', 'Hut aufbehalten. Und Wasser trinken.']] },
        ],
      },
    },
  });

  const liviaHint = (g) => {
    if (!g.flag('syllabar_erhalten')) return 'Tom liest Keilschrift, um Fundnummern zu entziffern. Frag ihn nach seiner Liste. Ohne die kannst du hier nichts lesen, und lesen ist alles, was uns von Vespers Leuten unterscheidet.';
    if (!g.flag('nabil_auftrag')) return 'Nabil. Er traut uns nicht, und er hat Gründe. Hör dir seine Gründe an, dann sagt er dir, was er von dir will.';
    if (!g.flag('zylinder_gelesen')) return 'Der Gründungszylinder an der Zikkurat. Lies ihn, Silbe für Silbe, mit Toms Liste. Nabil will keinen Vortrag, er will den Text.';
    if (!g.flag('kanister_erhalten')) return 'Sag Nabil, was auf dem Zylinder steht. Er wartet darauf, auch wenn er so tut, als täte er es nicht.';
    if (!g.flag('jeep_betankt')) return 'Du hast Benzin, der Jeep hat keins. Das lässt sich verbinden.';
    if (!g.flag('jeep_an_zikkurat')) return 'Fahr zur Zikkurat. Zu Fuß ziehst du keinen Block weg.';
    if (!g.flag('block_weg')) return 'Ein Block, ein Jeep, ein Seil. Du hast in Vermont ein Kletterseil an die Garderobe gehängt, du weißt, wie man Knoten macht.';
    if (!g.flag('fluttafel_gelesen')) return 'Im Haus der Tafeln liegt irgendwo eine, die von der Flut erzählt. Nimm Toms Liste mit hinein.';
    if (!g.flag('weisen_tuer_offen')) return 'Sieben Weise an einer Tür. Die Tafel sagt dir, welcher zählt.';
    if (!g.has('flutsiegel')) return 'Der Abzu. Das süße Wasser der Tiefe. Enki hat sein Zeichen nicht auf den Boden gelegt, Adrian. Schau nach oben, und lass das Wasser für dich arbeiten.';
    return g.has('stiersiegel') ? 'Drei Siegel. Jetzt Thera, bevor Vesper vor uns am Tor steht.' : 'Das Siegel der Flut. Jetzt fehlt noch der Stier. Kreta, bevor Vesper merkt, wo wir sind.';
  };
  ATL.dialogs.define('livia_me', {
    nodes: {
      root: {
        options: [
          { text: 'Was sollen wir als Nächstes tun?', say: (g) => [['livia', liviaHint(g)]] },
          { text: 'Eridu. Warum ausgerechnet hier?', once: true,
            say: [['livia', 'Weil die Sumerer glaubten, hier sei das Königtum vom Himmel gekommen. Die erste Stadt. Und weil Enki hier wohnte, der Herr des süßen Wassers, im Abzu unter dem Tempel.'], ['livia', 'Solons Text sagt: die Weisen aus dem Meer, im Haus des süßen Wassers. Das ist Eridu, oder es ist nichts.'], ['falk', 'Ich bin für „nichts“ offen.'], ['livia', 'Ich weiß.']],
            action: (g) => { g.codex('eridu'); } },
          { text: 'Die sieben Weisen. Erzähl.', once: true,
            say: [['livia', 'Die Apkallu. Sieben, die vor der Flut aus dem Meer kamen und den Menschen Schrift, Ackerbau, Gesetze brachten. Männer im Fischgewand, der Fischkopf als Kapuze.'], ['livia', 'Berossos nennt den ersten Oannes. Tagsüber lehrte er, nachts ging er zurück ins Wasser.'], ['falk', 'Ein Lehrer mit Bürozeiten.'], ['livia', 'Deine Figur vom Dachboden war einer von ihnen, Adrian. Deshalb wollte Vesper sie.']],
            action: (g) => { g.codex('apkallu'); } },
          { text: 'Die Flut. Gilgamesch.', once: true,
            say: [['livia', 'Elfte Tafel. Utnapischtim erzählt Gilgamesch, wie Ea ihn durch die Wand seines Schilfhauses warnte: Reiß das Haus ab, bau ein Schiff. Sechs Tage und sieben Nächte Flut.'], ['livia', 'Die Sumerer hatten die Geschichte vorher, mit Ziusudra. Und Ea ist Enki. Der Gott, dem dieser Tempel gehört, hat den einen Menschen die Flut überleben lassen.'], ['falk', 'Dann sollte er wissen, wo sein Siegel liegt.'], ['livia', 'Er weiß es. Er sagt es nur nicht.']],
            action: (g) => { g.codex('gilgamesch'); } },
          { text: 'Wegen Thera. Damals.', once: true,
            say: [['livia', 'Nicht hier, Adrian. Nicht bei vierzig Grad.'], ['falk', 'Später, also.'], ['livia', 'Später. Wenn wir ein Siegel in der Tasche haben und Schatten über dem Kopf.']] },
          { text: 'Bis gleich.', end: true, say: [['livia', 'Hut auf. Du wirst rot.']] },
        ],
      },
    },
  });

  // ---------------------------------------------------------------- Zikkurat
  async function readCylinder(g) {
    if (g.flag('zylinder_gelesen')) return 'E-ri-du, das Ortszeichen, Abzu. Das Haus des Abzu in Eridu. Ich habe es gelesen, es steht noch da.';
    if (!g.has('syllabar')) return 'Keile, Striche, Winkel, sauber in den Ton gedrückt. Ohne Silbenliste ist das für mich ein Muster, kein Text.';
    await g.say('falk', 'Sechs Zeichen in der ersten Zeile, tief und sauber gedrückt. Ich vergleiche sie mit Toms Liste.');
    const r = await g.puzzle('cuneiform', { title: 'Der Gründungszylinder', text: 'Die erste Zeile des Zylinders. Zeichen anklicken, dann die Silbe aus Toms Liste wählen. Am Ende „Lesen“.', signs: ZYLINDER, choices: CHOICES, tableGlyphs: SYL });
    if (r === true) {
      g.set('zylinder_gelesen'); g.fx('success');
      await g.say('falk', 'E, ri, du. Eridu. Dann KI, das Ortszeichen: die Stadt Eridu. Dann ab, zu: Abzu.');
      await g.say('falk', 'Das Haus des Abzu in Eridu. Der Zylinder nennt den Tempel, für den er gestiftet wurde. Enkis Haus, über dem süßen Wasser.');
      g.codex('keilschrift'); g.codex('eridu');
      g.objective('Nabil im Lager sagen, was auf dem Zylinder steht.');
    } else if (r === 'wrong') await g.say('falk', 'So ergibt das kein Wort, das ich kenne. Noch einmal, langsamer.');
    else await g.say('falk', 'Später. Die Sonne brennt mir auf den Nacken.');
  }

  const BLOCK_POLY = [378, 366, 484, 366, 484, 462, 378, 462];
  const BLOCK_POLY2 = [512, 396, 620, 396, 620, 478, 512, 478];
  const JEEP_POLY_Z = [548, 492, 742, 492, 742, 556, 548, 556];

  R({
    id: 'me_ziggurat', name: 'Zikkurat von Eridu', ambient: 'mesopotamia',
    start: [80, 530, 'r'],
    walk: [[20, 458, 940, 458, 940, 585, 20, 585]],
    scale: { y0: 458, s0: 0.82, y1: 585, s1: 1.05 },
    paint(ctx, g) {
      A.sky(ctx, 960, 450, '#c8d8e6', '#f6e8cc');
      A.glow(ctx, 160, 70, 260, 'rgba(255,250,225,0.9)', 0.5);
      A.sun(ctx, 160, 70, 26, '#fffbea');
      A.dune(ctx, 960, 420, '#dccaa0', 15, 12);
      A.rect(ctx, 0, 380, 960, 60, A.grad(ctx, 0, 380, 0, 440, ['rgba(240,222,180,0)', 'rgba(220,198,150,0.7)']));
      // Drei Terrassen aus Lehmziegeln, die Kanten vom Wind abgerundet
      const tier = (x, y, w, h, seed) => {
        A.bricks(ctx, x, y, w, h, '#b8946a', 30, 12, seed, '#8a6a48');
        A.rect(ctx, x, y, w, 7, '#d8bc90');
        A.poly(ctx, [x - 14, y + h, x, y + h * 0.3, x, y + h], '#c9ad80'); A.poly(ctx, [x + w + 14, y + h, x + w, y + h * 0.3, x + w, y + h], '#a88a60');
        ctx.fillStyle = A.grad(ctx, 0, y, 0, y + h, ['rgba(0,0,0,0)', 'rgba(0,0,0,0.22)']); ctx.fillRect(x, y, w, h);
        ctx.fillStyle = A.grad(ctx, x, 0, x + w, 0, ['rgba(0,0,0,0.22)', 'rgba(0,0,0,0)', 'rgba(255,240,200,0.08)']); ctx.fillRect(x, y, w, h);
        // ausgebrochene Kanten oben
        const r = ATL.U.rng(seed + 50);
        for (let i = 0; i < w / 18; i++) { const bx = x + i * 18 + r() * 6; A.rect(ctx, bx, y - 2 - r() * 8, 10 + r() * 8, 4 + r() * 8, r() < 0.5 ? '#c9ad80' : '#a88a60'); }
      };
      tier(300, 30, 360, 62, 7);
      tier(170, 92, 620, 130, 8);
      tier(30, 222, 900, 222, 9);
      // Erosionsrinnen an der Front
      for (let i = 0; i < 9; i++) { const x = 60 + i * 100 + (i % 3) * 17; A.line(ctx, x, 240, x + 6, 440, 'rgba(60,40,20,0.22)', 3); }
      // Bitumenlagen zwischen den Ziegelschichten, mit Tropfnasen; Salzausblühungen am Fuß
      const rbit = ATL.U.rng(91);
      for (const [bx, by, bw] of [[30, 262, 900], [30, 334, 900], [30, 400, 900], [170, 152, 620]]) {
        A.rect(ctx, bx, by, bw, 3, 'rgba(25,15,10,0.42)');
        for (let x = bx + 10; x < bx + bw; x += 26 + rbit() * 30) A.rect(ctx, x, by + 3, 2 + rbit() * 2, 3 + rbit() * 12, 'rgba(25,15,10,0.35)');
      }
      for (let i = 0; i < 7; i++) A.ell(ctx, 80 + i * 130 + rbit() * 40, 428 + rbit() * 8, 24 + rbit() * 20, 5, 'rgba(255,250,235,0.16)');
      // Reliefspuren: ein verwittertes Rosettenband unter der Terrassenkante, ein Inschriftfeld mit Prozession
      for (let x = 60; x < 920; x += 36) { if (x > 536 && x < 668) continue; A.circle(ctx, x, 243, 5.5, null, 'rgba(60,40,20,0.22)', 1.5); A.circle(ctx, x, 243, 1.5, 'rgba(60,40,20,0.3)'); }
      A.rect(ctx, 200, 296, 90, 46, 'rgba(0,0,0,0.12)'); ctx.strokeStyle = 'rgba(60,40,20,0.3)'; ctx.lineWidth = 1.5; ctx.strokeRect(200, 296, 90, 46);
      for (let i = 0; i < 4; i++) { const fx = 214 + i * 20; A.rect(ctx, fx - 3, 312, 6, 16, 'rgba(60,40,20,0.22)'); A.circle(ctx, fx, 308, 3, 'rgba(60,40,20,0.22)'); A.line(ctx, fx + 3, 316, fx + 8, 322, 'rgba(60,40,20,0.22)', 1.5); }
      A.cuneiform(ctx, 206, 330, 80, 10, 'rgba(60,40,20,0.28)', 27);
      // Eidechse auf den warmen Ziegeln
      lizard(ctx, 704, 384, '#8a7a52');
      // Schatten der Treppenwange nach rechts, Schatten im Bogen über dem Eingang
      A.rect(ctx, 654, 222, 22, 218, 'rgba(0,0,0,0.12)');
      A.rect(ctx, 470, 330, 16, 110, 'rgba(0,0,0,0.1)');
      // Große Treppe rechts der Mitte, hinauf zur ersten Terrasse
      for (let i = 0; i < 14; i++) { A.rect(ctx, 560, 440 - i * 15, 84, 15, A.shade('#b8946a', i * 0.01)); A.rect(ctx, 560, 440 - i * 15, 84, 4, '#e2caa0'); A.rect(ctx, 560, 451 - i * 15, 84, 4, 'rgba(0,0,0,0.3)'); }
      A.rect(ctx, 550, 222, 10, 218, '#8a6a48'); A.rect(ctx, 644, 222, 10, 218, '#8a6a48');
      A.rect(ctx, 546, 218, 18, 6, '#c9ad80'); A.rect(ctx, 640, 218, 18, 6, '#c9ad80');
      // Eingang neben der Treppe: dunkler Bogen im Mauerwerk
      A.arch(ctx, 402, 334, 68, 106, '#7a5a3a', '#0a0806');
      A.rect(ctx, 396, 328, 80, 8, '#8a6a48');
      // Nische mit dem Gründungszylinder
      A.rect(ctx, 760, 356, 50, 42, '#2a1c10'); A.rect(ctx, 756, 352, 58, 6, '#8a6a48');
      A.rr(ctx, 767, 364, 36, 26, 9, '#b08a5a'); A.cuneiform(ctx, 771, 368, 28, 18, '#4a2e18', 5);
      // Sand: Boden und Verwehungen am Fuß der Mauer
      A.ground(ctx, 0, 440, 960, 160, '#dcc69c', '#b6976a');
      A.dune(ctx, 960, 452, '#e2cca4', 14, 16);
      A.poly(ctx, [30, 440, 200, 440, 240, 452, 0, 468], '#e6d2aa'); A.poly(ctx, [700, 440, 960, 440, 960, 470, 760, 456], '#e6d2aa');
      sandDots(ctx, 0, 445, 960, 155, 33, 600);
      // heruntergefallene Ziegel im Sand, Schatten der Mauer
      const rb = ATL.U.rng(77);
      for (let i = 0; i < 14; i++) { const bx = 40 + rb() * 880, by = 452 + rb() * 60; ctx.save(); ctx.translate(bx, by); ctx.rotate((rb() - 0.5) * 0.8); A.rect(ctx, -9, -4, 18, 8, rb() < 0.5 ? '#a8845a' : '#8a6a48'); ctx.restore(); }
      A.rect(ctx, 30, 440, 900, 14, A.grad(ctx, 0, 440, 0, 454, ['rgba(0,0,0,0.3)', 'rgba(0,0,0,0)']));
      // Windrippel im Sand, weiter vorn deutlicher
      for (let j = 0; j < 9; j++) {
        const y = 468 + j * 13 + j * j * 0.6; ctx.strokeStyle = `rgba(120,90,50,${0.05 + j * 0.008})`; ctx.lineWidth = 1; ctx.beginPath();
        for (let x = 0; x <= 960; x += 16) { const yy = y + Math.sin(x * 0.04 + j * 1.3) * (2 + j * 0.3); x ? ctx.lineTo(x, yy) : ctx.moveTo(x, yy); }
        ctx.stroke();
      }
      // Geröll am Mauerfuß, Ziegelbrocken mit Schatten, ein toter Tamariskenbusch an jeder Seite
      A.rubble(ctx, 60, 438, 110, 26, 12, '#a8845a'); A.rubble(ctx, 690, 440, 70, 22, 15, '#9a7a52');
      const rb2 = ATL.U.rng(78);
      for (let i = 0; i < 9; i++) { const bx = 60 + rb2() * 840, by = 470 + rb2() * 90; A.ell(ctx, bx + 3, by + 5, 11, 3, 'rgba(0,0,0,0.16)'); ctx.save(); ctx.translate(bx, by); ctx.rotate((rb2() - 0.5) * 1.2); A.rect(ctx, -9, -4, 18, 8, rb2() < 0.5 ? '#a8845a' : '#8a6a48'); A.rect(ctx, -9, -4, 18, 2, 'rgba(255,240,200,0.25)'); ctx.restore(); }
      A.bush(ctx, 16, 462, 30, '#8a7a50', 3); A.bush(ctx, 944, 466, 28, '#7a6a44', 5);
      // Grabungsschnitt rechts am Mauerfuß: Schnüre, Pflöcke, Maßstab, Eimer
      A.rect(ctx, 838, 452, 92, 24, '#a08658'); A.rect(ctx, 842, 456, 84, 17, '#6e5438'); A.rect(ctx, 842, 456, 84, 4, '#5a4430');
      A.line(ctx, 836, 450, 932, 450, '#f0e8d0', 1); A.line(ctx, 836, 478, 932, 478, '#f0e8d0', 1); A.line(ctx, 884, 450, 884, 478, '#f0e8d0', 1);
      for (const px of [836, 884, 932]) { A.rect(ctx, px - 2, 444, 4, 8, '#6a5238'); A.rect(ctx, px - 2, 472, 4, 8, '#6a5238'); }
      for (let i = 0; i < 6; i++) A.rect(ctx, 846 + i * 10, 481, 10, 4, i % 2 ? '#ece4d4' : '#b8382e');
      A.ell(ctx, 926, 490, 12, 3, 'rgba(0,0,0,0.2)'); A.pot(ctx, 926, 489, 20, 18, '#7c7c78');
      A.line(ctx, 846, 478, 862, 460, '#4a4a48', 1.5); // Kelle
      A.rect(ctx, 858, 456, 8, 6, '#6a6a66');
      // Vermessungsstange vor der Mauer, mit Schatten nach rechts
      A.line(ctx, 302, 466, 340, 470, 'rgba(0,0,0,0.18)', 3); surveyPole(ctx, 300, 380, 460);
      // Korb und Spitzhacke am Fuß der Treppe, Skorpion im Sand
      A.ell(ctx, 680, 467, 18, 4, 'rgba(0,0,0,0.18)'); A.basket(ctx, 680, 466, 30, 22, '#b8955a');
      ctx.save(); ctx.translate(700, 470); ctx.rotate(1.35); pickaxe(ctx, 0, 0, 0); ctx.restore();
      scorpion(ctx, 258, 468);
      // Der Ziegelblock: vor dem Eingang oder weggezogen daneben
      if (!g.flag('block_weg')) {
        ctx.save(); ctx.translate(384, 372); ctx.rotate(-0.05);
        A.bricks(ctx, 0, 0, 96, 84, '#a8845a', 24, 12, 3, '#7a5a3a'); A.rect(ctx, 0, 0, 96, 6, '#c8a878'); ctx.restore();
        A.ell(ctx, 432, 458, 62, 8, 'rgba(0,0,0,0.25)');
        A.poly(ctx, [372, 462, 500, 462, 490, 446, 380, 446], '#e2cca4');
      } else {
        A.ell(ctx, 566, 476, 66, 9, 'rgba(0,0,0,0.25)');
        ctx.save(); ctx.translate(520, 402); ctx.rotate(0.18);
        A.bricks(ctx, 0, 0, 96, 72, '#a8845a', 24, 12, 3, '#7a5a3a'); A.rect(ctx, 0, 0, 96, 6, '#c8a878'); ctx.restore();
        for (let i = 0; i < 12; i++) A.rect(ctx, 400 + i * 14, 452 + (i % 3) * 4, 40, 3, 'rgba(120,90,50,0.3)');
      }
      A.vignette(ctx, 960, 600, 0.3);
      A.grain(ctx, 960, 600, 5, 0.035);
    },
    paintFront(ctx) {
      // Abgestürzter Ziegelbrocken links vorn
      A.ell(ctx, 26, 600, 66, 10, 'rgba(0,0,0,0.3)');
      ctx.save(); ctx.translate(24, 596); ctx.rotate(-0.22);
      A.bricks(ctx, -56, -30, 100, 56, '#a8845a', 22, 11, 8, '#7a5a3a'); A.rect(ctx, -56, -30, 100, 5, '#c8a878'); A.rect(ctx, 44, -30, 6, 56, 'rgba(0,0,0,0.25)');
      ctx.restore();
      // Theodolit auf dem Dreibein rechts vorn
      A.line(ctx, 934, 484, 900, 604, '#4a4038', 4); A.line(ctx, 934, 484, 960, 604, '#4a4038', 4); A.line(ctx, 934, 484, 942, 604, '#3a3028', 3);
      A.rect(ctx, 930, 478, 8, 12, '#3a3a3a');
      A.rr(ctx, 918, 462, 32, 18, 3, '#5a5a58'); A.rect(ctx, 910, 466, 48, 5, '#7a7a76'); A.circle(ctx, 934, 470, 6, '#3a3a3a'); A.circle(ctx, 934, 470, 2.5, '#9ab0c0');
    },
    animate(ctx, t) {
      A.dust(ctx, 0, 300, 960, 280, t, 18, 'rgba(120,100,60,0.22)');
      for (let i = 0; i < 4; i++) { const y = 226 + i * 6 + Math.sin(t * 1.9 + i) * 2; A.rect(ctx, 30, y, 900, 1, 'rgba(255,255,240,0.06)'); }
      // Ein Geier über der Zikkurat, Sand, der von der Terrassenkante und über den Boden weht
      vulture(ctx, t, 770, 120, 130, 24, 0.3, 1.1, 1);
      for (let i = 0; i < 6; i++) { const x = 60 + ((i * 151 + t * 60) % 880), y = 218 + Math.sin(t * 3 + i) * 3; A.rect(ctx, x, y, 3, 1, 'rgba(240,225,190,0.5)'); }
      windSand(ctx, t, 452, 120, 8);
    },
    hotspots: [
      { id: 'inschrift', name: 'Verwitterte Inschrift', rect: [198, 294, 94, 50], at: [245, 480, 'u'],
        look: 'Ein Feld im Mauerwerk mit einer Prozession: vier Männer, die etwas tragen. Darunter drei Zeilen, die der Wind in dreitausend Jahren fast weggeschliffen hat. Der Wind liest auch nicht.' },
      { id: 'eidechse', name: 'Eidechse', rect: [680, 372, 40, 20], at: [700, 480, 'u'],
        look: 'Eine Eidechse auf den heißen Ziegeln. Sie hält still, solange ich still halte. Sie hat mehr Geduld als ich.',
        take: 'Sie ist schneller. Deutlich.' },
      { id: 'skorpion', name: 'Skorpion', rect: [240, 456, 36, 20], at: [220, 490, 'r'],
        look: 'Ein Skorpion, gelb wie der Sand. Er hat den Schwanz gehoben, weil ich näher gekommen bin. Verstanden. Ich bleibe, wo ich bin.',
        take: 'Nein. Ich habe ihn gesehen, das reicht uns beiden.' },
      { id: 'stufen', name: 'Terrassen', rect: [30, 30, 900, 200], at: [480, 480, 'u'],
        look: async (g) => { await g.say('falk', 'Drei Terrassen aus Lehmziegeln, der Mantel aus gebrannten Ziegeln ist längst weggeholt, für Häuser in Basra. Oben stand einmal ein Tempel. Jetzt steht dort Wind.'); g.codex('zikkurat'); },
        use: 'Ich könnte hinaufsteigen. Aber das Siegel liegt unten, nicht oben.', take: 'Ziegel für Ziegel? Basra war schneller.' },
      { id: 'treppe', name: 'Große Treppe', rect: [552, 222, 100, 220], at: [602, 480, 'u'],
        look: 'Die Aufgangstreppe. Sie führt zur ersten Terrasse und dort zu nichts mehr; die oberen Stufen sind weggebrochen.',
        use: 'Oben ist nichts als Aussicht. Und die habe ich schon.' },
      { id: 'zylinder', name: 'Gründungszylinder', rect: [752, 348, 66, 54], at: [785, 480, 'u'],
        look: (g) => g.flag('zylinder_gelesen') ? 'Der Gründungszylinder. „Das Haus des Abzu in Eridu.“ Vier Jahrtausende alt, und man kann es lesen wie eine Hausnummer.' : 'Ein Tonzylinder in einer Nische im Mauerwerk, mit Keilschrift bedeckt. Ein Gründungszylinder: Der Bauherr ließ ihn einmauern, damit die Götter wissen, wer bezahlt hat.',
        use: readCylinder, open: 'Er ist massiv. Nichts zu öffnen.',
        take: 'Er sitzt seit viertausend Jahren in dieser Wand. Nabil würde mich mit dem Spaten erschlagen, und zu Recht.',
        useWith: { syllabar: readCylinder, schaufel: 'Ich kratze nicht an Fundstücken herum.', default: 'Damit lese ich nicht besser.' } },
      { id: 'block', name: 'Ziegelblock', rect: [376, 366, 112, 96], at: [432, 484, 'u'], cond: (g) => !g.flag('block_weg'),
        look: (g) => g.flag('seil_am_block') ? 'Der Block, mit meinem Seil darum. Der Knoten hält. Jetzt fehlt nur Zugkraft.' : 'Ein Block aus verbackenen Ziegeln, so groß wie ein Schrank. Er ist von der oberen Terrasse gestürzt und liegt genau im Eingang. Zwanzig Männer haben gezogen, sagt Nabil.',
        push: 'Ich stemme mich dagegen. Der Block überlegt es sich nicht einmal.',
        pull: 'Mit bloßen Händen? Nabils zwanzig Männer haben es nicht geschafft.',
        take: 'Zwei Tonnen Ziegel. Nein.', open: 'Das ist kein Schrank, das ist ein Block.',
        use: (g) => g.flag('seil_gespannt') ? 'Das Seil ist gespannt. Jetzt muss der Jeep ziehen, nicht ich.' : g.flag('seil_am_jeep') ? 'Das Seil hängt am Jeep. Das andere Ende gehört um diesen Block.' : g.flag('seil_am_block') ? 'Das eine Ende hängt am Block. Das andere gehört an etwas, das mehr zieht als ich.' : 'Von Hand geht hier nichts. Ich bräuchte etwas, das zieht, und etwas, das die Kraft überträgt.',
        useWith: {
          seil: async (g) => {
            if (g.flag('seil_am_block')) return 'Ein Ende ist schon um den Block. Das andere brauche ich für den Jeep.';
            await g.say('falk', 'Ich lege das Seil um den Block, zweimal, und mache einen Knoten, den mein Vater mir beigebracht hat.');
            g.set('seil_am_block'); g.repaint();
            if (g.flag('seil_am_jeep')) { g.drop('seil'); g.set('seil_am_jeep', false); g.set('seil_gespannt'); await g.say('falk', 'Block, Seil, Winde. Es ist knapp, aber es reicht. Jetzt fehlt nur noch der Motor.'); }
            else if (g.flag('jeep_an_zikkurat')) await g.say('falk', 'Das andere Ende behalte ich in der Hand. Es gehört an die Winde des Jeeps.');
            else await g.say('falk', 'Das andere Ende behalte ich in der Hand. Es fehlt noch etwas, das zieht.');
          },
          schaufel: 'Unter dem Block graben, bis er nachgibt? Auf mich zu? Nein.',
          kanister: 'Benzin an den Block? Ich will ihn wegziehen, nicht anzünden.',
          default: 'Das bewegt keinen Ziegelblock.',
        } },
      { id: 'block_weg', name: 'Ziegelblock', rect: [508, 392, 118, 90], at: [566, 500, 'u'], cond: (g) => g.flag('block_weg'),
        look: 'Der Block liegt jetzt neben dem Eingang, mit einer Schleifspur dahinter. Nabil wird seine Freude haben, und die Männer auch.',
        push: 'Er liegt gut. Da bleibt er.', take: 'Nein. Auch jetzt nicht.' },
      { id: 'jeep', name: 'Jeep', rect: [560, 490, 176, 64], at: [545, 556, 'r'], z: 549, cond: (g) => g.flag('jeep_an_zikkurat'),
        paint: (ctx, g) => {
          A.jeep(ctx, 560, 548, 170, '#6b6a3c'); A.rect(ctx, 566, 512, 30, 12, '#3a3a2a');
          if (g.flag('seil_gespannt') && !g.flag('block_weg')) A.rope(ctx, [566, 522, 520, 470, 478, 420], '#b89a68', 3);
          else if (g.flag('seil_am_block') && !g.flag('block_weg')) A.rope(ctx, [478, 420, 490, 440, 470, 452], '#b89a68', 3);
          else if (g.flag('seil_am_jeep')) A.rope(ctx, [566, 522, 540, 540, 528, 556], '#b89a68', 3);
        },
        look: (g) => g.flag('seil_gespannt') && !g.flag('block_weg') ? 'Der Jeep, das Seil an der Winde, straff bis zum Block. Jetzt kommt es auf den Motor an.' : g.flag('seil_am_jeep') ? 'Der Jeep, ein Seilende an der Winde. Das andere Ende hängt lose herunter. Es gehört an den Block.' : 'Der Jeep der Grabung, mit der Nase zum Eingang. Vorn am Kühler die Winde, mit einem Haken, an dem man etwas festmachen kann.',
        use: async (g) => {
          if (g.flag('block_weg')) return 'Der Block ist weg, der Jeep bleibt hier. Zurück ins Lager gehe ich zu Fuß, das ist schneller als dieser Anlasser.';
          if (g.flag('seil_am_jeep')) return 'Das Seil hängt an der Winde, aber nicht am Block. So ziehe ich nur Sand.';
          if (!g.flag('seil_am_block')) return 'Ich lasse den Motor an und lasse ihn wieder aus. Ohne Seil zwischen Jeep und Block ziehe ich nur Sand.';
          if (!g.flag('seil_gespannt')) return 'Das Seil hängt am Block, aber nicht am Jeep. So zieht niemand.';
          await g.scene(async () => {
            await g.walk('falk', 545, 556, 'r');
            g.fx('door');
            await g.say('falk', 'Ersten Gang, Kupplung langsam kommen lassen. Das Seil wird straff.');
            g.fx('stone');
            await g.message('Die Räder wühlen im Sand. Das Seil singt. Dann kippt der Block, rutscht, kippt noch einmal, und liegt neben dem Eingang.', 3200);
            g.set('block_weg'); g.set('seil_gespannt', false); g.set('seil_am_block', false);
            g.unblockWalk('block'); g.blockWalk('block2', BLOCK_POLY2);
            g.repaint();
            await g.say('falk', 'Der Eingang ist frei. Ein Loch in der Mauer, schwarz wie ein Brunnen.');
            g.take('seil');
            await g.say('falk', 'Das Seil nehme ich wieder mit. Man weiß nie.');
            g.objective('Das Haus der Tafeln unter der Zikkurat erkunden.');
          });
        },
        push: 'Der Jeep schiebt niemanden. Er zieht.', pull: 'Er soll ziehen, nicht ich.',
        open: 'Die Motorhaube. Der Motor ist heiß und ganz. Mehr will ich nicht wissen.',
        take: 'Er gehört der Grabung. Und er läuft nur, wenn er will.',
        useWith: {
          seil: async (g) => {
            if (g.flag('block_weg')) return 'Der Block ist weg. Das Seil bleibt bei mir.';
            if (g.flag('seil_gespannt') || g.flag('seil_am_jeep')) return 'Das Seil hängt schon an der Winde.';
            await g.say('falk', 'Ich hake das Seil an die Winde. Es hält.');
            if (g.flag('seil_am_block')) { g.drop('seil'); g.set('seil_gespannt'); g.repaint(); await g.say('falk', 'Jeep, Seil, Block. Jetzt fehlt nur noch der Motor.'); }
            else { g.set('seil_am_jeep'); g.repaint(); await g.say('falk', 'Das andere Ende behalte ich in der Hand. Es gehört um den Block.'); }
          },
          kanister: 'Er hat Benzin. Zwanzig Liter, abzüglich meiner Schuhe.',
          default: 'Das hilft dem Jeep nicht.',
        } },
      { id: 'sand', name: 'Sandverwehung', rect: [0, 440, 240, 30], at: [140, 490, 'u'],
        look: 'Sand, den der Wind gegen die Mauer treibt. In hundert Jahren ist die Zikkurat wieder ein Hügel.',
        take: 'Ich habe genug davon in den Schuhen.',
        useWith: { schaufel: 'Ich könnte eine Woche schaufeln, und der Wind hätte mehr Zeit als ich.', default: 'Das ist Sand. Er tut nichts.' } },
    ],
    exits: [
      { id: 'lager', name: 'Weg zum Lager', rect: [0, 330, 60, 250], at: [40, 545, 'l'], to: 'me_camp', pos: [900, 520], dir: 'l',
        look: 'Der Weg zurück zum Lager, über die Abraumhalden.' },
      { id: 'eingang', name: (g) => g.flag('block_weg') ? 'Eingang' : 'Verschütteter Eingang', rect: [398, 326, 80, 116], at: [436, 484, 'u'], to: 'me_archive', pos: [110, 500], dir: 'r',
        look: (g) => g.flag('block_weg') ? 'Ein niedriger Bogen aus Ziegeln und dahinter Stufen, die nach unten führen. Aus dem Loch kommt kühle Luft. Das erste Mal seit Basra, dass ich friere.' : 'Man sieht den Bogen über dem Block. Ein Eingang, und ein Ziegelblock, der etwas dagegen hat.',
        before: async (g) => { if (g.flag('block_weg')) return true; await g.say('falk', 'Der Block liegt davor. Da passt keine Katze durch, und ich bin keine Katze.'); return false; },
        open: (g) => g.flag('block_weg') ? g.travel(g.hs('eingang')) : 'Erst muss der Block weg.' },
    ],
    async enter(g) {
      if (!g.flag('block_weg')) g.blockWalk('block', BLOCK_POLY); else g.blockWalk('block2', BLOCK_POLY2);
      if (g.flag('jeep_an_zikkurat')) g.blockWalk('jeep', JEEP_POLY_Z);
      if (!g.flag('zikkurat_besucht')) {
        g.set('zikkurat_besucht');
        await g.say('falk', 'Von Nahem ist sie größer. Und der Block vor dem Eingang ist auch größer, als Nabil gesagt hat.');
      }
    },
  });

  // ---------------------------------------------------------------- Haus der Tafeln
  async function readFloodTablet(g) {
    if (g.flag('fluttafel_gelesen')) return 'Die Fluttafel. Ich habe abgeschrieben, was ich lesen konnte. Die Abschrift ist in meiner Tasche.';
    if (!g.has('syllabar')) return 'Dichte Zeilen, Keil an Keil. Ich erkenne, dass es Zeilen sind. Mehr nicht. Ohne Silbenliste lese ich hier nichts.';
    await g.say('falk', 'Die Tafel ist lang. Aber die erste Zeile ist groß geschrieben, fünf Zeichen, wie eine Überschrift. Ich fange dort an.');
    const r = await g.puzzle('cuneiform', { title: 'Die Fluttafel', text: 'Die Überschrift der Tafel. Zeichen anklicken, dann die Silbe aus Toms Liste wählen. Am Ende „Lesen“.', signs: FLUTTAFEL, choices: CHOICES, tableGlyphs: SYL });
    if (r === true) {
      g.set('fluttafel_gelesen'); g.fx('success');
      await g.say('falk', 'En, ki: Enki. Dann A, das Wasser. Dann ab, zu: Abzu. „Enki, das Wasser, der Abzu.“ Die Zeile über den Herrn des süßen Wassers.');
      await g.say('falk', 'Den Rest gehe ich Zeichen für Zeichen mit der Liste durch. Es dauert, und es lohnt sich.');
      g.take('tafeltext');
      await g.say('falk', '„Sieben Weise wachen an der Tür. Der vierte hält den Schlüssel.“ Sieben Weise. Ich habe sieben Männer auf einer Bronzetür gesehen.');
      g.codex('gilgamesch');
      g.objective('Die Tür der sieben Weisen öffnen. Der vierte hält den Schlüssel.');
    } else if (r === 'wrong') await g.say('falk', 'Das ergibt keinen Namen, den ich kenne. Ich fange noch einmal an.');
    else await g.say('falk', 'Ich lege sie zurück. Gleich noch einmal, mit mehr Licht.');
  }

  // Ein Apkallu-Relief auf der Bronzetür: Mann im Fischgewand, Eimer und Zapfen in den Händen
  function apkalluRelief(ctx, x, y, h, color, lit) {
    const w = h * 0.42;
    ctx.fillStyle = color;
    A.rr(ctx, x - w * 0.35, y - h * 0.62, w * 0.7, h * 0.6, 4, color);                     // Gewand
    A.poly(ctx, [x - w * 0.5, y - h * 0.62, x + w * 0.5, y - h * 0.62, x + w * 0.42, y - h * 0.28, x - w * 0.42, y - h * 0.28], A.shade(color, -0.12)); // Fischmantel
    for (let i = 0; i < 4; i++) A.line(ctx, x - w * 0.42, y - h * 0.58 + i * h * 0.08, x + w * 0.42, y - h * 0.55 + i * h * 0.08, A.shade(color, 0.18), 1);
    A.circle(ctx, x, y - h * 0.72, w * 0.22, A.shade(color, 0.12));                        // Kopf
    A.poly(ctx, [x - w * 0.16, y - h * 0.66, x + w * 0.16, y - h * 0.66, x, y - h * 0.52], A.shade(color, -0.2)); // Bart
    A.circle(ctx, x - w * 0.07, y - h * 0.74, w * 0.03, '#1a130c'); A.circle(ctx, x + w * 0.07, y - h * 0.74, w * 0.03, '#1a130c');
    A.poly(ctx, [x - w * 0.34, y - h * 0.7, x, y - h * 0.98, x + w * 0.34, y - h * 0.7, x + w * 0.2, y - h * 0.6, x - w * 0.2, y - h * 0.6], A.shade(color, -0.05)); // Fischkopf als Kapuze
    A.circle(ctx, x + w * 0.1, y - h * 0.86, w * 0.05, '#1a130c');
    A.poly(ctx, [x - w * 0.5, y - h * 0.2, x - w * 0.62, y, x - w * 0.3, y - h * 0.08], A.shade(color, -0.05)); // Schwanzflosse
    A.rr(ctx, x - w * 0.6, y - h * 0.34, w * 0.2, h * 0.14, 2, A.shade(color, 0.2));        // Eimer
    A.poly(ctx, [x + w * 0.4, y - h * 0.5, x + w * 0.6, y - h * 0.5, x + w * 0.5, y - h * 0.62], A.shade(color, 0.2)); // Zapfen
    if (lit) A.glow(ctx, x, y - h * 0.5, h * 0.7, 'rgba(255,220,150,0.7)', 0.35);
  }
  const RELIEF_X = (i) => 676 + i * 32;
  const RELIEF_LOOK = [
    'Der erste. Ein Mann im Fischgewand, mit einem Eimer in der Hand. Er sieht aus, als wäre er zu früh gekommen.',
    'Der zweite. Gleiche Flosse, gleicher Eimer. Die Handwerker hatten eine Schablone.',
    'Der dritte. Ihm fehlt die Nase; jemand hat vor langer Zeit daran gekratzt.',
    'Der vierte. In der Mitte der Reihe. Sein Zapfen ist erhoben, als wollte er etwas zeigen. Oder als hätte er etwas zu verbergen.',
    'Der fünfte. Der Fischkopf ist schöner gearbeitet als bei den anderen. Ein anderer Meißel.',
    'Der sechste. Er schaut nach links, zu seinen Brüdern.',
    'Der siebte. Der letzte vor der Flut, wenn man Berossos glaubt. Er hat den Eimer sinken lassen.',
  ];
  const RELIEF_PUSH = [
    'Ich drücke gegen den ersten. Bronze, kalt, unbeweglich. Er hat nichts für mich.',
    'Der zweite gibt nicht nach. Er hat einen Eimer und keine Zeit.',
    'Der dritte rührt sich nicht. Vielleicht ist er beleidigt wegen der Nase.',
    null,
    'Der fünfte bleibt, wo er ist. Schön gearbeitet, aber nutzlos.',
    'Der sechste schaut weiter nach links. Er ist nicht zuständig.',
    'Der siebte ist der letzte, aber nicht der Schlüssel. Er hat den Eimer nicht umsonst abgestellt.',
  ];
  const reliefHotspots = RELIEF_LOOK.map((txt, i) => ({
    id: 'relief' + (i + 1), name: ['Erster', 'Zweiter', 'Dritter', 'Vierter', 'Fünfter', 'Sechster', 'Siebter'][i] + ' Weiser', rect: [RELIEF_X(i) - 15, 212, 30, 84], at: [RELIEF_X(i), 484, 'u'], cond: (g) => !g.flag('weisen_tuer_offen'),
    look: txt,
    push: async (g) => {
      if (i === 3) {
        await g.say('falk', 'Ich drücke gegen den vierten. Er gibt nach, einen Finger breit, und bleibt dort.');
        g.fx('stone'); g.set('weisen_tuer_offen'); g.repaint();
        await g.message('Irgendwo in der Wand fällt ein Gewicht. Die Tür schwingt nach innen, langsam, und lässt kalte Luft herein.', 3000);
        await g.say('falk', 'Stufen. Und das Geräusch von Wasser.');
        g.objective('In den Abzu hinabsteigen und das Siegel der Flut finden.');
        return;
      }
      await g.say('falk', RELIEF_PUSH[i]);
      if (g.flag('fluttafel_gelesen') && !g.flag('relief_hinweis')) { g.set('relief_hinweis'); await g.say('falk', '„Der vierte hält den Schlüssel“, sagt die Tafel. Ich sollte zählen können.'); }
    },
    use: (g) => g.hs('relief' + (i + 1)).push(g), pull: 'Ziehen kann man an einem Relief nicht. Drücken vielleicht.',
    take: 'Er ist Teil der Tür. Und die Tür ist Teil der Wand.',
  }));

  R({
    id: 'me_archive', name: 'Haus der Tafeln', ambient: 'mesopotamia',
    start: [110, 500, 'r'],
    walk: [[30, 470, 930, 470, 930, 585, 30, 585]],
    scale: { y0: 470, s0: 0.82, y1: 585, s1: 1.05 },
    paint(ctx, g) {
      A.rect(ctx, 0, 0, 960, 600, '#140e08');
      A.bricks(ctx, 0, 60, 960, 380, '#6a5238', 44, 16, 5, '#3a2a1a');
      // Gewölbe aus Ziegeln oben
      ctx.fillStyle = A.grad(ctx, 0, 0, 0, 120, ['#1a120a', 'rgba(26,18,10,0)']); ctx.fillRect(0, 0, 960, 120);
      for (let i = 0; i < 6; i++) A.line(ctx, 0, 62 + i * 3, 960, 62 + i * 3, 'rgba(0,0,0,0.25)', 1);
      // Reliefband über den Regalen: sieben Apkallu im Wechsel mit Palmetten, die Farbe längst verblasst
      A.rect(ctx, 0, 82, 960, 52, 'rgba(0,0,0,0.2)'); A.rect(ctx, 0, 82, 960, 2, 'rgba(200,170,120,0.22)'); A.rect(ctx, 0, 132, 960, 2, 'rgba(200,170,120,0.22)');
      for (let x = 40; x < 960; x += 68) {
        apkalluRelief(ctx, x, 130, 44, '#7a6248', false);
        A.line(ctx, x + 34, 128, x + 34, 100, '#6e5840', 2); for (let k = -1; k <= 1; k++) A.line(ctx, x + 34, 104, x + 34 + k * 8, 92, '#6e5840', 1.5);
      }
      A.rect(ctx, 0, 82, 960, 52, 'rgba(20,14,8,0.25)');
      // Risse im Mauerwerk und die eingestürzte Ecke hinten rechts
      A.cracks(ctx, 300, 140, 120, 90, 3, 'rgba(0,0,0,0.45)'); A.cracks(ctx, 904, 110, 56, 190, 12, 'rgba(0,0,0,0.5)');
      A.poly(ctx, [908, 320, 930, 296, 960, 286, 960, 440, 900, 440, 890, 392, 902, 352], '#0b0704');
      const rbr = ATL.U.rng(66);
      for (let i = 0; i < 14; i++) { const k = i / 14; const ex = 908 + (960 - 908) * Math.max(0, k - 0.3) * 1.4 - 12 + rbr() * 10, ey = 320 - k * 34 + (i % 3) * 30; A.rect(ctx, ex, ey + rbr() * 40, 16 + rbr() * 12, 7, rbr() < 0.5 ? '#5a4632' : '#7a5a3a'); }
      for (let i = 0; i < 6; i++) A.rect(ctx, 892 + rbr() * 10, 350 + i * 15, 12 + rbr() * 10, 6, '#4a3a28');
      // Boden: gestampfter Lehm
      A.floorTiles(ctx, 960, 440, 600, '#5a4632', '#2a2016', 8, 480);
      A.rect(ctx, 0, 440, 960, 6, 'rgba(0,0,0,0.35)');
      // Staub, der sich an den Wänden sammelt; Geröll und Ziegel aus der eingestürzten Ecke
      A.rect(ctx, 0, 446, 960, 26, 'rgba(200,170,120,0.05)');
      A.poly(ctx, [900, 440, 960, 400, 960, 474, 860, 474], 'rgba(120,95,60,0.16)');
      A.rubble(ctx, 884, 414, 76, 48, 21, '#6a5238');
      for (const [bx, by, a] of [[858, 456, 0.3], [876, 466, -0.2], [904, 470, 0.6], [930, 462, -0.5]]) { ctx.save(); ctx.translate(bx, by); ctx.rotate(a); A.rect(ctx, -9, -4, 18, 8, '#6a5238'); A.rect(ctx, -9, -4, 18, 2, 'rgba(255,240,200,0.12)'); ctx.restore(); }
      // Treppe hinauf zum Eingang, Licht von oben
      A.rect(ctx, 30, 110, 140, 330, '#2a2016');
      A.stairs(ctx, 40, 440, 130, 9, 26, '#8a7050');
      A.rect(ctx, 40, 110, 80, 110, '#e8d8b0'); A.rect(ctx, 40, 110, 80, 110, 'rgba(255,240,200,0.5)');
      A.lightBeam(ctx, 60, 200, 220, 330, 'rgba(255,230,180,0.2)');
      // Ton-Regale mit Tafeln, links und rechts der Statue
      const shelf = (x, w, rows, seed) => {
        A.rect(ctx, x, 150, w, 290, '#5a4632');
        const r = ATL.U.rng(seed);
        for (let i = 0; i < rows; i++) {
          const y = 158 + i * (282 / rows);
          A.rect(ctx, x + 4, y, w - 8, 282 / rows - 6, '#2a1c10');
          let cx = x + 8;
          while (cx < x + w - 26) { const tw = 18 + r() * 10, th = 14 + r() * 8; A.rr(ctx, cx, y + 282 / rows - 8 - th, tw, th, 2, A.shade('#b89468', (r() - 0.5) * 0.3)); A.cuneiform(ctx, cx + 2, y + 282 / rows - 6 - th, tw - 4, th - 4, 'rgba(60,35,15,0.7)', Math.floor(r() * 100)); cx += tw + 3; }
          A.rect(ctx, x, y + 282 / rows - 6, w, 4, '#7a5a3a');
        }
      };
      shelf(190, 180, 5, 11); shelf(560, 90, 5, 13);
      // Staub auf den Regalkanten, Spinnweben in den Ecken
      A.rect(ctx, 190, 150, 180, 1, 'rgba(255,240,200,0.18)'); A.rect(ctx, 560, 150, 90, 1, 'rgba(255,240,200,0.18)');
      A.cobweb(ctx, 190, 150, 20, 'tl', 'rgba(255,255,255,0.16)'); A.cobweb(ctx, 370, 150, 26, 'tr', 'rgba(255,255,255,0.18)');
      A.cobweb(ctx, 656, 140, 26, 'tl', 'rgba(255,255,255,0.16)'); A.cobweb(ctx, 904, 140, 30, 'tr', 'rgba(255,255,255,0.18)');
      // Durchgang zwischen Regal und Statue: dahinter weitere Regalreihen, klein und blass, ins Dunkel
      A.arch(ctx, 380, 214, 36, 226, '#4a3a28', '#0a0704');
      for (let i = 0; i < 4; i++) { const y = 300 + i * 32; A.rect(ctx, 386, y, 24, 3, 'rgba(140,110,70,0.28)'); for (let k = 0; k < 4; k++) A.rect(ctx, 387 + k * 6, y - 6, 4, 5, 'rgba(184,148,104,0.22)'); }
      ctx.fillStyle = A.grad(ctx, 0, 240, 0, 440, ['rgba(10,7,4,0.9)', 'rgba(10,7,4,0)']); ctx.fillRect(384, 240, 28, 200);
      // Leiter aus Palmholz, an das schmale Regal gelehnt
      ctx.save(); ctx.translate(556, 470); ctx.rotate(0.07); A.ladder(ctx, -28, -300, 300, '#7a5a3a', 22); ctx.restore();
      // Tonöllampen auf den Regalkanten, mit Rußfahnen darüber
      clayLamp(ctx, 230, 150, true); clayLamp(ctx, 336, 150, true); clayLamp(ctx, 606, 150, true);
      // Tonkörbe mit Tafeln vor den Regalen, ein Stapel und ein paar gefallene Tafeln
      A.ell(ctx, 206, 471, 20, 4, 'rgba(0,0,0,0.3)'); A.basket(ctx, 206, 470, 36, 28, '#a08050');
      for (let i = 0; i < 3; i++) A.rr(ctx, 195 + i * 8, 432 + (i % 2) * 2, 7, 12, 1, A.shade('#b89468', -0.1 * i));
      A.ell(ctx, 584, 471, 17, 4, 'rgba(0,0,0,0.3)'); A.basket(ctx, 584, 470, 30, 24, '#a08050');
      for (let i = 0; i < 3; i++) A.rr(ctx, 575 + i * 7, 438 + (i % 2) * 2, 6, 10, 1, A.shade('#b08a5a', -0.1 * i));
      for (const [tx, ty, tw] of [[448, 452, 22], [474, 458, 18], [500, 450, 24], [530, 460, 16]]) { A.rr(ctx, tx, ty, tw, 8, 1, '#a08658'); A.cuneiform(ctx, tx + 2, ty + 1, tw - 4, 6, 'rgba(60,35,15,0.6)', tx); }
      A.poly(ctx, [520, 462, 528, 456, 532, 464], '#8a7050');
      // Schreibermatte aus Schilf mit Rollsiegeln, Griffeln und einem Tonumschlag
      A.rect(ctx, 172, 458, 64, 26, '#7a6a48'); for (let i = 0; i < 6; i++) A.line(ctx, 172, 462 + i * 4, 236, 462 + i * 4, 'rgba(0,0,0,0.2)', 1);
      A.rr(ctx, 178, 466, 12, 5, 2, '#3a4a5a'); A.rr(ctx, 178, 474, 12, 5, 2, '#5a3a2a');
      for (let i = 0; i < 3; i++) A.line(ctx, 196 + i * 4, 462, 212 + i * 4, 480, '#c8b070', 1.5);
      A.rr(ctx, 214, 466, 18, 13, 3, '#a88a60'); for (let i = 0; i < 6; i++) A.circle(ctx, 217 + (i % 3) * 5, 470 + Math.floor(i / 3) * 5, 1, 'rgba(60,35,15,0.6)');
      // Apkallu-Statue im Fischgewand auf einem Sockel
      A.rect(ctx, 425, 400, 90, 40, '#5a5248'); A.rect(ctx, 420, 396, 100, 8, '#6a6258');
      A.cuneiform(ctx, 432, 408, 76, 26, 'rgba(0,0,0,0.5)', 17);
      apkalluRelief(ctx, 470, 400, 260, '#7a6a58', false);
      // Bronzetür mit sieben Weisen
      A.rect(ctx, 656, 140, 248, 300, '#2a1c10');
      if (!g.flag('weisen_tuer_offen')) {
        A.rect(ctx, 664, 148, 232, 292, A.grad(ctx, 664, 0, 896, 0, ['#6a4a2a', '#a07a3a', '#7a5a2a']));
        A.rect(ctx, 664, 148, 232, 40, '#5a3e22'); A.rect(ctx, 664, 300, 232, 140, '#5a3e22');
        A.cuneiform(ctx, 672, 156, 216, 26, 'rgba(255,220,150,0.35)', 23);
        for (let i = 0; i < 7; i++) apkalluRelief(ctx, RELIEF_X(i), 296, 84, '#b08a4a', false);
        for (let i = 0; i < 12; i++) A.circle(ctx, 672 + i * 20, 430, 3, '#4a3218');
      } else {
        A.rect(ctx, 664, 148, 232, 292, '#05070a');
        A.poly(ctx, [664, 148, 700, 160, 700, 432, 664, 440], '#8a6a3a');
        for (let i = 0; i < 6; i++) A.rect(ctx, 720, 300 + i * 22, 160, 6, A.shade('#3a4048', i * 0.04));
        A.glow(ctx, 780, 260, 120, 'rgba(120,180,220,0.5)', 0.3);
      }
      // Tisch mit der Fluttafel vorn links, Scherben am Boden rechts
      A.table(ctx, 240, 445, 110, 10, '#6a5238', 34);
      A.rr(ctx, 260, 420, 70, 28, 3, '#b89468'); A.cuneiform(ctx, 264, 424, 62, 20, '#4a2e18', 31);
      A.rect(ctx, 296, 420, 34, 4, '#d0b080');
      for (let i = 0; i < 9; i++) A.poly(ctx, [600 + i * 14, 470 + (i % 3) * 6, 612 + i * 14, 466 + (i % 3) * 6, 616 + i * 14, 476 + (i % 3) * 6], '#8a7050');
      A.vignette(ctx, 960, 600, 0.6);
      A.grain(ctx, 960, 600, 6, 0.05);
    },
    paintFront(ctx) {
      // Gewölbekante ganz vorn
      A.bricks(ctx, 0, 0, 960, 36, '#3a2a1a', 46, 18, 15, '#160e06');
      ctx.fillStyle = A.grad(ctx, 0, 36, 0, 62, ['rgba(0,0,0,0.55)', 'rgba(0,0,0,0)']); ctx.fillRect(0, 36, 960, 26);
      // Vorratskrug links vorn, Tafelscherben rechts vorn
      A.ell(ctx, 10, 606, 44, 8, 'rgba(0,0,0,0.5)'); A.pot(ctx, 8, 608, 66, 74, '#6a5238');
      A.line(ctx, 22, 546, 18, 596, 'rgba(255,230,180,0.12)', 3);
      const r = ATL.U.rng(44);
      for (let i = 0; i < 6; i++) A.rr(ctx, 898 + r() * 50, 566 + r() * 28, 14 + r() * 16, 8 + r() * 6, 2, A.shade('#7a6248', (r() - 0.5) * 0.3));
    },
    animate(ctx, t, g) {
      A.dust(ctx, 50, 150, 220, 300, t, 30);
      // Staub, der aus der eingestürzten Ecke rieselt; Wasserlicht aus der offenen Tür
      A.dust(ctx, 880, 300, 80, 150, t, 6, 'rgba(200,170,120,0.22)');
      if (g.flag('weisen_tuer_offen')) A.glow(ctx, 780, 280, 110 + Math.sin(t * 1.3) * 10, 'rgba(120,180,220,0.6)', 0.14 + Math.sin(t * 2.1) * 0.05);
    },
    hotspots: [
      { id: 'fries', name: 'Reliefband', rect: [190, 80, 460, 54], at: [420, 485, 'u'],
        look: 'Ein Fries über den Regalen: Männer im Fischgewand, dazwischen Palmen, immer im Wechsel, bis in die Ecke. Die Farbe ist weg, die Form ist geblieben. Das ist bei den meisten Dingen umgekehrt.' },
      { id: 'einsturz', name: 'Eingestürzte Ecke', rect: [904, 290, 56, 180], at: [880, 500, 'r'],
        look: 'Die Ecke ist eingestürzt, irgendwann in den letzten dreitausend Jahren. Ziegel, Lehm, Staub. Was dahinter liegt, bleibt dahinter. Ich grabe nicht mit den Händen in einer Decke, die es sich schon einmal anders überlegt hat.' },
      { id: 'matte', name: 'Schreibermatte', rect: [172, 454, 66, 32], at: [204, 500, 'u'],
        look: 'Eine Schilfmatte, darauf zwei Rollsiegel, drei Griffel aus Rohr und ein Tonumschlag mit Siegelabdrücken. Jemand hat hier gearbeitet und ist aufgestanden, um kurz etwas zu holen.',
        take: 'Bagdad bekommt es. Ich habe es Nabil versprochen, und ich habe schon eine Figur an die falschen Leute verloren.' },
      { id: 'regal_l', name: 'Tafelregal', rect: [190, 150, 180, 290], at: [280, 485, 'u'],
        look: 'Regale aus Lehm, Fach über Fach, und darin Tontafeln, hochkant wie Bücher. Hunderte. Lieferlisten, Verträge, Hymnen. Das Archiv eines Tempels.',
        take: 'Ich ziehe eine heraus. Sie bricht in drei Teile, bevor ich sie richtig halte. Ich lege sie zurück und fasse nichts mehr an.',
        use: (g) => g.has('syllabar') ? 'Gerste, Öl, Schafe. Mit Toms Liste komme ich bis „Schafe“. Die Tafel, die ich suche, liegt nicht hier drin, sondern vorn auf dem Tisch.' : 'Ohne Silbenliste sind das Muster. Sehr viele Muster.',
        open: 'Es sind offene Fächer.' },
      { id: 'regal_r', name: 'Tafelregal', rect: [560, 150, 90, 290], at: [605, 485, 'u'],
        look: 'Ein schmaleres Regal. Die Tafeln hier sind kleiner, und viele sind zerbrochen. Vielleicht die Rechnungen.',
        take: 'Nein. Ich habe gesehen, was passiert.' },
      { id: 'statue', name: 'Apkallu-Statue', rect: [420, 140, 100, 300], at: [470, 485, 'u'],
        look: async (g) => { await g.say('falk', 'Ein Mann im Fischgewand, mannshoch. Der Fischkopf als Kapuze, die Flosse am Rücken. In der einen Hand ein Eimer, in der anderen ein Zapfen.'); await g.say('falk', 'Meine Figur vom Dachboden, nur zwanzigmal so groß. Einer der sieben Weisen, die vor der Flut aus dem Meer kamen.'); g.codex('apkallu'); },
        use: 'Ich klopfe an. Massiv. Er antwortet nicht.', push: 'Er steht seit viertausend Jahren. Ich bin nicht der Erste, der schiebt.', take: 'Der hier passt in keine Kiste.', talk: 'Er hat den Menschen die Schrift gebracht, heißt es. Zum Reden war er nicht da.',
        open: 'Er ist aus Stein. Nichts zu öffnen.' },
      { id: 'sockel', name: 'Sockel', rect: [420, 396, 100, 44], at: [470, 485, 'u'],
        look: 'Auf dem Sockel eine Inschrift. Ich erkenne das Ortszeichen und den Namen Eridu. Der Rest ist verwittert.', take: 'Er trägt die Statue. Das soll er weiter tun.' },
      { id: 'fluttafel', name: 'Tontafel', rect: [256, 416, 80, 34], at: [296, 490, 'u'], walkToLook: true,
        look: (g) => g.flag('fluttafel_gelesen') ? 'Die Fluttafel. Sie liegt, als hätte sie jemand gestern zum Lesen hingelegt. Vielleicht hat das jemand, vor viertausend Jahren.' : 'Eine große Tafel auf dem Tisch, allein, als wäre sie wichtiger als die anderen. Dichte Zeilen, und am Rand das Zeichen für Wasser, immer wieder.',
        use: readFloodTablet, open: 'Eine Tafel öffnet man nicht. Man liest sie.',
        take: 'Sie ist so groß wie ein Buch und so spröde wie Knäckebrot. Sie bleibt hier, und Bagdad bekommt sie.',
        useWith: { syllabar: readFloodTablet, tafeltext: 'Meine Abschrift stimmt. Ich habe verglichen.', kohle: 'Ich habe kein Papier mehr. Und die Tafel ist zu grob für einen Abrieb.', papier: 'Zu grob für einen Abrieb. Ich schreibe ab.', default: 'Das hilft beim Lesen nicht.' } },
      { id: 'tisch', name: 'Tisch', rect: [238, 445, 114, 40], at: [296, 490, 'u'], look: 'Ein Tisch aus Lehmziegeln. Hier hat einmal ein Schreiber gesessen. Lange.', use: 'Ich brauche keinen Tisch. Ich brauche die Tafel darauf.' },
      { id: 'scherben', name: 'Scherben', rect: [596, 462, 140, 30], at: [660, 510, 'u'], look: 'Scherben von Tafeln, die vor Jahrtausenden zerbrochen sind. Der Staub darauf ist so alt wie sie.', take: 'Scherben habe ich in Vermont genug.' },
      { id: 'tuer_zu', name: 'Bronzetür', rect: [660, 140, 240, 300], at: [780, 484, 'u'], cond: (g) => !g.flag('weisen_tuer_offen'),
        look: 'Eine Tür aus Bronze, grün angelaufen. Kein Griff, kein Schloss. Sieben Männer im Fischgewand, im Relief, in einer Reihe. Darüber eine Zeile Keilschrift.',
        open: 'Kein Griff. Ich lege die Hand auf die Bronze: kalt, und sie rührt sich nicht.', push: 'Ich drücke gegen die Tür. Nichts. Vielleicht muss man an der richtigen Stelle drücken.', pull: 'Es gibt nichts, woran man ziehen könnte.',
        use: (g) => g.has('syllabar') ? 'Die Zeile über den Reliefs: „Sieben“ kann ich lesen, und das Zeichen für Herr. Der Rest fehlt auf Toms Liste.' : 'Die Zeile über den Reliefs kann ich nicht lesen.',
        useWith: { seil: 'Nichts, woran ich es befestigen könnte. Die Tür ist glatt bis auf die Reliefs.', schaufel: 'Bronze gegen Blech. Die Tür gewinnt.', taschenmesser: 'Ich kratze ein bisschen Grünspan ab. Darunter ist Bronze. Überraschung.', default: 'Das öffnet keine Tür.' } },
      ...reliefHotspots,
    ],
    exits: [
      { id: 'ausgang', name: 'Treppe nach oben', rect: [30, 110, 140, 330], at: [100, 484, 'l'], to: 'me_ziggurat', pos: [436, 486], dir: 'd', look: 'Die Treppe hinauf zum Eingang. Oben ist es hell und heiß.' },
      { id: 'tuer', name: 'Tür der sieben Weisen', rect: [660, 140, 240, 300], at: [780, 484, 'u'], cond: (g) => g.flag('weisen_tuer_offen'), to: 'me_abzu', pos: [90, 545], dir: 'r',
        look: 'Die Tür steht offen. Stufen führen hinab, und von unten kommt Wasserlicht.', open: (g) => g.travel(g.hs('tuer')), close: 'Sie ist schwer und steht gut. Ich lasse sie offen. Man weiß nie, ob sie ein zweites Mal aufgeht.' },
    ],
    async enter(g) {
      if (!g.flag('archiv_besucht')) {
        g.set('archiv_besucht');
        await g.say('falk', 'Kühl. Dunkel. Und Regale, so weit das Licht reicht. Das ist kein Grab. Das ist eine Bibliothek.');
      }
    },
  });

  // ---------------------------------------------------------------- Der Abzu
  const WATER_Y = (g) => g.flag('wasser_hoch') ? 318 : 432;
  const BOAT = (g) => g.flag('wasser_hoch') ? [380, 326] : [420, 440];
  function reedBoat(ctx, x, y, w, color) {
    color = color || '#b8a060';
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.moveTo(x - w * 0.5, y - w * 0.16); ctx.quadraticCurveTo(x - w * 0.45, y + w * 0.14, x, y + w * 0.16); ctx.quadraticCurveTo(x + w * 0.45, y + w * 0.14, x + w * 0.5, y - w * 0.16); ctx.quadraticCurveTo(x + w * 0.2, y, x, y); ctx.quadraticCurveTo(x - w * 0.2, y, x - w * 0.5, y - w * 0.16); ctx.closePath(); ctx.fill();
    for (let i = 0; i < 6; i++) A.line(ctx, x - w * 0.42 + i * w * 0.15, y + w * 0.02 + Math.abs(i - 2.5) * 2, x - w * 0.36 + i * w * 0.15, y + w * 0.14 - Math.abs(i - 2.5) * 1.5, A.shade(color, -0.3), 1.5);
    A.line(ctx, x - w * 0.5, y - w * 0.16, x + w * 0.5, y - w * 0.16, A.shade(color, 0.2), 2);
    A.line(ctx, x + w * 0.1, y - w * 0.4, x + w * 0.25, y + w * 0.1, '#6a5a3a', 3);
  }
  async function getSeal(g) {
    if (g.flag('flutsiegel_genommen')) return 'Die Nische ist leer. Ich habe, was ich holen wollte.';
    await g.scene(async () => {
      await g.walk('falk', 660, 548, 'l');
      await g.say('falk', 'Ich steige ins Boot. Es schwankt, hält aber. Schilf, von Leuten gebunden, die es konnten.');
      await g.message('Falk stakt mit dem Ruder über das Becken, bis der Bug an die Wand unter der Nische stößt.', 2800);
      const [bx, by] = BOAT(g);
      g.hero.setPos(bx + 6, by + 8, 'u'); g.hero.fixedScale = 0.7; g.hero.scale = 0.7;
      g.hero.anim = 'reach';
      await g.wait(800);
      g.fx('pickup');
      g.take('flutsiegel'); g.set('flutsiegel_genommen'); g.repaint();
      g.hero.anim = 'stand';
      await g.say('falk', 'Ein blauer Stein, glatt und schwer, mit drei Wellen. Das Siegel der Flut.');
      await g.say('falk', 'Auf der Rückseite acht Kerben. Wie beim Siegel der Sonne. Jemand hat sie füreinander gemacht.');
      await g.message('Er stakt zurück und klettert auf das Podest.', 2000);
      g.hero.fixedScale = null; g.hero.setPos(680, 548, 'r'); g.hero.scale = g.scaleAt(548);
      await g.say('falk', 'Zurück ins Lager. Livia soll sich das ansehen, bevor sie es mir aus der Hand nimmt.');
      g.objective('Zurück ins Lager. Livia soll sich das Siegel ansehen.');
    });
  }
  async function turnWheel(g) {
    if (g.flag('wasser_hoch')) return 'Das Becken ist voll bis zum Rand. Das Rad dreht sich, aber es kommt nichts mehr nach. Der Abzu ist groß, die Zisterne nicht.';
    if (!g.flag('tor_zu')) {
      g.fx('water');
      await g.say('falk', 'Das Rad dreht sich schwer. Aus der Rinne schießt Wasser, klar und kalt.');
      await g.say('falk', 'Und läuft unten durch das offene Tor sofort wieder ab. So wird das nichts. Erst das Tor, dann das Rad.');
      return;
    }
    g.fx('water');
    await g.say('falk', 'Das Rad dreht sich schwer. Aus der Rinne schießt Wasser, klar und kalt.');
    g.set('wasser_hoch'); g.repaint();
    await g.message('Der Spiegel steigt, langsam, dann schneller, bis das Wasser kurz unter dem Rand steht.', 2600);
    if (g.flag('boot_im_wasser')) await g.say('falk', 'Das Boot steigt mit. Jetzt liegt es genau unter der Nische.');
    else await g.say('falk', 'Das Boot liegt noch auf dem Sims, trocken wie zuvor. Es müsste ins Wasser.');
  }
  async function pushBoat(g) {
    g.fx('water');
    g.set('boot_im_wasser'); g.repaint();
    if (g.flag('wasser_hoch')) return 'Es rutscht vom Sims und schwimmt. Schilf schwimmt, auch nach viertausend Jahren. Es treibt bis unter die Nische.';
    return 'Es rutscht vom Sims ins Wasser und schwimmt. Aber es liegt drei Meter unter der Nische. Das Wasser müsste steigen.';
  }
  async function openGate(g) {
    if (!g.flag('tor_zu')) return 'Das Tor steht offen. Das Wasser kann ablaufen, wenn es will.';
    g.fx('stone');
    g.set('tor_zu', false);
    if (g.flag('wasser_hoch')) {
      g.set('wasser_hoch', false); g.repaint(); g.fx('water');
      await g.say('falk', 'Ich ziehe das Tor hoch. Das Wasser strömt ab, gurgelnd, und der Spiegel sinkt.');
      if (g.flag('boot_im_wasser')) await g.say('falk', 'Das Boot sinkt mit. Es liegt wieder unten im Becken.');
      return;
    }
    g.repaint();
    return 'Ich ziehe das Tor hoch. Dahinter ein Kanal, schwarz, und ein Luftzug.';
  }
  async function closeGate(g) {
    if (g.flag('tor_zu')) return 'Das Tor ist unten. Nichts läuft mehr ab.';
    g.fx('stone');
    g.set('tor_zu'); g.repaint();
    await g.say('falk', 'Ich lasse das Tor herunter. Bronze auf Stein, ein Klang wie eine Glocke.');
    if (!g.flag('wasser_hoch')) await g.say('falk', 'Jetzt läuft nichts mehr ab. Wenn jetzt Wasser käme, bliebe es.');
  }

  R({
    id: 'me_abzu', name: 'Der Abzu', ambient: 'mesopotamia',
    start: [90, 545, 'r'],
    walk: [[20, 535, 940, 535, 940, 585, 20, 585], [20, 450, 130, 450, 130, 585, 20, 585], [660, 445, 940, 445, 940, 585, 660, 585]],
    scale: { y0: 445, s0: 0.85, y1: 585, s1: 1.05 },
    paint(ctx, g) {
      const wy = WATER_Y(g);
      A.rect(ctx, 0, 0, 960, 600, '#0a0c10');
      A.stones(ctx, 0, 0, 960, 310, '#3a4048', 3, 36);
      A.stones(ctx, 640, 300, 320, 140, '#3a4048', 4, 30);
      ctx.fillStyle = A.grad(ctx, 0, 0, 0, 120, ['#05070a', 'rgba(5,7,10,0)']); ctx.fillRect(0, 0, 960, 120);
      // Tropfsteine an der Decke, Risse im Gewölbe
      for (const [sx, sw, sh] of [[130, 18, 46], [176, 26, 66], [222, 14, 34], [268, 22, 58], [318, 16, 40], [398, 12, 30], [470, 14, 64], [610, 12, 28], [660, 20, 52], [712, 14, 36], [760, 24, 62], [822, 16, 40], [930, 20, 48]]) stalactite(ctx, sx, 0, sw, sh, sx % 3 ? '#4a4e56' : '#42464e');
      A.cracks(ctx, 40, 120, 90, 120, 4, 'rgba(0,0,0,0.5)'); A.cracks(ctx, 700, 310, 120, 100, 9, 'rgba(0,0,0,0.5)');
      // Lichtschacht in der Decke
      A.lightBeam(ctx, 440, 0, 140, 330, 'rgba(170,200,230,0.14)');
      // Enki im Relief links der Nische; aus seinen Schultern fließen zwei Ströme mit Fischen zur Rinne und zum Becken
      enkiRelief(ctx, 262, 280, 116, '#5a6068');
      for (const [sx, ex, ey, d] of [[246, 200, 286, -1], [278, 300, 300, 1]]) {
        for (const [c, off] of [['rgba(20,24,30,0.7)', 2], ['#6a7078', 0]]) {
          ctx.strokeStyle = c; ctx.lineWidth = 2.2; ctx.lineCap = 'round'; ctx.beginPath();
          for (let k = 0; k <= 10; k++) { const f = k / 10; const px = sx + (ex - sx) * f + Math.sin(f * 9) * 5 * d + off, py = 204 + (ey - 204) * f + off; k ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
          ctx.stroke();
        }
        fishGlyph(ctx, sx + (ex - sx) * 0.5 + 9 * d, 204 + (ey - 204) * 0.5 - 2, 12, 'rgba(160,170,180,0.6)', d);
      }
      // Ein kleinerer Apkallu rechts der Nische, im Licht des Schachts
      apkalluRelief(ctx, 486, 280, 92, '#5c626a', false);
      A.rect(ctx, 446, 282, 80, 6, 'rgba(0,0,0,0.3)'); A.rect(ctx, 220, 282, 84, 6, 'rgba(0,0,0,0.3)');
      // Nische hoch in der Rückwand, mit dem Siegel
      A.rect(ctx, 346, 186, 68, 80, '#1a1c22'); A.rect(ctx, 352, 192, 56, 68, '#05060a');
      A.rect(ctx, 340, 180, 80, 8, '#5a5e66'); A.rect(ctx, 340, 266, 80, 6, '#5a5e66');
      if (!g.flag('flutsiegel_genommen')) { A.seal(ctx, 380, 230, 18, 'flood', '#6fa8c8'); A.glow(ctx, 380, 230, 70, 'rgba(120,200,255,0.9)', 0.45); }
      // Zulaufrinne oben links
      A.rect(ctx, 130, 286, 80, 18, '#5a5e66'); A.rect(ctx, 136, 292, 68, 8, '#22262c');
      if (g.flag('wasser_hoch')) { A.rect(ctx, 140, 292, 60, 8, '#2f6a86'); }
      // Becken: Rückwand, Wasser, Frontmauer
      A.rect(ctx, 140, 300, 480, 8, '#5a5e66');
      A.rect(ctx, 140, 308, 480, wy - 308, '#151a20');
      for (let i = 0; i < 6; i++) A.line(ctx, 140, 320 + i * 22, 620, 320 + i * 22, 'rgba(255,255,255,0.03)', 1);
      A.rect(ctx, 140, 308, 480, 6, 'rgba(0,0,0,0.5)');
      // Kalkfahnen unter der Rinne, alte Wasserlinien an der Beckenwand
      const rk = ATL.U.rng(58);
      for (let i = 0; i < 6; i++) { const kx = 146 + i * 12 + rk() * 6, kh = 16 + rk() * 70; ctx.fillStyle = A.grad(ctx, 0, 308, 0, 308 + kh, ['rgba(225,230,235,0.2)', 'rgba(225,230,235,0)']); A.poly(ctx, [kx - 1 - rk() * 3, 308, kx + 2 + rk() * 3, 308, kx + 1, 308 + kh, kx, 308 + kh], ctx.fillStyle); }
      A.rect(ctx, 140, 308, 90, 8, 'rgba(225,230,235,0.12)');
      for (let i = 0; i < 4; i++) { const kx = 300 + rk() * 300, kh = 8 + rk() * 30; ctx.fillStyle = A.grad(ctx, 0, 308, 0, 308 + kh, ['rgba(225,230,235,0.12)', 'rgba(225,230,235,0)']); A.poly(ctx, [kx - 2, 308, kx + 2, 308, kx + 0.5, 308 + kh, kx, 308 + kh], ctx.fillStyle); }
      for (const ly of [344, 374, 404]) { A.line(ctx, 142, ly, 618, ly + 2, 'rgba(210,220,230,0.13)', 2.5); A.line(ctx, 142, ly + 3, 618, ly + 5, 'rgba(0,0,0,0.2)', 1); }
      A.sea(ctx, 140, wy, 480, 500 - wy, '#2f6a86', '#0f2a3a', 8);
      A.rect(ctx, 140, wy, 480, 2, 'rgba(200,230,255,0.35)');
      A.glow(ctx, 380, wy + 30, 160, 'rgba(80,160,220,0.5)', 0.25);
      A.stones(ctx, 140, 500, 480, 34, '#4a4c52', 6, 20); A.rect(ctx, 136, 498, 488, 6, '#6a6e76');
      // Kalkkruste und Moos auf der Beckenmauer, Fische in den Stein geritzt
      A.rect(ctx, 136, 504, 488, 2, 'rgba(230,235,240,0.18)');
      A.moss(ctx, 150, 508, 120, 5, '#3a5a34'); A.moss(ctx, 420, 510, 160, 6, '#34523a'); A.moss(ctx, 136, 302, 80, 7, '#3a5a34');
      for (let x = 176; x < 590; x += 46) { fishGlyph(ctx, x + 1, 520, 22, 'rgba(0,0,0,0.35)', 1); fishGlyph(ctx, x, 519, 22, 'rgba(180,190,200,0.4)', 1); }
      A.rect(ctx, 130, 300, 10, 234, '#4a4c52'); A.rect(ctx, 620, 300, 10, 234, '#4a4c52');
      // Abflusstor in der rechten Beckenwand
      A.rect(ctx, 594, 372, 30, 128, '#06080c');
      if (g.flag('tor_zu')) { for (let i = 0; i < 4; i++) A.rect(ctx, 597 + i * 7, 372, 4, 128, '#7a6a3a'); A.rect(ctx, 594, 380, 30, 5, '#8a7a4a'); }
      else { for (let i = 0; i < 4; i++) A.rect(ctx, 597 + i * 7, 300, 4, 60, '#7a6a3a'); A.rect(ctx, 594, 352, 30, 5, '#8a7a4a'); }
      A.chain(ctx, 609, 298, 700, 240, '#8a8a80'); A.chain(ctx, 700, 240, 800, 300, '#8a8a80');
      // Sims mit dem Schilfboot, Podest rechts mit Stufen
      A.rect(ctx, 618, 396, 110, 16, '#5a5e66'); A.rect(ctx, 618, 412, 110, 10, '#3a3c42');
      A.rect(ctx, 660, 432, 300, 104, '#4a4c52'); A.rect(ctx, 660, 432, 300, 6, '#6a6e76');
      for (let i = 0; i < 3; i++) { A.rect(ctx, 636 + i * 8, 470 + i * 22, 24 - i * 8, 66 - i * 22, A.shade('#4a4c52', i * 0.06)); }
      A.cuneiform(ctx, 700, 450, 220, 30, 'rgba(0,0,0,0.35)', 41);
      // Schleusenrad an der rechten Wand
      A.rect(ctx, 846, 340, 10, 92, '#3a3020');
      A.gear(ctx, 850, 330, 44, 12, '#6a5a3a', g.flag('wasser_hoch') ? 0.3 : 0);
      for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2 + (g.flag('wasser_hoch') ? 0.3 : 0); A.line(ctx, 850, 330, 850 + Math.cos(a) * 40, 330 + Math.sin(a) * 40, '#8a7a4a', 4); }
      A.circle(ctx, 850, 330, 9, '#3a3020');
      A.rect(ctx, 856, 300, 90, 8, '#5a5e66'); A.rect(ctx, 940, 300, 8, 60, '#22262c');
      // Grünspan unter der Rolle, Schilfbündel an der rechten Wand, Krüge und ein Seilring auf dem Podest
      A.ell(ctx, 700, 262, 10, 22, 'rgba(40,80,60,0.3)');
      for (const [rx, lean] of [[906, -0.06], [918, -0.02], [930, 0.03]]) { ctx.save(); ctx.translate(rx, 446); ctx.rotate(lean); A.rr(ctx, -6, -92, 12, 92, 5, '#a08c50'); A.rect(ctx, -6, -70, 12, 3, '#6a5a34'); A.rect(ctx, -6, -30, 12, 3, '#6a5a34'); for (let k = 0; k < 4; k++) A.line(ctx, -4 + k * 3, -92, -6 + k * 4, -104, '#b8a060', 1.5); ctx.restore(); }
      A.ell(ctx, 918, 448, 26, 4, 'rgba(0,0,0,0.35)');
      A.ell(ctx, 690, 446, 16, 3, 'rgba(0,0,0,0.35)'); A.pot(ctx, 690, 445, 24, 34, '#7a6248'); A.amphora(ctx, 712, 446, 40, '#6e5a44');
      A.ell(ctx, 750, 443, 14, 5, null, '#8a7a50', 3); A.ell(ctx, 750, 443, 8, 3, null, '#8a7a50', 2);
      // Boden vorn, Treppe hinauf links
      A.stones(ctx, 0, 534, 960, 70, '#3a3c42', 4, 26);
      // Pfützen auf dem Boden, Feuchtigkeit an der Beckenmauer
      A.puddle(ctx, 262, 562, 64, 10, 'rgba(110,150,180,0.22)'); A.puddle(ctx, 724, 570, 40, 7, 'rgba(110,150,180,0.2)'); A.puddle(ctx, 460, 578, 30, 6, 'rgba(110,150,180,0.18)');
      ctx.fillStyle = A.grad(ctx, 0, 534, 0, 556, ['rgba(20,40,50,0.35)', 'rgba(20,40,50,0)']); ctx.fillRect(140, 534, 480, 22);
      A.rect(ctx, 20, 240, 110, 300, '#22262c');
      A.stairs(ctx, 24, 534, 106, 8, 24, '#4a4c52');
      A.moss(ctx, 30, 508, 40, 8, '#2e4a2c'); A.moss(ctx, 60, 460, 30, 9, '#2e4a2c');
      A.rect(ctx, 30, 236, 70, 100, '#8a6a3a'); A.rect(ctx, 36, 242, 58, 94, '#1a1410'); A.glow(ctx, 65, 290, 80, 'rgba(255,220,160,0.6)', 0.3);
      // Boot auf dem Sims
      if (!g.flag('boot_im_wasser')) reedBoat(ctx, 672, 394, 90);
      A.vignette(ctx, 960, 600, 0.7);
      A.grain(ctx, 960, 600, 7, 0.05);
    },
    paintFront(ctx) {
      // Große Tropfsteine ganz vorn an der Decke, links und rechts vom Schacht
      stalactite(ctx, 32, 0, 30, 60, '#22262c'); stalactite(ctx, 72, 0, 46, 98, '#262a30'); stalactite(ctx, 108, 0, 26, 58, '#2a2e34');
      stalactite(ctx, 812, 0, 22, 44, '#22262c'); stalactite(ctx, 852, 0, 42, 86, '#262a30'); stalactite(ctx, 892, 0, 24, 50, '#2a2e34');
      // Tonkrug mit Moos links vorn, Scherben rechts vorn
      A.ell(ctx, 12, 606, 40, 8, 'rgba(0,0,0,0.5)'); A.pot(ctx, 10, 608, 56, 66, '#5a4a3a'); A.moss(ctx, -8, 604, 36, 5, '#2e4a2c');
      const r = ATL.U.rng(48);
      for (let i = 0; i < 5; i++) A.poly(ctx, [900 + r() * 50, 574 + r() * 22, 914 + r() * 40, 568 + r() * 22, 918 + r() * 40, 582 + r() * 18], A.shade('#6a5a48', (r() - 0.5) * 0.3));
    },
    animate(ctx, t, g) {
      const wy = WATER_Y(g);
      A.waterAnim(ctx, 140, wy, 480, 500 - wy, t, 'rgba(180,220,255,0.12)');
      if (!g.flag('flutsiegel_genommen')) A.glow(ctx, 380, 230, 60 + Math.sin(t * 2.2) * 12, 'rgba(120,200,255,0.8)', 0.3 + Math.sin(t * 1.4) * 0.1);
      if (!g.flag('flutsiegel_genommen')) A.glow(ctx, 380, wy + 20, 90, 'rgba(120,200,255,0.5)', 0.12 + Math.sin(t * 1.4) * 0.05);
      if (g.flag('wasser_hoch')) A.dust(ctx, 140, 292, 60, 20, t, 6, 'rgba(200,230,255,0.5)');
      // Lichtreflexe des Wassers, die über Decke und Rückwand wandern; bei vollem Becken näher und heller
      const hi = g.flag('wasser_hoch');
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineWidth = 2; ctx.lineCap = 'round';
      for (let k = 0; k < 7; k++) {
        const yb = (hi ? 66 : 88) + k * 14; ctx.strokeStyle = `rgba(110,170,220,${hi ? 0.09 : 0.06})`; ctx.beginPath();
        for (let x = 150; x <= 610; x += 12) { const y = yb + Math.sin(x * 0.035 + t * 1.6 + k * 1.7) * 5 + Math.sin(x * 0.011 - t * 0.9 + k) * 3; x === 150 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); }
        ctx.stroke();
      }
      ctx.restore();
      // Tropfen von der Rinne und vom Tropfstein im Lichtschacht, mit Ring auf dem Wasser
      const drip = (x, y0, off, speed) => {
        const p = (t * speed + off) % 1, y = y0 + p * p * (wy - y0);
        if (p < 0.97) A.ell(ctx, x, y, 1.6, 3.5, 'rgba(200,230,255,0.8)');
        const rp = (t * speed + off + 0.06) % 1;
        if (rp < 0.2) A.ell(ctx, x, wy, 3 + rp * 50, 1 + rp * 12, null, `rgba(200,230,255,${(0.4 * (1 - rp / 0.2)).toFixed(3)})`, 1);
      };
      drip(178, 304, 0.2, 0.55); drip(470, 64, 0.6, 0.45);
    },
    hotspots: [
      { id: 'enki', name: 'Relief des Enki', rect: [216, 150, 94, 130], at: [262, 550, 'u'],
        look: 'Ein Mann mit Hörnerkrone, aus dessen Schultern zwei Ströme fließen, mit Fischen darin. Enki, der Herr des süßen Wassers. Die Ströme führen zur Rinne und zum Becken. Wer das gemeißelt hat, wusste, wie die Anlage funktioniert. Ich noch nicht ganz.' },
      { id: 'fische', name: 'Fischritzungen', rect: [160, 506, 424, 26], at: [380, 550, 'u'],
        look: 'Fische, in die Beckenmauer geritzt, einer neben dem anderen, alle in dieselbe Richtung. Ein Fries oder eine Zählung. Bei den Sumerern war das oft dasselbe.' },
      { id: 'tropfsteine', name: 'Tropfsteine', rect: [100, 0, 300, 70], at: [250, 550, 'u'],
        look: 'Tropfsteine an der Decke, fingerlang bis armlang. Sie brauchen hundert Jahre für einen Zentimeter. Diese hier hatten Zeit.', use: 'Zu hoch. Und sie tropfen mir ohnehin schon auf den Hut.' },
      { id: 'nische', name: 'Nische', rect: [338, 178, 84, 96], at: [380, 550, 'u'],
        look: (g) => g.flag('flutsiegel_genommen') ? 'Die Nische, hoch in der Wand. Leer. Sie hat lange gewartet, jetzt wartet sie auf nichts mehr.' : 'Eine Nische hoch in der Rückwand, drei Meter über dem Wasser. Darin schimmert etwas Blaues. Es gibt keine Leiter, keine Stufen, keinen Vorsprung. Nur Wasser darunter.',
        take: (g) => g.flag('boot_im_wasser') && g.flag('wasser_hoch') ? getSeal(g) : g.flag('flutsiegel_genommen') ? 'Sie ist leer.' : 'Drei Meter über dem Wasser. Ohne Leiter und ohne Flügel komme ich nicht hin. Aber wer die Nische gebaut hat, kam hin. Irgendwie.',
        use: (g) => g.hs('nische').take(g),
        useWith: { seil: 'Glatter Stein, nichts zum Festmachen. Enki hat keine Haken vorgesehen.', schaufel: 'Zu kurz, um zwei Meter.', leiter: 'Die Leiter ist in Vermont.', default: 'Das reicht nicht bis dort hinauf.' } },
      { id: 'wasser', name: 'Wasser', rect: [140, 300, 480, 200], at: [380, 550, 'u'], walkToLook: true,
        look: (g) => g.flag('wasser_hoch') ? 'Das Becken ist voll bis zum Rand. Klares, kaltes Wasser, so still, dass sich die Nische darin spiegelt.' : 'Ein Becken aus Stein, halb voll. Klares Wasser, ganz still. Süßwasser, mitten in der Wüste. Der Abzu, würde Livia sagen. Eine Zisterne, würde ich sagen.',
        use: 'Ich halte die Hand hinein. Kalt. Kälter als alles seit Basra.',
        take: 'Ich nehme eine Handvoll. Sie läuft mir durch die Finger, wie es Wasser tut.',
        useWith: { flasche: async (g) => { g.fx('water'); g.set('flasche_leer', false); return 'Ich fülle die Flasche. Süßwasser aus dem Abzu. Enki wird es mir nicht übelnehmen.'; }, seil: 'Das Seil wird nass. Sonst passiert nichts.', default: 'Das gehört nicht ins Wasser.' } },
      { id: 'boot', name: 'Schilfboot', rect: [624, 372, 100, 40], at: [660, 548, 'u'], cond: (g) => !g.flag('boot_im_wasser'),
        look: 'Ein Boot aus Schilfbündeln, so lang wie zwei Männer, auf einem Sims über dem Wasser. Trocken, leicht, und älter als alles, worauf ich je gesessen habe. In Südirak baut man sie heute noch so.',
        push: pushBoat, use: pushBoat, pull: pushBoat,
        take: 'Es ist so lang wie zwei Männer. Ich schiebe es, ich trage es nicht.',
        open: 'Ein Boot hat keinen Deckel.' },
      { id: 'boot_wasser', name: 'Schilfboot', rect: [0, 0, 0, 0], at: [660, 548, 'l'], cond: (g) => g.flag('boot_im_wasser'), z: 0,
        paint: (ctx, g, t) => { const [bx, by] = BOAT(g); reedBoat(ctx, bx, by + Math.sin(t * 1.6) * 2, 90); const h = g.hs('boot_wasser'); h.rect = [bx - 50, by - 40, 100, 50]; },
        look: (g) => g.flag('wasser_hoch') ? 'Das Boot schwimmt, genau unter der Nische. Vom Bug aus könnte ich hineinfassen.' : 'Das Boot schwimmt unten im Becken. Es liegt drei Meter unter der Nische. So hilft es mir nicht.',
        use: (g) => g.flag('wasser_hoch') ? getSeal(g) : 'Ich könnte einsteigen. Aber von dort unten ist die Nische genauso weit weg wie von hier. Das Wasser müsste steigen.',
        push: 'Es treibt, wohin es will. Ich habe kein Ruder, nur eine Stange.', pull: 'Ich ziehe es an den Rand. Es kommt zurück, wenn ich loslasse.',
        take: 'Nass und schwer. Es bleibt im Wasser.' },
      { id: 'rad', name: 'Schleusenrad', rect: [800, 280, 100, 110], at: [850, 470, 'u'],
        look: (g) => g.flag('wasser_hoch') ? 'Das Rad, bis zum Anschlag gedreht. Die Rinne ist voll, das Becken auch.' : 'Ein Rad aus Bronze und Holz, mannshoch, an einer Welle in der Wand. Eine Kette führt zur Rinne oben. Wer es dreht, lässt Wasser aus dem Abzu in das Becken. Jedenfalls hat es das einmal getan.',
        use: turnWheel, pull: turnWheel, push: turnWheel,
        take: 'Es ist in die Wand gebaut. Und schwerer als ich.', open: 'Ein Rad öffnet man nicht. Man dreht es.' },
      { id: 'tor', name: 'Abflusstor', rect: [588, 296, 42, 120], at: [660, 548, 'u'],
        look: (g) => g.flag('tor_zu') ? 'Das Tor am Boden des Beckens, heruntergelassen. Bronzegitter auf Stein. Nichts läuft ab.' : 'Ein Bronzegitter in der Beckenwand, hochgezogen. Darunter ein Kanal, in dem es dunkel gurgelt. Was hereinkommt, läuft hier wieder hinaus.',
        open: openGate, close: closeGate,
        use: (g) => g.flag('tor_zu') ? openGate(g) : closeGate(g), push: (g) => g.flag('tor_zu') ? openGate(g) : closeGate(g), pull: (g) => g.flag('tor_zu') ? openGate(g) : closeGate(g),
        take: 'Es sitzt in Führungen im Stein. Rauf oder runter, sonst nichts.',
        useWith: { seil: 'Das Tor hängt an einer Kette. Ein Seil braucht es nicht.', default: 'Das Tor kennt nur rauf und runter.' } },
      { id: 'kette', name: 'Kette', rect: [630, 236, 180, 70], at: [700, 548, 'u'], look: 'Eine Bronzekette, von der Rinne über eine Rolle zum Tor. Grün, aber ganz. Sie hat viertausend Jahre gewartet, um jemanden zu ärgern.', pull: 'Sie ist straff. Das Tor bewegt man am Tor.', take: 'Sie ist Teil der Anlage.' },
      { id: 'rinne', name: 'Zulaufrinne', rect: [126, 280, 90, 30], at: [140, 548, 'u'], look: (g) => g.flag('wasser_hoch') ? 'Die Rinne, aus der das Wasser kam. Es tropft noch.' : 'Eine Rinne aus Stein oben am Becken. Trocken. Dahinter irgendwo der Abzu, das süße Wasser unter der Erde.', use: 'Sie ist oben an der Wand. Das Rad steuert sie.' },
      { id: 'podest', name: 'Podest', rect: [660, 430, 300, 106], at: [780, 500, 'd'], noWalk: true,
        look: 'Ein Podest aus Stein neben dem Becken, mit einer Inschrift im Boden. Von hier haben die Priester das Wasser gelenkt, mit dem Rad und dem Tor.',
        use: 'Ich stehe darauf. Mehr macht man mit einem Podest nicht.', take: 'Nein.' },
      { id: 'sims', name: 'Sims', rect: [618, 412, 110, 14], at: [660, 548, 'u'], look: (g) => g.flag('boot_im_wasser') ? 'Der Sims, auf dem das Boot lag. Ein Abdruck im Staub, sonst nichts.' : 'Ein Sims aus Stein über dem Wasser. Darauf liegt das Boot, als hätte es jemand für später bereitgelegt.', use: 'Ein Vorsprung. Er hält das Boot, mehr nicht.' },
      { id: 'schacht', name: 'Lichtschacht', rect: [440, 0, 140, 90], at: [500, 550, 'u'], look: 'Ein Schacht in der Decke, schräg, so dass Tageslicht hereinfällt, aber kein Sand. Wer das gebaut hat, hat lange nachgedacht.', use: 'Zu hoch. Und zu schräg.' },
    ],
    exits: [
      { id: 'treppe', name: 'Treppe zum Archiv', rect: [20, 236, 110, 300], at: [70, 545, 'l'], to: 'me_archive', pos: [780, 500], dir: 'd', look: 'Die Stufen hinauf zur Bronzetür und ins Haus der Tafeln.' },
    ],
    async enter(g) {
      if (!g.flag('abzu_besucht')) {
        g.set('abzu_besucht');
        await g.say('falk', 'Eine Zisterne. Steinwände, ein Becken, und oben ein Schacht, durch den Licht fällt. Es riecht nach Wasser. Nach richtigem Wasser.');
        await g.say('falk', 'Und da oben in der Wand schimmert etwas Blaues.');
      }
    },
  });
})(window.ATL);
