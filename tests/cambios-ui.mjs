/* Cambios desde Hoy en iPhone 13 emulado: mover el sábado 14/11 al domingo 15/11, añadir un
   ejercicio del plan y uno nuevo, apuntar series, deshacer, y comprobar la exportación (hoja
   Registro y Seguimiento rodilla) y Progreso. Capturas en tools/out/cambios-*.png.
       node tests/cambios-ui.mjs                                                       */
import { chromium, devices } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const out = path.join(root, 'tools', 'out');
fs.mkdirSync(out, { recursive: true });
const fflate = new Function(`${fs.readFileSync(path.join(root, 'vendor/fflate.js'), 'utf8')};return fflate;`)();

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png' };
const server = http.createServer((req, res) => {
  let f = decodeURIComponent(req.url.split('?')[0]);
  if (f === '/') f = '/index.html';
  const full = path.join(root, f);
  if (!full.startsWith(root) || !fs.existsSync(full) || fs.statSync(full).isDirectory()) { res.writeHead(404).end('no'); return; }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(full)] || 'application/octet-stream' });
  res.end(fs.readFileSync(full));
});
const PORT = 8137;
await new Promise((r) => server.listen(PORT, r));

let fallos = 0;
let total = 0;
const check = (nombre, ok, detalle = '') => {
  total++;
  if (!ok) fallos++;
  if (!ok || process.env.VERBOSE) console.log(`${ok ? '  OK  ' : ' FALLO'} ${nombre}${detalle ? ` — ${detalle}` : ''}`);
};

const browser = await chromium.launch();
const ctx = await browser.newContext({ ...devices['iPhone 13'], locale: 'es-ES', serviceWorkers: 'block', acceptDownloads: true });
const page = await ctx.newPage();
const errores = [];
page.on('pageerror', (e) => errores.push(`pageerror: ${e}`));
page.on('console', (m) => { if (m.type() === 'error') errores.push(`console.error: ${m.text()}`); });
page.on('dialog', (d) => d.accept());
await page.clock.setFixedTime(new Date('2026-11-14T10:00:00'));   // sábado de S4
// Chromium tiene showSaveFilePicker y en headless el diálogo no se cierra: como en el iPhone, descarga.
await page.addInitScript(() => { delete window.showSaveFilePicker; });
await page.goto(`http://localhost:${PORT}/index.html`);
await page.waitForSelector('#hero-name');

const reg = () => page.evaluate(() => JSON.parse(localStorage.getItem('gym.log.v1')));
const nombres = () => page.$$eval('main .ex .nm', (l) => l.map((e) => e.textContent.trim()));
const hero = () => page.textContent('#hero-name');
const ancho = () => page.evaluate(() => document.documentElement.scrollWidth);
const irA = async (fecha) => { await page.fill('#datepick', fecha); await page.dispatchEvent('#datepick', 'change'); await page.waitForTimeout(80); };

/* --- Mover el sábado al domingo --- */
const sabado = await nombres();
check('El sábado 14/11 tiene su torso y el botón de mover', sabado.length > 0
  && await page.locator('.cambios .btn', { hasText: 'Mover este entreno' }).count() === 1, sabado.join(', '));
await page.locator('.cambios .btn', { hasText: 'Mover este entreno' }).click();
await page.waitForSelector('#sheet:not([hidden]) [data-mover]');
check('La hoja de mover ofrece los otros 6 días de la semana', await page.locator('[data-mover]').count() === 6);
await page.screenshot({ path: path.join(out, 'cambios-mover.png') });
await page.click('[data-mover="D"]');
await page.waitForTimeout(80);
check('El sábado queda libre, con «Deshacer»', (await hero()).startsWith('Libre (movido al domingo)')
  && await page.locator('.cambios .btn', { hasText: 'Deshacer el cambio' }).count() === 1, await hero());
check('Guardado por semana', JSON.stringify((await reg()).movidos) === '{"S4":{"S":"D"}}', JSON.stringify((await reg()).movidos));

await irA('2026-11-15');
const domingo = await nombres();
check('El domingo 15/11 lleva su carrera y todo el torso del sábado', sabado.every((n) => domingo.includes(n))
  && domingo.length > sabado.length && (await hero()) === 'Carrera + lo del sábado', `${await hero()} · ${domingo.join(', ')}`);
check('El domingo no ofrece moverse (ya recibe) y sí devolver lo del sábado',
  await page.locator('.cambios .btn', { hasText: 'Mover este entreno' }).count() === 0
  && await page.locator('.cambios .btn', { hasText: 'Devolver lo del sábado' }).count() === 1);

/* --- Añadir un ejercicio del plan y uno nuevo --- */
await page.locator('.cambios .btn', { hasText: 'Añadir ejercicio' }).click();
await page.waitForSelector('#an-ej');
const opcion = await page.$$eval('#an-ej option', (l) => l.map((o) => [o.value, o.textContent]).find(([v, t]) => /press inclinado/i.test(t)));
await page.selectOption('#an-ej', opcion[0]);
check('Al elegir un ejercicio del plan se rellenan series, reps y RIR del plan',
  (await page.inputValue('#an-series')) !== '' && !(await page.isHidden('#an-pres')));
await page.fill('#an-series', '3');
await page.fill('#an-reps', '8-10');
await page.fill('#an-rir', '1');
await page.screenshot({ path: path.join(out, 'cambios-anadir.png') });
await page.click('#an-ok');
await page.waitForTimeout(80);
const conPress = await nombres();
check('El ejercicio añadido sale al final, marcado', conPress[conPress.length - 1] === opcion[1]
  && (await page.locator('main .ex').last().textContent()).includes('Añadido'), conPress.join(', '));

await page.locator('.cambios .btn', { hasText: 'Añadir ejercicio' }).click();
await page.selectOption('#an-ej', '__nuevo');
await page.fill('#an-nombre', 'Curl araña');
await page.selectOption('#an-grupo', 'Bíceps');
await page.fill('#an-series', '2');
await page.fill('#an-reps', '12');
await page.fill('#an-rir', '1/0');
await page.click('#an-ok');
await page.waitForTimeout(80);
check('El ejercicio nuevo sale y queda guardado con su grupo', (await nombres()).includes('Curl araña')
  && JSON.stringify((await reg()).extras) === '{"extra-curl-arana":{"name":"Curl araña","target":"Bíceps"}}', JSON.stringify((await reg()).extras));

/* --- Apuntar series: el curl araña lleva columna RIR y 1RM --- */
await page.locator('main .ex', { hasText: 'Curl araña' }).click();
await page.waitForSelector('.set-row:not(.head)');
check('El nuevo precarga 2 series con RIR 1 y 0 y columna 1RM', await page.locator('.set-row:not(.head)').count() === 2
  && await page.locator('.set-row.head', { hasText: '1RM' }).count() === 1
  && (await page.getAttribute('.set-row:not(.head) >> nth=1 >> [data-f="rir"]', 'placeholder')) === '0');
const fila = (i) => page.locator('.set-row:not(.head)').nth(i);
await fila(0).locator('[data-f="kg"]').fill('12');
await fila(0).locator('[data-f="reps"]').fill('12');
await fila(0).locator('[data-f="rir"]').fill('1');
await fila(1).locator('[data-f="kg"]').fill('12');
await fila(1).locator('[data-f="reps"]').fill('11');
await fila(1).locator('[data-f="rir"]').fill('0');
check('El 1RM se calcula en vivo', (await fila(0).locator('.e1rm').textContent()).startsWith('~'));
await page.screenshot({ path: path.join(out, 'cambios-serie.png') });
await page.locator('.btn', { hasText: 'Hecho' }).click();
await page.waitForTimeout(60);

await page.locator('main .ex', { hasText: opcion[1] }).click();
await page.waitForSelector('.set-row:not(.head)');
await fila(0).locator('[data-f="kg"]').fill('60');
await fila(0).locator('[data-f="reps"]').fill('9');
await fila(0).locator('[data-f="rir"]').fill('1');
await page.locator('.btn', { hasText: 'Hecho' }).click();
await page.waitForTimeout(60);
check('Ancho de iPhone sin desbordar en Hoy', await ancho() === 390, String(await ancho()));
await page.screenshot({ path: path.join(out, 'cambios-domingo.png'), fullPage: true });

/* --- Exportar --- */
await page.click('[data-tab="data"]');
await page.waitForSelector('.btn');
const [download] = await Promise.all([
  page.waitForEvent('download'),
  page.locator('.btn', { hasText: 'Exportar .xlsx' }).click(),
]);
const saved = path.join(out, 'cambios.xlsx');
await download.saveAs(saved);
const zip = fflate.unzipSync(new Uint8Array(fs.readFileSync(saved)));
const xml = (n) => new TextDecoder().decode(zip[`xl/worksheets/sheet${n}.xml`] || new Uint8Array());
const registro = xml(6);
check('Registro: las series del domingo con lo añadido, su prescripción y la marca',
  registro.includes('2026-11-15') && registro.includes('Curl araña') && registro.includes('Bíceps')
  && registro.includes('2 x12 @ RIR1/0') && registro.includes('3 x8-10 @ RIR1') && registro.includes('Añadido en la app')
  && registro.includes('Carrera + lo del sábado'));
check('Seguimiento rodilla: el sábado libre y el domingo con lo del sábado',
  xml(5).includes('Libre (movido al domingo)') && xml(5).includes('(del sábado)'));

/* --- Progreso: el nuevo con su 1RM y su volumen --- */
await page.click('[data-tab="progress"]');
await page.waitForSelector('.pg');
const opciones1RM = await page.$$eval('.pg select option', (l) => l.map((o) => o.textContent));
check('Progreso › 1RM ofrece el ejercicio nuevo', opciones1RM.some((t) => t.includes('Curl araña')), opciones1RM.slice(0, 5).join(', '));
const vol = await page.evaluate(() => {
  const cat = ProgresoCalc.catalogo([...Object.values(PLAN.BLOCK_VOL), { exercises: [{ id: 'extra-curl-arana', name: 'Curl araña', target: 'Bíceps', pres: [{ kind: 'rir' }] }] }], PLAN.VOL_GRUPOS);
  const v = ProgresoCalc.volumenSemanal(Store.all(), cat, PLAN.VOL_GRUPOS);
  return v.porGrupo['Bíceps'].series[v.semanas.indexOf('2026-11-09')];
});
check('Volumen de la semana del 9/11: el curl araña suma 2 series de bíceps', vol === 2, String(vol));

/* --- Plan y Rodilla con el día movido --- */
await page.click('[data-tab="plan"]');
await page.waitForSelector('main .card h2');
const plan = await page.textContent('main');
check('Plan (S4) muestra el sábado libre y el domingo con lo del sábado', plan.includes('Libre (movido al domingo)') && plan.includes('Carrera + lo del sábado'));
await page.click('[data-tab="knee"]');
await page.waitForTimeout(150);
check('La pestaña Rodilla se abre con el día movido', (await page.textContent('main')).length > 100);
check('Ancho de iPhone sin desbordar en Plan y Rodilla', await ancho() === 390, String(await ancho()));

/* --- Quitar y deshacer --- */
await page.click('[data-tab="today"]');
await page.waitForSelector('#hero-name');
await page.locator('main .ex', { hasText: 'Curl araña' }).click();
await page.locator('.btn', { hasText: 'Quitar de este día' }).click();
await page.waitForTimeout(80);
check('Quitar borra el añadido y sus series', !(await nombres()).includes('Curl araña')
  && !((await reg()).days['2026-11-15'].entries['extra-curl-arana']));
await page.locator('.cambios .btn', { hasText: 'Devolver lo del sábado' }).click();
await page.waitForTimeout(80);
const domingo2 = await nombres();
check('Devolver lo del sábado: el domingo vuelve a su carrera (y conserva lo añadido)', !sabado.every((n) => domingo2.includes(n))
  && domingo2.includes(opcion[1]) && !(await reg()).movidos, domingo2.join(', '));

check('Sin errores de JavaScript', errores.length === 0, errores.join(' | '));

await browser.close();
server.close();
console.log(fallos ? `\n${fallos} fallo(s) de ${total}` : `OK: ${total} comprobaciones`);
process.exit(fallos ? 1 : 0);
