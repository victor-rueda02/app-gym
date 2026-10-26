/* Reglas del bloque (hoja Volumen, A102–A113). ESQUELETO: lo rellena la tarea B.
   Contrato: `Reglas.open()` abre la hoja modal `#sheet` (definida en index.html y
   gestionada por app.js) con las reglas de `PLAN.VOL_BLOCK_RULES` (lista de textos;
   pueden llevar saltos de línea). Lo llama el botón «Reglas del bloque» de la
   pestaña Plan. Puede usar los helpers globales de app.js (`escapeHtml`, `toast`…). */

const Reglas = {
  open() {
    document.getElementById('sheet-title').textContent = 'Reglas del bloque';
    const reglas = PLAN.VOL_BLOCK_RULES;
    document.getElementById('sheet-content').innerHTML = reglas.length
      ? `<ul class="rules">${reglas.map((r) => `<li>${escapeHtml(r)}</li>`).join('')}</ul>`
      : '<p style="color:var(--muted)">Sin reglas cargadas todavía.</p>';
    document.getElementById('sheet').hidden = false;
  },
};
