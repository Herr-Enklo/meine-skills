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
      if (view === 'side') {
        ell(ctx, 1, top + 4, 24, 4); ctx.fill();
        rr(ctx, -12, top - 14, 24, 19, 6); ctx.fill();
        ctx.fillStyle = shade(hc, -0.35); ctx.fillRect(-12, top - 2, 24, 4);
        ctx.fillStyle = shade(hc, 0.12); rr(ctx, -9, top - 14, 8, 10, 4); ctx.fill();
      } else {
        ell(ctx, 0, top + 4, 22, 4); ctx.fill();
        rr(ctx, -13, top - 14, 26, 19, 6); ctx.fill();
        ctx.fillStyle = shade(hc, -0.35); ctx.fillRect(-13, top - 2, 26, 4);
      }
    } else if (hat === 'pith') {
      ell(ctx, 0, top + 2, view === 'side' ? 24 : 22, 5); ctx.fill();
      ctx.beginPath(); ctx.arc(0, top + 2, 17, Math.PI, 0); ctx.closePath(); ctx.fill();
      ctx.fillStyle = shade(hc, -0.3); ctx.fillRect(-16, top - 4, 32, 3);
    } else if (hat === 'cap') {
      ctx.beginPath(); ctx.arc(0, top + 3, 15, Math.PI, 0); ctx.closePath(); ctx.fill();
      ctx.fillStyle = shade(hc, -0.3);
      if (view === 'side') ctx.fillRect(4, top + 1, 16, 4); else ctx.fillRect(-15, top + 1, 30, 4);
    } else if (hat === 'fez') {
      ctx.beginPath(); ctx.moveTo(-12, top + 4); ctx.lineTo(-10, top - 14); ctx.lineTo(10, top - 14); ctx.lineTo(12, top + 4); ctx.closePath(); ctx.fill();
      line(ctx, 8, top - 14, 14, top - 6, 2, '#222');
    } else if (hat === 'turban') {
      ell(ctx, 0, top - 2, 18, 12); ctx.fill();
      ctx.strokeStyle = shade(hc, -0.25); ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(-15, top - 6); ctx.quadraticCurveTo(0, top + 2, 15, top - 8); ctx.stroke();
    } else if (hat === 'beret') {
      ell(ctx, -3, top - 2, 17, 8); ctx.fill();
    } else if (hat === 'officer') {
      rr(ctx, -14, top - 8, 28, 12, 3); ctx.fill();
      ctx.fillStyle = '#111';
      if (view === 'side') ctx.fillRect(2, top + 2, 18, 3); else ctx.fillRect(-15, top + 2, 30, 3);
      ctx.fillStyle = '#d4b45a'; ell(ctx, view === 'side' ? 6 : 0, top - 2, 3, 3); ctx.fill();
    } else if (hat === 'headscarf') {
      ctx.beginPath(); ctx.arc(0, top + 6, 17, Math.PI, 0); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(-17, top + 6); ctx.lineTo(-20, top + 34); ctx.lineTo(-12, top + 36); ctx.lineTo(-10, top + 8); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(17, top + 6); ctx.lineTo(20, top + 34); ctx.lineTo(12, top + 36); ctx.lineTo(10, top + 8); ctx.closePath(); ctx.fill();
    } else if (hat === 'crown') {
      ctx.fillStyle = '#e0b84a';
      ctx.beginPath(); ctx.moveTo(-13, top + 4); ctx.lineTo(-13, top - 8); ctx.lineTo(-6, top - 2); ctx.lineTo(0, top - 12); ctx.lineTo(6, top - 2); ctx.lineTo(13, top - 8); ctx.lineTo(13, top + 4); ctx.closePath(); ctx.fill();
    } else if (hat === 'hood') {
      ctx.beginPath(); ctx.arc(0, top + 8, 20, Math.PI * 0.95, Math.PI * 2.05); ctx.lineTo(18, top + 40); ctx.lineTo(-18, top + 40); ctx.closePath(); ctx.fill();
    }
  }

  function drawHair(ctx, L, view, bob) {
    const style = L.hairStyle || 'short';
    if (style === 'bald') return;
    ctx.fillStyle = L.hair || '#3a2414';
    const cy = -135 + bob;
    if (view === 'back') {
      ell(ctx, 0, cy - 2, 14, 15); ctx.fill();
      if (style === 'long') { rr(ctx, -13, cy - 4, 26, 34, 8); ctx.fill(); }
      if (style === 'bun') { ell(ctx, 0, cy - 2, 6, 6); ctx.fill(); }
      return;
    }
    if (view === 'side') {
      ctx.beginPath(); ctx.arc(-1, cy - 3, 14, Math.PI * 0.9, Math.PI * 1.95); ctx.lineTo(-1, cy - 3); ctx.closePath(); ctx.fill();
      if (style === 'long') { rr(ctx, -15, cy - 6, 12, 34, 6); ctx.fill(); }
      if (style === 'bun') { ell(ctx, -14, cy - 4, 6, 6); ctx.fill(); }
      if (style === 'slick') { ctx.fillRect(-13, cy - 12, 22, 5); }
      return;
    }
    // Vorderansicht
    ctx.beginPath(); ctx.arc(0, cy - 3, 14, Math.PI * 1.02, Math.PI * 1.98); ctx.lineTo(14, cy - 3); ctx.lineTo(-14, cy - 3); ctx.closePath(); ctx.fill();
    if (style === 'long') { rr(ctx, -16, cy - 6, 8, 34, 4); ctx.fill(); rr(ctx, 8, cy - 6, 8, 34, 4); ctx.fill(); }
    if (style === 'short' || style === 'slick') { ctx.fillRect(-14, cy - 6, 4, 8); ctx.fillRect(10, cy - 6, 4, 8); }
    if (style === 'grey') { ctx.fillRect(-14, cy - 6, 4, 8); ctx.fillRect(10, cy - 6, 4, 8); }
  }

  function drawFace(ctx, L, view, bob, talking, t) {
    const cy = -135 + bob;
    ctx.fillStyle = '#1a1210';
    if (view === 'front') {
      ell(ctx, -5, cy - 2, 1.6, 2); ctx.fill();
      ell(ctx, 5, cy - 2, 1.6, 2); ctx.fill();
      // Brauen
      line(ctx, -8, cy - 7, -2, cy - 7, 1.5, shade(L.hair || '#3a2414', -0.2));
      line(ctx, 2, cy - 7, 8, cy - 7, 1.5, shade(L.hair || '#3a2414', -0.2));
      // Nase
      line(ctx, 0, cy - 1, -1, cy + 4, 1.2, shade(L.skin, -0.25));
      // Mund
      if (talking) {
        const o = 1.5 + Math.abs(Math.sin(t * 14)) * 3;
        ctx.fillStyle = '#4a1f1a'; ell(ctx, 0, cy + 8, 4, o); ctx.fill();
      } else line(ctx, -3.5, cy + 8, 3.5, cy + 8, 1.4, shade(L.skin, -0.4));
      if (L.face === 'moustache' || L.face === 'beard') line(ctx, -6, cy + 5, 6, cy + 5, 3, L.hair || '#3a2414');
      if (L.face === 'beard') { ctx.fillStyle = L.hair || '#3a2414'; ctx.beginPath(); ctx.moveTo(-11, cy + 4); ctx.quadraticCurveTo(0, cy + 26, 11, cy + 4); ctx.closePath(); ctx.fill(); }
      if (L.face === 'goatee') { ctx.fillStyle = L.hair || '#3a2414'; ctx.beginPath(); ctx.moveTo(-4, cy + 11); ctx.lineTo(4, cy + 11); ctx.lineTo(0, cy + 18); ctx.closePath(); ctx.fill(); }
      if (L.glasses) {
        ctx.strokeStyle = '#333'; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.arc(-5, cy - 2, 4.5, 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath(); ctx.arc(5, cy - 2, 4.5, 0, Math.PI * 2); ctx.stroke();
        line(ctx, -0.5, cy - 2, 0.5, cy - 2, 1.2, '#333');
      }
    } else if (view === 'side') {
      ell(ctx, 6, cy - 2, 1.6, 2); ctx.fill();
      line(ctx, 3, cy - 7, 9, cy - 7, 1.5, shade(L.hair || '#3a2414', -0.2));
      // Nase im Profil
      ctx.fillStyle = L.skin;
      ctx.beginPath(); ctx.moveTo(12, cy - 2); ctx.lineTo(17, cy + 3); ctx.lineTo(12, cy + 5); ctx.closePath(); ctx.fill();
      if (talking) {
        const o = 1 + Math.abs(Math.sin(t * 14)) * 2.5;
        ctx.fillStyle = '#4a1f1a'; ell(ctx, 10, cy + 9, 2.5, o); ctx.fill();
      } else line(ctx, 7, cy + 9, 12, cy + 9, 1.4, shade(L.skin, -0.4));
      if (L.face === 'moustache' || L.face === 'beard') line(ctx, 6, cy + 6, 14, cy + 6, 3, L.hair || '#3a2414');
      if (L.face === 'beard') { ctx.fillStyle = L.hair || '#3a2414'; ctx.beginPath(); ctx.moveTo(-4, cy + 6); ctx.quadraticCurveTo(4, cy + 26, 13, cy + 8); ctx.closePath(); ctx.fill(); }
      if (L.glasses) { ctx.strokeStyle = '#333'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(7, cy - 2, 4.5, 0, Math.PI * 2); ctx.stroke(); line(ctx, 2, cy - 3, -10, cy - 4, 1.2, '#333'); }
    }
  }

  // Zeichnet die Figur selbst (ohne Schatten) mit Fußpunkt bei (ox, oy).
  function drawRaw(ctx, a, t, ox, oy, s) {
    const L = a.def.look;
    const dir = a.dir;
    const view = dir === 'd' ? 'front' : dir === 'u' ? 'back' : 'side';
    const walking = a.anim === 'walk';
    const ph = a.phase;
    const bob = walking ? Math.abs(Math.sin(ph)) * -3 : (a.talking ? Math.sin(t * 6) * 0.6 : 0);
    const crouch = a.anim === 'crouch' ? 18 : 0;
    const build = L.build === 'heavy' ? 1.25 : L.build === 'slim' ? 0.88 : 1;
    const top = L.top || '#8a6a4a';
    const bottom = L.bottom || '#4a3a2a';
    const skin = L.skin || '#e8b890';
    const isDress = L.topStyle === 'dress' || L.topStyle === 'robe';

    ctx.save();
    ctx.translate(ox, oy);
    ctx.scale(s * (dir === 'l' ? -1 : 1), s);
    ctx.translate(0, crouch);

    const hip = -68;
    const legLen = 62 - crouch * 0.6;

    if (view === 'side') {
      // Beine (zwei Segmente)
      const swing = walking ? Math.sin(ph) * 0.55 : 0;
      const legs = [[-swing, 0.55], [swing, 0.45]]; // [Winkel, Helligkeit]
      if (!isDress) {
        for (let i = 0; i < 2; i++) {
          const ang = legs[i][0];
          const bend = walking ? Math.max(0, Math.sin(ph + (i ? Math.PI : 0))) * 0.6 : 0;
          const kx = Math.sin(ang) * legLen * 0.5, ky = hip + Math.cos(ang) * legLen * 0.5;
          const fx = kx + Math.sin(ang - bend) * legLen * 0.5, fy = ky + Math.cos(ang - bend) * legLen * 0.5;
          const col = i === 0 ? shade(bottom, -0.3) : bottom;
          line(ctx, 0, hip, kx, ky, 12 * build, col);
          line(ctx, kx, ky, fx, fy, 11 * build, col);
          ctx.fillStyle = i === 0 ? shade(L.shoes || '#2a1c10', -0.3) : (L.shoes || '#2a1c10');
          ell(ctx, fx + 4, fy + 1, 9, 4); ctx.fill();
        }
      } else {
        ctx.fillStyle = bottom;
        ctx.beginPath(); ctx.moveTo(-12 * build, hip - 4); ctx.lineTo(12 * build, hip - 4); ctx.lineTo(16 * build, -8 + (walking ? Math.sin(ph) * 3 : 0)); ctx.lineTo(-16 * build, -8 - (walking ? Math.sin(ph) * 3 : 0)); ctx.closePath(); ctx.fill();
        ctx.fillStyle = L.shoes || '#2a1c10';
        ell(ctx, 6 + (walking ? Math.sin(ph) * 8 : 0), -3, 8, 4); ctx.fill();
        ell(ctx, -2 - (walking ? Math.sin(ph) * 8 : 0), -3, 8, 4); ctx.fill();
      }
      // hinterer Arm
      const armSwing = walking ? Math.sin(ph) * 0.6 : 0;
      const sh = -112 + bob;
      const farA = a.anim === 'reach' ? -1.2 : -armSwing;
      line(ctx, -2, sh, -2 + Math.sin(farA) * 34, sh + Math.cos(farA) * 34, 10 * build, shade(top, -0.35));
      // Rumpf
      ctx.fillStyle = top;
      rr(ctx, -13 * build, -120 + bob, 26 * build, 56, 8); ctx.fill();
      ctx.fillStyle = shade(top, -0.2);
      rr(ctx, -13 * build, -120 + bob, 9 * build, 56, 8); ctx.fill();
      if (L.topStyle === 'jacket' || L.topStyle === 'coat' || L.topStyle === 'vest') {
        ctx.fillStyle = L.topInner || '#e8e0c8';
        ctx.beginPath(); ctx.moveTo(8 * build, -120 + bob); ctx.lineTo(13 * build, -120 + bob); ctx.lineTo(13 * build, -96 + bob); ctx.closePath(); ctx.fill();
      }
      if (L.topStyle === 'coat' || L.topStyle === 'robe') { ctx.fillStyle = top; rr(ctx, -13 * build, -70 + bob, 26 * build, 40, 6); ctx.fill(); }
      // Gürtel
      if (!isDress) { ctx.fillStyle = '#2a1c10'; ctx.fillRect(-13 * build, hip - 4 + bob, 26 * build, 4); }
      // vorderer Arm
      const nearA = a.anim === 'reach' ? 1.3 : armSwing;
      const hx = 2 + Math.sin(nearA) * 34, hy = sh + Math.cos(nearA) * 34;
      line(ctx, 2, sh, hx, hy, 10 * build, top);
      ctx.fillStyle = skin; ell(ctx, hx, hy + 2, 5, 5); ctx.fill();
      // Hals und Kopf
      ctx.fillStyle = shade(skin, -0.15); ctx.fillRect(-3, -124 + bob, 9, 8);
      ctx.fillStyle = skin; ell(ctx, 1, -135 + bob, 13, 15); ctx.fill();
      drawHair(ctx, L, 'side', bob);
      drawFace(ctx, L, 'side', bob, a.talking, t);
      drawHat(ctx, L, 'side', bob);
    } else {
      // Vorder- oder Rückansicht
      if (!isDress) {
        for (let i = 0; i < 2; i++) {
          const off = i === 0 ? -9 * build : 9 * build;
          const len = legLen + (walking ? Math.sin(ph + (i ? Math.PI : 0)) * 6 : 0);
          const col = view === 'front' ? bottom : shade(bottom, -0.15);
          line(ctx, off, hip, off, hip + len - 4, 13 * build, col);
          ctx.fillStyle = L.shoes || '#2a1c10';
          ell(ctx, off, hip + len, 8, 4.5); ctx.fill();
        }
      } else {
        ctx.fillStyle = bottom;
        ctx.beginPath(); ctx.moveTo(-13 * build, hip - 6); ctx.lineTo(13 * build, hip - 6); ctx.lineTo(19 * build, -6); ctx.lineTo(-19 * build, -6); ctx.closePath(); ctx.fill();
        ctx.fillStyle = shade(bottom, -0.2); ctx.beginPath(); ctx.moveTo(-3, hip - 6); ctx.lineTo(3, hip - 6); ctx.lineTo(4, -6); ctx.lineTo(-4, -6); ctx.closePath(); ctx.fill();
        ctx.fillStyle = L.shoes || '#2a1c10';
        ell(ctx, -7 + (walking ? Math.sin(ph) * 2 : 0), -3, 7, 4); ctx.fill();
        ell(ctx, 7 - (walking ? Math.sin(ph) * 2 : 0), -3, 7, 4); ctx.fill();
      }
      // Rumpf
      ctx.fillStyle = view === 'front' ? top : shade(top, -0.12);
      rr(ctx, -19 * build, -120 + bob, 38 * build, 56, 9); ctx.fill();
      if (view === 'front') {
        if (L.topStyle === 'jacket' || L.topStyle === 'coat' || L.topStyle === 'vest') {
          ctx.fillStyle = L.topInner || '#e8e0c8';
          ctx.beginPath(); ctx.moveTo(-8 * build, -120 + bob); ctx.lineTo(8 * build, -120 + bob); ctx.lineTo(0, -92 + bob); ctx.closePath(); ctx.fill();
          ctx.fillStyle = shade(top, -0.25);
          ctx.fillRect(-1, -92 + bob, 2, 26);
        }
        if (L.topStyle === 'uniform') { ctx.fillStyle = '#d4b45a'; for (let k = 0; k < 4; k++) { ell(ctx, 0, -112 + bob + k * 11, 1.8, 1.8); ctx.fill(); } }
        if (L.topStyle === 'shirt' && L.tie) { ctx.fillStyle = L.tie; ctx.beginPath(); ctx.moveTo(-3, -118 + bob); ctx.lineTo(3, -118 + bob); ctx.lineTo(0, -92 + bob); ctx.closePath(); ctx.fill(); }
      }
      if (L.topStyle === 'coat' || L.topStyle === 'robe') { ctx.fillStyle = view === 'front' ? top : shade(top, -0.12); rr(ctx, -19 * build, -70 + bob, 38 * build, 40, 6); ctx.fill(); }
      if (!isDress) { ctx.fillStyle = '#2a1c10'; ctx.fillRect(-19 * build, hip - 4 + bob, 38 * build, 4); }
      // Arme
      const sw = walking ? Math.sin(ph) * 6 : 0;
      const sh = -112 + bob;
      for (let i = 0; i < 2; i++) {
        const side = i === 0 ? -1 : 1;
        const sx = side * 21 * build;
        let hx = sx + side * 3, hy = sh + 40 + (i ? -sw : sw);
        if (a.anim === 'reach') { hx = side * 12; hy = sh + 6; }
        line(ctx, sx, sh, hx, hy, 10 * build, view === 'front' ? top : shade(top, -0.12));
        ctx.fillStyle = skin; ell(ctx, hx, hy + 3, 5, 5); ctx.fill();
      }
      // Hals und Kopf
      ctx.fillStyle = shade(skin, -0.15); ctx.fillRect(-4, -124 + bob, 8, 8);
      ctx.fillStyle = skin; ell(ctx, 0, -135 + bob, 13, 15); ctx.fill();
      drawHair(ctx, L, view, bob);
      if (view === 'front') drawFace(ctx, L, 'front', bob, a.talking, t);
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
