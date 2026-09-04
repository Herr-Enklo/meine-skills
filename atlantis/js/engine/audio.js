/* Ton: generative Musik je Kapitel, Atmosphären je Raum (Meer, Wind, Höhle, Vögel …),
   Schritte je Bodenart und synthetische Geräusche. Alles über WebAudio, ohne Samples. */
(function (ATL) {
  const S = { ctx: null, master: null, musicGain: null, atmosGain: null, muted: false, music: null, musicName: null, atmos: [], atmosKey: null, surface: 'stone', noiseBuf: null, volume: 0.5 };

  function ctx() {
    if (S.ctx) return S.ctx;
    try {
      S.ctx = new (window.AudioContext || window.webkitAudioContext)();
      S.master = S.ctx.createGain(); S.master.gain.value = S.volume; S.master.connect(S.ctx.destination);
      S.musicGain = S.ctx.createGain(); S.musicGain.gain.value = 0.85;
      const lp = S.ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2000; lp.Q.value = 0.4;
      const comp = S.ctx.createDynamicsCompressor(); comp.threshold.value = -24; comp.knee.value = 20; comp.ratio.value = 4; comp.attack.value = 0.02; comp.release.value = 0.3;
      S.musicGain.connect(lp); lp.connect(comp); comp.connect(S.master);
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
    click: () => tone(600, 0.05, 'triangle', 0.05),
    pickup: () => { tone(520, 0.08, 'triangle', 0.12); setTimeout(() => tone(780, 0.12, 'triangle', 0.12), 70); },
    drop: () => tone(300, 0.15, 'triangle', 0.15, 0.5),
    door: () => { noise(0.35, 0.25, 500); tone(120, 0.3, 'sawtooth', 0.08, 0.7); },
    stone: () => { noise(0.9, 0.45, 220); tone(55, 0.9, 'sawtooth', 0.14, 0.6); },
    water: () => { noise(0.7, 0.22, 900); noise(0.4, 0.1, 2500, 'bandpass'); },
    success: () => { [392, 494, 587, 784].forEach((f, i) => setTimeout(() => tone(f, 0.3, 'triangle', 0.11), i * 110)); },
    fail: () => { tone(220, 0.25, 'sawtooth', 0.1, 0.6); },
    punch: () => { noise(0.12, 0.5, 700); tone(90, 0.1, 'square', 0.15, 0.5); },
    hum: () => { tone(110, 1.4, 'sine', 0.12, 1.5); tone(165, 1.4, 'sine', 0.08, 1.5); },
    glow: () => { [262, 330, 392, 523, 660].forEach((f, i) => setTimeout(() => tone(f, 0.7, 'sine', 0.08), i * 80)); },
    thunder: () => { noise(1.8, 0.6, 160); tone(45, 1.6, 'sawtooth', 0.15, 0.5); },
    bell: () => { tone(880, 0.9, 'sine', 0.09, 0.98); tone(1320, 0.4, 'sine', 0.025, 0.98); },
    step: () => S.step(),
    whoosh: () => noise(0.3, 0.15, 1600, 'bandpass'),
  };
  S.fx = function (name) { const f = FX[name]; if (f) try { f(); } catch (e) { /* stumm */ } };

  // Schritte je Bodenart
  const STEP = {
    stone: () => { noise(0.06, 0.07, 800 + Math.random() * 300); tone(140 + Math.random() * 40, 0.04, 'sine', 0.03, 0.6); },
    wood: () => { noise(0.07, 0.1, 600); tone(110 + Math.random() * 30, 0.07, 'triangle', 0.05, 0.6); },
    sand: () => { noise(0.13, 0.07, 320 + Math.random() * 120); },
    grass: () => { noise(0.1, 0.06, 450, 'bandpass'); },
    water: () => { noise(0.14, 0.09, 700, 'bandpass'); noise(0.08, 0.05, 2200, 'bandpass'); },
    metal: () => { noise(0.05, 0.06, 1200); tone(300 + Math.random() * 80, 0.08, 'triangle', 0.025, 0.7); },
  };
  S.step = function () { const f = STEP[S.surface] || STEP.stone; if (ready()) f(); };

  // ---------- Musik ----------
  const SCALES = {
    major: [0, 2, 4, 5, 7, 9, 11], minor: [0, 2, 3, 5, 7, 8, 10], dorian: [0, 2, 3, 5, 7, 9, 10],
    phrygDom: [0, 1, 4, 5, 7, 8, 10], minPenta: [0, 3, 5, 7, 10], harmMinor: [0, 2, 3, 5, 7, 8, 11], lydian: [0, 2, 4, 6, 7, 9, 11],
  };
  // Phrasen als (Stufe, Schläge); T ist das Thema des Spiels
  const T = [[0, 1], [0, 0.5], [2, 0.5], [4, 1], [7, 1], [6, 0.5], [4, 0.5], [5, 1], [4, 1], [2, 1], [0, 1], [1, 0.5], [2, 0.5], [0, 2]];
  const MUSIC = {
    title: { root: 220, scale: 'minor', bpm: 78, prog: [0, 5, 3, 4], order: ['T', 'B', 'T', 'A'], arp: true, pad: { vol: 0.045, cutoff: 700 }, bass: { vol: 0.08, pattern: [0, 8] }, lead: { vol: 0.06, cutoff: 1100 },
      phrases: { A: [[4, 1], [5, 1], [4, 0.5], [2, 0.5], [0, 1], [2, 1], [4, 2], [-1, 2]], B: [[7, 1.5], [6, 0.5], [5, 1], [4, 1], [2, 1], [4, 1], [0, 2]] } },
    map: { root: 220, scale: 'minor', bpm: 92, prog: [0, 5, 3, 4], order: ['T', 'A', 'T', 'B'], arp: true, pad: { vol: 0.04, cutoff: 700 }, bass: { vol: 0.08, pattern: [0, 6, 8] }, lead: { vol: 0.055, cutoff: 1100 },
      phrases: { A: [[4, 1], [5, 1], [4, 0.5], [2, 0.5], [0, 1], [2, 1], [4, 2], [-1, 2]], B: [[7, 1.5], [6, 0.5], [5, 1], [4, 1], [2, 1], [4, 1], [0, 2]] } },
    college: { root: 220, scale: 'major', bpm: 74, prog: [0, 5, 3, 4, 0, 3, 1, 4], order: ['A', 'B', 'A', 'C', 'T5'], arp: true, pad: { vol: 0.04 }, bass: { vol: 0.07, pattern: [0, 8, 12] }, lead: { vol: 0.055, cutoff: 1100 },
      phrases: { A: [[4, 1], [5, 0.5], [4, 0.5], [2, 1], [0, 1], [2, 1], [4, 1], [7, 2]], B: [[6, 1], [5, 0.5], [4, 0.5], [5, 1], [4, 1], [2, 1], [1, 1], [0, 2]], C: [[2, 1], [4, 1], [6, 1], [7, 1], [6, 1], [4, 1], [5, 2]] } },
    city: { root: 196, scale: 'dorian', bpm: 90, prog: [0, 3, 0, 4], order: ['A', 'B', 'A', 'T5', 'C'], pad: { vol: 0.03, cutoff: 500 }, bass: { vol: 0.085, pattern: [0, 3, 8, 11] }, perc: 'brush', swing: 0.14, lead: { vol: 0.05, cutoff: 950 },
      phrases: { A: [[0, 1.5], [2, 0.5], [3, 1], [4, 1], [7, 1], [6, 1], [4, 2]], B: [[5, 1], [4, 0.5], [3, 0.5], [2, 1], [0, 1], [-1, 1], [0, 3]], C: [[4, 0.5], [5, 0.5], [7, 2], [6, 1], [5, 1], [4, 1], [2, 2]] } },
    egypt: { root: 233.1, scale: 'phrygDom', bpm: 80, prog: [0, 1, 0, 4], order: ['A', 'B', 'A', 'C', 'T5'], pad: { vol: 0.04 }, bass: { vol: 0.08, pattern: [0, 8] }, perc: 'frame', lead: { vol: 0.055, cutoff: 1000 },
      phrases: { A: [[0, 1], [1, 1], [3, 1], [4, 1], [3, 0.5], [1, 0.5], [0, 2]], B: [[4, 1], [5, 0.5], [4, 0.5], [3, 1], [1, 1], [0, 1], [1, 1], [0, 2]], C: [[7, 1], [6, 1], [5, 1], [4, 1], [3, 1], [4, 1], [1, 2]] } },
    crete: { root: 261.6, scale: 'dorian', bpm: 96, prog: [0, 6, 3, 4], order: ['A', 'A', 'B', 'C', 'T5'], arp: true, pad: { vol: 0.035, cutoff: 900 }, bass: { vol: 0.07, pattern: [0, 8, 10] }, lead: { vol: 0.06, cutoff: 1200 },
      phrases: { A: [[0, 0.5], [2, 0.5], [4, 1], [5, 0.5], [4, 0.5], [2, 1], [0, 1], [2, 1], [4, 2]], B: [[7, 1], [6, 0.5], [5, 0.5], [4, 1], [2, 1], [3, 1], [2, 1], [0, 2]], C: [[4, 1], [6, 1], [7, 1], [6, 0.5], [4, 0.5], [2, 1], [4, 1], [2, 2]] } },
    mesopotamia: { root: 146.8, scale: 'minPenta', bpm: 62, prog: [0, 3, 0, 4], order: ['A', 'B', 'A', 'T5'], pad: { vol: 0.035, cutoff: 320 }, bass: { vol: 0.1, pattern: [0] }, perc: 'deep', lead: { vol: 0.055, cutoff: 900, oct: 1 },
      phrases: { A: [[0, 2], [2, 1], [3, 1], [4, 2], [3, 1], [2, 1]], B: [[5, 2], [4, 1], [3, 1], [2, 2], [0, 2]] } },
    thera: { root: 174.6, scale: 'harmMinor', bpm: 70, prog: [0, 5, 3, 4], order: ['A', 'B', 'A', 'T5', 'C'], pad: { vol: 0.04, cutoff: 800 }, bass: { vol: 0.08, pattern: [0, 8] }, lead: { vol: 0.055, cutoff: 1000, oct: 1 },
      phrases: { A: [[4, 1], [5, 1], [4, 1], [2, 1], [0, 1], [1, 1], [0, 2]], B: [[7, 1], [6, 1], [7, 1], [4, 1], [5, 0.5], [4, 0.5], [2, 1], [0, 2]], C: [[2, 1.5], [4, 0.5], [5, 1], [4, 1], [2, 1], [1, 1], [0, 2]] } },
    atlantis: { root: 130.8, scale: 'lydian', bpm: 56, prog: [0, 1, 4, 3], order: ['A', 'B', 'A', 'T5'], pad: { vol: 0.035, cutoff: 320, detune: 9 }, bass: { vol: 0.1, pattern: [0], sub: true }, lead: { vol: 0.05, cutoff: 900, oct: 1, a: 0.35 },
      phrases: { A: [[0, 2], [4, 2], [6, 1], [7, 1], [4, 2]], B: [[2, 2], [3, 1], [4, 1], [2, 2], [0, 2]] } },
    none: null,
  };
  const freqOf = (def, deg) => { const sc = SCALES[def.scale]; const n = sc.length; const oct = Math.floor(deg / n); const st = sc[((deg % n) + n) % n] + 12 * oct; return def.root * Math.pow(2, st / 12); };

  // Hall aus erzeugter Impulsantwort
  function reverb(c) {
    const len = Math.floor(c.sampleRate * 2.4);
    const buf = c.createBuffer(2, len, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = buf.getChannelData(ch); let last = 0; for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; last = (last * 3 + w) / 4; d[i] = last * Math.pow(1 - i / len, 2.6); } }
    const cv = c.createConvolver(); cv.buffer = buf;
    return cv;
  }

  // Weiche Stimme: zwei leicht verstimmte Oszillatoren, Tiefpass, langsamer Einsatz, langes Ausklingen
  function voice(c, out, freq, t0, dur, cfg, vol) {
    const g = c.createGain();
    const a = cfg.a || 0.14, r = cfg.r || 0.6;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + a);
    g.gain.setValueAtTime(vol, t0 + Math.max(a, dur));
    g.gain.setTargetAtTime(0.0001, t0 + Math.max(a, dur), r / 3);
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = Math.min(cfg.cutoff || 1000, Math.max(500, freq * 3)); f.Q.value = 0.4;
    f.connect(g); g.connect(out);
    const oscs = [];
    const n = cfg.single ? 1 : 2;
    for (let i = 0; i < n; i++) {
      const o = c.createOscillator(); o.type = cfg.type || (i ? 'sine' : 'triangle'); o.frequency.setValueAtTime(freq, t0);
      o.detune.value = (i ? 5 : -5) + (cfg.detune ? (Math.random() - 0.5) * cfg.detune * 2 : 0);
      if (cfg.vibrato !== false && !cfg.single) { const l = c.createOscillator(); l.frequency.value = 4.6; const lg = c.createGain(); lg.gain.setValueAtTime(0, t0); lg.gain.linearRampToValueAtTime(freq * 0.004, t0 + 0.5); l.connect(lg); lg.connect(o.frequency); l.start(t0); l.stop(t0 + dur + r + 0.5); }
      o.connect(f); o.start(t0); o.stop(t0 + Math.max(a, dur) + r + 0.4); oscs.push(o);
    }
    return g;
  }

  S.playMusic = function (name) {
    S.musicName = name;
    const c = ready(); if (!c) return;
    const def = MUSIC[name];
    S.stopMusic(false);
    if (!def) return;
    const bus = c.createGain(); bus.gain.setValueAtTime(0.0001, c.currentTime); bus.gain.linearRampToValueAtTime(1, c.currentTime + 3);
    const dry = c.createGain(); dry.gain.value = 0.7; bus.connect(dry); dry.connect(S.musicGain);
    const rv = reverb(c); const wet = c.createGain(); wet.gain.value = 0.45; bus.connect(rv); rv.connect(wet); wet.connect(S.musicGain);
    const stepDur = 60 / def.bpm / 4;
    const m = { def, bus, rv, step: 0, next: c.currentTime + 0.15, stepDur, pad: [], queue: [], orderIdx: 0, restSteps: 0, timer: null, arpIdx: 0 };
    const chordDegs = (bar) => { const d = def.prog[Math.floor(bar / 2) % def.prog.length]; return [d, d + 2, d + 4]; };
    const leadOct = (def.lead.oct || 0) * 7;
    const schedule = () => {
      while (m.next < c.currentTime + 0.3) {
        const step = m.step, bar = Math.floor(step / 16), inBar = step % 16;
        let t0 = m.next;
        if (def.swing && step % 2 === 1) t0 += stepDur * def.swing;
        const chord = chordDegs(bar);
        // Flächen: alle zwei Takte neu, langsam ein- und ausblenden
        if (inBar === 0 && bar % 2 === 0) {
          m.pad.forEach((g) => { g.gain.cancelScheduledValues(t0); g.gain.setTargetAtTime(0.0001, t0, 0.8); });
          m.pad = chord.map((d, i) => voice(c, bus, freqOf(def, d - (i === 0 ? 7 : 0)), t0, stepDur * 32 - 0.8, { type: i === 1 ? 'sine' : 'triangle', a: 1.6, r: 2.0, cutoff: def.pad.cutoff || 600, detune: def.pad.detune, vibrato: false }, def.pad.vol));
        }
        // Bass
        if (def.bass && def.bass.pattern.includes(inBar)) {
          const bd = chord[0] - 14 + (def.bass.sub ? -7 : 0) + (inBar % 8 === 6 ? 4 : 0);
          voice(c, bus, freqOf(def, bd), t0, stepDur * (def.bass.pattern.length > 2 ? 3 : 7), { type: 'sine', single: true, a: 0.05, r: 0.3, cutoff: 400 }, def.bass.vol);
        }
        // Harfenbegleitung: Akkordtöne auf Achteln
        if (def.arp && step % 2 === 0) {
          const pat = [0, 1, 2, 3, 2, 1];
          const k = pat[m.arpIdx++ % pat.length];
          const d = k < 3 ? chord[k] : chord[0] + 7;
          voice(c, bus, freqOf(def, d), t0, stepDur * 1.5, { type: 'sine', single: true, a: 0.015, r: 0.6, cutoff: 1400 }, 0.02);
        }
        // Schlagwerk, sehr zurückhaltend
        if (def.perc === 'brush' && inBar % 4 === 2) noise(0.05, 0.012, 2600, 'bandpass', t0, 0.8);
        if (def.perc === 'frame') { if (inBar === 0 || inBar === 8) tone(70, 0.16, 'sine', 0.1, 0.6, t0); if (inBar === 6 || inBar === 11 || inBar === 14) noise(0.05, 0.02, 1200, 'bandpass', t0, 1.5); }
        if (def.perc === 'deep') { if (inBar === 0) { tone(50, 0.5, 'sine', 0.16, 0.7, t0); } if (inBar === 8) tone(50, 0.3, 'sine', 0.07, 0.7, t0); }
        // Melodie aus komponierten Phrasen, taktweise gestartet
        if (m.restSteps > 0) m.restSteps--;
        else if (!m.queue.length && inBar === 0 && bar % 2 === 0) {
          const key = def.order[m.orderIdx++ % def.order.length];
          const ph = key === 'T' ? T : key === 'T5' ? T.slice(0, 5).concat([[0, 3]]) : def.phrases[key];
          m.queue = ph.map(([d, b]) => ({ deg: d + leadOct, steps: Math.round(b * 4) }));
          m.restAfter = 16;
        }
        if (m.queue.length && m.waitSteps <= 0) {
          const nnote = m.queue.shift();
          if (nnote.deg > -20) voice(c, bus, freqOf(def, nnote.deg), t0, nnote.steps * stepDur * 1.05, Object.assign({ a: 0.14, r: 0.7 }, def.lead), def.lead.vol);
          m.waitSteps = nnote.steps;
          if (!m.queue.length) m.restSteps = m.restAfter;
        }
        m.waitSteps = (m.waitSteps || 0) - 1;
        m.step++;
        m.next += stepDur;
      }
    };
    m.waitSteps = 0;
    m.timer = setInterval(() => { try { schedule(); } catch (e) { clearInterval(m.timer); console.error('Musik angehalten', e); } }, 60);
    S.music = m;
  };
  S.stopMusic = function (clearName) {
    if (clearName !== false) S.musicName = null;
    const m = S.music; if (!m) return;
    S.music = null;
    clearInterval(m.timer);
    try { const c = S.ctx; m.bus.gain.cancelScheduledValues(c.currentTime); m.bus.gain.setTargetAtTime(0.0001, c.currentTime, 0.6); setTimeout(() => { try { m.bus.disconnect(); m.rv.disconnect(); } catch (e) { /* weg */ } }, 3500); } catch (e) { /* ignorieren */ }
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
      const drip = () => { if (!alive) return; const t0 = c.currentTime; const f = 900 + Math.random() * 900; [0, 0.18, 0.36].forEach((d, i) => { const o = c.createOscillator(); o.frequency.setValueAtTime(f, t0 + d); o.frequency.exponentialRampToValueAtTime(f * 0.5, t0 + d + 0.08); const g = c.createGain(); g.gain.setValueAtTime(0.035 / (i + 1), t0 + d); g.gain.exponentialRampToValueAtTime(0.0001, t0 + d + 0.25); o.connect(g); g.connect(out); o.start(t0 + d); o.stop(t0 + d + 0.3); }); setTimeout(drip, 2500 + Math.random() * 7000); };
      setTimeout(drip, 1500);
      return () => { alive = false; n.src.stop(); };
    },
    birds: (c, out) => {
      let alive = true;
      const chirp = () => { if (!alive) return; const t0 = c.currentTime; const base = 1500 + Math.random() * 1100; const n = 2 + Math.floor(Math.random() * 3); for (let i = 0; i < n; i++) { const o = c.createOscillator(); o.frequency.setValueAtTime(base, t0 + i * 0.12); o.frequency.exponentialRampToValueAtTime(base * (1.3 + Math.random() * 0.4), t0 + i * 0.12 + 0.06); o.frequency.exponentialRampToValueAtTime(base * 0.9, t0 + i * 0.12 + 0.1); const g = c.createGain(); g.gain.setValueAtTime(0.0001, t0 + i * 0.12); g.gain.linearRampToValueAtTime(0.012, t0 + i * 0.12 + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t0 + i * 0.12 + 0.11); o.connect(g); g.connect(out); o.start(t0 + i * 0.12); o.stop(t0 + i * 0.12 + 0.13); } setTimeout(chirp, 1500 + Math.random() * 6000); };
      setTimeout(chirp, 800);
      return () => { alive = false; };
    },
    city: (c, out) => { const n = loopNoise(c, out, 'lowpass', 220, 0.6, 0.07); const l = lfo(c, n.g.gain, 0.2, 0.03, 0.06); let alive = true; const horn = () => { if (!alive) return; if (Math.random() < 0.5) { const f = 300 + Math.random() * 200; tone(f, 0.35, 'sawtooth', 0.02); tone(f * 1.25, 0.35, 'sawtooth', 0.015); } setTimeout(horn, 6000 + Math.random() * 12000); }; setTimeout(horn, 4000); return () => { alive = false; n.src.stop(); l.stop(); }; },
    market: (c, out) => { const n = loopNoise(c, out, 'bandpass', 700, 1.0, 0.035); const l = lfo(c, n.g.gain, 3.1, 0.015, 0.035); const l2 = lfo(c, n.f.frequency, 0.4, 300, 900); return () => { n.src.stop(); l.stop(); l2.stop(); }; },
    fire: (c, out) => { const n = loopNoise(c, out, 'bandpass', 1700, 1.2, 0.025); const l = lfo(c, n.g.gain, 7, 0.015, 0.025); const r = loopNoise(c, out, 'lowpass', 120, 0.5, 0.06); return () => { n.src.stop(); l.stop(); r.src.stop(); }; },
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

  S.setVolume = function (v) {
    S.volume = v;
    try { localStorage.setItem('atl.volume', String(v)); } catch (e) { /* egal */ }
    if (S.master) S.master.gain.setTargetAtTime(v, S.ctx.currentTime, 0.05);
  };
  try { const v = parseFloat(localStorage.getItem('atl.volume')); if (!isNaN(v)) S.volume = v; } catch (e) { /* egal */ }
  S.toggleMute = function () {
    S.muted = !S.muted;
    if (S.muted) { S.stopMusic(false); S.stopAtmos(false); }
    else S.resume();
    return S.muted;
  };

  ATL.audio = S;
})(window.ATL);
