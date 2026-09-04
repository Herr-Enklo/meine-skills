/* Ton: generative Musik je Kapitel, Atmosphären je Raum (Meer, Wind, Höhle, Vögel …),
   Schritte je Bodenart und synthetische Geräusche. Alles über WebAudio, ohne Samples. */
(function (ATL) {
  const S = { ctx: null, master: null, musicGain: null, atmosGain: null, muted: false, music: null, musicName: null, atmos: [], atmosKey: null, surface: 'stone', noiseBuf: null, volume: 0.6 };

  function ctx() {
    if (S.ctx) return S.ctx;
    try {
      S.ctx = new (window.AudioContext || window.webkitAudioContext)();
      S.master = S.ctx.createGain(); S.master.gain.value = S.volume; S.master.connect(S.ctx.destination);
      S.musicGain = S.ctx.createGain(); S.musicGain.gain.value = 1; S.musicGain.connect(S.master);
      S.atmosGain = S.ctx.createGain(); S.atmosGain.gain.value = 1; S.atmosGain.connect(S.master);
    } catch (e) { S.ctx = null; }
    return S.ctx;
  }
  function noiseBuffer(c) {
    if (S.noiseBuf) return S.noiseBuf;
    const len = c.sampleRate * 2;
    const buf = c.createBuffer(1, len, c.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; last = (last + 0.02 * w) / 1.02; d[i] = w * 0.6 + last * 6; }
    S.noiseBuf = buf;
    return buf;
  }
  const ready = () => { const c = ctx(); return c && !S.muted && c.state === 'running' ? c : null; };

  S.unlock = function () {
    const c = ctx();
    if (!c) return;
    if (c.state === 'suspended') c.resume().then(() => S.resume());
    else S.resume();
  };
  S.resume = function () {
    if (S.muted) return;
    if (S.musicName && !S.music) S.playMusic(S.musicName);
    if (S.atmosKey && !S.atmos.length) S.playAtmos(S.atmosKey);
  };

  // ---------- Geräusche ----------
  function tone(freq, dur, type, vol, slide, when) {
    const c = ready(); if (!c) return;
    const t0 = when || c.currentTime;
    const o = c.createOscillator(); const g = c.createGain();
    o.type = type || 'sine'; o.frequency.setValueAtTime(freq, t0);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * slide), t0 + dur);
    g.gain.setValueAtTime(vol || 0.2, t0); g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    o.connect(g); g.connect(S.master); o.start(t0); o.stop(t0 + dur + 0.02);
  }
  function noise(dur, vol, filterFreq, type, when, q) {
    const c = ready(); if (!c) return;
    const t0 = when || c.currentTime;
    const src = c.createBufferSource(); src.buffer = noiseBuffer(c);
    src.playbackRate.value = 0.8 + Math.random() * 0.4;
    const f = c.createBiquadFilter(); f.type = type || 'lowpass'; f.frequency.value = filterFreq || 1200; if (q) f.Q.value = q;
    const g = c.createGain(); g.gain.setValueAtTime(vol || 0.3, t0); g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    src.connect(f); f.connect(g); g.connect(S.master); src.start(t0, Math.random()); src.stop(t0 + dur + 0.02);
  }
  const FX = {
    click: () => tone(900, 0.05, 'square', 0.05),
    pickup: () => { tone(660, 0.08, 'triangle', 0.15); setTimeout(() => tone(990, 0.12, 'triangle', 0.15), 70); },
    drop: () => tone(300, 0.15, 'triangle', 0.15, 0.5),
    door: () => { noise(0.35, 0.25, 500); tone(120, 0.3, 'sawtooth', 0.08, 0.7); },
    stone: () => { noise(0.9, 0.45, 220); tone(55, 0.9, 'sawtooth', 0.14, 0.6); },
    water: () => { noise(0.7, 0.22, 900); noise(0.4, 0.1, 2500, 'bandpass'); },
    success: () => { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => tone(f, 0.3, 'triangle', 0.14), i * 110)); },
    fail: () => { tone(220, 0.25, 'sawtooth', 0.1, 0.6); },
    punch: () => { noise(0.12, 0.5, 700); tone(90, 0.1, 'square', 0.15, 0.5); },
    hum: () => { tone(110, 1.4, 'sine', 0.12, 1.5); tone(165, 1.4, 'sine', 0.08, 1.5); },
    glow: () => { [330, 415, 494, 660, 830].forEach((f, i) => setTimeout(() => tone(f, 0.7, 'sine', 0.09), i * 80)); },
    thunder: () => { noise(1.8, 0.6, 160); tone(45, 1.6, 'sawtooth', 0.15, 0.5); },
    bell: () => { tone(1320, 0.9, 'sine', 0.1, 0.98); tone(1320 * 2.76, 0.4, 'sine', 0.03, 0.98); },
    step: () => S.step(),
    whoosh: () => noise(0.3, 0.2, 2500, 'bandpass'),
  };
  S.fx = function (name) { const f = FX[name]; if (f) try { f(); } catch (e) { /* stumm */ } };

  // Schritte je Bodenart
  const STEP = {
    stone: () => { noise(0.06, 0.11, 1100 + Math.random() * 400); tone(160 + Math.random() * 40, 0.04, 'sine', 0.03, 0.6); },
    wood: () => { noise(0.07, 0.1, 600); tone(110 + Math.random() * 30, 0.07, 'triangle', 0.05, 0.6); },
    sand: () => { noise(0.13, 0.07, 320 + Math.random() * 120); },
    grass: () => { noise(0.1, 0.06, 450, 'bandpass'); },
    water: () => { noise(0.14, 0.09, 700, 'bandpass'); noise(0.08, 0.05, 2200, 'bandpass'); },
    metal: () => { noise(0.05, 0.08, 1800); tone(420 + Math.random() * 100, 0.08, 'triangle', 0.03, 0.7); },
  };
  S.step = function () { const f = STEP[S.surface] || STEP.stone; if (ready()) f(); };

  // ---------- Musik ----------
  const SCALES = {
    major: [0, 2, 4, 5, 7, 9, 11], minor: [0, 2, 3, 5, 7, 8, 10], dorian: [0, 2, 3, 5, 7, 9, 10],
    phrygDom: [0, 1, 4, 5, 7, 8, 10], minPenta: [0, 3, 5, 7, 10], harmMinor: [0, 2, 3, 5, 7, 8, 11], lydian: [0, 2, 4, 6, 7, 9, 11],
  };
  // Das Thema des Spiels: (Stufe, Schläge) in Moll
  const THEME = [[0, 1], [0, 0.5], [2, 0.5], [4, 1], [7, 1], [6, 0.5], [4, 0.5], [5, 1], [4, 1], [2, 1], [0, 1], [1, 0.5], [2, 0.5], [0, 2]];
  const MUSIC = {
    title: { root: 220, scale: 'minor', bpm: 80, prog: [0, 5, 3, 4], lead: { type: 'sawtooth', cutoff: 1600, a: 0.04, r: 0.3, vol: 0.06, theme: true }, pad: { type: 'triangle', vol: 0.05, cutoff: 900 }, bass: { type: 'sine', vol: 0.09, pattern: [0, 8] }, density: 0.5 },
    map: { root: 220, scale: 'minor', bpm: 100, prog: [0, 5, 3, 4], lead: { type: 'sawtooth', cutoff: 1800, a: 0.02, r: 0.2, vol: 0.055, theme: true }, pad: { type: 'triangle', vol: 0.04, cutoff: 900 }, bass: { type: 'triangle', vol: 0.08, pattern: [0, 6, 8, 14] }, perc: 'brush', density: 0.5 },
    college: { root: 220, scale: 'major', bpm: 76, prog: [0, 5, 3, 4, 0, 3, 1, 4], lead: { type: 'triangle', a: 0.02, r: 0.3, vol: 0.075 }, pad: { type: 'sine', vol: 0.045 }, bass: { type: 'sine', vol: 0.07, pattern: [0, 8, 12] }, density: 0.5 },
    city: { root: 196, scale: 'dorian', bpm: 98, prog: [0, 3, 0, 4], lead: { type: 'sawtooth', cutoff: 1400, a: 0.01, r: 0.2, vol: 0.05 }, pad: { type: 'sawtooth', cutoff: 600, vol: 0.02 }, bass: { type: 'triangle', vol: 0.09, pattern: [0, 3, 6, 8, 11, 14] }, perc: 'brush', density: 0.6, swing: 0.14 },
    egypt: { root: 233.1, scale: 'phrygDom', bpm: 86, prog: [0, 1, 0, 4], lead: { type: 'triangle', a: 0.005, r: 0.5, vol: 0.085, pluck: true }, pad: { type: 'sine', vol: 0.04 }, bass: { type: 'sine', vol: 0.08, pattern: [0, 8] }, perc: 'frame', density: 0.55 },
    crete: { root: 261.6, scale: 'dorian', bpm: 104, prog: [0, 6, 3, 4], lead: { type: 'sine', a: 0.04, r: 0.2, vol: 0.09, vibrato: true }, pad: { type: 'triangle', vol: 0.035 }, bass: { type: 'triangle', vol: 0.07, pattern: [0, 8, 10] }, density: 0.65 },
    mesopotamia: { root: 146.8, scale: 'minPenta', bpm: 64, prog: [0, 3, 0, 4], lead: { type: 'triangle', a: 0.05, r: 0.5, vol: 0.07 }, pad: { type: 'sawtooth', cutoff: 380, vol: 0.03 }, bass: { type: 'sine', vol: 0.1, pattern: [0] }, perc: 'deep', density: 0.4 },
    thera: { root: 174.6, scale: 'harmMinor', bpm: 72, prog: [0, 5, 3, 4], lead: { type: 'sine', a: 0.005, r: 1.0, vol: 0.07, bell: true }, pad: { type: 'triangle', vol: 0.04 }, bass: { type: 'sine', vol: 0.08, pattern: [0, 8] }, density: 0.35 },
    atlantis: { root: 130.8, scale: 'lydian', bpm: 58, prog: [0, 1, 4, 3], lead: { type: 'sine', a: 0.12, r: 0.9, vol: 0.06, oct: 2 }, pad: { type: 'sawtooth', cutoff: 340, vol: 0.035, detune: 9 }, bass: { type: 'sine', vol: 0.1, pattern: [0], sub: true }, density: 0.3 },
    none: null,
  };
  const freqOf = (def, deg) => { const sc = SCALES[def.scale]; const n = sc.length; const oct = Math.floor(deg / n); const st = sc[((deg % n) + n) % n] + 12 * oct; return def.root * Math.pow(2, st / 12); };

  function voice(c, out, freq, t0, dur, cfg, vol) {
    const o = c.createOscillator(); o.type = cfg.type || 'sine'; o.frequency.setValueAtTime(freq, t0);
    if (cfg.detune) o.detune.value = (Math.random() - 0.5) * cfg.detune * 2;
    let node = o;
    if (cfg.cutoff) { const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = cfg.cutoff; f.Q.value = 0.7; o.connect(f); node = f; }
    if (cfg.vibrato) { const l = c.createOscillator(); l.frequency.value = 5.5; const lg = c.createGain(); lg.gain.value = freq * 0.006; l.connect(lg); lg.connect(o.frequency); l.start(t0); l.stop(t0 + dur + 1); }
    const g = c.createGain();
    const a = cfg.a || 0.02, r = cfg.r || 0.3;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + a);
    if (cfg.pluck || cfg.bell) g.gain.exponentialRampToValueAtTime(Math.max(0.0001, vol * 0.25), t0 + Math.max(a + 0.05, dur * 0.6));
    g.gain.setTargetAtTime(0.0001, t0 + dur, r / 4);
    node.connect(g); g.connect(out);
    o.start(t0); o.stop(t0 + dur + r + 0.2);
    if (cfg.bell) { const o2 = c.createOscillator(); o2.frequency.value = freq * 2.76; const g2 = c.createGain(); g2.gain.setValueAtTime(vol * 0.18, t0); g2.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.5); o2.connect(g2); g2.connect(out); o2.start(t0); o2.stop(t0 + 0.6); }
    return g;
  }

  S.playMusic = function (name) {
    S.musicName = name;
    const c = ready(); if (!c) return;
    const def = MUSIC[name];
    S.stopMusic(false);
    if (!def) return;
    const bus = c.createGain(); bus.gain.setValueAtTime(0.0001, c.currentTime); bus.gain.linearRampToValueAtTime(1, c.currentTime + 3);
    bus.connect(S.musicGain);
    const stepDur = 60 / def.bpm / 4;
    const m = { def, bus, step: 0, next: c.currentTime + 0.15, stepDur, deg: 7, hold: 0, pad: [], themeIdx: -1, themeRest: 0, timer: null, lastQuote: -100 };
    const chordDegs = (bar) => { const d = def.prog[Math.floor(bar / 2) % def.prog.length]; return [d, d + 2, d + 4]; };
    const schedule = () => {
      while (m.next < c.currentTime + 0.25) {
        const step = m.step, bar = Math.floor(step / 16), inBar = step % 16;
        let t0 = m.next;
        if (def.swing && step % 2 === 1) t0 += stepDur * def.swing;
        const chord = chordDegs(bar);
        // Flächen: alle zwei Takte neu
        if (inBar === 0 && bar % 2 === 0) {
          m.pad.forEach((g) => { g.gain.cancelScheduledValues(t0); g.gain.setTargetAtTime(0.0001, t0, 0.6); });
          m.pad = chord.map((d, i) => voice(c, bus, freqOf(def, d - (i === 0 ? 7 : 0)), t0, stepDur * 32 - 0.5, Object.assign({ a: 1.2, r: 1.5 }, def.pad), def.pad.vol));
        }
        // Bass
        if (def.bass && def.bass.pattern.includes(inBar)) {
          const bd = chord[0] - 14 + (def.bass.sub ? -7 : 0) + (inBar % 8 === 6 ? 4 : 0);
          voice(c, bus, freqOf(def, bd), t0, stepDur * (def.bass.pattern.length > 2 ? 2.5 : 6), { type: def.bass.type, a: 0.01, r: 0.15 }, def.bass.vol);
        }
        // Schlagwerk
        if (def.perc === 'brush' && inBar % 4 === 2) noise(0.04, 0.035, 5000, 'highpass', t0);
        if (def.perc === 'frame') { if (inBar === 0 || inBar === 8) tone(75, 0.14, 'sine', 0.13, 0.6, t0); if (inBar === 6 || inBar === 11 || inBar === 14) noise(0.05, 0.06, 2600, 'bandpass', t0, 2); }
        if (def.perc === 'deep') { if (inBar === 0) { tone(52, 0.5, 'sine', 0.2, 0.7, t0); noise(0.2, 0.08, 200, 'lowpass', t0); } if (inBar === 8) tone(52, 0.3, 'sine', 0.08, 0.7, t0); }
        // Melodie
        if (step % 2 === 0) {
          const oct = (def.lead.oct || 1) * 7;
          if (def.lead.theme || (inBar === 0 && bar % 8 === 4)) {
            if (m.themeIdx < 0 && m.themeRest <= 0 && (def.lead.theme ? inBar === 0 : true)) { m.themeIdx = 0; m.hold = 0; m.quoteLen = def.lead.theme ? THEME.length : 5; }
          }
          if (m.hold > 0) m.hold -= 2;
          else if (m.themeIdx >= 0 && m.themeIdx < m.quoteLen) {
            const [d, beats] = THEME[m.themeIdx++];
            const len = beats * 4 * stepDur;
            voice(c, bus, freqOf(def, d + oct), t0, len * 0.95, def.lead, def.lead.vol);
            m.hold = beats * 4;
            m.deg = d + oct;
            if (m.themeIdx >= m.quoteLen) { m.themeIdx = -1; m.themeRest = def.lead.theme ? 16 : 0; }
          } else if (m.themeRest > 0) { m.themeRest -= 2; }
          else if (Math.random() < def.density * (inBar % 4 === 0 ? 1.2 : 0.8) && !(bar % 8 === 7 && inBar >= 8)) {
            let target;
            const rel = m.deg - oct;
            if (inBar % 8 === 0) { const opts = chord.map((d) => d + (rel > 10 ? 7 : rel < 3 ? 0 : (Math.random() < 0.5 ? 7 : 0))); target = opts[Math.floor(Math.random() * opts.length)] + oct; }
            else target = m.deg + (Math.random() < 0.5 ? -1 : 1) * (1 + Math.floor(Math.random() * 2.2));
            const lo = oct + 2, hi = oct + 13;
            if (target < lo) target = lo + 2; if (target > hi) target = hi - 2;
            const holds = [2, 2, 2, 4, 4, 4, 6, 8];
            m.hold = holds[Math.floor(Math.random() * holds.length)];
            voice(c, bus, freqOf(def, target), t0, m.hold * stepDur * 0.9, def.lead, def.lead.vol * (0.8 + Math.random() * 0.3));
            m.deg = target;
          }
        }
        m.step++;
        m.next += stepDur;
      }
    };
    m.timer = setInterval(() => { try { schedule(); } catch (e) { clearInterval(m.timer); console.error('Musik angehalten', e); } }, 60);
    S.music = m;
  };
  S.stopMusic = function (clearName) {
    if (clearName !== false) S.musicName = null;
    const m = S.music; if (!m) return;
    S.music = null;
    clearInterval(m.timer);
    try { const c = S.ctx; m.bus.gain.cancelScheduledValues(c.currentTime); m.bus.gain.setTargetAtTime(0.0001, c.currentTime, 0.5); setTimeout(() => { try { m.bus.disconnect(); } catch (e) { /* weg */ } }, 2500); } catch (e) { /* ignorieren */ }
  };
  // Kompatibel zur alten Schnittstelle: playAmbient wählt die Musik des Kapitels
  S.playAmbient = function (name) { if (name === S.musicName && S.music) return; S.playMusic(name); };
  S.stopAmbient = function (clearName) { S.stopMusic(clearName); };

  // ---------- Atmosphären ----------
  function loopNoise(c, out, type, freq, q, vol) {
    const src = c.createBufferSource(); src.buffer = noiseBuffer(c); src.loop = true;
    const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q || 0.7;
    const g = c.createGain(); g.gain.value = vol;
    src.connect(f); f.connect(g); g.connect(out); src.start();
    return { src, f, g };
  }
  function lfo(c, target, freq, amount, base) {
    const l = c.createOscillator(); l.frequency.value = freq; const lg = c.createGain(); lg.gain.value = amount;
    l.connect(lg); lg.connect(target); if (base !== undefined) target.value = base; l.start();
    return l;
  }
  const ATMOS = {
    sea: (c, out) => { const n = loopNoise(c, out, 'lowpass', 420, 0.5, 0.16); const l = lfo(c, n.g.gain, 0.09, 0.09, 0.14); const l2 = lfo(c, n.f.frequency, 0.05, 220, 420); return () => { n.src.stop(); l.stop(); l2.stop(); }; },
    wind: (c, out) => { const n = loopNoise(c, out, 'bandpass', 700, 0.9, 0.08); const l = lfo(c, n.f.frequency, 0.07, 350, 700); const l2 = lfo(c, n.g.gain, 0.13, 0.05, 0.07); return () => { n.src.stop(); l.stop(); l2.stop(); }; },
    cave: (c, out) => {
      const n = loopNoise(c, out, 'lowpass', 160, 0.5, 0.05);
      let alive = true;
      const drip = () => { if (!alive) return; const t0 = c.currentTime; const f = 1200 + Math.random() * 1800; [0, 0.18, 0.36].forEach((d, i) => { const o = c.createOscillator(); o.frequency.setValueAtTime(f, t0 + d); o.frequency.exponentialRampToValueAtTime(f * 0.5, t0 + d + 0.08); const g = c.createGain(); g.gain.setValueAtTime(0.05 / (i + 1), t0 + d); g.gain.exponentialRampToValueAtTime(0.0001, t0 + d + 0.25); o.connect(g); g.connect(out); o.start(t0 + d); o.stop(t0 + d + 0.3); }); setTimeout(drip, 2500 + Math.random() * 7000); };
      setTimeout(drip, 1500);
      return () => { alive = false; n.src.stop(); };
    },
    birds: (c, out) => {
      let alive = true;
      const chirp = () => { if (!alive) return; const t0 = c.currentTime; const base = 2200 + Math.random() * 1800; const n = 2 + Math.floor(Math.random() * 3); for (let i = 0; i < n; i++) { const o = c.createOscillator(); o.frequency.setValueAtTime(base, t0 + i * 0.12); o.frequency.exponentialRampToValueAtTime(base * (1.3 + Math.random() * 0.4), t0 + i * 0.12 + 0.06); o.frequency.exponentialRampToValueAtTime(base * 0.9, t0 + i * 0.12 + 0.1); const g = c.createGain(); g.gain.setValueAtTime(0.0001, t0 + i * 0.12); g.gain.linearRampToValueAtTime(0.03, t0 + i * 0.12 + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t0 + i * 0.12 + 0.11); o.connect(g); g.connect(out); o.start(t0 + i * 0.12); o.stop(t0 + i * 0.12 + 0.13); } setTimeout(chirp, 1500 + Math.random() * 6000); };
      setTimeout(chirp, 800);
      return () => { alive = false; };
    },
    city: (c, out) => { const n = loopNoise(c, out, 'lowpass', 220, 0.6, 0.07); const l = lfo(c, n.g.gain, 0.2, 0.03, 0.06); let alive = true; const horn = () => { if (!alive) return; if (Math.random() < 0.5) { const f = 300 + Math.random() * 200; tone(f, 0.35, 'sawtooth', 0.02); tone(f * 1.25, 0.35, 'sawtooth', 0.015); } setTimeout(horn, 6000 + Math.random() * 12000); }; setTimeout(horn, 4000); return () => { alive = false; n.src.stop(); l.stop(); }; },
    market: (c, out) => { const n = loopNoise(c, out, 'bandpass', 900, 1.2, 0.05); const l = lfo(c, n.g.gain, 3.1, 0.02, 0.05); const l2 = lfo(c, n.f.frequency, 0.4, 300, 900); return () => { n.src.stop(); l.stop(); l2.stop(); }; },
    fire: (c, out) => { const n = loopNoise(c, out, 'bandpass', 2400, 1.5, 0.035); const l = lfo(c, n.g.gain, 7, 0.02, 0.035); const r = loopNoise(c, out, 'lowpass', 120, 0.5, 0.06); return () => { n.src.stop(); l.stop(); r.src.stop(); }; },
    lava: (c, out) => { const r = loopNoise(c, out, 'lowpass', 90, 0.5, 0.12); const l = lfo(c, r.g.gain, 0.15, 0.05, 0.1); const o = c.createOscillator(); o.frequency.value = 38; const g = c.createGain(); g.gain.value = 0.05; o.connect(g); g.connect(out); o.start(); return () => { r.src.stop(); l.stop(); o.stop(); }; },
    machine: (c, out) => { const o = c.createOscillator(); o.frequency.value = 55; const o2 = c.createOscillator(); o2.frequency.value = 82.5; const g = c.createGain(); g.gain.value = 0.045; o.connect(g); o2.connect(g); g.connect(out); const l = lfo(c, g.gain, 0.5, 0.02, 0.045); const w = loopNoise(c, out, 'lowpass', 300, 0.5, 0.04); const l2 = lfo(c, w.g.gain, 0.11, 0.02, 0.04); o.start(); o2.start(); return () => { o.stop(); o2.stop(); l.stop(); w.src.stop(); l2.stop(); }; },
    water: (c, out) => { const n = loopNoise(c, out, 'bandpass', 600, 0.8, 0.06); const l = lfo(c, n.f.frequency, 0.3, 250, 600); const l2 = lfo(c, n.g.gain, 0.7, 0.025, 0.06); return () => { n.src.stop(); l.stop(); l2.stop(); }; },
    room: (c, out) => { const n = loopNoise(c, out, 'lowpass', 110, 0.5, 0.025); return () => n.src.stop(); },
  };
  // Zuordnung Raum → Atmosphären und Bodenart (Räume können atmos/surface auch selbst setzen)
  const ROOMS = {
    title: ['sea'], map: [],
    p_office: ['room', 'birds'], p_hall: ['room'], p_attic: ['room'], p_courtyard: ['birds'],
    ny_street: ['city'], ny_alley: ['city'], ny_dressing: ['room'], ny_stage: ['room'],
    eg_harbor: ['sea', 'birds'], eg_bazaar: ['market'], eg_library: ['room'], eg_sais: ['wind'], eg_temple: ['cave'], eg_crypt: ['cave'],
    cr_village: ['sea', 'birds'], cr_taverna: ['room'], cr_knossos: ['wind', 'birds'], cr_crypt: ['cave'], cr_bullchamber: ['cave', 'fire'],
    me_camp: ['wind'], me_ziggurat: ['wind'], me_archive: ['cave'], me_abzu: ['cave', 'water'],
    th_harbor: ['sea'], th_cliff: ['sea', 'wind'], th_akrotiri: ['wind'], th_descent: ['lava'],
    at_outer: ['machine', 'water'], at_middle: ['machine'], at_prison: ['machine'], at_inner: ['machine'], at_escape: ['lava', 'water'], at_epilog: ['sea'],
  };
  const SURFACES = {
    p_office: 'wood', p_attic: 'wood', p_courtyard: 'grass', ny_dressing: 'wood', ny_stage: 'wood', cr_taverna: 'wood',
    eg_sais: 'sand', eg_bazaar: 'sand', me_camp: 'sand', me_ziggurat: 'sand', th_cliff: 'sand', cr_village: 'sand', cr_knossos: 'grass',
    me_abzu: 'water', at_outer: 'metal', at_inner: 'metal', at_escape: 'water',
  };
  S.playAtmos = function (list) {
    S.atmosKey = list;
    const c = ready(); if (!c) return;
    S.stopAtmos(false);
    for (const name of list || []) {
      const gen = ATMOS[name]; if (!gen) continue;
      const g = c.createGain(); g.gain.setValueAtTime(0.0001, c.currentTime); g.gain.linearRampToValueAtTime(1, c.currentTime + 2);
      g.connect(S.atmosGain);
      try { const stop = gen(c, g); S.atmos.push({ g, stop }); } catch (e) { /* ignorieren */ }
    }
  };
  S.stopAtmos = function (clearKey) {
    if (clearKey !== false) S.atmosKey = null;
    const c = S.ctx;
    for (const a of S.atmos) { try { a.g.gain.cancelScheduledValues(c.currentTime); a.g.gain.setTargetAtTime(0.0001, c.currentTime, 0.4); setTimeout(() => { try { a.stop(); a.g.disconnect(); } catch (e) { /* weg */ } }, 1800); } catch (e) { /* ignorieren */ } }
    S.atmos = [];
  };
  S.setRoom = function (def) {
    const list = def.atmos !== undefined ? def.atmos : (ROOMS[def.id] || []);
    S.surface = def.surface || SURFACES[def.id] || 'stone';
    const key = JSON.stringify(list);
    if (key !== JSON.stringify(S.atmosKey)) S.playAtmos(list);
  };

  S.toggleMute = function () {
    S.muted = !S.muted;
    if (S.muted) { S.stopMusic(false); S.stopAtmos(false); }
    else S.resume();
    return S.muted;
  };

  ATL.audio = S;
})(window.ATL);
