/* Ejecuta la cadena real de exportación (plan.js -> xlsx.js) fuera del navegador
   y escribe ficheros de prueba, para validar el .xlsx sin tocar el móvil.
       node tools/test-export.mjs   ->  tools/out/*.xlsx

   Los scripts se evalúan en el realm principal de Node (no en un vm aislado):
   fflate comprueba `instanceof Uint8Array`, y en un contexto vm los arrays
   vienen de otro realm, así que fallaría la comprobación por un motivo que en
   el navegador —un solo realm— no existe. */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

const src = ['vendor/fflate.js', 'js/plan.js', 'js/original-xlsx.js', 'js/xlsx.js']
  .map(read).join('\n;\n');

// eslint-disable-next-line no-new-func
const run = new Function('__rows', `${src}\n;return buildXlsx(originalXlsxBytes(), __rows);`);

// Filas que cubren los tres tipos de prescripción (rir / fixed / iso), acentos,
// y texto con comillas y < > para comprobar el escapado XML.
const rows = [
  ['2026-07-20', 'Sem 1', 'A', 'Lunes · Rehab + Isquios + Hombro', 'Laterales', 'Hombro lat.', 1, 12, 14, '', 2, '2 @ RIR2', ''],
  ['2026-07-20', 'Sem 1', 'A', 'Lunes · Rehab + Isquios + Hombro', 'Laterales', 'Hombro lat.', 2, 12, 11, '', 2, '2 @ RIR2', 'hombro "cargado" <ojo>'],
  ['2026-07-20', 'Sem 1', 'A', 'Lunes · Rehab + Isquios + Hombro', 'Unilateral Bridge iso', 'Rehab', 1, '', '', 20, '', '2 (20 s)', 'fijo'],
  ['2026-07-20', 'Sem 1', 'A', 'Lunes · Rehab + Isquios + Hombro', 'Zercher squat', 'Rehab', 1, 40, 12, '', '', '3 x12', 'tempo controlado'],
  ['2026-08-04', 'Sem 3', 'B', 'Día 2 · Rehab + Pull mínimo', 'Dominadas neutro', 'Espalda', 1, 0, 9, '', 2, '2 @ RIR2', 'rodilla 2/10 & ok'],
];

const outDir = path.join(root, 'tools', 'out');
fs.mkdirSync(outDir, { recursive: true });

const bytes = run(rows);
fs.writeFileSync(path.join(outDir, 'test.xlsx'), Buffer.from(bytes));
console.log(`test.xlsx        ${bytes.length} bytes · ${rows.length} filas`);

// Sin filas: el caso "exporto antes de entrenar nada".
const emptyBytes = run([]);
fs.writeFileSync(path.join(outDir, 'test-empty.xlsx'), Buffer.from(emptyBytes));
console.log(`test-empty.xlsx  ${emptyBytes.length} bytes · 0 filas`);
