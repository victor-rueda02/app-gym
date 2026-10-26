/* Reglas del bloque (hoja Volumen, A102–A113).
   `Reglas.open()` abre la hoja modal `#sheet` (definida en index.html y gestionada por
   app.js) con las reglas de `PLAN.VOL_BLOCK_RULES` (lista de textos; pueden llevar
   saltos de línea) y el título `PLAN.VOL_BLOCK_RULES_TITLE`. Lo llama el botón «Reglas
   del bloque» de la pestaña Plan.
   `Reglas.marcarEtiquetas(texto)` es pura: devuelve el HTML escapado con las etiquetas
   [EVIDENCIA…], [LÓGICA…] e [INCERTIDUMBRE…] envueltas en un <span class="reglas-tag …">. */

const Reglas = {
  _estilosPuestos: false,

  // Etiquetas entre corchetes cuya primera palabra es EVIDENCIA, LÓGICA o INCERTIDUMBRE.
  _RE_ETIQUETA: /\[(EVIDENCIA|LÓGICA|INCERTIDUMBRE)[^\]]*\]/gi,

  _claseEtiqueta(palabra) {
    const p = palabra.toUpperCase();
    return p === 'EVIDENCIA' ? 'evidencia' : p === 'LÓGICA' ? 'logica' : 'incertidumbre';
  },

  // Texto -> HTML escapado, con las etiquetas resaltadas (sin quitar ni añadir texto).
  marcarEtiquetas(texto) {
    const s = String(texto == null ? '' : texto);
    const re = new RegExp(Reglas._RE_ETIQUETA.source, 'gi');
    let html = '';
    let ultimo = 0;
    let m;
    while ((m = re.exec(s)) !== null) {
      html += escapeHtml(s.slice(ultimo, m.index));
      html += `<span class="reglas-tag reglas-tag-${Reglas._claseEtiqueta(m[1])}">${escapeHtml(m[0])}</span>`;
      ultimo = m.index + m[0].length;
    }
    return html + escapeHtml(s.slice(ultimo));
  },

  // Una regla -> HTML con el encabezado (antes de «:» o « [») en negrita.
  _htmlRegla(texto) {
    const s = String(texto);
    const dp = s.indexOf(':');
    const cor = s.indexOf(' [');
    let corte = -1;
    if (dp >= 0 && (cor < 0 || dp < cor)) corte = dp + 1;   // incluye los dos puntos
    else if (cor >= 0) corte = cor;
    if (corte <= 0 || corte > 70) return Reglas.marcarEtiquetas(s);
    return `<strong>${escapeHtml(s.slice(0, corte))}</strong>${Reglas.marcarEtiquetas(s.slice(corte))}`;
  },

  _ponerEstilos() {
    if (Reglas._estilosPuestos) return;
    Reglas._estilosPuestos = true;
    const st = document.createElement('style');
    st.textContent = `
.reglas-leyenda{display:flex;flex-direction:column;gap:4px;margin:0 0 14px;font-size:12.5px;color:var(--muted);line-height:1.4}
.reglas-lista{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:10px}
.reglas-item{display:flex;gap:10px;align-items:flex-start;padding:10px 12px;border:1px solid rgba(255,255,255,.08);border-radius:10px;background:rgba(255,255,255,.03)}
.reglas-num{flex:none;min-width:24px;height:24px;border-radius:12px;background:var(--accent);color:#000;font-weight:700;font-size:13px;display:flex;align-items:center;justify-content:center}
.reglas-txt{flex:1;min-width:0;font-size:14.5px;line-height:1.5;white-space:pre-wrap;overflow-wrap:anywhere}
.reglas-tag{display:inline-block;padding:0 6px;margin:0 1px;border-radius:6px;font-size:12px;font-weight:600;line-height:1.5;border:1px solid currentColor;white-space:normal}
.reglas-tag-evidencia{color:var(--ok)}
.reglas-tag-logica{color:var(--accent)}
.reglas-tag-incertidumbre{color:var(--warn)}`;
    document.head.appendChild(st);
  },

  open() {
    Reglas._ponerEstilos();
    const titulo = (typeof PLAN !== 'undefined' && PLAN.VOL_BLOCK_RULES_TITLE) || 'Reglas del bloque';
    const reglas = (typeof PLAN !== 'undefined' && Array.isArray(PLAN.VOL_BLOCK_RULES))
      ? PLAN.VOL_BLOCK_RULES : [];
    document.getElementById('sheet-title').textContent = titulo;
    const cont = document.getElementById('sheet-content');
    cont.innerHTML = '';
    if (!reglas.length) {
      cont.innerHTML = '<p style="color:var(--warn)">No hay reglas del bloque cargadas en el plan.</p>';
    } else {
      cont.innerHTML =
        `<div class="reglas-leyenda">
          <div><span class="reglas-tag reglas-tag-evidencia">EVIDENCIA</span> respaldada por estudios</div>
          <div><span class="reglas-tag reglas-tag-logica">LÓGICA</span> razonamiento del plan</div>
          <div><span class="reglas-tag reglas-tag-incertidumbre">INCERTIDUMBRE</span> sin validar</div>
        </div>
        <ol class="reglas-lista">${reglas.map((r, i) =>
          `<li class="reglas-item"><span class="reglas-num">${i + 1}</span><div class="reglas-txt">${Reglas._htmlRegla(r)}</div></li>`
        ).join('')}</ol>`;
    }
    document.getElementById('sheet').hidden = false;
    cont.scrollTop = 0;
  },
};
