/* Statische Prüfung aller Räume: Ausgänge zeigen auf vorhandene Räume, Laufpunkte liegen auf
   begehbarem Boden, Figuren sind definiert, Gegenstände in useWith/giveWith existieren. */
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const gRoot = process.env.NODE_PATH || '/usr/lib/node_modules';
const { chromium } = createRequire(path.join(gRoot, 'x.js'))('playwright');
const port = 8900 + Math.floor(Math.random() * 90);
const server = spawn('http-server', [root, '-p', String(port), '-s'], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 900));
const browser = await chromium.launch();
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto(`http://localhost:${port}/index.html?test=1`);
await page.waitForFunction(() => window.ATL && ATL.game && ATL.game.roomDef);
const report = await page.evaluate(() => {
  const g = ATL.game;
  const out = [];
  const rooms = ATL.rooms.all;
  for (const id in rooms) {
    const def = rooms[id];
    if (def.noHero) continue;
    const w = def.width || 960;
    const grid = new ATL.WalkGrid(def.walk || [[0, 0, w, 0, w, 600, 0, 600]], w, 600);
    let hotspots = [], exits = [];
    try { hotspots = def.hotspots || []; exits = def.exits || []; } catch (e) { out.push(`${id}: hotspots-Getter wirft: ${e.message}`); }
    const all = [...hotspots.map((h) => ({ ...h, _kind: 'hotspot' })), ...exits.map((h) => ({ ...h, _kind: 'exit' }))];
    for (const h of all) {
      if (!h.id) out.push(`${id}: ${h._kind} ohne id (${h.name})`);
      if (!h.rect && !h.poly) out.push(`${id}/${h.id}: weder rect noch poly`);
      if (h.rect && h.rect[2] === 0 && !(h.cond && !h.cond(g))) out.push(`${id}/${h.id}: Rechteck ohne Breite`);
      if (h._kind === 'exit' && h.to && !rooms[h.to]) out.push(`${id}/${h.id}: Zielraum fehlt: ${h.to}`);
      if (!h.noWalk) {
        let at = h.at;
        if (!at) { const r = h.rect || (h.poly ? (() => { let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; for (let i = 0; i < h.poly.length; i += 2) { x0 = Math.min(x0, h.poly[i]); x1 = Math.max(x1, h.poly[i]); y0 = Math.min(y0, h.poly[i + 1]); y1 = Math.max(y1, h.poly[i + 1]); } return [x0, y0, x1 - x0, y1 - y0]; })() : null); if (r) at = [r[0] + r[2] / 2, r[1] + r[3] + 6]; }
        if (at) {
          const c = grid.nearestFree(at[0], at[1]);
          const p = grid.toPoint(c[0], c[1]);
          const d = Math.hypot(p[0] - at[0], p[1] - at[1]);
          if (d > 40) out.push(`${id}/${h.id}: Laufpunkt [${at[0]},${at[1]}] liegt ${Math.round(d)}px vom begehbaren Boden entfernt`);
        }
      }
      for (const key of ['useWith', 'giveWith']) if (h[key]) for (const it in h[key]) if (it !== 'default' && !ATL.items.get(it)) out.push(`${id}/${h.id}: ${key} mit unbekanntem Gegenstand ${it}`);
    }
    for (const a of def.actors || []) {
      if (!ATL.chars.get(a.id)) out.push(`${id}: unbekannte Figur ${a.id}`);
      if (typeof a.talk === 'string' && !/\s/.test(a.talk) && !ATL.dialogs.get(a.talk)) out.push(`${id}/${a.id}: Dialog fehlt: ${a.talk}`);
      for (const key of ['useWith', 'giveWith']) if (a[key]) for (const it in a[key]) if (it !== 'default' && !ATL.items.get(it)) out.push(`${id}/${a.id}: ${key} mit unbekanntem Gegenstand ${it}`);
    }
    if (def.start) { const c = grid.nearestFree(def.start[0], def.start[1]); const p = grid.toPoint(c[0], c[1]); if (Math.hypot(p[0] - def.start[0], p[1] - def.start[1]) > 40) out.push(`${id}: start liegt nicht auf begehbarem Boden`); }
    for (const e of exits) if (e.to && rooms[e.to] && e.pos) { const t = rooms[e.to]; const tw = t.width || 960; const tg = new ATL.WalkGrid(t.walk || [[0, 0, tw, 0, tw, 600, 0, 600]], tw, 600); const c = tg.nearestFree(e.pos[0], e.pos[1]); const p = tg.toPoint(c[0], c[1]); if (Math.hypot(p[0] - e.pos[0], p[1] - e.pos[1]) > 40) out.push(`${id}/${e.id}: Zielposition in ${e.to} liegt nicht auf begehbarem Boden`); }
  }
  // Gegenstände ohne Symbol
  for (const id in ATL.items.all) { const it = ATL.items.all[id]; if (!ATL.icons[it.icon || id]) out.push(`Gegenstand ohne Symbol: ${id}`); }
  for (const id in ATL.story.locations) { const l = ATL.story.locations[id]; if (!rooms[l.room]) out.push(`Karte: Raum fehlt für ${id}: ${l.room}`); }
  return { rooms: Object.keys(rooms).length, problems: out };
});
console.log(`${report.rooms} Räume geprüft.`);
report.problems.forEach((p) => console.log(' -', p));
console.log(report.problems.length ? `${report.problems.length} Hinweise.` : 'Keine Hinweise.');
await browser.close();
server.kill();
process.exit(report.problems.length ? 1 : 0);
