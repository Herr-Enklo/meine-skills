import { readFileSync } from 'node:fs';
import { launch, waitForSetup } from './browser.mjs';
import { acceptConsent } from './einwilligung.mjs';
const findings = JSON.parse(readFileSync('/tmp/claude-0/-home-user-meine-skills/5802fee4-c7d1-5c23-b60d-6eb933047358/scratchpad/research/findings.json', 'utf8')).sites;
const CANDIDATES = {
  'spiegel.de': ['.iqdcontainer', 'div[data-advertisement]', 'div[data-target-id^="smartfeed-sponsored-box"]', '#iqd_leftAd', '#iqd_rightAd', 'div.min-h-282:has(> div[data-advertisement])', 'div.min-h-282:has([data-advertisement*="pos_recommendation"])'],
  'zeit.de': ['div.comment__ad'],
  'bild.de': ['div.mtl--ad-mark'],
  'welt.de': ['[data-external-content="Outbrain.MoreLikeThis"]', '[data-external-content="Outbrain.Topics"]', '[data-external-content^="Outbrain"]'],
  'focus.de': ['[data-island="AdSlot"]', 'div.Ad-Carousel', 'div.Article-CTAButton[data-element-tracking-creative="layout-commercial"]'],
  'chip.de': ['tr.Table-Widget-Row--Ad', 'div.Ad-Carousel', '[data-island="AdSlot"]'],
  'n-tv.de': ['[class*="Ada_superbanner"]', '[class*="Ada_skyscraper"]', '[class*="Ada_"]'],
  'merkur.de': ['div.Skyscraper'],
  'tagesspiegel.de': ['#outbrain-container'],
  't-online.de': ['div.js-commercial-stream-item', '[data-component^="Nativendo"]', '[data-commercial-format]', '[data-testid^="CommercialSDI"]'],
};
const only = process.argv.slice(2);
const { context, worker } = await launch();
await waitForSetup(worker, { timeout: 120000 });
for (let i = 0; i < 60; i++) { const { listMeta = {} } = await worker.evaluate(() => chrome.storage.local.get('listMeta')); if (listMeta.easylist?.updated && listMeta['easylist-germany']?.updated) break; await new Promise(r => setTimeout(r, 1000)); }
for (const [site, sels] of Object.entries(CANDIDATES)) {
  if (only.length && !only.includes(site)) continue;
  const url = findings[site]?.articleUrl; if (!url) continue;
  const page = await context.newPage();
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
    const consent = await acceptConsent(page);
    await page.waitForTimeout(3000);
    for (let i = 0; i < 12; i++) { await page.mouse.wheel(0, 700); await page.waitForTimeout(350); }
    await page.waitForTimeout(2500);
    const res = await page.evaluate((sels) => {
      const out = {};
      for (const s of sels) {
        let els = []; try { els = [...document.querySelectorAll(s)]; } catch (e) { out[s] = 'UNGÜLTIG'; continue; }
        out[s] = els.slice(0, 8).map(el => { const r = el.getBoundingClientRect(); return `${Math.round(r.width)}x${Math.round(r.height)} vis=${el.checkVisibility()} text=${(el.innerText||'').trim().length} "${(el.innerText||'').trim().replace(/\s+/g,' ').slice(0,50)}" h1=${!!el.querySelector('h1')} body=${!!el.querySelector('[itemprop=articleBody]')}`; });
        if (els.length > 8) out[s].push(`… ${els.length} Treffer`);
      }
      const hidden = [...document.querySelectorAll('[data-werbefrei-verborgen]')].map(el => `${el.getAttribute('data-werbefrei-verborgen')}:${el.tagName}.${(el.getAttribute('class')||'').split(/\s+/).slice(0,2).join('.')}`);
      const labels = [...document.querySelectorAll('body *')].filter(el => !el.children.length && /^(anzeigen?|werbung)$/i.test((el.textContent||'').trim()) && el.checkVisibility()).map(el => { let p = el; for (let i=0;i<3&&p.parentElement;i++) p=p.parentElement; return `${el.tagName}.${(el.getAttribute('class')||'').slice(0,40)} in ${p.tagName}.${(p.getAttribute('class')||'').slice(0,60)}#${p.id}`; });
      return { out, hidden, labels, h1: document.querySelector('h1')?.innerText?.slice(0, 60) };
    }, sels);
    console.log(`\n=== ${site} (Einwilligung: ${consent}) h1="${res.h1}"`);
    for (const [s, v] of Object.entries(res.out)) console.log(`  ${s}\n     ${Array.isArray(v) ? (v.length ? v.join('\n     ') : '(keine Treffer)') : v}`);
    console.log(`  Heuristik: ${res.hidden.join(', ')}`);
    console.log(`  Sichtbare Kennzeichnungen: ${res.labels.slice(0, 8).join(' | ')}`);
  } catch (e) { console.log(`\n=== ${site} FEHLER ${e.message.split('\n')[0]}`); }
  await page.close();
}
await context.close();
