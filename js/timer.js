/* Cronómetro manual: cuenta hacia arriba y solo se mueve cuando tú lo dices.
   No es un temporizador — no hay cuenta atrás ni avisos.

   Es único para toda la app: sigue corriendo aunque salgas del ejercicio o
   cierres la app, que es justo lo que quieres para cronometrar el descanso
   entre series mientras cambias de pantalla.

   El tiempo se calcula a partir de marcas de Date.now(), nunca acumulando
   ticks: iOS congela los temporizadores de las webapps en segundo plano, así
   que contar intervalos se quedaría corto al volver. */

const TIMER_KEY = 'gym.timer.v1';

let st = { running: false, startedAt: null, acc: 0 };
const listeners = new Set();
let ticker = null;

try {
  const saved = JSON.parse(localStorage.getItem(TIMER_KEY));
  if (saved && typeof saved.acc === 'number') st = saved;
} catch { /* arrancamos a cero */ }

function save() {
  try { localStorage.setItem(TIMER_KEY, JSON.stringify(st)); } catch { /* da igual */ }
}

function elapsed() {
  return st.acc + (st.running && st.startedAt ? Date.now() - st.startedAt : 0);
}

function emit() {
  listeners.forEach((fn) => fn(elapsed(), st.running));
}

function sync() {
  clearInterval(ticker);
  ticker = null;
  // 250 ms: el reloj muestra segundos, así que basta para que no se vea saltar.
  if (st.running) ticker = setInterval(emit, 250);
  save();
  emit();
}

function start() {
  if (st.running) return;
  st.running = true;
  st.startedAt = Date.now();
  sync();
}

function pause() {
  if (!st.running) return;
  st.acc = elapsed();
  st.running = false;
  st.startedAt = null;
  sync();
}

const toggle = () => (st.running ? pause() : start());

/* A cero. Si estaba corriendo sigue corriendo desde cero, que es lo natural
   al encadenar series; si estaba parado, se queda parado. */
function reset() {
  st.acc = 0;
  st.startedAt = st.running ? Date.now() : null;
  sync();
}

function subscribe(fn) {
  listeners.add(fn);
  fn(elapsed(), st.running);
  return () => listeners.delete(fn);
}

/* Al volver del segundo plano el intervalo puede haberse quedado atrás. */
document.addEventListener('visibilitychange', () => { if (!document.hidden) emit(); });

function fmt(ms) {
  const total = Math.floor(ms / 1000);
  const s = String(total % 60).padStart(2, '0');
  const m = Math.floor(total / 60) % 60;
  const h = Math.floor(total / 3600);
  return h ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${String(m).padStart(2, '0')}:${s}`;
}

if (st.running) sync();

const Timer = {
  elapsed, start, pause, toggle, reset, subscribe, fmt,
  isRunning: () => st.running,
  seconds: () => Math.round(elapsed() / 1000),
};
