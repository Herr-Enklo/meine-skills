/* Synthetische Geräusche und Hintergrundklang über WebAudio. Kein Sample nötig. */
(function (ATL) {
  const S = { ctx: null, muted: false, ambient: null, ambientName: null, master: null };

  function ctx() {
    if (S.ctx) return S.ctx;
    try {
      S.ctx = new (window.AudioContext || window.webkitAudioContext)();
      S.master = S.ctx.createGain();
      S.master.gain.value = 0.5;
      S.master.connect(S.ctx.destination);
    } catch (e) { S.ctx = null; }
    return S.ctx;
  }

  S.unlock = function () {
    const c = ctx();
    if (c && c.state === 'suspended') c.resume();
    if (S.ambientName && !S.ambient) S.playAmbient(S.ambientName);
  };

  function tone(freq, dur, type, vol, slide) {
    const c = ctx();
    if (!c || S.muted) return;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type || 'sine';
    o.frequency.value = freq;
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * slide), c.currentTime + dur);
    g.gain.value = vol || 0.2;
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur);
    o.connect(g); g.connect(S.master);
    o.start(); o.stop(c.currentTime + dur);
  }

  function noise(dur, vol, filterFreq) {
    const c = ctx();
    if (!c || S.muted) return;
    const len = Math.floor(c.sampleRate * dur);
    const buf = c.createBuffer(1, len, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = c.createBufferSource();
    src.buffer = buf;
    const f = c.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = filterFreq || 1200;
    const g = c.createGain(); g.gain.value = vol || 0.3;
    src.connect(f); f.connect(g); g.connect(S.master);
    src.start();
  }

  const FX = {
    click: () => tone(900, 0.05, 'square', 0.05),
    pickup: () => { tone(660, 0.08, 'triangle', 0.15); setTimeout(() => tone(990, 0.12, 'triangle', 0.15), 70); },
    drop: () => tone(300, 0.15, 'triangle', 0.15, 0.5),
    door: () => { noise(0.35, 0.25, 500); tone(120, 0.3, 'sawtooth', 0.08, 0.7); },
    stone: () => { noise(0.8, 0.4, 250); tone(60, 0.8, 'sawtooth', 0.12, 0.6); },
    water: () => noise(0.6, 0.2, 900),
    success: () => { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => tone(f, 0.25, 'triangle', 0.14), i * 110)); },
    fail: () => { tone(220, 0.25, 'sawtooth', 0.1, 0.6); },
    punch: () => { noise(0.12, 0.5, 700); tone(90, 0.1, 'square', 0.15, 0.5); },
    hum: () => { tone(110, 1.2, 'sine', 0.12, 1.5); tone(165, 1.2, 'sine', 0.08, 1.5); },
    glow: () => { [330, 415, 494, 660].forEach((f, i) => setTimeout(() => tone(f, 0.6, 'sine', 0.1), i * 80)); },
    thunder: () => { noise(1.6, 0.6, 180); tone(45, 1.4, 'sawtooth', 0.15, 0.5); },
    bell: () => tone(1320, 0.8, 'sine', 0.12, 0.98),
    step: () => noise(0.04, 0.05, 400),
    whoosh: () => noise(0.3, 0.2, 2500),
  };

  S.fx = function (name) { const f = FX[name]; if (f) try { f(); } catch (e) { /* stumm */ } };

  // Hintergrundklang: ein leiser Akkord mit langsamem Filter, je Kapitel eine Stimmung
  const AMBIENTS = {
    college: { notes: [130.8, 196, 261.6], type: 'sine', vol: 0.05, lfo: 0.08 },
    city: { notes: [110, 164.8, 220, 277], type: 'triangle', vol: 0.035, lfo: 0.15 },
    egypt: { notes: [146.8, 174.6, 220, 293.7], type: 'sine', vol: 0.05, lfo: 0.05 },
    crete: { notes: [164.8, 207.7, 246.9], type: 'sine', vol: 0.05, lfo: 0.1 },
    mesopotamia: { notes: [123.5, 185, 246.9], type: 'triangle', vol: 0.03, lfo: 0.04 },
    thera: { notes: [98, 146.8, 196, 233], type: 'sine', vol: 0.05, lfo: 0.07 },
    atlantis: { notes: [82.4, 123.5, 164.8, 207.7], type: 'sawtooth', vol: 0.02, lfo: 0.03 },
    map: { notes: [196, 246.9, 293.7], type: 'sine', vol: 0.04, lfo: 0.2 },
    none: null,
  };

  S.playAmbient = function (name) {
    S.ambientName = name;
    const c = ctx();
    if (!c || S.muted) return;
    S.stopAmbient(false);
    const def = AMBIENTS[name];
    if (!def) return;
    const g = c.createGain();
    g.gain.value = 0;
    g.gain.linearRampToValueAtTime(def.vol, c.currentTime + 2.5);
    const f = c.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = 600;
    const lfo = c.createOscillator();
    lfo.frequency.value = def.lfo;
    const lfoG = c.createGain(); lfoG.gain.value = 300;
    lfo.connect(lfoG); lfoG.connect(f.frequency);
    lfo.start();
    const oscs = def.notes.map((n, i) => {
      const o = c.createOscillator();
      o.type = def.type; o.frequency.value = n;
      o.detune.value = (i % 2 ? 4 : -4);
      o.connect(f); o.start();
      return o;
    });
    f.connect(g); g.connect(S.master);
    S.ambient = { gain: g, oscs, lfo };
  };

  S.stopAmbient = function (clearName) {
    if (clearName !== false) S.ambientName = null;
    if (!S.ambient) return;
    const a = S.ambient; S.ambient = null;
    const c = S.ctx;
    try {
      a.gain.gain.cancelScheduledValues(c.currentTime);
      a.gain.gain.linearRampToValueAtTime(0, c.currentTime + 1);
      setTimeout(() => { a.oscs.forEach((o) => o.stop()); a.lfo.stop(); }, 1100);
    } catch (e) { /* ignorieren */ }
  };

  S.toggleMute = function () {
    S.muted = !S.muted;
    if (S.muted) S.stopAmbient(false);
    else if (S.ambientName) S.playAmbient(S.ambientName);
    return S.muted;
  };

  ATL.audio = S;
})(window.ATL);
