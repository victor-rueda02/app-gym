/* Prueba de js/rodilla-calc.js y js/rodilla-data.js, sin navegador ni dependencias.
       node tests/rodilla-calc.test.mjs */
import assert from 'node:assert/strict';
import { cargar, leer } from './cargar.mjs';

const { RodillaCalc: C, RODILLA_DATA: DATA, PLAN } = cargar(['RodillaCalc', 'RODILLA_DATA', 'PLAN'], { rodilla: true });
// Ejercicio del plan por su papel en la progresión (y su nombre, si hay varios).
const ej = (prog, nombre) => Object.values(PLAN.BLOCK_VOL).flatMap((s) => s.exercises)
  .find((x) => x.prog === prog && (!nombre || x.name.startsWith(nombre)));

let fallos = 0;
const test = (name, fn) => {
  try { fn(); console.log(`  OK  ${name}`); } catch (e) { fallos++; console.log(` FALLO ${name}\n        ${e.message}`); }
};

const G = 'Gimnasio (≤3/10)';
const R = 'Carrera (≤2/10)';
const N = '—';

/* Tres filas: la primera es la sesión; las dos siguientes dan 24 h y 48 h. */
const caso = (sesion, m24, m48) => C.calcularDias([
  { sem: 'S3', ...sesion },
  { sem: 'S3', decline: m24 },
  { sem: 'S3', decline: m48 },
])[0];
const sem = (sesion, m24, m48) => caso(sesion, m24, m48).semaforo;

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
  assert.equal(C.redondear1(2.9 - 2.4), 0.5);   // 0.4999… en coma flotante
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

/* Semáforo (punto 3 de la revisión). */
test('semáforo: día sin carga de rodilla -> «—», aunque haya datos', () => {
  assert.equal(sem({ rule: N, decline: 2, during: 5 }, 1, 1), '—');
});
test('semáforo: durante vacío -> vacío; sin mañana -> sin referencia (no se evalúa)', () => {
  assert.equal(sem({ rule: G, decline: 2 }, 1, 1), '');
  assert.equal(sem({ rule: G, during: 5 }, 9, 9), 'sin referencia');
});
test('semáforo: carrera sin el dato de 60 min -> falta K', () => {
  assert.equal(sem({ rule: R, decline: 2, during: 1 }, 1, 1), 'falta K');
});
test('semáforo gimnasio: durante 3 se evalúa, durante 4 -> Retroceder (aunque falten 24 h)', () => {
  assert.equal(sem({ rule: G, decline: 2, during: 3 }, 1, 1), 'Avanzar');
  assert.equal(sem({ rule: G, decline: 2, during: 4 }, undefined, undefined), 'Retroceder');
  assert.equal(caso({ rule: G, decline: 2, during: 4 }).fallo, 'durante');
});
test('semáforo carrera: durante 2 se evalúa, durante 3 o K = No -> Retroceder', () => {
  assert.equal(sem({ rule: R, decline: 2, during: 2, back60: 'Sí' }, 2, 2), 'Avanzar');
  assert.equal(sem({ rule: R, decline: 2, during: 3, back60: 'Sí' }, 1, 1), 'Retroceder');
  assert.equal(sem({ rule: R, decline: 2, during: 1, back60: 'No' }, 1, 1), 'Retroceder');
});
test('semáforo: la mañana siguiente peor -> Retroceder (sin esperar a las 48 h)', () => {
  assert.equal(sem({ rule: G, decline: 2, during: 1 }, 3, undefined), 'Retroceder');
  assert.equal(caso({ rule: G, decline: 2, during: 1 }, 3).fallo, '24h');
  assert.equal(sem({ rule: R, decline: 2, during: 1, back60: 'Sí' }, 3, 1), 'Retroceder');
});
test('semáforo: 24 h = referencia y 48 h peor -> Mantener; 48 h = referencia -> Avanzar', () => {
  assert.equal(sem({ rule: G, decline: 2, during: 1 }, 2, 3), 'Mantener');
  assert.equal(sem({ rule: R, decline: 2, during: 1, back60: 'Sí' }, 1, 3), 'Mantener');
  assert.equal(sem({ rule: G, decline: 2, during: 1 }, 2, 2), 'Avanzar');
});
test('semáforo: sin 24 h o sin 48 h -> pendiente', () => {
  assert.equal(sem({ rule: G, decline: 2, during: 1 }, undefined, undefined), 'pendiente');
  assert.equal(sem({ rule: G, decline: 2, during: 1 }, 1, undefined), 'pendiente');
});
test('semáforo: durante 0 cuenta como rellenado', () => {
  assert.equal(sem({ rule: G, decline: 0, during: 0 }, 0, 0), 'Avanzar');
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
  assert.equal(t[0].semaforo, 'falta K');   // cuenta la regla editada
});

test('resumenSemana: media con redondeo, peor, mañanas, a retroceder y chasquidos', () => {
  const filas = [
    { sem: 'S2', morning: 2, semaforo: 'Retroceder', click: 'Sí' },
    { sem: 'S2', morning: 3, semaforo: 'Avanzar', click: '' },
    { sem: 'S2', morning: 2, semaforo: 'Mantener', click: '' },
    { sem: 'S2', morning: 3, semaforo: 'Retroceder', click: 'Sí' },
    { sem: 'S2', morning: '', semaforo: '', click: '' },
    { sem: 'S3', morning: 5, semaforo: 'Retroceder', click: '' },
  ];
  const r = C.resumenSemana(filas, 'S2');
  assert.deepEqual([r.media, r.peor, r.mananas, r.retroceder, r.chasquidos], [2.5, 3, 4, 2, 2]);
  assert.equal(C.resumenSemana([{ sem: 'S2', morning: 1 }, { sem: 'S2', morning: 1 }, { sem: 'S2', morning: 2 }], 'S2').media, 1.3);
  assert.equal(C.resumenSemana([2, 2, 2, 3].map((m) => ({ sem: 'S2', morning: m })), 'S2').media, 2.3);   // 2.25
  const vacia = C.resumenSemana(filas, 'S9');
  assert.deepEqual([vacia.media, vacia.peor, vacia.mananas, vacia.retroceder], ['', '', 0, 0]);
});

test('avisoS4: pendiente hasta el 15/11 y con menos de 5 mañanas; umbral de 0,5', () => {
  const s = (media, mananas = 5) => ({ media, mananas, ultimo: '2026-11-15' });   // ultimo = cierre de S4
  assert.equal(C.avisoS4(s(2), s(5), '2026-11-14').nivel, 'pendiente');
  assert.equal(C.avisoS4(s(2), s(5), '2026-11-14').texto, 'Pendiente: se calcula al cerrar S4 (domingo 15/11)');
  assert.equal(C.avisoS4(s(2, 4), s(5), '2026-11-15').nivel, 'pendiente');
  assert.match(C.avisoS4(s(2), s(5, 4), '2026-11-20').texto, /al menos 5 mañanas/);
  assert.equal(C.avisoS4(s(2.4), s(2.9), '2026-11-15').nivel, 'peor');   // +0,5 justo
  assert.match(C.avisoS4(s(2.4), s(2.9), '2026-11-15').texto, /^PEOR que en S2/);
  assert.equal(C.avisoS4(s(2.4), s(2.8), '2026-11-15').nivel, 'igual');  // +0,4
  assert.equal(C.avisoS4(s(2.4), s(2.0), '2026-11-15').nivel, 'igual');  // −0,4
  assert.equal(C.avisoS4(s(2.4), s(1.9), '2026-11-15').nivel, 'mejor');  // −0,5 justo
  assert.equal(C.avisoS4(s(0), s(0), '2026-11-15').nivel, 'igual');      // 0 es un dato
});

test('avisoS2: repite si alguna mañana de S2 es peor que la primera medición', () => {
  const s2 = (ms) => ms.map((m) => ({ sem: 'S2', morning: m }));
  assert.equal(C.avisoS2(s2(['', '', ''])).nivel, 'pendiente');
  assert.equal(C.avisoS2(s2(['', 2, 2, 1, 2])).nivel, 'estable');   // el lunes sin medir: referencia el martes
  assert.equal(C.avisoS2(s2(['', 2, 3, 1])).nivel, 'repite');
  assert.match(C.avisoS2(s2([2, 3])).texto, /^REPITE S2/);
});

test('avisoChasquido', () => {
  assert.equal(C.avisoChasquido([{ click: '' }, { click: 'No' }]).activo, false);
  const a = C.avisoChasquido([{ click: 'Sí' }, { click: 'Sí' }]);
  assert.deepEqual([a.activo, a.n, a.texto], [true, 2, 'Registrado: la valoración del fisio pasa a ser prioritaria']);
});

test('entrada a la carrera: criterio 1 con dos casillas y la mañana del miércoles (24 h)', () => {
  const filas = C.tablaDias(DATA.dias, { '2026-10-27': { decline: 2 }, '2026-10-28': { decline: 2 } });
  const todo = { walkPain: 'Sí', walkBack60: 'Sí', tdPain: 'Sí', hopsPain: 'Sí' };
  assert.equal(C.entradaSemana(filas, 'S2', todo).texto, 'SÍ: 1.ª carrera hoy (N1)');
  assert.equal(C.entradaSemana(filas, 'S2', { ...todo, tdPain: '' }).estado, 'pendiente');
  const peor = C.tablaDias(DATA.dias, { '2026-10-27': { decline: 2 }, '2026-10-28': { decline: 3 } });
  const e = C.entradaSemana(peor, 'S2', todo);
  assert.deepEqual([e.manana, e.c1, e.estado], ['No', 'No', 'no']);
  assert.match(e.texto, /^NO: esta semana no hay carrera/);
  const sinMiercoles = C.tablaDias(DATA.dias, { '2026-10-27': { decline: 2 } });
  assert.equal(C.entradaSemana(sinMiercoles, 'S2', todo).c1, '');
  assert.equal(C.entradaSemana(filas, 'S2', { ...todo, walkBack60: 'No' }).c1, 'No');
});

test('test de fuerza: Epley, simetría y borde del 90 %', () => {
  assert.equal(C.fuerzaEstimada(50, 12), 70);
  assert.equal(C.fuerzaEstimada(50, ''), '');
  assert.equal(C.fuerzaEstimada(45, 8), 57);
  assert.equal(C.simetria(63, 70), 0.9);
  assert.equal(C.llega90(C.simetria(63, 70)), 'Sí');
  assert.equal(C.llega90(C.simetria(62.9, 70)), 'No');
  assert.equal(C.simetriaPct(C.simetria(63, 70)), 90);
  const t2 = C.calcularTest({ load: 50, repsD: 6, repsI: 12 });
  assert.deepEqual([t2.estD, t2.pct, t2.ok], [60, 85.7, 'No']);
  assert.equal(C.calcularTest({}).ok, '');
});

/* Progresión real (puntos 5, 6, 7 y 8 de la revisión). */
const dia = (d, x) => ({ [d]: x });
// S2 «de libro»: el lunes sin medir (punto 9), mañanas a 2 y entrada superada el miércoles.
const S2_BIEN = {
  ...dia('2026-10-27', { decline: 2, steps: 2 }),
  ...dia('2026-10-28', { decline: 2, during: 1, back60: 'Sí' }),
  ...dia('2026-10-29', { decline: 2, during: 2 }),
  ...dia('2026-10-30', { decline: 2 }), ...dia('2026-10-31', { decline: 2 }),
  ...dia('2026-11-01', { decline: 2, during: 1, back60: 'Sí' }),
  ...dia('2026-11-02', { decline: 2 }),
};
const ENTRADA = { S2: { walkPain: 'Sí', walkBack60: 'Sí', tdPain: 'Sí', hopsPain: 'Sí' } };
const progresar = (dias, hoy, extra = {}) => C.progresion(C.tablaDias(DATA.dias, dias), PLAN,
  extra.weeks || {}, extra.entry || ENTRADA, hoy);

test('progresión: S2 bien y entrada superada -> S3 sube según el plan', () => {
  const p = progresar(S2_BIEN, '2026-11-02');
  assert.equal(p.s2.nivel, 'estable');
  assert.deepEqual([p.semanas.S2.prensa.nivel, p.semanas.S2.carrera.nivel, p.semanas.S2.domingo.nivel], [1, 1, 1]);
  assert.deepEqual([p.semanas.S3.prensa.nivel, p.semanas.S3.carrera.nivel], [2, 2]);
  assert.match(p.semanas.S3.prensa.motivo, /^Avanzar: S2 estable/);
});

test('progresión: alguna mañana de S2 peor -> en S3 no sube nada (punto 6)', () => {
  const p = progresar({ ...S2_BIEN, ...dia('2026-10-30', { decline: 3 }) }, '2026-11-02');
  assert.equal(p.s2.nivel, 'repite');
  assert.deepEqual([p.semanas.S3.prensa.nivel, p.semanas.S3.carrera.nivel], [1, 1]);
});

test('progresión: sin entrada no se corre esa semana y se repite el miércoles siguiente (punto 7)', () => {
  const p = progresar(S2_BIEN, '2026-11-04', { entry: { S2: { ...ENTRADA.S2, hopsPain: 'No' } } });
  assert.equal(p.semanas.S2.carrera.nivel, 0);
  assert.equal(p.semanas.S2.domingo.nivel, 0);
  assert.equal(C.prescripcion(ej('carrera:domingo'), p.semanas.S2, PLAN, 2).label, 'No se corre\n(como mucho, un paseo)');
  assert.ok(p.semanas.S3.carrera.entrada, 'en S3 vuelven los criterios');
  assert.match(C.prescripcion(ej('carrera'), p.semanas.S3, PLAN, 3).label, /^Criterios de entrada/);
});

// S3: lunes en verde; miércoles N2 en verde a 24 h; jueves cumple pero el viernes peor.
const S3_JUEVES_BIEN_VIERNES_PEOR = {
  ...S2_BIEN,
  ...dia('2026-11-02', { decline: 2, during: 2 }),
  ...dia('2026-11-03', { decline: 2 }),
  ...dia('2026-11-04', { decline: 2, during: 1, back60: 'Sí' }),
  ...dia('2026-11-05', { decline: 2, during: 2 }),
  ...dia('2026-11-06', { decline: 3 }),
  ...dia('2026-11-07', { decline: 2 }), ...dia('2026-11-08', { decline: 2, during: 1, back60: 'Sí' }),
  ...dia('2026-11-09', { decline: 2 }), ...dia('2026-11-10', { decline: 2 }), ...dia('2026-11-11', { decline: 2 }),
};

test('progresión: jueves bien y viernes peor -> se retrocede la carrera y el escalón se mantiene (punto 5)', () => {
  const p = progresar(S3_JUEVES_BIEN_VIERNES_PEOR, '2026-11-11');
  const s4 = p.semanas.S4;
  assert.equal(s4.prensa.nivel, 2, s4.prensa.motivo);            // mantiene x10 · escalón 1
  assert.match(s4.prensa.motivo, /^Mantener/);
  assert.equal(s4.carrera.nivel, 1, s4.carrera.motivo);          // N2 -> N1
  assert.match(s4.carrera.motivo, /^Retroceder: mañana peor tras la sesión del J 05\/11/);
  assert.equal(p.brotes.length, 0);
});

test('progresión: dos sesiones seguidas en Retroceder -> brote y −1 en todo', () => {
  const p = progresar({
    ...S3_JUEVES_BIEN_VIERNES_PEOR,
    ...dia('2026-11-04', { decline: 2, during: 3, back60: 'Sí' }),   // miércoles: dolor 3/10 en carrera
    ...dia('2026-11-05', { decline: 2, during: 4 }),                 // jueves: 4/10 durante
  }, '2026-11-11');
  assert.equal(p.brotes.length, 1);
  assert.match(p.brotes[0].motivo, /dos sesiones seguidas/);
  assert.equal(p.semanas.S4.prensa.nivel, 1);
  assert.equal(p.semanas.S4.carrera.nivel, 1);
});

// Mañanas y sesiones de una semana: m = mañanas L..D; s = { dia: durante } (carrera con K = Sí).
const semana = (lunes, m, s = {}) => {
  const out = {};
  m.forEach((v, i) => {
    const f = C.sumarDias(lunes, i);
    const d = 'LMXJVSD'[i];
    out[f] = { decline: v };
    if (s[d] !== undefined) Object.assign(out[f], { during: s[d] }, d === 'X' || d === 'D' ? { back60: 'Sí' } : {});
  });
  return out;
};
const VERDE = { L: 2, X: 1, J: 2, D: 1 };

test('novedad: se compara con la referencia, no con el día anterior (empeoramiento lento)', () => {
  // S3: el martes ya sube a 3 y el miércoles sigue en 3: «igual que ayer», pero peor que la referencia (2).
  const p = progresar({ ...S2_BIEN, ...semana('2026-11-02', [2, 3, 3], { L: 2 }) }, '2026-11-04');
  assert.equal(p.semanas.S3.prensa.nivel, 2);                       // el lunes, a 2: hay novedad
  assert.equal(p.semanas.S3.carrera.nivel, 1, p.semanas.S3.carrera.motivo);
  assert.match(p.semanas.S3.carrera.motivo, /esa mañana \(3\) peor que la referencia \(2\)/);
});

test('atribución: una novedad ya validada no se culpa; sin novedad sin validar -> brote', () => {
  // S3 en verde (las novedades del lunes y del miércoles validan sus dos mañanas); el domingo,
  // la mañana del lunes sale peor: no queda novedad sin validar.
  const dias = { ...S2_BIEN, ...semana('2026-11-02', [2, 2, 2, 2, 2, 2, 2], VERDE), ...semana('2026-11-09', [3, 3, 3]) };
  const p = progresar(dias, '2026-11-11');
  assert.equal(p.brotes.length, 1);
  assert.match(p.brotes[0].motivo, /sin ninguna novedad sin validar/);
  assert.deepEqual([p.semanas.S4.prensa.nivel, p.semanas.S4.carrera.nivel], [1, 1]);
});

test('bici: no entra el viernes de S4 si S2 o S3 tuvieron sesiones en Retroceder', () => {
  const dias = { ...S2_BIEN, ...semana('2026-11-02', [2, 2, 2, 2, 3, 2, 2], VERDE), ...semana('2026-11-09', [2, 2, 2, 2, 2]) };
  const p = progresar(dias, '2026-11-13');
  assert.equal(p.bici.quitas.length, 1);
  assert.equal(p.bici.quitas[0].desde, '2026-11-13');
  assert.match(p.bici.quitas[0].motivo, /S2 o S3 tuvieron sesiones en Retroceder \(J 05\/11\)/);
  assert.ok(C.biciQuitada(p.bici, '2026-11-13'));
});

// S3 y S4 en verde; la bici entra el viernes 13/11; el domingo sube a 3 y el lunes 16/11, a 4:
// el fallo del domingo (24 h) es de la última novedad sin validar, la bici.
const BICI = {
  ...S2_BIEN, ...semana('2026-11-02', [2, 2, 2, 2, 2, 2, 2], VERDE),
  ...semana('2026-11-09', [2, 2, 2, 2, 2, 2, 3], VERDE),
  ...semana('2026-11-16', [4, 3, 3, 3, 3, 3, 3], VERDE), ...semana('2026-11-23', [3, 3, 3]),
};

test('bici: se quita si se le atribuye un fallo y vuelve tras una semana entera en verde', () => {
  const p = progresar(BICI, '2026-11-24');
  assert.equal(p.brotes.length, 0);
  assert.equal(p.bici.quitas.length, 1, JSON.stringify(p.bici.quitas));
  const q = p.bici.quitas[0];
  assert.deepEqual([q.desde, q.hasta], ['2026-11-16', '2026-11-22']);
  assert.match(q.motivo, /fallo atribuido a la bici \(D 15\/11\)/);
  assert.ok(C.biciQuitada(p.bici, '2026-11-17'));
  assert.equal(C.biciQuitada(p.bici, '2026-11-24'), null);
  // La prensa y la carrera no pagan el fallo de la bici.
  assert.ok(!/^Retroceder/.test(p.semanas.S5.prensa.motivo) && !/^Retroceder/.test(p.semanas.S5.carrera.motivo));
  assert.deepEqual([p.semanas.S5.prensa.nivel, p.semanas.S5.carrera.nivel], [p.semanas.S4.prensa.nivel, p.semanas.S4.carrera.nivel]);
});

test('bici: un brote también la quita (lo primero que se quita)', () => {
  const dias = { ...BICI, ...semana('2026-11-16', [4, 3, 3, 3, 3, 3, 3], { L: 4, X: 3 }) };   // lunes 4/10 y miércoles 3/10: dos seguidas
  const p = progresar(dias, '2026-11-19');
  assert.ok(p.brotes.some((b) => /dos sesiones seguidas/.test(b.motivo)));
  assert.ok(C.biciQuitada(p.bici, '2026-11-20'));
});

test('progresión: un nivel real apuntado manda sobre la propuesta y las semanas siguientes parten de él', () => {
  const p = progresar(S2_BIEN, '2026-11-02', { weeks: { S2: { pressLevel: 0 } } });
  assert.equal(p.semanas.S2.prensa.nivel, 0);
  assert.equal(p.semanas.S3.prensa.nivel, 1);
});

test('progresión: nunca pasa del máximo del calendario y deja de calcularse más allá de la semana que viene', () => {
  const p = progresar(S2_BIEN, '2026-11-02');
  for (const [s, x] of Object.entries(p.semanas)) {
    const n = +s.slice(1);
    assert.ok(x.prensa.nivel <= PLAN.PRENSA_MAX[n] && x.carrera.nivel <= PLAN.CARRERA_MAX[n], s);
  }
  assert.deepEqual(Object.keys(p.semanas), ['S2', 'S3', 'S4']);
});

test('prescripción: etiquetas de prensa, sentadilla, búlgara, touchdown y carrera', () => {
  const s3 = progresar(S2_BIEN, '2026-11-02').semanas.S3;
  const P = (prog, nombre) => C.prescripcion(ej(prog, nombre), s3, PLAN, 3);
  assert.equal(P('prensa').label, '2 x10/pierna\nescalón 1 · nov: +1 escalón');
  assert.equal(P('prensa:anterior').label, '2 x10-15/pierna\nescalón 0');
  assert.equal(P('prensa:sigue', 'Sentadilla').label, '3 x10\nescalón 1 (prof. del lunes)');
  assert.deepEqual([P('prensa:sigue', 'Bulgarian').sets, P('prensa:sigue', 'Bulgarian').reps], [2, 10]);
  assert.equal(P('carrera').label, "N2 · 6×(2'/1')\nnivel nuevo");
  assert.equal(P('carrera:domingo').label, "N2 · 6×(2'/1')\nrepite el miércoles");
  assert.equal(C.prescripcion({ prog: 'otro', pres: [] }, s3, PLAN, 3), null);
});

test('RODILLA_DATA: 63 días del 26/10 al 27/12 con D/E/F del volcado', () => {
  assert.equal(DATA.dias.length, 63);
  assert.equal(DATA.dias[0].fecha, '2026-10-26');
  assert.equal(DATA.dias[62].fecha, '2026-12-27');
  const letras = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];
  DATA.dias.forEach((d, i) => {
    const f = new Date(d.fecha + 'T12:00:00Z');
    assert.equal(d.dia, letras[f.getUTCDay()], d.fecha);
    assert.equal(d.sem, 'S' + (2 + Math.floor(i / 7)), d.fecha);
    // Semáforo solo en días con carga de rodilla: martes y viernes, «—».
    if (d.dia === 'M' || d.dia === 'V') assert.equal(d.regla, N, d.fecha);
  });
  assert.deepEqual(DATA.reglas, { gimnasio: G, carrera: R, ninguna: N });
  assert.deepEqual(DATA.entrada.map((e) => e.dia), ['martes', 'miércoles', 'miércoles']);
  assert.equal(DATA.tests.length, 4);
  assert.equal(DATA.escalones.length, 5);
  assert.ok(!/columna|celda/i.test(DATA.textos.ayuda), 'la ayuda de la app no habla del Excel');

  const h = JSON.parse(leer('docs/plan-rodilla/volcado.json'))['Seguimiento rodilla'];
  DATA.dias.forEach((d, i) => {
    const r = 5 + i;
    assert.equal(String(h['A' + r].v).slice(0, 10), d.fecha, 'fecha fila ' + r);
    assert.equal(h['D' + r].v, d.sesion, 'sesión ' + d.fecha);
    assert.equal(h['E' + r].v, d.regla, 'regla ' + d.fecha);
    assert.equal(h['F' + r].v, d.novedad, 'novedad ' + d.fecha);
  });
  assert.equal(h.A84.v, DATA.textos.resumen);
  assert.equal(h.A101.v, DATA.textos.fuerza); assert.equal(h.A110.v, DATA.textos.escalones);
  DATA.entrada.forEach((e, i) => assert.equal(h['A' + (89 + i)].v, e.texto));
  DATA.tests.forEach((t, i) => { assert.equal(h['A' + (97 + i)].v, t.nombre); assert.equal(String(h['D' + (97 + i)].v).slice(0, 10), t.fecha); });
});

console.log(fallos ? `\n${fallos} fallo(s)` : '\nTodo bien');
process.exit(fallos ? 1 : 0);
