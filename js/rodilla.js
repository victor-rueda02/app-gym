/* Pestaña «Rodilla» y tarjeta de la pantalla Hoy.
   Contrato (global `Rodilla`, usa los helpers de app.js: `view`, `titleEl`,
   `subtitleEl`, `el`, `escapeHtml`, `toast`, `render`, `state`, `fmtDate`, `shortDate`):
   - `Rodilla.render()`: pinta la pestaña (data-tab="knee") en `#view`.
   - `Rodilla.todayCard(date)`: tarjeta de rodilla de Hoy, o null fuera del 26/10–27/12.
   - `Rodilla.abrir(sec, fecha)`: lleva a la pestaña, en esa sección (y día).
   - `Rodilla.prescripcion(exercise, week)`: prescripción con el nivel real para los
     ejercicios con `prog` (prensa, sentadilla, búlgara, touchdown, carrera), o null.
   - `Rodilla.nivelesReales()`: { S2: { runLevel, depthStep } … } de las semanas ya
     empezadas, para la exportación.
   El registro vive en `Store.knee()` y se escribe con `Store.setKnee()` al teclear.
   Todos los cálculos están en js/rodilla-calc.js; aquí solo se pinta y se guarda. */

const Rodilla = (() => {
  const D = RODILLA_DATA;
  const C = RodillaCalc;

  // Estado de la interfaz (no se guarda): sección, día abierto y último state.date visto.
  const st = { sec: 'dia', fecha: null, vistaDe: null };

  const SECCIONES = [
    ['dia', 'Día'], ['registro', 'Registro'], ['resumen', 'Resumen'],
    ['progresion', 'Progresión'], ['entrada', 'Entrada'], ['test', 'Test'], ['escalones', 'Escalones'],
  ];

  // Entradas validadas: [validador, mensaje de error]
  const VALIDOS = {
    e010: [C.entero010, 'Escribe un entero de 0 a 10'],
    reps: [C.enteroPositivo, 'Escribe un entero (0 o más)'],
    carga: [C.decimalPositivo, 'Escribe un número en kg (0 o más)'],
  };

  const esc = (s) => escapeHtml(s);   // app.js se carga después: no leer sus globales al cargar
  const fmt = (v) => (v === '' || v === undefined || v === null ? '—' : String(v).replace('.', ','));
  const val = (v) => (v === undefined || v === null ? '' : esc(String(v).replace('.', ',')));
  const knee = () => Store.knee();
  const hoy = () => PLAN.isoDate(new Date());
  const tabla = () => C.tablaDias(D.dias, knee().days);
  const fila = (fecha) => tabla().find((f) => f.fecha === fecha);
  const prog = () => C.progresion(tabla(), PLAN, knee().weeks, knee().entry, hoy());
  const enRango = (f) => f >= D.desde && f <= D.hasta;
  const clamp = (f) => (f < D.desde ? D.desde : f > D.hasta ? D.hasta : f);
  const texto = (t) => (typeof Reglas !== 'undefined' && Reglas.marcarEtiquetas ? Reglas.marcarEtiquetas(t) : esc(t));

  // Semáforo: verde Avanzar, ámbar Mantener, rojo Retroceder; el resto, neutro.
  const claseSemaforo = (s) => ({ Avanzar: 'ok', Mantener: 'warn', Retroceder: 'bad' }[s] || 'none');
  const claseSiNo = (c) => (c === 'Sí' ? 'ok' : c === 'No' ? 'bad' : 'none');
  const nombreCarrera = (n) => (n ? `N${n} · ${PLAN.CARRERA_NIVELES[n]}` : 'Sin entrar');
  const nombrePrensa = (n) => `x${PLAN.PRENSA_NIVELES[n].reps} · escalón ${PLAN.PRENSA_NIVELES[n].esc}`;

  /* Guardado ------------------------------------------------------------- */
  /* Un campo de entrada lleva data-sec/key/f (+ data-kind). Devuelve false si el
     valor no es válido (no se guarda y se marca en rojo). */
  function guardarCampo(t) {
    const { sec, key, f } = t.dataset;
    let v = t.value;
    const kind = t.dataset.kind;
    const bloque = t.closest('.rod-f');
    const err = bloque && bloque.querySelector('.rod-err');
    if (VALIDOS[kind]) {
      const r = VALIDOS[kind][0](v);
      const mal = r === null;
      t.classList.toggle('rod-bad', mal);
      if (err) { err.textContent = mal ? VALIDOS[kind][1] : ''; err.hidden = !mal; }
      if (mal) return false;
      v = r;
    }
    if (t.dataset.num === '1') v = v === '' ? undefined : Number(v);   // selects de nivel
    if (v === '' && t.dataset.keep !== '1') v = undefined;   // vacío = sin dato
    Store.setKnee(sec, key, f, v);
    return true;
  }

  /* Enlaza los campos de `root`; `refrescar` repinta los calculados sin tocar los campos. */
  function enlazar(root, refrescar) {
    const campo = (e) => e.target.closest('[data-sec]');
    root.addEventListener('input', (e) => {
      const t = campo(e);
      if (!t || t.tagName === 'SELECT' || !t.matches('input,textarea')) return;
      if (guardarCampo(t)) refrescar();
    });
    root.addEventListener('change', (e) => {
      const t = campo(e);
      if (t && t.tagName === 'SELECT' && guardarCampo(t)) refrescar();
    });
    root.addEventListener('click', (e) => {
      const seg = e.target.closest('[data-seg]');
      if (seg) {
        const g = seg.closest('[data-sec]');
        const v = seg.dataset.seg;
        Store.setKnee(g.dataset.sec, g.dataset.key, g.dataset.f, v === '' ? undefined : v);
        g.querySelectorAll('[data-seg]').forEach((b) => b.classList.toggle('on', b === seg));
        refrescar();
        return;
      }
      const plan = e.target.closest('[data-plan]');
      if (plan) {   // volver al valor del plan: borra el override y repinta el editor
        Store.setKnee('days', st.fecha, plan.dataset.plan, undefined);
        Rodilla.render();
      }
    });
  }

  /* Piezas de HTML ------------------------------------------------------- */
  const campoTxt = (label, sec, key, f, v, o = {}) => `
    <label class="rod-f${o.cls ? ' ' + o.cls : ''}"><span>${esc(label)}</span>
      <input type="text" ${o.num ? `inputmode="${o.num}"` : ''} autocomplete="off" enterkeyhint="next"
        data-sec="${sec}" data-key="${esc(key)}" data-f="${f}" ${o.kind ? `data-kind="${o.kind}"` : ''}
        ${o.keep ? 'data-keep="1"' : ''} value="${val(v)}" ${o.ph ? `placeholder="${esc(o.ph)}"` : ''}>
      <em class="rod-err" hidden></em></label>`;

  const notas = (sec, key, v, label = 'Notas') => `
    <label class="rod-f"><span>${esc(label)}</span>
      <textarea data-sec="${sec}" data-key="${esc(key)}" data-f="notes" rows="2">${esc(v || '')}</textarea></label>`;

  const segSiNo = (label, sec, key, f, v) => `
    <div class="rod-f"><span>${esc(label)}</span>
      <div class="rod-seg" data-sec="${sec}" data-key="${esc(key)}" data-f="${f}">
        <button type="button" data-seg="Sí" class="${v === 'Sí' ? 'on' : ''}">Sí</button>
        <button type="button" data-seg="No" class="${v === 'No' ? 'on' : ''}">No</button>
        <button type="button" data-seg="" class="${!v ? 'on' : ''}">—</button>
      </div></div>`;

  /* Pinta los calculados del día en `root` (elementos [data-out]). */
  function pintarDia(root, fecha) {
    const f = fila(fecha);
    const reg = knee().days[fecha] || {};
    root.querySelectorAll('[data-out]').forEach((n) => {
      const k = n.dataset.out;
      n.textContent = fmt(f[k]);
      if (k === 'semaforo') n.className = `rod-big rod-${claseSemaforo(f.semaforo)}`;
    });
    root.querySelectorAll('[data-carrera]').forEach((n) => { n.hidden = f.rule !== C.REGLA_CARRERA; });
    root.querySelectorAll('[data-sincarga]').forEach((n) => { n.hidden = f.rule !== C.SIN_REGLA; });
    root.querySelectorAll('[data-plan]').forEach((n) => { n.hidden = reg[n.dataset.plan] === undefined; });
  }

  function barraSecciones() {
    return `<div class="rod-tabs">${SECCIONES.map(([k, n]) =>
      `<button type="button" data-sec-btn="${k}" class="${st.sec === k ? 'on' : ''}">${n}</button>`).join('')}</div>`;
  }

  /* Secciones ------------------------------------------------------------ */
  function seccionDia(root) {
    const plan = D.dias.find((d) => d.fecha === st.fecha);
    const i = D.dias.indexOf(plan);
    const reg = knee().days[st.fecha] || {};
    const f = fila(st.fecha);
    subtitleEl.textContent = `${plan.sem} · ${shortDate(st.fecha)}`;
    const reglas = Object.values(D.reglas);
    const planBtn = (campo) => `<button type="button" class="rod-plan" data-plan="${campo}" hidden>Volver al plan</button>`;
    root.appendChild(el(`
      <div>
        <div class="rod-nav">
          <button type="button" data-ir="-1" aria-label="Día anterior" ${i === 0 ? 'disabled' : ''}>‹</button>
          <div class="rod-nav-t"><b>${esc(fmtDate(st.fecha))}</b><small>${plan.dia} · ${plan.sem}</small></div>
          <button type="button" data-ir="1" aria-label="Día siguiente" ${i === D.dias.length - 1 ? 'disabled' : ''}>›</button>
        </div>
        <div class="card">
          <h2>Plan del día</h2>
          ${campoTxt('Sesión (plan)', 'days', st.fecha, 'session', f.session, { keep: true })}
          <div class="rod-f"><span>Regla</span>
            <select data-sec="days" data-key="${st.fecha}" data-f="rule" data-keep="1">
              ${reglas.map((r) => `<option ${r === f.rule ? 'selected' : ''}>${esc(r)}</option>`).join('')}
            </select>${planBtn('rule')}</div>
          ${campoTxt('Novedad del día (plan)', 'days', st.fecha, 'novelty', f.novelty, { keep: true })}
          <div class="rod-plans">${planBtn('session')}${planBtn('novelty')}</div>
        </div>
        <div class="card">
          <h2>Mañana</h2><p>En casa, antes de nada (0-10).</p>
          <div class="rod-grid2">
            ${campoTxt('Declive (0-10)', 'days', st.fecha, 'decline', reg.decline, { num: 'numeric', kind: 'e010' })}
            ${campoTxt('10 subidas D (0-10)', 'days', st.fecha, 'steps', reg.steps, { num: 'numeric', kind: 'e010' })}
          </div>
        </div>
        <div class="card">
          <h2>Después de la sesión</h2>
          <p data-sincarga>Día sin carga de rodilla: el semáforo no se evalúa.</p>
          ${campoTxt('Durante (0-10)', 'days', st.fecha, 'during', reg.during, { num: 'numeric', kind: 'e010' })}
          <div data-carrera>${segSiNo('Nivel previo en ≤60 min (carrera)', 'days', st.fecha, 'back60', reg.back60)}</div>
          ${segSiNo('Chasquido doloroso', 'days', st.fecha, 'click', reg.click)}
          ${notas('days', st.fecha, reg.notes)}
        </div>
        <div class="card rod-calc">
          <h2>Calculado</h2>
          <div class="rod-grid4">
            <div><small>Molestia mañana</small><b data-out="morning"></b></div>
            <div><small>24 h</small><b data-out="h24"></b></div>
            <div><small>48 h</small><b data-out="h48"></b></div>
            <div><small>Peor 24-48 h</small><b data-out="worst"></b></div>
          </div>
          <div class="rod-cumple"><small>Semáforo</small><b data-out="semaforo"></b></div>
        </div>
        <details class="card rod-help"><summary>Cómo se rellena</summary>
          <p class="rod-txt">${esc(D.textos.ayuda)}</p></details>
      </div>`));
    const raiz = root.firstElementChild;
    raiz.querySelectorAll('[data-ir]').forEach((b) => b.addEventListener('click', () => {
      st.fecha = D.dias[i + Number(b.dataset.ir)].fecha;
      Rodilla.render();
      window.scrollTo(0, 0);
    }));
    pintarDia(raiz, st.fecha);
    enlazar(raiz, () => pintarDia(raiz, st.fecha));
  }

  function seccionRegistro(root) {
    subtitleEl.textContent = 'Registro diario';
    const filas = tabla();
    const res = C.resumenes(filas, D.semanas);
    for (const sem of D.semanas) {
      const r = res.find((x) => x.sem === sem);
      root.appendChild(el(`<div class="section-label">${sem} · media ${fmt(r.media)}</div>`));
      filas.filter((x) => x.sem === sem).forEach((x) => {
        const b = el(`
          <button type="button" class="ex rod-row${x.fecha === state.date ? ' hoy' : ''}" data-f="${x.fecha}">
            <div class="grow"><div class="nm">${x.dia} ${esc(shortDate(x.fecha))}</div>
              <div class="meta">${esc(x.session)}</div></div>
            <div class="rod-cols"><small>Mañ.</small><b>${fmt(x.morning)}</b></div>
            <div class="rod-cols"><small>Dur.</small><b>${fmt(x.during)}</b></div>
            <div class="rod-cols rod-w"><small>Semáforo</small><b class="rod-${claseSemaforo(x.semaforo)}">${esc(x.semaforo || '—')}</b></div>
          </button>`);
        b.addEventListener('click', () => { st.fecha = x.fecha; st.sec = 'dia'; Rodilla.render(); window.scrollTo(0, 0); });
        root.appendChild(b);
      });
    }
  }

  function bannerAvisos(filas) {
    const p = prog();
    const c = C.avisoChasquido(filas);
    const aviso = (clase, titulo, txt) => `<div class="card rod-aviso rod-a-${clase}"><h2>${titulo}</h2><p>${esc(txt)}</p></div>`;
    return aviso(p.s2.nivel, 'S2 · semana de referencia', p.s2.texto)
      + aviso(p.s4.nivel, 'Aviso S4 (fisio)', p.s4.texto)
      + aviso(c.activo ? 'peor' : 'sin', 'Chasquido doloroso', c.texto)
      + p.brotes.map((b) => aviso('peor', 'Brote',
        `${shortDate(b.fecha)}: ${b.motivo}. 48-72 h solo isométricos (sentadilla española 5×45 s diaria), y la bici si ya estaba introducida; luego, un escalón por debajo en todo.`)).join('');
  }

  function seccionResumen(root) {
    subtitleEl.textContent = 'Resumen semanal';
    const filas = tabla();
    const res = C.resumenes(filas, D.semanas);
    const w = knee().weeks;
    root.appendChild(el(`<div>${bannerAvisos(filas)}
      <p class="rod-txt rod-nota">${texto(D.textos.resumen)}</p></div>`));
    for (const r of res) {
      root.appendChild(el(`
        <div class="card"><h2>${r.sem}</h2>
          <div class="rod-grid4">
            <div><small>Media</small><b>${fmt(r.media)}</b></div>
            <div><small>Peor mañana</small><b>${fmt(r.peor)}</b></div>
            <div><small>A retroceder</small><b>${r.retroceder}</b></div>
            <div><small>Chasquidos</small><b>${r.chasquidos}</b></div>
          </div>
          ${notas('weeks', r.sem, (w[r.sem] || {}).notes)}
        </div>`));
    }
    enlazar(root, () => {});   // las notas no alteran ningún cálculo
  }

  /* Progresión: por semana, el máximo del calendario, la propuesta del semáforo y el
     nivel real (si haces otra cosa, se apunta aquí y manda sobre la propuesta). */
  function seccionProgresion(root) {
    subtitleEl.textContent = 'Progresión real';
    const p = prog();
    const w = knee().weeks;
    root.appendChild(el(`<div>${bannerAvisos(tabla())}
      <p class="rod-txt rod-nota">El calendario marca el máximo de cada semana. La propuesta sale del semáforo: Avanzar = nivel +1, Mantener = el mismo, Retroceder = nivel −1. Si haces otra cosa, elige el nivel real: manda sobre la propuesta y las semanas siguientes parten de él.</p></div>`));
    const sems = Object.keys(p.semanas);
    if (!sems.length) root.appendChild(el('<div class="empty">La progresión empieza en S2 (26/10).</div>'));
    const opciones = (sem, f, n, nombre, desde) => `
      <select data-sec="weeks" data-key="${sem}" data-f="${f}" data-num="1">
        <option value="" ${(w[sem] || {})[f] === undefined ? 'selected' : ''}>Propuesta (${esc(nombre(n.propuesta))})</option>
        ${Array.from({ length: (f === 'pressLevel' ? PLAN.PRENSA_NIVELES.length : 7) - desde }, (_, i) => i + desde)
          .map((k) => `<option value="${k}" ${(w[sem] || {})[f] === k ? 'selected' : ''}>${esc(nombre(k))}</option>`).join('')}
      </select>`;
    for (const sem of sems) {
      const { prensa, carrera, domingo } = p.semanas[sem];
      const provisional = (x) => (x.provisional ? ' <small class="rod-none">(provisional)</small>' : '');
      root.appendChild(el(`
        <div class="card rod-prog"><h2>${sem}</h2>
          <div class="rod-prog-l"><b>Prensa (lunes)${provisional(prensa)}</b>
            <div class="rod-prog-g"><small>Máximo</small><span>${esc(nombrePrensa(prensa.plan))}</span>
              <small>Propuesta</small><span>${esc(nombrePrensa(prensa.propuesta))}</span></div>
            <p class="rod-txt">${esc(prensa.motivo)}</p>
            <label class="rod-f"><span>Nivel real</span>${opciones(sem, 'pressLevel', prensa, nombrePrensa, 0)}</label>
          </div>
          <div class="rod-prog-l"><b>Carrera (miércoles)${provisional(carrera)}</b>
            <div class="rod-prog-g"><small>Máximo</small><span>${esc(nombreCarrera(carrera.plan))}</span>
              <small>Propuesta</small><span>${esc(nombreCarrera(carrera.propuesta))}</span>
              <small>Domingo</small><span>${esc(domingo.nivel ? nombreCarrera(domingo.nivel) : 'No se corre')}</span></div>
            <p class="rod-txt">${esc(carrera.motivo)} · Domingo: ${esc(domingo.motivo)}</p>
            <label class="rod-f"><span>Nivel real</span>${opciones(sem, 'runLevel', carrera, nombreCarrera, 0)}</label>
          </div>
        </div>`));
    }
    enlazar(root, () => { Rodilla.render(); });
  }

  /* Entrada a la carrera: una tarjeta por semana mientras no se haya superado. */
  function seccionEntrada(root) {
    subtitleEl.textContent = 'Entrada a la carrera';
    root.appendChild(el(`<div class="rod-titulo">${esc(D.titulos.entrada)}</div>`));
    const p = prog();
    // Semanas ya empezadas en las que aún no se había entrado a correr.
    const intentos = Object.entries(p.semanas).filter(([, s]) => s.carrera.entrada && s.lunes <= hoy());
    if (!intentos.length) {
      root.appendChild(el('<div class="empty">La entrada a la carrera ya está superada, o aún no ha empezado S2.</div>'));
      return;
    }
    const [c1, c2, c3] = D.entrada;
    for (const [sem] of intentos) {
      const r = knee().entry[sem] || {};
      const card = el(`
        <div class="card" data-entrada="${sem}"><h2>${sem}</h2>
          <p class="rod-crit">1. ${esc(c1.texto)}</p><small class="rod-dia">${esc(c1.dia)}</small>
          <div class="rod-grid2">
            ${segSiNo('≤2/10 durante', 'entry', sem, 'walkPain', r.walkPain)}
            ${segSiNo('Nivel previo en ≤60 min', 'entry', sem, 'walkBack60', r.walkBack60)}
          </div>
          <div class="rod-grid2 rod-calc">
            <div><small>Miércoles por la mañana no peor (24 h)</small><b data-e="manana"></b></div>
            <div><small>Criterio 1</small><b data-e="c1"></b></div>
          </div>
          <p class="rod-crit">2. ${esc(c2.texto)}</p><small class="rod-dia">${esc(c2.dia)}</small>
          ${segSiNo('≤2/10', 'entry', sem, 'tdPain', r.tdPain)}
          <p class="rod-crit">3. ${esc(c3.texto)}</p><small class="rod-dia">${esc(c3.dia)}</small>
          ${segSiNo('≤2/10', 'entry', sem, 'hopsPain', r.hopsPain)}
          ${notas('entry', sem, r.notes)}
          <div class="rod-res"><small>Resultado</small><b data-e="texto"></b></div>
        </div>`);
      const pintar = () => {
        const e = C.entradaSemana(tabla(), sem, knee().entry[sem]);
        card.querySelectorAll('[data-e]').forEach((n) => {
          const k = n.dataset.e;
          n.textContent = k === 'texto' ? e.texto : fmt(e[k]);   // el texto lleva «1.ª»: sin formato numérico
          n.className = k === 'texto' ? `rod-${e.estado === 'si' ? 'ok' : e.estado === 'no' ? 'bad' : 'none'}` : `rod-${claseSiNo(e[k])}`;
        });
      };
      pintar();
      enlazar(card, pintar);
      root.appendChild(card);
    }
  }

  function seccionTest(root) {
    subtitleEl.textContent = 'Test de fuerza';
    root.appendChild(el(`<div class="rod-titulo">${esc(D.titulos.fuerza)}</div>`));
    D.tests.forEach((t) => {
      const r = knee().tests[t.clave] || {};
      root.appendChild(el(`
        <div class="card" data-test="${t.clave}"><h2>${esc(t.nombre)}</h2>
          <p>${esc(fmtDate(t.fecha))} · ${esc(t.rango)}</p>
          <div class="rod-grid3">
            ${campoTxt('Carga (kg)', 'tests', t.clave, 'load', r.load, { num: 'decimal', kind: 'carga' })}
            ${campoTxt('Reps D', 'tests', t.clave, 'repsD', r.repsD, { num: 'numeric', kind: 'reps' })}
            ${campoTxt('Reps I', 'tests', t.clave, 'repsI', r.repsI, { num: 'numeric', kind: 'reps' })}
          </div>
          <div class="rod-grid4">
            <div><small>Fuerza est. D</small><b data-o="estD"></b></div>
            <div><small>Fuerza est. I</small><b data-o="estI"></b></div>
            <div><small>Simetría D/I</small><b data-o="pct"></b></div>
            <div><small>¿≥90%?</small><b data-o="ok"></b></div>
          </div>
          ${notas('tests', t.clave, r.notes)}
        </div>`));
    });
    root.appendChild(el(`<p class="rod-txt rod-nota">${texto(D.textos.fuerza)}</p>`));
    const pintar = () => {
      root.querySelectorAll('[data-test]').forEach((card) => {
        const r = C.calcularTest(knee().tests[card.dataset.test]);
        card.querySelectorAll('[data-o]').forEach((n) => {
          const k = n.dataset.o;
          n.textContent = k === 'pct' ? (r.pct === '' ? '—' : `${fmt(r.pct)} %`) : fmt(r[k]);
          if (k === 'ok') n.className = `rod-${claseSiNo(r.ok)}`;
        });
      });
    };
    pintar();
    enlazar(root, pintar);
  }

  const CAMPOS_ESCALON = [['angle', 'Ángulo aprox. de rodilla (opcional)'], ['press', 'Prensa (marca)'],
    ['box', 'Cajón / pines'], ['split', 'Búlgara (apoyo)'], ['touchdown', 'Touchdown (plataforma)'], ['validated', 'Validado en']];

  function seccionEscalones(root) {
    subtitleEl.textContent = 'Escalones de profundidad';
    root.appendChild(el(`<div class="rod-titulo">${esc(D.titulos.escalones)}</div>`));
    D.escalones.forEach((s) => {
      const r = knee().depth[s.clave] || {};
      root.appendChild(el(`
        <div class="card"><h2>Escalón ${esc(s.nombre)}</h2>
          <div class="rod-grid2">${CAMPOS_ESCALON.map(([f, l]) => campoTxt(l, 'depth', s.clave, f, r[f])).join('')}</div>
          ${notas('depth', s.clave, r.notes)}
        </div>`));
    });
    root.appendChild(el(`<p class="rod-txt rod-nota">${texto(D.textos.escalones)}</p>`));
    enlazar(root, () => {});
  }

  /* Pública -------------------------------------------------------------- */
  function renderRodilla() {
    if (st.vistaDe !== state.date || !st.fecha) { st.fecha = clamp(state.date); st.vistaDe = state.date; }
    titleEl.textContent = 'Rodilla';
    view.innerHTML = '';
    const raiz = el(`<div class="rod">${barraSecciones()}<div class="rod-cuerpo"></div></div>`);
    raiz.querySelectorAll('[data-sec-btn]').forEach((b) => b.addEventListener('click', () => {
      st.sec = b.dataset.secBtn;
      Rodilla.render();
      window.scrollTo(0, 0);
    }));
    view.appendChild(raiz);
    const cuerpo = raiz.querySelector('.rod-cuerpo');
    ({ dia: seccionDia, registro: seccionRegistro, resumen: seccionResumen, progresion: seccionProgresion,
      entrada: seccionEntrada, test: seccionTest, escalones: seccionEscalones }[st.sec])(cuerpo);
  }

  function abrir(sec, fecha) {
    st.sec = sec;
    if (fecha) { st.fecha = clamp(fecha); st.vistaDe = state.date; }
    state.tab = 'knee';
    state.exercise = null;
    render();
    window.scrollTo(0, 0);
  }

  function todayCard(date) {
    if (!enRango(date)) return null;
    const reg = knee().days[date] || {};
    const filas = tabla();
    const p = prog();
    const ch = C.avisoChasquido(filas);
    const plan = D.dias.find((d) => d.fecha === date);
    const avisos = [];
    if (p.s2.nivel === 'repite' && plan.sem === 'S3') avisos.push(`S2: ${p.s2.texto}`);
    if (p.s4.nivel === 'peor' || p.s4.nivel === 'igual') avisos.push(`Aviso S4: ${p.s4.texto}`);
    if (ch.activo) avisos.push(`Chasquido doloroso: ${ch.texto}`);
    p.brotes.filter((b) => b.fecha >= C.sumarDias(date, -3) && b.fecha <= date)
      .forEach((b) => avisos.push(`Brote (${b.motivo}): 48-72 h solo isométricos y luego un escalón por debajo en todo.`));
    const semana = p.semanas[plan.sem];
    const entrada = semana && semana.carrera.entrada && (plan.dia === 'M' || plan.dia === 'X');
    const card = el(`
      <div class="card rod-hoy"><h2>Seguimiento rodilla</h2>
        <p>Pruebas de la mañana (0-10)</p>
        <div class="rod-grid2">
          ${campoTxt('Declive', 'days', date, 'decline', reg.decline, { num: 'numeric', kind: 'e010' })}
          ${campoTxt('10 subidas D', 'days', date, 'steps', reg.steps, { num: 'numeric', kind: 'e010' })}
        </div>
        <div class="rod-grid2 rod-calc">
          <div><small>Molestia mañana</small><b data-out="morning"></b></div>
          <div><small>Semáforo</small><b data-out="semaforo"></b></div>
        </div>
        ${avisos.map((a) => `<div class="rod-linea">${esc(a)}</div>`).join('')}
        ${entrada ? '<button type="button" class="btn line" data-entrada>Entrada a la carrera: criterios</button>' : ''}
        <button type="button" class="btn ghost" data-abrir>Seguimiento rodilla</button>
      </div>`);
    pintarDia(card, date);
    enlazar(card, () => pintarDia(card, date));
    card.querySelector('[data-abrir]').addEventListener('click', () => abrir('dia', date));
    const b = card.querySelector('[data-entrada]');
    if (b) b.addEventListener('click', () => abrir('entrada'));
    return card;
  }

  /* Prescripción real de un ejercicio con progresión (null: se usa la del calendario). */
  function prescripcion(exercise, week) {
    if (!exercise.prog || !week || week.plan !== 'vol' || week.n < 2) return null;
    const p = prog();
    const semana = p.semanas[`S${week.n}`];
    const pres = C.prescripcion(exercise.prog, semana, PLAN);
    if (!pres) return null;
    const x = exercise.prog.startsWith('carrera') ? semana.carrera : semana.prensa;
    return { ...pres, motivo: x.motivo, provisional: x.provisional };
  }

  /* Niveles reales de las semanas ya empezadas, para la hoja de seguimiento. */
  function nivelesReales() {
    const p = prog();
    const out = {};
    for (const [sem, s] of Object.entries(p.semanas)) {
      if (s.prensa.provisional && s.carrera.provisional) continue;
      out[sem] = {
        runLevel: s.carrera.provisional ? undefined : (s.carrera.nivel ? `N${s.carrera.nivel}` : 'Sin entrar'),
        depthStep: s.prensa.provisional ? undefined : PLAN.PRENSA_NIVELES[s.prensa.nivel].esc,
      };
    }
    return out;
  }

  return { render: renderRodilla, todayCard, abrir, prescripcion, nivelesReales };
})();
