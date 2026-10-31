/* Ejecuta la cadena real de exportación (plan.js -> export.js -> xlsx.js) fuera
   del navegador y escribe ficheros de prueba, para validar el .xlsx sin tocar
   el móvil.
       node tools/test-export.mjs   ->  tools/out/*.xlsx

   Comprueba que la hoja Registro lleva filas de los dos planes (con columna
   Lado), que las hojas Resumen / Bloque A / Bloque B / Volumen salen byte a
   byte iguales, que «Seguimiento rodilla» sale idéntica sin datos y, con
   datos, solo cambian las celdas de entrada (fórmulas y estilos intactos), y
   que openpyxl abre el fichero. Si hay LibreOffice (soffice) recalcula el
   exportado y comprueba resultados de las fórmulas.

   Los scripts se evalúan en el realm principal de Node (no en un vm aislado):
   fflate comprueba `instanceof Uint8Array`, y en un contexto vm los arrays
   vienen de otro realm, así que fallaría la comprobación por un motivo que en
   el navegador —un solo realm— no existe. */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

// El plan se construye desde el Excel empotrado: fflate, original-xlsx y lector antes que plan;
// rodilla-data da las filas de «Seguimiento rodilla» a la exportación.
const src = ['vendor/fflate.js', 'js/original-xlsx.js', 'js/lector-xlsx.js', 'js/plan.js', 'js/rodilla-data.js',
  'js/xlsx.js', 'js/export.js'].map(read).join('\n;\n');

// Store mínimo: buildRows solo necesita Store.all().
// eslint-disable-next-line no-new-func
const load = new Function('__data', `const Store = { all: () => __data };\n${src}
  ;return { buildRows, build: (rows, knee) => buildXlsx(originalXlsxBytes(), rows, knee), buildXlsx, kneeCells, original: originalXlsxBytes(), fflate };`);

const set = (kg, reps, rir, secs = '') => ({ kg, reps, secs, rir });
const cardio = (mins) => ({ kg: '', reps: '', secs: '', rir: '', mins });

// Registro con días de los dos planes: los tres tipos de prescripción del plan
// viejo (rir / fixed / iso), RIR1/0, RIR0 y reps por semana del nuevo, acentos,
// y texto con comillas, < > y & para comprobar el escapado XML.
const DATA = {
  v: 3,
  days: {
    '2026-07-20': {
      sessionId: 'A-L', notes: 'hombro "cargado" <ojo>',
      entries: {
        'laterales-de-pie': [set('12', '14', '2'), set('12', '11', '2')],
        'unilateral-bridge-iso': [set('', '', '', '20')],
        'zercher-squat': [set('40', '12', '')],
      },
    },
    '2026-08-04': {
      sessionId: 'B-2', notes: 'rodilla 2/10 & ok',
      entries: { 'dominadas-neutro': [set('0', '9', '2')] },
    },
    '2026-10-17': {                       // fuera de los dos planes: no se exporta
      sessionId: null, notes: 'suelto', entries: { abs: [set('', '20', '1')] },
    },
    '2026-10-19': {
      sessionId: 'VOL-L', notes: 'primer día de volumen',
      entries: {
        'elev-laterales-polea': [set('9', '15', '1'), set('9', '13', '0')],
        'elev-laterales-mancuerna': [set('10', '12', '0')],
        'prensa-unil-pesado-y-lento-n-1': [set('60', '12', '')],
      },
    },
    '2026-10-20': {                       // martes: el cardio es el último ejercicio
      sessionId: 'VOL-M', notes: '',
      entries: {
        'press-inclinado-barra-30-40': [set('40', '10', '1')],
        'bici-z2-65-75-fc': [cardio('16')],
      },
    },
    '2026-10-26': {                       // S2: unilateral con lado D/I
      sessionId: 'VOL-L', notes: '',
      entries: {
        'prensa-unil-pesado-y-lento-n-1': [{ ...set('60', '12', ''), side: 'D' }, { ...set('60', '11', ''), side: 'I' }],
      },
    },
    '2026-10-24': {
      sessionId: 'VOL-S', notes: '',
      entries: { 'abs-wesley-banco': [set('', '15', '1'), set('', '12', '0')] },
    },
    '2026-12-10': {
      sessionId: 'VOL-J', notes: '',
      entries: { 'sentadilla-al-cajon-o-desde-pines-pesado-y-lento-n-2': [set('70', '8', '')], 'isquios-sentado': [set('45', '10', '1')] },
    },
  },
};

const results = [];
const check = (name, pass, detail = '') => {
  results.push(pass);
  console.log(`${pass ? '  OK  ' : ' FALLO'} ${name}${detail ? ` — ${detail}` : ''}`);
};

const { buildRows, build, buildXlsx, kneeCells, original, fflate } = load(DATA);
const rows = buildRows();

const blocks = [...new Set(rows.map((r) => r[2]))];
check('Registro con filas de los dos planes', ['A', 'B', 'Volumen'].every((b) => blocks.includes(b)),
  blocks.join(', '));
check('Las fechas fuera de plan no se exportan', !rows.some((r) => r[0] === '2026-10-17'));
const lunes = rows.find((r) => r[0] === '2026-10-19' && r[4] === 'Elev laterales polea');
check('Fila del plan nuevo: semana, bloque, sesión y prescripción',
  lunes && lunes[1] === 'Sem 1' && lunes[2] === 'Volumen'
  && lunes[3] === 'Lunes · Rehab + Isquios + Hombro + Gemelo + Espalda (desde S3)' && lunes[13] === '2 @ RIR1/0',
  JSON.stringify(lunes));
// El jueves 10/12 ya no es día de pierna (desde S3 va el viernes): lo registrado ese día se
// exporta igual, al final de la sesión del día.
const squat = rows.find((r) => r[0] === '2026-12-10' && r[4].startsWith('Sentadilla al cajón'));
check('Semana 8: sentadilla al cajón, prescripción con salto de línea intacta',
  squat && squat[1] === 'Sem 8' && squat[13] === '3 x8\nrepite S7',
  squat && squat[13]);
const bici = rows.find((r) => r[0] === '2026-10-20' && r[4].startsWith('Bici Z2'));
check('Cardio: una fila con los minutos en la columna Min',
  bici && bici[5] === 'Cardio' && bici[11] === 16 && bici[8] === '' && bici[13] === '15 min',
  JSON.stringify(bici));
check('Cardio: va tras el ejercicio de fuerza de su sesión',
  rows.findIndex((r) => r[4].startsWith('Bici Z2')) > rows.findIndex((r) => r[4].startsWith('Press inclinado barra')));
check('Cardio: las pautas largas no se repiten en Registro', bici && bici[14] === '', JSON.stringify(bici && bici[14]));
const domingo = rows.find((r) => r[0] === '2026-10-24');
// En S1 el sábado aún tenía pierna: conserva el nombre de entonces.
check('Sábado de S1: sesión «Sábado/Domingo»', domingo && domingo[3] === 'Sábado/Domingo', domingo && domingo[3]);
const julio = rows.find((r) => r[0] === '2026-07-20' && r[4] === 'Laterales de pie');
check('Fila del plan viejo intacta',
  julio && julio[1] === 'Sem 1' && julio[2] === 'A' && julio[13] === '2 @ RIR2', JSON.stringify(julio));

const prensaS1 = rows.find((r) => r[0] === '2026-10-19' && r[4].startsWith('Prensa unil'));
const prensaS2 = rows.filter((r) => r[0] === '2026-10-26' && r[4].startsWith('Prensa unil'));
check('Lado vacío en un unilateral de S1', prensaS1 && prensaS1[7] === '', JSON.stringify(prensaS1));
check('Lado D/I en un unilateral de S2',
  prensaS2.length === 2 && prensaS2[0][7] === 'D' && prensaS2[1][7] === 'I', JSON.stringify(prensaS2.map((r) => r[7])));
check('Lado vacío en un ejercicio bilateral', rows.find((r) => r[4] === 'Isquios sentado')[7] === '');
const lateralBien = rows.every((r) => r.length === 15);
check('Todas las filas de Registro tienen 15 columnas', lateralBien);

const outDir = path.join(root, 'tools', 'out');
fs.mkdirSync(outDir, { recursive: true });

const KNEE = {
  days: {
    '2026-10-26': { decline: 2, steps: 4, during: 1, back60: 'Sí', click: 'No', notes: 'bien "todo" <ok> & más' },
    '2026-10-27': { decline: 3, steps: 5, during: 4, back60: 'No', click: 'Sí', notes: '',
      session: 'Sesión propia', rule: 'Carrera (≤2/10)', novelty: '' },
    '2026-11-05': { decline: 1, steps: 1, session: 'Solo sesión' },
    '2026-12-27': { decline: 0, steps: 0, during: 0, back60: 'Sí', click: 'No', notes: 'último día' },
    '2026-12-28': { decline: 9, notes: 'fuera de calendario' },
    '2026-10-25': { decline: 9, notes: 'fuera de calendario' },
  },
  // runLevelText/depthStep: los niveles reales que añade export.js (kneeParaExportar).
  weeks: { S2: { runLevelText: 'N1', depthStep: 0, notes: 'sem 2' }, S10: { runLevelText: 'Sin entrar', depthStep: 4, notes: 'fin' }, S1: { notes: 'no existe' } },
  // Dos intentos de entrada: va el último (S3), con la fecha de su martes en G89.
  entry: {
    S2: { walkPain: 'No', walkBack60: 'Sí', tdPain: 'Sí', hopsPain: 'Sí', notes: 'primero' },
    S3: { walkPain: 'Sí', walkBack60: 'Sí', tdPain: 'No', notes: 'ok' },
  },
  tests: { t1: { load: 80, repsD: 8, repsI: 9, notes: 't1' }, t4: { load: 100.5, repsD: 5, repsI: 5 } },
  depth: { 0: { angle: 30, press: 40, box: 10, split: 12, touchdown: 'Sí', validated: 'Sí', notes: 'e0' }, 4: { angle: 90, notes: 'e4' } },
};

// Mapa esperado, escrito a mano (independiente de kneeCells).
const SC = {
  G5: 2, H5: 4, J5: 1, K5: 'Sí', L5: 'No', Q5: 'bien "todo" <ok> & más',
  G6: 3, H6: 5, J6: 4, K6: 'No', L6: 'Sí', Q6: '', D6: 'Sesión propia', E6: 'Carrera (≤2/10)', F6: '',
  G15: 1, H15: 1, D15: 'Solo sesión',
  G67: 0, H67: 0, J67: 0, K67: 'Sí', L67: 'No', Q67: 'último día',
  I72: 'N1', K72: 0, M72: 'sem 2', I80: 'Sin entrar', K80: 4, M80: 'fin',
  D89: 'Sí', E89: 'Sí', D90: 'No', I89: 'ok', G89: 46329,   // martes 3/11

  F97: 80, G97: 8, H97: 9, M97: 't1', F100: 100.5, G100: 5, H100: 5,
  D105: 30, E105: 40, F105: 10, G105: 12, I105: 'Sí', K105: 'Sí', M105: 'e0', D109: 90, M109: 'e4',
};

const mapa = kneeCells(KNEE);
const sinOrden = (o) => JSON.stringify(Object.entries(o).sort());
check('kneeCells: mapa de celdas esperado', sinOrden(mapa) === sinOrden(SC),
  sinOrden(mapa) === sinOrden(SC) ? '' : JSON.stringify(mapa));
check('kneeCells: sin knee -> vacío', Object.keys(kneeCells(undefined)).length === 0 && Object.keys(kneeCells({})).length === 0);

const bytes = build(rows);
const file = path.join(outDir, 'test.xlsx');
fs.writeFileSync(file, Buffer.from(bytes));
console.log(`test.xlsx        ${bytes.length} bytes · ${rows.length} filas`);

const bytesKnee = build(rows, KNEE);
const fileKnee = path.join(outDir, 'test-knee.xlsx');
fs.writeFileSync(fileKnee, Buffer.from(bytesKnee));
console.log(`test-knee.xlsx   ${bytesKnee.length} bytes · con datos de rodilla`);

const same = (a, b) => a && b && a.length === b.length && a.every((x, i) => x === b[i]);
const before = fflate.unzipSync(original);
const dec = new TextDecoder();

for (const [label, out] of [['sin knee', bytes], ['con knee', bytesKnee]]) {
  const after = fflate.unzipSync(out);
  for (const n of [1, 2, 3, 4]) {
    const p = `xl/worksheets/sheet${n}.xml`;
    check(`${label}: ${p} idéntica byte a byte`, same(before[p], after[p]), `${before[p].length} bytes`);
  }
  const touched = ['xl/workbook.xml', 'xl/_rels/workbook.xml.rels', '[Content_Types].xml', 'xl/worksheets/sheet5.xml'];
  const changed = Object.keys(before).filter((k) => !touched.includes(k) && !same(before[k], after[k]));
  check(`${label}: el resto de partes originales no cambia`, changed.length === 0, changed.join(', '));
  check(`${label}: workbook.xml lleva fullCalcOnLoad="1"`, /<calcPr\b[^>]*fullCalcOnLoad="1"/.test(dec.decode(after['xl/workbook.xml'])));
  check(`${label}: styles.xml intacto`, same(before['xl/styles.xml'], after['xl/styles.xml']));
}
check('Sin knee: «Seguimiento rodilla» (sheet5) idéntica al original',
  same(before['xl/worksheets/sheet5.xml'], fflate.unzipSync(bytes)['xl/worksheets/sheet5.xml']));
check('Con knee: «Seguimiento rodilla» cambia', !same(before['xl/worksheets/sheet5.xml'], fflate.unzipSync(bytesKnee)['xl/worksheets/sheet5.xml']));

// Idempotencia: mismos bytes al repetir, y reexportar sobre un exportado no duplica nada.
check('Exportar dos veces da bytes iguales', same(build(rows, KNEE), bytesKnee));
const reexp = buildXlsx(bytesKnee, rows, KNEE);
const wbRe = dec.decode(fflate.unzipSync(reexp)['xl/workbook.xml']);
check('Reexportar sobre un exportado: una sola hoja Registro', (wbRe.match(/name="Registro"/g) || []).length === 1);
check('Reexportar sobre un exportado: mismo contenido',
  same(fflate.unzipSync(reexp)['xl/worksheets/sheet5.xml'], fflate.unzipSync(bytesKnee)['xl/worksheets/sheet5.xml'])
  && (wbRe.match(/fullCalcOnLoad/g) || []).length === 1);

// Sin filas: el caso "exporto antes de entrenar nada".
const emptyBytes = build([]);
fs.writeFileSync(path.join(outDir, 'test-empty.xlsx'), Buffer.from(emptyBytes));
console.log(`test-empty.xlsx  ${emptyBytes.length} bytes · 0 filas`);

// openpyxl es la prueba de que un lector real lo abre sin quejarse.
const PY = `
import sys, json, openpyxl
wb = openpyxl.load_workbook(sys.argv[1])
ws = wb["Registro"]
print("|".join(wb.sheetnames))
print(ws.max_row - 1)
print("|".join(sorted({str(ws.cell(r, 3).value) for r in range(2, ws.max_row + 1)})))
print(json.dumps([c.value for c in ws[1]], ensure_ascii=False))
`;
const py = spawnSync('python', ['-X', 'utf8', '-c', PY, file], { encoding: 'utf8' });
if (py.error) {
  check('openpyxl abre el .xlsx', false, `no se pudo lanzar python: ${py.error.message}`);
} else {
  const [sheets, count, pyBlocks, header] = py.stdout.trim().split(/\r?\n/);
  check('openpyxl abre el .xlsx sin errores', py.status === 0, py.stderr.trim().split('\n').pop());
  check('Hojas: las 5 originales + Registro',
    sheets === 'Resumen|Bloque A (20jul-2ago)|Bloque B (3-16ago)|Volumen (1910-1112)|Seguimiento rodilla|Registro', sheets);
  check('openpyxl lee todas las filas de Registro', Number(count) === rows.length, `${count} filas`);
  check('openpyxl ve los bloques A, B y Volumen', pyBlocks === 'A|B|Volumen', pyBlocks);
  const h = JSON.parse(header);
  check('Cabecera de Registro: Lado justo después de Serie', h[6] === 'Serie' && h[7] === 'Lado', h.join(','));
}

// Comparación celda a celda de «Seguimiento rodilla» (original vs. exportado).
const PY2 = `
import sys, json, openpyxl
orig, out, exp = sys.argv[1], sys.argv[2], json.loads(sys.argv[3])
a = openpyxl.load_workbook(orig)["Seguimiento rodilla"]
b = openpyxl.load_workbook(out)["Seguimiento rodilla"]
def norm(v):
    if v is None: return ""
    t = type(v).__name__
    if t == "ArrayFormula": return "ARR:" + v.ref + ":" + str(v.text)
    if t == "datetime":   # celdas con formato de fecha (G89): se comparan como serie de Excel
        import datetime
        return (v - datetime.datetime(1899, 12, 30)).days
    return v
res = {"formulas": 0, "formulaDiff": [], "styleDiff": [], "otherDiff": [], "valueDiff": [], "dims": [a.dimensions, b.dimensions]}
for row in a.iter_rows():
    for ca in row:
        cb = b[ca.coordinate]
        va, vb = norm(ca.value), norm(cb.value)
        isf = isinstance(va, str) and (va.startswith("=") or va.startswith("ARR:"))
        if ca.style_id != cb.style_id: res["styleDiff"].append(ca.coordinate)
        if isf:
            res["formulas"] += 1
            if va != vb: res["formulaDiff"].append(ca.coordinate)
        elif ca.coordinate in exp:
            if vb != exp[ca.coordinate]: res["valueDiff"].append([ca.coordinate, vb, exp[ca.coordinate]])
        elif va != vb:
            res["otherDiff"].append(ca.coordinate)
print(json.dumps(res, ensure_ascii=False))
`;
const origFile = path.join(outDir, 'original.xlsx');
fs.writeFileSync(origFile, Buffer.from(original));
const exp = JSON.stringify(Object.fromEntries(Object.entries(SC)));
const cmp = (out, esperado) => {
  const r = spawnSync('python', ['-X', 'utf8', '-c', PY2, origFile, out, esperado], { encoding: 'utf8' });
  return r.status === 0 ? JSON.parse(r.stdout.trim().split(/\r?\n/).pop()) : { error: r.stderr.trim().split('\n').pop() };
};
const sin = cmp(file, '{}');
check('Sin knee: openpyxl ve «Seguimiento rodilla» idéntica (valores, fórmulas, estilos)',
  !sin.error && !sin.formulaDiff.length && !sin.styleDiff.length && !sin.otherDiff.length, sin.error || '');
const con = cmp(fileKnee, exp);
check('Con knee: openpyxl lee cada valor en su celda',
  !con.error && !con.valueDiff.length, con.error || JSON.stringify(con.valueDiff));
check(`Con knee: las ${con.formulas} fórmulas siguen idénticas (I/M/N/O/P, resúmenes, tests, avisos)`,
  !con.error && con.formulas > 300 && !con.formulaDiff.length, con.error || con.formulaDiff.join(','));
check('Con knee: estilos de todas las celdas iguales a los originales', !con.error && !con.styleDiff.length, (con.styleDiff || []).join(','));
check('Con knee: ninguna otra celda cambia', !con.error && !con.otherDiff.length, (con.otherDiff || []).join(','));

// Recalculo con LibreOffice, si está instalado.
const soffice = ['soffice', 'C:\\Program Files\\LibreOffice\\program\\soffice.exe', 'C:\\Program Files (x86)\\LibreOffice\\program\\soffice.exe']
  .find((c) => !spawnSync(c, ['--version'], { encoding: 'utf8' }).error);
if (!soffice) {
  console.log('  --   LibreOffice (soffice) no encontrado: no se comprueba el recálculo de fórmulas');
} else {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lo-'));
  const r = spawnSync(soffice, ['--headless', '--convert-to', 'xlsx', '--outdir', tmp, fileKnee], { encoding: 'utf8' });
  const conv = path.join(tmp, 'test-knee.xlsx');
  const PY3 = `
import sys, openpyxl
ws = openpyxl.load_workbook(sys.argv[1], data_only=True)["Seguimiento rodilla"]
print(ws["I5"].value, ws["M5"].value, ws["P5"].value, ws["I6"].value, ws["P6"].value)
`;
  const v = spawnSync('python', ['-X', 'utf8', '-c', PY3, conv], { encoding: 'utf8' });
  const [i5, , p5, i6, p6] = v.stdout.trim().split(/\s+/);
  check('LibreOffice recalcula: I5 = MAX(G5,H5) = 4 e I6 = 5', r.status === 0 && i5 === '4' && i6 === '5', v.stdout.trim() || r.stderr);
  console.log(`       P5=${p5} P6=${p6}`);
}

const fallos = results.filter((r) => !r).length;
console.log(`\n${results.length - fallos}/${results.length} comprobaciones OK`);
process.exit(fallos ? 1 : 0);
