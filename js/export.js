/* Construye el .xlsx a partir del registro local y lo entrega.

   Escritorio (Chrome/Edge): con File System Access API se sobrescribe el
   fichero real en disco, eligiéndolo una sola vez por sesión.
   iOS/Safari: no existe esa API, así que se descarga siempre con el mismo
   nombre. Como el fichero se reconstruye entero desde el original embebido,
   copiarlo encima del tuyo lo deja correcto sin duplicar nada. */

let fileHandle = null;

const supportsFsa = () => typeof window.showSaveFilePicker === 'function';

/* Aplana el registro en filas ordenadas por fecha y orden del plan. */
function buildRows() {
  const rows = [];
  const data = Store.all();

  for (const date of Object.keys(data.days).sort()) {
    const rec = data.days[date];
    const week = PLAN.weekFor(date);
    if (!week) continue;

    // La columna Bloque identifica el plan: A / B (4 semanas) o Volumen. En el de volumen, la
    // sesión de esa semana con todo lo registrado ese día (aunque la sesión cambiara de día).
    const session = week.plan === 'vol' ? PLAN.sesionDelDia(date, rec.entries)
      : PLAN.sessionsFor(week).find((d) => d.id === rec.sessionId);
    if (!session) continue;

    const label = PLAN.sessionLabel(session, week);   // el sábado de S1 conserva su nombre
    const sessionLabel = label.title ? `${label.name} · ${label.title}` : label.name;

    const first = rows.length;

    session.exercises.forEach((exercise) => {
      const list = rec.entries[exercise.id];
      if (!list || !list.length) return;
      // Lo prescrito con el nivel real (prensa, sentadilla, búlgara, touchdown, carrera).
      const real = typeof Rodilla !== 'undefined' ? Rodilla.prescripcion(exercise, week, date) : null;
      const pres = real || PLAN.presFor(exercise, week);

      list.forEach((s, i) => {
        rows.push([
          date, `Sem ${week.n}`, week.block, sessionLabel, exercise.name,
          exercise.target, i + 1,
          PLAN.sidesFor(exercise, week) ? (s.side || '') : '',
          num(s.kg), num(s.reps), num(s.secs), num(s.mins), num(s.rir),
          pres.label, exercise.notes.length <= 40 ? exercise.notes : '',   // las pautas largas ya están en la hoja del plan
        ]);
      });
    });

    // La nota del día es una sola: va en la primera fila de esa fecha, no
    // repetida al final de cada ejercicio.
    if (rec.notes && rows.length > first) {
      const cell = rows[first][14];
      rows[first][14] = cell ? `${cell} · ${rec.notes}` : rec.notes;
    }
  }
  return rows;
}

function num(v) {
  if (v === '' || v === null || v === undefined) return '';
  const n = Number(v);
  return Number.isFinite(n) ? n : '';
}

function download(bytes) {
  const blob = new Blob([bytes], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = ORIGINAL_XLSX_NAME;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

/* Registro de rodilla tal cual, más el nivel real de carrera y el escalón de cada
   semana ya empezada (columnas I y K del resumen semanal), que calcula la app. */
function kneeParaExportar() {
  const knee = Store.all().knee;
  if (!knee || typeof Rodilla === 'undefined') return knee;
  const weeks = {};
  for (const [sem, rec] of Object.entries(knee.weeks || {})) weeks[sem] = { notes: rec.notes };
  for (const [sem, n] of Object.entries(Rodilla.nivelesReales())) {
    weeks[sem] = { ...weeks[sem], runLevelText: n.runLevel, depthStep: n.depthStep };
  }
  return { ...knee, weeks };
}

/* Devuelve un mensaje describiendo qué ha pasado, para mostrarlo en la UI. */
async function exportXlsx() {
  const rows = buildRows();
  const bytes = buildXlsx(originalXlsxBytes(), rows, kneeParaExportar());

  if (supportsFsa()) {
    try {
      if (!fileHandle) {
        fileHandle = await window.showSaveFilePicker({
          suggestedName: ORIGINAL_XLSX_NAME,
          types: [{
            description: 'Excel',
            accept: { 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'] },
          }],
        });
      }
      const writable = await fileHandle.createWritable();
      await writable.write(bytes);
      await writable.close();
      return `Guardado en ${fileHandle.name} · ${rows.length} series`;
    } catch (e) {
      if (e.name === 'AbortError') return 'Exportación cancelada';
      fileHandle = null;              // handle inservible: al reintentar se vuelve a pedir
      console.warn('Fallo al escribir en disco, descargando', e);
    }
  }

  download(bytes);
  return `Descargado ${ORIGINAL_XLSX_NAME} · ${rows.length} series`;
}

/* Copia de seguridad en crudo, por si hay que reinstalar la app. */
function exportJson() {
  const blob = new Blob([JSON.stringify(Store.all(), null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `gym-registro-${PLAN.isoDate(new Date())}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

async function importJson(file) {
  Store.importAll(JSON.parse(await file.text()));
}
