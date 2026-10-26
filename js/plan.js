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
// Cardio: una sola entrada en minutos. El texto de la celda puede llevar intervalos.
const cardio = (mins) => ({ sets: 1, kind: 'cardio', mins, label: `${mins} min` });

const slug = (s) => s.toLowerCase()
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/* ex(nombre, objetivo, presc.Sem1, presc.Sem2, notas) */
const ex = (name, target, s1, s2, notes = '') => ({
  id: slug(name), name, target, s1, s2: s2 || s1, notes,
});

/* Cardio y carrera: la celda es texto libre ("15 min", "10' Z2", "N1 · 8×(1'/2')",
   "repite N6"…). Los minutos solo se conocen si el texto empieza por "N min" o "N'". */
function cardioTexto(text) {
  const m = text.match(/^(\d+)(?: min|')/);
  return cardio(m ? +m[1] : '');
}

/* Prescripción a partir del texto de la celda del Excel. La etiqueta se
   conserva tal cual para poder compararla con la hoja. `target` (el objetivo
   del ejercicio) solo importa para el cardio, cuyo texto es libre.
   "—" = no se hace esa semana (skip); "-" = sin series, pero se lista. */
function parsePres(text, target = '') {
  let m;
  let p;
  if (text === '-') p = none();
  else if (text === '—') p = { ...none(), skip: true };
  else if (target === 'Cardio') p = cardioTexto(text);
  else if ((m = text.match(/^(\d+) @ RIR1\/0$/))) p = rir10(+m[1]);
  else if ((m = text.match(/^(\d+) @ RIR(\d)$/))) p = rir(+m[1], +m[2]);
  else if ((m = text.match(/^(\d+) x(\d+)$/))) p = fix(+m[1], +m[2]);
  else if ((m = text.match(/^(\d+) x(\d+–\d+)$/))) p = fix(+m[1], m[2]);
  // "N x R" o "N-M x R" (R entero o rango con - o –), "/pierna" opcional y líneas de
  // aclaración. En "N-M" se precargan N series (la M se añade a mano si se hace).
  else if ((m = text.match(/^(\d+)(?:-(\d+))? x(\d+(?:[-–]\d+)?)(\/pierna)?(?:\n[\s\S]*)?$/))) {
    p = fix(+m[1], /^\d+$/.test(m[3]) ? +m[3] : m[3]);
    if (m[2]) p.setsMax = +m[2];
  } else if (/^2 aprox\. \+\n1 al fallo\npor pierna$/.test(text)) {
    p = { ...fix(3, ''), reps: '' };   // test de fuerza: 2 de aproximación + 1 al fallo
  } else if (/^Opcional:\nrango completo$/.test(text)) {
    p = { ...fix(3, ''), reps: '', optional: true };
  } else if ((m = text.match(/^(\d+) min(?: \([^)]+\))?$/))) p = cardio(+m[1]);
  else throw new Error(`Prescripción desconocida: "${text}"`);
  return { ...p, label: text };
}

/* vx(nombre, objetivo, [presc. Sem1..Sem8], notas, extra) */
/* `extra`: { sides: true } marca los unilaterales que se registran por pierna (D/I);
   { prog } los que se prescriben con el nivel real (ver PRENSA_NIVELES y CARRERA_NIVELES)
   o, la bici, según esté quitada o no;
   { link: 'test' } el test de fuerza, que no se registra como ejercicio sino en
   Rodilla › Test. */
const vx = (name, target, weeks, notes = '', extra = {}) => ({
  id: slug(name), name, target, pres: weeks.map((w) => parsePres(w, target)), notes, ...extra,
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
   Lunes a viernes, sesión fija. El sábado es la sesión de casa (sin pierna desde S2);
   el domingo es carrera (VOL-D) solo desde S2: en S1 el domingo sigue siendo la sesión
   del sábado. El cardio (bici martes y viernes, carrera miércoles y domingo) va como
   un ejercicio más al final de la sesión, con objetivo 'Cardio'. Las semanas 9 (viaje
   = descarga) y 10 no van en el calendario: sus textos están en VOL_NOTES. */
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
        ['2 @ RIR1/0', '2 @ RIR1/0', '2 @ RIR1/0', '2 @ RIR1/0', '2 @ RIR1/0', '2 @ RIR1/0', '2 @ RIR1/0', '3 @ RIR1/0'],
        'Prioridad 1 · Polea altura muñeca/muslo en plano escapular (~30° adelante). Intercalar en superserie alterna con la abducción (máquina) para dar 3-4 min de descanso al deltoides antes de las mancuernas.'),
      vx('Abducción de pie unilateral (máquina)', 'Rehab (cadera)',
        ['2 x15–20', '3 x10-15/pierna\n@RIR1-2', '3 x10-15/pierna\n@RIR1-2', '3 x10-15/pierna\n@RIR1-2', '3 x10-15/pierna\n@RIR1-2', '3 x10-15/pierna\n@RIR1-2', '3 x10-15/pierna\n@RIR1-2', '3 x10-15/pierna\n@RIR1-2'],
        'Cadera: de pie, unilateral, en máquina; empieza por la D y sube carga cuando llegues a 15 con RIR 1-2. Cadera + rodilla combinadas = primera línea en los consensos de 2016 y 2018 [EVIDENCIA]. No cuenta como novedad: apenas carga la rodilla [LÓGICA]. Antes del rehab: sentadilla española 2-3×45 s.', { sides: true }),
      vx('Elev laterales mancuerna', 'Hombro lat.',
        ['1 @ RIR0', '1 @ RIR0', '1 @ RIR0', '1 @ RIR0', '2 @ RIR1/0', '2 @ RIR1/0', '2 @ RIR1/0', '2 @ RIR1/0'],
        'Prioridad 1 · Hacer tras el 1er bloque de la abducción (máquina) · Perfil en acortamiento, controlar bajada sin rebotar.'),
      vx('Touchdown squat', 'Rehab',
        ['2 x15–20', '2 x10-15/pierna', '2 x10-15/pierna', '2 x10-15/pierna', '2 x10-15/pierna', '2 x10-15/pierna', '2 x10-15/pierna', '2 x10-15/pierna\nrepite S7'],
        'Control antes de la prensa. D a la profundidad YA validada (la de la semana anterior), I completa; tempo 2-0-2, RIR 3; pelvis nivelada y rodilla hacia el 2.º-4.º dedo. Hace de filtro: si la D pasa de 3/10 aquí, ese lunes no se sube escalón en la prensa [LÓGICA].', { sides: true, prog: 'touchdown' }),
      vx('Prensa unil · pesado y lento n.º 1', 'Rehab',
        ['2 x12', '2 x10/pierna\nnov: x10', '2 x10/pierna\nnov: +1 escalón', '2 x10/pierna\nnov: +1 escalón', '2 x8/pierna\nnov: x8', '2 x8/pierna\nnov: +1 escalón', '2 x8/pierna\nnov: +1 escalón', '2 x8/pierna\nrepite S7'],
        'Pesado y lento para el tendón [EVIDENCIA: Kongsgaard 2009; 1-2 veces/semana para mantenerlo: LÓGICA]. Tempo 3-1-3. D primero: RIR 2 y profundidad de su escalón. I: RIR 1-2, rango completo y mismas reps. Lunes = día de novedad (escalón o reps): solo si esa mañana estás igual o mejor y la touchdown no pasa de 3/10; si no, repite la semana anterior. En la sesión con novedad no cambies nada más (con escalón nuevo, mismo peso).', { sides: true, prog: 'prensa' }),
      vx('Gemelos prensa', 'Gemelos',
        ['3 @ RIR1/0', '3 @ RIR1/0', '4 @ RIR1/0', '4 @ RIR1/0', '4 @ RIR1/0', '4 @ RIR1/0', '5 @ RIR1/0', '5 @ RIR1/0'],
        'Prensa con pies abajo · Pausa estricta de 2 s en máximo estiramiento abajo (sin rebotar en el tendón de Aquiles) + rodilla semirrígida.'),
      vx('Hiperextensiones', 'Isquios',
        ['2 @ RIR1/0', '2 @ RIR1/0', '2 @ RIR1/0', '3 @ RIR1/0', '3 @ RIR1/0', '3 @ RIR1/0', '3 @ RIR1/0', '4 @ RIR1/0'],
        'Extensión de cadera · Rodillas con ligera flexión fija (~10-15°), subir empujando talones sin hiperextender zona lumbar.'),
    ],
  },
  M: {
    id: 'VOL-M', dow: 2, name: 'Martes', title: 'Push',
    exercises: [
      vx('Press inclinado barra (30–40°)', 'Pecho',
        ['2 @ RIR1/0', '3 @ RIR1/0', '3 @ RIR1/0', '3 @ RIR1/0', '3 @ RIR1/0', '3 @ RIR1/0', '3 @ RIR1/0', '4 @ RIR1/0'],
        'Prioridad 4 (Haz clavicular) · Agarre ~1.3x ancho hombros y codos a 45–60° (plano escapular) para proteger hombro y codo.'),
      vx('Extensión tríceps unil polea', 'Tríceps',
        ['2 @ RIR1/0', '2 @ RIR1/0', '2 @ RIR1/0', '2 @ RIR1/0', '3 @ RIR1/0', '3 @ RIR1/0', '3 @ RIR1/0', '3 @ RIR1/0'],
        'Prioridad 2 (Tríceps) · Hombro a 0° pegado al costado (máxima palanca de cabeza larga sin estrés articular en codo).'),
      vx('Contractora (Pec Deck)', 'Pecho',
        ['2 @ RIR1/0', '2 @ RIR1/0', '2 @ RIR1/0', '3 @ RIR1/0', '3 @ RIR1/0', '3 @ RIR1/0', '3 @ RIR1/0', '3 @ RIR1/0'],
        'Prioridad 4 (Haz clavicular/esternal) · Asiento medio-bajo (manos altura clavícula/esternón sup.) · NO hiperextender húmeros detrás del torso al abrir para no irritar cápsula anterior del hombro.'),
      vx('Triceps tras nuca unil polea', 'Tríceps',
        ['1 @ RIR0', '1 @ RIR0', '2 @ RIR1/0', '2 @ RIR1/0', '2 @ RIR1/0', '2 @ RIR1/0', '2 @ RIR1/0', '3 @ RIR1/0'],
        'Prioridad 2 (Tríceps en estiramiento) · Dejar que el codo apunte ligeramente hacia fuera (~20-30° plano escapular) para no forzar cápsula del hombro ni tendón olecraniano.'),
      vx('Abs colgado (retroversión)', 'Abs',
        ['3 @ RIR1/0', '3 @ RIR1/0', '3 @ RIR1/0', '3 @ RIR1/0', '4 @ RIR1/0', '4 @ RIR1/0', '4 @ RIR1/0', '5 @ RIR1/0'],
        'Colgado con depresión escapular (activa dorsal) · Enrollar pelvis hacia costillas (retroversión). Usar straps si el agarre molesta al codo.'),
      vx('Bici Z2 (65–75% FC)', 'Cardio',
        ['15 min', '—', '—', '—', '10\' Z2', '10\' Z2', '10\' Z2', '10\' Z2'],
        'No se hizo en S1: estímulo NUEVO [LÓGICA]. Entra en S4 (el viernes) solo si S2 y S3 cumplieron la regla; desde S5, martes y viernes. Sin Z3 en este bloque. Lo primero que se quita si hay brote. Sillín alto (rodilla a 20-25° abajo), 85-90 rpm, sentado. 10 min fijos en el bloque; subir a 15 después del viaje, como novedad única.', { prog: 'bici' }),
    ],
  },
  X: {
    id: 'VOL-X', dow: 3, name: 'Miércoles', title: 'Pull  ·  + carrera (ver bloque de carrera)',
    exercises: [
      vx('Jalón ancho plano frontal', 'Espalda',
        ['2 @ RIR1/0', '2 @ RIR1/0', '2 @ RIR1/0', '3 @ RIR1/0', '3 @ RIR1/0', '3 @ RIR1/0', '3 @ RIR1/0', '3 @ RIR1/0'],
        'Prioridad 3 (Dorsal Bajo) · 1º fresco · Torso vertical, codos abiertos en plano frontal hasta ~90° · No encoger hombros.'),
      vx('Remo gironda abierto', 'Espalda',
        ['2 @ RIR1/0', '2 @ RIR1/0', '2 @ RIR1/0', '2 @ RIR1/0', '2 @ RIR1/0', '2 @ RIR1/0', '2 @ RIR1/0', '3 @ RIR1/0'],
        'Plano transversal (Espalda Alta) · Codos abiertos y retracción escapular completa.'),
      vx('Laterales sentado', 'Hombro lat.',
        ['1 @ RIR0', '1 @ RIR0', '2 @ RIR1/0', '2 @ RIR1/0', '2 @ RIR1/0', '2 @ RIR1/0', '3 @ RIR1/0', '3 @ RIR1/0'],
        'Prioridad 1 (Hombro Lat.) · Sentado en banco a 75–80°, abducir en plano escapular (~30° adelante) sin rotar internamente el hombro.'),
      vx('Jalón neutro', 'Espalda',
        ['1 @ RIR0', '2 @ RIR1/0', '2 @ RIR1/0', '2 @ RIR1/0', '2 @ RIR1/0', '2 @ RIR1/0', '2 @ RIR1/0', '2 @ RIR1/0'],
        'Plano sagital (Dorsal Sup.) · Agarre neutro ancho hombros, llevar codos a los bolsillos cortando a 90° (protege codo/bíceps).'),
      vx('Curl martillo scott', 'Bíceps',
        ['2 @ RIR1/0', '3 @ RIR1/0', '3 @ RIR1/0', '3 @ RIR1/0', '3 @ RIR1/0', '3 @ RIR1/0', '3 @ RIR1/0', '3 @ RIR1/0'],
        'Prioridad 2 (Bíceps/Braquiorradial) · Agarre neutro (muy amigable para el codo). Bajar en 2-3 s y parar a ~15° de la extensión total para no sobrecargar tendón distal.'),
      vx('Posterior polea', 'Hombro post.',
        ['1 @ RIR0', '1 @ RIR0', '2 @ RIR1/0', '2 @ RIR1/0', '2 @ RIR1/0', '3 @ RIR1/0', '3 @ RIR1/0', '3 @ RIR1/0'],
        'Salud Hombro / Transversal · Clave para centrar cabeza humeral y compensar presses.'),
      vx('Curl bayesian', 'Bíceps',
        ['2 @ RIR1/0', '2 @ RIR1/0', '2 @ RIR1/0', '2 @ RIR1/0', '2 @ RIR1/0', '3 @ RIR1/0', '3 @ RIR1/0', '4 @ RIR1/0'],
        'Prioridad 2 (Bíceps en estiramiento) · Hombro en extensión detrás del torso; no dejar que el hombro rote hacia delante al subir.'),
      vx('Andar-correr en llano', 'Cardio',
        ['—', 'N1 · 8×(1\'/2\')', 'N2 · 6×(2\'/1\')', 'N3 · 4×(4\'/1\')', 'N4 · 4×(5\'/1\')', 'N5 · 3×(8\'/1\')', 'N6 · 2×(12\'/1\')', 'repite N6'],
        'Formato: minutos trotando / minutos andando. Niveles: N1 8×(1\'/2\') · N2 6×(2\'/1\') · N3 4×(4\'/1\') · N4 4×(5\'/1\') · N5 3×(8\'/1\') · N6 2×(12\'/1\'); después del viaje, N7 18\' · N8 25\' · N9 30\' seguidos. Desde N4 el tramo continuo más largo crece como mucho un 50 % por nivel (5 → 8 → 12 → 18 → 25 → 30 min); de N1 a N3 se dobla porque los tramos son muy cortos [LÓGICA]. El calendario marca el máximo de cada semana; el nivel real sale del semáforo: Avanzar = +1, Mantener = el mismo, Retroceder = −1. Nivel nuevo solo si esa mañana estás igual o mejor. 5 min andando antes; llano y firme. Regla de carrera: Retroceder si pasas de 2/10 durante, no vuelves al nivel previo en ≤60 min o la mañana siguiente estás peor; Mantener si cumple pero el peor valor 24-48 h supera la referencia; Avanzar si cumple y el peor 24-48 h ≤ referencia [EVIDENCIA de uso: TREK Education, basada en Esculier; no comparada con otros umbrales]. Cadencia +5-10% opcional [EVIDENCIA mixta: Bramah 2019, serie de 12 corredores con mejora de dolor y función mantenida a 3 meses; Esculier 2018, sin beneficio extra sobre la educación].', { prog: 'carrera' }),
    ],
  },
  J: {
    id: 'VOL-J', dow: 4, name: 'Jueves', title: 'Rehab + Isquios + Aductores  ·  test de fuerza S2 / S5 / S7',
    exercises: [
      vx('TEST fuerza · extensión unilateral en máquina 90→45°', 'Test',
        ['—', '2 aprox. +\n1 al fallo\npor pierna', '—', '—', '2 aprox. +\n1 al fallo\npor pierna', '—', '2 aprox. +\n1 al fallo\npor pierna', 'Opcional:\nrango completo'],
        'Al empezar la sesión, tras la española 2-3×45 s y 2 series de aproximación. Mismo asiento y SIEMPRE rango fijo 90→45° (si el rango cambia, la comparación entre semanas no vale). Misma carga en las dos piernas (la que la I haga unas 10-15 reps), tempo 2-0-2, D primero, 3 min de descanso y luego la I; para si pasa de 3/10. Apunta carga y reps en «Seguimiento rodilla», que calcula la simetría. Objetivo ≥90% antes del balón [LÓGICA; el 90% viene de la vuelta al deporte tras LCA, no está validado en dolor femoropatelar: INCERTIDUMBRE]. Test en rango completo opcional en S8 y no en S7, para que sea la única novedad de su semana.', { link: 'test' }),
      vx('Sentadilla al cajón o desde pines · pesado y lento n.º 2', 'Rehab',
        ['3 x12', '3 x10', '3 x10\nprof. del lunes', '3 x10\nprof. del lunes', '3 x8', '3 x8\nprof. del lunes', '3 x8\nprof. del lunes', '3 x8\nrepite S7'],
        'Tras el test (S2/S5/S7), carga por RIR. Tempo 3-1-3, RIR 2. Profundidad = la validada el lunes en la prensa. Postura habitual: un chasquido sin dolor no cambia nada; el apoyo ancho solo si te reduce el DOLOR [LÓGICA]. Antes del rehab (si no hay test): sentadilla española 2-3×45 s.', { prog: 'sentadilla' }),
      vx('Bulgarian split squat', 'Rehab',
        ['2 x12', '2 x10/pierna', '2 x10/pierna', '2 x10/pierna', '2 x8/pierna', '2 x8/pierna', '2 x8/pierna', '2 x8/pierna\nrepite S7'],
        'D primero: RIR 2 y profundidad validada el lunes. I: RIR 1-2 y rango completo. Tempo 3-1-3. Alterna piernas, 60-90 s entre una y otra.', { sides: true, prog: 'bulgara' }),
      vx('Abducción de pie unilateral (máquina)', 'Rehab (cadera)',
        ['2 x15–20', '3 x10-15/pierna\n@RIR1-2', '3 x10-15/pierna\n@RIR1-2', '3 x10-15/pierna\n@RIR1-2', '3 x10-15/pierna\n@RIR1-2', '3 x10-15/pierna\n@RIR1-2', '3 x10-15/pierna\n@RIR1-2', '3 x10-15/pierna\n@RIR1-2'],
        'Misma máquina que el lunes; empieza por la D. Va DESPUÉS de la búlgara, para no fatigar el glúteo medio antes del trabajo a una pierna [LÓGICA]. Lunes + jueves = 72-96 h entre sesiones de cadera.', { sides: true }),
      vx('Touchdown squat', 'Rehab',
        ['2 x15–20', '—', '—', '—', '—', '—', '—', '—'],
        'Sale del jueves desde S2: va el lunes, antes de la prensa [LÓGICA].'),
      vx('Isquios sentado', 'Isquios',
        ['3 @ RIR1/0', '4 @ RIR1/0', '4 @ RIR1/0', '4 @ RIR1/0', '4 @ RIR1/0', '5 @ RIR1/0', '5 @ RIR1/0', '5 @ RIR1/0'],
        'Isquios en estiramiento máximo (cadera a 90°) · Controlar fase excéntrica.'),
      vx('Aductores', 'Aductores',
        ['2 @ RIR1/0', '2 @ RIR1/0', '2 @ RIR1/0', '2 @ RIR1/0', '3 @ RIR1/0', '3 @ RIR1/0', '3 @ RIR1/0', '3 @ RIR1/0'],
        'Plano transversal/frontal · Pausa de 1 s en apertura máxima sin dolor inguinal/rodilla.'),
      vx('Gemelos prensa', 'Gemelos',
        ['2 @ RIR1/0', '3 @ RIR1/0', '3 @ RIR1/0', '3 @ RIR1/0', '4 @ RIR1/0', '4 @ RIR1/0', '4 @ RIR1/0', '5 @ RIR1/0'],
        'Prensa con pies abajo · Pausa estricta de 2 s en máximo estiramiento abajo (sin rebote elástico).'),
    ],
  },
  V: {
    id: 'VOL-V', dow: 5, name: 'Viernes', title: 'Torso',
    exercises: [
      vx('Triceps conc polea (-15°)', 'Tríceps',
        ['1 @ RIR0', '1 @ RIR0', '1 @ RIR0', '1 @ RIR0', '1 @ RIR0', '1 @ RIR0', '1 @ RIR0', '1 @ RIR0'],
        'Prioridad 2 + Potenciación de codo · Hombro a -15° (extensión): máximo acortamiento de cabeza larga con torque nulo en flexión máxima de codo (calienta tendón para el francés).'),
      vx('Laterales polea', 'Hombro lat.',
        ['2 @ RIR1/0', '2 @ RIR1/0', '2 @ RIR1/0', '2 @ RIR1/0', '2 @ RIR1/0', '2 @ RIR1/0', '2 @ RIR1/0', '2 @ RIR1/0'],
        'Prioridad 1 (Hombro Lat.) · Polea a altura de muñeca/muslo, abducción en plano escapular.'),
      vx('Press francés manc (banco plano)', 'Tríceps',
        ['2 @ RIR1/0', '2 @ RIR1/0', '2 @ RIR1/0', '2 @ RIR1/0', '2 @ RIR1/0', '2 @ RIR1/0', '3 @ RIR1/0', '3 @ RIR1/0'],
        'Prioridad 2 (Tríceps) · Agarre neutro (martillo) y brazos inclinados a ~100° hacia la cabeza: quita cizalla en epitróclea/olécranon y mantiene tensión constante.'),
      vx('Curl biceps barra z', 'Bíceps',
        ['2 @ RIR1/0', '2 @ RIR1/0', '2 @ RIR1/0', '3 @ RIR1/0', '3 @ RIR1/0', '3 @ RIR1/0', '3 @ RIR1/0', '3 @ RIR1/0'],
        'Prioridad 2 (Bíceps rango medio) · Usar el agarre de la barra Z (ancho o estrecho) que resulte 100% libre de molestia en muñeca y codo.'),
      vx('Press máquina neutro ascendente', 'Pecho',
        ['2 @ RIR1/0', '2 @ RIR1/0', '2 @ RIR1/0', '2 @ RIR1/0', '2 @ RIR1/0', '3 @ RIR1/0', '3 @ RIR1/0', '3 @ RIR1/0'],
        'Prioridad 4 (Haz clavicular) · 10/10 tras brazos: el agarre neutro y la trayectoria convergente ascendente aíslan el haz clavicular sin estrés en hombro ni codo.'),
      vx('Dominada neutra dorsal', 'Espalda',
        ['1 @ RIR0', '1 @ RIR0', '1 @ RIR0', '1 @ RIR0', '1 @ RIR0', '2 @ RIR1/0', '2 @ RIR1/0', '2 @ RIR1/0'],
        'Plano sagital (Dorsal Sup.) · Usar STRAPS obligatoriamente para anular fatiga previa de bíceps y proteger codos.'),
      vx('Remo máquina (pecho apoyado 30°)', 'Espalda',
        ['2 @ RIR1/0', '2 @ RIR1/0', '2 @ RIR1/0', '2 @ RIR1/0', '2 @ RIR1/0', '2 @ RIR1/0', '2 @ RIR1/0', '2 @ RIR1/0'],
        'Plano sagital/híbrido (Dorsal Sup.) · Usar STRAPS, codos a ~30° hasta línea del torso.'),
      vx('Aducción unil. polea alta (Pull-in)', 'Espalda',
        ['2 @ RIR1/0', '2 @ RIR1/0', '2 @ RIR1/0', '2 @ RIR1/0', '2 @ RIR1/0', '2 @ RIR1/0', '2 @ RIR1/0', '2 @ RIR1/0'],
        'Prioridad 3 (Dorsal Bajo) · De lado a la polea (con tobillera en muñeca o codo semirrígido) para aislar haz inferior sin usar bíceps ni codo · Sem 1-2 a RIR 1-2.'),
      vx('Bici Z2 (sin Z3 en este bloque)', 'Cardio',
        ['12 min', '—', '—', '10\' Z2\nnov: 1.ª vez', '10\' Z2', '10\' Z2', '10\' Z2', '10\' Z2'],
        'S4: primera vez, solo si esa mañana estás igual o mejor; se valida con las mediciones del sábado y del domingo (el sábado no hay pierna). Ver la nota del martes.', { prog: 'bici' }),
    ],
  },
  S: {
    id: 'VOL-S', dow: 6, dows: [6, 0], name: 'Sábado',
    // En S1 el sábado (y el domingo) aún tenía pierna: se ve como entonces.
    byWeek: { 1: { name: 'Sábado/Domingo', title: '' } }, title: 'casa, sin máquinas ni poleas  ·  desde S2, sin pierna (el domingo: carrera)',
    exercises: [
      vx('Abducción unilateral', 'Rehab (cadera)',
        ['2 x15–20', '—', '—', '—', '—', '—', '—', '—'],
        'Sale del sábado desde S2: la abducción va el lunes y el jueves en máquina; la pierna se concentra en 2 días [LÓGICA].'),
      vx('Touchdown squat', 'Rehab',
        ['2 x15–20', '—', '—', '—', '—', '—', '—', '—'],
        'Sale del sábado desde S2: va el lunes, antes de la prensa [LÓGICA].'),
      vx('Bulgarian split squat', 'Rehab',
        ['2 x12', '—', '—', '—', '—', '—', '—', '—'],
        'Sale del sábado desde S2: la pierna se concentra en el lunes y el jueves [LÓGICA].'),
      vx('Abs wesley banco', 'Abs',
        ['2 @ RIR1/0', '2 @ RIR1/0', '3 @ RIR1/0', '3 @ RIR1/0', '3 @ RIR1/0', '3 @ RIR1/0', '4 @ RIR1/0', '4 @ RIR1/0'],
        ''),
      vx('Elevación lateral en prono «T» (mancuernas, banco)', 'Hombro (correctivo)',
        ['-', '2-3 x10-15\n5 s arriba', '2-3 x10-15\n5 s arriba', '2-3 x10-15\n5 s arriba', '2-3 x10-15\n5 s arriba', '2-3 x10-15\n5 s arriba', '2-3 x10-15\n5 s arriba', '2-3 x10-15\n5 s arriba'],
        'Postura: trapecio medio e inferior y deltoides posterior. Boca abajo en el banco, pulgar arriba, muy poco peso. RIR 3-4; no cuenta como serie de hipertrofia. Libro, p. 290.'),
      vx('Rotación externa con banda «W»', 'Hombro (correctivo)',
        ['—', '2-3 x15-20\n5-10 s fuera', '2-3 x15-20\n5-10 s fuera', '2-3 x15-20\n5-10 s fuera', '2-3 x15-20\n5-10 s fuera', '2-3 x15-20\n5-10 s fuera', '2-3 x15-20\n5-10 s fuera', '2-3 x15-20\n5-10 s fuera'],
        'Codos pegados al cuerpo a 90°. RIR 3-4. Libro, p. 288.'),
      vx('Curl de muñeca en extensión (mancuerna)', 'Codo (correctivo)',
        ['—', '3 x10-15\n3 s / 3 s', '3 x10-15\n3 s / 3 s', '3 x10-15\n3 s / 3 s', '3 x10-15\n3 s / 3 s', '3 x10-15\n3 s / 3 s', '3 x10-15\n3 s / 3 s', '3 x10-15\n3 s / 3 s'],
        'Codo (cara externa). Antebrazo apoyado, palma abajo. Si ahora agarrar te duele: isométrico 4-5×30-45 s las 1-2 primeras semanas. Antes, test del nervio radial (libro, p. 323): si es positivo, se cambia por deslizamientos del nervio (p. 338). Dolor ≤3/10 y no peor al día siguiente. Libro, pp. 332-333.'),
    ],
  },
  D: {
    id: 'VOL-D', dow: 0, fromWeek: 2, name: 'Domingo', title: 'Carrera',
    exercises: [
      vx('Andar-correr en llano', 'Cardio',
        ['—', 'repite el\nmiércoles', 'repite el\nmiércoles', 'repite el\nmiércoles', 'repite el\nmiércoles', 'repite el\nmiércoles', 'repite el\nmiércoles', 'repite el\nmiércoles'],
        'Repite el nivel validado el miércoles. Si el miércoles no se cumplieron los criterios de entrada, esa semana no hay carrera: el domingo no se corre (como mucho, un paseo). Nunca dos días seguidos corriendo [LÓGICA]. El sábado no hay pierna: llegas descansado.', { prog: 'carrera-domingo' }),
    ],
  },
};

/* Celdas A2 y A64 */
const VOL_RULES = [
  'RIR1/0 = todas las series a RIR1 y la ÚLTIMA a RIR0 (si solo hay 1 serie, RIR0).  REHAB RODILLA S2-S8 en 2 días: lunes (touchdown + prensa) y jueves (sentadilla + búlgara), pesado y lento, tempo 3-1-3; D a RIR 2 y en su escalón de profundidad, I a RIR 1-2 y rango completo. Reps: ×12 S1 → ×10 S2-4 → ×8 S5-8 → ×6 tras el viaje. Una novedad por día (lunes profundidad/reps · miércoles carrera), solo si esa mañana estás igual o mejor. El calendario marca el máximo de cada semana: se progresa según el semáforo (Avanzar / Mantener / Retroceder) y la app prescribe con el nivel real. Reglas al final de la hoja; registro diario en «Seguimiento rodilla».',
  'Autorregulación: si un músculo pierde reps 2 sesiones seguidas, esa semana NO le subas series. Si se estancan varios a la vez o la rodilla empeora en el test, repite la semana anterior.',
];

/* Celdas A66–A69 */
const VOL_NOTES = [
  'Semana 9 (14-20/12) · Viaje = descarga  ·  Semana 10 · Vuelta progresiva',
  'Hipertrofia: la semana sin entrenar hace de descarga justo después del pico de volumen de la semana 8.',
  'Rodilla en el viaje: nunca reposo total del tendón. Sentadilla española 5×45 s cada día (sin anclaje → wall sit a 1 pierna) y las dos pruebas de la mañana (declive + 10 subidas). Carrera: si puedes, 2 rodajes suaves sin pasar del nivel de S8 y nunca dos días seguidos, con la regla de carrera (≤2/10, nivel previo en ≤60 min, mañana siguiente no peor).',
  'Semana 10 (vuelta): hipertrofia con las series de la sem 3-4 y a RIR2. Rehab ×8 al ~80% del peso de la sem 8; si se cumple la regla de 24-48 h, semana 11 a peso completo y siguiente escalón del libro (×6). Carrera: retomas el nivel de S8, o uno por debajo si no pudiste correr en el viaje.',
];

/* Fila 99 «Hitos y avisos»: celdas C99–J99, un texto por semana ('—' = nada que avisar). */
const VOL_HITOS = [
  '—',
  'Mar: paseo 30\'\nMié: TD + saltitos\n→ 1.ª carrera\nJue: test 1',
  '—',
  'AVISO fisio\n(ver Seguimiento)\nVie: bici',
  'Lun: x8\nJue: test 2',
  '—',
  'Jue: test 3',
  'Repite S7\nJue: test opc.\nrango completo',
];
// Celda K99: nota general bajo los hitos.
const VOL_HITOS_NOTE = 'Entrada a la carrera (S2), con la regla de carrera: martes, paseo de 30 min a paso rápido (≤2/10, nivel previo en ≤60 min y el miércoles por la mañana no peor: el criterio 1 se evalúa solo con esa mañana, sin esperar a las 48 h); miércoles antes de correr, 10 touchdown con cada pierna y 20 saltitos a dos piernas (≤2/10). Si se cumplen los tres, 1.ª carrera ese miércoles (N1). Si no, esa semana no hay carrera (el domingo, como mucho, un paseo) y los criterios se repiten el miércoles siguiente [LÓGICA].';

/* Celdas A93 (título del bloque de cardio y carrera) y A101 (título de las reglas) */
const VOL_CARDIO_TITLE = 'BLOQUE DE CARDIO Y CARRERA (S2-S8)';
const VOL_BLOCK_RULES_TITLE = 'REGLAS DEL BLOQUE RODILLA (S2-S8)';
/* Celdas A102–A113: las 12 reglas del bloque rodilla. */
const VOL_BLOCK_RULES = [
  'Base [EVIDENCIA]: ejercicio combinado de cadera y rodilla (consensos de 2016 y 2018). Rodilla en 2 días, lunes y jueves (72-96 h entre sesiones, dentro de la ventana de 2-3 días de recuperación del tendón que describe el libro), pesado y lento en ambos; sábado sin pierna para llegar descansado a la carrera del domingo [LÓGICA].',
  'Mediciones: cada mañana, en casa, con las mismas pruebas: test en declive y 10 subidas con la D al mismo escalón o banco. Vale la peor de las dos (el declive solo no basta: te sale 0 aunque haya molestia). Si falta la medición de la mañana, ese día no se evalúa y la primera medición disponible hace de referencia (en S2, la del martes). Se apuntan en «Seguimiento rodilla».',
  'Regla de gimnasio [LÓGICA], en semáforo (solo días con carga de rodilla: lunes y jueves): Retroceder si pasas de 3/10 durante o la mañana siguiente estás peor que la de la sesión; Mantener si cumple, pero el peor valor entre 24 y 48 h supera la referencia (no avanzas, pero no has fallado); Avanzar si cumple y el peor valor 24-48 h es igual o mejor que la referencia. Los días sin carga de rodilla no se evalúan («—»).',
  'Regla de carrera [EVIDENCIA de uso], en semáforo (miércoles y domingo): Retroceder si pasas de 2/10 durante, no vuelves al nivel previo en ≤60 min o la mañana siguiente estás peor; Mantener si cumple, pero el peor valor 24-48 h supera la referencia; Avanzar si cumple y el peor valor 24-48 h ≤ referencia. El paseo de entrada se valida solo con la mañana siguiente. Se aplica también a las fases hacia el fútbol [LÓGICA].',
  'Novedades [LÓGICA]: una por día y validada a las 24 y 48 h antes de repetirla. Lunes: escalón o reps (prensa) · miércoles: nivel de carrera · viernes de S4: bici. Solo si esa mañana estás igual o mejor que la referencia (la mañana del mismo día de la semana anterior; en S3, la primera medición de S2), no que el día anterior: así un empeoramiento lento también salta. El calendario marca el máximo de cada semana; el nivel real sale del semáforo: Avanzar = nivel +1 (sin pasar del calendario), Mantener = el mismo, Retroceder = nivel −1. Lo validado se repite: el jueves usa la profundidad del lunes y el domingo repite el nivel del miércoles.',
  'S2 = semana de referencia [LÓGICA]: el paseo del martes no cuenta como novedad (caminas a diario). Si alguna mañana de S2 sale peor que la referencia (la primera medición de S2), en S3 no sube nada y se repite S2 entera, en lugar de intentar atribuir el empeoramiento.',
  'Escalones de profundidad de la D [LÓGICA; no hay pautas de rango validadas para la rótula: INCERTIDUMBRE]: escalón 0 = la profundidad que ya usas con la D; escalón 4 = la de la I. Reparte la diferencia en 4 partes iguales (como mucho ~15° cada una; si sale más, se termina después del bloque). Se sube, como mucho, los lunes de S3, S4, S6 y S7 en la prensa (según el semáforo); la touchdown del lunes va a la profundidad ya validada y hace de filtro. Apunta las marcas en «Seguimiento rodilla».',
  'Chasquido: si no duele, no se quita ni se cambia nada. Si duele, cuenta como dolor.',
  'Retroceso y brote [LÓGICA]: un dolor durante la sesión retrocede la escalera de esa sesión. Si una mañana sale peor, se retrocede la última novedad aún no validada (la que todavía no tiene en verde sus dos mañanas, 24 y 48 h; p. ej., jueves bien y viernes peor → se retrocede la carrera del miércoles y el escalón se mantiene); una novedad ya validada no se culpa. Si tras el retroceso vuelve a fallar, se retrocede la novedad anterior sin validar. Brote = un fallo sin ninguna novedad sin validar, o dos sesiones seguidas en Retroceder: lo primero que se quita es la bici; 48-72 h solo isométricos (sentadilla española 5×45 s diaria) y caminar, sin bici; luego se retoma un escalón por debajo en todo. La bici vuelve al nivel del calendario cuando lleves una semana entera en verde.',
  'Alarma: bloqueo real, fallos repetidos de la rodilla o hinchazón visible → se para la progresión y toca valoración clínica.',
  'AVISO S4 (fisio deportivo pendiente): se calcula al cerrar S4 (domingo 15/11) si hay al menos 5 mañanas registradas en S2 y en S4. Compara la media de las mañanas: PEOR si la de S4 supera en 0,5 o más a la de S2; MEJOR si queda 0,5 o más por debajo; si no, IGUAL. IGUAL o PEOR, o un chasquido que empieza a doler: la valoración del fisio pasa a ser prioritaria; PEOR además para la progresión [LÓGICA]. «Seguimiento rodilla» lo calcula.',
  'Fases hacia el fútbol, después del viaje [LÓGICA], siempre con la regla de carrera: cambios de dirección ← 30 min seguidos dos veces sin reacción y rango D = I · pliometría ← 2 semanas de cambios de dirección y 10 saltos a una pierna sin dolor · balón ← cuádriceps D ≥90% de la I en el test y pliometría media sin reacción · equipo ← 2 semanas de balón sin reacción.',
];

/* Progresión real -------------------------------------------------------
   El calendario (las celdas de la hoja) marca el máximo de cada semana; el nivel
   real sale del semáforo (js/rodilla-calc.js: Avanzar +1, Mantener =, Retroceder −1).
   Dos escaleras: la prensa del lunes (reps y escalón de profundidad de la D, que el
   jueves repiten la sentadilla y la búlgara) y la carrera del miércoles (el domingo
   repite su nivel). */
// Prensa: nivel 0 = S1 (x12, escalón 0); cada subida es la novedad de un lunes.
const PRENSA_NIVELES = [
  { reps: 12, esc: 0 }, { reps: 10, esc: 0 }, { reps: 10, esc: 1 }, { reps: 10, esc: 2 },
  { reps: 8, esc: 2 }, { reps: 8, esc: 3 }, { reps: 8, esc: 4 },
];
// Carrera (K97): nivel 0 = aún sin entrar (criterios de entrada); N7-N9, después del viaje
// (el tramo continuo crece como mucho un 50 % por nivel: 12 -> 18 -> 25 -> 30 min).
const CARRERA_NIVELES = ['', "8×(1'/2')", "6×(2'/1')", "4×(4'/1')", "4×(5'/1')",
  "3×(8'/1')", "2×(12'/1')", "18' seguidos", "25' seguidos", "30' seguidos"];
// Máximo del calendario por semana (índice = semana 1–8), según las celdas D10–J10 y D97–J97.
const PRENSA_MAX = [null, 0, 1, 2, 3, 4, 5, 6, 6];
const CARRERA_MAX = [null, 0, 1, 2, 3, 4, 5, 6, 6];

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

/* Días de la semana (0 = domingo) en que cae una sesión. En S1 del plan de volumen
   el domingo repite la sesión del sábado (dows); desde S2 el sábado es solo sábado y
   el domingo es la carrera (VOL-D, fromWeek: 2). */
const sessionDows = (s, week) => (week.plan === 'vol' && week.n === 1 && s.dows) || [s.dow];

/* Sesiones de la semana, en el orden del plan. */
function sessionsFor(week) {
  if (week.plan === 'vol') return Object.values(BLOCK_VOL).filter((s) => !s.fromWeek || week.n >= s.fromWeek);
  return Object.values(week.block === 'A' ? BLOCK_A : BLOCK_B);
}

/* Sesión prevista para una fecha. En bloque B el día es libre: devuelve la
   lista de los 3 días para que elijas, salvo que ya haya uno registrado. */
function sessionFor(dateStr) {
  const week = weekFor(dateStr);
  if (!week) return { week: null, options: [] };
  const dow = dowOf(dateStr);
  if (week.plan === 'vol') {
    const day = sessionsFor(week).find((d) => sessionDows(d, week).includes(dow));
    return { week, options: [day] };
  }
  if (week.block === 'A') {
    const day = Object.values(BLOCK_A).find((d) => d.dow === dow);
    return { week, options: [day] };
  }
  return { week, options: [BLOCK_B[1], BLOCK_B[2], BLOCK_B[3]] };
}

/* Nombre y título de una sesión esa semana (el sábado de S1 conserva los de entonces). */
const sessionLabel = (session, week) => ({ ...session, ...((week && session.byWeek && session.byWeek[week.n]) || {}) });

/* Plan de volumen: una prescripción por semana. Plan de 4 semanas: s1/s2. */
function presFor(exercise, week) {
  if (exercise.pres) return exercise.pres[week.n - 1];
  return week.col === 's2' ? exercise.s2 : exercise.s1;
}

/* ¿Se registra este ejercicio por pierna (D/I) esa semana? Solo desde S2 del plan
   de volumen: S1 ya está hecha y se ve como siempre. */
const sidesFor = (exercise, week) => !!exercise.sides && week.plan === 'vol' && week.n >= 2;

/* Grupos de la tabla «series por grupo» de la hoja Volumen (filas 71–83). */
const VOL_GRUPOS = ['Espalda', 'Pecho', 'Hombro lat.', 'Hombro post.', 'Bíceps', 'Tríceps',
  'Isquios', 'Abs', 'Gemelos', 'Aductores'];

/* Series de hipertrofia de la semana n (1–8) por grupo, como la fórmula del Excel
   (=SUM((B="grupo")*IFERROR(VALUE(LEFT(C, FIND(" ", C&" ")-1)),0))): el entero inicial
   de la celda, hasta el primer espacio, de los ejercicios cuyo objetivo es exactamente
   el grupo. Cardio, rehab, test y correctivos no cuentan. Devuelve { grupo: n, …, TOTAL }. */
function seriesPorGrupo(n) {
  const out = Object.fromEntries(VOL_GRUPOS.map((g) => [g, 0]));
  for (const session of Object.values(BLOCK_VOL)) {
    for (const exercise of session.exercises) {
      if (!(exercise.target in out)) continue;
      const first = exercise.pres[n - 1].label.split(' ')[0];
      if (/^\d+$/.test(first)) out[exercise.target] += +first;
    }
  }
  out.TOTAL = VOL_GRUPOS.reduce((acc, g) => acc + out[g], 0);
  return out;
}

const PLAN = {
  WEEKS, BLOCK_A, BLOCK_B, RULES, VOL_WEEKS, BLOCK_VOL, VOL_RULES, VOL_NOTES, PLANS,
  VOL_HITOS, VOL_HITOS_NOTE, VOL_BLOCK_RULES, VOL_BLOCK_RULES_TITLE, VOL_CARDIO_TITLE, VOL_GRUPOS,
  weekFor, planById, planFor, sessionsFor, sessionFor, presFor, isoDate,
  parsePres, sidesFor, seriesPorGrupo, slug, sessionLabel,
  PRENSA_NIVELES, CARRERA_NIVELES, PRENSA_MAX, CARRERA_MAX,
};
