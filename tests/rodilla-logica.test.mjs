/* Verificación independiente de la lógica del seguimiento de rodilla
   (js/rodilla-calc.js) contra las reglas de la revisión del 26/10 y contra las
   fórmulas reales del Excel (se evalúan con el paquete de Python `formulas`, si está
   instalado).
       node tests/rodilla-logica.test.mjs
   Para el contraste con el Excel hace falta `formulas` (ver PYPATH, más abajo);
   sin él, esa prueba se omite con un aviso. */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const leer = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const C = new Function(leer('js/rodilla-calc.js') + ';return RodillaCalc;')();
const D = new Function(leer('js/rodilla-data.js') + ';return RODILLA_DATA;')();

let fallos = 0; let total = 0;
const test = (name, fn) => {
  try { fn(); console.log(`  OK  ${name}`); } catch (e) { fallos++; console.log(` FALLO ${name}\n        ${e.message}`); }
};
const eq = (a, b, m) => { total++; assert.deepEqual(a, b, m); };

const G = D.reglas.gimnasio; const R = D.reglas.carrera; const N = D.reglas.ninguna;

/* ---------- 1. Semáforo: una fila por rama, escrita a partir de las reglas ---------- */
// [descripción, entrada, semáforo esperado]. Referencia (mañana) = 2 salvo que se diga.
const base = { rule: G, morning: 2, during: 1, back60: '', h24: 2, h48: 2 };
const CASOS = [
  ['día sin carga de rodilla', { rule: N, during: 9 }, '—'],
  ['sin «Durante»', { during: '' }, ''],
  ['sin referencia: no se evalúa', { morning: '' }, 'sin referencia'],
  ['sin referencia va antes que falta K', { rule: R, morning: '' }, 'sin referencia'],
  ['carrera sin el dato de 60 min', { rule: R }, 'falta K'],
  ['gimnasio: 3/10 durante está permitido', { during: 3 }, 'Avanzar'],
  ['gimnasio: más de 3/10 durante', { during: 4, h24: '', h48: '' }, 'Retroceder'],
  ['gimnasio: la mañana siguiente peor', { h24: 3, h48: '' }, 'Retroceder'],
  ['gimnasio: 24 h = referencia, 48 h peor', { h48: 3 }, 'Mantener'],
  ['gimnasio: peor 24-48 h = referencia', {}, 'Avanzar'],
  ['gimnasio: falta la mañana siguiente', { h24: '', h48: '' }, 'pendiente'],
  ['gimnasio: falta la de 48 h', { h48: '' }, 'pendiente'],
  ['carrera: 2/10 durante está permitido', { rule: R, back60: 'Sí', during: 2 }, 'Avanzar'],
  ['carrera: más de 2/10 durante', { rule: R, back60: 'Sí', during: 3 }, 'Retroceder'],
  ['carrera: no vuelve al nivel previo en 60 min', { rule: R, back60: 'No' }, 'Retroceder'],
  ['carrera: la mañana siguiente peor', { rule: R, back60: 'Sí', h24: 3 }, 'Retroceder'],
  ['carrera: 48 h peor que la referencia', { rule: R, back60: 'Sí', h48: 3 }, 'Mantener'],
  ['carrera: falta la de 48 h', { rule: R, back60: 'Sí', h48: '' }, 'pendiente'],
  ['regla vacía (editada) = gimnasio', { rule: '', during: 3 }, 'Avanzar'],
];
for (const [nombre, o, esperado] of CASOS) {
  test(`semáforo: ${nombre} -> «${esperado}»`, () => eq(C.semaforo({ ...base, ...o }), esperado));
}

test('semáforo en la tabla: 24/48 h de las mañanas siguientes; las dos últimas filas sin 48 h', () => {
  const t = C.tablaDias(D.dias, {
    '2026-12-24': { decline: 2, during: 1 }, '2026-12-25': { decline: 2 },
    '2026-12-26': { decline: 2 }, '2026-12-27': { decline: 2, during: 1, back60: 'Sí' },
  });
  const f = (d) => t.find((x) => x.fecha === d);
  eq([f('2026-12-24').h24, f('2026-12-24').h48, f('2026-12-24').semaforo], [2, 2, 'Avanzar']);
  eq([f('2026-12-27').h24, f('2026-12-27').semaforo], ['', 'pendiente']);
});

test('«sesiones que no cumplen» solo cuenta «Retroceder»', () => {
  const r = C.resumenSemana(['Retroceder', 'Mantener', 'pendiente', 'Avanzar', 'Retroceder']
    .map((s) => ({ sem: 'S3', semaforo: s, morning: 1 })), 'S3');
  eq(r.retroceder, 2);
});

test('aviso S4: umbral de ±0,5 sobre las medias redondeadas, desde el 15/11 y con 5 mañanas', () => {
  const s = (media, mananas = 5) => ({ media, mananas });
  eq(C.avisoS4(s(1), s(3), '2026-11-14').nivel, 'pendiente');
  eq(C.avisoS4(s(1, 4), s(3), '2026-11-15').nivel, 'pendiente');
  eq(C.avisoS4(s(1), s(1.5), '2026-11-15').nivel, 'peor');
  eq(C.avisoS4(s(1), s(1.4), '2026-11-15').nivel, 'igual');
  eq(C.avisoS4(s(1.5), s(1), '2026-11-15').nivel, 'mejor');
  eq(C.avisoS4(s(2.4), s(2.9), '2026-12-01').nivel, 'peor');   // 2,9 − 2,4 en coma flotante
});

test('test de fuerza: estimadas redondeadas a un decimal, simetría y ≥90 %', () => {
  const t = C.calcularTest({ load: 30, repsD: 33, repsI: 40 });
  eq([t.estD, t.estI, t.ok], [63, 70, 'Sí']);
  eq(C.calcularTest({ load: 30, repsD: 32, repsI: 40 }).ok, 'No');
});

/* ---------- 2. Contraste con las fórmulas reales del Excel ---------- */
// `formulas` no es dependencia del repo: se instala aparte, p. ej.
//   pip install --target tools/out/py formulas
// (tools/out/ no se versiona) o en otra carpeta indicada con RODILLA_PY.
const PYPATH = process.env.RODILLA_PY || path.join(root, 'tools', 'out', 'py');

// Datos que recorren todas las ramas del semáforo en gimnasio y en carrera.
const KNEE = {
  days: {
    '2026-10-26': { during: 3 },                                         // L: sin referencia
    '2026-10-27': { decline: 1, steps: 2, during: 2 },                   // M: «—»
    '2026-10-28': { decline: 2, steps: 2, during: 2, back60: 'Sí' },     // X: Mantener (48 h peor)
    '2026-10-29': { decline: 1, steps: 0, during: 1 },                   // J: Retroceder (24 h)
    '2026-10-30': { decline: 3, steps: 1, during: 4 },                   // V: «—»
    '2026-10-31': { decline: 2, click: 'Sí' },
    '2026-11-01': { steps: 4, during: 2, back60: 'No' },                 // D: Retroceder (K = No)
    '2026-11-02': { decline: 2, steps: 2, during: 2 },                   // L: Mantener
    '2026-11-03': { decline: 2, steps: 2 },
    '2026-11-04': { decline: 3, steps: 2, during: 1 },                   // X: falta K
    '2026-11-05': { decline: 2, steps: 2, during: 2 },                   // J: pendiente (sin 24 h)
    '2026-11-07': { decline: 1, steps: 1, during: 1, rule: R, back60: 'Sí', click: 'Sí' },   // S editado: Avanzar
    '2026-11-08': { decline: 1, steps: 1, during: 3, back60: 'Sí' },     // D: Retroceder (durante)
    '2026-11-09': { decline: 1, steps: 1, during: 3 },                   // L: Avanzar
    '2026-11-10': { decline: 1, steps: 1, during: 0 },
    '2026-11-11': { decline: 1, steps: 1, during: 2, back60: 'Sí' },     // X: Retroceder (24 h)
    '2026-11-12': { decline: 3, steps: 3, during: 1 },                   // J: pendiente (sin 48 h)
    '2026-11-13': { decline: 2, steps: 1, during: 3 },
    '2026-11-16': { decline: 2 },                                        // L: sin «Durante»
    '2026-12-25': { decline: 1, steps: 1, during: 1 },
    '2026-12-26': { decline: 2, steps: 0, during: 1 },
    '2026-12-27': { decline: 0, steps: 0, during: 0, back60: 'Sí', click: 'Sí' },   // D: pendiente
  },
  entry: { S2: { walkPain: 'Sí', walkBack60: 'Sí', tdPain: 'No', hopsPain: 'Sí' } },
  tests: {
    t1: { load: 80, repsD: 8, repsI: 9 }, t2: { load: 30, repsD: 33, repsI: 40 },
    t3: { load: 50, repsD: 6 }, t4: { load: 30, repsD: 32, repsI: 40 },
  },
};

const PYSRC = `
import sys, json
sys.path.insert(0, sys.argv[2])
import formulas
m = formulas.ExcelModel().loads(sys.argv[1]).finish()
sol = m.calculate()
def get(ref):
    hoja, celda = ref.split("!") if "!" in ref else ("Seguimiento rodilla", ref)
    for k, v in sol.items():
        if k.upper().endswith(hoja.upper() + "'!" + celda):
            x = v.value[0][0]
            if hasattr(x, 'item'): x = x.item()
            if x is None or str(x) in ('', 'empty'): return ''
            return x if isinstance(x, (int, float, str, bool)) else str(x)
    return None
refs = json.loads(sys.argv[3])
print("@@" + json.dumps({r: get(r) for r in refs}, ensure_ascii=False))
`;

test('contraste con las fórmulas del Excel (evaluadas con «formulas»)', () => {
  const probe = spawnSync('python', ['-c', 'import sys; sys.path.insert(0, sys.argv[1]); import formulas', PYPATH], { encoding: 'utf8' });
  if (probe.status !== 0) {
    console.log(`  --   AVISO: el paquete de Python «formulas» no está disponible en ${PYPATH}; se omite el contraste con el Excel`);
    return;
  }
  const src = ['vendor/fflate.js', 'js/plan.js', 'js/original-xlsx.js', 'js/xlsx.js', 'js/export.js'].map(leer).join('\n;\n');
  const load = new Function(`const Store = { all: () => ({}) };\n${src}\n;return { build: (rows, knee) => buildXlsx(originalXlsxBytes(), rows, knee) };`)();
  const bytes = load.build([], KNEE);
  const outDir = path.join(root, 'tools', 'out');
  fs.mkdirSync(outDir, { recursive: true });
  const file = path.join(outDir, 'rodilla-logica.xlsx');
  fs.writeFileSync(file, Buffer.from(bytes));

  // El Excel usa TODAY() en el aviso de S4: se compara con la fecha real de hoy.
  const d = new Date();
  const hoy = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const tabla = C.tablaDias(D.dias, KNEE.days);
  const exp = {};
  tabla.forEach((f, i) => {
    const r = 5 + i;
    exp['I' + r] = f.morning; exp['M' + r] = f.h24; exp['N' + r] = f.h48; exp['O' + r] = f.worst; exp['P' + r] = f.semaforo;
  });
  D.semanas.forEach((s, i) => {
    const r = 72 + i; const x = C.resumenSemana(tabla, s);
    exp['B' + r] = x.media; exp['E' + r] = x.peor; exp['F' + r] = x.retroceder; exp['G' + r] = x.chasquidos;
  });
  const sem = Object.fromEntries(C.resumenes(tabla, D.semanas).map((x) => [x.sem, x]));
  exp.E81 = C.avisoS2(tabla).texto;
  exp.E82 = C.avisoS4(sem.S2, sem.S4, hoy).texto;
  exp.E83 = C.avisoChasquido(tabla).texto;
  const e = C.entradaSemana(tabla, 'S2', KNEE.entry.S2);
  exp.F89 = e.manana; exp.H89 = e.c1; exp.H90 = e.c2; exp.H91 = e.c3; exp.H92 = e.texto;
  [97, 98, 99, 100].forEach((r, i) => {
    const t = C.calcularTest(KNEE.tests['t' + (i + 1)]);
    exp['I' + r] = t.estD; exp['J' + r] = t.estI; exp['K' + r] = t.sim; exp['L' + r] = t.ok;
  });

  // Tabla de series por grupo (hoja Volumen), sin fórmulas matriciales: 52 -> 88.
  [52, 57, 62, 66, 71, 76, 80, 88].forEach((n, i) => { exp[`Volumen (1910-1112)!${'CDEFGHIJ'[i]}83`] = n; });

  const res = spawnSync('python', ['-X', 'utf8', '-c', PYSRC, file, PYPATH, JSON.stringify(Object.keys(exp))], { encoding: 'utf8', maxBuffer: 1 << 26, timeout: 300000 });
  const line = (res.stdout || '').split(/\r?\n/).find((l) => l.startsWith('@@'));
  assert.ok(line, 'el motor de fórmulas no devolvió resultados: ' + (res.stderr || '').split('\n').slice(-4).join(' | '));
  const xl = JSON.parse(line.slice(2));
  const dif = [];
  const norm = (v) => (v === null || v === undefined ? '' : v);
  for (const [ref, x] of Object.entries(exp)) {
    total++;
    const a = norm(xl[ref]);
    const ok = typeof x === 'number' && typeof a === 'number' ? Math.abs(x - a) < 1e-9 : x === a;
    if (!ok) dif.push(`${ref}: Excel=${JSON.stringify(a)} RodillaCalc=${JSON.stringify(x)}`);
  }
  const cubiertos = new Set(tabla.filter((f) => f.semaforo !== '—').map((f) => (f.rule === R ? 'C:' : 'G:') + f.semaforo));
  for (const k of ['C:Avanzar', 'C:Mantener', 'C:Retroceder', 'C:falta K', 'C:pendiente',
    'G:Avanzar', 'G:Mantener', 'G:Retroceder', 'G:pendiente', 'G:sin referencia', 'G:']) {
    total++; if (!cubiertos.has(k)) dif.push(`datos de prueba sin cubrir la rama ${k}`);
  }
  console.log(`       ${Object.keys(exp).length} celdas comparadas; ramas: ${[...cubiertos].sort().join(' · ')}`);
  console.log(`       avisos: ${exp.E81} | ${exp.E82} | ${exp.H92}`);
  assert.equal(dif.length, 0, dif.join('\n        '));
});

console.log(`\n${total - fallos}/${total} comprobaciones, ${fallos} pruebas con fallo`);
process.exit(fallos ? 1 : 0);
