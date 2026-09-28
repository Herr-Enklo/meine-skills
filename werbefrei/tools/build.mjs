// Übersetzt die eingebaute Filterliste in das statische Regelwerk der Erweiterung.
//
//   node tools/build.mjs          schreibt extension/rules/werbefrei.json
//   node tools/build.mjs --check  prüft nur, ob die Datei zur Liste passt (für Tests und CI)
//
// Die Liste darf keine Zeilen enthalten, die der Übersetzer überspringen müsste: In der eigenen
// Liste ist das immer ein Tippfehler.

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { compileList, withIds } from '../extension/lib/filters.js';

const root = fileURLToPath(new URL('../extension/', import.meta.url));
const source = `${root}filters/werbefrei.txt`;
const target = `${root}rules/werbefrei.json`;

export function buildRules() {
  const compiled = compileList(readFileSync(source, 'utf8'));
  if (compiled.stats.skipped) {
    const lines = compiled.stats.errors.map((e) => `  Zeile ${e.line}: ${e.text} (${e.reason})`).join('\n');
    throw new Error(`filters/werbefrei.txt enthält Zeilen, die sich nicht übersetzen lassen:\n${lines}`);
  }
  const rules = withIds(compiled.network, 1);
  return { json: `${JSON.stringify(rules, null, 2)}\n`, stats: compiled.stats, rules };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { json, stats, rules } = buildRules();
  if (process.argv.includes('--check')) {
    const current = readFileSync(target, 'utf8');
    if (current !== json) {
      console.error('rules/werbefrei.json ist veraltet. Bitte "node tools/build.mjs" ausführen.');
      process.exit(1);
    }
    console.log('rules/werbefrei.json ist aktuell.');
  } else {
    writeFileSync(target, json);
    console.log(`${rules.length} Regeln aus ${stats.network} Netzfiltern, ${stats.cosmetic} Elementfilter.`);
  }
}
