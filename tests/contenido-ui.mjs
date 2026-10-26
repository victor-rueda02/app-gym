/* Contenido del plan de volumen tal y como lo pinta la app (iPhone 13 emulado),
   comparado con el volcado del Excel nuevo. Recoge todos los errores de consola.
       node tests/contenido-ui.mjs                                              */
import { chromium, devices } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const H = JSON.parse(fs.readFileSync(path.join(root, 'docs', 'plan-rodilla', 'volcado.json'), 'utf8'))['Volumen (1910-1112)'];
const c = (ref) => (H[ref] ? H[ref].v : undefined);
const COLS = [...'CDEFGHIJ'];

/* --- Esperado, del volcado --- */
const SES = [];   // { clave, label, ejercicios: [{ nombre, semanas[8] }] } en el orden de la hoja
for (let r = 1; r <= 70; r++) {
  const m = /^\(([LMXJVS])\) (\S+)\s+·\s*(.*)$/s.exec(c(`A${r}`) || '');
  if (!m) continue;
  const ej = [];
  for (let f = r + 2; c(`A${f}`) && c(`B${f}`); f++) ej.push({ nombre: c(`A${f}`).trim(), semanas: COLS.map((k) => c(`${k}${f}`)) });
  SES.push({ clave: m[1], label: `${m[2]} · ${m[3].trim()}`, titulo: m[3].trim(), ejercicios: ej });
}
const CARDIO = { M: 95, V: 96, X: 97 };
for (const s of SES) if (CARDIO[s.clave]) s.ejercicios.push({ nombre: c(`B${CARDIO[s.clave]}`), semanas: COLS.map((k) => c(`${k}${CARDIO[s.clave]}`)) });
SES.push({ clave: 'D', label: 'Domingo · Carrera', titulo: 'Carrera', desdeSemana: 2,
  ejercicios: [{ nombre: c('B98'), semanas: COLS.map((k) => c(`${k}98`)) }] });
const sesionesDe = (n) => SES.filter((s) => !s.desdeSemana || n >= s.desdeSemana);
const DOW = { L: 1, M: 2, X: 3, J: 4, V: 5, S: 6, D: 0 };
const inicioSemana = (n) => new Date(Date.UTC(2026, 9, 19 + 7 * (n - 1), 12));
const iso = (d) => d.toISOString().slice(0, 10);
const fechaDe = (n, dow) => iso(new Date(inicioSemana(n).getTime() + ((dow + 6) % 7) * 86400000));
// Sesión de una fecha: S1 el domingo repite el sábado; desde S2 el domingo es la carrera.
const sesionDe = (n, dow) => {
  if (n === 1 && dow === 0) return SES.find((s) => s.clave === 'S');
  return sesionesDe(n).find((s) => DOW[s.clave] === dow);
};

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
const PORT = 8131;
await new Promise((r) => server.listen(PORT, r));

let fallos = 0;
let total = 0;
const check = (nombre, ok, detalle = '') => {
  total++;
  if (!ok) fallos++;
  if (!ok || process.env.VERBOSE) console.log(`${ok ? '  OK  ' : ' FALLO'} ${nombre}${detalle ? ` — ${detalle}` : ''}`);
};
const igual = (nombre, a, b) => check(nombre, JSON.stringify(a) === JSON.stringify(b), JSON.stringify(a) === JSON.stringify(b) ? '' : `obtenido ${JSON.stringify(a)} · esperado ${JSON.stringify(b)}`);

const browser = await chromium.launch();
const ctx = await browser.newContext({ ...devices['iPhone 13'], locale: 'es-ES' });
const page = await ctx.newPage();
const errores = [];
page.on('pageerror', (e) => errores.push(`pageerror: ${e}`));
page.on('console', (m) => { if (m.type() === 'error') errores.push(`console.error: ${m.text()}`); });
await page.goto(`http://localhost:${PORT}/index.html`);
await page.waitForSelector('#view, main', { timeout: 10000 });

/* ---------- Plan: S1…S8 ---------- */
await page.click('[data-tab="plan"]');
await page.waitForSelector('[data-week]');
await page.click('[data-plan="vol"]');
for (let n = 1; n <= 8; n++) {
  await page.click(`[data-week="${n}"]`);
  await page.waitForFunction((k) => document.querySelector('main .card h2')?.textContent === `Semana ${k} · Volumen`, n);
  // Recorre main: etiquetas de sesión y filas .ex hasta el título de reglas.
  const dom = await page.evaluate(() => {
    const out = []; let cur = null;
    for (const el of document.querySelector('main').children) {
      if (el.classList.contains('section-label')) {
        if (el.textContent === 'Reglas') break;
        cur = { label: el.textContent, ex: [] }; out.push(cur);
      } else if (el.classList.contains('ex') && cur) {
        cur.ex.push({ nombre: el.querySelector('.nm').textContent, pres: el.querySelector('.pres').textContent, skip: el.classList.contains('skip') });
      }
    }
    return out;
  });
  const exp = sesionesDe(n);
  igual(`Plan S${n}: sesiones`, dom.map((d) => d.label), exp.map((s) => s.label));
  exp.forEach((s, i) => {
    const d = dom[i] || { ex: [] };
    igual(`Plan S${n} ${s.label.split(' ')[0]}: nombres`, d.ex.map((e) => e.nombre), s.ejercicios.map((e) => e.nombre));
    igual(`Plan S${n} ${s.label.split(' ')[0]}: prescripciones`, d.ex.map((e) => e.pres), s.ejercicios.map((e) => e.semanas[n - 1]));
    igual(`Plan S${n} ${s.label.split(' ')[0]}: «—» atenuado`, d.ex.map((e) => e.skip), s.ejercicios.map((e) => e.semanas[n - 1] === '—'));
  });
  // Hitos y avisos
  const hito = c(`${COLS[n - 1]}99`);
  const tarjeta = await page.evaluate(() => {
    const t = document.querySelector('main .card.hitos');
    return t ? { h2: t.querySelector('h2').textContent, ps: [...t.querySelectorAll('p')].map((p) => p.textContent) } : null;
  });
  if (hito === '—') check(`Plan S${n}: sin tarjeta «Hitos y avisos»`, tarjeta === null);
  else igual(`Plan S${n}: Hitos y avisos`, tarjeta && [tarjeta.h2, ...tarjeta.ps], ['Hitos y avisos', hito, c('K99')]);
  // Reglas del bloque
  const btn = page.locator('main .btn', { hasText: 'Reglas del bloque' });
  check(`Plan S${n}: botón «Reglas del bloque»`, (await btn.count()) === 1);
  if (n === 1 || n === 8) {
    await btn.click();
    await page.waitForSelector('#sheet .reglas-item', { state: 'visible' });
    const reglas = await page.locator('#sheet .reglas-txt').allTextContents();
    igual(`Plan S${n}: 12 reglas`, reglas.length, 12);
    reglas.forEach((t, i) => check(`Plan S${n}: regla ${i + 1} literal (A${102 + i})`, t.includes(c(`A${102 + i}`)) , t.slice(0, 60)));
    check(`Plan S${n}: título de las reglas`, (await page.textContent('#sheet-title')).trim().length > 0, await page.textContent('#sheet-title'));
    // etiquetas resaltadas
    check(`Plan S${n}: etiquetas resaltadas`, (await page.locator('#sheet .reglas-tag').count()) >= 10);
    await page.click('#sheet-close');
    await page.waitForSelector('#sheet', { state: 'hidden' });
  }
}
// Textos de A2/A64 y semanas 9-10 en el pie del Plan
await page.click('[data-week="2"]');
const pie = await page.textContent('main');
check('Plan: reglas A2 y A64', pie.includes(c('A2')) && pie.includes(c('A64')));
check('Plan: notas A66–A69', [66, 67, 68, 69].every((r) => pie.includes(c(`A${r}`))));

/* ---------- Hoy: todos los días de S1…S8 ---------- */
async function irA(fecha) {
  await page.click('[data-tab="today"]');
  await page.fill('#datepick', fecha);
  await page.waitForFunction((v) => document.getElementById('datepick').value === v, fecha);
  await page.waitForTimeout(40);
}
const leerHoy = () => page.evaluate(() => ({
  nombre: document.getElementById('hero-name').textContent,
  semana: document.querySelector('.hero .week').textContent,
  ex: [...document.querySelectorAll('main .ex')].map((e) => ({ nombre: e.querySelector('.nm').textContent, pres: e.querySelector('.pres').textContent })),
  hitos: (() => { const t = document.querySelector('main .card.hitos'); return t ? [...t.querySelectorAll('p')].map((p) => p.textContent) : null; })(),
}));
for (let n = 1; n <= 8; n++) {
  for (const dow of [1, 2, 3, 4, 5, 6, 0]) {
    const fecha = fechaDe(n, dow);
    await irA(fecha);
    const hoy = await leerHoy();
    const s = sesionDe(n, dow);
    const visibles = s.ejercicios.filter((e) => e.semanas[n - 1] !== '—');
    const tag = `Hoy ${fecha} (S${n}, ${s.label.split(' ')[0]})`;
    igual(`${tag}: semana`, hoy.semana, `Semana ${n} · Volumen`);
    igual(`${tag}: título`, hoy.nombre, s.titulo);
    igual(`${tag}: ejercicios (sin «—»)`, hoy.ex.map((e) => e.nombre), visibles.map((e) => e.nombre));
    igual(`${tag}: prescripciones`, hoy.ex.map((e) => e.pres), visibles.map((e) => e.semanas[n - 1]));
    check(`${tag}: ningún «—» visible`, !hoy.ex.some((e) => e.pres === '—'));
    const hito = c(`${COLS[n - 1]}99`);
    if (n === 1 || hito === '—') check(`${tag}: sin tarjeta de hitos`, hoy.hitos === null, JSON.stringify(hoy.hitos));
    else igual(`${tag}: hitos`, hoy.hitos, [hito, c('K99')]);
  }
}
// Casos pedidos de forma explícita
await irA('2026-11-08');
let h = await leerHoy();
igual('Hoy 2026-11-08 (domingo S2): solo la carrera', h.ex.map((e) => [e.nombre, e.pres]), [['Andar-correr en llano', c('D98')]]);
await irA('2026-10-25');
h = await leerHoy();
check('Hoy 2026-10-25 (domingo S1): es la sesión del sábado', h.nombre === SES.find((s) => s.clave === 'S').titulo && h.ex.length === 5, `${h.ex.length} ejercicios`);
await irA('2026-11-05');
h = await leerHoy();
check('Hoy 2026-11-05 (jueves S2): sin touchdown', !h.ex.some((e) => e.nombre === 'Touchdown squat'));
await irA('2026-11-07');
h = await leerHoy();
check('Hoy 2026-11-07 (sábado S2): sin abducción, touchdown ni búlgara', !h.ex.some((e) => /^(Abducción|Touchdown|Bulgarian)/.test(e.nombre)), h.ex.map((e) => e.nombre).join(' | '));

check('Sin errores de consola ni pageerror', errores.length === 0, [...new Set(errores)].join(' || '));
await browser.close();
server.close();
console.log(`\n${total - fallos}/${total} comprobaciones OK${errores.length ? ` · ${errores.length} errores de consola` : ''}`);
process.exit(fallos ? 1 : 0);
