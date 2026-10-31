/* Prueba de punta a punta en un iPhone emulado: recorre la app como lo harías
   en el gimnasio y comprueba que el .xlsx descargado contiene lo registrado.
       node tools/e2e.mjs */

import { chromium, devices } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
// fflate es UMD y package.json es "type": "module", así que no vale require.
// eslint-disable-next-line no-new-func
const fflate = new Function(`${fs.readFileSync(path.join(root, 'vendor/fflate.js'), 'utf8')};return fflate;`)();
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

/* --- Plan de volumen (19 oct – 13 dic) desde el selector de fecha de Hoy --- */
async function goToDate(d) {
  await page.click('[data-tab="today"]');
  await page.fill('#datepick', d);
  await page.waitForFunction((v) => document.getElementById('datepick').value === v, d);
}
const reEsc = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const presOf = (name) => page.locator('main .ex', { has: page.locator('.nm', { hasText: new RegExp(`^${reEsc(name)}$`) }) })
  .locator('.pres').textContent();

await goToDate('2026-10-19');
check('19/10: sesión L de la semana 1',
  (await page.textContent('#hero-name')) === 'Rehab + Isquios + Hombro + Gemelo + Espalda (desde S3)'
  && (await page.textContent('.hero .week')) === 'Semana 1 · Volumen',
  `${await page.textContent('#hero-name')} / ${await page.textContent('.hero .week')}`);
check('19/10: 7 ejercicios', (await page.locator('main .ex').count()) === 7,
  `${await page.locator('main .ex').count()} filas`);
check('19/10: Elev laterales polea 2 @ RIR1/0', (await presOf('Elev laterales polea')) === '2 @ RIR1/0');
check('19/10: Elev laterales mancuerna 1 @ RIR0', (await presOf('Elev laterales mancuerna')) === '1 @ RIR0');

await page.locator('main .ex', { hasText: 'Elev laterales polea' }).click();
await page.waitForSelector('.set-row input');
const rirPh = await page.locator('.set-row:not(.head) input[data-f="rir"]')
  .evaluateAll((els) => els.map((e) => e.placeholder));
check('RIR1/0: objetivo 1 y 0 en la última serie', rirPh.join(',') === '1,0', rirPh.join(','));
const lat = page.locator('.set-row:not(.head) input');
await lat.nth(0).fill('9');
await lat.nth(1).fill('15');
await lat.nth(2).fill('1');
await page.locator('.btn', { hasText: 'Hecho' }).click();
await page.waitForSelector('main .ex');
check('19/10: contador 1/2 tras registrar', (await presOf('Elev laterales polea')) === '1/2');

await page.locator('main .ex', { hasText: 'Gemelos' }).click();
await page.waitForSelector('.set-row input');
const gemPh = await page.locator('.set-row:not(.head) input[data-f="rir"]')
  .evaluateAll((els) => els.map((e) => e.placeholder));
check('Gemelos 3 @ RIR1/0: objetivos 1,1,0', gemPh.join(',') === '1,1,0', gemPh.join(','));
await page.locator('.btn', { hasText: 'Hecho' }).click();

await page.locator('main .ex', { hasText: 'Prensa unil' }).click();
await page.waitForSelector('.set-row input');
check('Prensa unil semana 1: Kg/Reps con ×12 de referencia',
  (await page.locator('.set-row.head span').allTextContents()).join(',') === ',Kg,Reps,'
  && (await page.locator('.set-row:not(.head) input[data-f="reps"]').first().getAttribute('placeholder')) === '12');
await page.locator('.btn', { hasText: 'Hecho' }).click();

/* --- Cardio: un ejercicio más, con barra azul --- */
await goToDate('2026-10-20');
const cardioRow = page.locator('main .ex.cardio');
check('20/10 (martes): fila de cardio con barra azul al final',
  (await cardioRow.count()) === 1 && (await cardioRow.locator('.nm').textContent()).includes('Bici Z2')
  && (await page.locator('main .ex').last().getAttribute('class')).includes('cardio'),
  await cardioRow.locator('.nm').textContent());
check('La barra del cardio es azul y la de rehab verde',
  (await cardioRow.evaluate((e) => getComputedStyle(e).borderLeftColor)) === 'rgb(47, 111, 209)'
  && (await page.evaluate(() => {
    const d = document.createElement('div'); d.className = 'ex rehab'; document.body.appendChild(d);
    const c = getComputedStyle(d).borderLeftColor; d.remove(); return c;
  })) === 'rgb(47, 125, 91)');
check('Cardio semana 1: 15 min', (await cardioRow.locator('.pres').textContent()) === '15 min');
await cardioRow.click();
await page.waitForSelector('.set-row input');
check('Cardio: una sola fila con columna Min y sin añadir serie',
  (await page.locator('.set-row.head span').allTextContents()).join(',') === ',Min,'
  && (await page.locator('.set-row:not(.head)').count()) === 1
  && (await page.locator('.btn.ghost', { hasText: 'Añadir serie' }).count()) === 0);
check('Cardio: pautas visibles y valor prescrito de referencia',
  (await page.textContent('main')).includes('Sillín alto (rodilla a 20-25° abajo), 85-90 rpm')
  && (await page.locator('.set-row:not(.head) input').getAttribute('placeholder')) === '15');
await page.locator('.set-row:not(.head) input').fill('16');
await page.locator('.btn', { hasText: 'Hecho' }).click();
await page.waitForSelector('main .ex');
check('Cardio registrado cuenta como hecho (1/1)',
  (await cardioRow.locator('.pres').textContent()) === '1/1'
  && (await cardioRow.getAttribute('class')).includes('done'));
await goToDate('2026-11-20');
check('20/11 (viernes, semana 5): bici de 10 min en Z2 (sin Z3)',
  (await page.locator('main .ex.cardio .pres').textContent()) === "10' Z2");

await goToDate('2026-10-24');
check('24/10 (sábado): sesión del fin de semana de S1, con su nombre de entonces',
  (await page.textContent('#hero-name')) === 'Sábado/Domingo'
  && (await page.locator('main .ex').count()) === 5, await page.textContent('#hero-name'));
check('«T» en prono (correctivo) sin series en S1 (-)', (await presOf('Elevación lateral en prono «T» (mancuernas, banco)')) === '-');
await page.locator('main .ex', { hasText: 'Abs wesley banco' }).click();
await page.waitForSelector('.set-row input');
await page.locator('.set-row:not(.head) input').nth(1).fill('15');
await page.locator('.btn', { hasText: 'Hecho' }).click();
await goToDate('2026-10-25');
check('25/10 (domingo, S1): comparte la sesión del sábado',
  (await page.textContent('#hero-name')) === 'Sábado/Domingo'
  && (await page.textContent('.hero .week')) === 'Semana 1 · Volumen'
  && (await page.locator('main .ex').count()) === 5, await page.textContent('#hero-name'));

// Desde S3 la pierna 2 va el viernes (el jueves es el pull).
await goToDate('2026-12-11');
check('11/12: semana 8, viernes (pierna 2)',
  (await page.textContent('.hero .week')) === 'Semana 8 · Volumen'
  && (await page.textContent('#hero-name')) === 'Rehab + Isquios + Aductores  ·  test de fuerza S3 / S5 / S7 (+ opcional S8)  (desde S2; S1 se hizo el jueves; en S2, el viernes 30/10)',
  await page.textContent('#hero-name'));
const SQ8 = ['3 x8', 'repite S7'].join(String.fromCharCode(10));
const SENT = 'Sentadilla al cajón o desde pines · pesado y lento n.º 2';
check('11/12: sentadilla 3 x8 (repite S7)', (await presOf(SENT)) === SQ8);
check('11/12: Isquios sentado 5 @ RIR1/0', (await presOf('Isquios sentado')) === '5 @ RIR1/0');

await goToDate('2026-07-21');
check('21/07 sigue en el plan viejo (martes, semana 1)',
  (await page.textContent('#hero-name')) === 'Push'
  && (await presOf('Press inclinado manc')) === '3 @ RIR2');

for (const d of ['2026-10-17', '2026-12-14']) {
  await goToDate(d);
  check(`${d}: fuera de plan sin romperse`,
    (await page.textContent('main .empty')).includes('fuera de los planes')
    && (await page.textContent('.hero .week')) === 'Sin plan para esta fecha');
}

// Con la fecha en 14/12 ya no queda plan por delante: Plan abre el último.
await page.click('[data-tab="plan"]');
await page.waitForSelector('main .ex');
check('Plan abre el plan de volumen por defecto',
  (await page.textContent('#subtitle')) === 'Volumen 8 semanas · 19 oct – 13 dic',
  await page.textContent('#subtitle'));
check('Selector con las 8 semanas', (await page.locator('[data-week]').count()) === 8);
await page.click('[data-week="8"]');
check('Semana 8: título y fechas',
  (await page.textContent('main .card h2')) === 'Semana 8 · Volumen'
  && (await page.textContent('main')).includes('7–13 dic'));
check('Semana 8: sentadilla 3 x8 en el viernes', (await presOf(SENT)) === SQ8);
const etiquetas = await page.locator('main .section-label').allTextContents();
check('El plan nombra el sábado y el domingo de carrera (S8) como en el Excel',
  // Desde S2 el sábado es el torso en casa, con las filas de abdominales y correctivos detrás.
  etiquetas.includes('Sábado · casa, peso libre  ·  Torso (desde S2 = 31/10; S1 se hizo el viernes en el gimnasio)')
  && etiquetas.includes('Domingo · Carrera'), etiquetas.join(' | '));
check('El plan marca el cardio en azul (bici martes y viernes, carrera miércoles y domingo)',
  (await page.locator('main .ex.cardio').count()) === 4);
check('Notas de semanas 9–10 en el plan',
  (await page.textContent('main')).includes('Semana 9 (14-20/12) · Viaje = descarga'));
check('Reglas del plan nuevo (RIR1/0 y autorregulación)',
  (await page.textContent('main')).includes('RIR1/0 = todas las series a RIR1')
  && (await page.textContent('main')).includes('Autorregulación:'));
await page.click('[data-plan="jul"]');
check('Desde Plan se ve el plan viejo',
  (await page.locator('[data-week]').count()) === 4
  && (await page.textContent('main')).includes('Laterales de pie')
  && (await page.textContent('main')).includes('Tras el 16/08'));

await goToDate('2026-10-17');
await page.click('[data-tab="plan"]');
await page.waitForSelector('main .ex');
check('El 17/10 Plan abre el próximo plan (volumen, S1)',
  (await page.textContent('#subtitle')).startsWith('Volumen 8 semanas')
  && (await page.textContent('main .card h2')) === 'Semana 1 · Volumen');

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
  download.suggestedFilename() === 'Plan_8sem_vol_definitivo_con_cardio.xlsx',
  download.suggestedFilename());
check('El .xlsx descargado no está vacío', fs.statSync(saved).size > 10000,
  `${fs.statSync(saved).size} bytes`);

const zipOut = fflate.unzipSync(new Uint8Array(fs.readFileSync(saved)));
const zipSrc = fflate.unzipSync(new Uint8Array(fs.readFileSync(path.join(root, 'Plan_8sem_vol_definitivo_con_cardio.xlsx'))));
const registro = new TextDecoder().decode(zipOut['xl/worksheets/sheet6.xml'] || new Uint8Array());
check('Registro con filas de julio y del plan de volumen',
  registro.includes('2026-07-20') && registro.includes('2026-10-19')
  && registro.includes('2026-10-24') && registro.includes('>Volumen<'));
check('Las 4 hojas originales salen intactas',
  [1, 2, 3, 4].every((n) => Buffer.compare(
    Buffer.from(zipOut[`xl/worksheets/sheet${n}.xml`]),
    Buffer.from(zipSrc[`xl/worksheets/sheet${n}.xml`])) === 0));

check('Sin errores de JavaScript', errors.length === 0, errors.join(' | '));

await browser.close();
server.close();

const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} comprobaciones OK`);
process.exit(failed.length ? 1 : 0);
