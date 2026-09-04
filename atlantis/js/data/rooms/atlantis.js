/* Atlantis: Finale und Epilog. Sechs Räume unter Thera: äußerer Ring, Tempel des Poseidon,
   Zellen, das Herz, Flucht, Boot bei Sonnenuntergang. */
(function (ATL) {
  const A = ATL.A;
  const R = ATL.rooms.define;
  const TAU = Math.PI * 2;
  const TEAL = 'rgba(90,240,210,0.8)';

  // ---------------------------------------------------------------- Hilfen
  // Höhlenhintergrund: dunkles Blaugrün, Decke mit Tropfsteinen
  const cave = (ctx, w, h, seed) => {
    ctx.fillStyle = A.grad(ctx, 0, 0, 0, h, ['#050c14', '#0a1c26', '#0d2a30']);
    ctx.fillRect(0, 0, w, h);
    const r = ATL.U.rng(seed || 3);
    for (let x = -20; x < w + 40; x += 18 + r() * 30) {
      const d = 30 + r() * 90, ww = 8 + r() * 18;
      A.poly(ctx, [x - ww, 0, x + ww, 0, x + (r() - 0.5) * 8, d], '#06131a');
    }
  };
  // Orichalkum-Adern in der Mauer
  const veins = (ctx, x, y, w, h, seed, n) => {
    const r = ATL.U.rng(seed || 9);
    for (let i = 0; i < (n || 8); i++) {
      const px = x + r() * w, py = y + r() * h;
      A.glow(ctx, px, py, 40 + r() * 60, 'rgba(70,220,190,0.5)', 0.35);
      A.path(ctx, [px - 20, py + 4, px - 6, py - 3, px + 8, py + 5, px + 22, py - 2], 'rgba(120,255,225,0.55)', 1.5);
    }
  };
  // Leuchtender Kanal (statischer Teil)
  const canal = (ctx, x, y, w, h) => {
    A.rect(ctx, x, y, w, h, '#03151c');
    ctx.fillStyle = A.grad(ctx, 0, y, 0, y + h, ['#0a4a4c', '#1a9a90', '#0c5a58']);
    ctx.fillRect(x + 4, y + 4, w - 8, h - 8);
    A.glow(ctx, x + w / 2, y + h / 2, Math.max(w, h) * 0.6, 'rgba(60,220,200,0.6)', 0.35);
    A.rect(ctx, x, y, w, 4, '#1e3a3c'); A.rect(ctx, x, y + h - 4, w, 4, '#1e3a3c');
  };
  // Silhouette eines geflügelten Pferds
  const horse = (ctx, x, y, s, color) => {
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    A.ell(ctx, 0, 0, 30, 14, color);
    A.poly(ctx, [18, -6, 34, -30, 44, -28, 40, -16, 32, -8, 26, 4], color);
    A.poly(ctx, [40, -30, 56, -26, 50, -18, 42, -20], color);
    A.line(ctx, -18, 8, -26, 32, color, 5); A.line(ctx, -8, 10, -10, 34, color, 5);
    A.line(ctx, 12, 10, 18, 34, color, 5); A.line(ctx, 22, 8, 32, 30, color, 5);
    A.poly(ctx, [-30, -2, -46, 6, -40, 16, -28, 8], color);
    A.poly(ctx, [-6, -10, -30, -60, 4, -44, 26, -70, 18, -20], color);
    ctx.restore();
  };
  // Der tote Maschinenkrebs
  const crab = (ctx, x, y, open) => {
    const m = '#3a5a5c', d = '#22393c';
    for (let i = 0; i < 4; i++) {
      const k = i * 26;
      A.line(ctx, x - 40 + k, y + 10, x - 80 + k, y + 34 + (i % 2) * 8, d, 7);
      A.line(ctx, x + 40 + k * 0.6, y + 10, x + 90 + k * 0.6, y + 30 + (i % 2) * 10, d, 7);
    }
    ctx.fillStyle = A.grad(ctx, x - 80, y - 60, x + 80, y + 20, ['#4a6c6e', m, d]);
    A.ell(ctx, x, y - 10, 82, 46, ctx.fillStyle);
    A.ell(ctx, x, y - 26, 60, 22, d);
    A.line(ctx, x - 70, y - 30, x - 118, y - 62, m, 10); A.poly(ctx, [x - 126, y - 78, x - 100, y - 60, x - 130, y - 50], d);
    A.line(ctx, x + 70, y - 30, x + 110, y - 52, m, 10); A.poly(ctx, [x + 122, y - 66, x + 96, y - 52, x + 124, y - 40], d);
    for (let i = 0; i < 5; i++) A.rect(ctx, x - 50 + i * 24, y - 44, 12, 5, '#5a7c7c');
    A.circle(ctx, x - 24, y - 20, 6, '#111'); A.circle(ctx, x + 24, y - 20, 6, '#111');
    if (open) {
      A.poly(ctx, [x - 30, y - 6, x + 30, y - 6, x + 36, y + 20, x - 36, y + 20], '#0a1416');
      A.poly(ctx, [x - 30, y - 6, x + 30, y - 6, x + 44, y - 40, x - 12, y - 40], '#5a7c7c');
    } else {
      A.rr(ctx, x - 30, y - 8, 60, 26, 4, '#2c4648'); A.circle(ctx, x, y + 5, 3, '#7aa');
      A.glow(ctx, x, y + 5, 40, 'rgba(90,255,210,0.5)', 0.4);
    }
  };
  // ---- Ausschmückung: kleine Bausteine, die nur dieses Kapitel braucht ----
  const shade = A.shade;
  // Fischsilhouette (dir: 1 nach rechts, -1 nach links)
  const fish = (ctx, x, y, s, color, dir) => {
    ctx.save(); ctx.translate(x, y); ctx.scale(s * (dir || 1), s);
    A.ell(ctx, 0, 0, 10, 4, color); A.poly(ctx, [-8, 0, -16, -5, -16, 5], color);
    ctx.restore();
  };
  // Leitung aus grünem Metall mit Flanschen an den Knicken
  const pipe = (ctx, pts, w, color, glow) => {
    A.path(ctx, pts, shade(color, -0.4), w + 2);
    A.path(ctx, pts, color, w);
    A.path(ctx, pts, 'rgba(255,255,255,0.10)', Math.max(1, w * 0.25));
    for (let i = 0; i < pts.length; i += 2) {
      A.circle(ctx, pts[i], pts[i + 1], w * 0.8, shade(color, -0.1), shade(color, -0.45), 1);
      if (glow) A.glow(ctx, pts[i], pts[i + 1], w * 4, glow, 0.3);
    }
  };
  // Kalkschleier, der von einer Kante herabläuft
  const lime = (ctx, x, y, w, h, seed, n) => {
    const r = ATL.U.rng(seed || 121);
    for (let i = 0; i < (n || 10); i++) {
      const px = x + r() * w, len = h * (0.3 + r() * 0.7), ww = 3 + r() * 9;
      ctx.fillStyle = A.grad(ctx, 0, y, 0, y + len, [`rgba(220,235,228,${0.10 + r() * 0.1})`, 'rgba(220,235,228,0)']);
      A.poly(ctx, [px - ww / 2, y, px + ww / 2, y, px + ww * 0.2, y + len, px - ww * 0.1, y + len], ctx.fillStyle);
    }
  };
  // Algenschleier, die von einer Kante hängen
  const algae = (ctx, x, y, w, h, seed, color) => {
    const r = ATL.U.rng(seed || 131);
    for (let px = x; px < x + w; px += 6 + r() * 14) {
      const len = h * (0.4 + r() * 0.6);
      ctx.strokeStyle = color || `rgba(30,90,70,${0.35 + r() * 0.3})`; ctx.lineWidth = 1.5 + r() * 2;
      ctx.beginPath(); ctx.moveTo(px, y); ctx.quadraticCurveTo(px + (r() - 0.5) * 8, y + len * 0.6, px + (r() - 0.5) * 6, y + len); ctx.stroke();
    }
  };
  // Reihe atlantischer Zeichen: Spiralen, Punkte, Striche
  const glyphRow = (ctx, x, y, w, seed, color) => {
    const r = ATL.U.rng(seed || 141);
    ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = 1.2;
    for (let cx = x; cx < x + w - 6; cx += 9 + r() * 4) {
      const k = r();
      if (k < 0.3) { ctx.beginPath(); ctx.arc(cx + 3, y, 3, 0, TAU * 0.8); ctx.stroke(); }
      else if (k < 0.55) { ctx.fillRect(cx + 2, y - 1, 2, 2); ctx.fillRect(cx + 5, y - 1, 2, 2); }
      else if (k < 0.75) { ctx.beginPath(); ctx.moveTo(cx, y + 3); ctx.lineTo(cx + 3, y - 3); ctx.lineTo(cx + 6, y + 3); ctx.stroke(); }
      else { ctx.fillRect(cx + 1, y - 3, 1.5, 6); ctx.fillRect(cx + 4, y - 1, 3, 1.5); }
    }
  };
  // Wächterfigur mit Fischkopf in einer Nische
  const guardianNiche = (ctx, x, y, w, h, color, glow) => {
    A.rect(ctx, x, y + w / 2, w, h - w / 2, '#061014');
    A.ell(ctx, x + w / 2, y + w / 2, w / 2, w / 2, '#061014');
    ctx.strokeStyle = 'rgba(120,255,225,0.25)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x, y + h); ctx.lineTo(x, y + w / 2); ctx.arc(x + w / 2, y + w / 2, w / 2, Math.PI, 0); ctx.lineTo(x + w, y + h); ctx.stroke();
    if (glow) A.glow(ctx, x + w / 2, y + h * 0.55, w, glow, 0.3);
    const cx = x + w / 2, fh = h * 0.62, base = y + h - 4;
    A.rect(ctx, cx - w * 0.3, base - 4, w * 0.6, 4, shade(color, -0.2));
    A.poly(ctx, [cx - w * 0.2, base - 4, cx + w * 0.2, base - 4, cx + w * 0.16, base - fh * 0.75, cx - w * 0.16, base - fh * 0.75], color);
    A.ell(ctx, cx, base - fh * 0.75, w * 0.24, w * 0.16, shade(color, 0.1));
    A.circle(ctx, cx, base - fh * 0.88, w * 0.15, color);
    A.poly(ctx, [cx - w * 0.1, base - fh * 0.98, cx + w * 0.1, base - fh * 0.98, cx, base - fh * 1.1], shade(color, 0.15));
    A.line(ctx, cx - w * 0.14, base - fh * 0.55, cx + w * 0.14, base - fh * 0.5, shade(color, -0.3), 2);
  };
  // Dreifuß mit Schale (kalte Flamme kommt aus animate)
  const tripod = (ctx, x, baseY, h, color) => {
    color = color || '#4a6a66';
    for (const k of [-1, 0, 1]) A.line(ctx, x + k * h * 0.22, baseY, x + k * h * 0.06, baseY - h * 0.7, shade(color, k ? -0.15 : 0.05), 3);
    A.line(ctx, x - h * 0.16, baseY - h * 0.35, x + h * 0.16, baseY - h * 0.35, shade(color, -0.2), 2);
    A.ell(ctx, x, baseY - h * 0.72, h * 0.28, h * 0.1, shade(color, 0.1));
    A.ell(ctx, x, baseY - h * 0.74, h * 0.22, h * 0.06, '#0a1618');
  };
  // Kandelaber aus grünem Metall, drei Arme
  const candelabrum = (ctx, x, baseY, h, color) => {
    color = color || '#5a8280';
    A.ell(ctx, x, baseY, h * 0.12, h * 0.03, shade(color, -0.3));
    A.line(ctx, x, baseY, x, baseY - h * 0.8, color, 3);
    for (const k of [-1, 0, 1]) {
      ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, baseY - h * 0.7);
      ctx.quadraticCurveTo(x + k * h * 0.2, baseY - h * 0.72, x + k * h * 0.2, baseY - h * 0.9); ctx.stroke();
      A.ell(ctx, x + k * h * 0.2, baseY - h * 0.9, h * 0.05, h * 0.02, shade(color, 0.1));
    }
  };
  // Anker aus grünem Metall, angelehnt
  const anchor = (ctx, x, y, h, color) => {
    color = color || '#3e5e5a';
    A.circle(ctx, x, y, h * 0.08, null, color, 3);
    A.line(ctx, x, y + h * 0.08, x, y + h * 0.85, color, 4);
    A.line(ctx, x - h * 0.2, y + h * 0.22, x + h * 0.2, y + h * 0.22, color, 3);
    ctx.strokeStyle = color; ctx.lineWidth = 4; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x - h * 0.34, y + h * 0.66); ctx.quadraticCurveTo(x, y + h * 1.1, x + h * 0.34, y + h * 0.66); ctx.stroke();
    A.poly(ctx, [x - h * 0.34, y + h * 0.66, x - h * 0.42, y + h * 0.76, x - h * 0.28, y + h * 0.74], color);
    A.poly(ctx, [x + h * 0.34, y + h * 0.66, x + h * 0.42, y + h * 0.76, x + h * 0.28, y + h * 0.74], color);
    A.ell(ctx, x + h * 0.06, y + h * 0.5, h * 0.05, h * 0.12, 'rgba(120,255,225,0.15)');
  };
  // Liegende Säulentrommel
  const drum = (ctx, x, y, w, h, color) => {
    ctx.fillStyle = A.grad(ctx, 0, y, 0, y + h, [shade(color, 0.15), color, shade(color, -0.35)]);
    A.rr(ctx, x, y, w, h, h * 0.45, ctx.fillStyle);
    A.ell(ctx, x + w, y + h / 2, h * 0.18, h / 2, shade(color, -0.15));
    A.ell(ctx, x + w, y + h / 2, h * 0.1, h * 0.32, shade(color, -0.4));
    for (let k = 1; k < 4; k++) A.line(ctx, x + 6, y + (k * h) / 4, x + w - 4, y + (k * h) / 4 + 2, 'rgba(120,255,220,0.18)', 1.5);
  };
  // Schwarm von Fischschatten im Kanal (animiert, mit Clip)
  const fishSchool = (ctx, x, y, w, h, t, n, color, seed) => {
    ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
    for (let i = 0; i < n; i++) {
      const px = x + ((i * 173 + (seed || 0) + t * 34) % (w + 200)) - 100;
      const py = y + h * 0.3 + ((i * 37) % (h * 0.5)) + Math.sin(t * 1.6 + i) * 4;
      fish(ctx, px, py, 0.7 + (i % 3) * 0.2, color || 'rgba(6,40,40,0.55)', 1);
    }
    ctx.restore();
  };
  // Nebelschwaden, die langsam treiben (animiert)
  const mist = (ctx, x, y, w, t, n, color) => {
    for (let i = 0; i < n; i++) {
      const px = x + ((i * 331 + t * (9 + (i % 3) * 4)) % (w + 240)) - 120;
      const py = y + Math.sin(t * 0.5 + i * 1.7) * 5;
      A.ell(ctx, px, py, 70 + (i % 4) * 25, 7 + (i % 3) * 3, color || 'rgba(150,240,225,0.06)');
    }
  };
  // Fallender Tropfen mit kleinem Ring beim Aufschlag
  const drip = (ctx, x, y0, y1, t, phase, color) => {
    const k = (t * 0.55 + (phase || 0)) % 1;
    const y = y0 + (y1 - y0) * k * k;
    A.line(ctx, x, y - 6, x, y, color || 'rgba(190,250,240,0.6)', 1.5);
    if (k > 0.92) A.ell(ctx, x, y1, (k - 0.92) * 120, (k - 0.92) * 30, null, 'rgba(190,250,240,0.4)', 1);
  };
  // Funken (animiert)
  const sparks = (ctx, x, y, t, n, color) => {
    for (let i = 0; i < n; i++) {
      const k = (t * (1.4 + (i % 3) * 0.5) + i * 0.37) % 1;
      const px = x + Math.sin(i * 2.1) * 22 * k + (i % 2 ? 1 : -1) * k * 12, py = y + k * k * 60 - k * 10;
      ctx.fillStyle = color || `rgba(255,${180 - Math.round(k * 120)},60,${1 - k})`;
      ctx.fillRect(px, py, 2, 2);
    }
  };

  // Königsstatue mit Namensschild
  const kingStatue = (ctx, x, baseY, h, name, pressed) => {
    A.statue(ctx, x, baseY, h, '#6f8a88', 'crown');
    const w = h * 0.3;
    // ausgestreckte Hand
    A.line(ctx, x + w * 0.35, baseY - h * 0.62, x + w * 0.85, baseY - h * (pressed ? 0.5 : 0.58), '#7a9694', 4);
    A.circle(ctx, x + w * 0.85, baseY - h * (pressed ? 0.5 : 0.58), 3.5, '#8aa6a4');
    A.rr(ctx, x - 29, baseY + 4, 58, 16, 3, '#1a2c30', '#4a8a84', 1);
    A.text(ctx, name, x, baseY + 16, { font: '11px Georgia', color: '#8fe0d0', align: 'center' });
  };

  Object.assign(ATL.codex, {
    kritias: { title: 'Das Ende des Kritias', origin: 'Platon, Kritias 121b–c', text: 'Der Kritias endet mitten im Satz. Zuvor erzählt Platon, wie die Atlanter über Generationen ihr göttliches Erbe verloren und habgierig wurden. Zeus beschloss, sie zu strafen, rief die Götter zusammen und begann zu sprechen. Dort bricht der Text ab.\nOb Platon den Dialog nie beendete oder ob der Schluss verloren ging, ist unbekannt. Der Untergang der Insel selbst wird nur im Timaios geschildert, in wenigen Zeilen.' },
  });

  // ---------------------------------------------------------------- Äußerer Ring
  R({
    id: 'at_outer', name: 'Äußerer Ring von Atlantis', ambient: 'atlantis', width: 1600,
    start: [200, 520, 'r'],
    walk: [[40, 450, 520, 450, 520, 485, 745, 485, 745, 450, 1600, 450, 1600, 585, 40, 585]],
    scale: { y0: 420, s0: 0.78, y1: 585, s1: 1.05 },
    paint(ctx, g) {
      cave(ctx, 1600, 600, 5);
      // Ferne Ringe der Stadt hinter der Mauer
      for (let i = 0; i < 3; i++) A.ell(ctx, 800, 150, 760 - i * 200, 46 - i * 10, null, `rgba(60,200,180,${0.14 + i * 0.06})`, 3);
      A.stars(ctx, 1600, 260, 120, 21, 'rgba(120,255,230,0.35)');
      // Ferne Silhouetten der inneren Ringe: Türme, Kuppeln, dahinter klein und blass
      {
        const r = ATL.U.rng(61);
        for (let x = 20; x < 1600; x += 60 + r() * 80) {
          const h = 12 + r() * 38, w = 10 + r() * 22, c = `rgba(50,140,130,${0.08 + r() * 0.12})`;
          if (r() < 0.35) A.ell(ctx, x, 150 - h * 0.5, w, h * 0.5, c);
          else A.poly(ctx, [x - w / 2, 150, x + w / 2, 150, x + w * 0.35, 150 - h, x - w * 0.35, 150 - h], c);
        }
        // versteinerter Garten auf der Terrasse hinter der Mauer
        ctx.strokeStyle = 'rgba(130,180,170,0.3)'; ctx.lineWidth = 2; ctx.lineCap = 'round';
        for (let i = 0; i < 27; i++) {
          const x = 30 + i * 60 + r() * 24, h = 16 + r() * 24;
          ctx.beginPath(); ctx.moveTo(x, 152); ctx.lineTo(x + (r() - 0.5) * 6, 152 - h);
          ctx.moveTo(x + (r() - 0.5) * 3, 152 - h * 0.55); ctx.lineTo(x + 7 + r() * 7, 152 - h * 0.85);
          ctx.moveTo(x + (r() - 0.5) * 3, 152 - h * 0.4); ctx.lineTo(x - 7 - r() * 7, 152 - h * 0.7);
          ctx.stroke();
        }
        ctx.fillStyle = A.grad(ctx, 0, 112, 0, 158, ['rgba(80,170,160,0)', 'rgba(80,170,160,0.15)', 'rgba(80,170,160,0)']);
        ctx.fillRect(0, 112, 1600, 46);
      }
      // Zyklopenmauer
      A.stones(ctx, 0, 150, 1600, 240, '#2a4a50', 31, 64);
      A.rect(ctx, 0, 150, 1600, 10, '#3a5e62');
      veins(ctx, 0, 160, 1600, 220, 12, 16);
      // Reliefband oben: Spiralen; unten: Wellen und Fische
      A.rect(ctx, 0, 166, 1600, 28, 'rgba(0,0,0,0.2)');
      A.line(ctx, 0, 166, 1600, 166, 'rgba(160,255,235,0.18)', 1); A.line(ctx, 0, 194, 1600, 194, 'rgba(0,0,0,0.35)', 1);
      A.spirals(ctx, 0, 169, 1600, 22, 'rgba(120,255,225,0.28)');
      A.rect(ctx, 0, 356, 1600, 24, 'rgba(0,0,0,0.22)');
      ctx.strokeStyle = 'rgba(120,255,225,0.22)'; ctx.lineWidth = 1.5; ctx.beginPath();
      for (let x = 0; x <= 1600; x += 6) { const y = 372 + Math.sin(x * 0.09) * 4; x ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
      ctx.stroke();
      for (let x = 60; x < 1600; x += 140) fish(ctx, x, 365, 0.7, 'rgba(120,255,225,0.3)', (x / 140) % 2 ? 1 : -1);
      // Metallverkleidung: ein Streifen, der noch glänzt
      ctx.fillStyle = A.grad(ctx, 0, 338, 0, 356, ['#4e7e7a', '#8cc4b8', '#365e5a']); ctx.fillRect(0, 338, 1600, 18);
      for (let x = 30; x < 1600; x += 210) A.line(ctx, x, 341, x + 40, 341, 'rgba(255,255,255,0.35)', 1.5);
      for (let x = 100; x < 1600; x += 160) A.rect(ctx, x, 340, 2, 14, 'rgba(0,0,0,0.35)');
      // Orichalkum-Leitung an der Mauer, mit Abzweigen zum Kanal
      pipe(ctx, [0, 214, 1600, 214], 7, '#3a6a66');
      for (let x = 150; x < 1600; x += 150) A.circle(ctx, x, 214, 6, '#4a7a76', '#1e3c3a', 1);
      for (const x of [300, 900, 1500]) pipe(ctx, [x, 214, x, 336], 5, '#3a6a66');
      // Kalkschleier und Algen
      lime(ctx, 0, 160, 1600, 120, 122, 26);
      lime(ctx, 0, 300, 1600, 60, 123, 18);
      algae(ctx, 0, 380, 1600, 26, 132);
      // Treppe, die in das Wasser führt
      for (let i = 0; i < 4; i++) { A.rect(ctx, 816, 344 + i * 12, 88, 12, shade('#3a5a5e', i * 0.05)); A.rect(ctx, 816, 344 + i * 12, 88, 2, 'rgba(255,255,255,0.12)'); }
      A.rect(ctx, 812, 340, 4, 52, '#1e3436'); A.rect(ctx, 904, 340, 4, 52, '#1e3436');
      // Kristalle am Fuß der Mauer
      for (const [x, w, h] of [[386, 12, 26], [398, 16, 38], [416, 10, 20], [1360, 12, 24], [1374, 14, 34]]) A.crystal(ctx, x, 392, w, h, 'rgba(110,230,205,0.85)');
      A.glow(ctx, 402, 380, 40, TEAL, 0.3); A.glow(ctx, 1370, 380, 34, TEAL, 0.25);
      for (let x = 150; x < 1600; x += 300) A.column(ctx, x, 392, 250, 34, '#587c7c', 'atlantis');
      // Kalk an den Säulenfüßen
      for (let x = 150; x < 1600; x += 300) A.ell(ctx, x, 390, 26, 5, 'rgba(220,235,228,0.12)');
      // Kanal hinter dem Gehweg
      canal(ctx, 0, 392, 1600, 56);
      // Stufen unter Wasser, Bootswrack im Kanal
      A.rect(ctx, 816, 396, 88, 10, 'rgba(60,110,110,0.45)'); A.rect(ctx, 816, 406, 88, 10, 'rgba(50,95,95,0.35)');
      ctx.save(); ctx.translate(900, 428); ctx.rotate(-0.16);
      A.poly(ctx, [-52, -2, 52, -2, 42, 14, -40, 14], '#233836');
      A.rect(ctx, -48, -7, 96, 5, '#34504c');
      for (let k = -36; k < 40; k += 14) A.line(ctx, k, -2, k + 2, 12, 'rgba(0,0,0,0.35)', 1.5);
      A.line(ctx, 4, -6, 18, -44, '#2a403e', 3); A.line(ctx, 18, -44, 30, -30, '#2a403e', 2);
      ctx.restore();
      ctx.save(); ctx.beginPath(); ctx.rect(820, 416, 170, 32); ctx.clip();
      A.ell(ctx, 905, 440, 96, 22, 'rgba(20,140,130,0.5)'); A.ell(ctx, 905, 446, 80, 14, 'rgba(26,154,144,0.6)');
      ctx.restore();
      // Seitenkanal, den die Brücke überspannt
      canal(ctx, 1100, 392, 200, 208);
      // Gehweg
      ctx.fillStyle = A.grad(ctx, 0, 448, 0, 600, ['#3e5c5e', '#22383a']);
      ctx.fillRect(0, 448, 1100, 152); ctx.fillRect(1300, 448, 300, 152);
      for (let x = 0; x < 1600; x += 90) { if (x >= 1100 && x < 1300) continue; A.line(ctx, x, 448, x - 30, 600, 'rgba(0,0,0,0.25)', 1); }
      for (let y = 470; y < 600; y += 34) { A.line(ctx, 0, y, 1100, y, 'rgba(0,0,0,0.2)', 1); A.line(ctx, 1300, y, 1600, y, 'rgba(0,0,0,0.2)', 1); }
      A.rect(ctx, 0, 446, 1100, 6, '#5a7e7e'); A.rect(ctx, 1300, 446, 300, 6, '#5a7e7e');
      A.rect(ctx, 1096, 448, 6, 152, '#1a2c2e'); A.rect(ctx, 1298, 448, 6, 152, '#1a2c2e');
      // Muscheln, Kalk und Kies am Kanalrand; Pfützen; Risse im Gehweg
      {
        const r = ATL.U.rng(151);
        for (let x = 4; x < 1600; x += 10 + r() * 24) {
          if (x > 1090 && x < 1310) continue;
          const y = 454 + r() * 16;
          if (r() < 0.4) A.ell(ctx, x, y, 3 + r() * 3, 2 + r() * 2, `rgba(225,235,228,${0.25 + r() * 0.3})`);
          else A.ell(ctx, x, y, 2 + r() * 3, 1.5 + r() * 1.5, `rgba(0,0,0,${0.2 + r() * 0.2})`);
        }
      }
      A.puddle(ctx, 700, 522, 96, 18, 'rgba(90,210,195,0.16)'); A.puddle(ctx, 190, 560, 64, 12, 'rgba(90,210,195,0.14)'); A.puddle(ctx, 1450, 545, 76, 14, 'rgba(90,210,195,0.16)');
      A.cracks(ctx, 60, 470, 300, 110, 161, 'rgba(0,0,0,0.35)'); A.cracks(ctx, 780, 480, 280, 100, 162, 'rgba(0,0,0,0.35)'); A.cracks(ctx, 1320, 470, 260, 110, 163, 'rgba(0,0,0,0.35)');
      // Krüge und Taurollen am hinteren Rand des Gehwegs
      A.amphora(ctx, 250, 480, 40, '#4c5e5a'); A.ell(ctx, 250, 481, 12, 3, 'rgba(0,0,0,0.35)');
      ctx.save(); ctx.beginPath(); ctx.rect(270, 462, 30, 20); ctx.clip(); A.amphora(ctx, 284, 482, 38, '#3e4e4a'); ctx.restore();
      A.pebbles(ctx, 262, 470, 40, 12, 165, '#5a6a66');
      for (let k = 0; k < 4; k++) A.ell(ctx, 1010 + k * 2, 470 - k * 3, 20 - k * 2, 7 - k, null, '#5a6a5c', 3);
      // Anker, an den Kanalrand gelehnt
      A.ell(ctx, 424, 492, 22, 5, 'rgba(0,0,0,0.35)');
      anchor(ctx, 420, 440, 52);
      // Umgestürzte Säule rechts der Brücke
      A.ell(ctx, 1378, 492, 58, 7, 'rgba(0,0,0,0.35)');
      drum(ctx, 1326, 460, 92, 30, '#587c7c'); drum(ctx, 1338, 490, 60, 22, '#4e6e6c');
      A.ell(ctx, 1326, 475, 5, 15, '#3e5e5c');
      // Kristallgruppe neben dem Podest
      A.ell(ctx, 1062, 478, 26, 5, 'rgba(0,0,0,0.3)');
      A.crystal(ctx, 1044, 474, 14, 30, '#6fe0c8'); A.crystal(ctx, 1056, 478, 18, 42, '#8ff0dc'); A.crystal(ctx, 1072, 476, 12, 24, '#6fe0c8');
      A.glow(ctx, 1062, 460, 44, TEAL, 0.4);
      // Geröll links: der Gang zur Hebebühne
      A.rect(ctx, 0, 120, 60, 480, '#101c20');
      for (let i = 0; i < 14; i++) A.rock(ctx, -10 + (i * 37) % 90, 300 + (i * 53) % 260, 40 + (i % 3) * 18, 30 + (i % 2) * 14, '#4a5a58', i + 3);
      // Brücke
      if (g.flag('bruecke_unten')) {
        ctx.fillStyle = A.grad(ctx, 0, 448, 0, 600, ['#587a78', '#2e4a4a']);
        ctx.fillRect(1100, 452, 200, 148);
        for (let i = 0; i < 6; i++) A.line(ctx, 1100 + i * 40, 452, 1100 + i * 40, 600, 'rgba(0,0,0,0.3)', 2);
        A.rect(ctx, 1100, 448, 200, 6, '#7aa09c');
      } else {
        ctx.save(); ctx.translate(1300, 452); ctx.rotate(-1.35);
        ctx.fillStyle = A.grad(ctx, 0, 0, 200, 0, ['#587a78', '#2e4a4a']);
        ctx.fillRect(0, -12, 200, 24);
        for (let i = 0; i < 6; i++) A.line(ctx, i * 40, -12, i * 40, 12, 'rgba(0,0,0,0.3)', 2);
        ctx.restore();
        A.chain(ctx, 1252, 260, 1290, 150, '#6a8a88');
      }
      A.rect(ctx, 1290, 140, 22, 310, '#3e5c5e'); A.rect(ctx, 1286, 136, 30, 10, '#5a7e7e');
      // Podest mit drei Sockeln
      A.rect(ctx, 976, 372, 50, 78, '#3a5658'); A.rect(ctx, 970, 366, 62, 10, '#587c7c');
      for (let i = 0; i < 3; i++) { A.circle(ctx, 986 + i * 15, 384, 5, '#0a1618'); if (g.flag('bruecke_unten')) { A.circle(ctx, 986 + i * 15, 384, 4, '#5fd8b0'); A.glow(ctx, 986 + i * 15, 384, 20, TEAL, 0.5); } }
      A.rr(ctx, 978, 400, 46, 30, 3, '#2e4648'); A.spirals(ctx, 980, 404, 44, 20, 'rgba(120,255,225,0.5)');
      // Tor zum Tempel rechts
      A.rect(ctx, 1430, 130, 170, 320, '#1a2c30');
      A.arch(ctx, 1450, 170, 130, 280, '#5a8a84', '#03080c');
      A.glow(ctx, 1515, 330, 120, 'rgba(90,240,210,0.6)', 0.3);
      A.text(ctx, 'ΠΟΣΕΙΔΩΝ', 1515, 160, { font: 'bold 16px Georgia', color: '#8fe0d0', align: 'center' });
      A.spirals(ctx, 1436, 136, 160, 14, 'rgba(120,255,225,0.3)');
      A.cobweb(ctx, 1452, 300, 26, 'tl', 'rgba(255,255,255,0.16)');
      lime(ctx, 1436, 132, 160, 80, 124, 8);
      // Maschinenkrebs
      crab(ctx, 630, 440, g.flag('krebs_offen'));
      A.ell(ctx, 640, 478, 90, 8, 'rgba(0,0,0,0.3)');
      // Metalltafel am Boden
      if (!g.flag('schriftrolle_genommen')) { A.rr(ctx, 336, 536, 40, 22, 3, '#4fb0a0'); for (let i = 0; i < 3; i++) A.line(ctx, 341, 541 + i * 6, 371, 541 + i * 6, '#1a4a40', 1.2); }
      A.vignette(ctx, 1600, 600, 0.55);
      A.grain(ctx, 1600, 600, 4, 0.05);
    },
    paintFront(ctx) {
      // Kette, die von der Decke über dem Seitenkanal hängt
      A.chain(ctx, 1182, -4, 1184, 112, '#5a7a78');
      ctx.strokeStyle = '#6a8a88'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(1188, 120, 7, Math.PI * 1.1, Math.PI * 2.3); ctx.stroke();
      // Tropfsteinzacken mit Kristall, ganz vorn oben
      A.poly(ctx, [660, 0, 760, 0, 740, 30, 716, 88, 700, 34, 686, 60, 672, 22], '#03090c');
      A.crystal(ctx, 722, 70, 10, -22, 'rgba(120,240,215,0.7)');
      // Kristallnest in der Ecke unten rechts
      A.crystal(ctx, 1548, 600, 18, 42, '#5fd0b8'); A.crystal(ctx, 1566, 600, 22, 56, '#7fe6cc'); A.crystal(ctx, 1586, 600, 14, 34, '#5fd0b8');
      A.glow(ctx, 1572, 580, 50, TEAL, 0.35);
    },
    animate(ctx, t, g) {
      A.waterAnim(ctx, 0, 396, 1600, 48, t, 'rgba(160,255,235,0.14)');
      A.waterAnim(ctx, 1104, 396, 192, 200, t * 0.8, 'rgba(160,255,235,0.14)');
      fishSchool(ctx, 4, 398, 1092, 46, t, 7, 'rgba(6,45,45,0.55)', 0);
      fishSchool(ctx, 1304, 398, 292, 46, t * 0.9, 3, 'rgba(6,45,45,0.55)', 90);
      mist(ctx, 0, 392, 1600, t, 7);
      const p = 0.5 + Math.sin(t * 1.5) * 0.15;
      for (let x = 150; x < 1600; x += 300) A.glow(ctx, x, 260, 70, 'rgba(90,240,210,0.5)', p * 0.4);
      for (let x = 150; x < 1600; x += 150) A.glow(ctx, x, 214, 14, 'rgba(120,255,225,0.7)', 0.25 + Math.sin(t * 1.5 + x * 0.01) * 0.15);
      drip(ctx, 560, 96, 396, t, 0); drip(ctx, 1230, 80, 396, t, 0.45); drip(ctx, 1440, 110, 446, t, 0.7);
      if (!g.flag('krebs_offen')) A.glow(ctx, 630, 445, 30 + Math.sin(t * 3) * 6, 'rgba(90,255,210,0.7)', 0.4);
    },
    hotspots: [
      { id: 'garten', name: 'Versteinerter Garten', rect: [70, 96, 1500, 56], z: 2, noWalk: true,
        look: 'Hinter der Mauerkrone: Bäume. Aus Stein, ohne ein Blatt. Platon schreibt von Gärten und einer Rennbahn auf dem Ring. Die Gärtner sind fort, die Bäume haben es nicht gemerkt.' },
      { id: 'wrack', name: 'Bootswrack', rect: [846, 380, 110, 68], z: 2, at: [900, 484, 'u'],
        look: 'Ein Boot, oder das Gerippe davon, halb im Kanal. Wer hier zuletzt gerudert ist, hatte es nicht eilig zurückzukommen.' },
      { id: 'anker', name: 'Anker', rect: [396, 434, 50, 62], z: 2, at: [450, 512, 'l'],
        look: 'Ein Anker aus dem grünen Metall, an den Kanalrand gelehnt. Kein Rost, nach dreitausend Jahren. Ich fange an, das persönlich zu nehmen.' },
      { id: 'geroell', name: 'Geröll', rect: [0, 280, 70, 300], at: [90, 520, 'l'],
        look: 'Der Gang zur Hebebühne. Oder das, was davon übrig ist: Brocken, so groß wie Schreibtische.',
        use: 'Ich habe es versucht. Die kleinen Steine bewegen sich, die großen nicht.', push: 'Ich habe es versucht. Die kleinen Steine bewegen sich, die großen nicht.', pull: 'Da rührt sich nichts.',
        useWith: { schaufel: 'Das ist kein Sand. Das ist ein Berg.', brecheisen: 'Damit hebele ich einen Brocken heraus, und drei rutschen nach.', default: 'Das hilft gegen einen Berg nicht.' } },
      { id: 'kanal', name: 'Kanal', rect: [70, 392, 1030, 56], at: [500, 480, 'u'],
        look: async (g) => { await g.say('falk', 'Wasser, das von selbst leuchtet. Es fließt, ohne dass ich ein Gefälle sehe.'); if (!g.flag('kanal_kommentar')) { g.set('kanal_kommentar'); await g.say('falk', 'Platon schreibt von Ringen aus Wasser und Land um die Stadt. Das hier wäre der äußere.'); g.codex('ringe'); } },
        use: 'Ich stecke die Hand nicht in Wasser, das leuchtet.', take: 'Womit? Und wozu?',
        useWith: { flasche: 'Nein. Ich weiß nicht, was das ist, und ich will es nicht trinken.', default: 'Ins Wasser? Lieber nicht.' } },
      { id: 'mauer', name: 'Zyklopenmauer', rect: [70, 150, 1030, 240], at: [500, 480, 'u'],
        look: 'Blöcke, so groß wie Lastwagen, ohne Mörtel gesetzt. In den Fugen leuchten Adern von etwas Grünem. Orichalkum, würde Vesper sagen.',
        take: 'Ein Block wiegt mehr als das Institut.', use: 'Ich klopfe. Es klingt nach Stein.', push: 'Sie steht seit ein paar tausend Jahren. Sie bleibt.' },
      { id: 'saeulen', name: 'Säulen', rect: [130, 130, 40, 260], at: [150, 480, 'u'],
        look: 'Säulen, wie ich sie noch nirgends gesehen habe. Kein Kapitell, keine Kannelierung, nur diese schrägen Rillen, die leuchten.' },
      { id: 'decke', name: 'Höhlendecke', rect: [70, 0, 1500, 130], noWalk: true,
        look: 'Tropfsteine, hoch oben. Die Höhle ist größer als jede Kathedrale. Und sie hat ein Echo, das mir nicht gefällt.' },
      { id: 'schriftrolle', name: 'Metalltafel', rect: [330, 528, 52, 34], at: [356, 560, 'u'], cond: (g) => !g.flag('schriftrolle_genommen'),
        look: 'Eine dünne Tafel aus grünlichem Metall, halb unter Staub. Mit Zeichen darauf.',
        take: async (g) => { g.set('schriftrolle_genommen'); g.take('schriftrolle'); g.repaint(); await g.say('falk', 'Leicht wie Blech, aber ich kann sie nicht biegen. Zeilen aus Spiralen und Punkten.'); await g.say('falk', 'Keine Schrift, die ich kenne. Livia hat sich mit so etwas beschäftigt. Wenn ich sie finde.'); g.codex('ringe'); },
        use: (g) => g.hs('schriftrolle').take(g) },
      { id: 'krebs', name: 'Maschinenkrebs', rect: [510, 360, 250, 120], at: [630, 512, 'u'],
        look: (g) => g.flag('krebs_offen') ? 'Der Krebs. Die Klappe steht offen, die Fassung ist leer.' : 'Eine Maschine in Form eines Krebses, so groß wie ein Auto. Sie liegt schief, ein Bein im Kanal. Unter dem Panzer leuchtet etwas.',
        take: 'Er wiegt mehr als ich. Und er hat Scheren.',
        use: (g) => g.flag('krebs_offen') ? 'Er ist tot. Toter geht nicht.' : 'Ich taste den Panzer ab. Da ist eine Klappe, aber sie sitzt fest. Verklemmt, seit wer weiß wann.',
        open: (g) => g.flag('krebs_offen') ? 'Sie ist schon offen.' : 'Die Klappe sitzt fest. Mit bloßen Händen reiße ich mir nur die Nägel ab.',
        push: 'Er rührt sich nicht. Zum Glück.', pull: 'Er rührt sich nicht. Zum Glück.',
        talk: 'Er hat keine Ohren. Jedenfalls keine, die ich erkenne.',
        useWith: {
          brecheisen: async (g) => {
            if (g.flag('krebs_offen')) return 'Die Klappe ist offen. Da ist nichts mehr.';
            await g.say('falk', 'Das Brecheisen in den Spalt, und dann mit Gewicht…');
            g.fx('stone'); g.anim('falk', 'reach'); await g.wait(600); g.anim('falk', 'stand');
            g.set('krebs_offen'); g.repaint();
            await g.say('falk', 'Die Klappe springt auf. Darunter drei Perlen in einer Fassung, jede so groß wie die aus der Figur.');
            g.take('perlen'); g.set('perlen', 3);
            await g.say('falk', 'Sie sind warm. Sie summen. Ich nehme sie, bevor ich mir das überlege.');
            g.codex('orichalkum');
          },
          taschenmesser: 'Die Klinge bricht ab, bevor die Klappe nachgibt.', schaufel: 'Der Spaten biegt sich. Ich brauche etwas Stabileres.', seil: 'Ich könnte ihn festbinden. Er läuft aber nicht weg.',
          default: 'Damit komme ich an die Klappe nicht heran.' } },
      { id: 'podest', name: 'Podest mit drei Sockeln', rect: [966, 360, 70, 90], at: [1000, 508, 'u'],
        look: (g) => g.flag('bruecke_unten') ? 'Das Podest. Drei Perlen in drei Fassungen, alle leuchten.' : 'Ein Podest aus Stein, kniehoch. Oben drei leere Fassungen, so groß wie Haselnüsse. Darunter eine Spirale.',
        use: (g) => g.flag('bruecke_unten') ? 'Es tut, was es soll.' : 'Drei leere Fassungen. Drei Fassungen brauchen drei Dinge, die hineinpassen.',
        push: 'Das Podest ist Teil des Bodens.', pull: 'Das Podest ist Teil des Bodens.', take: 'Es ist aus dem Fels gehauen.',
        useWith: {
          perlen: async (g) => {
            await g.say('falk', 'Eine Perle in jede Fassung.');
            g.drop('perlen'); g.set('perlen', 0); g.fx('glow');
            await g.wait(500);
            g.set('bruecke_unten'); g.repaint(); g.unblockWalk('bruecke');
            g.fx('stone');
            await g.message('Ketten rasseln. Die Brücke senkt sich, langsam, und legt sich über den Kanal.', 2600);
            await g.say('falk', 'Drei Perlen, eine Brücke. Vesper hätte gesagt: Das ist erst der Anfang.');
            g.objective('Über die Brücke in den Tempel gehen.');
          },
          muenzen: 'Falsche Währung.', flasche: 'Das Podest hat keinen Durst.',
          default: 'Das passt nicht in die Fassungen.' } },
      { id: 'bruecke', name: 'Brücke', rect: [1100, 150, 220, 300], at: [1060, 520, 'r'],
        look: (g) => g.flag('bruecke_unten') ? 'Die Brücke liegt. Stein, breit genug für einen Wagen.' : 'Eine Brücke aus Stein, hochgezogen wie eine Zugbrücke. Die Ketten führen in die Wand. Kein Hebel, keine Winde.',
        pull: (g) => g.flag('bruecke_unten') ? 'Sie liegt schon.' : 'Ich ziehe an der Kette. Ich könnte genauso gut an der Mauer ziehen.',
        use: (g) => g.flag('bruecke_unten') ? 'Ich gehe einfach hinüber.' : 'Von hier aus komme ich nicht hin. Und springen? Zehn Meter, und unten leuchtendes Wasser.',
        push: 'Das Ding wiegt Tonnen.',
        useWith: { seil: 'Zu weit und zu hoch. Und woran sollte ich es festmachen?', default: 'Das bringt die Brücke nicht herunter.' } },
      { id: 'seitenkanal', name: 'Seitenkanal', rect: [1100, 452, 200, 148], at: [1060, 520, 'r'], cond: (g) => !g.flag('bruecke_unten'),
        look: 'Ein Kanal, der vom Hauptkanal abzweigt und unter dem Gehweg verschwindet. Tief, und das Wasser leuchtet.', use: 'Schwimmen? In dem Zeug? Nein.' },
    ],
    get exits() {
      const g = ATL.game;
      const unten = !!(g && g.state && g.flag('bruecke_unten'));
      return [
        { id: 'tor', name: 'Tor zum Tempel', rect: [1440, 160, 150, 290], at: [1515, 500, 'u'], to: 'at_middle', pos: [480, 560], dir: 'u', noWalk: !unten,
          look: 'Ein Torbogen, hoch wie ein Haus, mit griechischen Buchstaben darüber. Poseidon. Dahinter Licht.',
          before: async (g) => { if (g.flag('bruecke_unten')) return true; await g.say('falk', 'Da komme ich nicht hin. Die Brücke ist oben.'); return false; } },
      ];
    },
    async enter(g) {
      if (!g.flag('bruecke_unten')) g.blockWalk('bruecke', [1100, 440, 1300, 440, 1300, 600, 1100, 600]);
      if (g.flag('at_angekommen')) return;
      g.set('at_angekommen');
      await g.scene(async () => {
        await g.message('Unter Thera. Tiefer, als der Berg hoch ist.', 2400);
        g.fx('stone');
        await g.message('Der Staub legt sich. Hinter Falk liegt der Gang zur Hebebühne unter Geröll.', 2600);
        g.face('falk', 'l');
        await g.say('falk', 'Das war der Rückweg. Vesper wird einen anderen kennen. Er kennt immer einen anderen.');
        g.face('falk', 'r');
        await g.say('falk', 'Und das hier… Eine Mauer, ein Kanal, und Wasser, das leuchtet.');
        await g.say('falk', 'Platon hat das beschrieben. Ringe aus Wasser und Land. Ich habe es für einen Satzbauplan gehalten.');
        await g.say('falk', 'Livia ist irgendwo da vorn. Mit Kessler. Das ist die einzige Richtung, die es gibt.');
        g.objective('Einen Weg über den Kanal zum Tempel finden. Livia ist bei Vespers Leuten.');
      });
    },
  });

  // ---------------------------------------------------------------- Tempel des Poseidon
  const KINGS = [
    ['atlas', 'Atlas', 'Ἄτλας', 'Atlas, der Erstgeborene. Poseidon machte ihn zum König über die ganze Insel. Nach ihm heißt sie, sagt Platon, und das Meer um sie herum.'],
    ['gadeiros', 'Gadeiros', 'Γάδειρος', 'Gadeiros, der Zwilling des Atlas. Auf Griechisch Eumelos. Er bekam den Landstrich gegenüber Gadeira, dem heutigen Cádiz.'],
    ['ampheres', 'Ampheres', 'Ἀμφήρης', 'Ampheres, der Ältere des zweiten Paars. Bei Platon nur ein Name in einer Liste. Hier hat er ein Gesicht.'],
    ['euaimon', 'Euaimon', 'Εὐαίμων', 'Euaimon, Zwilling des Ampheres. Platon nennt ihn, sonst niemand.'],
    ['mneseus', 'Mneseus', 'Μνησεύς', 'Mneseus, drittes Paar, der Ältere. Der Name klingt nach Erinnerung. Vielleicht Zufall, vielleicht nicht.'],
    ['autochthon', 'Autochthon', 'Αὐτόχθων', 'Autochthon, „der aus der Erde Geborene“. So nannten sich auch die Athener, die bei Platon gegen Atlantis kämpfen.'],
    ['elasippos', 'Elasippos', 'Ἐλάσιππος', 'Elasippos, „der Pferdetreiber“. Viertes Paar. Poseidon war auch der Gott der Pferde.'],
    ['mestor', 'Mestor', 'Μήστωρ', 'Mestor, Zwilling des Elasippos. „Der Ratgeber“. Er sieht nicht aus, als hätte man ihn oft gefragt.'],
    ['azaes', 'Azaes', 'Ἀζάης', 'Azaes, fünftes Paar, der Ältere. Über ihn steht bei Platon nicht mehr als der Name.'],
    ['diaprepes', 'Diaprepes', 'Διαπρεπής', 'Diaprepes, der Jüngste. „Der Hervorragende“. Ein großer Name für den Letzten in der Reihe.'],
  ];
  const KING_X = [75, 135, 195, 255, 315, 675, 735, 795, 855, 915];
  const pressKing = async (g, id, name) => {
    if (g.flag('koenige_offen')) return 'Die Hand ist unten, die Tür ist offen. Das reicht.';
    const seq = g.flag('koenige_seq') || '';
    g.fx('click');
    if (id === 'atlas' && seq === '') {
      g.set('koenige_seq', 'atlas'); g.repaint();
      await g.say('falk', 'Die Hand des Atlas senkt sich ein Stück. Hinter der Wand klickt etwas und bleibt stehen.');
      return;
    }
    if (id === 'atlas' && seq === 'atlas') return 'Die Hand ist unten. Sie wartet auf jemanden.';
    if (id === 'gadeiros' && seq === 'atlas') {
      g.set('koenige_seq', 'fertig'); g.set('koenige_offen'); g.repaint();
      g.fx('stone');
      await g.message('Ein tiefes Rollen im Stein. Im Sockel des Standbilds öffnet sich ein Durchgang.', 2600);
      await g.say('falk', 'Der Erstgeborene, mit seinem Zwilling an der Hand. Solon hat das notiert. Ich habe es für Poesie gehalten.');
      g.codex('zehnkoenige');
      g.objective(g.flag('livia_frei') ? 'Mit Livia ins Innere gehen. Vesper wartet.' : 'Livia aus den Zellen holen, dann ins Innere.');
      return;
    }
    g.set('koenige_seq', ''); g.repaint();
    g.fx('fail');
    if (seq === 'atlas') await g.say('falk', `Die Hand des ${name} geht hinunter, dann ein dumpfer Schlag: Beide Hände heben sich wieder. Falscher Zwilling.`);
    else await g.say('falk', `Die Hand des ${name} senkt sich, klickt, und hebt sich sofort wieder. Das war nicht der Anfang.`);
  };

  R({
    id: 'at_middle', name: 'Tempel des Poseidon', ambient: 'atlantis',
    start: [480, 560, 'u'],
    walk: [[30, 452, 930, 452, 940, 585, 20, 585]],
    scale: { y0: 420, s0: 0.78, y1: 585, s1: 1.05 },
    paint(ctx, g) {
      cave(ctx, 960, 600, 7);
      // Sternkarte an der Decke: Bahnen und Sternbilder
      {
        const r = ATL.U.rng(171);
        A.ell(ctx, 480, 10, 430, 76, null, 'rgba(120,255,225,0.14)', 1.5);
        A.ell(ctx, 480, 10, 300, 52, null, 'rgba(120,255,225,0.1)', 1);
        for (let c = 0; c < 6; c++) {
          const cx = 80 + c * 160 + r() * 40, cy = 20 + r() * 50;
          let px = cx, py = cy;
          for (let k = 0; k < 4; k++) {
            const nx = px + (r() - 0.5) * 50, ny = py + (r() - 0.5) * 34;
            A.line(ctx, px, py, nx, ny, 'rgba(120,255,225,0.22)', 1);
            A.circle(ctx, nx, ny, 1.5 + r(), 'rgba(180,255,240,0.7)');
            px = nx; py = ny;
          }
          A.circle(ctx, cx, cy, 2, 'rgba(180,255,240,0.8)');
        }
      }
      // Wände aus Orichalkum-Platten
      ctx.fillStyle = A.grad(ctx, 0, 100, 0, 450, ['#123034', '#1c4448', '#122c30']);
      ctx.fillRect(0, 100, 960, 350);
      for (let x = 0; x < 960; x += 80) for (let y = 100; y < 450; y += 70) A.rr(ctx, x + 2, y + 2, 76, 66, 4, null, 'rgba(120,255,225,0.12)', 1);
      {
        // Metallglanz auf manchen Platten, fehlende Platten, Kalk
        const r = ATL.U.rng(173);
        for (let x = 0; x < 960; x += 80) for (let y = 170; y < 450; y += 70) {
          const k = r();
          if (k < 0.22) { ctx.fillStyle = A.grad(ctx, x, y, x + 76, y + 66, ['rgba(200,255,240,0)', 'rgba(200,255,240,0.09)', 'rgba(200,255,240,0)']); ctx.fillRect(x + 2, y + 2, 76, 66); }
          else if (k < 0.3) { A.rr(ctx, x + 3, y + 3, 74, 64, 4, '#0b1c20'); A.cracks(ctx, x + 6, y + 6, 68, 56, Math.floor(x + y), 'rgba(0,0,0,0.5)'); }
        }
        lime(ctx, 0, 118, 960, 90, 174, 14);
      }
      veins(ctx, 0, 110, 960, 320, 14, 10);
      A.meander(ctx, 0, 104, 960, 14, 'rgba(120,255,225,0.35)');
      // Pferdefries unter dem Mäander
      A.rect(ctx, 0, 122, 960, 26, 'rgba(0,0,0,0.22)');
      A.line(ctx, 0, 122, 960, 122, 'rgba(160,255,235,0.15)', 1); A.line(ctx, 0, 148, 960, 148, 'rgba(0,0,0,0.35)', 1);
      for (let x = 30; x < 960; x += 64) horse(ctx, x, 138, 0.13, 'rgba(120,255,225,0.32)');
      // Nischen mit Weihegeschenken
      for (const nx of [110, 220, 740, 850]) {
        A.rect(ctx, nx - 22, 190, 44, 66, '#071418'); A.ell(ctx, nx, 190, 22, 22, '#071418');
        A.glow(ctx, nx, 220, 34, 'rgba(210,180,90,0.5)', 0.22);
        A.rect(ctx, nx - 24, 254, 48, 4, '#2c4c4e');
        A.amphora(ctx, nx - 10, 254, 20, '#8a7a3a');
        A.pot(ctx, nx + 8, 254, 12, 8, '#a08a3c');
        A.rr(ctx, nx + 1, 232, 6, 20, 2, '#b89a4a'); A.circle(ctx, nx + 4, 230, 3.5, '#c8aa5a');
        for (let k = 0; k < 4; k++) A.circle(ctx, nx - 16 + k * 4, 251 - (k % 2) * 2, 1.5, '#d8c070');
      }
      // Kalk und Risse an der Wand
      A.cracks(ctx, 600, 160, 120, 120, 175, 'rgba(0,0,0,0.4)'); A.cracks(ctx, 100, 280, 160, 60, 176, 'rgba(0,0,0,0.35)');
      // Seitengang zu den Zellen
      A.rect(ctx, 0, 250, 56, 200, '#03080c');
      A.poly(ctx, [0, 250, 56, 262, 56, 450, 0, 450], '#050d12');
      A.rect(ctx, 52, 246, 8, 206, '#2a4a4e');
      // Vorhang aus Metallketten vor dem Seitengang
      A.rect(ctx, 0, 244, 56, 6, '#3a5e5c');
      for (let x = 4; x < 54; x += 7) A.chain(ctx, x, 250, x + (x % 3) - 1, 438, 'rgba(150,185,180,0.5)');
      A.rubble(ctx, 54, 428, 50, 24, 177, '#3a5250');
      // Sockel des Standbilds mit dem Tor ins Innere
      ctx.fillStyle = A.grad(ctx, 400, 0, 560, 0, ['#2a4a4c', '#4a7270', '#2a4a4c']);
      ctx.fillRect(400, 296, 160, 154);
      A.cracks(ctx, 404, 300, 150, 140, 178, 'rgba(0,0,0,0.4)');
      A.rect(ctx, 392, 290, 176, 10, '#5a8280');
      A.line(ctx, 392, 291, 568, 291, 'rgba(255,255,255,0.25)', 1);
      // Kandelaber auf dem Sockel, links und rechts des Bogens
      candelabrum(ctx, 420, 446, 110); candelabrum(ctx, 540, 446, 110);
      if (g.flag('koenige_offen')) { A.arch(ctx, 448, 318, 64, 132, '#6a9a94', '#02090c'); A.glow(ctx, 480, 400, 60, 'rgba(90,240,210,0.7)', 0.35); }
      else { A.arch(ctx, 448, 318, 64, 132, '#6a9a94', '#1e3c40'); for (let i = 0; i < 4; i++) A.line(ctx, 452, 360 + i * 22, 508, 360 + i * 22, 'rgba(0,0,0,0.3)', 2); A.spirals(ctx, 452, 336, 56, 16, 'rgba(120,255,225,0.4)'); }
      // Wagen mit sechs geflügelten Pferden und Poseidon
      const sil = '#0b1e24';
      A.glow(ctx, 480, 150, 220, 'rgba(70,200,180,0.5)', 0.3);
      for (let i = 0; i < 3; i++) { horse(ctx, 300 + i * 26, 250 - i * 22, 0.8 - i * 0.1, sil); horse(ctx, 660 - i * 26, 250 - i * 22, 0.8 - i * 0.1, sil); }
      A.rr(ctx, 420, 210, 120, 70, 10, sil); A.circle(ctx, 432, 282, 18, sil); A.circle(ctx, 528, 282, 18, sil);
      A.circle(ctx, 432, 282, 6, '#1e3c40'); A.circle(ctx, 528, 282, 6, '#1e3c40');
      A.statue(ctx, 480, 226, 200, '#1a3a40', 'trident');
      A.glow(ctx, 480, 100, 60, 'rgba(90,240,210,0.6)', 0.3);
      // Die zehn Könige
      const seq = g.flag('koenige_seq') || '';
      KINGS.forEach((k, i) => kingStatue(ctx, KING_X[i], 420, 96, k[2], g.flag('koenige_offen') ? (i < 2) : (seq === 'atlas' && i === 0)));
      // Altar und Säule der Gesetze
      A.rect(ctx, 580, 402, 62, 48, '#1a2628'); A.rect(ctx, 576, 396, 70, 10, '#2e4244');
      A.rect(ctx, 584, 388, 54, 8, '#3a4e50'); A.ell(ctx, 611, 388, 20, 5, '#101a1c');
      A.meander(ctx, 582, 414, 58, 10, 'rgba(120,255,225,0.35)');
      A.column(ctx, 362, 450, 130, 22, '#6a8e8a', 'atlantis');
      A.text(ctx, 'ΝΟΜΟΙ', 362, 304, { font: 'bold 9px Georgia', color: '#8fe0d0', align: 'center' });
      // Boden mit Perspektive
      A.floorTiles(ctx, 960, 450, 600, '#2e4e50', '#142628', 12, 480);
      // Mosaik: die Ringe der Stadt als Grundriss, in der Mitte der Dreizack
      {
        const r = ATL.U.rng(181);
        for (let k = 0; k < 4; k++) {
          const rx = 160 - k * 36, ry = 34 - k * 7.5;
          A.ell(ctx, 480, 512, rx, ry, k % 2 ? '#1a3234' : '#24484a');
          A.ell(ctx, 480, 512, rx, ry, null, 'rgba(120,255,225,0.28)', 1.5);
        }
        A.ell(ctx, 480, 512, 16, 4, '#0c1c1e');
        A.line(ctx, 480, 500, 480, 522, 'rgba(120,255,225,0.6)', 2); A.line(ctx, 470, 504, 490, 504, 'rgba(120,255,225,0.6)', 2);
        A.line(ctx, 470, 504, 470, 500, 'rgba(120,255,225,0.6)', 2); A.line(ctx, 490, 504, 490, 500, 'rgba(120,255,225,0.6)', 2);
        for (let i = 0; i < 60; i++) { const a = r() * TAU, rr = 0.25 + r() * 0.75; ctx.fillStyle = r() < 0.3 ? 'rgba(200,180,90,0.4)' : 'rgba(0,0,0,0.22)'; ctx.fillRect(480 + Math.cos(a) * 160 * rr, 512 + Math.sin(a) * 34 * rr, 3, 2); }
        for (let i = 0; i < 5; i++) { const a = r() * TAU, rr = 0.3 + r() * 0.6; A.ell(ctx, 480 + Math.cos(a) * 160 * rr, 512 + Math.sin(a) * 34 * rr, 6 + r() * 6, 3, '#0f1e20'); }
      }
      A.cracks(ctx, 60, 470, 220, 110, 182, 'rgba(0,0,0,0.35)'); A.cracks(ctx, 700, 480, 220, 100, 183, 'rgba(0,0,0,0.35)');
      A.puddle(ctx, 330, 566, 60, 10, 'rgba(90,210,195,0.14)'); A.puddle(ctx, 660, 476, 46, 8, 'rgba(90,210,195,0.14)');
      A.rect(ctx, 0, 448, 960, 6, '#5a8280');
      A.rect(ctx, 0, 452, 960, 4, 'rgba(0,0,0,0.3)');
      // Weihegefäße zu Füßen der Könige
      A.ell(ctx, 105, 465, 8, 2.5, 'rgba(0,0,0,0.35)'); A.amphora(ctx, 105, 464, 24, '#4c5e5a');
      A.pot(ctx, 225, 462, 16, 10, '#5a6a5c');
      A.pot(ctx, 705, 462, 14, 9, '#5a6a5c');
      A.ell(ctx, 825, 465, 8, 2.5, 'rgba(0,0,0,0.35)'); A.amphora(ctx, 825, 464, 22, '#3e4e4a');
      ctx.save(); ctx.beginPath(); ctx.rect(870, 448, 40, 12); ctx.clip(); A.amphora(ctx, 885, 466, 24, '#4c5e5a'); ctx.restore();
      A.pebbles(ctx, 872, 456, 40, 8, 184, '#4a5a56');
      A.vignette(ctx, 960, 600, 0.5);
      A.grain(ctx, 960, 600, 5, 0.05);
    },
    paintFront(ctx) {
      // Dreifüße mit Opferschalen, ganz vorn in den Ecken
      tripod(ctx, 40, 594, 84); tripod(ctx, 924, 596, 84);
      // Kettenvorhang, der von der Decke rechts hängt
      A.rect(ctx, 760, 0, 200, 5, '#3a5e5c');
      for (let x = 766; x < 960; x += 12) A.chain(ctx, x, 4, x + (x % 3) - 1, 44 + (x % 5) * 8, 'rgba(150,185,180,0.4)');
    },
    animate(ctx, t, g) {
      const p = 0.45 + Math.sin(t * 1.2) * 0.15;
      A.glow(ctx, 480, 140, 160, 'rgba(90,240,210,0.5)', p * 0.5);
      A.dust(ctx, 340, 60, 280, 240, t * 0.35, 16, 'rgba(160,255,235,0.22)');
      // kalte Flammen der Kandelaber
      for (const x of [420, 540]) for (const k of [-1, 0, 1]) {
        const fx = x + k * 22, fy = 347, f = 1 + Math.sin(t * 6 + fx) * 0.2;
        A.glow(ctx, fx, fy - 4, 18 * f, 'rgba(200,255,245,0.8)', 0.4);
        A.ell(ctx, fx, fy - 5 * f, 2.2, 6 * f, 'rgba(220,255,250,0.85)');
      }
      if (g.flag('koenige_offen')) A.glow(ctx, 480, 410, 50 + Math.sin(t * 2) * 8, 'rgba(90,255,220,0.8)', 0.5);
    },
    animateFront(ctx, t) {
      for (const x of [40, 924]) {
        const f = 1 + Math.sin(t * 5 + x) * 0.2;
        A.glow(ctx, x, 528, 34 * f, 'rgba(200,255,245,0.8)', 0.35);
        A.ell(ctx, x, 530 - 8 * f, 5, 12 * f, 'rgba(210,255,248,0.75)');
        A.ell(ctx, x + Math.sin(t * 9) * 2, 530 - 10 * f, 2, 6 * f, 'rgba(255,255,255,0.9)');
      }
    },
    get hotspots() {
      const list = KINGS.map((k, i) => ({
        id: 'koenig_' + k[0], name: 'Statue: ' + k[1], rect: [KING_X[i] - 26, 322, 52, 116], at: [KING_X[i], 470, 'u'],
        look: async (g) => { await g.say('falk', k[3]); g.codex('zehnkoenige'); },
        push: (g) => pressKing(g, k[0], k[1]),
        use: (g) => pressKing(g, k[0], k[1]),
        pull: 'Die Hand lässt sich nicht ziehen. Nur drücken.',
        take: 'Die Statue ist mannshoch und aus Stein.',
        talk: 'Er hat mich seit dreitausend Jahren nicht gehört. Warum jetzt.',
      }));
      list.push(
        { id: 'poseidon', name: 'Standbild des Poseidon', rect: [300, 60, 360, 236], at: [480, 480, 'u'],
          look: async (g) => { await g.say('falk', 'Poseidon auf seinem Wagen. Sechs geflügelte Pferde, der Dreizack, und er so hoch, dass sein Kopf die Decke berührt.'); await g.say('falk', 'Genau so steht es im Kritias. Wort für Wort. Entweder hat Platon das hier gesehen, oder jemand hat Platon gelesen.'); g.codex('poseidon'); },
          use: 'Ich habe keinen Stier zu opfern.', take: 'Ich nehme nichts mit, was höher ist als ein Haus.', talk: 'Er ist beschäftigt. Er erschüttert die Erde.' },
        { id: 'altar', name: 'Altar', rect: [572, 380, 78, 70], at: [611, 480, 'u'],
          look: async (g) => { await g.say('falk', 'Ein Altar aus schwarzem Stein, in der Mitte eine Schale. Hier, sagt Platon, opferten die Könige einen Stier und schworen auf die Gesetze.'); await g.say('falk', 'Die Schale ist trocken. Der letzte Schwur ist lange her.'); g.codex('stier'); },
          use: 'Ich habe nichts zu opfern und nichts zu schwören.', take: 'Er ist Teil des Bodens.', open: 'Ein Altar ist keine Kiste.',
          useWith: { flasche: 'Wasser statt Stierblut. Poseidon würde sich bedanken. Oder nicht.', default: 'Das gehört nicht auf einen Altar.' } },
        { id: 'saeule', name: 'Säule der Gesetze', rect: [346, 296, 34, 154], at: [362, 480, 'u'],
          look: async (g) => { await g.say('falk', 'Eine Säule aus dem grünen Metall, eng beschrieben. „Nomoi“, Gesetze. Platon sagt, die Könige hätten ihre Gesetze auf einer Säule aus Orichalkum bewahrt, mitten im Tempel.'); await g.say('falk', 'Den Rest kann ich nicht lesen. Livia vielleicht. Sie liest alles, was nicht wegläuft.'); g.codex('orichalkum'); },
          use: 'Ich lese, was ich kann. Das ist wenig.', take: 'Sie ist mit dem Boden verwachsen.', push: 'Sie steht.', pull: 'Sie steht.' },
        { id: 'sockel', name: 'Sockel des Standbilds', rect: [392, 290, 176, 26], at: [480, 480, 'u'],
          look: (g) => g.flag('koenige_offen') ? 'Der Sockel. Der Durchgang darin steht offen.' : 'Der Sockel des Standbilds. Darin ein Torbogen ohne Tür, aber mit Stein dahinter. Kein Griff, kein Schloss.' },
        { id: 'wand', name: 'Wand', rect: [60, 100, 340, 190], at: [230, 480, 'u'],
          look: 'Platten aus dem grünen Metall, an den Fugen verschweißt. Innen Orichalkum, schreibt Platon, außen Silber. Silber sehe ich keins. Vielleicht war Vesper schneller.' },
        { id: 'decke', name: 'Decke', rect: [0, 0, 960, 60], noWalk: true, look: 'Die Decke ist so hoch, dass Poseidons Dreizack sie gerade berührt. Man hat sie also nach ihm gebaut, nicht ihn nach ihr. Und jemand hat Sterne darauf gemalt, mit Linien dazwischen. Ein Himmel, wie er vor dreitausend Jahren aussah.' },
        { id: 'mosaik', name: 'Mosaik', rect: [330, 480, 300, 66], at: [480, 548, 'u'],
          look: 'Ein Mosaik im Boden: Ringe aus schwarzem und grünem Stein, in der Mitte der Dreizack. Die Stadt als Grundriss. Man hat hier auf der Landkarte gestanden.' },
        { id: 'nische', name: 'Nische mit Weihegeschenken', rect: [86, 166, 48, 92], z: 2, at: [110, 480, 'u'],
          look: 'Nischen mit Weihegeschenken: kleine Figuren, Schalen, ein Krug. Man hat dem Gott gegeben, was man entbehren konnte. Es war nicht viel, und es ist noch da.' },
        { id: 'kandelaber', name: 'Kandelaber', rect: [396, 330, 46, 116], z: 2, at: [420, 480, 'u'],
          look: 'Ein Kandelaber aus dem grünen Metall. Die Flammen darauf sind kalt und weiß und brauchen kein Öl. Ich habe aufgehört, das zu hinterfragen.' },
      );
      return list;
    },
    exits: [
      { id: 'zurueck', name: 'Zurück zum äußeren Ring', rect: [380, 556, 200, 44], at: [480, 575, 'd'], to: 'at_outer', pos: [1500, 540], dir: 'l', look: 'Der Torbogen zurück zum Ring und zur Brücke.' },
      { id: 'seitentuer', name: 'Seitengang', rect: [0, 246, 60, 206], at: [70, 500, 'l'], to: 'at_prison', pos: [110, 520], dir: 'r',
        look: (g) => g.flag('livia_frei') ? 'Der Gang zu den Zellen. Leer jetzt.' : 'Ein Seitengang, unbeleuchtet. Von dort kamen die Stimmen.' },
      { id: 'tuer_innen', name: 'Durchgang ins Innere', rect: [446, 316, 68, 134], at: [480, 480, 'u'], to: 'at_inner', pos: [140, 520], dir: 'r',
        look: (g) => g.flag('koenige_offen') ? 'Ein Durchgang im Sockel des Standbilds. Dahinter ist es hell, und es summt.' : 'Ein Torbogen im Sockel, mit Stein dahinter. Die Halle der Zehn, hätte Solon gesagt. Die Zehn stehen rechts und links.',
        before: async (g) => {
          if (!g.flag('koenige_offen')) { await g.say('falk', 'Stein. Kein Griff, kein Schloss. Nur zehn Könige, die zusehen.'); return false; }
          if (!g.flag('livia_frei')) { await g.say('falk', 'Nicht ohne Livia. Ich habe sie gehört, aus dem Seitengang.'); return false; }
          return true;
        },
        open: (g) => g.flag('koenige_offen') ? g.travel(g.hs('tuer_innen')) : 'Da ist nichts zu öffnen. Es ist eine Wand in Form eines Tors.',
        push: (g) => g.flag('koenige_offen') ? 'Er ist offen.' : 'Ich drücke gegen Stein. Der Stein gewinnt.' },
    ],
    actors: [
      { id: 'livia', x: 560, y: 505, dir: 'l', cond: (g) => g.flag('livia_frei'), talk: (g) => g.dialog('livia_tempel'),
        look: 'Livia. Sie sieht die Statuen an, als wollte sie sie später abfragen.',
        giveWith: { schriftrolle: (g) => g.dialog('livia_tafel'), default: 'Livia hebt eine Braue. Das heißt nein.' } },
    ],
    async enter(g) {
      if (g.flag('tempel_besucht')) return;
      g.set('tempel_besucht');
      await g.scene(async () => {
        await g.walk('falk', 480, 520, 'u');
        await g.say('falk', 'Der Tempel des Poseidon. Platon hat nicht übertrieben. Er hat untertrieben.');
        await g.say('falk', 'Zehn Statuen. Fünf rechts, fünf links. Und in der Mitte er, auf dem Wagen.');
        await g.wait(400);
        await g.message('Aus dem Seitengang links: eine Männerstimme, kurz und laut. Dann eine Frau, die ihm antwortet, ruhig und deutlich.', 3000);
        await g.say('falk', 'Livia. Und der andere war Kessler.');
        await g.say('falk', 'Vesper hat sie irgendwo eingesperrt, um mich in Bewegung zu halten. Er denkt in Hebeln.');
        g.objective('Livia aus dem Seitengang holen. Und herausfinden, wie die Halle der Zehn aufgeht.');
      });
    },
  });

  ATL.dialogs.define('livia_tempel', {
    nodes: {
      root: {
        options: [
          { text: 'Was jetzt?', cond: (g) => !g.flag('koenige_offen'),
            say: [['livia', 'Solon. „Der Erstgeborene öffne die Halle der Zehn, mit seinem Zwilling an der Hand.“'], ['livia', 'Atlas ist der Erstgeborene. Gadeiros sein Zwilling. Und die Statuen haben Hände, Adrian. Ausgestreckte.'], ['falk', 'Erst Atlas, dann Gadeiros.'], ['livia', 'Ich würde es so versuchen.']] },
          { text: 'Was jetzt?', cond: (g) => g.flag('koenige_offen'),
            say: [['livia', 'Vesper ist da drin. Mit dem Medaillon und mit dem, was er für seine Bestimmung hält.'], ['livia', 'Ich gehe mit. Ich habe zwölf Jahre auf diesen Raum gewartet, ich sehe ihn mir an.'], ['falk', 'Das ist keine Grabung, Livia.'], ['livia', 'Doch. Nur ohne Genehmigung.']] },
          { text: 'Die zehn Könige. Erzähl.', once: true,
            say: [['livia', 'Fünf Zwillingspaare, sagt der Kritias. Poseidon und eine Sterbliche, Kleito. Atlas bekam die Mitte, die anderen die Ränder.'], ['livia', 'Abwechselnd alle fünf und alle sechs Jahre kamen sie hier zusammen, jagten einen Stier ohne Waffen, opferten ihn über der Säule mit den Gesetzen und richteten übereinander.'], ['falk', 'Und dann?'], ['livia', 'Dann wurden sie gierig. Zeus rief die Götter zusammen, um sie zu strafen. Und da bricht der Text ab. Mitten im Satz.']],
            action: (g) => { g.codex('zehnkoenige'); g.codex('kritias'); } },
          { text: 'Die Metalltafel, die ich gefunden habe.', cond: (g) => g.has('schriftrolle') && !g.flag('rolle_gelesen'), silent: true, action: (g) => g.dialog('livia_tafel') },
          { text: 'Gehen wir.', end: true, say: [['livia', 'Nach dir.']] },
        ],
      },
    },
  });

  // ---------------------------------------------------------------- Zellen
  const kesslerHier = (g) => !g.flag('kessler_abgelenkt') && !g.flag('kessler_besiegt');
  const freeLivia = async (g) => {
    await g.say('falk', 'Die Perle sitzt locker in der Fassung. Ich ziehe sie heraus…');
    g.fx('click'); g.set('livia_frei'); g.repaint();
    await g.message('Die Lichtlinien flackern, werden dünn und erlöschen. Das Summen hört auf.', 2400);
    await g.say('falk', 'Sie wird heiß, dann grau. Dann zerfällt sie mir in der Hand zu Staub.');
    await g.scene(async () => {
      await g.walk('livia', 640, 505, 'l');
      g.face('falk', 'livia');
      await g.say('livia', 'Du hast dir Zeit gelassen.');
      await g.say('falk', 'Ich hatte eine Brücke zu senken.');
      if (g.flag('kessler_besiegt')) {
        g.fx('step');
        await g.message('Hinter ihnen kommt Kessler auf die Beine. Er sieht die beiden an, sieht das erloschene Gitter, und geht ohne ein Wort in den Gang.' + (g.has('figur') ? '' : ' Die Figur nimmt er mit.'), 3400);
        g.set('kessler_aus_zellen'); if (!g.has('figur')) g.set('figur_weg'); g.repaint();
        await g.say('livia', 'Er holt Verstärkung. Vesper.');
      } else {
        await g.say('livia', 'Kessler ist in den Gang, zu Vesper. Mit meiner Figur unter dem Arm.');
      }
      await g.say('livia', 'Vesper hat unterwegs geredet. Die ganze Fahrt, das ganze Tor hinunter. Die Maschine im Inneren. Er nennt sie die Vollendung.');
      await g.say('falk', 'Die Vollendung.');
      await g.say('livia', 'Er glaubt, sie macht aus einem Menschen etwas, das mehr ist. Er hat den Kritias gelesen wie eine Gebrauchsanweisung.');
      if (g.has('schriftrolle')) { await g.say('livia', 'Und du hast etwas in der Tasche, das nach Metall klingt. Zeig her, wenn es Schrift ist.'); }
      else await g.say('livia', 'Wenn du unterwegs Schrift siehst, Tafeln, Zeichen: Ich lese schneller als Vesper.');
      g.objective(g.flag('koenige_offen') ? 'Mit Livia zurück in den Tempel und durch den Durchgang im Sockel.' : 'Mit Livia zurück in den Tempel. Die Halle der Zehn öffnen: der Erstgeborene, dann sein Zwilling.');
    });
  };

  R({
    id: 'at_prison', name: 'Zellen', ambient: 'atlantis',
    start: [110, 520, 'r'],
    walk: [[60, 452, 900, 452, 930, 585, 30, 585]],
    scale: { y0: 420, s0: 0.78, y1: 585, s1: 1.05 },
    paint(ctx, g) {
      cave(ctx, 960, 600, 11);
      A.stones(ctx, 0, 90, 960, 360, '#243e44', 37, 48);
      veins(ctx, 0, 100, 960, 300, 17, 6);
      lime(ctx, 0, 92, 960, 110, 191, 22);
      A.cracks(ctx, 40, 100, 200, 100, 192, 'rgba(0,0,0,0.4)'); A.cracks(ctx, 700, 100, 120, 90, 193, 'rgba(0,0,0,0.4)');
      // Ritzzeichnungen über den Zellen: Fisch, Spirale, Boot
      ctx.strokeStyle = 'rgba(200,235,225,0.2)'; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.ellipse(160, 140, 16, 6, 0, 0, TAU); ctx.moveTo(176, 140); ctx.lineTo(186, 133); ctx.lineTo(186, 147); ctx.closePath(); ctx.stroke();
      ctx.beginPath(); for (let a = 0; a < TAU * 2.5; a += 0.3) { const rr = a * 1.6; a ? ctx.lineTo(300 + Math.cos(a) * rr, 150 + Math.sin(a) * rr) : ctx.moveTo(300, 150); } ctx.stroke();
      ctx.beginPath(); ctx.moveTo(470, 150); ctx.lineTo(520, 150); ctx.lineTo(512, 158); ctx.lineTo(478, 158); ctx.closePath(); ctx.moveTo(495, 150); ctx.lineTo(495, 132); ctx.stroke();
      ctx.beginPath(); for (let k = 0; k < 4; k++) { ctx.moveTo(700 + k * 8, 134); ctx.lineTo(700 + k * 8, 146); } ctx.moveTo(696, 146); ctx.lineTo(732, 132); ctx.stroke();
      // Rohrleitung mit Ventilen, quer über die Wand
      pipe(ctx, [0, 172, 826, 172], 8, '#3e5e5c');
      for (const x of [120, 340, 560]) pipe(ctx, [x, 172, x, 208], 5, '#3e5e5c');
      pipe(ctx, [800, 172, 800, 372], 6, '#3e5e5c');
      for (const [vx, vy] of [[80, 172], [800, 300]]) { A.circle(ctx, vx, vy, 5, '#2a4446'); A.gear(ctx, vx, vy, 9, 8, '#7a9a96', 0.3); A.circle(ctx, vx, vy, 2.5, '#2a4446'); }
      A.ell(ctx, 800, 372, 8, 3, 'rgba(220,235,228,0.2)');
      // Öffnung des Gangs zurück zum Tempel
      A.rect(ctx, 0, 250, 50, 200, '#03080c');
      A.poly(ctx, [0, 250, 50, 262, 50, 450, 0, 450], '#050d12');
      A.rect(ctx, 48, 246, 8, 206, '#2a4a4e');
      // Kisten der Meridian-Gesellschaft
      A.crate(ctx, 62, 410, 48, 40, '#3a3a40', 'MERIDIAN'); A.crate(ctx, 66, 376, 40, 34, '#44443a');
      A.sack(ctx, 84, 452, 26, 16, '#6a6a5a');
      // drei Zellen als Nischen
      for (let c = 0; c < 3; c++) {
        const x = 120 + c * 220;
        A.rect(ctx, x, 220, 180, 225, '#040b0e');
        ctx.fillStyle = A.grad(ctx, 0, 220, 0, 445, ['#02070a', '#0e2228']); ctx.fillRect(x + 6, 226, 168, 219);
        A.rect(ctx, x + 6, 420, 168, 25, '#1a3236');
        // Lager aus Stein, Kette an der Rückwand, Wasserrinne, Moos
        A.rect(ctx, x + 16, 394, 92, 26, '#0f2226'); A.rect(ctx, x + 16, 394, 92, 4, '#1c3a40');
        A.chain(ctx, x + 150, 228, x + 150, 322, '#4a5e60'); A.circle(ctx, x + 150, 328, 6, null, '#5a6e70', 2);
        A.rect(ctx, x + 6, 436, 168, 4, '#061216'); A.line(ctx, x + 10, 438, x + 170, 438, 'rgba(120,220,210,0.25)', 1);
        A.moss(ctx, x + 12, 434, 150, 195 + c, '#1c4a44');
        if (c === 0) { A.cobweb(ctx, x + 6, 226, 30, 'tl', 'rgba(255,255,255,0.16)'); A.bones(ctx, x + 112, 426, 197, '#8a9a90'); A.pot(ctx, x + 40, 434, 14, 10, '#3e4e4a'); }
        if (c === 1) {
          A.cobweb(ctx, x + 174, 226, 26, 'tr', 'rgba(255,255,255,0.16)');
          ctx.strokeStyle = 'rgba(200,235,225,0.24)'; ctx.lineWidth = 1;
          for (let row = 0; row < 3; row++) for (let grp = 0; grp < 5; grp++) for (let k = 0; k < 5; k++) {
            const sx = x + 24 + grp * 28 + k * 4, sy = 290 + row * 22;
            ctx.beginPath(); if (k < 4) { ctx.moveTo(sx, sy); ctx.lineTo(sx, sy + 12); } else { ctx.moveTo(sx - 17, sy + 10); ctx.lineTo(sx, sy + 2); } ctx.stroke();
          }
          A.chain(ctx, x + 30, 420, x + 80, 432, '#4a5e60'); A.circle(ctx, x + 84, 434, 5, null, '#5a6e70', 2);
        }
        if (c === 2) { A.rr(ctx, x + 24, 386, 40, 8, 3, '#5a4a5a'); A.pot(ctx, x + 130, 432, 12, 9, '#4a5a56'); }
        // Pfeiler mit Knoten
        for (const px of [x - 8, x + 172]) { A.rect(ctx, px, 210, 16, 240, '#3a5a5c'); A.rect(ctx, px + 2, 210, 3, 240, 'rgba(255,255,255,0.08)'); for (let y = 240; y < 440; y += 40) A.circle(ctx, px + 8, y, 4, c === 2 && !g.flag('livia_frei') ? '#8fe0d0' : '#1a2c30'); }
      }
      // Ritzungen früherer Gefangener zwischen den Zellen
      ctx.strokeStyle = 'rgba(200,235,225,0.2)'; ctx.lineWidth = 1;
      for (const gx of [312, 532]) {
        ctx.beginPath(); ctx.arc(gx, 262, 4, 0, TAU); ctx.moveTo(gx, 266); ctx.lineTo(gx, 282); ctx.lineTo(gx - 6, 294); ctx.moveTo(gx, 282); ctx.lineTo(gx + 6, 294); ctx.moveTo(gx - 7, 272); ctx.lineTo(gx + 7, 272); ctx.stroke();
        ctx.beginPath(); ctx.ellipse(gx, 330, 8, 3, 0, 0, TAU); ctx.moveTo(gx + 8, 330); ctx.lineTo(gx + 13, 326); ctx.lineTo(gx + 13, 334); ctx.stroke();
        for (let k = 0; k < 6; k++) { ctx.beginPath(); ctx.moveTo(gx - 8 + k * 3, 360); ctx.lineTo(gx - 8 + k * 3, 372); ctx.stroke(); }
      }
      A.text(ctx, 'Ι', 210, 200, { font: '18px Georgia', color: '#5fa89c', align: 'center' });
      A.text(ctx, 'ΙΙ', 430, 200, { font: '18px Georgia', color: '#5fa89c', align: 'center' });
      A.text(ctx, 'ΙΙΙ', 650, 200, { font: '18px Georgia', color: '#5fa89c', align: 'center' });
      // Sockel mit Perle
      A.rect(ctx, 752, 386, 34, 64, '#3a5658'); A.rect(ctx, 748, 380, 42, 8, '#587c7c');
      A.circle(ctx, 769, 400, 7, '#0a1618');
      if (!g.flag('livia_frei')) { A.circle(ctx, 769, 400, 6, '#5fd8b0'); A.glow(ctx, 769, 400, 40, TEAL, 0.6); A.path(ctx, [762, 400, 745, 380, 740, 300, 742, 240], 'rgba(120,255,225,0.5)', 1.5); }
      // Gang nach hinten
      A.rect(ctx, 830, 170, 130, 280, '#03080c');
      A.poly(ctx, [830, 170, 960, 150, 960, 450, 830, 450], '#050d12');
      for (let i = 0; i < 5; i++) A.rect(ctx, 840 + i * 10, 300 + i * 30, 120 - i * 10, 4, 'rgba(60,120,120,0.25)');
      A.glow(ctx, 930, 440, 60, 'rgba(60,200,180,0.5)', 0.18);
      A.rect(ctx, 826, 166, 8, 284, '#2a4a4e');
      algae(ctx, 830, 170, 130, 30, 198, 'rgba(30,80,70,0.5)');
      // Boden
      A.floorTiles(ctx, 960, 450, 600, '#2a4648', '#122224', 12, 480);
      A.rect(ctx, 0, 448, 960, 6, '#4e7472');
      // Wasserrinne quer durch den Boden, Pfützen, Risse
      A.rect(ctx, 0, 538, 960, 8, '#0c1a1c'); A.line(ctx, 0, 540, 960, 540, 'rgba(120,220,210,0.22)', 1); A.line(ctx, 0, 546, 960, 546, 'rgba(255,255,255,0.08)', 1);
      A.puddle(ctx, 880, 566, 70, 12, 'rgba(90,210,195,0.16)'); A.puddle(ctx, 200, 500, 50, 9, 'rgba(90,210,195,0.12)');
      A.cracks(ctx, 560, 460, 260, 70, 199, 'rgba(0,0,0,0.35)');
      // Vespers Feldausrüstung: Klapptisch, Karten, Funkgerät
      A.ell(ctx, 220, 512, 62, 6, 'rgba(0,0,0,0.3)');
      A.table(ctx, 160, 470, 120, 8, '#5a4a3a', 34);
      A.rect(ctx, 168, 458, 44, 14, '#d8ccaa'); A.rect(ctx, 176, 462, 40, 12, '#c8bc9a');
      for (let k = 0; k < 4; k++) A.line(ctx, 178 + k * 9, 464, 182 + k * 9, 472, 'rgba(60,40,20,0.4)', 1);
      A.rr(ctx, 230, 446, 42, 26, 3, '#3a3a3a'); A.rect(ctx, 234, 450, 16, 8, '#1a1a1a'); A.circle(ctx, 260, 456, 4, '#8a8a80'); A.circle(ctx, 260, 466, 3, '#8a8a80');
      A.line(ctx, 268, 446, 276, 406, '#8a8a80', 1.5);
      A.rr(ctx, 218, 462, 8, 10, 2, '#9a9a90');
      A.bottle(ctx, 166, 470, 14, '#5a7a5a');
      for (let k = 0; k < 3; k++) A.ell(ctx, 132, 472 - k * 2, 14 - k * 2, 5, null, '#2a2a2a', 3);
      // Kiste, auf der Kessler saß
      A.crate(ctx, 380, 470, 70, 46, '#3a3a40', 'MERIDIAN');
      A.lantern(ctx, 350, 470, 0, true);
      A.vignette(ctx, 960, 600, 0.55);
      A.grain(ctx, 960, 600, 8, 0.05);
    },
    paintFront(ctx) {
      // Kette mit Schelle, die von der Decke hängt
      A.chain(ctx, 92, -4, 94, 130, '#5a6e70');
      A.circle(ctx, 96, 140, 9, null, '#6a7e80', 3); A.rect(ctx, 92, 128, 8, 6, '#6a7e80');
      // Tropfsteinzacken mit Kristallen, oben rechts
      A.poly(ctx, [760, 0, 880, 0, 866, 28, 842, 74, 826, 36, 808, 58, 790, 20], '#03090c');
      A.crystal(ctx, 836, 60, 9, -18, 'rgba(120,240,215,0.6)'); A.crystal(ctx, 800, 42, 7, -12, 'rgba(120,240,215,0.5)');
    },
    animate(ctx, t) {
      A.glow(ctx, 350, 458, 60 + Math.sin(t * 9) * 4, 'rgba(255,200,100,0.6)', 0.35);
      drip(ctx, 200, 228, 436, t, 0.2, 'rgba(190,250,240,0.45)');
      mist(ctx, 830, 436, 130, t * 0.6, 3, 'rgba(120,200,190,0.05)');
    },
    animateFront(ctx, t, g) {
      if (g.flag('livia_frei')) return;
      const x = 560;
      for (let i = 0; i <= 14; i++) {
        const a = 0.45 + Math.sin(t * 18 + i * 1.7) * 0.25;
        A.line(ctx, x + 6 + i * 12, 226, x + 6 + i * 12, 445, `rgba(140,255,230,${a})`, 1.5);
      }
      for (let j = 0; j < 4; j++) A.line(ctx, x + 6, 260 + j * 50 + Math.sin(t * 3 + j) * 3, x + 174, 260 + j * 50 + Math.sin(t * 3 + j) * 3, 'rgba(140,255,230,0.35)', 1);
      A.glow(ctx, 650, 330, 120, 'rgba(90,240,210,0.5)', 0.25 + Math.sin(t * 6) * 0.05);
    },
    hotspots: [
      { id: 'zelle1', name: 'Zelle I', rect: [120, 220, 180, 225], at: [210, 480, 'u'], look: 'Eine leere Zelle. Die Pfeiler sind dunkel. Wer hier gesessen hat, ist lange fort.', use: 'Ich habe nicht vor, einzuziehen.', open: 'Sie ist offen. Sie hat keine Tür, nur zwei tote Pfeiler.' },
      { id: 'zelle2', name: 'Zelle II', rect: [340, 220, 180, 225], at: [430, 480, 'u'], look: 'Leer. An der Rückwand Kratzer, in Reihen. Jemand hat Tage gezählt, vor sehr langer Zeit.', use: 'Nein.', open: 'Sie steht offen.' },
      { id: 'gitter', name: 'Energiegitter', rect: [560, 220, 180, 160], at: [650, 490, 'u'], cond: (g) => !g.flag('livia_frei'),
        look: 'Linien aus Licht, dicht wie Harfensaiten, von Pfeiler zu Pfeiler. Sie summen. Dahinter Livia.',
        use: 'Ich halte die Hand hin. Die Haare auf dem Arm stellen sich auf. Weiter gehe ich nicht.', open: 'Kein Schloss, keine Tür. Nur Licht.', push: 'Ich drücke nicht gegen Licht, das summt.', pull: 'Nichts zum Anfassen.', take: 'Wie nimmt man Licht?',
        useWith: { brecheisen: 'Ich halte das Eisen an die Linien. Es wird warm. Sehr schnell sehr warm. Nein.', seil: 'Das Seil würde durchgebrannt sein, bevor es unten ist.', flasche: 'Wasser gegen Strom. Ich habe Physik gehabt.', default: 'Das bringt gegen das Gitter nichts.' } },
      { id: 'sockel', name: 'Sockel mit Perle', rect: [744, 376, 50, 76], at: [769, 500, 'u'], cond: (g) => !g.flag('livia_frei'),
        look: 'Ein Sockel neben dem Gitter, kniehoch. In der Fassung eine Perle, und von ihr laufen Lichtfäden in die Pfeiler.',
        take: async (g) => {
          if (kesslerHier(g)) { await g.say('kessler', 'Finger weg, Falk.'); await g.walk('falk', 690, 520, 'r'); await g.say('falk', 'Er sieht nicht hin. Er sieht nur mich an. Solange das so ist, komme ich an die Perle nicht heran.'); return; }
          await freeLivia(g);
        },
        use: (g) => g.hs('sockel').take(g), pull: (g) => g.hs('sockel').take(g), push: 'Drücken bringt nichts. Sie muss heraus.' },
      { id: 'gang', name: 'Dunkler Gang', rect: [830, 160, 130, 290], at: [880, 500, 'u'],
        look: (g) => kesslerHier(g) ? 'Ein Gang, der tiefer führt. Stufen, dann Dunkelheit. Von dort kam vorhin eine Stimme, ruhig und gebildet. Vesper.' : 'Der Gang, in dem Kessler verschwunden ist. Er führt ins Innere, auf einem anderen Weg.',
        use: (g) => g.flag('livia_frei') ? 'Wir nehmen den Weg durch den Tempel. Da weiß ich, was mich erwartet.' : 'Nicht, solange Livia hier hinter Licht sitzt.',
        useWith: {
          bimsstein: async (g) => {
            if (!kesslerHier(g)) return 'Ich werfe einen Stein in einen leeren Gang. Da hört keiner zu. Ich hebe ihn auf.';
            await g.say('falk', 'Bimsstein. Leicht, aber laut, wenn er auf Stein fällt.');
            g.drop('bimsstein'); g.fx('whoosh');
            await g.scene(async () => {
              g.anim('falk', 'reach'); await g.wait(300); g.anim('falk', 'stand');
              await g.wait(400); g.fx('stone');
              await g.message('Der Stein klappert die Stufen hinunter, poltert, kommt irgendwo unten zur Ruhe.', 2600);
              g.face('kessler', 'r');
              await g.say('kessler', 'Was war das.');
              await g.say('falk', 'Ihr Chef, würde ich sagen. Er ruft.');
              await g.say('kessler', 'Bleiben Sie, wo Sie sind.');
              await g.walk('kessler', 420, 500, 'l');
              g.anim('kessler', 'crouch'); await g.wait(400); g.anim('kessler', 'stand');
              await g.message('Kessler nimmt die Figur von der Kiste, wie ein Mann, der seinen Hut nicht vergisst.', 2600);
              g.set('figur_weg'); g.set('kessler_abgelenkt'); g.repaint();
              await g.walk('kessler', 880, 480, 'u');
              await g.walk('kessler', 900, 300, 'u');
              g.hide('kessler');
              await g.wait(600);
              await g.message('Von unten, gedämpft: „Kessler. Kommen Sie. Ich brauche Sie hier.“ Schritte, die sich entfernen.', 3000);
              await g.say('livia', 'Er kommt nicht zurück. Vesper ruft nur einmal.');
              await g.say('falk', 'Dann ist jetzt Zeit für die Perle.');
            });
          },
          stein: (g) => g.hs('gang').useWith.bimsstein(g),
          muenzen: 'Ich könnte Münzen werfen. Aber die brauche ich vielleicht noch für die Rückfahrt.',
          default: 'Das werfe ich nicht in einen Gang, den ich nicht kenne.' } },
      { id: 'kiste', name: 'Kiste', rect: [378, 466, 74, 52], at: [415, 540, 'u'],
        look: (g) => g.has('figur') || g.flag('figur_weg') ? 'Eine Kiste der Meridian-Gesellschaft. Vesper reist mit Gepäck.' : 'Eine Kiste der Meridian-Gesellschaft. Darauf steht die Wächterfigur.',
        open: 'Zugenagelt. Und Kessler hat darauf gesessen, das reicht als Siegel.', take: 'Zu groß, und es ist nicht meine.' },
      { id: 'figur', name: 'Wächterfigur', rect: [400, 428, 30, 42], at: [415, 540, 'u'], z: 470, cond: (g) => !g.flag('figur_weg') && !g.has('figur'),
        paint: (ctx) => { A.rr(ctx, 408, 440, 14, 30, 4, '#6a7a6a'); A.circle(ctx, 415, 438, 7, '#7a8a7a'); A.poly(ctx, [415, 435, 424, 433, 421, 440], '#6a7a6a'); },
        look: 'Livias Figur aus Thera. Der Mann mit dem Fischkopf. Sie ist leer, ich weiß es, ich habe sie geleert.',
        take: (g) => { if (kesslerHier(g)) return 'Kessler sitzt daneben. Er würde es merken, und er merkt Dinge mit den Fäusten.'; g.take('figur'); g.repaint(); return 'Livias Figur. Leer, aber ihr. Ich nehme sie mit.'; } },
      { id: 'kessler_boden', name: 'Kessler', rect: [430, 490, 110, 50], at: [400, 540, 'r'], z: 515, cond: (g) => g.flag('kessler_besiegt') && !g.flag('kessler_aus_zellen'),
        paint: (ctx) => { A.rr(ctx, 440, 502, 90, 26, 8, '#3a3a44'); A.circle(ctx, 536, 514, 12, '#e0b090'); A.rect(ctx, 528, 502, 16, 6, '#2a2a2a'); A.line(ctx, 445, 528, 425, 540, '#2a2a34', 9); A.line(ctx, 460, 528, 440, 542, '#2a2a34', 9); },
        look: 'Kessler, am Boden. Er atmet. Ich habe nicht vor, das zu ändern.', talk: 'Er hört mich nicht. Und wenn, hätte er nichts Nettes zu sagen.', take: 'Nein.', use: 'Ich lasse ihn liegen.', push: 'Er ist schwer genug, so wie er liegt.' },
      { id: 'laterne', name: 'Laterne', rect: [340, 440, 20, 34], at: [330, 530, 'r'], look: 'Eine Petroleumlaterne von Vespers Leuten. Das einzige Licht hier, das nicht summt.', take: 'Sie gehört Kessler. Ich lasse ihm sein Licht.' },
      { id: 'ausruestung', name: 'Feldausrüstung', rect: [156, 404, 128, 110], at: [220, 540, 'u'],
        look: 'Vespers Feldausrüstung: ein Klapptisch, Karten von Thera, ein Funkgerät, das hier unten niemanden erreicht. Er hat an alles gedacht. Außer an den Rückweg.' },
      { id: 'kisten', name: 'Kisten', rect: [60, 372, 52, 82], at: [120, 520, 'l'],
        look: 'Kisten der Meridian-Gesellschaft, mit Stempel. Konserven, Seile, vermutlich Sprengstoff. Ich lasse die Deckel zu.' },
      { id: 'rohre', name: 'Rohrleitung', rect: [0, 164, 826, 16], noWalk: true,
        look: 'Rohre aus dem grünen Metall, mit Ventilen. Heiße und kalte Quellen, schreibt Platon. Hier unten ist inzwischen alles gleich kalt.' },
    ],
    exits: [
      { id: 'ausgang', name: 'Zurück zum Tempel', rect: [0, 240, 60, 340], at: [70, 520, 'l'], to: 'at_middle', pos: [110, 500], dir: 'r', look: 'Der Gang zurück in den Tempel.' },
    ],
    actors: [
      { id: 'kessler', x: 470, y: 505, dir: 'l', cond: (g) => kesslerHier(g) && !g.flag('livia_frei'), talk: (g) => g.dialog('kessler_zellen'), at: [380, 530, 'r'],
        look: 'Kessler. Er sitzt auf der Kiste wie ein Mann, der dafür bezahlt wird, zu sitzen. Und das wird er.',
        giveWith: { muenzen: 'Kessler sieht die Münzen an, dann mich. Er lacht nicht einmal.', visitenkarte: async (g) => { await g.say('kessler', 'Die Karte meines Chefs. Behalten Sie sie. Er hat mehr davon.'); }, default: 'Kessler hebt die Hand. Er will nichts von mir.' } },
      { id: 'livia', x: 650, y: 428, dir: 'd', cond: (g) => !g.flag('livia_frei'), at: [650, 490, 'u'],
        talk: (g) => g.dialog(g.flag('livia_frei') ? 'livia_tempel' : 'livia_zelle'),
        look: (g) => g.flag('livia_frei') ? 'Livia. Sie reibt sich die Handgelenke, obwohl niemand sie gefesselt hat.' : 'Livia, hinter Linien aus Licht. Sie steht, als wäre die Zelle ihre Idee gewesen.',
        giveWith: { schriftrolle: async (g) => { if (!g.flag('livia_frei')) return 'Durch das Gitter? Die Tafel wäre geschmolzen, bevor sie drüben ist.'; await g.dialog('livia_tafel'); }, flasche: async (g) => { if (!g.flag('livia_frei')) return 'Durch das Gitter geht nichts.'; await g.say('livia', 'Danke. Kessler hat mir Wasser angeboten. Ich habe abgelehnt, aus Prinzip.'); }, default: (g) => g.flag('livia_frei') ? 'Livia schüttelt den Kopf.' : 'Durch das Gitter geht nichts.' } },
    ],
    async enter(g) {
      if (g.flag('zellen_besucht')) return;
      g.set('zellen_besucht');
      await g.scene(async () => {
        await g.say('kessler', 'Dr. Falk. Sie haben die Brücke gefunden. Herr Vesper hat es vorhergesagt, auf die Minute.');
        await g.say('livia', 'Adrian.');
        await g.say('falk', 'Livia. Du siehst aus, als hättest du dich eingesperrt, um in Ruhe zu lesen.');
        await g.say('livia', 'Ich habe die Wände gelesen. Sie sind interessanter als Kessler.');
        await g.say('kessler', 'Das Gitter bleibt an, bis Herr Vesper es anders sagt. Und Herr Vesper sagt es anders, wenn Sie getan haben, was er will.');
        g.objective('Livia aus der Zelle holen. Das Gitter hängt an etwas, und Kessler passt auf.');
      });
    },
  });

  ATL.dialogs.define('kessler_zellen', {
    nodes: {
      root: {
        options: [
          { text: 'Lassen Sie sie frei.', once: true, say: [['kessler', 'Nein.'], ['kessler', 'Herr Vesper sagt, Sie arbeiten besser, wenn Sie einen Grund haben. Sie ist der Grund.']] },
          { text: 'Wo ist Vesper?', once: true, say: [['kessler', 'Im Inneren. Er wartet auf Sie. Er sagt, Sie finden die Tür, weil Sie der Einzige sind, der das Griechisch liest.'], ['falk', 'Und Sie? Lesen Sie nicht?'], ['kessler', 'Ich lese Gesichter. Ihres sagt, dass Sie etwas vorhaben.']] },
          { text: 'Was ist mit der Figur?', once: true, cond: (g) => !g.has('figur'), say: [['kessler', 'Die bleibt bei mir. Herr Vesper sammelt. Sie ist leer, das wissen Sie besser als ich.'], ['falk', 'Ich weiß, was drin war.'], ['kessler', 'Das weiß Herr Vesper auch. Deshalb steckt es jetzt oben in der Hebebühne.']] },
          { text: 'Ich regle das anders.', end: true, silent: true,
            action: async (g) => {
              await g.say('falk', 'Ich regle das anders.');
              await g.say('kessler', 'Das haben Sie auf Kreta auch gesagt.');
              const won = await g.puzzle('fight', { enemy: 'Kessler', enemyHp: 120, enemyDamage: 25 });
              if (won) {
                g.fx('punch');
                await g.message('Kessler geht zu Boden, schwer, und bleibt liegen.', 2200);
                g.set('kessler_besiegt'); g.hide('kessler'); g.repaint();
                await g.say('falk', 'Er atmet. Gut. Ich bin Archäologe, kein Boxer. Auch wenn es gerade anders aussah.');
                await g.say('livia', 'Die Perle, Adrian. Im Sockel.');
              } else {
                g.fx('punch');
                await g.message('Falk geht zu Boden. Kessler wartet, bis er wieder steht.', 2200);
                await g.say('kessler', 'Noch einmal? Ich habe Zeit. Herr Vesper zahlt nach Stunden.');
                await g.say('falk', 'Gleich. Ich sortiere nur meine Zähne.');
              }
            } },
          { text: 'Wir sprechen uns noch.', end: true, say: [['kessler', 'Sicher.']] },
        ],
      },
    },
  });
  ATL.dialogs.define('livia_zelle', {
    nodes: {
      root: {
        options: [
          { text: 'Bist du in Ordnung?', once: true, say: [['livia', 'Ja. Kessler ist ein Rohling, aber ein sorgfältiger. Er hat mich nicht angefasst, er hat mich nur eingesperrt.'], ['livia', 'Und Vesper hat sich entschuldigt. Zweimal. Das war das Schlimmste.']] },
          { text: 'Wie komme ich an das Gitter?', say: (g) => [['livia', 'Es hängt an der Perle im Sockel, rechts. Kessler hat sie hineingesetzt, dann ging das Licht an. Nimm sie heraus, dann geht es aus.'], ...(kesslerHier(g) ? [['livia', 'Aber nicht, solange er hinsieht. Und er sieht immer hin.']] : [])] },
          { text: 'Was will Vesper?', once: true, say: [['livia', 'Die Maschine im Inneren. Er nennt sie die Vollendung. Er hat es mir unterwegs erklärt, dreimal, in ganzen Sätzen.'], ['livia', 'Er glaubt, die Atlanter hätten damit aus Menschen etwas Besseres gemacht. Er will der Erste seit dreitausend Jahren sein.'], ['falk', 'Und was hält ihn auf?'], ['livia', 'Kein Strom. Und drei Siegel, die er nicht hat. Die hast du.']] },
          { text: 'Ich hole dich da raus.', end: true, say: [['livia', 'Ich warte. Es ist nicht so, als hätte ich Termine.']] },
        ],
      },
    },
  });
  ATL.dialogs.define('livia_tafel', {
    nodes: {
      root: {
        say: [
          ['livia', 'Zeig her. Spiralen, Punkte, die Reihen von rechts nach links…'],
          ['livia', 'Ich habe zwölf Jahre auf diese Zeichen gestarrt, auf Scherben von Thera. Hier sind sie ganz.'],
          ['falk', 'Und?'],
          ['livia', 'Ungefähr: „Wer in den Kreis tritt, wird vollendet. Das Herz nimmt nur, wen die Zehn gesegnet haben. Die anderen macht es zu dem, was in ihnen ist.“'],
          ['falk', 'Zu dem, was in ihnen ist.'],
          ['livia', 'Ungeheuer, würde ich übersetzen. Das Wort hat einen Fischschwanz.'],
          ['livia', 'Ich behalte die Tafel. Wenn wir hier herauskommen, ist das der wichtigste Fund seit dem Stein von Rosette. Wenn.'],
        ],
        action: (g) => { g.drop('schriftrolle'); g.set('rolle_gelesen'); g.codex('apkallu'); },
      },
    },
  });

  // ---------------------------------------------------------------- Das Herz
  const SEALS = { sonnensiegel: ['sun', 'der Sonne'], stiersiegel: ['bull', 'des Stiers'], flutsiegel: ['flood', 'der Flut'] };
  const setSeal = async (g, id) => {
    if (g.flag('finale')) return 'Dafür ist es zu spät.';
    if (!g.flag('strom')) { await g.say('vesper', 'Zuerst der Strom, Dr. Falk. Ein Schlüssel in einem toten Schloss ist nur Metall.'); return; }
    const [kind, name] = SEALS[id];
    g.drop(id); g.set('siegel_' + kind); const n = g.inc('siegel_gesetzt');
    g.fx('glow'); g.repaint();
    await g.say('falk', `Das Siegel ${name} rastet ein. Es wird warm, und die Ringe ziehen an.`);
    if (n === 1) await g.say('vesper', 'Eins.');
    else if (n === 2) await g.say('vesper', 'Zwei. Sie sehen, es geht. Es ging immer, es fehlte nur jemand, der es tut.');
    else await finale(g);
  };
  const finale = async (g) => {
    g.set('finale');
    await g.scene(async () => {
      g.fx('hum');
      await g.message('Das dritte Siegel rastet ein. Die Ringe drehen sich schneller, und das Summen wird zu einem Ton.', 2800);
      await g.say('vesper', 'Da ist er. Der Ton. Ich habe ihn in Berlin beschrieben, 1931, vor einem Saal, der gelacht hat.');
      await g.walk('vesper', 700, 500, 'l');
      await g.say('vesper', 'Kessler. An den Hebel.');
      await g.walk('kessler', 475, 508, 'l');
      await g.say('vesper', 'Dr. Marsh, Dr. Falk. Sie werden das bezeugen. Deshalb sind Sie hier, nicht nur wegen der Siegel. Ein Wunder ohne Zeugen ist ein Gerücht.');
      if (g.flag('rolle_gelesen')) {
        await g.say('livia', 'Vesper. Die Tafel. „Das Herz nimmt nur, wen die Zehn gesegnet haben. Die anderen macht es zu dem, was in ihnen ist.“');
        await g.say('vesper', 'Priesterprosa, Dr. Marsh. Wer eine Maschine baut, schreibt Warnungen an die Tür. Für die anderen.');
      } else {
        await g.say('livia', 'Vesper. Niemand weiß, was diese Maschine tut. Nicht Sie, nicht ich.');
        await g.say('vesper', 'Ich weiß es seit sieben Jahren, Dr. Marsh. Sie haben nur nicht zugehört.');
      }
      await g.say('vesper', 'Man hat mich ausgelacht. Das ist eine Art Segen. Man geht danach anders durch Türen.');
      g.place('vesper', 700, 432, 'd'); g.set('vesper_in_kammer'); g.repaint();
      g.fx('door');
      await g.message('Vesper tritt in die Kammer. Die Tür schließt sich hinter ihm ohne ein Geräusch.', 2400);
      await g.say('vesper', 'Kessler. Wenn ich es sage.');
      await g.say('vesper', 'Oder Sie, Dr. Falk. Ich lasse Ihnen die Wahl. Es ist Ihr Fund, so gut wie meiner.');
    });
    await g.dialog('vesper_hebel');
    await g.scene(async () => {
      if (g.flag('falk_zieht')) {
        await g.walk('kessler', 545, 512, 'l');
        await g.walk('falk', 455, 505, 'u');
        await g.say('vesper', 'Jetzt.');
        g.anim('falk', 'reach'); await g.wait(500); g.anim('falk', 'stand');
        await g.message('Falk legt die Hand auf den Hebel und zieht.', 1800);
      } else {
        await g.say('vesper', 'Jetzt.');
        g.anim('kessler', 'reach'); await g.wait(500); g.anim('kessler', 'stand');
        await g.message('Kessler zieht den Hebel.', 1600);
      }
      g.fx('thunder'); g.fx('hum'); g.set('ueberladung', 0.15);
      await g.message('Licht füllt die Kammer, weiß, dann grün. Vesper steht darin mit erhobenen Händen.', 2600);
      await g.say('vesper', 'Es ist warm. Es ist… ja. So muss es gewesen sein. So muss es…');
      for (let k = 2; k <= 6; k++) { g.set('ueberladung', k / 10); await g.wait(220); }
      g.fx('hum');
      await g.message('Dann verändert sich das Licht. Es wird rot. Und die Gestalt hinter dem Glas verändert sich mit ihm.', 2800);
      await g.say('vesper', 'Kessler. Der Hebel. Zurück, bitte.');
      await g.say('kessler', 'Er rührt sich nicht, Herr Vesper.');
      for (let k = 7; k <= 10; k++) { g.set('ueberladung', k / 10); await g.wait(220); }
      await g.message('Hinter dem Glas richtet sich etwas auf, das zu groß für die Kammer ist. Es hat Vespers Stimme, aber sie kommt von zu vielen Stellen zugleich.', 3400);
      await g.say('vesper', 'Dr. Marsh. Was genau steht auf der Tafel. Ich möchte es jetzt hören.');
      await g.say('livia', g.flag('rolle_gelesen') ? '„Zu dem, was in ihnen ist.“' : 'Ich weiß es nicht, Vesper. Niemand weiß es.');
      await g.say('vesper', 'Ah. Das ist eine gute Übersetzung.');
      g.fx('thunder');
      g.set('vesper_vernichtet'); g.hide('vesper'); g.set('kammer_zerstoert'); g.set('ueberladung', 0.5); g.repaint();
      await g.message('Das Glas zerspringt. Ein Windstoß, heiß und grün, dann nichts. In der Kammer liegt Asche, und ein Paar Brillengläser.', 3200);
      await g.wait(500);
      g.actor('kessler').speed = 260;
      await g.message('Kessler sieht die Kammer an, sieht die beiden, und rennt in den Gang.', 2200);
      await g.walk('kessler', 930, 480, 'r'); g.hide('kessler'); g.set('kessler_geflohen_herz');
      g.fx('thunder');
      await g.message('Die Ringe drehen sich, ohne dass jemand sie hält. Der Ton wird höher. Von der Decke lösen sich Platten.', 2800);
      await g.say('livia', 'Raus. Jetzt. Der Gang, den Kessler genommen hat.');
      await g.say('falk', 'Nach dir.');
      g.objective('Raus hier.', { silent: true });
      await g.goto('at_escape', 120, 530, 'r');
    });
  };

  R({
    id: 'at_inner', name: 'Das Herz', ambient: 'atlantis',
    start: [140, 520, 'r'],
    walk: [[40, 452, 920, 452, 940, 585, 30, 585]],
    scale: { y0: 420, s0: 0.78, y1: 585, s1: 1.05 },
    paint(ctx, g) {
      cave(ctx, 960, 600, 13);
      ctx.fillStyle = A.grad(ctx, 0, 90, 0, 450, ['#0c2226', '#163a3e', '#0e2a2e']);
      ctx.fillRect(0, 90, 960, 360);
      for (let x = 0; x < 960; x += 60) A.line(ctx, x, 90, x, 450, 'rgba(120,255,225,0.08)', 1);
      for (let y = 90; y < 450; y += 60) A.line(ctx, 0, y, 960, y, 'rgba(120,255,225,0.08)', 1);
      {
        // Metallglanz auf einzelnen Feldern, Risse, Kalk
        const r = ATL.U.rng(201);
        for (let x = 0; x < 960; x += 60) for (let y = 90; y < 450; y += 60) if (r() < 0.18) { ctx.fillStyle = A.grad(ctx, x, y, x + 60, y + 60, ['rgba(200,255,240,0)', 'rgba(200,255,240,0.08)', 'rgba(200,255,240,0)']); ctx.fillRect(x + 1, y + 1, 58, 58); }
        lime(ctx, 0, 92, 960, 70, 202, 12);
        A.cracks(ctx, 660, 90, 140, 90, 203, 'rgba(0,0,0,0.45)'); A.cracks(ctx, 40, 330, 200, 60, 204, 'rgba(0,0,0,0.4)');
      }
      veins(ctx, 0, 100, 960, 300, 19, 8);
      const live = g.flag('strom');
      // Kabelstränge von der Decke und entlang des Wandfußes
      pipe(ctx, [100, 0, 100, 110], 6, '#2c4a4c');
      pipe(ctx, [860, 0, 860, 120], 6, '#2c4a4c');
      for (const [x0, x1] of [[254, 330], [468, 636], [766, 900]]) {
        A.line(ctx, x0, 440, x1, 440, '#1a3032', 9); A.line(ctx, x0, 437, x1, 437, '#3a5a5c', 3); A.line(ctx, x0, 443, x1, 443, '#2a4648', 3);
        for (let x = x0 + 14; x < x1; x += 34) A.rect(ctx, x, 434, 5, 12, '#4a6a6c');
      }
      // Anzeigetafeln mit Zeichen (Lampen leuchten in animate)
      for (const px of [50, 790]) {
        A.rr(ctx, px, 110, 150, 84, 4, '#0b1d21', '#4a7a76', 2);
        A.rect(ctx, px + 4, 114, 142, 3, 'rgba(255,255,255,0.15)');
        for (let row = 0; row < 3; row++) glyphRow(ctx, px + 10, 130 + row * 16, 130, 205 + row + px, 'rgba(120,255,225,0.45)');
        for (let i = 0; i < 6; i++) A.circle(ctx, px + 16 + i * 22, 182, 3, '#1a3034', '#3a5a5c', 1);
      }
      // Schrifttafel rechts
      A.rr(ctx, 826, 214, 74, 96, 3, '#243e42', '#3a5a5c', 2);
      for (let row = 0; row < 6; row++) glyphRow(ctx, 832, 226 + row * 14, 62, 211 + row, 'rgba(160,255,235,0.4)');
      A.cracks(ctx, 830, 216, 66, 90, 212, 'rgba(0,0,0,0.4)');
      // Wächterfiguren in Nischen
      guardianNiche(ctx, 62, 218, 40, 106, '#4a6a66', live ? 'rgba(90,240,210,0.6)' : null);
      guardianNiche(ctx, 776, 218, 40, 106, '#4a6a66', live ? 'rgba(90,240,210,0.6)' : null);
      // Kristallreihe auf einem Sims
      A.rect(ctx, 826, 330, 74, 6, '#3a5a5c'); A.rect(ctx, 826, 336, 74, 3, '#1e3436');
      for (let i = 0; i < 5; i++) A.crystal(ctx, 830 + i * 14, 330, 10, 16 + (i % 3) * 8, live ? '#8ff0dc' : '#3e6a66');
      // Zahnräder an der Wand links: Achsen (die Räder drehen sich in animate)
      for (const [gx, gy] of [[250, 150], [292, 190], [232, 214]]) A.circle(ctx, gx, gy, 5, '#0b1e24', '#4a6a6c', 2);
      A.rect(ctx, 226, 232, 80, 6, '#2a4648');
      // Rohr vom Kanal in die Wand, mit Ventil und Dampfschlitz
      pipe(ctx, [256, 386, 256, 300, 300, 300], 8, '#3a5a5c');
      A.gear(ctx, 256, 344, 10, 8, '#7a9a96', 0.2); A.circle(ctx, 256, 344, 3, '#2a4446');
      A.rect(ctx, 262, 430, 22, 10, '#1a2c30'); for (let k = 0; k < 4; k++) A.rect(ctx, 264 + k * 5, 432, 2, 6, '#3e5e5c');
      // Adern von der Maschine zur Kammer und Konsole
      A.path(ctx, [480, 340, 480, 420, 390, 420, 390, 440], g.flag('strom') ? 'rgba(120,255,225,0.7)' : 'rgba(60,110,110,0.5)', 3);
      A.path(ctx, [600, 260, 640, 260, 640, 330], g.flag('strom') ? 'rgba(120,255,225,0.7)' : 'rgba(60,110,110,0.5)', 3);
      A.path(ctx, [240, 420, 330, 420], g.flag('strom') ? 'rgba(120,255,225,0.7)' : 'rgba(60,110,110,0.5)', 3);
      // Kanal mit Wasserrad und Gitter
      canal(ctx, 30, 398, 220, 52);
      algae(ctx, 34, 398, 212, 14, 213, 'rgba(30,90,70,0.45)');
      A.rect(ctx, 26, 380, 8, 70, '#3a5a5c'); A.rect(ctx, 246, 380, 8, 70, '#3a5a5c');
      A.rect(ctx, 60, 384, 60, 66, '#0a1a1e');
      for (let i = 0; i < 6; i++) A.rect(ctx, 62 + i * 10, 384, 3, 66, '#587c7c');
      if (!g.flag('strom')) for (let i = 0; i < 9; i++) A.rock(ctx, 56 + (i * 23) % 60, 386 + (i * 17) % 40, 22 + (i % 3) * 8, 18 + (i % 2) * 8, '#5a5a52', i + 40);
      A.rect(ctx, 150, 360, 8, 60, '#2e4648'); A.rect(ctx, 204, 360, 8, 60, '#2e4648'); A.rect(ctx, 146, 356, 70, 6, '#4a6a6c');
      // Konsole
      ctx.fillStyle = A.grad(ctx, 0, 380, 0, 450, ['#4a6e6c', '#22383a']);
      A.poly(ctx, [330, 396, 450, 396, 460, 450, 320, 450], ctx.fillStyle);
      A.rect(ctx, 326, 388, 128, 10, '#5a8280');
      for (let i = 0; i < 3; i++) {
        const kind = ['sun', 'bull', 'flood'][i];
        A.circle(ctx, 355 + i * 35, 420, 13, '#0a1618');
        if (g.flag('siegel_' + kind)) A.seal(ctx, 355 + i * 35, 420, 12, kind, kind === 'sun' ? '#e0b84a' : kind === 'bull' ? '#b8956a' : '#6fa8c8');
      }
      // Medaillon und Figur auf der Konsole
      if (!g.has('medaillon')) { A.circle(ctx, 435, 404, 7, '#4a7a78'); A.circle(ctx, 435, 404, 5, null, '#8fe0d0', 1); }
      if (!g.has('figur')) { A.rr(ctx, 336, 372, 9, 22, 3, '#6a7a6a'); A.circle(ctx, 340, 371, 5, '#7a8a7a'); }
      // Hebel
      A.rect(ctx, 460, 400, 8, 50, '#3a4a4c');
      A.line(ctx, 464, 402, g.flag('finale') ? 500 : 478, 356, '#8a9a9a', 5); A.circle(ctx, g.flag('finale') ? 500 : 478, 356, 5, '#b03a3a');
      // Kammer
      A.rect(ctx, 636, 184, 128, 266, '#1e3c40'); A.rect(ctx, 630, 178, 140, 12, '#4a6e6c'); A.rect(ctx, 630, 440, 140, 12, '#4a6e6c');
      A.rect(ctx, 648, 194, 104, 250, g.flag('kammer_zerstoert') ? '#1a0a08' : '#061a1e');
      if (g.flag('kammer_zerstoert')) {
        A.ell(ctx, 700, 436, 44, 6, '#3a3a3a'); A.circle(ctx, 692, 434, 4, null, '#aaa', 1); A.circle(ctx, 702, 434, 4, null, '#aaa', 1);
        A.glow(ctx, 700, 300, 180, 'rgba(0,0,0,0.9)', 0.5);
        A.cracks(ctx, 560, 100, 300, 340, 214, 'rgba(0,0,0,0.6)');
      }
      // Kondensat, Schutt, Risse im Boden
      A.floorTiles(ctx, 960, 450, 600, '#24403e', '#101e1e', 14, 480);
      A.puddle(ctx, 150, 486, 60, 10, 'rgba(90,210,195,0.16)'); A.puddle(ctx, 570, 470, 72, 12, 'rgba(90,210,195,0.16)'); A.puddle(ctx, 835, 490, 56, 10, 'rgba(90,210,195,0.16)');
      A.cracks(ctx, 620, 460, 260, 100, 215, 'rgba(0,0,0,0.35)'); A.cracks(ctx, 60, 470, 200, 90, 216, 'rgba(0,0,0,0.3)');
      A.rect(ctx, 0, 448, 960, 6, '#5a8280');
      A.rubble(ctx, 786, 426, 90, 30, 217, '#3e5a58');
      A.pebbles(ctx, 770, 452, 120, 14, 218, '#3e5250');
      A.rect(ctx, 0, 250, 40, 200, '#03080c');
      A.vignette(ctx, 960, 600, 0.5);
      A.grain(ctx, 960, 600, 6, 0.05);
    },
    paintFront(ctx, g) {
      // Kabelstrang, der vorn unten links über den Boden läuft; Kristalle in der Ecke rechts
      A.line(ctx, -4, 592, 90, 580, '#1a3032', 10); A.line(ctx, 90, 580, 140, 602, '#1a3032', 10);
      A.line(ctx, -4, 589, 90, 577, '#3a5a5c', 3); A.line(ctx, 90, 577, 140, 599, '#3a5a5c', 3);
      A.rect(ctx, 40, 580, 6, 12, '#4a6a6c'); A.rect(ctx, 106, 582, 6, 12, '#4a6a6c');
      A.crystal(ctx, 908, 600, 16, 36, '#5fd0b8'); A.crystal(ctx, 926, 600, 22, 52, '#7fe6cc'); A.crystal(ctx, 946, 600, 14, 30, '#5fd0b8');
      if (g.flag('kammer_zerstoert')) {
        for (let i = 0; i < 12; i++) A.poly(ctx, [640 + (i * 41) % 110, 440 - (i * 29) % 240, 650 + (i * 41) % 110, 450 - (i * 29) % 240, 646 + (i * 41) % 110, 462 - (i * 29) % 240], 'rgba(160,255,240,0.25)');
        return;
      }
      ctx.fillStyle = 'rgba(120,255,235,0.14)'; ctx.fillRect(650, 196, 100, 246);
      A.line(ctx, 660, 200, 660, 438, 'rgba(255,255,255,0.25)', 3);
      A.line(ctx, 740, 200, 740, 438, 'rgba(255,255,255,0.12)', 2);
      A.rect(ctx, 648, 194, 104, 3, '#8fe0d0');
    },
    animate(ctx, t, g) {
      const strom = g.flag('strom');
      const u = g.flag('ueberladung') || 0;
      const rot = strom ? t * (0.5 + u * 3) : 0;
      // kleine Zahnräder an der Wand, Anzeigelampen, Kristallsims, Dampf
      A.gear(ctx, 250, 150, 20, 12, '#3a6a6a', strom ? t * 1.2 : 0.1); A.circle(ctx, 250, 150, 5, '#0b1e24');
      A.gear(ctx, 292, 190, 12, 8, '#2e5658', strom ? -t * 2 : 0.4); A.circle(ctx, 292, 190, 3.5, '#0b1e24');
      A.gear(ctx, 232, 214, 10, 8, '#3a6a6a', strom ? -t * 2.4 : 0.2); A.circle(ctx, 232, 214, 3, '#0b1e24');
      if (strom) {
        for (const px of [50, 790]) for (let i = 0; i < 6; i++) { const on = Math.sin(t * (1 + i * 0.3) + i * 2 + px) > 0; if (on) { A.circle(ctx, px + 16 + i * 22, 182, 3, '#8fffe0'); A.glow(ctx, px + 16 + i * 22, 182, 10, TEAL, 0.5); } }
        A.glow(ctx, 862, 322, 40 + Math.sin(t * 2.5) * 6, TEAL, 0.35);
        A.smoke(ctx, 273, 430, t, 'rgba(200,240,235,0.28)', 0.45);
      }
      drip(ctx, 570, 92, 470, t, 0.3, 'rgba(190,250,240,0.4)');
      const col = (a) => u > 0 ? `rgba(${Math.round(90 + 165 * u)},${Math.round(200 - 160 * u)},${Math.round(180 - 150 * u)},${a})` : `rgba(90,200,180,${a})`;
      A.glow(ctx, 480, 200, 200, col(0.6), strom ? 0.35 + Math.sin(t * 2) * 0.1 + u * 0.3 : 0.12);
      for (let i = 3; i >= 0; i--) {
        const r = 52 + i * 28;
        A.gear(ctx, 480, 200, r, 10 + i * 6, i % 2 ? '#2e5658' : '#3a6a6a', rot * (i % 2 ? -1 : 1) / (i + 1));
        A.circle(ctx, 480, 200, r - 9, '#0b1e24');
      }
      A.crystal(ctx, 464, 206, 32, 36, u > 0 ? `rgb(${Math.round(90 + 165 * u)},${Math.round(230 - 180 * u)},${Math.round(200 - 160 * u)})` : (strom ? '#8fffe0' : '#3a6a66'));
      A.waterAnim(ctx, 34, 402, 212, 44, t * (strom ? 2 : 0.3), 'rgba(160,255,235,0.14)');
      A.gear(ctx, 180, 400, 34, 10, '#4a6e6c', strom ? t * 2.2 : 0.3);
      A.circle(ctx, 180, 400, 6, '#1a2c30');
      if (g.flag('vesper_in_kammer') && !g.flag('vesper_vernichtet')) A.glow(ctx, 700, 320, 120, u > 0.5 ? 'rgba(255,60,30,0.9)' : 'rgba(120,255,230,0.8)', 0.3 + u * 0.5);
      if (u > 0) { ctx.fillStyle = `rgba(255,40,20,${u * 0.35})`; ctx.fillRect(0, 0, 960, 600); A.glow(ctx, 700, 320, 300, 'rgba(255,60,30,0.9)', u * 0.6); }
      if (strom) for (let i = 0; i < 3; i++) if (g.flag('siegel_' + ['sun', 'bull', 'flood'][i])) A.glow(ctx, 355 + i * 35, 420, 24 + Math.sin(t * 4 + i) * 4, TEAL, 0.5);
    },
    hotspots: [
      { id: 'maschine', name: 'Die Maschine', rect: [320, 40, 320, 330], at: [480, 490, 'u'],
        look: (g) => g.flag('strom') ? 'Ringe aus Metall, ineinander, und sie drehen sich. In der Mitte ein Kristall, der leuchtet wie die Perlen. Der Ton kommt von ihm.' : 'Ringe aus dem grünen Metall, ineinander gelagert wie die Ringe der Stadt. Sie stehen still. In der Mitte ein Kristall, dunkel.',
        use: 'Ich fasse nichts an, das größer ist als ein Haus und summt.', push: 'Nein.', take: 'Nein.', talk: 'Sie antwortet nicht. Sie summt nur. Ich weiß nicht, ob das besser ist.' },
      { id: 'kanal', name: 'Kanal', rect: [30, 398, 220, 52], at: [140, 490, 'u'],
        look: (g) => g.flag('strom') ? 'Der Kanal. Das Wasser schießt jetzt durch das Gitter und treibt das Rad.' : 'Ein Kanal, der aus der Wand kommt und in die Wand geht. Das Wasser steht fast. Vor dem Rad ein Gitter, und im Gitter Geröll.' },
      { id: 'gitter', name: 'Gitter voller Geröll', rect: [56, 380, 68, 70], at: [90, 490, 'u'], cond: (g) => !g.flag('strom'),
        look: 'Ein Gitter quer im Kanal, Stäbe aus Metall. Davor hat sich Geröll verkeilt, Brocken, die von der Decke gekommen sind. Das Wasser kommt kaum durch.',
        use: 'Ich greife hinein und ziehe. Die kleinen Steine kommen, die großen sitzen fest. Ich brauche einen Hebel oder Zug.',
        pull: (g) => g.hs('gitter').use(g), push: 'Ich drücke das Geröll nur tiefer ins Gitter.', take: 'Die kleinen Steine, ja. Die großen nicht.', open: 'Es ist kein Tor, es ist ein Sieb.',
        useWith: {
          brecheisen: async (g) => {
            await g.say('falk', 'Das Brecheisen unter den größten Brocken, und dann Hebel…');
            g.anim('falk', 'crouch'); await g.wait(500); g.anim('falk', 'stand');
            g.fx('stone'); g.fx('water');
            g.set('strom'); g.repaint();
            await g.message('Das Geröll rutscht, das Wasser schießt durch, das Rad dreht sich. Ein Ruck geht durch den Boden, und die Ringe beginnen sich zu bewegen.', 3000);
            g.fx('hum');
            await g.say('vesper', 'Sehen Sie. Dreitausend Jahre, und es läuft an wie ein Motor nach dem Winter.');
            await g.say('falk', 'Ein Wasserrad. Alles hier ist ein Wasserrad mit besserer Beleuchtung.');
            g.objective('Die drei Siegel in die Konsole setzen. Vesper wartet darauf, und Kessler steht vor dem Gang.');
          },
          seil: async (g) => {
            await g.say('falk', 'Ich schlinge das Seil um den größten Brocken, stemme mich gegen die Wand und ziehe…');
            g.anim('falk', 'reach'); await g.wait(600); g.anim('falk', 'stand');
            g.fx('stone'); g.fx('water');
            g.set('strom'); g.repaint();
            await g.message('Der Brocken kippt, das Geröll rutscht nach, das Wasser schießt durch. Das Rad dreht sich, und die Ringe beginnen sich zu bewegen.', 3000);
            g.fx('hum');
            await g.say('vesper', 'Sehen Sie. Dreitausend Jahre, und es läuft an wie ein Motor nach dem Winter.');
            await g.say('falk', 'Ein Wasserrad. Alles hier ist ein Wasserrad mit besserer Beleuchtung.');
            g.objective('Die drei Siegel in die Konsole setzen. Vesper wartet darauf, und Kessler steht vor dem Gang.');
          },
          schaufel: 'Die Brocken sind zu groß für den Spaten. Er biegt sich nur.', taschenmesser: 'Ein Taschenmesser gegen einen Felsbrocken. Nein.', default: 'Damit bekomme ich das Geröll nicht aus dem Gitter.' } },
      { id: 'gitter_frei', name: 'Gitter', rect: [56, 380, 68, 70], at: [90, 490, 'u'], cond: (g) => g.flag('strom'), look: 'Das Gitter, jetzt frei. Das Wasser rauscht hindurch.', use: 'Ich lasse die Hände draußen.' },
      { id: 'rad', name: 'Wasserrad', rect: [140, 350, 80, 100], at: [180, 490, 'u'],
        look: (g) => g.flag('strom') ? 'Das Rad dreht sich. Von seiner Achse laufen Adern in die Wand und weiter zu den Ringen.' : 'Ein Rad im Kanal, aus dem grünen Metall, mit Schaufeln. Es steht. Das Wasser, das es drehen sollte, kommt nicht durch das Gitter.',
        use: (g) => g.flag('strom') ? 'Es läuft. Ich lasse die Finger davon.' : 'Ich drücke gegen das Rad. Es bewegt sich eine Handbreit und steht wieder. Das Wasser muss es drehen, nicht ich.',
        push: (g) => g.hs('rad').use(g), pull: (g) => g.hs('rad').use(g), take: 'Es ist an der Wand festgemacht, und es ist so groß wie ich.',
        useWith: { seil: 'Am Rad ist nichts, was ich ziehen müsste. Das Problem ist das Gitter davor.', brecheisen: 'Das Rad ist in Ordnung. Das Geröll im Gitter ist das Problem.', default: 'Das Rad braucht Wasser, nichts anderes.' } },
      { id: 'konsole', name: 'Konsole', rect: [318, 366, 146, 86], at: [390, 500, 'u'],
        look: (g) => { const n = g.flag('siegel_gesetzt') || 0; return `Eine schräge Platte mit drei runden Schlitzen, jeder mit acht Kerben. ${n ? n + ' davon ' + (n === 1 ? 'ist' : 'sind') + ' belegt.' : 'Alle leer.'} Daneben Livias Medaillon in einer Mulde, und ein Hebel.`; },
        use: (g) => !g.flag('strom') ? 'Die Schlitze sind dunkel. Ohne Strom passiert hier nichts.' : (g.flag('siegel_gesetzt') || 0) < 3 ? 'Drei Schlitze. Acht Kerben. Ich habe drei Scheiben mit acht Kerben in der Tasche, und Vesper weiß es.' : 'Es läuft.',
        open: 'Es ist eine Konsole, kein Schrank.', take: 'Sie ist Teil des Bodens.', push: 'Ich drücke. Nichts.',
        useWith: {
          sonnensiegel: (g) => setSeal(g, 'sonnensiegel'), stiersiegel: (g) => setSeal(g, 'stiersiegel'), flutsiegel: (g) => setSeal(g, 'flutsiegel'),
          solontext: 'Solons Text hat mich bis hierher gebracht. Für die Konsole hilft er nicht.',
          brecheisen: async (g) => { await g.say('falk', 'Ich könnte die Konsole zerschlagen.'); await g.say('vesper', 'Könnten Sie. Dann bleiben wir alle hier, für immer. Ich habe Zeit, Dr. Falk. Sie haben Dr. Marsh.'); },
          default: 'Das passt in keinen der Schlitze.' } },
      { id: 'hebel', name: 'Hebel', rect: [456, 346, 52, 60], at: [450, 500, 'u'],
        look: 'Ein Hebel aus Metall, mit rotem Knauf. Das Einzige hier, das aussieht, als hätte ein Mensch es gebaut.',
        pull: (g) => !g.flag('strom') ? 'Er bewegt sich nicht. Nichts hier bewegt sich ohne Strom.' : (g.flag('siegel_gesetzt') || 0) < 3 ? 'Er bewegt sich nicht. Drei Schlitze, drei Siegel. Ich habe noch nicht alle gesetzt.' : 'Zu spät dafür.',
        use: (g) => g.hs('hebel').pull(g), push: 'Er will gezogen werden, nicht gedrückt.', take: 'Er ist festgeschraubt. Von wem auch immer.' },
      { id: 'medaillon', name: 'Medaillon', rect: [426, 394, 20, 20], at: [430, 500, 'u'], cond: (g) => !g.has('medaillon'),
        look: 'Livias Medaillon, in einer Mulde in der Konsole. Es sitzt dort, als wäre es dafür gemacht. Es ist dafür gemacht.',
        take: async (g) => { if (g.flag('vesper_vernichtet')) { g.take('medaillon'); g.repaint(); return 'Ich nehme es. Es gehört Livia.'; } await g.say('vesper', 'Lassen Sie es liegen, Dr. Falk. Es ist der Schlüssel, und ich habe ihn schon gedreht.'); } },
      { id: 'kammer', name: 'Verwandlungskammer', rect: [630, 178, 140, 274], at: [700, 500, 'u'],
        look: (g) => g.flag('kammer_zerstoert') ? 'Die Kammer. Zersprungenes Glas, Asche, und ein Paar Brillengläser ohne Gestell.' : 'Eine Kammer aus etwas wie Glas, mannshoch, mit einer Tür. Innen Adern, die zur Maschine laufen. Man soll da hineintreten. Ich nicht.',
        open: (g) => g.flag('kammer_zerstoert') ? 'Sie hat keine Tür mehr.' : 'Die Tür hat keinen Griff. Sie öffnet sich, wenn die Maschine es will, nehme ich an.',
        use: 'Nein. Was auch immer das tut, ich will es nicht an mir ausprobieren.', push: 'Sie steht fest.', take: 'Nein.' },
      { id: 'tafel', name: 'Schrifttafel', rect: [822, 210, 82, 104], at: [860, 500, 'u'],
        look: 'Eine Tafel mit Zeichen, Reihen von Spiralen und Punkten. Eine Betriebsanleitung, würde Vesper sagen. Eine Warnung, würde Livia sagen. Ich sage: Ich kann es nicht lesen.' },
      { id: 'zahnraeder', name: 'Zahnräder', rect: [216, 124, 100, 118], at: [265, 500, 'u'],
        look: 'Kleine Zahnräder an der Wand, ineinander. Sie tun etwas. Ich habe keine Ahnung, was, und die Maschine erklärt es nicht.' },
      { id: 'waechter', name: 'Wächterfigur', rect: [60, 214, 44, 112], at: [110, 500, 'u'],
        look: 'Eine Nische mit einer Figur: ein Mann mit Fischkopf, die Hände auf der Brust. Wie Livias Figur, nur größer, und nicht zu verkaufen.' },
      { id: 'gang_innen', name: 'Gang', rect: [900, 200, 60, 250], at: [900, 500, 'u'],
        look: (g) => g.flag('kessler_geflohen_herz') ? 'Der Gang, in dem Kessler verschwunden ist. Er führt nach oben, hoffe ich.' : 'Ein Gang, der nach oben führt. Vespers Weg. Kessler steht davor wie eine Tür mit Fäusten.',
        use: (g) => g.flag('kessler_geflohen_herz') ? 'Gleich.' : 'Kessler steht davor. Er hat nicht vor, Platz zu machen.' },
    ],
    exits: [
      { id: 'zurueck', name: 'Zurück zum Tempel', rect: [0, 250, 40, 330], at: [60, 520, 'l'], to: 'at_middle', pos: [480, 480], dir: 'd', cond: (g) => !g.flag('finale'),
        look: 'Der Durchgang zurück in den Tempel.' },
    ],
    actors: [
      { id: 'vesper', x: 505, y: 495, dir: 'l', cond: (g) => !g.flag('vesper_vernichtet'), talk: (g) => g.dialog('vesper_herz'), at: [420, 528, 'r'],
        look: 'Konrad Vesper. Grauer Anzug, saubere Brille, keine Eile. Er sieht die Maschine an wie ein Mann sein Haus.',
        giveWith: { visitenkarte: async (g) => { await g.say('vesper', 'Meine Karte. Behalten Sie sie. Sie werden noch jemandem erklären müssen, wer ich war.'); }, default: async (g) => { await g.say('vesper', 'Nein danke, Dr. Falk. Ich habe alles, was ich brauche. Bis auf Ihre Siegel.'); } } },
      { id: 'kessler', x: 830, y: 505, dir: 'l', cond: (g) => !g.flag('kessler_geflohen_herz'), at: [760, 530, 'r'],
        look: 'Kessler, vor dem Gang. Er hat sich nicht gerührt, seit wir hereingekommen sind.',
        talk: async (g) => { await g.say('falk', 'Kessler.'); await g.say('kessler', 'Falk.'); await g.say('falk', 'Das war ein gutes Gespräch.'); },
        giveWith: { default: 'Kessler nimmt nichts an. Er ist im Dienst.' } },
      { id: 'livia', x: 200, y: 548, dir: 'r', cond: (g) => g.flag('livia_frei'), talk: (g) => g.dialog('livia_herz'), at: [260, 555, 'l'],
        look: 'Livia. Sie sieht die Maschine an und nicht Vesper. Das ist ihre Art, ihn zu beleidigen.',
        giveWith: { schriftrolle: (g) => g.dialog('livia_tafel'), default: 'Livia schüttelt den Kopf. Nicht jetzt.' } },
    ],
    async enter(g) {
      if (g.flag('vesper_begruesst')) return;
      g.set('vesper_begruesst');
      await g.scene(async () => {
        await g.walk('falk', 300, 520, 'r');
        await g.walk('livia', 200, 548, 'r');
        await g.say('vesper', 'Dr. Falk. Dr. Marsh. Ich hatte gehofft, Sie kommen zusammen. Es spart Erklärungen.');
        await g.say('falk', 'Sie haben Livia eingesperrt.');
        await g.say('vesper', 'Ich habe sie in Sicherheit gebracht. Kessler ist nicht subtil, aber er ist zuverlässig.');
        await g.say('livia', 'Er hat mich in eine Zelle gesetzt, Adrian. Das nennt er Sicherheit.');
        await g.say('vesper', 'Sehen Sie sich um. Das ist das Herz. Platon nennt es nicht, weil Solon es nie gesehen hat. Die Priester in Sais wussten davon. Sie haben es ihm verschwiegen.');
        await g.say('vesper', 'Die Ringe, die Kammer, die Konsole. Und drei Schlitze, in die drei Siegel passen. Sie haben sie in der Tasche.');
        await g.say('falk', 'Und wenn ich sie behalte?');
        await g.say('vesper', 'Dann bleiben wir alle hier. Der Weg zur Hebebühne ist verschüttet, Sie haben es gesehen. Der andere Weg führt durch diesen Raum, und Kessler steht davor.');
        await g.say('vesper', 'Aber zuerst: Die Maschine hat keinen Strom. Das Rad im Kanal steht. Sie sind der Praktiker unter uns, Dr. Falk. Ich bin nur der, der weiß, warum.');
        await g.say('falk', 'Sie wissen sehr viel, Vesper. Für einen Mann, der nichts anfassen will.');
        g.objective('Die Maschine hat keinen Strom. Das Wasserrad im Kanal steht still.');
      });
    },
  });

  ATL.dialogs.define('vesper_herz', {
    nodes: {
      root: {
        options: [
          { text: 'Was ist die Vollendung?', once: true,
            say: (g) => [['vesper', 'Der Kritias sagt, die Atlanter seien Kinder eines Gottes gewesen. Über Generationen habe sich das Göttliche in ihnen verdünnt. Diese Maschine hat es aufgefrischt.'], ['vesper', 'Wer hineintrat, kam als das heraus, was er hätte sein sollen.'], ...(g.flag('rolle_gelesen') ? [['livia', 'Wer von den Zehn gesegnet war. So steht es auf der Tafel. Alle anderen macht sie zu Ungeheuern.'], ['vesper', 'Priesterprosa, Dr. Marsh. Wer eine Maschine baut, schreibt Warnungen an die Tür. Für die anderen.']] : [['falk', 'Und wer sagt, dass sie das noch tut?'], ['vesper', 'Niemand. Deshalb probiert man es aus.']])] },
          { text: 'Das Medaillon.', once: true, say: [['vesper', 'Dr. Marshs Medaillon, ja. Es liegt in der Konsole, wo es hingehört. Sie hat es zwölf Jahre als Schmuck getragen. Es ist ein Schlüssel.'], ['livia', 'Ich habe es getragen, damit Sie es nicht bekommen.'], ['vesper', 'Und nun habe ich es doch. So geht es mit Schmuck.']] },
          { text: 'Warum ich?', once: true, say: [['vesper', 'Weil Sie nicht glauben. Ein Gläubiger hätte die Siegel angebetet. Sie haben sie gefunden.'], ['vesper', 'Das ist der Unterschied zwischen Dr. Marsh und Ihnen, und er hat mich hierhergebracht.']] },
          { text: 'Kessler hat mir von Ihnen erzählt.', once: true, cond: (g) => g.flag('kessler_besiegt'), say: [['vesper', 'Und mir von Ihnen. Er ist nachtragend. Ich bin es nicht, ich bin nur gründlich.']] },
          { text: 'Ich habe genug gehört.', end: true, say: (g) => [['vesper', g.flag('strom') ? 'Dann die Siegel, Dr. Falk. Alle drei.' : 'Dann fangen Sie an. Das Rad, Dr. Falk.']] },
        ],
      },
    },
  });
  ATL.dialogs.define('livia_herz', {
    nodes: {
      root: {
        options: [
          { text: 'Was meinst du?', say: (g) => !g.flag('strom') ? [['livia', 'Er hat recht mit dem Rad. Ohne Wasser läuft hier nichts. Das Gitter davor ist voll Geröll, ich habe es gesehen.'], ['livia', 'Und dann? Ich weiß es nicht, Adrian. Ich wollte immer wissen, ob es das gibt. Ich habe nie gefragt, was es tut.']] : [['livia', 'Er will hinein. Das sieht man ihm an. Er hat sein Leben lang gewartet, dass jemand die Tür aufmacht.'], ['livia', 'Ich würde ihn lassen. Das ist nicht christlich, aber es ist ehrlich.']] },
          { text: 'Die Tafel.', once: true, cond: (g) => g.flag('rolle_gelesen'), say: [['livia', '„Die anderen macht es zu dem, was in ihnen ist.“ Ich habe mir das dreimal übersetzt. Es bleibt dasselbe.'], ['falk', 'Und was ist in Vesper?'], ['livia', 'Ich möchte es nicht herausfinden. Aber ich glaube, er wird es tun.']] },
          { text: 'Gut.', end: true, say: [['livia', 'Pass auf dich auf. Ich sage das nur einmal.']] },
        ],
      },
    },
  });
  ATL.dialogs.define('vesper_hebel', {
    nodes: {
      root: {
        say: [['vesper', 'Nun, Dr. Falk?']],
        options: [
          { text: 'Ich ziehe den Hebel.', flag: 'falk_zieht', end: true, say: [['livia', 'Adrian…'], ['falk', 'Er geht sowieso hinein. Dann will ich wenigstens die Hand am Hebel haben, wenn es schiefgeht.'], ['vesper', 'Sehen Sie, Dr. Marsh. Deshalb er.']] },
          { text: 'Ich weigere mich.', end: true, say: [['falk', 'Nein. Nicht ich.'], ['vesper', 'Wie Sie wollen. Es ändert nichts, außer wer sich später erinnert. Kessler.']] },
        ],
      },
    },
  });

  // ---------------------------------------------------------------- Flucht
  R({
    id: 'at_escape', name: 'Flucht', ambient: 'atlantis',
    start: [120, 530, 'r'],
    walk: [[40, 470, 940, 470, 940, 585, 40, 585]],
    scale: { y0: 420, s0: 0.85, y1: 585, s1: 1.0 },
    paint(ctx, g) {
      ctx.fillStyle = A.grad(ctx, 0, 0, 0, 600, ['#0a0608', '#1c0e0c', '#2a1410']);
      ctx.fillRect(0, 0, 960, 600);
      // Lavaröhre: Wände, die nach rechts zulaufen
      A.poly(ctx, [0, 0, 960, 0, 960, 130, 700, 190, 400, 210, 0, 160], '#14090a');
      A.poly(ctx, [0, 160, 400, 210, 400, 470, 0, 600], '#2a1612');
      A.poly(ctx, [400, 210, 700, 190, 700, 470, 400, 470], '#3a1e18');
      A.stones(ctx, 0, 160, 400, 320, '#3a2420', 44, 40);
      A.stones(ctx, 400, 200, 300, 270, '#42281f', 45, 30);
      A.stones(ctx, 700, 190, 260, 280, '#3a2420', 46, 40);
      veins(ctx, 0, 180, 700, 260, 23, 6);
      // Tropfsteine an der Decke, Risse mit Glut dahinter
      {
        const r = ATL.U.rng(221);
        for (let x = 0; x < 960; x += 24 + r() * 40) { const d = 20 + r() * 50, ww = 6 + r() * 12; A.poly(ctx, [x - ww, 0, x + ww, 0, x + (r() - 0.5) * 6, d], '#0e0607'); }
        for (const [cx, cy, cw, ch, s] of [[60, 200, 200, 200, 222], [520, 220, 160, 200, 223], [720, 200, 200, 220, 224]]) {
          A.glow(ctx, cx + cw / 2, cy + ch / 2, cw * 0.6, 'rgba(255,120,40,0.5)', 0.18);
          A.cracks(ctx, cx, cy, cw, ch, s, 'rgba(255,140,60,0.5)');
          A.cracks(ctx, cx + 2, cy + 2, cw, ch, s, 'rgba(0,0,0,0.5)');
        }
      }
      // Ferne Öffnung in der Rückwand, aus der noch Licht von Atlantis kommt
      A.rect(ctx, 480, 330, 60, 140, '#08060a'); A.ell(ctx, 510, 330, 30, 30, '#08060a');
      A.glow(ctx, 510, 420, 50, 'rgba(60,220,200,0.5)', 0.2);
      for (let i = 0; i < 4; i++) A.rect(ctx, 486 + i * 4, 380 + i * 22, 48 - i * 8, 3, 'rgba(60,140,130,0.25)');
      // Glühbirnenkette von Vespers Leuten an der Wand
      ctx.strokeStyle = '#1a1210'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, 236);
      for (let x = 0; x < 780; x += 130) ctx.quadraticCurveTo(x + 65, 252, x + 130, 236);
      ctx.stroke();
      for (let x = 130; x < 780; x += 130) { A.rect(ctx, x - 3, 236, 6, 8, '#2a2a2a'); A.circle(ctx, x, 250, 5, '#3a3020'); }
      // Abgerissene Orichalkum-Leitung, die von der Decke hängt
      pipe(ctx, [600, 0, 604, 120, 612, 196], 7, '#3a5a5c');
      A.poly(ctx, [606, 192, 618, 190, 622, 204, 610, 208], '#1e3436');
      // Boden
      ctx.fillStyle = A.grad(ctx, 0, 460, 0, 600, ['#3a2820', '#1a100c']); ctx.fillRect(0, 460, 960, 140);
      for (let x = 0; x < 960; x += 70) A.line(ctx, x, 470, x - 40, 600, 'rgba(0,0,0,0.3)', 1);
      A.pebbles(ctx, 0, 470, 960, 120, 225, '#5a3a30');
      A.rubble(ctx, 30, 438, 170, 44, 226, '#4a2e26'); A.rubble(ctx, 560, 440, 150, 40, 227, '#4a2e26');
      drum(ctx, 300, 446, 80, 26, '#4e6e6c');
      A.cracks(ctx, 200, 470, 300, 110, 228, 'rgba(255,120,40,0.35)'); A.glow(ctx, 350, 540, 80, 'rgba(255,120,40,0.5)', 0.15);
      A.puddle(ctx, 130, 486, 70, 12, 'rgba(60,200,190,0.25)');
      // Wasser, das aus einem Riss in der linken Wand läuft
      A.poly(ctx, [116, 296, 128, 292, 124, 310, 112, 314], '#08060a');
      // Hebebühne
      A.rect(ctx, 790, 80, 160, 390, '#050304');
      ctx.fillStyle = A.grad(ctx, 0, 80, 0, 470, ['#02090c', '#0a1c20']); ctx.fillRect(796, 86, 148, 384);
      A.rect(ctx, 784, 80, 8, 390, '#3a5658'); A.rect(ctx, 948, 80, 8, 390, '#3a5658');
      for (let y = 100; y < 460; y += 40) { A.rect(ctx, 786, y, 4, 8, '#8fe0d0'); A.rect(ctx, 950, y, 4, 8, '#8fe0d0'); }
      A.rect(ctx, 796, 452, 148, 16, '#4a6e6c'); A.rect(ctx, 796, 468, 148, 60, '#22383a');
      A.rect(ctx, 850, 384, 40, 68, '#3a5658'); A.circle(ctx, 870, 396, 7, '#0a1618'); A.circle(ctx, 870, 396, 6, '#5fd8b0'); A.glow(ctx, 870, 396, 40, TEAL, 0.6);
      A.line(ctx, 910, 452, 928, 410, '#8a9a9a', 5); A.circle(ctx, 928, 410, 5, '#b03a3a');
      A.crate(ctx, 800, 424, 36, 28, '#3a3a40'); A.lantern(ctx, 846, 452, 0, false);
      A.vignette(ctx, 960, 600, 0.55);
      A.grain(ctx, 960, 600, 7, 0.06);
    },
    paintFront(ctx) {
      // Felsüberhang oben links, Platte unten links
      A.poly(ctx, [0, 0, 240, 0, 224, 30, 190, 48, 160, 92, 136, 50, 100, 66, 60, 40, 30, 74, 0, 60], '#0a0506');
      A.poly(ctx, [0, 480, 44, 500, 38, 600, 0, 600], '#1a0e0c');
      A.line(ctx, 4, 484, 40, 502, 'rgba(255,140,60,0.25)', 1.5);
    },
    animate(ctx, t, g) {
      const rt = g.roomTime;
      // Wasser aus dem Riss, Funken aus der Leitung, flackernde Birnen
      for (let i = 0; i < 4; i++) { const k = ((t * 1.6 + i * 0.25) % 1); A.line(ctx, 118 + i * 2, 300 + k * 170, 118 + i * 2 + 2, 300 + k * 170 + 14, 'rgba(160,240,230,0.55)', 1.5); }
      sparks(ctx, 614, 204, t, 9);
      A.glow(ctx, 614, 204, 26 + Math.sin(t * 30) * 8, 'rgba(255,190,90,0.8)', Math.sin(t * 23) > 0.6 ? 0.5 : 0.15);
      for (let x = 130; x < 780; x += 130) { const on = Math.sin(t * 7 + x) > -0.6; if (on) { A.circle(ctx, x, 250, 5, '#ffe9a0'); A.glow(ctx, x, 250, 40, 'rgba(255,220,140,0.7)', 0.3); } }
      // fallende Steine
      for (let i = 0; i < 10; i++) {
        const x = (i * 197 + 40) % 900, y = ((rt * (260 + (i % 4) * 60) + i * 137) % 760) - 120;
        A.rock(ctx, x, y, 14 + (i % 3) * 8, 12 + (i % 2) * 6, '#5a3a30', i + 60);
      }
      // Staub
      A.dust(ctx, 0, 100, 960, 400, t, 60, 'rgba(200,160,120,0.25)');
      // steigendes Wasser
      const lvl = Math.min(150, rt * 28);
      if (lvl > 0) { ctx.fillStyle = 'rgba(20,120,110,0.7)'; ctx.fillRect(0, 600 - lvl, 960, lvl); A.waterAnim(ctx, 0, 600 - lvl, 960, lvl, t * 2, 'rgba(160,255,235,0.2)'); A.glow(ctx, 480, 600, 300, 'rgba(60,220,200,0.5)', 0.3); }
      const sh = Math.sin(t * 40) * 2;
      ctx.fillStyle = `rgba(255,120,60,${0.05 + Math.abs(sh) * 0.02})`; ctx.fillRect(0, 0, 960, 600);
    },
    hotspots: [],
    async enter(g) {
      await g.scene(async () => {
        g.place('livia', 70, 545, 'r');
        const hs = g.hero.speed, ls = g.actor('livia').speed;
        g.hero.speed = 280; g.actor('livia').speed = 270;
        g.fx('thunder');
        await g.message('Der Gang, den Kessler genommen hat, führt nach oben. Hinter ihnen bricht der Ton der Maschine ab, und dann bricht alles andere.', 3000);
        const p1 = g.walk('falk', 400, 530, 'r');
        const p2 = g.walk('livia', 350, 548, 'r');
        await Promise.all([p1, p2]);
        g.fx('stone');
        await g.say('livia', 'Wasser. Der Kanal. Die Ringe laufen aus.');
        await g.say('falk', 'Nicht stehen bleiben.');
        const p3 = g.walk('falk', 760, 520, 'r');
        const p4 = g.walk('livia', 720, 545, 'r');
        await Promise.all([p3, p4]);
        g.fx('thunder');
        await g.say('falk', 'Die Hebebühne. Von hier bin ich gekommen. Die Perle steckt noch im Sockel.');
        await g.say('livia', 'Dann steck du jetzt den Hebel um.');
        g.hero.speed = hs; g.actor('livia').speed = ls;
        await g.walk('falk', 830, 500, 'r'); await g.walk('livia', 810, 520, 'r');
        g.hero.fixedScale = g.hero.scale; g.actor('livia').fixedScale = g.actor('livia').scale;
        g.anim('falk', 'reach'); await g.wait(400); g.anim('falk', 'stand');
        g.fx('hum');
        await g.message('Die Bühne ruckt, summt, und hebt sich. Unter ihr steigt das Wasser, grün und leuchtend, und löscht das Licht von Atlantis aus.', 3200);
        for (let i = 1; i <= 14 && !g.fast; i++) { g.hero.offsetY = -i * 30; g.actor('livia').offsetY = -i * 30; await g.wait(110); }
        await g.wait(300);
        await g.goto('at_epilog', 380, 508, 'r');
      });
    },
    leave(g) { g.hero.offsetY = 0; g.hero.fixedScale = null; const l = g.actor('livia'); l.offsetY = 0; l.fixedScale = null; },
  });

  // ---------------------------------------------------------------- Epilog
  R({
    id: 'at_epilog', name: 'Vor Thera', ambient: 'thera',
    start: [380, 508, 'r'],
    walk: [[340, 500, 640, 500, 640, 520, 340, 520]],
    scale: { y0: 400, s0: 0.8, y1: 585, s1: 0.8 },
    paint(ctx, g) {
      A.sky(ctx, 960, 320, '#2a1e4a', '#f0a050');
      ctx.fillStyle = A.grad(ctx, 0, 180, 0, 320, ['rgba(255,150,60,0)', 'rgba(255,170,80,0.55)']); ctx.fillRect(0, 180, 960, 140);
      A.stars(ctx, 960, 140, 50, 27, 'rgba(255,240,220,0.5)');
      A.stars(ctx, 960, 90, 12, 28, 'rgba(255,250,240,0.9)');
      A.moon(ctx, 150, 62, 13);
      A.sun(ctx, 640, 296, 34, '#ffe0a0');
      A.clouds(ctx, 960, 120, 5, 8, 'rgba(120,60,90,0.55)');
      A.clouds(ctx, 960, 200, 4, 9, 'rgba(255,190,120,0.35)');
      // Thera als Silhouette: Steilküste rechts
      A.mountains(ctx, 960, 318, '#1a1220', 33, 60, 60);
      A.poly(ctx, [620, 318, 700, 250, 760, 236, 840, 228, 900, 240, 960, 226, 960, 320], '#120c18');
      A.poly(ctx, [700, 250, 760, 236, 770, 318, 700, 318], '#1a1020');
      for (let i = 0; i < 7; i++) A.rect(ctx, 790 + i * 22, 236 - (i % 2) * 4, 5, 6, '#e8e0d0');
      // Lichter von Fira am Hang, mit Spiegelung im Wasser
      {
        const r = ATL.U.rng(231);
        for (let i = 0; i < 26; i++) { const lx = 700 + r() * 250, ly = 240 + r() * 62; ctx.fillStyle = `rgba(255,${200 + Math.floor(r() * 40)},120,${0.5 + r() * 0.5})`; ctx.fillRect(lx, ly, 2, 2); }
      }
      // Rauch über Akrotiri
      for (let i = 0; i < 8; i++) A.ell(ctx, 720 + i * 10 - (i * i), 226 - i * 22, 26 + i * 8, 14 + i * 4, `rgba(120,110,120,${0.5 - i * 0.05})`);
      // Meer
      A.sea(ctx, 0, 318, 960, 282, '#6a3a5a', '#101828', 6);
      ctx.fillStyle = A.grad(ctx, 0, 316, 0, 340, ['rgba(255,190,140,0.35)', 'rgba(255,190,140,0)']); ctx.fillRect(0, 316, 960, 24);
      A.glow(ctx, 640, 330, 180, 'rgba(255,190,110,0.7)', 0.45); A.glow(ctx, 640, 390, 90, 'rgba(255,190,110,0.5)', 0.3);
      {
        const r = ATL.U.rng(232);
        for (let i = 0; i < 18; i++) { const lx = 710 + r() * 230, ly = 330 + r() * 70; A.line(ctx, lx, ly, lx, ly + 4 + r() * 10, `rgba(255,220,140,${0.15 + r() * 0.25})`, 1); }
      }
      // Ferne Fischerboote mit Positionslicht
      A.boat(ctx, 140, 334, 26, '#1a1220'); A.rect(ctx, 152, 322, 2, 12, '#1a1220'); ctx.fillStyle = '#ffd88a'; ctx.fillRect(153, 322, 2, 2);
      A.boat(ctx, 296, 330, 16, '#1a1220'); ctx.fillStyle = '#ffd88a'; ctx.fillRect(304, 328, 2, 2);
      // Boot, hinterer Rand
      A.rect(ctx, 330, 462, 340, 10, '#8a6a48');
      A.rect(ctx, 630, 430, 5, 40, '#5a4a3a');
      // Laterne am Mast, Netz über der Bordwand, Taurolle am Bug
      A.lantern(ctx, 642, 456, 0, true);
      ctx.strokeStyle = 'rgba(210,190,140,0.7)'; ctx.lineWidth = 1;
      for (let k = 0; k < 8; k++) { ctx.beginPath(); ctx.moveTo(346 + k * 8, 448); ctx.lineTo(352 + k * 8, 470); ctx.stroke(); }
      for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.moveTo(344, 452 + k * 6); ctx.lineTo(414, 450 + k * 6); ctx.stroke(); }
      A.circle(ctx, 356, 450, 2, '#c8b890'); A.circle(ctx, 392, 458, 2, '#c8b890');
      for (let k = 0; k < 3; k++) A.ell(ctx, 656, 468 - k * 2, 12 - k * 2, 4, null, '#b89a68', 3);
      A.grain(ctx, 960, 600, 12, 0.04);
    },
    paintFront(ctx) {
      A.boat(ctx, 320, 472, 360, '#7a5a3a');
      A.rect(ctx, 338, 478, 324, 10, '#5a4030');
      A.line(ctx, 340, 488, 660, 488, 'rgba(255,255,255,0.12)', 1);
      A.text(ctx, 'ΑΓΙΟΣ ΝΙΚΟΛΑΟΣ', 500, 520, { font: 'bold 11px Georgia', color: '#e8dcc0', align: 'center' });
      A.line(ctx, 640, 480, 700, 500, '#5a4a3a', 4);
      // Rettungsring an der Bordwand, Kanister am Bug, zweites Ruder achtern
      A.circle(ctx, 352, 506, 12, '#e8e0d0'); A.circle(ctx, 352, 506, 6, '#7a5a3a');
      for (let k = 0; k < 4; k++) { ctx.fillStyle = '#b03a3a'; ctx.beginPath(); ctx.arc(352, 506, 12, k * Math.PI / 2, k * Math.PI / 2 + 0.5); ctx.arc(352, 506, 6, k * Math.PI / 2 + 0.5, k * Math.PI / 2, true); ctx.closePath(); ctx.fill(); }
      A.rr(ctx, 636, 474, 20, 26, 2, '#6a3a2a'); A.rect(ctx, 640, 470, 8, 5, '#4a2a1a'); A.rect(ctx, 639, 480, 14, 2, 'rgba(255,255,255,0.15)');
      A.line(ctx, 296, 524, 372, 486, '#5a4a3a', 4); A.poly(ctx, [290, 528, 304, 520, 296, 512, 284, 520], '#4a3a2a');
      A.vignette(ctx, 960, 600, 0.4);
    },
    animate(ctx, t) {
      A.waterAnim(ctx, 0, 330, 960, 270, t, 'rgba(255,220,180,0.12)');
      A.birds(ctx, 120, 110, 5, t, 'rgba(30,20,40,0.65)', 220);
      A.birds(ctx, 420, 150, 3, t * 0.8 + 3, 'rgba(30,20,40,0.5)', 120);
      A.smoke(ctx, 722, 232, t * 0.7, 'rgba(140,130,140,0.3)', 2.2);
      for (let i = 0; i < 5; i++) { const lx = 760 + i * 40, on = Math.sin(t * (1.5 + i * 0.4) + i * 2) > 0.3; if (on) { ctx.fillStyle = 'rgba(255,240,180,0.9)'; ctx.fillRect(lx, 252 + (i % 3) * 14, 2, 2); } }
      A.glow(ctx, 642, 444, 44 + Math.sin(t * 9) * 3, 'rgba(255,200,100,0.7)', 0.3);
    },
    animateFront(ctx, t) {
      for (let i = 0; i < 3; i++) { const k = (t * 0.5 + i * 0.33) % 1; A.ell(ctx, 500, 552 + k * 14, 150 + k * 60, 6 + k * 6, null, `rgba(255,255,255,${0.18 * (1 - k)})`, 1.5); }
    },
    hotspots: [],
    actors: [{ id: 'stavros', x: 600, y: 508, dir: 'l' }],
    async enter(g) {
      await g.scene(async () => {
        g.place('livia', 440, 512, 'l');
        g.face('falk', 'r');
        await g.message('Abends. Stavros hat nicht gefragt, woher der Staub kam. Er hat gefragt, ob sie bezahlen können.', 3000);
        await g.wait(600);
        await g.say('stavros', 'Über Akrotiri steht eine Wolke. Das Tor der Deutschen ist weg, sagt der Junge vom Kiosk. Der ganze Hang.');
        await g.say('falk', 'Dann war es das mit dem Tor.');
        await g.say('stavros', 'Und die Deutschen?');
        await g.say('falk', 'Einer ist in Piräus, wenn er schnell war. Der andere ist nirgends mehr.');
        await g.wait(500);
        g.face('livia', 'l'); g.face('falk', 'r');
        await g.say('livia', 'Und? Glaubst du jetzt an Atlantis?');
        await g.say('falk', 'Ich glaube an Platon. Er hat gesagt, es sei nur eine Geschichte.');
        await g.say('livia', 'Das hat er nicht gesagt. Er hat Kritias sagen lassen, es sei wahr.');
        await g.say('falk', 'Und dann hat er mitten im Satz aufgehört. Das ist die ehrlichste Stelle im ganzen Buch.');
        await g.say('livia', 'Du bist unmöglich, Adrian.');
        await g.say('falk', 'Ich bin Archäologe. Das ist dasselbe, nur mit Spaten.');
        g.codex('platon');
        await g.wait(800);
        // Abspann
        await g.message('Die Meridian-Gesellschaft löste sich im Winter 1938 auf. Ihr Vorsitzender galt als verschollen. Niemand suchte lange.', 3400);
        if (g.has('figur')) { await g.message('Kessler wurde zuletzt in Piräus gesehen, auf einem Frachter nach Genua. Er reiste ohne Gepäck.', 3000); await g.message('Die Wächterfigur steht wieder auf dem Dachboden in Whitmore. Diesmal ohne Perle. Hank hat den Schlüssel.', 3200); }
        else await g.message('Kessler wurde zuletzt in Piräus gesehen, auf einem Frachter nach Genua. Er hatte eine Steinfigur unter dem Arm und wollte sie nicht verkaufen.', 3600);
        await g.message('Livia Marsh kehrte im Herbst mit einer Genehmigung nach Thera zurück. Der Hang bei Akrotiri war ein Hang. Sie grub trotzdem und fand Bimsstein.', 3600);
        await g.message('Adrian Falk hielt in Whitmore eine Vorlesung über den Kritias. Er nannte ihn eine Erfindung. Er sagte es sehr überzeugend, und er sah dabei aus dem Fenster.', 3800);
        await g.message('Die Metalltafel liegt in einer Schublade in Vermont. Livia übersetzt noch.', 2800);
        await g.message('Die Mythen, die beide hierher geführt haben, sind echt: Platons Atlantis, Solon in Sais, Thot und Maat, das Labyrinth, die Flut, die Apkallu, der Berg Thera. Der Kodex im Tagebuch nennt zu jedem die Quelle.', 4600);
        await g.message('Die Handlung ist erfunden. Die Insel auch. Wahrscheinlich.', 2800);
        await g.wait(400);
        await g.message('ENDE', 2600);
        g.set('at_fertig');
        g.objective(null);
        await g.goto('title');
        if (g.ui && !g.fast) g.ui.toggleMenu(true);
      });
    },
  });
})(window.ATL);
