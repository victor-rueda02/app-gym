/* Persistencia local. localStorage es la fuente de verdad (síncrono, simple);
   IndexedDB guarda una copia espejo porque iOS puede purgar localStorage de
   sitios poco usados, y una PWA instalada con IDB aguanta bastante más. */

const KEY = 'gym.log.v1';
const DB = 'gym', STORE = 'kv';

let cache = null;

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbPut(value) {
  const db = await openDb();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(value, KEY);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

async function idbGet() {
  const db = await openDb();
  const value = await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get(KEY);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  db.close();
  return value;
}

/* Estructura:
   { v, days: { "2026-07-20": { sessionId, notes, entries: { exId: [ {kg,reps,secs,rir,mins,side} ] } } },
     knee: { days, weeks, entry, tests, depth } }
   `side` ('D' | 'I' | '') solo se usa en los unilaterales desde la semana 2 del plan de volumen.
   `knee` es el registro de la pestaña Rodilla (ver KNEE_SECCIONES y setKnee). */
const VERSION = 4;

// Secciones de `knee`, cada una un mapa clave -> { campo: valor }:
//   days  { 'YYYY-MM-DD': { decline, steps, during, back60:'Sí'|'No', click:'Sí'|'No', notes,
//                           session?, rule?, novelty? } }   (session/rule/novelty: solo si se
//                           edita lo precargado; ausente = el del plan, presente aunque sea '' = lo editado)
//   weeks { 'S2'…'S10': { pressLevel?, runLevel?, notes } }   (niveles reales apuntados a
//                           mano: índices de PLAN.PRENSA_NIVELES y de PLAN.CARRERA_NIVELES;
//                           ausentes = la propuesta del semáforo)
//   entry { 'S2'…'S8': { walkPain, walkBack60, tdPain, hopsPain: 'Sí'|'No', notes } }
//                           (un intento de entrada a la carrera por semana)
//   tests { t1…t4: { load, repsD, repsI, notes } }
//   depth { '0'…'4': { angle, press, box, split, touchdown, validated, notes } }
const KNEE_SECCIONES = ['days', 'weeks', 'entry', 'tests', 'depth'];

function ensureKnee(data) {
  if (!data.knee || typeof data.knee !== 'object') data.knee = {};
  for (const sec of KNEE_SECCIONES) {
    if (!data.knee[sec] || typeof data.knee[sec] !== 'object') data.knee[sec] = {};
  }
  return data.knee;
}

function empty() { return ensureKnee({ v: VERSION, days: {} }); }

/* Los identificadores de ejercicio salen del nombre, así que renombrar uno deja
   huérfano lo ya registrado. Cada migración recoloca esas entradas. */
const MIGRATIONS = {
  // v1 -> v2: las tres "Laterales" del bloque A pasan a nombres propios por día.
  // Bloque B mantiene su "Laterales" genérico y no se toca.
  2(data) {
    const porSesion = {
      'A-L': 'laterales-de-pie',
      'A-X': 'laterales-sentado-inclinado',
      'A-V': 'laterales-inclinado-estiramiento',
    };
    const mover = (entries, from, to) => {
      if (!entries[from]) return;
      entries[to] = (entries[to] || []).concat(entries[from]);
      delete entries[from];
    };
    for (const rec of Object.values(data.days)) {
      const destino = porSesion[rec.sessionId];
      if (destino) mover(rec.entries, 'laterales', destino);
      mover(rec.entries, 'laterales-medio-posterior', 'laterales-banco-inclinado-posterior');
    }
  },

  // v2 -> v3: el Excel con cardio renombra o sustituye ejercicios del plan de
  // volumen. Se recolocan por sesión: las sesiones de julio/agosto no se tocan.
  // En el miércoles el orden importa: "Jalón neutro" pasa a "Jalón ancho plano
  // frontal" y solo después "Dominadas medio abiertas" ocupa el nombre "Jalón neutro".
  3(data) {
    const porSesion = {
      'VOL-L': [['gemelos', 'gemelos-prensa']],
      'VOL-M': [
        ['press-inclinado-barra', 'press-inclinado-barra-30-40'],
        ['aperturas-polea', 'contractora-pec-deck'],
        ['abs', 'abs-colgado-retroversion'],
      ],
      'VOL-X': [
        ['jalon-neutro', 'jalon-ancho-plano-frontal'],
        ['dominadas-medio-abiertas', 'jalon-neutro'],
      ],
      'VOL-J': [['gemelos', 'gemelos-prensa']],
      'VOL-V': [
        ['triceps-conc-polea', 'triceps-conc-polea-15'],
        ['curl-frances-manc', 'press-frances-manc-banco-plano'],
        ['press-incl-maquina', 'press-maquina-neutro-ascendente'],
        ['remo-maquina', 'remo-maquina-pecho-apoyado-30'],
        ['pullover', 'aduccion-unil-polea-alta-pull-in'],
      ],
    };
    for (const rec of Object.values(data.days)) {
      for (const [from, to] of porSesion[rec.sessionId] || []) {
        if (!rec.entries[from]) continue;
        rec.entries[to] = (rec.entries[to] || []).concat(rec.entries[from]);
        delete rec.entries[from];
      }
    }
  },

  // v3 -> v4: el Excel del plan rodilla renombra o sustituye ejercicios del plan de
  // volumen (ids escritos a mano: son el slug del nombre en js/plan.js) y añade el
  // registro de rodilla. Por sesión: las de julio/agosto (A-*, B-*) no se tocan.
  4(data) {
    const porSesion = {
      'VOL-L': [
        ['unilateral-abduction', 'abduccion-de-pie-unilateral-maquina'],
        ['prensa-unil', 'prensa-unil-pesado-y-lento-n-1'],
      ],
      'VOL-J': [
        ['unilateral-abduction', 'abduccion-de-pie-unilateral-maquina'],
        ['back-squat', 'sentadilla-al-cajon-o-desde-pines-pesado-y-lento-n-2'],
      ],
      'VOL-S': [
        ['unilateral-abduction', 'abduccion-unilateral'],
        ['movilidad-trapecio-inferior', 'elevacion-lateral-en-prono-t-mancuernas-banco'],
      ],
      'VOL-V': [['bici-z2-z3-prog', 'bici-z2-sin-z3-en-este-bloque']],
    };
    for (const rec of Object.values(data.days)) {
      for (const [from, to] of porSesion[rec.sessionId] || []) {
        if (!rec.entries[from]) continue;
        rec.entries[to] = (rec.entries[to] || []).concat(rec.entries[from]);
        delete rec.entries[from];
      }
    }
    ensureKnee(data);
  },
};

function migrate(data) {
  for (let v = (data.v || 1) + 1; v <= VERSION; v++) {
    if (MIGRATIONS[v]) MIGRATIONS[v](data);
  }
  data.v = VERSION;
  ensureKnee(data);
  return data;
}

/* Arranca leyendo localStorage y, si está vacío, recupera del espejo IDB. */
async function init() {
  try {
    cache = JSON.parse(localStorage.getItem(KEY)) || null;
  } catch { cache = null; }
  if (!cache) {
    try {
      const backup = await idbGet();
      if (backup) {
        cache = backup;
        localStorage.setItem(KEY, JSON.stringify(cache));
      }
    } catch { /* IDB no disponible: seguimos solo con localStorage */ }
  }
  if (!cache) cache = empty();
  const before = cache.v || 1;
  cache = migrate(cache);
  if (cache.v !== before) persist();
  return cache;
}

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(cache));
  } catch (e) {
    console.warn('localStorage lleno o bloqueado', e);
  }
  idbPut(cache).catch(() => { /* el espejo es best-effort */ });
}

const all = () => cache;

function day(dateStr) {
  if (!cache.days[dateStr]) cache.days[dateStr] = { sessionId: null, notes: '', entries: {} };
  return cache.days[dateStr];
}

function setSession(dateStr, sessionId) {
  day(dateStr).sessionId = sessionId;
  persist();
}

function sets(dateStr, exId) {
  return (cache.days[dateStr] && cache.days[dateStr].entries[exId]) || [];
}

function saveSets(dateStr, exId, list) {
  const d = day(dateStr);
  if (list.length) d.entries[exId] = list;
  else delete d.entries[exId];
  persist();
}

function setNotes(dateStr, text) {
  day(dateStr).notes = text;
  persist();
}

/* Última sesión registrada de un ejercicio antes de `beforeDate`, para tener
   referencia de carga a la hora de progresar. */
function lastPerformance(exId, beforeDate) {
  const dates = Object.keys(cache.days).filter((d) => d < beforeDate).sort().reverse();
  for (const d of dates) {
    const list = cache.days[d].entries[exId];
    if (list && list.length) return { date: d, sets: list };
  }
  return null;
}

/* Registro de rodilla (garantiza las secciones). */
const knee = () => ensureKnee(cache);

/* Escribe un campo del registro de rodilla y persiste. `value === undefined` borra
   el campo (y la clave si se queda sin campos). */
function setKnee(section, key, field, value) {
  if (!KNEE_SECCIONES.includes(section)) throw new Error(`Sección de rodilla desconocida: ${section}`);
  const sec = knee()[section];
  if (value === undefined) {
    if (sec[key]) {
      delete sec[key][field];
      if (!Object.keys(sec[key]).length) delete sec[key];
    }
  } else {
    if (!sec[key]) sec[key] = {};
    sec[key][field] = value;
  }
  persist();
}

function importAll(data) {
  if (!data || typeof data !== 'object' || !data.days) throw new Error('Formato no válido');
  cache = migrate(data);   // una copia antigua puede venir de antes de un renombrado
  persist();
}

const Store = {
  init, all, day, setSession, sets, saveSets, setNotes, lastPerformance, importAll,
  knee, setKnee,
};
