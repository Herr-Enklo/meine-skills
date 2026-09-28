// Werbefrei – Service Worker.
// Hält die Netzregeln aktuell, lädt abonnierte Filterlisten, blendet Werbeplätze per CSS aus und
// beantwortet die Nachrichten von Inhaltsskript, Popup und Einstellungsseite.

import {
  compileList,
  buildCosmeticIndex,
  prepareIndex,
  cosmeticForHost,
  selectorsForKeys,
  cssForSelectors,
  hostSuffixes,
  isSafeSelector,
  toAsciiDomain,
  withIds,
  PRIORITY,
} from './lib/filters.js';
import {
  LISTS,
  BUILTIN_LIST,
  DEFAULT_SETTINGS,
  DEFAULT_EXPIRES_HOURS,
  MIN_EXPIRES_HOURS,
  MAX_LIST_BYTES,
} from './lib/catalog.js';

const DNR = chrome.declarativeNetRequest;
const EXTENSION_ORIGIN = chrome.runtime.getURL('');
const HIDE_ATTR = 'data-werbefrei-verborgen';
const HEURISTIC_CSS = `[${HIDE_ATTR}]{display:none!important}`;
const UPDATE_ALARM = 'listen-aktualisieren';
const MENU_ID = 'element-ausblenden';
const USER_RULES_MAX = 500000;

// Bereiche der dynamischen Regel-ids
const RULE_ID = { pause: 1, allowlist: 2, userStart: 100, userMax: 9899, listStart: 10000 };

const ICONS = {
  an: { 16: 'icons/an-16.png', 32: 'icons/an-32.png' },
  aus: { 16: 'icons/aus-16.png', 32: 'icons/aus-32.png' },
};

// ---------------------------------------------------------------------------------------------
// Zustand. Chrome beendet den Service Worker nach kurzer Untätigkeit; alles hier wird bei Bedarf
// aus chrome.storage.local neu geladen.
// ---------------------------------------------------------------------------------------------

let settingsCache = null;
let indexCache = null;
let hostsCache = null; // {blocked: Set, allowed: Set}
const hostMemo = new Map(); // Hostname -> Ergebnis von cosmeticForHost

let queue = Promise.resolve();
/** Führt Änderungen nacheinander aus, damit sich zwei Aktualisierungen nicht überschneiden. */
function serial(task) {
  const run = queue.then(task, task);
  queue = run.catch(() => {});
  return run;
}

async function getSettings() {
  if (!settingsCache) {
    const { settings } = await chrome.storage.local.get('settings');
    settingsCache = normalizeSettings(settings);
  }
  return settingsCache;
}

function normalizeSettings(raw) {
  const s = { ...DEFAULT_SETTINGS, ...(raw || {}) };
  s.lists = { ...DEFAULT_SETTINGS.lists, ...(raw?.lists || {}) };
  s.allowlist = Array.isArray(s.allowlist) ? s.allowlist : [];
  s.customLists = Array.isArray(s.customLists) ? s.customLists : [];
  return s;
}

async function saveSettings(patch) {
  const next = normalizeSettings({ ...(await getSettings()), ...patch });
  settingsCache = next;
  await chrome.storage.local.set({ settings: next });
  return next;
}

function allLists(settings) {
  return [...LISTS, ...settings.customLists.map((l) => ({ ...l, custom: true }))];
}

function isEnabled(settings, id) {
  return settings.lists[id] === true;
}

async function getIndex() {
  if (!indexCache) {
    const { cosmeticIndex } = await chrome.storage.local.get('cosmeticIndex');
    indexCache = prepareIndex(cosmeticIndex || buildCosmeticIndex([]));
  }
  return indexCache;
}

async function getHostSets() {
  if (!hostsCache) {
    const { blockHosts, allowHosts } = await chrome.storage.local.get(['blockHosts', 'allowHosts']);
    hostsCache = { blocked: new Set(blockHosts || []), allowed: new Set(allowHosts || []) };
  }
  return hostsCache;
}

async function cosmeticFor(hostname) {
  let entry = hostMemo.get(hostname);
  if (!entry) {
    entry = cosmeticForHost(await getIndex(), hostname);
    if (hostMemo.size > 200) hostMemo.delete(hostMemo.keys().next().value);
    hostMemo.set(hostname, entry);
  }
  return entry;
}

/** "www.spiegel.de" -> "spiegel.de". So gilt eine Freigabe für die ganze Seite. */
function siteOf(hostname) {
  return hostname.toLowerCase().replace(/^www\d?\./, '');
}

function isAllowlisted(settings, hostname) {
  const allow = new Set(settings.allowlist);
  return hostSuffixes(hostname).some((d) => allow.has(d));
}

function pageHost(url) {
  try {
    const u = new URL(url);
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.hostname : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------------------------
// Filterlisten laden und übersetzen
// ---------------------------------------------------------------------------------------------

function parseHeader(text) {
  const head = text.slice(0, 4000);
  const version = /^!\s*Version:\s*(.+)$/m.exec(head)?.[1]?.trim() || null;
  const title = /^!\s*Title:\s*(.+)$/m.exec(head)?.[1]?.trim() || null;
  let hours = DEFAULT_EXPIRES_HOURS;
  const exp = /^!\s*Expires:\s*(\d+)\s*(day|days|hour|hours|h|d)?/im.exec(head);
  if (exp) hours = Number(exp[1]) * (/^h/i.test(exp[2] || 'days') ? 1 : 24);
  return { version, title, expiresHours: Math.max(MIN_EXPIRES_HOURS, hours) };
}

async function storeCompiled(id, compiled, meta) {
  const { listMeta = {} } = await chrome.storage.local.get('listMeta');
  listMeta[id] = { ...(listMeta[id] || {}), ...meta, error: null };
  await chrome.storage.local.set({ [`list:${id}`]: compiled, listMeta });
}

async function setListError(id, message) {
  const { listMeta = {} } = await chrome.storage.local.get('listMeta');
  listMeta[id] = { ...(listMeta[id] || {}), error: message, checked: Date.now() };
  await chrome.storage.local.set({ listMeta });
}

function statsOf(c) {
  return { network: c.stats.network, cosmetic: c.stats.cosmetic, skipped: c.stats.skipped, rules: c.network.length };
}

/** Die eingebaute Liste: Netzfilter liegen als statisches Regelwerk vor, hier zählen die Elementfilter. */
async function compileBundled() {
  const list = LISTS.find((l) => l.id === BUILTIN_LIST);
  const text = await (await fetch(chrome.runtime.getURL(list.bundled))).text();
  const c = compileList(text);
  await storeCompiled(
    BUILTIN_LIST,
    { network: [], hosts: c.hosts, cosmetic: c.cosmetic },
    { updated: Date.now(), checked: Date.now(), version: chrome.runtime.getManifest().version, stats: statsOf(c) },
  );
}

/** Liest die Antwort höchstens bis MAX_LIST_BYTES, statt eine beliebig große Datei zu laden. */
async function readLimited(response) {
  const length = Number(response.headers.get('content-length') || 0);
  if (length > MAX_LIST_BYTES) throw new Error('Liste ist zu groß');
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let received = 0;
  let text = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.byteLength;
    if (received > MAX_LIST_BYTES) {
      await reader.cancel();
      throw new Error('Liste ist zu groß');
    }
    text += decoder.decode(value, { stream: true });
  }
  return text + decoder.decode();
}

async function downloadList(list) {
  try {
    const response = await fetch(list.url, { cache: 'no-cache', credentials: 'omit', redirect: 'follow' });
    if (!response.url.startsWith('https://')) throw new Error('Weiterleitung auf eine unverschlüsselte Adresse');
    if (!response.ok) throw new Error(`Server antwortet mit ${response.status}`);
    const text = await readLimited(response);
    if (/^\s*</.test(text) || !/^(\[Adblock|!|\|\||##|[\w.-]+##|0\.0\.0\.0|127\.0\.0\.1)/m.test(text)) {
      throw new Error('Die Adresse liefert keine Filterliste');
    }
    const header = parseHeader(text);
    const c = compileList(text);
    await storeCompiled(
      list.id,
      { network: c.network, hosts: c.hosts, cosmetic: c.cosmetic },
      {
        updated: Date.now(),
        checked: Date.now(),
        version: header.version,
        expiresHours: header.expiresHours,
        remoteTitle: header.title,
        stats: statsOf(c),
      },
    );
    return true;
  } catch (e) {
    await setListError(list.id, e.message || String(e));
    return false;
  }
}

/** Lädt abonnierte Listen, die fehlen oder abgelaufen sind (force: alle aktiven). */
async function updateLists({ force = false, only = null } = {}) {
  const settings = await getSettings();
  const { listMeta = {} } = await chrome.storage.local.get('listMeta');
  const due = allLists(settings).filter((l) => {
    if (!l.url || !isEnabled(settings, l.id)) return false;
    if (only && l.id !== only) return false;
    if (force) return true;
    const meta = listMeta[l.id];
    if (!meta?.updated) return true;
    const hours = meta.expiresHours || DEFAULT_EXPIRES_HOURS;
    return Date.now() - meta.updated > hours * 3600 * 1000;
  });
  if (!due.length) return 0;
  // Nacheinander: storeCompiled liest und schreibt listMeta, parallel gingen Einträge verloren.
  let ok = 0;
  for (const list of due) if (await downloadList(list)) ok++;
  if (ok) await rebuild();
  return ok;
}

// ---------------------------------------------------------------------------------------------
// Regeln zusammenstellen
// ---------------------------------------------------------------------------------------------

function controlRules(settings) {
  const rules = [];
  if (settings.paused) {
    rules.push({
      id: RULE_ID.pause,
      priority: PRIORITY.pause,
      action: { type: 'allowAllRequests' },
      condition: { resourceTypes: ['main_frame', 'sub_frame'] },
    });
  }
  if (settings.allowlist.length) {
    rules.push({
      id: RULE_ID.allowlist,
      priority: PRIORITY.allowlist,
      action: { type: 'allowAllRequests' },
      condition: { requestDomains: [...settings.allowlist], resourceTypes: ['main_frame'] },
    });
  }
  return rules;
}

function dynamicRuleLimit() {
  return DNR.MAX_NUMBER_OF_DYNAMIC_RULES ?? DNR.MAX_NUMBER_OF_DYNAMIC_AND_SESSION_RULES ?? 5000;
}

/**
 * Ersetzt dynamische Regeln. Lehnt Chrome eine einzelne Regel ab, fällt nur diese weg und der
 * Rest wird erneut versucht, statt dass die ganze Liste ausfällt.
 */
async function replaceDynamicRules(removeRuleIds, addRules) {
  const invalid = [];
  let rules = addRules;
  for (let attempt = 0; attempt < 30; attempt++) {
    try {
      await DNR.updateDynamicRules({ removeRuleIds, addRules: rules });
      return { added: rules.length, invalid };
    } catch (e) {
      const id = Number(/\bid\s+(\d+)/i.exec(e.message || '')?.[1]);
      if (!id || !rules.some((r) => r.id === id)) throw e;
      invalid.push({ id, error: e.message });
      rules = rules.filter((r) => r.id !== id);
    }
  }
  throw new Error('Zu viele ungültige Regeln');
}

async function syncControlRules() {
  const settings = await getSettings();
  const existing = await DNR.getDynamicRules();
  const remove = existing.filter((r) => r.id < RULE_ID.userStart).map((r) => r.id);
  await DNR.updateDynamicRules({ removeRuleIds: remove, addRules: controlRules(settings) });
}

async function syncStaticRulesets(settings) {
  const enabled = new Set(await DNR.getEnabledRulesets());
  const enable = [];
  const disable = [];
  for (const list of LISTS.filter((l) => l.ruleset)) {
    const want = isEnabled(settings, list.id);
    if (want && !enabled.has(list.ruleset)) enable.push(list.ruleset);
    if (!want && enabled.has(list.ruleset)) disable.push(list.ruleset);
  }
  if (enable.length || disable.length) {
    await DNR.updateEnabledRulesets({ enableRulesetIds: enable, disableRulesetIds: disable });
  }
}

/**
 * Alles neu zusammenstellen: Elementfilter-Index, Werbe-Domains, dynamische Netzregeln.
 * network: false lässt die Netzregeln unverändert (reicht, wenn nur Elementfilter dazukamen).
 */
async function rebuild({ network = true } = {}) {
  const settings = await getSettings();
  const ids = allLists(settings)
    .filter((l) => isEnabled(settings, l.id))
    .map((l) => l.id);
  const stored = await chrome.storage.local.get([...ids.map((id) => `list:${id}`), 'userRules']);
  const user = compileList(stored.userRules || '');

  const compiled = ids.map((id) => stored[`list:${id}`]).filter(Boolean);
  const index = buildCosmeticIndex([...compiled.map((c) => c.cosmetic), user.cosmetic]);
  const hosts = new Set();
  const allowHosts = new Set();
  for (const c of [...compiled, user]) {
    for (const h of c.hosts) hosts.add(h);
    for (const h of c.allowHosts || []) allowHosts.add(h);
  }
  const cosmeticState = { cosmeticIndex: index, blockHosts: [...hosts], allowHosts: [...allowHosts] };
  if (!network) {
    await chrome.storage.local.set(cosmeticState);
    indexCache = prepareIndex(index);
    hostsCache = { blocked: hosts, allowed: allowHosts };
    hostMemo.clear();
    return null;
  }

  // Netzregeln: erst die eigenen, dann die Listen. Ist Chromes Grenze erreicht, fallen Regeln
  // vom Ende der Listen weg; wie viele, steht im Bericht auf der Einstellungsseite.
  const limit = dynamicRuleLimit() - 2;
  const userRules = withIds(user.network.slice(0, RULE_ID.userMax - RULE_ID.userStart), RULE_ID.userStart);
  let listRules = [];
  for (const id of ids) {
    const c = stored[`list:${id}`];
    if (c?.network?.length) listRules = listRules.concat(c.network);
  }
  const room = Math.max(0, limit - userRules.length);
  const dropped = Math.max(0, listRules.length - room);
  listRules = withIds(listRules.slice(0, room), RULE_ID.listStart);

  const existing = await DNR.getDynamicRules();
  const result = await replaceDynamicRules(
    existing.map((r) => r.id),
    [...controlRules(settings), ...userRules, ...listRules],
  );
  await syncStaticRulesets(settings);

  const report = {
    at: Date.now(),
    limit: dynamicRuleLimit(),
    active: result.added,
    dropped,
    invalid: result.invalid.length,
    invalidSample: result.invalid.slice(0, 5),
  };
  await chrome.storage.local.set({ ...cosmeticState, ruleReport: report });
  indexCache = prepareIndex(index);
  hostsCache = { blocked: hosts, allowed: allowHosts };
  hostMemo.clear();
  return report;
}

// ---------------------------------------------------------------------------------------------
// Symbol, Kontextmenü, Zähler
// ---------------------------------------------------------------------------------------------

async function applyActionState() {
  const settings = await getSettings();
  await chrome.action.setIcon({ path: settings.paused ? ICONS.aus : ICONS.an });
  await chrome.action.setBadgeBackgroundColor({ color: '#0f6e5a' });
  if (chrome.action.setBadgeTextColor) await chrome.action.setBadgeTextColor({ color: '#ffffff' });
  await DNR.setExtensionActionOptions({ displayActionCountAsBadgeText: settings.badge && !settings.paused });
}

async function setupContextMenu() {
  await chrome.contextMenus.removeAll();
  chrome.contextMenus.create({
    id: MENU_ID,
    title: 'Element ausblenden …',
    contexts: ['all'],
    documentUrlPatterns: ['http://*/*', 'https://*/*'],
  });
}

const PICKER_TTL = 30 * 60 * 1000;

/**
 * Startet die Element-Auswahl. Nur eine so gestartete Auswahl darf eine Regel speichern (einmal),
 * damit eine Seite nicht von sich aus Regeln anlegen kann.
 */
async function startPicker(tabId, { fromContextMenu = false } = {}) {
  await chrome.storage.session.set({ [`auswahl:${tabId}`]: Date.now() + PICKER_TTL });
  await chrome.scripting.executeScript({
    target: { tabId, frameIds: [0] },
    func: (flag) => { globalThis.__werbefreiVonKontextmenue = flag; },
    args: [fromContextMenu],
  });
  await chrome.scripting.executeScript({ target: { tabId, frameIds: [0] }, files: ['picker/picker.js'] });
}

async function takePickerSession(tabId) {
  const key = `auswahl:${tabId}`;
  const { [key]: until } = await chrome.storage.session.get(key);
  await chrome.storage.session.remove(key);
  return typeof until === 'number' && until > Date.now();
}

/** Stylesheet in genau das Dokument einfügen, das die Nachricht geschickt hat. */
async function insertCss(sender, css) {
  if (!css) return;
  const target = sender.documentId
    ? { tabId: sender.tab.id, documentIds: [sender.documentId] }
    : { tabId: sender.tab.id, frameIds: [sender.frameId ?? 0] };
  try {
    await chrome.scripting.insertCSS({ target, css, origin: 'USER' });
  } catch {
    // Tab geschlossen oder weiternavigiert: nichts zu tun.
  }
}

// ---------------------------------------------------------------------------------------------
// Nachrichten vom Inhaltsskript (Webseite). Diese Absender gelten als weniger vertrauenswürdig:
// Hostname und Tab stammen aus sender, nie aus der Nachricht.
// ---------------------------------------------------------------------------------------------

const KEY_RE = /^[.#][A-Za-z_-][\w-]{0,200}$/;

const contentHandlers = {
  async init(msg, sender) {
    const host = pageHost(sender.url);
    if (!host) return { active: false };
    const settings = await getSettings();
    if (settings.paused) return { active: false, reason: 'pausiert' };
    if (isAllowlisted(settings, host)) {
      chrome.action.setIcon({ tabId: sender.tab.id, path: ICONS.aus }).catch(() => {});
      return { active: false, reason: 'freigegeben' };
    }
    const cosmetic = await cosmeticFor(host);
    if (cosmetic.disabled) return { active: false, reason: 'liste' };
    await insertCss(sender, `${cssForSelectors(cosmetic.selectors)}\n${HEURISTIC_CSS}`);
    return { active: true, generic: !cosmetic.generichide, heuristics: settings.heuristics && !cosmetic.generichide };
  },

  async generic(msg, sender) {
    const host = pageHost(sender.url);
    if (!host || !Array.isArray(msg.keys)) return { selectors: [] };
    const keys = msg.keys.slice(0, 20000).filter((k) => typeof k === 'string' && KEY_RE.test(k));
    const cosmetic = await cosmeticFor(host);
    if (cosmetic.disabled || cosmetic.generichide) return { selectors: [] };
    const selectors = selectorsForKeys(await getIndex(), keys, cosmetic.exceptions);
    await insertCss(sender, cssForSelectors(selectors));
    return { selectors };
  },

  async checkHosts(msg) {
    if (!Array.isArray(msg.hosts)) return { blocked: [] };
    const sets = await getHostSets();
    const blocked = msg.hosts
      .slice(0, 500)
      .filter((h) => typeof h === 'string' && h.length < 256)
      .filter((h) => {
        const suffixes = hostSuffixes(h);
        return suffixes.some((d) => sets.blocked.has(d)) && !suffixes.some((d) => sets.allowed.has(d));
      });
    return { blocked };
  },

  async pickerSave(msg, sender) {
    const host = pageHost(sender.url);
    const selector = typeof msg.selector === 'string' ? msg.selector.trim() : '';
    if (!host || !selector || selector.length > 1000 || !isSafeSelector(selector)) {
      return { ok: false, error: 'Dieser Selektor kann nicht gespeichert werden.' };
    }
    if (!(await takePickerSession(sender.tab.id))) {
      return { ok: false, error: 'Die Auswahl ist abgelaufen. Bitte neu starten.' };
    }
    const line = `${siteOf(host)}##${selector}`;
    const result = await serial(async () => {
      const { userRules = '' } = await chrome.storage.local.get('userRules');
      if (userRules.split(/\r?\n/).includes(line)) return { ok: true };
      if (userRules.length + line.length > USER_RULES_MAX) {
        return { ok: false, error: 'Die eigenen Regeln sind voll. Bitte in den Einstellungen aufräumen.' };
      }
      const text = `${userRules.replace(/\s+$/, '')}${userRules.trim() ? '\n' : ''}${line}\n`;
      await chrome.storage.local.set({ userRules: text });
      await rebuild({ network: false });
      return { ok: true };
    });
    if (!result.ok) return result;
    await insertCss(sender, cssForSelectors([selector]));
    return { ok: true, rule: line };
  },
};

// ---------------------------------------------------------------------------------------------
// Nachrichten von Popup und Einstellungsseite (nur Seiten der Erweiterung selbst)
// ---------------------------------------------------------------------------------------------

async function tabHost(tabId) {
  const tab = await chrome.tabs.get(tabId);
  return { tab, host: pageHost(tab.url || '') };
}

function cleanHostList(list) {
  const out = new Set();
  for (const entry of Array.isArray(list) ? list : []) {
    if (typeof entry !== 'string') continue;
    let value = entry.trim();
    if (!value) continue;
    if (/^[a-z]+:\/\//i.test(value)) value = pageHost(value) || '';
    const d = toAsciiDomain(value);
    if (d && d.includes('.')) out.add(siteOf(d));
  }
  return [...out].sort();
}

const pageHandlers = {
  async popupState({ tabId }) {
    const settings = await getSettings();
    const { host } = await tabHost(tabId);
    if (!host) return { supported: false, paused: settings.paused };
    const cosmetic = await cosmeticFor(host);
    return {
      supported: true,
      host,
      site: siteOf(host),
      paused: settings.paused,
      allowlisted: isAllowlisted(settings, host),
      listDisabled: cosmetic.disabled,
    };
  },

  async popupCount({ tabId }) {
    const { host } = await tabHost(tabId);
    if (!host) return null;
    const cosmetic = await cosmeticFor(host);
    try {
      return await chrome.tabs.sendMessage(tabId, { type: 'werbefrei:zaehlen', selectors: cosmetic.selectors }, { frameId: 0 });
    } catch {
      return null;
    }
  },

  async setSiteEnabled({ tabId, enabled }) {
    const { host } = await tabHost(tabId);
    if (!host) return { ok: false };
    await serial(async () => {
      const settings = await getSettings();
      const site = siteOf(host);
      let allowlist = settings.allowlist.filter((d) => !hostSuffixes(host).includes(d));
      if (!enabled) allowlist = [...allowlist, site];
      await saveSettings({ allowlist: cleanHostList(allowlist) });
      await syncControlRules();
    });
    hostMemo.clear();
    await chrome.tabs.reload(tabId);
    return { ok: true };
  },

  async setPaused({ paused }) {
    await serial(async () => {
      await saveSettings({ paused: Boolean(paused) });
      await syncControlRules();
      await applyActionState();
    });
    return { ok: true };
  },

  async startPicker({ tabId }) {
    await startPicker(tabId);
    return { ok: true };
  },

  async optionsState() {
    const settings = await getSettings();
    const { listMeta = {}, userRules = '', ruleReport = null } = await chrome.storage.local.get(['listMeta', 'userRules', 'ruleReport']);
    return {
      settings,
      lists: allLists(settings).map((l) => ({ ...l, enabled: isEnabled(settings, l.id), meta: listMeta[l.id] || null })),
      userRules,
      ruleReport,
      version: chrome.runtime.getManifest().version,
    };
  },

  async setListEnabled({ id, enabled }) {
    return serial(async () => {
      const settings = await getSettings();
      const list = allLists(settings).find((l) => l.id === id);
      if (!list) return { ok: false };
      await saveSettings({ lists: { ...settings.lists, [id]: Boolean(enabled) } });
      if (enabled && list.url) {
        const { [`list:${id}`]: data } = await chrome.storage.local.get(`list:${id}`);
        if (!data) await downloadList(list);
      }
      await rebuild();
      return { ok: true };
    });
  },

  async updateLists({ id }) {
    const count = await serial(() => updateLists({ force: true, only: id || null }));
    return { ok: true, count };
  },

  async addCustomList({ url, title }) {
    let parsed;
    try {
      parsed = new URL(String(url).trim());
    } catch {
      return { ok: false, error: 'Das ist keine gültige Adresse.' };
    }
    if (parsed.protocol !== 'https:') return { ok: false, error: 'Nur https-Adressen sind erlaubt.' };
    return serial(async () => {
      const settings = await getSettings();
      if (allLists(settings).some((l) => l.url === parsed.href)) return { ok: false, error: 'Diese Liste ist schon eingetragen.' };
      const id = `eigene-${Date.now().toString(36)}`;
      const list = { id, title: String(title || '').trim().slice(0, 80) || parsed.hostname, url: parsed.href };
      await saveSettings({ customLists: [...settings.customLists, list], lists: { ...settings.lists, [id]: true } });
      const ok = await downloadList(list);
      await rebuild();
      const { listMeta = {} } = await chrome.storage.local.get('listMeta');
      return ok ? { ok: true } : { ok: true, warning: listMeta[id]?.error };
    });
  },

  async removeCustomList({ id }) {
    return serial(async () => {
      const settings = await getSettings();
      const lists = { ...settings.lists };
      delete lists[id];
      await saveSettings({ customLists: settings.customLists.filter((l) => l.id !== id), lists });
      const { listMeta = {} } = await chrome.storage.local.get('listMeta');
      delete listMeta[id];
      await chrome.storage.local.set({ listMeta });
      await chrome.storage.local.remove(`list:${id}`);
      await rebuild();
      return { ok: true };
    });
  },

  async saveUserRules({ text }) {
    const value = String(text ?? '').slice(0, USER_RULES_MAX);
    const check = compileList(value, { maxLineErrors: 100 });
    return serial(async () => {
      await chrome.storage.local.set({ userRules: value });
      const report = await rebuild();
      return { ok: true, stats: check.stats, errors: check.stats.errors, report };
    });
  },

  async setOption({ key, value }) {
    if (!['heuristics', 'badge'].includes(key)) return { ok: false };
    await serial(async () => {
      await saveSettings({ [key]: Boolean(value) });
      await applyActionState();
    });
    hostMemo.clear();
    return { ok: true };
  },

  async setAllowlist({ hosts }) {
    const allowlist = cleanHostList(hosts);
    await serial(async () => {
      await saveSettings({ allowlist });
      await syncControlRules();
    });
    return { ok: true, allowlist };
  },

  async exportData() {
    const settings = await getSettings();
    const { userRules = '' } = await chrome.storage.local.get('userRules');
    return {
      format: 'werbefrei-sicherung',
      version: 1,
      exported: new Date().toISOString(),
      settings: {
        allowlist: settings.allowlist,
        heuristics: settings.heuristics,
        badge: settings.badge,
        lists: settings.lists,
        customLists: settings.customLists,
      },
      userRules,
    };
  },

  async importData({ data }) {
    if (!data || data.format !== 'werbefrei-sicherung' || typeof data.settings !== 'object') {
      return { ok: false, error: 'Das ist keine Sicherung von Werbefrei.' };
    }
    const s = data.settings;
    const customLists = (Array.isArray(s.customLists) ? s.customLists : [])
      .filter((l) => l && typeof l.url === 'string' && l.url.startsWith('https://') && typeof l.id === 'string' && /^eigene-[a-z0-9]+$/.test(l.id))
      .map((l) => ({ id: l.id, title: String(l.title || '').slice(0, 80), url: l.url }))
      .slice(0, 20);
    const known = new Set([...LISTS.map((l) => l.id), ...customLists.map((l) => l.id)]);
    const lists = { ...DEFAULT_SETTINGS.lists };
    for (const [id, on] of Object.entries(s.lists || {})) if (known.has(id)) lists[id] = on === true;
    return serial(async () => {
      await saveSettings({
        allowlist: cleanHostList(s.allowlist),
        heuristics: s.heuristics !== false,
        badge: s.badge !== false,
        lists,
        customLists,
      });
      await chrome.storage.local.set({ userRules: typeof data.userRules === 'string' ? data.userRules.slice(0, USER_RULES_MAX) : '' });
      await updateLists();
      await rebuild();
      await applyActionState();
      return { ok: true };
    });
  },
};

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (sender.id !== chrome.runtime.id || !msg || typeof msg.type !== 'string') return false;
  const fromPage = typeof sender.url === 'string' && sender.url.startsWith(EXTENSION_ORIGIN);
  let handler = null;
  if (fromPage && Object.hasOwn(pageHandlers, msg.type)) handler = pageHandlers[msg.type];
  else if (!fromPage && sender.tab && Object.hasOwn(contentHandlers, msg.type)) handler = contentHandlers[msg.type];
  if (!handler) return false;
  handler(msg, sender).then(sendResponse, (e) => sendResponse({ ok: false, error: e?.message || String(e) }));
  return true;
});

// ---------------------------------------------------------------------------------------------
// Lebenszyklus
// ---------------------------------------------------------------------------------------------

chrome.runtime.onInstalled.addListener(({ reason }) => {
  serial(async () => {
    if (reason === 'install') await chrome.storage.local.set({ settings: normalizeSettings(null) });
    settingsCache = null;
    await setupContextMenu();
    await compileBundled();
    await rebuild();
    await applyActionState();
    await chrome.alarms.create(UPDATE_ALARM, { delayInMinutes: 1, periodInMinutes: 180 });
    await updateLists();
  }).catch((e) => console.error('Werbefrei: Einrichtung fehlgeschlagen', e));
});

chrome.runtime.onStartup.addListener(() => {
  serial(async () => {
    await applyActionState();
    if (!(await chrome.alarms.get(UPDATE_ALARM))) {
      await chrome.alarms.create(UPDATE_ALARM, { delayInMinutes: 1, periodInMinutes: 180 });
    }
  }).catch((e) => console.error('Werbefrei: Start fehlgeschlagen', e));
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === UPDATE_ALARM) serial(() => updateLists()).catch((e) => console.error('Werbefrei: Aktualisierung fehlgeschlagen', e));
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === MENU_ID && tab?.id !== undefined) startPicker(tab.id, { fromContextMenu: true }).catch(() => {});
});

chrome.commands.onCommand.addListener((command, tab) => {
  if (command === 'element-ausblenden' && tab?.id !== undefined) startPicker(tab.id).catch(() => {});
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;
  if (changes.settings) settingsCache = null;
});
