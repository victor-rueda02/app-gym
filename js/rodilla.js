/* Pestaña «Rodilla» y tarjeta de la pantalla Hoy.
   Contrato (global `Rodilla`, usa los helpers de app.js: `view`, `titleEl`,
   `subtitleEl`, `el`, `escapeHtml`, `toast`, `render`, `state`, `fmtDate`, `shortDate`):
   - `Rodilla.render()`: pinta la pestaña (data-tab="knee") en `#view`.
   - `Rodilla.todayCard(date)`: tarjeta de rodilla de Hoy, o null fuera del 26/10–27/12.
   El registro vive en `Store.knee()` y se escribe con `Store.setKnee()` al teclear.
   Todos los cálculos están en js/rodilla-calc.js; aquí solo se pinta y se guarda. */

const Rodilla = (() => {
  const D = RODILLA_DATA;
  const C = RodillaCalc;

  // Estado de la interfaz (no se guarda): sección, día abierto y último state.date visto.
  const st = { sec: 'dia', fecha: null, vistaDe: null };

  const SECCIONES = [
    ['dia', 'Día'], ['registro', 'Registro'], ['resumen', 'Resumen'],
    ['entrada', 'Entrada'], ['test', 'Test'], ['escalones', 'Escalones'],
  ];

  // Entradas validadas: [validador, mensaje de error]
  const VALIDOS = {
    e010: [C.entero010, 'Escribe un entero de 0 a 10'],
    esc04: [(v) => C.enteroRango(v, 0, 4), 'Escribe un entero de 0 a 4'],
    reps: [C.enteroPositivo, 'Escribe un entero (0 o más)'],
    carga: [C.decimalPositivo, 'Escribe un número en kg (0 o más)'],
  };

  const esc = (s) => escapeHtml(s);   // app.js se carga después: no leer sus globales al cargar
  const fmt = (v) => (v === '' || v === undefined || v === null ? '—' : String(v).replace('.', ','));
  const val = (v) => (v === undefined || v === null ? '' : esc(String(v).replace('.', ',')));
  const knee = () => Store.knee();
  const fila = (fecha) => C.tablaDias(D.dias, knee().days).find((f) => f.fecha === fecha);
  const enRango = (f) => f >= D.desde && f <= D.hasta;
  const clamp = (f) => (f < D.desde ? D.desde : f > D.hasta ? D.hasta : f);
  const texto = (t) => (typeof Reglas !== 'undefined' && Reglas.marcarEtiquetas ? Reglas.marcarEtiquetas(t) : esc(t));

  const claseCumple = (c) => (c === 'Sí' ? 'ok' : c === 'No' ? 'bad' : c === '' ? 'none' : 'warn');

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

  const pill = (clase, txt) => `<span class="rod-pill rod-${clase}">${esc(txt)}</span>`;

  /* Pinta los calculados del día en `root` (elementos [data-out]). */
  function pintarDia(root, fecha) {
    const f = fila(fecha);
    const reg = knee().days[fecha] || {};
    root.querySelectorAll('[data-out]').forEach((n) => {
      const k = n.dataset.out;
      n.textContent = fmt(f[k]);
      if (k === 'cumple') n.className = `rod-big rod-${claseCumple(f.cumple)}`;
    });
    root.querySelectorAll('[data-carrera]').forEach((n) => { n.hidden = f.rule !== C.REGLA_CARRERA; });
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
          <div class="rod-cumple"><small>¿Cumple?</small><b data-out="cumple"></b></div>
        </div>
        <details class="card rod-help"><summary>Cómo se rellena</summary>
          <p class="rod-txt">${texto(D.textos.registro)}</p></details>
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
    const filas = C.tablaDias(D.dias, knee().days);
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
            <div class="rod-cols rod-w"><small>¿Cumple?</small><b class="rod-${claseCumple(x.cumple)}">${esc(x.cumple || '—')}</b></div>
          </button>`);
        b.addEventListener('click', () => { st.fecha = x.fecha; st.sec = 'dia'; Rodilla.render(); window.scrollTo(0, 0); });
        root.appendChild(b);
      });
    }
  }

  function bannerAvisos(filas, res) {
    const s2 = res.find((x) => x.sem === 'S2');
    const s4 = res.find((x) => x.sem === 'S4');
    const a = C.avisoS4(s2.media, s4.media);
    const c = C.avisoChasquido(filas);
    return `
      <div class="card rod-aviso rod-a-${a.nivel}"><h2>Aviso S4 (fisio)</h2><p>${esc(a.texto)}</p></div>
      <div class="card rod-aviso rod-a-${c.activo ? 'peor' : 'sin'}"><h2>Chasquido doloroso</h2><p>${esc(c.texto)}</p></div>`;
  }

  function seccionResumen(root) {
    subtitleEl.textContent = 'Resumen semanal';
    const filas = C.tablaDias(D.dias, knee().days);
    const res = C.resumenes(filas, D.semanas);
    const w = knee().weeks;
    root.appendChild(el(`<div>${bannerAvisos(filas, res)}
      <p class="rod-txt rod-nota">${texto(D.textos.resumen)}</p></div>`));
    for (const r of res) {
      const m = w[r.sem] || {};
      root.appendChild(el(`
        <div class="card"><h2>${r.sem}</h2>
          <div class="rod-grid4">
            <div><small>Media</small><b>${fmt(r.media)}</b></div>
            <div><small>Peor mañana</small><b>${fmt(r.peor)}</b></div>
            <div><small>No cumplen</small><b>${r.noCumplen}</b></div>
            <div><small>Chasquidos</small><b>${r.chasquidos}</b></div>
          </div>
          <div class="rod-grid2">
            ${campoTxt('Nivel de carrera real', 'weeks', r.sem, 'runLevel', m.runLevel)}
            ${campoTxt('Escalón D real (0-4)', 'weeks', r.sem, 'depthStep', m.depthStep, { num: 'numeric', kind: 'esc04' })}
          </div>
          ${notas('weeks', r.sem, m.notes)}
        </div>`));
    }
    enlazar(root, () => {});   // los campos manuales no alteran ningún cálculo
  }

  function seccionEntrada(root) {
    subtitleEl.textContent = 'Entrada a la carrera';
    const e = knee().entry;
    root.appendChild(el(`<div class="rod-titulo">${esc(D.titulos.entrada)}</div>`));
    D.entrada.forEach((c) => {
      const r = e[c.clave] || {};
      root.appendChild(el(`
        <div class="card"><p class="rod-crit">${esc(c.texto)}</p><small class="rod-dia">${esc(c.dia)}</small>
          ${segSiNo('¿Cumple?', 'entry', c.clave, 'ok', r.ok)}
          ${campoTxt('Notas', 'entry', c.clave, 'notes', r.notes)}
        </div>`));
    });
    const out = el('<div class="card rod-res"><small>Resultado</small><b data-res></b></div>');
    root.appendChild(out);
    const pintar = () => {
      const r = C.entradaResultado(D.entrada.map((c) => (knee().entry[c.clave] || {}).ok || ''));
      const b = out.querySelector('[data-res]');
      b.textContent = r.texto;
      b.className = `rod-${r.estado === 'si' ? 'ok' : r.estado === 'no' ? 'bad' : 'none'}`;
    };
    pintar();
    enlazar(root, pintar);
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
          if (k === 'ok') n.className = `rod-${claseCumple(r.ok)}`;
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
    ({ dia: seccionDia, registro: seccionRegistro, resumen: seccionResumen,
      entrada: seccionEntrada, test: seccionTest, escalones: seccionEscalones }[st.sec])(cuerpo);
  }

  function todayCard(date) {
    if (!enRango(date)) return null;
    const reg = knee().days[date] || {};
    const filas = C.tablaDias(D.dias, knee().days);
    const res = C.resumenes(filas, D.semanas);
    const s4 = C.avisoS4(res.find((x) => x.sem === 'S2').media, res.find((x) => x.sem === 'S4').media);
    const ch = C.avisoChasquido(filas);
    const avisos = [];
    if (s4.nivel === 'peor' || s4.nivel === 'igual') avisos.push(`Aviso S4: ${s4.texto}`);
    if (ch.activo) avisos.push(`Chasquido doloroso: ${ch.texto}`);
    const card = el(`
      <div class="card rod-hoy"><h2>Seguimiento rodilla</h2>
        <p>Pruebas de la mañana (0-10)</p>
        <div class="rod-grid2">
          ${campoTxt('Declive', 'days', date, 'decline', reg.decline, { num: 'numeric', kind: 'e010' })}
          ${campoTxt('10 subidas D', 'days', date, 'steps', reg.steps, { num: 'numeric', kind: 'e010' })}
        </div>
        <div class="rod-grid2 rod-calc">
          <div><small>Molestia mañana</small><b data-out="morning"></b></div>
          <div><small>¿Cumple?</small><b data-out="cumple"></b></div>
        </div>
        ${avisos.map((a) => `<div class="rod-linea">${esc(a)}</div>`).join('')}
        <button type="button" class="btn ghost" data-abrir>Seguimiento rodilla</button>
      </div>`);
    pintarDia(card, date);
    enlazar(card, () => pintarDia(card, date));
    card.querySelector('[data-abrir]').addEventListener('click', () => {
      st.fecha = date; st.vistaDe = state.date; st.sec = 'dia';
      state.tab = 'knee';
      render();
    });
    return card;
  }

  return { render: renderRodilla, todayCard };
})();
