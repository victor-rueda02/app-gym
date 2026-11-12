/* Pantalla «Progreso»: 1RM estimado, volumen semanal, esfuerzo (RIR) y rodilla, con gráficas
   SVG propias (sin librerías). Contrato: objeto global `Progreso` con `render()`; usa los
   helpers de app.js (`view`, `titleEl`, `subtitleEl`, `el`, `escapeHtml`, `shortDate`) y los
   cálculos de `ProgresoCalc`, `RodillaCalc` y `PLAN`. Estilos en css/progreso.css (gr-, pg-).
   El registro vive en `Store`; aquí solo se lee y se pinta. */

const Progreso = (() => {
  const C = ProgresoCalc;
  const esc = (s) => escapeHtml(String(s));

  // Estado de la interfaz (no se guarda): subpestaña, ejercicio, grupo y modo de volumen.
  const st = { sec: '1rm', ex: null, grupo: 'Total', modo: 'series' };
  const SECCIONES = [['1rm', '1RM'], ['volumen', 'Volumen'], ['esfuerzo', 'Esfuerzo'], ['rodilla', 'Rodilla']];

  // Periodo de las gráficas (común a las cuatro subpestañas). Se recuerda en este móvil.
  const PERIODOS = [['1m', '1 mes', 1, 'el último mes'], ['3m', '3 meses', 3, 'los últimos 3 meses'],
    ['6m', '6 meses', 6, 'los últimos 6 meses'], ['total', 'Total', null, 'todo el registro']];
  const CLAVE_PERIODO = 'gym.progreso.periodo';
  try { const p = localStorage.getItem(CLAVE_PERIODO); if (PERIODOS.some(([id]) => id === p)) st.periodo = p; } catch { /* sin almacenamiento */ }
  if (!st.periodo) st.periodo = 'total';
  const periodo = () => PERIODOS.find(([id]) => id === st.periodo) || PERIODOS[3];
  const desde = () => C.desdePeriodo(PLAN.isoDate(new Date()), periodo()[2]);

  let cacheCat = null;
  const catalogo = () => cacheCat || (cacheCat = C.catalogo(
    [...Object.values(PLAN.BLOCK_VOL), ...Object.values(PLAN.BLOCK_A), ...Object.values(PLAN.BLOCK_B)],
    PLAN.VOL_GRUPOS));

  /* Formato ---------------------------------------------------------------- */
  const fmtN = (v, dec = 1) => {
    if (typeof v !== 'number' || !Number.isFinite(v)) return '—';
    return (Number.isInteger(v) ? String(v) : v.toFixed(dec).replace(/\.0+$/, '')).replace('.', ',');
  };
  const fmtTon = (kg) => (kg >= 1000 ? `${fmtN(Math.round(kg / 100) / 10)} t` : `${fmtN(Math.round(kg))} kg`);
  const fmtTonEje = (kg) => (kg >= 1000 ? `${fmtN(Math.round(kg / 100) / 10)} t` : fmtN(kg));
  const lado = (s) => (s === 'D' ? 'pierna D' : s === 'I' ? 'pierna I' : '');
  const diasDesde = (f) => { const [y, m, d] = f.split('-').map(Number); return Math.round(Date.UTC(y, m - 1, d) / 86400000); };
  // Eje X por semanas: siempre la fecha real del lunes (S1 del plan de volumen = 19 oct).
  const etiquetaSemana = (lunes) => shortDate(lunes);

  /* Gráficas ----------------------------------------------------------------
     grafica({ tipo: 'lineas'|'barras', columnas, series | barras, categorico, yMin, yMax,
               fmtY, refs, leyenda, aria }) -> elemento con leyenda, <svg viewBox> y línea de detalle.
       columnas: [{ pos, label, det }] una por punto/barra (zona táctil), `det` = HTML ya escapado.
       series (líneas): [{ cls, dash, marcas, puntos: [{ pos, y|null, record }] }]
       barras: [{ pos (índice), y, cls?, obj? }]
       refs: [{ y, label, cls }]   leyenda: [{ cls, texto, tipo }] */
  const W = 350;
  const H = 220;
  const ARR = 12;
  const ABA = 28;

  function ticks(min, max, n = 4) {
    const rango = max - min || 1;
    const bruto = rango / n;
    const mag = 10 ** Math.floor(Math.log10(bruto));
    const paso = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= bruto - 1e-9);
    const lo = Math.floor(min / paso + 1e-9) * paso;
    const hi = Math.ceil(max / paso - 1e-9) * paso;
    const out = [];
    for (let v = lo; v <= hi + paso / 1000; v += paso) out.push(Math.round(v * 1e6) / 1e6);
    return { ticks: out, lo, hi };
  }

  const rutaBarra = (x, y, w, h, r) => {
    r = Math.min(r, h, w / 2);
    return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
  };

  function grafica(o) {
    const barras = o.tipo === 'barras';
    const categorico = barras || o.categorico;
    const cols = o.columnas;
    // Rango Y.
    const ys = [];
    (o.series || []).forEach((s) => s.puntos.forEach((p) => p.y !== null && ys.push(p.y)));
    (o.barras || []).forEach((b) => { ys.push(b.y); if (b.obj != null) ys.push(b.obj); });
    (o.refs || []).forEach((r) => ys.push(r.y));
    let min = o.yMin != null ? o.yMin : Math.min(...ys);
    let max = o.yMax != null ? o.yMax : Math.max(...ys);
    if (o.yMin == null) {
      if (max === min) { min -= Math.max(1, Math.abs(min) * 0.05); max += Math.max(1, Math.abs(max) * 0.05); }
      else { const p = (max - min) * 0.12; min -= p; max += p; }
    }
    if (o.yMax == null && o.yMin != null && max <= min) max = min + 1;
    const tk = ticks(min, max);
    const fy = o.fmtY || ((v) => fmtN(v));
    const etY = tk.ticks.map(fy);
    const izq = Math.max(...etY.map((t) => t.length)) * 6.6 + 12;
    const der = 8;
    const pw = W - izq - der;
    const ph = H - ARR - ABA;
    const y = (v) => ARR + ph - ((v - tk.lo) / (tk.hi - tk.lo || 1)) * ph;
    // Posición X.
    const n = cols.length;
    const slot = pw / Math.max(n, 1);
    let x;
    if (categorico) x = (p) => izq + (p + 0.5) * slot;
    else {
      const ps = cols.map((c) => c.pos);
      const a = Math.min(...ps);
      const b = Math.max(...ps);
      const m = 10;
      x = (p) => (b === a ? izq + pw / 2 : izq + m + ((p - a) / (b - a)) * (pw - 2 * m));
    }
    const sv = [];
    // Rejilla y eje Y.
    tk.ticks.forEach((t, i) => {
      sv.push(`<line class="gr-grid" x1="${izq}" x2="${W - der}" y1="${y(t)}" y2="${y(t)}"/>`);
      sv.push(`<text class="gr-t" x="${izq - 6}" y="${y(t) + 4}" text-anchor="end">${esc(etY[i])}</text>`);
    });
    // Etiquetas X sin solaparse (las que no caben se saltan).
    const anchoEt = Math.max(...cols.map((c) => String(c.label).length)) * 6.4 + 10;
    let ultimo = -Infinity;
    cols.forEach((c) => {
      const cx = x(c.pos);
      if (cx - ultimo < anchoEt) return;
      ultimo = cx;
      sv.push(`<text class="gr-t" x="${cx}" y="${H - 8}" text-anchor="middle">${esc(c.label)}</text>`);
    });
    // Líneas de referencia.
    (o.refs || []).forEach((r) => {
      sv.push(`<line class="gr-ref ${r.cls || ''}" x1="${izq}" x2="${W - der}" y1="${y(r.y)}" y2="${y(r.y)}"/>`);
      if (r.label) sv.push(`<text class="gr-t gr-ref-t" x="${W - der - 2}" y="${y(r.y) - 4}" text-anchor="end">${esc(r.label)}</text>`);
    });
    sv.push('<line class="gr-guia" hidden y1="' + ARR + '" y2="' + (ARR + ph) + '"/>');
    if (barras) {
      const bw = Math.min(slot * 0.6, 30);
      o.barras.forEach((b) => {
        const cx = x(b.pos);
        const h = ARR + ph - y(b.y);
        if (h > 0.5) sv.push(`<path class="gr-bar ${b.cls || ''}" d="${rutaBarra(cx - bw / 2, y(b.y), bw, h, 4)}"/>`);
        if (b.obj != null) sv.push(`<line class="gr-obj" x1="${cx - bw / 2 - 3}" x2="${cx + bw / 2 + 3}" y1="${y(b.obj)}" y2="${y(b.obj)}"/>`);
      });
    } else {
      (o.series || []).forEach((s) => {
        // Segmentos continuos (se corta donde falta el dato).
        let seg = [];
        const cierra = () => {
          if (seg.length > 1) sv.push(`<path class="gr-line ${s.cls} ${s.dash ? 'gr-dash' : ''}" d="M${seg.map((p) => `${x(p.pos).toFixed(1)},${y(p.y).toFixed(1)}`).join('L')}"/>`);
          seg = [];
        };
        s.puntos.forEach((p) => { if (p.y === null) cierra(); else seg.push(p); });
        cierra();
        s.puntos.filter((p) => p.y !== null).forEach((p) => {
          if (p.record) sv.push(`<circle class="gr-rec" cx="${x(p.pos)}" cy="${y(p.y)}" r="7.5"/>`);
          sv.push(`<circle class="gr-pt ${s.cls} ${s.dash ? 'gr-pt-s' : ''}" cx="${x(p.pos)}" cy="${y(p.y)}" r="${s.dash ? 3 : 4}"/>`);
        });
      });
    }
    // Zonas táctiles: una columna invisible por punto o barra.
    const cx = cols.map((c) => x(c.pos));
    cols.forEach((c, i) => {
      const a = i === 0 ? izq : (cx[i - 1] + cx[i]) / 2;
      const b = i === n - 1 ? W - der : (cx[i] + cx[i + 1]) / 2;
      sv.push(`<rect class="gr-hit" data-i="${i}" x="${a}" y="0" width="${b - a}" height="${H - ABA + 8}"/>`);
    });
    const ley = (o.leyenda || []).map((l) => `<span class="gr-ley"><i class="gr-sw gr-sw-${l.tipo || 'linea'} ${l.cls || ''}"></i>${esc(l.texto)}</span>`).join('');
    const raiz = el(`<div class="gr">
      ${ley ? `<div class="gr-leyenda">${ley}</div>` : ''}
      <svg class="gr-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(o.aria || 'Gráfica')}" preserveAspectRatio="xMidYMid meet">${sv.join('')}</svg>
      <div class="gr-det" aria-live="polite"></div></div>`);
    const det = raiz.querySelector('.gr-det');
    const guia = raiz.querySelector('.gr-guia');
    const elegir = (i) => {
      det.innerHTML = cols[i].det;
      guia.setAttribute('x1', cx[i]);
      guia.setAttribute('x2', cx[i]);
      guia.removeAttribute('hidden');
      raiz.dataset.sel = String(i);
    };
    raiz.querySelectorAll('.gr-hit').forEach((r) => r.addEventListener('click', () => elegir(+r.dataset.i)));
    elegir(n - 1);
    return raiz;
  }

  /* Piezas comunes ---------------------------------------------------------- */
  const vacio = (msg) => el(`<div class="empty">${esc(msg)}</div>`);
  const tarjeta = (titulo, sub) => el(`<div class="card pg-card"><h2>${esc(titulo)}</h2>${sub ? `<p>${esc(sub)}</p>` : ''}</div>`);

  function pestanas() {
    const barra = el('<div class="card pg-tabs"></div>');
    SECCIONES.forEach(([id, nombre]) => {
      const b = el(`<button class="btn ${st.sec === id ? '' : 'ghost'}" data-ptab="${id}">${esc(nombre)}</button>`);
      b.addEventListener('click', () => { st.sec = id; render(); });
      barra.appendChild(b);
    });
    return barra;
  }

  function barraPeriodo() {
    const barra = el('<div class="card pg-tabs pg-periodo" role="group" aria-label="Periodo de las gráficas"></div>');
    PERIODOS.forEach(([id, nombre]) => {
      const b = el(`<button class="btn ${st.periodo === id ? '' : 'ghost'}" data-periodo="${id}" aria-pressed="${st.periodo === id}">${esc(nombre)}</button>`);
      b.addEventListener('click', () => {
        st.periodo = id;
        try { localStorage.setItem(CLAVE_PERIODO, id); } catch { /* sin almacenamiento */ }
        render();
      });
      barra.appendChild(b);
    });
    return barra;
  }
  const vacioPeriodo = () => el(`<p class="pg-vacio">Sin datos en ${esc(periodo()[3])}. Prueba con un periodo más largo.</p>`);

  function selector(opciones, actual, onCambio, aria) {
    const sel = el(`<select class="pg-select" aria-label="${esc(aria)}">${opciones.map((o) => (o.grupo
      ? `<optgroup label="${esc(o.grupo)}">${o.items.map((i) => `<option value="${esc(i.v)}"${i.v === actual ? ' selected' : ''}>${esc(i.t)}</option>`).join('')}</optgroup>`
      : `<option value="${esc(o.v)}"${o.v === actual ? ' selected' : ''}>${esc(o.t)}</option>`)).join('')}</select>`);
    sel.addEventListener('change', () => onCambio(sel.value));
    return sel;
  }

  /* 1RM -------------------------------------------------------------------- */
  // Con lastre pero sin sumar el cuerpo (el abs colgado mueve las piernas, no el peso entero).
  const soloLastre = (name) => /colgado/i.test(name);

  function seccion1RM(raiz, data) {
    const cat = catalogo();
    const lista = C.ejerciciosConDatos(data, cat);
    if (!lista.length) {
      raiz.appendChild(vacio('Registra series con kg y reps para ver tu 1RM estimado.'));
      return;
    }
    if (!lista.some((e) => e.exId === st.ex)) st.ex = lista[0].exId;
    const grupos = [];
    lista.forEach((e) => {
      let g = grupos.find((x) => x.grupo === e.target);
      if (!g) grupos.push(g = { grupo: e.target || 'Otros', items: [] });
      g.items.push({ v: e.exId, t: `${e.name} · ${e.dias} ${e.dias === 1 ? 'día' : 'días'}` });
    });
    raiz.appendChild(selector(grupos, st.ex, (v) => { st.ex = v; render(); }, 'Ejercicio'));

    const ex = cat[st.ex];
    const d0 = desde();
    // Los récords se marcan con todo el historial; el periodo solo recorta lo que se ve.
    const lineas = C.mejor1RMPorDia(data, cat, st.ex)
      .map((l) => ({ ...l, puntos: l.puntos.filter((p) => C.enPeriodo(p.fecha, d0)) }))
      .filter((l) => l.puntos.length);
    const card = tarjeta(ex.name, '1RM estimado: mejor serie de cada día');
    if (!lineas.length) {
      card.appendChild(vacioPeriodo());
      raiz.appendChild(card);
    } else {
    const fechasUnicas = [...new Set(lineas.flatMap((l) => l.puntos.map((p) => p.fecha)))].sort();
    const base = diasDesde(fechasUnicas[0]);
    const columnas = fechasUnicas.map((f) => ({
      pos: diasDesde(f) - base, label: shortDate(f),
      det: lineas.map((l) => {
        const p = l.puntos.find((q) => q.fecha === f);
        if (!p) return '';
        const carga = p.corporal != null ? `(${fmtN(p.corporal)} + ${fmtN(p.lastre)})` : fmtN(p.kg);
        const serie = `${carga} × ${fmtN(p.reps)}${p.sinRir ? ' (sin RIR)' : ` @${fmtN(p.rir)}`}`;
        return `<div>${l.side ? `<b>${esc(l.side)}</b> · ` : ''}${esc(shortDate(f))} · <b>${esc(C.fmt1RM(p.valor))} kg</b> · ${esc(serie)}${p.record ? ' · ★ récord' : ''}</div>`;
      }).join(''),
    }));
    const series = lineas.map((l) => ({
      cls: l.side === 'D' ? 'c-d' : l.side === 'I' ? 'c-i' : 'c-acc',
      puntos: l.puntos.map((p) => ({ pos: diasDesde(p.fecha) - base, y: p.valor, record: p.record })),
    }));
    const leyenda = lineas.map((l) => ({ cls: l.side === 'D' ? 'c-d' : l.side === 'I' ? 'c-i' : 'c-acc', texto: l.side ? `Pierna ${l.side}` : '1RM', tipo: 'linea' }));
    leyenda.push({ texto: 'Récord', tipo: 'rec' });
    card.appendChild(grafica({ tipo: 'lineas', columnas, series, leyenda, aria: `1RM estimado de ${ex.name}`, fmtY: (v) => fmtN(v) }));
    raiz.appendChild(card);

    // Mejor y avisos.
    const mejores = lineas.map((l) => {
      const m = l.puntos.reduce((a, p) => (p.valor >= a.valor ? p : a));
      return `${l.side ? `${lado(l.side)}: ` : ''}<b>${esc(C.fmt1RM(m.valor))} kg</b> (${esc(shortDate(m.fecha))})`;
    });
    const avisos = [];
    if (lineas.some((l) => l.puntos.some((p) => p.sinRir))) avisos.push('Algunos puntos son «sin RIR»: se estiman con RIR 0 y se quedan cortos.');
    if (ex.pesoCorporal) {
      const pts = lineas.flatMap((l) => l.puntos);
      const sin = pts.filter((p) => p.corporal == null).length;
      avisos.push(sin === 0 ? 'Peso corporal: el 1RM es tu peso de la báscula + el lastre.'
        : `Peso corporal: ${sin} de ${pts.length} ${pts.length === 1 ? 'día' : 'días'} sin peso de la báscula a menos de 7 días; esos usan solo el lastre. Importa tus pesos en Datos › Peso corporal.`);
    } else if (soloLastre(ex.name)) avisos.push('El valor es el del lastre añadido, no incluye tu peso.');
    raiz.appendChild(el(`<div class="card pg-mejor"><p class="pg-mejor-t">${d0 ? 'Mejor del periodo' : 'Mejor'}: ${mejores.join(' · ')}</p>${avisos.map((a) => `<p class="pg-aviso">${esc(a)}</p>`).join('')}</div>`));
    }

    // Progresión.
    const prog = C.progresion(data, cat);
    raiz.appendChild(el('<div class="section-label">Progresión</div>'));
    const cp = el('<div class="card pg-lista"></div>');
    if (!prog.length) cp.appendChild(el('<p class="pg-vacio">Hacen falta al menos dos días con el mismo ejercicio.</p>'));
    const flecha = { mejor: ['↑', 'ok'], igual: ['→', 'igual'], peor: ['↓', 'warn'] };
    prog.forEach((p) => {
      const [f, k] = flecha[p.tendencia];
      const dif = `${p.diff > 0 ? '+' : p.diff < 0 ? '−' : ''}${fmtN(Math.abs(p.diff))} kg`;
      const fila = el(`<button type="button" class="pg-fila${p.exId === st.ex ? ' on' : ''}" data-ex="${esc(p.exId)}">
        <span class="pg-fila-n"><b>${esc(p.name)}</b>${p.side ? `<em class="pg-lado pg-lado-${p.side}">${esc(p.side)}</em>` : ''}<small>${esc(shortDate(p.previo.fecha))} → ${esc(shortDate(p.ultimo.fecha))}</small></span>
        <span class="pg-fila-v">${esc(C.fmt1RM(p.previo.valor))} → ${esc(C.fmt1RM(p.ultimo.valor))}</span>
        <span class="pg-tend pg-${k}"><span aria-hidden="true">${f}</span> ${esc(dif)}</span></button>`);
      fila.addEventListener('click', () => { st.ex = p.exId; render(); window.scrollTo(0, 0); });
      cp.appendChild(fila);
    });
    raiz.appendChild(cp);

    // Récords recientes.
    const recs = C.records(data, cat, 8);
    raiz.appendChild(el('<div class="section-label">Récords recientes</div>'));
    const cr = el('<div class="card pg-lista"></div>');
    if (!recs.length) cr.appendChild(el('<p class="pg-vacio">Aún no hay récords: se marcan al superar tu mejor 1RM anterior.</p>'));
    recs.forEach((r) => {
      cr.appendChild(el(`<div class="pg-fila pg-rec">
        <span class="pg-fila-n"><b>${esc(r.name)}</b>${r.side ? `<em class="pg-lado pg-lado-${r.side}">${esc(r.side)}</em>` : ''}<small>${esc(shortDate(r.fecha))}</small></span>
        <span class="pg-fila-v"><b>★ ${esc(C.fmt1RM(r.valor))} kg</b></span>
        <span class="pg-tend pg-igual">${r.anterior === null ? 'primero' : `antes ${esc(C.fmt1RM(r.anterior))}`}</span></div>`));
    });
    raiz.appendChild(cr);
  }

  /* Volumen ---------------------------------------------------------------- */
  function seccionVolumen(raiz, data) {
    const cat = catalogo();
    const v = C.volumenSemanal(data, cat, PLAN.VOL_GRUPOS);
    if (!v.semanas.length) {
      raiz.appendChild(vacio('Registra series de hipertrofia para ver tu volumen semanal.'));
      return;
    }
    const opciones = [{ v: 'Total', t: 'Total (todos los grupos)' }, ...PLAN.VOL_GRUPOS.map((g) => ({ v: g, t: g }))];
    if (!opciones.some((o) => o.v === st.grupo)) st.grupo = 'Total';
    raiz.appendChild(selector(opciones, st.grupo, (g) => { st.grupo = g; render(); }, 'Grupo muscular'));
    const modos = el('<div class="card pg-tabs pg-modos"></div>');
    [['series', 'Series'], ['tonelaje', 'Tonelaje']].forEach(([id, t]) => {
      const b = el(`<button class="btn ${st.modo === id ? '' : 'ghost'}" data-modo="${id}">${t}</button>`);
      b.addEventListener('click', () => { st.modo = id; render(); });
      modos.appendChild(b);
    });
    raiz.appendChild(modos);

    const total = st.grupo === 'Total';
    const d = total ? v.total : v.porGrupo[st.grupo];
    const esSeries = st.modo === 'series';
    const vals = esSeries ? d.series : d.tonelaje;
    let hayObj = false;
    const columnas = [];
    const d0 = desde();
    const idx = v.semanas.map((_, i) => i).filter((i) => C.semanaEnPeriodo(v.semanas[i], d0));
    const barras = idx.map((i, j) => {
      const lunes = v.semanas[i];
      const w = PLAN.weekFor(lunes);
      let obj = null;
      if (esSeries && w && w.plan === 'vol') {
        const o = PLAN.seriesPorGrupo(w.n)[total ? 'TOTAL' : st.grupo];
        if (typeof o === 'number') { obj = o; hayObj = true; }
      }
      const txt = esSeries ? `${fmtN(vals[i])} series` : fmtTon(vals[i]);
      columnas.push({
        pos: j, label: etiquetaSemana(lunes),
        det: `<div>Semana del ${esc(shortDate(lunes))}${w && w.plan === 'vol' ? ` (S${w.n})` : ''} · <b>${esc(txt)}</b>${obj !== null ? ` · objetivo ${esc(fmtN(obj))}` : ''}</div>`,
      });
      return { pos: j, y: vals[i], obj };
    });
    const card = tarjeta(`${total ? 'Total' : st.grupo} · ${esSeries ? 'series por semana' : 'tonelaje por semana'}`, esSeries ? 'Series de hipertrofia (D o I cuentan 0,5)' : 'Tonelaje = kg × reps');
    if (!barras.length) card.appendChild(vacioPeriodo());
    else card.appendChild(grafica({
      tipo: 'barras', columnas, barras, yMin: 0,
      fmtY: esSeries ? (x) => fmtN(x) : fmtTonEje,
      leyenda: [{ cls: 'c-acc', texto: esSeries ? 'Series' : 'Tonelaje', tipo: 'barra' }, ...(hayObj ? [{ texto: 'Objetivo', tipo: 'obj' }] : [])],
      aria: `${total ? 'Total' : st.grupo}: ${esSeries ? 'series' : 'tonelaje'} por semana`,
    }));
    raiz.appendChild(card);

    if (total) {
      raiz.appendChild(el('<div class="section-label">Cumplimiento</div>'));
      const cc = el('<div class="card pg-lista"></div>');
      const hoyLunes = C.semanaDe(PLAN.isoDate(new Date()));
      let hay = false;
      v.semanas.forEach((lunes, i) => {
        const w = PLAN.weekFor(lunes);
        if (!w || w.plan !== 'vol' || !C.semanaEnPeriodo(lunes, d0)) return;
        hay = true;
        const plan = PLAN.seriesPorGrupo(w.n).TOTAL;
        const pct = C.cumplimiento(v.total.series[i], plan);
        cc.appendChild(el(`<div class="pg-cump">
          <div class="pg-cump-c"><b>${esc(shortDate(lunes))}</b> <small>S${w.n}${lunes === hoyLunes ? ' · en curso' : ''}</small><span>${esc(fmtN(v.total.series[i]))} / ${esc(fmtN(plan))} series</span><b class="pg-cump-p">${pct === null ? '—' : `${pct} %`}</b></div>
          <div class="pg-barra"><i style="width:${Math.min(pct || 0, 100)}%"></i></div></div>`));
      });
      if (!hay) cc.appendChild(el('<p class="pg-vacio">Aún no hay semanas del plan de volumen con datos.</p>'));
      raiz.appendChild(cc);
    }
    raiz.appendChild(el('<p class="pg-nota">Cuentan solo las series de hipertrofia del plan: rehab, cardio y correctivos no. En ejercicios por pierna, cada serie D o I cuenta media.</p>'));
  }

  /* Esfuerzo --------------------------------------------------------------- */
  function seccionEsfuerzo(raiz, data) {
    const cat = catalogo();
    const todas = C.rirMedioSemanal(data, cat, PLAN.VOL_GRUPOS);
    if (!todas.length) {
      raiz.appendChild(vacio('Anota el RIR en tus series de hipertrofia para ver tu esfuerzo medio.'));
      return;
    }
    const d0 = desde();
    const filas = todas.filter((f) => C.semanaEnPeriodo(f.semana, d0));
    const sesiones = Object.values(PLAN.BLOCK_VOL);
    const columnas = [];
    const real = [];
    const pres = [];
    filas.forEach((f, i) => {
      const w = PLAN.weekFor(f.semana);
      const p = w && w.plan === 'vol' ? C.rirPrescrito(sesiones, w.n, PLAN.VOL_GRUPOS) : null;
      real.push({ pos: i, y: f.media });
      pres.push({ pos: i, y: p });
      columnas.push({
        pos: i, label: etiquetaSemana(f.semana),
        det: `<div>Semana del ${esc(shortDate(f.semana))} · RIR medio <b>${esc(fmtN(f.media))}</b> (n = ${f.n} ${f.n === 1 ? 'serie' : 'series'} con RIR)${p !== null ? ` · prescrito ${esc(fmtN(p))}` : ''}</div>`,
      });
    });
    const hayPres = pres.some((p) => p.y !== null);
    const series = [{ cls: 'c-acc', puntos: real }];
    if (hayPres) series.push({ cls: 'c-muted', dash: true, puntos: pres });
    const card = tarjeta('RIR medio por semana', 'Repeticiones que te dejas en recámara');
    if (!filas.length) card.appendChild(vacioPeriodo());
    else card.appendChild(grafica({
      tipo: 'lineas', categorico: true, columnas, series, yMin: 0,
      leyenda: [{ cls: 'c-acc', texto: 'RIR real', tipo: 'linea' }, ...(hayPres ? [{ cls: 'c-muted', texto: 'Prescrito', tipo: 'dash' }] : [])],
      aria: 'RIR medio real y prescrito por semana',
    }));
    raiz.appendChild(card);
    raiz.appendChild(el('<p class="pg-nota">Por encima del prescrito = te estás dejando más reps de las planeadas. Toca un punto para ver cuántas series con RIR lo forman.</p>'));
  }

  /* Rodilla ---------------------------------------------------------------- */
  const numero = (x) => (typeof x === 'number' ? x : x === '' || x === undefined || x === null ? null : (Number.isFinite(Number(x)) ? Number(x) : null));

  function seccionRodilla(raiz) {
    const filas = RodillaCalc.tablaDias(RODILLA_DATA.dias, Store.knee().days, PLAN);
    const d0 = desde();
    // Con periodo, solo las semanas del plan cuyo último día entra en él.
    const res = RodillaCalc.resumenes(filas, RODILLA_DATA.semanas)
      .filter((r) => !d0 || (r.ultimo && C.enPeriodo(r.ultimo, d0)));
    const conDatos = res.filter((r) => numero(r.media) !== null);
    let algo = false;
    if (conDatos.length) {
      algo = true;
      const columnas = res.map((r, i) => {
        const m = numero(r.media);
        return {
          pos: i, label: r.sem,
          det: m === null ? `<div>${esc(r.sem)} · sin datos</div>`
            : `<div>${esc(r.sem)} · media <b>${esc(fmtN(m))}</b> · peor ${esc(fmtN(numero(r.peor)))} · ${r.mananas} ${r.mananas === 1 ? 'mañana' : 'mañanas'}</div>`,
        };
      });
      let ult = columnas.length - 1;
      while (ult > 0 && numero(res[ult].media) === null) ult--;
      const card = tarjeta('Molestia de la mañana', 'Media semanal (0 = nada, 10 = máxima)');
      const g = grafica({
        tipo: 'lineas', categorico: true, yMin: 0, yMax: 10, columnas,
        series: [{ cls: 'c-acc', puntos: res.map((r, i) => ({ pos: i, y: numero(r.media) })) }],
        refs: [{ y: 3, label: 'gimnasio 3', cls: 'c-warn' }, { y: 2, label: 'carrera 2', cls: 'c-muted' }],
        leyenda: [{ cls: 'c-acc', texto: 'Media', tipo: 'linea' }, { cls: 'c-warn', texto: 'Umbral gimnasio (3)', tipo: 'dash' }, { cls: 'c-muted', texto: 'Carrera (2)', tipo: 'dash' }],
        aria: 'Molestia media de la mañana por semana',
      });
      card.appendChild(g);
      // Empieza en la última semana con datos, no en una vacía.
      g.querySelectorAll('.gr-hit')[ult].dispatchEvent(new Event('click'));
      raiz.appendChild(card);
    }
    // Simetría D/I de los tests.
    const tests = RODILLA_DATA.tests.map((t) => {
      const reg = Store.knee().tests[t.clave];
      if (!reg) return null;
      const r = RodillaCalc.calcularTest(reg);
      return typeof r.pct === 'number' ? { t, r, reg } : null;
    }).filter(Boolean);
    if (tests.length) {
      algo = true;
      const columnas = tests.map(({ t, r, reg }, i) => ({
        pos: i, label: t.clave.toUpperCase(),
        det: `<div>${esc(t.nombre)} · D ${esc(fmtN(numero(reg.loadD)))} kg × ${esc(fmtN(numero(reg.repsD)))} (${esc(fmtN(r.estD))}) · I ${esc(fmtN(numero(reg.loadI)))} kg × ${esc(fmtN(numero(reg.repsI)))} (${esc(fmtN(r.estI))}) · simetría <b>${esc(fmtN(r.pct))} %</b> ${r.pct >= 90 ? '(llega al 90 %)' : '(por debajo del 90 %)'}</div>`,
      }));
      const card = tarjeta('Simetría D/I en los tests', 'e1RM de la pierna lesionada frente a la sana');
      card.appendChild(grafica({
        tipo: 'barras', columnas, yMin: 0, yMax: Math.max(100, Math.ceil(Math.max(...tests.map(({ r }) => r.pct)) / 25) * 25), fmtY: (x) => `${fmtN(x)}`,
        barras: tests.map(({ r }, i) => ({ pos: i, y: r.pct, cls: r.pct >= 90 ? 'c-ok' : 'c-warn' })),
        refs: [{ y: 90, label: '90 %', cls: 'c-muted' }],
        leyenda: [{ cls: 'c-ok', texto: '≥ 90 %', tipo: 'barra' }, { cls: 'c-warn', texto: '< 90 %', tipo: 'barra' }],
        aria: 'Simetría D/I por test',
      }));
      raiz.appendChild(card);
    }
    if (!algo && d0 && RodillaCalc.resumenes(filas, RODILLA_DATA.semanas).some((r) => numero(r.media) !== null)) {
      const card = tarjeta('Molestia de la mañana', 'Media semanal (0 = nada, 10 = máxima)');
      card.appendChild(vacioPeriodo());
      raiz.appendChild(card);
      algo = true;
    }
    if (!algo) raiz.appendChild(vacio('Apunta la molestia de la mañana en Rodilla o completa un test de fuerza para ver aquí su evolución.'));
  }

  /* Pantalla ---------------------------------------------------------------- */
  function render() {
    const data = Store.all();
    const cat = catalogo();
    const nEj = C.ejerciciosConDatos(data, cat).length;
    const nSem = C.volumenSemanal(data, cat, PLAN.VOL_GRUPOS).semanas.length;
    titleEl.textContent = 'Progreso';
    subtitleEl.textContent = `${nEj} ${nEj === 1 ? 'ejercicio' : 'ejercicios'} con carga · ${nSem} ${nSem === 1 ? 'semana' : 'semanas'}`;
    view.innerHTML = '';
    const raiz = el('<div class="pg"></div>');
    raiz.appendChild(pestanas());
    raiz.appendChild(barraPeriodo());
    try {
      ({ '1rm': seccion1RM, volumen: seccionVolumen, esfuerzo: seccionEsfuerzo, rodilla: seccionRodilla }[st.sec])(raiz, data);
    } catch (e) {
      raiz.appendChild(vacio('No se pudo pintar esta gráfica.'));
      console.warn('Progreso:', e);
    }
    view.appendChild(raiz);
  }

  return { render };
})();
