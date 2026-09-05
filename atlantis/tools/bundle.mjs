/* Baut aus index.html eine einzelne HTML-Datei mit eingebettetem CSS und JS: dist/atlantis.html.
   Mit --artifact=<pfad> entsteht zusätzlich eine Fassung ohne Dokumentrahmen (für claude.ai-Artifacts). */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(path.join(root, 'index.html'), 'utf8');
let out = html.replace(/<link rel="stylesheet" href="([^"]+)">/g, (m, href) => '<style>\n' + readFileSync(path.join(root, href), 'utf8') + '\n</style>');
out = out.replace(/<script src="([^"]+)"><\/script>/g, (m, src) => '<script>\n' + readFileSync(path.join(root, src), 'utf8').replace(/<\/script>/g, '<\\/script>') + '\n</script>');
mkdirSync(path.join(root, 'dist'), { recursive: true });
writeFileSync(path.join(root, 'dist', 'atlantis.html'), out);
console.log('dist/atlantis.html', Math.round(out.length / 1024) + ' KB');
const art = process.argv.find((a) => a.startsWith('--artifact='));
if (art) {
  const body = out.replace(/^[\s\S]*?<body>/, '').replace(/<\/body>\s*<\/html>\s*$/, '');
  const head = out.match(/<head>([\s\S]*?)<\/head>/)[1].replace(/<meta[^>]*>/g, '');
  writeFileSync(art.slice('--artifact='.length), head + '\n' + body);
  console.log(art.slice('--artifact='.length));
}
