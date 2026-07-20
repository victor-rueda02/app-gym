/* Comprueba que un registro guardado ANTES de renombrar las laterales se
   recoloca solo al abrir la app, en vez de quedarse huérfano.
       node tools/test-migracion.mjs */

import { chromium, devices } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png' };
const server = http.createServer((req, res) => {
  let f = decodeURIComponent(req.url.split('?')[0]);
  if (f === '/') f = '/index.html';
  const full = path.join(root, f);
  if (!full.startsWith(root) || !fs.existsSync(full)) { res.writeHead(404).end('no'); return; }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(full)] || 'application/octet-stream' });
  res.end(fs.readFileSync(full));
});
await new Promise((r) => server.listen(8125, r));

const results = [];
const check = (name, pass, detail = '') => {
  results.push(pass);
  console.log(`${pass ? '  OK  ' : ' FALLO'} ${name}${detail ? ` — ${detail}` : ''}`);
};

const browser = await chromium.launch();
const ctx = await browser.newContext({ ...devices['iPhone 13'], locale: 'es-ES' });
const page = await ctx.newPage();

// Registro tal y como lo habría dejado la versión anterior: sin campo de
// versión y con los identificadores antiguos, incluidos los tres "laterales"
// compartidos entre lunes, miércoles y viernes.
const ANTIGUO = {
  days: {
    '2026-07-20': {                       // lunes  -> laterales de pie
      sessionId: 'A-L', notes: 'previo',
      entries: {
        laterales: [{ kg: '10', reps: '15', secs: '', rir: '2' }],
        'laterales-medio-posterior': [{ kg: '6', reps: '12', secs: '', rir: '2' }],
      },
    },
    '2026-07-22': {                       // miércoles -> laterales sentado inclinado
      sessionId: 'A-X', notes: '',
      entries: { laterales: [{ kg: '11', reps: '13', secs: '', rir: '2' }] },
    },
    '2026-08-05': {                       // bloque B: NO se debe tocar
      sessionId: 'B-1', notes: '',
      entries: { laterales: [{ kg: '8', reps: '15', secs: '', rir: '3' }] },
    },
  },
};

await page.addInitScript((data) => {
  localStorage.setItem('gym.log.v1', JSON.stringify(data));
}, ANTIGUO);

await page.goto('http://localhost:8125/index.html');
await page.waitForFunction(() => document.querySelectorAll('.ex').length > 0);

const tras = await page.evaluate(() => JSON.parse(localStorage.getItem('gym.log.v1')));

check('El registro se marca con la versión nueva', tras.v === 2, `v=${tras.v}`);
check('Lunes: laterales -> laterales-de-pie',
  !!tras.days['2026-07-20'].entries['laterales-de-pie']
  && !tras.days['2026-07-20'].entries.laterales,
  Object.keys(tras.days['2026-07-20'].entries).join(', '));
check('Lunes: se conservan los datos (10 kg x15 @2)',
  tras.days['2026-07-20'].entries['laterales-de-pie'][0].kg === '10');
check('Lunes: medio posterior -> banco inclinado posterior',
  !!tras.days['2026-07-20'].entries['laterales-banco-inclinado-posterior']);
check('Miércoles: laterales -> laterales-sentado-inclinado',
  !!tras.days['2026-07-22'].entries['laterales-sentado-inclinado'],
  Object.keys(tras.days['2026-07-22'].entries).join(', '));
check('Bloque B: sus laterales quedan intactas',
  !!tras.days['2026-08-05'].entries.laterales,
  Object.keys(tras.days['2026-08-05'].entries).join(', '));

// Y lo importante: que se vea en pantalla.
const visible = await page.locator('main .ex', { hasText: 'Laterales de pie' }).first()
  .locator('.pres').textContent();
check('El lunes muestra la serie ya registrada', visible === '1/2', visible);

// Volver a arrancar no debe duplicar nada (migración idempotente).
await page.reload();
await page.waitForFunction(() => document.querySelectorAll('.ex').length > 0);
const otra = await page.evaluate(() => JSON.parse(localStorage.getItem('gym.log.v1')));
check('Reabrir no duplica series',
  otra.days['2026-07-20'].entries['laterales-de-pie'].length === 1,
  `${otra.days['2026-07-20'].entries['laterales-de-pie'].length} series`);

await browser.close();
server.close();
const fallos = results.filter((r) => !r).length;
console.log(`\n${results.length - fallos}/${results.length} comprobaciones OK`);
process.exit(fallos ? 1 : 0);
