// Werbefrei – Element-Auswahl. Wird bei Bedarf in die Seite geladen (Popup, Kontextmenü,
// Tastenkürzel). Der Nutzer zeigt auf ein Element, Werbefrei schlägt einen CSS-Selektor vor, und
// "Ausblenden" speichert ihn als eigene Regel für diese Website.

(() => {
  'use strict';
  if (globalThis.__werbefreiAuswahl) {
    globalThis.__werbefreiAuswahl.close();
    return;
  }

  const HOST_ID = 'werbefrei-auswahl';
  const PREVIEW_ID = 'werbefrei-vorschau';
  const Z = '2147483647';

  const host = document.createElement('div');
  host.id = HOST_ID;
  host.style.cssText = `all:initial;position:fixed;inset:0;z-index:${Z};pointer-events:none;`;
  const shadow = host.attachShadow({ mode: 'closed' });

  shadow.innerHTML = `
<style>
  :host { all: initial; }
  * { box-sizing: border-box; }
  .catcher { position: fixed; inset: 0; pointer-events: auto; cursor: crosshair; background: transparent; }
  .mark { position: fixed; pointer-events: none; border: 2px solid #e5484d; background: rgba(229, 72, 77, 0.16);
    border-radius: 3px; transition: all 60ms ease-out; display: none; }
  .mark.locked { border-color: #0f6e5a; background: rgba(15, 110, 90, 0.16); }
  .tag { position: fixed; pointer-events: none; display: none; max-width: 70vw; overflow: hidden; text-overflow: ellipsis;
    white-space: nowrap; font: 500 12px/1.4 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; color: #fff;
    background: #1c2024; padding: 3px 7px; border-radius: 4px; }
  .panel { position: fixed; right: 16px; bottom: 16px; width: 390px; max-width: calc(100vw - 32px); pointer-events: auto;
    font: 14px/1.45 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; color: #1c2024; background: #fff;
    border: 1px solid #d9dde1; border-radius: 12px; box-shadow: 0 12px 32px rgba(0,0,0,.18); padding: 14px 16px 16px; }
  .panel.left { right: auto; left: 16px; }
  .head { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 6px; }
  .title { font-weight: 650; font-size: 15px; }
  .move { border: 0; background: none; color: #60676e; cursor: pointer; font: inherit; font-size: 12px; padding: 2px 4px; }
  .move:hover { color: #1c2024; }
  p { margin: 0 0 8px; color: #3c4349; }
  .keys { font-size: 12px; color: #60676e; }
  kbd { font: 11px/1 ui-monospace, Menlo, Consolas, monospace; border: 1px solid #c9ced3; border-bottom-width: 2px;
    border-radius: 4px; padding: 2px 4px; background: #f6f7f8; color: #1c2024; }
  textarea { width: 100%; min-height: 64px; resize: vertical; font: 12.5px/1.45 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    color: #1c2024; background: #f6f7f8; border: 1px solid #c9ced3; border-radius: 8px; padding: 8px 10px; }
  textarea:focus { outline: 2px solid #0f6e5a; outline-offset: 1px; background: #fff; }
  .status { font-size: 12.5px; margin: 6px 0 10px; color: #3c4349; min-height: 18px; }
  .status.bad { color: #c3272d; }
  .row { display: flex; gap: 6px; flex-wrap: wrap; align-items: center; }
  .row + .row { margin-top: 8px; }
  .row.actions { flex-wrap: nowrap; }
  button.b { font: inherit; font-size: 13px; border-radius: 8px; border: 1px solid #c9ced3; background: #fff; color: #1c2024;
    padding: 6px 12px; cursor: pointer; }
  button.b:hover { background: #f1f3f5; }
  button.b:focus-visible { outline: 2px solid #0f6e5a; outline-offset: 1px; }
  button.primary { background: #0f6e5a; border-color: #0f6e5a; color: #fff; font-weight: 600; }
  button.primary:hover { background: #0c5c4b; }
  button.primary:disabled { background: #9bb8b0; border-color: #9bb8b0; cursor: default; }
  .spacer { flex: 1; }
  label.check { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; color: #3c4349; cursor: pointer; }
  .done { color: #0f6e5a; font-weight: 600; }
  [hidden] { display: none !important; }
</style>
<div class="catcher"></div>
<div class="mark"></div>
<div class="tag"></div>
<div class="panel" role="dialog" aria-label="Element ausblenden">
  <div class="head"><span class="title">Element ausblenden</span><button class="move" type="button" title="Fenster auf die andere Seite">⇆</button></div>
  <section class="pick">
    <p>Zeige auf die Werbung und klicke sie an.</p>
    <p class="keys"><kbd>↑</kbd> größer · <kbd>↓</kbd> kleiner · <kbd>Esc</kbd> abbrechen</p>
    <div class="row"><span class="spacer"></span><button class="b cancel" type="button">Abbrechen</button></div>
  </section>
  <section class="confirm" hidden>
    <textarea spellcheck="false" aria-label="CSS-Selektor"></textarea>
    <div class="status" aria-live="polite"></div>
    <div class="row">
      <button class="b up" type="button" title="Übergeordnetes Element (↑)">Größer</button>
      <button class="b down" type="button" title="Inneres Element (↓)">Kleiner</button>
      <span class="spacer"></span>
      <label class="check"><input type="checkbox" class="preview"> Vorschau</label>
    </div>
    <div class="row actions">
      <button class="b primary save" type="button">Ausblenden</button>
      <button class="b repick" type="button">Neu wählen</button>
      <span class="spacer"></span>
      <button class="b cancel" type="button">Abbrechen</button>
    </div>
  </section>
  <section class="saved" hidden><p class="done"></p><p class="keys">Rückgängig: Einstellungen › Eigene Regeln.</p></section>
</div>`;

  const $ = (sel) => shadow.querySelector(sel);
  const catcher = $('.catcher');
  const mark = $('.mark');
  const tag = $('.tag');
  const panel = $('.panel');
  const textarea = $('textarea');
  const status = $('.status');
  const previewBox = $('.preview');
  const saveButton = $('.save');

  let hovered = null;
  let chain = []; // vom angeklickten Element nach oben
  let level = 0;
  let locked = false;

  // --- Selektor bilden ----------------------------------------------------------------------

  const STATE_CLASS = /^(is|has|js)-|^(active|open|opened|closed|visible|hidden|show|hide|hover|focus|selected|loaded|loading|lazy|sticky|fixed|in-view|animated?)$/i;

  function looksGenerated(name) {
    return (
      /\d{3,}/.test(name) ||
      /^(css|sc|jsx|emotion|styled|svelte|tw|chakra|mui|Mui)[-_]/.test(name) ||
      /[a-z][A-Z0-9][a-z0-9]*[A-Z0-9]/.test(name.replace(/^[A-Za-z]+[-_]/, '')) && /[-_][A-Za-z0-9]{5,}$/.test(name) ||
      /^[a-z0-9]{6,}$/i.test(name) && /\d/.test(name) && /[a-z]/i.test(name)
    );
  }

  function stableId(el) {
    const id = el.id;
    return id && /^[A-Za-z][\w-]{1,60}$/.test(id) && !looksGenerated(id) ? id : null;
  }

  function stableClasses(el) {
    return [...el.classList].filter((c) => /^[A-Za-z_][\w-]{1,50}$/.test(c) && !STATE_CLASS.test(c) && !looksGenerated(c)).slice(0, 3);
  }

  function segment(el) {
    const id = stableId(el);
    if (id) return `#${CSS.escape(id)}`;
    const classes = stableClasses(el);
    return el.localName + classes.map((c) => `.${CSS.escape(c)}`).join('');
  }

  function nthOfType(el) {
    let n = 1;
    for (let s = el.previousElementSibling; s; s = s.previousElementSibling) if (s.localName === el.localName) n++;
    return n;
  }

  function selectorFor(el) {
    const own = segment(el);
    if (own !== el.localName) return own;
    // Ohne id und Klassen: Pfad bis zum nächsten Vorfahren mit Namen, mit Position.
    const parts = [];
    let cur = el;
    while (cur && cur !== document.body && cur !== document.documentElement && parts.length < 6) {
      const seg = segment(cur);
      if (seg !== cur.localName) {
        parts.unshift(seg);
        return parts.join(' > ');
      }
      parts.unshift(`${cur.localName}:nth-of-type(${nthOfType(cur)})`);
      cur = cur.parentElement;
    }
    parts.unshift('body');
    return parts.join(' > ');
  }

  // --- Anzeige ------------------------------------------------------------------------------

  function elementAt(x, y) {
    for (const el of document.elementsFromPoint(x, y)) {
      if (el === host || el === document.documentElement || el === document.body) continue;
      return el;
    }
    return null;
  }

  function place(el) {
    if (!el || !el.isConnected) {
      mark.style.display = 'none';
      tag.style.display = 'none';
      return;
    }
    const r = el.getBoundingClientRect();
    Object.assign(mark.style, { display: 'block', left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px` });
    mark.classList.toggle('locked', locked);
    tag.textContent = `${selectorFor(el)}  ${Math.round(r.width)}×${Math.round(r.height)}`;
    tag.style.display = 'block';
    const top = r.top > 28 ? r.top - 26 : Math.min(innerHeight - 26, r.bottom + 4);
    Object.assign(tag.style, { left: `${Math.max(4, Math.min(r.left, innerWidth - 300))}px`, top: `${top}px` });
  }

  function current() {
    return chain[level] || null;
  }

  function countMatches(selector) {
    try {
      const all = document.querySelectorAll(selector);
      let n = 0;
      for (const el of all) if (!host.contains(el)) n++;
      return n;
    } catch {
      return -1;
    }
  }

  function updateStatus() {
    const selector = textarea.value.trim();
    const n = selector ? countMatches(selector) : 0;
    status.classList.toggle('bad', n <= 0);
    if (n < 0) status.textContent = 'Dieser Selektor ist ungültig.';
    else if (n === 0) status.textContent = 'Trifft auf dieser Seite kein Element.';
    else status.textContent = n === 1 ? 'Trifft 1 Element.' : `Trifft ${n} Elemente.`;
    saveButton.disabled = n <= 0;
    updatePreview();
  }

  function updatePreview() {
    let style = document.getElementById(PREVIEW_ID);
    if (!previewBox.checked || !locked) {
      style?.remove();
      mark.style.visibility = 'visible';
      return;
    }
    if (!style) {
      style = document.createElement('style');
      style.id = PREVIEW_ID;
      (document.head || document.documentElement).appendChild(style);
    }
    const selector = textarea.value.trim();
    style.textContent = countMatches(selector) > 0 ? `${selector}{display:none!important}` : '';
    mark.style.visibility = 'hidden';
  }

  function show(section) {
    for (const name of ['pick', 'confirm', 'saved']) $(`.${name}`).hidden = name !== section;
  }

  function lock(el) {
    chain = [];
    for (let n = el; n && n !== document.body && n !== document.documentElement; n = n.parentElement) chain.push(n);
    if (!chain.length) return;
    level = 0;
    locked = true;
    show('confirm');
    refreshLocked();
    textarea.focus({ preventScroll: true });
  }

  function refreshLocked() {
    const el = current();
    textarea.value = el ? selectorFor(el) : '';
    $('.up').disabled = level >= chain.length - 1;
    $('.down').disabled = level <= 0;
    place(el);
    updateStatus();
  }

  function resize(step) {
    if (!locked) {
      // Beim Zeigen: vom Element unter der Maus aus größer werden.
      if (step > 0 && hovered?.parentElement && hovered.parentElement !== document.body) hovered = hovered.parentElement;
      place(hovered);
      return;
    }
    level = Math.max(0, Math.min(chain.length - 1, level + step));
    refreshLocked();
  }

  // --- Ereignisse ---------------------------------------------------------------------------

  catcher.addEventListener('mousemove', (e) => {
    if (locked) return;
    const el = elementAt(e.clientX, e.clientY);
    if (el !== hovered) {
      hovered = el;
      place(el);
    }
  });

  catcher.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    const el = locked ? elementAt(e.clientX, e.clientY) : hovered || elementAt(e.clientX, e.clientY);
    if (el) {
      previewBox.checked = false;
      lock(el);
    }
  });

  // Mit dem Mausrad scrollt die Seite weiter; der Fänger lässt es durch.
  catcher.addEventListener('wheel', () => {
    catcher.style.pointerEvents = 'none';
    clearTimeout(catcher._t);
    catcher._t = setTimeout(() => { catcher.style.pointerEvents = 'auto'; }, 150);
  }, { passive: true });

  function onKey(e) {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      close();
      return;
    }
    if (shadow.activeElement === textarea) {
      // Tippen im Selektorfeld: Tastenkürzel der Seite nicht auslösen.
      e.stopPropagation();
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        save();
      }
      return;
    }
    if (e.key === 'ArrowUp') { e.preventDefault(); e.stopPropagation(); resize(1); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); e.stopPropagation(); resize(-1); }
    else if (e.key === 'Enter' && locked && !e.shiftKey) { e.preventDefault(); e.stopPropagation(); save(); }
    else if (e.key === 'Enter' && !locked && hovered) { e.preventDefault(); lock(hovered); }
  }

  function onScroll() {
    place(locked ? current() : hovered);
  }

  textarea.addEventListener('input', () => {
    updateStatus();
    const selector = textarea.value.trim();
    if (countMatches(selector) > 0) {
      const first = [...document.querySelectorAll(selector)].find((el) => !host.contains(el));
      place(first);
    }
  });
  previewBox.addEventListener('change', updatePreview);
  $('.up').addEventListener('click', () => resize(1));
  $('.down').addEventListener('click', () => resize(-1));
  $('.repick').addEventListener('click', () => {
    locked = false;
    previewBox.checked = false;
    updatePreview();
    show('pick');
    place(hovered);
  });
  shadow.querySelectorAll('.cancel').forEach((b) => b.addEventListener('click', close));
  $('.move').addEventListener('click', () => panel.classList.toggle('left'));
  saveButton.addEventListener('click', save);

  async function save() {
    const selector = textarea.value.trim();
    if (countMatches(selector) <= 0) return;
    saveButton.disabled = true;
    let res = null;
    try {
      res = await chrome.runtime.sendMessage({ type: 'pickerSave', selector });
    } catch {
      res = null;
    }
    if (!res?.ok) {
      status.classList.add('bad');
      status.textContent = res?.error || 'Speichern hat nicht geklappt. Bitte die Seite neu laden und noch einmal versuchen.';
      saveButton.disabled = false;
      return;
    }
    // Sofort sichtbar machen; das Nutzer-Stylesheet des Service Workers greift parallel.
    try {
      document.querySelectorAll(selector).forEach((el) => el.style.setProperty('display', 'none', 'important'));
    } catch { /* bereits geprüft */ }
    $('.done').textContent = `Ausgeblendet. Die Regel gilt ab jetzt auf ${location.hostname.replace(/^www\d?\./, '')}.`;
    show('saved');
    mark.style.display = 'none';
    tag.style.display = 'none';
    catcher.style.pointerEvents = 'none';
    setTimeout(close, 1800);
  }

  function close() {
    window.removeEventListener('keydown', onKey, true);
    window.removeEventListener('scroll', onScroll, true);
    window.removeEventListener('resize', onScroll, true);
    document.getElementById(PREVIEW_ID)?.remove();
    host.remove();
    delete globalThis.__werbefreiAuswahl;
  }

  window.addEventListener('keydown', onKey, true);
  window.addEventListener('scroll', onScroll, true);
  window.addEventListener('resize', onScroll, true);
  document.documentElement.appendChild(host);
  globalThis.__werbefreiAuswahl = { close };

  // Aus dem Kontextmenü gestartet: das rechts angeklickte Element gleich vorschlagen.
  const target = globalThis.__werbefreiZiel;
  if (target && Date.now() - target.zeit < 15000 && target.element?.isConnected) {
    globalThis.__werbefreiZiel = null;
    const el = target.element.nodeType === 1 ? target.element : target.element.parentElement;
    if (el) lock(el);
  }
})();
