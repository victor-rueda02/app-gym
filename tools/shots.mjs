/* Capturas en iPhone emulado, para revisar el aspecto sin el móvil delante.
       node tools/shots.mjs  ->  tools/out/shot-*.png */

import { chromium, devices } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const outDir = path.join(root, 'tools', 'out');
fs.mkdirSync(outDir, { recursive: true });

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png' };
const server = http.createServer((req, res) => {
  let f = decodeURIComponent(req.url.split('?')[0]);
  if (f === '/') f = '/index.html';
  const full = path.join(root, f);
  if (!full.startsWith(root) || !fs.existsSync(full)) { res.writeHead(404).end('no'); return; }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(full)] || 'application/octet-stream' });
  res.end(fs.readFileSync(full));
});
await new Promise((r) => server.listen(8124, r));

const browser = await chromium.launch();
const ctx = await browser.newContext({ ...devices['iPhone 13'], locale: 'es-ES' });
const page = await ctx.newPage();
await page.addInitScript(() => {
  const fixed = new Date('2026-07-21T10:00:00');   // martes = Push, sesión con carga
  const RealDate = Date;
  Date = class extends RealDate {
    constructor(...a) { return a.length ? new RealDate(...a) : new RealDate(fixed); }
    static now() { return fixed.getTime(); }
  };
});
await page.goto('http://localhost:8124/index.html');
await page.waitForSelector('main .ex');

const shot = (n) => page.screenshot({ path: path.join(outDir, `shot-${n}.png`) });

await shot('1-hoy');

await page.locator('main .ex', { hasText: 'Press inclinado manc' }).click();
await page.waitForSelector('.set-row input');
const i = page.locator('.set-row:not(.head) input');
await i.nth(0).fill('30'); await i.nth(1).fill('10'); await i.nth(2).fill('2');
await i.nth(3).fill('30'); await i.nth(4).fill('9'); await i.nth(5).fill('2');
await i.nth(6).fill('27,5'); await i.nth(7).fill('9'); await i.nth(8).fill('2');
await page.locator('.btn.ghost').first().click();
await shot('2-ejercicio');

await page.locator('.btn', { hasText: 'Hecho' }).click();
await page.waitForSelector('main .ex');
await shot('3-hoy-con-series');

await page.click('[data-tab="plan"]');
await page.waitForSelector('main .ex');
await shot('4-plan');

await page.click('[data-tab="data"]');
await page.waitForSelector('.btn');
await shot('5-datos');

await browser.close();
server.close();
console.log('capturas en tools/out/');
