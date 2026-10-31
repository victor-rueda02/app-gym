/* Dos planes:
   - 4 semanas · 20 jul – 16 ago 2026, transcrito desde las hojas "Bloque A" y
     "Bloque B" del Excel (ya pasado: no cambia).
   - Volumen 8 semanas, que se lee al arrancar de la hoja "Volumen (1910-1112)" del
     Excel empotrado (ver «Volumen · 8 semanas, leído del Excel empotrado»). */

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
  // "N @ RIR1/0" y "N @ RIRk", con líneas de aclaración opcionales (p. ej. "2/11: con goma").
  else if ((m = text.match(/^(\d+) @ RIR1\/0(?:\n[\s\S]*)?$/))) p = rir10(+m[1]);
  else if ((m = text.match(/^(\d+) @ RIR(\d)(?:\n[\s\S]*)?$/))) p = rir(+m[1], +m[2]);
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

/* Volumen · 8 semanas, leído del Excel empotrado -------------------------------
   El plan de volumen no está copiado aquí: se construye al arrancar a partir de la
   hoja «Volumen (1910-1112)» del .xlsx que lleva la app (js/original-xlsx.js), así
   que para cambiarlo basta con editar el Excel y empotrarlo (tools/excel_app.py).
   La columna «App» (L, oculta) etiqueta lo que la hoja no dice por sí sola:
     sesion[;nombreS1=…]      cabecera de sesión «(L) Lunes · título» (nombre en S1)
     id=…                     id estable del ejercicio (el historial cuelga de él)
     escalera=prensa          la prensa: sus celdas definen la escalera (nov: xN / +1 escalón)
     escalera=prensa:sigue    sigue el nivel de la prensa de esa semana (sentadilla, búlgara)
     escalera=prensa:anterior va al escalón ya validado, el de la semana anterior (touchdown)
     escalera=carrera         la carrera del día de novedad: sus celdas definen los niveles
     escalera=carrera:domingo repite el nivel de la carrera de esa semana
     bici                     la bici: se quita y vuelve según el semáforo
     sesion=X[;titulo=…]      (bloque de cardio) a qué sesión va la fila, como último ejercicio
     S1=X;S2=X                día de esa semana, si no es el de la cabecera (en una cabecera,
                              toda la sesión; en un ejercicio, solo esa fila)
     cardio · hitos · regla · nota · grupos · reglas-bloque · desglose=…   filas de texto/tablas
   Dos cabeceras con la misma letra son un mismo día (sus filas, seguidas).
   El sábado de S1 y el domingo sin sesión: si un domingo no tiene sesión esa semana,
   repite la del sábado (así era S1). */
const LIBRO = LectorXlsx.leer(originalXlsxBytes());

const DIAS_PLAN = 'LMXJVSD';
const DOW = { L: 1, M: 2, X: 3, J: 4, V: 5, S: 6, D: 0 };
const NOMBRE_DIA = { L: 'Lunes', M: 'Martes', X: 'Miércoles', J: 'Jueves', V: 'Viernes', S: 'Sábado', D: 'Domingo' };
const COLS_SEMANA = ['C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];

/* 'id=x;bici' -> { id: 'x', bici: true } */
function etiquetasApp(valor) {
  const out = {};
  String(valor || '').split(';').map((p) => p.trim()).filter(Boolean).forEach((p) => {
    const i = p.indexOf('=');
    if (i < 0) out[p] = true;
    else out[p.slice(0, i).trim()] = p.slice(i + 1).trim();
  });
  return out;
}

const ultimaFila = (hoja) => Math.max(...Object.keys(hoja).map((ref) => +ref.replace(/^[A-Z]+/, '')));

/* «S1=X;S2=X» -> { 1: 'X', 2: 'X' } (días que cambian según la semana). */
function diasPorSemana(e, donde) {
  const out = {};
  for (const [k, letra] of Object.entries(e)) {
    if (!/^S\d+$/.test(k)) continue;
    if (!(letra in DOW)) throw new Error(`Volumen!${donde}: «${k}=${letra}» no es un día (L M X J V S D)`);
    out[+k.slice(1)] = letra;
  }
  return out;
}

function construirVolumen(hoja) {
  const v = (ref) => (hoja[ref] === undefined ? '' : hoja[ref]);
  const t = (ref) => String(v(ref));
  const app = (r) => etiquetasApp(v(`L${r}`));
  const max = ultimaFila(hoja);
  const vol = {
    cabeceras: [], cardio: [], rules: [], notes: [], hitos: [], hitosNote: '', blockRules: [], blockRulesTitle: '',
    cardioTitle: '', grupos: [],
  };

  const ejercicio = (r, nombre, objetivo, e) => {
    const semanas = COLS_SEMANA.map((c) => t(`${c}${r}`));
    const extra = {};
    if (objetivo === 'Test') extra.link = 'test';                       // se apunta en Rodilla › Test
    else if (semanas.slice(1).some((s) => /\/pierna|por pierna/.test(s))) extra.sides = true;   // D/I
    if (e.escalera) extra.prog = e.escalera;
    if (e.bici) extra.prog = 'bici';
    const x = vx(nombre, objetivo, semanas, t(`K${r}`), extra);
    if (e.id) x.id = e.id;
    return x;
  };

  let sesion = null;
  for (let r = 1; r <= max; r++) {
    const a = t(`A${r}`).trim();
    const e = app(r);
    if (e.sesion === true) {
      const m = /^\(([LMXJVSD])\)\s*([^·]+?)\s*(?:·\s*([\s\S]*))?$/.exec(a);
      if (!m) throw new Error(`Volumen!A${r}: cabecera de sesión sin el formato «(L) Lunes · título»`);
      sesion = { letra: m[1], title: (m[3] || '').trim(), dias: diasPorSemana(e, `L${r}`), nombreS1: e.nombreS1, filas: [] };
      vol.cabeceras.push(sesion);
      continue;
    }
    if (!a) { sesion = null; continue; }
    // Dentro de una sesión: la cabecera de la tabla y los ejercicios (con objetivo en B). Una
    // fila sin objetivo (p. ej. un texto pegado a la tabla) cierra la sesión.
    if (sesion && a === 'Ejercicio') continue;
    if (sesion && t(`B${r}`)) { sesion.filas.push({ x: ejercicio(r, a, t(`B${r}`), e), dias: diasPorSemana(e, `L${r}`) }); continue; }
    sesion = null;
    if (typeof e.sesion === 'string') {   // bloque de cardio y carrera
      vol.cardio.push({ letra: e.sesion, titulo: e.titulo || '', x: ejercicio(r, t(`B${r}`).trim(), 'Cardio', e) });
    }
    if (e.regla) vol.rules.push(a);
    if (e.nota) vol.notes.push(a);
    if (e.cardio) vol.cardioTitle = a;
    if (e.hitos) { vol.hitos = COLS_SEMANA.map((c) => t(`${c}${r}`)); vol.hitosNote = t(`K${r}`); }
    if (e.grupos) {
      for (let f = r + 1; t(`A${f}`) && !t(`A${f}`).startsWith('TOTAL'); f++) vol.grupos.push(t(`A${f}`));
    }
    if (e['reglas-bloque']) {
      vol.blockRulesTitle = a;
      for (let f = r + 1; t(`A${f}`); f++) vol.blockRules.push(t(`A${f}`));
    }
  }

  // Sesiones sin cambios de día por semana (las de S3 en adelante) y sesiones que solo
  // existen desde una semana (el domingo de carrera).
  vol.sesiones = sesionesDeSemana(vol, null);
  for (const s of Object.values(vol.sesiones)) {
    if (s.exercises.every((x) => x.target === 'Cardio')) {
      const desde = s.exercises.map((x) => x.pres.findIndex((p) => !p.skip)).filter((i) => i >= 0);
      if (desde.length && Math.min(...desde) > 0) s.fromWeek = Math.min(...desde) + 1;
    }
  }
  return vol;
}

/* Sesiones de la semana n, por día: cada cabecera va al día de esa semana («S1=X») o al
   de su letra, y una fila con su propio «Sn=…» va ese día detrás de las filas de la primera
   cabecera de ese día. El cardio va al final de su día. Título: el de la primera cabecera
   con ejercicios ese día (si no hay, el de la cabecera de ese día o el de la fila de cardio).
   Con n = null no se aplica ningún cambio por semana ni se quita nada. Con n, se quita el
   día que se queda sin ejercicios o solo con cardio que esa semana no se hace («—»). */
function sesionesDeSemana(vol, n) {
  const diaDe = (dias, letra) => (n && dias[n]) || letra;
  const out = {};
  const dia = (letra) => {
    if (!out[letra]) out[letra] = { id: `VOL-${letra}`, dow: DOW[letra], name: NOMBRE_DIA[letra], title: '', exercises: [], conFilas: false };
    return out[letra];
  };
  const movidas = {};   // filas que esa semana van a otro día que el de su cabecera
  vol.cabeceras.forEach((c) => c.filas.forEach((f) => {
    const letra = diaDe(f.dias, diaDe(c.dias, c.letra));
    if (letra !== diaDe(c.dias, c.letra)) (movidas[letra] = movidas[letra] || []).push(f.x);
  }));
  for (const c of vol.cabeceras) {
    const letra = diaDe(c.dias, c.letra);
    const s = dia(letra);
    const propias = c.filas.filter((f) => diaDe(f.dias, letra) === letra).map((f) => f.x);
    if (!s.title && (propias.length || letra === c.letra)) s.title = c.title;
    if (propias.length && !s.conFilas) {
      s.title = c.title;
      s.exercises.push(...propias, ...(movidas[letra] || []));
      s.conFilas = true;
    } else {
      s.exercises.push(...propias);
    }
    if (c.nombreS1) s.byWeek = { 1: { name: c.nombreS1, title: '' } };
  }
  for (const [letra, xs] of Object.entries(movidas)) {
    if (!dia(letra).conFilas) dia(letra).exercises.push(...xs);
  }
  for (const c of vol.cardio) {
    const s = dia(c.letra);
    if (!s.title) s.title = c.titulo;
    s.exercises.push(c.x);
  }
  const ordenadas = {};
  for (const letra of DIAS_PLAN) {
    const s = out[letra];
    if (!s) continue;
    delete s.conFilas;
    if (n && (!s.exercises.length || s.exercises.every((x) => x.target === 'Cardio' && x.pres[n - 1].skip))) continue;
    ordenadas[letra] = s;
  }
  return ordenadas;
}

/* Escaleras de progresión, sacadas de las celdas del calendario:
   - prensa: nivel 0 = S1; «nov: xN» cambia las reps y «nov: +1 escalón» sube el escalón.
   - carrera: «N1 · 8×(1'/2')» define el nivel 1; «repite N6» repite; «—» = sin entrar. */
function construirEscaleras(sesiones, desde) {
  const todos = Object.entries(sesiones).flatMap(([l, s]) => s.exercises.map((x) => ({ l, x })));
  const con = (prog) => todos.filter(({ x }) => x.prog === prog);
  const uno = (prog) => {
    const xs = con(prog);
    if (xs.length !== 1) throw new Error(`Volumen: tiene que haber un ejercicio con «escalera=${prog}» y hay ${xs.length}`);
    return xs[0];
  };

  const prensa = uno('prensa');
  const PRENSA_NIVELES = [];
  const PRENSA_MAX = [null];
  prensa.x.pres.forEach((p, i) => {
    const reps = +((/x(\d+)/.exec(p.label.split('\n')[0]) || [])[1]);
    const nov = /nov: (?:x(\d+)|\+1 escalón)/.exec(p.label);
    if (i === 0) PRENSA_NIVELES.push({ reps, esc: 0 });
    else if (nov) {
      const ant = PRENSA_NIVELES[PRENSA_NIVELES.length - 1];
      PRENSA_NIVELES.push(nov[1] ? { reps: +nov[1], esc: ant.esc } : { reps: ant.reps, esc: ant.esc + 1 });
    }
    const nivel = PRENSA_NIVELES.length - 1;
    if (!p.skip && reps !== PRENSA_NIVELES[nivel].reps) {
      throw new Error(`Prensa S${i + 1}: «${p.label}» no cuadra con la escalera (x${PRENSA_NIVELES[nivel].reps})`);
    }
    PRENSA_MAX.push(nivel);
  });

  const carrera = uno('carrera');
  const CARRERA_NIVELES = [''];
  const CARRERA_MAX = [null];
  carrera.x.pres.forEach((p) => {
    let m;
    if ((m = /^N(\d+) · (.+)$/.exec(p.label))) { CARRERA_NIVELES[+m[1]] = m[2]; CARRERA_MAX.push(+m[1]); }
    else if ((m = /^repite N(\d+)$/.exec(p.label))) CARRERA_MAX.push(+m[1]);
    else CARRERA_MAX.push(0);
  });

  // Semana en la que el calendario alcanza cada nivel de la prensa (su celda da series y reps).
  const PRENSA_SEMANA = PRENSA_NIVELES.map((_, k) => PRENSA_MAX.indexOf(k));

  // Días de cada escalera y entrada de la bici: la primera celda que no es «—» desde la
  // primera semana con seguimiento (en S1 ya se hacía bici, pero no se seguía).
  const dias = (...progs) => [...new Set(todos.filter(({ x }) => progs.includes(x.prog)).map(({ l }) => l))]
    .sort((a, b) => DIAS_PLAN.indexOf(a) - DIAS_PLAN.indexOf(b));
  const bici = con('bici').map(({ l, x }) => ({ l, semana: x.pres.findIndex((p, i) => i + 1 >= desde && !p.skip) + 1 }))
    .filter((b) => b.semana > 0).sort((a, b) => a.semana - b.semana || DIAS_PLAN.indexOf(a.l) - DIAS_PLAN.indexOf(b.l));
  // Escaleras genéricas: cualquier otro «escalera=<nombre>» (p. ej. un rango que se amplía).
  // Su ejercicio guía marca cada subida con una línea «nov: …» en la celda; el nivel 0 es su
  // primera celda que no es «—»; en las semanas con «—» no hay sesión de esa escalera.
  // «escalera=<nombre>:sigue» = otro ejercicio que va al nivel de esa semana.
  const ESPECIALES = ['prensa', 'carrera', 'bici'];
  const simples = [...new Set(todos.map(({ x }) => (x.prog || '').split(':')[0]))]
    .filter((nombre) => nombre && !ESPECIALES.includes(nombre))
    .map((nombre) => {
      const guia = uno(nombre);
      const max = [null];
      const semana = [];
      const niveles = [];   // descripción de cada nivel: el texto tras «nov: » (el 0, su 2.ª línea)
      let nivel = -1;
      guia.x.pres.forEach((p, i) => {
        if (p.skip) { max.push(null); return; }
        const lineas = p.label.split('\n').slice(1);
        const nov = lineas.find((l) => l.startsWith('nov: '));
        if (nivel < 0) { nivel = 0; niveles[0] = lineas.join(' · '); }
        else if (nov) { nivel += 1; niveles[nivel] = nov.slice(5); }
        if (semana[nivel] === undefined) semana[nivel] = i + 1;
        max.push(nivel);
      });
      return { nombre, dia: guia.l, dias: dias(nombre, `${nombre}:sigue`), max, semana, niveles };
    });
  const ESCALERAS = {
    prensa: { dia: prensa.l, dias: dias('prensa', 'prensa:sigue') },
    carrera: { dia: carrera.l, dias: dias('carrera', 'carrera:domingo') },
    bici: { dias: dias('bici'), entrada: bici.length ? { semana: bici[0].semana, dia: bici[0].l } : null },
    simples,
  };
  return { PRENSA_NIVELES, PRENSA_MAX, PRENSA_SEMANA, CARRERA_NIVELES, CARRERA_MAX, ESCALERAS };
}

/* Semanas: la primera fecha del seguimiento (lunes de la primera semana con seguimiento)
   y la semana que es (columna C) dan el lunes de S1; hay tantas semanas como columnas.
   `semanas.seguimiento` = número de la primera semana con seguimiento (2). */
function construirSemanas(seguimiento) {
  const col = (ref) => (seguimiento[ref] === undefined ? '' : seguimiento[ref]);
  const max = ultimaFila(seguimiento);
  let cab = 0;
  for (let r = 1; r <= max && !cab; r++) if (etiquetasApp(col(`R${r}`)).dias) cab = r;
  if (!cab) throw new Error('Seguimiento rodilla: falta la fila con la etiqueta «dias»');
  const primera = LectorXlsx.fecha(col(`A${cab + 1}`));
  const n = +String(col(`C${cab + 1}`)).slice(1);
  const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  const dia = (iso, k) => { const d = new Date(`${iso}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + k); return d; };
  const iso = (d) => d.toISOString().slice(0, 10);
  const corta = (d) => [d.getUTCDate(), MESES[d.getUTCMonth()]];
  const lunes1 = iso(dia(primera, -7 * (n - 1)));
  const semanas = COLS_SEMANA.map((_, i) => {
    const a = dia(lunes1, 7 * i);
    const b = dia(lunes1, 7 * i + 6);
    const [da, ma] = corta(a);
    const [db, mb] = corta(b);
    return {
      plan: 'vol', n: i + 1, block: 'Volumen', from: iso(a), to: iso(b), title: `Semana ${i + 1} · Volumen`,
      sub: ma === mb ? `${da}–${db} ${ma}` : `${da} ${ma} – ${db} ${mb}`,
    };
  });
  return { semanas, seguimiento: n };
}

const VOLUMEN = construirVolumen(LIBRO['Volumen (1910-1112)']);
const BLOCK_VOL = VOLUMEN.sesiones;
const VOL_RULES = VOLUMEN.rules;
const VOL_NOTES = VOLUMEN.notes;
const VOL_HITOS = VOLUMEN.hitos;
const VOL_HITOS_NOTE = VOLUMEN.hitosNote;
const VOL_CARDIO_TITLE = VOLUMEN.cardioTitle;
const VOL_BLOCK_RULES_TITLE = VOLUMEN.blockRulesTitle;
const VOL_BLOCK_RULES = VOLUMEN.blockRules;
const VOL_GRUPOS = VOLUMEN.grupos;
const SEMANAS = construirSemanas(LIBRO['Seguimiento rodilla']);
const VOL_WEEKS = SEMANAS.semanas;
const SEMANA_SEGUIMIENTO = SEMANAS.seguimiento;   // primera semana con seguimiento (S2): la de referencia
const { PRENSA_NIVELES, PRENSA_MAX, PRENSA_SEMANA, CARRERA_NIVELES, CARRERA_MAX, ESCALERAS } = construirEscaleras(BLOCK_VOL, SEMANA_SEGUIMIENTO);
const SESIONES_SEMANA = VOL_WEEKS.map((w) => sesionesDeSemana(VOLUMEN, w.n));   // las sesiones de cada semana, por día
const rangoCorto = (iso) => {
  const d = new Date(`${iso}T12:00:00Z`);
  return `${d.getUTCDate()} ${['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'][d.getUTCMonth()]}`;
};

const PLANS = [
  { id: 'jul', name: '4 semanas', range: '20 jul – 16 ago', from: '2026-07-20', to: '2026-08-16',
    weeks: WEEKS, rules: RULES, rulesTitle: 'Reglas de rodilla',
    sheetNote: 'Rehab FIJA las 4 semanas. Techo en MAV2: nada de MRV antes de la fiesta.' },
  { id: 'vol', name: `Volumen ${VOL_WEEKS.length} semanas`,
    range: `${rangoCorto(VOL_WEEKS[0].from)} – ${rangoCorto(VOL_WEEKS[VOL_WEEKS.length - 1].to)}`,
    from: VOL_WEEKS[0].from, to: VOL_WEEKS[VOL_WEEKS.length - 1].to,
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
  if (week.plan === 'vol') return Object.values(SESIONES_SEMANA[week.n - 1]);
  return Object.values(week.block === 'A' ? BLOCK_A : BLOCK_B);
}

/* Sesión prevista para una fecha. En bloque B el día es libre: devuelve la
   lista de los 3 días para que elijas, salvo que ya haya uno registrado. */
function sessionFor(dateStr) {
  const week = weekFor(dateStr);
  if (!week) return { week: null, options: [] };
  const dow = dowOf(dateStr);
  if (week.plan === 'vol') {
    const sesiones = sessionsFor(week);
    // Un domingo sin sesión propia esa semana repite la del sábado (así era S1).
    const day = sesiones.find((d) => d.dow === dow) || (dow === 0 ? sesiones.find((d) => d.dow === 6) : undefined);
    return { week, options: [day] };
  }
  if (week.block === 'A') {
    const day = Object.values(BLOCK_A).find((d) => d.dow === dow);
    return { week, options: [day] };
  }
  return { week, options: [BLOCK_B[1], BLOCK_B[2], BLOCK_B[3]] };
}

/* Plan de volumen: la sesión de un día con lo que ya se registró ese día. Es la prevista y,
   al final, cada ejercicio registrado que no esté en ella (p. ej. una sesión hecha otro día),
   para que ni la pantalla ni la exportación pierdan nada. Sin sesión prevista ni registros,
   descanso. `entries` = Store.day(fecha).entries. */
function sesionDelDia(dateStr, entries) {
  const { week, options } = sessionFor(dateStr);
  if (!week || week.plan !== 'vol') return null;
  const prevista = options[0];
  const ids = new Set(prevista ? prevista.exercises.map((x) => x.id) : []);
  const todos = [...sessionsFor(week), ...Object.values(BLOCK_VOL)].flatMap((s) => s.exercises);
  const extra = Object.keys(entries || {}).filter((id) => entries[id].length && !ids.has(id))
    .map((id) => todos.find((x) => x.id === id)).filter(Boolean);
  if (!extra.length && prevista) return prevista;
  const letra = DIAS_PLAN.split('').find((l) => DOW[l] === dowOf(dateStr));
  const base = prevista || { id: `VOL-${letra}`, dow: DOW[letra], name: NOMBRE_DIA[letra], title: '', exercises: [] };
  if (!extra.length) return { ...base, title: 'Descanso', rest: true };
  return { ...base, exercises: [...base.exercises, ...extra] };
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

/* Series de hipertrofia de la semana n (1–8) por grupo, como la fórmula del Excel
   (suma de IFERROR(VALUE(LEFT(C, FIND(" ", C&" ")-1)),0) de cada fila del grupo): el entero inicial
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
  weekFor, planById, planFor, sessionsFor, sessionFor, sesionDelDia, presFor, isoDate,
  parsePres, sidesFor, seriesPorGrupo, slug, sessionLabel,
  PRENSA_NIVELES, CARRERA_NIVELES, PRENSA_MAX, CARRERA_MAX, PRENSA_SEMANA, ESCALERAS,
  LIBRO, etiquetasApp, DIAS_PLAN, NOMBRE_DIA, SEMANA_SEGUIMIENTO,
};
