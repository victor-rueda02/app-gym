/* Comprobación independiente del contenido del plan de volumen (js/plan.js)
   contra el volcado del Excel nuevo. No reutiliza parsePres ni la lógica de
   tools/verify_plan.py: lee las filas del volcado por su cuenta.
       node tests/contenido.test.mjs
   Compara también con la versión anterior (git show c3ece19:js/plan.js). */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const cargar = (src) => new Function(`${src};return PLAN;`)();
const PLAN = cargar(fs.readFileSync(path.join(root, 'js', 'plan.js'), 'utf8'));
const VIEJO = cargar(execFileSync('git', ['show', 'c3ece19:js/plan.js'], { cwd: root, encoding: 'utf8', maxBuffer: 1 << 24 }));
const H = JSON.parse(fs.readFileSync(path.join(root, 'docs', 'plan-rodilla', 'volcado.json'), 'utf8'))['Volumen (1910-1112)'];
const c = (ref) => (H[ref] ? H[ref].v : undefined);
const SEM = [...'CDEFGHIJ'];
const semanas = (fila) => SEM.map((col) => c(`${col}${fila}`));

let fallos = 0;
const test = (nombre, fn) => {
  try { fn(); console.log(`  OK  ${nombre}`); } catch (e) { fallos++; console.log(` FALLO ${nombre}\n        ${e.message.split('\n').slice(0, 6).join('\n        ')}`); }
};

/* --- Esperado, leído del volcado --- */
// Sesiones: cabecera "(L) Lunes  ·  título"; tras ella la fila "Ejercicio" y las filas hasta la primera con A vacía.
const sesiones = {};
for (let r = 1; r <= 70; r++) {
  const m = /^\(([LMXJVS])\) (\S+)\s+·\s*(.*)$/s.exec(c(`A${r}`) || '');
  if (!m) continue;
  assert.equal(c(`A${r + 1}`), 'Ejercicio', `fila ${r + 1}`);
  const filas = [];
  for (let f = r + 2; c(`A${f}`) && c(`B${f}`); f++) filas.push(f);
  sesiones[m[1]] = { cab: r, nombre: m[2], titulo: m[3].trim(), filas };
}
// Cardio: filas 95-98, al final de martes, viernes, miércoles y (único) domingo.
const CARDIO = { M: 95, V: 96, X: 97, D: 98 };
const esperado = (clave) => {
  const s = sesiones[clave];
  const ej = (s ? s.filas : []).map((f) => ({
    fila: f, nombre: c(`A${f}`), objetivo: c(`B${f}`), semanas: semanas(f), notas: c(`K${f}`) ?? "",
  }));
  if (CARDIO[clave]) {
    const f = CARDIO[clave];
    ej.push({ fila: f, nombre: c(`B${f}`), objetivo: 'Cardio', semanas: semanas(f), notas: c(`K${f}`) ?? "" });
  }
  return ej;
};

test('el volcado tiene las 6 sesiones y el número de filas esperado', () => {
  assert.deepEqual(Object.keys(sesiones), ['L', 'M', 'X', 'J', 'V', 'S']);
  assert.deepEqual(Object.values(sesiones).map((s) => s.filas.length), [7, 5, 7, 8, 8, 7]);
});

test('cabeceras de sesión: nombre, título y orden', () => {
  assert.deepEqual(Object.keys(PLAN.BLOCK_VOL), ['L', 'M', 'X', 'J', 'V', 'S', 'D']);
  for (const [k, s] of Object.entries(sesiones)) {
    assert.equal(PLAN.BLOCK_VOL[k].name, s.nombre, k);
    assert.equal(PLAN.BLOCK_VOL[k].title, s.titulo, k);
  }
  assert.equal(PLAN.BLOCK_VOL.D.name, 'Domingo');
  assert.equal(PLAN.BLOCK_VOL.D.title, 'Carrera');
  assert.ok(PLAN.BLOCK_VOL.X.title.includes('+ carrera'), 'miércoles: «+ carrera»');
  assert.ok(PLAN.BLOCK_VOL.S.title.startsWith('casa') && PLAN.BLOCK_VOL.S.title.includes('sin pierna'), 'sábado: «casa…sin pierna»');
});

test('cada ejercicio: nombre, objetivo, 8 etiquetas (C–J) y notas K, en el orden de la hoja', () => {
  let celdas = 0;
  for (const k of Object.keys(PLAN.BLOCK_VOL)) {
    const app = PLAN.BLOCK_VOL[k].exercises;
    const exp = esperado(k);
    assert.equal(app.length, exp.length, `${k}: nº de ejercicios`);
    exp.forEach((e, i) => {
      assert.equal(app[i].name, e.nombre.trim(), `${k} fila ${e.fila}: nombre`);
      assert.equal(app[i].target, e.objetivo, `${k} fila ${e.fila}: objetivo`);
      assert.equal(app[i].notes, e.notas, `${k} fila ${e.fila}: notas K`);
      assert.equal(app[i].pres.length, 8, `${k} fila ${e.fila}`);
      e.semanas.forEach((txt, w) => { assert.equal(app[i].pres[w].label, txt, `${k} fila ${e.fila} S${w + 1}`); celdas++; });
    });
  }
  assert.equal(celdas, 46 * 8);   // 42 filas de ejercicio + 4 de cardio
});

test('textos sueltos: A2/A64, A66–A69, hitos, nota de hitos, títulos y 12 reglas', () => {
  assert.deepEqual(PLAN.VOL_RULES, [c('A2'), c('A64')]);
  assert.deepEqual(PLAN.VOL_NOTES, [66, 67, 68, 69].map((r) => c(`A${r}`)));
  assert.deepEqual(PLAN.VOL_HITOS, semanas(99));
  assert.equal(PLAN.VOL_HITOS_NOTE, c('K99'));
  assert.equal(PLAN.VOL_CARDIO_TITLE, c('A93'));
  assert.equal(PLAN.VOL_BLOCK_RULES_TITLE, c('A101'));
  assert.equal(PLAN.VOL_BLOCK_RULES.length, 12);
  PLAN.VOL_BLOCK_RULES.forEach((t, i) => assert.equal(t, c(`A${102 + i}`), `A${102 + i}`));
  assert.equal(c('A114'), undefined, 'no hay una regla 13');
});

test('etiquetas [EVIDENCIA], [LÓGICA], [INCERTIDUMBRE]: mismas apariciones y texto que en el Excel', () => {
  const tags = (txt) => (String(txt || '').match(/\[[^\]]*(?:EVIDENCIA|LÓGICA|INCERTIDUMBRE)[^\]]*\]/g) || []);
  const celdasTexto = ['A2', 'A64', 'A66', 'A67', 'A68', 'A69', 'K99', ...Array.from({ length: 12 }, (_, i) => `A${102 + i}`)];
  const exp = celdasTexto.flatMap((r) => tags(c(r)));
  for (const k of ['L', 'M', 'X', 'J', 'V', 'S', 'D']) for (const e of esperado(k)) exp.push(...tags(e.notas));
  const app = [...PLAN.VOL_RULES, ...PLAN.VOL_NOTES, PLAN.VOL_HITOS_NOTE, ...PLAN.VOL_BLOCK_RULES].flatMap(tags);
  for (const s of Object.values(PLAN.BLOCK_VOL)) for (const e of s.exercises) app.push(...tags(e.notes));
  assert.ok(exp.length > 20, `solo ${exp.length} etiquetas en el volcado`);
  assert.deepEqual(app.sort(), exp.sort());
  for (const t of ['[EVIDENCIA', '[LÓGICA', '[INCERTIDUMBRE']) assert.ok(exp.some((x) => x.startsWith(t)) || exp.some((x) => x.includes(t.slice(1))), t);
});

test('S1 idéntica: cada ejercicio que ya existía conserva su prescripción de S1 (columna C)', () => {
  // Renombres de la migración v4 (DECISIONES 5/12) y el nuevo nombre; el resto conserva el id.
  const ren = {
    L: { 'unilateral-abduction': 'abduccion-de-pie-unilateral-maquina', 'prensa-unil': 'prensa-unil-pesado-y-lento-n-1' },
    J: { 'unilateral-abduction': 'abduccion-de-pie-unilateral-maquina', 'back-squat': 'sentadilla-al-cajon-o-desde-pines-pesado-y-lento-n-2' },
    S: { 'unilateral-abduction': 'abduccion-unilateral', 'movilidad-trapecio-inferior': 'elevacion-lateral-en-prono-t-mancuernas-banco' },
    V: { 'bici-z2-z3-prog': 'bici-z2-sin-z3-en-este-bloque' },
  };
  let n = 0;
  for (const [k, vieja] of Object.entries(VIEJO.BLOCK_VOL)) {
    for (const e of vieja.exercises) {
      const id = (ren[k] || {})[e.id] || e.id;
      const nuevo = PLAN.BLOCK_VOL[k].exercises.find((x) => x.id === id);
      assert.ok(nuevo, `${k}: ${e.id} → ${id} no existe`);
      assert.equal(nuevo.pres[0].label, e.pres[0].label, `${k} ${e.name} → ${nuevo.name}: S1`);
      n++;
    }
  }
  assert.equal(n, 7 + 6 + 7 + 7 + 9 + 5);
});

test('S1: el domingo es la sesión del sábado, sin D/I, sin sesión de carrera', () => {
  const s1 = PLAN.VOL_WEEKS[0];
  assert.equal(PLAN.sessionFor('2026-10-25').options[0].id, 'VOL-S');
  assert.equal(PLAN.sessionFor('2026-10-24').options[0].id, 'VOL-S');
  assert.ok(!PLAN.sessionsFor(s1).some((s) => s.id === 'VOL-D'));
  for (const s of Object.values(PLAN.BLOCK_VOL)) for (const e of s.exercises) assert.equal(PLAN.sidesFor(e, s1), false, e.name);
  // S2: domingo = carrera, sábado = sesión de casa
  assert.equal(PLAN.sessionFor('2026-11-01').options[0].id, 'VOL-D');
  assert.equal(PLAN.sessionFor('2026-11-07').options[0].id, 'VOL-S');
  assert.equal(PLAN.sessionFor('2026-11-08').options[0].id, 'VOL-D');
});

test('hipertrofia idéntica: los ejercicios con series @RIR conservan las 8 prescripciones', () => {
  const ren = { 'unilateral-abduction': null };   // ningún ejercicio @RIR se renombró en v4
  let n = 0;
  for (const [k, vieja] of Object.entries(VIEJO.BLOCK_VOL)) {
    for (const e of vieja.exercises) {
      if (!e.pres.some((p) => / @ RIR/.test(p.label))) continue;
      assert.ok(!(e.id in ren));
      const nuevo = PLAN.BLOCK_VOL[k].exercises.find((x) => x.id === e.id);
      assert.ok(nuevo, `${k}: ${e.name} no está`);
      assert.deepEqual(nuevo.pres.map((p) => p.label), e.pres.map((p) => p.label), `${k} ${e.name}`);
      assert.equal(nuevo.target, e.target, `${k} ${e.name}: objetivo`);
      n++;
    }
  }
  assert.ok(n >= 20, `solo ${n} ejercicios @RIR`);
});

test('recuento por grupo: 52 → 88 y coincide con las filas 73–83 del Excel y con un recuento propio', () => {
  const grupos = Array.from({ length: 10 }, (_, i) => c(`A${73 + i}`));
  assert.deepEqual(grupos, PLAN.VOL_GRUPOS);
  const totales = [];
  for (let w = 0; w < 8; w++) {
    const prop = Object.fromEntries(grupos.map((g) => [g, 0]));
    for (const k of Object.keys(PLAN.BLOCK_VOL)) {
      for (const e of esperado(k)) {
        if (!(e.objetivo in prop)) continue;
        const m = /^(\d+) /.exec(e.semanas[w]);
        if (m) prop[e.objetivo] += +m[1];
      }
    }
    const app = PLAN.seriesPorGrupo(w + 1);
    grupos.forEach((g, i) => {
      assert.equal(app[g], prop[g], `S${w + 1} ${g}`);
      assert.equal(app[g], c(`${SEM[w]}${73 + i}`), `S${w + 1} ${g} vs Excel`);
    });
    totales.push(app.TOTAL);
    assert.equal(app.TOTAL, c(`${SEM[w]}83`), `S${w + 1} total vs Excel`);
  }
  assert.deepEqual(totales, [52, 57, 62, 66, 71, 76, 80, 88]);
});

test('correctivos: T en prono, W con banda y curl de muñeca, con objetivo correctivo y fuera del recuento', () => {
  const s = PLAN.BLOCK_VOL.S.exercises;
  const T = s.find((e) => /prono «T»/.test(e.name));
  const W = s.find((e) => /banda «W»/.test(e.name));
  const M = s.find((e) => /Curl de muñeca/.test(e.name));
  assert.deepEqual([T.target, W.target, M.target], ['Hombro (correctivo)', 'Hombro (correctivo)', 'Codo (correctivo)']);
  assert.ok(!PLAN.VOL_GRUPOS.some((g) => /correctivo/.test(g)));
  for (let n = 1; n <= 8; n++) {
    const sin = PLAN.seriesPorGrupo(n);
    // Si contasen, el total subiría por las series de los correctivos (prescritas desde S2).
    const extra = [T, W, M].reduce((a, e) => a + (/^\d+(?:-(\d+))? x/.exec(e.pres[n - 1].label) ? 1 : 0), 0);
    if (n >= 2) assert.ok(extra === 3);
    assert.equal(Object.values(sin).slice(0, -1).reduce((a, b) => a + b, 0), sin.TOTAL);
  }
});

test('jueves: test → sentadilla → búlgara → abducción, sin touchdown desde S2', () => {
  const j = PLAN.BLOCK_VOL.J.exercises;
  assert.match(j[0].name, /^TEST fuerza/);
  assert.match(j[1].name, /^Sentadilla al cajón/);
  assert.equal(j[2].name, 'Bulgarian split squat');
  assert.match(j[3].name, /^Abducción de pie unilateral/);
  const td = j.find((e) => e.name === 'Touchdown squat');
  assert.ok(td, 'touchdown en el jueves');
  assert.notEqual(td.pres[0].label, '—', 'S1 conserva el touchdown');
  td.pres.slice(1).forEach((p, i) => { assert.equal(p.label, '—', `S${i + 2}`); assert.equal(p.skip, true); });
});

test('sábado: abducción, touchdown y búlgara «—» desde S2 (y presentes en S1)', () => {
  const s = PLAN.BLOCK_VOL.S.exercises;
  for (const nombre of [/^Abducción/, /^Touchdown/, /^Bulgarian/]) {
    const e = s.find((x) => nombre.test(x.name));
    assert.ok(e, String(nombre));
    assert.notEqual(e.pres[0].label, '—');
    e.pres.slice(1).forEach((p, i) => assert.equal(p.label, '—', `${e.name} S${i + 2}`));
  }
});

test('«—» es skip y «-» no; ningún otro texto se marca como skip', () => {
  for (const s of Object.values(PLAN.BLOCK_VOL)) for (const e of s.exercises) for (const p of e.pres) {
    assert.equal(!!p.skip, p.label === '—', `${e.name}: ${p.label}`);
  }
});

test('carrera y cardio: miércoles (N1…N6, repite N6), domingo repite el miércoles desde S2', () => {
  const x = PLAN.BLOCK_VOL.X.exercises.at(-1);
  assert.deepEqual([x.name, x.target], ['Andar-correr en llano', 'Cardio']);
  assert.deepEqual(x.pres.map((p) => p.label), semanas(97));
  const d = PLAN.BLOCK_VOL.D.exercises;
  assert.equal(d.length, 1);
  assert.deepEqual(d[0].pres.map((p) => p.label), semanas(98));
  assert.equal(d[0].pres[0].skip, true);
  assert.equal(PLAN.BLOCK_VOL.D.fromWeek, 2);
});

console.log(fallos ? `\n${fallos} fallo(s)` : '\nTodo OK');
process.exit(fallos ? 1 : 0);
