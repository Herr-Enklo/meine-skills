/* Spielkern: Räume, Figuren, Verben, Skript-API, Zeichenschleife. */
(function (ATL) {
  const U = ATL.U;
  const VERBS = { walk: 'Gehe zu', look: 'Schau an', take: 'Nimm', use: 'Benutze', open: 'Öffne', close: 'Schließe', push: 'Drücke', pull: 'Ziehe', talk: 'Rede mit', give: 'Gib' };
  const PREP = { use: 'mit', give: 'an' };
  const DEFAULTS = {
    look: ['Nichts Besonderes.', 'Das ist nicht weiter interessant.', 'Ich sehe nichts Auffälliges.'],
    take: ['Das kann ich nicht mitnehmen.', 'Das lasse ich lieber, wo es ist.', 'Das brauche ich nicht.'],
    use: ['Das funktioniert so nicht.', 'Damit kann ich hier nichts anfangen.', 'Das bringt nichts.'],
    useWith: ['Das passt nicht zusammen.', 'So ergibt das keinen Sinn.', 'Das bringt nichts.'],
    open: ['Das lässt sich nicht öffnen.', 'Das geht nicht auf.'],
    close: ['Das lässt sich nicht schließen.', 'Das ist schon zu.'],
    push: ['Das rührt sich nicht.', 'Das bewegt sich keinen Millimeter.'],
    pull: ['Das rührt sich nicht.', 'Da tut sich nichts.'],
    talk: ['Das würde mir keine Antwort geben.', 'Ich rede nicht mit Dingen.'],
    give: ['Das will niemand haben.', 'Das gebe ich lieber nicht her.'],
    walk: [],
  };

  const rooms = {};
  const items = {};
  const chars = {};
  ATL.rooms = { define: (def) => { rooms[def.id] = def; return def; }, get: (id) => rooms[id], all: rooms };
  ATL.items = { define: (def) => { items[def.id] = def; return def; }, get: (id) => items[id], all: items };
  ATL.chars = { define: (id, def) => { def.id = id; chars[id] = def; return def; }, get: (id) => chars[id], all: chars };
  ATL.VERBS = VERBS;

  class Game {
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.W = 960; this.H = 600;
      this.state = null;
      this.roomDef = null;
      this.actors = {};
      this.hero = null;
      this.grid = null;
      this.bg = document.createElement('canvas');
      this.fg = document.createElement('canvas');
      this.camera = 0;
      this.verb = 'walk';
      this.item = null;
      this.hover = null;
      this.busy = false;
      this.phase = null;
      this.cutscene = false;
      this.inDialog = false;
      this.fast = false;
      this.time = 0;
      this.fade = 1;
      this.skipFn = null;
      this.narration = null;
      this.blocks = {};
      this.running = false;
      this.ui = null;
      this.last = 0;
      this.dark = 0;
      this.roomTime = 0;
      this.log = [];
      this.walkTicket = 0;
    }

    // ---------- Zustand ----------
    newState() {
      return { flags: {}, inv: [], codex: [], objectives: [], seed: Math.floor(Math.random() * 1e9), room: null, chapter: 0, started: Date.now() };
    }
    flag(k) { return this.state.flags[k]; }
    set(k, v) { this.state.flags[k] = v === undefined ? true : v; return v; }
    inc(k, n) { this.state.flags[k] = (this.state.flags[k] || 0) + (n || 1); return this.state.flags[k]; }
    has(id) { return this.state.inv.includes(id); }
    take(id, opts) {
      if (!this.has(id)) this.state.inv.push(id);
      if (!(opts && opts.silent)) ATL.audio.fx('pickup');
      if (this.ui) this.ui.refreshInventory();
    }
    drop(id) {
      this.state.inv = this.state.inv.filter((i) => i !== id);
      if (this.item === id) this.item = null;
      if (this.ui) this.ui.refreshInventory();
    }
    rng() { return U.rng(this.state.seed); }

    codex(id) {
      if (this.state.codex.includes(id)) return;
      this.state.codex.push(id);
      const e = ATL.codex && ATL.codex[id];
      if (this.ui) this.ui.toast('Neuer Eintrag im Kodex: ' + (e ? e.title : id));
      ATL.audio.fx('bell');
    }
    objective(text, opts) {
      const list = this.state.objectives;
      const cur = list.find((o) => !o.done);
      if (cur) cur.done = true;
      if (text) {
        list.push({ text, done: false });
        if (this.ui && !(opts && opts.silent)) this.ui.toast('Tagebuch: ' + text);
      }
    }
    done(text) { const o = this.state.objectives.find((x) => x.text === text); if (o) o.done = true; }

    // ---------- Figuren ----------
    actor(id) {
      if (!this.actors[id]) {
        const def = chars[id];
        if (!def) throw new Error('Unbekannte Figur: ' + id);
        this.actors[id] = new ATL.Actor(id, def);
      }
      return this.actors[id];
    }
    place(id, x, y, dir) {
      const a = this.actor(id);
      a.setPos(x, y, dir);
      a.room = this.roomDef ? this.roomDef.id : null;
      a.visible = true;
      a.hidden = false;
      a.offsetY = 0;
      if (this.grid && !a.fixedScale) a.scale = this.scaleAt(y);
      return a;
    }
    hide(id) { const a = this.actor(id); a.visible = false; a.speech = null; }
    inRoom(id) { const a = this.actors[id]; return !!(a && a.visible && a.room === this.roomDef.id); }
    face(id, target) {
      const a = this.actor(id);
      if (typeof target === 'string' && 'lrud'.includes(target) && target.length === 1) a.dir = target;
      else if (typeof target === 'string') { const b = this.actor(target); a.faceTo(b.x, b.y); }
      else if (Array.isArray(target)) a.faceTo(target[0], target[1]);
    }
    anim(id, name) { this.actor(id).anim = name; }
    scaleAt(y) {
      const s = this.roomDef && this.roomDef.scale;
      if (!s) return 1;
      const t = U.clamp((y - s.y0) / (s.y1 - s.y0), 0, 1);
      return U.lerp(s.s0, s.s1, t);
    }

    async walk(id, x, y, dir) {
      const a = this.actor(id);
      if (!a.visible) { a.setPos(x, y, dir); return true; }
      if (this.fast) { a.setPos(x, y, dir); return true; }
      const path = this.grid ? this.grid.findPath(a.x, a.y, x, y) : [[x, y]];
      if (!path) { if (id === 'falk' && !this.cutscene) await this.say('falk', 'Da komme ich nicht hin.'); return false; }
      const ok = await a.walkPath(path);
      if (ok && dir) a.dir = dir;
      return ok;
    }
    async walkHero(x, y, dir) {
      const ticket = ++this.walkTicket;
      const ok = await this.walk('falk', x, y, dir);
      return ok && ticket === this.walkTicket;
    }

    // ---------- Sprache ----------
    say(id, text, opts) {
      opts = opts || {};
      const a = this.actor(id);
      if (this.skipFn) this.skipFn();
      const dur = this.fast ? 0 : Math.max(1400, 60 * String(text).length + (opts.extra || 0));
      return new Promise((resolve) => {
        if (this.fast) {
          this.log.push(id + ': ' + text);
          if (this.log.length > 400) this.log.shift();
          resolve(); return;
        }
        a.speech = { text, color: a.def.color || '#fff' };
        a.talking = true;
        let finished = false;
        const end = () => {
          if (finished) return;
          finished = true;
          clearTimeout(timer);
          a.speech = null; a.talking = false;
          if (this.skipFn === end) this.skipFn = null;
          resolve();
        };
        const timer = setTimeout(end, dur);
        this.skipFn = end;
      });
    }
    async talk(lines) {
      for (const l of lines) {
        if (typeof l === 'string') await this.message(l);
        else if (typeof l === 'function') await l(this);
        else await this.say(l[0], l[1]);
      }
    }
    message(text, dur) {
      if (this.skipFn) this.skipFn();
      return new Promise((resolve) => {
        if (this.fast) { this.log.push('* ' + text); resolve(); return; }
        this.narration = text;
        let finished = false;
        const end = () => {
          if (finished) return;
          finished = true; clearTimeout(timer);
          this.narration = null;
          if (this.skipFn === end) this.skipFn = null;
          resolve();
        };
        const timer = setTimeout(end, dur || Math.max(1600, 60 * text.length));
        this.skipFn = end;
      });
    }
    skip() { if (this.skipFn) this.skipFn(); }
    wait(ms) {
      if (this.fast) return Promise.resolve();
      return new Promise((resolve) => {
        let finished = false;
        const end = () => { if (finished) return; finished = true; clearTimeout(t); if (this.skipFn === end) this.skipFn = null; resolve(); };
        const t = setTimeout(end, ms);
        this.skipFn = end;
      });
    }
    fx(name) { ATL.audio.fx(name); }

    // ---------- Zwischensequenzen ----------
    async scene(fn) {
      const prev = this.cutscene;
      this.cutscene = true;
      if (this.ui) this.ui.setCutscene(true);
      try { await fn(this); }
      finally {
        this.cutscene = prev;
        if (this.ui && !prev) this.ui.setCutscene(false);
      }
    }
    async fadeOut(ms) {
      if (this.fast) { this.fade = 1; return; }
      const start = performance.now(); ms = ms || 400;
      const from = this.fade;
      await new Promise((r) => {
        const step = () => { const t = Math.min(1, (performance.now() - start) / ms); this.fade = U.lerp(from, 1, t); if (t < 1) requestAnimationFrame(step); else r(); };
        step();
      });
    }
    async fadeIn(ms) {
      if (this.fast) { this.fade = 0; return; }
      const start = performance.now(); ms = ms || 500;
      const from = this.fade;
      await new Promise((r) => {
        const step = () => { const t = Math.min(1, (performance.now() - start) / ms); this.fade = U.lerp(from, 0, t); if (t < 1) requestAnimationFrame(step); else r(); };
        step();
      });
    }

    // ---------- Räume ----------
    async goto(roomId, x, y, dir, opts) {
      opts = opts || {};
      const def = rooms[roomId];
      if (!def) throw new Error('Unbekannter Raum: ' + roomId);
      if (this.skipFn) this.skipFn();
      this.hero.stop();
      if (!opts.noFade) await this.fadeOut(opts.fadeMs);
      if (this.roomDef && this.roomDef.leave) this.roomDef.leave(this);
      for (const id in this.actors) if (id !== 'falk') { const a = this.actors[id]; if (a.room !== roomId) { a.visible = false; a.speech = null; a.offsetY = 0; a.fixedScale = null; } }
      this.roomDef = def;
      this.state.room = roomId;
      this.roomTime = 0;
      this.blocks = {};
      this.narration = null;
      const w = def.width || this.W;
      this.grid = new ATL.WalkGrid(def.walk || [[0, 0, w, 0, w, this.H, 0, this.H]], w, this.H);
      this.repaint();
      const hx = x ?? (def.start ? def.start[0] : 480), hy = y ?? (def.start ? def.start[1] : 520);
      this.hero.setPos(hx, hy, dir || (def.start && def.start[2]) || 'd');
      this.hero.room = roomId;
      this.hero.visible = !def.noHero;
      this.hero.fixedScale = null;
      this.hero.scale = this.scaleAt(hy);
      this.hero.anim = 'stand';
      this.hero.offsetY = 0;
      for (const p of def.actors || []) {
        const a = this.actor(p.id);
        if (p.cond && !p.cond(this)) { a.visible = false; continue; }
        a.setPos(p.x, p.y, p.dir || 'd');
        a.room = roomId; a.visible = true; a.anim = 'stand'; a.fixedScale = p.scale || null; a.offsetY = 0;
        a.scale = a.fixedScale || this.scaleAt(p.y);
      }
      this.updateCamera(true);
      if (def.ambient !== undefined) ATL.audio.playAmbient(def.ambient);
      ATL.audio.setRoom(def);
      if (this.ui) { this.ui.setRoomName(def.name); this.ui.refreshInventory(); }
      this.hover = null;
      if (!opts.noFade) await this.fadeIn(opts.fadeMs);
      if (def.enter) await def.enter(this);
    }
    repaint() {
      const def = this.roomDef;
      if (!def) return;
      const w = def.width || this.W;
      this.bg.width = w; this.bg.height = this.H;
      const c = this.bg.getContext('2d');
      c.clearRect(0, 0, w, this.H);
      c.fillStyle = '#000'; c.fillRect(0, 0, w, this.H);
      if (def.paint) def.paint(c, this);
      this.fg.width = w; this.fg.height = this.H;
      const f = this.fg.getContext('2d');
      f.clearRect(0, 0, w, this.H);
      if (def.paintFront) def.paintFront(f, this);
      this.hasFront = !!def.paintFront;
    }
    blockWalk(id, poly) { this.blocks[id] = poly; this.grid.block(poly); }
    unblockWalk(id) { const p = this.blocks[id]; if (p) { delete this.blocks[id]; this.grid.unblock(p); } }
    updateCamera(snap) {
      const w = this.roomDef ? (this.roomDef.width || this.W) : this.W;
      if (w <= this.W) { this.camera = 0; return; }
      const target = U.clamp(this.hero.x - this.W / 2, 0, w - this.W);
      this.camera = snap ? target : U.lerp(this.camera, target, 0.12);
    }

    // ---------- Zielobjekte ----------
    hotspotName(h) { return typeof h.name === 'function' ? h.name(this) : h.name; }
    targetsInRoom() {
      const out = [];
      const def = this.roomDef;
      if (!def) return out;
      for (const id in this.actors) {
        const a = this.actors[id];
        if (id === 'falk' || !a.visible || a.hidden || a.room !== def.id) continue;
        const p = (def.actors || []).find((x) => x.id === id) || {};
        const h = a.height;
        out.push({ kind: 'actor', id, name: p.name || a.def.name, def: Object.assign({ look: a.def.look_text }, a.def.handlers || {}, p), rect: [a.x - 24 * a.scale, a.y - h, 48 * a.scale, h + 4], at: p.at || [a.x + (a.x < 480 ? 60 : -60) * a.scale, a.y + 4], actor: a });
      }
      for (const h of def.hotspots || []) {
        if (h.cond && !h.cond(this)) continue;
        out.push({ kind: 'hotspot', id: h.id, name: this.hotspotName(h), def: h, rect: h.rect, poly: h.poly, at: h.at });
      }
      for (const e of def.exits || []) {
        if (e.cond && !e.cond(this)) continue;
        out.push({ kind: 'exit', id: e.id, name: this.hotspotName(e), def: e, rect: e.rect, poly: e.poly, at: e.at });
      }
      return out;
    }
    hotspotAt(x, y) {
      const list = this.targetsInRoom();
      let best = null;
      for (const t of list) {
        const hit = t.poly ? U.pointInPoly(x, y, t.poly) : t.rect ? U.inRect(x, y, t.rect) : false;
        if (!hit) continue;
        const z = t.def.z ?? (t.kind === 'actor' ? 5 : t.kind === 'exit' ? 0 : 1);
        if (!best || z >= best.z) best = { t, z };
      }
      return best ? best.t : null;
    }
    findTarget(id) { return this.targetsInRoom().find((t) => t.id === id) || null; }
    hs(id) { return ((this.roomDef && this.roomDef.hotspots) || []).find((h) => h.id === id) || ((this.roomDef && this.roomDef.exits) || []).find((h) => h.id === id) || null; }
    hasAll(...ids) { return ids.every((i) => this.has(i)); }

    defaultAt(t) {
      if (t.at) return t.at;
      const r = t.rect || (t.poly ? polyBounds(t.poly) : null);
      if (!r) return [this.hero.x, this.hero.y];
      const cx = r[0] + r[2] / 2, by = r[1] + r[3] + 6;
      const c = this.grid.nearestFree(cx, by);
      return this.grid.toPoint(c[0], c[1]);
    }

    // ---------- Verben ----------
    sentence() {
      let s = VERBS[this.verb];
      if (this.item) {
        s += ' ' + items[this.item].name;
        if (PREP[this.verb]) s += ' ' + PREP[this.verb];
      }
      if (this.hover && this.hover.name) {
        if (!this.item || PREP[this.verb]) s += ' ' + this.hover.name;
      }
      return s;
    }
    selectVerb(v) { this.verb = v; this.item = null; if (this.ui) this.ui.refreshVerbs(); }
    resetVerb() { this.verb = 'walk'; this.item = null; if (this.ui) this.ui.refreshVerbs(); }

    async clickScene(x, y, right) {
      if (!this.roomDef || this.inDialog) return;
      const wx = x + this.camera;
      if (this.cutscene) { this.skip(); return; }
      if (this.busy && this.phase !== 'walking') { this.skip(); return; }
      const t = this.hotspotAt(wx, y);
      if (right) {
        if (t) await this.perform('look', t, null);
        return;
      }
      if (this.verb === 'walk' || !t) {
        if (this.roomDef.noHero) { if (t) await this.perform('walk', t, null); return; }
        this.busy = false; this.phase = null;
        this.walkTicket++;
        this.walk('falk', wx, y).then(() => {});
        if (t && t.kind === 'exit') await this.perform('walk', t, null);
        else this.resetVerb();
        return;
      }
      if (PREP[this.verb] && !this.item) {
        if (t && t.kind === 'actor' && this.verb === 'use') await this.perform('use', t, null);
        else if (this.verb === 'use') await this.perform('use', t, null);
        return;
      }
      await this.perform(this.verb, t, this.item);
    }

    async perform(verb, t, itemId) {
      if (!t) return;
      if (this.busy && this.phase !== 'walking') return;
      this.busy = true; this.phase = 'walking';
      const ticket = ++this.walkTicket;
      const d = t.def;
      const noWalk = verb === 'look' ? !d.walkToLook : d.noWalk;
      if (!noWalk && !this.roomDef.noHero) {
        const at = this.defaultAt(t);
        const ok = await this.walk('falk', at[0], at[1]);
        if (!ok || ticket !== this.walkTicket) { if (ticket === this.walkTicket) { this.busy = false; this.phase = null; } return; }
        if (at[2]) this.hero.dir = at[2];
        else if (t.kind === 'actor') this.hero.faceTo(t.actor.x, t.actor.y);
        if (t.kind === 'actor' && (verb === 'talk' || verb === 'give') && !d.noTurn) t.actor.faceTo(this.hero.x, this.hero.y);
        else if (t.rect) this.hero.faceTo(t.rect[0] + t.rect[2] / 2, Math.min(this.hero.y, t.rect[1] + t.rect[3] / 2));
      } else if (!this.roomDef.noHero && verb === 'look' && !d.noFace && t.rect) {
        this.hero.faceTo(t.rect[0] + t.rect[2] / 2, Math.min(this.hero.y - 1, t.rect[1] + t.rect[3] / 2));
      }
      this.phase = 'running';
      try {
        let h;
        if (itemId && (verb === 'use' || verb === 'give')) {
          const key = verb === 'use' ? 'useWith' : 'giveWith';
          const map = d[key] || {};
          h = map[itemId] || map.default;
          if (h) await this.runHandler(h, t, itemId);
          else if (verb === 'give' && t.kind === 'actor') await this.say('falk', U.pick(['Das braucht ' + t.name + ' nicht.', 'Das will ' + t.name + ' nicht haben.']));
          else await this.say('falk', U.pick(DEFAULTS.useWith));
        } else if (verb === 'walk' && t.kind === 'exit') {
          await this.travel(d);
        } else {
          h = d[verb];
          if (h === undefined && verb === 'use' && t.kind === 'exit') h = () => this.travel(d);
          if (h !== undefined) await this.runHandler(h, t, itemId);
          else if (verb === 'talk' && t.kind === 'actor') await this.say('falk', 'Dazu fällt mir gerade nichts ein.');
          else if (verb === 'give' && !itemId) await this.say('falk', 'Was soll ich denn geben?');
          else if (verb !== 'walk') await this.say('falk', U.pick(DEFAULTS[verb] || ['Das geht nicht.']));
        }
      } catch (e) {
        console.error('Fehler in Aktion', verb, t.id, e);
      } finally {
        if (ticket === this.walkTicket || this.phase === 'running') { this.busy = false; this.phase = null; }
        this.resetVerb();
        if (this.onActionDone) this.onActionDone();
      }
    }
    async runHandler(h, t, itemId) {
      if (typeof h === 'string' && ATL.dialogs && ATL.dialogs.get(h)) await this.dialog(h);
      else if (typeof h === 'string') await this.say('falk', h);
      else if (Array.isArray(h)) await this.talk(h);
      else if (typeof h === 'function') { const r = await h(this, t, itemId); if (typeof r === 'string') await this.say('falk', r); }
    }
    async travel(e) {
      if (e.before) { const ok = await e.before(this); if (ok === false) return; }
      if (e.to) {
        const p = e.pos || [480, 520];
        await this.goto(e.to, p[0], p[1], e.dir);
      }
    }

    // Inventar-Aktionen
    async useItem(verb, itemId, withId) {
      if (this.busy || this.inDialog || this.cutscene) return;
      const it = items[itemId];
      if (!it) return;
      this.busy = true; this.phase = 'running';
      try {
        if (withId) {
          const other = items[withId];
          const h = (it.useWith && (it.useWith[withId] || it.useWith.default)) || (other.useWith && (other.useWith[itemId] || other.useWith.default));
          if (h) await this.runHandler(h, { kind: 'item', id: withId, def: other, name: other.name }, withId === itemId ? null : (it.useWith && it.useWith[withId] ? withId : itemId));
          else await this.say('falk', U.pick(DEFAULTS.useWith));
        } else {
          const h = it[verb];
          if (h !== undefined) await this.runHandler(h, { kind: 'item', id: itemId, def: it, name: it.name }, null);
          else if (verb === 'look') await this.say('falk', 'Das ist ' + it.name + '.');
          else if (verb === 'take') await this.say('falk', 'Das habe ich schon.');
          else if (verb === 'give' || verb === 'use') await this.say('falk', 'Womit?');
          else if (verb === 'talk') await this.say('falk', 'Ich rede nicht mit Gegenständen.');
          else await this.say('falk', U.pick(DEFAULTS[verb]));
        }
      } catch (e) { console.error(e); }
      finally { this.busy = false; this.phase = null; this.resetVerb(); if (this.onActionDone) this.onActionDone(); }
    }
    async clickItem(itemId) {
      if (this.inDialog || this.cutscene || (this.busy && this.phase !== 'walking')) return;
      const v = this.verb;
      if (v === 'walk') { this.verb = 'look'; await this.useItem('look', itemId); return; }
      if (PREP[v]) {
        if (!this.item) {
          const it = items[itemId];
          if (v === 'use' && it.use && !it.useWith) { await this.useItem('use', itemId); return; }
          this.item = itemId;
          if (this.ui) this.ui.refreshVerbs();
          return;
        }
        if (v === 'use') await this.useItem('use', this.item, itemId);
        else await this.say('falk', 'Das ergibt keinen Sinn.').then(() => this.resetVerb());
        return;
      }
      await this.useItem(v, itemId);
    }

    // Test-API: Aktion per Kennung ausführen
    async act(verb, targetId, itemId) {
      const t = this.findTarget(targetId);
      if (!t) throw new Error('Ziel nicht im Raum: ' + targetId + ' (' + this.roomDef.id + ')');
      if (itemId && !this.has(itemId)) throw new Error('Gegenstand nicht im Inventar: ' + itemId);
      this.busy = false; this.phase = null;
      await this.perform(verb, t, itemId || null);
    }
    async actItem(verb, itemId, withId) {
      if (!this.has(itemId)) throw new Error('Gegenstand nicht im Inventar: ' + itemId);
      this.busy = false; this.phase = null;
      await this.useItem(verb, itemId, withId || null);
    }

    // ---------- Schleife ----------
    start() {
      if (this.running) return;
      this.running = true;
      this.last = performance.now();
      const loop = (now) => {
        const dt = Math.min(0.05, (now - this.last) / 1000);
        this.last = now;
        this.time += dt;
        this.roomTime += dt;
        this.update(dt);
        this.draw();
        requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
    }
    update(dt) {
      if (!this.roomDef) return;
      for (const id in this.actors) {
        const a = this.actors[id];
        if (a.visible && a.room === this.roomDef.id) a.update(dt, (y) => this.scaleAt(y));
      }
      this.updateCamera(false);
      // Schritte der Spielfigur
      const hp = Math.floor(this.hero.phase / Math.PI);
      if (this.hero.anim === 'walk' && this.hero.visible && hp !== this.lastStep) { this.lastStep = hp; if (!this.fast) ATL.audio.step(); }
      if (this.roomDef.update) this.roomDef.update(this, dt);
    }
    draw() {
      const ctx = this.ctx;
      const t = this.time;
      ctx.clearRect(0, 0, this.W, this.H);
      if (!this.roomDef) { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, this.W, this.H); return; }
      const def = this.roomDef;
      ctx.save();
      ctx.translate(-Math.round(this.camera), 0);
      ctx.drawImage(this.bg, 0, 0);
      if (def.animate) def.animate(ctx, t, this);
      const ents = [];
      for (const h of def.hotspots || []) {
        if (h.paint && !(h.cond && !h.cond(this))) {
          if (h.z === undefined) h.paint(ctx, this, t);
          else ents.push({ y: h.z, draw: () => h.paint(ctx, this, t) });
        }
      }
      const tint = ATL.fx ? ATL.fx.tintFor(def) : null;
      for (const id in this.actors) {
        const a = this.actors[id];
        if (a.visible && !a.hidden && a.room === def.id) ents.push({ y: a.y + (a.zOffset || 0), draw: () => ATL.drawActor(ctx, a, t, tint) });
      }
      ents.sort((p, q) => p.y - q.y);
      for (const e of ents) e.draw();
      if (this.hasFront) ctx.drawImage(this.fg, 0, 0);
      if (def.animateFront) def.animateFront(ctx, t, this);
      if (ATL.fx) ATL.fx.drawParticles(ctx, def, t, def.width || this.W, this.H);
      ctx.restore();
      if (ATL.fx) ATL.fx.drawGrade(ctx, def, this.W, this.H);
      if (this.dark > 0) { ctx.fillStyle = `rgba(0,0,0,${this.dark})`; ctx.fillRect(0, 0, this.W, this.H); }
      // Sprechtexte
      for (const id in this.actors) {
        const a = this.actors[id];
        if (a.speech) this.drawSpeech(a);
      }
      if (this.narration) this.drawNarration(this.narration);
      if (def.overlayPaint) def.overlayPaint(ctx, t, this);
      if (this.fade > 0) { ctx.fillStyle = `rgba(0,0,0,${this.fade})`; ctx.fillRect(0, 0, this.W, this.H); }
    }
    drawSpeech(a) {
      const ctx = this.ctx;
      ctx.font = 'bold 21px "Trebuchet MS", Verdana, sans-serif';
      const lines = U.wrap(ctx, a.speech.text, 440);
      const lh = 25;
      let x, y;
      const visible = a.visible && a.room === this.roomDef.id && !this.roomDef.noHero;
      if (visible) {
        x = U.clamp(a.x - this.camera, 230, this.W - 230);
        y = a.y - a.height - 14 - (lines.length - 1) * lh;
        if (y < 30) y = 30;
      } else { x = this.W / 2; y = 40; }
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      for (let i = 0; i < lines.length; i++) {
        const ly = y + i * lh;
        ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0,0,0,0.85)'; ctx.lineJoin = 'round';
        ctx.strokeText(lines[i], x, ly);
        ctx.fillStyle = a.speech.color; ctx.fillText(lines[i], x, ly);
      }
    }
    drawNarration(text) {
      const ctx = this.ctx;
      ctx.font = 'italic 21px Georgia, serif';
      const lines = U.wrap(ctx, text, 720);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const y0 = this.H - 30 - (lines.length - 1) * 26;
      for (let i = 0; i < lines.length; i++) {
        ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0,0,0,0.9)';
        ctx.strokeText(lines[i], this.W / 2, y0 + i * 26);
        ctx.fillStyle = '#f5ecd5'; ctx.fillText(lines[i], this.W / 2, y0 + i * 26);
      }
    }

    // ---------- Speichern ----------
    snapshot() {
      const s = JSON.parse(JSON.stringify(this.state));
      s.hero = { x: this.hero.x, y: this.hero.y, dir: this.hero.dir };
      s.roomName = this.roomDef ? this.roomDef.name : '';
      s.saved = Date.now();
      return s;
    }
    async restore(s) {
      this.state = JSON.parse(JSON.stringify(s));
      delete this.state.hero; delete this.state.roomName; delete this.state.saved;
      this.actors = {};
      this.hero = this.actor('falk');
      this.busy = false; this.phase = null; this.cutscene = false; this.inDialog = false;
      if (this.ui) { this.ui.setCutscene(false); this.ui.hideDialog(); }
      await this.goto(s.room, s.hero.x, s.hero.y, s.hero.dir, { noFade: false });
    }
  }

  function polyBounds(p) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (let i = 0; i < p.length; i += 2) { x0 = Math.min(x0, p[i]); x1 = Math.max(x1, p[i]); y0 = Math.min(y0, p[i + 1]); y1 = Math.max(y1, p[i + 1]); }
    return [x0, y0, x1 - x0, y1 - y0];
  }

  ATL.Game = Game;
  ATL.DEFAULTS = DEFAULTS;
})(window.ATL);
