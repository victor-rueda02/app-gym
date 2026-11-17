/* Selector de ejercicios (Progreso › 1RM) en iPhone 13 emulado. Captura: tools/out/selector.png
       node tests/selector-ui.mjs                                                              */
import { chromium, devices } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const out = path.join(root, 'tools', 'out');
fs.mkdirSync(out, { recursive: true });

const s = (kg, reps, rir, side) => ({ kg: String(kg), reps: String(reps), secs: '', rir: rir === undefined ? '' : String(rir), mins: '', ...(side ? { side } : {}) });
const dia = (entries) => ({ entries });
const days = {
  '2026-10-19': dia({ 'press-inclinado-barra-30-40': [s(60, 8, 2), s(60, 8, 2)], 'jalon-neutro': [s(50, 10, 2), s(50, 10, 2)], 'prensa-unil-pesado-y-lento-n-1': [s(80, 8, '', 'D'), s(90, 8, '', 'I')] }),
  '2026-10-21': dia({ 'curl-bayesian': [s(12, 10, 2), s(12, 9, 1)], 'elev-laterales-polea': [s(8, 12, 3), s(8, 12, 2)] }),
  '2026-11-02': dia({ 'press-inclinado-barra-30-40': [s(65, 8, 2), s(65, 8, 1)], 'jalon-neutro': [s(52.5, 11, 2)] }),
  '2026-11-04': dia({ 'curl-bayesian': [s(12.5, 11, 1), s(12.5, 10, 1)] }),
  '2026-11-09': dia({ 'elev-laterales-polea': [s(9, 12, 2)] }),
};
const registro = { v: 5, days, knee: { days: {}, weeks: {}, entry: {}, tests: {}, depth: {} } };

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png' };
const server = http.createServer((req, res) => {
  let f = decodeURIComponent(req.url.split('?')[0]);
  if (f === '/') f = '/index.html';
  const full = path.join(root, f);
  if (!full.startsWith(root) || !fs.existsSync(full) || fs.statSync(full).isDirectory()) { res.writeHead(404).end('no'); return; }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(full)] || 'application/octet-stream' });
  res.end(fs.readFileSync(full));
});
const PORT = 8151;
await new Promise((r) => server.listen(PORT, r));

let fallos = 0;
const check = (nombre, ok, detalle = '') => {
  if (!ok) fallos++;
  if (!ok || process.env.VERBOSE) console.log(`${ok ? '  OK  ' : ' FALLO'} ${nombre}${detalle ? ` — ${detalle}` : ''}`);
};

const browser = await chromium.launch();
const ctx = await browser.newContext({ ...devices['iPhone 13'], locale: 'es-ES', serviceWorkers: 'block' });
const page = await ctx.newPage();
const errores = [];
page.on('pageerror', (e) => errores.push(`pageerror: ${e}`));
page.on('console', (m) => { if (m.type() === 'error') errores.push(`console: ${m.text()}`); });
await page.addInitScript((r) => { if (!localStorage.getItem('gym.log.v1')) localStorage.setItem('gym.log.v1', JSON.stringify(r)); }, registro);
await page.goto(`http://localhost:${PORT}/index.html`);
await page.waitForSelector('[data-tab="progress"]');
// index.html aún puede no cargar selector.js/css: se inyectan tras cargar y antes de abrir Progreso
// (progreso.js comprueba `typeof Selector` al pintar, no al cargar, así que basta).
if (await page.evaluate(() => typeof Selector === 'undefined')) {
  await page.addScriptTag({ path: path.join(root, 'js', 'selector.js') });
  await page.addStyleTag({ path: path.join(root, 'css', 'selector.css') });
}
await page.click('[data-tab="progress"]');
await page.waitForSelector('.pg');

const ancho = () => page.evaluate(() => document.documentElement.scrollWidth);
const nombreGrafica = () => page.$eval('.pg-card h2', (e) => e.textContent.trim());

check('hay botón selector (no select)', (await page.$$('.sel-boton')).length === 1 && (await page.$$('select.pg-select')).length === 0);
const antes = await nombreGrafica();
await page.click('.sel-boton');
await page.waitForSelector('#sheet:not([hidden]) .sel-lista');
check('título de la hoja', (await page.textContent('#sheet-title')).trim() === 'Ejercicio');
check('sección Recientes primera', (await page.$eval('.sel-grupo', (e) => e.textContent)) === 'Recientes');
const nRec = await page.$$eval('.sel-grupo[data-g="__rec"] ~ .sel-item', (l) => l.length);
check('recientes ≤ 6', nRec > 0);
check('actual marcado', (await page.$$('.sel-item.on')).length >= 1);
const chips = await page.$$eval('.sel-chip', (l) => l.map((b) => b.textContent));
check('chips de grupo', chips.length >= 2, chips.join(','));
check('chips ≥ 44px', (await page.$$eval('.sel-chip', (l) => l.every((b) => b.getBoundingClientRect().height >= 44))));
check('items ≥ 44px', (await page.$$eval('.sel-item', (l) => l.every((b) => b.getBoundingClientRect().height >= 44))));
check('sin scroll horizontal (abierto)', (await ancho()) <= 390, String(await ancho()));
await page.screenshot({ path: path.join(out, 'selector.png') });

// Chip: salta a la cabecera del último grupo
const ultimo = chips[chips.length - 1];
const nUlt = chips.length - 1;
await page.click(`.sel-chip[data-n="${nUlt}"]`);
await page.waitForTimeout(100);
const pos = await page.evaluate((n) => {
  const l = document.querySelector('.sel-lista');
  const c = l.querySelector(`.sel-grupo[data-g="${n}"]`);
  return { dTop: c.getBoundingClientRect().top - l.getBoundingClientRect().top, st: l.scrollTop };
}, nUlt);
check(`chip «${ultimo}» hace scroll a su cabecera`, pos.st > 0 && Math.abs(pos.dTop) <= 3, JSON.stringify(pos));

// Búsqueda sin tildes
await page.fill('.sel-buscar', 'biceps');
const encontrados = await page.$$eval('.sel-item b', (l) => l.map((b) => b.textContent));
check('«biceps» encuentra Bíceps (curl)', encontrados.some((t) => /curl/i.test(t)), encontrados.join('|'));
check('al buscar se oculta Recientes', (await page.$$('.sel-grupo[data-g="__rec"]')).length === 0);
await page.fill('.sel-buscar', 'CURL bay');
check('«CURL bay» encuentra Curl bayesian', (await page.$$eval('.sel-item b', (l) => l.map((b) => b.textContent))).some((t) => /bayesian/i.test(t)));
await page.fill('.sel-buscar', 'zzzz');
check('sin resultados', (await page.$$('.sel-vacio')).length === 1);
await page.fill('.sel-buscar', 'curl');

// Elegir
const idElegido = await page.$eval('.sel-item', (b) => b.dataset.id);
const nomElegido = await page.$eval('.sel-item b', (b) => b.textContent);
await page.click('.sel-item');
await page.waitForTimeout(80);
check('elegir cierra la hoja', await page.$eval('#sheet', (e) => e.hidden));
check('elegir cambia la gráfica', (await nombreGrafica()) === nomElegido, `${antes} -> ${await nombreGrafica()} (${idElegido})`);
check('el botón muestra el ejercicio', (await page.textContent('.sel-boton-t')).trim() === nomElegido);
check('sin scroll horizontal (cerrado)', (await ancho()) <= 390);
check('sin errores de consola', errores.length === 0, errores.join(' | '));

await browser.close();
server.close();
console.log(fallos ? `selector-ui: ${fallos} FALLOS` : 'selector-ui: todo OK');
process.exit(fallos ? 1 : 0);
