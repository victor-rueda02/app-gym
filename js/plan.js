/* Dos planes:
   - 4 semanas · 20 jul – 16 ago 2026, transcrito desde las hojas "Bloque A" y
     "Bloque B" del Excel.
   - Volumen 8 semanas · 19 oct – 13 dic 2026, transcrito desde la hoja
     "Volumen (1910-1112)". tools/verify_plan.py lo compara celda a celda. */

/* Prescripciones ------------------------------------------------------- */
const rir = (sets, r) => ({ sets, kind: 'rir', rir: r, label: `${sets} @ RIR${r}` });
// "N @ RIR1/0": todas a RIR1 salvo la última, a RIR0. `rirs` da el objetivo de cada serie.
const rir10 = (sets) => ({
  sets, kind: 'rir', rir: 0, rirs: Array.from({ length: sets }, (_, i) => (i === sets - 1 ? 0 : 1)),
  label: `${sets} @ RIR1/0`,
});
const fix = (sets, reps) => ({ sets, kind: 'fixed', reps, label: `${sets} x${reps}` });
const iso = (sets, secs) => ({ sets, kind: 'iso', secs, label: `${sets} (${secs} s)` });
const none = () => ({ sets: 0, kind: 'none', label: '—' });

const slug = (s) => s.toLowerCase()
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/* ex(nombre, objetivo, presc.Sem1, presc.Sem2, notas) */
const ex = (name, target, s1, s2, notes = '') => ({
  id: slug(name), name, target, s1, s2: s2 || s1, notes,
});

/* Prescripción a partir del texto de la celda del Excel. La etiqueta se
   conserva tal cual para poder compararla con la hoja. */
function parsePres(text) {
  let m;
  let p;
  if (text === '-') p = none();
  else if ((m = text.match(/^(\d+) @ RIR1\/0$/))) p = rir10(+m[1]);
  else if ((m = text.match(/^(\d+) @ RIR(\d)$/))) p = rir(+m[1], +m[2]);
  else if ((m = text.match(/^(\d+) x(\d+)$/))) p = fix(+m[1], +m[2]);
  else if ((m = text.match(/^(\d+) x(\d+–\d+)$/))) p = fix(+m[1], m[2]);
  else throw new Error(`Prescripción desconocida: "${text}"`);
  return { ...p, label: text };
}

/* vx(nombre, objetivo, [presc. Sem1..Sem8], notas) */
const vx = (name, target, weeks, notes = '') => ({
  id: slug(name), name, target, pres: weeks.map(parsePres), notes,
});

/* Semanas --------------------------------------------------------------- */
const WEEKS = [
  { plan: 'jul', n: 1, block: 'A', col: 's1', from: '2026-07-20', to: '2026-07-26',
    title: 'Semana 1 · MAV1 torso', sub: 'Torso 2 RIR · Pierna MEV' },
  { plan: 'jul', n: 2, block: 'A', col: 's2', from: '2026-07-27', to: '2026-08-02',
    title: 'Semana 2 · MAV2 torso', sub: 'Torso 1 RIR · Pierna MAV1' },
  { plan: 'jul', n: 3, block: 'B', col: 's1', from: '2026-08-03', to: '2026-08-09',
    title: 'Semana 3 · Mantenimiento', sub: '3 días cortos · 2–3 RIR · sin fallo' },
  { plan: 'jul', n: 4, block: 'B', col: 's1', from: '2026-08-10', to: '2026-08-16',
    title: 'Semana 4 · Mantenimiento', sub: '3 días cortos · 2–3 RIR · sin fallo' },
];

/* Bloque A · 20 jul – 2 ago · Acumulación -------------------------------- */
const BLOCK_A = {
  L: {
    id: 'A-L', dow: 1, name: 'Lunes', title: 'Rehab + Isquios + Hombro',
    exercises: [
      ex('Laterales de pie', 'Hombro lat.', rir(2, 2), rir(2, 1)),
      ex('Laterales banco inclinado posterior', 'Posterior', rir(1, 2), rir(2, 1)),
      ex('Unilateral Abduction', 'Rehab', fix(2, '15–20'), fix(2, '15–20'), 'fijo'),
      ex('Touchdown squat', 'Rehab', fix(2, '15–20'), fix(2, '15–20'), 'fijo'),
      ex('Unilateral Bridge iso', 'Rehab', iso(2, 20), iso(2, 20), 'fijo'),
      ex('Zercher squat', 'Rehab', fix(3, 12), fix(3, 12), 'tempo controlado'),
      ex('Bulgarian split squat', 'Rehab', fix(2, 12), fix(2, 12), 'fijo'),
      ex('Isquios', 'Isquios (MEV→MAV1)', rir(2, 2), rir(3, 1)),
    ],
  },
  M: {
    id: 'A-M', dow: 2, name: 'Martes', title: 'Push',
    exercises: [
      ex('Press inclinado manc', 'Pecho', rir(3, 2), rir(4, 1)),
      ex('Aperturas pecho manc + gomas', 'Pecho', rir(2, 2), rir(2, 1)),
      ex('Kaz press manc', 'Pecho/hombro', rir(1, 2), rir(1, 1)),
      ex('Extensión tríceps unil', 'Tríceps', rir(3, 2), rir(3, 1)),
      ex('Gemelos', 'Gemelos', rir(2, 2), rir(2, 1)),
      ex('Abs', 'Abs', rir(3, 2), rir(3, 1)),
    ],
  },
  X: {
    id: 'A-X', dow: 3, name: 'Miércoles', title: 'Pull',
    exercises: [
      ex('Dominadas neutro', 'Espalda', rir(3, 2), rir(4, 1)),
      ex('Remo apoyado', 'Espalda', rir(3, 2), rir(3, 1)),
      ex('Pullover manc + gomas', 'Dorsal', rir(2, 2), rir(2, 1)),
      ex('Dominadas abducción hombro', 'Espalda/post.', rir(1, 2), rir(1, 1)),
      ex('Laterales sentado inclinado', 'Hombro lat.', rir(2, 2), rir(3, 1)),
      ex('Arnold laterales', 'Hombro', rir(1, 2), rir(1, 1)),
      ex('Curl biceps', 'Bíceps', rir(3, 2), rir(3, 1)),
    ],
  },
  J: {
    id: 'A-J', dow: 4, name: 'Jueves', title: 'Rehab + Isquios + Aductores',
    exercises: [
      ex('Unilateral Abduction', 'Rehab', fix(2, '15–20'), fix(2, '15–20'), 'fijo'),
      ex('Touchdown squat', 'Rehab', fix(2, '15–20'), fix(2, '15–20'), 'fijo'),
      ex('Unilateral Bridge iso', 'Rehab', iso(2, 20), iso(2, 20), 'fijo'),
      ex('Zercher squat', 'Rehab', fix(3, 12), fix(3, 12), 'fijo'),
      ex('Bulgarian split squat', 'Rehab', fix(2, 12), fix(2, 12), 'fijo'),
      ex('Isquios', 'Isquios', rir(2, 2), rir(3, 1)),
      ex('Aductores', 'Aductores (MEV→MAV1)', rir(1, 2), rir(2, 1)),
      ex('Gemelos', 'Gemelos', rir(1, 2), rir(2, 1)),
    ],
  },
  V: {
    id: 'A-V', dow: 5, name: 'Viernes', title: 'Torso (upper completo)',
    exercises: [
      ex('Dominadas neutras dorsal', 'Espalda', rir(2, 2), rir(2, 1)),
      ex('Press incl manc cerrado', 'Pecho/tríceps', rir(2, 2), rir(2, 1)),
      ex('Laterales inclinado estiramiento', 'Hombro lat.', rir(2, 2), rir(2, 1)),
      ex('Triceps tras nuca', 'Tríceps', rir(2, 2), rir(3, 1)),
      ex('Triceps conc', 'Tríceps', rir(1, 1), rir(1, 0), 'última al fallo ok'),
      ex('Curl biceps incl', 'Bíceps', rir(2, 2), rir(2, 1)),
      ex('Curl martillo scott', 'Bíceps/braquial', rir(2, 2), rir(2, 1)),
    ],
  },
  S: {
    id: 'A-S', dow: 6, name: 'Sábado', title: 'Rehab ligero + movilidad',
    note: 'Hazlo antes de salir el 25/07 y 01/08.',
    exercises: [
      ex('Unilateral Abduction', 'Rehab', fix(2, '15–20'), fix(2, '15–20'), 'fijo'),
      ex('Touchdown squat', 'Rehab', fix(2, '15–20'), fix(2, '15–20'), 'fijo'),
      ex('Bulgarian split squat', 'Rehab', fix(2, 12), fix(2, 12), 'fijo'),
      ex('Abs', 'Abs', rir(2, 2), rir(2, 1)),
      ex('Movilidad', '—', none(), none()),
    ],
  },
  D: {
    id: 'A-D', dow: 0, name: 'Domingo', title: 'Descanso total', rest: true,
    note: 'Hidrátate y prioriza proteína/sueño tras la fiesta.',
    exercises: [],
  },
};

/* Bloque B · 3 – 16 ago · Mantenimiento ---------------------------------- */
const BLOCK_B = {
  1: {
    id: 'B-1', name: 'Día 1', title: 'Rehab + Push mínimo',
    exercises: [
      ex('Unilateral Abduction', 'Rehab', fix(2, '15–20')),
      ex('Touchdown squat', 'Rehab', fix(2, '15–20')),
      ex('Unilateral Bridge iso', 'Rehab', iso(2, 20)),
      ex('Zercher squat', 'Rehab', fix(3, 12)),
      ex('Bulgarian split squat', 'Rehab', fix(2, 12)),
      ex('Press inclinado manc', 'Pecho', rir(2, 2)),
      ex('Laterales', 'Hombro lat.', rir(2, 2)),
      ex('Extensión tríceps unil', 'Tríceps', rir(1, 2)),
    ],
  },
  2: {
    id: 'B-2', name: 'Día 2', title: 'Rehab + Pull mínimo',
    exercises: [
      ex('Unilateral Abduction', 'Rehab', fix(2, '15–20')),
      ex('Touchdown squat', 'Rehab', fix(2, '15–20')),
      ex('Unilateral Bridge iso', 'Rehab', iso(2, 20)),
      ex('Zercher squat', 'Rehab', fix(3, 12)),
      ex('Bulgarian split squat', 'Rehab', fix(2, 12)),
      ex('Dominadas neutro', 'Espalda', rir(2, 2)),
      ex('Remo apoyado', 'Espalda', rir(1, 2)),
      ex('Curl biceps', 'Bíceps', rir(2, 2)),
    ],
  },
  3: {
    id: 'B-3', name: 'Día 3', title: 'Rehab ligero + full mínimo',
    exercises: [
      ex('Unilateral Abduction', 'Rehab', fix(2, '15–20')),
      ex('Touchdown squat', 'Rehab', fix(2, '15–20')),
      ex('Bulgarian split squat', 'Rehab', fix(2, 12)),
      ex('Press incl manc cerrado', 'Pecho/tríceps', rir(1, 2)),
      ex('Pullover manc + gomas', 'Espalda', rir(1, 2)),
      ex('Laterales', 'Hombro lat.', rir(1, 2)),
      ex('Isquios', 'Isquios', rir(2, 2)),
      ex('Abs', 'Abs', rir(2, 2)),
    ],
  },
};

const RULES = [
  'Semáforo: hasta 3/10 de dolor durante o justo después es aceptable.',
  'Regla 24 h: si al día siguiente el dolor sube y no baja, no progreses esa carga.',
  'Alcohol y deshidratación empeoran el tendón: extrema la hidratación.',
  'Tras el 16/08: retoma tu mesociclo normal reentrando en MEV.',
];

/* Volumen · 19 oct – 13 dic · 8 semanas ----------------------------------
   Lunes a sábado, sesión fija. El domingo no tiene sesión en el Excel: la app
   lo trata como descanso (VOL_REST). Las semanas 9 (viaje = descarga) y 10 no van en el calendario: sus textos
   están en VOL_NOTES. */
const VOL_WEEKS = [
  ['2026-10-19', '2026-10-25', '19–25 oct'],
  ['2026-10-26', '2026-11-01', '26 oct – 1 nov'],
  ['2026-11-02', '2026-11-08', '2–8 nov'],
  ['2026-11-09', '2026-11-15', '9–15 nov'],
  ['2026-11-16', '2026-11-22', '16–22 nov'],
  ['2026-11-23', '2026-11-29', '23–29 nov'],
  ['2026-11-30', '2026-12-06', '30 nov – 6 dic'],
  ['2026-12-07', '2026-12-13', '7–13 dic'],
].map(([from, to, sub], i) => ({
  plan: 'vol', n: i + 1, block: 'Volumen', from, to, title: `Semana ${i + 1} · Volumen`, sub,
}));

const BLOCK_VOL = {
  L: {
    id: 'VOL-L', dow: 1, name: 'Lunes', title: 'Rehab + Isquios + Hombro + Gemelo',
    exercises: [
      vx('Elev laterales polea', 'Hombro lat.',
        ['2 @ RIR1/0', '2 @ RIR1/0', '2 @ RIR1/0', '2 @ RIR1/0', '2 @ RIR1/0', '2 @ RIR1/0', '2 @ RIR1/0', '3 @ RIR1/0']),
      vx('Elev laterales mancuerna', 'Hombro lat.',
        ['1 @ RIR0', '1 @ RIR0', '1 @ RIR0', '1 @ RIR0', '2 @ RIR1/0', '2 @ RIR1/0', '2 @ RIR1/0', '2 @ RIR1/0']),
      vx('Unilateral abduction', 'Rehab',
        ['2 x15–20', '2 x15–20', '2 x15–20', '2 x15–20', '2 x15–20', '2 x15–20', '2 x15–20', '2 x15–20'],
        'Antes del rehab: sentadilla española 5×45 s'),
      vx('Touchdown squat', 'Rehab',
        ['2 x15–20', '2 x15–20', '2 x15–20', '2 x15–20', '2 x15–20', '2 x15–20', '2 x15–20', '2 x15–20'],
        'fijo'),
      vx('Prensa unil', 'Rehab',
        ['2 x12', '2 x10', '2 x10', '2 x10', '2 x8', '2 x8', '2 x8', '2 x8'],
        'fijo · Tempo 3-1-3 · dolor ≤3/10'),
      vx('Gemelos', 'Gemelos',
        ['3 @ RIR1/0', '3 @ RIR1/0', '4 @ RIR1/0', '4 @ RIR1/0', '4 @ RIR1/0', '4 @ RIR1/0', '5 @ RIR1/0', '5 @ RIR1/0']),
      vx('Hiperextensiones', 'Isquios',
        ['2 @ RIR1/0', '2 @ RIR1/0', '2 @ RIR1/0', '3 @ RIR1/0', '3 @ RIR1/0', '3 @ RIR1/0', '3 @ RIR1/0', '4 @ RIR1/0']),
    ],
  },
  M: {
    id: 'VOL-M', dow: 2, name: 'Martes', title: 'Push',
    exercises: [
      vx('Press inclinado barra', 'Pecho',
        ['2 @ RIR1/0', '3 @ RIR1/0', '3 @ RIR1/0', '3 @ RIR1/0', '3 @ RIR1/0', '3 @ RIR1/0', '3 @ RIR1/0', '4 @ RIR1/0']),
      vx('Extensión tríceps unil polea', 'Tríceps',
        ['2 @ RIR1/0', '2 @ RIR1/0', '2 @ RIR1/0', '2 @ RIR1/0', '3 @ RIR1/0', '3 @ RIR1/0', '3 @ RIR1/0', '3 @ RIR1/0']),
      vx('Aperturas polea', 'Pecho',
        ['2 @ RIR1/0', '2 @ RIR1/0', '2 @ RIR1/0', '3 @ RIR1/0', '3 @ RIR1/0', '3 @ RIR1/0', '3 @ RIR1/0', '3 @ RIR1/0']),
      vx('Triceps tras nuca unil polea', 'Tríceps',
        ['1 @ RIR0', '1 @ RIR0', '2 @ RIR1/0', '2 @ RIR1/0', '2 @ RIR1/0', '2 @ RIR1/0', '2 @ RIR1/0', '3 @ RIR1/0']),
      vx('Abs', 'Abs',
        ['3 @ RIR1/0', '3 @ RIR1/0', '3 @ RIR1/0', '3 @ RIR1/0', '4 @ RIR1/0', '4 @ RIR1/0', '4 @ RIR1/0', '5 @ RIR1/0']),
    ],
  },
  X: {
    id: 'VOL-X', dow: 3, name: 'Miércoles', title: 'Pull',
    exercises: [
      vx('Jalón neutro', 'Espalda',
        ['2 @ RIR1/0', '2 @ RIR1/0', '2 @ RIR1/0', '3 @ RIR1/0', '3 @ RIR1/0', '3 @ RIR1/0', '3 @ RIR1/0', '3 @ RIR1/0']),
      vx('Remo gironda abierto', 'Espalda',
        ['2 @ RIR1/0', '2 @ RIR1/0', '2 @ RIR1/0', '2 @ RIR1/0', '2 @ RIR1/0', '2 @ RIR1/0', '2 @ RIR1/0', '3 @ RIR1/0']),
      vx('Laterales sentado', 'Hombro lat.',
        ['1 @ RIR0', '1 @ RIR0', '2 @ RIR1/0', '2 @ RIR1/0', '2 @ RIR1/0', '2 @ RIR1/0', '3 @ RIR1/0', '3 @ RIR1/0']),
      vx('Dominadas medio abiertas', 'Espalda',
        ['1 @ RIR0', '2 @ RIR1/0', '2 @ RIR1/0', '2 @ RIR1/0', '2 @ RIR1/0', '2 @ RIR1/0', '2 @ RIR1/0', '2 @ RIR1/0']),
      vx('Curl martillo scott', 'Bíceps',
        ['2 @ RIR1/0', '3 @ RIR1/0', '3 @ RIR1/0', '3 @ RIR1/0', '3 @ RIR1/0', '3 @ RIR1/0', '3 @ RIR1/0', '3 @ RIR1/0']),
      vx('Posterior polea', 'Hombro post.',
        ['1 @ RIR0', '1 @ RIR0', '2 @ RIR1/0', '2 @ RIR1/0', '2 @ RIR1/0', '3 @ RIR1/0', '3 @ RIR1/0', '3 @ RIR1/0']),
      vx('Curl bayesian', 'Bíceps',
        ['2 @ RIR1/0', '2 @ RIR1/0', '2 @ RIR1/0', '2 @ RIR1/0', '2 @ RIR1/0', '3 @ RIR1/0', '3 @ RIR1/0', '4 @ RIR1/0']),
    ],
  },
  J: {
    id: 'VOL-J', dow: 4, name: 'Jueves', title: 'Rehab + Isquios + Aductores',
    exercises: [
      vx('Unilateral Abduction', 'Rehab',
        ['2 x15–20', '2 x15–20', '2 x15–20', '2 x15–20', '2 x15–20', '2 x15–20', '2 x15–20', '2 x15–20'],
        'Antes del rehab: sentadilla española 5×45 s'),
      vx('Touchdown squat', 'Rehab',
        ['2 x15–20', '2 x15–20', '2 x15–20', '2 x15–20', '2 x15–20', '2 x15–20', '2 x15–20', '2 x15–20']),
      vx('Back squat', 'Rehab',
        ['3 x12', '3 x10', '3 x10', '3 x10', '3 x8', '3 x8', '3 x8', '3 x8'],
        'Al cajón: tope + pausa 1 s · tempo 3-1-3'),
      vx('Bulgarian split squat', 'Rehab',
        ['2 x12', '2 x10', '2 x10', '2 x10', '2 x8', '2 x8', '2 x8', '2 x8'],
        'Tempo 3-1-3 · empieza por la lesionada'),
      vx('Isquios sentado', 'Isquios',
        ['3 @ RIR1/0', '4 @ RIR1/0', '4 @ RIR1/0', '4 @ RIR1/0', '4 @ RIR1/0', '5 @ RIR1/0', '5 @ RIR1/0', '5 @ RIR1/0']),
      vx('Aductores', 'Aductores',
        ['2 @ RIR1/0', '2 @ RIR1/0', '2 @ RIR1/0', '2 @ RIR1/0', '3 @ RIR1/0', '3 @ RIR1/0', '3 @ RIR1/0', '3 @ RIR1/0']),
      vx('Gemelos', 'Gemelos',
        ['2 @ RIR1/0', '3 @ RIR1/0', '3 @ RIR1/0', '3 @ RIR1/0', '4 @ RIR1/0', '4 @ RIR1/0', '4 @ RIR1/0', '5 @ RIR1/0']),
    ],
  },
  V: {
    id: 'VOL-V', dow: 5, name: 'Viernes', title: 'Torso',
    exercises: [
      vx('Triceps conc polea', 'Tríceps',
        ['1 @ RIR0', '1 @ RIR0', '1 @ RIR0', '1 @ RIR0', '1 @ RIR0', '1 @ RIR0', '1 @ RIR0', '1 @ RIR0']),
      vx('Laterales polea', 'Hombro lat.',
        ['2 @ RIR1/0', '2 @ RIR1/0', '2 @ RIR1/0', '2 @ RIR1/0', '2 @ RIR1/0', '2 @ RIR1/0', '2 @ RIR1/0', '2 @ RIR1/0']),
      vx('Curl francés manc', 'Tríceps',
        ['2 @ RIR1/0', '2 @ RIR1/0', '2 @ RIR1/0', '2 @ RIR1/0', '2 @ RIR1/0', '2 @ RIR1/0', '3 @ RIR1/0', '3 @ RIR1/0']),
      vx('Curl biceps barra z', 'Bíceps',
        ['2 @ RIR1/0', '2 @ RIR1/0', '2 @ RIR1/0', '3 @ RIR1/0', '3 @ RIR1/0', '3 @ RIR1/0', '3 @ RIR1/0', '3 @ RIR1/0']),
      vx('Press incl máquina', 'Pecho',
        ['2 @ RIR1/0', '2 @ RIR1/0', '2 @ RIR1/0', '2 @ RIR1/0', '2 @ RIR1/0', '3 @ RIR1/0', '3 @ RIR1/0', '3 @ RIR1/0']),
      vx('Dominada neutra dorsal', 'Espalda',
        ['1 @ RIR0', '1 @ RIR0', '1 @ RIR0', '1 @ RIR0', '1 @ RIR0', '2 @ RIR1/0', '2 @ RIR1/0', '2 @ RIR1/0']),
      vx('Remo máquina', 'Espalda',
        ['2 @ RIR1/0', '2 @ RIR1/0', '2 @ RIR1/0', '2 @ RIR1/0', '2 @ RIR1/0', '2 @ RIR1/0', '2 @ RIR1/0', '2 @ RIR1/0']),
      vx('Pullover', 'Espalda',
        ['2 @ RIR1/0', '2 @ RIR1/0', '2 @ RIR1/0', '2 @ RIR1/0', '2 @ RIR1/0', '2 @ RIR1/0', '2 @ RIR1/0', '2 @ RIR1/0']),
    ],
  },
  S: {
    id: 'VOL-S', dow: 6, name: 'Sábado', title: 'Rehab + Movilidad',
    exercises: [
      vx('Unilateral Abduction', 'Rehab',
        ['2 x15–20', '2 x15–20', '2 x15–20', '2 x15–20', '2 x15–20', '2 x15–20', '2 x15–20', '2 x15–20'],
        'fijo · Antes del rehab: sentadilla española 5×45 s'),
      vx('Touchdown squat', 'Rehab',
        ['2 x15–20', '2 x15–20', '2 x15–20', '2 x15–20', '2 x15–20', '2 x15–20', '2 x15–20', '2 x15–20'],
        'fijo'),
      vx('Bulgarian split squat', 'Rehab',
        ['2 x12', '2 x10', '2 x10', '2 x10', '2 x8', '2 x8', '2 x8', '2 x8'],
        'fijo · Tempo 3-1-3 · empieza por la lesionada'),
      vx('Abs wesley banco', 'Abs',
        ['2 @ RIR1/0', '2 @ RIR1/0', '3 @ RIR1/0', '3 @ RIR1/0', '3 @ RIR1/0', '3 @ RIR1/0', '4 @ RIR1/0', '4 @ RIR1/0']),
      vx('Movilidad - trapecio inferior', '-',
        ['-', '-', '-', '-', '-', '-', '-', '-']),
    ],
  },
};

const VOL_REST = { id: 'VOL-D', dow: 0, name: 'Domingo', title: 'Descanso', rest: true, exercises: [] };

/* Celdas A2 y A61 */
const VOL_RULES = [
  'RIR1/0 = todas las series a RIR1 y la ÚLTIMA a RIR0 (si solo hay 1 serie, RIR0).  Rehab (Rebuilding Milo): ×12 sem 1 → ×10 sem 2-4 → ×8 sem 5-8 → ×6 tras el viaje; peso con el que la última serie quede cerca del fallo sin perder tempo 3-1-3 ni profundidad, dolor ≤3/10; sube peso solo si el test de 24 h está igual o mejor.',
  'Autorregulación: si un músculo pierde reps 2 sesiones seguidas, esa semana NO le subas series. Si se estancan varios a la vez o la rodilla empeora en el test, repite la semana anterior.',
];

/* Celdas A63–A66 */
const VOL_NOTES = [
  'Semana 9 (14-20/12) · Viaje = descarga  ·  Semana 10 · Vuelta progresiva',
  'Hipertrofia: la semana sin entrenar hace de descarga justo después del pico de volumen de la semana 8.',
  'Rodilla (libro): nunca dejes el tendón en reposo total. Llévate la goma: sentadilla española 5×45 s cada día (sin anclaje → wall sit a 1 pierna). Sigue haciendo el test en declive por la mañana.',
  'Semana 10 (vuelta): hipertrofia con las series de la sem 3-4 y a RIR2. Rehab ×8 al ~80% del peso de la sem 8. Si el test de 24 h aguanta, semana 11 a peso completo y siguiente escalón del libro (×6).',
];

const PLANS = [
  { id: 'jul', name: '4 semanas', range: '20 jul – 16 ago', from: '2026-07-20', to: '2026-08-16',
    weeks: WEEKS, rules: RULES, rulesTitle: 'Reglas de rodilla',
    sheetNote: 'Rehab FIJA las 4 semanas. Techo en MAV2: nada de MRV antes de la fiesta.' },
  { id: 'vol', name: 'Volumen 8 semanas', range: '19 oct – 13 dic', from: '2026-10-19', to: '2026-12-13',
    weeks: VOL_WEEKS, rules: VOL_RULES, rulesTitle: 'Reglas',
    notes: VOL_NOTES, notesTitle: 'Semanas 9–10' },
];

/* Helpers de fecha ------------------------------------------------------- */
function isoDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const dowOf = (dateStr) => new Date(dateStr + 'T12:00:00').getDay();

function weekFor(dateStr) {
  for (const plan of PLANS) {
    const week = plan.weeks.find((w) => dateStr >= w.from && dateStr <= w.to);
    if (week) return week;
  }
  return null;
}

const planById = (id) => PLANS.find((p) => p.id === id);

/* El plan en curso para una fecha; si no hay, el próximo; si ya pasaron
   todos, el último. */
function planFor(dateStr) {
  return PLANS.find((p) => dateStr <= p.to) || PLANS[PLANS.length - 1];
}

/* Sesiones de la semana, en el orden del plan. */
function sessionsFor(week) {
  if (week.plan === 'vol') return Object.values(BLOCK_VOL);
  return Object.values(week.block === 'A' ? BLOCK_A : BLOCK_B);
}

/* Sesión prevista para una fecha. En bloque B el día es libre: devuelve la
   lista de los 3 días para que elijas, salvo que ya haya uno registrado. */
function sessionFor(dateStr) {
  const week = weekFor(dateStr);
  if (!week) return { week: null, options: [] };
  const dow = dowOf(dateStr);
  if (week.plan === 'vol') {
    const day = Object.values(BLOCK_VOL).find((d) => d.dow === dow) || VOL_REST;
    return { week, options: [day] };
  }
  if (week.block === 'A') {
    const day = Object.values(BLOCK_A).find((d) => d.dow === dow);
    return { week, options: [day] };
  }
  return { week, options: [BLOCK_B[1], BLOCK_B[2], BLOCK_B[3]] };
}

/* Plan de volumen: una prescripción por semana. Plan de 4 semanas: s1/s2. */
function presFor(exercise, week) {
  if (exercise.pres) return exercise.pres[week.n - 1];
  return week.col === 's2' ? exercise.s2 : exercise.s1;
}

const PLAN = {
  WEEKS, BLOCK_A, BLOCK_B, RULES, VOL_WEEKS, BLOCK_VOL, VOL_RULES, VOL_NOTES, PLANS,
  weekFor, planById, planFor, sessionsFor, sessionFor, presFor, isoDate,
};
