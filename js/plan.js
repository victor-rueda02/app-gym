/* Plan de 4 semanas · 20 jul – 16 ago 2026
   Transcrito desde Plan_4semanas_20jul-16ago.xlsx (hojas "Bloque A" y "Bloque B"). */

/* Prescripciones ------------------------------------------------------- */
const rir = (sets, r) => ({ sets, kind: 'rir', rir: r, label: `${sets} @ RIR${r}` });
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

/* Semanas --------------------------------------------------------------- */
const WEEKS = [
  { n: 1, block: 'A', col: 's1', from: '2026-07-20', to: '2026-07-26',
    title: 'Semana 1 · MAV1 torso', sub: 'Torso 2 RIR · Pierna MEV' },
  { n: 2, block: 'A', col: 's2', from: '2026-07-27', to: '2026-08-02',
    title: 'Semana 2 · MAV2 torso', sub: 'Torso 1 RIR · Pierna MAV1' },
  { n: 3, block: 'B', col: 's1', from: '2026-08-03', to: '2026-08-09',
    title: 'Semana 3 · Mantenimiento', sub: '3 días cortos · 2–3 RIR · sin fallo' },
  { n: 4, block: 'B', col: 's1', from: '2026-08-10', to: '2026-08-16',
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

/* Helpers de fecha ------------------------------------------------------- */
function isoDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function weekFor(dateStr) {
  return WEEKS.find((w) => dateStr >= w.from && dateStr <= w.to) || null;
}

/* Sesión prevista para una fecha. En bloque B el día es libre: devuelve la
   lista de los 3 días para que elijas, salvo que ya haya uno registrado. */
function sessionFor(dateStr) {
  const week = weekFor(dateStr);
  if (!week) return { week: null, options: [] };
  if (week.block === 'A') {
    const dow = new Date(dateStr + 'T12:00:00').getDay();
    const day = Object.values(BLOCK_A).find((d) => d.dow === dow);
    return { week, options: [day] };
  }
  return { week, options: [BLOCK_B[1], BLOCK_B[2], BLOCK_B[3]] };
}

function presFor(exercise, week) {
  return week.col === 's2' ? exercise.s2 : exercise.s1;
}

const PLAN = { WEEKS, BLOCK_A, BLOCK_B, RULES, weekFor, sessionFor, presFor, isoDate };
