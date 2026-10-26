/* Pruebas del plan (js/plan.js) contra el volcado del Excel nuevo.
       node tests/plan.test.mjs */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const src = fs.readFileSync(path.join(root, 'js', 'plan.js'), 'utf8');
const PLAN = new Function(src + ';return PLAN;')();
const hoja = JSON.parse(fs.readFileSync(path.join(root, 'docs', 'plan-rodilla', 'volcado.json'), 'utf8'))['Volumen (1910-1112)'];
const cell = (c, r) => (hoja[`${c}${r}`] ? hoja[`${c}${r}`].v : '');

let fallos = 0;
const test = (name, fn) => {
  try { fn(); console.log(`  OK  ${name}`); } catch (e) { fallos++; console.log(` FALLO ${name}\n        ${e.message}`); }
};

// [clave, primera fila, última fila de ejercicios, fila del cardio que va al final]
const SESIONES = [
  ['L', 6, 12, null], ['M', 16, 20, 95], ['X', 25, 31, 97],
  ['J', 35, 42, null], ['V', 46, 53, 96], ['S', 57, 63, null],
];
const COLS = 'CDEFGHIJ';
const filasDe = (a, b, c) => Array.from({ length: b - a + 1 }, (_, i) => a + i).concat(c ? [c] : []);

test('todas las celdas C–J se interpretan y la etiqueta es idéntica a la celda', () => {
  let n = 0;
  const filas = SESIONES.flatMap(([, a, b, c]) => filasDe(a, b, c).map((r) => [r, r === c ? 'Cardio' : cell('B', r)]));
  filas.push([98, 'Cardio']);
  for (const [r, objetivo] of filas) {
    for (const col of COLS) {
      const texto = cell(col, r);
      assert.equal(PLAN.parsePres(texto, objetivo).label, texto, `${col}${r}`);
      n++;
    }
  }
  assert.equal(n, filas.length * 8);
});

test('parsePres: formatos nuevos', () => {
  const P = PLAN.parsePres;
  assert.deepEqual([P('—').kind, P('—').skip], ['none', true]);
  assert.deepEqual([P('-').kind, P('-').skip], ['none', undefined]);
  const a = P('3 x10-15\n@RIR1-2');
  assert.deepEqual([a.kind, a.sets, a.reps], ['fixed', 3, '10-15']);
  // «2-3 x»: se precargan 2 series; la tercera se añade a mano.
  assert.deepEqual([P('2-3 x15-20\n5-10 s fuera').sets, P('2-3 x15-20\n5-10 s fuera').setsMax], [2, 3]);
  assert.equal(P('2 x10\nnov: +1 escalón').reps, 10);
  const pp = P('2 x10/pierna\nnov: +1 escalón');
  assert.deepEqual([pp.kind, pp.sets, pp.reps], ['fixed', 2, 10]);
  assert.equal(P('3 x10-15/pierna\n@RIR1-2').reps, '10-15');
  assert.equal(P('2 aprox. +\n1 al fallo\npor pierna').sets, 3);
  const op = P('Opcional:\nrango completo');
  assert.deepEqual([op.kind, op.sets, op.optional], ['fixed', 3, true]);
  assert.deepEqual([P("10' Z2", 'Cardio').kind, P("10' Z2", 'Cardio').mins], ['cardio', 10]);
  assert.equal(P('15 min', 'Cardio').mins, 15);
  assert.equal(P("N1 · 8×(1'/2')", 'Cardio').mins, '');
  assert.equal(P('repite el\nmiércoles', 'Cardio').kind, 'cardio');
  assert.equal(P('—', 'Cardio').skip, true);
  assert.throws(() => P('algo raro'));
});

test('nombres, objetivos, orden de filas y celdas coinciden con la hoja', () => {
  for (const [key, a, b, c] of SESIONES) {
    const ejs = PLAN.BLOCK_VOL[key].exercises;
    const filas = filasDe(a, b, c);
    assert.equal(ejs.length, filas.length, key);
    filas.forEach((r, i) => {
      if (r === c) {
        assert.equal(ejs[i].name, cell('B', r));
        assert.equal(ejs[i].target, 'Cardio');
      } else {
        assert.equal(ejs[i].name, cell('A', r).trim());
        assert.equal(ejs[i].target, cell('B', r));
      }
      ejs[i].pres.forEach((p, w) => assert.equal(p.label, cell(COLS[w], r), `${key} fila ${r} S${w + 1}`));
    });
  }
  const dom = PLAN.BLOCK_VOL.D.exercises;
  assert.equal(dom.length, 1);
  assert.equal(dom[0].name, cell('B', 98));
  assert.equal(dom[0].target, 'Cardio');
});

test('seriesPorGrupo da 52, 57, 62, 66, 71, 76, 80, 88', () => {
  [52, 57, 62, 66, 71, 76, 80, 88].forEach((t, i) => assert.equal(PLAN.seriesPorGrupo(i + 1).TOTAL, t, `S${i + 1}`));
});

test('seriesPorGrupo: ni correctivos, ni cardio, ni rehab, ni test cuentan', () => {
  for (let n = 1; n <= 8; n++) {
    const g = PLAN.seriesPorGrupo(n);
    assert.deepEqual(Object.keys(g), [...PLAN.VOL_GRUPOS, 'TOTAL']);
    assert.equal(Object.values(g).slice(0, -1).reduce((a, b) => a + b, 0), g.TOTAL);
  }
  const objetivos = new Set(Object.values(PLAN.BLOCK_VOL).flatMap((s) => s.exercises.map((e) => e.target)));
  for (const o of ['Hombro (correctivo)', 'Codo (correctivo)', 'Cardio', 'Rehab', 'Rehab (cadera)', 'Test']) {
    assert.ok(objetivos.has(o), o);
    assert.ok(!PLAN.VOL_GRUPOS.includes(o), o);
  }
});

test('sessionFor / sessionsFor dependen de la semana', () => {
  const id = (d) => PLAN.sessionFor(d).options[0].id;
  assert.equal(id('2026-10-25'), 'VOL-S');   // domingo de S1 = sesión del sábado
  assert.equal(id('2026-10-24'), 'VOL-S');
  assert.equal(id('2026-11-01'), 'VOL-D');   // domingo de S2 = carrera
  assert.equal(id('2026-11-07'), 'VOL-S');
  const x = PLAN.sessionFor('2026-10-28').options[0];
  assert.equal(x.id, 'VOL-X');
  assert.deepEqual([x.exercises.at(-1).name, x.exercises.at(-1).target], ['Andar-correr en llano', 'Cardio']);
  const ids = (n) => PLAN.sessionsFor(PLAN.VOL_WEEKS[n - 1]).map((s) => s.id);
  assert.ok(!ids(1).includes('VOL-D'));
  assert.deepEqual(ids(2), ['VOL-L', 'VOL-M', 'VOL-X', 'VOL-J', 'VOL-V', 'VOL-S', 'VOL-D']);
  assert.equal(PLAN.BLOCK_VOL.S.name, 'Sábado');
});

test('las etiquetas de S1 de cada sesión coinciden con la columna C del volcado', () => {
  for (const [key, a, b, c] of SESIONES) {
    const plan = PLAN.BLOCK_VOL[key].exercises.map((e) => PLAN.presFor(e, PLAN.VOL_WEEKS[0]).label);
    assert.deepEqual(plan, filasDe(a, b, c).map((r) => cell('C', r)), key);
  }
});

test('sidesFor: solo unilaterales y solo desde S2', () => {
  const marcados = Object.values(PLAN.BLOCK_VOL)
    .flatMap((s) => s.exercises.filter((e) => e.sides).map((e) => `${s.id}|${e.name}`)).sort();
  assert.deepEqual(marcados, [
    'VOL-J|Abducción de pie unilateral (máquina)',
    'VOL-J|Bulgarian split squat',
    'VOL-L|Abducción de pie unilateral (máquina)',
    'VOL-L|Prensa unil · pesado y lento n.º 1',
    'VOL-L|Touchdown squat',
  ].sort());
  const ej = PLAN.BLOCK_VOL.L.exercises[1];
  assert.equal(PLAN.sidesFor(ej, PLAN.VOL_WEEKS[0]), false);
  assert.equal(PLAN.sidesFor(ej, PLAN.VOL_WEEKS[1]), true);
  assert.equal(PLAN.sidesFor(PLAN.BLOCK_VOL.M.exercises[0], PLAN.VOL_WEEKS[3]), false);
  assert.equal(PLAN.sidesFor(PLAN.BLOCK_A.L.exercises[2], PLAN.WEEKS[0]), false);
});

test('unilaterales: «/pierna» de S2 a S8 y S1 sin tocar', () => {
  for (const s of Object.values(PLAN.BLOCK_VOL)) {
    for (const e of s.exercises.filter((x) => x.sides)) {
      e.pres.slice(1).forEach((p, i) => assert.ok(p.skip || /\/pierna|por pierna/.test(p.label), `${e.name} S${i + 2}`));
      assert.ok(!e.pres[0].label.includes('/pierna'), `${e.name} S1`);
    }
  }
});

test('el test de fuerza es un enlace a Rodilla › Test, sin D/I', () => {
  const t = PLAN.BLOCK_VOL.J.exercises[0];
  assert.deepEqual([t.link, t.sides, t.target], ['test', undefined, 'Test']);
});

test('escaleras de progresión coherentes con las celdas del calendario', () => {
  const prensa = PLAN.BLOCK_VOL.L.exercises.find((e) => e.prog === 'prensa');
  const carrera = PLAN.BLOCK_VOL.X.exercises.find((e) => e.prog === 'carrera');
  for (let n = 2; n <= 8; n++) {
    const p = PLAN.PRENSA_NIVELES[PLAN.PRENSA_MAX[n]];
    assert.ok(prensa.pres[n - 1].label.startsWith(`2 x${p.reps}/pierna`), `prensa S${n}`);
    const k = PLAN.CARRERA_MAX[n];
    const celda = carrera.pres[n - 1].label;
    assert.ok(celda === `N${k} · ${PLAN.CARRERA_NIVELES[k]}` || celda === `repite N${k}`, `carrera S${n}: ${celda}`);
  }
  // Escalones: +1 en S3, S4, S6 y S7; reps x10 en S2 y x8 en S5.
  assert.deepEqual([2, 3, 4, 5, 6, 7, 8].map((n) => PLAN.PRENSA_NIVELES[PLAN.PRENSA_MAX[n]].esc), [0, 1, 2, 2, 3, 4, 4]);
  // Nivel intermedio: el tramo continuo más largo pasa de 5 a 8 y a 12 min.
  assert.deepEqual(PLAN.CARRERA_NIVELES.slice(4, 7), ["4×(5'/1')", "3×(8'/1')", "2×(12'/1')"]);
  // Después del viaje: 12 -> 18 -> 25 -> 30 min seguidos (como mucho +50 % por nivel).
  assert.deepEqual(PLAN.CARRERA_NIVELES.slice(7), ["18' seguidos", "25' seguidos", "30' seguidos"]);
});

test('el sábado de S1 conserva su nombre (aún tenía pierna)', () => {
  const s = PLAN.BLOCK_VOL.S;
  assert.deepEqual([PLAN.sessionLabel(s, PLAN.VOL_WEEKS[0]).name, PLAN.sessionLabel(s, PLAN.VOL_WEEKS[0]).title], ['Sábado/Domingo', '']);
  assert.ok(PLAN.sessionLabel(s, PLAN.VOL_WEEKS[1]).title.includes('desde S2, sin pierna'));
});

test('hitos, nota de hitos y reglas del bloque, como en el volcado', () => {
  assert.equal(PLAN.VOL_HITOS.length, 8);
  PLAN.VOL_HITOS.forEach((h, i) => assert.equal(h, cell(COLS[i], 99)));
  assert.equal(PLAN.VOL_HITOS_NOTE, cell('K', 99));
  assert.equal(PLAN.VOL_BLOCK_RULES.length, 12);
  PLAN.VOL_BLOCK_RULES.forEach((r, i) => assert.equal(r, cell('A', 102 + i)));
});

console.log(fallos ? `\n${fallos} fallo(s)` : '\nTodo OK');
process.exit(fallos ? 1 : 0);
