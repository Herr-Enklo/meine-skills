/* Rätsel-Einblendungen: Ringschloss, Labyrinth, Faustkampf, Symbolschloss,
   Zettelkasten, Keilschrift, Schriftstücke. Jede Funktion liefert ein Promise. */
(function (ATL) {
  const U = ATL.U;
  const A = ATL.A;
  const P = {};
  const $ = (s) => document.querySelector(s);

  function open(g, build) {
    const ov = $('#overlay');
    ov.innerHTML = '';
    ov.classList.remove('hidden');
    const box = U.el('div', { class: 'box' });
    ov.appendChild(box);
    return new Promise((resolve) => {
      const close = (v) => { ov.classList.add('hidden'); ov.innerHTML = ''; resolve(v); };
      build(box, close);
    });
  }
  P.open = open;

  // ---------- Symbole für das Ringschloss ----------
  const SYMBOLS = [
    { id: 'sonne', name: 'Sonne', riddle: 'zur Sonne selbst', draw: (c, x, y, r) => { A.circle(c, x, y, r * 0.4, c.fillStyle); for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; A.line(c, x + Math.cos(a) * r * 0.55, y + Math.sin(a) * r * 0.55, x + Math.cos(a) * r * 0.9, y + Math.sin(a) * r * 0.9, c.fillStyle, 2); } } },
    { id: 'mond', name: 'Mond', riddle: 'zur Schwester der Sonne, die nachts wandert', draw: (c, x, y, r) => { A.circle(c, x, y, r * 0.75, c.fillStyle); const f = c.fillStyle; A.circle(c, x + r * 0.35, y - r * 0.15, r * 0.6, '#1a130c'); c.fillStyle = f; } },
    { id: 'welle', name: 'Welle', riddle: 'dorthin, wo das Meer sich hebt', draw: (c, x, y, r) => { c.strokeStyle = c.fillStyle; c.lineWidth = 2.5; for (let k = -1; k <= 1; k++) { c.beginPath(); for (let i = 0; i <= 10; i++) { const px = x - r * 0.8 + i / 10 * r * 1.6, py = y + k * r * 0.4 + Math.sin(i * 1.3) * r * 0.15; i ? c.lineTo(px, py) : c.moveTo(px, py); } c.stroke(); } } },
    { id: 'berg', name: 'Berg', riddle: 'dorthin, wo die Erde den Himmel berührt', draw: (c, x, y, r) => { A.poly(c, [x - r * 0.85, y + r * 0.6, x - r * 0.2, y - r * 0.7, x + r * 0.3, y, x + r * 0.55, y - r * 0.3, x + r * 0.9, y + r * 0.6], c.fillStyle); } },
    { id: 'stern', name: 'Stern', riddle: 'zum Licht, das nachts den Seefahrer führt', draw: (c, x, y, r) => { const p = []; for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i / 10 * Math.PI * 2; const rr = i % 2 ? r * 0.35 : r * 0.85; p.push(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } A.poly(c, p, c.fillStyle); } },
    { id: 'auge', name: 'Auge', riddle: 'zum Auge, das niemals schläft', draw: (c, x, y, r) => { c.strokeStyle = c.fillStyle; c.lineWidth = 2.5; c.beginPath(); c.moveTo(x - r * 0.85, y); c.quadraticCurveTo(x, y - r * 0.9, x + r * 0.85, y); c.quadraticCurveTo(x, y + r * 0.9, x - r * 0.85, y); c.stroke(); A.circle(c, x, y, r * 0.28, c.fillStyle); } },
    { id: 'spirale', name: 'Spirale', riddle: 'zum Wirbel, der alles verschlingt', draw: (c, x, y, r) => { c.strokeStyle = c.fillStyle; c.lineWidth = 2.5; c.beginPath(); for (let a = 0; a < Math.PI * 5; a += 0.15) { const rr = a / (Math.PI * 5) * r * 0.85; const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr; a ? c.lineTo(px, py) : c.moveTo(px, py); } c.stroke(); } },
    { id: 'dreizack', name: 'Dreizack', riddle: 'zur Waffe des Erderschütterers', draw: (c, x, y, r) => { A.line(c, x, y + r * 0.9, x, y - r * 0.4, c.fillStyle, 3); c.strokeStyle = c.fillStyle; c.lineWidth = 3; c.beginPath(); c.moveTo(x - r * 0.6, y - r * 0.2); c.lineTo(x - r * 0.6, y - r * 0.8); c.moveTo(x + r * 0.6, y - r * 0.2); c.lineTo(x + r * 0.6, y - r * 0.8); c.moveTo(x, y - r * 0.4); c.lineTo(x, y - r * 0.95); c.moveTo(x - r * 0.6, y - r * 0.2); c.quadraticCurveTo(x, y + r * 0.3, x + r * 0.6, y - r * 0.2); c.stroke(); } },
  ];
  P.SYMBOLS = SYMBOLS;

  // Ringschloss: drei Ringe, jeder muss auf ein bestimmtes Symbol zeigen
  P.dial = function (g, opts) {
    if (g.fast) return Promise.resolve(true);
    const sol = opts.solution; // [outer, middle, inner] als Indizes in SYMBOLS
    const rot = [0, 0, 0];
    const names = ['Sonne', 'Stier', 'Flut'];
    return open(g, (box, close) => {
      box.appendChild(U.el('h2', { text: opts.title || 'Das Tor der drei Siegel' }));
      box.appendChild(U.el('p', { text: opts.hint || 'Klick auf einen Ring dreht ihn im Uhrzeigersinn, Rechtsklick dagegen. Der Zeiger oben markiert die Lesestelle.' }));
      const cv = U.el('canvas', { width: 440, height: 440 });
      box.appendChild(cv);
      const row = U.el('div', { class: 'row' });
      const bq = U.el('button', { text: 'Zurücktreten' });
      bq.addEventListener('click', () => close(false));
      row.appendChild(bq);
      box.appendChild(row);
      const c = cv.getContext('2d');
      const cx = 220, cy = 220;
      const radii = [[200, 150], [145, 95], [90, 40]];
      const colors = ['#8a7350', '#7a6248', '#6a5540'];
      let solved = false;
      const draw = () => {
        c.clearRect(0, 0, 440, 440);
        A.circle(c, cx, cy, 212, '#1d160e');
        for (let ring = 0; ring < 3; ring++) {
          const [ro, ri] = radii[ring];
          c.fillStyle = A.rgrad(c, cx, cy, ri, ro, [A.shade(colors[ring], -0.2), colors[ring], A.shade(colors[ring], -0.3)]);
          c.beginPath(); c.arc(cx, cy, ro, 0, Math.PI * 2); c.arc(cx, cy, ri, 0, Math.PI * 2, true); c.fill();
          c.strokeStyle = '#2a2016'; c.lineWidth = 2;
          c.beginPath(); c.arc(cx, cy, ro, 0, Math.PI * 2); c.stroke();
          const rm = (ro + ri) / 2;
          for (let i = 0; i < 8; i++) {
            const a = -Math.PI / 2 + ((i + rot[ring]) / 8) * Math.PI * 2;
            const sx = cx + Math.cos(a) * rm, sy = cy + Math.sin(a) * rm;
            const ok = solved && i === sol[ring];
            c.fillStyle = ok ? '#ffe28a' : '#e6cf98';
            SYMBOLS[i].draw(c, sx, sy, (ro - ri) * 0.32);
          }
          A.seal(c, cx, cy, 36, 'flood', '#d8b04a');
        }
        // Siegel in den Ringen anzeigen (Beschriftung)
        c.fillStyle = '#f1d998'; c.font = '13px Georgia'; c.textAlign = 'center';
        for (let ring = 0; ring < 3; ring++) c.fillText(names[ring], cx, cy + radii[ring][1] + 12);
        // Zeiger
        A.poly(c, [cx - 12, 8, cx + 12, 8, cx, 30], solved ? '#ffe28a' : '#e0b84a');
        if (solved) { c.fillStyle = '#ffe28a'; c.font = '20px Georgia'; c.fillText('Die Ringe rasten ein.', cx, 432); }
      };
      draw();
      const ringAt = (x, y) => {
        const d = Math.hypot(x - cx, y - cy);
        for (let r = 0; r < 3; r++) if (d <= radii[r][0] && d >= radii[r][1]) return r;
        return -1;
      };
      const handle = (ev, dirn) => {
        ev.preventDefault();
        if (solved) return;
        const rect = cv.getBoundingClientRect();
        const x = ((ev.clientX - rect.left) / rect.width) * 440, y = ((ev.clientY - rect.top) / rect.height) * 440;
        const r = ringAt(x, y);
        if (r < 0) return;
        rot[r] = (rot[r] + dirn + 8) % 8;
        ATL.audio.fx('click');
        // Symbol an der Lesestelle (oben): Index i mit (i + rot) % 8 === 0
        const reading = rot.map((rr) => (8 - rr) % 8);
        draw();
        if (reading.every((v, i) => v === sol[i])) {
          solved = true; ATL.audio.fx('stone'); draw();
          setTimeout(() => close(true), 1400);
        }
      };
      cv.addEventListener('click', (ev) => handle(ev, 1));
      cv.addEventListener('contextmenu', (ev) => handle(ev, -1));
    });
  };

  // ---------- Labyrinth ----------
  function genMaze(w, h, seed) {
    const r = U.rng(seed);
    const cells = [];
    for (let y = 0; y < h; y++) { cells.push([]); for (let x = 0; x < w; x++) cells[y].push({ n: true, s: true, e: true, w: true, v: false }); }
    const stack = [[0, Math.floor(h / 2)]];
    cells[Math.floor(h / 2)][0].v = true;
    while (stack.length) {
      const [x, y] = stack[stack.length - 1];
      const nb = [];
      if (y > 0 && !cells[y - 1][x].v) nb.push([x, y - 1, 'n', 's']);
      if (y < h - 1 && !cells[y + 1][x].v) nb.push([x, y + 1, 's', 'n']);
      if (x > 0 && !cells[y][x - 1].v) nb.push([x - 1, y, 'w', 'e']);
      if (x < w - 1 && !cells[y][x + 1].v) nb.push([x + 1, y, 'e', 'w']);
      if (!nb.length) { stack.pop(); continue; }
      const [nx, ny, a, b] = nb[Math.floor(r() * nb.length)];
      cells[y][x][a] = false; cells[ny][nx][b] = false; cells[ny][nx].v = true;
      stack.push([nx, ny]);
    }
    return cells;
  }
  P.maze = function (g, opts) {
    if (g.fast) return Promise.resolve(true);
    opts = opts || {};
    const W = 15, H = 11, CS = 34;
    const cells = genMaze(W, H, opts.seed || 4242);
    const start = [0, Math.floor(H / 2)];
    const goal = opts.goal || [Math.floor(W / 2), Math.floor(H / 2)];
    let px = start[0], py = start[1];
    const seen = new Set([px + ',' + py]);
    const trail = [[px, py]];
    const hasThread = !!opts.thread;
    let steps = 0;
    return open(g, (box, close) => {
      box.appendChild(U.el('h2', { text: 'Das Labyrinth' }));
      box.appendChild(U.el('p', { text: hasThread ? 'Der Faden markiert den Weg zurück. Pfeiltasten oder Klick auf ein Nachbarfeld. Finde die Halle in der Mitte.' : 'Ohne Faden verliert man hier schnell die Orientierung. Pfeiltasten oder Klick auf ein Nachbarfeld.' }));
      const cv = U.el('canvas', { width: W * CS + 20, height: H * CS + 20 });
      box.appendChild(cv);
      const row = U.el('div', { class: 'row' });
      const bq = U.el('button', { text: 'Umkehren und hinausgehen' });
      bq.addEventListener('click', () => { window.removeEventListener('keydown', onKey); close(false); });
      row.appendChild(bq);
      box.appendChild(row);
      const c = cv.getContext('2d');
      const draw = () => {
        c.fillStyle = '#0b0805'; c.fillRect(0, 0, cv.width, cv.height);
        const ox = 10, oy = 10;
        const R = hasThread ? 3 : 2;
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
          const d = Math.max(Math.abs(x - px), Math.abs(y - py));
          const vis = d <= R || (hasThread && seen.has(x + ',' + y));
          if (!vis) continue;
          const alpha = d <= R ? 1 - d * 0.2 : 0.35;
          const X = ox + x * CS, Y = oy + y * CS;
          c.fillStyle = `rgba(90,72,50,${alpha * 0.55})`; c.fillRect(X, Y, CS, CS);
          c.strokeStyle = `rgba(210,180,130,${alpha})`; c.lineWidth = 3;
          const cell = cells[y][x];
          c.beginPath();
          if (cell.n) { c.moveTo(X, Y); c.lineTo(X + CS, Y); }
          if (cell.s) { c.moveTo(X, Y + CS); c.lineTo(X + CS, Y + CS); }
          if (cell.w) { c.moveTo(X, Y); c.lineTo(X, Y + CS); }
          if (cell.e) { c.moveTo(X + CS, Y); c.lineTo(X + CS, Y + CS); }
          c.stroke();
          if (x === goal[0] && y === goal[1]) { c.fillStyle = `rgba(255,200,80,${alpha})`; A.circle(c, X + CS / 2, Y + CS / 2, 8, c.fillStyle); }
        }
        if (hasThread && trail.length > 1) {
          c.strokeStyle = '#e8d8b0'; c.lineWidth = 2; c.beginPath();
          trail.forEach(([x, y], i) => { const X = ox + x * CS + CS / 2, Y = oy + y * CS + CS / 2; i ? c.lineTo(X, Y) : c.moveTo(X, Y); });
          c.stroke();
        }
        A.circle(c, ox + px * CS + CS / 2, oy + py * CS + CS / 2, 9, '#f0d090');
        A.circle(c, ox + px * CS + CS / 2, oy + py * CS + CS / 2, 4, '#6b4a2b');
        A.glow(c, ox + px * CS + CS / 2, oy + py * CS + CS / 2, CS * 2.2, 'rgba(255,170,80,0.5)', 0.35);
      };
      const move = (dx, dy) => {
        const cell = cells[py][px];
        if (dx === 1 && cell.e) return; if (dx === -1 && cell.w) return;
        if (dy === 1 && cell.s) return; if (dy === -1 && cell.n) return;
        const nx = px + dx, ny = py + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) return;
        px = nx; py = ny; steps++;
        ATL.audio.fx('step');
        const k = px + ',' + py;
        const idx = trail.findIndex(([x, y]) => x === px && y === py);
        if (idx >= 0) trail.length = idx + 1; else trail.push([px, py]);
        seen.add(k);
        draw();
        if (px === goal[0] && py === goal[1]) { window.removeEventListener('keydown', onKey); ATL.audio.fx('success'); setTimeout(() => close(true), 500); }
        else if (!hasThread && steps > 40 && Math.random() < 0.06) {
          window.removeEventListener('keydown', onKey);
          close('lost');
        }
      };
      const onKey = (ev) => {
        const m = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1], a: [-1, 0], d: [1, 0], w: [0, -1], s: [0, 1] };
        if (m[ev.key]) { ev.preventDefault(); ev.stopPropagation(); move(...m[ev.key]); }
      };
      window.addEventListener('keydown', onKey, true);
      cv.addEventListener('click', (ev) => {
        const rect = cv.getBoundingClientRect();
        const x = Math.floor((((ev.clientX - rect.left) / rect.width) * cv.width - 10) / CS);
        const y = Math.floor((((ev.clientY - rect.top) / rect.height) * cv.height - 10) / CS);
        const dx = x - px, dy = y - py;
        if (Math.abs(dx) + Math.abs(dy) === 1) move(dx, dy);
      });
      draw();
    });
  };

  // ---------- Faustkampf ----------
  P.fight = function (g, opts) {
    if (g.fast) return Promise.resolve(true);
    opts = opts || {};
    const enemyName = opts.enemy || 'Kessler';
    let hp = 100, ehp = opts.enemyHp || 100;
    const dmg = opts.damage || 22, edmg = opts.enemyDamage || 20;
    let state = 'idle'; // idle | windup | open
    let windSide = 'high';
    let timer = null;
    let msg = enemyName + ' geht in Stellung.';
    return open(g, (box, close) => {
      box.appendChild(U.el('h2', { text: 'Faustkampf gegen ' + enemyName }));
      box.appendChild(U.el('p', { text: 'Wenn er ausholt, blocke auf der richtigen Höhe. Nach einem Block ist er kurz offen: dann schlagen.' }));
      const cv = U.el('canvas', { width: 600, height: 240 });
      box.appendChild(cv);
      const row = U.el('div', { class: 'row' });
      const bHigh = U.el('button', { text: 'Block oben' });
      const bLow = U.el('button', { text: 'Block unten' });
      const bHit = U.el('button', { text: 'Schlag' });
      const bRun = U.el('button', { text: 'Zurückweichen' });
      [bHigh, bLow, bHit, bRun].forEach((b) => row.appendChild(b));
      box.appendChild(row);
      const c = cv.getContext('2d');
      const draw = () => {
        c.fillStyle = '#120d08'; c.fillRect(0, 0, 600, 240);
        A.rect(c, 40, 30, 200, 14, '#3a2a1a'); A.rect(c, 40, 30, 2 * Math.max(0, hp), 14, '#c9a86a');
        A.rect(c, 360, 30, 200, 14, '#3a2a1a'); A.rect(c, 360 + 200 - 2 * Math.max(0, ehp), 30, 2 * Math.max(0, ehp), 14, '#b34a3a');
        c.fillStyle = '#e6cf98'; c.font = '14px Georgia'; c.textAlign = 'left'; c.fillText('Falk', 40, 24); c.textAlign = 'right'; c.fillText(enemyName, 560, 24);
        // Figuren vereinfacht
        const drawFighter = (x, color, mirror, pose) => {
          c.save(); c.translate(x, 200); if (mirror) c.scale(-1, 1);
          A.rr(c, -18, -110, 36, 60, 8, color);
          A.circle(c, 0, -125, 14, '#e8b890');
          A.line(c, -8, -50, -12, 0, '#4a3a2a', 10); A.line(c, 8, -50, 12, 0, '#4a3a2a', 10);
          if (pose === 'high') A.line(c, 14, -100, 44, -128, color, 9);
          else if (pose === 'low') A.line(c, 14, -80, 44, -70, color, 9);
          else if (pose === 'blockhigh') A.line(c, 14, -100, 20, -135, color, 9);
          else if (pose === 'blocklow') A.line(c, 14, -80, 26, -60, color, 9);
          else if (pose === 'hit') A.line(c, 14, -95, 60, -100, color, 9);
          else A.line(c, 14, -95, 30, -75, color, 9);
          c.restore();
        };
        drawFighter(200, '#7a5230', false, S.playerPose);
        drawFighter(400, '#3a3a44', true, state === 'windup' ? windSide : state === 'stagger' ? 'low' : 'idle');
        c.fillStyle = '#f1d998'; c.font = '16px Georgia'; c.textAlign = 'center'; c.fillText(msg, 300, 225);
      };
      const S = { playerPose: 'idle' };
      const schedule = () => {
        clearTimeout(timer);
        state = 'idle';
        timer = setTimeout(() => {
          windSide = Math.random() < 0.5 ? 'high' : 'low';
          state = 'windup';
          msg = enemyName + ' holt aus: ' + (windSide === 'high' ? 'OBEN' : 'UNTEN') + '!';
          draw();
          timer = setTimeout(() => {
            if (state === 'windup') {
              hp -= edmg; ATL.audio.fx('punch');
              msg = 'Getroffen!';
              S.playerPose = 'idle';
              draw();
              if (hp <= 0) return finish(false);
              schedule();
            }
          }, 900);
        }, 700 + Math.random() * 900);
      };
      const finish = (won) => {
        clearTimeout(timer);
        msg = won ? enemyName + ' geht zu Boden.' : 'Falk geht zu Boden.';
        draw();
        setTimeout(() => close(won), 1200);
      };
      const block = (side) => {
        S.playerPose = side === 'high' ? 'blockhigh' : 'blocklow';
        if (state === 'windup' && side === windSide) {
          clearTimeout(timer);
          state = 'open';
          msg = 'Geblockt! Er ist offen!';
          ATL.audio.fx('click');
          draw();
          timer = setTimeout(() => { if (state === 'open') { msg = 'Zu langsam.'; S.playerPose = 'idle'; schedule(); draw(); } }, 900);
        } else draw();
      };
      bHigh.addEventListener('click', () => block('high'));
      bLow.addEventListener('click', () => block('low'));
      bHit.addEventListener('click', () => {
        S.playerPose = 'hit';
        if (state === 'open') {
          clearTimeout(timer);
          ehp -= dmg; ATL.audio.fx('punch');
          msg = 'Treffer!';
          state = 'stagger';
          draw();
          if (ehp <= 0) return finish(true);
          setTimeout(() => { S.playerPose = 'idle'; schedule(); draw(); }, 500);
        } else {
          msg = 'Ins Leere.';
          draw();
          setTimeout(() => { S.playerPose = 'idle'; draw(); }, 300);
        }
      });
      bRun.addEventListener('click', () => { clearTimeout(timer); close(false); });
      draw();
      schedule();
    });
  };

  // ---------- Symbolschloss: Blöcke durchklicken ----------
  P.symbols = function (g, opts) {
    if (g.fast) return Promise.resolve(true);
    const n = opts.solution.length;
    const cur = opts.start ? opts.start.slice() : new Array(n).fill(0);
    const syms = opts.symbols;
    return open(g, (box, close) => {
      box.appendChild(U.el('h2', { text: opts.title || 'Symbolschloss' }));
      if (opts.text) box.appendChild(U.el('p', { text: opts.text }));
      const row = U.el('div', { class: 'row' });
      const tiles = [];
      const cv = U.el('canvas', { width: 90 * n, height: 100 });
      box.appendChild(cv);
      const c = cv.getContext('2d');
      const draw = () => {
        c.clearRect(0, 0, cv.width, 100);
        for (let i = 0; i < n; i++) {
          A.rr(c, i * 90 + 8, 8, 74, 84, 6, '#3a2c1c', '#8a7350', 2);
          c.fillStyle = '#e6cf98';
          syms[cur[i]].draw(c, i * 90 + 45, 46, 26);
          c.fillStyle = '#a58a5c'; c.font = '12px Georgia'; c.textAlign = 'center'; c.fillText(syms[cur[i]].name, i * 90 + 45, 88);
        }
      };
      cv.addEventListener('click', (ev) => {
        const rect = cv.getBoundingClientRect();
        const i = Math.floor((((ev.clientX - rect.left) / rect.width) * cv.width) / 90);
        if (i < 0 || i >= n) return;
        cur[i] = (cur[i] + 1) % syms.length;
        ATL.audio.fx('click');
        draw();
      });
      const bOk = U.el('button', { text: 'Prüfen', class: 'primary' });
      bOk.addEventListener('click', () => {
        if (cur.every((v, i) => v === opts.solution[i])) { ATL.audio.fx('stone'); close(true); }
        else { ATL.audio.fx('fail'); close('wrong'); }
      });
      const bq = U.el('button', { text: 'Zurücktreten' });
      bq.addEventListener('click', () => close(false));
      row.appendChild(bOk); row.appendChild(bq);
      box.appendChild(row);
      draw();
    });
  };

  // ---------- Zettelkasten ----------
  P.catalog = function (g, opts) {
    if (g.fast) return Promise.resolve(opts.answer);
    return open(g, (box, close) => {
      box.appendChild(U.el('h2', { text: opts.title || 'Zettelkasten' }));
      box.appendChild(U.el('p', { text: opts.text || 'Schublade wählen, dann eine Karte.' }));
      const drawers = U.el('div', { class: 'row' });
      const cards = U.el('div', { class: 'row', style: 'margin-top:10px;min-height:120px;align-items:flex-start' });
      box.appendChild(drawers); box.appendChild(cards);
      opts.drawers.forEach((d) => {
        const b = U.el('div', { class: 'card', text: d.label });
        b.addEventListener('click', () => {
          document.querySelectorAll('#overlay .row .card').forEach((e) => e.classList.remove('on'));
          b.classList.add('on');
          cards.innerHTML = '';
          d.cards.forEach((cd) => {
            const e = U.el('div', { class: 'card', style: 'width:100%', text: cd.text });
            e.addEventListener('click', () => close(cd.id));
            cards.appendChild(e);
          });
        });
        drawers.appendChild(b);
      });
      const bq = U.el('button', { text: 'Schließen' });
      bq.addEventListener('click', () => close(null));
      box.appendChild(bq);
    });
  };

  // ---------- Keilschrift zuordnen ----------
  function wedgeGlyph(c, x, y, s, kind) {
    c.fillStyle = '#e6cf98';
    const w = (px, py, ang, len) => { c.save(); c.translate(px, py); c.rotate(ang); A.poly(c, [0, -s * 0.09, len, 0, 0, s * 0.09], c.fillStyle); c.restore(); };
    const L = s * 0.5;
    const pats = [
      () => { w(x - L, y - L * 0.5, 0, L * 2); w(x - L, y + L * 0.5, 0, L * 2); },
      () => { w(x, y - L, Math.PI / 2, L * 2); w(x - L * 0.7, y - L * 0.6, 0, L * 1.2); },
      () => { w(x - L, y - L, Math.PI / 4, L * 2.2); w(x - L, y + L, -Math.PI / 4, L * 2.2); },
      () => { w(x - L, y, 0, L * 2); w(x - L * 0.5, y - L, Math.PI / 2, L * 2); w(x + L * 0.5, y - L, Math.PI / 2, L * 2); },
      () => { w(x - L, y - L * 0.8, 0, L * 1.4); w(x - L, y, 0, L * 1.4); w(x - L, y + L * 0.8, 0, L * 1.4); },
      () => { w(x - L * 0.3, y - L, Math.PI / 2, L * 2); w(x - L, y + L * 0.3, 0, L * 2); },
      () => { w(x - L, y - L, Math.PI / 4, L * 1.5); w(x, y - L, Math.PI / 4, L * 1.5); w(x - L, y + L * 0.6, 0, L * 2); },
      () => { w(x - L, y, 0, L * 2); w(x + L * 0.2, y - L, Math.PI / 2, L * 2); },
    ];
    pats[kind % pats.length]();
  }
  P.wedgeGlyph = wedgeGlyph;
  P.cuneiform = function (g, opts) {
    if (g.fast) return Promise.resolve(true);
    const signs = opts.signs; // [{glyph:index, syl:'..'}]
    const choices = opts.choices; // Silben inkl. Ablenker
    const assign = new Array(signs.length).fill(null);
    let sel = 0;
    return open(g, (box, close) => {
      box.appendChild(U.el('h2', { text: opts.title || 'Keilschrift lesen' }));
      box.appendChild(U.el('p', { text: opts.text || 'Vergleiche die Zeichen mit der Silbentafel. Zeichen anklicken, dann die passende Silbe.' }));
      const cv = U.el('canvas', { width: 80 * signs.length + 20, height: 110 });
      box.appendChild(cv);
      const c = cv.getContext('2d');
      const draw = () => {
        c.clearRect(0, 0, cv.width, 110);
        signs.forEach((s, i) => {
          A.rr(c, 10 + i * 80, 6, 70, 96, 6, i === sel ? '#3f3020' : '#2a2016', i === sel ? '#ffd98a' : '#5a4225', 2);
          wedgeGlyph(c, 45 + i * 80, 44, 44, s.glyph);
          c.fillStyle = assign[i] ? '#ffe9b6' : '#5a4a3a'; c.font = '15px Georgia'; c.textAlign = 'center';
          c.fillText(assign[i] || '?', 45 + i * 80, 92);
        });
      };
      cv.addEventListener('click', (ev) => {
        const rect = cv.getBoundingClientRect();
        const i = Math.floor((((ev.clientX - rect.left) / rect.width) * cv.width - 10) / 80);
        if (i >= 0 && i < signs.length) { sel = i; draw(); }
      });
      if (opts.tableGlyphs) {
        box.appendChild(U.el('p', { text: 'Silbentafel:' }));
        const tv = U.el('canvas', { width: 70 * opts.tableGlyphs.length + 10, height: 80 });
        box.appendChild(tv);
        const tc = tv.getContext('2d');
        opts.tableGlyphs.forEach((t, i) => {
          wedgeGlyph(tc, 40 + i * 70, 32, 36, t.glyph);
          tc.fillStyle = '#c9a86a'; tc.font = '14px Georgia'; tc.textAlign = 'center'; tc.fillText(t.syl, 40 + i * 70, 72);
        });
      }
      const row = U.el('div', { class: 'row' });
      choices.forEach((ch) => {
        const b = U.el('button', { text: ch });
        b.addEventListener('click', () => { assign[sel] = ch; ATL.audio.fx('click'); if (sel < signs.length - 1) sel++; draw(); });
        row.appendChild(b);
      });
      box.appendChild(row);
      const row2 = U.el('div', { class: 'row' });
      const bOk = U.el('button', { text: 'Lesen', class: 'primary' });
      bOk.addEventListener('click', () => {
        if (signs.every((s, i) => assign[i] === s.syl)) { ATL.audio.fx('success'); close(true); }
        else { ATL.audio.fx('fail'); close('wrong'); }
      });
      const bq = U.el('button', { text: 'Abbrechen' });
      bq.addEventListener('click', () => close(false));
      row2.appendChild(bOk); row2.appendChild(bq);
      box.appendChild(row2);
      draw();
    });
  };

  // ---------- Schriftstück lesen ----------
  P.note = function (g, opts) {
    if (g.fast) return Promise.resolve(true);
    return open(g, (box, close) => {
      box.style.maxWidth = '640px';
      box.appendChild(U.el('h2', { text: opts.title }));
      const body = U.el('div', { style: 'font-size:17px;line-height:1.5;color:#efe1bf;white-space:pre-wrap;' + (opts.style || '') });
      body.textContent = opts.text;
      box.appendChild(body);
      const b = U.el('button', { text: opts.button || 'Weglegen', class: 'primary' });
      b.addEventListener('click', () => close(true));
      box.appendChild(b);
    });
  };

  // ---------- Allgemeine Auswahl ----------
  P.choose = function (g, opts) {
    if (g.fast) return Promise.resolve(opts.testAnswer ?? 0);
    return open(g, (box, close) => {
      box.appendChild(U.el('h2', { text: opts.title }));
      if (opts.text) box.appendChild(U.el('p', { text: opts.text }));
      opts.options.forEach((o, i) => {
        const b = U.el('button', { text: o, style: 'display:block;width:100%;text-align:left' });
        b.addEventListener('click', () => close(i));
        box.appendChild(b);
      });
      if (opts.cancel !== false) { const q = U.el('button', { text: 'Abbrechen' }); q.addEventListener('click', () => close(-1)); box.appendChild(q); }
    });
  };

  ATL.puzzles = P;
  ATL.Game.prototype.puzzle = function (name, opts) { return P[name](this, opts || {}); };
})(window.ATL);
