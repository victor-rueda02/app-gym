/* El plan de volumen que construye la app (js/plan.js, a partir del Excel empotrado)
   contra el volcado de openpyxl (docs/plan-rodilla/volcado.json, tools/volcado_excel.py).
   Genérico: localiza sesiones, ejercicios y textos por las etiquetas de la columna «App»
   (L), no por números de fila, así que sigue valiendo cuando el plan cambia.
   Lo propio de este bloque (S1, 52 -> 88…) está en tests/contenido.test.mjs.
       node tests/plan.test.mjs */
import assert from 'node:assert/strict';
import { cargar, leer } from './cargar.mjs';

const { PLAN } = cargar(['PLAN']);
const hoja = JSON.parse(leer('docs/plan-rodilla/volcado.json'))['Volumen (1910-1112)'];
const cell = (c, r) => (hoja[`${c}${r}`] ? String(hoja[`${c}${r}`].v ?? '') : '');
const app = (r) => PLAN.etiquetasApp(cell('L', r));
const MAX = Math.max(...Object.keys(hoja).map((k) => +k.replace(/^[A-Z]+/, '')));
const COLS = 'CDEFGHIJ';
const filas = (pred) => Array.from({ length: MAX }, (_, i) => i + 1).filter((r) => pred(app(r), r));
const ejercicios = Object.values(PLAN.BLOCK_VOL).flatMap((s) => s.exercises.map((x) => ({ s, x })));

let fallos = 0;
const test = (name, fn) => {
  try { fn(); console.log(`  OK  ${name}`); } catch (e) { fallos++; console.log(` FALLO ${name}\n        ${e.message}`); }
};

/* Esperado, desde el volcado: cada cabecera «sesion» con sus filas de ejercicio (las que
   tienen «id=»), y las filas de cardio («sesion=X») al final de su sesión. */
const esperado = {};
let actual = null;
for (let r = 1; r <= MAX; r++) {
  const e = app(r);
  if (e.sesion === true) { actual = /^\(([LMXJVSD])\)/.exec(cell('A', r))[1]; esperado[actual] = []; continue; }
  if (e.id && typeof e.sesion !== 'string' && actual) {
    esperado[actual].push({ r, name: cell('A', r).trim(), target: cell('B', r), id: e.id });
  } else if (typeof e.sesion === 'string') {
    (esperado[e.sesion] = esperado[e.sesion] || []).push({ r, name: cell('B', r).trim(), target: 'Cardio', id: e.id });
  }
  if (!cell('A', r) && !e.sesion) actual = null;
}

test('sesiones y ejercicios: nombre, objetivo, id, celdas S1-S8 y notas, en el orden de la hoja', () => {
  assert.deepEqual(Object.keys(PLAN.BLOCK_VOL), 'LMXJVSD'.split('').filter((l) => esperado[l]));
  for (const [l, filasEj] of Object.entries(esperado)) {
    const ejs = PLAN.BLOCK_VOL[l].exercises;
    assert.equal(ejs.length, filasEj.length, `sesión ${l}`);
    filasEj.forEach((f, i) => {
      const x = ejs[i];
      assert.deepEqual([x.name, x.target, x.id], [f.name, f.target, f.id], `${l} fila ${f.r}`);
      x.pres.forEach((p, w) => assert.equal(p.label, cell(COLS[w], f.r), `${l} ${COLS[w]}${f.r}`));
      assert.equal(x.notes, cell('K', f.r), `K${f.r}`);
    });
  }
});

test('cabeceras: nombre y título tras «(L) »; nombre de S1 desde «nombreS1»', () => {
  for (const r of filas((e) => e.sesion === true)) {
    const [, l, nombre, titulo] = /^\(([LMXJVSD])\)\s*([^·]+?)\s*(?:·\s*([\s\S]*))?$/.exec(cell('A', r));
    const s = PLAN.BLOCK_VOL[l];
    assert.deepEqual([s.name, s.title], [nombre.trim(), (titulo || '').trim()], `A${r}`);
    if (app(r).nombreS1) assert.equal(PLAN.sessionLabel(s, PLAN.VOL_WEEKS[0]).name, app(r).nombreS1);
  }
});

test('parsePres: formatos de las celdas', () => {
  const P = PLAN.parsePres;
  assert.deepEqual([P('—').kind, P('—').skip], ['none', true]);
  assert.deepEqual([P('-').kind, P('-').skip], ['none', undefined]);
  const a = P('3 x10-15\n@RIR1-2');
  assert.deepEqual([a.kind, a.sets, a.reps], ['fixed', 3, '10-15']);
  // «2-3 x»: se precargan 2 series; la tercera se añade a mano.
  assert.deepEqual([P('2-3 x15-20\n5-10 s fuera').sets, P('2-3 x15-20\n5-10 s fuera').setsMax], [2, 3]);
  const pp = P('2 x10/pierna\nnov: +1 escalón');
  assert.deepEqual([pp.kind, pp.sets, pp.reps], ['fixed', 2, 10]);
  assert.equal(P('2 aprox. +\n1 al fallo\npor pierna').sets, 3);
  assert.deepEqual([P('Opcional:\nrango completo').sets, P('Opcional:\nrango completo').optional], [3, true]);
  assert.deepEqual([P("10' Z2", 'Cardio').kind, P("10' Z2", 'Cardio').mins], ['cardio', 10]);
  assert.equal(P("N1 · 8×(1'/2')", 'Cardio').mins, '');
  assert.equal(P('—', 'Cardio').skip, true);
  assert.throws(() => P('algo raro'));
});

test('series por grupo: replica la tabla del Excel (suma del entero inicial de cada fila del grupo)', () => {
  const grupos = filas((e) => e.grupos).flatMap((r) => {
    const out = [];
    for (let f = r + 1; cell('A', f) && !cell('A', f).startsWith('TOTAL'); f++) out.push(cell('A', f));
    return out;
  });
  assert.deepEqual(PLAN.VOL_GRUPOS, grupos);
  for (let n = 1; n <= 8; n++) {
    const g = PLAN.seriesPorGrupo(n);
    for (const grupo of grupos) {
      const propio = filas((e, r) => e.id && cell('B', r) === grupo)
        .reduce((acc, r) => acc + (/^\d+ /.test(cell(COLS[n - 1], r)) ? +cell(COLS[n - 1], r).split(' ')[0] : 0), 0);
      assert.equal(g[grupo], propio, `${grupo} S${n}`);
    }
    assert.equal(g.TOTAL, grupos.reduce((a, k) => a + g[k], 0));
  }
  // Correctivos, cardio, rehab y test no son grupos: no suman.
  for (const { x } of ejercicios) {
    if (/correctivo|Cardio|Rehab|Test/.test(x.target)) assert.ok(!grupos.includes(x.target), x.target);
  }
});

test('D/I: los que dicen «/pierna» o «por pierna» desde S2 (salvo el test); solo desde S2', () => {
  for (const { s, x } of ejercicios) {
    const porPierna = x.target !== 'Test' && x.pres.slice(1).some((p) => /\/pierna|por pierna/.test(p.label));
    assert.equal(!!x.sides, porPierna, `${s.id} ${x.name}`);
    if (x.sides) {
      assert.equal(PLAN.sidesFor(x, PLAN.VOL_WEEKS[0]), false);
      assert.equal(PLAN.sidesFor(x, PLAN.VOL_WEEKS[1]), true);
    }
  }
});

test('el test de fuerza (objetivo «Test») es un enlace a Rodilla › Test', () => {
  const t = ejercicios.filter(({ x }) => x.target === 'Test');
  assert.ok(t.length >= 1);
  t.forEach(({ x }) => assert.deepEqual([x.link, x.sides], ['test', undefined]));
});

test('papel en la progresión: el de la etiqueta «escalera=» o «bici»', () => {
  for (let r = 1; r <= MAX; r++) {
    const e = app(r);
    if (!e.escalera && !e.bici) continue;
    const x = ejercicios.find((y) => y.x.id === e.id && (typeof e.sesion !== 'string' || y.s.id === `VOL-${e.sesion}`)).x;
    assert.equal(x.prog, e.bici ? 'bici' : e.escalera, `fila ${r}`);
  }
});

test('escaleras coherentes con sus celdas y días de cada una', () => {
  const prensa = ejercicios.find(({ x }) => x.prog === 'prensa');
  const carrera = ejercicios.find(({ x }) => x.prog === 'carrera');
  for (let n = 1; n <= 8; n++) {
    const p = PLAN.PRENSA_NIVELES[PLAN.PRENSA_MAX[n]];
    assert.ok(prensa.x.pres[n - 1].label.startsWith(`2 x${p.reps}`), `prensa S${n}`);
    const k = PLAN.CARRERA_MAX[n];
    const celda = carrera.x.pres[n - 1].label;
    assert.ok(k === 0 ? celda === '—' : celda === `N${k} · ${PLAN.CARRERA_NIVELES[k]}` || celda === `repite N${k}`, `carrera S${n}: ${celda}`);
  }
  // La semana de cada nivel de la prensa es la primera en que el calendario lo alcanza.
  PLAN.PRENSA_SEMANA.forEach((w, k) => assert.equal(PLAN.PRENSA_MAX[w], k));
  assert.equal(PLAN.ESCALERAS.prensa.dia, prensa.s.id.slice(-1));
  assert.equal(PLAN.ESCALERAS.carrera.dia, carrera.s.id.slice(-1));
  assert.ok(PLAN.ESCALERAS.bici.entrada.semana >= PLAN.SEMANA_SEGUIMIENTO);
});

test('domingo: su sesión si la tiene esa semana; si no, la del sábado', () => {
  for (const w of PLAN.VOL_WEEKS) {
    const domingo = PLAN.sessionFor(w.to).options[0];
    const tiene = PLAN.sessionsFor(w).some((s) => s.dow === 0);
    assert.equal(domingo.dow, tiene ? 0 : 6, `S${w.n}`);
  }
});

test('semanas: tantas como columnas, seguidas, desde el lunes de S1', () => {
  assert.equal(PLAN.VOL_WEEKS.length, 8);
  PLAN.VOL_WEEKS.forEach((w, i) => {
    assert.equal(new Date(`${w.from}T12:00:00Z`).getUTCDay(), 1, `S${i + 1} empieza en lunes`);
    if (i) assert.equal((new Date(w.from) - new Date(PLAN.VOL_WEEKS[i - 1].from)) / 864e5, 7);
  });
  assert.deepEqual([PLAN.PLANS[1].from, PLAN.PLANS[1].to], [PLAN.VOL_WEEKS[0].from, PLAN.VOL_WEEKS[7].to]);
});

test('textos: reglas, notas, hitos, cardio y reglas del bloque, por sus etiquetas', () => {
  assert.deepEqual(PLAN.VOL_RULES, filas((e) => e.regla).map((r) => cell('A', r)));
  assert.deepEqual(PLAN.VOL_NOTES, filas((e) => e.nota).map((r) => cell('A', r)));
  const h = filas((e) => e.hitos)[0];
  assert.deepEqual(PLAN.VOL_HITOS, [...COLS].map((c) => cell(c, h)));
  assert.equal(PLAN.VOL_HITOS_NOTE, cell('K', h));
  assert.equal(PLAN.VOL_CARDIO_TITLE, cell('A', filas((e) => e.cardio)[0]));
  const rb = filas((e) => e['reglas-bloque'])[0];
  assert.equal(PLAN.VOL_BLOCK_RULES_TITLE, cell('A', rb));
  const reglas = [];
  for (let f = rb + 1; cell('A', f); f++) reglas.push(cell('A', f));
  assert.deepEqual(PLAN.VOL_BLOCK_RULES, reglas);
});

console.log(fallos ? `\n${fallos} fallo(s)` : '\nTodo OK');
process.exit(fallos ? 1 : 0);
