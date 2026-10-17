// Gera index.html (página completa, funciona offline e no GitHub Pages)
// e dist/artifact.html (conteúdo da página para publicar no claude.ai).
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');

const css = read('src/style.css');
const jsFiles = readdirSync(join(root, 'src/js')).filter((f) => f.endsWith('.js')).sort();
const js = jsFiles.map((f) => `// ---- ${f}\n${read('src/js/' + f)}`).join('\n');

const fonts = [
  '<link rel="preconnect" href="https://fonts.googleapis.com">',
  '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>',
  '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bungee&family=Nunito:wght@600;700;800&display=swap">',
].join('\n');

const content = `<title>Lucas Kong</title>
${fonts}
<style>
${css}
</style>
<div id="app"></div>
<script>
(() => {
${js}
})();
</script>
`;

mkdirSync(join(root, 'dist'), { recursive: true });
writeFileSync(join(root, 'dist/artifact.html'), content);

// Página completa: título e estilos no <head>, app e script no <body>.
const split = content.indexOf('<div id="app">');
const full = [
  '<!doctype html>',
  '<html lang="pt-BR">',
  '<head>',
  '<meta charset="utf-8">',
  '<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover">',
  '<meta name="description" content="Lucas Kong: suba as vigas, desvie dos barris e resgate a Lara. Jogo para iPad, celular e computador.">',
  '<meta name="theme-color" content="#0b0920">',
  '<meta name="apple-mobile-web-app-capable" content="yes">',
  '<meta name="mobile-web-app-capable" content="yes">',
  '<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">',
  '<meta name="apple-mobile-web-app-title" content="Lucas Kong">',
  '<link rel="icon" type="image/png" href="icons/icon-192.png">',
  '<link rel="apple-touch-icon" href="icons/icon-180.png">',
  '<link rel="manifest" href="manifest.webmanifest">',
  content.slice(0, split).trim(),
  '</head>',
  '<body>',
  content.slice(split).trim(),
  '</body>',
  '</html>',
  '',
].join('\n');
writeFileSync(join(root, 'index.html'), full);

console.log(`ok: index.html (${(full.length / 1024).toFixed(0)} KB), dist/artifact.html (${(content.length / 1024).toFixed(0)} KB), ${jsFiles.length} módulos`);
