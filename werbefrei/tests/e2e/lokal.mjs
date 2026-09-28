// End-to-End-Test gegen eine nachgebaute Artikelseite, ohne echte Nachrichtenseiten.
//   node tests/e2e/lokal.mjs            (HEADED=1 zeigt das Browserfenster)
//
// Die Seite lädt Werbung von echten Werbeservern (doubleclick.net, amazon-adsystem.com). Diese
// Anfragen blockiert die Erweiterung, bevor sie das Netz erreichen; der Test braucht dafür keinen
// Internetzugang. Abonnierte Listen werden abgeschaltet, damit nur die eingebauten Regeln und die
// Heuristiken wirken.

import { createServer } from 'node:http';
import { readFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { launch, waitForSetup, extensionPage, sendFrom } from './browser.mjs';

const fixtures = fileURLToPath(new URL('./fixtures/', import.meta.url));
const shots = fileURLToPath(new URL('../../test-ergebnisse/', import.meta.url));
mkdirSync(shots, { recursive: true });

const server = createServer((req, res) => {
  const host = (req.headers.host || '').split(':')[0];
  if (host === 'video.test') {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end('<body style="margin:0;background:#123;color:#fff;font:20px sans-serif;display:grid;place-items:center;height:100vh">Videoplayer</body>');
    return;
  }
  if (req.url.startsWith('/artikel')) {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(readFileSync(`${fixtures}artikel.html`, 'utf8').replaceAll('http://video.test/', `http://video.test:${port}/`));
    return;
  }
  res.writeHead(404);
  res.end();
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const port = server.address().port;
const ARTICLE = `http://news.test:${port}/artikel.html`;

const results = [];
function check(name, ok, detail = '') {
  results.push({ name, ok, detail });
  console.log(`${ok ? '  ok  ' : 'FEHLER'}  ${name}${detail ? `  (${detail})` : ''}`);
}

const { context, worker, extensionId } = await launch({
  args: ['--host-resolver-rules=MAP *.test 127.0.0.1', '--proxy-bypass-list=*.test;127.0.0.1'],
});

try {
  await waitForSetup(worker);
  const options = await extensionPage(context, extensionId);
  for (const id of ['easylist-germany', 'easylist']) await sendFrom(options, { type: 'setListEnabled', id, enabled: false });
  await sendFrom(options, { type: 'saveUserRules', text: '' });

  const page = await context.newPage();
  const blocked = [];
  page.on('requestfailed', (r) => {
    if (r.failure()?.errorText === 'net::ERR_BLOCKED_BY_CLIENT') blocked.push(new URL(r.url()).hostname);
  });
  await page.goto(ARTICLE, { waitUntil: 'load' });
  await page.waitForTimeout(5500);

  const visible = (sel) => page.locator(sel).first().evaluate((el) => el.checkVisibility());

  console.log('\nNetz');
  check('gpt.js von doubleclick.net blockiert', blocked.some((h) => h.endsWith('doubleclick.net')), blocked.join(', '));
  check('apstag.js von amazon-adsystem.com blockiert', blocked.includes('c.amazon-adsystem.com'));

  console.log('\nWerbeplätze ausgeblendet');
  for (const [sel, what] of [
    ['#wp-billboard', 'Billboard mit Kennzeichnung "Anzeige"'],
    ['#wp-inline', 'Werbeplatz zwischen den Absätzen'],
    ['#wp-sky', 'leerer Skyscraper in der Seitenleiste'],
    ['#wp-sticky', 'klebende Werbeleiste unten'],
    ['#taboola-below-article-thumbnails', 'Taboola-Widget unter dem Artikel'],
    ['#teaser-anzeige', 'gesponserter Beitrag in der Teaserliste'],
    ['#wp-nachgeladen', 'nachgeladener leerer Werbeplatz'],
    ['#wp-skript', 'Werbeplatz mit Inline-Skript und Kennzeichnung'],
    ['#ersatz-rahmen', 'Ersatzanzeige (Bild im Werbeformat, Zufallsnamen) mit Kennzeichnung'],
  ]) {
    check(what, !(await visible(sel)));
  }

  console.log('\nInhalt bleibt sichtbar');
  for (const [sel, what] of [
    ['h1', 'Überschrift'],
    ['#absatz-1', 'Absatz mit dem Wort "Werbung"'],
    ['#absatz-2', 'Absatz mit dem Wort "Anzeige"'],
    ['#absatz-3', 'Absatz nach dem Werbeplatz'],
    ['#kicker-werbung', 'Dachzeile "Werbung" über der Überschrift'],
    ['#adhoc', 'Kasten mit Klasse ad-hoc-note und Text'],
    ['#video', 'eingebettetes Video'],
    ['#teaser-1', 'echter Teaser'],
    ['#teaser-3', 'echter Teaser'],
    ['#consent-dialog li:first-child', 'Einwilligungszweck "Werbung"'],
    ['#sidebar-meistgelesen', 'Kasten "Meistgelesen"'],
    ['header.site nav a[href="/werben"]', 'Menülink "Werbung"'],
    ['#fusszeile a[href="/werben"]', 'Fußzeilenlink "Werbung"'],
    ['#knopf-anzeigen', 'Knopf "Anzeigen"'],
    ['#lazy-billboard', 'Kasten mit Klasse billboard und verzögert ladendem Bild'],
    ['#foto-normal', 'Foto im Format 300×250'],
    ['#foto-zufall', 'Foto im Format 300×250 mit Bildunterschrift in Container mit Zufallsnamen'],
  ]) {
    check(what, await visible(sel));
  }
  await page.screenshot({ path: `${shots}lokal-mit-werbefrei.png`, fullPage: true });

  console.log('\nElement-Auswahl');
  const tabId = await worker.evaluate(async (url) => (await chrome.tabs.query({ url })).at(0)?.id, `${ARTICLE}`);
  await page.bringToFront();
  await sendFrom(options, { type: 'startPicker', tabId });
  await page.waitForSelector('#werbefrei-auswahl', { state: 'attached' });
  await page.locator('#eigenes-element').scrollIntoViewIfNeeded();
  const box = await page.locator('#eigenes-element').boundingBox();
  await page.mouse.move(box.x + 20, box.y + 20);
  await page.mouse.move(box.x + 30, box.y + 30);
  await page.mouse.click(box.x + 30, box.y + 30);
  await page.waitForTimeout(200);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(800);
  const { userRules } = await worker.evaluate(() => chrome.storage.local.get('userRules'));
  check('Auswahl speichert eine Regel für die Seite', /^news\.test##.+$/m.test(userRules || ''), (userRules || '').trim());
  check('ausgewähltes Element ist verschwunden', !(await visible('#eigenes-element')));
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(800);
  check('Regel greift nach dem Neuladen', !(await visible('#eigenes-element')));

  console.log('\nPopup');
  await page.waitForTimeout(4000); // leere Werbeplätze verschwinden erst nach zwei Durchläufen
  const popup = await extensionPage(context, extensionId, `popup/popup.html?tab=${tabId}`);
  await popup.setViewportSize({ width: 320, height: 420 });
  await popup.waitForFunction(() => document.getElementById('hidden').textContent !== '–', null, { timeout: 5000 }).catch(() => {});
  const hiddenCount = Number((await popup.locator('#hidden').textContent()).replace(/\D/g, ''));
  check('Popup zählt ausgeblendete Werbeplätze', hiddenCount >= 9, `${hiddenCount}`);
  await popup.screenshot({ path: `${shots}popup.png` });

  console.log('\nAusnahme für die Seite');
  await sendFrom(options, { type: 'setSiteEnabled', tabId, enabled: false });
  await page.waitForLoadState('load');
  await page.waitForTimeout(2500);
  check('Werbeplatz ist wieder da, wenn Werbefrei auf der Seite aus ist', await visible('#wp-billboard'));
  check('eigenes Element ist wieder da', await visible('#eigenes-element'));
  await sendFrom(options, { type: 'setSiteEnabled', tabId, enabled: true });
  await page.waitForLoadState('load');
  await page.waitForTimeout(2500);
  check('nach dem Wiedereinschalten wieder ausgeblendet', !(await visible('#wp-billboard')));

  console.log('\nEinstellungsseite');
  await options.reload();
  await options.waitForSelector('.card');
  await options.setViewportSize({ width: 1100, height: 1500 });
  check('Einstellungen zeigen die Listen', (await options.locator('.card').count()) >= 4);
  await options.screenshot({ path: `${shots}einstellungen.png`, fullPage: true });
} finally {
  await context.close();
  server.close();
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length} von ${results.length} Prüfungen bestanden.`);
process.exit(failed.length ? 1 : 0);
