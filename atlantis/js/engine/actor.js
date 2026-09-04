/* Figuren: Zustand (Position, Weg, Animation) und prozedurale Zeichnung.
   Alle Figuren werden aus Grundformen gezeichnet, es gibt keine Bilddateien. */
(function (ATL) {
  const BASE_H = 150; // Höhe einer Figur bei Skalierung 1

  class Actor {
    constructor(id, def) {
      this.id = id;
      this.def = def;
      this.name = def.name;
      this.x = 480; this.y = 500;
      this.dir = 'd';
      this.scale = 1;
      this.visible = false;
      this.room = null;
      this.path = [];
      this.speed = def.speed || 170;
      this.anim = 'stand';
      this.phase = 0;
      this.talking = false;
      this.speech = null;
      this.walkResolve = null;
      this.fixedScale = null;
      this.hidden = false;
      this.offsetY = 0;
    }
    get height() { return BASE_H * this.scale * (this.def.look.height || 1); }
    setPos(x, y, dir) { this.x = x; this.y = y; if (dir) this.dir = dir; this.path = []; }
    stop() {
      this.path = [];
      this.anim = 'stand';
      if (this.walkResolve) { const r = this.walkResolve; this.walkResolve = null; r(false); }
    }
    walkPath(path) {
      return new Promise((resolve) => {
        this.stop();
        if (!path || !path.length) { resolve(true); return; }
        this.path = path.slice();
        this.anim = 'walk';
        this.walkResolve = resolve;
      });
    }
    faceTo(x, y) {
      const dx = x - this.x, dy = y - this.y;
      if (Math.abs(dx) > Math.abs(dy) * 1.2) this.dir = dx < 0 ? 'l' : 'r';
      else this.dir = dy < 0 ? 'u' : 'd';
    }
    update(dt, scaleFn) {
      if (scaleFn && !this.fixedScale) this.scale = scaleFn(this.y);
      if (this.fixedScale) this.scale = this.fixedScale;
      if (this.path.length) {
        const [tx, ty] = this.path[0];
        const dx = tx - this.x, dy = ty - this.y;
        const d = Math.hypot(dx, dy);
        const step = this.speed * this.scale * dt;
        if (d <= step) {
          this.x = tx; this.y = ty;
          this.path.shift();
          if (!this.path.length) {
            this.anim = 'stand';
            const r = this.walkResolve; this.walkResolve = null;
            if (r) r(true);
          }
        } else {
          this.x += (dx / d) * step;
          this.y += (dy / d) * step;
          this.faceTo(tx, ty);
          this.phase += dt * 9 * Math.max(0.6, this.scale);
        }
      } else if (this.anim === 'walk') this.anim = 'stand';
    }
  }

  // ---------- Zeichnung ----------
  function rr(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  function ell(ctx, x, y, rx, ry) { ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.closePath(); }
  function shade(hex, f) {
    // Farbe aufhellen (f>0) oder abdunkeln (f<0)
    const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
    if (!m) return hex;
    const c = [1, 2, 3].map((i) => parseInt(m[i], 16));
    const o = c.map((v) => Math.round(f > 0 ? v + (255 - v) * f : v * (1 + f)));
    return '#' + o.map((v) => ATL.U.clamp(v, 0, 255).toString(16).padStart(2, '0')).join('');
  }
  function line(ctx, x0, y0, x1, y1, w, color) {
    ctx.strokeStyle = color; ctx.lineWidth = w; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
  }

  function drawHat(ctx, L, view, bob) {
    const hat = L.hat || 'none';
    const hc = L.hatColor || '#5a3d22';
    const top = -150 + bob;
    if (hat === 'none') return;
    ctx.fillStyle = hc;
    if (hat === 'fedora') {
      const brimW = view === 'side' ? 25 : 23;
      // Krempe leicht geschwungen
      ctx.fillStyle = shade(hc, -0.1);
      ctx.beginPath(); ctx.ellipse(view === 'side' ? 2 : 0, top + 4, brimW, 4.5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = shade(hc, 0.05);
      ctx.beginPath(); ctx.ellipse(view === 'side' ? 2 : 0, top + 3, brimW, 3, 0, Math.PI, Math.PI * 2); ctx.fill();
      // Krone mit Kniff
      ctx.fillStyle = hc;
      ctx.beginPath(); ctx.moveTo(-13, top + 3); ctx.lineTo(-12, top - 12); ctx.quadraticCurveTo(-8, top - 16, -3, top - 13); ctx.quadraticCurveTo(0, top - 11, 3, top - 13); ctx.quadraticCurveTo(8, top - 16, 12, top - 12); ctx.lineTo(13, top + 3); ctx.closePath(); ctx.fill();
      ctx.fillStyle = shade(hc, 0.14); ctx.beginPath(); ctx.moveTo(-11, top - 11); ctx.quadraticCurveTo(-7, top - 14, -3, top - 12); ctx.lineTo(-4, top - 4); ctx.lineTo(-11, top - 3); ctx.closePath(); ctx.fill();
      // Band mit Schleife
      ctx.fillStyle = shade(hc, -0.45); ctx.fillRect(-13, top - 2, 26, 5);
      ctx.fillStyle = shade(hc, -0.6); ctx.fillRect(view === 'side' ? -11 : 8, top - 3, 4, 6);
      // Schatten der Krempe auf der Stirn
      ctx.fillStyle = 'rgba(0,0,0,0.22)';
      ctx.beginPath(); ctx.ellipse(view === 'side' ? 3 : 0, top + 8, 13, 5, 0, 0, Math.PI); ctx.fill();
    } else if (hat === 'pith') {
      ell(ctx, 0, top + 2, view === 'side' ? 24 : 22, 5); ctx.fill();
      ctx.fillStyle = A_grad(ctx, -17, top - 16, 17, top + 2, [shade(hc, 0.15), hc, shade(hc, -0.2)]);
      ctx.beginPath(); ctx.arc(0, top + 2, 17, Math.PI, 0); ctx.closePath(); ctx.fill();
      ctx.fillStyle = shade(hc, -0.3); ctx.fillRect(-16, top - 4, 32, 3);
      ctx.fillStyle = shade(hc, -0.15); ctx.fillRect(-2, top - 15, 4, 12);
      ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.beginPath(); ctx.ellipse(0, top + 7, 13, 4, 0, 0, Math.PI); ctx.fill();
    } else if (hat === 'cap') {
      ctx.fillStyle = A_grad(ctx, -15, top - 12, 15, top + 4, [shade(hc, 0.12), hc, shade(hc, -0.2)]);
      ctx.beginPath(); ctx.arc(0, top + 3, 15, Math.PI, 0); ctx.closePath(); ctx.fill();
      ctx.fillStyle = shade(hc, -0.3);
      if (view === 'side') { ctx.beginPath(); ctx.moveTo(2, top + 1); ctx.lineTo(21, top + 2); ctx.lineTo(19, top + 6); ctx.lineTo(2, top + 5); ctx.closePath(); ctx.fill(); }
      else ctx.fillRect(-15, top + 1, 30, 4);
      ctx.fillStyle = shade(hc, -0.15); ctx.fillRect(-1.5, top - 12, 3, 2);
      ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.beginPath(); ctx.ellipse(view === 'side' ? 6 : 0, top + 7, 12, 4, 0, 0, Math.PI); ctx.fill();
    } else if (hat === 'fez') {
      ctx.fillStyle = A_grad(ctx, -12, 0, 12, 0, [shade(hc, -0.2), shade(hc, 0.12), shade(hc, -0.25)]);
      ctx.beginPath(); ctx.moveTo(-12, top + 4); ctx.lineTo(-10, top - 14); ctx.lineTo(10, top - 14); ctx.lineTo(12, top + 4); ctx.closePath(); ctx.fill();
      ctx.fillStyle = shade(hc, 0.1); ctx.beginPath(); ctx.ellipse(0, top - 14, 10, 2.5, 0, 0, Math.PI * 2); ctx.fill();
      line(ctx, 6, top - 14, 13, top - 5, 2, '#222'); ctx.fillStyle = '#222'; ell(ctx, 13, top - 4, 2, 3); ctx.fill();
    } else if (hat === 'turban') {
      ctx.fillStyle = A_grad(ctx, -18, top - 14, 18, top + 10, [shade(hc, 0.1), hc, shade(hc, -0.25)]);
      ell(ctx, 0, top - 2, 18, 12); ctx.fill();
      ctx.strokeStyle = shade(hc, -0.28); ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(-15, top - 6); ctx.quadraticCurveTo(0, top + 2, 15, top - 8); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-13, top + 3); ctx.quadraticCurveTo(0, top - 8, 14, top + 1); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-9, top - 11); ctx.quadraticCurveTo(2, top - 4, 12, top - 12); ctx.stroke();
    } else if (hat === 'beret') {
      ctx.fillStyle = A_grad(ctx, -20, top - 10, 14, top + 6, [shade(hc, 0.12), hc, shade(hc, -0.2)]);
      ell(ctx, -3, top - 2, 17, 8); ctx.fill();
      ctx.fillStyle = shade(hc, -0.3); ell(ctx, -2, top - 9, 1.5, 1.5); ctx.fill();
    } else if (hat === 'officer') {
      ctx.fillStyle = A_grad(ctx, -14, top - 10, 14, top + 4, [shade(hc, 0.12), hc, shade(hc, -0.2)]);
      rr(ctx, -14, top - 9, 28, 13, 3); ctx.fill();
      ctx.fillStyle = shade(hc, -0.35); ctx.fillRect(-14, top - 1, 28, 4);
      ctx.fillStyle = '#111';
      if (view === 'side') { ctx.beginPath(); ctx.moveTo(2, top + 2); ctx.lineTo(20, top + 3); ctx.lineTo(18, top + 6); ctx.lineTo(2, top + 6); ctx.closePath(); ctx.fill(); }
      else ctx.fillRect(-15, top + 2, 30, 3);
      ctx.fillStyle = '#d4b45a'; ell(ctx, view === 'side' ? 6 : 0, top - 4, 3, 3); ctx.fill();
      ctx.fillStyle = '#e8cc70'; ell(ctx, view === 'side' ? 6 : 0, top - 4, 1.2, 1.2); ctx.fill();
    } else if (hat === 'headscarf') {
      ctx.fillStyle = A_grad(ctx, -17, top - 12, 17, top + 10, [shade(hc, 0.12), hc, shade(hc, -0.2)]);
      ctx.beginPath(); ctx.arc(0, top + 6, 17, Math.PI, 0); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(-17, top + 6); ctx.lineTo(-20, top + 34); ctx.lineTo(-12, top + 36); ctx.lineTo(-10, top + 8); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(17, top + 6); ctx.lineTo(20, top + 34); ctx.lineTo(12, top + 36); ctx.lineTo(10, top + 8); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = shade(hc, -0.25); ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(-15, top + 8); ctx.quadraticCurveTo(0, top + 2, 15, top + 8); ctx.stroke();
    } else if (hat === 'crown') {
      ctx.fillStyle = '#e0b84a';
      ctx.beginPath(); ctx.moveTo(-13, top + 4); ctx.lineTo(-13, top - 8); ctx.lineTo(-6, top - 2); ctx.lineTo(0, top - 12); ctx.lineTo(6, top - 2); ctx.lineTo(13, top - 8); ctx.lineTo(13, top + 4); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#5fd8b0'; [-8, 0, 8].forEach((x) => { ell(ctx, x, top, 1.6, 1.6); ctx.fill(); });
    } else if (hat === 'hood') {
      ctx.beginPath(); ctx.arc(0, top + 8, 20, Math.PI * 0.95, Math.PI * 2.05); ctx.lineTo(18, top + 40); ctx.lineTo(-18, top + 40); ctx.closePath(); ctx.fill();
    }
  }
  function A_grad(ctx, x0, y0, x1, y1, stops) { const g = ctx.createLinearGradient(x0, y0, x1, y1); stops.forEach((c, i) => g.addColorStop(i / (stops.length - 1), c)); return g; }

  function drawHair(ctx, L, view, bob) {
    const style = L.hairStyle || 'short';
    if (style === 'bald') { ctx.fillStyle = 'rgba(255,255,255,0.12)'; ell(ctx, -3, -142 + bob, 5, 3); ctx.fill(); return; }
    const hc = L.hair || '#3a2414';
    ctx.fillStyle = hc;
    const cy = -135 + bob;
    const strands = (x0, y0, x1, y1) => { ctx.strokeStyle = shade(hc, 0.22); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.quadraticCurveTo((x0 + x1) / 2 + 2, (y0 + y1) / 2 - 2, x1, y1); ctx.stroke(); };
    if (view === 'back') {
      ell(ctx, 0, cy - 2, 14, 15); ctx.fill();
      if (style === 'long') { rr(ctx, -13, cy - 4, 26, 34, 8); ctx.fill(); strands(-6, cy + 4, -7, cy + 26); strands(5, cy + 2, 6, cy + 24); }
      if (style === 'bun') { ell(ctx, 0, cy - 2, 6.5, 6.5); ctx.fill(); ctx.fillStyle = shade(hc, 0.2); ell(ctx, -2, cy - 4, 2, 2); ctx.fill(); }
      if (style === 'short' || style === 'slick' || style === 'grey') { strands(-8, cy - 10, -4, cy + 6); strands(6, cy - 10, 3, cy + 6); }
      return;
    }
    if (view === 'side') {
      ctx.beginPath(); ctx.arc(-1, cy - 3, 14, Math.PI * 0.92, Math.PI * 1.98); ctx.lineTo(-1, cy - 3); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(-14, cy - 2); ctx.quadraticCurveTo(-16, cy + 6, -12, cy + 9); ctx.lineTo(-9, cy - 2); ctx.closePath(); ctx.fill();
      if (style === 'long') { rr(ctx, -15, cy - 6, 12, 34, 6); ctx.fill(); strands(-9, cy + 2, -10, cy + 24); }
      if (style === 'bun') { ell(ctx, -14, cy - 4, 6, 6); ctx.fill(); }
      if (style === 'slick') { ctx.fillRect(-13, cy - 13, 22, 5); strands(-10, cy - 10, 8, cy - 12); }
      else { strands(-6, cy - 14, 6, cy - 15); strands(2, cy - 15, 9, cy - 11); }
      if (style === 'grey') { ctx.fillStyle = shade(hc, 0.3); ell(ctx, -6, cy - 12, 4, 2); ctx.fill(); }
      return;
    }
    // Vorderansicht
    ctx.beginPath(); ctx.arc(0, cy - 3, 14, Math.PI * 1.02, Math.PI * 1.98); ctx.lineTo(14, cy - 3); ctx.lineTo(-14, cy - 3); ctx.closePath(); ctx.fill();
    if (style === 'long') { rr(ctx, -16, cy - 6, 8, 34, 4); ctx.fill(); rr(ctx, 8, cy - 6, 8, 34, 4); ctx.fill(); strands(-12, cy, -13, cy + 24); strands(12, cy, 13, cy + 24); }
    if (style === 'short' || style === 'slick' || style === 'grey') { ctx.fillRect(-14, cy - 6, 4, 8); ctx.fillRect(10, cy - 6, 4, 8); }
    if (style === 'slick') { ctx.fillRect(-13, cy - 14, 26, 4); strands(-10, cy - 12, 10, cy - 13); }
    else if (style !== 'bun') { strands(-8, cy - 12, -2, cy - 15); strands(3, cy - 15, 9, cy - 12); }
    if (style === 'bun') { ell(ctx, -12, cy - 6, 3, 8); ctx.fill(); ell(ctx, 12, cy - 6, 3, 8); ctx.fill(); }
    // Glanz
    ctx.fillStyle = 'rgba(255,255,255,0.14)'; ell(ctx, -5, cy - 12, 5, 2); ctx.fill();
  }

  function drawFace(ctx, L, view, bob, talking, t) {
    const cy = -135 + bob;
    const skin = L.skin || '#e8b890';
    const hc = L.hair || '#3a2414';
    const iris = L.eyes || '#2a1a10';
    if (view === 'front') {
      // Ohren
      ctx.fillStyle = shade(skin, -0.08); ell(ctx, -13, cy + 1, 3, 4); ctx.fill(); ell(ctx, 13, cy + 1, 3, 4); ctx.fill();
      ctx.fillStyle = shade(skin, -0.25); ell(ctx, -13, cy + 1, 1.2, 2); ctx.fill(); ell(ctx, 13, cy + 1, 1.2, 2); ctx.fill();
      // Augen
      for (const sx of [-5, 5]) {
        ctx.fillStyle = '#f6f4ee'; ell(ctx, sx, cy - 2, 3.2, 2.3); ctx.fill();
        ctx.fillStyle = iris; ell(ctx, sx + 0.4, cy - 1.8, 1.7, 1.9); ctx.fill();
        ctx.fillStyle = '#000'; ell(ctx, sx + 0.4, cy - 1.8, 0.8, 0.9); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.8)'; ell(ctx, sx - 0.3, cy - 2.6, 0.6, 0.6); ctx.fill();
        line(ctx, sx - 3.2, cy - 3.6, sx + 3.2, cy - 3.6, 1.1, shade(skin, -0.45));
      }
      // Brauen
      ctx.strokeStyle = shade(hc, -0.15); ctx.lineWidth = 1.8; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(-8.5, cy - 6.5); ctx.quadraticCurveTo(-5, cy - 8.5, -1.5, cy - 6.8); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(1.5, cy - 6.8); ctx.quadraticCurveTo(5, cy - 8.5, 8.5, cy - 6.5); ctx.stroke();
      // Nase
      ctx.strokeStyle = shade(skin, -0.3); ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(0.5, cy - 1); ctx.lineTo(-1.5, cy + 3.5); ctx.lineTo(1.5, cy + 4); ctx.stroke();
      // Wangen
      if (L.face !== 'beard') { ctx.fillStyle = 'rgba(220,90,80,0.13)'; ell(ctx, -8, cy + 4, 3.5, 2); ctx.fill(); ell(ctx, 8, cy + 4, 3.5, 2); ctx.fill(); }
      // Mund
      if (talking) {
        const o = 1.5 + Math.abs(Math.sin(t * 14)) * 3;
        ctx.fillStyle = '#4a1f1a'; ell(ctx, 0, cy + 8.5, 4, o); ctx.fill();
        ctx.fillStyle = '#f0ece4'; ctx.fillRect(-2.5, cy + 8.5 - o + 0.5, 5, Math.min(1.6, o * 0.5));
      } else {
        line(ctx, -3.5, cy + 8, 3.5, cy + 8, 1.3, shade(skin, -0.45));
        line(ctx, -2.5, cy + 9.8, 2.5, cy + 9.8, 1.6, shade(skin, -0.12));
      }
      if (L.face === 'moustache' || L.face === 'beard') { ctx.fillStyle = hc; ctx.beginPath(); ctx.moveTo(-7, cy + 5.5); ctx.quadraticCurveTo(0, cy + 3, 7, cy + 5.5); ctx.quadraticCurveTo(0, cy + 8, -7, cy + 5.5); ctx.closePath(); ctx.fill(); }
      if (L.face === 'beard') { ctx.fillStyle = hc; ctx.beginPath(); ctx.moveTo(-12, cy + 3); ctx.quadraticCurveTo(-13, cy + 18, 0, cy + 26); ctx.quadraticCurveTo(13, cy + 18, 12, cy + 3); ctx.quadraticCurveTo(8, cy + 12, 0, cy + 11); ctx.quadraticCurveTo(-8, cy + 12, -12, cy + 3); ctx.closePath(); ctx.fill(); ctx.strokeStyle = shade(hc, 0.2); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-5, cy + 14); ctx.lineTo(-4, cy + 22); ctx.moveTo(4, cy + 14); ctx.lineTo(3, cy + 22); ctx.stroke(); }
      if (L.face === 'goatee') { ctx.fillStyle = hc; ctx.beginPath(); ctx.moveTo(-4.5, cy + 11); ctx.lineTo(4.5, cy + 11); ctx.lineTo(0, cy + 19); ctx.closePath(); ctx.fill(); }
      if (L.glasses) {
        ctx.strokeStyle = L.glassesColor || '#3a3028'; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.arc(-5, cy - 2, 4.6, 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath(); ctx.arc(5, cy - 2, 4.6, 0, Math.PI * 2); ctx.stroke();
        line(ctx, -0.6, cy - 2.5, 0.6, cy - 2.5, 1.2, ctx.strokeStyle);
        line(ctx, -9.4, cy - 2.5, -13, cy - 1, 1, ctx.strokeStyle); line(ctx, 9.4, cy - 2.5, 13, cy - 1, 1, ctx.strokeStyle);
        ctx.fillStyle = 'rgba(255,255,255,0.12)'; ell(ctx, -5, cy - 2, 4, 4); ctx.fill(); ell(ctx, 5, cy - 2, 4, 4); ctx.fill();
      }
    } else if (view === 'side') {
      // Ohr
      ctx.fillStyle = shade(skin, -0.08); ell(ctx, -7, cy + 1, 3.2, 4.2); ctx.fill();
      ctx.fillStyle = shade(skin, -0.25); ell(ctx, -7, cy + 1, 1.4, 2.2); ctx.fill();
      // Auge
      ctx.fillStyle = '#f6f4ee'; ell(ctx, 6, cy - 2, 2.8, 2.2); ctx.fill();
      ctx.fillStyle = iris; ell(ctx, 7, cy - 1.8, 1.6, 1.9); ctx.fill();
      ctx.fillStyle = '#000'; ell(ctx, 7.2, cy - 1.8, 0.7, 0.9); ctx.fill();
      line(ctx, 3.5, cy - 3.6, 9, cy - 3.8, 1.1, shade(skin, -0.45));
      ctx.strokeStyle = shade(hc, -0.15); ctx.lineWidth = 1.8; ctx.beginPath(); ctx.moveTo(3, cy - 6.5); ctx.quadraticCurveTo(7, cy - 8.5, 10, cy - 6.5); ctx.stroke();
      // Nase im Profil
      ctx.fillStyle = skin;
      ctx.beginPath(); ctx.moveTo(11.5, cy - 3); ctx.quadraticCurveTo(17.5, cy + 1, 16, cy + 4); ctx.lineTo(11.5, cy + 5); ctx.closePath(); ctx.fill();
      line(ctx, 13, cy + 4.5, 15.5, cy + 4, 1, shade(skin, -0.3));
      if (talking) {
        const o = 1 + Math.abs(Math.sin(t * 14)) * 2.5;
        ctx.fillStyle = '#4a1f1a'; ell(ctx, 10, cy + 9, 2.8, o); ctx.fill();
      } else { line(ctx, 7, cy + 9, 12.5, cy + 8.6, 1.3, shade(skin, -0.45)); line(ctx, 7.5, cy + 10.6, 11.5, cy + 10.4, 1.4, shade(skin, -0.12)); }
      if (L.face === 'moustache' || L.face === 'beard') { ctx.fillStyle = hc; ctx.beginPath(); ctx.moveTo(5, cy + 6.5); ctx.quadraticCurveTo(10, cy + 4, 15, cy + 6.5); ctx.quadraticCurveTo(10, cy + 8.5, 5, cy + 6.5); ctx.closePath(); ctx.fill(); }
      if (L.face === 'beard') { ctx.fillStyle = hc; ctx.beginPath(); ctx.moveTo(-5, cy + 5); ctx.quadraticCurveTo(-2, cy + 24, 8, cy + 24); ctx.quadraticCurveTo(15, cy + 20, 14, cy + 8); ctx.quadraticCurveTo(8, cy + 12, -5, cy + 5); ctx.closePath(); ctx.fill(); }
      if (L.face === 'goatee') { ctx.fillStyle = hc; ctx.beginPath(); ctx.moveTo(6, cy + 12); ctx.lineTo(13, cy + 11); ctx.lineTo(9, cy + 19); ctx.closePath(); ctx.fill(); }
      if (L.glasses) { ctx.strokeStyle = L.glassesColor || '#3a3028'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(7, cy - 2, 4.6, 0, Math.PI * 2); ctx.stroke(); line(ctx, 2.4, cy - 3, -8, cy - 3.5, 1, ctx.strokeStyle); ctx.fillStyle = 'rgba(255,255,255,0.12)'; ell(ctx, 7, cy - 2, 4, 4); ctx.fill(); }
    }
  }

  // Arm mit Ellbogen: Schulter (sx, sy) → Hand (hx, hy); bend verschiebt den Ellbogen seitlich
  function drawArm(ctx, sx, sy, hx, hy, w, color, cuff, skin, bend) {
    const mx = (sx + hx) / 2, my = (sy + hy) / 2;
    const dx = hx - sx, dy = hy - sy, len = Math.hypot(dx, dy) || 1;
    const ex = mx + (-dy / len) * (bend || 0), ey = my + (dx / len) * (bend || 0);
    line(ctx, sx, sy, ex, ey, w, color);
    line(ctx, ex, ey, hx, hy, w * 0.92, color);
    ctx.fillStyle = shade(color, 0.08); ell(ctx, ex, ey, w * 0.5, w * 0.5); ctx.fill();
    if (cuff) { const cx = hx - (hx - ex) * 0.22, cy2 = hy - (hy - ey) * 0.22; ctx.fillStyle = cuff; ell(ctx, cx, cy2, w * 0.56, w * 0.36); ctx.fill(); }
    // Hand mit Fingern
    ctx.fillStyle = skin; ell(ctx, hx, hy + 2, 5, 5.5); ctx.fill();
    ctx.strokeStyle = shade(skin, -0.25); ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.moveTo(hx - 1.5, hy + 4); ctx.lineTo(hx - 1.5, hy + 7); ctx.moveTo(hx + 1, hy + 4); ctx.lineTo(hx + 1, hy + 7.2); ctx.stroke();
  }
  function drawShoe(ctx, x, y, w, h, color, mirrorHeel) {
    ctx.fillStyle = color; ell(ctx, x, y, w, h); ctx.fill();
    ctx.fillStyle = shade(color, -0.45); ell(ctx, x, y + h * 0.55, w, h * 0.45); ctx.fill();
    ctx.fillStyle = shade(color, 0.18); ell(ctx, x - w * 0.2, y - h * 0.3, w * 0.4, h * 0.3); ctx.fill();
  }

  // Zeichnet die Figur selbst (ohne Schatten) mit Fußpunkt bei (ox, oy).
  function drawRaw(ctx, a, t, ox, oy, s) {
    const L = a.def.look;
    const dir = a.dir;
    const view = dir === 'd' ? 'front' : dir === 'u' ? 'back' : 'side';
    const walking = a.anim === 'walk';
    const ph = a.phase;
    const bob = walking ? Math.abs(Math.sin(ph)) * -3 : (a.talking ? Math.sin(t * 6) * 0.6 : Math.sin(t * 1.3) * 0.4);
    const crouch = a.anim === 'crouch' ? 18 : 0;
    const build = L.build === 'heavy' ? 1.25 : L.build === 'slim' ? 0.88 : 1;
    const top = L.top || '#8a6a4a';
    const bottom = L.bottom || '#4a3a2a';
    const skin = L.skin || '#e8b890';
    const inner = L.topInner || '#e8e0c8';
    const shoes = L.shoes || '#2a1c10';
    const style = L.topStyle || 'shirt';
    const isDress = style === 'dress' || style === 'robe';
    const sleeveColor = style === 'vest' ? inner : top;
    const cuffColor = (style === 'jacket' || style === 'coat' || style === 'uniform') ? inner : null;

    ctx.save();
    ctx.translate(ox, oy);
    ctx.scale(s * (dir === 'l' ? -1 : 1), s);
    ctx.translate(0, crouch);

    const hip = -68;
    const legLen = 62 - crouch * 0.6;
    const torsoGrad = (x0, x1, base) => A_grad(ctx, x0, 0, x1, 0, [shade(base, -0.22), shade(base, 0.1), shade(base, -0.05), shade(base, -0.28)]);

    if (view === 'side') {
      // Beine (zwei Segmente)
      const swing = walking ? Math.sin(ph) * 0.55 : 0;
      const legs = [[-swing, 0], [swing, 1]];
      if (!isDress) {
        for (let i = 0; i < 2; i++) {
          const ang = legs[i][0];
          const bend = walking ? Math.max(0, Math.sin(ph + (i ? Math.PI : 0))) * 0.6 : 0;
          const kx = Math.sin(ang) * legLen * 0.5, ky = hip + Math.cos(ang) * legLen * 0.5;
          const fx = kx + Math.sin(ang - bend) * legLen * 0.5, fy = ky + Math.cos(ang - bend) * legLen * 0.5;
          const col = i === 0 ? shade(bottom, -0.3) : bottom;
          line(ctx, 0, hip, kx, ky, 12 * build, col);
          line(ctx, kx, ky, fx, fy, 11 * build, col);
          line(ctx, kx + 1, ky + 2, fx + 1, fy - 3, 1.2, shade(col, i ? -0.25 : -0.15));
          ctx.fillStyle = shade(col, 0.06); ell(ctx, kx, ky, 5.5 * build, 5.5 * build); ctx.fill();
          drawShoe(ctx, fx + 4, fy + 1, 9.5, 4.2, i === 0 ? shade(shoes, -0.3) : shoes);
        }
      } else {
        ctx.fillStyle = torsoGrad(-14 * build, 16 * build, bottom);
        ctx.beginPath(); ctx.moveTo(-12 * build, hip - 4); ctx.lineTo(12 * build, hip - 4); ctx.lineTo(16 * build, -8 + (walking ? Math.sin(ph) * 3 : 0)); ctx.lineTo(-16 * build, -8 - (walking ? Math.sin(ph) * 3 : 0)); ctx.closePath(); ctx.fill();
        for (let k = -1; k <= 1; k++) line(ctx, k * 6 * build, hip + 2, k * 8 * build, -10, 1.2, shade(bottom, -0.22));
        line(ctx, -16 * build, -9, 16 * build, -9, 2.5, shade(bottom, -0.3));
        drawShoe(ctx, 6 + (walking ? Math.sin(ph) * 8 : 0), -3, 8, 4, shoes);
        drawShoe(ctx, -2 - (walking ? Math.sin(ph) * 8 : 0), -3, 8, 4, shade(shoes, -0.25));
      }
      // hinterer Arm
      const armSwing = walking ? Math.sin(ph) * 0.6 : 0;
      const sh = -112 + bob;
      const farA = a.anim === 'reach' ? -1.2 : -armSwing + 0.12;
      drawArm(ctx, -3, sh, -3 + Math.sin(farA) * 36, sh + Math.cos(farA) * 36, 10 * build, shade(sleeveColor, -0.35), cuffColor ? shade(cuffColor, -0.3) : null, shade(skin, -0.3), -6);
      // Rumpf
      ctx.fillStyle = torsoGrad(-13 * build, 13 * build, top);
      rr(ctx, -13 * build, -120 + bob, 26 * build, 56, 8); ctx.fill();
      // Schulterrundung
      ctx.fillStyle = shade(top, 0.06); ell(ctx, 0, -117 + bob, 12 * build, 6); ctx.fill();
      if (style === 'jacket' || style === 'coat' || style === 'vest') {
        ctx.fillStyle = inner;
        ctx.beginPath(); ctx.moveTo(6 * build, -120 + bob); ctx.lineTo(13 * build, -120 + bob); ctx.lineTo(13 * build, -94 + bob); ctx.closePath(); ctx.fill();
        ctx.fillStyle = shade(top, -0.22);
        ctx.beginPath(); ctx.moveTo(5 * build, -120 + bob); ctx.lineTo(11 * build, -120 + bob); ctx.lineTo(9 * build, -100 + bob); ctx.closePath(); ctx.fill();
        ctx.fillStyle = shade(top, -0.5); ell(ctx, 9 * build, -92 + bob, 1.4, 1.4); ctx.fill(); ell(ctx, 9 * build, -82 + bob, 1.4, 1.4); ctx.fill();
        ctx.strokeStyle = shade(top, -0.3); ctx.lineWidth = 1; ctx.strokeRect(-2 * build, -86 + bob, 9 * build, 7);
      }
      if (style === 'shirt') { ctx.fillStyle = shade(top, 0.25); ctx.beginPath(); ctx.moveTo(4 * build, -121 + bob); ctx.lineTo(12 * build, -121 + bob); ctx.lineTo(10 * build, -113 + bob); ctx.closePath(); ctx.fill(); ctx.fillStyle = shade(top, -0.45); for (let k = 0; k < 4; k++) { ell(ctx, 9 * build, -108 + bob + k * 10, 1.2, 1.2); ctx.fill(); } }
      if (style === 'uniform') { ctx.fillStyle = '#d4b45a'; for (let k = 0; k < 4; k++) { ell(ctx, 9 * build, -110 + bob + k * 10, 1.8, 1.8); ctx.fill(); } ctx.fillStyle = shade('#d4b45a', -0.2); rr(ctx, -6 * build, -121 + bob, 14 * build, 4, 1.5); ctx.fill(); }
      if (style === 'coat' || style === 'robe') { ctx.fillStyle = torsoGrad(-13 * build, 13 * build, top); rr(ctx, -13 * build, -70 + bob, 26 * build, 40, 6); ctx.fill(); line(ctx, 9 * build, -70 + bob, 9 * build, -34, 1, shade(top, -0.3)); }
      if (style === 'robe') { ctx.fillStyle = shade(top, -0.25); ctx.fillRect(-13 * build, -76 + bob, 26 * build, 5); }
      if (L.apron) { ctx.fillStyle = L.apron; rr(ctx, -9 * build, -100 + bob, 20 * build, 66, 3); ctx.fill(); }
      if (L.satchel) { line(ctx, 2, -118 + bob, -10 * build, -74 + bob, 4, '#4a3018'); ctx.fillStyle = '#5a3a1c'; rr(ctx, -20 * build, -74 + bob, 14, 13, 3); ctx.fill(); ctx.fillStyle = '#4a3018'; rr(ctx, -20 * build, -74 + bob, 14, 5, 2); ctx.fill(); }
      if (L.scarf) { ctx.fillStyle = L.scarf; rr(ctx, -8, -126 + bob, 18, 8, 3); ctx.fill(); }
      // Gürtel
      if (!isDress) { ctx.fillStyle = '#2a1c10'; ctx.fillRect(-13 * build, hip - 4 + bob, 26 * build, 4); ctx.fillStyle = '#c8a848'; ctx.fillRect(7 * build, hip - 4.5 + bob, 4, 5); }
      // vorderer Arm
      const nearA = a.anim === 'reach' ? 1.3 : armSwing - 0.12;
      const hx = 3 + Math.sin(nearA) * 36, hy = sh + Math.cos(nearA) * 36;
      drawArm(ctx, 3, sh, hx, hy, 10 * build, sleeveColor, cuffColor, skin, 6);
      // Hals und Kopf
      ctx.fillStyle = shade(skin, -0.18); ctx.fillRect(-3, -125 + bob, 9, 9);
      ctx.fillStyle = A_grad(ctx, -12, -150 + bob, 14, -120 + bob, [shade(skin, 0.1), skin, shade(skin, -0.12)]);
      ctx.beginPath(); ctx.ellipse(1, -135 + bob, 13, 15, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = shade(skin, -0.1); ell(ctx, 4, -123 + bob, 7, 3.5); ctx.fill();
      drawHair(ctx, L, 'side', bob);
      drawFace(ctx, L, 'side', bob, a.talking, t);
      drawHat(ctx, L, 'side', bob);
    } else {
      // Vorder- oder Rückansicht
      const front = view === 'front';
      if (!isDress) {
        for (let i = 0; i < 2; i++) {
          const off = i === 0 ? -9 * build : 9 * build;
          const len = legLen + (walking ? Math.sin(ph + (i ? Math.PI : 0)) * 6 : 0);
          const col = front ? bottom : shade(bottom, -0.15);
          line(ctx, off, hip, off, hip + len - 4, 13 * build, col);
          line(ctx, off + (i ? 1 : -1), hip + 6, off + (i ? 1 : -1), hip + len - 8, 1.2, shade(col, -0.22));
          ctx.fillStyle = shade(col, -0.12); ctx.fillRect(off - 6.5 * build, hip + len - 9, 13 * build, 3);
          drawShoe(ctx, off, hip + len, 8.5, 4.6, shoes);
        }
      } else {
        ctx.fillStyle = torsoGrad(-19 * build, 19 * build, bottom);
        ctx.beginPath(); ctx.moveTo(-13 * build, hip - 6); ctx.lineTo(13 * build, hip - 6); ctx.lineTo(19 * build, -6); ctx.lineTo(-19 * build, -6); ctx.closePath(); ctx.fill();
        for (let k = -2; k <= 2; k++) line(ctx, k * 5 * build, hip, k * 7 * build, -8, 1.2, shade(bottom, k % 2 ? -0.22 : 0.08));
        line(ctx, -19 * build, -8, 19 * build, -8, 2.5, shade(bottom, -0.3));
        drawShoe(ctx, -7 + (walking ? Math.sin(ph) * 2 : 0), -3, 7, 4, shoes);
        drawShoe(ctx, 7 - (walking ? Math.sin(ph) * 2 : 0), -3, 7, 4, shoes);
      }
      // Rumpf
      ctx.fillStyle = torsoGrad(-19 * build, 19 * build, front ? top : shade(top, -0.1));
      rr(ctx, -19 * build, -120 + bob, 38 * build, 56, 9); ctx.fill();
      ctx.fillStyle = shade(top, 0.07); ell(ctx, -14 * build, -116 + bob, 7, 5); ctx.fill(); ell(ctx, 14 * build, -116 + bob, 7, 5); ctx.fill();
      if (front) {
        if (style === 'jacket' || style === 'coat' || style === 'vest') {
          ctx.fillStyle = inner;
          ctx.beginPath(); ctx.moveTo(-9 * build, -120 + bob); ctx.lineTo(9 * build, -120 + bob); ctx.lineTo(0, -90 + bob); ctx.closePath(); ctx.fill();
          // Kragen des Hemds
          ctx.fillStyle = shade(inner, 0.12);
          ctx.beginPath(); ctx.moveTo(-6, -121 + bob); ctx.lineTo(0, -114 + bob); ctx.lineTo(-1, -120 + bob); ctx.closePath(); ctx.fill();
          ctx.beginPath(); ctx.moveTo(6, -121 + bob); ctx.lineTo(0, -114 + bob); ctx.lineTo(1, -120 + bob); ctx.closePath(); ctx.fill();
          if (L.tie) { ctx.fillStyle = L.tie; ctx.beginPath(); ctx.moveTo(-2.5, -116 + bob); ctx.lineTo(2.5, -116 + bob); ctx.lineTo(1.5, -96 + bob); ctx.lineTo(0, -93 + bob); ctx.lineTo(-1.5, -96 + bob); ctx.closePath(); ctx.fill(); }
          // Revers
          ctx.fillStyle = shade(top, -0.2);
          ctx.beginPath(); ctx.moveTo(-12 * build, -120 + bob); ctx.lineTo(-6 * build, -120 + bob); ctx.lineTo(-2, -96 + bob); ctx.lineTo(-7 * build, -100 + bob); ctx.closePath(); ctx.fill();
          ctx.beginPath(); ctx.moveTo(12 * build, -120 + bob); ctx.lineTo(6 * build, -120 + bob); ctx.lineTo(2, -96 + bob); ctx.lineTo(7 * build, -100 + bob); ctx.closePath(); ctx.fill();
          ctx.fillStyle = shade(top, -0.3); ctx.fillRect(-1, -92 + bob, 2, 26);
          ctx.fillStyle = shade(top, -0.55); ell(ctx, 2.5, -86 + bob, 1.5, 1.5); ctx.fill(); ell(ctx, 2.5, -76 + bob, 1.5, 1.5); ctx.fill();
          ctx.strokeStyle = shade(top, -0.3); ctx.lineWidth = 1;
          ctx.strokeRect(-16 * build, -84 + bob, 9 * build, 7); ctx.strokeRect(7 * build, -84 + bob, 9 * build, 7);
          ctx.fillStyle = shade(top, 0.05); ctx.fillRect(-14 * build, -110 + bob, 5 * build, 6);
        }
        if (style === 'shirt') {
          ctx.fillStyle = shade(top, 0.22);
          ctx.beginPath(); ctx.moveTo(-8, -121 + bob); ctx.lineTo(0, -113 + bob); ctx.lineTo(-2, -121 + bob); ctx.closePath(); ctx.fill();
          ctx.beginPath(); ctx.moveTo(8, -121 + bob); ctx.lineTo(0, -113 + bob); ctx.lineTo(2, -121 + bob); ctx.closePath(); ctx.fill();
          ctx.fillStyle = shade(top, -0.14); ctx.fillRect(-1, -113 + bob, 2, 46);
          ctx.fillStyle = shade(top, -0.5); for (let k = 0; k < 4; k++) { ell(ctx, 0, -108 + bob + k * 11, 1.3, 1.3); ctx.fill(); }
          if (L.tie) { ctx.fillStyle = L.tie; ctx.beginPath(); ctx.moveTo(-3, -118 + bob); ctx.lineTo(3, -118 + bob); ctx.lineTo(2, -94 + bob); ctx.lineTo(0, -90 + bob); ctx.lineTo(-2, -94 + bob); ctx.closePath(); ctx.fill(); }
          ctx.strokeStyle = shade(top, -0.25); ctx.lineWidth = 1; ctx.strokeRect(-14 * build, -104 + bob, 8 * build, 7);
        }
        if (style === 'uniform') {
          ctx.fillStyle = '#d4b45a'; for (let k = 0; k < 4; k++) { ell(ctx, -4, -110 + bob + k * 10, 1.8, 1.8); ctx.fill(); ell(ctx, 4, -110 + bob + k * 10, 1.8, 1.8); ctx.fill(); }
          ctx.fillStyle = shade('#d4b45a', -0.2); rr(ctx, -19 * build, -121 + bob, 10 * build, 4, 1.5); ctx.fill(); rr(ctx, 9 * build, -121 + bob, 10 * build, 4, 1.5); ctx.fill();
          ctx.fillStyle = shade(top, 0.2); ctx.beginPath(); ctx.moveTo(-6, -121 + bob); ctx.lineTo(6, -121 + bob); ctx.lineTo(4, -116 + bob); ctx.lineTo(-4, -116 + bob); ctx.closePath(); ctx.fill();
        }
        if (style === 'dress') { ctx.fillStyle = shade(skin, -0.05); ctx.beginPath(); ctx.moveTo(-8, -120 + bob); ctx.quadraticCurveTo(0, -108 + bob, 8, -120 + bob); ctx.closePath(); ctx.fill(); ctx.fillStyle = shade(top, -0.25); ctx.fillRect(-19 * build, -74 + bob, 38 * build, 5); line(ctx, -8, -104 + bob, -9, -76 + bob, 1, shade(top, -0.2)); line(ctx, 8, -104 + bob, 9, -76 + bob, 1, shade(top, -0.2)); }
        if (style === 'robe') { ctx.fillStyle = shade(top, -0.22); ctx.beginPath(); ctx.moveTo(-7, -120 + bob); ctx.lineTo(7, -120 + bob); ctx.lineTo(0, -104 + bob); ctx.closePath(); ctx.fill(); ctx.fillStyle = shade(top, -0.25); ctx.fillRect(-19 * build, -76 + bob, 38 * build, 5); line(ctx, -10, -100 + bob, -12, -40, 1, shade(top, -0.2)); line(ctx, 10, -100 + bob, 12, -40, 1, shade(top, -0.2)); }
      } else {
        // Rückansicht: Rückennaht, Kragen
        line(ctx, 0, -118 + bob, 0, -70 + bob, 1.2, shade(top, -0.3));
        ctx.fillStyle = shade(top, -0.18); rr(ctx, -9, -122 + bob, 18, 5, 2); ctx.fill();
      }
      if (style === 'coat' || style === 'robe') { ctx.fillStyle = torsoGrad(-19 * build, 19 * build, front ? top : shade(top, -0.1)); rr(ctx, -19 * build, -70 + bob, 38 * build, 40, 6); ctx.fill(); if (front) line(ctx, 0, -70 + bob, 0, -34, 1.2, shade(top, -0.3)); }
      if (L.apron && front) { ctx.fillStyle = L.apron; rr(ctx, -13 * build, -100 + bob, 26 * build, 66, 3); ctx.fill(); line(ctx, -13 * build, -100 + bob, -7, -118 + bob, 2, L.apron); line(ctx, 13 * build, -100 + bob, 7, -118 + bob, 2, L.apron); }
      if (L.satchel) { if (front) { line(ctx, 13 * build, -118 + bob, -17 * build, -74 + bob, 4, '#4a3018'); } ctx.fillStyle = '#5a3a1c'; rr(ctx, -26 * build, -74 + bob, 15, 13, 3); ctx.fill(); ctx.fillStyle = '#4a3018'; rr(ctx, -26 * build, -74 + bob, 15, 5, 2); ctx.fill(); ctx.fillStyle = '#c8a848'; ctx.fillRect(-20 * build, -69 + bob, 2.5, 2.5); }
      if (L.scarf) { ctx.fillStyle = L.scarf; rr(ctx, -10, -126 + bob, 20, 8, 3); ctx.fill(); if (front) { ctx.beginPath(); ctx.moveTo(-6, -118 + bob); ctx.lineTo(-2, -118 + bob); ctx.lineTo(-4, -100 + bob); ctx.closePath(); ctx.fill(); } }
      if (L.necklace && front) { ctx.strokeStyle = L.necklace; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-7, -121 + bob); ctx.quadraticCurveTo(0, -109 + bob, 7, -121 + bob); ctx.stroke(); ctx.fillStyle = L.necklace; ell(ctx, 0, -113 + bob, 2.2, 2.6); ctx.fill(); }
      if (!isDress) { ctx.fillStyle = '#2a1c10'; ctx.fillRect(-19 * build, hip - 4 + bob, 38 * build, 4); if (front) { ctx.fillStyle = '#c8a848'; ctx.fillRect(-2.5, hip - 4.5 + bob, 5, 5); ctx.fillStyle = '#2a1c10'; ctx.fillRect(-1, hip - 3 + bob, 2, 2); } }
      // Arme
      const sw = walking ? Math.sin(ph) * 6 : 0;
      const sh = -112 + bob;
      for (let i = 0; i < 2; i++) {
        const side = i === 0 ? -1 : 1;
        const sx = side * 21 * build;
        let hx = sx + side * 3, hy = sh + 40 + (i ? -sw : sw);
        if (a.anim === 'reach') { hx = side * 12; hy = sh + 6; }
        drawArm(ctx, sx, sh, hx, hy, 10 * build, front ? sleeveColor : shade(sleeveColor, -0.12), cuffColor, skin, side * 5);
      }
      // Hals und Kopf
      ctx.fillStyle = shade(skin, -0.18); ctx.fillRect(-4, -125 + bob, 8, 9);
      ctx.fillStyle = A_grad(ctx, -13, -150 + bob, 13, -120 + bob, [shade(skin, 0.1), skin, shade(skin, -0.12)]);
      ctx.beginPath(); ctx.ellipse(0, -135 + bob, 13, 15, 0, 0, Math.PI * 2); ctx.fill();
      // Kinn und Halsschatten
      ctx.fillStyle = shade(skin, -0.1); ell(ctx, 0, -123 + bob, 8, 3.5); ctx.fill();
      drawHair(ctx, L, view, bob);
      if (front) drawFace(ctx, L, 'front', bob, a.talking, t);
      drawHat(ctx, L, view, bob);
    }
    ctx.restore();
  }

  // Figur mit Kontur, Schattierung und Raumlicht über Zwischenleinwände zeichnen.
  const OC = document.createElement('canvas'), OL = document.createElement('canvas');
  function drawActor(ctx, a, t, tint) {
    const L = a.def.look;
    const s = a.scale * (L.height || 1);
    const build = L.build === 'heavy' ? 1.25 : L.build === 'slim' ? 0.88 : 1;
    const fx = a.x, fy = a.y + (a.offsetY || 0);
    // Bodenschatten
    ctx.fillStyle = 'rgba(0,0,0,0.30)';
    ell(ctx, fx, fy, 24 * s * build, 6 * s); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ell(ctx, fx, fy, 34 * s * build, 9 * s); ctx.fill();
    const w = Math.ceil(150 * s) + 12, h = Math.ceil(185 * s) + 12;
    if (OC.width !== w || OC.height !== h) { OC.width = w; OC.height = h; OL.width = w; OL.height = h; }
    const oc = OC.getContext('2d');
    oc.clearRect(0, 0, w, h);
    const ox = w / 2, oy = h - 6;
    drawRaw(oc, a, t, ox, oy, s);
    // Schattierung: oben etwas heller, unten dunkler, dazu Raumlicht
    oc.globalCompositeOperation = 'source-atop';
    const grd = oc.createLinearGradient(0, oy - 165 * s, 0, oy);
    grd.addColorStop(0, 'rgba(255,255,255,0.07)'); grd.addColorStop(0.5, 'rgba(0,0,0,0)'); grd.addColorStop(1, 'rgba(0,0,0,0.30)');
    oc.fillStyle = grd; oc.fillRect(0, 0, w, h);
    const side = oc.createLinearGradient(0, 0, w, 0);
    side.addColorStop(0, 'rgba(0,0,0,0.16)'); side.addColorStop(0.35, 'rgba(0,0,0,0)'); side.addColorStop(0.7, 'rgba(255,255,255,0.05)'); side.addColorStop(1, 'rgba(0,0,0,0.12)');
    oc.fillStyle = side; oc.fillRect(0, 0, w, h);
    if (tint) { oc.fillStyle = tint; oc.fillRect(0, 0, w, h); }
    oc.globalCompositeOperation = 'source-over';
    // Kontur: Silhouette in acht Richtungen versetzt, dunkel eingefärbt
    const ol = OL.getContext('2d');
    ol.clearRect(0, 0, w, h);
    const d = 1.4;
    for (let i = 0; i < 8; i++) { const ang = (i / 8) * Math.PI * 2; ol.drawImage(OC, Math.cos(ang) * d, Math.sin(ang) * d); }
    ol.globalCompositeOperation = 'source-in';
    ol.fillStyle = 'rgba(22,14,10,0.9)'; ol.fillRect(0, 0, w, h);
    ol.globalCompositeOperation = 'source-over';
    const dx = Math.round(fx - ox), dy = Math.round(fy - oy);
    ctx.drawImage(OL, dx, dy);
    ctx.drawImage(OC, dx, dy);
  }

  ATL.Actor = Actor;
  ATL.drawActor = drawActor;
  ATL.drawActorRaw = drawRaw;
  ATL.BASE_H = BASE_H;
  ATL.shade = shade;
})(window.ATL);
