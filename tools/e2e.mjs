/* Prueba de punta a punta en un iPhone emulado: recorre la app como lo harías
   en el gimnasio y comprueba que el .xlsx descargado contiene lo registrado.
       node tools/e2e.mjs */

import { chromium, devices } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const outDir = path.join(root, 'tools', 'out');
fs.mkdirSync(outDir, { recursive: true });

const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.png': 'image/png', '.xlsx': 'application/octet-stream',
};

const server = http.createServer((req, res) => {
  let file = decodeURIComponent(req.url.split('?')[0]);
  if (file === '/') file = '/index.html';
  const full = path.join(root, file);
  if (!full.startsWith(root) || !fs.existsSync(full) || fs.statSync(full).isDirectory()) {
    res.writeHead(404).end('no');
    return;
  }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(full)] || 'application/octet-stream' });
  res.end(fs.readFileSync(full));
});

const PORT = 8123;
await new Promise((r) => server.listen(PORT, r));

const results = [];
const check = (name, pass, detail = '') => {
  results.push({ name, pass, detail });
  console.log(`${pass ? '  OK  ' : ' FALLO'} ${name}${detail ? ` — ${detail}` : ''}`);
};

const browser = await chromium.launch();
const ctx = await browser.newContext({
  ...devices['iPhone 13'],
  locale: 'es-ES',
  acceptDownloads: true,
});
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

// Chromium sí implementa showSaveFilePicker y en headless el diálogo se queda
// colgado. Safari en iPhone no la tiene, así que emulamos el objetivo real y
// forzamos la rama de descarga.
await page.addInitScript(() => { delete window.showSaveFilePicker; });

// El plan empieza el 20 jul 2026 (lunes): desplazamos el reloj para caer en
// Semana 1, pero dejando que el tiempo AVANCE — si lo congelásemos en un
// instante fijo el cronómetro nunca contaría y no podríamos probarlo.
await page.addInitScript(() => {
  const RealDate = Date;
  const fixed = new RealDate('2026-07-20T10:00:00').getTime();
  const origin = RealDate.now();
  const shifted = () => fixed + (RealDate.now() - origin);
  // eslint-disable-next-line no-global-assign
  Date = class extends RealDate {
    constructor(...args) { return args.length ? new RealDate(...args) : new RealDate(shifted()); }
    static now() { return shifted(); }
    static parse(...args) { return RealDate.parse(...args); }
    static UTC(...args) { return RealDate.UTC(...args); }
  };
});

await page.goto(`http://localhost:${PORT}/index.html`);
await page.waitForFunction(() => document.querySelectorAll('.ex').length > 0, { timeout: 5000 });

/* --- Hoy: sesión correcta para el 20 jul (lunes, Semana 1) --- */
check('Título de la sesión del lunes',
  (await page.textContent('#hero-name')) === 'Rehab + Isquios + Hombro',
  await page.textContent('#hero-name'));
check('Semana 1 detectada',
  (await page.textContent('.hero .week')).includes('Semana 1'));
check('8 ejercicios el lunes',
  (await page.locator('main .ex').count()) === 8,
  `${await page.locator('main .ex').count()} filas`);
check('Prescripción Semana 1 en Laterales de pie (2 @ RIR2)',
  (await page.locator('main .ex', { hasText: 'Laterales de pie' }).first().locator('.pres').textContent()) === '2 @ RIR2');
check('Ejercicios renombrados del lunes',
  (await page.textContent('main')).includes('Laterales de pie')
  && (await page.textContent('main')).includes('Laterales banco inclinado posterior'));

/* --- Registrar series en un ejercicio con RIR --- */
await page.locator('main .ex', { hasText: 'Laterales de pie' }).first().click();
await page.waitForSelector('.set-row input');
check('Se pintan las 2 series prescritas',
  (await page.locator('.set-row:not(.head)').count()) === 2);
check('Columnas Kg/Reps/RIR para prescripción por RIR',
  (await page.locator('.set-row.head span').allTextContents()).join(',') === ',Kg,Reps,RIR,');

const inputs = page.locator('.set-row:not(.head) input');
await inputs.nth(0).fill('12');
await inputs.nth(1).fill('14');
await inputs.nth(2).fill('2');
await inputs.nth(3).fill('12');
await inputs.nth(4).fill('11');
await inputs.nth(5).fill('2');

// Coma decimal: en el teclado del iPhone sale coma, debe guardarse como punto.
await page.locator('.btn.ghost', { hasText: 'Añadir serie' }).click();
await page.waitForFunction(() => document.querySelectorAll('.set-row:not(.head)').length === 3);
const third = page.locator('.set-row:not(.head)').nth(2).locator('input');
check('La serie añadida hereda la carga anterior',
  (await third.nth(0).inputValue()) === '12', `valor "${await third.nth(0).inputValue()}"`);
await third.nth(0).fill('12,5');
await third.nth(1).fill('9');
await third.nth(2).fill('1');

await page.locator('.btn', { hasText: 'Hecho' }).click();
await page.waitForSelector('main .ex');
check('Contador 3/2 tras registrar',
  (await page.locator('main .ex', { hasText: 'Laterales de pie' }).first().locator('.pres').textContent()) === '3/2');

/* --- Cronómetro: control manual, global y persistente --- */
await page.locator('main .ex', { hasText: 'Laterales de pie' }).first().click();
await page.waitForSelector('#sw-clock');
check('El cronómetro arranca a cero y parado',
  (await page.textContent('#sw-clock')) === '00:00'
  && (await page.textContent('#sw-toggle')) === 'Iniciar');

await page.click('#sw-toggle');
await page.waitForTimeout(1400);
const corriendo = await page.textContent('#sw-clock');
check('Cuenta hacia arriba al iniciarlo', /^00:0[1-9]$/.test(corriendo), corriendo);
check('El botón pasa a Pausar', (await page.textContent('#sw-toggle')) === 'Pausar');

await page.locator('.btn', { hasText: 'Hecho' }).click();
await page.waitForSelector('main .ex');
check('Sigue contando fuera del ejercicio, avisando en la barra',
  !(await page.locator('#chip-timer').isHidden()));

await page.locator('main .ex', { hasText: 'Laterales de pie' }).first().click();
await page.waitForSelector('#sw-clock');
check('Al volver al ejercicio sigue en marcha',
  (await page.textContent('#sw-toggle')) === 'Pausar');
check('El chip desaparece cuando se ve el reloj grande',
  await page.locator('#chip-timer').isHidden());

await page.click('#sw-toggle');
const pausado = await page.textContent('#sw-clock');
await page.waitForTimeout(900);
check('Al pausar se queda quieto',
  (await page.textContent('#sw-clock')) === pausado
  && (await page.textContent('#sw-toggle')) === 'Seguir', pausado);

await page.click('#sw-reset');
check('"A cero" lo devuelve a 00:00',
  (await page.textContent('#sw-clock')) === '00:00');
await page.locator('.btn', { hasText: 'Hecho' }).click();

/* --- Ejercicio isométrico: columnas Kg/Seg y volcado del cronómetro --- */
await page.locator('main .ex', { hasText: 'Unilateral Bridge iso' }).click();
await page.waitForSelector('.set-row input');
check('Columnas Kg/Seg para prescripción isométrica',
  (await page.locator('.set-row.head span').allTextContents()).join(',') === ',Kg,Seg,');

check('En isométricos aparece el botón para volcar el tiempo',
  (await page.locator('.stamp').count()) === 1,
  await page.locator('.stamp').textContent());
await page.click('#sw-toggle');
await page.waitForTimeout(2200);
await page.click('.stamp');
await page.waitForTimeout(200);
const anotado = await page.locator('.set-row:not(.head) input').nth(1).inputValue();
check('El tiempo se anota en la serie', /^[12]$/.test(anotado), `${anotado} s`);
check('Tras anotar, el cronómetro vuelve a cero y parado',
  (await page.textContent('#sw-clock')) === '00:00'
  && (await page.textContent('#sw-toggle')) === 'Iniciar');

const isoIn = page.locator('.set-row:not(.head) input');
await isoIn.nth(1).fill('20');
await isoIn.nth(3).fill('22');
await page.locator('.btn', { hasText: 'Hecho' }).click();

/* --- Notas del día --- */
await page.fill('#daynotes', 'rodilla 2/10, dormí 7h');

/* --- Persistencia tras recargar --- */
await page.reload();
await page.waitForFunction(() => document.querySelectorAll('.ex').length > 0);
check('El registro sobrevive a recargar',
  (await page.locator('main .ex', { hasText: 'Laterales de pie' }).first().locator('.pres').textContent()) === '3/2');
check('Las notas del día sobreviven',
  (await page.inputValue('#daynotes')) === 'rodilla 2/10, dormí 7h');

/* --- Pestaña Plan --- */
await page.click('[data-tab="plan"]');
await page.waitForSelector('main .ex');
check('El plan lista los ejercicios de la Semana 1',
  (await page.locator('main .ex').count()) > 30,
  `${await page.locator('main .ex').count()} filas`);
await page.locator('.card .btn', { hasText: 'S2' }).click();
check('Semana 2 muestra la prescripción a RIR1',
  (await page.locator('main .ex', { hasText: 'Press inclinado manc' }).first().locator('.pres').textContent()) === '4 @ RIR1');
await page.locator('.card .btn', { hasText: 'S3' }).click();
// Comparamos el nombre exacto: hasText mira todo el texto de la fila
// (nombre + objetivo + prescripción), así que "Laterales" casaría de más.
const nombresB = await page.locator('main .ex .nm').allTextContents();
check('Bloque B conserva sus "Laterales" genéricos',
  nombresB.includes('Laterales'),
  nombresB.filter((n) => n.startsWith('Laterales')).join(', '));
await page.locator('.card .btn', { hasText: 'S1' }).click();
check('Miércoles y viernes renombrados',
  (await page.textContent('main')).includes('Laterales sentado inclinado')
  && (await page.textContent('main')).includes('Laterales inclinado estiramiento'));
await page.locator('.card .btn', { hasText: 'S3' }).click();
check('Semana 3 muestra los 3 días del bloque B',
  (await page.textContent('main')).includes('Día 3'));

/* --- Exportar y comprobar el .xlsx --- */
await page.click('[data-tab="data"]');
await page.waitForSelector('.btn');
const [download] = await Promise.all([
  page.waitForEvent('download'),
  page.locator('.btn', { hasText: 'Exportar .xlsx' }).click(),
]);
const saved = path.join(outDir, 'e2e.xlsx');
await download.saveAs(saved);
check('El fichero descargado conserva el nombre original',
  download.suggestedFilename() === 'Plan_4semanas_20jul-16ago.xlsx',
  download.suggestedFilename());
check('El .xlsx descargado no está vacío', fs.statSync(saved).size > 10000,
  `${fs.statSync(saved).size} bytes`);

check('Sin errores de JavaScript', errors.length === 0, errors.join(' | '));

await browser.close();
server.close();

const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} comprobaciones OK`);
process.exit(failed.length ? 1 : 0);
