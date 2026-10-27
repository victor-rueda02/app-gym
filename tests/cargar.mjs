/* Carga en Node los scripts de la app (son scripts globales del navegador, sin módulos) y
   devuelve los globales pedidos. Se evalúan en el realm principal, como en el navegador:
   fflate comprueba `instanceof Uint8Array`, que fallaría con arrays de otro realm (vm).
       const { PLAN } = cargar(['PLAN']);                    // plan y lo que necesita
       const { RodillaCalc } = cargar(['RodillaCalc'], { rodilla: true }); */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
export const leer = (f) => fs.readFileSync(path.join(root, f), 'utf8');

// El plan se construye al cargar a partir del Excel empotrado: estos van siempre, en este orden.
const BASE = ['vendor/fflate.js', 'js/original-xlsx.js', 'js/lector-xlsx.js', 'js/plan.js'];
const RODILLA = ['js/rodilla-data.js', 'js/rodilla-calc.js'];

export function cargar(nombres, { rodilla = false, extra = [], previo = '' } = {}) {
  const src = [...BASE, ...(rodilla ? RODILLA : []), ...extra].map(leer).join('\n;\n');
  // eslint-disable-next-line no-new-func
  return new Function(`${previo}\n${src}\n;return { ${nombres.join(', ')} };`)();
}
