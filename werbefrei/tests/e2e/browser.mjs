// Chromium mit geladener Erweiterung starten (Playwright).

import { existsSync, readFileSync, mkdtempSync } from 'node:fs';
import { createHash, createPublicKey } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

export const EXTENSION = fileURLToPath(new URL('../../extension', import.meta.url));

/**
 * Läuft der Test hinter einem Proxy, der TLS aufbricht (etwa in der Claude-Cloud), vertraut
 * Chromium zusätzlich genau dieser CA. Pfad über WERBEFREI_PROXY_CA änderbar.
 */
function proxyCaPins() {
  const path = process.env.WERBEFREI_PROXY_CA || '/root/.ccr/agent-proxy-ca.crt';
  if (!existsSync(path)) return [];
  const pem = readFileSync(path, 'utf8');
  const blocks = pem.match(/-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/g) || [];
  return blocks.map((block) => {
    const spki = createPublicKey(block).export({ type: 'spki', format: 'der' });
    return createHash('sha256').update(spki).digest('base64');
  });
}

export async function launch({ withExtension = true, args = [], viewport = { width: 1366, height: 900 } } = {}) {
  const pins = proxyCaPins();
  const allArgs = [...args];
  if (pins.length) allArgs.push(`--ignore-certificate-errors-spki-list=${pins.join(',')}`);
  if (withExtension) allArgs.push(`--disable-extensions-except=${EXTENSION}`, `--load-extension=${EXTENSION}`);
  const context = await chromium.launchPersistentContext(mkdtempSync(join(tmpdir(), 'werbefrei-')), {
    channel: 'chromium',
    headless: process.env.HEADED ? false : true,
    viewport,
    locale: 'de-DE',
    args: allArgs,
  });
  if (!withExtension) return { context };
  let [worker] = context.serviceWorkers();
  if (!worker) worker = await context.waitForEvent('serviceworker');
  const extensionId = new URL(worker.url()).host;
  return { context, worker, extensionId };
}

/** Wartet, bis die Einrichtung nach der Installation fertig ist (Index gebaut). */
export async function waitForSetup(worker, { timeout = 60000 } = {}) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    // Direkt nach dem Start sind die Erweiterungs-APIs im Worker manchmal noch nicht gebunden.
    const ready = await worker
      .evaluate(async () => {
        if (!globalThis.chrome?.storage) return false;
        const { cosmeticIndex, ruleReport } = await chrome.storage.local.get(['cosmeticIndex', 'ruleReport']);
        return Boolean(cosmeticIndex && ruleReport);
      })
      .catch(() => false);
    if (ready) return;
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error('Einrichtung der Erweiterung nicht fertig geworden');
}

/** Öffnet eine Seite der Erweiterung, über die sich Nachrichten wie aus den Einstellungen schicken lassen. */
export async function extensionPage(context, extensionId, path = 'options/options.html') {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/${path}`);
  return page;
}

export function sendFrom(page, msg) {
  return page.evaluate((m) => chrome.runtime.sendMessage(m), msg);
}

/**
 * Wartet, bis alle eingeschalteten abonnierten Listen geladen (oder mit Fehler abgebrochen) sind
 * und der Service Worker die Regeln danach neu zusammengestellt hat.
 */
export async function waitForLists(worker, { timeout = 120000 } = {}) {
  await waitForSetup(worker, { timeout });
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const done = await worker
      .evaluate(async () => {
        const { settings, listMeta = {}, ruleReport } = await chrome.storage.local.get(['settings', 'listMeta', 'ruleReport']);
        const ids = Object.entries(settings?.lists || {}).filter(([id, on]) => on && id !== 'werbefrei').map(([id]) => id);
        if (!ids.every((id) => listMeta[id]?.updated || listMeta[id]?.error)) return false;
        const last = Math.max(0, ...ids.map((id) => listMeta[id]?.updated || 0));
        return Boolean(ruleReport && ruleReport.at >= last);
      })
      .catch(() => false);
    if (done) return;
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error('Filterlisten nicht rechtzeitig geladen');
}
