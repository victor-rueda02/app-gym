/* Invariantes del bloque «plan rodilla» que fijaste en la revisión: S1 ya hecha e
   intocable, hipertrofia como antes (52 -> 88), correctivos fuera del recuento, jueves y
   sábado. Si alguno de estos cambia A PROPÓSITO (lo pides tú), se actualiza aquí; si
   falla sin haberlo pedido, el Excel tiene un cambio que no tocaba.
   La comparación celda a celda de la app con el Excel está en tests/plan.test.mjs y
   tests/lector.test.mjs (genéricas). Compara con la versión anterior
   (git show c3ece19:js/plan.js) y, día a día en S1-S2, con el plan de antes de la semana
   nueva (main del 27/10, 9db8297).
       node tests/contenido.test.mjs */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { cargar, leer, root } from './cargar.mjs';

const { PLAN } = cargar(['PLAN']);
const show = (ref) => execFileSync('git', ['show', ref], { cwd: root, encoding: 'utf8', maxBuffer: 1 << 26 });
const VIEJO = new Function(`${show('c3ece19:js/plan.js')};return PLAN;`)();
// El plan de antes de la semana nueva (31/10): el código y el Excel de main del 27/10.
const ANTES = new Function(`${[leer('vendor/fflate.js'), ...['js/original-xlsx.js', 'js/lector-xlsx.js', 'js/plan.js']
  .map((f) => show(`9db8297:${f}`))].join('\n;\n')};return PLAN;`)();
// Desde S3 (31/10) las sesiones cambian de día: el pull del miércoles pasa al jueves, la
// pierna 2 del jueves al viernes y el torso del viernes al sábado (sus tres filas de
// espalda, al lunes). Letra de antes -> letra de ahora, para buscar cada ejercicio.
const MOVIDA = { X: 'J', J: 'V', V: 'S' };
const buscar = (k, id) => PLAN.BLOCK_VOL[MOVIDA[k] || k].exercises.find((x) => x.id === id)
  || Object.values(PLAN.BLOCK_VOL).flatMap((x) => x.exercises).find((x) => x.id === id);
// Excepción (31/10): el lunes 2/11 (S3, festivo) se entrena en casa y la celda lleva el
// sustituto en una línea «2/11: …»; las series y el RIR no cambian.
const sinFecha = (label) => label.split('\n').filter((l) => !/^\d{1,2}\/\d{1,2}: /.test(l)).join('\n');

let fallos = 0;
const test = (nombre, fn) => {
  try { fn(); console.log(`  OK  ${nombre}`); } catch (e) { fallos++; console.log(` FALLO ${nombre}\n        ${e.message.split('\n').slice(0, 6).join('\n        ')}`); }
};

test('S1 idéntica: cada ejercicio que ya existía conserva su prescripción de S1', () => {
  // Renombres de la migración v4 (DECISIONES 5/12); el resto conserva el id.
  const ren = {
    L: { 'unilateral-abduction': 'abduccion-de-pie-unilateral-maquina', 'prensa-unil': 'prensa-unil-pesado-y-lento-n-1' },
    J: { 'unilateral-abduction': 'abduccion-de-pie-unilateral-maquina', 'back-squat': 'sentadilla-al-cajon-o-desde-pines-pesado-y-lento-n-2' },
    S: { 'unilateral-abduction': 'abduccion-unilateral', 'movilidad-trapecio-inferior': 'elevacion-lateral-en-prono-t-mancuernas-banco' },
    V: { 'bici-z2-z3-prog': 'bici-z2-sin-z3-en-este-bloque' },
  };
  // En S1 cada sesión sigue en su día de entonces (la semana nueva empieza en S3).
  const s1 = PLAN.sessionsFor(PLAN.VOL_WEEKS[0]);
  let n = 0;
  for (const [k, vieja] of Object.entries(VIEJO.BLOCK_VOL)) {
    for (const e of vieja.exercises) {
      const id = (ren[k] || {})[e.id] || e.id;
      const nuevo = (s1.find((x) => x.id === `VOL-${k}`) || { exercises: [] }).exercises.find((x) => x.id === id);
      assert.ok(nuevo, `${k}: ${e.id} → ${id} no existe`);
      assert.equal(nuevo.pres[0].label, e.pres[0].label, `${k} ${e.name} → ${nuevo.name}: S1`);
      n++;
    }
  }
  assert.equal(n, 7 + 6 + 7 + 7 + 9 + 5);
  // Lo nuevo no se hacía en S1.
  for (const s of Object.values(PLAN.BLOCK_VOL)) {
    for (const e of s.exercises) {
      const existia = Object.values(VIEJO.BLOCK_VOL).some((v) => v.exercises.some((x) => x.id === e.id))
        || Object.values(ren).some((r) => Object.values(r).includes(e.id));
      if (!existia) assert.ok(['—', '-'].includes(e.pres[0].label), `${e.name}: S1 «${e.pres[0].label}»`);
    }
  }
});

test('S1 y S2 como se hicieron: cada día, los mismos ejercicios y prescripciones que en el plan de antes', () => {
  // Excepciones pedidas (31/10): en S2 el torso del viernes 30/10 se hizo el sábado 31/10 en
  // casa (con sus tres filas de espalda) y el test 1 pasó de S2 a S3 (viernes 6/11).
  const porDia = (P, w) => Object.fromEntries(P.sessionsFor(w).map((x) => [x.dow, x.exercises.map((e) => `${e.id} · ${e.pres[w.n - 1].label}`)]));
  for (const n of [1, 2]) {
    const antes = porDia(ANTES, ANTES.VOL_WEEKS[n - 1]);
    if (n === 2) {
      antes[6] = [...antes[5].filter((e) => !e.startsWith('bici-')), ...antes[6]];
      delete antes[5];   // el viernes 30/10 solo queda la bici, que en S2 no se hace
      antes[4] = antes[4].map((e) => (e.startsWith('test-fuerza') ? e.replace(/ · [\s\S]*$/, ' · —') : e));
    }
    assert.deepEqual(porDia(PLAN, PLAN.VOL_WEEKS[n - 1]), antes, `S${n}`);
  }
});

test('S1: el domingo es la sesión del sábado («Sábado/Domingo»), sin D/I, sin sesión de carrera', () => {
  const s1 = PLAN.VOL_WEEKS[0];
  const domingo = PLAN.sessionFor(s1.to).options[0];
  assert.equal(domingo.id, 'VOL-S');
  assert.equal(PLAN.sessionLabel(domingo, s1).name, 'Sábado/Domingo');
  assert.ok(!PLAN.sessionsFor(s1).some((s) => s.id === 'VOL-D'));
  for (const s of Object.values(PLAN.BLOCK_VOL)) for (const e of s.exercises) assert.equal(PLAN.sidesFor(e, s1), false, e.name);
  assert.equal(PLAN.sessionFor(PLAN.VOL_WEEKS[1].to).options[0].id, 'VOL-D');
});

test('hipertrofia como antes: los ejercicios con series @RIR conservan las 8 prescripciones', () => {
  // Excepción pedida (27/10): desde S2 el abs colgado del martes se queda en 1 serie y el
  // resto pasa al abs en máquina, justo debajo. Se comprueba que entre los dos suman lo
  // de antes, con el mismo RIR; el total de Abs no cambia (ver «series por grupo»).
  const repartidos = { M: { 'abs-colgado-retroversion': 'abs-maquina-crunch' } };
  let n = 0;
  for (const [k, vieja] of Object.entries(VIEJO.BLOCK_VOL)) {
    for (const e of vieja.exercises) {
      if (!e.pres.some((p) => / @ RIR/.test(p.label))) continue;
      const nuevo = buscar(k, e.id);
      assert.ok(nuevo, `${k}: ${e.name} no está`);
      const otro = (repartidos[k] || {})[e.id];
      if (otro) {
        const maquina = PLAN.BLOCK_VOL[k].exercises.find((x) => x.id === otro);
        assert.equal(nuevo.pres[0].label, e.pres[0].label, `${k} ${e.name}: S1`);
        assert.equal(maquina.pres[0].label, '—', `${k} ${maquina.name}: S1`);
        for (let s = 1; s < 8; s++) {
          const antes = e.pres[s].label.match(/^(\d+) @ (RIR.*)$/);
          assert.equal(nuevo.pres[s].label, '1 @ RIR0', `${k} ${e.name}: S${s + 1}`);
          assert.equal(maquina.pres[s].label, `${antes[1] - 1} @ ${antes[2]}`, `${k} ${maquina.name}: S${s + 1}`);
        }
        assert.equal(maquina.target, e.target, `${k} ${maquina.name}: objetivo`);
        n++;
        continue;
      }
      assert.deepEqual(nuevo.pres.map((p) => sinFecha(p.label)), e.pres.map((p) => p.label), `${k} ${e.name}`);
      assert.equal(nuevo.target, e.target, `${k} ${e.name}: objetivo`);
      n++;
    }
  }
  assert.ok(n >= 20, `solo ${n} ejercicios @RIR`);
});

test('series por grupo: 52 → 88', () => {
  assert.deepEqual([1, 2, 3, 4, 5, 6, 7, 8].map((n) => PLAN.seriesPorGrupo(n).TOTAL), [52, 57, 62, 66, 71, 76, 80, 88]);
});

test('correctivos (T en prono, W con banda, curl de muñeca): objetivo correctivo y fuera del recuento', () => {
  const s = PLAN.BLOCK_VOL.S.exercises;
  const T = s.find((e) => /prono «T»/.test(e.name));
  const W = s.find((e) => /banda «W»/.test(e.name));
  const M = s.find((e) => /Curl de muñeca/.test(e.name));
  assert.deepEqual([T.target, W.target, M.target], ['Hombro (correctivo)', 'Hombro (correctivo)', 'Codo (correctivo)']);
  assert.ok(!PLAN.VOL_GRUPOS.some((g) => /correctivo/.test(g)));
});

test('pierna en dos días: rodilla lunes y viernes (S1-S2: jueves), abducción en máquina esos dos días y sábado sin pierna', () => {
  // Cambio pedido (31/10): desde S3 la pierna 2 va el viernes, el jueves es el pull y el
  // miércoles solo hay carrera; en S1-S2 la pierna 2 fue el jueves.
  const j = PLAN.BLOCK_VOL.V.exercises;
  assert.equal(PLAN.BLOCK_VOL.J.exercises[0].name, 'Jalón ancho plano frontal');
  assert.ok(PLAN.BLOCK_VOL.X.exercises.every((e) => e.target === 'Cardio'));
  for (const n of [1, 2]) {
    const jueves = PLAN.sessionsFor(PLAN.VOL_WEEKS[n - 1]).find((x) => x.dow === 4);
    assert.match(jueves.exercises[1].name, /^Sentadilla al cajón/, `S${n}`);
  }
  assert.match(j[0].name, /^TEST fuerza/);
  assert.match(j[1].name, /^Sentadilla al cajón/);
  assert.equal(j[2].name, 'Bulgarian split squat');
  assert.match(j[3].name, /^Abducción de pie unilateral \(máquina\)/);
  assert.ok(PLAN.BLOCK_VOL.L.exercises.some((e) => /^Abducción de pie unilateral \(máquina\)/.test(e.name)));
  for (let n = 2; n <= 8; n++) {
    const sabado = PLAN.BLOCK_VOL.S.exercises.filter((e) => !e.pres[n - 1].skip);
    assert.ok(sabado.every((e) => !/Rehab/.test(e.target)), `S${n}: el sábado no lleva pierna`);
  }
});

console.log(fallos ? `\n${fallos} fallo(s)` : '\nTodo OK');
process.exit(fallos ? 1 : 0);
