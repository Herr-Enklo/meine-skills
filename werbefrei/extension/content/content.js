// Werbefrei – Inhaltsskript. Läuft in jeder Seite ab dem ersten Byte (document_start).
//
// 1. Meldet dem Service Worker die Klassen und ids der Seite. Er antwortet mit den passenden
//    Elementfiltern aus den Listen und blendet sie per Nutzer-Stylesheet aus.
// 2. Erkennt Werbeplätze, die keine Liste kennt:
//    - Kästen, die nur aus einer Kennzeichnung wie "Anzeige" und einem Werberahmen bestehen,
//    - Werbecontainer, die leer zurückbleiben, weil ihr Inhalt blockiert wurde,
//    - eingebettete Rahmen und Bilder von gesperrten Werbeservern.
// Ausgeblendet wird immer per CSS (display:none), nichts wird aus der Seite gelöscht. So bleiben
// Skripte der Seite heil, und "Auf dieser Seite aus" stellt alles wieder her.

(() => {
  'use strict';
  if (globalThis.__werbefreiInhalt) return;
  globalThis.__werbefreiInhalt = true;

  const ATTR = 'data-werbefrei-verborgen';
  const LABEL_WORDS = 'anzeigen?|werbung|werbeanzeige|advertisement|advertorial|sponsored|gesponsert|promoted|sponsored content';
  const LABEL_RE = new RegExp(`^[\\s\\-–—|:·•*()]*(?:${LABEL_WORDS})[\\s\\-–—|:·•*()]*$`, 'i');
  const LABEL_STRIP_RE = new RegExp(`\\b(?:${LABEL_WORDS})\\b`, 'gi');
  const AD_TOKENS = new Set([
    'ad', 'ads', 'adv', 'advert', 'adverts', 'advertising', 'advertisement', 'advertisements', 'adslot', 'adslots',
    'adunit', 'adbox', 'adcontainer', 'adwrapper', 'adspace', 'adplace', 'adplacement', 'adzone', 'adtag', 'adframe',
    // "anzeigen" fehlt absichtlich: Im Deutschen ist es auch das Verb ("Kommentare anzeigen").
    'anzeige', 'werbung', 'werbeflaeche', 'werbemittel', 'billboard', 'skyscraper', 'superbanner',
    'leaderboard', 'mrec', 'medrec', 'dfp', 'taboola', 'outbrain', 'teads', 'outstream', 'sponsoredcontent',
  ]);
  const SKIP_TEXT_PARENTS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA', 'OPTION', 'TITLE', 'TEMPLATE']);
  const MEDIA = 'img, picture, video, canvas, svg, object, embed, iframe, input, select, textarea, button';

  const state = {
    active: false,
    generic: false,
    heuristics: false,
    sentKeys: new Set(),
    keyedSelectors: [],
    pending: [],
    flushTimer: 0,
    scanTimer: 0,
    lastScan: 0,
    scans: 0,
    firstEmpty: new WeakMap(), // Element -> Zeitpunkt, an dem es zum ersten Mal leer war
    labelsSeen: new WeakSet(),
    revived: new WeakSet(), // leere Kästen, die sich doch noch gefüllt haben: nie wieder ausblenden
    hostVerdict: new Map(), // Hostname -> true (gesperrt) | false | 'offen'
    reasons: { kennzeichnung: 0, leer: 0, rahmen: 0, ersatz: 0 },
  };

  const send = (msg) => chrome.runtime.sendMessage(msg).catch(() => null);

  // Zuletzt rechts angeklicktes Element, für "Element ausblenden …" im Kontextmenü.
  document.addEventListener('contextmenu', (e) => {
    globalThis.__werbefreiZiel = { element: e.target, zeit: Date.now() };
  }, true);

  // -------------------------------------------------------------------------------------------
  // Klassen und ids melden
  // -------------------------------------------------------------------------------------------

  function collectKeys(el, out) {
    const id = el.id;
    if (id && typeof id === 'string') {
      const key = `#${id}`;
      if (!state.sentKeys.has(key)) { state.sentKeys.add(key); out.push(key); }
    }
    const list = el.classList;
    if (list) {
      for (let i = 0; i < list.length; i++) {
        const key = `.${list[i]}`;
        if (!state.sentKeys.has(key)) { state.sentKeys.add(key); out.push(key); }
      }
    }
  }

  function flush() {
    state.flushTimer = 0;
    const roots = state.pending;
    state.pending = [];
    if (!state.active) return;
    if (state.generic) {
      const keys = [];
      for (const root of roots) {
        if (root.nodeType !== 1 || !root.isConnected) continue;
        collectKeys(root, keys);
        const all = root.querySelectorAll('[id],[class]');
        for (let i = 0; i < all.length; i++) collectKeys(all[i], keys);
      }
      if (keys.length) {
        send({ type: 'generic', keys }).then((res) => {
          if (res?.selectors?.length) state.keyedSelectors.push(...res.selectors);
        });
      }
    }
    if (state.heuristics) scheduleScan(false);
  }

  function queue(node) {
    state.pending.push(node);
    if (!state.flushTimer) state.flushTimer = setTimeout(flush, state.active ? 60 : 0);
  }

  // Beobachtet wird erst nach der Antwort des Service Workers; bis dahin Hinzugekommenes erfasst
  // der erste Durchlauf über das ganze Dokument.
  const observer = new MutationObserver((records) => {
    for (const r of records) {
      for (const n of r.addedNodes) if (n.nodeType === 1) queue(n);
    }
  });

  // -------------------------------------------------------------------------------------------
  // Heuristiken
  // -------------------------------------------------------------------------------------------

  function hide(el, reason) {
    if (!el || el.hasAttribute(ATTR)) return false;
    el.setAttribute(ATTR, reason);
    state.reasons[reason]++;
    return true;
  }

  function adTokens(el) {
    const cls = typeof el.className === 'string' ? el.className : el.getAttribute('class') || '';
    const raw = `${el.id || ''} ${cls}`;
    if (raw.length < 2) return false;
    const tokens = raw.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase().split(/[^a-z0-9]+/);
    for (const t of tokens) {
      if (!t) continue;
      if (AD_TOKENS.has(t) || AD_TOKENS.has(t.replace(/\d+$/, ''))) return true;
    }
    return false;
  }

  function hasAdHint(el) {
    return adTokens(el) || el.hasAttribute('data-ad-slot') || el.hasAttribute('data-google-query-id');
  }

  /** Teile der Seite, die nie ausgeblendet werden, egal was eine Heuristik meint. */
  function isProtected(el) {
    if (el === document.body || el === document.documentElement || el === document.head) return true;
    const tag = el.tagName;
    if (tag === 'MAIN' || tag === 'H1' || tag === 'FORM') return true;
    if (el.matches('[itemprop="articleBody"], [role="main"], [contenteditable="true"], [contenteditable=""]')) return true;
    if (el.querySelector('h1, main, [itemprop="articleBody"], input:not([type="hidden"]), textarea, select')) return true;
    const active = document.activeElement;
    if (active && active !== document.body && el.contains(active)) return true;
    const r = el.getBoundingClientRect();
    if (r.height > innerHeight * 1.5 && r.width > innerWidth * 0.6) return true;
    return false;
  }

  /**
   * Text eines Elements ohne Skripte und Styles (Werbeplätze enthalten oft Inline-Skripte) und
   * unabhängig davon, ob er gerade sichtbar ist. Liest höchstens etwa `limit` Zeichen.
   */
  function textOf(el, limit = 600) {
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, {
      acceptNode: (n) => (SKIP_TEXT_PARENTS.has(n.parentElement?.tagName) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
    });
    let text = '';
    for (let n = walker.nextNode(); n && text.length <= limit; n = walker.nextNode()) text += ` ${n.data}`;
    return text;
  }

  /** Länge des Textes ohne Kennzeichnungen wie "Anzeige" und ohne Leer- und Satzzeichen. */
  function otherTextLength(el) {
    const text = textOf(el);
    if (text.length > 400) return text.length;
    return text.replace(LABEL_STRIP_RE, '').replace(/[\s\-–—|:·•*()]+/g, '').length;
  }

  function looksLikeAdBlock(el) {
    if (hasAdHint(el)) return true;
    if (el.querySelector(`[${ATTR}]`)) return true; // enthält schon einen ausgeblendeten Werbeplatz
    if (el.querySelector('iframe, ins, object, embed, [id^="div-gpt-ad"], [id^="google_ads"], [data-ad-slot], [data-google-query-id]')) return true;
    const hinted = el.querySelectorAll('[id],[class]');
    for (let i = 0; i < hinted.length && i < 50; i++) if (hasAdHint(hinted[i])) return true;
    return false;
  }

  /** Eine Kennzeichnung ("Anzeige") gefunden: den Kasten drumherum ausblenden. */
  const INTERACTIVE = 'a[href], button, summary, label, [role="button"], [role="menuitem"], [role="tab"], [onclick], [tabindex]:not([tabindex="-1"])';

  // Hier steht "Werbung" als Menüpunkt, Link oder Einwilligungszweck, nicht als Kennzeichnung.
  const NOT_A_LABEL =
    'a, button, nav, footer, form, select, label, h1, dialog, summary, [role="button"], [onclick], [tabindex]:not([tabindex="-1"]), ' +
    '[role="navigation"], [role="menu"], [role="menubar"], ' +
    '[role="tablist"], [role="dialog"], [aria-modal="true"], [id*="consent" i], [class*="consent" i], ' +
    '[id*="cookie" i], [class*="cookie" i], [id*="privacy" i], [id*="onetrust" i], [id*="cmp" i], [class*="cmp-" i]';

  function handleLabel(label) {
    if (label.closest(NOT_A_LABEL)) return;
    if (label.closest(`[${ATTR}]`)) return;

    // Nach oben gehen, solange der Kasten außer der Kennzeichnung (fast) keinen Text enthält.
    let box = label;
    for (let depth = 0; depth < 8; depth++) {
      const parent = box.parentElement;
      if (!parent || isProtected(parent)) break;
      if (otherTextLength(parent) > 20) break;
      if (parent.querySelector('video') && !hasAdHint(parent)) break; // Videoplayer mit Werbeeinblendung
      const r = parent.getBoundingClientRect();
      if (r.width > 1100 || r.height > 800) break; // größer als jedes übliche Werbeformat
      box = parent;
    }

    // Einzelne Tabellenzellen nie ausblenden, das verschiebt die Spalten der ganzen Tabelle.
    if (box.tagName === 'TD' || box.tagName === 'TH') return;
    if (box !== label) {
      // Werbe-Indiz im Kasten, oder ein großer leerer Kasten, in dem nur noch die Kennzeichnung steht.
      const blank = box.getBoundingClientRect().height >= 60 && !box.querySelector('a[href], button, input, [role="button"]');
      if (looksLikeAdBlock(box) || blank) hide(box, 'kennzeichnung');
      return;
    }

    // Kennzeichnung steht allein, der Werbeplatz folgt direkt dahinter.
    const next = label.nextElementSibling;
    if (next && !isProtected(next) && looksLikeAdBlock(next) && otherTextLength(next) <= 20) {
      hide(label, 'kennzeichnung');
      hide(next, 'kennzeichnung');
      return;
    }

    // Gesponserter Beitrag in einer Liste von Artikelanrissen.
    const card = label.closest('article, li, [class*="teaser" i], [class*="card" i]');
    if (!card || card === label) return;
    let levels = 0;
    for (let n = label; n && n !== card; n = n.parentElement) levels++;
    if (levels > 6 || isProtected(card)) return;
    if ((card.textContent || '').trim().length > 400) return;
    if (!card.querySelector('a[href]')) return;
    const siblings = card.parentElement ? card.parentElement.children.length : 0;
    if (siblings < 2) return;
    hide(card, 'kennzeichnung');
  }

  function scanLabels() {
    if (!document.body) return;
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const t = node.data;
        if (t.length > 40 || t.length < 2) return NodeFilter.FILTER_SKIP;
        return LABEL_RE.test(t) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
      },
    });
    const labels = [];
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const el = n.parentElement;
      if (!el || SKIP_TEXT_PARENTS.has(el.tagName) || state.labelsSeen.has(el)) continue;
      state.labelsSeen.add(el);
      labels.push(el);
    }
    for (const el of labels) handleLabel(el);
  }

  function hostOf(url) {
    try {
      const u = new URL(url, location.href);
      return u.protocol === 'http:' || u.protocol === 'https:' ? u.hostname : null;
    } catch {
      return null;
    }
  }

  /** Rahmen und Bilder von gesperrten Werbeservern einklappen, sonst bleiben leere Kästen stehen. */
  async function collapseBlockedFrames() {
    const elements = document.querySelectorAll(`iframe[src]:not([${ATTR}]), img[src]:not([${ATTR}])`);
    const byHost = new Map();
    for (const el of elements) {
      const host = hostOf(el.getAttribute('src'));
      if (!host || host === location.hostname) continue;
      if (!byHost.has(host)) byHost.set(host, []);
      byHost.get(host).push(el);
    }
    const unknown = [...byHost.keys()].filter((h) => !state.hostVerdict.has(h));
    if (unknown.length) {
      unknown.forEach((h) => state.hostVerdict.set(h, 'offen'));
      const res = await send({ type: 'checkHosts', hosts: unknown });
      const blocked = new Set(res?.blocked || []);
      unknown.forEach((h) => state.hostVerdict.set(h, blocked.has(h)));
    }
    for (const [host, els] of byHost) {
      if (state.hostVerdict.get(host) === true) els.forEach((el) => hide(el, 'rahmen'));
    }
  }

  function frameIsAdLike(frame) {
    if (frame.hasAttribute(ATTR)) return true;
    const src = frame.getAttribute('src') || '';
    if (!src || src === 'about:blank' || src.startsWith('javascript:')) return true;
    const host = hostOf(src);
    if (host && state.hostVerdict.get(host) === true) return true;
    return hasAdHint(frame) || /google_ads|ad[_-]?frame/i.test(frame.id || frame.name || '');
  }

  /** Ist der Werbecontainer leer, also ohne Text und ohne sichtbare Bilder oder Inhalte? */
  /** Bild mit echter Quelle (auch wenn es verzögert lädt und noch 0×0 groß ist)? */
  function hasRealSource(m) {
    const source = m.querySelector('source');
    const src = m.currentSrc || m.getAttribute('src') || m.getAttribute('data-src') || m.getAttribute('srcset') ||
      source?.getAttribute('src') || source?.getAttribute('srcset') || '';
    if (!src || src.startsWith('data:image/gif') || src === 'about:blank') return false;
    const host = hostOf(src.split(/\s/)[0]);
    return !(host && state.hostVerdict.get(host) === true);
  }

  function hasContent(el) {
    if (otherTextLength(el) > 0) return true;
    for (const m of el.querySelectorAll(MEDIA)) {
      if (m.hasAttribute(ATTR) || m.parentElement?.closest(`[${ATTR}]:not([${ATTR}="leer"])`)) continue;
      if (m.tagName === 'IFRAME') {
        if (frameIsAdLike(m)) continue;
        return true;
      }
      if (m.tagName === 'IMG' || m.tagName === 'VIDEO' || m.tagName === 'PICTURE') {
        if (m.tagName === 'PICTURE' || hasRealSource(m)) {
          const w = Number(m.getAttribute('width')), h = Number(m.getAttribute('height'));
          if (w && h && w * h <= 4) continue; // Zählpixel
          return true;
        }
        continue;
      }
      const mr = m.getBoundingClientRect();
      if (mr.width * mr.height >= 16) return true;
    }
    return false;
  }

  /** Ist der Werbecontainer leer, also ohne Text und ohne Bilder oder andere Inhalte? */
  function isEmptyAdBox(el) {
    const r = el.getBoundingClientRect();
    // Nur Kästen, die sichtbar Platz belegen. Eine einzelne Zeile wie eine Dachzeile "Werbung"
    // ist kein Werbeplatz, auch wenn ihre Klasse danach klingt. Und nichts, das größer ist als
    // jedes Werbeformat: Das ist ein Seitenbereich, dessen Klasse zufällig passt.
    if (r.width < 30 || r.height < 30 || r.width > 1500 || r.height > 1300) return false;
    if (hasContent(el)) return false;
    const style = getComputedStyle(el);
    if (style.backgroundImage && style.backgroundImage !== 'none' && !style.backgroundImage.startsWith('linear-gradient')) return false;
    return true;
  }

  /** Ein als leer ausgeblendeter Kasten hat sich doch gefüllt: wieder zeigen. */
  function reviveFilled() {
    for (const el of document.querySelectorAll(`[${ATTR}="leer"]`)) {
      if (hasContent(el)) {
        el.removeAttribute(ATTR);
        state.reasons.leer--;
        state.revived.add(el);
      }
    }
  }

  // -------------------------------------------------------------------------------------------
  // Ersatzanzeigen: Manche Seiten erkennen den Werbeblocker und blenden dann Werbung als Bild über
  // die eigene Domain ein, in Containern mit Namen, die bei jedem Laden neu ausgewürfelt werden
  // (etwa "pszFwpCl"). Erkennungsmerkmal ist die Kombination aus Bild in einem Standard-Werbeformat
  // und solchen Zufallsnamen in den umschließenden Containern.
  // -------------------------------------------------------------------------------------------

  const AD_SIZES = [
    [300, 250], [336, 280], [728, 90], [970, 90], [970, 250], [160, 600], [120, 600], [300, 600],
    [300, 1050], [320, 50], [320, 100], [468, 60], [250, 250], [800, 250], [994, 250], [1000, 250],
  ];

  function isAdSize(w, h) {
    return AD_SIZES.some(([aw, ah]) => Math.abs(w - aw) <= 3 && Math.abs(h - ah) <= 3);
  }

  /** Klingt ein Klassen- oder id-Name ausgewürfelt? Nur Buchstaben, gemischte Schreibung, kaum Vokale. */
  function looksRandom(name) {
    if (!name || !/^[A-Za-z]{7,16}$/.test(name)) return false;
    const upper = name.replace(/[^A-Z]/g, '').length;
    if (upper < 2) return false;
    const vowels = name.replace(/[^aeiouAEIOU]/g, '').length;
    return vowels / name.length < 0.3;
  }

  function hasRandomName(el) {
    if (looksRandom(el.id)) return true;
    const list = el.classList;
    for (let i = 0; i < list.length; i++) if (looksRandom(list[i])) return true;
    return false;
  }

  function scanReplacementAds() {
    for (const m of document.querySelectorAll(`img:not([${ATTR}]), iframe:not([${ATTR}]), canvas:not([${ATTR}])`)) {
      if (m.closest(`[${ATTR}]`)) continue;
      const r = m.getBoundingClientRect();
      if (!isAdSize(r.width, r.height)) continue;
      // Von innen nach außen: der äußerste Container mit Zufallsnamen, höchstens vier Ebenen.
      let target = null;
      let node = m.parentElement;
      for (let depth = 0; node && depth < 4 && node !== document.body; depth++, node = node.parentElement) {
        if (hasRandomName(node)) target = node;
        else if (target) break;
      }
      if (!target || isProtected(target)) continue;
      if (otherTextLength(target) > 40) continue; // echter Inhalt mit Text, keine Bildanzeige
      hide(target, 'ersatz');
    }
  }

  function scanEmptySlots(now) {
    const candidates = document.querySelectorAll(`[id]:not([${ATTR}]),[class]:not([${ATTR}]),[data-ad-slot]:not([${ATTR}])`);
    for (const el of candidates) {
      if (el === document.body || el === document.documentElement || el.tagName === 'MAIN') continue;
      if (el.tagName === 'TD' || el.tagName === 'TH') continue; // Zellen verschieben sonst die Tabelle
      if (state.revived.has(el) || !hasAdHint(el)) continue;
      if (el.closest(INTERACTIVE)) continue; // Knöpfe, Links, Menüs sind nie ein leerer Werbeplatz
      if (el.parentElement?.closest(`[${ATTR}]`) || el.closest('h1, h2, h3, h4, h5, h6')) continue;
      if (!isEmptyAdBox(el)) {
        state.firstEmpty.delete(el);
        continue;
      }
      // Erst ausblenden, wenn der Kasten über mehrere Durchläufe leer bleibt. Werbeskripte
      // füllen Container oft erst nach und nach, und ein Kasten, der sich doch noch mit echtem
      // Inhalt füllt, soll nicht verschwinden.
      const since = state.firstEmpty.get(el);
      if (since === undefined) state.firstEmpty.set(el, now);
      else if (now - since >= 1200 && !isProtected(el)) hide(el, 'leer');
    }
  }

  async function scan() {
    state.scanTimer = 0;
    if (!state.active || !state.heuristics || !document.body) return;
    state.lastScan = Date.now();
    state.scans++;
    try {
      await collapseBlockedFrames();
      reviveFilled();
      scanReplacementAds();
      scanLabels();
      scanEmptySlots(Date.now());
    } catch (e) {
      // Eine Heuristik darf die Seite nie stören.
    }
  }

  function scheduleScan(soon) {
    if (state.scanTimer || !state.heuristics) return;
    // Viele Änderungen hintereinander: höchstens alle 1,5 s ein Durchlauf, später seltener.
    const gap = state.scans > 20 ? 5000 : 1500;
    const wait = soon ? 0 : Math.max(0, state.lastScan + gap - Date.now());
    state.scanTimer = setTimeout(() => {
      if ('requestIdleCallback' in window) requestIdleCallback(() => scan(), { timeout: 1000 });
      else scan();
    }, wait);
  }

  // -------------------------------------------------------------------------------------------
  // Zählen für das Popup
  // -------------------------------------------------------------------------------------------

  function countHidden(selectors) {
    const matched = new Set();
    const addAll = (list) => {
      for (let i = 0; i < list.length; i += 200) {
        const chunk = list.slice(i, i + 200);
        try {
          document.querySelectorAll(chunk.join(',')).forEach((el) => matched.add(el));
        } catch {
          for (const s of chunk) {
            try { document.querySelectorAll(s).forEach((el) => matched.add(el)); } catch { /* ungültig */ }
          }
        }
      }
    };
    addAll(selectors || []);
    addAll(state.keyedSelectors);
    document.querySelectorAll(`[${ATTR}]`).forEach((el) => matched.add(el));
    let outer = 0;
    for (const el of matched) {
      let p = el.parentElement;
      let nested = false;
      while (p) {
        if (matched.has(p)) { nested = true; break; }
        p = p.parentElement;
      }
      if (!nested) outer++;
    }
    return outer;
  }

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (sender.id !== chrome.runtime.id || msg?.type !== 'werbefrei:zaehlen') return false;
    sendResponse({
      active: state.active,
      hidden: state.active ? countHidden(Array.isArray(msg.selectors) ? msg.selectors : []) : 0,
      reasons: { ...state.reasons },
    });
    return false;
  });

  // -------------------------------------------------------------------------------------------
  // Start
  // -------------------------------------------------------------------------------------------

  send({ type: 'init' }).then((res) => {
    if (!res?.active) return;
    state.active = true;
    state.generic = res.generic;
    state.heuristics = res.heuristics;
    observer.observe(document, { childList: true, subtree: true });
    queue(document.documentElement);
    if (state.heuristics) {
      const later = () => {
        scheduleScan(true);
        setTimeout(() => scheduleScan(true), 1500);
        setTimeout(() => scheduleScan(true), 4000);
        setTimeout(() => scheduleScan(true), 9000);
      };
      if (document.readyState === 'complete') later();
      else window.addEventListener('load', later, { once: true });
      if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => scheduleScan(true), { once: true });
    }
  });
})();
