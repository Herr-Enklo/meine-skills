import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseLine,
  compileList,
  isSafeSelector,
  selectorKey,
  buildCosmeticIndex,
  prepareIndex,
  cosmeticForHost,
  selectorsForKeys,
  cssForSelectors,
  hostSuffixes,
  toAsciiDomain,
  withIds,
  planDynamicRules,
  PRIORITY,
} from '../extension/lib/filters.js';

const rulesOf = (text) => compileList(text).network;

test('Kommentare und Kopfzeilen werden ignoriert', () => {
  assert.equal(parseLine('! Titel').kind, 'comment');
  assert.equal(parseLine('[Adblock Plus 2.0]').kind, 'comment');
  assert.equal(parseLine('   ').kind, 'comment');
});

test('reine Domainfilter werden zu einer Regel mit requestDomains zusammengefasst', () => {
  const rules = rulesOf('||doubleclick.net^\n||adnxs.com^\n||Criteo.com^');
  assert.equal(rules.length, 1);
  assert.deepEqual(rules[0], {
    priority: PRIORITY.block,
    action: { type: 'block' },
    condition: { requestDomains: ['adnxs.com', 'criteo.com', 'doubleclick.net'] },
  });
});

test('Domainfilter mit Optionen landen in getrennten Gruppen', () => {
  const rules = rulesOf('||a.com^$third-party\n||b.com^$third-party\n||c.com^$script,domain=spiegel.de|~panorama.spiegel.de');
  assert.equal(rules.length, 2);
  const third = rules.find((r) => r.condition.domainType);
  assert.deepEqual(third.condition, { domainType: 'thirdParty', requestDomains: ['a.com', 'b.com'] });
  const scoped = rules.find((r) => r.condition.initiatorDomains);
  assert.deepEqual(scoped.condition, {
    resourceTypes: ['script'],
    initiatorDomains: ['spiegel.de'],
    excludedInitiatorDomains: ['panorama.spiegel.de'],
    requestDomains: ['c.com'],
  });
});

test('Pfadmuster werden zu urlFilter', () => {
  const [rule] = rulesOf('/banner/ads/*.gif$image');
  assert.deepEqual(rule.condition, { resourceTypes: ['image'], urlFilter: '/banner/ads/*.gif', isUrlFilterCaseSensitive: false });
  const [anchored] = rulesOf('||example.com/werbung/');
  assert.equal(anchored.condition.urlFilter, '||example.com/werbung/');
});

test('Sterne am Rand fallen weg, "||*" entsteht nie', () => {
  const [a] = rulesOf('||*.adserver.example/');
  assert.equal(a.condition.urlFilter, '.adserver.example/');
  const [b] = rulesOf('*/ads/*');
  assert.equal(b.condition.urlFilter, '/ads/');
});

test('Ausnahmen, $important und $document bekommen die richtige Aktion und Priorität', () => {
  const [allow] = rulesOf('@@||example.com/ads.js$script');
  assert.equal(allow.action.type, 'allow');
  assert.equal(allow.priority, PRIORITY.exception);

  const [important] = rulesOf('||tracker.example^$important');
  assert.equal(important.action.type, 'block');
  assert.equal(important.priority, PRIORITY.important);

  const compiled = compileList('@@||news.example^$document');
  assert.equal(compiled.network[0].action.type, 'allowAllRequests');
  assert.deepEqual(compiled.network[0].condition.resourceTypes, ['main_frame']);
  assert.deepEqual(compiled.cosmetic.elemhide, ['news.example']);
});

test('negierte Typen schließen main_frame aus', () => {
  const [rule] = rulesOf('/adframe.$~script');
  assert.deepEqual(rule.condition.excludedResourceTypes, ['main_frame', 'script']);
});

test('$match-case setzt die Groß-/Kleinschreibung', () => {
  const [rule] = rulesOf('/AdBanner.$match-case');
  assert.equal(rule.condition.isUrlFilterCaseSensitive, true);
});

test('nicht abbildbare Filter werden übersprungen und gezählt', () => {
  const { network, stats } = compileList(
    [
      '||popup.example^$popup',
      '/ad-[0-9]+\\.js/',
      '||x.example^$csp=script-src none',
      '||x.example^$domain=google.*',
      '/addyn|*|adtech;',
      '*$third-party',
      '||werbung.example^$webrtc',
    ].join('\n'),
  );
  assert.equal(network.length, 0);
  assert.equal(stats.skipped, 7);
  assert.equal(stats.reasons['option:popup'], 1);
  assert.equal(stats.reasons.regex, 1);
  assert.equal(stats.reasons.broad, 1);
});

test('ein "$" in einem regulären Ausdruck trennt keine Optionen ab', () => {
  assert.equal(parseLine('/ads\\.js$/').skip, 'regex');
  const r = parseLine('/ad/img/*$image,domain=~eki-net.com|~jiji.com');
  assert.equal(r.kind, 'network');
  assert.equal(r.urlFilter, '/ad/img/');
});

test('hosts-Dateien werden verstanden', () => {
  const rules = rulesOf('0.0.0.0 ads.example.com\n127.0.0.1 localhost');
  assert.deepEqual(rules[0].condition.requestDomains, ['ads.example.com']);
});

test('Umlautdomains werden in Punycode umgewandelt', () => {
  assert.equal(toAsciiDomain('Bücher.de'), 'xn--bcher-kva.de');
  assert.equal(toAsciiDomain('a b.de'), null);
  const [rule] = rulesOf('||x.example^$domain=bücher.de');
  assert.deepEqual(rule.condition.initiatorDomains, ['xn--bcher-kva.de']);
});

test('Elementfilter werden nach generisch, seitenbezogen und Ausnahme sortiert', () => {
  const { cosmetic, stats } = compileList(
    [
      '##.werbung',
      'spiegel.de,~panorama.spiegel.de##.ad-billboard',
      'zeit.de##.ad-rectangle',
      '~heise.de##.sponsored',
      'zeit.de#@#.werbung',
      '@@||golem.de^$generichide',
      '@@||kaputt.example^$elemhide',
    ].join('\n'),
  );
  assert.equal(stats.skipped, 0);
  assert.deepEqual(cosmetic.generic, ['.werbung']);
  assert.deepEqual(cosmetic.specific, [
    ['.ad-billboard', ['spiegel.de'], ['panorama.spiegel.de']],
    ['.ad-rectangle', ['zeit.de']],
  ]);
  assert.deepEqual(cosmetic.genericExcept, [['.sponsored', ['heise.de']]]);
  assert.deepEqual(cosmetic.exceptions, [['.werbung', ['zeit.de']]]);
  assert.deepEqual(cosmetic.generichide, ['golem.de']);
  assert.deepEqual(cosmetic.elemhide, ['kaputt.example']);
});

test('erweiterte und gefährliche Selektoren werden abgelehnt', () => {
  assert.equal(parseLine('example.com#?#div:-abp-has(.ad)').skip, 'cosmetic-extended');
  assert.equal(parseLine('example.com#$#abort-on-property-read x').skip, 'cosmetic-extended');
  assert.equal(parseLine('example.com##+js(nobab)').skip, 'cosmetic-selector');
  assert.equal(parseLine('example.com##div:has-text(Anzeige)').skip, 'cosmetic-selector');
  assert.equal(parseLine('example.com##.x {top:0}').skip, 'cosmetic-selector');
  assert.equal(parseLine('example.com##body}html{display:none').skip, 'cosmetic-selector');
  assert.equal(parseLine('google.*##.ad').skip, 'cosmetic-domain');
});

test('isSafeSelector prüft Klammern, Anführungszeichen und Kommentare', () => {
  assert.ok(isSafeSelector('div[id^="div-gpt-ad"]'));
  assert.ok(isSafeSelector('.teaser:has(> .label-anzeige)'));
  assert.ok(isSafeSelector('a[href*="(test)"]'));
  assert.ok(isSafeSelector('.a\\:b'));
  assert.ok(!isSafeSelector('div[id="x'));
  assert.ok(!isSafeSelector('div:not(.a'));
  assert.ok(!isSafeSelector('div]'));
  assert.ok(!isSafeSelector('div /* x */'));
  assert.ok(!isSafeSelector('.a\\'));
  assert.ok(!isSafeSelector('[title="a\rb"]'));
  assert.ok(!isSafeSelector('[title="a\fb"]'));
  assert.ok(!isSafeSelector(''));
});

test('selectorKey findet die Klasse oder id, ohne die ein Selektor nicht greift', () => {
  assert.equal(selectorKey('.ad-banner'), '.ad-banner');
  assert.equal(selectorKey('#werbung'), '#werbung');
  assert.equal(selectorKey('div.ad-slot > iframe'), '.ad-slot');
  assert.equal(selectorKey('a[href*=".com/x"] .ad'), '.ad');
  assert.equal(selectorKey('[id^="div-gpt-ad"]'), null);
  assert.equal(selectorKey('.a:not(.b)'), null);
  assert.equal(selectorKey('.a, .b'), null);
});

test('Index: Selektoren für eine Seite inklusive Ausnahmen', () => {
  const list = compileList(
    [
      '##.werbung',
      '##[id^="div-gpt-ad"]',
      '##.teaser.anzeige',
      '~heise.de##.sponsored-box',
      'spiegel.de##.ad-billboard',
      'panorama.spiegel.de#@#.ad-billboard',
      'zeit.de#@#.werbung',
      '#@#.harmlos',
      '##.harmlos',
      '@@||golem.de^$generichide',
      '@@||kaputt.example^$elemhide',
      'golem.de##.golem-ad',
    ].join('\n'),
  );
  const index = prepareIndex(buildCosmeticIndex([list.cosmetic]));

  assert.deepEqual(Object.keys(index.keyed).sort(), ['.teaser', '.werbung']);
  assert.deepEqual(index.always, ['[id^="div-gpt-ad"]']);

  const spiegel = cosmeticForHost(index, 'www.spiegel.de');
  assert.deepEqual(spiegel.selectors.sort(), ['.ad-billboard', '.sponsored-box', '[id^="div-gpt-ad"]']);
  assert.deepEqual(selectorsForKeys(index, ['.werbung', '.teaser', '.harmlos', '.nav'], spiegel.exceptions), ['.werbung', '.teaser.anzeige']);

  const panorama = cosmeticForHost(index, 'panorama.spiegel.de');
  assert.ok(!panorama.selectors.includes('.ad-billboard'));

  const zeit = cosmeticForHost(index, 'www.zeit.de');
  assert.deepEqual(selectorsForKeys(index, ['.werbung'], zeit.exceptions), []);

  const heise = cosmeticForHost(index, 'www.heise.de');
  assert.ok(!heise.selectors.includes('.sponsored-box'));

  const golem = cosmeticForHost(index, 'www.golem.de');
  assert.equal(golem.generichide, true);
  assert.deepEqual(golem.selectors, ['.golem-ad']);

  assert.equal(cosmeticForHost(index, 'kaputt.example').disabled, true);
});

test('Index verträgt mehrere Listen und doppelte Einträge', () => {
  const a = compileList('##.werbung\nspiegel.de##.x').cosmetic;
  const b = compileList('##.werbung\nspiegel.de##.x').cosmetic;
  const index = prepareIndex(buildCosmeticIndex([a, b]));
  assert.deepEqual(index.keyed['.werbung'], ['.werbung']);
  assert.deepEqual(cosmeticForHost(index, 'spiegel.de').selectors, ['.x']);
});

test('nur bedingungslos gesperrte Domains werden für das Einklappen gesammelt', () => {
  const { hosts, allowHosts } = compileList(
    '||ads.example^\n||tracker.example^$script\n||third.example^$third-party\n@@||ok.example^\n@@||player.ads.example/embed$subdocument',
  );
  assert.deepEqual(hosts, ['ads.example']);
  assert.deepEqual(allowHosts, ['ok.example', 'player.ads.example']);
});

test('"||host^|" sperrt nur die Startadresse, nicht die ganze Domain', () => {
  const [rule] = rulesOf('||example.com^|');
  assert.equal(rule.condition.urlFilter, '||example.com^|');
  assert.equal(rule.condition.requestDomains, undefined);
});

test('cssForSelectors schreibt eine Regel pro Selektor', () => {
  assert.equal(cssForSelectors(['.a', '#b']), '.a{display:none!important}\n#b{display:none!important}');
});

test('cssForSelectors mit Schalter-Attribut lässt sich über <html> abschalten', () => {
  assert.equal(
    cssForSelectors(['div > .ad'], 'data-xyz'),
    ':is(div > .ad):not(:root[data-xyz] *){display:none!important}',
  );
  assert.equal(
    cssForSelectors(['.box::before'], 'data-xyz'),
    ':is(.box):not(:root[data-xyz] *)::before{display:none!important}',
  );
});

test('planDynamicRules hält die Obergrenze auch bei vielen eigenen Regeln ein', () => {
  const rule = { priority: 1, action: { type: 'block' }, condition: { urlFilter: '/x' } };
  const control = [{ id: 1, ...rule }, { id: 3, ...rule }];
  const plan = planDynamicRules({
    control,
    user: Array(5001).fill(rule),
    lists: Array(300).fill(rule),
    limit: 5000,
    userStart: 100,
    userMax: 9899,
    listStart: 10000,
  });
  assert.equal(plan.rules.length, 5000);
  assert.equal(plan.userDropped, 3);
  assert.equal(plan.listDropped, 300);
  assert.equal(plan.rules[2].id, 100);
  assert.equal(plan.rules.at(-1).id, 100 + 4997);

  const roomy = planDynamicRules({ control, user: Array(10).fill(rule), lists: Array(20).fill(rule), limit: 30000, userStart: 100, userMax: 9899, listStart: 10000 });
  assert.equal(roomy.rules.length, 32);
  assert.equal(roomy.userDropped + roomy.listDropped, 0);
  assert.equal(roomy.rules.at(-1).id, 10019);

  const capped = planDynamicRules({ control: [], user: Array(12000).fill(rule), lists: [], limit: 30000, userStart: 100, userMax: 9899, listStart: 10000 });
  assert.equal(capped.userDropped, 12000 - 9800);
  assert.ok(capped.rules.every((r) => r.id < 10000));
});

test('hostSuffixes und withIds', () => {
  assert.deepEqual(hostSuffixes('www.spiegel.de'), ['www.spiegel.de', 'spiegel.de', 'de']);
  assert.deepEqual(withIds([{ a: 1 }, { a: 2 }], 10).map((r) => r.id), [10, 11]);
});

test('Fehlerzeilen nennen Zeilennummer und Grund', () => {
  const { stats } = compileList('##.ok\nexample.com##.x {top:0}\n||popup.example^$popup');
  assert.deepEqual(
    stats.errors.map((e) => [e.line, e.reason]),
    [
      [2, 'cosmetic-selector'],
      [3, 'option:popup'],
    ],
  );
});
