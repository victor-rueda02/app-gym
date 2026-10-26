/* Pestaña «Rodilla». ESQUELETO: lo rellena la tarea C.
   Contrato (global `Rodilla`, usa los helpers de app.js: `view`, `titleEl`,
   `subtitleEl`, `el`, `escapeHtml`, `toast`, `render`, `state`):
   - `Rodilla.render()`: pinta la pestaña (data-tab="knee") en `#view` y pone el
     título y el subtítulo de la barra superior.
   - `Rodilla.todayCard(date)`: devuelve el elemento DOM de la tarjeta de rodilla
     de la pantalla Hoy para esa fecha ('YYYY-MM-DD'), o null si no toca.
   El registro vive en `Store.knee()` y se escribe con `Store.setKnee()`. */

const Rodilla = {
  render() {
    titleEl.textContent = 'Rodilla';
    subtitleEl.textContent = 'Seguimiento';
    view.innerHTML = '';
    view.appendChild(el('<div class="empty">En construcción</div>'));
  },

  todayCard(date) {   // eslint-disable-line no-unused-vars
    return null;
  },
};
