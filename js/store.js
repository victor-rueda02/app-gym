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
   { v, days: { "2026-07-20": { sessionId, notes, entries: { exId: [ {kg,reps,secs,rir} ] } } } } */
const VERSION = 3;

function empty() { return { v: VERSION, days: {} }; }

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
};

function migrate(data) {
  for (let v = (data.v || 1) + 1; v <= VERSION; v++) {
    if (MIGRATIONS[v]) MIGRATIONS[v](data);
  }
  data.v = VERSION;
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

function importAll(data) {
  if (!data || typeof data !== 'object' || !data.days) throw new Error('Formato no válido');
  cache = migrate(data);   // una copia antigua puede venir de antes de un renombrado
  persist();
}

const Store = {
  init, all, day, setSession, sets, saveSets, setNotes, lastPerformance, importAll,
};
