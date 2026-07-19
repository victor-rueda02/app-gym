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
   { days: { "2026-07-20": { sessionId, notes, entries: { exId: [ {kg,reps,secs,rir,done} ] } } } } */
function empty() { return { days: {} }; }

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
  cache = data;
  persist();
}

const Store = {
  init, all, day, setSession, sets, saveSets, setNotes, lastPerformance, importAll,
};
