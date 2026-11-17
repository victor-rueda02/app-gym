/* Interfaz. Cinco pestañas (Hoy / Plan / Rodilla / Progreso / Datos) y una vista de detalle por
   ejercicio. La pestaña Rodilla la pinta js/rodilla.js (Rodilla.render) y Progreso, js/progreso.js
   (Progreso.render). Todo se guarda al teclear: no hay botón de "guardar" que olvidar. */

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
  planVista: 'semana',   // Plan: 'semana' (el plan por semanas) o 'ejercicios' (Plan › Ejercicios)
  ejercicioConf: null,   // Plan › Ejercicios: id del ejercicio abierto en el editor
  ejTodos: false,        // Plan › Ejercicios: todos los del plan (true) o solo los hechos
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

/* La sesión de un día. En el plan de volumen, la de esa semana (los días de las sesiones
   cambian de una semana a otra) con lo que se haya registrado ese día; en el de julio, por id. */
function sesionDe(date, id) {
  const week = PLAN.weekFor(date);
  if (week && week.plan === 'vol') { const r = Store.all().days[date] || {}; return PLAN.sesionDelDia(date, r.entries, r.added, r.removed); }
  return sessionById(id);
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

const isLogged = (s) => [s.kg, s.reps, s.secs, s.mins, ...Object.values(s.x || {})].some((v) => v !== '' && v != null);

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

/* Prescripción del día: con el nivel real para los ejercicios con progresión
   (prensa, sentadilla, búlgara, touchdown y carrera, desde S2); si no, la del plan. */
const presHoy = (exercise, week, date) => Rodilla.prescripcion(exercise, week, date) || PLAN.presFor(exercise, week);

/* El test de fuerza no es un ejercicio: es un enlace a Rodilla › Test (y no cuenta series). */
function testCard(exercise, week) {
  const card = el(`
    <button class="ex rehab">
      <div class="grow">
        <div class="nm">${escapeHtml(exercise.name)}</div>
        <div class="meta">${escapeHtml(PLAN.presFor(exercise, week).label.replace(/\n/g, ' '))} · se apunta en Rodilla › Test</div>
      </div>
      <span class="pres">Test ›</span>
    </button>`);
  card.addEventListener('click', () => Rodilla.abrir('test'));
  return card;
}

/* Render ------------------------------------------------------------------ */
function render() {
  backBtn.hidden = !state.exercise;
  document.querySelectorAll('.tabbar button')
    .forEach((b) => b.classList.toggle('active', b.dataset.tab === state.tab));

  if (state.exercise) renderExercise();
  else if (state.tab === 'today') renderToday();
  else if (state.tab === 'plan') renderPlan();
  else if (state.tab === 'knee') Rodilla.render();
  else if (state.tab === 'progress') Progreso.render();
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

  const session = week.block === 'B' ? sessionById(rec.sessionId)
    : week.plan === 'vol' ? PLAN.sesionDelDia(date, rec.entries, rec.added, rec.removed) : options[0];
  if (!session) { view.appendChild(picker); return; }
  if (!rec.sessionId && !session.rest) Store.setSession(date, session.id);

  const label = PLAN.sessionLabel(session, week);
  document.getElementById('hero-name').textContent = session.rest
    ? 'Descanso' : (label.title || label.name);

  if (session.note) {
    view.appendChild(el(`<div class="card"><p class="multi">${escapeHtml(session.note)}</p></div>`));
  }
  if (session.rest || !session.exercises.length) {
    itemsRodilla(date).forEach((n) => view.appendChild(n));
    if (week.plan === 'vol') view.appendChild(cambiosCard(date, week, session));
    view.appendChild(picker);
    return;
  }

  view.appendChild(el('<div class="section-label">Ejercicios</div>'));
  session.exercises.forEach((exercise) => {
    // «—»: esa semana no se hace (salvo que se haya registrado igualmente).
    if (presHoy(exercise, week, date).skip && !Store.sets(date, exercise.id).length) return;
    view.appendChild(exercise.link === 'test' ? testCard(exercise, week) : exerciseRow(exercise, week, date, session));
  });
  itemsRodilla(date).forEach((n) => view.appendChild(n));
  if (week.plan === 'vol') view.appendChild(cambiosCard(date, week, session));

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

/* --- Cambios desde Hoy: mover el entreno y añadir ejercicios (plan de volumen) ---------- */
const fechaDeLetra = (date, letra) => {
  const d = new Date(date + 'T12:00:00');
  d.setDate(d.getDate() + PLAN.DIAS_PLAN.indexOf(letra) - PLAN.DIAS_PLAN.indexOf(PLAN.letraDe(date)));
  return PLAN.isoDate(d);
};

function abrirSheet(titulo, contenido) {
  document.getElementById('sheet-title').textContent = titulo;
  const box = document.getElementById('sheet-content');
  box.innerHTML = '';
  box.appendChild(contenido);
  sheet.hidden = false;
}

/* Tarjeta al final de Hoy: mover el entreno a otro día de la semana, deshacerlo y añadir
   ejercicios. Lo movido se guarda por semana (Store.setMovido) y lo añadido por día. */
function cambiosCard(date, week, session) {
  const letra = PLAN.letraDe(date);
  const base = PLAN.sesionesBase(week.n)[letra];
  const movidos = PLAN.movidosDe(week.n);
  const dia = (l) => PLAN.NOMBRE_DIA[l].toLowerCase();
  const card = el('<div class="card cambios"><div class="section-label" style="margin:0 0 8px">Cambios de este día</div></div>');
  if (movidos[letra]) {
    card.appendChild(el(`<p class="multi">Lo de este día se hace el ${escapeHtml(dia(movidos[letra]))} (${escapeHtml(shortDate(fechaDeLetra(date, movidos[letra])))}).</p>`));
    const des = el('<button class="btn line">Deshacer el cambio</button>');
    des.addEventListener('click', () => { Store.setMovido(week.n, letra, null); toast('Cambio deshecho'); render(); });
    card.appendChild(des);
  }
  for (const de of Object.keys(movidos).filter((x) => movidos[x] === letra)) {
    const des = el(`<button class="btn line">Devolver lo del ${escapeHtml(dia(de))} a su día</button>`);
    des.addEventListener('click', () => { Store.setMovido(week.n, de, null); toast(`Lo del ${dia(de)} vuelve a su día`); render(); });
    card.appendChild(des);
  }
  const recibe = Object.values(movidos).includes(letra);
  if (!movidos[letra] && !recibe && base && base.exercises.length) {
    const mover = el('<button class="btn ghost">Mover este entreno a otro día</button>');
    mover.addEventListener('click', () => abrirMover(date, week));
    card.appendChild(mover);
  }
  const todos = Object.values(PLAN.BLOCK_VOL).flatMap((s) => s.exercises);
  for (const id of Store.quitados(date)) {
    const x = todos.find((e) => e.id === id);
    if (!x) continue;
    const b = el(`<button class="btn line">Volver a poner «${escapeHtml(x.name)}»</button>`);
    b.addEventListener('click', () => { Store.devolverAlDia(date, id); toast(`«${x.name}» vuelve a este día`); render(); });
    card.appendChild(b);
  }
  const anadir = el('<button class="btn ghost">+ Añadir ejercicio</button>');
  anadir.addEventListener('click', () => abrirAnadir(date, week, session));
  card.appendChild(anadir);
  return card;
}

function abrirMover(date, week) {
  const letra = PLAN.letraDe(date);
  const base = PLAN.sesionesBase(week.n);
  const movidos = PLAN.movidosDe(week.n);
  const box = el(`<div><p class="multi" style="margin:0 0 12px">${escapeHtml(PLAN.NOMBRE_DIA[letra])}: «${escapeHtml(base[letra].title)}». Elige el día de esta semana en que lo haces; se suma a lo que ya tenga ese día.</p></div>`);
  for (const l of PLAN.DIAS_PLAN) {
    if (l === letra || movidos[l]) continue;   // un día ya movido no recibe
    const f = fechaDeLetra(date, l);
    const suya = base[l] && base[l].exercises.length ? base[l].title : 'Sin entreno';
    const b = el(`<button class="ex" data-mover="${l}"><div class="grow"><div class="nm">${escapeHtml(PLAN.NOMBRE_DIA[l])} ${escapeHtml(shortDate(f))}</div>
      <div class="meta">${escapeHtml(suya)}</div></div></button>`);
    b.addEventListener('click', () => {
      Store.setMovido(week.n, letra, l);
      sheet.hidden = true;
      toast(`Movido al ${PLAN.NOMBRE_DIA[l].toLowerCase()}`);
      render();
    });
    box.appendChild(b);
  }
  abrirSheet('Mover el entreno', box);
}

function abrirAnadir(date, week, session) {
  const ya = new Set(session.exercises.map((x) => x.id));
  const lista = PLAN.catalogoAnadir().filter((x) => !ya.has(x.id));
  const grupos = [...new Set(lista.map((x) => x.target))];
  const opciones = grupos.map((g) => `<optgroup label="${escapeHtml(g)}">${lista.filter((x) => x.target === g)
    .map((x) => `<option value="${escapeHtml(x.id)}">${escapeHtml(x.name)}</option>`).join('')}</optgroup>`).join('');
  const objetivos = [...PLAN.VOL_GRUPOS, 'Rehab', 'Otro'];
  const box = el(`
    <div class="anadir">
      <label>Ejercicio
        <select id="an-ej"><option value="">Elige uno…</option><option value="__nuevo">+ Ejercicio nuevo</option>${opciones}</select></label>
      <div id="an-nuevo" hidden>
        <label>Nombre <input id="an-nombre" type="text" autocomplete="off" placeholder="p. ej. Curl araña"></label>
        <label>Grupo muscular <select id="an-grupo">${objetivos.map((g) => `<option>${escapeHtml(g)}</option>`).join('')}</select></label>
      </div>
      <div id="an-pres" hidden>
        <div class="an-fila">
          <label>Series <input id="an-series" inputmode="numeric" placeholder="3"></label>
          <label>Reps <input id="an-reps" inputmode="text" placeholder="8-10"></label>
          <label>RIR <input id="an-rir" inputmode="text" placeholder="1 o 1/0"></label>
        </div>
        <p class="an-ayuda">Sin RIR, las reps quedan fijas. «1/0» = todas a RIR 1 y la última a RIR 0.</p>
      </div>
      <p class="an-ayuda" id="an-plan" hidden></p>
      <button class="btn" id="an-ok" disabled>Añadir a este día</button>
    </div>`);
  const $ = (s) => box.querySelector(s);
  const n = week.n;
  // Con el selector (buscador, grupos y recientes), el desplegable queda oculto y lo maneja él.
  if (typeof Selector !== 'undefined') {
    const sel = $('#an-ej');
    const nombreDe = (id) => (id === '__nuevo' ? '+ Ejercicio nuevo' : (lista.find((x) => x.id === id) || {}).name || 'Elige uno…');
    const recientes = Object.entries(hechos()).sort((a, b) => (a[1] < b[1] ? 1 : -1)).map(([id]) => id).filter((id) => !ya.has(id));
    const elegir = () => Selector.abrir({
      titulo: 'Añadir ejercicio',
      items: lista.map((x) => ({ id: x.id, nombre: x.name, grupo: x.target })),
      recientes,
      actual: sel.value || null,
      extra: { texto: '+ Ejercicio nuevo', onClick: () => elegido('__nuevo') },
      onElegir: (id) => elegido(id),
    });
    const boton = Selector.boton('Elige uno…', elegir);
    boton.id = 'an-boton';
    const elegido = (id) => {
      abrirSheet('Añadir ejercicio', box);   // el selector usó la misma hoja: se vuelve al formulario
      sel.value = id;
      boton.firstChild.textContent = nombreDe(id);
      sel.dispatchEvent(new Event('change'));
    };
    sel.hidden = true;
    sel.parentNode.appendChild(boton);
  }
  $('#an-ej').addEventListener('change', (e) => {
    const id = e.target.value;
    const nuevo = id === '__nuevo';
    const delPlan = nuevo || !id ? null : Object.values(PLAN.BLOCK_VOL).flatMap((s) => s.exercises).find((x) => x.id === id) || null;
    $('#an-nuevo').hidden = !nuevo;
    // Lo del plan esa semana (o, si esa semana no se hace, su primera semana con algo).
    const p = delPlan ? (delPlan.pres[n - 1].skip ? delPlan.pres.find((x) => !x.skip) : delPlan.pres[n - 1]) : null;
    const editable = !!id && (!delPlan || (p && ['rir', 'fixed'].includes(p.kind)));
    $('#an-pres').hidden = !editable;
    $('#an-plan').hidden = !id || editable;
    if (p && !editable) $('#an-plan').textContent = `Se añade como en el plan: ${p.label.replace(/\n/g, ' · ')}.`;
    $('#an-series').value = p && editable ? p.sets : '';
    $('#an-reps').value = p && editable && p.reps !== undefined ? p.reps : '';
    $('#an-rir').value = p && p.kind === 'rir' ? (p.rirs ? '1/0' : p.rir) : '';
    $('#an-ok').disabled = !id;
  });
  $('#an-ok').addEventListener('click', () => {
    let id = $('#an-ej').value;
    const editable = !$('#an-pres').hidden;
    const rirTxt = $('#an-rir').value.trim();
    if (editable && rirTxt && !/^(\d|1\/0)$/.test(rirTxt)) { toast('RIR: un número del 0 al 9, o 1/0'); return; }
    try {
      if (id === '__nuevo') id = Store.crearExtra($('#an-nombre').value, $('#an-grupo').value);
    } catch (err) { toast(err.message === 'Falta el nombre' ? 'Escribe el nombre del ejercicio' : err.message); return; }
    const item = editable
      ? { id, sets: $('#an-series').value.trim() || '1', reps: $('#an-reps').value.trim(), rir: rirTxt }
      : { id, plan: true };
    Store.anadir(date, item);
    sheet.hidden = true;
    const nombre = (PLAN.catalogoAnadir().find((x) => x.id === id) || {}).name || 'Ejercicio';
    toast(`«${nombre}» añadido`);
    render();
  });
  abrirSheet('Añadir ejercicio', box);
}

/* Tareas de rodilla del día como ítems de la lista (js/rodilla.js, itemsHoy). */
function itemsRodilla(date) {
  if (typeof Rodilla === 'undefined' || !Rodilla.itemsHoy) return [];
  const items = Rodilla.itemsHoy(date, () => { if (state.tab === 'today' && !state.exercise) render(); }) || [];
  return items.length ? [el('<div class="section-label">Rodilla</div>'), ...items] : [];
}

function exerciseRow(exercise, week, date, session) {
  const pres = presHoy(exercise, week, date);
  const logged = Store.sets(date, exercise.id).filter(isLogged).length;
  // En los unilaterales (D/I) cada serie prescrita se hace con las dos piernas.
  const total = PLAN.sidesFor(exercise, week) ? pres.sets * 2 : pres.sets;
  const done = total > 0 && logged >= total;

  const row = el(`
    <button class="ex ${typeClass(exercise)} ${done ? 'done' : ''}">
      <div class="grow">
        <div class="nm">${escapeHtml(exercise.name)}</div>
        <div class="meta">${exercise.added ? 'Añadido · ' : ''}${escapeHtml(exercise.target)}${shortNote(exercise.notes) ? ' · ' + escapeHtml(shortNote(exercise.notes)) : ''}</div>
      </div>
      <span class="pres">${logged ? `${logged}/${total}` : escapeHtml(pres.label)}</span>
    </button>`);

  let largo = false;
  pulsacionLarga(row, () => { largo = true; menuEjercicio(exercise, week, date); });
  row.addEventListener('click', () => {
    if (largo) { largo = false; return; }   // la pulsación larga ya abrió el menú
    state.exercise = { sessionId: session.id, exId: exercise.id, date };
    render();
    window.scrollTo(0, 0);
  });
  return row;
}

/* Llama a `fn` si se mantiene pulsado ~0,5 s sin mover el dedo (y con el botón derecho). */
function pulsacionLarga(nodo, fn) {
  let timer = null;
  let x0 = 0;
  let y0 = 0;
  const parar = () => { clearTimeout(timer); timer = null; };
  nodo.addEventListener('pointerdown', (e) => {
    x0 = e.clientX; y0 = e.clientY;
    parar();
    timer = setTimeout(() => { timer = null; if (navigator.vibrate) navigator.vibrate(15); fn(); }, 500);
  });
  nodo.addEventListener('pointermove', (e) => { if (timer && Math.hypot(e.clientX - x0, e.clientY - y0) > 10) parar(); });
  ['pointerup', 'pointercancel', 'pointerleave'].forEach((ev) => nodo.addEventListener(ev, parar));
  nodo.addEventListener('contextmenu', (e) => { e.preventDefault(); if (timer !== null || e.pointerType !== 'touch') { parar(); fn(); } });
}

/* Menú de un ejercicio de Hoy (pulsación larga): quitarlo de ese día o editar sus parámetros. */
function menuEjercicio(exercise, week, date) {
  const box = el('<div class="menu-ej"></div>');
  const quitar = el('<button class="btn line" data-menu="quitar">Quitar de este día</button>');
  quitar.addEventListener('click', () => {
    const n = Store.sets(date, exercise.id).filter(isLogged).length;
    if (n && !confirm(`Se borrarán también sus ${n} series apuntadas. ¿Quitar «${exercise.name}» de este día?`)) return;
    if (exercise.added) Store.quitarAnadido(date, exercise.id);
    else Store.quitarDelDia(date, exercise.id);
    sheet.hidden = true;
    toast(`«${exercise.name}» quitado de este día`);
    render();
  });
  const editar = el('<button class="btn ghost" data-menu="editar">Editar parámetros</button>');
  editar.addEventListener('click', () => {
    sheet.hidden = true;
    abrirEjercicioConfig(exercise.id);
  });
  box.appendChild(quitar);
  box.appendChild(editar);
  abrirSheet(exercise.name, box);
}

/* Plan › Ejercicios con un ejercicio abierto. */
function abrirEjercicioConfig(exId) {
  state.exercise = null;
  state.tab = 'plan';
  state.planVista = 'ejercicios';
  state.ejercicioConf = exId;
  render();
  window.scrollTo(0, 0);
}

/* --- Detalle de ejercicio -------------------------------------------------- */
function renderExercise() {
  const { sessionId, exId, date } = state.exercise;
  const session = sesionDe(date, sessionId);
  const week = PLAN.weekFor(date);
  const exercise = session.exercises.find((e) => e.id === exId);
  const pres = presHoy(exercise, week, date);
  const delPlan = PLAN.presFor(exercise, week);

  titleEl.textContent = exercise.name;
  subtitleEl.textContent = `${exercise.target} · objetivo ${pres.label.replace(/\n/g, ' · ')}`;

  view.innerHTML = '';

  if (pres.kind === 'none') {
    view.appendChild(el(pres.skip ? '<div class="empty">Este ejercicio no se hace esta semana.</div>'
      : pres.motivo ? `<div class="empty">${escapeHtml(pres.motivo)}</div>`   // p. ej., la bici quitada
        : '<div class="empty">Sin series que registrar. Haz tu rutina de movilidad.</div>'));
    return;
  }

  if (pres.label.includes('\n') || pres.optional) {
    view.appendChild(el(`<div class="card"><p class="multi">${escapeHtml(pres.label)}</p></div>`));
  }

  // Con progresión real: por qué este nivel y cuál es el máximo del calendario.
  if (pres.motivo) {
    view.appendChild(el(`
      <div class="card"><p class="multi">${escapeHtml(pres.motivo)}${pres.provisional ? ' (provisional)' : ''}</p>
        <p class="multi" style="margin-top:6px">Máximo del calendario: ${escapeHtml(delPlan.label)}</p></div>`));
  }

  const conf = Ejercicios.config(exercise);
  const fijos = Ejercicios.fijos(exercise);
  if (fijos.length) {
    view.appendChild(el(`<div class="card ref-fija">${fijos.map(([n, v]) =>
      `<div><small>${escapeHtml(n)}</small><b>${escapeHtml(v)}</b></div>`).join('')}</div>`));
  }
  const ajustes = Ejercicios.ajustes(exercise);
  if (ajustes.length) view.appendChild(ajustesCard(exercise, date, ajustes));

  if (exercise.notes) view.appendChild(el(`<div class="card"><p class="multi">${escapeHtml(exercise.notes)}</p></div>`));

  view.appendChild(stopwatch(pres, date, exId, conf.seg.modo === 'serie'));

  const prev = Store.lastPerformance(exId, date);
  if (prev) {
    const summary = prev.sets.filter(isLogged).map((s) => setSummary(s, pres.kind)).join(' · ');
    view.appendChild(el(
      `<div class="prev">Última vez (<b>${escapeHtml(shortDate(prev.date))}</b>): ${escapeHtml(summary || '—')}</div>`));
  }

  const card = el('<div class="card"></div>');
  // Columnas según Plan › Ejercicios (peso, profundidad, reps, segundos, RIR).
  const columnas = Ejercicios.columnas(exercise, pres);
  const cols = columnas.map((c) => c.etiqueta);

  // Unilaterales desde S2: una columna con el botón de pierna (D = derecha, la afectada; I = izquierda).
  const sides = PLAN.sidesFor(exercise, week);
  // Con RIR hay además una columna «1RM» (estimado en vivo) antes del botón de borrar.
  const con1RM = pres.kind === 'rir' && cols.includes('Kg') && cols.includes('Reps');
  // Dominadas y similares: el 1RM suma tu peso de la báscula al lastre (columna Kg).
  const pesoCorp = con1RM && ProgresoCalc.esPesoCorporal(exercise.name);
  if (pesoCorp) {
    const pc = ProgresoCalc.pesoDelDia(Store.pesos(), date);
    view.appendChild(el(pc
      ? `<div class="prev">Kg = lastre. El 1RM suma tu peso de la báscula: <b>${escapeHtml(fmtKg(pc.kg))} kg</b>${pc.fecha === date ? '' : ` (del ${escapeHtml(shortDate(pc.fecha))})`}.</div>`
      : '<div class="prev">Kg = lastre. Sin peso de la báscula de estos días: el 1RM usa solo el lastre. Impórtalo en Datos › Peso corporal.</div>'));
  }
  const grid = (extra) => `grid-template-columns: 30px ${sides ? '44px ' : ''}${'1fr '.repeat(cols.length)}${con1RM ? '52px ' : ''}40px;${extra || ''}`;
  card.appendChild(el(
    `<div class="set-row head${con1RM ? ' con-1rm' : ''}" style="${grid()}">
       <span></span>${sides ? '<span>Lado</span>' : ''}${cols.map((c) => `<span>${c}</span>`).join('')}${con1RM ? '<span>1RM</span>' : ''}<span></span>
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
    const field = Object.fromEntries(columnas.map((c) => [c.etiqueta, c.campo]));
    const esExtra = Object.fromEntries(columnas.map((c) => [c.etiqueta, !!c.extra]));
    const valor = (c) => (esExtra[c] ? ((s.x || {})[field[c]] ?? '') : (s[field[c]] ?? ''));

    const row = el(`
      <div class="set-row${con1RM ? ' con-1rm' : ''}" style="${grid()}">
        <span class="n">${index + 1}</span>
        ${sides ? `<button class="side ${s.side === 'I' ? 'i' : s.side === 'D' ? 'd' : ''}"
                           aria-label="Pierna de la serie ${index + 1}">${s.side || '–'}</button>` : ''}
        ${cols.map((c) => `
          <input inputmode="decimal" enterkeyhint="next"
                 data-f="${escapeHtml(field[c])}" ${esExtra[c] ? 'data-x="1"' : ''} value="${escapeHtml(String(valor(c)))}"
                 placeholder="${escapeHtml(String(placeholder[c] ?? ''))}"
                 aria-label="${c} serie ${index + 1}">`).join('')}
        ${con1RM ? `<span class="e1rm" aria-live="off" aria-label="1RM estimado serie ${index + 1}"
                          title="1RM estimado serie ${index + 1}"></span>` : ''}
        <button class="del" aria-label="Borrar serie ${index + 1}">×</button>
      </div>`);

    // Repinta solo esta celda: volver a renderizar la vista quitaría el foco al teclear.
    const e1rm = row.querySelector('.e1rm');
    const pintar1RM = () => {
      if (!e1rm) return;
      const carga = ProgresoCalc.cargaSerie(s, pesoCorp, Store.pesos(), date).kg;
      const r = ProgresoCalc.estimar1RM(carga, s.reps, s.rir);
      e1rm.innerHTML = `${escapeHtml(ProgresoCalc.fmt1RM(r))}${r.valor != null && r.sinRir ? '<small>sin RIR</small>' : ''}`;
      e1rm.classList.toggle('vacio', r.valor == null);
    };
    pintar1RM();

    row.querySelectorAll('input').forEach((input) => {
      input.addEventListener('input', (e) => {
        const v = e.target.value.replace(',', '.').trim();
        if (e.target.dataset.x) {
          s.x = { ...(s.x || {}), [e.target.dataset.f]: v };
          if (!v) delete s.x[e.target.dataset.f];
          if (!Object.keys(s.x).length) delete s.x;
        } else s[e.target.dataset.f] = v;
        save();
        pintar1RM();
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
      // Copiamos la carga (y la profundidad) de la serie anterior: casi siempre se repite.
      list.push({ ...blankSet(nextSide), kg: last.kg ?? '', ...(last.x ? { x: { ...last.x } } : {}) });
      state.rows[rowsKey(date, exId)] = list.length;
      save();   // persiste la carga heredada; si va vacía, la mantiene state.rows
      renderExercise();
    });
    view.appendChild(add);
  }

  const back = el('<button class="btn">Hecho</button>');
  back.addEventListener('click', () => { state.exercise = null; render(); });
  view.appendChild(back);

  if (exercise.added) {
    const quitar = el('<button class="btn line">Quitar de este día</button>');
    quitar.addEventListener('click', () => {
      const n = Store.sets(date, exId).filter(isLogged).length;
      if (n && !confirm(`Se borrarán también sus ${n} series apuntadas. ¿Quitar «${exercise.name}» de este día?`)) return;
      Store.quitarAnadido(date, exId);
      state.exercise = null;
      toast(`«${exercise.name}» quitado`);
      render();
    });
    view.appendChild(quitar);
  }
}

/* Posición de la máquina (y profundidad «recuerda») de ese día. Cada campo sale con lo de ese día
   o, si no, con lo último apuntado; al cambiarlo se guarda en el día. */
function ajustesCard(exercise, date, ajustes) {
  const card = el(`<div class="card ajustes"><div class="section-label" style="margin:0 0 8px">Posición de la máquina</div>
    <div class="aj-grid"></div><small class="aj-nota"></small></div>`);
  const grid = card.querySelector('.aj-grid');
  let heredados = 0;
  ajustes.forEach(({ nombre }) => {
    const v = Ejercicios.valorAjuste(exercise, nombre, date);
    if (v.de !== 'hoy') heredados++;
    const f = el(`<label class="aj-campo"><span>${escapeHtml(nombre)}</span>
      <input inputmode="text" value="${escapeHtml(String(v.valor ?? ''))}" aria-label="${escapeHtml(nombre)}"></label>`);
    f.querySelector('input').addEventListener('change', (e) => Store.setAjuste(date, exercise.id, nombre, e.target.value.trim()));
    grid.appendChild(f);
  });
  card.querySelector('.aj-nota').textContent = heredados ? 'Con lo del último día. Cámbialo si hoy es distinto.' : '';
  return card;
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

function stopwatch(pres, date, exId, conSegundos = true) {
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

  if (pres.kind !== 'iso' || !conSegundos) return box;

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

/* --- Plan › Ejercicios: qué muestra cada ejercicio en Hoy (js/ejercicios.js) ---------------- */

/* Todos los ejercicios configurables: los del plan de volumen (sin el test) y los creados. */
function catalogoEjercicios() {
  const vistos = new Set();
  const delPlan = Object.values(PLAN.BLOCK_VOL).flatMap((s) => s.exercises)
    .filter((x) => !x.link && !vistos.has(x.id) && vistos.add(x.id));
  const propios = Object.entries(Store.extras()).map(([id, e]) => ({ id, name: e.name, target: e.target, notes: '', propio: true }));
  return [...delPlan, ...propios];
}

/* Ejercicios con series apuntadas, del más reciente al más antiguo: { id: último día }. */
function hechos() {
  const out = {};
  for (const [f, d] of Object.entries(Store.all().days)) {
    for (const [id, list] of Object.entries(d.entries || {})) {
      if (list.some(isLogged) && (!out[id] || out[id] < f)) out[id] = f;
    }
  }
  return out;
}

/* Resumen de una configuración: «Kg · Reps · RIR | tempo 3-1-3 | asiento, pies». */
function resumenConfig(ex) {
  const c = Ejercicios.config(ex);
  const cols = Ejercicios.columnas(ex, { kind: (ex.target === 'Cardio' ? 'cardio' : '') }).map((x) => x.etiqueta);
  const partes = [cols.join(' · ')];
  if (c.lado) partes.push('D/I');
  Ejercicios.fijos(ex).forEach(([n, v]) => partes.push(`${n.toLowerCase()} ${v}`));
  if (c.posicion.length) partes.push(c.posicion.map((a) => a.nombre.toLowerCase()).join(', '));
  return partes.join(' | ');
}

function renderEjercicios() {
  const cat = catalogoEjercicios();
  if (state.ejercicioConf) {
    const ex = cat.find((x) => x.id === state.ejercicioConf);
    if (ex) { editorEjercicio(ex); return; }
    state.ejercicioConf = null;
  }
  const hechosPor = hechos();
  const lista = state.ejTodos ? cat : cat.filter((x) => hechosPor[x.id]);
  view.appendChild(el(`<div class="card"><p class="multi" style="margin:0">Qué se apunta de cada ejercicio en Hoy y qué se ve como referencia fija (tempo, RIR…). Mantén pulsado un ejercicio en Hoy y elige «Editar parámetros» para venir directo.</p></div>`));

  const buscar = (typeof Selector !== 'undefined') ? Selector.boton('Buscar un ejercicio', () => Selector.abrir({
    titulo: 'Ejercicio',
    items: cat.map((x) => ({ id: x.id, nombre: x.name, grupo: x.target, detalle: hechosPor[x.id] ? `último: ${shortDate(hechosPor[x.id])}` : '' })),
    recientes: Object.entries(hechosPor).sort((a, b) => (a[1] < b[1] ? 1 : -1)).map(([id]) => id),
    onElegir: (id) => { state.ejercicioConf = id; render(); window.scrollTo(0, 0); },
  })) : null;
  if (buscar) view.appendChild(buscar);

  const filtro = el(`<div class="card" style="display:flex;gap:6px;padding:6px">
    <button class="btn ${state.ejTodos ? 'ghost' : ''}" data-ejtodos="0" style="height:40px;margin:0;font-size:14px">Hechos (${Object.keys(hechosPor).filter((id) => cat.some((x) => x.id === id)).length})</button>
    <button class="btn ${state.ejTodos ? '' : 'ghost'}" data-ejtodos="1" style="height:40px;margin:0;font-size:14px">Todos (${cat.length})</button></div>`);
  filtro.querySelectorAll('[data-ejtodos]').forEach((b) => b.addEventListener('click', () => { state.ejTodos = b.dataset.ejtodos === '1'; render(); }));
  view.appendChild(filtro);

  if (!lista.length) {
    view.appendChild(el('<div class="empty">Todavía no hay ejercicios con series apuntadas. Mira «Todos».</div>'));
    return;
  }
  const grupos = [...new Set(lista.map((x) => x.target))];
  grupos.forEach((g) => {
    view.appendChild(el(`<div class="section-label">${escapeHtml(g)}</div>`));
    lista.filter((x) => x.target === g).forEach((x) => {
      const b = el(`<button class="ex ${typeClass(x)}" data-conf="${escapeHtml(x.id)}"><div class="grow">
        <div class="nm">${escapeHtml(x.name)}${Ejercicios.editado(x.id) ? ' <small class="ej-tag">ajustado</small>' : ''}</div>
        <div class="meta">${escapeHtml(resumenConfig(x))}</div></div></button>`);
      b.addEventListener('click', () => { state.ejercicioConf = x.id; render(); window.scrollTo(0, 0); });
      view.appendChild(b);
    });
  });
}

/* Editor de un ejercicio. Cada cambio se guarda al momento (Store.setEjercicio). */
function editorEjercicio(ex) {
  const c = Ejercicios.config(ex);
  const guardar = (cambio, repintar = true) => {
    Store.setEjercicio(ex.id, Ejercicios.normalizar({ ...Ejercicios.config(ex), ...cambio }));
    if (repintar) render();
  };
  const volver = el('<button class="btn line" style="margin-top:0">‹ Todos los ejercicios</button>');
  volver.addEventListener('click', () => { state.ejercicioConf = null; render(); });
  view.appendChild(volver);
  view.appendChild(el(`<div class="card"><h2>${escapeHtml(ex.name)}</h2>
    <p>${escapeHtml(ex.target)}${Ejercicios.editado(ex.id) ? ' · ajustado por ti' : ' · como viene por defecto'}</p>
    <p class="multi ej-prev"><b>En Hoy:</b> ${escapeHtml(resumenConfig(ex))}</p></div>`));

  const card = el('<div class="card ej-editor"></div>');
  for (const prm of Ejercicios.PARAMS) {
    const v = c[prm.k];
    const fila = el(`<div class="ej-param"><div class="ej-titulo">${escapeHtml(prm.nombre)}</div>
      <div class="ej-modos">${prm.modos.map((m) => `<button type="button" data-modo="${m}" class="${v.modo === m ? 'on' : ''}">${escapeHtml(Ejercicios.MODOS[m])}</button>`).join('')}</div></div>`);
    fila.querySelectorAll('[data-modo]').forEach((b) => b.addEventListener('click', () => guardar({ [prm.k]: { ...v, modo: b.dataset.modo } })));
    const conValor = v.modo === 'fijo' || (prm.k === 'prof' && v.modo === 'recuerda');
    if (conValor) {
      const ph = prm.k === 'tempo' ? Ejercicios.TEMPO_DEFECTO : prm.k === 'rir' ? 'p. ej. 2 o D 2 · I 1-2' : prm.k === 'seg' ? 'p. ej. 45 s' : '';
      const inp = el(`<label class="ej-valor"><span>${v.modo === 'recuerda' ? 'Valor de partida' : 'Valor'}</span>
        <input type="text" value="${escapeHtml(v.valor)}" placeholder="${escapeHtml(ph)}"></label>`);
      inp.querySelector('input').addEventListener('change', (e) => guardar({ [prm.k]: { ...v, valor: e.target.value.trim() } }, false));
      fila.appendChild(inp);
    }
    if (prm.k === 'prof' && v.modo === 'serie') {
      const inp = el(`<label class="ej-valor"><span>Columnas (separadas por comas)</span>
        <input type="text" value="${escapeHtml(c.prof.columnas.join(', '))}" placeholder="p. ej. Steps, Discos"></label>`);
      inp.querySelector('input').addEventListener('change', (e) => guardar({ prof: { ...v, columnas: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) } }, false));
      fila.appendChild(inp);
    }
    card.appendChild(fila);
  }
  // Por pierna (D/I).
  const lado = el(`<div class="ej-param"><div class="ej-titulo">Piernas por separado (D / I)</div>
    <div class="ej-modos"><button type="button" data-lado="1" class="${c.lado ? 'on' : ''}">Sí</button>
    <button type="button" data-lado="0" class="${c.lado ? '' : 'on'}">No</button></div></div>`);
  lado.querySelectorAll('[data-lado]').forEach((b) => b.addEventListener('click', () => guardar({ lado: b.dataset.lado === '1' })));
  card.appendChild(lado);
  view.appendChild(card);

  // Posición de la máquina: ajustes con nombre que en Hoy salen con el último valor.
  const pos = el(`<div class="card ej-editor"><div class="ej-titulo">Posición de la máquina</div>
    <p class="multi" style="margin:4px 0 8px;color:var(--muted)">En Hoy salen con lo del último día; el valor de aquí es el de partida.</p>
    <div class="ej-pos"></div></div>`);
  const box = pos.querySelector('.ej-pos');
  c.posicion.forEach((a, i) => {
    const f = el(`<div class="ej-pos-fila"><input type="text" data-p="nombre" value="${escapeHtml(a.nombre)}" aria-label="Ajuste">
      <input type="text" data-p="valor" value="${escapeHtml(a.valor)}" aria-label="Valor de ${escapeHtml(a.nombre)}">
      <button type="button" class="del" aria-label="Quitar ${escapeHtml(a.nombre)}">×</button></div>`);
    f.querySelectorAll('input').forEach((inp) => inp.addEventListener('change', () => {
      const lista = c.posicion.map((x, j) => (j === i ? { ...x, [inp.dataset.p]: inp.value.trim() } : x)).filter((x) => x.nombre);
      guardar({ posicion: lista }, false);
    }));
    f.querySelector('.del').addEventListener('click', () => guardar({ posicion: c.posicion.filter((_, j) => j !== i) }));
    box.appendChild(f);
  });
  const nuevo = el(`<div class="ej-pos-fila"><input type="text" data-nuevo placeholder="Nuevo ajuste (p. ej. Asiento)" aria-label="Nuevo ajuste">
    <input type="text" data-nuevo-valor placeholder="Valor" aria-label="Valor del nuevo ajuste"><button type="button" class="add" aria-label="Añadir ajuste">+</button></div>`);
  nuevo.querySelector('.add').addEventListener('click', () => {
    const nombre = nuevo.querySelector('[data-nuevo]').value.trim();
    if (!nombre) { toast('Escribe el nombre del ajuste'); return; }
    guardar({ posicion: [...c.posicion, { nombre, valor: nuevo.querySelector('[data-nuevo-valor]').value.trim() }] });
  });
  box.appendChild(nuevo);
  view.appendChild(pos);

  if (Ejercicios.editado(ex.id)) {
    const reset = el('<button class="btn line">Volver a lo de por defecto</button>');
    reset.addEventListener('click', () => {
      if (!confirm(`¿Volver a la configuración de partida de «${ex.name}»?`)) return;
      Store.setEjercicio(ex.id, null);
      render();
    });
    view.appendChild(reset);
  }
  if (ex.notes) view.appendChild(el(`<div class="card"><p class="multi">${escapeHtml(ex.notes)}</p></div>`));
}

/* --- Plan ------------------------------------------------------------------ */

/* Interruptor «Semana sin viernes» de una semana del plan de volumen (ver js/plan.js). */
function sinViernesCard(week) {
  const on = PLAN.sinViernes(week.n);
  const card = el(`
    <div class="card sinv">
      <div style="display:flex;align-items:center;gap:12px">
        <div class="grow" style="flex:1">
          <h2 style="margin:0">Semana sin viernes</h2>
          <p style="margin-top:4px">${on
    ? 'Activada: pierna 2 el jueves, pull el miércoles tras la carrera y el pull-in del lunes al miércoles. El viernes, libre.'
    : 'Si el viernes no puedes entrenar: pierna 2 al jueves, pull al miércoles (tras la carrera) y el pull-in del lunes al miércoles.'}</p>
        </div>
        <button type="button" role="switch" aria-checked="${on}" aria-label="Semana sin viernes"
                class="btn ${on ? '' : 'line'}" style="width:auto;flex-shrink:0;height:40px;margin:0;padding:0 16px;font-size:14px">${on ? 'Activada' : 'Activar'}</button>
      </div>
    </div>`);
  card.querySelector('button').addEventListener('click', () => {
    Store.setSinViernes(week.n, !on);
    toast(on ? `S${week.n}: vuelve el viernes` : `S${week.n}: semana sin viernes`);
    render();
  });
  return card;
}

function renderPlan() {
  const plan = PLAN.planById(state.planId) || PLAN.planFor(state.date);
  const current = PLAN.weekFor(state.date);
  const weekN = state.planWeek || (current && current.plan === plan.id ? current.n : 1);

  titleEl.textContent = 'Plan';
  subtitleEl.textContent = `${plan.name} · ${plan.range}`;
  view.innerHTML = '';

  // Plan › Semanas | Ejercicios.
  const vistas = el(`<div class="card" style="display:flex;gap:6px;padding:6px">
    <button class="btn ${state.planVista === 'ejercicios' ? 'ghost' : ''}" data-vista="semana" style="height:40px;margin:0;font-size:14px">Semanas</button>
    <button class="btn ${state.planVista === 'ejercicios' ? '' : 'ghost'}" data-vista="ejercicios" style="height:40px;margin:0;font-size:14px">Ejercicios</button></div>`);
  vistas.querySelectorAll('[data-vista]').forEach((b) => b.addEventListener('click', () => {
    state.planVista = b.dataset.vista;
    state.ejercicioConf = null;
    render();
  }));
  view.appendChild(vistas);
  if (state.planVista === 'ejercicios') {
    subtitleEl.textContent = 'Ejercicios · qué se apunta en Hoy';
    renderEjercicios();
    return;
  }

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
      ${week.plan === 'vol' && week.n >= 2 ? `<p style="margin-top:6px">Rehab y carrera: el plan marca el
        máximo de la semana; lo que toca según tu progreso está en Hoy y en Rodilla › Progresión.</p>` : ''}
    </div>`));

  if (week.plan === 'vol' && PLAN.admiteSinViernes(week.n)) view.appendChild(sinViernesCard(week));

  if (week.plan === 'vol') {
    const hitos = hitosCard(week);
    if (hitos) view.appendChild(hitos);
    const reglas = el('<button class="btn line" style="margin:0 0 10px">Reglas del bloque</button>');
    reglas.addEventListener('click', () => Reglas.open());
    view.appendChild(reglas);
  }

  PLAN.sessionsFor(week).forEach((session) => {
    view.appendChild(el(`<div class="section-label">${escapeHtml(sessionName(PLAN.sessionLabel(session, week)))}</div>`));
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

  renderPesoCorporal();

  if (days.length) {
    view.appendChild(el('<div class="section-label">Historial</div>'));
    days.sort().reverse().forEach((d) => {
      const rec = data.days[d];
      const session = sesionDe(d, rec.sessionId);
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

/* Peso corporal (Datos): copia de los pesajes de la app Báscula, para el 1RM de las dominadas. */
const fmtKg = (kg) => kg.toLocaleString('es-ES', { maximumFractionDigits: 2 });

function renderPesoCorporal() {
  Store.sincronizarBascula();
  const pesos = Store.pesos();
  const dias = Object.keys(pesos).sort();
  const ultimo = dias[dias.length - 1];
  view.appendChild(el('<div class="section-label">Peso corporal</div>'));
  view.appendChild(el(`
    <div class="card"><p>${dias.length
      ? `${dias.length} ${dias.length === 1 ? 'día' : 'días'} con peso · último <b>${escapeHtml(fmtKg(pesos[ultimo]))} kg</b> (${escapeHtml(shortDate(ultimo))}).`
      : 'Aún no hay pesos.'}
      Se usan en el 1RM de las dominadas (peso + lastre). Si la báscula está en este mismo
      navegador se leen solos; si no, en la báscula pulsa <b>Copia de seguridad</b> y aquí
      carga el archivo o pega el texto.</p></div>`));

  const fileBtn = el('<button class="btn line">Cargar copia de la báscula</button>');
  const picker = el('<input type="file" accept="application/json,.json,text/plain,.txt" hidden>');
  const importar = (texto) => {
    try {
      const r = Store.importarBascula(texto);
      toast(`${r.dias} ${r.dias === 1 ? 'día' : 'días'} con peso (${r.cambiados} ${r.cambiados === 1 ? 'nuevo' : 'nuevos'})`);
      render();
    } catch (e) {
      toast('No es una copia de la báscula');
    }
  };
  fileBtn.addEventListener('click', () => picker.click());
  picker.addEventListener('change', async () => {
    const file = picker.files[0];
    if (file) importar(await file.text());
    picker.value = '';
  });
  const pegar = el(`
    <details class="card pegar-bascula"><summary>Pegar el texto de la copia</summary>
      <textarea rows="4" placeholder='{"formato":"bascula-ilteco", …}' aria-label="Texto de la copia de la báscula"></textarea>
      <button class="btn line">Importar texto</button></details>`);
  pegar.querySelector('button').addEventListener('click', () => importar(pegar.querySelector('textarea').value));
  view.appendChild(fileBtn);
  view.appendChild(picker);
  view.appendChild(pegar);
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
  // Al volver a la app, recoge los pesajes nuevos de la báscula (si comparte navegador).
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && Store.sincronizarBascula() && !state.exercise
      && (state.tab === 'progress' || state.tab === 'data')) render();
  });
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => { /* sin offline, pero funciona */ });
  }
});
