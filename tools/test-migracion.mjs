/* Comprueba que un registro guardado ANTES de renombrar las laterales (v1) y
   antes del Excel con cardio (v2) se recoloca solo al abrir la app, en vez de
   quedarse huérfano.
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

// Filas que exportaba este mismo registro antes de añadir el plan de volumen
// (capturadas con la versión anterior de la app). Deben salir idénticas.
const EXPORT_ANTES = [
  ['2026-07-20', 'Sem 1', 'A', 'Lunes · Rehab + Isquios + Hombro', 'Laterales de pie', 'Hombro lat.', 1, 10, 15, '', 2, '2 @ RIR2', 'previo'],
  ['2026-07-20', 'Sem 1', 'A', 'Lunes · Rehab + Isquios + Hombro', 'Laterales banco inclinado posterior', 'Posterior', 1, 6, 12, '', 2, '1 @ RIR2', ''],
  ['2026-07-22', 'Sem 1', 'A', 'Miércoles · Pull', 'Laterales sentado inclinado', 'Hombro lat.', 1, 11, 13, '', 2, '2 @ RIR2', ''],
  ['2026-08-05', 'Sem 3', 'B', 'Día 1 · Rehab + Push mínimo', 'Laterales', 'Hombro lat.', 1, 8, 15, '', 3, '2 @ RIR2', ''],
];

await page.addInitScript((data) => {
  localStorage.setItem('gym.log.v1', JSON.stringify(data));
}, ANTIGUO);

// La pantalla Hoy depende de la fecha: fijamos el reloj en el lunes 20 jul
// para que el registro antiguo caiga en el día que se muestra.
await page.addInitScript(() => {
  const RealDate = Date;
  const fixed = new RealDate('2026-07-20T10:00:00').getTime();
  // eslint-disable-next-line no-global-assign
  Date = class extends RealDate {
    constructor(...args) { return args.length ? new RealDate(...args) : new RealDate(fixed); }
    static now() { return fixed; }
  };
});

await page.goto('http://localhost:8125/index.html');
await page.waitForFunction(() => document.querySelectorAll('.ex').length > 0);

const tras = await page.evaluate(() => JSON.parse(localStorage.getItem('gym.log.v1')));

check('El registro se marca con la versión nueva', tras.v === 4, `v=${tras.v}`);
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

const filas = await page.evaluate(() => buildRows());
// La hoja Registro ganó dos columnas: Lado (índice 7, tras Serie) y Min (tras Seg).
// Se insertan vacías en las filas de antes.
const conMin = (r) => { const a = [...r.slice(0, 7), '', ...r.slice(7)]; return [...a.slice(0, 11), '', ...a.slice(11)]; };
check('Se exporta igual que antes del plan de volumen',
  JSON.stringify(filas) === JSON.stringify(EXPORT_ANTES.map(conMin)), `${filas.length} filas`);

// Volver a arrancar no debe duplicar nada (migración idempotente).
await page.reload();
await page.waitForFunction(() => document.querySelectorAll('.ex').length > 0);
const otra = await page.evaluate(() => JSON.parse(localStorage.getItem('gym.log.v1')));
check('Reabrir no duplica series',
  otra.days['2026-07-20'].entries['laterales-de-pie'].length === 1,
  `${otra.days['2026-07-20'].entries['laterales-de-pie'].length} series`);

/* --- v2 -> v3: ejercicios del plan de volumen renombrados en el Excel con cardio --- */
const s = (kg, reps, rir) => ({ kg, reps, secs: '', rir });
const V2 = {
  v: 2,
  days: {
    '2026-10-19': { sessionId: 'VOL-L', notes: '', entries: { gemelos: [s('80', '12', '1')], 'elev-laterales-polea': [s('9', '15', '1')] } },
    '2026-10-20': { sessionId: 'VOL-M', notes: '', entries: {
      'press-inclinado-barra': [s('40', '10', '1')], 'aperturas-polea': [s('15', '12', '1')], abs: [s('', '15', '1')] } },
    '2026-10-21': { sessionId: 'VOL-X', notes: '', entries: {   // el intercambio de "Jalón neutro" es el caso delicado
      'jalon-neutro': [s('50', '10', '1')], 'dominadas-medio-abiertas': [s('0', '6', '0')] } },
    '2026-10-22': { sessionId: 'VOL-J', notes: '', entries: { gemelos: [s('90', '12', '1')], 'back-squat': [s('60', '10', '')] } },
    '2026-10-23': { sessionId: 'VOL-V', notes: '', entries: {
      'triceps-conc-polea': [s('12', '12', '0')], 'curl-frances-manc': [s('14', '10', '1')],
      'press-incl-maquina': [s('30', '10', '1')], 'remo-maquina': [s('45', '10', '1')], pullover: [s('20', '12', '1')] } },
    '2026-07-23': { sessionId: 'A-J', notes: '', entries: { gemelos: [s('70', '15', '2')] } },   // julio: no se toca
  },
};
const page2 = await ctx.newPage();
await page2.addInitScript((data) => { localStorage.setItem('gym.log.v1', JSON.stringify(data)); }, V2);
await page2.goto('http://localhost:8125/index.html');
await page2.waitForFunction(() => document.querySelectorAll('.ex').length > 0 || document.querySelector('.empty'));
const t2 = await page2.evaluate(() => JSON.parse(localStorage.getItem('gym.log.v1')));
const keys = (d) => Object.keys(t2.days[d].entries).sort().join(', ');
check('v3 · lunes: gemelos -> gemelos-prensa', keys('2026-10-19') === 'elev-laterales-polea, gemelos-prensa', keys('2026-10-19'));
check('v3 · martes: press, contractora y abs colgado',
  keys('2026-10-20') === 'abs-colgado-retroversion, contractora-pec-deck, press-inclinado-barra-30-40', keys('2026-10-20'));
check('v3 · miércoles: el jalón neutro viejo pasa a jalón ancho y las dominadas a jalón neutro',
  keys('2026-10-21') === 'jalon-ancho-plano-frontal, jalon-neutro'
  && t2.days['2026-10-21'].entries['jalon-ancho-plano-frontal'][0].kg === '50'
  && t2.days['2026-10-21'].entries['jalon-neutro'][0].kg === '0', keys('2026-10-21'));
check('v3 · jueves: gemelos-prensa y la sentadilla (back squat) renombrada por la migración v4',
  keys('2026-10-22') === 'gemelos-prensa, sentadilla-al-cajon-o-desde-pines-pesado-y-lento-n-2', keys('2026-10-22'));
check('v3 · viernes: los 5 ejercicios renombrados',
  keys('2026-10-23') === 'aduccion-unil-polea-alta-pull-in, press-frances-manc-banco-plano, press-maquina-neutro-ascendente, remo-maquina-pecho-apoyado-30, triceps-conc-polea-15',
  keys('2026-10-23'));
check('v3 · julio conserva sus gemelos', keys('2026-07-23') === 'gemelos', keys('2026-07-23'));
const ids = await page2.evaluate(() => PLAN.sessionFor('2026-10-23').options[0].exercises.map((e) => e.id));
check('v3 · todos los ids migrados existen en el plan',
  Object.keys(t2.days['2026-10-23'].entries).every((k) => ids.includes(k)), ids.join(', '));

/* --- v3 -> v4: plan rodilla; los ids antiguos del plan de volumen se recolocan --- */
const V3 = {
  v: 3,
  days: {
    '2026-10-19': { sessionId: 'VOL-L', notes: '', entries: {
      'unilateral-abduction': [s('30', '15', '2')], 'prensa-unil': [s('100', '12', '')] } },
    '2026-10-22': { sessionId: 'VOL-J', notes: '', entries: {
      'unilateral-abduction': [s('32', '15', '2')], 'back-squat': [s('60', '12', '')] } },
    '2026-10-23': { sessionId: 'VOL-V', notes: '', entries: { 'bici-z2-z3-prog': [{ kg: '', reps: '', secs: '', rir: '', mins: '12' }] } },
    '2026-10-24': { sessionId: 'VOL-S', notes: '', entries: {
      'unilateral-abduction': [s('25', '15', '2')], 'movilidad-trapecio-inferior': [s('', '', '')] } },
    '2026-07-23': { sessionId: 'A-J', notes: '', entries: { 'unilateral-abduction': [s('20', '16', '2')] } },   // julio: no se toca
  },
};
const page3 = await ctx.newPage();
await page3.addInitScript((data) => { localStorage.setItem('gym.log.v1', JSON.stringify(data)); }, V3);
await page3.goto('http://localhost:8125/index.html');
await page3.waitForFunction(() => document.querySelectorAll('.ex').length > 0 || document.querySelector('.empty'));
const t3 = await page3.evaluate(() => JSON.parse(localStorage.getItem('gym.log.v1')));
const k3 = (d) => Object.keys(t3.days[d].entries).sort().join(', ');
check('v4 · versión 4 y registro de rodilla creado', t3.v === 4 && !!t3.knee);
check('v4 · lunes: abducción y prensa renombradas',
  k3('2026-10-19') === 'abduccion-de-pie-unilateral-maquina, prensa-unil-pesado-y-lento-n-1', k3('2026-10-19'));
check('v4 · jueves: abducción y sentadilla renombradas',
  k3('2026-10-22') === 'abduccion-de-pie-unilateral-maquina, sentadilla-al-cajon-o-desde-pines-pesado-y-lento-n-2', k3('2026-10-22'));
check('v4 · viernes: bici', k3('2026-10-23') === 'bici-z2-sin-z3-en-este-bloque', k3('2026-10-23'));
check('v4 · sábado: abducción y T', k3('2026-10-24') === 'abduccion-unilateral, elevacion-lateral-en-prono-t-mancuernas-banco', k3('2026-10-24'));
check('v4 · julio no se toca', k3('2026-07-23') === 'unilateral-abduction', k3('2026-07-23'));
check('v4 · conserva los datos (kg)',
  t3.days['2026-10-19'].entries['abduccion-de-pie-unilateral-maquina'][0].kg === '30'
  && t3.days['2026-10-22'].entries['sentadilla-al-cajon-o-desde-pines-pesado-y-lento-n-2'][0].kg === '60');
const ids3 = await page3.evaluate(() => ['2026-10-19', '2026-10-22', '2026-10-23', '2026-10-24']
  .map((d) => PLAN.sessionFor(d).options[0].exercises.map((e) => e.id)));
check('v4 · todos los ids migrados existen en su sesión',
  ['2026-10-19', '2026-10-22', '2026-10-23', '2026-10-24']
    .every((d, i) => Object.keys(t3.days[d].entries).every((k) => ids3[i].includes(k))));
// Y se ve en pantalla: las series aparecen en los ejercicios renombrados (Hoy, S1).
const verPres = async (fecha, nombre) => {
  await page3.click('[data-tab="today"]');
  await page3.fill('#datepick', fecha);
  await page3.waitForFunction((v) => document.getElementById('datepick').value === v, fecha);
  return page3.locator('main .ex', { has: page3.locator('.nm', { hasText: nombre }) }).first().locator('.pres').textContent();
};
check('v4 · lunes: abducción renombrada muestra 1/2', (await verPres('2026-10-19', 'Abducción de pie unilateral (máquina)')) === '1/2');
check('v4 · lunes: prensa renombrada muestra 1/2', (await verPres('2026-10-19', 'Prensa unil')) === '1/2');
check('v4 · jueves: sentadilla renombrada muestra 1/3', (await verPres('2026-10-22', 'Sentadilla al cajón')) === '1/3');
check('v4 · viernes: bici renombrada cuenta como hecha (1/1)', (await verPres('2026-10-23', 'Bici Z2')) === '1/1');
check('v4 · sábado: abducción renombrada muestra 1/2', (await verPres('2026-10-24', 'Abducción unilateral')) === '1/2');

await browser.close();
server.close();
const fallos = results.filter((r) => !r).length;
console.log(`\n${results.length - fallos}/${results.length} comprobaciones OK`);
process.exit(fallos ? 1 : 0);
