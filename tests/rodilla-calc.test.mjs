/* Prueba de js/rodilla-calc.js y js/rodilla-data.js, sin navegador ni dependencias.
       node tests/rodilla-calc.test.mjs */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const leer = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const C = new Function(leer('js/rodilla-calc.js') + ';return RodillaCalc;')();
const DATA = new Function(leer('js/rodilla-data.js') + ';return RODILLA_DATA;')();

let fallos = 0;
const test = (name, fn) => {
  try { fn(); console.log(`  OK  ${name}`); } catch (e) { fallos++; console.log(` FALLO ${name}\n        ${e.message}`); }
};

const G = 'Gimnasio (≤3/10)';
const R = 'Carrera (≤2/10)';
const N = '—';

/* Tres filas: la primera es la sesión; las dos siguientes dan 24 h y 48 h. */
const caso = (sesion, m24, m48) => C.calcularDias([
  { sem: 'S2', ...sesion },
  { sem: 'S2', decline: m24 },
  { sem: 'S2', decline: m48 },
])[0];

test('entero010 acepta 0-10 y vacío, rechaza el resto', () => {
  assert.equal(C.entero010('0'), 0);
  assert.equal(C.entero010(10), 10);
  assert.equal(C.entero010(' 7 '), 7);
  assert.equal(C.entero010(''), '');
  assert.equal(C.entero010(undefined), '');
  for (const mal of ['11', 11, -1, '-1', '2.5', 2.5, 'a', '1,5', NaN]) assert.equal(C.entero010(mal), null, String(mal));
});

test('redondear1 como el ROUND de Excel', () => {
  assert.equal(C.redondear1(2.25), 2.3);
  assert.equal(C.redondear1(1.05), 1.1);
  assert.equal(C.redondear1(-2.25), -2.3);
  assert.equal(C.redondear1(3), 3);
  assert.equal(C.redondear1(''), '');
});

test('molestiaManana: máximo de las dos o la única que haya', () => {
  assert.equal(C.molestiaManana(3, 5), 5);
  assert.equal(C.molestiaManana(4, 2), 4);
  assert.equal(C.molestiaManana(0, 0), 0);
  assert.equal(C.molestiaManana(3, undefined), 3);
  assert.equal(C.molestiaManana(undefined, 2), 2);
  assert.equal(C.molestiaManana(undefined, undefined), '');
});

test('cumple: durante vacío -> vacío', () => {
  assert.equal(caso({ rule: G, decline: 2 }, 1, 1).cumple, '');
});
test('cumple: sin dato de la mañana -> sin referencia', () => {
  assert.equal(caso({ rule: G, during: 1 }, 1, 1).cumple, 'sin referencia');
});
test('cumple: carrera sin K -> falta K (antes que pendiente)', () => {
  assert.equal(caso({ rule: R, decline: 2, during: 1 }, 1, 1).cumple, 'falta K');
  assert.equal(caso({ rule: R, decline: 2, during: 1 }, undefined, undefined).cumple, 'falta K');
});
test('cumple: sin 24-48 h -> pendiente (también con solo la de 24 h)', () => {
  assert.equal(caso({ rule: G, decline: 2, during: 1 }, undefined, undefined).cumple, 'pendiente');
  assert.equal(caso({ rule: G, decline: 2, during: 1 }, 1, undefined).cumple, 'pendiente');
  assert.equal(caso({ rule: R, decline: 2, during: 1, back60: 'Sí' }, undefined, 1).cumple, 'pendiente');
});
test('cumple gimnasio: durante 3 sí, durante 4 no', () => {
  assert.equal(caso({ rule: G, decline: 2, during: 3 }, 1, 1).cumple, 'Sí');
  assert.equal(caso({ rule: G, decline: 2, during: 4 }, 1, 1).cumple, 'No');
});
test('cumple gimnasio: peor 24-48 h igual a la referencia sí, mayor no', () => {
  assert.equal(caso({ rule: G, decline: 2, during: 1 }, 2, 2).cumple, 'Sí');
  assert.equal(caso({ rule: G, decline: 2, during: 1 }, 1, 3).cumple, 'No');
});
test('cumple gimnasio: la regla «—» cae en la rama de gimnasio', () => {
  assert.equal(caso({ rule: N, decline: 2, during: 3 }, 1, 1).cumple, 'Sí');
  assert.equal(caso({ rule: N, decline: 2, during: 4 }, 1, 1).cumple, 'No');
});
test('cumple carrera: durante 2 sí, durante 3 no', () => {
  assert.equal(caso({ rule: R, decline: 2, during: 2, back60: 'Sí' }, 1, 1).cumple, 'Sí');
  assert.equal(caso({ rule: R, decline: 2, during: 3, back60: 'Sí' }, 1, 1).cumple, 'No');
});
test('cumple carrera: K = No -> No', () => {
  assert.equal(caso({ rule: R, decline: 2, during: 1, back60: 'No' }, 1, 1).cumple, 'No');
});
test('cumple carrera: 24 h igual a la referencia sí, mayor no', () => {
  assert.equal(caso({ rule: R, decline: 2, during: 1, back60: 'Sí' }, 2, 1).cumple, 'Sí');
  assert.equal(caso({ rule: R, decline: 2, during: 1, back60: 'Sí' }, 3, 1).cumple, 'No');
});
test('cumple carrera: 48 h mayor que la referencia -> No', () => {
  assert.equal(caso({ rule: R, decline: 2, during: 1, back60: 'Sí' }, 1, 3).cumple, 'No');
});
test('cumple: durante 0 cuenta como rellenado', () => {
  assert.equal(caso({ rule: G, decline: 0, during: 0 }, 0, 0).cumple, 'Sí');
});

test('calcularDias: una sola prueba de la mañana vale; 24/48 h por orden de filas', () => {
  const f = C.calcularDias([
    { sem: 'S2', decline: 4 }, { sem: 'S2', steps: 2 }, { sem: 'S2', decline: 1, steps: 3 }, { sem: 'S2' },
  ]);
  assert.deepEqual(f.map((x) => x.morning), [4, 2, 3, '']);
  assert.equal(f[0].h24, 2); assert.equal(f[0].h48, 3); assert.equal(f[0].worst, 3);
  assert.equal(f[1].h24, 3); assert.equal(f[1].h48, ''); assert.equal(f[1].worst, '');
  assert.equal(f[3].h24, ''); assert.equal(f[3].worst, '');
});

test('filaDia: el override (aunque sea vacío) manda sobre el plan', () => {
  const plan = { fecha: '2026-10-26', dia: 'L', sem: 'S2', sesion: 'X', regla: G, novedad: 'Y' };
  assert.equal(C.filaDia(plan, undefined).rule, G);
  assert.equal(C.filaDia(plan, { rule: R }).rule, R);
  assert.equal(C.filaDia(plan, { novelty: '' }).novelty, '');
  assert.equal(C.filaDia(plan, {}).novelty, 'Y');
  const t = C.tablaDias([plan], { '2026-10-26': { rule: R, decline: 1, during: 1 } });
  assert.equal(t[0].cumple, 'falta K');   // cuenta la regla editada
});

test('resumenSemana: media con redondeo, peor, no cumplen y chasquidos', () => {
  const filas = [
    { sem: 'S2', morning: 2, cumple: 'No', click: 'Sí' },
    { sem: 'S2', morning: 3, cumple: 'Sí', click: '' },
    { sem: 'S2', morning: 2, cumple: '', click: '' },
    { sem: 'S2', morning: 3, cumple: 'No', click: 'Sí' },
    { sem: 'S2', morning: '', cumple: '', click: '' },
    { sem: 'S3', morning: 5, cumple: 'No', click: '' },
  ];
  const r = C.resumenSemana(filas, 'S2');
  assert.equal(r.media, 2.5); assert.equal(r.peor, 3); assert.equal(r.noCumplen, 2); assert.equal(r.chasquidos, 2);
  const r3 = C.resumenSemana([{ sem: 'S2', morning: 1 }, { sem: 'S2', morning: 1 }, { sem: 'S2', morning: 2 }], 'S2');
  assert.equal(r3.media, 1.3);   // 4/3 = 1.333
  const r4 = C.resumenSemana([{ sem: 'S2', morning: 2 }, { sem: 'S2', morning: 2 }, { sem: 'S2', morning: 2 }, { sem: 'S2', morning: 3 }], 'S2');
  assert.equal(r4.media, 2.3);   // 9/4 = 2.25 -> 2.3
  const vacia = C.resumenSemana(filas, 'S9');
  assert.equal(vacia.media, ''); assert.equal(vacia.peor, '');
  assert.equal(vacia.noCumplen, 0);
});

test('avisoS4: mayor, igual, menor y sin datos', () => {
  assert.equal(C.avisoS4(2, 3).nivel, 'peor');
  assert.match(C.avisoS4(2, 3).texto, /^PEOR que en S2: para la progresión/);
  assert.equal(C.avisoS4(2.5, 2.5).nivel, 'igual');
  assert.match(C.avisoS4(2.5, 2.5).texto, /^IGUAL que en S2/);
  assert.equal(C.avisoS4(3, 2).nivel, 'mejor');
  assert.equal(C.avisoS4(3, 2).texto, 'MEJOR que en S2: sigue el plan');
  assert.equal(C.avisoS4('', 2).nivel, 'sin');
  assert.equal(C.avisoS4(2, '').texto, 'Se calcula cuando haya datos de S2 y S4');
  assert.equal(C.avisoS4(0, 0).nivel, 'igual');   // 0 es un dato
});

test('avisoChasquido', () => {
  assert.equal(C.avisoChasquido([{ click: '' }, { click: 'No' }]).activo, false);
  assert.equal(C.avisoChasquido([{ click: '' }, { click: 'No' }]).texto, 'Sin chasquido doloroso por ahora');
  const a = C.avisoChasquido([{ click: 'Sí' }, { click: 'Sí' }]);
  assert.equal(a.activo, true); assert.equal(a.n, 2);
  assert.equal(a.texto, 'Registrado: la valoración del fisio pasa a ser prioritaria');
});

test('entradaResultado', () => {
  assert.equal(C.entradaResultado(['Sí', 'Sí', 'Sí']).texto, 'SÍ: 1.ª carrera hoy (N1)');
  assert.equal(C.entradaResultado(['Sí', 'No', '']).estado, 'no');
  assert.equal(C.entradaResultado(['No', 'No', 'No']).texto, 'NO: hoy no corres; repite los criterios la semana que viene');
  assert.equal(C.entradaResultado(['Sí', 'Sí', '']).texto, 'Pendiente');
  assert.equal(C.entradaResultado(['', '', '']).estado, 'pendiente');
});

test('test de fuerza: Epley, simetría y borde del 90 %', () => {
  assert.equal(C.fuerzaEstimada(50, 12), 70);
  assert.equal(C.fuerzaEstimada(50, ''), '');
  assert.equal(C.fuerzaEstimada('', 10), '');
  assert.equal(C.fuerzaEstimada(45, 8), 57);        // 45 * 1.2666 = 57.0
  assert.equal(C.fuerzaEstimada(20, 15), 30);
  assert.equal(C.simetria(63, 70), 0.9);
  assert.equal(C.llega90(C.simetria(63, 70)), 'Sí');      // justo en el borde
  assert.equal(C.llega90(C.simetria(62.9, 70)), 'No');
  assert.equal(C.simetriaPct(C.simetria(63, 70)), 90);
  assert.equal(C.simetria(70, ''), '');
  assert.equal(C.llega90(''), '');
  const t = C.calcularTest({ load: 50, repsD: 12, repsI: 12 });
  assert.equal(t.estD, 70); assert.equal(t.pct, 100); assert.equal(t.ok, 'Sí');
  const t2 = C.calcularTest({ load: 50, repsD: 6, repsI: 12 });
  assert.equal(t2.estD, 60); assert.equal(t2.pct, 85.7); assert.equal(t2.ok, 'No');
  assert.equal(C.calcularTest({}).ok, '');
});

test('RODILLA_DATA: 63 días del 26/10 al 27/12 con D/E/F del volcado', () => {
  assert.equal(DATA.dias.length, 63);
  assert.equal(DATA.dias[0].fecha, '2026-10-26');
  assert.equal(DATA.dias[62].fecha, '2026-12-27');
  assert.equal(DATA.desde, '2026-10-26'); assert.equal(DATA.hasta, '2026-12-27');
  // consecutivos, día de la semana y semana coherentes
  const letras = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];
  DATA.dias.forEach((d, i) => {
    const f = new Date(d.fecha + 'T12:00:00Z');
    assert.equal(f.toISOString().slice(0, 10), d.fecha);
    assert.equal(d.dia, letras[f.getUTCDay()], d.fecha);
    assert.equal(d.sem, 'S' + (2 + Math.floor(i / 7)), d.fecha);
    if (i) assert.equal((f - new Date(DATA.dias[i - 1].fecha + 'T12:00:00Z')) / 864e5, 1);
  });
  assert.deepEqual(DATA.semanas, ['S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8', 'S9', 'S10']);
  assert.deepEqual(DATA.reglas, { gimnasio: G, carrera: R, ninguna: N });
  assert.equal(DATA.entrada.length, 3);
  assert.equal(DATA.tests.length, 4);
  assert.equal(DATA.escalones.length, 5);
  for (const t of Object.values(DATA.textos)) assert.ok(t.length > 20);
  assert.match(DATA.textos.fuerza, /INCERTIDUMBRE/);

  const vol = path.join(root, 'docs/plan-rodilla/volcado.json');
  if (!fs.existsSync(vol)) { console.log('        (sin volcado.json: se omite la comparación literal)'); return; }
  const h = JSON.parse(fs.readFileSync(vol, 'utf8'))['Seguimiento rodilla'];
  DATA.dias.forEach((d, i) => {
    const r = 5 + i;
    assert.equal(String(h['A' + r].v).slice(0, 10), d.fecha, 'fecha fila ' + r);
    assert.equal(h['B' + r].v, d.dia); assert.equal(h['C' + r].v, d.sem);
    assert.equal(h['D' + r].v, d.sesion, 'sesión ' + d.fecha);
    assert.equal(h['E' + r].v, d.regla, 'regla ' + d.fecha);
    assert.equal(h['F' + r].v, d.novedad, 'novedad ' + d.fecha);
  });
  assert.equal(h.A2.v, DATA.textos.registro); assert.equal(h.A84.v, DATA.textos.resumen);
  assert.equal(h.A101.v, DATA.textos.fuerza); assert.equal(h.A110.v, DATA.textos.escalones);
  DATA.entrada.forEach((e, i) => { assert.equal(h['A' + (89 + i)].v, e.texto); assert.equal(h['G' + (89 + i)].v, e.dia); });
  DATA.tests.forEach((t, i) => { assert.equal(h['A' + (97 + i)].v, t.nombre); assert.equal(h['E' + (97 + i)].v, t.rango); assert.equal(String(h['D' + (97 + i)].v).slice(0, 10), t.fecha); });
  DATA.escalones.forEach((e, i) => assert.equal(h['A' + (105 + i)].v, e.nombre));
});

console.log(fallos ? `\n${fallos} fallo(s)` : '\nTodo bien');
process.exit(fallos ? 1 : 0);
