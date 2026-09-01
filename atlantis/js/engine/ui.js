/* Bedienoberfläche: Verben, Inventar, Satzzeile, Menü, Tagebuch, Speichern. */
(function (ATL) {
  const U = ATL.U;
  const $ = (s) => document.querySelector(s);
  const SLOTS = 6;

  class UI {
    constructor(g) {
      this.g = g; g.ui = this;
      this.invPage = 0;
      this.dialogResolve = null;
      this.toastTimer = null;
      this.menuOpen = false;
      this.diaryOpen = false;
      this.muted = false;
      this.bind();
      this.resize();
      window.addEventListener('resize', () => this.resize());
      g.onActionDone = () => this.autosave();
    }
    resize() {
      const sw = window.innerWidth / 960, sh = window.innerHeight / 750;
      const s = Math.min(sw, sh);
      $('#frame').style.transform = `translate(-50%, -50%) scale(${s})`;
    }
    bind() {
      const g = this.g;
      const canvas = $('#scene');
      const pos = (ev) => {
        const r = canvas.getBoundingClientRect();
        return [((ev.clientX - r.left) / r.width) * 960, ((ev.clientY - r.top) / r.height) * 600];
      };
      canvas.addEventListener('mousemove', (ev) => {
        const [x, y] = pos(ev);
        if (!g.roomDef) return;
        g.hover = g.hotspotAt(x + g.camera, y);
        this.updateSentence();
        canvas.style.cursor = g.hover ? 'pointer' : 'crosshair';
      });
      canvas.addEventListener('mouseleave', () => { g.hover = null; this.updateSentence(); });
      canvas.addEventListener('click', (ev) => { ATL.audio.unlock(); const [x, y] = pos(ev); g.clickScene(x, y, false); });
      canvas.addEventListener('contextmenu', (ev) => { ev.preventDefault(); ATL.audio.unlock(); const [x, y] = pos(ev); g.clickScene(x, y, true); });
      document.querySelectorAll('#verbs button').forEach((b) => {
        b.addEventListener('click', () => { ATL.audio.unlock(); if (g.cutscene || g.inDialog) return; g.selectVerb(b.dataset.verb); this.updateSentence(); });
      });
      $('#inv-up').addEventListener('click', () => { this.invPage = Math.max(0, this.invPage - 1); this.refreshInventory(); });
      $('#inv-down').addEventListener('click', () => { this.invPage++; this.refreshInventory(); });
      $('#btn-menu').addEventListener('click', () => this.toggleMenu());
      $('#btn-diary').addEventListener('click', () => this.toggleDiary());
      $('#diary-close').addEventListener('click', () => this.toggleDiary(false));
      document.querySelectorAll('.diary-tabs button[data-tab]').forEach((b) => b.addEventListener('click', () => this.showDiary(b.dataset.tab)));
      window.addEventListener('keydown', (ev) => {
        if (ev.target && ev.target.tagName === 'INPUT') return;
        if (ev.key === 'Escape') {
          if (this.diaryOpen) { this.toggleDiary(false); return; }
          if ($('#overlay').classList.contains('hidden')) this.toggleMenu();
          return;
        }
        if (this.menuOpen || this.diaryOpen) return;
        if (ev.key === ' ' || ev.key === 'Enter' || ev.key === '.') { ev.preventDefault(); g.skip(); return; }
        if (ev.key === 't' || ev.key === 'T') { this.toggleDiary(); return; }
        const map = { g: 'give', o: 'open', s: 'close', n: 'take', a: 'look', r: 'talk', b: 'use', d: 'push', z: 'pull' };
        if (map[ev.key] && !g.cutscene && !g.inDialog) { g.selectVerb(map[ev.key]); this.updateSentence(); }
        if (g.inDialog && /^[1-9]$/.test(ev.key)) {
          const opts = document.querySelectorAll('#dialog .opt');
          const o = opts[parseInt(ev.key, 10) - 1];
          if (o) o.click();
        }
      });
    }
    setRoomName(n) { document.title = n ? n + ' – Die Siegel von Atlantis' : 'Die Siegel von Atlantis'; }
    updateSentence() {
      const g = this.g;
      if (g.cutscene || g.inDialog) { $('#sentence').innerHTML = '&nbsp;'; return; }
      $('#sentence').textContent = g.roomDef ? g.sentence() : '';
    }
    refreshVerbs() {
      const g = this.g;
      document.querySelectorAll('#verbs button').forEach((b) => b.classList.toggle('active', b.dataset.verb === g.verb));
      document.querySelectorAll('.inv-item').forEach((e) => e.classList.toggle('selected', e.dataset.item === g.item));
      this.updateSentence();
    }
    refreshInventory() {
      const g = this.g;
      const grid = $('#inv-grid');
      grid.innerHTML = '';
      if (!g.state) return;
      const inv = g.state.inv;
      const per = 12;
      const pages = Math.max(1, Math.ceil(inv.length / per));
      if (this.invPage >= pages) this.invPage = pages - 1;
      $('#inv-up').disabled = this.invPage === 0;
      $('#inv-down').disabled = this.invPage >= pages - 1;
      const slice = inv.slice(this.invPage * per, this.invPage * per + per);
      for (const id of slice) {
        const it = ATL.items.get(id);
        if (!it) continue;
        const cv = document.createElement('canvas');
        cv.width = 48; cv.height = 48;
        const painter = ATL.icons[it.icon || id] || ATL.icons.default;
        try { painter(cv.getContext('2d'), it); } catch (e) { /* Icon fehlt */ }
        const el = U.el('div', { class: 'inv-item' + (g.item === id ? ' selected' : ''), title: it.name, 'data-item': id }, [cv]);
        el.addEventListener('mouseenter', () => { g.hover = { name: it.name, kind: 'item', id }; this.updateSentence(); });
        el.addEventListener('mouseleave', () => { g.hover = null; this.updateSentence(); });
        el.addEventListener('click', () => { ATL.audio.unlock(); g.clickItem(id); });
        el.addEventListener('contextmenu', (ev) => { ev.preventDefault(); g.verb = 'look'; g.item = null; g.useItem('look', id); });
        grid.appendChild(el);
      }
    }
    setCutscene(on) {
      $('#panel').style.opacity = on ? 0.35 : 1;
      $('#panel').style.pointerEvents = on ? 'none' : 'auto';
      this.updateSentence();
    }
    showDialogPanel() {
      $('#verbs').classList.add('hidden');
      $('#inventory').classList.add('hidden');
      $('#dialog').classList.remove('hidden');
      $('#dialog').innerHTML = '';
      $('#sentence').innerHTML = '&nbsp;';
    }
    chooseOption(texts) {
      const box = $('#dialog');
      box.innerHTML = '';
      return new Promise((resolve) => {
        texts.forEach((t, i) => {
          const el = U.el('div', { class: 'opt', text: t });
          el.addEventListener('click', () => { box.innerHTML = ''; resolve(i); });
          box.appendChild(el);
        });
      });
    }
    hideDialog() {
      $('#dialog').classList.add('hidden');
      $('#dialog').innerHTML = '';
      $('#verbs').classList.remove('hidden');
      $('#inventory').classList.remove('hidden');
    }
    toast(text) {
      const t = $('#toast');
      t.textContent = text; t.classList.remove('hidden');
      clearTimeout(this.toastTimer);
      this.toastTimer = setTimeout(() => t.classList.add('hidden'), 3200);
    }

    // ---------- Menü ----------
    toggleMenu(force) {
      this.menuOpen = force === undefined ? !this.menuOpen : force;
      $('#menu').classList.toggle('hidden', !this.menuOpen);
      if (this.menuOpen) this.renderMenu();
    }
    renderMenu(mode) {
      const g = this.g;
      const bt = $('#menu-buttons');
      const slots = $('#menu-slots');
      bt.innerHTML = ''; slots.innerHTML = ''; slots.classList.add('hidden');
      const inGame = !!(g.state && g.roomDef && g.roomDef.id !== 'title');
      const add = (label, fn, disabled) => { const b = U.el('button', { text: label }); b.disabled = !!disabled; b.addEventListener('click', fn); bt.appendChild(b); return b; };
      if (mode === 'save' || mode === 'load') {
        slots.classList.remove('hidden');
        const list = this.listSaves();
        for (let i = 0; i < SLOTS; i++) {
          const s = list[i];
          const label = (i + 1) + '. ' + (s ? `${s.roomName} – ${new Date(s.saved).toLocaleString('de-DE')}` : 'leer');
          const b = U.el('button', { text: label });
          if (mode === 'load' && !s) b.disabled = true;
          b.addEventListener('click', async () => {
            if (mode === 'save') { this.save(i); this.toast('Gespeichert.'); this.toggleMenu(false); }
            else { this.toggleMenu(false); await g.restore(s); }
          });
          slots.appendChild(b);
        }
        add('Zurück', () => this.renderMenu());
        return;
      }
      add('Neues Spiel', async () => { this.toggleMenu(false); await ATL.story.newGame(g); });
      const auto = this.loadSlot('auto');
      add(inGame ? 'Weiterspielen' : 'Fortsetzen', async () => { this.toggleMenu(false); if (!inGame && auto) await g.restore(auto); }, !inGame && !auto);
      add('Speichern', () => this.renderMenu('save'), !inGame || g.cutscene || g.inDialog);
      add('Laden', () => this.renderMenu('load'), !this.listSaves().some(Boolean));
      add(ATL.audio.muted ? 'Ton einschalten' : 'Ton ausschalten', () => { ATL.audio.unlock(); ATL.audio.toggleMute(); this.renderMenu(); });
      add('Über das Spiel', () => this.about());
    }
    about() {
      const bt = $('#menu-buttons');
      bt.innerHTML = '';
      bt.appendChild(U.el('div', { style: 'text-align:left;font-size:15px;line-height:1.45;color:#d8c8a0', html:
        '<p>Ein Abenteuerspiel im Stil der klassischen Zeigen-und-Klicken-Spiele der frühen 1990er. Alle Grafiken werden im Browser aus Formen gezeichnet, es gibt keine Bilddateien.</p>' +
        '<p>Die Mythen und Kulturen im Spiel (Platons Atlantis, Solon in Sais, Thot und Maat, das Labyrinth von Knossos, die Sintflut des Gilgamesch-Epos, die Apkallu, der Ausbruch von Thera) sind im Kodex kurz und ohne Ausschmückung erklärt. Die Handlung selbst ist erfunden.</p>' +
        '<p>Tastatur: Leertaste überspringt Text, Esc öffnet das Menü, T das Tagebuch, Ziffern wählen Gesprächsoptionen.</p>' }));
      const b = U.el('button', { text: 'Zurück' }); b.addEventListener('click', () => this.renderMenu()); bt.appendChild(b);
    }

    // ---------- Speichern ----------
    key(i) { return 'atl.save.' + i; }
    loadSlot(i) { try { const s = localStorage.getItem(this.key(i)); return s ? JSON.parse(s) : null; } catch (e) { return null; } }
    listSaves() { const out = []; for (let i = 0; i < SLOTS; i++) out.push(this.loadSlot(i)); return out; }
    save(i) { try { localStorage.setItem(this.key(i), JSON.stringify(this.g.snapshot())); } catch (e) { this.toast('Speichern nicht möglich.'); } }
    autosave() {
      const g = this.g;
      if (!g.state || !g.roomDef || g.roomDef.id === 'title' || g.cutscene || g.inDialog || g.roomDef.noSave) return;
      try { localStorage.setItem(this.key('auto'), JSON.stringify(g.snapshot())); } catch (e) { /* voll */ }
    }

    // ---------- Tagebuch ----------
    toggleDiary(force) {
      this.diaryOpen = force === undefined ? !this.diaryOpen : force;
      $('#diary').classList.toggle('hidden', !this.diaryOpen);
      if (this.diaryOpen) this.showDiary('ziele');
    }
    showDiary(tab) {
      const g = this.g;
      document.querySelectorAll('.diary-tabs button[data-tab]').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
      const c = $('#diary-content');
      c.innerHTML = '';
      if (!g.state) { c.textContent = 'Kein Spiel geladen.'; return; }
      if (tab === 'ziele') {
        const list = g.state.objectives;
        if (!list.length) { c.textContent = 'Noch keine Einträge.'; return; }
        c.appendChild(U.el('h3', { text: 'Aktuelle Aufgabe' }));
        const cur = list.filter((o) => !o.done);
        if (cur.length) cur.forEach((o) => c.appendChild(U.el('p', { class: 'now', text: o.text })));
        else c.appendChild(U.el('p', { text: 'Nichts Offenes.' }));
        const done = list.filter((o) => o.done);
        if (done.length) {
          c.appendChild(U.el('h3', { text: 'Erledigt' }));
          done.slice().reverse().forEach((o) => c.appendChild(U.el('p', { class: 'done', text: o.text })));
        }
      } else {
        const ids = g.state.codex;
        if (!ids.length) { c.textContent = 'Der Kodex ist noch leer. Er füllt sich, wenn Falk auf Spuren alter Mythen stößt.'; return; }
        for (const id of ids) {
          const e = ATL.codex[id];
          if (!e) continue;
          const d = U.el('div', { class: 'kodex-entry' });
          d.appendChild(U.el('h3', { text: e.title }));
          if (e.origin) d.appendChild(U.el('small', { text: e.origin }));
          e.text.split('\n').forEach((p) => d.appendChild(U.el('p', { text: p })));
          c.appendChild(d);
        }
      }
    }
  }

  ATL.UI = UI;
})(window.ATL);
