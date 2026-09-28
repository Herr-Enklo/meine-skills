import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildRules } from '../tools/build.mjs';

const read = (path) => readFileSync(new URL(`../extension/${path}`, import.meta.url), 'utf8');

test('rules/werbefrei.json passt zu filters/werbefrei.txt', () => {
  assert.equal(read('rules/werbefrei.json'), buildRules().json);
});

test('das statische Regelwerk hält die Vorgaben von Chrome ein', () => {
  const { rules } = buildRules();
  const ids = new Set();
  for (const rule of rules) {
    assert.ok(Number.isInteger(rule.id) && rule.id > 0, 'id ist eine positive Ganzzahl');
    assert.ok(!ids.has(rule.id), 'ids sind eindeutig');
    ids.add(rule.id);
    assert.ok(['block', 'allow', 'allowAllRequests'].includes(rule.action.type));
    const c = rule.condition;
    if (c.urlFilter !== undefined) {
      assert.ok(c.urlFilter.length > 0 && !c.urlFilter.startsWith('||*'));
      assert.match(c.urlFilter, /^[\x21-\x7e]+$/);
    }
    for (const d of [...(c.requestDomains || []), ...(c.initiatorDomains || []), ...(c.excludedInitiatorDomains || [])]) {
      assert.match(d, /^[a-z0-9_.-]+$/, `Domain ${d} ist kleingeschrieben und ASCII`);
    }
    if (rule.action.type === 'allowAllRequests') {
      assert.ok(c.resourceTypes.every((t) => t === 'main_frame' || t === 'sub_frame'));
    }
  }
});

test('Manifest verweist nur auf vorhandene Dateien', () => {
  const manifest = JSON.parse(read('manifest.json'));
  const files = [
    manifest.background.service_worker,
    manifest.action.default_popup,
    manifest.options_ui.page,
    ...Object.values(manifest.icons),
    ...Object.values(manifest.action.default_icon),
    ...manifest.content_scripts.flatMap((c) => c.js),
    ...manifest.declarative_net_request.rule_resources.map((r) => r.path),
    'picker/picker.js',
    'icons/aus-16.png',
    'icons/aus-32.png',
  ];
  for (const f of files) assert.doesNotThrow(() => readFileSync(new URL(`../extension/${f}`, import.meta.url)), f);
});
