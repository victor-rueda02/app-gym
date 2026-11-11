/* Pantalla Progreso (gráficas SVG) en iPhone 13 emulado, con un registro de ejemplo y sin datos.
   Capturas en tools/out/progreso-*.png.
       node tests/progreso-ui.mjs                                              */
import { chromium, devices } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const out = path.join(root, 'tools', 'out');
fs.mkdirSync(out, { recursive: true });

/* --- Registro de ejemplo --- */
const s = (kg, reps, rir, side) => ({ kg: String(kg), reps: String(reps), secs: '', rir: rir === undefined ? '' : String(rir), mins: '', ...(side ? { side } : {}) });
const dia = (entries) => ({ entries });
const days = {
  '2026-10-19': dia({ 'press-inclinado-barra-30-40': [s(60, 8, 2), s(60, 8, 2), s(60, 7, 1)], 'jalon-neutro': [s(50, 10, 2), s(50, 10, 2)], 'prensa-unil-pesado-y-lento-n-1': [s(80, 8, '', 'D'), s(90, 8, '', 'I')] }),
  '2026-10-21': dia({ 'curl-bayesian': [s(12, 10, 2), s(12, 9, 1)], 'elev-laterales-polea': [s(8, 12, 3), s(8, 12, 2)] }),
  '2026-10-26': dia({ 'press-inclinado-barra-30-40': [s(62.5, 8, 2), s(62.5, 8, 2), s(62.5, 7, 1)], 'jalon-neutro': [s(52.5, 10, 2), s(52.5, 10, 1)], 'prensa-unil-pesado-y-lento-n-1': [s(85, 8, '', 'D'), s(90, 8, '', 'I')], 'curl-de-muneca-en-extension-mancuerna': [s(8, 15, 2)] }),
  '2026-10-28': dia({ 'curl-bayesian': [s(12.5, 10, 2), s(12.5, 9, 1)], 'elev-laterales-polea': [s(8, 12, 2), s(8, 12, 2)] }),
  '2026-11-02': dia({ 'press-inclinado-barra-30-40': [s(65, 8, 2), s(65, 8, 1), s(65, 7, 1)], 'jalon-neutro': [s(52.5, 11, 2), s(52.5, 10, 1)], 'prensa-unil-pesado-y-lento-n-1': [s(90, 8, '', 'D'), s(95, 8, '', 'I')] }),
  '2026-11-04': dia({ 'curl-bayesian': [s(12.5, 11, 1), s(12.5, 10, 1)], 'elev-laterales-polea': [s(9, 12, 2), s(9, 11, 1)] }),
  '2026-11-09': dia({ 'press-inclinado-barra-30-40': [s(64, 8, 3), s(64, 8, 2)], 'jalon-neutro': [s(55, 10, 2), s(55, 9, 1)] }),
};
const registro = {
  v: 5, days,
  knee: {
    days: { '2026-10-26': { decline: 2, steps: 3 }, '2026-10-27': { decline: 1, steps: 2 }, '2026-10-28': { decline: 3, steps: 2 }, '2026-11-02': { decline: 1, steps: 1 }, '2026-11-03': { decline: 2, steps: 2 } },
    weeks: {}, entry: {},
    tests: { t1: { loadD: 60, repsD: 8, loadI: 70, repsI: 8 }, t2: { loadD: 66, repsD: 8, loadI: 70, repsI: 8 } },
    depth: {},
  },
};
const vacioReg = { v: 5, days: {}, knee: { days: {}, weeks: {}, entry: {}, tests: {}, depth: {} } };

/* --- Servidor --- */
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png' };
const server = http.createServer((req, res) => {
  let f = decodeURIComponent(req.url.split('?')[0]);
  if (f === '/') f = '/index.html';
  const full = path.join(root, f);
  if (!full.startsWith(root) || !fs.existsSync(full) || fs.statSync(full).isDirectory()) { res.writeHead(404).end('no'); return; }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(full)] || 'application/octet-stream' });
  res.end(fs.readFileSync(full));
});
const PORT = 8132;
await new Promise((r) => server.listen(PORT, r));

let fallos = 0;
let total = 0;
const check = (nombre, ok, detalle = '') => {
  total++;
  if (!ok) fallos++;
  if (!ok || process.env.VERBOSE) console.log(`${ok ? '  OK  ' : ' FALLO'} ${nombre}${detalle ? ` — ${detalle}` : ''}`);
};

const browser = await chromium.launch();

async function abrir(reg) {
  const ctx = await browser.newContext({ ...devices['iPhone 13'], locale: 'es-ES', serviceWorkers: 'block' });
  const page = await ctx.newPage();
  const errores = [];
  page.on('pageerror', (e) => errores.push(`pageerror: ${e}`));
  page.on('console', (m) => { if (m.type() === 'error') errores.push(`console.${m.type()}: ${m.text()}`); });
  await page.addInitScript((r) => { if (!localStorage.getItem('gym.log.v1')) localStorage.setItem('gym.log.v1', JSON.stringify(r)); }, reg);
  await page.goto(`http://localhost:${PORT}/index.html`);
  await page.waitForSelector('[data-tab="progress"]');
  await page.click('[data-tab="progress"]');
  await page.waitForSelector('.pg');
  return { ctx, page, errores };
}
const sub = async (page, id) => { await page.click(`[data-ptab="${id}"]`); await page.waitForTimeout(60); };
const ancho = (page) => page.evaluate(() => document.documentElement.scrollWidth);
const texto = (page, sel) => page.$eval(sel, (e) => e.textContent.trim()).catch(() => '');
const cuenta = (page, sel) => page.$$eval(sel, (l) => l.length);

/* ---------- Con datos ---------- */
{
  const { ctx, page, errores } = await abrir(registro);
  check('subtítulo con ejercicios y semanas', /ejercicios con carga · \d+ semanas/.test(await texto(page, '.topbar p')), await texto(page, '.topbar p'));

  // 1RM
  check('1RM: pinta un SVG', (await cuenta(page, '.pg .gr-svg')) === 1);
  check('1RM: hay línea y puntos', (await cuenta(page, '.gr-line')) >= 1 && (await cuenta(page, '.gr-pt')) >= 3);
  check('1RM: hay marca de récord', (await cuenta(page, '.gr-rec')) >= 1);
  check('1RM: progresión y récords con filas', (await cuenta(page, '.pg-fila')) >= 4);
  const nombre0 = await texto(page, '.pg-card h2');
  await page.screenshot({ path: path.join(out, 'progreso-1rm.png'), fullPage: true });
  const aria0 = await page.$eval('.gr-svg', (e) => e.innerHTML.length);
  // Cambiar de ejercicio con el selector
  await page.selectOption('.pg-select', 'prensa-unil-pesado-y-lento-n-1');
  await page.waitForTimeout(60);
  check('selector cambia el ejercicio', (await texto(page, '.pg-card h2')) !== nombre0, await texto(page, '.pg-card h2'));
  check('prensa: dos líneas D/I', (await cuenta(page, '.gr-line.c-d')) === 1 && (await cuenta(page, '.gr-line.c-i')) === 1);
  check('prensa: leyenda D/I', /Pierna D/.test(await texto(page, '.gr-leyenda')) && /Pierna I/.test(await texto(page, '.gr-leyenda')));
  check('prensa: gráfica distinta', (await page.$eval('.gr-svg', (e) => e.innerHTML.length)) !== aria0);
  // Tocar un punto
  const antes = await texto(page, '.gr-det');
  await page.locator('.gr-hit').first().click({ force: true });
  const despues = await texto(page, '.gr-det');
  check('tocar muestra el valor', /kg/.test(despues) && /×/.test(despues) && despues !== antes, despues);
  check('prensa sin RIR: avisa', /sin RIR/.test(await texto(page, '.pg-mejor')));
  await page.screenshot({ path: path.join(out, 'progreso-1rm-prensa.png'), fullPage: true });
  // Tocar una fila de progresión selecciona el ejercicio
  await page.locator('button.pg-fila[data-ex="jalon-neutro"]').first().click();
  await page.waitForTimeout(60);
  check('fila de progresión selecciona', (await texto(page, '.pg-card h2')).includes('Jalón neutro'));
  check('1RM: sin scroll horizontal', (await ancho(page)) <= 390, String(await ancho(page)));

  // Volumen
  await sub(page, 'volumen');
  check('volumen: SVG con barras', (await cuenta(page, '.gr-bar')) >= 3);
  check('volumen: objetivo marcado', (await cuenta(page, '.gr-obj')) >= 1 && /Objetivo/.test(await texto(page, '.gr-leyenda')));
  const ejeVol = await page.$$eval('.gr-svg text', (l) => l.map((t) => t.textContent));
  check('volumen: el eje lleva la fecha real del lunes (S1 = 19 oct)', ejeVol.includes('19 oct') && !ejeVol.includes('S1'), ejeVol.join('|'));
  const ejeSeries = await page.$$eval('.gr-svg text', (l) => l.map((t) => t.textContent).join('|'));
  await page.locator('.gr-hit').nth(1).click({ force: true });
  check('volumen: tocar barra muestra series y objetivo', /series/.test(await texto(page, '.gr-det')) && /objetivo/.test(await texto(page, '.gr-det')), await texto(page, '.gr-det'));
  check('volumen: cumplimiento con barras', (await cuenta(page, '.pg-cump')) >= 3 && /%/.test(await texto(page, '.pg-cump')));
  check('volumen: el correctivo no cuenta', !/curl de muñeca/i.test(await page.content()));
  await page.screenshot({ path: path.join(out, 'progreso-volumen.png'), fullPage: true });
  await page.click('[data-modo="tonelaje"]');
  await page.waitForTimeout(60);
  const ejeTon = await page.$$eval('.gr-svg text', (l) => l.map((t) => t.textContent).join('|'));
  check('conmutador cambia el eje', ejeTon !== ejeSeries && (await cuenta(page, '.gr-obj')) === 0 && /t\b|kg/.test(await texto(page, '.gr-det')), await texto(page, '.gr-det'));
  await page.screenshot({ path: path.join(out, 'progreso-volumen-tonelaje.png'), fullPage: true });
  await page.selectOption('.pg-select', 'Espalda');
  await page.waitForTimeout(60);
  check('volumen: grupo sin cumplimiento total', (await cuenta(page, '.pg-cump')) === 0 && (await cuenta(page, '.gr-bar')) >= 1);
  await page.click('[data-modo="series"]');
  check('volumen: sin scroll horizontal', (await ancho(page)) <= 390);

  // Esfuerzo
  await sub(page, 'esfuerzo');
  check('esfuerzo: línea real y prescrita discontinua', (await cuenta(page, '.gr-line')) === 2 && (await cuenta(page, '.gr-dash')) === 1);
  await page.locator('.gr-hit').first().click({ force: true });
  check('esfuerzo: detalle con n', /n = \d+/.test(await texto(page, '.gr-det')), await texto(page, '.gr-det'));
  check('esfuerzo: sin scroll horizontal', (await ancho(page)) <= 390);
  await page.screenshot({ path: path.join(out, 'progreso-esfuerzo.png'), fullPage: true });

  // Rodilla
  await sub(page, 'rodilla');
  check('rodilla: gráfica de molestia con referencias', (await cuenta(page, '.gr-ref')) >= 2 && (await cuenta(page, '.gr-pt')) >= 1);
  check('rodilla: barras de simetría con 90 %', (await cuenta(page, '.gr-bar')) === 2 && (await page.$$eval('.gr-ref-t', (l) => l.map((t) => t.textContent))).includes('90 %'));
  await page.locator('.gr-hit').last().click({ force: true });
  const dt = await page.locator('.gr-det').last().textContent();
  check('rodilla: detalle de test', /simetría/.test(dt), dt);
  check('rodilla: sin scroll horizontal', (await ancho(page)) <= 390);
  await page.screenshot({ path: path.join(out, 'progreso-rodilla.png'), fullPage: true });

  // Se recuerda la subpestaña al volver
  await page.click('[data-tab="plan"]');
  await page.click('[data-tab="progress"]');
  await page.waitForSelector('.pg');
  check('recuerda la subpestaña', await page.$eval('[data-ptab="rodilla"]', (b) => !b.classList.contains('ghost')));

  check('sin errores de consola', errores.length === 0, errores.join(' || '));
  check('ninguna sección falló', !/No se pudo pintar/.test(await page.content()));
  await ctx.close();
}

/* ---------- Peso corporal (báscula en el mismo navegador y copia pegada) ---------- */
{
  const DOM = 'dominada-neutra-dorsal';
  const conDom = { ...vacioReg, days: {
    '2026-10-21': dia({ [DOM]: [s(10, 6, 2), s('', 8, 1)] }),
    '2026-10-28': dia({ [DOM]: [s(12.5, 6, 2)] }),
  } };
  const bascula = [{ t: '2026-10-20T06:30:00.000Z', kg: 72 }, { t: '2026-10-20T19:00:00.000Z', kg: 73.4 }, { t: '2026-10-27T06:30:00.000Z', kg: 72.6 }];
  const ctx = await browser.newContext({ ...devices['iPhone 13'], locale: 'es-ES', serviceWorkers: 'block' });
  const page = await ctx.newPage();
  const errores = [];
  page.on('pageerror', (e) => errores.push(`pageerror: ${e}`));
  page.on('console', (m) => { if (m.type() === 'error') errores.push(`console.${m.type()}: ${m.text()}`); });
  await page.addInitScript(([r, b]) => {
    if (!localStorage.getItem('gym.log.v1')) localStorage.setItem('gym.log.v1', JSON.stringify(r));
    if (!localStorage.getItem('bascula.history.v1')) localStorage.setItem('bascula.history.v1', JSON.stringify(b));
  }, [conDom, bascula]);
  await page.goto(`http://localhost:${PORT}/index.html`);
  await page.waitForSelector('[data-tab="progress"]');
  check('báscula: lee los pesajes del mismo navegador (primero del día)', JSON.stringify(await page.evaluate(() => Store.pesos())) === JSON.stringify({ '2026-10-20': 72, '2026-10-27': 72.6 }), JSON.stringify(await page.evaluate(() => Store.pesos())));
  await page.click('[data-tab="progress"]');
  await page.waitForSelector('.pg');
  await page.selectOption('.pg-select', DOM);
  await page.waitForTimeout(60);
  check('báscula: aviso de peso + lastre', /peso de la báscula \+ el lastre/.test(await texto(page, '.pg-mejor')), await texto(page, '.pg-mejor'));
  await page.locator('.gr-hit').first().click({ force: true });
  const det = await texto(page, '.gr-det');
  check('báscula: el punto suma peso y lastre', /~102 kg/.test(det) && /\(72 \+ 10\) × 6/.test(det), det);
  // Pantalla del ejercicio: nota con el peso y 1RM en vivo con peso + lastre.
  await page.evaluate((id) => {
    const ses = Object.values(PLAN.BLOCK_VOL).find((x) => x.exercises.some((e) => e.id === id));
    state.exercise = { sessionId: ses.id, exId: id, date: '2026-10-21' };
    render();
  }, DOM);
  await page.waitForSelector('.e1rm');
  check('ejercicio: nota con el peso de la báscula', /72 kg/.test(await texto(page, '.prev')) && /lastre/.test(await texto(page, '.prev')), await texto(page, '.prev'));
  const vivos = await page.$$eval('.e1rm', (l) => l.map((e) => e.textContent.trim()));
  check('ejercicio: 1RM en vivo con peso + lastre', vivos[0].startsWith('~102') && vivos[1].startsWith('~92,5'), vivos.join(' | '));
  await page.screenshot({ path: path.join(out, 'progreso-peso-ejercicio.png'), fullPage: true });
  // Datos › Peso corporal
  await page.evaluate(() => { state.exercise = null; });
  await page.click('[data-tab="data"]');
  await page.waitForTimeout(60);
  check('datos: resumen de pesos', /2 días con peso/.test(await page.content()));
  check('datos: sin scroll horizontal', (await ancho(page)) <= 390);
  await page.screenshot({ path: path.join(out, 'progreso-peso-datos.png'), fullPage: true });
  check('báscula: sin errores de consola', errores.length === 0, errores.join(' || '));
  await ctx.close();
}
{
  // Otro navegador (sin la báscula): se pega el texto de su copia de seguridad.
  const { ctx, page, errores } = await abrir(vacioReg);
  await page.click('[data-tab="data"]');
  await page.click('.pegar-bascula summary');
  const copia = { formato: 'bascula-ilteco', version: 1, exportado: '2026-11-10T08:00:00.000Z', alturaCm: '178',
    registros: [{ t: '2026-11-09T07:00:00.000Z', kg: 71.85 }, { t: '2026-11-10T07:00:00.000Z', kg: 71.6 }] };
  await page.fill('.pegar-bascula textarea', JSON.stringify(copia, null, 2));
  await page.click('.pegar-bascula button');
  await page.waitForTimeout(60);
  check('pegar copia: importa los pesos', JSON.stringify(await page.evaluate(() => Store.pesos())) === JSON.stringify({ '2026-11-09': 71.85, '2026-11-10': 71.6 }));
  check('pegar copia: se ve en Datos', /2 días con peso/.test(await page.content()) && /71,6 kg/.test(await page.content()));
  await page.click('.pegar-bascula summary').catch(() => {});
  await page.fill('.pegar-bascula textarea', 'esto no es una copia').catch(() => {});
  await page.click('.pegar-bascula button').catch(() => {});
  await page.waitForTimeout(60);
  check('pegar basura: no rompe ni borra', Object.keys(await page.evaluate(() => Store.pesos())).length === 2);
  check('pegar copia: sin errores de consola', errores.length === 0, errores.join(' || '));
  await ctx.close();
}

/* ---------- Un solo punto ---------- */
{
  const uno = { ...vacioReg, days: { '2026-10-19': dia({ 'jalon-neutro': [s(50, 10, 2)] }) } };
  const { ctx, page, errores } = await abrir(uno);
  check('un solo punto: se ve el punto', (await cuenta(page, '.gr-pt')) === 1 && (await cuenta(page, '.gr-line')) === 0);
  check('un solo punto: progresión vacía con texto', /al menos dos días/.test(await texto(page, '.pg-lista')));
  await page.screenshot({ path: path.join(out, 'progreso-un-punto.png'), fullPage: true });
  check('un solo punto: sin errores', errores.length === 0, errores.join(' || '));
  await ctx.close();
}

/* ---------- Sin datos ---------- */
{
  const { ctx, page, errores } = await abrir(vacioReg);
  for (const [id, re] of [['1rm', /Registra series con kg y reps/], ['volumen', /Registra series de hipertrofia/], ['esfuerzo', /Anota el RIR/], ['rodilla', /Apunta la molestia/]]) {
    await sub(page, id);
    check(`vacío ${id}: estado vacío`, re.test(await texto(page, '.pg .empty')) && (await cuenta(page, '.gr-svg')) === 0, await texto(page, '.pg .empty'));
    check(`vacío ${id}: sin scroll horizontal`, (await ancho(page)) <= 390);
  }
  await page.screenshot({ path: path.join(out, 'progreso-vacio.png'), fullPage: true });
  check('vacío: sin errores de consola', errores.length === 0, errores.join(' || '));
  await ctx.close();
}

await browser.close();
server.close();
console.log(fallos ? `${fallos} de ${total} comprobaciones FALLAN` : `OK: ${total} comprobaciones`);
process.exit(fallos ? 1 : 0);
