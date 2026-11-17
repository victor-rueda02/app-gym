/* Plan › Ejercicios y lo que cambia en Hoy (js/ejercicios.js), en iPhone 13 emulado:
   columnas y referencias fijas de cada ejercicio, posición de la máquina que recuerda el último
   día, profundidad por serie de la touchdown, sentadilla iso por pierna, pulsación larga (quitar
   del día y editar parámetros), editor y «Añadir ejercicio» con el selector, y la exportación.
   Capturas en tools/out/ejercicios-*.png.
       node tests/ejercicios-ui.mjs                                                       */
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
const PORT = 8139;
await new Promise((r) => server.listen(PORT, r));

let fallos = 0;
let total = 0;
const check = (nombre, ok, detalle = '') => {
  total++;
  if (!ok) fallos++;
  if (!ok || process.env.VERBOSE) console.log(`${ok ? '  OK  ' : ' FALLO'} ${nombre}${detalle ? ` — ${detalle}` : ''}`);
};

// Registro de partida: el lunes 9/11 con la prensa y el curl bayesian apuntados (para «Hechos» y «Recientes»).
const registro = {
  v: 5,
  days: {
    '2026-11-09': { sessionId: 'VOL-L', notes: '', entries: {
      'prensa-unil-pesado-y-lento-n-1': [{ kg: '80', reps: '10', secs: '', rir: '', mins: '', side: 'D' }],
    } },
    '2026-11-12': { sessionId: 'VOL-J', notes: '', entries: { 'curl-bayesian': [{ kg: '12', reps: '10', secs: '', rir: '2', mins: '' }] } },
  },
  knee: { days: {}, weeks: {}, entry: {}, tests: {}, depth: {} },
};

const browser = await chromium.launch();
const ctx = await browser.newContext({ ...devices['iPhone 13'], locale: 'es-ES', serviceWorkers: 'block', acceptDownloads: true });
const page = await ctx.newPage();
const errores = [];
page.on('pageerror', (e) => errores.push(`pageerror: ${e}`));
page.on('console', (m) => { if (m.type() === 'error') errores.push(`console.error: ${m.text()}`); });
page.on('dialog', (d) => d.accept());
await page.clock.setFixedTime(new Date('2026-11-16T10:00:00'));   // lunes de S5
await page.addInitScript((r) => { delete window.showSaveFilePicker; if (!localStorage.getItem('gym.log.v1')) localStorage.setItem('gym.log.v1', JSON.stringify(r)); }, registro);
await page.goto(`http://localhost:${PORT}/index.html`);
await page.waitForSelector('#hero-name');

const reg = () => page.evaluate(() => JSON.parse(localStorage.getItem('gym.log.v1')));
const nombres = () => page.$$eval('main .ex:not(.rod-item) .nm', (l) => l.map((e) => e.textContent.trim()));
const ancho = () => page.evaluate(() => document.documentElement.scrollWidth);
const abrirEj = async (texto) => { await page.locator('main .ex', { hasText: texto }).first().click(); await page.waitForSelector('.set-row'); };
const hecho = async () => { await page.locator('.btn', { hasText: 'Hecho' }).click(); await page.waitForTimeout(60); };
const cabecera = () => page.$$eval('.set-row.head span', (l) => l.map((e) => e.textContent.trim()).filter(Boolean));
const irA = async (fecha) => { await page.fill('#datepick', fecha); await page.dispatchEvent('#datepick', 'change'); await page.waitForTimeout(80); };

/* --- Hoy, lunes 16/11 --- */
const lunes = await nombres();
check('La sentadilla iso pared unilateral sustituye a la española', lunes.includes('Sentadilla iso pared unilateral') && !lunes.includes('Sentadilla española'), lunes.join(', '));
check('Hoy lista las tareas de rodilla del día', await page.locator('[data-rod-item="tras"]').count() === 1 && await page.locator('[data-rod-item="notas"]').count() === 1);

await abrirEj('Prensa unil');
const refs = await page.textContent('.ref-fija');
check('Prensa: referencias fijas tempo 3-1-3 y RIR D 2 · I 1-2', refs.includes('3-1-3') && refs.includes('D 2 · I 1-2'), refs);
check('Prensa: columnas Lado, Kg y Reps, sin RIR', JSON.stringify(await cabecera()) === '["Lado","Kg","Reps"]', JSON.stringify(await cabecera()));
const aj = await page.$$eval('.aj-campo', (l) => l.map((e) => `${e.querySelector('span').textContent}=${e.querySelector('input').value}`));
check('Prensa: posición de la máquina con lo de partida', aj.join('|') === 'Profundidad D=6|Profundidad I=5|Altura pies=3', aj.join('|'));
await page.locator('.aj-campo input').first().fill('7');
await page.locator('.aj-campo input').first().dispatchEvent('change');
await page.screenshot({ path: path.join(out, 'ejercicios-prensa.png'), fullPage: true });
await hecho();
check('El ajuste se guarda en el día', (await reg()).days['2026-11-16'].ajustes['prensa-unil-pesado-y-lento-n-1']['Profundidad D'] === '7');

await abrirEj('Touchdown');
check('Touchdown: profundidad en steps y discos por serie, sin peso', JSON.stringify(await cabecera()) === '["Lado","Steps","Discos","Reps"]', JSON.stringify(await cabecera()));
const fila0 = page.locator('.set-row:not(.head)').first();
await fila0.locator('[data-f="Steps"]').fill('3');
await fila0.locator('[data-f="Discos"]').fill('1');
await fila0.locator('[data-f="reps"]').fill('10');
await hecho();
const td = (await reg()).days['2026-11-16'].entries['touchdown-squat'];
check('Touchdown: steps y discos guardados en la serie', td && td[0].x && td[0].x.Steps === '3' && td[0].x.Discos === '1', JSON.stringify(td));

await abrirEj('Sentadilla iso');
check('Sentadilla iso: por pierna, con peso y 45 s de referencia', JSON.stringify(await cabecera()) === '["Lado","Kg"]'
  && (await page.textContent('.ref-fija')).includes('45 s') && await page.locator('.stamp').count() === 0, JSON.stringify(await cabecera()));
await hecho();

/* --- El lunes siguiente recuerda la posición --- */
await irA('2026-11-23');
await abrirEj('Prensa unil');
const aj2 = await page.$$eval('.aj-campo input', (l) => l.map((e) => e.value));
check('El lunes siguiente la prensa sale con la profundidad D del último día (7)', aj2[0] === '7', aj2.join(','));
await hecho();
await irA('2026-11-16');

/* --- Pulsación larga: quitar y editar --- */
const pulsar = async (texto) => {
  const fila = page.locator('main .ex', { hasText: texto }).first();
  const caja = await fila.boundingBox();
  const o = { clientX: caja.x + 20, clientY: caja.y + 20, pointerType: 'touch', isPrimary: true };
  await fila.dispatchEvent('pointerdown', o);
  await page.waitForTimeout(650);
  await fila.dispatchEvent('pointerup', o);
  await page.waitForTimeout(80);
};
await pulsar('Hiperextensiones');
check('Mantener pulsado abre el menú con quitar y editar', !(await page.isHidden('#sheet'))
  && await page.locator('[data-menu="quitar"]').count() === 1 && await page.locator('[data-menu="editar"]').count() === 1);
await page.screenshot({ path: path.join(out, 'ejercicios-menu.png') });
await page.click('[data-menu="quitar"]');
await page.waitForTimeout(80);
check('Quitar lo saca de ese día', !(await nombres()).includes('Hiperextensiones')
  && JSON.stringify((await reg()).days['2026-11-16'].removed) === '["hiperextensiones"]');
await page.locator('.cambios .btn', { hasText: 'Volver a poner «Hiperextensiones»' }).click();
await page.waitForTimeout(80);
check('«Volver a poner» lo devuelve', (await nombres()).includes('Hiperextensiones'));

await pulsar('Prensa unil');
await page.click('[data-menu="editar"]');
await page.waitForTimeout(100);
check('«Editar parámetros» abre Plan › Ejercicios en ese ejercicio', (await page.textContent('main h2')).startsWith('Prensa unil')
  && await page.locator('.ej-param').count() >= 7);
// RIR en cada serie.
await page.locator('.ej-param', { hasText: 'RIR' }).first().locator('[data-modo="serie"]').click();
await page.waitForTimeout(80);
check('El cambio se guarda como ajustado', (await reg()).ejercicios['prensa-unil-pesado-y-lento-n-1'].rir.modo === 'serie');
await page.screenshot({ path: path.join(out, 'ejercicios-editor.png'), fullPage: true });
check('Ancho de iPhone en el editor', await ancho() === 390, String(await ancho()));
await page.locator('.btn', { hasText: 'Todos los ejercicios' }).click();
await page.waitForTimeout(60);
const lista = await page.$$eval('main [data-conf] .nm', (l) => l.map((e) => e.textContent.trim()));
check('La lista «Hechos» trae los ejercicios con series, con la prensa marcada como ajustada',
  lista.some((t) => t.startsWith('Prensa unil') && t.includes('ajustado')) && lista.some((t) => t.startsWith('Touchdown')) && lista.some((t) => t.startsWith('Curl bayesian')), lista.join(', '));
await page.click('[data-tab="today"]');
await page.waitForSelector('#hero-name');
await abrirEj('Prensa unil');
check('En Hoy la prensa ya lleva columna RIR', (await cabecera()).includes('RIR'), JSON.stringify(await cabecera()));
await hecho();

/* --- Añadir ejercicio con el selector --- */
await page.locator('.cambios .btn', { hasText: 'Añadir ejercicio' }).click();
await page.click('#an-boton');
await page.waitForTimeout(80);
check('Añadir abre el selector con Recientes', (await page.textContent('#sheet')).includes('Recientes'));
await page.fill('#sheet input[type="search"], #sheet input[type="text"]', 'curl bay');
await page.waitForTimeout(80);
await page.locator('#sheet button', { hasText: 'Curl bayesian' }).first().click();
await page.waitForTimeout(80);
check('Tras elegir, vuelve al formulario con el ejercicio y sus series', (await page.textContent('#an-boton')).includes('Curl bayesian')
  && (await page.inputValue('#an-series')) !== '');
await page.click('#an-ok');
await page.waitForTimeout(80);
check('Curl bayesian añadido al lunes', (await nombres()).includes('Curl bayesian'));
check('Ancho de iPhone en Hoy', await ancho() === 390, String(await ancho()));
await page.screenshot({ path: path.join(out, 'ejercicios-hoy.png'), fullPage: true });

/* --- Exportar: columna Ajustes --- */
await page.click('[data-tab="data"]');
await page.waitForSelector('.btn');
const [download] = await Promise.all([page.waitForEvent('download'), page.locator('.btn', { hasText: 'Exportar .xlsx' }).click()]);
const saved = path.join(out, 'ejercicios.xlsx');
await download.saveAs(saved);
const zip = fflate.unzipSync(new Uint8Array(fs.readFileSync(saved)));
const registroXml = new TextDecoder().decode(zip['xl/worksheets/sheet6.xml']);
check('Registro: columna Ajustes con la profundidad de la touchdown y la posición de la prensa',
  registroXml.includes('>Ajustes<') && registroXml.includes('Steps 3 · Discos 1') , registroXml.slice(0, 200));

check('Sin errores de JavaScript', errores.length === 0, errores.join(' | '));
await browser.close();
server.close();
console.log(fallos ? `\n${fallos} fallo(s) de ${total}` : `OK: ${total} comprobaciones`);
process.exit(fallos ? 1 : 0);
