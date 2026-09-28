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
import { launch, waitForSetup } from './browser.mjs';

const out = fileURLToPath(new URL('../../test-ergebnisse/', import.meta.url));
mkdirSync(out, { recursive: true });

const SITES = [
  'https://www.spiegel.de/',
  'https://www.zeit.de/index',
  'https://www.bild.de/',
  'https://www.welt.de/',
  'https://www.faz.net/aktuell/',
  'https://www.sueddeutsche.de/',
  'https://www.t-online.de/',
  'https://www.focus.de/',
  'https://www.n-tv.de/',
  'https://www.stern.de/',
  'https://www.heise.de/',
  'https://www.golem.de/',
  'https://www.chip.de/',
  'https://www.merkur.de/',
  'https://www.tagesspiegel.de/',
];

const only = process.argv.slice(2);
const sites = only.length ? SITES.filter((u) => only.some((o) => u.includes(o))) : SITES;
const PARALLEL = Number(process.env.PARALLEL || 3);

const CONSENT = /^(alle akzeptieren|alles akzeptieren|akzeptieren|akzeptieren und weiter|akzeptieren & weiter|akzeptieren und schließen|zustimmen|alle zustimmen|zustimmen und weiter|einwilligen|einwilligen und weiter|alle einwilligen|einverstanden|mit werbung weiterlesen|mit werbung lesen|accept all|agree|i agree|ok)$/i;

async function acceptConsent(page) {
  for (let attempt = 0; attempt < 12; attempt++) {
    for (const frame of page.frames()) {
      try {
        const buttons = frame.locator('button, [role="button"], a.message-button, a[class*="button"]');
        const count = Math.min(await buttons.count(), 60);
        for (let i = 0; i < count; i++) {
          const b = buttons.nth(i);
          const raw = (await b.innerText({ timeout: 300 }).catch(() => '')) || (await b.getAttribute('title').catch(() => '')) || '';
          const text = raw.replace(/\s+/g, ' ').replace(/[\s›»>→]+$/, '').trim();
          if (CONSENT.test(text) && (await b.isVisible().catch(() => false))) {
            await b.click({ timeout: 2000 });
            return text;
          }
        }
      } catch {
        // Rahmen weg oder noch nicht fertig
      }
    }
    await page.waitForTimeout(700);
  }
  return null;
}

function sameSite(a, b) {
  const base = (h) => h.split('.').slice(-2).join('.');
  return base(a) === base(b);
}

async function pickArticle(page, start) {
  const host = new URL(start).hostname;
  const links = await page.$$eval('a[href]', (as) => as.map((a) => a.href));
  const candidates = links.filter((href) => {
    let u;
    try { u = new URL(href); } catch { return false; }
    if (!sameSite(u.hostname, host) || u.hash) return false;
    const p = u.pathname;
    if (/\/(video|videos|plus|abo|podcast|podcasts|thema|themen|autor|autoren|newsletter|service|shop|spiele|live|tv|audio|bilder|fotos|galerie|quiz)\//i.test(p)) return false;
    if (/(ticker|liveblog|newsblog|gutschein|deals|rabatt)/i.test(p)) return false;
    // Artikel haben einen sprechenden Pfad mit mehreren Bindestrichen ("/politik/wahl-in-...-123.html").
    const slug = p.split('/').filter(Boolean).sort((a, b) => b.split('-').length - a.split('-').length)[0] || '';
    return p.length > 40 && slug.split('-').length >= 4;
  });
  // Bevorzugt Links, die nach Artikel mit id aussehen.
  candidates.sort((a, b) => Number(/(\.html?$|\d{5,}|-a-[0-9a-f-]{8,})/.test(new URL(b).pathname)) - Number(/(\.html?$|\d{5,}|-a-[0-9a-f-]{8,})/.test(new URL(a).pathname)));
  return candidates[0] || null;
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
      hiddenByWerbefrei: document.querySelectorAll('[data-werbefrei-verborgen]').length,
    };
  }, adHosts);
}

async function visit(context, start, adHosts, label, articleUrl) {
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
      await page.goto(start, { waitUntil: 'domcontentloaded', timeout: 45000 });
      consent = await acceptConsent(page);
      await page.waitForTimeout(2500);
      await page.waitForLoadState('domcontentloaded').catch(() => {});
      url = await pickArticle(page, start);
      if (!url) throw new Error('kein Artikel auf der Startseite gefunden');
    }
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
    consent = (await acceptConsent(page)) || consent;
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

async function compare(start, adHosts) {
  const name = new URL(start).hostname.replace(/^www\./, '');
  const withExt = await launch();
  await waitForSetup(withExt.worker, { timeout: 120000 });
  const b = await visit(withExt.context, start, adHosts, 'mit');
  await withExt.context.close();
  const plain = await launch({ withExtension: false });
  const a = await visit(plain.context, start, adHosts, 'ohne', b.url);
  await plain.context.close();
  console.log(`${name.padEnd(18)} ohne: ${a.error || `${a.adFrames} Werberahmen, ${a.adSlots} Werbeplätze, ${a.requests.ad} Werbeanfragen`}`);
  console.log(`${''.padEnd(18)} mit:  ${b.error || `${b.adFrames} Werberahmen, ${b.adSlots} Werbeplätze, ${b.requests.blocked} Anfragen blockiert, ${b.hiddenByWerbefrei} per Heuristik ausgeblendet`}`);
  return { name, start, ohne: a, mit: b };
}

// Werbe-Domains aus den Listen der Erweiterung holen (einmal installieren, Listen laden).
const setup = await launch();
await waitForSetup(setup.worker, { timeout: 120000 });
for (let i = 0; i < 60; i++) {
  const { listMeta = {} } = await setup.worker.evaluate(() => chrome.storage.local.get('listMeta'));
  if (listMeta.easylist?.updated && listMeta['easylist-germany']?.updated) break;
  await new Promise((r) => setTimeout(r, 1000));
}
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
  return `| ${name} | ${f(a, 'adFrames')} / ${f(b, 'adFrames')} | ${f(a, 'adSlots')} / ${f(b, 'adSlots')} | ${f(a, 'labels')} / ${f(b, 'labels')} | ${a.error ? '–' : a.requests.ad} | ${b.error ? '–' : b.requests.blocked} | ${b.error ? '–' : b.hiddenByWerbefrei} | ${f(a, 'articleChars')} / ${f(b, 'articleChars')}${broken ? ' ⚠' : ''} | ${b.error || a.error || ''} |`;
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
