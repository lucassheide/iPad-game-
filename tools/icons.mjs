// Gera os ícones PNG (tela de início do iPad/celular) a partir do desenho do Lucas.
// Uso: NODE_PATH=$(npm root -g) node tools/icons.mjs
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { writeFileSync } from 'node:fs';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto('file://' + join(root, 'index.html'));
await page.waitForTimeout(1200);
for (const size of [180, 192, 512]) {
  const data = await page.evaluate((size) => {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const x = c.getContext('2d');
    const g = x.createLinearGradient(0, 0, 0, size);
    g.addColorStop(0, '#171447');
    g.addColorStop(1, '#3b1d5e');
    x.fillStyle = g;
    x.fillRect(0, 0, size, size);
    const k = size / 40;
    x.setTransform(k, 0, 0, k, 0, 0);
    x.fillStyle = '#ff5470';
    x.fillRect(0, 33, 40, 2.2);
    x.fillStyle = '#7e1235';
    x.fillRect(0, 35.2, 40, 4.8);
    x.setTransform(k * 0.95, 0, 0, k * 0.95, size * 0.025, 0);
    window.LucasKong.Art.lucas(x, 21, 34.5, { t: 0.5, state: 'beat', dir: 1 });
    return c.toDataURL('image/png').split(',')[1];
  }, size);
  writeFileSync(join(root, 'icons', `icon-${size}.png`), Buffer.from(data, 'base64'));
}
await browser.close();
console.log('ícones gerados');
