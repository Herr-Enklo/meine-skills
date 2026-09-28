// Filterlisten im Adblock-Plus-Format (EasyList, eigene Regeln) lesen und für Chrome übersetzen:
// Netzfilter werden zu declarativeNetRequest-Regeln, Elementfilter zu CSS-Selektoren.
// Läuft im Service Worker, auf der Einstellungsseite und unter Node (Build-Skript, Tests).

// Priorität der Regeln. Bei gleicher Priorität gewinnt in Chrome "allow" gegen "block".
export const PRIORITY = {
  block: 1,
  exception: 2, // @@-Ausnahmen der Listen schlagen normale Sperren
  important: 3, // $important schlägt Ausnahmen der Listen
  allowlist: 100000, // vom Nutzer freigegebene Seiten
  pause: 1000000, // Werbefrei pausiert
};

const TYPE_MAP = {
  script: 'script',
  image: 'image',
  stylesheet: 'stylesheet',
  css: 'stylesheet',
  object: 'object',
  'object-subrequest': 'object',
  xmlhttprequest: 'xmlhttprequest',
  xhr: 'xmlhttprequest',
  subdocument: 'sub_frame',
  frame: 'sub_frame',
  ping: 'ping',
  beacon: 'ping',
  media: 'media',
  font: 'font',
  websocket: 'websocket',
  other: 'other',
  document: 'main_frame',
  doc: 'main_frame',
};

// Typen, die Chrome nicht getrennt kennt. Sie fallen aus der Typenliste heraus.
const IGNORED_TYPES = new Set(['webrtc', 'webbundle']);

// Optionen, die sich mit declarativeNetRequest nicht abbilden lassen. Filter damit werden
// übersprungen, statt sie ungenau anzuwenden.
const UNSUPPORTED_OPTIONS = new Set([
  'popup', 'popunder', 'csp', 'redirect', 'redirect-rule', 'rewrite', 'removeparam', 'queryprune',
  'header', 'permissions', 'replace', 'urltransform', 'uritransform', 'badfilter', 'empty', 'mp4',
  'inline-script', 'inline-font', 'genericblock', 'sitekey', 'cname', 'ipaddress', 'method', 'strict1p',
  'strict3p', 'all', 'specifichide', 'shide', 'urlskip', 'reason', 'to', 'denyallow',
]);

// Erweiterte Selektoren von Adblock Plus und uBlock Origin, die kein CSS sind.
const PROCEDURAL = /:(?:-abp-[\w-]+|has-text|contains|xpath|upward|remove|remove-attr|remove-class|style|matches-css(?:-before|-after)?|matches-attr|matches-path|matches-prop|matches-media|min-text-length|watch-attr|others|if|if-not|nth-ancestor|shadow|spath)\b/i;

const DOMAIN_RE = /^[a-z0-9_](?:[a-z0-9_-]*[a-z0-9_])?(?:\.[a-z0-9_](?:[a-z0-9_-]*[a-z0-9_])?)*$/;
const PURE_HOST_RE = /^\|\|([a-z0-9_](?:[a-z0-9_-]*[a-z0-9_])?(?:\.[a-z0-9_](?:[a-z0-9_-]*[a-z0-9_])?)+)\^$/;
const OPTIONS_RE = /^~?[a-z0-9_-]+(?:=[^,]*)?(?:,~?[a-z0-9_-]+(?:=[^,]*)?)*$/i;
const SIMPLE_KEY_RE = /^[.#][A-Za-z_-][\w-]*$/;

// Größte Zahl von Domains in einer einzelnen Regel. Chrome nennt keine Grenze, kleinere Regeln
// halten Fehlermeldungen aber übersichtlich.
const HOSTS_PER_RULE = 1000;

/** Wandelt einen Domainnamen in die ASCII-Form (Punycode). Gibt null zurück, wenn er ungültig ist. */
export function toAsciiDomain(name) {
  let d = String(name).trim().toLowerCase().replace(/\.$/, '');
  if (!d) return null;
  if (!DOMAIN_RE.test(d)) {
    if (/[\s/:?#@*]/.test(d)) return null;
    try {
      d = new URL(`http://${d}/`).hostname;
    } catch {
      return null;
    }
    if (!DOMAIN_RE.test(d)) return null;
  }
  return d;
}

/** "www.spiegel.de" -> ["www.spiegel.de", "spiegel.de", "de"] */
export function hostSuffixes(hostname) {
  const parts = String(hostname).toLowerCase().replace(/\.$/, '').split('.');
  const out = [];
  for (let i = 0; i < parts.length; i++) out.push(parts.slice(i).join('.'));
  return out;
}

/**
 * Prüft einen CSS-Selektor, ohne ein DOM zu brauchen. Abgelehnt wird, was kein CSS ist
 * (erweiterte Selektoren) und was aus der Regel "selektor{display:none}" ausbrechen könnte.
 */
export function isSafeSelector(selector) {
  const s = selector.trim();
  if (!s || s.length > 2000) return false;
  // Zeilenumbrüche beenden in CSS einen String und würden die folgende Regel mitreißen.
  if (/[{}\r\n\f]/.test(s) || s.includes('/*') || s.startsWith('@') || s.startsWith('+js(') || s.startsWith('^')) return false;
  if (PROCEDURAL.test(s)) return false;
  const stack = [];
  let quote = null;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === '\\') {
      if (i === s.length - 1) return false;
      i++;
      continue;
    }
    if (quote) {
      if (c === quote) quote = null;
      continue;
    }
    if (c === '"' || c === "'") quote = c;
    else if (c === '(' || c === '[') stack.push(c);
    else if (c === ')' || c === ']') {
      if (stack.pop() !== (c === ')' ? '(' : '[')) return false;
    }
  }
  return !quote && stack.length === 0;
}

function parseDomainList(text, separator) {
  const include = [];
  const exclude = [];
  for (const raw of text.split(separator)) {
    const entry = raw.trim();
    if (!entry) continue;
    const negated = entry.startsWith('~');
    const name = negated ? entry.slice(1) : entry;
    // Platzhalter wie "google.*" kann Chrome nicht auswerten. Den ganzen Filter zu verwerfen ist
    // sicherer, als ihn ohne diese Einschränkung anzuwenden.
    if (name.includes('*')) return null;
    const ascii = toAsciiDomain(name);
    if (!ascii) return null;
    (negated ? exclude : include).push(ascii);
  }
  return { include, exclude };
}

function skip(reason) {
  return { skip: reason };
}

/** Einen Elementfilter lesen: "domains##selector" oder "domains#@#selector". */
function parseCosmetic(line, sepIndex) {
  const domainsText = line.slice(0, sepIndex);
  const rest = line.slice(sepIndex);
  let exception = false;
  let selector;
  if (rest.startsWith('##')) {
    selector = rest.slice(2);
  } else if (rest.startsWith('#@#')) {
    exception = true;
    selector = rest.slice(3);
  } else {
    return skip('cosmetic-extended'); // #?#, #$#, #%# und ihre Ausnahmen
  }
  selector = selector.trim();
  if (!isSafeSelector(selector)) return skip('cosmetic-selector');
  const domains = parseDomainList(domainsText, ',');
  if (!domains) return skip('cosmetic-domain');
  // "~a.de#@#x" (Ausnahme überall außer auf a.de) wird praktisch nie gebraucht und bleibt außen vor.
  if (exception && domains.exclude.length) return skip('cosmetic-domain');
  return { kind: 'cosmetic', exception, selector, include: domains.include, exclude: domains.exclude };
}

function findCosmeticSeparator(line) {
  const m = /#[@?$%]*[#?$%]/.exec(line);
  if (!m) return -1;
  // Vor dem Trenner dürfen nur Domains stehen.
  const before = line.slice(0, m.index);
  if (!/^[^\s/|^$=]*$/.test(before)) return -1;
  return m.index;
}

function patternToUrlFilter(pattern) {
  let p = pattern;
  if (p.length > 2 && p.startsWith('/') && p.endsWith('/')) return skip('regex');
  if (!/^[\x21-\x7e]*$/.test(p)) return skip('non-ascii');
  let anchor = '';
  if (p.startsWith('||')) {
    anchor = '||';
    p = p.slice(2);
  } else if (p.startsWith('|')) {
    anchor = '|';
    p = p.slice(1);
  }
  let end = '';
  if (p.endsWith('|')) {
    end = '|';
    p = p.slice(0, -1);
  }
  // "*" am Anfang und Ende ist bei Adblock Plus ohnehin implizit. Chrome lehnt "||*" ab.
  if (p.startsWith('*')) {
    p = p.replace(/^\*+/, '');
    anchor = '';
  }
  if (p.endsWith('*')) {
    p = p.replace(/\*+$/, '');
    end = '';
  }
  if (p.includes('|')) return skip('pattern');
  if (!p) return {};
  return { urlFilter: anchor + p + end };
}

/** Einen Netzfilter lesen. Ergebnis ist eine Beschreibung, noch keine Chrome-Regel. */
function parseNetwork(line) {
  let text = line;
  let exception = false;
  if (text.startsWith('@@')) {
    exception = true;
    text = text.slice(2);
  }
  let pattern = text;
  let optionText = '';
  // Optionen stehen hinter dem letzten "$". Ein "$" innerhalb eines Musters (etwa am Ende eines
  // regulären Ausdrucks) wird nicht getrennt, weil danach keine gültige Optionsliste folgt.
  const dollar = text.lastIndexOf('$');
  if (dollar >= 0 && OPTIONS_RE.test(text.slice(dollar + 1))) {
    pattern = text.slice(0, dollar);
    optionText = text.slice(dollar + 1);
  }

  const f = {
    kind: 'network',
    exception,
    pattern,
    types: new Set(),
    notTypes: new Set(),
    party: null,
    initiators: null,
    notInitiators: null,
    important: false,
    matchCase: false,
    cosmetic: new Set(), // elemhide, generichide
  };

  if (optionText) {
    for (const raw of optionText.split(',')) {
      const opt = raw.trim().toLowerCase();
      if (!opt) continue;
      const negated = opt.startsWith('~');
      const name = (negated ? opt.slice(1) : opt).split('=')[0];
      const value = raw.includes('=') ? raw.slice(raw.indexOf('=') + 1).trim() : '';
      if (name === 'third-party' || name === '3p') {
        f.party = negated ? 'firstParty' : 'thirdParty';
      } else if (name === 'first-party' || name === '1p') {
        f.party = negated ? 'thirdParty' : 'firstParty';
      } else if (name === 'domain' || name === 'from') {
        if (negated) return skip('option');
        const domains = parseDomainList(value, '|');
        if (!domains) return skip('domain');
        f.initiators = domains.include;
        f.notInitiators = domains.exclude;
      } else if (name === 'important') {
        f.important = true;
      } else if (name === 'match-case') {
        f.matchCase = true;
      } else if (name === 'elemhide' || name === 'ehide') {
        f.cosmetic.add('elemhide');
      } else if (name === 'generichide' || name === 'ghide') {
        f.cosmetic.add('generichide');
      } else if (name in TYPE_MAP) {
        (negated ? f.notTypes : f.types).add(TYPE_MAP[name]);
      } else if (IGNORED_TYPES.has(name)) {
        if (!negated) f.hadIgnoredType = true;
      } else if (UNSUPPORTED_OPTIONS.has(name)) {
        return skip(`option:${name}`);
      } else {
        return skip('option');
      }
    }
  }
  if (f.hadIgnoredType && f.types.size === 0) return skip('type');

  // $elemhide/$generichide wirken nur auf Elementfilter und nur als Ausnahme.
  if (f.cosmetic.size) {
    if (!exception) return skip('option');
    const host = hostFromPattern(pattern);
    if (!host) return skip('pattern');
    f.cosmeticHost = host;
    if (f.types.size === 0 && f.notTypes.size === 0) return f; // nur die Elementausnahme
  }

  const url = patternToUrlFilter(pattern);
  if (url.skip) return url;
  f.urlFilter = url.urlFilter;
  const pure = PURE_HOST_RE.exec(pattern.toLowerCase());
  if (pure) f.host = pure[1];
  return f;
}

function hostFromPattern(pattern) {
  const m = /^\|\|([^/^|*:]+)[/^|]?$/.exec(pattern.toLowerCase());
  return m ? toAsciiDomain(m[1]) : null;
}

/**
 * Eine Zeile einer Filterliste lesen.
 * Ergebnis: {kind:'comment'} | {kind:'cosmetic', ...} | {kind:'network', ...} | {skip: grund}
 */
export function parseLine(rawLine) {
  const line = rawLine.trim();
  if (!line || line.startsWith('!') || (line.startsWith('[') && line.endsWith(']'))) return { kind: 'comment' };
  const sep = findCosmeticSeparator(line);
  if (sep >= 0) return parseCosmetic(line, sep);
  if (line.includes('##') || line.includes('#@#')) return skip('cosmetic-domain');
  // Zeilen im hosts-Format ("0.0.0.0 example.com")
  const hosts = /^(?:0\.0\.0\.0|127\.0\.0\.1|::1?)\s+([^\s#]+)/.exec(line);
  if (hosts) {
    const d = toAsciiDomain(hosts[1]);
    if (!d || d === 'localhost' || !d.includes('.')) return skip('hosts');
    return parseNetwork(`||${d}^`);
  }
  if (/\s/.test(line)) return skip('pattern');
  return parseNetwork(line);
}

function sortedArray(set) {
  return [...set].sort();
}

/** Chrome-Bedingung ohne urlFilter/requestDomains für einen gelesenen Netzfilter. */
function baseCondition(f) {
  const c = {};
  if (f.types.size) {
    c.resourceTypes = sortedArray(f.types);
  } else if (f.notTypes.size) {
    // Ohne resourceTypes gilt eine Regel nicht für main_frame. Mit excludedResourceTypes schon,
    // deshalb main_frame ausdrücklich ausschließen.
    c.excludedResourceTypes = sortedArray(new Set([...f.notTypes, 'main_frame']));
  }
  if (f.party) c.domainType = f.party;
  if (f.initiators?.length) c.initiatorDomains = [...f.initiators].sort();
  if (f.notInitiators?.length) c.excludedInitiatorDomains = [...f.notInitiators].sort();
  return c;
}

function actionFor(f) {
  if (!f.exception) return { rule: { type: 'block' }, priority: f.important ? PRIORITY.important : PRIORITY.block };
  const frameOnly = f.types.size > 0 && [...f.types].every((t) => t === 'main_frame' || t === 'sub_frame');
  if (f.types.has('main_frame') && frameOnly) {
    return { rule: { type: 'allowAllRequests' }, priority: PRIORITY.exception };
  }
  return { rule: { type: 'allow' }, priority: PRIORITY.exception };
}

/**
 * Eine ganze Filterliste übersetzen.
 * @returns {{network: object[], hosts: string[], allowHosts: string[], cosmetic: object, stats: object}}
 *   network: Chrome-Regeln ohne id; hosts: reine Werbe-Domains (für das Einklappen gesperrter Rahmen);
 *   allowHosts: Domains, für die es Ausnahmen gibt;
 *   cosmetic: Elementfilter in kompakter Form, siehe buildCosmeticIndex.
 */
export function compileList(text, { maxLineErrors = 50 } = {}) {
  const stats = { lines: 0, network: 0, cosmetic: 0, skipped: 0, reasons: {}, errors: [] };
  const groups = new Map(); // gleiche Bedingung -> Domains
  const rules = [];
  const hosts = new Set();
  const allowHosts = new Set(); // Domains mit Ausnahmeregeln: deren Rahmen nie einklappen
  const cosmetic = { generic: [], genericExcept: [], specific: [], exceptions: [], elemhide: [], generichide: [] };

  const lines = String(text).split(/\r?\n/);
  lines.forEach((raw, index) => {
    const r = parseLine(raw);
    if (r.kind === 'comment') return;
    stats.lines++;
    if (r.skip) {
      stats.skipped++;
      stats.reasons[r.skip] = (stats.reasons[r.skip] || 0) + 1;
      if (stats.errors.length < maxLineErrors) stats.errors.push({ line: index + 1, text: raw.trim().slice(0, 200), reason: r.skip });
      return;
    }
    if (r.kind === 'cosmetic') {
      stats.cosmetic++;
      if (r.exception) cosmetic.exceptions.push([r.selector, r.include]);
      else if (r.include.length) cosmetic.specific.push(r.exclude.length ? [r.selector, r.include, r.exclude] : [r.selector, r.include]);
      else if (r.exclude.length) cosmetic.genericExcept.push([r.selector, r.exclude]);
      else cosmetic.generic.push(r.selector);
      return;
    }

    // Netzfilter
    stats.network++;
    if (r.cosmeticHost) {
      if (r.cosmetic.has('elemhide')) cosmetic.elemhide.push(r.cosmeticHost);
      if (r.cosmetic.has('generichide')) cosmetic.generichide.push(r.cosmeticHost);
      if (r.types.size === 0 && r.notTypes.size === 0) return;
    }
    // $document-Ausnahmen schalten auch die Elementfilter ab.
    if (r.exception && r.types.has('main_frame')) {
      const h = hostFromPattern(r.pattern);
      if (h) cosmetic.elemhide.push(h);
    }
    if (r.exception) {
      const h = /^\|\|([a-z0-9_.-]+)/.exec(r.pattern.toLowerCase())?.[1];
      if (h && h.includes('.')) allowHosts.add(h.replace(/\.$/, ''));
    }
    const { rule: action, priority } = actionFor(r);
    const condition = baseCondition(r);
    if (action.type === 'allowAllRequests') {
      condition.resourceTypes = condition.resourceTypes.filter((t) => t === 'main_frame' || t === 'sub_frame');
    }
    if (!r.urlFilter && !condition.initiatorDomains && !r.host) {
      // Ein Filter ohne Muster und ohne Seitenbezug träfe jede Anfrage.
      stats.network--;
      stats.skipped++;
      stats.reasons.broad = (stats.reasons.broad || 0) + 1;
      return;
    }

    if (r.host && !r.matchCase) {
      const key = JSON.stringify([action.type, priority, condition]);
      let group = groups.get(key);
      if (!group) groups.set(key, (group = { action, priority, condition, domains: new Set() }));
      group.domains.add(r.host);
      // Nur Sperren ohne jede Bedingung: Dann ist sicher, dass Chrome einen Rahmen von dort blockiert.
      if (action.type === 'block' && Object.keys(condition).length === 0) hosts.add(r.host);
      return;
    }
    if (r.urlFilter) {
      condition.urlFilter = r.urlFilter;
      // Ausdrücklich setzen: Vor Chrome 118 galt Groß-/Kleinschreibung standardmäßig.
      condition.isUrlFilterCaseSensitive = r.matchCase;
    }
    rules.push({ priority, action, condition });
  });

  for (const g of groups.values()) {
    const domains = [...g.domains].sort();
    for (let i = 0; i < domains.length; i += HOSTS_PER_RULE) {
      rules.push({ priority: g.priority, action: g.action, condition: { ...g.condition, requestDomains: domains.slice(i, i + HOSTS_PER_RULE) } });
    }
  }
  // Stabile Reihenfolge: gruppierte Domainregeln zuerst, damit sie bei knappen Grenzen erhalten bleiben.
  rules.sort((a, b) => Number(!a.condition.requestDomains) - Number(!b.condition.requestDomains));

  return { network: rules, hosts: [...hosts].sort(), allowHosts: [...allowHosts].sort(), cosmetic, stats };
}

/** Vergibt ids ab startId. */
export function withIds(rules, startId) {
  return rules.map((r, i) => ({ id: startId + i, ...r }));
}

/** Liefert den Schlüssel (.klasse oder #id), ohne den ein Selektor nie greifen kann, oder null. */
export function selectorKey(selector) {
  if (SIMPLE_KEY_RE.test(selector)) return selector;
  if (/[\\(,]/.test(selector)) return null;
  // Erstes .klasse oder #id außerhalb von Attributklammern
  const stripped = selector.replace(/\[[^\]]*\]/g, (m) => ' '.repeat(m.length));
  const m = /[.#][A-Za-z_-][\w-]*(?![\w-])/.exec(stripped);
  return m ? m[0] : null;
}

/**
 * Mehrere übersetzte Listen zu einem Nachschlage-Index zusammenführen.
 * keyed: Selektoren, die nur greifen können, wenn eine bestimmte Klasse/id auf der Seite
 * vorkommt; sie werden erst angewendet, wenn das Inhaltsskript diese Klasse meldet.
 * always: generische Selektoren ohne solchen Schlüssel, sie gelten auf jeder Seite.
 */
export function buildCosmeticIndex(compiledCosmetics) {
  const genericExceptions = new Set();
  for (const c of compiledCosmetics) {
    for (const [sel, domains] of c.exceptions) if (!domains.length) genericExceptions.add(sel);
  }
  const keyed = {};
  const always = new Set();
  const genericExcept = [];
  const specific = {};
  const exceptions = {};
  const elemhide = new Set();
  const generichide = new Set();

  for (const c of compiledCosmetics) {
    for (const sel of c.generic) {
      if (genericExceptions.has(sel)) continue;
      const key = selectorKey(sel);
      if (key) (keyed[key] ||= []).includes(sel) || keyed[key].push(sel);
      else always.add(sel);
    }
    for (const [sel, exclude] of c.genericExcept) if (!genericExceptions.has(sel)) genericExcept.push([sel, exclude]);
    for (const [sel, include, exclude] of c.specific) {
      if (genericExceptions.has(sel)) continue;
      for (const d of include) (specific[d] ||= []).push(exclude ? [sel, exclude] : sel);
    }
    for (const [sel, domains] of c.exceptions) for (const d of domains) (exceptions[d] ||= []).push(sel);
    c.elemhide.forEach((d) => elemhide.add(d));
    c.generichide.forEach((d) => generichide.add(d));
  }
  return {
    keyed,
    always: [...always],
    genericExcept,
    specific,
    exceptions,
    elemhide: [...elemhide],
    generichide: [...generichide],
  };
}

/**
 * Macht aus dem gespeicherten Index eine Form, in der das Nachschlagen schnell geht
 * (Sets statt Arrays). Wird im Service Worker einmal pro Start aufgerufen.
 */
export function prepareIndex(index) {
  return {
    ...index,
    keyedMap: new Map(Object.entries(index.keyed)),
    elemhideSet: new Set(index.elemhide),
    generichideSet: new Set(index.generichide),
  };
}

/** Welche Elementfilter gelten auf einer Seite? Berücksichtigt Ausnahmen und $elemhide/$generichide. */
export function cosmeticForHost(prepared, hostname) {
  const suffixes = hostSuffixes(hostname);
  if (suffixes.some((d) => prepared.elemhideSet.has(d))) {
    return { disabled: true, generichide: true, selectors: [], exceptions: new Set() };
  }
  const exceptions = new Set();
  for (const d of suffixes) for (const s of prepared.exceptions[d] || []) exceptions.add(s);
  const excluded = (list) => list.some((n) => suffixes.includes(n));

  const out = new Set();
  for (const d of suffixes) {
    for (const entry of prepared.specific[d] || []) {
      const [sel, exclude] = typeof entry === 'string' ? [entry, null] : entry;
      if (exclude && excluded(exclude)) continue;
      if (!exceptions.has(sel)) out.add(sel);
    }
  }
  const generichide = suffixes.some((d) => prepared.generichideSet.has(d));
  if (!generichide) {
    for (const sel of prepared.always) if (!exceptions.has(sel)) out.add(sel);
    for (const [sel, exclude] of prepared.genericExcept) {
      if (!excluded(exclude) && !exceptions.has(sel)) out.add(sel);
    }
  }
  return { disabled: false, generichide, selectors: [...out], exceptions };
}

/** Selektoren zu den vom Inhaltsskript gemeldeten Klassen/ids. */
export function selectorsForKeys(prepared, keys, exceptions) {
  const out = [];
  for (const key of keys) {
    const list = prepared.keyedMap.get(key);
    if (!list) continue;
    for (const sel of list) if (!exceptions.has(sel)) out.push(sel);
  }
  return out;
}

/**
 * CSS zum Ausblenden. Eine Regel pro Selektor: Versteht der Browser einen Selektor nicht,
 * verwirft er nur diese eine Regel und nicht alle anderen.
 */
export function cssForSelectors(selectors) {
  return selectors.map((s) => `${s}{display:none!important}`).join('\n');
}
