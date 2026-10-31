/* Progresión real, entrada a la carrera y test de fuerza en la app (iPhone 13 emulado),
   con el reloj fijado y un S2 registrado. Recoge los errores de consola.
       node tests/progresion-ui.mjs                                              */
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
  if (!full.startsWith(root) || !fs.existsSync(full) || fs.statSync(full).isDirectory()) { res.writeHead(404).end('no'); return; }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(full)] || 'application/octet-stream' });
  res.end(fs.readFileSync(full));
});
const PORT = 8133;
await new Promise((r) => server.listen(PORT, r));

let fallos = 0;
let total = 0;
const check = (nombre, ok, detalle = '') => {
  total++;
  if (!ok) fallos++;
  console.log(`${ok ? '  OK  ' : ' FALLO'} ${nombre}${detalle && !ok ? ` — ${detalle}` : ''}`);
};

// S2 «de libro»: el lunes sin medir, mañanas a 2, carrera N1 el miércoles y el domingo.
const S2 = {
  '2026-10-27': { decline: 2, steps: 2 },
  '2026-10-28': { decline: 2, during: 1, back60: 'Sí' },
  '2026-10-29': { decline: 2, during: 2 },
  '2026-10-30': { decline: 2 }, '2026-10-31': { decline: 2 },
  '2026-11-01': { decline: 2, during: 1, back60: 'Sí' },
  '2026-11-02': { decline: 2 },
};
const REGISTRO = {
  v: 4, days: {},
  knee: { days: S2, weeks: {}, entry: {}, tests: {}, depth: {} },
};

const browser = await chromium.launch();
const ctx = await browser.newContext({ ...devices['iPhone 13'], locale: 'es-ES' });
const page = await ctx.newPage();
const errores = [];
page.on('pageerror', (e) => errores.push(`pageerror: ${e}`));
page.on('console', (m) => { if (m.type() === 'error') errores.push(`console.error: ${m.text()}`); });
await page.clock.setFixedTime(new Date('2026-10-28T08:00:00'));
await page.addInitScript((r) => localStorage.setItem('gym.log.v1', JSON.stringify(r)), REGISTRO);
await page.goto(`http://localhost:${PORT}/index.html`);
await page.waitForSelector('main .ex');

const presDe = (nombre) => page.locator('main .ex', { hasText: nombre }).first().locator('.pres').textContent();

// Miércoles de S2: criterios de entrada desde la tarjeta de Hoy, con casillas.
check('Hoy (mié 28/10): la carrera pide los criterios de entrada',
  (await presDe('Andar-correr')).startsWith('Criterios de entrada'), await presDe('Andar-correr'));
await page.click('[data-entrada]');
await page.waitForSelector('[data-entrada="S2"]');
const card = page.locator('[data-entrada="S2"]');
for (const f of ['walkPain', 'walkBack60', 'tdPain', 'hopsPain']) {
  await card.locator(`[data-f="${f}"] [data-seg="Sí"]`).click();
}
check('Entrada: la mañana del miércoles no peor (24 h) sale sola',
  (await card.locator('[data-e="manana"]').textContent()) === 'Sí');
check('Entrada: tres criterios -> SÍ: 1.ª carrera hoy (N1)',
  (await card.locator('[data-e="texto"]').textContent()) === 'SÍ: 1.ª carrera hoy (N1)');

// Hoy vuelve a pintar la carrera con N1.
await page.click('[data-tab="today"]');
await page.waitForSelector('main .ex');
check('Hoy (mié 28/10): con la entrada superada, N1', (await presDe('Andar-correr')).startsWith("N1 · 8×(1'/2')"), await presDe('Andar-correr'));

// Viernes de S3 (6/11): el test 1 (pasó de S2 a S3) es un enlace a Rodilla › Test.
await page.fill('#datepick', '2026-11-06');
await page.dispatchEvent('#datepick', 'change');
await page.waitForSelector('main .ex');
check('Hoy (vie 6/11): el test de fuerza es un enlace', (await presDe('TEST fuerza')) === 'Test ›');
await page.locator('main .ex', { hasText: 'TEST fuerza' }).click();
await page.waitForSelector('[data-test="t1"]');
check('El enlace abre Rodilla › Test', (await page.textContent('#subtitle')) === 'Test de fuerza');

// Lunes de S3 (2/11, festivo, en casa): S2 estable, pero el calendario no sube escalón; la
// celda añade el sustituto del día. La touchdown, a la profundidad ya validada.
await page.click('[data-tab="today"]');
await page.fill('#datepick', '2026-11-02');
await page.dispatchEvent('#datepick', 'change');
await page.waitForSelector('main .ex');
check('Hoy (lun 2/11): prensa sin escalón y con el sustituto del festivo', (await presDe('Prensa unil')) === '2 x10/pierna\nescalón 0 · mantiene\n2/11: búlgara en casa, escalón 0, sin novedad', await presDe('Prensa unil'));
check('Hoy (lun 2/11): touchdown al escalón validado (0)', (await presDe('Touchdown')) === '2 x10-15/pierna\nescalón 0', await presDe('Touchdown'));
await page.locator('main .ex', { hasText: 'Prensa unil' }).click();
await page.waitForSelector('.set-row');
check('Detalle de la prensa: motivo y máximo del calendario', (await page.textContent('main')).includes('ya está en el máximo del calendario')
  && (await page.textContent('main')).includes('Máximo del calendario: 2 x10/pierna'));
check('Detalle de la prensa: 4 filas, D e I alternas', (await page.locator('.set-row:not(.head) .side').allTextContents()).join('') === 'DIDI');

// Rodilla › Progresión: propuesta y nivel real.
await page.click('#back');
await page.click('[data-tab="knee"]');
await page.click('[data-sec-btn="progresion"]');
await page.waitForSelector('.rod-prog');
const s3 = page.locator('.rod-prog', { hasText: 'S3' });
check('Progresión S3: propuesta de la prensa x10 · escalón 0', (await s3.textContent()).includes('x10 · escalón 0'));
await s3.locator('select[data-f="pressLevel"]').selectOption('0');
await page.waitForSelector('.rod-prog');
const real = await page.evaluate(() => Store.knee().weeks.S3);
check('Progresión: el nivel real se guarda', real && real.pressLevel === 0, JSON.stringify(real));
await page.click('[data-tab="today"]');
await page.waitForSelector('main .ex');
check('Hoy usa el nivel real apuntado (x12, retrocede)', (await presDe('Prensa unil')) === '2 x12\nescalón 0 · retrocede un nivel\n2/11: búlgara en casa, escalón 0, sin novedad', await presDe('Prensa unil'));
check('Sin scroll horizontal', await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));

// Bici quitada: S3 y S4 en verde, la bici entra el viernes 13/11 y el domingo 15/11 la mañana
// siguiente sale peor sin otra novedad sin validar -> se quita la bici desde el lunes 16/11.
const verde = (lunes, m) => Object.fromEntries(m.map((v, i) => {
  const d = new Date(`${lunes}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + i);
  const dia = 'LMXJVSD'[i];
  const x = { decline: v };
  if (dia === 'L' || dia === 'J') x.during = 2;
  if (dia === 'X' || dia === 'D') Object.assign(x, { during: 1, back60: 'Sí' });
  return [d.toISOString().slice(0, 10), x];
}));
const BICI = {
  v: 4, days: {},
  knee: {
    days: { ...S2, ...verde('2026-11-02', [2, 2, 2, 2, 2, 2, 2]), ...verde('2026-11-09', [2, 2, 2, 2, 2, 2, 3]), ...verde('2026-11-16', [4, 3]) },
    weeks: {}, entry: { S2: { walkPain: 'Sí', walkBack60: 'Sí', tdPain: 'Sí', hopsPain: 'Sí' } }, tests: {}, depth: {},
  },
};
const page2 = await (await browser.newContext({ ...devices['iPhone 13'], locale: 'es-ES' })).newPage();
page2.on('pageerror', (e) => errores.push(`pageerror: ${e}`));
page2.on('console', (m) => { if (m.type() === 'error') errores.push(`console.error: ${m.text()}`); });
await page2.clock.setFixedTime(new Date('2026-11-17T08:00:00'));
await page2.addInitScript((r) => localStorage.setItem('gym.log.v1', JSON.stringify(r)), BICI);
await page2.goto(`http://localhost:${PORT}/index.html`);
await page2.waitForSelector('main .ex');
const bici = await page2.locator('main .ex', { hasText: 'Bici' }).first().locator('.pres').textContent();
check('Hoy (mar 17/11): la bici sale quitada', bici === 'Sin bici\n(quitada)', bici);
check('Hoy (mar 17/11): aviso de la bici en la tarjeta de rodilla', (await page2.textContent('.rod-hoy')).includes('Sin bici: fallo atribuido a la bici'));

check('Sin errores de consola ni pageerror', errores.length === 0, errores.join(' || '));
await browser.close();
server.close();
console.log(`\n${total - fallos}/${total} comprobaciones OK`);
process.exit(fallos ? 1 : 0);
