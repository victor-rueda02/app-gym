/* El lector de .xlsx de la app (js/lector-xlsx.js) lee el Excel empotrado igual que
   openpyxl: se compara celda a celda con docs/plan-rodilla/volcado.json (que genera
   tools/volcado_excel.py con openpyxl). Sin dependencias.
       node tests/lector.test.mjs */
import assert from 'node:assert/strict';
import { leer } from './cargar.mjs';

const src = ['vendor/fflate.js', 'js/original-xlsx.js', 'js/lector-xlsx.js'].map(leer).join('\n;\n');
const { LectorXlsx, originalXlsxBytes } = new Function(`${src}\n;return { LectorXlsx, originalXlsxBytes };`)();

let fallos = 0;
const test = (name, fn) => {
  try { fn(); console.log(`  OK  ${name}`); } catch (e) { fallos++; console.log(` FALLO ${name}\n        ${e.message}`); }
};

const libro = LectorXlsx.leer(originalXlsxBytes());
const volcado = JSON.parse(leer('docs/plan-rodilla/volcado.json'));

test('lee todas las hojas del libro', () => {
  assert.deepEqual(Object.keys(libro), ['Resumen', 'Bloque A (20jul-2ago)', 'Bloque B (3-16ago)',
    'Volumen (1910-1112)', 'Seguimiento rodilla']);
});

for (const [hoja, celdas] of Object.entries(volcado)) {
  test(`«${hoja}»: cada celda con valor, igual que openpyxl (textos con saltos de línea, números y fechas)`, () => {
    let n = 0;
    for (const [ref, c] of Object.entries(celdas)) {
      if (c.f) continue;   // fórmulas: el libro se guarda sin calcular
      let a = libro[hoja][ref];
      let e = c.v;
      if (typeof e === 'string' && /^\d{4}-\d\d-\d\dT/.test(e)) {   // fechas: openpyxl da datetime, el lector la serie
        e = e.slice(0, 10);
        a = LectorXlsx.fecha(a);
      }
      assert.deepEqual(a, e, `${ref}`);
      n++;
    }
    assert.ok(n > 300, `solo ${n} celdas`);
  });
}

test('fecha: serie de Excel -> ISO', () => {
  assert.equal(LectorXlsx.fecha(46321), '2026-10-26');
  assert.equal(LectorXlsx.fecha(46322), '2026-10-27');
});

console.log(fallos ? `\n${fallos} fallo(s)` : '\nTodo OK');
process.exit(fallos ? 1 : 0);
