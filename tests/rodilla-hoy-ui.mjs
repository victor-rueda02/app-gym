/* Ítems de rodilla de la lista de Hoy (Rodilla.itemsHoy) en iPhone 13 emulado.
       node tests/rodilla-hoy-ui.mjs                                              */
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
const PORT = 8152;
await new Promise((r) => server.listen(PORT, r));

let fallos = 0;
const check = (nombre, ok, detalle = '') => {
  if (!ok) fallos++;
  console.log(`${ok ? '  OK  ' : ' FALLO'} ${nombre}${detalle && !ok ? ` — ${detalle}` : ''}`);
};

const browser = await chromium.launch();
const ctx = await browser.newContext({ ...devices['iPhone 13'], locale: 'es-ES', serviceWorkers: 'block' });
const page = await ctx.newPage();
const errores = [];
page.on('pageerror', (e) => errores.push(`pageerror: ${e}`));
page.on('console', (m) => { if (m.type() === 'error') errores.push(`console.error: ${m.text()}`); });
await page.clock.setFixedTime(new Date('2026-11-16T08:00:00'));
await page.goto(`http://localhost:${PORT}/index.html`);
await page.waitForSelector('main .ex');

// Monta los ítems de una fecha en un contenedor de prueba y devuelve [nombre, etiqueta] de cada uno.
const montar = (fecha) => page.evaluate((f) => {
  const viejo = document.getElementById('rod-test');
  if (viejo) viejo.remove();
  const c = document.createElement('div');
  c.id = 'rod-test';
  document.querySelector('main').prepend(c);
  window.__cambios = 0;
  Rodilla.itemsHoy(f, () => { window.__cambios++; }).forEach((i) => c.appendChild(i));
  return [...c.querySelectorAll('.ex')].map((b) => [b.querySelector('.nm').textContent, b.querySelector('.pres').textContent]);
}, fecha);
const nombres = (l) => l.map((x) => x[0]);
const TRAS = 'Rodilla tras la sesión', ENT = 'Entrada a la carrera: criterios', CHAS = 'Rodilla: chasquido y notas';

let l = await montar('2026-11-16');
check('Lunes de pierna: tras la sesión y chasquido', nombres(l).includes(TRAS) && nombres(l).includes(CHAS), JSON.stringify(l));
check('Orden: tras la sesión antes que chasquido', nombres(l).indexOf(TRAS) < nombres(l).indexOf(CHAS));
check('Pendiente al principio', l.find((x) => x[0] === TRAS)[1] === 'pendiente' && l.find((x) => x[0] === CHAS)[1] === '—');
check('Filas con clase rehab', (await page.locator('#rod-test .ex.rehab').count()) === l.length);

// Miércoles de carrera
l = await montar('2026-11-18');
await page.locator('#rod-test .ex', { hasText: TRAS }).click();
check('Miércoles de carrera: aparece «Nivel previo en ≤60 min»', (await page.locator('#sheet-content', { hasText: 'Nivel previo en ≤60 min' }).count()) === 1);
await page.click('#sheet-content [data-rod-listo]');
check('Listo cierra la hoja', await page.locator('#sheet').isHidden());
check('Listo llama a alCambiar una vez', (await page.evaluate(() => window.__cambios)) === 1);

// Entrada: se busca el día de paseo/1.ª carrera sin haber entrado
const entradas = await page.evaluate(() => {
  const out = [];
  for (const d of RODILLA_DATA.dias) {
    const it = Rodilla.itemsHoy(d.fecha, () => {});
    if (it.some((i) => i.dataset.rodItem === 'entrada')) out.push(d.fecha);
  }
  return out;
});
check('Hay días con ítem de entrada', entradas.length > 0, JSON.stringify(entradas));
const eDia = entradas[0];
l = await montar(eDia);
check(`Día de entrada (${eDia}): sale la entrada, pendiente`, nombres(l).includes(ENT) && l.find((x) => x[0] === ENT)[1] === 'pendiente', JSON.stringify(l));
await page.locator('#rod-test .ex', { hasText: ENT }).click();
await page.waitForSelector('[data-entrada]');
check('Tocar la entrada abre Rodilla › Entrada', (await page.locator('[data-entrada]').count()) >= 1);
await page.goto(`http://localhost:${PORT}/index.html`);
await page.waitForSelector('main .ex');

// Día sin regla (martes de push) sin entrada
const martes = await page.evaluate(() => {
  const C = RodillaCalc;
  const filas = C.tablaDias(RODILLA_DATA.dias, Store.knee().days, PLAN);
  return filas.find((f) => f.dia === 'M' && f.rule === C.SIN_REGLA
    && !Rodilla.itemsHoy(f.fecha, () => {}).some((i) => i.dataset.rodItem === 'entrada')) || null;
});
if (!martes) check('Encontrado un día sin regla ni entrada', false);
else {
  l = await montar(martes.fecha);
  check(`Día sin regla (${martes.fecha}): solo chasquido y notas`, nombres(l).length === 1 && nombres(l)[0] === CHAS, JSON.stringify(l));
}

// Fuera de rango
check('Fuera de rango: vacío', (await montar('2026-01-05')).length === 0);

// Editar el dolor en la hoja lo guarda
await montar('2026-11-16');
await page.locator('#rod-test .ex', { hasText: TRAS }).click();
const campoDolor = page.locator('#sheet-content input[data-f="during"]');
await campoDolor.fill('3');
check('Dolor durante guardado en Store.knee().days',
  (await page.evaluate(() => Store.knee().days['2026-11-16'].during)) === 3);
await campoDolor.fill('15');
check('Valor fuera de 0-10 no se guarda y avisa',
  (await page.evaluate(() => Store.knee().days['2026-11-16'].during)) === 3
  && (await page.locator('#sheet-content .rod-err:visible').count()) === 1);
await campoDolor.fill('2');
await page.click('#sheet-close');
check('Cerrar con «Cerrar» llama a alCambiar', (await page.evaluate(() => window.__cambios)) === 1);
l = await montar('2026-11-16');
check('Etiqueta tras la sesión con resumen', /^2\/10/.test(l.find((x) => x[0] === TRAS)[1]), JSON.stringify(l));

// Chasquido y notas
await page.locator('#rod-test .ex', { hasText: CHAS }).click();
await page.locator('#sheet-content [data-f="click"] [data-seg="Sí"]').click();
await page.locator('#sheet-content textarea').fill('Chasquido al bajar');
await page.click('#sheet-content [data-rod-listo]');
const d = await page.evaluate(() => Store.knee().days['2026-11-16']);
check('Chasquido y notas guardados', d.click === 'Sí' && d.notes === 'Chasquido al bajar', JSON.stringify(d));
l = await montar('2026-11-16');
check('Etiqueta chasquido «Sí»', l.find((x) => x[0] === CHAS)[1] === 'Sí');

// 390 px sin scroll horizontal y objetivos táctiles
await page.locator('#rod-test .ex', { hasText: TRAS }).click();
const w = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth,
  document.getElementById('sheet-content').scrollWidth, document.getElementById('sheet-content').clientWidth]);
check('Sin scroll horizontal (390 px)', w[0] <= w[1] && w[2] <= w[3], JSON.stringify(w));
const h = await page.evaluate(() => [...document.querySelectorAll('#rod-test .ex, #sheet-content .rod-seg button, [data-rod-listo]')]
  .map((b) => b.getBoundingClientRect().height));
check('Objetivos táctiles >= 44 px', h.every((x) => x >= 44), JSON.stringify(h));
await page.click('#sheet-content [data-rod-listo]');

check('Sin errores de consola', errores.length === 0, errores.join(' | '));
await browser.close();
server.close();
console.log(fallos ? `\n${fallos} FALLOS` : '\nTodo OK');
process.exit(fallos ? 1 : 0);
