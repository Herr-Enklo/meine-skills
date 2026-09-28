// Cookie-Hinweise auf echten Seiten: Wird ein gewöhnlicher Einwilligungsbanner ausgeblendet, lässt
// sich die Seite danach scrollen, und bleiben Abfragen mit Abo-Angebot (Pur, contentpass) stehen?
//   node tests/e2e/cookie-seiten.mjs [adresse …]
// Ergebnis: Tabelle in der Konsole und Bildschirmfotos test-ergebnisse/cookie-<seite>.png.
// Seiten und Anbieter ändern sich; die Ausgabe ist eine Momentaufnahme.

import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { launch, waitForLists } from './browser.mjs';

const out = fileURLToPath(new URL('../../test-ergebnisse/', import.meta.url));
mkdirSync(out, { recursive: true });

const SITES = process.argv.slice(2).length
  ? process.argv.slice(2)
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
  '.fc-consent-root', '#cookiescript_injected', '#tarteaucitronRoot', '.c24-cookie-consent-wrapper', 'div[id^="sp_message_container_"]',
].join(',');

const { context, worker } = await launch();
await waitForLists(worker);
const rows = [];
for (const url of SITES) {
  const name = new URL(url).hostname.replace(/^www\./, '');
  const page = await context.newPage();
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 40000 });
    await page.waitForTimeout(7000);
    const info = await page.evaluate((sel) => {
      const found = [...document.querySelectorAll(sel)].filter((el) => !el.parentElement?.closest(sel));
      return found.map((el) => ({
        el: `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ''}`,
        hidden: el.closest('[data-werbefrei-verborgen]') !== null,
        visible: el.checkVisibility() && el.getBoundingClientRect().height > 0,
      }));
    }, CMP);
    await page.mouse.move(600, 400);
    await page.mouse.wheel(0, 900);
    await page.waitForTimeout(600);
    // Manche Seiten scrollen den body statt des Fensters (check24).
    const scrollY = await page.evaluate(() => Math.round(Math.max(window.scrollY, document.body?.scrollTop || 0)));
    await page.evaluate(() => { window.scrollTo(0, 0); if (document.body) document.body.scrollTop = 0; });
    await page.screenshot({ path: `${out}cookie-${name}.png` });
    const banner = info.map((i) => `${i.el} ${i.hidden ? 'ausgeblendet' : i.visible ? 'SICHTBAR' : 'unsichtbar'}`).join(', ') || 'kein bekannter Anbieter gefunden';
    rows.push({ name, banner, scrollY });
    console.log(`${name.padEnd(20)} ${banner}; gescrollt: ${scrollY}px`);
  } catch (e) {
    console.log(`${name.padEnd(20)} FEHLER ${e.message.split('\n')[0]}`);
  }
  await page.close();
}
await context.close();
