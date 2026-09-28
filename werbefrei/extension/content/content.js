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
    pendingAttr: new Set(), // Elemente, deren Klasse oder id sich geändert hat
    gate: null, // Attribut am <html>-Element, das eingefügtes CSS abschaltet
    generation: null, // Stand der Regeln, mit dem das Stylesheet eingefügt wurde
    cssInserted: false,
    flushTimer: 0,
    scanTimer: 0,
    lastScan: 0,
    scans: 0,
    firstEmpty: new WeakMap(), // Element -> Zeitpunkt, an dem es zum ersten Mal leer war
    labelsSeen: new WeakSet(),
    revived: new WeakSet(), // leere Kästen, die sich doch noch gefüllt haben: nie wieder ausblenden
    hostVerdict: new Map(), // Hostname -> true (gesperrt) | false | 'offen'
    reasons: { kennzeichnung: 0, leer: 0, rahmen: 0, ersatz: 0, cookie: 0 },
    cookies: false, // Cookie-Hinweise ausblenden
    autoConsent: false, // Abo-Abfragen mit "Einwilligen" beantworten
    consentClicked: new WeakSet(), // Zustimmungsknöpfe, die schon einmal geklickt wurden
    spVerdict: null, // Meldung aus dem Sourcepoint-Rahmen: 'normal' | 'bezahl'
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
    const changed = state.pendingAttr;
    state.pending = [];
    state.pendingAttr = new Set();
    if (!state.active) return;
    let adHint = false;
    if (state.generic) {
      const keys = [];
      for (const root of roots) {
        if (root.nodeType !== 1 || !root.isConnected) continue;
        collectKeys(root, keys);
        const all = root.querySelectorAll('[id],[class]');
        for (let i = 0; i < all.length; i++) collectKeys(all[i], keys);
      }
      // Nachträglich geänderte Klasse oder id: nur das Element selbst, nicht sein Inhalt.
      for (const el of changed) if (el.isConnected) collectKeys(el, keys);
      if (keys.length) {
        send({ type: 'generic', keys, gate: state.gate }).then((res) => {
          if (res?.selectors?.length) state.keyedSelectors.push(...res.selectors);
        });
      }
    }
    for (const el of changed) if (el.isConnected && hasAdHint(el)) adHint = true;
    if (cmpActive() && (roots.length || changed.size)) scanCookieBanners([...roots, ...changed]);
    if (state.heuristics && (roots.length || adHint)) scheduleScan(false);
  }

  function scheduleFlush() {
    if (!state.flushTimer) state.flushTimer = setTimeout(flush, state.active ? 60 : 0);
  }

  function queue(node) {
    state.pending.push(node);
    scheduleFlush();
  }

  // Beobachtet wird erst nach der Antwort des Service Workers; bis dahin Hinzugekommenes erfasst
  // der erste Durchlauf über das ganze Dokument.
  const observer = new MutationObserver((records) => {
    for (const r of records) {
      if (r.type === 'attributes') {
        state.pendingAttr.add(r.target);
        scheduleFlush();
        continue;
      }
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
  // (etwa "pszFwpCl"). Erkennungsmerkmal ist die Kombination aus einem Bild in Anzeigengröße ohne
  // Alternativtext und solchen Zufallsnamen in den umschließenden Containern. Die Größe folgt nicht
  // immer den Standardformaten, manche Seiten passen die Bilder der Spaltenbreite an.
  // -------------------------------------------------------------------------------------------

  const AD_SIZES = [
    [300, 250], [336, 280], [728, 90], [970, 90], [970, 250], [160, 600], [120, 600], [300, 600],
    [300, 1050], [320, 50], [320, 100], [468, 60], [250, 250], [800, 250], [994, 250], [1000, 250],
  ];

  function isAdSize(w, h) {
    if (AD_SIZES.some(([aw, ah]) => Math.abs(w - aw) <= 3 && Math.abs(h - ah) <= 3)) return true;
    return (w >= 250 && h >= 90) || (w >= 120 && h >= 400);
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
      // Bilder mit Beschreibung oder in figure/picture sind Inhalt der Seite.
      if (m.tagName === 'IMG' && (m.alt.trim() || m.closest('figure, picture'))) continue;
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
    if (!state.active || !document.body) return;
    state.lastScan = Date.now();
    state.scans++;
    try {
      if (cmpActive()) scanCookieBanners([]);
      if (!state.heuristics) return;
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
    if (state.scanTimer || !(state.heuristics || cmpActive())) return;
    // Viele Änderungen hintereinander: höchstens alle 1,5 s ein Durchlauf, später seltener.
    const gap = state.scans > 20 ? 5000 : 1500;
    const wait = soon ? 0 : Math.max(0, state.lastScan + gap - Date.now());
    state.scanTimer = setTimeout(() => {
      if ('requestIdleCallback' in window) requestIdleCallback(() => scan(), { timeout: 1000 });
      else scan();
    }, wait);
  }

  // -------------------------------------------------------------------------------------------
  // Cookie-Hinweise. Ausgeblendet werden gewöhnliche Einwilligungsbanner der verbreiteten
  // Anbieter; Werbefrei stimmt dabei nichts zu, die Seite verhält sich wie ohne Auswahl. Ein Dialog,
  // der statt der Zustimmung ein Abo anbietet (Pur-Abo, contentpass), bleibt stehen.
  // -------------------------------------------------------------------------------------------

  const COOKIE_BANNERS = [
    '#onetrust-consent-sdk', '#onetrust-banner-sdk', // OneTrust
    '#CybotCookiebotDialog', '#CybotCookiebotDialogBodyUnderlay', // Cookiebot
    '#usercentrics-root', '#usercentrics-cmp-ui', // Usercentrics
    '#didomi-host', // Didomi
    '#cmpwrapper', '#cmpbox', '#cmpbox2', '.cmpboxBG', // consentmanager
    '#BorlabsCookieBox', '#BorlabsCookieBoxWrap', // Borlabs Cookie
    '#cmplz-cookiebanner-container', // Complianz
    '.cky-consent-container', '.cky-overlay', '.cky-modal', // CookieYes
    '#cookie-law-info-bar', '.cli-modal-backdrop', // CookieLawInfo
    '#cookie-notice', // Cookie Notice
    '.qc-cmp2-container', // Quantcast Choice
    '#truste-consent-track', '.truste_overlay', '.truste_box_overlay', // TrustArc
    '.osano-cm-window', // Osano
    '#iubenda-cs-banner', // iubenda
    '.fc-consent-root', // Google Funding Choices
    '#cookiescript_injected', // Cookie Script
    '#tarteaucitronRoot', // tarteaucitron
    '#axeptio_overlay', // Axeptio
    '#shopify-pc__banner', // Shopify
    '#klaro', // Klaro
    '.c24-cookie-consent-wrapper', // check24
  ].join(',');
  const SOURCEPOINT = 'div[id^="sp_message_container_"]';
  // Knöpfe "Alle akzeptieren" der Anbieter, deren Dialog im Seitendokument liegt. Sourcepoint
  // übernimmt das Skript im Rahmen (cmp-rahmen.js).
  const ACCEPT_BUTTONS = [
    '.cmpboxbtnyes', // consentmanager
    '#onetrust-accept-btn-handler', // OneTrust
  ].join(',');
  const PAY_TEXT = /\bpur\b|pur-abo|abonn|\babo\b|contentpass|werbefrei|ohne werbung|subscribe|subscription|€/i;
  const SCROLL_ATTR = 'data-werbefrei-scroll';

  /**
   * Text eines Banners, auch aus offenen Shadow-DOM-Bereichen. Versteckte Ebenen im Banner
   * (Einstellungen, Anbieterlisten) zählen nicht: Dort steht oft "subscription" oder ein Preis eines
   * Drittanbieters, ohne dass der Dialog ein Abo anbietet. Ob der Banner selbst gerade zu sehen ist,
   * spielt keine Rolle: Er kann noch versteckt eingefügt oder schon von Werbefrei ausgeblendet sein,
   * und ein Abo-Angebot muss trotzdem erkannt werden.
   */
  function bannerText(el, budget = { left: 6000 }) {
    let text = '';
    const shown = new Map(); // Element → innerhalb des Banners nicht per display/content-visibility versteckt
    const shownInBanner = (node) => {
      const chain = [];
      let result = true;
      for (let cur = node; cur && cur !== el; cur = cur.parentElement || cur.getRootNode().host) {
        if (shown.has(cur)) {
          result = shown.get(cur);
          break;
        }
        chain.push(cur);
        const cs = getComputedStyle(cur);
        if (cs.display === 'none' || (cur !== node && cs.contentVisibility === 'hidden')) {
          result = false;
          break;
        }
      }
      // Die Kette reicht nur bis zum versteckten Element; alles darin ist ebenfalls versteckt.
      chain.forEach((c) => shown.set(c, result));
      return result;
    };
    const walk = (root) => {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, {
        acceptNode(node) {
          if (node.nodeType === 1) {
            // Versteckte Ebenen samt Inhalt überspringen (Anbieterlisten können lang sein).
            if (SKIP_TEXT_PARENTS.has(node.tagName) || !shownInBanner(node)) return NodeFilter.FILTER_REJECT;
            if (node.shadowRoot) walk(node.shadowRoot);
            return NodeFilter.FILTER_SKIP;
          }
          const parent = node.parentElement || node.parentNode?.host;
          return parent && getComputedStyle(parent).visibility === 'visible' ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
        },
      });
      for (let n = walker.nextNode(); n && budget.left > 0; n = walker.nextNode()) {
        text += ` ${n.data}`;
        budget.left -= n.data.length;
      }
    };
    walk(el);
    return text;
  }

  /**
   * Steht um einen Sourcepoint-Rahmen herum ein Abo-Angebot? Manche Seiten (golem.de) bauen den
   * Dialog selbst und holen nur den Zustimmungsknopf aus dem Rahmen. Gesucht wird nur in Kästen mit
   * höchstens 4000 Zeichen Text: Größer ist schon die ganze Seite, und dort steht "Abo" oft im Menü.
   */
  function payAround(container) {
    for (let cur = container.parentElement; cur && cur !== document.body; cur = cur.parentElement) {
      const text = bannerText(cur, { left: 4000 });
      if (text.length >= 4000) return false;
      if (PAY_TEXT.test(text)) return true;
    }
    return false;
  }

  /** Cookie-Hinweise ausblenden oder Abo-Abfragen beantworten: Ist eins davon eingeschaltet? */
  function cmpActive() {
    return state.cookies || state.autoConsent;
  }

  /**
   * Eine Abo-Abfrage mit "Einwilligen" beantworten, wenn das eingeschaltet ist. Jeder Knopf wird
   * höchstens einmal geklickt; schließt sich der Dialog danach nicht, bleibt er stehen.
   */
  function acceptPayDialog(el) {
    if (!state.autoConsent) return;
    const button = el.querySelector(ACCEPT_BUTTONS) || el.shadowRoot?.querySelector(ACCEPT_BUTTONS);
    if (!button || state.consentClicked.has(button)) return;
    state.consentClicked.add(button);
    button.click();
  }

  /** Einen gefundenen Banner behandeln: ausblenden, außer er bietet ein Abo an. */
  function handleBanner(el) {
    if (el.hasAttribute(ATTR) || el.parentElement?.closest(`[${ATTR}]`)) return;
    if (el.matches(SOURCEPOINT)) {
      // Den Text liest das Skript im Sourcepoint-Rahmen; ohne seine Meldung bleibt der Dialog stehen.
      // Die Einwilligung bei einer Abo-Abfrage klickt es ebenfalls dort.
      if (state.cookies && state.spVerdict === 'normal') hide(el, 'cookie');
      return;
    }
    if (PAY_TEXT.test(bannerText(el))) {
      acceptPayDialog(el);
      return;
    }
    if (state.cookies) hide(el, 'cookie');
  }

  function scanCookieBanners(roots) {
    if (!cmpActive()) return;
    const sel = `${COOKIE_BANNERS},${SOURCEPOINT}`;
    for (const root of roots) {
      if (root.nodeType !== 1 || !root.isConnected) continue;
      if (root.matches(sel)) handleBanner(root);
      root.querySelectorAll(sel).forEach(handleBanner);
    }
    // Hat ein ausgeblendeter Banner inzwischen ein Abo-Angebot geladen, wieder zeigen.
    for (const el of document.querySelectorAll(`[${ATTR}="cookie"]`)) {
      if (!el.matches(SOURCEPOINT) && PAY_TEXT.test(bannerText(el))) {
        el.removeAttribute(ATTR);
        state.reasons.cookie--;
        acceptPayDialog(el);
      }
    }
    unlockScroll();
  }

  /** Die Scroll-Sperre aufheben, die ein ausgeblendeter Cookie-Hinweis gesetzt hat. */
  function unlockScroll() {
    const root = document.documentElement;
    if (!state.cookies || !document.querySelector(`[${ATTR}="cookie"]`) || !document.body) {
      root.removeAttribute(SCROLL_ATTR);
      return;
    }
    // Steht noch ein sichtbarer Abo-Dialog, bleibt die Sperre.
    const visibleDialog = [...document.querySelectorAll(`${COOKIE_BANNERS},${SOURCEPOINT}`)].some(
      (el) => !el.closest(`[${ATTR}]`) && el.getBoundingClientRect().height > 0,
    );
    if (visibleDialog) {
      root.removeAttribute(SCROLL_ATTR);
      return;
    }
    if (root.hasAttribute(SCROLL_ATTR)) return;
    const html = getComputedStyle(root);
    const body = getComputedStyle(document.body);
    const locked = [html.overflow, html.overflowY, body.overflow, body.overflowY].some((v) => v === 'hidden' || v === 'clip');
    if (body.position === 'fixed') root.setAttribute(SCROLL_ATTR, 'fixed');
    else if (locked) root.setAttribute(SCROLL_ATTR, 'overflow');
  }

  function releaseCookies() {
    for (const el of document.querySelectorAll(`[${ATTR}="cookie"]`)) {
      el.removeAttribute(ATTR);
      state.reasons.cookie--;
    }
    document.documentElement.removeAttribute(SCROLL_ATTR);
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
    document.querySelectorAll(`[${ATTR}]:not([${ATTR}="cookie"])`).forEach((el) => matched.add(el));
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
    if (sender.id !== chrome.runtime.id) return false;
    if (msg?.type === 'werbefrei:status') {
      onStatus();
      return false;
    }
    if (msg?.type === 'werbefrei:cmp') {
      let art = msg.art;
      if (art === 'knopf') {
        // Nur ein Knopf im Rahmen: Abo-Abfrage, wenn der Dialog der Seite drumherum ein Abo anbietet.
        // Sonst bleibt alles, wie es ist; ein unklarer Dialog wird weder ausgeblendet noch beantwortet.
        const pay = state.active && [...document.querySelectorAll(SOURCEPOINT)].some(payAround);
        sendResponse({ bezahl: pay });
        if (!pay) return false;
        art = 'bezahl';
      }
      // Einmal als Abo-Abfrage erkannt, bleibt es dabei, auch wenn weitere Rahmen "normal" melden.
      if (state.spVerdict !== 'bezahl') state.spVerdict = art === 'bezahl' ? 'bezahl' : 'normal';
      if (state.spVerdict === 'bezahl') {
        // War der Dialog schon ausgeblendet (Abo-Teil kam erst später), wieder zeigen.
        for (const el of document.querySelectorAll(`${SOURCEPOINT}[${ATTR}="cookie"]`)) {
          el.removeAttribute(ATTR);
          state.reasons.cookie--;
        }
      }
      if (state.active) scanCookieBanners([document.documentElement]);
      return false;
    }
    if (msg?.type !== 'werbefrei:zaehlen') return false;
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

  /** Das eingefügte CSS über das Attribut am <html>-Element ab- oder wieder einschalten. */
  function setGate(off) {
    if (!state.gate) return;
    if (off) document.documentElement.setAttribute(state.gate, '');
    else document.documentElement.removeAttribute(state.gate);
  }

  function scheduleInitialScans() {
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

  function activate(res) {
    const wasRunning = state.active && (state.heuristics || cmpActive());
    state.active = true;
    state.generic = res.generic;
    state.heuristics = res.heuristics;
    const cookiesBefore = state.cookies;
    state.cookies = res.cookies === true;
    const consentBefore = state.autoConsent;
    state.autoConsent = res.autoConsent === true;
    // Gerade eingeschaltet, und eine Sourcepoint-Abo-Abfrage ist schon offen: jetzt beantworten.
    if (!consentBefore && state.autoConsent && state.spVerdict === 'bezahl') send({ type: 'einwilligen' });
    if (cookiesBefore && !state.cookies) releaseCookies();
    setGate(false);
    observer.observe(document, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'id'] });
    queue(document.documentElement);
    if ((state.heuristics || cmpActive()) && !wasRunning) scheduleInitialScans();
  }

  function deactivate() {
    state.active = false;
    state.autoConsent = false; // beim Fortsetzen wie neu eingeschaltet behandeln
    observer.disconnect();
    clearTimeout(state.flushTimer);
    clearTimeout(state.scanTimer);
    state.flushTimer = 0;
    state.scanTimer = 0;
    state.pending = [];
    state.pendingAttr = new Set();
    setGate(true);
  }

  function setGateName(gate) {
    if (!gate) return;
    state.gate = gate;
    globalThis.__werbefreiTor = gate; // für die Element-Auswahl (gleiche isolierte Welt)
  }

  let initRunning = null;

  /**
   * Stylesheet anfordern (der Service Worker fügt es ein) und loslegen. Läuft nie doppelt, und
   * das einmal vergebene Attribut wird wiederverwendet, damit alles eingefügte CSS daran hängt.
   */
  function init() {
    if (!initRunning) {
      initRunning = (async () => {
        const res = await send({ type: 'init', gate: state.gate });
        if (!res) return;
        setGateName(res.gate);
        state.generation = res.generation;
        if (!res.active) {
          if (state.active) deactivate();
          return;
        }
        state.cssInserted = true;
        activate(res);
      })().finally(() => {
        initRunning = null;
      });
    }
    return initRunning;
  }

  /** Pause, Ausnahme oder Regeln haben sich geändert: ohne Neuladen umschalten. */
  async function onStatus() {
    if (initRunning) await initRunning;
    const res = await send({ type: 'status', gate: state.gate });
    if (!res) return;
    setGateName(res.gate);
    if (!res.active) {
      if (state.active) deactivate();
      return;
    }
    if (!state.cssInserted || res.generation !== state.generation) {
      // Seite wurde während einer Pause geöffnet oder die Regeln sind neu: Stylesheet neu
      // anfordern und alle Klassen und ids erneut melden. Weggefallene Regeln wirken bis zum
      // nächsten Laden weiter; hinzugekommene sofort.
      state.sentKeys.clear();
      state.keyedSelectors = [];
      await init();
      return;
    }
    activate(res);
  }

  init();
})();
