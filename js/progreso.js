/* Provisional: lo sustituye la fase 2B (pantalla Progreso). */
const Progreso = (() => {
  function render() {
    titleEl.textContent = 'Progreso';
    subtitleEl.textContent = '';
    view.innerHTML = '<div class="empty">En construcción.</div>';
  }
  return { render };
})();
