/* Verificación independiente de la lógica del seguimiento de rodilla
   (js/rodilla-calc.js) contra la especificación y contra las fórmulas reales del
   Excel (se evalúan con el paquete de Python `formulas`, si está instalado).
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
const cm = (o) => C.cumple({ rule: G, morning: 3, during: 1, back60: '', h24: 2, worst: 3, ...o });

/* ---------- 1. cumple() directa ---------- */
test('cumple: vacío si no hay «Durante» (aunque falte todo lo demás)', () => {
  for (const d of ['', undefined, null]) eq(cm({ during: d }), '');
  eq(cm({ during: '', morning: '' }), '');
  eq(cm({ during: '', rule: R, back60: '' }), '');
});
test('cumple: sin referencia / falta K / pendiente (orden de la cascada)', () => {
  eq(cm({ morning: '' }), 'sin referencia');
  eq(cm({ morning: '', rule: R, back60: '' }), 'sin referencia'); // referencia antes que K
  eq(cm({ rule: R, back60: '' }), 'falta K');
  eq(cm({ rule: R, back60: '', worst: '' }), 'falta K');          // K antes que pendiente
  eq(cm({ worst: '' }), 'pendiente');
  eq(cm({ rule: N, worst: '' }), 'pendiente');
  eq(cm({ rule: R, back60: 'Sí', worst: '' }), 'pendiente');
  eq(cm({ rule: R, back60: 'No', worst: '' }), 'pendiente');
  eq(cm({ back60: '', rule: G }), 'Sí'); // K no se pide fuera de carrera
});
test('cumple: carrera, Sí y No por cada condición, y bordes', () => {
  const c = (o) => cm({ rule: R, during: 2, back60: 'Sí', morning: 3, h24: 3, worst: 3, ...o });
  eq(c({}), 'Sí');
  eq(c({ during: 3 }), 'No');          // durante > 2
  eq(c({ during: 2 }), 'Sí'); eq(c({ during: 0 }), 'Sí'); eq(c({ during: 1 }), 'Sí');
  eq(c({ back60: 'No' }), 'No');       // nivel previo
  eq(c({ h24: 4, worst: 4 }), 'No');   // 24 h > ref
  eq(c({ h24: 4, worst: 3 }), 'No');   // 24 h > ref aunque worst no lo refleje
  eq(c({ h24: 3, worst: 4 }), 'No');   // peor > ref
  eq(c({ h24: 3, worst: 3 }), 'Sí');   // = ref
  eq(c({ h24: 2, worst: 3 }), 'Sí');
  eq(c({ h24: 0, worst: 0, morning: 0 }), 'Sí');
});
test('cumple: gimnasio, Sí y No por cada condición, y bordes', () => {
  const g = (o) => cm({ rule: G, during: 3, morning: 3, h24: 9, worst: 3, ...o });
  eq(g({}), 'Sí');                     // 24 h no cuenta aparte en gimnasio (worst lo incluye)
  eq(g({ during: 4 }), 'No');
  eq(g({ during: 3 }), 'Sí'); eq(g({ during: 2 }), 'Sí'); eq(g({ during: 0 }), 'Sí');
  eq(g({ worst: 4 }), 'No');
  eq(g({ worst: 3 }), 'Sí');
  eq(g({ worst: 2, morning: 2, during: 3 }), 'Sí');
  eq(g({ morning: 2, worst: 3 }), 'No');
  eq(g({ back60: 'No' }), 'Sí');       // K ignorado
});
test('cumple: la regla «—» se evalúa como gimnasio', () => {
  eq(cm({ rule: N, during: 3 }), 'Sí');
  eq(cm({ rule: N, during: 4 }), 'No');
  eq(cm({ rule: N, during: 3, back60: '' }), 'Sí');
  eq(cm({ rule: '', during: 3 }), 'Sí');
});
test('cumple: regla editada por el usuario cambia la rama (tablaDias)', () => {
  const dias = [0, 1, 2].map((i) => ({ fecha: `2026-10-${26 + i}`, dia: 'L', sem: 'S2', sesion: 's', regla: G, novedad: 'n' }));
  const reg = (rule) => ({
    '2026-10-26': { decline: 3, steps: 2, during: 3, back60: 'Sí', ...(rule !== undefined ? { rule } : {}) },
    '2026-10-27': { decline: 3 }, '2026-10-28': { decline: 3 },
  });
  eq(C.tablaDias(dias, reg())[0].cumple, 'Sí');          // plan: gimnasio, 3 ≤ 3
  eq(C.tablaDias(dias, reg(R))[0].cumple, 'No');         // editada a carrera: 3 > 2
  eq(C.tablaDias(dias, reg(R))[0].rule, R);
  const sinK = { ...reg(R) }; sinK['2026-10-26'] = { ...sinK['2026-10-26'], back60: '', during: 1 };
  eq(C.tablaDias(dias, sinK)[0].cumple, 'falta K');
  const aGim = [{ ...dias[0], regla: R }, dias[1], dias[2]];
  eq(C.tablaDias(aGim, reg())[0].cumple, 'No');          // plan carrera
  eq(C.tablaDias(aGim, reg(G))[0].cumple, 'Sí');         // editada a gimnasio
  eq(C.tablaDias(aGim, reg(''))[0].cumple, 'Sí');        // regla vaciada = gimnasio
  eq(C.tablaDias(aGim, reg(N))[0].cumple, 'Sí');
});

/* ---------- 1b. cadena tablaDias con registro realista ---------- */
const dia = (i) => D.dias[i];
test('calendario: 63 días consecutivos 26/10-27/12', () => {
  eq(D.dias.length, 63); eq(D.dias[0].fecha, '2026-10-26'); eq(D.dias[62].fecha, '2026-12-27');
  for (let i = 1; i < 63; i++) eq(Date.parse(D.dias[i].fecha) - Date.parse(D.dias[i - 1].fecha), 86400000);
});
test('tablaDias: 24 h/48 h de las filas siguientes; últimas filas sin 48 h', () => {
  const reg = {};
  // días 0..7 con datos; luego 3 vacíos; y los tres últimos del calendario
  const m = [[2, 3], [1, 4], [2, ''], ['', 5], [0, 0], [3, 3], [1, 2], [2, 2]];
  m.forEach(([d, s], i) => { reg[D.dias[i].fecha] = { decline: d, steps: s, during: 1, back60: 'Sí' }; });
  reg['2026-12-25'] = { decline: 1, steps: 1, during: 1 };
  reg['2026-12-26'] = { decline: 2, steps: 0, during: 1 };
  reg['2026-12-27'] = { decline: 0, steps: 0, during: 1, back60: 'Sí' };
  const t = C.tablaDias(D.dias, reg);
  eq(t.length, 63);
  eq(t.slice(0, 8).map((x) => x.morning), [3, 4, 2, 5, 0, 3, 2, 2]);
  eq(t.slice(0, 8).map((x) => x.h24), [4, 2, 5, 0, 3, 2, 2, '']);
  eq(t.slice(0, 8).map((x) => x.h48), [2, 5, 0, 3, 2, 2, '', '']);
  eq(t.slice(0, 8).map((x) => x.worst), [4, 5, 5, 3, 3, 2, '', '']);
  eq(t[7].morning, 2); eq(t[7].h24, ''); eq(t[7].cumple, 'pendiente');
  eq(t[6].cumple, 'pendiente');     // el día siguiente existe pero el de dos después está en blanco
  eq(t.slice(0, 8).map((x) => x.cumple), ['No', 'No', 'No', 'Sí', 'No', 'Sí', 'pendiente', 'pendiente']);
  eq(t.slice(8, 60).every((x) => x.cumple === '' && x.morning === ''), true);
  eq([60, 61, 62].map((i) => t[i].fecha), ['2026-12-25', '2026-12-26', '2026-12-27']);
  eq([60, 61, 62].map((i) => t[i].h24), [2, 0, '']);
  eq([60, 61, 62].map((i) => t[i].h48), [0, '', '']);   // penúltima y última sin 48 h
  eq([60, 61, 62].map((i) => t[i].cumple), ['No', 'pendiente', 'pendiente']);
  // día del registro con solo «Durante» y sin mañana: sin referencia (hueco en medio)
  const t2 = C.tablaDias(D.dias, { '2026-10-26': { during: 1 }, '2026-10-27': { decline: 1 }, '2026-10-28': { steps: 1 } });
  eq(t2[0].cumple, 'sin referencia');
  // una sola prueba de la mañana basta como referencia y como 24 h/48 h
  const t3 = C.tablaDias(D.dias, { '2026-10-26': { decline: 2, during: 3 }, '2026-10-27': { steps: 2 }, '2026-10-28': { decline: 1 } });
  eq(t3[0].morning, 2); eq(t3[0].h24, 2); eq(t3[0].h48, 1); eq(t3[0].cumple, 'Sí');
  // 24 h = referencia cumple; 24 h = referencia + 1 no cumple
  const par = (r, h24, h48) => C.tablaDias(D.dias, { '2026-10-26': { decline: r, during: 1 }, '2026-10-27': { decline: h24 }, '2026-10-28': { decline: h48 } })[0].cumple;
  eq(par(3, 3, 0), 'Sí'); eq(par(3, 4, 0), 'No'); eq(par(3, 0, 3), 'Sí'); eq(par(3, 0, 4), 'No');
  eq(par(3, 3, ''), 'pendiente'); eq(par('', 3, 3), 'sin referencia');
  const sin24 = C.tablaDias(D.dias, { '2026-10-26': { decline: 3, during: 1 }, '2026-10-28': { decline: 1 } })[0];
  eq(sin24.h24, ''); eq(sin24.h48, 1); eq(sin24.cumple, 'pendiente');   // falta el de 24 h
  // carrera en cadena (28/10 es carrera en el plan): durante 2/3, K, 24 h
  const car = (o, h24 = 2) => C.tablaDias(D.dias, { '2026-10-28': { decline: 2, during: 2, back60: 'Sí', ...o }, '2026-10-29': { decline: h24 }, '2026-10-30': { decline: 1 } })[2];
  eq(D.dias[2].regla, R);
  eq(car({}).cumple, 'Sí'); eq(car({ during: 3 }).cumple, 'No'); eq(car({ back60: 'No' }).cumple, 'No');
  eq(car({ back60: '' }).cumple, 'falta K'); eq(car({}, 3).cumple, 'No'); eq(car({ decline: 3 }, 3).cumple, 'Sí');
});

/* ---------- 2. Resumen semanal ---------- */
const fila = (sem, morning, extra = {}) => ({ sem, morning, cumple: '', click: '', ...extra });
test('resumen semanal: media a un decimal (x,x5 y coma flotante), peor, no cumplen, chasquidos', () => {
  const med = (vals) => C.resumenSemana(vals.map((v) => fila('S2', v)), 'S2').media;
  eq(med([2, 3, 2, 2]), 2.3);                       // 2.25 -> 2.3 (ROUND de Excel)
  eq(med(Array(19).fill(1).concat([2])), 1.1);      // 21/20 = 1.05 -> 1.1
  eq(med(Array(17).fill(1).concat([2, 2, 2])), 1.2); // 23/20 = 1.15 -> 1.2
  eq(med(Array(19).fill(1).concat([10])), 1.5);     // 29/20 = 1.45 -> 1.5
  eq(med(Array(19).fill(0).concat([3])), 0.2);      // 0.15 -> 0.2
  eq(med([3, 3, 3]), 3); eq(med([0]), 0); eq(med([1, 2]), 1.5); eq(med([2, 2, 3]), 2.3); eq(med([1, 1, 2]), 1.3);
  eq(med([1, 2, 2, 2, 2, 2, 2]), 1.9);
  const f = [fila('S3', 4, { cumple: 'No' }), fila('S3', 2, { cumple: 'Sí', click: 'Sí' }), fila('S3', '', { cumple: 'No', click: 'Sí' }),
    fila('S3', 7, { cumple: 'pendiente' }), fila('S4', 9, { cumple: 'No', click: 'Sí' })];
  eq(C.resumenSemana(f, 'S3'), { sem: 'S3', media: 4.3, peor: 7, noCumplen: 2, chasquidos: 2 });
  eq(C.resumenSemana(f, 'S4'), { sem: 'S4', media: 9, peor: 9, noCumplen: 1, chasquidos: 1 });
});
test('resumen semanal: semana sin datos -> vacío', () => {
  eq(C.resumenSemana([fila('S5', '')], 'S5'), { sem: 'S5', media: '', peor: '', noCumplen: 0, chasquidos: 0 });
  eq(C.resumenSemana([], 'S2').media, '');
  const r = C.resumenes(C.tablaDias(D.dias, {}), D.semanas);
  eq(r.length, 9); eq(r.every((x) => x.media === '' && x.peor === '' && x.noCumplen === 0 && x.chasquidos === 0), true);
  eq(C.resumenSemana([fila('S2', 0)], 'S2').peor, 0);   // el 0 es dato, no vacío
});

/* ---------- 3. Aviso S4, chasquido, entrada ---------- */
test('aviso S4: peor / igual / mejor / sin datos, y empate tras redondear', () => {
  const med = (vals, sem) => C.resumenSemana(vals.map((v) => fila(sem, v)), sem).media;
  eq(C.avisoS4(2, 3).nivel, 'peor'); eq(C.avisoS4(2, 2).nivel, 'igual'); eq(C.avisoS4(3, 2).nivel, 'mejor');
  eq(C.avisoS4(0, 0).nivel, 'igual');   // 0 es dato
  eq(C.avisoS4(0, 1).nivel, 'peor'); eq(C.avisoS4(1, 0).nivel, 'mejor');
  for (const [a, b] of [['', 2], [2, ''], ['', ''], [undefined, 1]]) eq(C.avisoS4(a, b), { nivel: 'sin', texto: 'Se calcula cuando haya datos de S2 y S4' });
  const s2 = med([3, 2, 2, 1, 3, 2, 4], 'S2');            // 17/7 = 2.43 -> 2.4
  const s4 = med([2, 3, 2, 3, 2], 'S4');                  // 12/5 = 2.4
  eq([s2, s4], [2.4, 2.4]); eq(C.avisoS4(s2, s4).nivel, 'igual');
  eq(C.avisoS4(2, 3).texto, 'PEOR que en S2: para la progresión y la valoración del fisio pasa a ser prioritaria');
  eq(C.avisoS4(2, 2).texto, 'IGUAL que en S2: la valoración del fisio pasa a ser prioritaria');
  eq(C.avisoS4(3, 2).texto, 'MEJOR que en S2: sigue el plan');
});
test('aviso chasquido doloroso', () => {
  eq(C.avisoChasquido([{ click: 'No' }, { click: '' }]), { activo: false, n: 0, texto: 'Sin chasquido doloroso por ahora' });
  eq(C.avisoChasquido([]).activo, false);
  eq(C.avisoChasquido([{ click: 'No' }, { click: 'Sí' }, { click: 'Sí' }]), { activo: true, n: 2, texto: 'Registrado: la valoración del fisio pasa a ser prioritaria' });
});
test('entrada a la carrera: 3 Sí / algún No / pendiente', () => {
  eq(C.entradaResultado(['Sí', 'Sí', 'Sí']), { estado: 'si', texto: 'SÍ: 1.ª carrera hoy (N1)' });
  const no = 'NO: hoy no corres; repite los criterios la semana que viene';
  eq(C.entradaResultado(['Sí', 'No', 'Sí']).texto, no);
  eq(C.entradaResultado(['No', '', '']).texto, no);
  eq(C.entradaResultado(['Sí', 'Sí', 'No']).estado, 'no');
  eq(C.entradaResultado(['Sí', 'Sí', '']), { estado: 'pendiente', texto: 'Pendiente' });
  eq(C.entradaResultado(['', '', '']).texto, 'Pendiente');
});

/* ---------- 4. Test de fuerza ---------- */
test('test de fuerza: estimadas, simetría, ¿≥90%?', () => {
  eq(C.fuerzaEstimada(80, 8), 101.3);           // 101.33
  eq(C.fuerzaEstimada(80, 9), 104);
  eq(C.fuerzaEstimada(50, 3), 55);
  eq(C.fuerzaEstimada(32.5, 7), 40.1);          // 40.0833
  eq(C.fuerzaEstimada(15, 1), 15.5);
  eq(C.fuerzaEstimada(100, 0), 100);
  eq(C.fuerzaEstimada(0, 10), 0);
  eq(C.fuerzaEstimada(33, 15), 49.5);
  const t = C.calcularTest({ load: 80, repsD: 8, repsI: 9 });
  eq(t.estD, 101.3); eq(t.estI, 104); eq(t.sim, 101.3 / 104); eq(t.pct, 97.4); eq(t.ok, 'Sí');
  eq(C.calcularTest({ load: 30, repsD: 33, repsI: 40 }).sim, 63 / 70);
  eq(C.llega90(0.9), 'Sí'); eq(C.llega90(0.8999999), 'No'); eq(C.llega90(0.9000001), 'Sí'); eq(C.llega90(1.2), 'Sí'); eq(C.llega90(0), 'No');
  eq(C.calcularTest({ load: 30, repsD: 33, repsI: 40 }).ok, 'Sí');   // 63/70 = 0.9 exacto
  eq(C.calcularTest({ load: 30, repsD: 32, repsI: 40 }).ok, 'No');   // 62/70
  eq(C.calcularTest({ load: 30, repsD: 34, repsI: 40 }).ok, 'Sí');   // 64/70
  eq(C.simetriaPct(63 / 70), 90); eq(C.simetriaPct(0.8857), 88.6); eq(C.simetriaPct(0.9045), 90.5); eq(C.simetriaPct(''), '');
});
test('test de fuerza: datos incompletos -> vacío', () => {
  const v = { estD: '', estI: '', sim: '', pct: '', ok: '' };
  eq(C.calcularTest({}), v); eq(C.calcularTest(undefined), v);
  eq(C.calcularTest({ load: 50 }), v);
  eq(C.calcularTest({ repsD: 5, repsI: 5 }), v);
  const soloD = C.calcularTest({ load: 50, repsD: 6 });
  eq([soloD.estD, soloD.estI, soloD.sim, soloD.pct, soloD.ok], [60, '', '', '', '']);
  const soloI = C.calcularTest({ load: 50, repsI: 6 });
  eq([soloI.estD, soloI.estI, soloI.sim, soloI.ok], ['', 60, '', '']);
  eq(C.calcularTest({ load: 50, repsD: 0, repsI: 0 }).ok, 'Sí');   // 50/50
  eq(C.calcularTest({ load: 0, repsD: 5, repsI: 5 }).sim, '');     // 0/0: sin simetría
  eq(C.calcularTest({ load: '', repsD: 5, repsI: 5 }), v);
});

/* ---------- 5. Contraste con las fórmulas reales del Excel ---------- */
// `formulas` no es dependencia del repo: se instala aparte, p. ej.
//   pip install --target tools/out/py formulas
// (tools/out/ no se versiona) o en otra carpeta indicada con RODILLA_PY.
const PYPATH = process.env.RODILLA_PY || path.join(root, 'tools', 'out', 'py');

const KNEE = {
  days: {
    // S2
    '2026-10-26': { decline: 2, steps: 3, during: 3, click: 'No' },
    '2026-10-27': { decline: 1, steps: 2, during: 2, back60: 'Sí', click: 'Sí' },
    '2026-10-28': { decline: 2, steps: 2, during: 2, back60: 'Sí' },
    '2026-10-29': { decline: 1, steps: 0, during: 1 },
    '2026-10-30': { decline: 3, steps: 1, during: 4, rule: '—' },
    '2026-10-31': { decline: 2, during: 3 },
    '2026-11-01': { steps: 4, during: 2, back60: 'No' },
    // S3
    '2026-11-02': { during: 2 },
    '2026-11-03': { decline: 5, steps: 5 },
    '2026-11-04': { decline: 3, steps: 2, during: 1 },
    '2026-11-05': { decline: 2, steps: 2, during: 2 },
    '2026-11-07': { decline: 1, steps: 1, during: 1, rule: 'Carrera (≤2/10)', back60: 'Sí', click: 'Sí' },
    '2026-11-08': { decline: 3, steps: 3, during: 3, back60: 'Sí' },
    // S4
    '2026-11-09': { decline: 2, steps: 2, during: 3 },
    '2026-11-10': { decline: 2, steps: 3, during: 0 },
    '2026-11-11': { decline: 2, steps: 2, during: 2, back60: 'Sí' },
    '2026-11-12': { decline: 3, steps: 3, during: 1 },
    '2026-11-13': { decline: 2, steps: 1, during: 3 },
    // fin del calendario
    '2026-12-25': { decline: 1, steps: 1, during: 1 },
    '2026-12-26': { decline: 2, steps: 0, during: 1 },
    '2026-12-27': { decline: 0, steps: 0, during: 0, back60: 'Sí', click: 'Sí' },
  },
  entry: { walk: { ok: 'Sí' }, touchdown: { ok: 'No' }, hops: { ok: 'Sí' } },
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
    for k, v in sol.items():
        if k.upper().endswith("SEGUIMIENTO RODILLA'!" + ref):
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

  const tabla = C.tablaDias(D.dias, KNEE.days);
  const exp = {};
  tabla.forEach((f, i) => {
    const r = 5 + i;
    exp['I' + r] = f.morning; exp['M' + r] = f.h24; exp['N' + r] = f.h48; exp['O' + r] = f.worst; exp['P' + r] = f.cumple;
  });
  D.semanas.forEach((s, i) => {
    const r = 72 + i; const x = C.resumenSemana(tabla, s);
    exp['B' + r] = x.media; exp['E' + r] = x.peor; exp['F' + r] = x.noCumplen; exp['G' + r] = x.chasquidos;
  });
  const sem = Object.fromEntries(C.resumenes(tabla, D.semanas).map((x) => [x.sem, x]));
  exp.E82 = C.avisoS4(sem.S2.media, sem.S4.media).texto;
  exp.E83 = C.avisoChasquido(tabla).texto;
  exp.H92 = C.entradaResultado([KNEE.entry.walk.ok, KNEE.entry.touchdown.ok, KNEE.entry.hops.ok]).texto;
  [97, 98, 99, 100].forEach((r, i) => {
    const t = C.calcularTest(KNEE.tests['t' + (i + 1)]);
    exp['I' + r] = t.estD; exp['J' + r] = t.estI; exp['K' + r] = t.sim; exp['L' + r] = t.ok;
  });

  const res = spawnSync('python', ['-X', 'utf8', '-c', PYSRC, file, PYPATH, JSON.stringify(Object.keys(exp))], { encoding: 'utf8', maxBuffer: 1 << 26, timeout: 300000 });
  const line = (res.stdout || '').split(/\r?\n/).find((l) => l.startsWith('@@'));
  assert.ok(line, 'el motor de fórmulas no devolvió resultados: ' + (res.stderr || '').split('\n').slice(-4).join(' | '));
  const xl = JSON.parse(line.slice(2));
  const dif = [];
  const norm = (v) => (v === null || v === undefined ? '' : v);
  for (const [ref, e] of Object.entries(exp)) {
    total++;
    const a = norm(xl[ref]);
    const ok = typeof e === 'number' && typeof a === 'number' ? Math.abs(e - a) < 1e-9 : e === a;
    if (!ok) dif.push(`${ref}: Excel=${JSON.stringify(a)} RodillaCalc=${JSON.stringify(e)}`);
  }
  const cubiertos = new Set(tabla.map((f) => (f.rule === R ? 'C:' : 'G:') + f.cumple));
  for (const k of ['C:Sí', 'C:No', 'C:falta K', 'C:pendiente', 'G:Sí', 'G:No', 'G:pendiente', 'G:sin referencia', 'G:']) {
    total++; if (!cubiertos.has(k)) dif.push(`datos de prueba sin cubrir la rama ${k}`);
  }
  console.log(`       ${Object.keys(exp).length} celdas comparadas; ramas: ${[...cubiertos].sort().join(' · ')}`);
  console.log(`       avisos: ${exp.E82} | ${exp.E83} | ${exp.H92}`);
  assert.equal(dif.length, 0, dif.join('\n        '));
});

console.log(`\n${total - fallos}/${total} comprobaciones, ${fallos} pruebas con fallo`);
process.exit(fallos ? 1 : 0);
