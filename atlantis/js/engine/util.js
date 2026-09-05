/* Grundlegende Hilfsfunktionen. Alles hängt am globalen Namensraum ATL. */
window.ATL = window.ATL || {};
(function (ATL) {
  const U = {};
  U.clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  U.lerp = (a, b, t) => a + (b - a) * t;
  U.dist = (x0, y0, x1, y1) => Math.hypot(x1 - x0, y1 - y0);
  U.pick = (arr, rng) => arr[Math.floor((rng ? rng() : Math.random()) * arr.length)];
  U.sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  // Deterministischer Zufallsgenerator (mulberry32)
  U.rng = function (seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

  U.pointInPoly = function (x, y, poly) {
    // poly: flaches Array [x0,y0,x1,y1,...]
    let inside = false;
    const n = poly.length / 2;
    for (let i = 0, j = n - 1; i < n; j = i++) {
      const xi = poly[i * 2], yi = poly[i * 2 + 1];
      const xj = poly[j * 2], yj = poly[j * 2 + 1];
      const hit = (yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
      if (hit) inside = !inside;
    }
    return inside;
  };

  U.inRect = (x, y, r) => x >= r[0] && y >= r[1] && x <= r[0] + r[2] && y <= r[1] + r[3];

  U.wrap = function (ctx, text, maxWidth) {
    const words = String(text).split(/\s+/);
    const lines = [];
    let line = '';
    for (const w of words) {
      const test = line ? line + ' ' + w : w;
      if (ctx.measureText(test).width > maxWidth && line) {
        lines.push(line);
        line = w;
      } else line = test;
    }
    if (line) lines.push(line);
    return lines;
  };

  U.escape = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  // Einfache Hilfsfunktion für sortiertes Einfügen
  U.sortBy = (arr, fn) => arr.slice().sort((a, b) => fn(a) - fn(b));

  U.el = (tag, attrs, children) => {
    const e = document.createElement(tag);
    if (attrs) for (const k in attrs) {
      if (k === 'class') e.className = attrs[k];
      else if (k === 'text') e.textContent = attrs[k];
      else if (k === 'html') e.innerHTML = attrs[k];
      else if (k.startsWith('on')) e.addEventListener(k.slice(2), attrs[k]);
      else e.setAttribute(k, attrs[k]);
    }
    if (children) for (const c of children) if (c) e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    return e;
  };

  ATL.U = U;
})(window.ATL);
