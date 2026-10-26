/* Prueba de la migración v3 -> v4 de js/store.js, sin navegador: se cargan plan.js
   y store.js con stubs de localStorage e indexedDB.
       node tests/migracion.test.mjs */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const leer = (f) => fs.readFileSync(path.join(root, 'js', f), 'utf8');
const PLAN = new Function(leer('plan.js') + ';return PLAN;')();

let fallos = 0;
const test = async (name, fn) => {
  try { await fn(); console.log(`  OK  ${name}`); } catch (e) { fallos++; console.log(` FALLO ${name}\n        ${e.message}`); }
};

/* Carga un Store nuevo con `inicial` ya guardado en localStorage. */
function cargarStore(inicial) {
  const mem = new Map();
  if (inicial !== undefined) mem.set('gym.log.v1', JSON.stringify(inicial));
  globalThis.localStorage = {
    getItem: (k) => (mem.has(k) ? mem.get(k) : null),
    setItem: (k, v) => { mem.set(k, String(v)); },
  };
  globalThis.indexedDB = { open() { throw new Error('sin IndexedDB en las pruebas'); } };
  const Store = new Function(leer('store.js') + ';return Store;')();
  return { Store, guardado: () => JSON.parse(mem.get('gym.log.v1')) };
}

const s = (kg, reps, rir = '') => ({ kg, reps, secs: '', rir });
const clon = (x) => JSON.parse(JSON.stringify(x));

const V3 = {
  v: 3,
  days: {
    '2026-07-20': { sessionId: 'A-L', notes: 'julio', entries: { 'unilateral-abduction': [s('20', '15', '2')], 'touchdown-squat': [s('', '15')] } },
    '2026-10-19': { sessionId: 'VOL-L', notes: '', entries: {
      'unilateral-abduction': [s('25', '15', '2'), s('25', '14', '1')], 'prensa-unil': [s('100', '12')], 'touchdown-squat': [s('', '15')] } },
    '2026-10-22': { sessionId: 'VOL-J', notes: '', entries: {
      'unilateral-abduction': [s('25', '15')], 'back-squat': [s('60', '10'), s('60', '10')], 'bulgarian-split-squat': [s('10', '12')] } },
    '2026-10-24': { sessionId: 'VOL-S', notes: '', entries: {
      'unilateral-abduction': [s('20', '15')], 'movilidad-trapecio-inferior': [{ kg: '', reps: '', secs: '', rir: '', mins: '5' }] } },
    '2026-10-23': { sessionId: 'VOL-V', notes: '', entries: { 'bici-z2-z3-prog': [{ kg: '', reps: '', secs: '', rir: '', mins: '12' }] } },
  },
};
const nSeries = (data) => Object.values(data.days).reduce((a, d) => a + Object.values(d.entries).reduce((b, l) => b + l.length, 0), 0);
const claves = (data, d) => Object.keys(data.days[d].entries).sort();

await test('v3 -> v4: recoloca por sesión, conserva series y crea knee', async () => {
  const { Store, guardado } = cargarStore(clon(V3));
  await Store.init();
  const d = guardado();
  assert.equal(d.v, 4);
  assert.equal(nSeries(d), nSeries(V3));
  assert.deepEqual(claves(d, '2026-07-20'), ['touchdown-squat', 'unilateral-abduction']);   // julio no se toca
  assert.deepEqual(claves(d, '2026-10-19'),
    ['abduccion-de-pie-unilateral-maquina', 'prensa-unil-pesado-y-lento-n-1', 'touchdown-squat']);
  assert.equal(d.days['2026-10-19'].entries['abduccion-de-pie-unilateral-maquina'].length, 2);
  assert.deepEqual(claves(d, '2026-10-22'),
    ['abduccion-de-pie-unilateral-maquina', 'bulgarian-split-squat', 'sentadilla-al-cajon-o-desde-pines-pesado-y-lento-n-2']);
  assert.deepEqual(claves(d, '2026-10-24'), ['abduccion-unilateral', 'elevacion-lateral-en-prono-t-mancuernas-banco']);
  assert.deepEqual(claves(d, '2026-10-23'), ['bici-z2-sin-z3-en-este-bloque']);
  assert.deepEqual(d.knee, { days: {}, weeks: {}, entry: {}, tests: {}, depth: {} });
});

await test('los ids nuevos existen en el plan y los antiguos ya no', async () => {
  const { Store, guardado } = cargarStore(clon(V3));
  await Store.init();
  const d = guardado();
  const ids = (sid) => Object.values(PLAN.BLOCK_VOL).find((x) => x.id === sid).exercises.map((e) => e.id);
  for (const [dia, sid] of [['2026-10-19', 'VOL-L'], ['2026-10-22', 'VOL-J'], ['2026-10-24', 'VOL-S'], ['2026-10-23', 'VOL-V']]) {
    for (const k of Object.keys(d.days[dia].entries)) assert.ok(ids(sid).includes(k), `${sid}: ${k}`);
  }
});

await test('un registro v4 no cambia al migrar (idempotente) y conserva knee', async () => {
  const V4 = clon(V3);
  V4.v = 4;
  V4.days['2026-10-19'].entries = { 'unilateral-abduction': [{ ...s('25', '15'), side: 'D' }] };   // id viejo en v4: ya no se mueve
  V4.knee = { days: { '2026-10-26': { decline: 2, steps: 1 } }, weeks: { S2: { runLevel: 'N1' } }, entry: {}, tests: {}, depth: {} };
  const antes = clon(V4);
  const { Store, guardado } = cargarStore(clon(V4));
  await Store.init();
  assert.deepEqual(guardado(), antes);
  assert.deepEqual(Store.all(), antes);
});

await test('un registro v4 sin knee lo recibe, e importAll migra copias antiguas', async () => {
  const { Store } = cargarStore(undefined);
  await Store.init();
  assert.deepEqual(Store.knee(), { days: {}, weeks: {}, entry: {}, tests: {}, depth: {} });
  Store.importAll(clon(V3));
  assert.equal(Store.all().v, 4);
  assert.ok(Store.all().days['2026-10-19'].entries['prensa-unil-pesado-y-lento-n-1']);
  assert.deepEqual(Store.knee().days, {});
  Store.importAll({ v: 4, days: {} });
  assert.deepEqual(Object.keys(Store.knee()).sort(), ['days', 'depth', 'entry', 'tests', 'weeks']);
});

await test('setKnee escribe, persiste y borra campos y claves vacías', async () => {
  const { Store, guardado } = cargarStore(undefined);
  await Store.init();
  Store.setKnee('days', '2026-10-26', 'decline', 3);
  Store.setKnee('days', '2026-10-26', 'novelty', '');
  Store.setKnee('tests', 't1', 'load', '40');
  assert.deepEqual(guardado().knee.days['2026-10-26'], { decline: 3, novelty: '' });
  assert.deepEqual(guardado().knee.tests.t1, { load: '40' });
  Store.setKnee('days', '2026-10-26', 'decline', undefined);
  assert.deepEqual(guardado().knee.days['2026-10-26'], { novelty: '' });
  Store.setKnee('days', '2026-10-26', 'novelty', undefined);
  assert.equal('2026-10-26' in guardado().knee.days, false);
  assert.throws(() => Store.setKnee('nada', 'x', 'y', 1));
});

await test('las series admiten side y se guardan tal cual', async () => {
  const { Store, guardado } = cargarStore(undefined);
  await Store.init();
  Store.saveSets('2026-11-02', 'touchdown-squat', [{ kg: '', reps: '12', secs: '', rir: '', mins: '', side: 'D' }, { kg: '', reps: '11', secs: '', rir: '', mins: '', side: 'I' }]);
  assert.deepEqual(guardado().days['2026-11-02'].entries['touchdown-squat'].map((x) => x.side), ['D', 'I']);
});

console.log(fallos ? `\n${fallos} fallo(s)` : '\nTodo OK');
process.exit(fallos ? 1 : 0);
