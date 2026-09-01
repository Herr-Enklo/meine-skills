/* Automatischer Durchlauf: startet das Spiel im Testmodus (keine Wartezeiten) und
   führt die Schritte aus test/walkthrough.mjs aus. Aufruf: node test/run.mjs [--shots] [--until=<schrittnummer>] [--chapter=<name>] */
import { createRequire } from 'node:module';
import { chapters } from './walkthrough.mjs';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const gRoot = process.env.NODE_PATH || '/usr/lib/node_modules';
const { chromium } = createRequire(path.join(gRoot, 'x.js'))('playwright');
const root = path.resolve(here, '..');
const args = process.argv.slice(2);
const opt = (name, def) => { const a = args.find((x) => x.startsWith('--' + name + '=')); return a ? a.split('=')[1] : def; };
const shots = args.includes('--shots');
const until = parseInt(opt('until', '99999'), 10);
const only = opt('chapter', null);
const shotDir = opt('shotdir', path.join(process.env.SCRATCH || '/tmp', 'atl-shots'));
mkdirSync(shotDir, { recursive: true });

const port = 8123 + Math.floor(Math.random() * 500);
const server = spawn('http-server', [root, '-p', String(port), '-s'], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 900));

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 960, height: 750 } });
const errors = [];
page.on('console', (m) => { if ((m.type() === 'error' || m.type() === 'warning') && !/AudioContext/.test(m.text())) { errors.push(m.text()); console.log('  [console]', m.text()); } });
page.on('pageerror', (e) => { errors.push(e.message); console.log('  [pageerror]', e.message); });
await page.goto(`http://localhost:${port}/index.html?test=1&start=1`);
await page.waitForFunction(() => window.ATL && ATL.game && ATL.game.roomDef && ATL.game.roomDef.id === 'p_office', null, { timeout: 15000 });
await page.evaluate(() => {
  ATL.testQueue = [];
  ATL.game.testChooser = (opts) => {
    while (ATL.testQueue.length) {
      const q = ATL.testQueue.shift();
      const idx = opts.findIndex((o) => new RegExp(q, 'i').test(typeof o.text === 'function' ? o.text(ATL.game) : o.text));
      if (idx >= 0) return idx;
      console.warn('Dialogoption nicht gefunden: ' + q + ' unter ' + opts.map((o) => typeof o.text === 'function' ? o.text(ATL.game) : o.text).join(' | '));
    }
    const e = opts.findIndex((o) => o.end);
    return e >= 0 ? e : opts.length - 1;
  };
});

const steps = [];
for (const ch of chapters) {
  if (only && ch.name !== only) continue;
  const mod = await import(ch.file);
  steps.push(['chapter', ch.name]);
  if (only && mod.setup) steps.push(...mod.setup);
  else if (!only && ch.travel) steps.push(['eval', `if (g.roomDef.id === 'map') await g.act('walk', '${ch.travel}');`]);
  steps.push(...mod.steps);
}
let n = 0, failed = 0, chapter = '';
const seenRooms = new Set();
for (const s of steps) {
  n++;
  if (n > until) break;
  if (s[0] === 'chapter') { chapter = s[1]; console.log(`\n=== ${chapter} ===`); continue; }
  const label = s.join(' ');
  let res;
  try {
    res = await page.evaluate(async (s) => {
      const g = ATL.game;
      const [kind, ...a] = s;
      const fail = (m) => ({ ok: false, msg: m, room: g.roomDef && g.roomDef.id, log: g.log.slice(-6) });
      try {
        if (kind === 'act') await g.act(a[0], a[1], a[2] || null);
        else if (kind === 'item') await g.actItem(a[0], a[1], a[2] || null);
        else if (kind === 'queue') ATL.testQueue.push(...a);
        else if (kind === 'room') { if (g.roomDef.id !== a[0]) return fail('Raum ist ' + g.roomDef.id + ', erwartet ' + a[0]); }
        else if (kind === 'has') { for (const it of a) if (!g.has(it)) return fail('Fehlt im Inventar: ' + it + ' (hat: ' + g.state.inv.join(',') + ')'); }
        else if (kind === 'hasnot') { for (const it of a) if (g.has(it)) return fail('Sollte nicht im Inventar sein: ' + it); }
        else if (kind === 'flag') { if (!g.flag(a[0])) return fail('Flag fehlt: ' + a[0]); }
        else if (kind === 'noflag') { if (g.flag(a[0])) return fail('Flag gesetzt, sollte fehlen: ' + a[0]); }
        else if (kind === 'codex') { if (!g.state.codex.includes(a[0])) return fail('Kodex fehlt: ' + a[0]); }
        else if (kind === 'goto') await g.goto(a[0], a[1], a[2], a[3]);
        else if (kind === 'eval') { const AF = Object.getPrototypeOf(async function () {}).constructor; const r = await (new AF('g', 'ATL', a[0]))(g, ATL); if (r === false) return fail('eval false: ' + a[0]); }
        else if (kind === 'wait') { /* nichts im Testmodus */ }
        else return fail('Unbekannter Schritt ' + kind);
        if (g.busy && kind !== 'queue') return fail('Spiel bleibt beschäftigt nach Schritt');
        return { ok: true, room: g.roomDef && g.roomDef.id, log: g.log.slice(-3) };
      } catch (e) { return fail('Ausnahme: ' + (e && e.stack || e)); }
    }, s);
  } catch (e) { res = { ok: false, msg: 'Playwright: ' + e.message }; }
  if (res.ok) {
    console.log(`ok   ${n}. ${label}  [${res.room}]`);
    if (shots && res.room && !seenRooms.has(res.room)) {
      seenRooms.add(res.room);
      await page.screenshot({ path: path.join(shotDir, `${String(n).padStart(3, '0')}-${res.room}.png`) });
    }
  } else {
    failed++;
    console.log(`FAIL ${n}. ${label}\n     ${res.msg}\n     Raum: ${res.room}\n     Log: ${(res.log || []).join(' / ')}`);
    if (shots) await page.screenshot({ path: path.join(shotDir, `FAIL-${String(n).padStart(3, '0')}-${res.room}.png`) });
    break;
  }
}
const state = await page.evaluate(() => ({ room: ATL.game.roomDef.id, inv: ATL.game.state.inv, codex: ATL.game.state.codex.length, objectives: ATL.game.state.objectives.length }));
console.log('\nEndzustand:', JSON.stringify(state));
console.log(failed ? `\n${failed} Schritt fehlgeschlagen.` : '\nAlle Schritte bestanden.');
if (errors.length) console.log(`${errors.length} Konsolenfehler.`);
await browser.close();
server.kill();
process.exit(failed || errors.length ? 1 : 0);
