// Zeigt, was Werbefrei auf einer Seite ausblendet: jedes Element, das die eigene Erkennung
// versteckt hat, mit Grund und Ausschnitt. Hilft beim Nachschärfen der Heuristiken.
//   node tests/e2e/pruefen.mjs https://www.beispiel.de/artikel.html
// Die Einwilligung wird bestätigt, damit die Seite Werbung lädt.

import { launch, waitForSetup } from './browser.mjs';

const url = process.argv[2];
if (!url) {
  console.error('Aufruf: node tests/e2e/pruefen.mjs <Adresse>');
  process.exit(2);
}

const CONSENT = /^(alle akzeptieren|akzeptieren|akzeptieren und weiter|zustimmen|alle zustimmen|einwilligen|einwilligen und weiter|einverstanden|mit werbung weiterlesen)$/i;

const { context, worker } = await launch();
try {
  await waitForSetup(worker, { timeout: 120000 });
  for (let i = 0; i < 60; i++) {
    const { listMeta = {} } = await worker.evaluate(() => chrome.storage.local.get('listMeta'));
    if (listMeta.easylist?.updated && listMeta['easylist-germany']?.updated) break;
    await new Promise((r) => setTimeout(r, 1000));
  }
  const page = await context.newPage();
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  outer: for (let attempt = 0; attempt < 10; attempt++) {
    for (const frame of page.frames()) {
      const buttons = frame.locator('button, [role="button"]');
      const n = Math.min(await buttons.count().catch(() => 0), 60);
      for (let i = 0; i < n; i++) {
        const text = ((await buttons.nth(i).innerText({ timeout: 300 }).catch(() => '')) || '').replace(/\s+/g, ' ').replace(/[\s›»>]+$/, '').trim();
        if (CONSENT.test(text) && (await buttons.nth(i).isVisible().catch(() => false))) {
          await buttons.nth(i).click().catch(() => {});
          console.log(`Einwilligung: "${text}"`);
          break outer;
        }
      }
    }
    await page.waitForTimeout(700);
  }
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
  console.log(`\n${hidden.length} Elemente per Erkennung ausgeblendet:`);
  for (const h of hidden) console.log(`- [${h.grund}] ${h.element}${h.text ? `  "${h.text}"` : ''}${h.src ? `  ${h.src}` : ''}`);
} finally {
  await context.close();
}
