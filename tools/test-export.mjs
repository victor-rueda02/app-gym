/* Ejecuta la cadena real de exportación (plan.js -> export.js -> xlsx.js) fuera
   del navegador y escribe ficheros de prueba, para validar el .xlsx sin tocar
   el móvil.
       node tools/test-export.mjs   ->  tools/out/*.xlsx

   Comprueba que la hoja Registro lleva filas de los dos planes, que las 4
   hojas originales salen byte a byte iguales y que openpyxl abre el fichero.

   Los scripts se evalúan en el realm principal de Node (no en un vm aislado):
   fflate comprueba `instanceof Uint8Array`, y en un contexto vm los arrays
   vienen de otro realm, así que fallaría la comprobación por un motivo que en
   el navegador —un solo realm— no existe. */

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

const src = ['vendor/fflate.js', 'js/plan.js', 'js/original-xlsx.js', 'js/xlsx.js', 'js/export.js']
  .map(read).join('\n;\n');

// Store mínimo: buildRows solo necesita Store.all().
// eslint-disable-next-line no-new-func
const load = new Function('__data', `const Store = { all: () => __data };\n${src}
  ;return { buildRows, build: (rows) => buildXlsx(originalXlsxBytes(), rows), original: originalXlsxBytes(), fflate };`);

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
        'prensa-unil': [set('60', '12', '')],
      },
    },
    '2026-10-20': {                       // martes: el cardio es el último ejercicio
      sessionId: 'VOL-M', notes: '',
      entries: {
        'press-inclinado-barra-30-40': [set('40', '10', '1')],
        'bici-z2-65-75-fc': [cardio('16')],
      },
    },
    '2026-10-24': {
      sessionId: 'VOL-S', notes: '',
      entries: { 'abs-wesley-banco': [set('', '15', '1'), set('', '12', '0')] },
    },
    '2026-12-10': {
      sessionId: 'VOL-J', notes: '',
      entries: { 'back-squat': [set('70', '8', '')], 'isquios-sentado': [set('45', '10', '1')] },
    },
  },
};

const results = [];
const check = (name, pass, detail = '') => {
  results.push(pass);
  console.log(`${pass ? '  OK  ' : ' FALLO'} ${name}${detail ? ` — ${detail}` : ''}`);
};

const { buildRows, build, original, fflate } = load(DATA);
const rows = buildRows();

const blocks = [...new Set(rows.map((r) => r[2]))];
check('Registro con filas de los dos planes', ['A', 'B', 'Volumen'].every((b) => blocks.includes(b)),
  blocks.join(', '));
check('Las fechas fuera de plan no se exportan', !rows.some((r) => r[0] === '2026-10-17'));
const lunes = rows.find((r) => r[0] === '2026-10-19' && r[4] === 'Elev laterales polea');
check('Fila del plan nuevo: semana, bloque, sesión y prescripción',
  lunes && lunes[1] === 'Sem 1' && lunes[2] === 'Volumen'
  && lunes[3] === 'Lunes · Rehab + Isquios + Hombro + Gemelo' && lunes[12] === '2 @ RIR1/0',
  JSON.stringify(lunes));
const squat = rows.find((r) => r[0] === '2026-12-10' && r[4] === 'Back squat');
check('Semana 8: Back squat 3 x8', squat && squat[1] === 'Sem 8' && squat[12] === '3 x8',
  squat && squat[12]);
const bici = rows.find((r) => r[0] === '2026-10-20' && r[4].startsWith('Bici Z2'));
check('Cardio: una fila con los minutos en la columna Min',
  bici && bici[5] === 'Cardio' && bici[10] === 16 && bici[7] === '' && bici[12] === '15 min',
  JSON.stringify(bici));
check('Cardio: va tras el ejercicio de fuerza de su sesión',
  rows.findIndex((r) => r[4].startsWith('Bici Z2')) > rows.findIndex((r) => r[4].startsWith('Press inclinado barra')));
check('Cardio: las pautas largas no se repiten en Registro', bici && bici[13] === '', JSON.stringify(bici && bici[13]));
const domingo = rows.find((r) => r[0] === '2026-10-24');
check('Sábado/Domingo: sesión sin título', domingo && domingo[3] === 'Sábado/Domingo', domingo && domingo[3]);
const julio = rows.find((r) => r[0] === '2026-07-20' && r[4] === 'Laterales de pie');
check('Fila del plan viejo intacta',
  julio && julio[1] === 'Sem 1' && julio[2] === 'A' && julio[12] === '2 @ RIR2', JSON.stringify(julio));

const outDir = path.join(root, 'tools', 'out');
fs.mkdirSync(outDir, { recursive: true });

const bytes = build(rows);
const file = path.join(outDir, 'test.xlsx');
fs.writeFileSync(file, Buffer.from(bytes));
console.log(`test.xlsx        ${bytes.length} bytes · ${rows.length} filas`);

// Las partes originales salen igual, salvo las tres que registran la hoja nueva.
const before = fflate.unzipSync(original);
const after = fflate.unzipSync(bytes);
const same = (a, b) => a && b && a.length === b.length && a.every((x, i) => x === b[i]);
for (let n = 1; n <= 4; n++) {
  const p = `xl/worksheets/sheet${n}.xml`;
  check(`${p} idéntica byte a byte`, same(before[p], after[p]), `${before[p].length} bytes`);
}
const touched = ['xl/workbook.xml', 'xl/_rels/workbook.xml.rels', '[Content_Types].xml'];
const changed = Object.keys(before).filter((k) => !touched.includes(k) && !same(before[k], after[k]));
check('El resto de partes originales no cambia', changed.length === 0, changed.join(', '));

// Sin filas: el caso "exporto antes de entrenar nada".
const emptyBytes = build([]);
fs.writeFileSync(path.join(outDir, 'test-empty.xlsx'), Buffer.from(emptyBytes));
console.log(`test-empty.xlsx  ${emptyBytes.length} bytes · 0 filas`);

// openpyxl es la prueba de que un lector real lo abre sin quejarse.
const PY = `
import sys, openpyxl
wb = openpyxl.load_workbook(sys.argv[1])
ws = wb["Registro"]
print("|".join(wb.sheetnames))
print(ws.max_row - 1)
print("|".join(sorted({str(ws.cell(r, 3).value) for r in range(2, ws.max_row + 1)})))
`;
const py = spawnSync('python', ['-X', 'utf8', '-c', PY, file], { encoding: 'utf8' });
if (py.error) {
  check('openpyxl abre el .xlsx', false, `no se pudo lanzar python: ${py.error.message}`);
} else {
  const [sheets, count, pyBlocks] = py.stdout.trim().split(/\r?\n/);
  check('openpyxl abre el .xlsx sin errores', py.status === 0, py.stderr.trim().split('\n').pop());
  check('Hojas: las 4 originales + Registro',
    sheets === 'Resumen|Bloque A (20jul-2ago)|Bloque B (3-16ago)|Volumen (1910-1112)|Registro', sheets);
  check('openpyxl lee todas las filas de Registro', Number(count) === rows.length, `${count} filas`);
  check('openpyxl ve los bloques A, B y Volumen', pyBlocks === 'A|B|Volumen', pyBlocks);
}

const fallos = results.filter((r) => !r).length;
console.log(`\n${results.length - fallos}/${results.length} comprobaciones OK`);
process.exit(fallos ? 1 : 0);
