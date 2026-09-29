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
  if (host === 'werbung.test') {
    // Steht als eigene Netzregel auf der Sperrliste; antwortet, wenn Werbefrei es durchlässt.
    res.writeHead(200, { 'content-type': 'text/plain', 'access-control-allow-origin': '*' });
    res.end('ok');
    return;
  }
  if (host === 'consent.test' && req.url.startsWith('/rahmen-abo')) {
    // Abo-Abfrage in einem eigenen Rahmen ohne Sourcepoint (wie gmx.net)
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(`<!doctype html><meta charset="utf-8"><body style="font:15px sans-serif;padding:16px">
      <h2>Postfach ohne Werbung abonnieren – oder mit Werbung und Tracking weiter wie gewohnt</h2>
      <p>Mit Premium ab 3,99 €/Monat ohne Werbetracking.</p> <button>Zum Abo ohne Fremdwerbung</button>
      <p>Mit Ihrer Zustimmung verarbeiten wir und unsere Partner Daten mit Cookies (Datenschutz).</p>
      <button id="ja">Akzeptieren und weiter</button>
      <script>document.getElementById('ja').addEventListener('click', () => parent.postMessage('zugestimmt', '*'));</script>
    </body>`);
    return;
  }
  if (host === 'consent.test') {
    // Nachbildung eines Sourcepoint-Dialogs in einem Rahmen von fremder Domain.
    const art = new URL(req.url, 'http://consent.test').searchParams.get('art');
    const text = art === 'pur'
      ? 'Mit Werbung und Tracking nutzen: Zustimmen. Oder ohne Werbung mit dem PUR-Abo für 2,99 € / Monat: Jetzt abonnieren.'
      : 'Wir und unsere Partner verwenden Cookies und ähnliche Technologien, um unser Angebot zu verbessern. Zustimmen. Einstellungen.';
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    if (art?.startsWith('knopf')) {
      // Wie bei golem.de: Im Rahmen steht nur der Zustimmungsknopf, der Dialog gehört zur Seite.
      res.end(`<!doctype html><meta charset="utf-8"><body style="margin:0">
        <button class="sp_choice_type_11">Zustimmen und weiter</button>
        <script>document.querySelector('button').addEventListener('click', () => parent.postMessage('zugestimmt', '*'));</script>
      </body>`);
      return;
    }
    // Wie bei Sourcepoint: Erst steht nur Skripttext im Dokument, der Dialog mit Knöpfen kommt später.
    res.end(`<!doctype html><meta charset="utf-8"><body style="font:15px sans-serif;padding:16px">
      <script>window.preRenderData = { url: '/' };</script>
      <div id="dialog"></div>
      <script>setTimeout(() => {
        document.getElementById('dialog').innerHTML = '<p>${text}</p><button class="sp_choice_type_11">Zustimmen</button> <button>Einstellungen</button>';
        document.querySelector('.sp_choice_type_11').addEventListener('click', () => parent.postMessage('zugestimmt', '*'));
      }, 700);</script>
      ${art === 'spaet' ? `<script>setTimeout(() => { document.getElementById('dialog').insertAdjacentHTML('beforeend', '<p>Oder ohne Werbung mit dem PUR-Abo für 2,99 € / Monat.</p>'); }, 3500);</script>` : ''}
    </body>`);
    return;
  }
  if (host === 'video.test') {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end('<body style="margin:0;background:#123;color:#fff;font:20px sans-serif;display:grid;place-items:center;height:100vh">Videoplayer</body>');
    return;
  }
  const cookiePage = /^\/(cookie-banner|cookie-pur|cookie-sp|cookie-opencmp|cookie-eigen|cookie-fallen|cookie-rahmen)\.html/.exec(req.url);
  if (cookiePage) {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(readFileSync(`${fixtures}${cookiePage[1]}.html`));
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
  await sendFrom(options, { type: 'saveUserRules', text: '||werbung.test^\n' });

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
    ['#spaeter-werbung', 'Element, das nachträglich die Klasse adsbygoogle bekommt'],
    ['#ersatz-rahmen', 'Ersatzanzeige (Bild im Werbeformat, Zufallsnamen) mit Kennzeichnung'],
    ['#ersatz-breit', 'Ersatzanzeige in Spaltenbreite (640×200)'],
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
    ['#foto-alt', 'Foto mit Beschreibung (alt) in Container mit Zufallsnamen'],
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

  console.log('\nPause, Ausnahmen und neue Regeln ohne Neuladen');
  const werbung = (p) => p.evaluate((port) => fetch(`http://werbung.test:${port}/x`).then((r) => String(r.status), () => 'blockiert'), port);
  check('eigene Netzregel sperrt werbung.test', (await werbung(page)) === 'blockiert');

  await sendFrom(options, { type: 'setPaused', paused: true });
  await page.waitForTimeout(700);
  check('Pause: offene Seite lädt wieder von gesperrten Servern', (await werbung(page)) === '200');
  check('Pause: ausgeblendeter Werbeplatz der offenen Seite ist wieder da', await visible('#wp-billboard'));
  check('Pause: per Liste ausgeblendetes Taboola-Widget ist wieder da', await visible('#taboola-below-article-thumbnails'));

  const page2 = await context.newPage();
  await page2.goto(ARTICLE, { waitUntil: 'load' });
  await page2.waitForTimeout(1500);
  const visible2 = (sel) => page2.locator(sel).first().evaluate((el) => el.checkVisibility());
  check('Pause: neu geöffnete Seite bleibt unverändert', (await visible2('#wp-billboard')) && (await visible2('#taboola-below-article-thumbnails')));

  await sendFrom(options, { type: 'setPaused', paused: false });
  await page.waitForTimeout(700);
  check('Fortsetzen: offene Seite sperrt wieder', (await werbung(page)) === 'blockiert');
  check('Fortsetzen: Werbeplatz der offenen Seite wieder ausgeblendet', !(await visible('#wp-billboard')));
  await page2.waitForTimeout(3500);
  check('Fortsetzen: während der Pause geöffnete Seite wird nachträglich eingerichtet', !(await visible2('#taboola-below-article-thumbnails')) && !(await visible2('#wp-billboard')));

  await sendFrom(options, { type: 'setAllowlist', hosts: ['news.test'] });
  await page.waitForTimeout(700);
  check('Ausnahme aus den Einstellungen: offene Seite lädt sofort wieder', (await werbung(page)) === '200');
  check('Ausnahme aus den Einstellungen: Werbeplatz sofort wieder da', await visible('#wp-billboard'));
  const gateName = (p) => p.evaluate(() => [...document.documentElement.attributes].map((a) => a.name).find((n) => /^data-[a-z]{12}$/.test(n)) || null);
  const [gateA, gateB] = [await gateName(page), await gateName(page2)];
  check('Schalter-Attribut ist pro geladener Seite ein anderes', Boolean(gateA && gateB && gateA !== gateB), `${gateA} / ${gateB}`);
  await page2.close();
  await sendFrom(options, { type: 'setAllowlist', hosts: [] });
  await page.waitForTimeout(700);
  check('Ausnahme entfernt: offene Seite sperrt und blendet wieder aus', (await werbung(page)) === 'blockiert' && !(await visible('#wp-billboard')));

  const { userRules: before } = await worker.evaluate(() => chrome.storage.local.get('userRules'));
  await sendFrom(options, { type: 'saveUserRules', text: `${before}news.test###live-regel\n` });
  await page.waitForTimeout(1000);
  check('neue eigene Regel greift in der offenen Seite ohne Neuladen', !(await visible('#live-regel')));

  console.log('\nCookie-Hinweise');
  const cookieTab = await context.newPage();
  const shown = (sel) => cookieTab.locator(sel).first().evaluate((el) => el.checkVisibility()).catch(() => false);
  const agreed = () => cookieTab.evaluate(() => window.__zugestimmt === true);
  const scrolls = async () => {
    await cookieTab.evaluate(() => window.scrollTo(0, 0));
    await cookieTab.mouse.move(400, 300);
    await cookieTab.mouse.wheel(0, 700);
    await cookieTab.waitForTimeout(400);
    return cookieTab.evaluate(() => window.scrollY > 100);
  };
  await cookieTab.goto(`http://news.test:${port}/cookie-banner.html`, { waitUntil: 'load' });
  await cookieTab.waitForTimeout(2500);
  check('gewöhnlicher Cookie-Banner ausgeblendet', !(await shown('#onetrust-banner-sdk')) && !(await shown('.onetrust-pc-dark-filter')));
  check('Scroll-Sperre des Banners aufgehoben', await scrolls());
  check('Seiteninhalt bleibt sichtbar', await shown('#titel'));

  await sendFrom(options, { type: 'setOption', key: 'cookieBanners', value: false });
  await cookieTab.waitForTimeout(800);
  check('Einstellung aus: Banner ohne Neuladen wieder da', await shown('#onetrust-banner-sdk'));
  await sendFrom(options, { type: 'setOption', key: 'cookieBanners', value: true });
  await cookieTab.waitForTimeout(800);
  check('Einstellung wieder an: Banner wieder ausgeblendet', !(await shown('#onetrust-banner-sdk')));

  await cookieTab.goto(`http://news.test:${port}/cookie-pur.html`, { waitUntil: 'load' });
  await cookieTab.waitForTimeout(2500);
  check('Dialog mit Abo-Angebot bleibt stehen, ohne Einwilligung', (await shown('#cmpbox')) && !(await agreed()));
  check('dessen Scroll-Sperre bleibt', !(await scrolls()));

  await cookieTab.goto(`http://news.test:${port}/cookie-pur.html?art=spaet`, { waitUntil: 'load' });
  await cookieTab.waitForTimeout(1200);
  const purFirstHidden = !(await shown('#cmpbox'));
  await cookieTab.waitForTimeout(1500);
  check('Abo-Angebot kommt später: Banner erst ausgeblendet, dann wieder da', purFirstHidden && (await shown('#cmpbox')));
  check('dann bleibt auch hier die Scroll-Sperre', !(await scrolls()));

  await cookieTab.goto(`http://news.test:${port}/cookie-pur.html?art=versteckt`, { waitUntil: 'load' });
  await cookieTab.waitForTimeout(2500);
  check('versteckt eingefügter Abo-Dialog bleibt stehen, sobald er erscheint', await shown('#cmpbox'));

  await cookieTab.goto(`http://news.test:${port}/cookie-sp.html?art=normal`, { waitUntil: 'load' });
  await cookieTab.waitForTimeout(3000);
  check('Sourcepoint-Rahmen mit gewöhnlichem Cookie-Dialog ausgeblendet', !(await shown('#sp_message_container_1234')));
  check('Sourcepoint-Scroll-Sperre aufgehoben', await scrolls());

  await cookieTab.goto(`http://news.test:${port}/cookie-sp.html?art=pur`, { waitUntil: 'load' });
  await cookieTab.waitForTimeout(3000);
  check('Sourcepoint-Rahmen mit Pur-Abo-Angebot bleibt stehen, ohne Einwilligung', (await shown('#sp_message_container_1234')) && !(await agreed()));

  await cookieTab.goto(`http://news.test:${port}/cookie-sp.html?art=knopf`, { waitUntil: 'load' });
  await cookieTab.waitForTimeout(3000);
  check('Knopf-Rahmen im Abo-Dialog der Seite (wie golem.de) bleibt stehen, ohne Einwilligung', (await shown('#sp_message_container_1234')) && !(await agreed()));

  // OpenCMP (merkur.de): Dialog im Shadow DOM eines Elements ohne Höhe
  const openCmpShown = () => cookieTab.evaluate(() => {
    const host = document.querySelector('.cmp-root-container');
    return Boolean(host && host.checkVisibility() && host.shadowRoot.querySelector('.cmp_overlay').checkVisibility());
  });
  await cookieTab.goto(`http://news.test:${port}/cookie-opencmp.html?art=abo`, { waitUntil: 'load' });
  await cookieTab.waitForTimeout(2500);
  check('OpenCMP-Abo-Abfrage (wie merkur.de) bleibt stehen, ohne Einwilligung', (await openCmpShown()) && !(await agreed()));
  await cookieTab.goto(`http://news.test:${port}/cookie-opencmp.html?art=normal`, { waitUntil: 'load' });
  await cookieTab.waitForTimeout(2500);
  check('gewöhnlicher OpenCMP-Hinweis ausgeblendet', !(await openCmpShown()) && !(await agreed()) && (await shown('#titel')));

  // Selbst gebaute Dialoge ohne bekannten Anbieter (allgemeine Erkennung)
  await cookieTab.goto(`http://news.test:${port}/cookie-eigen.html?art=zdf`, { waitUntil: 'load' });
  await cookieTab.waitForTimeout(2500);
  check('selbst gebauter Dialog wie auf zdf.de ausgeblendet', !(await shown('[role="dialog"]')) && !(await agreed()));
  check('und mit „Ablehnen“ beantwortet (Seite hebt ihre Sperren selbst auf)', await cookieTab.evaluate(() => window.__abgelehnt === true));
  check('dessen Hintergrundebene ebenfalls', !(await shown('.kx81')));
  check('Seite danach scrollbar', await scrolls());
  await cookieTab.evaluate(() => window.scrollTo(0, 0));
  await cookieTab.click('#klickmich', { timeout: 3000 }).catch(() => {});
  check('Seite danach klickbar (pointer-events)', (await cookieTab.textContent('#zaehler')) === '1');
  await cookieTab.goto(`http://news.test:${port}/cookie-eigen.html?art=schatten`, { waitUntil: 'load' });
  await cookieTab.waitForTimeout(2500);
  check('Dialog im Shadow DOM eines Elements im Seiteninhalt (wie alternate.de) ausgeblendet und abgelehnt',
    !(await shown('#cmp-xy-shadow')) && (await cookieTab.evaluate(() => window.__abgelehnt === true)) && (await shown('#titel')));
  await cookieTab.goto(`http://news.test:${port}/cookie-eigen.html?art=uc`, { waitUntil: 'load' });
  await cookieTab.waitForTimeout(4000);
  check('Usercentrics-Dialog, der erst per CSS-Animation sichtbar wird (wie dm.de), ausgeblendet', !(await shown('#usercentrics-root')));
  await cookieTab.goto(`http://news.test:${port}/cookie-eigen.html?art=leiste`, { waitUntil: 'load' });
  await cookieTab.waitForTimeout(2500);
  check('schlichte Cookie-Leiste mit „OK“ ausgeblendet', !(await shown('.v3pl')));
  await cookieTab.goto(`http://news.test:${port}/cookie-eigen.html?art=abo`, { waitUntil: 'load' });
  await cookieTab.waitForTimeout(2500);
  check('selbst gebaute Abo-Abfrage bleibt stehen, ohne Einwilligung', (await shown('[role="dialog"]')) && !(await agreed()));
  check('deren Scroll-Sperre bleibt', !(await scrolls()));
  await cookieTab.goto(`http://news.test:${port}/cookie-rahmen.html`, { waitUntil: 'load' });
  await cookieTab.waitForTimeout(3000);
  check('Abo-Abfrage in fremdem Rahmen (wie gmx.net) bleibt stehen, ohne Einwilligung', (await shown('#abfrage')) && !(await agreed()));
  await cookieTab.goto(`http://news.test:${port}/cookie-fallen.html`, { waitUntil: 'load' });
  await cookieTab.waitForTimeout(3000);
  for (const [id, name] of [
    ['falle-login', 'Anmeldefenster mit Datenschutz-Hinweis'],
    ['falle-newsletter', 'Newsletter-Kasten mit Einwilligung'],
    ['falle-fuss', 'feste Fußleiste mit Cookie-Einstellungen'],
    ['falle-chat', 'Chat-Fenster'],
    ['falle-knopf', 'Knopf „Cookie-Einstellungen“'],
    ['falle-video', 'Zustimmung für ein eingebettetes Video'],
  ]) {
    check(`Falle bleibt sichtbar: ${name}`, await shown(`#${id}`));
  }

  await cookieTab.goto(`http://news.test:${port}/cookie-sp.html?art=spaet`, { waitUntil: 'load' });
  await cookieTab.waitForTimeout(2800);
  const firstHidden = !(await shown('#sp_message_container_1234'));
  await cookieTab.waitForTimeout(2500);
  check('Abo-Angebot kommt später: Dialog erst ausgeblendet, dann wieder da', firstHidden && (await shown('#sp_message_container_1234')));
  check('dann bleibt auch die Scroll-Sperre', !(await scrolls()));

  // Abo-Abfragen automatisch beantworten (Einstellung, standardmäßig aus). Zuerst: Der Schalter wird
  // eingeschaltet, während die Abfrage schon offen ist.
  for (const [art, name] of [['pur', 'die Sourcepoint-Abo-Abfrage'], ['knopf', 'der Knopf-Rahmen im Abo-Dialog der Seite']]) {
    await cookieTab.goto(`http://news.test:${port}/cookie-sp.html?art=${art}`, { waitUntil: 'load' });
    await cookieTab.waitForTimeout(3000);
    const openBefore = (await shown('#sp_message_container_1234')) && !(await agreed());
    await sendFrom(options, { type: 'setOption', key: 'autoConsent', value: true });
    await cookieTab.waitForTimeout(1500);
    check(`Schalter eingeschaltet, während ${name} offen ist: sofort beantwortet`, openBefore && (await agreed()) && !(await shown('#sp_message_container_1234')));
    await sendFrom(options, { type: 'setOption', key: 'autoConsent', value: false });
  }

  await sendFrom(options, { type: 'setOption', key: 'autoConsent', value: true });
  await cookieTab.goto(`http://news.test:${port}/cookie-sp.html?art=pur`, { waitUntil: 'load' });
  await cookieTab.waitForTimeout(3000);
  check('Schalter an: Sourcepoint-Abo-Abfrage mit „Einwilligen“ beantwortet', (await agreed()) && !(await shown('#sp_message_container_1234')));
  check('danach lässt sich die Seite scrollen', await scrolls());
  await cookieTab.goto(`http://news.test:${port}/cookie-pur.html`, { waitUntil: 'load' });
  await cookieTab.waitForTimeout(2500);
  check('Schalter an: consentmanager-Abo-Abfrage beantwortet', (await agreed()) && !(await shown('#cmpbox')));
  await cookieTab.goto(`http://news.test:${port}/cookie-opencmp.html?art=abo`, { waitUntil: 'load' });
  await cookieTab.waitForTimeout(2500);
  check('Schalter an: OpenCMP-Abo-Abfrage beantwortet', (await agreed()) && !(await openCmpShown()));
  await cookieTab.goto(`http://news.test:${port}/cookie-rahmen.html`, { waitUntil: 'load' });
  await cookieTab.waitForTimeout(3500);
  check('Schalter an: Abo-Abfrage in fremdem Rahmen beantwortet', (await agreed()) && !(await shown('#abfrage')));
  await cookieTab.goto(`http://news.test:${port}/cookie-eigen.html?art=abo`, { waitUntil: 'load' });
  await cookieTab.waitForTimeout(2500);
  check('Schalter an: selbst gebaute Abo-Abfrage über Knopftext beantwortet', (await agreed()) && !(await shown('[role="dialog"]')));
  await cookieTab.goto(`http://news.test:${port}/cookie-eigen.html?art=zdf`, { waitUntil: 'load' });
  await cookieTab.waitForTimeout(2500);
  check('Schalter an: gewöhnlicher selbst gebauter Dialog nicht zugestimmt, nur abgelehnt', !(await agreed()) && !(await shown('[role="dialog"]')));
  await cookieTab.goto(`http://news.test:${port}/cookie-sp.html?art=knopf`, { waitUntil: 'load' });
  await cookieTab.waitForTimeout(3000);
  check('Schalter an: Knopf-Rahmen im Abo-Dialog der Seite beantwortet', (await agreed()) && !(await shown('#sp_message_container_1234')));
  await cookieTab.goto(`http://news.test:${port}/cookie-sp.html?art=knopf-ohne-abo`, { waitUntil: 'load' });
  await cookieTab.waitForTimeout(3000);
  check('Knopf-Rahmen ohne Abo-Angebot: nichts geklickt, nichts ausgeblendet', !(await agreed()) && (await shown('#sp_message_container_1234')));
  await cookieTab.goto(`http://news.test:${port}/cookie-sp.html?art=normal`, { waitUntil: 'load' });
  await cookieTab.waitForTimeout(3000);
  check('gewöhnlicher Dialog wird nur ausgeblendet, nicht beantwortet', !(await agreed()) && !(await shown('#sp_message_container_1234')));
  await sendFrom(options, { type: 'setAllowlist', hosts: ['news.test'] });
  await cookieTab.goto(`http://news.test:${port}/cookie-sp.html?art=pur`, { waitUntil: 'load' });
  await cookieTab.waitForTimeout(3000);
  check('auf ausgenommener Seite keine Einwilligung', !(await agreed()) && (await shown('#sp_message_container_1234')));
  await sendFrom(options, { type: 'setAllowlist', hosts: [] });
  await sendFrom(options, { type: 'setOption', key: 'autoConsent', value: false });
  await cookieTab.close();

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
