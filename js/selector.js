/* Selector de ejercicios: hoja modal con buscador, chips de grupo muscular, recientes y
   lista agrupada. Sustituye al <select> con <optgroup> cuando hay muchos ejercicios.
   Usa la hoja #sheet de index.html. Script global, sin dependencias. */
const Selector = (() => {
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  // Sin tildes ni mayúsculas.
  const norm = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

  function abrir({ titulo, items, recientes = [], actual = null, onElegir, extra = null }) {
    const sheet = document.getElementById('sheet');
    document.getElementById('sheet-title').textContent = titulo || 'Elegir ejercicio';
    const box = document.getElementById('sheet-content');
    const lista0 = (items || []).map((i) => ({ ...i, grupo: i.grupo || 'Otros', _q: norm(`${i.nombre} ${i.grupo || 'Otros'}`) }));
    const porId = new Map(lista0.map((i) => [i.id, i]));
    const rec = [...new Set(recientes)].map((id) => porId.get(id)).filter(Boolean).slice(0, 6);

    box.innerHTML = `<div class="sel">
      <input type="search" class="sel-buscar" placeholder="Buscar ejercicio o grupo…" aria-label="Buscar ejercicio" autocomplete="off" autocapitalize="off" spellcheck="false">
      <div class="sel-chips" role="group" aria-label="Grupos musculares"></div>
      <div class="sel-lista"></div></div>`;
    const inp = box.querySelector('.sel-buscar');
    const chips = box.querySelector('.sel-chips');
    const lista = box.querySelector('.sel-lista');

    const cerrar = () => { sheet.hidden = true; };
    const elegir = (id) => { cerrar(); if (onElegir) onElegir(id); };
    const fila = (i) => `<button type="button" class="sel-item${i.id === actual ? ' on' : ''}" data-id="${esc(i.id)}"${i.id === actual ? ' aria-current="true"' : ''}>
      <span class="sel-item-t"><b>${esc(i.nombre)}</b>${i.detalle ? `<small>${esc(i.detalle)}</small>` : ''}</span>
      ${i.id === actual ? '<span class="sel-check" aria-hidden="true">✓</span>' : ''}</button>`;

    function pinta() {
      const q = norm(inp.value);
      const vis = q ? lista0.filter((i) => q.split(/\s+/).every((t) => i._q.includes(t))) : lista0;
      const grupos = [];
      vis.forEach((i) => {
        let g = grupos.find((x) => x.g === i.grupo);
        if (!g) grupos.push(g = { g: i.grupo, items: [] });
        g.items.push(i);
      });
      let h = '';
      if (extra && !q) h += `<button type="button" class="sel-extra">${esc(extra.texto)}</button>`;
      if (rec.length && !q) h += `<div class="sel-grupo" data-g="__rec">Recientes</div>${rec.map(fila).join('')}`;
      grupos.forEach((g, n) => { h += `<div class="sel-grupo" data-g="${n}">${esc(g.g)}</div>${g.items.map(fila).join('')}`; });
      if (!vis.length) h += '<p class="sel-vacio">Nada coincide con la búsqueda.</p>';
      lista.innerHTML = h + '<div class="sel-relleno" aria-hidden="true"></div>';
      // Relleno final para que el último grupo, aunque sea corto, pueda llegar arriba del todo.
      const cabs = lista.querySelectorAll('.sel-grupo');
      const rel = lista.querySelector('.sel-relleno');
      if (cabs.length) {
        const ult = cabs[cabs.length - 1];
        rel.style.height = `${Math.max(0, lista.clientHeight - (rel.offsetTop - ult.offsetTop))}px`;
      }
      lista.scrollTop = 0;
      chips.innerHTML = grupos.map((g, n) => `<button type="button" class="sel-chip" data-n="${n}">${esc(g.g)}</button>`).join('');
      chips.hidden = grupos.length < 2;
    }
    sheet.hidden = false;   // visible antes de pintar: el relleno necesita medir la lista
    pinta();

    inp.addEventListener('input', pinta);
    chips.addEventListener('click', (e) => {
      const b = e.target.closest('.sel-chip');
      if (!b) return;
      const cab = lista.querySelector(`.sel-grupo[data-g="${b.dataset.n}"]`);
      if (!cab) return;
      // La cabecera es sticky (su offsetTop cambia al pegarse): se mide con el elemento siguiente.
      const sig = cab.nextElementSibling;
      lista.scrollTo({ top: sig ? sig.offsetTop - cab.offsetHeight : cab.offsetTop, behavior: 'auto' });
    });
    lista.addEventListener('click', (e) => {
      if (e.target.closest('.sel-extra')) { cerrar(); extra.onClick(); return; }
      const b = e.target.closest('.sel-item');
      if (b) elegir(b.dataset.id);
    });
  }

  function boton(texto, onClick) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'sel-boton';
    b.innerHTML = `<span class="sel-boton-t">${esc(texto)}</span><span class="sel-boton-f" aria-hidden="true">▾</span>`;
    b.addEventListener('click', onClick);
    return b;
  }

  return { abrir, boton };
})();
