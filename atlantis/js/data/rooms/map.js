/* Die Reisekarte: Nordatlantik und Mittelmeer im Stil einer Seekarte der 1930er. */
(function (ATL) {
  const A = ATL.A;
  const S = () => ATL.story;

  ATL.rooms.define({
    id: 'map', name: 'Reisekarte', noHero: true, ambient: 'map', noSave: true,
    paint(ctx, g) {
      // Projektion: Länge -80..50 auf x, Breite 62..20 auf y
      const P = (lon, lat) => [(lon + 80) * (960 / 130), (62 - lat) * (600 / 42)];
      const poly = (pts, fill, stroke, lw) => { const flat = []; pts.forEach(([lo, la]) => flat.push(...P(lo, la))); A.poly(ctx, flat, fill, stroke, lw); };
      const path = (pts, color, lw) => { const flat = []; pts.forEach(([lo, la]) => flat.push(...P(lo, la))); A.path(ctx, flat, color, lw); };
      const sea = '#b7c6b6', land = '#e6d7ae', edge = '#8a7a58';
      A.rect(ctx, 0, 0, 960, 600, sea);
      // Gitternetz alle 10 Grad
      ctx.strokeStyle = 'rgba(80,70,50,0.22)'; ctx.lineWidth = 1;
      for (let lo = -80; lo <= 50; lo += 10) { const [x] = P(lo, 40); ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 600); ctx.stroke(); }
      for (let la = 20; la <= 60; la += 10) { const [, y] = P(0, la); ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(960, y); ctx.stroke(); }
      // Nordamerika, Ostküste
      poly([[-80, 62], [-70, 62], [-62, 58], [-56, 53], [-56, 47.5], [-60, 45.5], [-64, 44.8], [-66.5, 44.5], [-70, 42.2], [-71, 41.4], [-74, 40.6], [-75.5, 38.5], [-75.5, 35.3], [-78, 33.9], [-80, 32], [-80, 20], [-80, 62]], land, edge, 2);
      poly([[-80, 30], [-80.5, 26], [-80, 20], [-81, 20], [-81, 25], [-80.7, 29]], land, edge, 1);
      // Grönlandspitze
      poly([[-55, 62], [-50, 61], [-44, 60], [-42, 61], [-41, 62]], land, edge, 1.5);
      // Europa, Afrika und Vorderasien als eine Landmasse, Meere werden darauf gelegt
      poly([[5, 62], [4.6, 58.6], [8.2, 57], [8.5, 55], [4.5, 52.5], [1.6, 50.9], [-1.5, 49.6], [-4.7, 48.4], [-1.6, 46.5], [-1.5, 43.5], [-8.5, 43.5], [-9.3, 41.5], [-9.4, 39], [-9, 37], [-6, 36.2], [-5.4, 35.9], [-9.7, 32], [-11.5, 28.5], [-13, 27.5], [-15, 24], [-17, 21], [-17, 20], [50, 20], [50, 62], [5, 62]], land, edge, 2);
      // Mittelmeer
      poly([[-5.4, 35.9], [-2, 36.7], [0, 38.5], [0.2, 39.6], [2.2, 41.4], [3.3, 43.2], [5, 43.4], [7.6, 43.8], [9, 44.4], [10, 43.2], [11.2, 42.4], [12.2, 41.7], [13.2, 41.2], [14.3, 40.7], [15.6, 40], [15.7, 38.2], [16.6, 38.9], [17.2, 39.4], [18.5, 39.9], [18.1, 40.7], [16.6, 41.3], [15.6, 42], [14.1, 42.6], [13, 43.8], [12.4, 44.5], [12.3, 45.4], [13.7, 45.7], [14, 45], [15.1, 44.2], [16.6, 43.3], [18, 42.5], [19.5, 41.8], [19.4, 40.5], [20.1, 39.5], [21, 38.4], [21.7, 37], [22.5, 36.5], [23.1, 36.7], [23.2, 37.7], [24, 37.6], [23.6, 38.3], [24.1, 38.9], [22.9, 39.6], [22.7, 40.5], [24, 40.9], [26, 40.7], [26.2, 40.1], [26.5, 39.4], [26.8, 38.4], [27.3, 37], [28.2, 36.7], [29.3, 36.3], [30.6, 36.8], [32, 36.1], [34, 36.2], [36, 36.7], [36, 35], [35.8, 34], [35, 32.8], [34.6, 31.8], [34, 31.2], [32.5, 31.1], [31.6, 31.5], [30.5, 31.4], [29.9, 31.2], [28, 31], [25.5, 31.8], [24, 32.4], [22, 32.9], [20, 32.4], [19.8, 31], [19, 30.3], [17.5, 31], [15.7, 32.4], [14.3, 32.6], [12, 33.2], [11.2, 33.4], [10.6, 34.6], [11, 35.6], [10.9, 37.3], [9.7, 37.3], [8, 37], [6.5, 37.1], [3, 36.9], [0, 35.9], [-2, 35.2]], sea, edge, 2);
      // Schwarzes Meer, Rotes Meer, Persischer Golf, Nordsee-Einschnitt
      poly([[28, 41.3], [29, 41.2], [31, 41.1], [34, 42], [37, 41.2], [39.5, 41.5], [41, 41.6], [41.6, 42.5], [40, 43.6], [38, 44.5], [36.6, 45.2], [33, 44.5], [33.6, 46], [31, 46.6], [29.6, 45.3], [28.6, 44], [28, 42.5]], sea, edge, 2);
      poly([[32.6, 29.9], [33.9, 27.7], [35.5, 24.5], [37, 22], [38.5, 20], [41.5, 20], [39.5, 22.3], [38, 24.5], [36.5, 26.5], [35, 28], [34.6, 29.5]], sea, edge, 2);
      poly([[47.8, 30.2], [50, 29.6], [50, 26.8], [48.6, 28.4]], sea, edge, 2);
      poly([[4.5, 52.5], [8.5, 55], [8.2, 57], [5, 62], [-1, 62], [-1, 55]], sea, edge, 2);
      // Britische Inseln, Inseln im Mittelmeer
      poly([[-5.7, 50.1], [1.4, 51.2], [1.8, 52.8], [-0.5, 54.6], [-1.5, 55.6], [-2, 57.6], [-3.5, 58.6], [-6, 58.2], [-5, 56.5], [-6, 55.3], [-4.7, 54.7], [-3.2, 54], [-4.5, 53.3], [-4.5, 51.7]], land, edge, 1.5);
      poly([[-10, 51.5], [-6, 52.2], [-5.5, 54.5], [-8, 55.3], [-10, 53.5]], land, edge, 1.5);
      poly([[12.4, 37.9], [15.2, 38.3], [15.7, 37.9], [15.1, 36.7], [12.6, 37.6]], land, edge, 1.5);
      poly([[8.2, 41.1], [9.7, 41.2], [9.7, 39.1], [8.4, 38.9]], land, edge, 1.5);
      poly([[8.6, 43], [9.5, 42.8], [9.3, 41.4], [8.6, 41.7]], land, edge, 1.5);
      poly([[23.5, 35.3], [26.3, 35.3], [26.2, 35], [24.5, 34.9], [23.5, 35.1]], land, edge, 1.5);
      poly([[32.3, 35], [34.6, 35.7], [34, 34.7], [32.5, 34.6]], land, edge, 1.5);
      poly([[1.2, 39.1], [3.3, 39.9], [3.4, 39.6], [1.4, 38.7]], land, edge, 1);
      // Flüsse
      path([[31, 31.4], [31.2, 30], [31.3, 28], [31, 26], [32.9, 24.5], [32.7, 22], [31.5, 20]], 'rgba(80,110,140,0.8)', 1.5);
      path([[38.5, 37.6], [40.5, 35], [43, 33.5], [44.5, 32], [46.2, 31], [47.8, 30.4]], 'rgba(80,110,140,0.8)', 1.5);
      path([[3.4, 43.4], [4.7, 45], [4.9, 47.5]], 'rgba(80,110,140,0.6)', 1);
      // Beschriftung
      const lab = (t, x, y, s) => A.text(ctx, t, x, y, { font: `italic ${s || 15}px Georgia`, color: '#5a4a30', align: 'center' });
      lab('ATLANTISCHER OZEAN', 300, 330, 17);
      lab('MITTELMEER', 705, 372, 12);
      lab('EUROPA', 700, 190, 17);
      lab('AFRIKA', 640, 530, 17);
      lab('AMERIKA', 90, 400, 15);
      lab('ARABIEN', 905, 520, 12);
      lab('SCHWARZES MEER', 848, 250, 10);
      // Kompassrose
      ctx.save(); ctx.translate(120, 110);
      for (let i = 0; i < 8; i++) { ctx.rotate(Math.PI / 4); A.poly(ctx, [0, 0, 8, -8, 0, i % 2 ? -34 : -50, -8, -8], i % 2 ? '#8a7a58' : '#3a2a1a'); }
      ctx.restore();
      A.text(ctx, 'N', 120, 50, { font: 'bold 16px Georgia', color: '#3a2a1a', align: 'center' });
      // Orte
      for (const id in S().locations) {
        const l = S().locations[id];
        const avail = l.cond(g) || g.flag('ort') === id;
        A.circle(ctx, l.x, l.y, 5, avail ? '#a3312a' : '#8a7a58');
        A.circle(ctx, l.x, l.y, 8, null, avail ? '#a3312a' : '#8a7a58', 1.5);
        const right = l.labelSide !== 'left';
        A.text(ctx, l.name, l.x + (right ? 12 : -12), l.y + (l.labelDy || 5), { font: 'bold 14px Georgia', color: avail ? '#3a1a10' : '#7a6a48', align: right ? 'left' : 'right' });
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
        const lw = 28 + l.name.length * 8; return { id: 'ort_' + id, name: l.name, rect: [l.labelSide === 'left' ? l.x + 14 - lw : l.x - 14, l.y - 14, lw, 28], cond: (g) => l.cond(g) && g.flag('ort') !== id, noWalk: true, walk: (g) => S().travel(g, id), look: (g) => `${l.name}. ${g.flag('ort') === id ? 'Hier bin ich.' : 'Da könnte ich hinreisen.'}`, use: (g) => S().travel(g, id) };
      });
    },
  });
})(window.ATL);
