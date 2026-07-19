/* Interfaz. Tres pestañas (Hoy / Plan / Datos) y una vista de detalle por
   ejercicio. Todo se guarda al teclear: no hay botón de "guardar" que olvidar. */

const view = document.getElementById('view');
const titleEl = document.getElementById('title');
const subtitleEl = document.getElementById('subtitle');
const backBtn = document.getElementById('back');

const state = {
  tab: 'today',
  date: PLAN.isoDate(new Date()),
  exercise: null,     // {sessionId, exId} cuando estamos en el detalle
  planWeek: 1,
  // Filas visibles por ejercicio. Las series vacías no se guardan, así que sin
  // esto un "+ Añadir serie" se perdería en el siguiente render.
  rows: {},
};

const rowsKey = (date, exId) => `${date}|${exId}`;

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
    || null;
}

/* Resumen de una serie ya guardada, p. ej. "40kg × 10 @2" */
function setSummary(s, kind) {
  const parts = [];
  if (s.kg !== '' && s.kg != null) parts.push(`${s.kg}kg`);
  if (kind === 'iso') { if (s.secs) parts.push(`${s.secs}s`); }
  else if (s.reps !== '' && s.reps != null) parts.push(`×${s.reps}`);
  if (kind === 'rir' && s.rir !== '' && s.rir != null) parts.push(`@${s.rir}`);
  return parts.join(' ') || '—';
}

const isLogged = (s) => [s.kg, s.reps, s.secs].some((v) => v !== '' && v != null);

/* Render ------------------------------------------------------------------ */
function render() {
  backBtn.hidden = !state.exercise;
  document.querySelectorAll('.tabbar button')
    .forEach((b) => b.classList.toggle('active', b.dataset.tab === state.tab));

  if (state.exercise) return renderExercise();
  if (state.tab === 'today') return renderToday();
  if (state.tab === 'plan') return renderPlan();
  return renderData();
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

  const picker = el(`
    <div class="card" style="display:flex;align-items:center;gap:10px">
      <span style="flex:1;font-size:13px;color:var(--muted)">Cambiar día</span>
      <input type="date" id="datepick" value="${date}"
             style="background:var(--surface-2);border:1px solid var(--line);border-radius:10px;
                    color:var(--text);font:inherit;font-size:15px;padding:8px 10px">
    </div>`);
  picker.querySelector('#datepick').addEventListener('change', (e) => {
    if (e.target.value) { state.date = e.target.value; render(); }
  });

  if (!week) {
    view.appendChild(el('<div class="empty">Esta fecha queda fuera del plan de 4 semanas (20 jul – 16 ago).</div>'));
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
            <div class="meta">${escapeHtml(s.title)}</div>
          </div>
          <span class="pres">${s.exercises.length} ej.</span>
        </button>`);
      b.addEventListener('click', () => { Store.setSession(date, s.id); render(); });
      view.appendChild(b);
    });
    view.appendChild(picker);
    return;
  }

  const session = week.block === 'A' ? options[0] : sessionById(rec.sessionId);
  if (!session) { view.appendChild(picker); return; }
  if (!rec.sessionId) Store.setSession(date, session.id);

  document.getElementById('hero-name').textContent = session.rest
    ? 'Descanso' : session.title;

  if (session.note) {
    view.appendChild(el(`<div class="card"><p>${escapeHtml(session.note)}</p></div>`));
  }
  if (session.rest || !session.exercises.length) {
    view.appendChild(picker);
    return;
  }

  view.appendChild(el('<div class="section-label">Ejercicios</div>'));
  session.exercises.forEach((exercise) => {
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
  const done = pres.sets > 0 && logged >= pres.sets;

  const row = el(`
    <button class="ex ${exercise.target === 'Rehab' ? 'rehab' : ''} ${done ? 'done' : ''}">
      <div class="grow">
        <div class="nm">${escapeHtml(exercise.name)}</div>
        <div class="meta">${escapeHtml(exercise.target)}${exercise.notes ? ' · ' + escapeHtml(exercise.notes) : ''}</div>
      </div>
      <span class="pres">${logged ? `${logged}/${pres.sets}` : escapeHtml(pres.label)}</span>
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
  subtitleEl.textContent = `${exercise.target} · objetivo ${pres.label}`;

  view.innerHTML = '';

  if (pres.kind === 'none') {
    view.appendChild(el('<div class="empty">Sin series que registrar. Haz tu rutina de movilidad.</div>'));
    return;
  }

  const prev = Store.lastPerformance(exId, date);
  if (prev) {
    const summary = prev.sets.filter(isLogged).map((s) => setSummary(s, pres.kind)).join(' · ');
    view.appendChild(el(
      `<div class="prev">Última vez (<b>${escapeHtml(shortDate(prev.date))}</b>): ${escapeHtml(summary || '—')}</div>`));
  }

  const card = el('<div class="card"></div>');
  const cols = pres.kind === 'iso'
    ? ['Kg', 'Seg'] : pres.kind === 'rir' ? ['Kg', 'Reps', 'RIR'] : ['Kg', 'Reps'];

  const grid = (extra) => `grid-template-columns: 30px ${'1fr '.repeat(cols.length)}40px;${extra || ''}`;
  card.appendChild(el(
    `<div class="set-row head" style="${grid()}">
       <span></span>${cols.map((c) => `<span>${c}</span>`).join('')}<span></span>
     </div>`));

  const list = Store.sets(date, exId).slice();
  // Arranca con las series prescritas para que solo haya que rellenar huecos.
  const wanted = Math.max(pres.sets, 1, state.rows[rowsKey(date, exId)] || 0, list.length);
  while (list.length < wanted) list.push({ kg: '', reps: '', secs: '', rir: '' });

  const save = () => Store.saveSets(date, exId, list.filter(isLogged));

  function addRow(index) {
    const s = list[index];
    const placeholder = { Kg: '—', Reps: pres.reps || '', Seg: pres.secs || '', RIR: pres.rir ?? '' };
    const field = { Kg: 'kg', Reps: 'reps', Seg: 'secs', RIR: 'rir' };

    const row = el(`
      <div class="set-row" style="${grid()}">
        <span class="n">${index + 1}</span>
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

  const add = el('<button class="btn ghost">+ Añadir serie</button>');
  add.addEventListener('click', () => {
    const last = list[list.length - 1] || {};
    // Copiamos la carga de la serie anterior: casi siempre se repite.
    list.push({ kg: last.kg ?? '', reps: '', secs: '', rir: '' });
    state.rows[rowsKey(date, exId)] = list.length;
    save();   // persiste la carga heredada; si va vacía, la mantiene state.rows
    renderExercise();
  });
  view.appendChild(add);

  const back = el('<button class="btn">Hecho</button>');
  back.addEventListener('click', () => { state.exercise = null; render(); });
  view.appendChild(back);
}

/* --- Plan ------------------------------------------------------------------ */
function renderPlan() {
  titleEl.textContent = 'Plan';
  subtitleEl.textContent = '4 semanas · 20 jul – 16 ago';
  view.innerHTML = '';

  const tabs = el('<div class="card" style="display:flex;gap:6px;padding:6px"></div>');
  PLAN.WEEKS.forEach((w) => {
    const b = el(`<button class="btn ${state.planWeek === w.n ? '' : 'ghost'}"
                          style="height:40px;margin:0;font-size:14px">S${w.n}</button>`);
    b.addEventListener('click', () => { state.planWeek = w.n; render(); });
    tabs.appendChild(b);
  });
  view.appendChild(tabs);

  const week = PLAN.WEEKS.find((w) => w.n === state.planWeek);
  view.appendChild(el(`
    <div class="card">
      <h2>${escapeHtml(week.title)}</h2>
      <p>${escapeHtml(week.sub)} · ${escapeHtml(shortDate(week.from))} – ${escapeHtml(shortDate(week.to))}</p>
    </div>`));

  const days = week.block === 'A' ? Object.values(PLAN.BLOCK_A) : Object.values(PLAN.BLOCK_B);
  days.forEach((session) => {
    view.appendChild(el(`<div class="section-label">${escapeHtml(session.name)} · ${escapeHtml(session.title)}</div>`));
    if (!session.exercises.length) {
      view.appendChild(el(`<div class="card"><p>${escapeHtml(session.note || 'Descanso')}</p></div>`));
      return;
    }
    session.exercises.forEach((exercise) => {
      const pres = PLAN.presFor(exercise, week);
      view.appendChild(el(`
        <div class="ex ${exercise.target === 'Rehab' ? 'rehab' : ''}">
          <div class="grow">
            <div class="nm">${escapeHtml(exercise.name)}</div>
            <div class="meta">${escapeHtml(exercise.target)}</div>
          </div>
          <span class="pres">${escapeHtml(pres.label)}</span>
        </div>`));
    });
  });

  view.appendChild(el('<div class="section-label">Reglas de rodilla</div>'));
  view.appendChild(el(
    `<div class="card"><ul class="rules">${PLAN.RULES.map((r) => `<li>${escapeHtml(r)}</li>`).join('')}</ul></div>`));
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
      <p>Reconstruye <b>${escapeHtml(ORIGINAL_XLSX_NAME)}</b> con tus 3 hojas
         originales intactas + la hoja <b>Registro</b>. Sustituye el fichero
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
            <div class="meta">${escapeHtml(session ? session.title : '—')}</div>
          </div>
          <span class="pres">${n} series</span>
        </button>`);
      row.addEventListener('click', () => {
        state.date = d; state.tab = 'today'; render(); window.scrollTo(0, 0);
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
  document.getElementById('sheet-title').textContent = 'Reglas de rodilla';
  document.getElementById('sheet-content').innerHTML =
    `<ul class="rules">${PLAN.RULES.map((r) => `<li>${escapeHtml(r)}</li>`).join('')}</ul>
     <p style="color:var(--muted);font-size:12.5px;margin-top:14px">
       Rehab FIJA las 4 semanas. Techo en MAV2: nada de MRV antes de la fiesta.</p>`;
  sheet.hidden = false;
});

/* Arranque ------------------------------------------------------------------ */
Store.init().then(() => {
  render();
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => { /* sin offline, pero funciona */ });
  }
});
