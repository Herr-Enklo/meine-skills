// Zeichnet die Symbole der Erweiterung als PNG (aktiv: grün, aus/pausiert: grau).
//   node tools/icons.mjs
// Braucht Playwright mit Chromium (npm install; in der Claude-Cloud ist Chromium vorinstalliert).

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const out = fileURLToPath(new URL('../extension/icons/', import.meta.url));

// Ein Werbebanner (Rahmen mit drei Zeilen), diagonal durchgestrichen.
function svg(color, size) {
  const stroke = size <= 16 ? 2.2 : 1.8;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24">
  <rect x="0.5" y="0.5" width="23" height="23" rx="5.5" fill="${color}"/>
  <rect x="4.6" y="6.2" width="14.8" height="11.6" rx="1.8" fill="none" stroke="#fff" stroke-width="${stroke}"/>
  ${size > 16 ? '<path d="M7.6 10h5.2M7.6 13.6h8.8" stroke="#fff" stroke-width="1.5" stroke-linecap="round" opacity=".75"/>' : ''}
  <path d="M4.2 19.8 19.8 4.2" stroke="${color}" stroke-width="${stroke + 2.6}" stroke-linecap="round"/>
  <path d="M4.2 19.8 19.8 4.2" stroke="#fff" stroke-width="${stroke}" stroke-linecap="round"/>
</svg>`;
}

const variants = { an: '#0f6e5a', aus: '#8a9199' };
const sizes = [16, 32, 48, 128];

const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 1 });
for (const [name, color] of Object.entries(variants)) {
  for (const size of sizes) {
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(`<style>html,body{margin:0;background:transparent}</style>${svg(color, size)}`);
    const png = await page.locator('svg').screenshot({ omitBackground: true });
    writeFileSync(`${out}${name}-${size}.png`, png);
  }
  writeFileSync(`${out}${name}.svg`, `${svg(color, 128)}\n`);
}
await browser.close();
console.log('Symbole geschrieben:', Object.keys(variants).flatMap((n) => sizes.map((s) => `${n}-${s}.png`)).join(', '));
