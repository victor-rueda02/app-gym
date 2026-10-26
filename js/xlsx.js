/* Cirugía sobre el ZIP del .xlsx original:
   - Inyecta una hoja "Registro" con las series.
   - Rellena las celdas de entrada de la hoja "Seguimiento rodilla" con lo que
     el usuario registró en la app (`knee`). Las fórmulas de esa hoja no se
     tocan (nunca se sobrescribe una celda con <f>) y cada celda conserva su
     estilo; como las fórmulas traen el valor en caché vacío, el libro se marca
     con fullCalcOnLoad para que Excel/Calc las recalcule al abrir.
   Las hojas Resumen / Bloque A / Bloque B / Volumen se copian byte a byte: conservan
   colores, anchos y formato al 100%. La operación es idempotente: siempre se
   parte del fichero original embebido, nunca de una exportación previa. */

const SHEET_NAME = 'Registro';
const NS_WS = 'application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml';
const KNEE_SHEET = 'Seguimiento rodilla';
const KNEE_FIRST_DAY = Date.UTC(2026, 9, 26);   // 26/10/2026 = fila 5
const KNEE_DAYS = 63;                           // 26/10 ... 27/12 (filas 5..67)
const REL_WS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet';

const COLS = [
  ['Fecha', 12], ['Semana', 9], ['Bloque', 8], ['Sesión', 26], ['Ejercicio', 30],
  ['Objetivo', 18], ['Serie', 7], ['Lado', 6], ['Peso (kg)', 10], ['Reps', 7], ['Seg', 7],
  ['Min', 7], ['RIR', 6], ['Prescrito', 12], ['Notas', 28],
];

const esc = (s) => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '');  // control chars: XML 1.0 no los admite

function colName(i) {
  let s = '';
  for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) {
    s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  }
  return s;
}

function cell(ref, value, bold, xf) {
  if (value === null || value === undefined || value === '') return '';
  const style = bold ? ' s="12"' : (xf ? ` s="${xf}"` : '');  // xf 12 = cabecera de las tablas de la hoja Volumen (fila 5)
  if (typeof value === 'number' && Number.isFinite(value)) {
    return `<c r="${ref}"${style}><v>${value}</v></c>`;
  }
  return `<c r="${ref}"${style} t="inlineStr"><is><t xml:space="preserve">${esc(value)}</t></is></c>`;
}

function sheetXml(rows) {
  const cells = (values, r, bold) =>
    values.map((v, i) => cell(colName(i) + r, v, bold)).join('');

  const cols = COLS.map((c, i) => `<col min="${i + 1}" max="${i + 1}" width="${c[1]}" customWidth="1"/>`).join('');
  const header = `<row r="1">${cells(COLS.map((c) => c[0]), 1, true)}</row>`;
  const body = rows.map((row, i) => `<row r="${i + 2}">${cells(row, i + 2, false)}</row>`).join('');

  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    `<dimension ref="A1:${colName(COLS.length - 1)}${rows.length + 1}"/>` +
    '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>' +
    '<sheetFormatPr defaultRowHeight="15"/>' +
    `<cols>${cols}</cols>` +
    `<sheetData>${header}${body}</sheetData>` +
    `<autoFilter ref="A1:${colName(COLS.length - 1)}${rows.length + 1}"/>` +
    '</worksheet>';
}

/* ---- Hoja "Seguimiento rodilla" ---------------------------------------- */

/* Campos de cada sección -> columna. Las filas se calculan por sección. */
const KNEE_DAY_COLS = {
  decline: 'G', steps: 'H', during: 'J', back60: 'K', click: 'L', notes: 'Q',
  session: 'D', rule: 'E', novelty: 'F',
};
// runLevelText y depthStep son los niveles reales que calcula la app (export.js los añade).
const KNEE_WEEK_COLS = { runLevelText: 'I', depthStep: 'K', notes: 'M' };
// Entrada a la carrera: la hoja tiene sitio para un intento, así que va el último
// (la semana más alta con datos). G89 = fecha del martes de esa semana.
const KNEE_ENTRY_CELLS = {
  walkPain: 'D89', walkBack60: 'E89', tdPain: 'D90', hopsPain: 'D91', notes: 'I89',
};
const KNEE_TEST_ROWS = { t1: 97, t2: 98, t3: 99, t4: 100 };
const KNEE_TEST_COLS = { load: 'F', repsD: 'G', repsI: 'H', notes: 'M' };
const KNEE_DEPTH_COLS = {
  angle: 'D', press: 'E', box: 'F', split: 'G', touchdown: 'I', validated: 'K', notes: 'M',
};

/* Fila de un día (YYYY-MM-DD) en la hoja; null si cae fuera del calendario. */
function kneeDayRow(date) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!m) return null;
  const diff = Math.round((Date.UTC(+m[1], +m[2] - 1, +m[3]) - KNEE_FIRST_DAY) / 86400000);
  return diff >= 0 && diff < KNEE_DAYS ? 5 + diff : null;
}

/* Fila de una semana 'S2'..'S10' (filas 72..80); null si no es válida. */
function kneeWeekRow(key) {
  const m = /^S(\d+)$/.exec(key);
  const n = m ? +m[1] : 0;
  return n >= 2 && n <= 10 ? 70 + n : null;
}

/* knee -> { 'G5': valor, ... }. Pura: no toca el ZIP, se prueba sola.
   Solo salen los campos presentes en `knee` (los ausentes dejan la celda como
   está); '' vacía la celda. */
function kneeCells(knee) {
  const out = {};
  if (!knee || typeof knee !== 'object') return out;

  const put = (cols, row, rec) => {
    if (row === null || row === undefined || !rec || typeof rec !== 'object') return;
    for (const [field, col] of Object.entries(cols)) {
      const v = rec[field];
      if (v === undefined || v === null) continue;
      if (typeof v === 'number' && !Number.isFinite(v)) continue;
      out[col + row] = v;
    }
  };

  for (const [date, rec] of Object.entries(knee.days || {})) put(KNEE_DAY_COLS, kneeDayRow(date), rec);
  for (const [key, rec] of Object.entries(knee.weeks || {})) put(KNEE_WEEK_COLS, kneeWeekRow(key), rec);
  const intentos = Object.keys(knee.entry || {}).filter((k) => kneeWeekRow(k) && kneeWeekRow(k) <= 78)
    .sort((a, b) => kneeWeekRow(a) - kneeWeekRow(b));
  if (intentos.length) {
    const sem = intentos[intentos.length - 1];
    const rec = knee.entry[sem] || {};
    for (const [field, ref] of Object.entries(KNEE_ENTRY_CELLS)) {
      if (typeof rec[field] === 'string') out[ref] = rec[field];
    }
    // Serie de Excel del martes de esa semana (27/10/2026 = 46322, S2).
    out.G89 = 46322 + 7 * (kneeWeekRow(sem) - 72);
  }
  for (const [key, rec] of Object.entries(knee.tests || {})) put(KNEE_TEST_COLS, KNEE_TEST_ROWS[key], rec);
  for (const [key, rec] of Object.entries(knee.depth || {})) put(KNEE_DEPTH_COLS, /^[0-4]$/.test(key) ? 105 + +key : null, rec);
  return out;
}

const colIndex = (letters) => [...letters].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0);

/* Parchea el XML de una hoja con { ref: valor }, conservando el estilo `s` de
   cada celda. No sobrescribe celdas con fórmula; si la celda no existe la
   inserta en su fila en orden de columnas; si la fila no existe, se ignora. */
function patchSheetXml(xml, cells) {
  for (const [ref, value] of Object.entries(cells)) {
    const [, col, rowN] = /^([A-Z]+)(\d+)$/.exec(ref);
    const rowRe = new RegExp(`(<row r="${rowN}"[^>]*>)([\\s\\S]*?)(</row>)`);
    xml = xml.replace(rowRe, (all, open, inner, close) => {
      const cellRe = /<c r="([A-Z]+)\d+"([^>]*?)(?:\/>|>[\s\S]*?<\/c>)/g;
      let found = null;
      let insertAt = inner.length;
      for (let m; (m = cellRe.exec(inner));) {
        if (m[1] === col) { found = m; break; }
        if (colIndex(m[1]) > colIndex(col) && insertAt === inner.length) insertAt = m.index;
      }
      if (found) {
        if (found[0].includes('<f')) return all;                 // fórmula: intocable
        const style = (found[2].match(/\ss="(\d+)"/) || [])[1];
        const fresh = cell(ref, value, false, style) || `<c r="${ref}"${style ? ` s="${style}"` : ''}/>`;
        return open + inner.slice(0, found.index) + fresh + inner.slice(found.index + found[0].length) + close;
      }
      return open + inner.slice(0, insertAt) + cell(ref, value, false) + inner.slice(insertAt) + close;
    });
  }
  return xml;
}

/* Ruta (dentro del ZIP) de la hoja con ese nombre, según workbook.xml y sus rels. */
function sheetPathByName(workbook, rels, name) {
  const sheet = workbook.match(new RegExp(`<sheet\\b[^>]*name="${name}"[^>]*/>`));
  const rid = sheet && (sheet[0].match(/r:id="([^"]+)"/) || [])[1];
  if (!rid) return null;
  const rel = rels.match(new RegExp(`<Relationship\\b[^>]*Id="${rid}"[^>]*/>`));
  const target = rel && (rel[0].match(/Target="([^"]+)"/) || [])[1];
  if (!target) return null;
  return target.startsWith('/') ? target.slice(1) : `xl/${target}`;
}

/* Marca el libro para recalcular todas las fórmulas al abrirlo. */
function forceFullCalc(workbook) {
  const m = workbook.match(/<calcPr\b[^>]*?\/>/);
  if (!m) return workbook.replace('</workbook>', '<calcPr fullCalcOnLoad="1"/></workbook>');
  const tag = /\sfullCalcOnLoad="[^"]*"/.test(m[0])
    ? m[0].replace(/\sfullCalcOnLoad="[^"]*"/, ' fullCalcOnLoad="1"')
    : m[0].replace('<calcPr', '<calcPr fullCalcOnLoad="1"');
  return workbook.replace(m[0], tag);
}

/* Quita cualquier rastro de una hoja "Registro" previa, para que reexportar
   sobre un fichero ya exportado no duplique la hoja. */
function dropExisting(workbook, rels, types, files) {
  const m = workbook.match(new RegExp(`<sheet[^>]*name="${SHEET_NAME}"[^>]*/>`));
  if (!m) return { workbook, rels, types };
  const rid = (m[0].match(/r:id="([^"]+)"/) || [])[1];
  const target = rid && (rels.match(new RegExp(`<Relationship[^>]*Id="${rid}"[^>]*/>`)) || [])[0];
  if (target) {
    const path = ((target.match(/Target="([^"]+)"/) || [])[1] || '').replace(/^\//, '');
    delete files[path.startsWith('xl/') ? path : `xl/${path}`];
    rels = rels.replace(target, '');
    types = types.replace(new RegExp(`<Override PartName="/${path.startsWith('xl/') ? path : `xl/${path}`}"[^>]*/>`), '');
  }
  return { workbook: workbook.replace(m[0], ''), rels, types };
}

/* rows: array de arrays alineado con COLS; knee: Store.all().knee (opcional).
   Devuelve un Uint8Array (.xlsx). */
function buildXlsx(originalBytes, rows, knee) {
  const dec = new TextDecoder();
  const encText = (s) => new TextEncoder().encode(s);
  const files = fflate.unzipSync(originalBytes);

  let workbook = dec.decode(files['xl/workbook.xml']);
  let rels = dec.decode(files['xl/_rels/workbook.xml.rels']);
  let types = dec.decode(files['[Content_Types].xml']);
  ({ workbook, rels, types } = dropExisting(workbook, rels, types, files));

  // IDs libres, calculados sobre lo que queda tras la limpieza
  const usedRid = [...rels.matchAll(/Id="rId(\d+)"/g)].map((x) => +x[1]);
  const rid = `rId${Math.max(0, ...usedRid) + 1}`;
  const usedSid = [...workbook.matchAll(/sheetId="(\d+)"/g)].map((x) => +x[1]);
  const sheetId = Math.max(0, ...usedSid) + 1;
  const usedNum = [...Object.keys(files)]
    .map((k) => (k.match(/^xl\/worksheets\/sheet(\d+)\.xml$/) || [])[1])
    .filter(Boolean).map(Number);
  const path = `xl/worksheets/sheet${Math.max(0, ...usedNum) + 1}.xml`;

  // Hoja de rodilla: se localiza por nombre y solo se parchea si hay datos.
  const kneePath = sheetPathByName(workbook, rels, KNEE_SHEET);
  const kneeData = kneeCells(knee);
  if (kneePath && files[kneePath] && Object.keys(kneeData).length) {
    files[kneePath] = encText(patchSheetXml(dec.decode(files[kneePath]), kneeData));
  }
  workbook = forceFullCalc(workbook);

  files[path] = encText(sheetXml(rows));
  files['xl/workbook.xml'] = encText(workbook.replace(
    '</sheets>',
    `<sheet xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"` +
    ` name="${SHEET_NAME}" sheetId="${sheetId}" state="visible" r:id="${rid}"/></sheets>`,
  ));
  files['xl/_rels/workbook.xml.rels'] = encText(rels.replace(
    '</Relationships>',
    `<Relationship Type="${REL_WS}" Target="/${path}" Id="${rid}"/></Relationships>`,
  ));
  files['[Content_Types].xml'] = encText(types.replace(
    '</Types>',
    `<Override PartName="/${path}" ContentType="${NS_WS}"/></Types>`,
  ));

  return fflate.zipSync(files, { level: 6 });
}
