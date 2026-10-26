/* Interfaz. Cuatro pestañas (Hoy / Plan / Rodilla / Datos) y una vista de detalle por
   ejercicio. La pestaña Rodilla la pinta js/rodilla.js (Rodilla.render). Todo se guarda al teclear: no hay botón de "guardar" que olvidar. */

const view = document.getElementById('view');
const titleEl = document.getElementById('title');
const subtitleEl = document.getElementById('subtitle');
const backBtn = document.getElementById('back');
const chipTimer = document.getElementById('chip-timer');

const state = {
  tab: 'today',
  date: PLAN.isoDate(new Date()),
  exercise: null,     // {sessionId, exId} cuando estamos en el detalle
  planId: null,       // null: el plan en curso (o el próximo) según la fecha
  planWeek: null,     // null: la semana de la fecha si cae en ese plan, si no la 1
  // Filas visibles por ejercicio. Las series vacías no se guardan, así que sin
  // esto un "+ Añadir serie" se perdería en el siguiente render.
  rows: {},
};

const rowsKey = (date, exId) => `${date}|${exId}`;

/* Cambiar de fecha devuelve la pestaña Plan al plan y semana de esa fecha. */
function setDate(d) {
  state.date = d;
  state.planId = null;
  state.planWeek = null;
}

/* Utilidades -------------------------------------------------------------- */
const el = (html) => {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
};

const escapeHtml = (s) => String(s).replace(/[&<>"']/g,
  (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Solo la inicial en mayúscula: `text-transform: capitalize` capitalizaría
// también el "de" de "21 de julio".
const fmtDate = (d) => {
  const s = new Date(d + 'T12:00:00')
    .toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
  return s.charAt(0).toUpperCase() + s.slice(1);
};

const shortDate = (d) => new Date(d + 'T12:00:00')
  .toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });

let toastTimer;
function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, 2600);
}

function sessionById(id) {
  return Object.values(PLAN.BLOCK_A).find((d) => d.id === id)
    || Object.values(PLAN.BLOCK_B).find((d) => d.id === id)
    || Object.values(PLAN.BLOCK_VOL).find((d) => d.id === id)
    || null;
}

/* Resumen de una serie ya guardada, p. ej. "40kg × 10 @2" */
function setSummary(s, kind) {
  if (kind === 'cardio') return s.mins ? `${s.mins} min` : '—';
  const parts = [];
  if (s.side) parts.push(s.side);   // pierna (D/I) en los unilaterales
  if (s.kg !== '' && s.kg != null) parts.push(`${s.kg}kg`);
  if (kind === 'iso') { if (s.secs) parts.push(`${s.secs}s`); }
  else if (s.reps !== '' && s.reps != null) parts.push(`×${s.reps}`);
  if (kind === 'rir' && s.rir !== '' && s.rir != null) parts.push(`@${s.rir}`);
  return parts.join(' ') || '—';
}

const isLogged = (s) => [s.kg, s.reps, s.secs, s.mins].some((v) => v !== '' && v != null);

// Barra de color a la izquierda: verde = rehab y test, azul = cardio, ámbar = correctivos
const typeClass = (exercise) => (exercise.target.startsWith('Rehab') || exercise.target === 'Test' ? 'rehab'
  : exercise.target === 'Cardio' ? 'cardio'
    : exercise.target.endsWith('(correctivo)') ? 'corr' : '');

// Hueco de serie vacío. En los unilaterales (D/I) las series alternan, D primero.
const blankSet = (side) => ({ kg: '', reps: '', secs: '', rir: '', mins: '', ...(side ? { side } : {}) });
const sideAt = (index) => (index % 2 ? 'I' : 'D');

/* Tarjeta «Hitos y avisos» de una semana del plan de volumen (null si no hay nada). */
function hitosCard(week) {
  if (!week || week.plan !== 'vol') return null;
  const hito = PLAN.VOL_HITOS[week.n - 1];
  if (!hito || hito === '—') return null;
  const note = PLAN.VOL_HITOS_NOTE ? `<p class="multi" style="margin-top:8px">${escapeHtml(PLAN.VOL_HITOS_NOTE)}</p>` : '';
  return el(`<div class="card hitos"><h2>Hitos y avisos</h2><p class="multi">${escapeHtml(hito)}</p>${note}</div>`);
}

// En la lista solo caben notas cortas; las largas se leen dentro del ejercicio.
const shortNote = (n) => (n && n.length <= 40 ? n : '');

const sessionName = (s) => (s.title ? `${s.name} · ${s.title}` : s.name);

/* Render ------------------------------------------------------------------ */
function render() {
  backBtn.hidden = !state.exercise;
  document.querySelectorAll('.tabbar button')
    .forEach((b) => b.classList.toggle('active', b.dataset.tab === state.tab));

  if (state.exercise) renderExercise();
  else if (state.tab === 'today') renderToday();
  else if (state.tab === 'plan') renderPlan();
  else if (state.tab === 'knee') Rodilla.render();
  else renderData();

  paintTimer();   // el DOM es nuevo: hay que devolverle el estado del cronómetro
}

/* --- Hoy ------------------------------------------------------------------ */
function renderToday() {
  const date = state.date;
  const { week, options } = PLAN.sessionFor(date);
  titleEl.textContent = 'Hoy';
  subtitleEl.textContent = week ? `${week.title} · ${week.sub}` : 'Fuera del plan';

  view.innerHTML = '';
  view.appendChild(el(`
    <div class="card hero">
      <div class="date">${escapeHtml(fmtDate(date))}</div>
      <div class="name" id="hero-name"></div>
      <div class="week">${week ? escapeHtml(week.title) : 'Sin plan para esta fecha'}</div>
    </div>`));

  const kneeCard = Rodilla.todayCard(date);
  if (kneeCard) view.appendChild(kneeCard);
  const hitos = week && week.n >= 2 ? hitosCard(week) : null;
  if (hitos) view.appendChild(hitos);

  const picker = el(`
    <div class="card" style="display:flex;align-items:center;gap:10px">
      <span style="flex:1;font-size:13px;color:var(--muted)">Cambiar día</span>
      <input type="date" id="datepick" value="${date}"
             style="background:var(--surface-2);border:1px solid var(--line);border-radius:10px;
                    color:var(--text);font:inherit;font-size:15px;padding:8px 10px">
    </div>`);
  picker.querySelector('#datepick').addEventListener('change', (e) => {
    if (e.target.value) { setDate(e.target.value); render(); }
  });

  if (!week) {
    view.appendChild(el(`<div class="empty">Esta fecha queda fuera de los planes
      (${escapeHtml(PLAN.PLANS.map((p) => p.range).join(' y '))}).</div>`));
    view.appendChild(picker);
    return;
  }

  const rec = Store.day(date);

  // Bloque B: los 3 días son libres, se elige cuál toca hoy.
  if (week.block === 'B' && !rec.sessionId) {
    document.getElementById('hero-name').textContent = 'Elige sesión';
    view.appendChild(el('<div class="section-label">Coloca los 3 días en tus jornadas menos resacosas</div>'));
    options.forEach((s) => {
      const b = el(`
        <button class="ex">
          <div class="grow">
            <div class="nm">${escapeHtml(s.name)}</div>
            <div class="meta">${escapeHtml(s.title || s.name)}</div>
          </div>
          <span class="pres">${s.exercises.length} ej.</span>
        </button>`);
      b.addEventListener('click', () => { Store.setSession(date, s.id); render(); });
      view.appendChild(b);
    });
    view.appendChild(picker);
    return;
  }

  const session = week.block === 'B' ? sessionById(rec.sessionId) : options[0];
  if (!session) { view.appendChild(picker); return; }
  if (!rec.sessionId) Store.setSession(date, session.id);

  document.getElementById('hero-name').textContent = session.rest
    ? 'Descanso' : (session.title || session.name);

  if (session.note) {
    view.appendChild(el(`<div class="card"><p class="multi">${escapeHtml(session.note)}</p></div>`));
  }
  if (session.rest || !session.exercises.length) {
    view.appendChild(picker);
    return;
  }

  view.appendChild(el('<div class="section-label">Ejercicios</div>'));
  session.exercises.forEach((exercise) => {
    if (PLAN.presFor(exercise, week).skip) return;   // «—»: esa semana no se hace
    view.appendChild(exerciseRow(exercise, week, date, session));
  });

  const notes = el(`
    <div class="card">
      <div class="section-label" style="margin:0 0 8px">Notas del día</div>
      <textarea id="daynotes" placeholder="Sensaciones, dolor de rodilla (0–10), sueño…">${escapeHtml(rec.notes || '')}</textarea>
    </div>`);
  notes.querySelector('#daynotes')
    .addEventListener('input', (e) => Store.setNotes(date, e.target.value));
  view.appendChild(notes);

  if (week.block === 'B') {
    const change = el('<button class="btn line">Cambiar de sesión</button>');
    change.addEventListener('click', () => { Store.setSession(date, null); render(); });
    view.appendChild(change);
  }
  view.appendChild(picker);
}

function exerciseRow(exercise, week, date, session) {
  const pres = PLAN.presFor(exercise, week);
  const logged = Store.sets(date, exercise.id).filter(isLogged).length;
  // En los unilaterales (D/I) cada serie prescrita se hace con las dos piernas.
  const total = PLAN.sidesFor(exercise, week) ? pres.sets * 2 : pres.sets;
  const done = total > 0 && logged >= total;

  const row = el(`
    <button class="ex ${typeClass(exercise)} ${done ? 'done' : ''}">
      <div class="grow">
        <div class="nm">${escapeHtml(exercise.name)}</div>
        <div class="meta">${escapeHtml(exercise.target)}${shortNote(exercise.notes) ? ' · ' + escapeHtml(shortNote(exercise.notes)) : ''}</div>
      </div>
      <span class="pres">${logged ? `${logged}/${total}` : escapeHtml(pres.label)}</span>
    </button>`);

  row.addEventListener('click', () => {
    state.exercise = { sessionId: session.id, exId: exercise.id, date };
    render();
    window.scrollTo(0, 0);
  });
  return row;
}

/* --- Detalle de ejercicio -------------------------------------------------- */
function renderExercise() {
  const { sessionId, exId, date } = state.exercise;
  const session = sessionById(sessionId);
  const week = PLAN.weekFor(date);
  const exercise = session.exercises.find((e) => e.id === exId);
  const pres = PLAN.presFor(exercise, week);

  titleEl.textContent = exercise.name;
  subtitleEl.textContent = `${exercise.target} · objetivo ${pres.label.replace(/\n/g, ' · ')}`;

  view.innerHTML = '';

  if (pres.kind === 'none') {
    view.appendChild(el(pres.skip
      ? '<div class="empty">Este ejercicio no se hace esta semana.</div>'
      : '<div class="empty">Sin series que registrar. Haz tu rutina de movilidad.</div>'));
    return;
  }

  if (pres.label.includes('\n') || pres.optional) {
    view.appendChild(el(`<div class="card"><p class="multi">${escapeHtml(pres.label)}</p></div>`));
  }

  if (exercise.notes) view.appendChild(el(`<div class="card"><p class="multi">${escapeHtml(exercise.notes)}</p></div>`));

  view.appendChild(stopwatch(pres, date, exId));

  const prev = Store.lastPerformance(exId, date);
  if (prev) {
    const summary = prev.sets.filter(isLogged).map((s) => setSummary(s, pres.kind)).join(' · ');
    view.appendChild(el(
      `<div class="prev">Última vez (<b>${escapeHtml(shortDate(prev.date))}</b>): ${escapeHtml(summary || '—')}</div>`));
  }

  const card = el('<div class="card"></div>');
  const cols = pres.kind === 'cardio' ? ['Min']
    : pres.kind === 'iso' ? ['Kg', 'Seg'] : pres.kind === 'rir' ? ['Kg', 'Reps', 'RIR'] : ['Kg', 'Reps'];

  // Unilaterales desde S2: una columna con el botón de pierna (D = derecha, la afectada; I = izquierda).
  const sides = PLAN.sidesFor(exercise, week);
  const grid = (extra) => `grid-template-columns: 30px ${sides ? '44px ' : ''}${'1fr '.repeat(cols.length)}40px;${extra || ''}`;
  card.appendChild(el(
    `<div class="set-row head" style="${grid()}">
       <span></span>${sides ? '<span>Lado</span>' : ''}${cols.map((c) => `<span>${c}</span>`).join('')}<span></span>
     </div>`));

  const list = Store.sets(date, exId).slice();
  // Arranca con las series prescritas para que solo haya que rellenar huecos.
  // En los unilaterales son 2 × series (una por pierna), alternando D, I.
  const prescritas = sides ? pres.sets * 2 : pres.sets;
  const wanted = Math.max(prescritas, 1, state.rows[rowsKey(date, exId)] || 0, list.length);
  while (list.length < wanted) list.push(blankSet(sides && sideAt(list.length)));

  const save = () => Store.saveSets(date, exId, list.filter(isLogged));

  function addRow(index) {
    const s = list[index];
    // "RIR1/0" lleva un objetivo por serie (1, 1, …, 0); el resto, uno común.
    const rirGoal = pres.rirs ? pres.rirs[index] : pres.rir;
    const placeholder = { Kg: '—', Reps: pres.reps || '', Seg: pres.secs || '', RIR: rirGoal ?? '', Min: pres.mins || '' };
    const field = { Kg: 'kg', Reps: 'reps', Seg: 'secs', RIR: 'rir', Min: 'mins' };

    const row = el(`
      <div class="set-row" style="${grid()}">
        <span class="n">${index + 1}</span>
        ${sides ? `<button class="side ${s.side === 'I' ? 'i' : s.side === 'D' ? 'd' : ''}"
                           aria-label="Pierna de la serie ${index + 1}">${s.side || '–'}</button>` : ''}
        ${cols.map((c) => `
          <input inputmode="decimal" enterkeyhint="next"
                 data-f="${field[c]}" value="${s[field[c]] ?? ''}"
                 placeholder="${escapeHtml(String(placeholder[c] ?? ''))}"
                 aria-label="${c} serie ${index + 1}">`).join('')}
        <button class="del" aria-label="Borrar serie ${index + 1}">×</button>
      </div>`);

    row.querySelectorAll('input').forEach((input) => {
      input.addEventListener('input', (e) => {
        s[e.target.dataset.f] = e.target.value.replace(',', '.').trim();
        save();
      });
    });
    const sideBtn = row.querySelector('.side');
    if (sideBtn) {
      sideBtn.addEventListener('click', () => {
        s.side = s.side === 'D' ? 'I' : 'D';
        sideBtn.textContent = s.side;
        sideBtn.classList.toggle('d', s.side === 'D');
        sideBtn.classList.toggle('i', s.side === 'I');
        save();
      });
    }
    row.querySelector('.del').addEventListener('click', () => {
      list.splice(index, 1);
      save();
      state.rows[rowsKey(date, exId)] = Math.max(1, list.length);
      renderExercise();
    });
    card.appendChild(row);
  }

  list.forEach((_, i) => addRow(i));
  view.appendChild(card);

  if (pres.kind !== 'cardio') {   // el cardio es una sola entrada, sin series
    const add = el('<button class="btn ghost">+ Añadir serie</button>');
    add.addEventListener('click', () => {
      const last = list[list.length - 1] || {};
      // Copiamos la carga de la serie anterior: casi siempre se repite.
      const nextSide = sides ? (last.side === 'D' ? 'I' : 'D') : '';
      list.push({ ...blankSet(nextSide), kg: last.kg ?? '' });
      state.rows[rowsKey(date, exId)] = list.length;
      save();   // persiste la carga heredada; si va vacía, la mantiene state.rows
      renderExercise();
    });
    view.appendChild(add);
  }

  const back = el('<button class="btn">Hecho</button>');
  back.addEventListener('click', () => { state.exercise = null; render(); });
  view.appendChild(back);
}

/* Cronómetro manual. Es único para toda la app, así que sigue contando si sales
   del ejercicio; el chip de la barra superior lo recuerda. */
const toggleLabel = (ms, running) => (running ? 'Pausar' : (ms ? 'Seguir' : 'Iniciar'));

/* Vuelca el estado del cronómetro en el DOM. Se llama desde la suscripción y al
   final de cada render: los elementos recién creados tienen que nacer con la
   hora correcta, y en pausa no hay ticks que la corrijan después. */
function paintTimer(ms = Timer.elapsed(), running = Timer.isRunning()) {
  const txt = Timer.fmt(ms);
  const clock = document.getElementById('sw-clock');
  if (clock) {
    clock.textContent = txt;
    clock.parentElement.classList.toggle('on', running);
    const toggle = document.getElementById('sw-toggle');
    if (toggle) toggle.textContent = toggleLabel(ms, running);
  }
  const showChip = running && !clock;   // redundante si el reloj grande está a la vista
  chipTimer.hidden = !showChip;
  if (showChip) chipTimer.textContent = txt;
}

Timer.subscribe(paintTimer);

function stopwatch(pres, date, exId) {
  const ms = Timer.elapsed();
  const running = Timer.isRunning();
  const box = el(`
    <div class="stopwatch ${running ? 'on' : ''}">
      <span class="clock" id="sw-clock">${Timer.fmt(ms)}</span>
      <button id="sw-toggle">${toggleLabel(ms, running)}</button>
      <button class="sec" id="sw-reset">A cero</button>
    </div>`);

  box.querySelector('#sw-toggle').addEventListener('click', () => Timer.toggle());
  box.querySelector('#sw-reset').addEventListener('click', () => Timer.reset());

  if (pres.kind !== 'iso') return box;

  // En los isométricos el tiempo ES el dato, así que se puede volcar a la serie.
  const wrap = document.createDocumentFragment();
  wrap.appendChild(box);

  const list = Store.sets(date, exId);
  let target = list.findIndex((s) => !s.secs);
  if (target === -1) target = list.length;

  const stamp = el(`<button class="stamp">Anotar el tiempo en la serie ${target + 1}</button>`);
  stamp.addEventListener('click', () => {
    const secs = Timer.seconds();
    if (!secs) { toast('El cronómetro está a cero'); return; }
    const updated = Store.sets(date, exId).slice();
    while (updated.length <= target) updated.push(blankSet());
    updated[target] = { ...updated[target], secs: String(secs) };
    Store.saveSets(date, exId, updated.filter(isLogged));
    state.rows[rowsKey(date, exId)] = Math.max(updated.length, state.rows[rowsKey(date, exId)] || 0);
    Timer.pause();
    Timer.reset();
    toast(`${secs} s anotados en la serie ${target + 1}`);
    renderExercise();
  });
  wrap.appendChild(stamp);
  return wrap;
}

/* --- Plan ------------------------------------------------------------------ */
function renderPlan() {
  const plan = PLAN.planById(state.planId) || PLAN.planFor(state.date);
  const current = PLAN.weekFor(state.date);
  const weekN = state.planWeek || (current && current.plan === plan.id ? current.n : 1);

  titleEl.textContent = 'Plan';
  subtitleEl.textContent = `${plan.name} · ${plan.range}`;
  view.innerHTML = '';

  const plans = el('<div class="card" style="display:flex;gap:6px;padding:6px"></div>');
  PLAN.PLANS.forEach((p) => {
    const b = el(`<button class="btn ${p.id === plan.id ? '' : 'ghost'}" data-plan="${p.id}"
                          style="height:40px;margin:0;font-size:14px">${escapeHtml(p.name)}</button>`);
    b.addEventListener('click', () => { state.planId = p.id; state.planWeek = null; render(); });
    plans.appendChild(b);
  });
  view.appendChild(plans);

  const tabs = el('<div class="card" style="display:flex;gap:6px;padding:6px"></div>');
  plan.weeks.forEach((w) => {
    const b = el(`<button class="btn ${weekN === w.n ? '' : 'ghost'}" data-week="${w.n}"
                          style="height:40px;margin:0;font-size:14px">S${w.n}</button>`);
    b.addEventListener('click', () => { state.planId = plan.id; state.planWeek = w.n; render(); });
    tabs.appendChild(b);
  });
  view.appendChild(tabs);

  const week = plan.weeks.find((w) => w.n === weekN);
  // En el plan de volumen el subtítulo ya es el rango de fechas.
  const range = week.plan === 'vol' ? ''
    : ` · ${shortDate(week.from)} – ${shortDate(week.to)}`;
  view.appendChild(el(`
    <div class="card">
      <h2>${escapeHtml(week.title)}</h2>
      <p>${escapeHtml(week.sub + range)}</p>
    </div>`));

  if (week.plan === 'vol') {
    const hitos = hitosCard(week);
    if (hitos) view.appendChild(hitos);
    const reglas = el('<button class="btn line" style="margin:0 0 10px">Reglas del bloque</button>');
    reglas.addEventListener('click', () => Reglas.open());
    view.appendChild(reglas);
  }

  PLAN.sessionsFor(week).forEach((session) => {
    view.appendChild(el(`<div class="section-label">${escapeHtml(sessionName(session))}</div>`));
    if (!session.exercises.length) {
      view.appendChild(el(`<div class="card"><p>${escapeHtml(session.note || 'Descanso')}</p></div>`));
      return;
    }
    session.exercises.forEach((exercise) => {
      const pres = PLAN.presFor(exercise, week);
      view.appendChild(el(`
        <div class="ex ${typeClass(exercise)} ${pres.skip ? 'skip' : ''}">
          <div class="grow">
            <div class="nm">${escapeHtml(exercise.name)}</div>
            <div class="meta">${escapeHtml(exercise.target)}</div>
          </div>
          <span class="pres">${escapeHtml(pres.label)}</span>
        </div>`));
    });
  });

  const list = (items) => `<ul class="rules">${items.map((r) => `<li>${escapeHtml(r)}</li>`).join('')}</ul>`;
  view.appendChild(el(`<div class="section-label">${escapeHtml(plan.rulesTitle)}</div>`));
  view.appendChild(el(`<div class="card">${list(plan.rules)}</div>`));
  if (plan.notes) {
    view.appendChild(el(`<div class="section-label">${escapeHtml(plan.notesTitle)}</div>`));
    view.appendChild(el(`<div class="card">${list(plan.notes)}</div>`));
  }
}

/* --- Datos ----------------------------------------------------------------- */
function renderData() {
  titleEl.textContent = 'Datos';
  const data = Store.all();
  const days = Object.keys(data.days).filter((d) => Object.keys(data.days[d].entries).length);
  const totalSets = days.reduce((acc, d) => acc
    + Object.values(data.days[d].entries).reduce((a, l) => a + l.length, 0), 0);
  const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
  subtitleEl.textContent = `${plural(days.length, 'sesión', 'sesiones')} · ${plural(totalSets, 'serie', 'series')}`;

  view.innerHTML = '';
  view.appendChild(el(`
    <div class="card">
      <h2>Exportar al Excel</h2>
      <p>Reconstruye <b>${escapeHtml(ORIGINAL_XLSX_NAME)}</b> con las hojas
         del plan intactas, la hoja <b>Seguimiento rodilla</b> rellena con lo
         que apuntes en Rodilla y la hoja <b>Registro</b>. Sustituye el fichero
         de tu ordenador por el exportado.</p>
    </div>`));

  const exportBtn = el('<button class="btn">Exportar .xlsx</button>');
  exportBtn.addEventListener('click', async () => {
    exportBtn.disabled = true;
    exportBtn.textContent = 'Generando…';
    try {
      toast(await exportXlsx());
    } catch (e) {
      console.error(e);
      toast('Error al exportar: ' + e.message);
    } finally {
      exportBtn.disabled = false;
      exportBtn.textContent = 'Exportar .xlsx';
    }
  });
  view.appendChild(exportBtn);

  view.appendChild(el('<div class="section-label">Copia de seguridad</div>'));
  view.appendChild(el(`
    <div class="card"><p>El registro vive solo en este móvil. Descarga un JSON
      de vez en cuando por si reinstalas la app o cambias de dispositivo.</p></div>`));

  const jsonBtn = el('<button class="btn line">Descargar copia (JSON)</button>');
  jsonBtn.addEventListener('click', () => { exportJson(); toast('Copia descargada'); });
  view.appendChild(jsonBtn);

  const importBtn = el('<button class="btn line">Restaurar copia</button>');
  const picker = el('<input type="file" accept="application/json,.json" hidden>');
  importBtn.addEventListener('click', () => picker.click());
  picker.addEventListener('change', async () => {
    const file = picker.files[0];
    if (!file) return;
    try {
      await importJson(file);
      toast('Copia restaurada');
      render();
    } catch (e) {
      toast('Fichero no válido');
    }
    picker.value = '';
  });
  view.appendChild(importBtn);
  view.appendChild(picker);

  if (days.length) {
    view.appendChild(el('<div class="section-label">Historial</div>'));
    days.sort().reverse().forEach((d) => {
      const rec = data.days[d];
      const session = sessionById(rec.sessionId);
      const n = Object.values(rec.entries).reduce((a, l) => a + l.length, 0);
      const row = el(`
        <button class="ex">
          <div class="grow">
            <div class="nm">${escapeHtml(shortDate(d))}</div>
            <div class="meta">${escapeHtml(session ? (session.title || session.name) : '—')}</div>
          </div>
          <span class="pres">${n} series</span>
        </button>`);
      row.addEventListener('click', () => {
        setDate(d); state.tab = 'today'; render(); window.scrollTo(0, 0);
      });
      view.appendChild(row);
    });
  }
}

/* Navegación ---------------------------------------------------------------- */
document.querySelectorAll('.tabbar button').forEach((b) => {
  b.addEventListener('click', () => {
    state.tab = b.dataset.tab;
    state.exercise = null;
    render();
    window.scrollTo(0, 0);
  });
});

backBtn.addEventListener('click', () => { state.exercise = null; render(); });

const sheet = document.getElementById('sheet');
document.getElementById('sheet-close').addEventListener('click', () => { sheet.hidden = true; });
sheet.addEventListener('click', (e) => { if (e.target === sheet) sheet.hidden = true; });

document.getElementById('menu').addEventListener('click', () => {
  const plan = PLAN.planFor(state.date);
  document.getElementById('sheet-title').textContent = plan.rulesTitle;
  document.getElementById('sheet-content').innerHTML =
    `<ul class="rules">${plan.rules.map((r) => `<li>${escapeHtml(r)}</li>`).join('')}</ul>` +
    (plan.sheetNote ? `<p style="color:var(--muted);font-size:12.5px;margin-top:14px">
       ${escapeHtml(plan.sheetNote)}</p>` : '');
  sheet.hidden = false;
});

/* Arranque ------------------------------------------------------------------ */
Store.init().then(() => {
  render();
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => { /* sin offline, pero funciona */ });
  }
});
