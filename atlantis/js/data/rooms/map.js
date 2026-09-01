/* Die Reisekarte: Nordatlantik und Mittelmeer im Stil einer Seekarte der 1930er. */
(function (ATL) {
  const A = ATL.A;
  const S = () => ATL.story;

  ATL.rooms.define({
    id: 'map', name: 'Reisekarte', noHero: true, ambient: 'map', noSave: true,
    paint(ctx, g) {
      A.rect(ctx, 0, 0, 960, 600, '#d9c9a0');
      ctx.fillStyle = A.rgrad(ctx, 480, 300, 100, 700, ['rgba(255,250,230,0)', 'rgba(120,90,50,0.35)']);
      ctx.fillRect(0, 0, 960, 600);
      // Meer
      A.rect(ctx, 0, 0, 960, 600, '#b7c6b6');
      // Gitternetz
      ctx.strokeStyle = 'rgba(80,70,50,0.25)'; ctx.lineWidth = 1;
      for (let x = 0; x < 960; x += 80) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 600); ctx.stroke(); }
      for (let y = 0; y < 600; y += 80) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(960, y); ctx.stroke(); }
      const land = '#e6d7ae', edge = '#8a7a58';
      // Nordamerika (Ostküste)
      A.poly(ctx, [0, 0, 260, 0, 250, 90, 205, 150, 175, 200, 190, 250, 160, 300, 120, 340, 90, 420, 40, 470, 0, 480], land, edge, 2);
      // Grönland, Island
      A.poly(ctx, [300, 0, 420, 0, 400, 60, 350, 90, 310, 60], land, edge, 2);
      A.poly(ctx, [430, 120, 470, 112, 480, 135, 445, 145], land, edge, 2);
      // Europa
      A.poly(ctx, [520, 0, 960, 0, 960, 260, 900, 250, 860, 275, 820, 265, 780, 285, 740, 275, 700, 300, 660, 290, 640, 270, 600, 275, 570, 250, 540, 260, 520, 240, 500, 205, 470, 190, 490, 150, 520, 120, 545, 80, 520, 40], land, edge, 2);
      // Britische Inseln
      A.poly(ctx, [470, 80, 500, 60, 510, 110, 490, 140, 470, 120], land, edge, 2);
      // Afrika
      A.poly(ctx, [470, 330, 560, 320, 620, 340, 680, 345, 740, 360, 800, 390, 900, 420, 960, 440, 960, 600, 420, 600, 400, 500, 440, 400], land, edge, 2);
      // Arabien, Vorderer Orient
      A.poly(ctx, [700, 300, 760, 295, 820, 310, 880, 300, 960, 280, 960, 430, 900, 420, 840, 400, 780, 370], land, edge, 2);
      // Iberien, Italien, Griechenland als Zungen ins Mittelmeer
      A.poly(ctx, [500, 205, 560, 200, 580, 240, 540, 262, 505, 245], land, edge, 2);
      A.poly(ctx, [600, 220, 615, 275, 635, 300, 618, 305, 598, 270, 590, 240], land, edge, 2);
      A.poly(ctx, [640, 240, 670, 235, 675, 270, 660, 290, 645, 280], land, edge, 2);
      // Kreta, Zypern
      A.poly(ctx, [590, 298, 620, 296, 622, 304, 592, 306], land, edge, 1.5);
      A.poly(ctx, [700, 318, 722, 315, 724, 324, 704, 326], land, edge, 1.5);
      // Beschriftung
      const lab = (t, x, y, s) => A.text(ctx, t, x, y, { font: `italic ${s || 15}px Georgia`, color: '#5a4a30', align: 'center' });
      lab('ATLANTISCHER OZEAN', 330, 300, 17);
      lab('MITTELMEER', 590, 330, 13);
      lab('EUROPA', 700, 150, 17);
      lab('AFRIKA', 640, 500, 17);
      lab('AMERIKA', 110, 120, 15);
      lab('ARABIEN', 860, 370, 12);
      // Kompassrose
      ctx.save(); ctx.translate(850, 110);
      for (let i = 0; i < 8; i++) { ctx.rotate(Math.PI / 4); A.poly(ctx, [0, 0, 8, -8, 0, i % 2 ? -34 : -50, -8, -8], i % 2 ? '#8a7a58' : '#3a2a1a'); }
      ctx.restore();
      A.text(ctx, 'N', 850, 50, { font: 'bold 16px Georgia', color: '#3a2a1a', align: 'center' });
      // Orte
      for (const id in S().locations) {
        const l = S().locations[id];
        const avail = l.cond(g) || g.flag('ort') === id;
        A.circle(ctx, l.x, l.y, 5, avail ? '#a3312a' : '#8a7a58');
        A.circle(ctx, l.x, l.y, 8, null, avail ? '#a3312a' : '#8a7a58', 1.5);
        A.text(ctx, l.name, l.x + (l.x > 700 ? -12 : 12), l.y + 5, { font: 'bold 14px Georgia', color: avail ? '#3a1a10' : '#7a6a48', align: l.x > 700 ? 'right' : 'left' });
      }
      A.text(ctx, 'Klick auf einen Ort, um dorthin zu reisen.', 480, 585, { font: '15px Georgia', color: '#5a4a30', align: 'center' });
      A.grain(ctx, 960, 600, 9, 0.04);
      A.vignette(ctx, 960, 600, 0.35);
    },
    animate(ctx, t, g) {
      const r = g.flag('reise');
      if (!r) return;
      const [x0, y0] = r.from, [x1, y1] = r.to;
      const n = Math.floor(40 * r.t);
      ctx.fillStyle = '#a3312a';
      for (let i = 0; i <= n; i++) { const k = i / 40; ctx.fillRect(x0 + (x1 - x0) * k - 2, y0 + (y1 - y0) * k - 2, 4, 4); }
      const px = x0 + (x1 - x0) * r.t, py = y0 + (y1 - y0) * r.t;
      ctx.save(); ctx.translate(px, py); ctx.rotate(Math.atan2(y1 - y0, x1 - x0));
      A.poly(ctx, [-14, 0, 6, -5, 12, 0, 6, 5], '#3a2a1a');
      A.poly(ctx, [-2, 0, 0, -12, 4, -12, 4, 12, 0, 12], '#3a2a1a');
      ctx.restore();
    },
    get hotspots() {
      return Object.keys(S().locations).map((id) => {
        const l = S().locations[id];
        return { id: 'ort_' + id, name: l.name, rect: [l.x - 14, l.y - 14, 28 + l.name.length * 8, 28], cond: (g) => l.cond(g) && g.flag('ort') !== id, noWalk: true, walk: (g) => S().travel(g, id), look: (g) => `${l.name}. ${g.flag('ort') === id ? 'Hier bin ich.' : 'Da könnte ich hinreisen.'}`, use: (g) => S().travel(g, id) };
      });
    },
  });
})(window.ATL);
