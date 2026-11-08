/* Semana sin viernes (js/plan.js «Semana sin viernes» y su efecto en js/rodilla-calc.js):
   la pierna 2 pasa al jueves, el pull al miércoles tras la carrera y el pull-in del lunes al
   miércoles; la rodilla evalúa y progresa con el jueves en lugar del viernes.
       node tests/sin-viernes.test.mjs */
import assert from 'node:assert/strict';
import { cargar } from './cargar.mjs';

const { PLAN, RodillaCalc: C, RODILLA_DATA: DATA } = cargar(['PLAN', 'RodillaCalc', 'RODILLA_DATA'], { rodilla: true });
let activas = [];
PLAN.setFuenteSinViernes(() => activas);
const con = (semanas, fn) => { const antes = activas; activas = semanas; try { return fn(); } finally { activas = antes; } };

let fallos = 0;
const test = (name, fn) => {
  try { fn(); console.log(`  OK  ${name}`); } catch (e) { fallos++; console.log(` FALLO ${name}\n        ${e.message}`); }
};

const W = (n) => PLAN.VOL_WEEKS[n - 1];
const porDia = (n) => Object.fromEntries(PLAN.sessionsFor(W(n)).map((s) => [s.id.slice(4), s]));
const ids = (s) => s.exercises.map((x) => x.id);
const PULL_IN = PLAN.SIN_VIERNES.pullIn.id;

test('solo se puede activar desde S3 y, sin activar, la semana es la del Excel', () => {
  assert.deepEqual(PLAN.VOL_WEEKS.map((w) => PLAN.admiteSinViernes(w.n)), [false, false, true, true, true, true, true, true]);
  const normal = porDia(4);
  const s2 = porDia(2);
  con([1, 2], () => { assert.equal(PLAN.sinViernes(2), false); assert.deepEqual(porDia(2), s2); });
  con([3], () => assert.deepEqual(porDia(4), normal));   // otra semana activada: S4 no cambia
  assert.equal(PLAN.sinViernes(4), false);
  assert.equal(PLAN.diaSinViernes(4, 'V'), 'V');
});

test('S4 sin viernes: pierna 2 el jueves, pull el miércoles tras la carrera y el pull-in tras el jalón ancho', () => {
  const normal = porDia(4);
  con([4], () => {
    const s = porDia(4);
    assert.deepEqual(Object.keys(s), ['L', 'M', 'X', 'J', 'V', 'S', 'D']);
    assert.deepEqual(ids(s.L), ids(normal.L).filter((id) => id !== PULL_IN));
    const pull = ids(normal.J);
    pull.splice(pull.indexOf(PLAN.SIN_VIERNES.pullIn.tras) + 1, 0, PULL_IN);
    assert.deepEqual(ids(s.X), [...ids(normal.X), ...pull]);
    assert.equal(s.X.exercises[0].target, 'Cardio', 'primero la carrera');
    assert.deepEqual(ids(s.J), ids(normal.V));
    assert.deepEqual([s.J.dow, s.J.name, s.J.title], [4, 'Jueves', 'Rehab + Isquios + Aductores']);
    assert.equal(s.X.title, 'Carrera + Pull');
    assert.deepEqual([s.V.exercises.length, s.V.title], [0, 'Libre']);
    assert.ok(s.V.note && s.J.note && s.X.note && s.L.note);
    assert.equal(PLAN.diaSinViernes(4, 'V'), 'J');
    assert.equal(PLAN.diaSinViernes(4, 'J'), 'X');
    // Las series de la semana no cambian: mismos ejercicios, con las mismas prescripciones.
    const todas = (d) => Object.values(d).flatMap((x) => x.exercises.map((e) => `${e.id}:${PLAN.presFor(e, W(4)).label}`)).sort();
    const sinBici = (xs) => xs.filter((x) => !x.startsWith('bici-z2-sin-z3'));
    assert.deepEqual(sinBici(todas(s)), sinBici(todas(normal)));
  });
});

test('S4 sin viernes: la bici no se estrena el jueves; entra en la primera bici de S5 (martes)', () => {
  con([4], () => {
    const bici = porDia(4).J.exercises.find((x) => x.prog === 'bici');
    assert.equal(PLAN.presFor(bici, W(4)).skip, true);
    assert.equal(PLAN.presFor(bici, W(5)).skip, undefined, 'solo esa semana');
    assert.match(porDia(4).J.note, /bici no se estrena hoy/);
    assert.deepEqual(PLAN.entradaBici(), { semana: 5, dia: 'M', movida: true, de: 4 });
  });
  con([4, 5], () => assert.deepEqual(PLAN.entradaBici(), { semana: 5, dia: 'M', movida: true, de: 4 }));
  con([5], () => {
    assert.deepEqual(PLAN.entradaBici(), PLAN.ESCALERAS.bici.entrada);
    const bici = porDia(5).J.exercises.find((x) => x.prog === 'bici');
    assert.equal(PLAN.presFor(bici, W(5)).label, PLAN.presFor(PLAN.BLOCK_VOL.V.exercises.find((x) => x.prog === 'bici'), W(5)).label);
  });
  assert.deepEqual(PLAN.entradaBici(), { semana: 4, dia: 'V' });
});

test('sesionDelDia: el viernes, libre; el jueves, la pierna 2; lo ya registrado no se pierde', () => {
  con([4], () => {
    assert.deepEqual(PLAN.sesionDelDia('2026-11-13', {}).exercises, []);
    assert.equal(PLAN.sesionDelDia('2026-11-12', {}).exercises[1].id, 'sentadilla-al-cajon-o-desde-pines-pesado-y-lento-n-2');
    const v = PLAN.sesionDelDia('2026-11-13', { 'isquios-sentado': [{ kg: '40', reps: '10' }] });
    assert.deepEqual(ids(v), ['isquios-sentado']);
  });
});

test('calendario de rodilla: el jueves con la regla y la sesión del viernes; el viernes, sin carga', () => {
  const d = con([4], () => C.diasEfectivos(DATA.dias, PLAN));
  const de = (fecha) => d.find((x) => x.fecha === fecha);
  const orig = (fecha) => DATA.dias.find((x) => x.fecha === fecha);
  assert.equal(de('2026-11-12').regla, orig('2026-11-13').regla);
  assert.match(de('2026-11-12').sesion, /sentadilla.*sin bici: se estrena la semana que viene/);
  assert.equal(de('2026-11-12').novedad, '—');
  assert.deepEqual([de('2026-11-13').regla, de('2026-11-13').novedad], [C.SIN_REGLA, '—']);
  assert.match(de('2026-11-11').sesion, /\+ pull del jueves/);
  assert.equal(de('2026-11-11').regla, orig('2026-11-11').regla);
  assert.match(de('2026-11-17').novedad, /^Bici \(1\.ª vez/);
  // Las demás semanas, tal cual.
  assert.deepEqual(d.filter((x) => !['S4'].includes(x.sem) && x.fecha !== '2026-11-17'),
    DATA.dias.filter((x) => !['S4'].includes(x.sem) && x.fecha !== '2026-11-17'));
  assert.deepEqual(C.diasEfectivos(DATA.dias, PLAN), DATA.dias);
});

/* Progresión: S2 y S3 en verde; S4 sin viernes con la pierna 2 el jueves 12/11. */
const sumar = (iso, k) => C.sumarDias(iso, k);
function semana(lunes, mananas, durante = {}) {
  const out = {};
  'LMXJVSD'.split('').forEach((l, i) => {
    if (i >= mananas.length) return;
    const r = { decline: mananas[i] };
    if (durante[l] !== undefined) { r.during = durante[l]; if (l === 'X' || l === 'D') r.back60 = 'Sí'; }
    out[sumar(lunes, i)] = r;
  });
  return out;
}
const ENTRADA = { S2: { walkPain: 'Sí', walkBack60: 'Sí', tdPain: 'Sí', hopsPain: 'Sí' } };
const VERDE = { L: 1, X: 1, V: 1, D: 1 };
const BASE = {
  ...semana('2026-10-26', [2, 2, 2, 2, 2, 2, 2], { X: 1, V: 1, D: 1 }),
  ...semana('2026-11-02', [2, 2, 2, 2, 2, 2, 2], VERDE),
};
const progresar = (dias, hoy) => C.progresion(C.tablaDias(DATA.dias, dias, PLAN), PLAN, {}, ENTRADA, hoy);

test('progresión: con la pierna 2 del jueves en verde, la prensa de S5 avanza (el viernes no cuenta)', () => {
  const dias = { ...BASE, ...semana('2026-11-09', [2, 2, 2, 2, 2, 2, 2], { L: 1, X: 1, J: 1, D: 1 }), ...semana('2026-11-16', [2, 2]) };
  const p = con([4], () => progresar(dias, '2026-11-16'));
  assert.equal(p.semanas.S5.prensa.nivel, p.semanas.S4.prensa.nivel + 1, p.semanas.S5.prensa.motivo);
  assert.match(p.semanas.S5.prensa.motivo, /^Avanzar/);
  // Sin el interruptor, el jueves no tiene regla de rodilla y al viernes le faltan datos.
  const q = progresar(dias, '2026-11-16');
  assert.match(q.semanas.S5.prensa.motivo, /^Mantener \(V 13\/11/);
});

test('progresión: dolor durante la pierna 2 del jueves retrocede la prensa; la bici entra el martes de S5', () => {
  const dias = { ...BASE, ...semana('2026-11-09', [2, 2, 2, 2, 2, 2, 2], { L: 1, X: 1, J: 4, D: 1 }), ...semana('2026-11-16', [2, 2]) };
  const p = con([4], () => progresar(dias, '2026-11-17'));
  assert.match(p.semanas.S5.prensa.motivo, /^Retroceder: dolor durante la sesión del J 12\/11/);
  assert.equal(p.bici.quitas.length, 1, 'S4 tuvo una sesión en Retroceder: la bici no entra');
  assert.equal(p.bici.quitas[0].desde, '2026-11-17');
});

test('progresión: mañana del viernes peor tras la pierna del jueves -> se retrocede la carrera (última novedad sin validar)', () => {
  const dias = { ...BASE, ...semana('2026-11-09', [2, 2, 2, 2, 3, 2, 2], { L: 1, X: 1, J: 1, D: 1 }), ...semana('2026-11-16', [2, 2, 2]) };
  const p = con([4], () => progresar(dias, '2026-11-18'));
  assert.match(p.semanas.S5.carrera.motivo, /^Retroceder: mañana peor tras la sesión del J 12\/11/);
  assert.equal(p.brotes.length, 0);
});

console.log(fallos ? `\n${fallos} fallo(s)` : '\nTodo OK');
process.exitCode = fallos ? 1 : 0;
