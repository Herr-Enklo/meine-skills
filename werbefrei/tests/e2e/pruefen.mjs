// Zeigt, was Werbefrei auf einer Seite ausblendet: jedes Element, das die eigene Erkennung
// versteckt hat, mit Grund und Ausschnitt. Hilft beim Nachschärfen der Heuristiken.
//   node tests/e2e/pruefen.mjs https://www.beispiel.de/artikel.html
// Die Einwilligung wird bestätigt, damit die Seite Werbung lädt.

import { launch, waitForLists } from './browser.mjs';
import { acceptConsent } from './einwilligung.mjs';

const url = process.argv[2];
if (!url) {
  console.error('Aufruf: node tests/e2e/pruefen.mjs <Adresse>');
  process.exit(2);
}

const { context, worker } = await launch();
try {
  await waitForLists(worker);
  const page = await context.newPage();
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  const consent = await acceptConsent(page);
  console.log(consent ? `Einwilligung: "${consent}"` : 'Kein Einwilligungsdialog gefunden');
  await page.waitForTimeout(4000);
  for (let i = 0; i < 12; i++) {
    await page.mouse.wheel(0, 700);
    await page.waitForTimeout(400);
  }
  await page.waitForTimeout(3000);
  const hidden = await page.evaluate(() =>
    [...document.querySelectorAll('[data-werbefrei-verborgen]')].map((el) => ({
      grund: el.getAttribute('data-werbefrei-verborgen'),
      element: `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ''}${el.getAttribute('class') ? `.${el.getAttribute('class').trim().split(/\s+/).slice(0, 3).join('.')}` : ''}`,
      text: (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 90),
      src: el.getAttribute('src')?.slice(0, 90),
    })),
  );
  // Optional Bildschirmfotos: FOTO=pfad/name schreibt name-oben.png und name-mitte.png.
  if (process.env.FOTO) {
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(800);
    await page.screenshot({ path: `${process.env.FOTO}-oben.png` });
    await page.evaluate(() => window.scrollTo(0, 1400));
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${process.env.FOTO}-mitte.png` });
  }
  console.log(`\n${hidden.length} Elemente per Erkennung ausgeblendet:`);
  for (const h of hidden) console.log(`- [${h.grund}] ${h.element}${h.text ? `  "${h.text}"` : ''}${h.src ? `  ${h.src}` : ''}`);
} finally {
  await context.close();
}
