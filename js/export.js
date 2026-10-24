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

    // La columna Bloque identifica el plan: A / B (4 semanas) o Volumen.
    const session = PLAN.sessionsFor(week).find((d) => d.id === rec.sessionId);
    if (!session) continue;

    const sessionLabel = session.title ? `${session.name} · ${session.title}` : session.name;

    const first = rows.length;

    session.exercises.forEach((exercise) => {
      const list = rec.entries[exercise.id];
      if (!list || !list.length) return;
      const pres = PLAN.presFor(exercise, week);

      list.forEach((s, i) => {
        rows.push([
          date, `Sem ${week.n}`, week.block, sessionLabel, exercise.name,
          exercise.target, i + 1,
          num(s.kg), num(s.reps), num(s.secs), num(s.mins), num(s.rir),
          pres.label, exercise.notes.length <= 40 ? exercise.notes : '',   // las pautas largas ya están en la hoja del plan
        ]);
      });
    });

    // La nota del día es una sola: va en la primera fila de esa fecha, no
    // repetida al final de cada ejercicio.
    if (rec.notes && rows.length > first) {
      const cell = rows[first][13];
      rows[first][13] = cell ? `${cell} · ${rec.notes}` : rec.notes;
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

/* Devuelve un mensaje describiendo qué ha pasado, para mostrarlo en la UI. */
async function exportXlsx() {
  const rows = buildRows();
  const bytes = buildXlsx(originalXlsxBytes(), rows);

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
