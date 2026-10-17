// Teste rápido no Chromium: abre o jogo, percorre as fases e tira capturas de tela.
// Uso: NODE_PATH=$(npm root -g) node tools/smoke.mjs [pasta-de-saida]
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { mkdirSync } from 'node:fs';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = process.argv[2] || join(root, 'dist', 'shots');
mkdirSync(out, { recursive: true });

const views = {
  ipad: { viewport: { width: 1080, height: 810 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true },
  phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, hasTouch: true, isMobile: true },
};

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined });
const errors = [];
for (const [name, opts] of Object.entries(views)) {
  const ctx = await browser.newContext(opts);
  const page = await ctx.newPage();
  page.on('console', (m) => m.type() === 'error' && errors.push(`[${name}] ${m.text()}`));
  page.on('pageerror', (e) => errors.push(`[${name}] ${e.message}`));
  await page.goto('file://' + join(root, 'index.html'));
  await page.waitForTimeout(1500);
  await page.screenshot({ path: join(out, `${name}-home.png`) });
  const fases = name === 'ipad' ? [1, 2, 3, 4, 5, 6, 7, 8] : [1, 3];
  for (const f of fases) {
    await page.evaluate((f) => window.LucasKong.UI.startGame({ mode: 'solo', players: [{ id: null, name: 'Lucas', color: '#5ee7ff' }], startFase: f }), f);
    await page.waitForTimeout(f === 1 ? 900 : 3600);
    await page.screenshot({ path: join(out, `${name}-fase${f}.png`) });
  }
  await page.evaluate(() => window.LucasKong.UI.startGame({ mode: 'duelo', players: [{ id: null, name: 'Lucas', color: '#5ee7ff' }, { id: null, name: 'Lara', color: '#ff8fc7' }], startFase: 1 }));
  await page.waitForTimeout(3500);
  await page.screenshot({ path: join(out, `${name}-duelo.png`) });
  await ctx.close();
}
await browser.close();
console.log(errors.length ? 'ERROS:\n' + errors.join('\n') : 'sem erros no console');
