const $ = (id) => document.getElementById(id);
const send = (msg) => chrome.runtime.sendMessage(msg);
const number = new Intl.NumberFormat('de-DE');
const dateTime = new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium', timeStyle: 'short' });

let state = null;
let rulesDirty = false;

function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = value;
    else if (key.startsWith('on')) node.addEventListener(key.slice(2), value);
    else if (value !== undefined && value !== null && value !== false) node.setAttribute(key, value === true ? '' : value);
  }
  for (const child of children.flat()) if (child) node.append(child);
  return node;
}

function setMessage(id, text, kind = '') {
  const node = $(id);
  node.textContent = text;
  node.className = `message ${kind}`;
}

// --- Filterlisten ------------------------------------------------------------------------------

function listMeta(list) {
  const parts = [];
  const meta = list.meta;
  if (list.bundled) {
    parts.push(el('span', { text: `Eingebaut, Version ${state.version}` }));
  } else if (meta?.updated) {
    parts.push(el('span', { text: `Stand ${dateTime.format(meta.updated)}` }));
  } else if (list.enabled) {
    parts.push(el('span', { text: meta?.error ? 'Noch nicht geladen' : 'Wird geladen …' }));
  }
  if (meta?.stats && (list.enabled || list.bundled)) {
    parts.push(el('span', { text: `${number.format(meta.stats.network)} Netzfilter` }));
    parts.push(el('span', { text: `${number.format(meta.stats.cosmetic)} Elementfilter` }));
    if (meta.stats.skipped) {
      parts.push(el('span', {
        text: `${number.format(meta.stats.skipped)} Zeilen übersprungen`,
        title: 'Filter mit Funktionen, die Chrome-Erweiterungen nicht nachbilden können (etwa Pop-up-Sperren oder Skript-Eingriffe). Sie bleiben außen vor, statt ungenau zu wirken.',
      }));
    }
  }
  if (meta?.error) parts.push(el('span', { class: 'error', text: `Fehler: ${meta.error}` }));
  if (list.url && list.enabled) {
    parts.push(el('button', {
      class: 'btn quiet',
      text: 'Aktualisieren',
      onclick: async (e) => {
        e.target.disabled = true;
        e.target.textContent = 'Lädt …';
        await send({ type: 'updateLists', id: list.id });
        await load();
      },
    }));
  }
  if (list.custom) {
    parts.push(el('button', {
      class: 'btn quiet danger',
      text: 'Entfernen',
      onclick: async () => {
        await send({ type: 'removeCustomList', id: list.id });
        await load();
      },
    }));
  }
  return parts;
}

function renderLists() {
  const container = $('lists');
  container.replaceChildren(
    ...state.lists.map((list) => {
      const input = el('input', {
        type: 'checkbox',
        'aria-label': `${list.title} verwenden`,
        onchange: async (e) => {
          e.target.disabled = true;
          await send({ type: 'setListEnabled', id: list.id, enabled: e.target.checked });
          await load();
        },
      });
      input.checked = list.enabled;
      const title = el('div', { class: 'title' },
        el('span', { text: list.title }),
        list.bundled ? el('span', { class: 'badge', text: 'eingebaut' }) : null,
        list.custom ? el('span', { class: 'badge', text: 'eigene' }) : null,
        list.homepage ? el('a', { href: list.homepage, target: '_blank', rel: 'noopener', text: 'Projektseite' }) : null,
      );
      const description = list.description || list.url;
      return el('div', { class: `card${list.enabled ? ' on' : ''}` },
        el('div', {}, title, el('div', { class: 'desc', text: description })),
        el('label', { class: 'switch' }, input, el('span')),
        el('div', { class: 'meta' }, listMeta(list)),
      );
    }),
  );

  const report = state.ruleReport;
  if (report) {
    let text = `Aktive Netzregeln aus Listen und eigenen Regeln: ${number.format(report.active)} von ${number.format(report.limit)} möglichen.`;
    if (report.userDropped) text += ` ${number.format(report.userDropped)} eigene Netzregeln passten nicht mehr hinein.`;
    if (report.dropped) text += ` ${number.format(report.dropped)} Regeln aus Listen passten nicht mehr hinein.`;
    if (report.invalid) text += ` ${number.format(report.invalid)} Regeln hat der Browser abgelehnt.`;
    $('ruleReport').textContent = text;
  }
}

$('updateAll').addEventListener('click', async (e) => {
  e.target.disabled = true;
  e.target.textContent = 'Lädt …';
  await send({ type: 'updateLists' });
  e.target.disabled = false;
  e.target.textContent = 'Jetzt aktualisieren';
  await load();
});

$('addListForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  setMessage('addListMessage', 'Lädt …');
  const res = await send({ type: 'addCustomList', url: $('listUrl').value, title: $('listTitle').value });
  if (!res?.ok) {
    setMessage('addListMessage', res?.error || 'Hat nicht geklappt.', 'bad');
    return;
  }
  $('listUrl').value = '';
  $('listTitle').value = '';
  setMessage('addListMessage', res.warning ? `Eingetragen, aber: ${res.warning}` : 'Liste abonniert.', res.warning ? 'bad' : 'ok');
  await load();
});

// --- Eigene Regeln -------------------------------------------------------------------------------

const REASONS = {
  'cosmetic-selector': 'Selektor ist kein gültiges CSS oder nutzt erweiterte Funktionen',
  'cosmetic-extended': 'Erweiterte Elementfilter (#?#, #$#) werden nicht unterstützt',
  'cosmetic-domain': 'Domainangabe nicht verständlich (Platzhalter wie google.* gehen nicht)',
  regex: 'Reguläre Ausdrücke werden nicht unterstützt',
  pattern: 'Muster nicht verständlich',
  option: 'Unbekannte Option',
  domain: 'Domainangabe nicht verständlich',
  broad: 'Würde jede Anfrage sperren',
  'non-ascii': 'Muster enthält Sonderzeichen',
  hosts: 'hosts-Zeile nicht verständlich',
  type: 'Anfragetyp wird nicht unterstützt',
};

function reasonText(reason) {
  if (reason.startsWith('option:')) return `Option $${reason.slice(7)} wird nicht unterstützt`;
  return REASONS[reason] || reason;
}

$('userRules').addEventListener('input', () => {
  rulesDirty = true;
  setMessage('rulesMessage', 'Nicht gespeichert');
});

$('saveRules').addEventListener('click', async () => {
  setMessage('rulesMessage', 'Speichert …');
  const res = await send({ type: 'saveUserRules', text: $('userRules').value });
  rulesDirty = false;
  const errors = res?.errors || [];
  const s = res?.stats;
  let summary = s ? `${number.format(s.network)} Netzregeln, ${number.format(s.cosmetic)} Elementregeln gespeichert.` : 'Gespeichert.';
  if (res?.report?.userDropped) {
    summary += ` ${number.format(res.report.userDropped)} Netzregeln passen nicht mehr in die Grenze des Browsers (${number.format(res.report.limit)}) und sind nicht aktiv.`;
  }
  const bad = errors.length || res?.report?.userDropped;
  setMessage('rulesMessage', errors.length ? `${summary} ${errors.length} Zeilen übersprungen:` : summary, bad ? 'bad' : 'ok');
  $('rulesErrors').replaceChildren(
    ...errors.map((e) => el('li', {}, el('strong', { text: `Zeile ${e.line}: ` }), el('span', { class: 'mono', text: e.text }), ` – ${reasonText(e.reason)}`)),
  );
  await load({ keepRules: false });
});

// --- Ausnahmen -----------------------------------------------------------------------------------

function renderAllowlist() {
  const list = state.settings.allowlist;
  $('allowEmpty').hidden = list.length > 0;
  $('allowlist').replaceChildren(
    ...list.map((site) =>
      el('li', {},
        el('span', { text: site }),
        el('button', {
          class: 'btn quiet small',
          text: 'Entfernen',
          'aria-label': `${site} entfernen`,
          onclick: async () => {
            await send({ type: 'setAllowlist', hosts: list.filter((s) => s !== site) });
            await load();
          },
        }),
      ),
    ),
  );
}

$('allowForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const value = $('allowInput').value.trim();
  if (!value) return;
  await send({ type: 'setAllowlist', hosts: [...state.settings.allowlist, value] });
  $('allowInput').value = '';
  await load();
});

// --- Allgemein -----------------------------------------------------------------------------------

for (const key of ['heuristics', 'cookieBanners', 'badge']) {
  $(key).addEventListener('change', async (e) => {
    await send({ type: 'setOption', key, value: e.target.checked });
    await load();
  });
}

async function togglePause() {
  await send({ type: 'setPaused', paused: !state.settings.paused });
  await load();
}
$('pauseToggle').addEventListener('click', togglePause);
$('resume').addEventListener('click', togglePause);

// --- Sichern -------------------------------------------------------------------------------------

$('export').addEventListener('click', async () => {
  const data = await send({ type: 'exportData' });
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = el('a', { href: url, download: `werbefrei-sicherung-${new Date().toISOString().slice(0, 10)}.json` });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  setMessage('backupMessage', 'Sicherung gespeichert.', 'ok');
});

$('importFile').addEventListener('change', async (e) => {
  const file = e.target.files?.[0];
  e.target.value = '';
  if (!file) return;
  let data;
  try {
    data = JSON.parse(await file.text());
  } catch {
    setMessage('backupMessage', 'Die Datei ist kein gültiges JSON.', 'bad');
    return;
  }
  setMessage('backupMessage', 'Stellt wieder her …');
  const res = await send({ type: 'importData', data });
  setMessage('backupMessage', res?.ok ? 'Sicherung wiederhergestellt.' : res?.error || 'Hat nicht geklappt.', res?.ok ? 'ok' : 'bad');
  await load({ keepRules: false });
});

// --- Laden und Navigation --------------------------------------------------------------------------

async function load({ keepRules = true } = {}) {
  state = await send({ type: 'optionsState' });
  $('version').textContent = `Version ${state.version}`;
  $('pausedState').hidden = !state.settings.paused;
  $('pauseToggle').textContent = state.settings.paused ? 'Fortsetzen' : 'Pausieren';
  $('heuristics').checked = state.settings.heuristics;
  $('cookieBanners').checked = state.settings.cookieBanners;
  $('badge').checked = state.settings.badge;
  if (!keepRules || !rulesDirty) $('userRules').value = state.userRules;
  renderLists();
  renderAllowlist();
}

// Änderungen aus dem Hintergrund (Listen geladen, Regel per Auswahl gespeichert) sofort zeigen.
let reloadTimer = 0;
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local' || !(changes.listMeta || changes.settings || changes.userRules || changes.ruleReport)) return;
  clearTimeout(reloadTimer);
  reloadTimer = setTimeout(() => load(), 250);
});

const links = [...document.querySelectorAll('.tabs a')];
const observer = new IntersectionObserver(
  (entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      links.forEach((a) => a.classList.toggle('current', a.getAttribute('href') === `#${entry.target.id}`));
    }
  },
  { rootMargin: '-120px 0px -60% 0px' },
);
document.querySelectorAll('main section').forEach((s) => observer.observe(s));

await load();
