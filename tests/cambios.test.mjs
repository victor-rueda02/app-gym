/* Cambios desde Hoy (js/plan.js «Cambios hechos desde la app», js/store.js «Cambios desde Hoy»):
   mover el entreno de un día a otro de la semana y añadir ejercicios a un día, y su efecto en
   la rodilla (js/rodilla-calc.js, diasMovidos).
       node tests/cambios.test.mjs */
import assert from 'node:assert/strict';
import { cargar } from './cargar.mjs';

const { PLAN, RodillaCalc: C, RODILLA_DATA: DATA } = cargar(['PLAN', 'RodillaCalc', 'RODILLA_DATA'], { rodilla: true });
let cambios = {};
let sinV = [];
PLAN.setFuenteCambios(() => cambios);
PLAN.setFuenteSinViernes(() => sinV);
const con = (c, fn, v = []) => { const a = cambios; const b = sinV; cambios = c; sinV = v; try { return fn(); } finally { cambios = a; sinV = b; } };

let fallos = 0;
const test = (name, fn) => {
  try { fn(); console.log(`  OK  ${name}`); } catch (e) { fallos++; console.log(` FALLO ${name}\n        ${e.message}`); }
};

const W = (n) => PLAN.VOL_WEEKS[n - 1];
const porDia = (n) => Object.fromEntries(PLAN.sessionsFor(W(n)).map((s) => [s.id.slice(4), s]));
const ids = (s) => (s ? s.exercises.map((x) => x.id) : []);
const fila = (dias, fecha) => dias.find((d) => d.fecha === fecha);

test('sin cambios, la semana es la del Excel', () => {
  const antes = porDia(4);
  con({ movidos: { S5: { S: 'D' } } }, () => assert.deepEqual(porDia(4), antes));   // otra semana
  assert.equal(PLAN.diaEfectivo(4, 'S'), 'S');
});

test('S4: el sábado al domingo -> el domingo suma el torso a su carrera y el sábado queda libre', () => {
  const antes = porDia(4);
  con({ movidos: { S4: { S: 'D' } } }, () => {
    const s = porDia(4);
    assert.deepEqual(ids(s.D), [...ids(antes.D), ...ids(antes.S).filter((id) => !ids(antes.D).includes(id))]);
    assert.deepEqual(ids(s.S), []);
    assert.match(s.S.title, /^Libre \(movido al domingo\)$/);
    assert.equal(s.D.title, 'Carrera + lo del sábado');
    assert.equal(s.D.dow, 0);
    assert.deepEqual(s.D.movidosDe, ['S']);
    assert.equal(PLAN.diaEfectivo(4, 'S'), 'D');
    // Hoy: el domingo 15/11 lleva todo; el sábado 14/11 no lleva nada.
    assert.deepEqual(ids(PLAN.sesionDelDia('2026-11-15', {})), ids(s.D));
    const sab = PLAN.sesionDelDia('2026-11-14', {});
    assert.equal(sab.exercises.length, 0);
    // Lo ya apuntado el sábado no se pierde.
    const torso = ids(antes.S)[0];
    assert.deepEqual(ids(PLAN.sesionDelDia('2026-11-14', { [torso]: [{ kg: '10', reps: '8' }] })), [torso]);
  });
});

test('mover un día de pierna lleva la regla y la novedad de la rodilla al destino', () => {
  const dias = (c) => con(c, () => C.diasEfectivos(DATA.dias, PLAN));
  const normal = dias({});
  const lunes = fila(normal, '2026-11-23');   // S6: pierna 1 con la novedad de la prensa
  assert.notEqual(lunes.regla, '—');
  const movido = dias({ movidos: { S6: { L: 'M' } } });
  assert.equal(fila(movido, '2026-11-23').regla, '—');
  assert.match(fila(movido, '2026-11-23').sesion, /^Libre \(movido al martes\)$/);
  const martes = fila(movido, '2026-11-24');
  assert.equal(martes.regla, lunes.regla);
  assert.match(martes.sesion, /\(del lunes\)$/);
  assert.ok(martes.novedad.includes(lunes.novedad), martes.novedad);
  // Con la carrera el mismo día, manda la regla de carrera (≤2/10).
  const conCarrera = dias({ movidos: { S6: { L: 'X' } } });
  assert.match(fila(conCarrera, '2026-11-25').regla, /carrera/i);
  // La progresión busca la prensa en el martes.
  con({ movidos: { S6: { L: 'M' } } }, () => assert.equal(PLAN.diaEfectivo(6, 'L'), 'M'));
});

test('mover y semana sin viernes a la vez: se mueve lo que esa semana hay ese día', () => {
  con({ movidos: { S5: { J: 'S' } } }, () => {
    const s = porDia(5);
    // Sin viernes, el jueves lleva la pierna 2; al moverlo al sábado, la pierna 2 va el sábado.
    const pierna2 = ids(PLAN.sesionesBase(5).J);
    assert.ok(pierna2.every((id) => ids(s.S).includes(id)));
    assert.equal(PLAN.diaEfectivo(5, 'V'), 'S');   // V -> J (sin viernes) -> S (movido)
  }, [5]);
});

test('añadir un ejercicio del plan con series, reps y RIR propios', () => {
  const sab = porDia(5).S;
  const press = Object.values(PLAN.BLOCK_VOL).flatMap((s) => s.exercises).find((x) => x.pres[4].kind === 'rir' && !ids(sab).includes(x.id));
  const s = PLAN.sesionDelDia('2026-11-21', {}, [{ id: press.id, sets: '3', reps: '8-10', rir: '1' }]);
  const x = s.exercises[s.exercises.length - 1];
  assert.equal(x.id, press.id);
  assert.ok(x.added);
  assert.equal(x.prog, undefined);
  const p = PLAN.presFor(x, W(5));
  assert.deepEqual([p.kind, p.sets, p.rir, p.reps, p.label], ['rir', 3, 1, '8-10', '3 x8-10 @ RIR1']);
  // RIR 1/0, sin reps, y sin RIR (reps fijas).
  assert.equal(PLAN.presAnadida({ sets: 2, rir: '1/0' }).label, '2 @ RIR1/0');
  assert.deepEqual(PLAN.presAnadida({ sets: 2, rir: '1/0' }).rirs, [1, 0]);
  assert.deepEqual([PLAN.presAnadida({ sets: 4, reps: '12' }).kind, PLAN.presAnadida({ sets: 4, reps: '12' }).label], ['fixed', '4 x12']);
  // Un ejercicio que ya está en la sesión no se duplica.
  const yaEsta = ids(sab)[0];
  assert.equal(PLAN.sesionDelDia('2026-11-21', {}, [{ id: yaEsta, sets: 9 }]).exercises.filter((e) => e.id === yaEsta).length, 1);
});

test('añadir a un día libre convierte el descanso en entreno; con la prescripción del plan si es cardio', () => {
  assert.ok(PLAN.sesionDelDia('2026-11-19', {}).exercises.length);   // jueves de S5: pull
  const bici = Object.values(PLAN.BLOCK_VOL).flatMap((s) => s.exercises).find((x) => x.prog === 'bici');
  con({ movidos: { S5: { J: 'V' } } }, () => {
    const jueves = PLAN.sesionDelDia('2026-11-19', {});
    assert.equal(jueves.exercises.length, 0);
    const conBici = PLAN.sesionDelDia('2026-11-19', {}, [{ id: bici.id, plan: true }]);
    assert.equal(conBici.rest, false);
    const x = conBici.exercises[0];
    assert.equal(PLAN.presFor(x, W(5)).kind, 'cardio');
    assert.equal(x.prog, undefined);   // sin la lógica de bici quitada: es lo que se añadió
  });
});

test('ejercicio creado en la app: con su grupo, entra en el catálogo y en la sesión', () => {
  con({ extras: { 'extra-curl-arana': { name: 'Curl araña', target: 'Bíceps' } } }, () => {
    assert.ok(PLAN.catalogoAnadir().some((x) => x.id === 'extra-curl-arana' && x.propio));
    const s = PLAN.sesionDelDia('2026-11-21', {}, [{ id: 'extra-curl-arana', sets: '2', reps: '12', rir: '2' }]);
    const x = s.exercises.find((e) => e.id === 'extra-curl-arana');
    assert.deepEqual([x.name, x.target, PLAN.presFor(x, W(5)).label], ['Curl araña', 'Bíceps', '2 x12 @ RIR2']);
    // Si se quitó de la lista pero quedan series apuntadas, sigue saliendo.
    const y = PLAN.sesionDelDia('2026-11-21', { 'extra-curl-arana': [{ kg: '12', reps: '12' }] });
    assert.ok(y.exercises.some((e) => e.id === 'extra-curl-arana'));
  });
  // Sin el ejercicio en `extras`, un id desconocido no rompe nada.
  assert.ok(PLAN.sesionDelDia('2026-11-21', {}, [{ id: 'extra-no-existe', sets: 1 }]));
});

console.log(fallos ? `\n${fallos} fallo(s)` : '\nTodo OK');
process.exit(fallos ? 1 : 0);
