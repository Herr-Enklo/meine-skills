/* Zeichenbibliothek für Hintergründe. Alle Räume werden aus diesen Bausteinen gemalt. */
(function (ATL) {
  const A = {};
  const TAU = Math.PI * 2;
  const shade = ATL.shade;
  A.shade = shade;

  A.grad = (ctx, x0, y0, x1, y1, stops) => {
    const g = ctx.createLinearGradient(x0, y0, x1, y1);
    stops.forEach((s, i) => g.addColorStop(typeof s === 'string' ? i / (stops.length - 1) : s[0], typeof s === 'string' ? s : s[1]));
    return g;
  };
  A.rgrad = (ctx, x, y, r0, r1, stops) => {
    const g = ctx.createRadialGradient(x, y, r0, x, y, r1);
    stops.forEach((s, i) => g.addColorStop(typeof s === 'string' ? i / (stops.length - 1) : s[0], typeof s === 'string' ? s : s[1]));
    return g;
  };
  A.rect = (ctx, x, y, w, h, fill) => { ctx.fillStyle = fill; ctx.fillRect(x, y, w, h); };
  A.rr = (ctx, x, y, w, h, r, fill, stroke, lw) => {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw || 1; ctx.stroke(); }
  };
  A.poly = (ctx, pts, fill, stroke, lw) => {
    ctx.beginPath();
    for (let i = 0; i < pts.length; i += 2) i ? ctx.lineTo(pts[i], pts[i + 1]) : ctx.moveTo(pts[i], pts[i + 1]);
    ctx.closePath();
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw || 1; ctx.stroke(); }
  };
  A.ell = (ctx, x, y, rx, ry, fill, stroke, lw) => {
    ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, TAU); ctx.closePath();
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw || 1; ctx.stroke(); }
  };
  A.circle = (ctx, x, y, r, fill, stroke, lw) => A.ell(ctx, x, y, r, r, fill, stroke, lw);
  A.line = (ctx, x0, y0, x1, y1, color, w) => {
    ctx.strokeStyle = color; ctx.lineWidth = w || 1; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
  };
  A.path = (ctx, pts, color, w, close) => {
    ctx.strokeStyle = color; ctx.lineWidth = w || 1; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath();
    for (let i = 0; i < pts.length; i += 2) i ? ctx.lineTo(pts[i], pts[i + 1]) : ctx.moveTo(pts[i], pts[i + 1]);
    if (close) ctx.closePath();
    ctx.stroke();
  };
  A.text = (ctx, str, x, y, o) => {
    o = o || {};
    ctx.font = o.font || '16px Georgia';
    ctx.textAlign = o.align || 'left';
    ctx.textBaseline = o.baseline || 'alphabetic';
    if (o.shadow) { ctx.fillStyle = o.shadow; ctx.fillText(str, x + 1, y + 1); }
    ctx.fillStyle = o.color || '#000';
    ctx.fillText(str, x, y);
  };

  // ---------- Himmel, Landschaft ----------
  A.sky = (ctx, w, h, top, bottom, y0) => {
    ctx.fillStyle = A.grad(ctx, 0, y0 || 0, 0, h, [top, bottom]);
    ctx.fillRect(0, y0 || 0, w, h - (y0 || 0));
  };
  A.stars = (ctx, w, h, n, seed, color) => {
    const r = ATL.U.rng(seed || 1);
    for (let i = 0; i < n; i++) {
      const x = r() * w, y = r() * h, s = r();
      ctx.fillStyle = color || `rgba(255,255,230,${0.3 + s * 0.7})`;
      ctx.fillRect(x, y, s > 0.8 ? 2 : 1, s > 0.8 ? 2 : 1);
    }
  };
  A.sun = (ctx, x, y, r, color) => {
    ctx.fillStyle = A.rgrad(ctx, x, y, r * 0.6, r * 4, [[0, color || '#fff6d0'], [0.25, 'rgba(255,230,160,0.35)'], [1, 'rgba(255,220,150,0)']]);
    ctx.fillRect(x - r * 4, y - r * 4, r * 8, r * 8);
    A.circle(ctx, x, y, r, color || '#fff6d0');
  };
  A.moon = (ctx, x, y, r) => {
    ctx.fillStyle = A.rgrad(ctx, x, y, r, r * 3, [[0, 'rgba(230,235,255,0.35)'], [1, 'rgba(230,235,255,0)']]);
    ctx.fillRect(x - r * 3, y - r * 3, r * 6, r * 6);
    A.circle(ctx, x, y, r, '#e8ecf5');
    A.circle(ctx, x + r * 0.3, y - r * 0.2, r * 0.75, 'rgba(180,190,215,0.35)');
  };
  A.clouds = (ctx, w, y, n, seed, color) => {
    const r = ATL.U.rng(seed || 3);
    for (let i = 0; i < n; i++) {
      const cx = r() * w, cy = y + (r() - 0.5) * 40, s = 30 + r() * 60;
      ctx.fillStyle = color || 'rgba(255,255,255,0.55)';
      for (let k = 0; k < 5; k++) A.ell(ctx, cx + (k - 2) * s * 0.4, cy + (k % 2) * s * 0.1, s * (0.5 + (k === 2 ? 0.3 : 0)), s * 0.28, ctx.fillStyle);
    }
  };
  A.mountains = (ctx, w, baseY, color, seed, amp, step) => {
    const r = ATL.U.rng(seed || 5);
    amp = amp || 80; step = step || 90;
    const pts = [0, baseY];
    let x = 0;
    while (x < w + step) { pts.push(x, baseY - r() * amp); x += step * (0.6 + r() * 0.8); }
    pts.push(w, baseY, w, baseY + 400, 0, baseY + 400);
    A.poly(ctx, pts, color);
  };
  A.hills = (ctx, w, baseY, color, seed, amp) => {
    const r = ATL.U.rng(seed || 7);
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.moveTo(0, baseY + 400);
    let x = 0;
    ctx.lineTo(0, baseY);
    while (x < w) {
      const nx = x + 120 + r() * 160;
      ctx.quadraticCurveTo(x + (nx - x) / 2, baseY - (amp || 40) * (0.4 + r()), nx, baseY);
      x = nx;
    }
    ctx.lineTo(w, baseY + 400); ctx.closePath(); ctx.fill();
  };
  A.sea = (ctx, x, y, w, h, c1, c2, seed) => {
    ctx.fillStyle = A.grad(ctx, 0, y, 0, y + h, [c1, c2]);
    ctx.fillRect(x, y, w, h);
    const r = ATL.U.rng(seed || 11);
    for (let i = 0; i < 60; i++) {
      const ly = y + r() * h, lx = x + r() * w, lw = 10 + r() * 60 * (ly - y) / h;
      A.line(ctx, lx, ly, lx + lw, ly, `rgba(255,255,255,${0.05 + r() * 0.2 * (ly - y) / h})`, 1);
    }
  };
  A.waterAnim = (ctx, x, y, w, h, t, color) => {
    ctx.save();
    ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
    for (let i = 0; i < 12; i++) {
      const ly = y + ((i * 41 + t * 12) % h);
      const ph = t * 1.3 + i;
      const lx = x + w * 0.5 + Math.sin(ph) * w * 0.35;
      const lw = 30 + Math.sin(ph * 1.7) * 20 + 40 * (ly - y) / h;
      A.line(ctx, lx - lw / 2, ly, lx + lw / 2, ly, color || 'rgba(255,255,255,0.12)', 1.5);
    }
    ctx.restore();
  };
  A.ground = (ctx, x, y, w, h, c1, c2) => { ctx.fillStyle = A.grad(ctx, 0, y, 0, y + h, [c1, c2]); ctx.fillRect(x, y, w, h); };
  A.floorTiles = (ctx, w, y0, y1, c1, c2, cols, vanishX) => {
    // Perspektivischer Fliesenboden
    ctx.fillStyle = A.grad(ctx, 0, y0, 0, y1, [c1, c2]); ctx.fillRect(0, y0, w, y1 - y0);
    vanishX = vanishX ?? w / 2;
    cols = cols || 12;
    ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 1;
    for (let i = 0; i <= cols; i++) {
      const bx = (i / cols) * w * 1.6 - w * 0.3;
      ctx.beginPath(); ctx.moveTo(vanishX + (bx - vanishX) * 0.35, y0); ctx.lineTo(bx, y1); ctx.stroke();
    }
    const rows = 6;
    for (let j = 0; j <= rows; j++) {
      const t = j / rows;
      const y = y0 + (y1 - y0) * t * t;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }
  };
  A.planks = (ctx, x, y, w, h, color, n, vertical, seed) => {
    ctx.fillStyle = color; ctx.fillRect(x, y, w, h);
    const r = ATL.U.rng(seed || 13);
    n = n || 8;
    for (let i = 0; i < n; i++) {
      const c = shade(color, (r() - 0.5) * 0.2);
      if (vertical) { ctx.fillStyle = c; ctx.fillRect(x + (i * w) / n, y, w / n - 1, h); }
      else { ctx.fillStyle = c; ctx.fillRect(x, y + (i * h) / n, w, h / n - 1); }
    }
  };
  A.wall = (ctx, x, y, w, h, color, seed) => {
    ctx.fillStyle = A.grad(ctx, x, y, x, y + h, [shade(color, 0.08), color, shade(color, -0.12)]);
    ctx.fillRect(x, y, w, h);
    const r = ATL.U.rng(seed || 17);
    for (let i = 0; i < (w * h) / 400; i++) {
      ctx.fillStyle = `rgba(0,0,0,${r() * 0.06})`;
      ctx.fillRect(x + r() * w, y + r() * h, 2 + r() * 6, 1 + r() * 3);
    }
  };
  A.bricks = (ctx, x, y, w, h, color, bw, bh, seed, mortar) => {
    bw = bw || 40; bh = bh || 16;
    ctx.fillStyle = mortar || shade(color, -0.35); ctx.fillRect(x, y, w, h);
    const r = ATL.U.rng(seed || 19);
    ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
    for (let row = 0; row * bh < h; row++) {
      const off = row % 2 ? bw / 2 : 0;
      for (let col = -1; col * bw < w + bw; col++) {
        ctx.fillStyle = shade(color, (r() - 0.5) * 0.25);
        ctx.fillRect(x + col * bw + off + 1, y + row * bh + 1, bw - 2, bh - 2);
      }
    }
    ctx.restore();
  };
  A.stones = (ctx, x, y, w, h, color, seed, size) => {
    size = size || 30;
    ctx.fillStyle = shade(color, -0.4); ctx.fillRect(x, y, w, h);
    const r = ATL.U.rng(seed || 23);
    ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
    for (let row = 0; row * size < h + size; row++) {
      let cx = x - r() * size;
      while (cx < x + w) {
        const sw = size * (0.7 + r() * 0.9), sh = size * (0.7 + r() * 0.5);
        const cy = y + row * size + (r() - 0.5) * size * 0.3;
        A.rr(ctx, cx + 1, cy + 1, sw - 2, sh - 2, 4 + r() * 6, shade(color, (r() - 0.5) * 0.3));
        cx += sw;
      }
    }
    ctx.restore();
  };
  A.column = (ctx, x, baseY, h, w, color, style) => {
    style = style || 'doric';
    const top = baseY - h;
    ctx.fillStyle = A.grad(ctx, x - w / 2, 0, x + w / 2, 0, [shade(color, -0.3), shade(color, 0.15), color, shade(color, -0.35)]);
    ctx.fillRect(x - w / 2, top, w, h);
    if (style === 'doric') {
      for (let i = 1; i < 5; i++) A.line(ctx, x - w / 2 + (i * w) / 5, top, x - w / 2 + (i * w) / 5, baseY, 'rgba(0,0,0,0.12)', 1.5);
      A.rect(ctx, x - w * 0.65, top - 10, w * 1.3, 10, shade(color, 0.05));
      A.rect(ctx, x - w * 0.6, baseY - 6, w * 1.2, 6, shade(color, -0.1));
    } else if (style === 'egypt') {
      A.rect(ctx, x - w * 0.7, top - 14, w * 1.4, 14, shade(color, 0.05));
      A.ell(ctx, x, top, w * 0.8, 10, shade(color, -0.1));
      ATL.A.hieroglyphs(ctx, x - w / 2 + 4, top + 30, w - 8, h - 60, 'rgba(60,40,20,0.45)', Math.floor(x));
    } else if (style === 'minoan') {
      // minoische Säulen sind oben breiter als unten
      ctx.fillStyle = A.grad(ctx, x - w / 2, 0, x + w / 2, 0, [shade(color, -0.3), shade(color, 0.1), shade(color, -0.3)]);
      A.poly(ctx, [x - w * 0.35, baseY, x + w * 0.35, baseY, x + w * 0.5, top, x - w * 0.5, top], ctx.fillStyle);
      A.ell(ctx, x, top, w * 0.7, 8, shade(color, -0.15));
      A.rect(ctx, x - w * 0.8, top - 12, w * 1.6, 8, '#2a2a2a');
    } else if (style === 'atlantis') {
      A.rect(ctx, x - w * 0.7, top - 12, w * 1.4, 12, shade(color, 0.1));
      for (let yy = top + 20; yy < baseY - 10; yy += 24) A.line(ctx, x - w / 2 + 2, yy, x + w / 2 - 2, yy + 8, 'rgba(120,255,220,0.25)', 2);
    }
  };
  A.door = (ctx, x, y, w, h, color, o) => {
    o = o || {};
    if (o.frame !== false) A.rect(ctx, x - 6, y - 6, w + 12, h + 6, o.frame || shade(color, -0.4));
    if (o.open) {
      A.rect(ctx, x, y, w, h, o.inside || '#08060a');
      ctx.fillStyle = shade(color, -0.2);
      A.poly(ctx, [x, y, x + w * 0.35, y + 8, x + w * 0.35, y + h - 4, x, y + h], ctx.fillStyle);
    } else {
      if (o.arch) { A.rect(ctx, x, y + w / 2, w, h - w / 2, color); A.ell(ctx, x + w / 2, y + w / 2, w / 2, w / 2, color); }
      else A.rect(ctx, x, y, w, h, color);
      if (o.planks !== false) for (let i = 1; i < 4; i++) A.line(ctx, x + (i * w) / 4, y + (o.arch ? w / 4 : 0), x + (i * w) / 4, y + h, 'rgba(0,0,0,0.25)', 1.5);
      if (o.panel) { A.rr(ctx, x + 8, y + 10, w - 16, h * 0.4, 3, null, 'rgba(0,0,0,0.3)', 2); A.rr(ctx, x + 8, y + h * 0.55, w - 16, h * 0.38, 3, null, 'rgba(0,0,0,0.3)', 2); }
      A.circle(ctx, x + w - 12, y + h * 0.55, 3.5, o.knob || '#c9a03a');
    }
  };
  A.window = (ctx, x, y, w, h, o) => {
    o = o || {};
    A.rect(ctx, x - 4, y - 4, w + 8, h + 8, o.frame || '#3a2a1a');
    ctx.fillStyle = o.light || A.grad(ctx, x, y, x, y + h, ['#cfe3f5', '#8fb6d8']);
    ctx.fillRect(x, y, w, h);
    if (o.view) { ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip(); o.view(ctx); ctx.restore(); }
    A.line(ctx, x + w / 2, y, x + w / 2, y + h, o.frame || '#3a2a1a', 4);
    A.line(ctx, x, y + h / 2, x + w, y + h / 2, o.frame || '#3a2a1a', 4);
  };
  A.arch = (ctx, x, y, w, h, color, inside) => {
    A.rect(ctx, x, y + w / 2, w, h - w / 2, inside || '#0a0806');
    A.ell(ctx, x + w / 2, y + w / 2, w / 2, w / 2, inside || '#0a0806');
    ctx.strokeStyle = color; ctx.lineWidth = 10;
    ctx.beginPath(); ctx.moveTo(x, y + h); ctx.lineTo(x, y + w / 2); ctx.arc(x + w / 2, y + w / 2, w / 2, Math.PI, 0); ctx.lineTo(x + w, y + h); ctx.stroke();
  };

  // ---------- Einrichtung ----------
  A.crate = (ctx, x, y, w, h, color, label) => {
    A.rect(ctx, x, y, w, h, color);
    ctx.strokeStyle = shade(color, -0.4); ctx.lineWidth = 2;
    ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
    A.line(ctx, x + 2, y + 2, x + w - 2, y + h - 2, shade(color, -0.3), 2);
    A.line(ctx, x + w - 2, y + 2, x + 2, y + h - 2, shade(color, -0.3), 2);
    if (label) A.text(ctx, label, x + w / 2, y + h / 2 + 4, { font: `bold ${Math.max(9, h / 5)}px Georgia`, color: shade(color, -0.55), align: 'center' });
  };
  A.barrel = (ctx, x, y, w, h, color) => {
    ctx.fillStyle = A.grad(ctx, x, 0, x + w, 0, [shade(color, -0.3), shade(color, 0.1), shade(color, -0.3)]);
    A.rr(ctx, x, y, w, h, w / 3, ctx.fillStyle);
    A.rect(ctx, x, y + h * 0.2, w, 4, '#3a3a3a'); A.rect(ctx, x, y + h * 0.75, w, 4, '#3a3a3a');
    A.ell(ctx, x + w / 2, y + 2, w / 2, 5, shade(color, 0.15));
  };
  A.table = (ctx, x, y, w, h, color, legH) => {
    legH = legH || 40;
    A.rect(ctx, x + 6, y + h, 8, legH, shade(color, -0.3));
    A.rect(ctx, x + w - 14, y + h, 8, legH, shade(color, -0.3));
    A.rect(ctx, x, y, w, h, color);
    A.rect(ctx, x, y, w, 4, shade(color, 0.15));
  };
  A.chair = (ctx, x, y, w, color) => {
    A.rect(ctx, x, y - w * 1.2, w, w * 0.9, color);
    A.rect(ctx, x, y - w * 0.3, w, 6, shade(color, 0.1));
    A.rect(ctx, x + 2, y - w * 0.25, 4, w * 0.6, shade(color, -0.3));
    A.rect(ctx, x + w - 6, y - w * 0.25, 4, w * 0.6, shade(color, -0.3));
  };
  A.books = (ctx, x, y, w, h, seed) => {
    const r = ATL.U.rng(seed || 29);
    const cols = ['#7a2e2e', '#2e4a7a', '#4a6a2e', '#7a6a2e', '#5a3a6a', '#3a3a3a', '#8a5a3a', '#a08050'];
    let cx = x;
    while (cx < x + w - 4) {
      const bw = 6 + r() * 10, bh = h * (0.7 + r() * 0.3);
      A.rect(ctx, cx, y + h - bh, bw, bh, cols[Math.floor(r() * cols.length)]);
      A.rect(ctx, cx + 1, y + h - bh + 3, bw - 2, 1, 'rgba(255,255,255,0.25)');
      cx += bw + 1;
    }
  };
  A.shelf = (ctx, x, y, w, h, color, rows, seed) => {
    A.rect(ctx, x, y, w, h, shade(color, -0.25));
    rows = rows || 4;
    const rh = h / rows;
    for (let i = 0; i < rows; i++) {
      A.rect(ctx, x + 4, y + i * rh + 4, w - 8, rh - 4, shade(color, -0.55));
      A.books(ctx, x + 6, y + i * rh + 8, w - 12, rh - 10, (seed || 1) * 7 + i);
      A.rect(ctx, x, y + (i + 1) * rh - 3, w, 4, color);
    }
    A.rect(ctx, x, y, 4, h, color); A.rect(ctx, x + w - 4, y, 4, h, color);
  };
  A.rug = (ctx, x, y, w, h, c1, c2) => {
    A.rect(ctx, x, y, w, h, c1);
    A.rect(ctx, x + 8, y + 6, w - 16, h - 12, c2);
    A.rect(ctx, x + 16, y + 12, w - 32, h - 24, c1);
    for (let i = 0; i < w; i += 8) A.rect(ctx, x + i, y - 3, 3, 3, c2), A.rect(ctx, x + i, y + h, 3, 3, c2);
  };
  A.ladder = (ctx, x, y, h, color, w) => {
    w = w || 30;
    A.rect(ctx, x, y, 5, h, color); A.rect(ctx, x + w, y, 5, h, color);
    for (let yy = y + 10; yy < y + h; yy += 18) A.rect(ctx, x, yy, w + 5, 4, shade(color, 0.1));
  };
  A.stairs = (ctx, x, y, w, steps, stepH, color, dir) => {
    for (let i = 0; i < steps; i++) {
      const sx = dir === 'l' ? x + i * (w / steps) : x;
      A.rect(ctx, sx, y - i * stepH, w - i * (w / steps), stepH, shade(color, i * 0.03));
      A.rect(ctx, sx, y - i * stepH, w - i * (w / steps), 2, shade(color, 0.2));
    }
  };
  A.rope = (ctx, pts, color, w) => {
    ctx.strokeStyle = color || '#b89a68'; ctx.lineWidth = w || 3; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
    ctx.stroke();
  };
  A.chain = (ctx, x0, y0, x1, y1, color) => {
    const n = Math.floor(Math.hypot(x1 - x0, y1 - y0) / 8);
    for (let i = 0; i <= n; i++) A.ell(ctx, x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n, 3, 4.5, null, color || '#777', 1.5);
  };

  // ---------- Natur ----------
  A.palm = (ctx, x, baseY, h, seed) => {
    const r = ATL.U.rng(seed || 31);
    const lean = (r() - 0.5) * 0.5;
    ctx.strokeStyle = '#5a4630'; ctx.lineWidth = h * 0.07; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x, baseY); ctx.quadraticCurveTo(x + lean * h * 0.5, baseY - h * 0.6, x + lean * h, baseY - h); ctx.stroke();
    const tx = x + lean * h, ty = baseY - h;
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * TAU + r() * 0.5;
      const len = h * (0.35 + r() * 0.2);
      ctx.strokeStyle = i % 2 ? '#3d7a3a' : '#2e5e2c'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(tx, ty);
      ctx.quadraticCurveTo(tx + Math.cos(a) * len * 0.6, ty + Math.sin(a) * len * 0.6 - len * 0.3, tx + Math.cos(a) * len, ty + Math.sin(a) * len * 0.5 + len * 0.3);
      ctx.stroke();
    }
    A.circle(ctx, tx, ty + 3, h * 0.05, '#6a4a2a');
  };
  A.tree = (ctx, x, baseY, h, leaf, trunk, seed) => {
    const r = ATL.U.rng(seed || 37);
    A.rect(ctx, x - h * 0.05, baseY - h * 0.45, h * 0.1, h * 0.45, trunk || '#4a3624');
    for (let i = 0; i < 6; i++) {
      const cx = x + (r() - 0.5) * h * 0.5, cy = baseY - h * 0.55 - r() * h * 0.35;
      A.circle(ctx, cx, cy, h * (0.16 + r() * 0.12), shade(leaf || '#3f6a2e', (r() - 0.5) * 0.3));
    }
  };
  A.cypress = (ctx, x, baseY, h, color) => {
    A.poly(ctx, [x, baseY - h, x + h * 0.12, baseY - h * 0.5, x + h * 0.09, baseY, x - h * 0.09, baseY, x - h * 0.12, baseY - h * 0.5], color || '#1f3a1e');
  };
  A.bush = (ctx, x, y, w, color, seed) => {
    const r = ATL.U.rng(seed || 41);
    for (let i = 0; i < 5; i++) A.circle(ctx, x + (i - 2) * w * 0.2, y - r() * w * 0.2, w * (0.2 + r() * 0.15), shade(color || '#3f6a2e', (r() - 0.5) * 0.3));
  };
  A.rock = (ctx, x, y, w, h, color, seed) => {
    const r = ATL.U.rng(seed || 43);
    const pts = [];
    const n = 8;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU;
      pts.push(x + w / 2 + Math.cos(a) * w * 0.5 * (0.8 + r() * 0.3), y + h / 2 + Math.sin(a) * h * 0.5 * (0.8 + r() * 0.3));
    }
    A.poly(ctx, pts, A.grad(ctx, x, y, x + w, y + h, [shade(color, 0.2), color, shade(color, -0.35)]));
  };
  A.dune = (ctx, w, baseY, color, seed, amp) => {
    const r = ATL.U.rng(seed || 47);
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.moveTo(0, baseY + 400); ctx.lineTo(0, baseY);
    let x = 0;
    while (x < w) { const nx = x + 200 + r() * 250; ctx.bezierCurveTo(x + 60, baseY - (amp || 30) * r(), nx - 80, baseY - (amp || 30) * (0.5 + r()), nx, baseY); x = nx; }
    ctx.lineTo(w, baseY + 400); ctx.closePath(); ctx.fill();
  };

  // ---------- Licht ----------
  A.glow = (ctx, x, y, r, color, alpha) => {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = A.rgrad(ctx, x, y, 0, r, [[0, color], [1, 'rgba(0,0,0,0)']]);
    ctx.globalAlpha = alpha ?? 0.5;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
    ctx.restore();
  };
  A.torch = (ctx, x, y, t, size, holder) => {
    size = size || 1;
    if (holder !== false) { A.rect(ctx, x - 3 * size, y, 6 * size, 30 * size, '#3a2a1a'); A.rect(ctx, x - 5 * size, y - 2, 10 * size, 6 * size, '#5a4a3a'); }
    const f = 1 + Math.sin(t * 17 + x) * 0.15 + Math.sin(t * 7.3 + x * 0.3) * 0.1;
    A.glow(ctx, x, y - 10 * size, 90 * size * f, 'rgba(255,150,50,0.8)', 0.45);
    ctx.fillStyle = 'rgba(255,120,20,0.9)';
    A.ell(ctx, x, y - 12 * size * f, 7 * size, 16 * size * f, ctx.fillStyle);
    A.ell(ctx, x + Math.sin(t * 23) * 2, y - 14 * size * f, 3.5 * size, 9 * size * f, 'rgba(255,230,120,0.95)');
  };
  A.candle = (ctx, x, y, t) => {
    A.rect(ctx, x - 3, y - 18, 6, 18, '#f0e8d0');
    const f = 1 + Math.sin(t * 15 + x) * 0.2;
    A.glow(ctx, x, y - 22, 40 * f, 'rgba(255,200,100,0.8)', 0.4);
    A.ell(ctx, x, y - 24 * f, 2.5, 6 * f, '#ffd070');
  };
  A.lantern = (ctx, x, y, t, lit) => {
    A.rect(ctx, x - 6, y - 22, 12, 22, '#4a4a48');
    A.rect(ctx, x - 4, y - 19, 8, 15, lit ? '#ffd070' : '#333');
    A.rect(ctx, x - 7, y - 25, 14, 4, '#5a5a58');
    if (lit) A.glow(ctx, x, y - 12, 70 + Math.sin(t * 9) * 4, 'rgba(255,200,100,0.7)', 0.4);
  };
  A.shadeRect = (ctx, x, y, w, h, alpha) => { ctx.fillStyle = `rgba(0,0,0,${alpha})`; ctx.fillRect(x, y, w, h); };
  A.vignette = (ctx, w, h, strength) => {
    ctx.fillStyle = A.rgrad(ctx, w / 2, h / 2, h * 0.45, h * 0.95, [[0, 'rgba(0,0,0,0)'], [1, `rgba(0,0,0,${strength ?? 0.55})`]]);
    ctx.fillRect(0, 0, w, h);
  };
  A.grain = (ctx, w, h, seed, alpha) => {
    const r = ATL.U.rng(seed || 53);
    ctx.fillStyle = `rgba(0,0,0,${alpha || 0.05})`;
    for (let i = 0; i < 1400; i++) ctx.fillRect(r() * w, r() * h, 2, 2);
    ctx.fillStyle = `rgba(255,255,255,${alpha || 0.05})`;
    for (let i = 0; i < 900; i++) ctx.fillRect(r() * w, r() * h, 2, 2);
  };
  A.lightBeam = (ctx, x, y, w, h, color) => {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = A.grad(ctx, 0, y, 0, y + h, [color || 'rgba(255,240,200,0.28)', 'rgba(255,240,200,0)']);
    A.poly(ctx, [x, y, x + w * 0.3, y, x + w, y + h, x - w * 0.5, y + h], ctx.fillStyle);
    ctx.restore();
  };
  A.dust = (ctx, x, y, w, h, t, n, color) => {
    for (let i = 0; i < (n || 30); i++) {
      const px = x + ((i * 97 + t * (8 + (i % 5) * 3)) % w);
      const py = y + ((i * 53 + Math.sin(t * 0.7 + i) * 20 + t * 5) % h);
      ctx.fillStyle = color || `rgba(255,240,200,${0.15 + (i % 3) * 0.1})`;
      ctx.fillRect(px, py, 2, 2);
    }
  };

  // ---------- Ornamente ----------
  A.hieroglyphs = (ctx, x, y, w, h, color, seed) => {
    const r = ATL.U.rng(seed || 59);
    ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = 1.5;
    const cw = 14, ch = 20;
    for (let cy = y; cy + ch <= y + h; cy += ch + 4) {
      for (let cx = x; cx + cw <= x + w; cx += cw + 4) {
        const k = Math.floor(r() * 8);
        ctx.beginPath();
        if (k === 0) { ctx.ellipse(cx + 7, cy + 10, 4, 8, 0, 0, TAU); ctx.stroke(); }
        else if (k === 1) { ctx.moveTo(cx + 2, cy + 18); ctx.lineTo(cx + 7, cy + 2); ctx.lineTo(cx + 12, cy + 18); ctx.stroke(); }
        else if (k === 2) { ctx.rect(cx + 2, cy + 4, 10, 12); ctx.stroke(); }
        else if (k === 3) { ctx.moveTo(cx + 2, cy + 10); ctx.lineTo(cx + 12, cy + 10); ctx.moveTo(cx + 7, cy + 2); ctx.lineTo(cx + 7, cy + 18); ctx.stroke(); }
        else if (k === 4) { ctx.arc(cx + 7, cy + 8, 5, 0, TAU); ctx.fill(); ctx.moveTo(cx + 7, cy + 13); ctx.lineTo(cx + 7, cy + 19); ctx.stroke(); }
        else if (k === 5) { ctx.moveTo(cx + 2, cy + 18); ctx.quadraticCurveTo(cx + 7, cy - 4, cx + 12, cy + 18); ctx.stroke(); }
        else if (k === 6) { ctx.moveTo(cx + 2, cy + 4); ctx.lineTo(cx + 12, cy + 4); ctx.lineTo(cx + 12, cy + 16); ctx.lineTo(cx + 2, cy + 16); ctx.stroke(); ctx.fillRect(cx + 5, cy + 7, 4, 6); }
        else { ctx.moveTo(cx + 3, cy + 16); ctx.lineTo(cx + 7, cy + 3); ctx.lineTo(cx + 11, cy + 16); ctx.lineTo(cx + 3, cy + 9); ctx.lineTo(cx + 11, cy + 9); ctx.stroke(); }
      }
    }
  };
  A.cuneiform = (ctx, x, y, w, h, color, seed) => {
    const r = ATL.U.rng(seed || 61);
    ctx.fillStyle = color;
    for (let cy = y; cy < y + h - 6; cy += 12) {
      for (let cx = x; cx < x + w - 8; cx += 10) {
        const k = r();
        if (k < 0.35) { A.poly(ctx, [cx, cy, cx + 6, cy + 2, cx, cy + 4], color); }
        else if (k < 0.65) { A.poly(ctx, [cx + 2, cy, cx + 4, cy, cx + 3, cy + 8], color); }
        else if (k < 0.8) { A.poly(ctx, [cx, cy + 6, cx + 6, cy, cx + 7, cy + 2], color); }
      }
    }
  };
  A.meander = (ctx, x, y, w, h, color) => {
    ctx.strokeStyle = color; ctx.lineWidth = Math.max(1.5, h / 8);
    const s = h;
    for (let cx = x; cx < x + w - s; cx += s) {
      ctx.beginPath();
      ctx.moveTo(cx, y + s); ctx.lineTo(cx, y); ctx.lineTo(cx + s * 0.8, y); ctx.lineTo(cx + s * 0.8, y + s * 0.7); ctx.lineTo(cx + s * 0.3, y + s * 0.7); ctx.lineTo(cx + s * 0.3, y + s * 0.35); ctx.lineTo(cx + s * 0.55, y + s * 0.35);
      ctx.stroke();
    }
  };
  A.spirals = (ctx, x, y, w, h, color) => {
    ctx.strokeStyle = color; ctx.lineWidth = 2;
    const s = h;
    for (let cx = x + s / 2; cx < x + w; cx += s) {
      ctx.beginPath();
      for (let a = 0; a < TAU * 2; a += 0.2) { const rr = (a / (TAU * 2)) * s * 0.42; const px = cx + Math.cos(a) * rr, py = y + s / 2 + Math.sin(a) * rr; a === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py); }
      ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx + s * 0.42, y + s / 2); ctx.lineTo(cx + s * 0.58, y + s / 2); ctx.stroke();
    }
  };
  A.statue = (ctx, x, baseY, h, color, style) => {
    // abstrakte stehende Figur auf Sockel
    const w = h * 0.3;
    A.rect(ctx, x - w * 0.8, baseY - h * 0.12, w * 1.6, h * 0.12, shade(color, -0.2));
    ctx.fillStyle = A.grad(ctx, x - w / 2, 0, x + w / 2, 0, [shade(color, -0.25), shade(color, 0.12), shade(color, -0.3)]);
    const f = ctx.fillStyle;
    const top = baseY - h * 0.12;
    if (style === 'seated') {
      A.rr(ctx, x - w * 0.55, top - h * 0.5, w * 1.1, h * 0.5, 6, f);
      A.circle(ctx, x, top - h * 0.62, w * 0.28, f);
    } else {
      A.poly(ctx, [x - w * 0.45, top, x + w * 0.45, top, x + w * 0.35, top - h * 0.6, x - w * 0.35, top - h * 0.6], f);
      A.rr(ctx, x - w * 0.5, top - h * 0.75, w, h * 0.2, 5, f);
      A.circle(ctx, x, top - h * 0.83, w * 0.26, f);
      if (style === 'ibis') { A.poly(ctx, [x + w * 0.2, top - h * 0.86, x + w * 0.75, top - h * 0.78, x + w * 0.2, top - h * 0.8], f); }
      if (style === 'crown') { A.poly(ctx, [x - w * 0.25, top - h * 0.92, x + w * 0.25, top - h * 0.92, x, top - h * 1.05], f); }
      if (style === 'trident') { A.line(ctx, x + w * 0.55, top, x + w * 0.55, top - h * 0.95, f, 4); A.poly(ctx, [x + w * 0.4, top - h * 0.95, x + w * 0.7, top - h * 0.95, x + w * 0.55, top - h * 1.06], f); }
    }
  };
  A.fresco = (ctx, x, y, w, h, seed, palette) => {
    const r = ATL.U.rng(seed || 67);
    palette = palette || ['#b34a3a', '#2f5f8a', '#d8b56a', '#3d6e4a', '#e7d5b0'];
    A.rect(ctx, x, y, w, h, '#e0cfa8');
    for (let i = 0; i < 14; i++) {
      const cx = x + r() * w, cy = y + r() * h, rw = 20 + r() * 60, rh = 10 + r() * 40;
      ctx.fillStyle = palette[Math.floor(r() * palette.length)];
      if (r() < 0.5) A.ell(ctx, cx, cy, rw / 2, rh / 2, ctx.fillStyle); else A.rr(ctx, cx - rw / 2, cy - rh / 2, rw, rh, 8, ctx.fillStyle);
    }
    A.rect(ctx, x, y, w, h, 'rgba(230,210,170,0.25)');
    ctx.strokeStyle = 'rgba(60,40,20,0.5)'; ctx.lineWidth = 3; ctx.strokeRect(x, y, w, h);
  };

  // ---------- Fahrzeuge, Bauten ----------
  A.boat = (ctx, x, y, w, color, mast) => {
    A.poly(ctx, [x, y, x + w, y, x + w * 0.85, y + w * 0.22, x + w * 0.15, y + w * 0.22], color || '#7a5a3a');
    A.rect(ctx, x + w * 0.05, y - 6, w * 0.9, 6, shade(color || '#7a5a3a', 0.15));
    if (mast) { A.rect(ctx, x + w * 0.5, y - w * 0.9, 4, w * 0.9, '#5a4a3a'); A.poly(ctx, [x + w * 0.52, y - w * 0.85, x + w * 0.52, y - w * 0.15, x + w * 0.9, y - w * 0.15], '#e8dcc0'); }
  };
  A.ship = (ctx, x, y, w, color) => {
    A.poly(ctx, [x, y, x + w, y, x + w * 0.9, y + w * 0.18, x + w * 0.08, y + w * 0.18], color || '#3a3a44');
    A.rect(ctx, x + w * 0.25, y - w * 0.14, w * 0.45, w * 0.14, shade(color || '#3a3a44', 0.3));
    A.rect(ctx, x + w * 0.4, y - w * 0.3, w * 0.06, w * 0.16, '#222');
    for (let i = 0; i < 6; i++) A.rect(ctx, x + w * 0.28 + i * w * 0.07, y - w * 0.1, w * 0.03, w * 0.04, '#ffe9a0');
  };
  A.jeep = (ctx, x, y, w, color) => {
    color = color || '#6b6a3c';
    A.rr(ctx, x, y - w * 0.28, w, w * 0.28, 6, color);
    A.rr(ctx, x + w * 0.12, y - w * 0.5, w * 0.5, w * 0.25, 5, shade(color, 0.05));
    A.rect(ctx, x + w * 0.16, y - w * 0.47, w * 0.42, w * 0.15, '#9bbad0');
    A.circle(ctx, x + w * 0.22, y, w * 0.11, '#222'); A.circle(ctx, x + w * 0.22, y, w * 0.05, '#777');
    A.circle(ctx, x + w * 0.78, y, w * 0.11, '#222'); A.circle(ctx, x + w * 0.78, y, w * 0.05, '#777');
  };
  A.tent = (ctx, x, baseY, w, h, color) => {
    A.poly(ctx, [x - w / 2, baseY, x + w / 2, baseY, x, baseY - h], color || '#c8b48a');
    A.poly(ctx, [x - w * 0.12, baseY, x + w * 0.12, baseY, x, baseY - h * 0.6], shade(color || '#c8b48a', -0.5));
    A.line(ctx, x, baseY - h, x, baseY - h - 10, '#5a4a3a', 2);
  };
  A.pyramid = (ctx, x, baseY, w, h, color) => {
    A.poly(ctx, [x - w / 2, baseY, x, baseY - h, x + w * 0.1, baseY], shade(color, 0.1));
    A.poly(ctx, [x + w * 0.1, baseY, x, baseY - h, x + w / 2, baseY], shade(color, -0.25));
  };
  A.ziggurat = (ctx, x, baseY, w, h, color, levels) => {
    levels = levels || 3;
    for (let i = 0; i < levels; i++) {
      const lw = w * (1 - i * 0.28), lh = h / levels;
      A.rect(ctx, x - lw / 2, baseY - lh * (i + 1), lw, lh, shade(color, i * 0.06));
      A.rect(ctx, x - lw / 2, baseY - lh * (i + 1), lw * 0.5, lh, shade(color, i * 0.06 - 0.15));
    }
    A.poly(ctx, [x - w * 0.06, baseY, x + w * 0.06, baseY, x + w * 0.03, baseY - h, x - w * 0.03, baseY - h], shade(color, 0.2));
  };
  A.gear = (ctx, x, y, r, teeth, color, rot) => {
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot || 0);
    ctx.fillStyle = color;
    ctx.beginPath();
    for (let i = 0; i < teeth; i++) {
      const a0 = (i / teeth) * TAU, a1 = ((i + 0.5) / teeth) * TAU;
      ctx.lineTo(Math.cos(a0) * r, Math.sin(a0) * r);
      ctx.lineTo(Math.cos(a0 + 0.1) * r * 1.2, Math.sin(a0 + 0.1) * r * 1.2);
      ctx.lineTo(Math.cos(a1 - 0.1) * r * 1.2, Math.sin(a1 - 0.1) * r * 1.2);
      ctx.lineTo(Math.cos(a1) * r, Math.sin(a1) * r);
    }
    ctx.closePath(); ctx.fill();
    A.circle(ctx, 0, 0, r * 0.3, shade(color, -0.4));
    ctx.restore();
  };
  A.crystal = (ctx, x, y, w, h, color) => {
    A.poly(ctx, [x, y, x + w * 0.5, y - h, x + w, y, x + w * 0.5, y + h * 0.35], color);
    A.poly(ctx, [x, y, x + w * 0.5, y - h, x + w * 0.5, y + h * 0.35], 'rgba(255,255,255,0.25)');
  };
  A.seal = (ctx, x, y, r, kind, color) => {
    // die drei Siegel: Sonne, Stier, Flut
    A.circle(ctx, x, y, r, color || '#d8b04a');
    A.circle(ctx, x, y, r * 0.86, null, shade(color || '#d8b04a', -0.35), 2);
    ctx.strokeStyle = shade(color || '#d8b04a', -0.5); ctx.lineWidth = Math.max(1.5, r * 0.08); ctx.fillStyle = ctx.strokeStyle;
    if (kind === 'sun') {
      A.circle(ctx, x, y, r * 0.3, ctx.fillStyle);
      for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU; A.line(ctx, x + Math.cos(a) * r * 0.42, y + Math.sin(a) * r * 0.42, x + Math.cos(a) * r * 0.7, y + Math.sin(a) * r * 0.7, ctx.strokeStyle, ctx.lineWidth); }
    } else if (kind === 'bull') {
      ctx.beginPath(); ctx.arc(x, y + r * 0.1, r * 0.3, 0, TAU); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x - r * 0.25, y - r * 0.1); ctx.quadraticCurveTo(x - r * 0.6, y - r * 0.6, x - r * 0.15, y - r * 0.7); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x + r * 0.25, y - r * 0.1); ctx.quadraticCurveTo(x + r * 0.6, y - r * 0.6, x + r * 0.15, y - r * 0.7); ctx.stroke();
    } else if (kind === 'flood') {
      for (let k = -1; k <= 1; k++) {
        ctx.beginPath();
        for (let i = 0; i <= 12; i++) { const px = x - r * 0.6 + (i / 12) * r * 1.2, py = y + k * r * 0.3 + Math.sin(i * 1.2) * r * 0.1; i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
        ctx.stroke();
      }
    }
  };

  // ---------- Ausschmückung ----------
  A.amphora = (ctx, x, baseY, h, color, seed) => {
    const w = h * 0.42;
    ctx.fillStyle = A.grad(ctx, x - w / 2, 0, x + w / 2, 0, [shade(color, -0.3), shade(color, 0.12), shade(color, -0.35)]);
    ctx.beginPath(); ctx.moveTo(x - w * 0.18, baseY); ctx.bezierCurveTo(x - w * 0.7, baseY - h * 0.3, x - w * 0.55, baseY - h * 0.75, x - w * 0.22, baseY - h * 0.86);
    ctx.lineTo(x - w * 0.22, baseY - h); ctx.lineTo(x + w * 0.22, baseY - h); ctx.lineTo(x + w * 0.22, baseY - h * 0.86);
    ctx.bezierCurveTo(x + w * 0.55, baseY - h * 0.75, x + w * 0.7, baseY - h * 0.3, x + w * 0.18, baseY); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = shade(color, -0.4); ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x - w * 0.22, baseY - h * 0.8); ctx.quadraticCurveTo(x - w * 0.6, baseY - h * 0.75, x - w * 0.5, baseY - h * 0.55); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x + w * 0.22, baseY - h * 0.8); ctx.quadraticCurveTo(x + w * 0.6, baseY - h * 0.75, x + w * 0.5, baseY - h * 0.55); ctx.stroke();
    A.meander(ctx, x - w * 0.42, baseY - h * 0.55, w * 0.84, h * 0.07, 'rgba(0,0,0,0.35)');
  };
  A.pot = (ctx, x, baseY, w, h, color) => {
    ctx.fillStyle = A.grad(ctx, x - w / 2, 0, x + w / 2, 0, [shade(color, -0.3), shade(color, 0.1), shade(color, -0.3)]);
    A.poly(ctx, [x - w * 0.35, baseY, x + w * 0.35, baseY, x + w * 0.5, baseY - h, x - w * 0.5, baseY - h], ctx.fillStyle);
    A.ell(ctx, x, baseY - h, w * 0.5, h * 0.12, shade(color, -0.45));
  };
  A.basket = (ctx, x, baseY, w, h, color) => {
    color = color || '#b8955a';
    A.poly(ctx, [x - w * 0.4, baseY, x + w * 0.4, baseY, x + w * 0.5, baseY - h, x - w * 0.5, baseY - h], color);
    for (let yy = baseY - h + 4; yy < baseY - 2; yy += 6) A.line(ctx, x - w * 0.46, yy, x + w * 0.46, yy, shade(color, -0.3), 1.5);
    for (let i = -2; i <= 2; i++) A.line(ctx, x + i * w * 0.18, baseY - h, x + i * w * 0.15, baseY, shade(color, -0.25), 1.5);
    A.ell(ctx, x, baseY - h, w * 0.5, h * 0.12, shade(color, -0.4));
  };
  A.sack = (ctx, x, baseY, w, h, color) => {
    A.rr(ctx, x - w / 2, baseY - h, w, h, w * 0.3, color || '#c8b48a');
    A.rect(ctx, x - w * 0.2, baseY - h - 4, w * 0.4, 8, shade(color || '#c8b48a', -0.3));
    A.line(ctx, x - w * 0.3, baseY - h * 0.5, x + w * 0.3, baseY - h * 0.55, shade(color || '#c8b48a', -0.2), 1.5);
  };
  A.bottle = (ctx, x, baseY, h, color) => {
    A.rr(ctx, x - h * 0.16, baseY - h * 0.7, h * 0.32, h * 0.7, h * 0.08, color);
    A.rect(ctx, x - h * 0.07, baseY - h, h * 0.14, h * 0.32, color);
    A.rect(ctx, x - h * 0.08, baseY - h, h * 0.16, h * 0.06, shade(color, -0.4));
    A.rect(ctx, x - h * 0.12, baseY - h * 0.5, h * 0.06, h * 0.3, 'rgba(255,255,255,0.25)');
  };
  A.cobweb = (ctx, x, y, r, corner, color) => {
    // corner: 'tl' | 'tr' | 'bl' | 'br'
    const sx = corner[1] === 'l' ? 1 : -1, sy = corner[0] === 't' ? 1 : -1;
    ctx.strokeStyle = color || 'rgba(255,255,255,0.35)'; ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) { const a = (i / 4) * Math.PI / 2; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * r * sx, y + Math.sin(a) * r * sy); ctx.stroke(); }
    for (let k = 1; k <= 4; k++) { const rr = (k / 4) * r; ctx.beginPath(); for (let i = 0; i <= 4; i++) { const a = (i / 4) * Math.PI / 2; const px = x + Math.cos(a) * rr * sx, py = y + Math.sin(a) * rr * sy; i ? ctx.quadraticCurveTo(x + Math.cos(a - Math.PI / 8) * rr * 0.9 * sx, y + Math.sin(a - Math.PI / 8) * rr * 0.9 * sy, px, py) : ctx.moveTo(px, py); } ctx.stroke(); }
  };
  A.cracks = (ctx, x, y, w, h, seed, color) => {
    const r = ATL.U.rng(seed || 71);
    ctx.strokeStyle = color || 'rgba(0,0,0,0.35)'; ctx.lineWidth = 1.2;
    for (let i = 0; i < 3; i++) {
      let px = x + r() * w, py = y + r() * h;
      ctx.beginPath(); ctx.moveTo(px, py);
      for (let k = 0; k < 6; k++) { px += (r() - 0.5) * w * 0.25; py += r() * h * 0.2; ctx.lineTo(px, py); }
      ctx.stroke();
    }
  };
  A.moss = (ctx, x, y, w, seed, color) => {
    const r = ATL.U.rng(seed || 73);
    for (let i = 0; i < 9; i++) A.ell(ctx, x + r() * w, y + (r() - 0.5) * 10, 6 + r() * 12, 3 + r() * 4, shade(color || '#5a7a3a', (r() - 0.5) * 0.3));
  };
  A.grass = (ctx, x, y, w, seed, color) => {
    const r = ATL.U.rng(seed || 79);
    ctx.strokeStyle = color || '#5a8a3a'; ctx.lineWidth = 1.5;
    for (let i = 0; i < w / 4; i++) { const gx = x + r() * w; const gh = 6 + r() * 12; ctx.beginPath(); ctx.moveTo(gx, y); ctx.quadraticCurveTo(gx + (r() - 0.5) * 8, y - gh * 0.6, gx + (r() - 0.5) * 12, y - gh); ctx.stroke(); }
  };
  A.pebbles = (ctx, x, y, w, h, seed, color) => {
    const r = ATL.U.rng(seed || 83);
    for (let i = 0; i < (w * h) / 500; i++) A.ell(ctx, x + r() * w, y + r() * h, 2 + r() * 4, 1.5 + r() * 2, shade(color || '#8a8478', (r() - 0.5) * 0.4));
  };
  A.rubble = (ctx, x, y, w, h, seed, color) => {
    const r = ATL.U.rng(seed || 89);
    for (let i = 0; i < 10; i++) A.rock(ctx, x + r() * w * 0.8, y + r() * h * 0.6, w * (0.15 + r() * 0.25), h * (0.3 + r() * 0.4), shade(color || '#8a8478', (r() - 0.5) * 0.3), seed + i);
  };
  A.birds = (ctx, x, y, n, t, color, spread) => {
    ctx.strokeStyle = color || 'rgba(20,20,30,0.7)'; ctx.lineWidth = 1.5;
    for (let i = 0; i < n; i++) {
      const bx = x + ((i * 37) % (spread || 120)) + Math.sin(t * 0.6 + i) * 6 + t * 6 * (i % 2 ? 1 : 0.8);
      const by = y + ((i * 19) % 40) + Math.sin(t * 1.4 + i * 2) * 4;
      const f = Math.sin(t * 6 + i) * 3;
      ctx.beginPath(); ctx.moveTo(bx - 6, by + f); ctx.quadraticCurveTo(bx - 2, by - 2, bx, by); ctx.quadraticCurveTo(bx + 2, by - 2, bx + 6, by + f); ctx.stroke();
    }
  };
  A.smoke = (ctx, x, y, t, color, size) => {
    size = size || 1;
    for (let i = 0; i < 6; i++) {
      const k = ((t * 0.35 + i * 0.17) % 1);
      const px = x + Math.sin(t * 0.8 + i * 1.3) * 10 * size + k * 14 * size, py = y - k * 90 * size;
      ctx.fillStyle = (color || 'rgba(200,200,200,0.35)').replace(/[\d.]+\)$/, ((1 - k) * 0.3).toFixed(2) + ')');
      A.ell(ctx, px, py, (6 + k * 18) * size, (5 + k * 12) * size, ctx.fillStyle);
    }
  };
  A.flag = (ctx, x, y, w, h, t, color) => {
    ctx.fillStyle = color || '#a3312a';
    ctx.beginPath(); ctx.moveTo(x, y);
    for (let i = 0; i <= 8; i++) { const k = i / 8; ctx.lineTo(x + k * w, y + Math.sin(t * 4 + k * 5) * h * 0.12 * k); }
    for (let i = 8; i >= 0; i--) { const k = i / 8; ctx.lineTo(x + k * w, y + h + Math.sin(t * 4 + k * 5) * h * 0.12 * k); }
    ctx.closePath(); ctx.fill();
  };
  A.curtain = (ctx, x, y, w, h, color, t, folds) => {
    folds = folds || 5;
    for (let i = 0; i < folds; i++) {
      const fx = x + (i * w) / folds, fw = w / folds;
      ctx.fillStyle = A.grad(ctx, fx, 0, fx + fw, 0, [shade(color, -0.35), shade(color, 0.1), shade(color, -0.3)]);
      const sway = t !== undefined ? Math.sin(t * 1.2 + i) * 3 : 0;
      A.poly(ctx, [fx, y, fx + fw, y, fx + fw + sway, y + h, fx + sway, y + h], ctx.fillStyle);
    }
  };
  A.sign = (ctx, x, y, w, h, text, color, textColor, font) => {
    A.rr(ctx, x, y, w, h, 3, color || '#5a3f28', shade(color || '#5a3f28', -0.4), 2);
    A.text(ctx, text, x + w / 2, y + h * 0.68, { font: font || `bold ${Math.floor(h * 0.5)}px Georgia`, color: textColor || '#e8d8b0', align: 'center' });
  };
  A.lamppost = (ctx, x, baseY, h, t, lit, color) => {
    A.rect(ctx, x - 3, baseY - h, 6, h, color || '#2a2a30');
    A.ell(ctx, x, baseY, 12, 4, color || '#2a2a30');
    A.rr(ctx, x - 12, baseY - h - 22, 24, 24, 4, shade(color || '#2a2a30', 0.15));
    A.rect(ctx, x - 8, baseY - h - 18, 16, 16, lit ? '#ffe9a0' : '#3a3a40');
    if (lit) A.glow(ctx, x, baseY - h - 10, 120 + (t ? Math.sin(t * 9) * 3 : 0), 'rgba(255,225,150,0.7)', 0.35);
  };
  A.papyrus = (ctx, x, y, w, color) => {
    A.rect(ctx, x, y, w, 12, color || '#e0cf9e');
    A.circle(ctx, x, y + 6, 6, shade(color || '#e0cf9e', -0.2)); A.circle(ctx, x + w, y + 6, 6, shade(color || '#e0cf9e', -0.2));
    for (let i = 0; i < 3; i++) A.line(ctx, x + 8, y + 4 + i * 3, x + w - 8, y + 4 + i * 3, 'rgba(0,0,0,0.25)', 1);
  };
  A.painting = (ctx, x, y, w, h, seed, frame) => {
    A.rect(ctx, x - 5, y - 5, w + 10, h + 10, frame || '#5a3f28');
    A.rect(ctx, x - 2, y - 2, w + 4, h + 4, shade(frame || '#5a3f28', 0.3));
    const r = ATL.U.rng(seed || 97);
    A.sky(ctx, w, h, shade('#8fb3d8', (r() - 0.5) * 0.3), '#e8d8b0', 0);
    ctx.save(); ctx.translate(x, y); ctx.beginPath(); ctx.rect(0, 0, w, h); ctx.clip();
    A.sky(ctx, w, h, shade('#8fb3d8', (r() - 0.5) * 0.3), '#e8d8b0');
    A.mountains(ctx, w, h * 0.6, shade('#6a7a8a', (r() - 0.5) * 0.3), seed, h * 0.3, w * 0.3);
    A.hills(ctx, w, h * 0.75, shade('#5f8a4a', (r() - 0.5) * 0.3), seed + 1, h * 0.15);
    if (r() < 0.6) A.tree(ctx, w * (0.2 + r() * 0.6), h * 0.9, h * 0.5, '#3f6a2e', '#4a3624', seed + 2);
    ctx.restore();
  };
  A.vines = (ctx, x, y, h, seed, color) => {
    const r = ATL.U.rng(seed || 101);
    ctx.strokeStyle = shade(color || '#3f6a2e', -0.2); ctx.lineWidth = 2;
    for (let v = 0; v < 3; v++) {
      let px = x + (r() - 0.5) * 20; ctx.beginPath(); ctx.moveTo(px, y);
      for (let yy = y; yy < y + h; yy += 12) { px += (r() - 0.5) * 8; ctx.lineTo(px, yy); if (r() < 0.7) A.ell(ctx, px + (r() - 0.5) * 10, yy, 5, 3, shade(color || '#3f6a2e', (r() - 0.5) * 0.3)); }
      ctx.stroke();
    }
  };
  A.puddle = (ctx, x, y, w, h, color) => {
    A.ell(ctx, x, y, w / 2, h / 2, color || 'rgba(120,150,190,0.35)');
    A.ell(ctx, x - w * 0.15, y - h * 0.15, w * 0.18, h * 0.12, 'rgba(255,255,255,0.18)');
  };
  A.railing = (ctx, x, y, w, h, color) => {
    A.rect(ctx, x, y, w, 4, color || '#3a3a3a');
    for (let px = x; px <= x + w; px += 14) A.rect(ctx, px, y, 2.5, h, color || '#3a3a3a');
    A.rect(ctx, x, y + h - 3, w, 3, color || '#3a3a3a');
  };
  A.awning = (ctx, x, y, w, h, c1, c2, stripes) => {
    stripes = stripes || 6;
    for (let i = 0; i < stripes; i++) A.poly(ctx, [x + (i * w) / stripes, y, x + ((i + 1) * w) / stripes, y, x + ((i + 1) * w) / stripes + 6, y + h, x + (i * w) / stripes + 6, y + h], i % 2 ? c1 : c2);
    for (let i = 0; i <= stripes; i++) A.ell(ctx, x + (i * w) / stripes + 6, y + h, w / stripes / 2, 6, i % 2 ? c2 : c1);
  };
  A.insects = (ctx, x, y, w, h, t, n, color) => {
    for (let i = 0; i < (n || 6); i++) {
      const px = x + ((i * 61) % w) + Math.sin(t * 3 + i * 2) * 12 + Math.sin(t * 0.5 + i) * 20;
      const py = y + ((i * 43) % h) + Math.cos(t * 2.3 + i) * 8;
      ctx.fillStyle = color || 'rgba(40,30,20,0.6)';
      ctx.fillRect(px, py, 2, 2);
    }
  };
  A.bones = (ctx, x, y, seed, color) => {
    const r = ATL.U.rng(seed || 103);
    color = color || '#e8e0c8';
    for (let i = 0; i < 4; i++) { const bx = x + r() * 40, by = y + r() * 14; const a = r() * Math.PI; ctx.save(); ctx.translate(bx, by); ctx.rotate(a); A.rr(ctx, -10, -2, 20, 4, 2, color); A.circle(ctx, -10, 0, 3, color); A.circle(ctx, 10, 0, 3, color); ctx.restore(); }
    A.circle(ctx, x + 20, y + 4, 7, color); A.circle(ctx, x + 17, y + 3, 2, '#3a2a1a'); A.circle(ctx, x + 23, y + 3, 2, '#3a2a1a');
  };

  ATL.A = A;
})(window.ATL);
