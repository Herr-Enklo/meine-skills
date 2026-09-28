// Cookie-Hinweise auf vielen echten Seiten, in drei Durchgängen: ohne Werbefrei, mit Werbefrei
// (Grundeinstellung) und mit eingeschaltetem "Abo-Abfragen automatisch beantworten".
//
//   node tests/e2e/cookie-umfrage.mjs [--parallel=2] [--gruppe=rundfunk,handel] [--weiter]
//                                     [--ohne-von=test-ergebnisse/cookie-umfrage.json]
//                                     [--probleme-von=test-ergebnisse/cookie-umfrage.json] [adresse …]
//
// --probleme-von prüft nur die Seiten neu, die in einem früheren Lauf als Problem gemeldet wurden.
//
// --ohne-von übernimmt den Durchgang ohne Werbefrei aus einem früheren Lauf (er hängt nicht vom Code
// der Erweiterung ab und ist der langsamste). Der Durchgang mit Schalter läuft dann nur für Seiten,
// auf denen dort eine Abo-Abfrage gefunden wurde.
//
// Pro Durchgang laufen --parallel Seiten gleichzeitig (drei Durchgänge parallel, also dreimal so
// viele Tabs). Nach jeder Seite wird der Zwischenstand gespeichert; --weiter setzt einen
// abgebrochenen Lauf fort. Stürzt ein Browser ab, startet der Durchgang ihn neu.
//
// Die Dialogerkennung hier ist absichtlich unabhängig von den Selektoren der Erweiterung: Gesucht
// wird ein sichtbarer Knopf mit Entscheidungstext ("Akzeptieren", "Zustimmen", "Ablehnen" …) in
// einem Kasten mit Einwilligungstext ("Cookies", "Datenschutz", "Einwilligung" …), der fest über der
// Seite liegt oder in einem eigenen Rahmen steckt. So fallen auch Dialoge auf, die Werbefrei nicht
// kennt.
//
// Ergebnis: test-ergebnisse/cookie-umfrage.md (Tabelle, Fehlerliste), .json und Bildschirmfotos
// unter test-ergebnisse/umfrage/. Seiten, die den Testbrowser sperren oder ihren Dialog nur Besuchern
// aus der EU zeigen, erscheinen als "gesperrt" bzw. "kein Dialog". Das Ergebnis ist eine
// Momentaufnahme; Seiten ändern sich.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { launch, waitForLists, extensionPage, sendFrom } from './browser.mjs';

// WERBEFREI_UMFRAGE_OUT: anderer Ausgabeordner, etwa für eine Einzelprüfung neben einem laufenden Lauf.
const out = process.env.WERBEFREI_UMFRAGE_OUT
  ? `${process.env.WERBEFREI_UMFRAGE_OUT.replace(/\/$/, '')}/`
  : fileURLToPath(new URL('../../test-ergebnisse/', import.meta.url));
const shots = `${out}umfrage/`;
mkdirSync(shots, { recursive: true });

const GROUPS = {
  nachrichten: [
    'https://www.spiegel.de/', 'https://www.zeit.de/index', 'https://www.faz.net/aktuell/', 'https://www.sueddeutsche.de/',
    'https://www.welt.de/', 'https://www.bild.de/', 'https://www.focus.de/', 'https://www.stern.de/', 'https://www.t-online.de/',
    'https://www.n-tv.de/', 'https://www.tagesspiegel.de/', 'https://www.handelsblatt.com/', 'https://www.wiwo.de/',
    'https://www.rnd.de/', 'https://taz.de/', 'https://www.merkur.de/', 'https://www.fr.de/', 'https://www.tz.de/',
    'https://www.berliner-zeitung.de/', 'https://www.morgenpost.de/', 'https://www.ksta.de/', 'https://rp-online.de/',
    'https://www.waz.de/', 'https://www.stuttgarter-zeitung.de/', 'https://www.mopo.de/', 'https://www.derwesten.de/',
    'https://www.abendblatt.de/', 'https://www.augsburger-allgemeine.de/',
  ],
  technik: [
    'https://www.heise.de/', 'https://www.golem.de/', 'https://www.chip.de/', 'https://www.computerbild.de/',
    'https://www.netzwelt.de/', 'https://t3n.de/', 'https://www.giga.de/', 'https://www.pcgameshardware.de/',
  ],
  rundfunk: [
    'https://www.zdf.de/', 'https://www.ardmediathek.de/', 'https://www.tagesschau.de/', 'https://www.br.de/',
    'https://www1.wdr.de/', 'https://www.ndr.de/', 'https://www.swr.de/', 'https://www.mdr.de/',
    'https://www.deutschlandfunk.de/', 'https://www.rtl.de/', 'https://www.prosieben.de/', 'https://www.sportschau.de/',
  ],
  sport: ['https://www.kicker.de/', 'https://www.sport1.de/', 'https://www.transfermarkt.de/', 'https://www.sportbild.bild.de/'],
  magazine: [
    'https://www.geo.de/', 'https://www.brigitte.de/', 'https://www.gala.de/', 'https://www.bunte.de/',
    'https://www.apotheken-umschau.de/', 'https://www.chefkoch.de/', 'https://www.essen-und-trinken.de/',
  ],
  handel: [
    'https://www.amazon.de/', 'https://www.otto.de/', 'https://www.zalando.de/', 'https://www.mediamarkt.de/',
    'https://www.saturn.de/', 'https://www.lidl.de/', 'https://www.aldi-sued.de/', 'https://www.kaufland.de/',
    'https://www.dm.de/', 'https://www.rossmann.de/', 'https://www.ikea.com/de/de/', 'https://www.obi.de/',
    'https://www.hornbach.de/', 'https://www.tchibo.de/', 'https://www.idealo.de/', 'https://www.ebay.de/',
    'https://www.kleinanzeigen.de/', 'https://www.thomann.de/', 'https://www.alternate.de/', 'https://www.cyberport.de/',
    'https://www.galeria.de/', 'https://www.douglas.de/',
  ],
  dienste: [
    'https://www.check24.de/', 'https://www.verivox.de/', 'https://www.bahn.de/', 'https://www.dhl.de/',
    'https://www.mobile.de/', 'https://www.autoscout24.de/', 'https://www.immobilienscout24.de/', 'https://www.immowelt.de/',
    'https://web.de/', 'https://www.gmx.net/', 'https://www.gutefrage.net/', 'https://www.wetter.com/',
    'https://www.wetteronline.de/', 'https://www.wetter.de/', 'https://www.adac.de/', 'https://www.stepstone.de/',
    'https://www.lieferando.de/', 'https://www.holidaycheck.de/', 'https://www.tui.com/', 'https://www.booking.com/',
  ],
  banken: [
    'https://www.sparkasse.de/', 'https://www.ing.de/', 'https://www.dkb.de/', 'https://www.comdirect.de/',
    'https://www.allianz.de/', 'https://www.huk.de/', 'https://www.telekom.de/', 'https://www.vodafone.de/',
    'https://www.o2online.de/', 'https://www.1und1.de/',
  ],
  anbieter: [
    'https://usercentrics.com/de/', 'https://www.didomi.io/', 'https://www.consentmanager.net/', 'https://www.onetrust.com/de/',
    'https://www.cookiebot.com/de/', 'https://borlabs.io/', 'https://complianz.io/', 'https://www.cookieyes.com/',
  ],
};

const args = process.argv.slice(2);
const opt = (name, def) => {
  const a = args.find((x) => x.startsWith(`--${name}=`));
  return a ? a.slice(name.length + 3) : def;
};
const PARALLEL = Number(opt('parallel', '2'));
const RESUME = args.includes('--weiter');
const OHNE_VON = opt('ohne-von', '');
const PROBLEME_VON = opt('probleme-von', '');
const chosen = opt('gruppe', '').split(',').filter(Boolean);
const urls = args.filter((a) => !a.startsWith('--'));
const problemUrls = PROBLEME_VON
  ? JSON.parse(readFileSync(PROBLEME_VON, 'utf8')).rows.filter((r) => r.ok === false).map((r) => r.site)
  : null;
const SITES = problemUrls
  ? problemUrls
  : urls.length
  ? urls.map((u) => ({
      // "merkur.de" → https://www.merkur.de/ (manche Seiten sperren Aufrufe ohne www)
      url: u.startsWith('http') ? u : `https://${u.split('/')[0].split('.').length === 2 ? 'www.' : ''}${u}${u.includes('/') ? '' : '/'}`,
      group: 'einzeln',
    }))
  : Object.entries(GROUPS)
      .filter(([g]) => !chosen.length || chosen.includes(g))
      .flatMap(([group, list]) => list.map((url) => ({ url, group })));

const nameOf = (url) => {
  const u = new URL(url);
  return (u.hostname.replace(/^www\d?\./, '') + u.pathname.replace(/\/(index)?$/, '')).replace(/[^a-z0-9.-]+/gi, '_');
};

/**
 * Sucht in einem Dokument einen sichtbaren Einwilligungsdialog. Läuft im Browser, in jedem Rahmen.
 * isTop: Hauptdokument (dort muss der Dialog fest über der Seite liegen).
 */
function detectDialog(isTop) {
  const CONSENT = /cookie|datenschutz|privacy|einwillig|consent|tracking|personenbezogen|nutzungsbasiert/i;
  const DECIDE = /akzeptier|zustimm|einverstanden|annehm|erlaube|einwillig|ablehn|accept|agree|allow|reject|verstanden|^ok$|^okay$|nur notwendige|nur erforderliche|nur essenzielle|speichern und schließen/i;
  const PAY = /pur-abo|\bpur\b|abonn|\babo\b|contentpass|freechoice|werbefrei|ohne werbung|subscribe|subscription|€/i;
  const vw = innerWidth;
  const vh = innerHeight;
  const visible = (el) => {
    if (!el.checkVisibility({ opacityProperty: true, visibilityProperty: true })) return false;
    const r = el.getBoundingClientRect();
    return r.width > 2 && r.height > 2 && r.bottom > 0 && r.right > 0 && r.top < vh && r.left < vw;
  };
  const parentOf = (el) => el.parentElement || el.getRootNode()?.host || null;
  const clickables = [];
  const collect = (root) => {
    root.querySelectorAll('button, [role="button"], a, input[type="button"], input[type="submit"]').forEach((el) => clickables.push(el));
    root.querySelectorAll('*').forEach((el) => el.shadowRoot && collect(el.shadowRoot));
  };
  collect(document);
  const fixedUp = (el) => {
    for (let c = el; c && c !== document.documentElement; c = parentOf(c)) {
      const p = getComputedStyle(c).position;
      if (p === 'fixed' || p === 'sticky') return true;
    }
    return false;
  };
  const consentPage = isTop && /zustimmung|consent|privacy|datenschutz/i.test(location.pathname);
  // Eigene Zustimmungsseite (golem.de): Der Knopf steckt dort oft in einem fremden Rahmen.
  if (consentPage && CONSENT.test(document.body.innerText) && [...document.querySelectorAll('iframe')].some(visible)) {
    const t = document.body.innerText.replace(/\s+/g, ' ');
    return { pay: PAY.test(t), button: '(Zustimmungsseite)', text: t.slice(0, 140) };
  }
  for (const b of clickables) {
    const label = (b.innerText || b.value || b.getAttribute('aria-label') || '').replace(/\s+/g, ' ').trim();
    if (!label || label.length > 40 || !DECIDE.test(label) || !visible(b)) continue;
    let box = null;
    for (let c = parentOf(b), i = 0; c && c !== document.body && c !== document.documentElement && i < 15; c = parentOf(c), i++) {
      const t = (c.innerText || '').replace(/\s+/g, ' ');
      if (t.length >= 60 && CONSENT.test(t)) {
        box = c;
        break;
      }
    }
    if (!box && !isTop && CONSENT.test(document.body.innerText)) box = document.body;
    if (!box) continue;
    if (isTop && !consentPage && !fixedUp(box)) continue;
    // Für die Abo-Frage den ganzen Dialog lesen, nicht nur die Spalte um den Knopf: im Rahmen das
    // ganze Dokument, in der Seite den äußersten fest positionierten Kasten.
    let whole = box;
    if (!isTop || consentPage) whole = document.body;
    else {
      for (let c = box; c && c !== document.body && c !== document.documentElement; c = parentOf(c)) {
        const p = getComputedStyle(c).position;
        if (p === 'fixed' || p === 'sticky') whole = c;
      }
    }
    const text = (box.innerText || '').replace(/\s+/g, ' ').trim();
    const wholeText = (whole.innerText || '').replace(/\s+/g, ' ');
    return { pay: PAY.test(wholeText), button: label, text: text.slice(0, 140) };
  }
  return null;
}

/** Je Browser eine Warteschlange: Nur ein Tab zur Zeit darf im Vordergrund scrollen. */
const scrollLock = {
  queues: new WeakMap(),
  async acquire(context) {
    const prev = this.queues.get(context) || Promise.resolve();
    let release;
    const next = new Promise((r) => { release = r; });
    this.queues.set(context, prev.then(() => next));
    await prev;
    return release;
  },
};

/** Sichtbaren Einwilligungsdialog in der Seite oder einem ihrer Rahmen suchen. */
async function findDialog(page) {
  let dialog = null;
  for (const frame of page.frames()) {
    const isTop = frame === page.mainFrame();
    const found = await frame.evaluate(detectDialog, isTop).catch(() => null);
    if (!found) continue;
    if (!isTop) {
      const el = await frame.frameElement().catch(() => null);
      const shown = el
        ? await el
            .evaluate((e) => {
              const r = e.getBoundingClientRect();
              return e.checkVisibility({ opacityProperty: true, visibilityProperty: true }) && r.width > 150 && r.height > 60;
            })
            .catch(() => false)
        : false;
      if (!shown) continue;
    }
    dialog = { ...found, where: isTop ? 'Seite' : new URL(frame.url()).hostname };
    if (found.pay || isTop) break;
  }
  return dialog;
}

/**
 * Dialog suchen und die Seite vermessen. Dialoge erscheinen unter Last erst nach mehr als acht
 * Sekunden (welt.de): bis zu 20 Sekunden nach dem Laden alle zwei Sekunden nachsehen. Ein gefundener
 * Dialog zählt nur, wenn er 2,5 Sekunden später noch da ist; so wird ein Banner, der kurz sichtbar ist,
 * bevor Werbefrei ihn ausblendet oder beantwortet, nicht als Fehler gewertet.
 */
async function inspect(page) {
  const deadline = Date.now() + 14000;
  let dialog = null;
  for (;;) {
    dialog = await findDialog(page);
    if (dialog) {
      await page.waitForTimeout(2500);
      dialog = await findDialog(page);
      if (dialog) break;
    }
    if (Date.now() > deadline) break;
    await page.waitForTimeout(2000);
  }
  const page2 = await page.evaluate(() => ({
    textLen: (document.body?.innerText || '').length,
    // Text ohne fest positionierte Kästen (Dialoge, Leisten): Ein ausgeblendeter Dialog soll nicht
    // als "weniger Inhalt" zählen. Kästen mit mehr als der Hälfte des Seitentexts sind eher ein
    // fester App-Container als ein Dialog und bleiben drin (lidl.de, dhl.de).
    textMain: (() => {
      const total = (document.body?.innerText || '').length;
      let n = total;
      for (const el of document.querySelectorAll('body *')) {
        if (getComputedStyle(el).position !== 'fixed') continue;
        let nested = false;
        for (let c = el.parentElement; c && c !== document.body; c = c.parentElement) {
          if (getComputedStyle(c).position === 'fixed') { nested = true; break; }
        }
        const len = (el.innerText || '').length;
        if (!nested && len < total / 2) n -= len;
      }
      return Math.max(0, n);
    })(),
    clickable: getComputedStyle(document.body).pointerEvents !== 'none' && getComputedStyle(document.documentElement).pointerEvents !== 'none',
    tall: document.documentElement.scrollHeight > innerHeight + 300 || (document.body?.scrollHeight || 0) > innerHeight + 300,
    blocked: /captcha|access denied|zugriff verweigert|request blocked|ihre anfrage wurde blockiert|are you a robot|bist du ein mensch|sind sie ein roboter/i.test(document.body?.innerText.slice(0, 3000) || ''),
    // Sperrseite für Werbeblocker (bild.de leitet auf /adblockwall.html um)
    adblockWall: /adblockwall/i.test(location.href) || /aufgrund ihres (werbe)?blockers|deaktivieren sie ihren (werbe|ad)blocker|werbeblocker erkannt|adblocker erkannt/i.test(document.body?.innerText.slice(0, 4000) || ''),
    title: document.title.slice(0, 60),
  }));
  // Ein Tab im Hintergrund reagiert nicht aufs Mausrad: nach vorn holen, und die parallelen Tabs
  // eines Durchgangs nacheinander prüfen lassen.
  const release = await scrollLock.acquire(page.context());
  try {
    await page.bringToFront();
    await page.mouse.move(683, 450);
    await page.mouse.wheel(0, 800);
    await page.waitForTimeout(700);
  } finally {
    release();
  }
  // Manche Seiten scrollen nicht das Fenster, sondern einen inneren Container (rtl.de, ksta.de).
  const scrolled = await page.evaluate(() => {
    let best = Math.max(window.scrollY, document.body?.scrollTop || 0, document.documentElement.scrollTop);
    for (const el of document.querySelectorAll('body *')) {
      if (el.scrollTop > best && el.clientHeight > innerHeight * 0.5) best = el.scrollTop;
    }
    return Math.round(best);
  });
  return { dialog, ...page2, scrolled };
}

const VISIT_LIMIT = 120000;

async function visit(context, site, mode) {
  const name = nameOf(site.url);
  let page;
  try {
    page = await context.newPage();
  } catch (e) {
    return { error: e.message.split('\n')[0].slice(0, 120) };
  }
  // Manche Seiten legen ohne Werbeblocker den Browser-Tab lahm (faz.net, n-tv.de); dann hängen auch
  // evaluate() und close(). Nach VISIT_LIMIT gilt der Besuch als gescheitert.
  let timer;
  const limit = new Promise((resolve) => {
    timer = setTimeout(() => resolve({ error: `Zeitüberschreitung (${VISIT_LIMIT / 1000} s)` }), VISIT_LIMIT);
  });
  try {
    return await Promise.race([measure(page, site, mode, name), limit]);
  } finally {
    clearTimeout(timer);
    await Promise.race([page.close().catch(() => {}), new Promise((r) => setTimeout(r, 5000))]);
  }
}

async function measure(page, site, mode, name) {
  try {
    const res = await page.goto(site.url, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForTimeout(6000);
    let r;
    try {
      r = await inspect(page);
    } catch (e) {
      // Weiterleitung nach der Einwilligung (golem.de): neue Seite abwarten und noch einmal messen.
      if (!/context was destroyed|navigat/i.test(e.message)) throw e;
      await page.waitForLoadState('domcontentloaded').catch(() => {});
      await page.waitForTimeout(3000);
      r = await inspect(page);
    }
    await page.evaluate(() => { window.scrollTo(0, 0); if (document.body) document.body.scrollTop = 0; }).catch(() => {});
    await page.screenshot({ path: `${shots}${name}-${mode}.png`, timeout: 15000 }).catch(() => {});
    return { ...r, status: res?.status() ?? 0 };
  } catch (e) {
    return { error: e.message.split('\n')[0].slice(0, 120) };
  }
}

async function startBrowser(mode) {
  const withExtension = mode !== 'ohne';
  const { context, worker, extensionId } = await launch({ withExtension, realistic: true });
  // OpenCMP (merkur.de u. a.) fragt den Standort ab und zeigt außerhalb der EU keinen Dialog.
  await context.route('https://cdntrf.com/api/country/**', (r) => r.fulfill({ status: 200, body: 'DE', headers: { 'access-control-allow-origin': '*' } }));
  if (withExtension) {
    await waitForLists(worker);
    if (mode === 'einwilligen') {
      const options = await extensionPage(context, extensionId);
      await sendFrom(options, { type: 'setOption', key: 'autoConsent', value: true });
      await options.close();
    }
  }
  return context;
}

async function runMode(mode, offset, only = null) {
  const partFile = `${shots}_zwischenstand-${mode}.json`;
  const results = RESUME && existsSync(partFile) ? JSON.parse(readFileSync(partFile, 'utf8')) : {};
  if (only && !only.length) return results;
  let context = await startBrowser(mode);
  let generation = 0;
  let restarting = null;
  let crashed = false;
  context.on('close', () => { crashed = true; });
  /** Den laufenden Browser liefern; ist er abgestürzt, genau einmal neu starten. */
  const alive = async () => {
    if (restarting) return restarting;
    if (!crashed) return context;
    const gen = generation;
    restarting = (async () => {
      if (gen !== generation) return context;
      process.stdout.write('!');
      await context.close().catch(() => {});
      context = await startBrowser(mode);
      crashed = false;
      context.on('close', () => { crashed = true; });
      generation++;
      return context;
    })().finally(() => { restarting = null; });
    return restarting;
  };
  // Jeder Durchgang beginnt an einer anderen Stelle der Liste: Rufen drei Browser dieselbe Seite
  // gleichzeitig auf, sperren manche Seiten (merkur.de antwortet dann mit 403).
  const order = SITES.map((_, i) => SITES[(i + offset) % SITES.length]).filter((s) => !results[s.url] && (!only || only.includes(s.url)));
  let next = 0;
  const workerLoop = async () => {
    while (next < order.length) {
      const site = order[next++];
      let r = await visit(await alive(), site, mode);
      if (r.error && /closed|crash|disconnected/i.test(r.error)) r = await visit(await alive(), site, mode);
      results[site.url] = r;
      writeFileSync(partFile, JSON.stringify(results));
      process.stdout.write(mode === 'ohne' ? '.' : mode === 'mit' ? '+' : '*');
    }
  };
  await Promise.all(Array.from({ length: PARALLEL }, workerLoop));
  crashed = false;
  await context.close().catch(() => {});
  return results;
}

console.log(`${SITES.length} Seiten, je drei Durchgänge (. ohne, + mit Werbefrei, * mit Abo-Schalter)`);
const third = Math.max(1, Math.floor(SITES.length / 3));
let ohne, mit, einw;
if (OHNE_VON) {
  const old = JSON.parse(readFileSync(OHNE_VON, 'utf8'));
  ohne = old.ohne || old;
  // Ohne Dialog oder mit Fehler: noch einmal besuchen (der Dialog kann damals zu spät gekommen sein).
  const missing = SITES.filter((s) => {
    const r = ohne[s.url];
    return !r || r.error || (!r.dialog && !r.blocked && !(r.status >= 400));
  });
  for (const s of missing) delete ohne[s.url];
  if (missing.length) Object.assign(ohne, await runMode('ohne', 0, missing.map((s) => s.url)));
  const paySites = SITES.filter((s) => ohne[s.url]?.dialog?.pay).map((s) => s.url);
  [mit, einw] = await Promise.all([runMode('mit', 0), runMode('einwilligen', third, paySites)]);
} else {
  [ohne, mit, einw] = await Promise.all(['ohne', 'mit', 'einwilligen'].map((mode, i) => runMode(mode, i * third)));
}
console.log('\n');

function judge(site) {
  const a = ohne[site.url];
  const b = mit[site.url];
  const c = einw[site.url] || { error: 'nicht besucht' };
  const notes = [];
  if (a.error || b.error) return { status: 'Fehler', ok: null, notes: [a.error || b.error] };
  if (a.blocked || b.blocked || a.status >= 400) return { status: 'gesperrt', ok: null, notes: [`HTTP ${a.status}`, a.title] };
  // Mit Werbeblocker sperrt die Seite sich selbst (bild.de); das umgeht Werbefrei absichtlich nicht.
  if (b.adblockWall && !a.adblockWall) return { status: 'Werbeblocker-Sperre der Seite', ok: null, notes: b.dialog ? [`Dialog bleibt: ${b.dialog.pay ? 'Abo-Abfrage' : 'Hinweis'}`] : [] };
  if (a.textMain !== undefined && b.textMain !== undefined && b.textMain < a.textMain * 0.5 && a.textMain - b.textMain > 1000) {
    notes.push(`weniger Inhalt (${b.textMain} statt ${a.textMain} Zeichen)`);
  }
  // Mit Werbefrei ein anderer Dialog als ohne (etwa eine Anfrage für Push-Nachrichten): kein Fehler
  // der Cookie-Erkennung, aber erwähnen.
  const key = (d) => (d?.text || '').toLowerCase().replace(/[^a-zäöüß]/g, '').slice(0, 40);
  const other = a.dialog && b.dialog && key(a.dialog) !== key(b.dialog) && !a.dialog.pay;
  if (other) notes.push(`anderer Dialog sichtbar: „${b.dialog.text.slice(0, 60)}…“`);
  // Nur echte Mängel zählen als Fehler, "anderer Dialog sichtbar" ist ein Hinweis.
  const serious = () => notes.filter((n) => !n.startsWith('anderer Dialog')).length > 0;
  if (!a.dialog) {
    // Meist ein Dialog, der ohne Werbefrei erst nach der Messung kam, oder eine andere Einblendung.
    if (b.dialog) return { status: 'Dialog nur mit Werbefrei', ok: null, notes: [...notes, `„${b.dialog.text.slice(0, 60)}…“`] };
    return { status: 'kein Dialog', ok: serious() ? false : null, notes };
  }
  if (!a.dialog.pay) {
    if (b.dialog && !other) return { status: 'NICHT AUSGEBLENDET', ok: false, notes: [...notes, `Knopf "${b.dialog.button}" (${b.dialog.where})`] };
    if (!b.clickable) return { status: 'Seite nicht klickbar', ok: false, notes };
    if (a.tall && b.scrolled < 100) return { status: 'Scrollen gesperrt', ok: false, notes };
    return { status: 'ausgeblendet', ok: !serious(), notes };
  }
  // Abo-Abfrage
  if (!b.dialog) return { status: 'Abo-Abfrage verschwunden', ok: false, notes };
  if (c.error) return { status: 'Abo-Abfrage bleibt; Schalter: Fehler', ok: false, notes: [...notes, c.error] };
  if (c.dialog) return { status: 'Abo-Abfrage NICHT BEANTWORTET', ok: false, notes: [...notes, `Knopf "${c.dialog.button}" (${c.dialog.where})`] };
  if (c.tall && c.scrolled < 100) return { status: 'beantwortet, aber Scrollen gesperrt', ok: false, notes };
  return { status: 'Abo-Abfrage bleibt, Schalter beantwortet', ok: !serious(), notes };
}

const rows = SITES.map((site) => ({ site, name: nameOf(site.url), ...judge(site) }));
const count = (f) => rows.filter(f).length;
const fails = rows.filter((r) => r.ok === false);
const md = `# Cookie-Hinweise auf ${SITES.length} Seiten

Stand: ${new Date().toLocaleString('de-DE')}. Drei Durchgänge: ohne Werbefrei, mit Werbefrei (Grundeinstellung),
mit „Abo-Abfragen automatisch beantworten“. Testbrowser mit Zeitzone Berlin; Seiten, die ihren Dialog
nur Besuchern aus der EU zeigen, erscheinen als „kein Dialog“.

- in Ordnung: ${count((r) => r.ok === true)}
- Probleme: ${fails.length}
- kein Dialog (ohne Werbefrei nicht gefunden): ${count((r) => r.status === 'kein Dialog' && r.ok === null)}
- gesperrt oder Fehler: ${count((r) => r.status === 'gesperrt' || r.status === 'Fehler')}

## Probleme

${fails.length ? fails.map((r) => `- **${r.name}**: ${r.status}${r.notes.length ? ` – ${r.notes.join('; ')}` : ''}. Bilder: umfrage/${r.name}-ohne.png, -mit.png, -einwilligen.png`).join('\n') : 'keine'}

## Alle Seiten

| Gruppe | Seite | Ergebnis | Dialog ohne Werbefrei | Hinweise |
|---|---|---|---|---|
${rows
  .map((r) => {
    const d = ohne[r.site.url]?.dialog;
    const dlg = d ? `${d.pay ? 'Abo-Abfrage' : 'Hinweis'} (${d.where}): „${d.button}“` : '–';
    return `| ${r.site.group} | ${r.name} | ${r.ok === false ? '✗ ' : r.ok ? '✓ ' : ''}${r.status} | ${dlg} | ${r.notes.join('; ').replace(/\|/g, '/')} |`;
  })
  .join('\n')}
`;
writeFileSync(`${out}cookie-umfrage.md`, md);
writeFileSync(`${out}cookie-umfrage.json`, JSON.stringify({ ohne, mit, einwilligen: einw, rows }, null, 2));
for (const r of rows) console.log(`${r.ok === false ? '✗' : r.ok ? '✓' : ' '} ${r.name.padEnd(28)} ${r.status}${r.notes.length ? ` – ${r.notes.join('; ')}` : ''}`);
console.log(`\n${count((r) => r.ok === true)} in Ordnung, ${fails.length} Probleme, ${count((r) => r.ok === null)} ohne Aussage. Bericht: ${out}cookie-umfrage.md`);
