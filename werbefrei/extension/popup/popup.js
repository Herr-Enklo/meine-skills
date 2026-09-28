const $ = (id) => document.getElementById(id);
const send = (msg) => chrome.runtime.sendMessage(msg);
const number = new Intl.NumberFormat('de-DE');

// ?tab=<id> öffnet das Popup für einen bestimmten Tab (für die automatischen Tests).
const tabParam = Number(new URLSearchParams(location.search).get('tab'));
const tab = tabParam ? await chrome.tabs.get(tabParam) : (await chrome.tabs.query({ active: true, currentWindow: true }))[0];

$('settings').addEventListener('click', (e) => {
  e.preventDefault();
  chrome.runtime.openOptionsPage();
  window.close();
});

$('picker').addEventListener('click', async () => {
  await send({ type: 'startPicker', tabId: tab.id });
  window.close();
});

$('siteEnabled').addEventListener('change', async (e) => {
  e.target.disabled = true;
  await send({ type: 'setSiteEnabled', tabId: tab.id, enabled: e.target.checked });
  await render();
  e.target.disabled = false;
});

$('pause').addEventListener('click', async () => {
  await send({ type: 'setPaused', paused: true, tabId: tab.id });
  await render();
});

$('resume').addEventListener('click', async () => {
  await send({ type: 'setPaused', paused: false, tabId: tab.id });
  await render();
});

/** Anzahl der blockierten Anfragen im Tab. Ausnahmeregeln zählen nicht mit. */
async function blockedCount(tabId) {
  const dnr = chrome.declarativeNetRequest;
  try {
    const { rulesMatchedInfo } = await dnr.getMatchedRules({ tabId });
    if (!rulesMatchedInfo.length) return 0;
    const staticRules = await (await fetch('../rules/werbefrei.json')).json();
    const staticBlock = new Set(staticRules.filter((r) => r.action.type === 'block').map((r) => r.id));
    const dynamicIds = [...new Set(rulesMatchedInfo.filter((i) => i.rule.rulesetId === '_dynamic').map((i) => i.rule.ruleId))];
    const dynamic = dynamicIds.length ? await dnr.getDynamicRules({ ruleIds: dynamicIds }) : [];
    const dynamicBlock = new Set(dynamic.filter((r) => r.action.type === 'block').map((r) => r.id));
    return rulesMatchedInfo.filter((i) =>
      i.rule.rulesetId === '_dynamic' ? dynamicBlock.has(i.rule.ruleId) : staticBlock.has(i.rule.ruleId),
    ).length;
  } catch {
    // Chrome begrenzt die Abfrage auf 20 Aufrufe in 10 Minuten.
    return null;
  }
}

async function render() {
  const state = await send({ type: 'popupState', tabId: tab.id });
  const paused = Boolean(state?.paused);
  $('pausedNotice').hidden = !paused;
  $('pause').hidden = paused;
  $('logo').src = paused || state?.allowlisted ? '../icons/aus-32.png' : '../icons/an-32.png';

  if (!state?.supported) {
    $('site').textContent = 'Keine Webseite';
    $('main').hidden = true;
    $('unsupported').hidden = paused;
    return;
  }
  $('site').textContent = state.site;
  $('unsupported').hidden = true;
  $('main').hidden = paused;
  if (paused) return;

  const active = !state.allowlisted;
  $('siteEnabled').checked = active;
  $('toggleLabel').textContent = active ? 'Auf dieser Seite aktiv' : 'Auf dieser Seite aus';
  $('toggleHint').textContent = active
    ? 'Ausschalten, wenn die Seite nicht richtig funktioniert.'
    : `Auf ${state.site} wird nichts blockiert.`;
  if (state.listDisabled && active) {
    $('toggleHint').textContent = 'Die Filterlisten schalten das Ausblenden hier ab, weil es die Seite stört.';
  }
  $('picker').disabled = !active;
  $('stats').classList.toggle('off', !active);

  const [blocked, count] = await Promise.all([
    active ? blockedCount(tab.id) : 0,
    active ? send({ type: 'popupCount', tabId: tab.id }) : null,
  ]);
  $('blocked').textContent = blocked === null ? '–' : number.format(blocked);
  $('hidden').textContent = count?.active ? number.format(count.hidden) : active ? '–' : '0';
}

await render();
