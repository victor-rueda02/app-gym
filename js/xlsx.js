/* Inyecta una hoja "Registro" en el .xlsx original mediante cirugía sobre el ZIP.
   Las hojas Resumen / Bloque A / Bloque B / Volumen se copian byte a byte: conservan
   colores, anchos y formato al 100%. La operación es idempotente: siempre se
   parte del fichero original embebido, nunca de una exportación previa. */

const SHEET_NAME = 'Registro';
const NS_WS = 'application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml';
const REL_WS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet';

const COLS = [
  ['Fecha', 12], ['Semana', 9], ['Bloque', 8], ['Sesión', 26], ['Ejercicio', 30],
  ['Objetivo', 18], ['Serie', 7], ['Peso (kg)', 10], ['Reps', 7], ['Seg', 7],
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

function cell(ref, value, bold) {
  if (value === null || value === undefined || value === '') return '';
  const style = bold ? ' s="13"' : '';  // xf 13 = cabecera de las tablas de la hoja Volumen (fila 5)
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

/* rows: array de arrays alineado con COLS. Devuelve un Uint8Array (.xlsx). */
function buildXlsx(originalBytes, rows) {
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
