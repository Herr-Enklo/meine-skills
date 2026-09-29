// Cookie-Hinweise auf echten Seiten: Wird ein gewöhnlicher Einwilligungsbanner ausgeblendet, lässt
// sich die Seite danach scrollen, und bleiben Abfragen mit Abo-Angebot (Pur, contentpass) stehen?
//   node tests/e2e/cookie-seiten.mjs [--einwilligen] [--de] [adresse …]
// Mit --einwilligen ist "Abo-Abfragen automatisch beantworten" eingeschaltet. Mit --de meldet der
// Testbrowser OpenCMP (merkur.de) einen Besucher aus Deutschland; außerhalb der EU zeigt OpenCMP
// sonst gar keinen Dialog.
// Ergebnis: Tabelle in der Konsole und Bildschirmfotos test-ergebnisse/cookie-<seite>.png.
// Seiten und Anbieter ändern sich; die Ausgabe ist eine Momentaufnahme.

import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { launch, waitForLists, extensionPage, sendFrom } from './browser.mjs';

const out = fileURLToPath(new URL('../../test-ergebnisse/', import.meta.url));
mkdirSync(out, { recursive: true });

const args = process.argv.slice(2);
const consent = args.includes('--einwilligen');
const germany = args.includes('--de');
const urls = args.filter((a) => !a.startsWith('--'));
const SITES = urls.length
  ? urls
  : [
      'https://usercentrics.com/de/',
      'https://www.didomi.io/',
      'https://www.consentmanager.net/',
      'https://www.onetrust.com/de/',
      'https://www.idealo.de/',
      'https://www.check24.de/',
      'https://www.mediamarkt.de/',
      'https://www.chefkoch.de/',
      'https://www.heise.de/',
      'https://www.spiegel.de/',
      'https://www.t-online.de/',
      'https://www.chip.de/',
    ];

const CMP = [
  '#onetrust-consent-sdk', '#CybotCookiebotDialog', '#usercentrics-root', '#usercentrics-cmp-ui', '#didomi-host',
  '#cmpwrapper', '#cmpbox', '#BorlabsCookieBox', '#cmplz-cookiebanner-container', '.cky-consent-container',
  '#cookie-law-info-bar', '.qc-cmp2-container', '#truste-consent-track', '.osano-cm-window', '#iubenda-cs-banner',
  '.fc-consent-root', '#cookiescript_injected', '#tarteaucitronRoot', '.c24-cookie-consent-wrapper', '.cmp-root-container',
  'div[id^="sp_message_container_"]',
].join(',');

const { context, worker, extensionId } = await launch();
await waitForLists(worker);
if (germany) {
  await context.route('https://cdntrf.com/api/country/**', (r) => r.fulfill({ status: 200, body: 'DE', headers: { 'access-control-allow-origin': '*' } }));
}
if (consent) {
  const options = await extensionPage(context, extensionId);
  await sendFrom(options, { type: 'setOption', key: 'autoConsent', value: true });
  await options.close();
  console.log('Abo-Abfragen werden automatisch beantwortet.\n');
}
const rows = [];
for (const url of SITES) {
  const name = new URL(url).hostname.replace(/^www\./, '');
  const page = await context.newPage();
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 40000 });
    await page.waitForTimeout(7000);
    // Nach einer Einwilligung leiten manche Seiten weiter (golem.de): dann auf die neue Seite warten.
    const measure = (fn, arg) => page.evaluate(fn, arg).catch(async (e) => {
      if (!/context was destroyed|navigat/i.test(e.message)) throw e;
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(3000);
      return page.evaluate(fn, arg);
    });
    const info = await measure((sel) => {
      const found = [...document.querySelectorAll(sel)].filter((el) => !el.parentElement?.closest(sel));
      return found.map((el) => ({
        el: `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ''}`,
        hidden: el.closest('[data-werbefrei-verborgen]') !== null,
        // OpenCMP: Das Element selbst hat keine Höhe, der Dialog steckt in seinem Shadow DOM.
        visible: el.checkVisibility() && [el, ...(el.shadowRoot?.querySelectorAll('*') || [])].some((e) => e.getBoundingClientRect().height > 0),
      }));
    }, CMP);
    await page.mouse.move(600, 400);
    await page.mouse.wheel(0, 900);
    await page.waitForTimeout(600);
    // Manche Seiten scrollen den body statt des Fensters (check24).
    const scrollY = await page.evaluate(() => Math.round(Math.max(window.scrollY, document.body?.scrollTop || 0)));
    await page.evaluate(() => { window.scrollTo(0, 0); if (document.body) document.body.scrollTop = 0; });
    await page.screenshot({ path: `${out}cookie-${name}.png` });
    const banner = info.map((i) => `${i.el} ${i.hidden ? 'ausgeblendet' : i.visible ? 'SICHTBAR' : 'unsichtbar'}`).join(', ') || 'kein Dialog (mehr) da';
    rows.push({ name, banner, scrollY });
    console.log(`${name.padEnd(20)} ${banner}; gescrollt: ${scrollY}px`);
  } catch (e) {
    console.log(`${name.padEnd(20)} FEHLER ${e.message.split('\n')[0]}`);
  }
  await page.close();
}
await context.close();
