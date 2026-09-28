import { launch, waitForSetup } from './browser.mjs';
import { acceptConsent } from './einwilligung.mjs';
const { context, worker } = await launch();
await waitForSetup(worker, { timeout: 120000 });
for (let i = 0; i < 60; i++) { const { listMeta = {} } = await worker.evaluate(() => chrome.storage.local.get('listMeta')); if (listMeta.easylist?.updated && listMeta['easylist-germany']?.updated) break; await new Promise(r => setTimeout(r, 1000)); }
for (const url of process.argv.slice(2)) {
  const page = await context.newPage();
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
  console.log('consent', await acceptConsent(page));
  await page.waitForTimeout(3000);
  for (let i = 0; i < 10; i++) { await page.mouse.wheel(0, 700); await page.waitForTimeout(350); }
  await page.waitForTimeout(2500);
  console.log(url, JSON.stringify(await page.evaluate(() => ({
    h1: document.querySelector('h1')?.innerText,
    hidden: [...document.querySelectorAll('[data-werbefrei-verborgen]')].map(el => `${el.getAttribute('data-werbefrei-verborgen')}: <${el.tagName.toLowerCase()} id="${el.id}" class="${el.getAttribute('class')}"> parent=<${el.parentElement.tagName} id=${el.parentElement.id} class="${el.parentElement.getAttribute('class')}"> text="${el.textContent.trim().slice(0,60)}"`),
    partner: [...document.querySelectorAll('body *')].filter(el => /^News unserer Partner$/.test(el.textContent.trim()) && !el.children.length).map(el => { const chain = []; for (let n = el; n && chain.length < 7; n = n.parentElement) chain.push(`${n.tagName}#${n.id}.${(n.getAttribute('class')||'').slice(0,50)}[${[...n.attributes].filter(a => a.name.startsWith('data-')).map(a => a.name+'='+a.value.slice(0,30)).join(',')}]`); return chain; }),
    iqd: [...document.querySelectorAll('.iqdcontainer, [data-advertisement]')].filter(el => (el.innerText||'').trim().length > 0).map(el => `${el.tagName}.${el.className} text=${el.innerText.trim().slice(0,60)}`).slice(0,10),
  })), null, 1));
  await page.close();
}
await context.close();
