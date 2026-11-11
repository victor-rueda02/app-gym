/* Prueba de js/progreso-calc.js (1RM estimado y agregaciones de Progreso), sin navegador ni dependencias.
       node tests/progreso-calc.test.mjs */
import assert from 'node:assert/strict';
import { cargar } from './cargar.mjs';

const { ProgresoCalc: C, PLAN } = cargar(['ProgresoCalc', 'PLAN'], { extra: ['js/progreso-calc.js'] });

let fallos = 0;
const test = (name, fn) => {
  try { fn(); console.log(`  OK  ${name}`); } catch (e) { fallos++; console.log(` FALLO ${name}\n        ${e.message}`); }
};

const SESIONES = [...Object.values(PLAN.BLOCK_VOL), ...Object.values(PLAN.BLOCK_A), ...Object.values(PLAN.BLOCK_B)];
const G = PLAN.VOL_GRUPOS;
const cat = C.catalogo(SESIONES, G);
const v = (kg, reps, rir) => C.estimar1RM(kg, reps, rir).valor;

test('num: coma, espacios, números y no válidos', () => {
  assert.equal(C.num('72.5'), 72.5);
  assert.equal(C.num('72,5'), 72.5);
  assert.equal(C.num(' 8 '), 8);
  assert.equal(C.num(72.5), 72.5);
  for (const x of ['', null, undefined, '10-12', 'abc', NaN, Infinity]) assert.equal(C.num(x), null);
});

test('redondear05', () => {
  assert.equal(C.redondear05(106.67), 106.5);
  assert.equal(C.redondear05(106.8), 107);
  assert.equal(C.redondear05(133.33), 133.5);
});

test('Brzycki', () => {
  assert.equal(v(100, 5, 0), 112.5);
  assert.equal(v('80', '8', '2'), 106.5);
  assert.equal(C.estimar1RM(80, 8, 2).repsEf, 10);
  assert.equal(C.estimar1RM(80, 8, 2).formula, 'brzycki');
});

test('Epley', () => {
  assert.equal(v(60, 10, 2), 84);
  assert.equal(v(100, 11, 0), 136.5);
  assert.equal(C.estimar1RM(60, 10, 2).formula, 'epley');
});

test('borde 10/11: Brzycki frente a Epley', () => {
  assert.equal(v(100, 10, 0), 133.5);
  assert.equal(C.estimar1RM(100, 10, 0).formula, 'brzycki');
  assert.equal(C.estimar1RM(100, 11, 0).formula, 'epley');
});

test('borde 15/16', () => {
  assert.equal(v(50, 15, 0), 75);
  assert.equal(C.estimar1RM(50, 15, 0).formula, 'epley');
  const r = C.estimar1RM(50, 14, 2);
  assert.deepEqual(r, { valor: null, repsEf: 16, formula: null, sinRir: false });
});

test('RIR vacío, con coma y no válido', () => {
  const r = C.estimar1RM(100, 5, '');
  assert.equal(r.valor, 112.5); assert.equal(r.sinRir, true);
  assert.equal(C.estimar1RM(100, 5, null).sinRir, true);
  assert.equal(C.estimar1RM(100, 5, 0).sinRir, false);
  assert.equal(C.estimar1RM(100, 5, '1,5').repsEf, 6.5);
  assert.equal(C.estimar1RM(100, 5, 'x').valor, null);
  assert.equal(C.estimar1RM(100, 5, '-1').valor, null);
});

test('entradas no válidas -> null', () => {
  for (const [k, r] of [['', 5], ['0', 5], [100, ''], [100, '10-12'], [100, 0], [100, 5.5], [-5, 5], ['abc', 5]]) {
    assert.deepEqual(C.estimar1RM(k, r, 2), { valor: null, repsEf: null, formula: null, sinRir: false });
  }
});

test('fmt1RM', () => {
  assert.equal(C.fmt1RM(C.estimar1RM(80, 8, 2)), '~106,5');
  assert.equal(C.fmt1RM(112), '~112');
  assert.equal(C.fmt1RM(C.estimar1RM('', 8, 2)), '—');
  assert.equal(C.fmt1RM(null), '—');
});

test('semanaDe y sumarDias', () => {
  assert.equal(C.semanaDe('2026-10-25'), '2026-10-19');
  assert.equal(C.semanaDe('2026-10-19'), '2026-10-19');
  assert.equal(C.semanaDe('2026-10-21'), '2026-10-19');
  assert.equal(C.semanaDe('2026-03-01'), '2026-02-23');
  assert.equal(C.sumarDias('2026-10-28', 5), '2026-11-02');
  assert.equal(C.sumarDias('2026-01-01', -1), '2025-12-31');
});

test('catalogo con el plan real', () => {
  const p = cat['press-inclinado-barra-30-40'];
  assert.ok(p.conRir && p.hipertrofia && p.conCarga && !p.sides);
  const pr = cat['prensa-unil-pesado-y-lento-n-1'];
  assert.ok(pr.conCarga && !pr.conRir && !pr.hipertrofia && pr.sides);
  const cm = cat['curl-de-muneca-en-extension-mancuerna'];
  assert.ok(!cm.conCarga && !cm.hipertrofia);
  assert.ok(!cat['test-fuerza-extension-unilateral-en-maquina-90-45'].conCarga);
  assert.ok(!cat['andar-correr-en-llano'].conCarga);
});

test('catalogo: gana la primera aparición y s1/s2', () => {
  const c = C.catalogo([
    { exercises: [{ id: 'a', name: 'A', target: 'Pecho', pres: [{ kind: 'rir', sets: 2, rir: 1 }] }] },
    { exercises: [{ id: 'a', name: 'A2', target: 'Espalda', s1: { kind: 'fixed' } }, { id: 'b', name: 'B', target: 'Pecho', s1: { kind: 'fixed' }, s2: { kind: 'none' } }] },
  ], ['Pecho']);
  assert.equal(c.a.name, 'A'); assert.ok(c.a.conRir);
  assert.ok(c.b.conCarga && !c.b.conRir && c.b.hipertrofia);
});

/* Datos de ejemplo: semana del 5/10, semana vacía (12/10) y semana del 19/10. */
const PRESS = 'press-inclinado-barra-30-40';
const ELEV = 'elev-laterales-polea';
const PRENSA = 'prensa-unil-pesado-y-lento-n-1';
const MUNECA = 'curl-de-muneca-en-extension-mancuerna';
const s = (kg, reps, rir, side) => ({ kg, reps, secs: '', rir, mins: '', ...(side ? { side } : {}) });
const data = {
  days: {
    '2026-10-22': { entries: { [PRESS]: [s('80', '8', '2')], [ELEV]: [s('10', '10', '1', 'D')] } },
    '2026-10-06': { entries: { [PRESS]: [s('80', '8', '2'), s('80', '8', '')], [ELEV]: [s('10', '12', '1')] } },
    '2026-10-08': { entries: { [PRENSA]: [s('100', '10', '2', 'D'), s('90', '10', '2', 'I')] } },
    '2026-10-20': {
      entries: {
        [PRESS]: [s('82,5', '8', '2'), s('', '8', '')],
        [ELEV]: [s('10', '12', '1'), s('10', '12', '0')],
        [PRENSA]: [s('100', '10', '2', 'D'), s('95', '10', '2', 'I')],
        [MUNECA]: [s('5', '12', '2')],
        'ejercicio-fantasma': [s('50', '5', '1')],
      },
    },
  },
};

test('seriesConCarga: solo con carga válida, ordenadas, sin correctivos', () => {
  const sc = C.seriesConCarga(data, cat);
  assert.deepEqual(sc.map((x) => x.fecha), ['2026-10-06', '2026-10-06', '2026-10-06', '2026-10-08', '2026-10-08', '2026-10-20', '2026-10-20', '2026-10-20', '2026-10-20', '2026-10-20', '2026-10-22', '2026-10-22']);
  assert.ok(!sc.some((x) => x.exId === MUNECA || x.exId === 'ejercicio-fantasma'));
  const sinRir = sc.find((x) => x.fecha === '2026-10-06' && x.kg === 80 && x.sinRir);
  assert.equal(sinRir.valor, 99.5); assert.equal(sinRir.rir, null);
  assert.equal(sc.find((x) => x.side === 'I' && x.fecha === '2026-10-08').side, 'I');
});

test('mejor1RMPorDia: mejor del día, líneas y récords', () => {
  const l = C.mejor1RMPorDia(data, cat, PRESS);
  assert.equal(l.length, 1); assert.equal(l[0].side, '');
  assert.deepEqual(l[0].puntos.map((p) => [p.fecha, p.valor, p.record]), [['2026-10-06', 106.5, false], ['2026-10-20', 110, true], ['2026-10-22', 106.5, false]]);
  assert.equal(l[0].puntos[0].kg, 80); assert.equal(l[0].puntos[0].reps, 8); assert.equal(l[0].puntos[0].rir, 2);
  const p = C.mejor1RMPorDia(data, cat, PRENSA);
  assert.deepEqual(p.map((x) => x.side), ['D', 'I']);
  assert.deepEqual(p[0].puntos.map((q) => [q.valor, q.record]), [[140, false], [140, false]]);
  assert.deepEqual(p[1].puntos.map((q) => [q.valor, q.record]), [[126, false], [133, true]]);
  assert.deepEqual(C.mejor1RMPorDia(data, cat, 'nada'), []);
});

test('mejor1RMPorDia: línea sin lado aparte de D', () => {
  const d = { days: { '2026-10-06': { entries: { [PRENSA]: [s('100', '10', '2'), s('100', '10', '2', 'D')] } } } };
  assert.deepEqual(C.mejor1RMPorDia(d, cat, PRENSA).map((x) => x.side), ['', 'D']);
});

test('ejerciciosConDatos', () => {
  const e = C.ejerciciosConDatos(data, cat);
  assert.deepEqual(e.map((x) => x.exId).sort(), [ELEV, PRENSA, PRESS].sort());
  assert.equal(e[0].ultimo, '2026-10-22');
  const pr = e.find((x) => x.exId === PRENSA);
  assert.equal(pr.dias, 2); assert.equal(pr.mejor, 140); assert.equal(pr.ultimo, '2026-10-20');
});

test('records', () => {
  const r = C.records(data, cat);
  assert.equal(r.length, 2);
  assert.ok(r.every((x) => x.fecha === '2026-10-20'));
  const pr = r.find((x) => x.exId === PRESS);
  assert.deepEqual([pr.valor, pr.anterior, pr.side], [110, 106.5, '']);
  const pi = r.find((x) => x.exId === PRENSA);
  assert.deepEqual([pi.valor, pi.anterior, pi.side], [133, 126, 'I']);
  assert.equal(C.records(data, cat, 1).length, 1);
});

test('progresion: mejor, igual y peor', () => {
  const p = C.progresion(data, cat);
  const get = (id, side) => p.find((x) => x.exId === id && x.side === side);
  assert.deepEqual([get(PRESS, '').tendencia, get(PRESS, '').diff], ['peor', -3.5]);
  assert.equal(get(PRENSA, 'D').tendencia, 'igual');
  const i = get(PRENSA, 'I');
  assert.deepEqual([i.tendencia, i.diff, i.ultimo.valor, i.previo.valor, i.previo.fecha], ['mejor', 7, 133, 126, '2026-10-08']);
  assert.equal(get(ELEV, '').tendencia, 'igual');   // 14,5 -> 14,5
});

test('volumenSemanal: semanas, D/I a 0,5, exclusiones, hueco a 0', () => {
  const vs = C.volumenSemanal(data, cat, G);
  assert.deepEqual(vs.semanas, ['2026-10-05', '2026-10-12', '2026-10-19']);
  assert.deepEqual(Object.keys(vs.porGrupo), G);
  assert.deepEqual(vs.porGrupo.Pecho.series, [2, 0, 3]);
  assert.deepEqual(vs.porGrupo.Pecho.tonelaje, [1280, 0, 660 + 640]);
  assert.deepEqual(vs.porGrupo['Hombro lat.'].series, [1, 0, 2.5]);
  assert.deepEqual(vs.porGrupo['Hombro lat.'].tonelaje, [120, 0, 240 + 100]);
  assert.deepEqual(vs.total.series, [3, 0, 5.5]);
  assert.deepEqual(vs.total.tonelaje, [1400, 0, 1640]);
  assert.deepEqual(vs.porGrupo.Espalda.series, [0, 0, 0]);
  assert.deepEqual(C.volumenSemanal({ days: {} }, cat, G), { semanas: [], porGrupo: Object.fromEntries(G.map((g) => [g, { series: [], tonelaje: [] }])), total: { series: [], tonelaje: [] } });
});

test('rirMedioSemanal', () => {
  assert.deepEqual(C.rirMedioSemanal(data, cat, G), [
    { semana: '2026-10-05', media: 1.5, n: 2 },
    { semana: '2026-10-19', media: 1.2, n: 5 },
  ]);
});

test('rirPrescrito semana 1 con el plan real (cálculo independiente)', () => {
  let suma = 0; let n = 0;
  for (const ses of Object.values(PLAN.BLOCK_VOL)) {
    for (const ex of ses.exercises) {
      if (!G.includes(ex.target)) continue;
      const p = ex.pres[0];
      if (p.kind !== 'rir') continue;
      for (let i = 0; i < p.sets; i++) { suma += p.rirs ? p.rirs[i] : p.rir; n++; }
    }
  }
  assert.ok(n > 0);
  assert.equal(C.rirPrescrito(SESIONES, 1, G), Math.round((suma / n) * 10) / 10);
  assert.equal(C.rirPrescrito([], 1, G), null);
  // Con datos a mano: 2 series a RIR 1 y 3 con rirs [1,1,0] -> 3/5 = 0,6... = (2+2)/5
  const ses = [{ exercises: [
    { id: 'a', target: 'Pecho', pres: [{ kind: 'rir', sets: 2, rir: 2 }] },
    { id: 'b', target: 'Pecho', pres: [{ kind: 'rir', sets: 3, rir: 0, rirs: [1, 1, 0] }] },
    { id: 'c', target: 'Rehab', pres: [{ kind: 'rir', sets: 9, rir: 3 }] },
    { id: 'd', target: 'Pecho', pres: [{ kind: 'fixed', sets: 4, reps: 10 }] },
  ] }];
  assert.equal(C.rirPrescrito(ses, 1, G), 1.2);
});

test('cumplimiento', () => {
  assert.equal(C.cumplimiento(26, 52), 50);
  assert.equal(C.cumplimiento(1, 3), 33);
  assert.equal(C.cumplimiento(5, 0), null);
  assert.equal(C.cumplimiento(0, 10), 0);
});

test('peso corporal: qué ejercicios', () => {
  assert.equal(C.esPesoCorporal('Dominada neutra dorsal'), true);
  assert.equal(C.esPesoCorporal('Dominadas abducción hombro'), true);
  assert.equal(C.esPesoCorporal('Fondos en paralelas'), true);
  assert.equal(C.esPesoCorporal('Abs colgado (retroversión)'), false);
  assert.equal(C.esPesoCorporal('Jalón neutro'), false);
  assert.equal(cat['dominada-neutra-dorsal'].pesoCorporal, true);
  assert.equal(cat['jalon-neutro'].pesoCorporal, false);
});

test('pesosDiarios: primer pesaje de cada día, ignora basura', () => {
  // Horas a mediodía UTC: la fecha local es la misma en Europa y América.
  const reg = [
    { t: '2026-10-20T13:00:00.000Z', kg: 73.1 },
    { t: '2026-10-20T11:00:00.000Z', kg: 72.456 },   // el primero del día, aunque venga después
    { t: '2026-10-22T12:00:00.000Z', kg: 72.9 },
    { t: 'mal', kg: 70 }, { t: '2026-10-23T12:00:00.000Z', kg: '71' }, null, { t: '2026-10-24T12:00:00.000Z', kg: 0 },
  ];
  assert.deepEqual(C.pesosDiarios(reg), { '2026-10-20': 72.46, '2026-10-22': 72.9 });
  assert.deepEqual(C.pesosDiarios(null), {});
});

test('pesoDelDia: el del día, el más cercano antes, después, o nada a más de 7 días', () => {
  const p = { '2026-10-20': 72.5, '2026-10-30': 74 };
  assert.deepEqual(C.pesoDelDia(p, '2026-10-20'), { kg: 72.5, fecha: '2026-10-20' });
  assert.deepEqual(C.pesoDelDia(p, '2026-10-23'), { kg: 72.5, fecha: '2026-10-20' });
  assert.deepEqual(C.pesoDelDia(p, '2026-10-25'), { kg: 72.5, fecha: '2026-10-20' });   // 5 antes gana a 5 después
  assert.deepEqual(C.pesoDelDia(p, '2026-10-26'), { kg: 74, fecha: '2026-10-30' });
  assert.equal(C.pesoDelDia(p, '2026-11-10'), null);
  assert.equal(C.pesoDelDia(undefined, '2026-10-20'), null);
});

test('peso corporal en el 1RM y el tonelaje: peso + lastre', () => {
  const data = {
    peso: { '2026-10-19': 72 },
    days: {
      '2026-10-21': { entries: { 'dominada-neutra-dorsal': [
        { kg: '10', reps: '6', rir: '2', secs: '', mins: '' },   // (72 + 10) x 6 @2 -> Brzycki 82*36/29 = 101,79 -> 102
        { kg: '', reps: '8', rir: '1', secs: '', mins: '' },     // sin lastre: 72 x 8 @1 -> 72*36/28 = 92,57 -> 92,5
      ] } },
    },
  };
  const ss = C.seriesConCarga(data, cat);
  assert.deepEqual(ss.map((x) => [x.kg, x.lastre, x.corporal, x.valor]), [[82, 10, 72, 102], [72, 0, 72, 92.5]]);
  assert.equal(C.mejor1RMPorDia(data, cat, 'dominada-neutra-dorsal')[0].puntos[0].corporal, 72);
  const vol = C.volumenSemanal(data, cat, G);
  assert.equal(vol.porGrupo.Espalda.tonelaje[0], 82 * 6 + 72 * 8);
  // Sin peso cerca: como antes, solo el lastre (y la serie sin lastre no da 1RM).
  const sinPeso = { ...data, peso: {} };
  assert.deepEqual(C.seriesConCarga(sinPeso, cat).map((x) => [x.kg, x.corporal, x.valor]), [[10, null, 12.5]]);
  // En un ejercicio normal el peso corporal no cambia nada.
  assert.deepEqual(C.cargaSerie({ kg: '50' }, false, { '2026-10-21': 72 }, '2026-10-21'), { kg: 50, lastre: null, corporal: null });
});

console.log(fallos ? `\n${fallos} fallo(s)` : '\nTodo bien');
process.exit(fallos ? 1 : 0);
