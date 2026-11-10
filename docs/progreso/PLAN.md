# Plan · 1RM estimado y pantalla Progreso

Rama `progreso-1rm` (desde `main`). Decisiones en `DECISIONES.md`, sección
«Progreso y 1RM estimado (10/11)».

## Lo que hay (reconocimiento)

- **Registro.** `js/store.js`: `localStorage['gym.log.v1']` (espejo en IndexedDB), versión 5.
  `days['YYYY-MM-DD'].entries[exId] = [{ kg, reps, secs, rir, mins, side? }]`. Los valores se
  guardan como **texto** tal cual se teclean (coma ya cambiada por punto, `''` = vacío). Solo
  se guardan las series con algo escrito (`isLogged`: kg, reps, secs o mins).
- **Calentamiento:** la app no lo distingue (no hay campo ni fila de calentamiento).
- **D/I:** `side: 'D' | 'I'` en los ejercicios con `exercise.sides` desde S2 del plan de volumen
  (hoy solo rehab con prescripción fija: prensa unilateral, búlgara, touchdown, abducción).
- **RIR:** columna solo en los ejercicios con prescripción `kind: 'rir'`
  (`js/plan.js`, `parsePres`); objetivo por serie en `pres.rir` / `pres.rirs`.
- **Filas de series:** `js/app.js`, `renderExercise` → `addRow`; rejilla
  `30px [44px lado] 1fr×columnas 40px` (`css/styles.css`, `.set-row`). Se guarda al teclear.
- **Grupo muscular:** `exercise.target`; cuenta como hipertrofia solo si es exactamente uno de
  `PLAN.VOL_GRUPOS` (10 grupos). Rehab, Test, Cardio y «Hombro/Codo (correctivo)» no cuentan.
  Objetivo semanal: `PLAN.seriesPorGrupo(n)` (TOTAL 52 → 88 de S1 a S8).
- **Planes:** julio (`PLAN.BLOCK_A/B`, prescripción `s1/s2`) y volumen (`PLAN.BLOCK_VOL`,
  `pres[0..7]`), semanas que empiezan en lunes (`PLAN.weekFor`).
- **Rodilla:** módulo presente (`js/rodilla*.js`): `RodillaCalc.tablaDias`, `resumenes`
  (molestia media de la mañana por semana) y `calcularTest` (simetría D/I).
- **Infra:** sin build ni librería de gráficas; scripts globales en `index.html`;
  service worker `sw.js` con lista `ASSETS` y `CACHE` = huella que recalcula
  `python tools/excel_app.py --solo-cache`. Tests Node sin dependencias en `tests/*.test.mjs`
  (cargador `tests/cargar.mjs`); Playwright en `node_modules` para pruebas de UI.
- **Tema:** oscuro fijo (variables en `:root` de `css/styles.css`).

## Reparto

| Fase | Quién | Archivos que toca | Nada más |
|---|---|---|---|
| 0 | orquestador | `docs/progreso/PLAN.md`, `DECISIONES.md`, `index.html` (pestaña y scripts), `sw.js` (ASSETS), `js/app.js` (solo la rama `progress` de `render`), `css/styles.css` (tabbar), stubs `js/progreso-calc.js`, `js/progreso.js`, `css/progreso.css` | |
| 1 | subagente L | `js/progreso-calc.js`, `tests/progreso-calc.test.mjs` | |
| 2A | subagente A | `js/app.js` (`renderExercise`/`addRow`), `css/styles.css` (`.set-row`) | no toca progreso* |
| 2B | subagente B | `js/progreso.js`, `css/progreso.css`, `tests/progreso-ui.mjs` | no toca app.js ni styles.css |
| 3 | orquestador + subagente V | lectura; arreglos devueltos al autor | |
| 4 | orquestador | `DECISIONES.md`, `sw.js` (CACHE), informe | |

2A y 2B van en paralelo: archivos disjuntos.

## Contrato de `ProgresoCalc` (js/progreso-calc.js)

Objeto global, funciones puras (sin DOM, sin Store, sin PLAN global: el plan entra por parámetro).

- `num(v)` → número o `null` (acepta `'72.5'`, `'72,5'`, `72.5`; `''`/inválido → `null`).
- `estimar1RM(kg, reps, rir)` → `{ valor, repsEf, formula, sinRir }`; `valor` redondeado a 0,5 o `null`.
- `fmt1RM(r)` → `'~106,5'` o `'—'`.
- `catalogo(sesiones)` → `{ [exId]: { id, name, target, conCarga, conRir, hipertrofia, sides } }`.
- `semanaDe(fecha)` → lunes `'YYYY-MM-DD'`.
- `seriesConCarga(data, cat)`, `mejor1RMPorDia(data, cat, exId)`, `ejerciciosConDatos`,
  `records`, `progresion`, `volumenSemanal(data, cat, grupos)`, `rirMedioSemanal`,
  `rirPrescrito(sesiones, n, grupos)`, `cumplimiento(hechas, planificadas)`.
