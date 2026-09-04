/* Bildwirkung je Raum: Farbstimmung, Figurenlicht und Partikel. Räume können
   grade, actorTint und particles selbst setzen; sonst greifen die Vorgaben je Kapitelklang. */
(function (ATL) {
  const F = {};
  const GRADES = {
    college: { color: '#ffb366', alpha: 0.10 },
    city: { color: '#4a60c8', alpha: 0.16 },
    egypt: { color: '#ffc058', alpha: 0.16 },
    crete: { color: '#8ac8ff', alpha: 0.08 },
    mesopotamia: { color: '#e8a850', alpha: 0.14 },
    thera: { color: '#ff9868', alpha: 0.12 },
    atlantis: { color: '#22a8b8', alpha: 0.20 },
    map: null, none: null,
  };
  const TINTS = {
    college: 'rgba(255,200,140,0.10)', city: 'rgba(110,130,220,0.20)', egypt: 'rgba(255,200,120,0.14)', crete: 'rgba(255,240,220,0.06)',
    mesopotamia: 'rgba(240,190,120,0.14)', thera: 'rgba(255,170,130,0.14)', atlantis: 'rgba(60,190,210,0.22)', map: null, none: null,
  };
  const PARTICLES = {
    at_outer: { n: 40, color: 'rgba(140,255,230,A)', size: 2, vy: -14, vx: 4, alpha: 0.5, twinkle: true },
    at_middle: { n: 30, color: 'rgba(140,255,230,A)', size: 2, vy: -10, vx: 3, alpha: 0.45, twinkle: true },
    at_prison: { n: 18, color: 'rgba(140,255,230,A)', size: 2, vy: -8, vx: 2, alpha: 0.35, twinkle: true },
    at_inner: { n: 50, color: 'rgba(160,255,240,A)', size: 2, vy: -18, vx: 6, alpha: 0.5, twinkle: true },
    at_escape: { n: 40, color: 'rgba(255,170,90,A)', size: 3, vy: 60, vx: 20, alpha: 0.6 },
    th_descent: { n: 35, color: 'rgba(255,140,60,A)', size: 2, vy: -22, vx: 10, alpha: 0.6, twinkle: true },
    th_cliff: { n: 25, color: 'rgba(230,220,210,A)', size: 2, vy: 12, vx: 26, alpha: 0.35 },
    th_akrotiri: { n: 20, color: 'rgba(230,220,210,A)', size: 2, vy: 10, vx: 22, alpha: 0.3 },
    eg_sais: { n: 40, color: 'rgba(240,210,150,A)', size: 2, vy: 4, vx: 70, alpha: 0.35 },
    me_camp: { n: 45, color: 'rgba(240,210,150,A)', size: 2, vy: 3, vx: 90, alpha: 0.35 },
    me_ziggurat: { n: 50, color: 'rgba(240,210,150,A)', size: 2, vy: 4, vx: 110, alpha: 0.4 },
    eg_temple: { n: 25, color: 'rgba(255,230,190,A)', size: 2, vy: -5, vx: 3, alpha: 0.25, twinkle: true },
    eg_crypt: { n: 25, color: 'rgba(255,230,190,A)', size: 2, vy: -5, vx: 3, alpha: 0.25, twinkle: true },
    cr_bullchamber: { n: 20, color: 'rgba(255,190,110,A)', size: 2, vy: -16, vx: 6, alpha: 0.4, twinkle: true },
    me_abzu: { n: 20, color: 'rgba(180,220,255,A)', size: 2, vy: -6, vx: 2, alpha: 0.3, twinkle: true },
    p_courtyard: { n: 14, color: 'rgba(255,255,240,A)', size: 2, vy: 6, vx: 18, alpha: 0.35 },
    cr_village: { n: 12, color: 'rgba(255,255,240,A)', size: 2, vy: 5, vx: 24, alpha: 0.3 },
  };

  F.gradeFor = (def) => (def.grade !== undefined ? def.grade : GRADES[def.ambient]);
  F.tintFor = (def) => (def.actorTint !== undefined ? def.actorTint : TINTS[def.ambient]);
  F.particlesFor = (def) => (def.particles !== undefined ? def.particles : PARTICLES[def.id]);

  F.drawGrade = function (ctx, def, w, h) {
    const g = F.gradeFor(def);
    if (!g) return;
    ctx.save();
    ctx.globalCompositeOperation = 'soft-light';
    ctx.globalAlpha = g.alpha;
    ctx.fillStyle = g.color;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  };

  // Partikel als Funktion der Zeit, ohne Zustand
  F.drawParticles = function (ctx, def, t, w, h) {
    const p = F.particlesFor(def);
    if (!p) return;
    for (let i = 0; i < p.n; i++) {
      const seed = i * 7919;
      const sx = (seed * 13) % w, sy = (seed * 29) % h;
      const x = ((sx + t * (p.vx * (0.6 + ((i * 37) % 10) / 12)) + Math.sin(t * 0.7 + i) * 14) % (w + 40) + w + 40) % (w + 40) - 20;
      const y = ((sy + t * (p.vy * (0.6 + ((i * 53) % 10) / 12))) % (h + 40) + h + 40) % (h + 40) - 20;
      const a = p.alpha * (p.twinkle ? 0.5 + 0.5 * Math.sin(t * 2.3 + i * 1.7) : 0.7 + 0.3 * Math.sin(t + i));
      ctx.fillStyle = p.color.replace('A', a.toFixed(2));
      const sz = p.size * (0.7 + ((i * 11) % 6) / 8);
      ctx.fillRect(x, y, sz, sz);
    }
  };

  ATL.fx = F;
})(window.ATL);
