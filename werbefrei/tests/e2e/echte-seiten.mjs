// Vergleich auf echten Nachrichtenseiten: derselbe Artikel ohne und mit Werbefrei.
//   node tests/e2e/echte-seiten.mjs                 alle Seiten
//   node tests/e2e/echte-seiten.mjs spiegel.de zeit.de
//
// Pro Seite: Startseite öffnen, einen Artikel wählen, Einwilligung bestätigen (ohne sie lädt keine
// dieser Seiten Werbung), durch den Artikel scrollen, zählen und Bildschirmfotos machen.
// Ergebnis: test-ergebnisse/echte-seiten.md und je Seite ein Vergleichsbild.
// Braucht Internetzugang. Seiten ändern sich täglich; die Zahlen sind eine Momentaufnahme.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { launch, waitForLists } from './browser.mjs';
import { acceptConsent } from './einwilligung.mjs';

const out = fileURLToPath(new URL('../../test-ergebnisse/', import.meta.url));
mkdirSync(out, { recursive: true });

// Startseite und Muster für Artikeladressen. stern.de fehlt: Die Seite liefert Artikel an
// Chromium ohne Fenster nicht aus ("Access Denied").
const SITES = [
  { start: 'https://www.spiegel.de/', artikel: /-a-[0-9a-f]{8}-[0-9a-f-]+$/ },
  { start: 'https://www.zeit.de/index', artikel: /\/\d{4}-\d{2}\/[a-z0-9-]{15,}$/ },
  { start: 'https://www.bild.de/', artikel: /\/[a-z0-9-]{20,}-[0-9a-f]{24}$/ },
  { start: 'https://www.welt.de/', artikel: /\/article[0-9a-f]{10,}\/[a-z0-9-]+\.html$/ },
  { start: 'https://www.faz.net/aktuell/', artikel: /-\d{9}\.html$/ },
  { start: 'https://www.sueddeutsche.de/', artikel: /-li\.\d{6,}$/ },
  { start: 'https://www.t-online.de/', artikel: /\/id_\d{6,}\/[a-z0-9-]{15,}\.html$/ },
  { start: 'https://www.focus.de/', artikel: /_id_\d{5,}\.html$/ },
  { start: 'https://www.n-tv.de/', artikel: /-id\d{6,}\.html$/ },
  { start: 'https://www.heise.de/', artikel: /\/news\/[A-Za-z0-9-]{15,}-\d{6,}\.html$/ },
  { start: 'https://www.golem.de/', artikel: /\/news\/[a-z0-9-]{15,}-\d{4}-\d+\.html$/ },
  { start: 'https://www.chip.de/', artikel: /\/(news|artikel)\/[A-Za-z0-9-]{15,}_\d{6,}\.html$/ },
  { start: 'https://www.merkur.de/', artikel: /-\d{8,}\.html$/ },
  { start: 'https://www.tagesspiegel.de/', artikel: /\/[a-z0-9-]{20,}-\d{6,}\.html$/ },
];

const only = process.argv.slice(2);
const sites = only.length ? SITES.filter((site) => only.some((o) => new URL(site.start).hostname.replace(/^www\./, '') === o)) : SITES;
const PARALLEL = Number(process.env.PARALLEL || 3);

function sameSite(a, b) {
  const base = (h) => h.split('.').slice(-2).join('.');
  return base(a) === base(b);
}

async function pickArticle(page, site) {
  const host = new URL(site.start).hostname;
  const links = await page.$$eval('a[href]', (as) => as.map((a) => a.href));
  const seen = new Set();
  for (const href of links) {
    let u;
    try { u = new URL(href); } catch { continue; }
    if (!sameSite(u.hostname, host) || seen.has(u.pathname)) continue;
    seen.add(u.pathname);
    if (/\/(video|videos|plus|abo|podcast|podcasts|live|liveblog|newsticker|ticker|spiele|quiz|bilder|fotos|galerie)\//i.test(u.pathname)) continue;
    if (site.artikel.test(u.pathname)) return `${u.origin}${u.pathname}`;
  }
  return null;
}

async function scrollThrough(page) {
  const height = await page.evaluate(() => document.documentElement.scrollHeight);
  const steps = Math.min(14, Math.ceil(height / 700));
  for (let i = 1; i <= steps; i++) {
    await page.mouse.wheel(0, 700);
    await page.waitForTimeout(450);
  }
  await page.waitForTimeout(1500);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(1200);
}

function measure(page, adHosts) {
  return page.evaluate((hosts) => {
    const adHost = (url) => {
      try {
        const h = new URL(url, location.href).hostname;
        const parts = h.split('.');
        for (let i = 0; i < parts.length - 1; i++) if (hosts.includes(parts.slice(i).join('.'))) return true;
      } catch { /* kein URL */ }
      return false;
    };
    const visible = (el) => {
      if (!el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) return false;
      const r = el.getBoundingClientRect();
      return r.width >= 40 && r.height >= 40;
    };
    const frames = [...document.querySelectorAll('iframe')].filter(visible);
    const adFrames = frames.filter((f) => adHost(f.src) || /google_ads|gpt|ad[_-]?frame|taboola|outbrain/i.test(f.id + f.name + f.className));
    const slotSel = '[id^="div-gpt-ad"], ins.adsbygoogle, [id^="google_ads_iframe"], [data-google-query-id], [id*="taboola" i], .OUTBRAIN, [id^="outbrain"], [class*="taboola" i]';
    const slots = [...document.querySelectorAll(slotSel)].filter(visible);
    const labels = [...document.querySelectorAll('body *')].filter((el) => {
      if (el.children.length) return false;
      const t = (el.textContent || '').trim();
      return /^(anzeige|werbung|advertisement|sponsored|gesponsert)$/i.test(t) && el.checkVisibility();
    });
    const main = document.querySelector('article [itemprop="articleBody"], [itemprop="articleBody"], article, main') || document.body;
    const h1 = document.querySelector('h1');
    const area = adFrames.reduce((sum, f) => {
      const r = f.getBoundingClientRect();
      return sum + r.width * r.height;
    }, 0);
    return {
      adFrames: adFrames.length,
      adFrameArea: Math.round(area),
      adSlots: slots.length,
      labels: labels.length,
      articleChars: (main.innerText || '').length,
      h1: h1 && h1.checkVisibility() ? h1.innerText.trim().slice(0, 90) : null,
      sperre: /blocker|adblock/i.test(h1?.innerText || ''),
      hiddenByWerbefrei: document.querySelectorAll('[data-werbefrei-verborgen]').length,
    };
  }, adHosts);
}

async function visit(context, site, adHosts, label, articleUrl) {
  const { start } = site;
  const page = await context.newPage();
  const requests = { ad: 0, blocked: 0 };
  page.on('request', (r) => {
    try {
      const h = new URL(r.url()).hostname.split('.');
      for (let i = 0; i < h.length - 1; i++) if (adHosts.has(h.slice(i).join('.'))) { requests.ad++; break; }
    } catch { /* egal */ }
  });
  page.on('requestfailed', (r) => { if (r.failure()?.errorText === 'net::ERR_BLOCKED_BY_CLIENT') requests.blocked++; });
  try {
    let url = articleUrl;
    let consent = null;
    if (!url) {
      const response = await page.goto(start, { waitUntil: 'domcontentloaded', timeout: 45000 });
      if (response && response.status() >= 400) throw new Error(`Startseite antwortet mit ${response.status()}`);
      consent = await acceptConsent(page);
      await page.waitForTimeout(2500);
      await page.waitForLoadState('domcontentloaded').catch(() => {});
      url = await pickArticle(page, site);
      if (!url) throw new Error('kein Artikel auf der Startseite gefunden');
    }
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
    consent = (await acceptConsent(page, { timeout: consent ? 4000 : 14000 })) || consent;
    await page.waitForLoadState('load', { timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(3000);
    await scrollThrough(page);
    const name = new URL(start).hostname.replace(/^www\./, '');
    const shot = `${out}${name}-${label}.png`;
    await page.screenshot({ path: shot });
    const scrolled = `${out}${name}-${label}-mitte.png`;
    await page.evaluate(() => window.scrollTo(0, Math.min(1400, document.documentElement.scrollHeight * 0.3)));
    await page.waitForTimeout(1500);
    await page.screenshot({ path: scrolled });
    await page.evaluate(() => window.scrollTo(0, 0));
    const m = await measure(page, [...adHosts]);
    return { url, consent, ...m, requests, shots: [shot, scrolled] };
  } catch (e) {
    return { error: e.message.split('\n')[0] };
  } finally {
    await page.close();
  }
}

async function compare(site, adHosts) {
  const name = new URL(site.start).hostname.replace(/^www\./, '');
  const withExt = await launch();
  await waitForLists(withExt.worker);
  const b = await visit(withExt.context, site, adHosts, 'mit');
  await withExt.context.close();
  const plain = await launch({ withExtension: false });
  const a = await visit(plain.context, site, adHosts, 'ohne', b.url);
  await plain.context.close();
  console.log(`${name.padEnd(18)} ohne: ${a.error || `${a.adFrames} Werberahmen, ${a.adSlots} Werbeplätze, ${a.requests.ad} Werbeanfragen`}`);
  console.log(`${''.padEnd(18)} mit:  ${b.error || `${b.adFrames} Werberahmen, ${b.adSlots} Werbeplätze, ${b.requests.blocked} Anfragen blockiert, ${b.hiddenByWerbefrei} per Heuristik ausgeblendet`}`);
  return { name, start: site.start, ohne: a, mit: b };
}

// Werbe-Domains aus den Listen der Erweiterung holen (einmal installieren, Listen laden).
const setup = await launch();
await waitForLists(setup.worker);
const { blockHosts = [], ruleReport } = await setup.worker.evaluate(() => chrome.storage.local.get(['blockHosts', 'ruleReport']));
await setup.context.close();
const adHosts = new Set(blockHosts);
console.log(`${adHosts.size} Werbe-Domains, ${ruleReport?.active} aktive Netzregeln\n`);

const results = [];
for (let i = 0; i < sites.length; i += PARALLEL) {
  results.push(...(await Promise.all(sites.slice(i, i + PARALLEL).map((s) => compare(s, adHosts)))));
}

const rows = results.map(({ name, ohne: a, mit: b }) => {
  const f = (r, key) => (r.error ? '–' : r[key]);
  const broken = !a.error && !b.error && a.articleChars > 500 && b.articleChars < a.articleChars * 0.7;
  const note = b.sperre ? 'Seite sperrt sich bei Werbeblockern' : b.error || a.error || (broken ? 'Artikeltext kürzer, prüfen' : '');
  return `| ${name} | ${f(a, 'adFrames')} / ${f(b, 'adFrames')} | ${f(a, 'adSlots')} / ${f(b, 'adSlots')} | ${f(a, 'labels')} / ${f(b, 'labels')} | ${a.error ? '–' : a.requests.ad} | ${b.error ? '–' : b.requests.blocked} | ${b.error ? '–' : b.hiddenByWerbefrei} | ${f(a, 'articleChars')} / ${f(b, 'articleChars')} | ${note} |`;
});

const md = `# Werbefrei auf echten Nachrichtenseiten

Stand: ${new Date().toLocaleString('de-DE')}. Chromium ${process.env.CHROMIUM_VERSION || ''}, Fenster 1366×900, Einwilligung jeweils bestätigt.
Werte "ohne / mit" Werbefrei. Werberahmen: sichtbare iframes von Werbeservern. Werbeplätze: sichtbare Standard-Werbecontainer
(Google Publisher Tag, AdSense, Taboola, Outbrain). Kennzeichnungen: sichtbare Elemente mit dem Text "Anzeige"/"Werbung".
Textlänge: Zeichen im Artikel, zur Kontrolle, dass der Artikel selbst vollständig bleibt.

| Seite | Werberahmen | Werbeplätze | Kennzeichnungen | Werbeanfragen ohne | blockiert mit | Heuristik | Textlänge | Hinweis |
|---|---|---|---|---|---|---|---|---|
${rows.join('\n')}

Artikel:
${results.map((r) => `- ${r.name}: ${r.mit.url || r.ohne.url || '–'}`).join('\n')}
`;
// Vergleichsbilder: links ohne, rechts mit Werbefrei, jeweils Artikelanfang und weiter unten.
const viewer = await launch({ withExtension: false, viewport: { width: 1400, height: 900 } });
const page = await viewer.context.newPage();
const dataUrl = (path) => `data:image/png;base64,${readFileSync(path).toString('base64')}`;
for (const r of results) {
  if (r.ohne.error || r.mit.error) continue;
  const cell = (path, title) => `<figure><figcaption>${title}</figcaption><img src="${dataUrl(path)}"></figure>`;
  await page.setContent(`<style>
    body{margin:0;background:#1c2024;font:600 22px system-ui,sans-serif;color:#fff}
    .grid{display:grid;grid-template-columns:1fr 1fr;gap:14px;padding:14px}
    figure{margin:0} figcaption{padding:4px 2px 8px} img{width:100%;display:block;border-radius:6px}
    h1{font-size:26px;margin:14px 14px 0}
  </style><h1>${r.name}</h1><div class="grid">
    ${cell(r.ohne.shots[0], 'Ohne Werbefrei')}${cell(r.mit.shots[0], 'Mit Werbefrei')}
    ${cell(r.ohne.shots[1], 'Ohne Werbefrei, weiter unten')}${cell(r.mit.shots[1], 'Mit Werbefrei, weiter unten')}
  </div>`);
  await page.screenshot({ path: `${out}${r.name}-vergleich.png`, fullPage: true });
}
await viewer.context.close();

writeFileSync(`${out}echte-seiten.md`, md);
writeFileSync(`${out}echte-seiten.json`, JSON.stringify(results, null, 2));
console.log(`\nBericht: ${out}echte-seiten.md`);
