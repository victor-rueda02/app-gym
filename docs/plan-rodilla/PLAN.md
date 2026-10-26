# Plan rodilla · reparto de tareas

Rama `plan-rodilla` (desde `main`). Un commit por fase.

## Entradas (en esta carpeta)

- `cambios_para_app_plan_rodilla.md`: especificación (manda en la lógica).
- `Plan_8sem_vol_definitivo_con_cardio.xlsx`: Excel nuevo (manda en los valores).
- `volcado.json`: todas las celdas con valor de «Volumen (1910-1112)» y
  «Seguimiento rodilla», con `v` (valor calculado) y `f` (fórmula).
- `diff_por_ejercicio.txt`: cambios de la hoja Volumen por sesión y ejercicio
  frente a la versión anterior (commit `c3ece19`). Es la fuente de verdad de la
  Fase 2. `diff_volumen.txt/json` es el mismo diff por posición de celda (las
  filas se desplazan, así que tiene ruido).
- Se regeneran con `python tools/volcado_excel.py`.

## Cómo está hecha la app (resumen del reconocimiento)

- PWA estática, sin build: `index.html` carga `vendor/fflate.js` y `js/*.js`
  como scripts globales (sin módulos). Comentarios e interfaz en español.
- `js/plan.js`: el plan transcrito a mano. `BLOCK_VOL` = sesiones L/M/X/J/V/S;
  cada ejercicio es `vx(nombre, objetivo, [8 textos de celda C–J], nota K)`.
  `parsePres` convierte el texto de la celda en prescripción y falla ante un
  formato desconocido. El id del ejercicio es `slug(nombre)`. El cardio (bici)
  va como último ejercicio de M y V con objetivo `Cardio` (barra azul).
- `js/store.js`: localStorage `gym.log.v1` + espejo IndexedDB. `VERSION = 3` y
  `MIGRATIONS` por versión, que recolocan entradas al renombrar ejercicios.
- `js/app.js`: pestañas Hoy / Plan / Datos, detalle de ejercicio con series
  (kg/reps/RIR, seg, min) y cronómetro único (`js/timer.js`).
- Exportación: `js/original-xlsx.js` lleva el .xlsx empotrado en base64
  (`tools/embed.py`); `js/xlsx.js` añade una hoja `Registro` copiando el resto
  byte a byte; `js/export.js` construye las filas.
- `sw.js`: caché `gym-v4` con lista fija de ASSETS.
- Pruebas: `tools/verify_plan.py` (plan.js vs hoja Volumen),
  `tools/test-export.mjs` (Node + openpyxl), `tools/test-migracion.mjs` y
  `tools/e2e.mjs` (Playwright, no instalado).

## Fases y propiedad de archivos

### Fase 1 · Modelo de datos (P1, en serie)

| Archivo | Qué |
|---|---|
| `js/plan.js` | Estructura: `parsePres` con los formatos nuevos, `—` = no se hace, sesión de domingo (carrera) desde S2, nombres/objetivos/orden definitivos de los ejercicios, marca `sides` (D/I), objetivos correctivos, `seriesPorGrupo`, huecos para hitos (`VOL_HITOS`) y reglas del bloque (`VOL_BLOCK_RULES`). |
| `js/store.js` | `VERSION = 4`: migración de renombrados, campo `side` en series, registro de rodilla (`knee`) y su API. |
| `js/app.js`, `index.html`, `css/styles.css` | Todos los enganches de interfaz: saltos de línea, `—` oculto en Hoy y atenuado en Plan, D/I en las series, tarjeta de hitos, botón de reglas del bloque, pestaña Rodilla, tarjeta de rodilla en Hoy. |
| `sw.js` | ASSETS nuevos y `CACHE = 'gym-v5'`. |
| Esqueletos | `js/reglas.js`, `js/rodilla-calc.js`, `js/rodilla-data.js`, `js/rodilla.js`, `css/rodilla.css`. |
| `tests/` | Prueba Node sin dependencias de la migración v4. |

### Fase 2 · En paralelo (archivos disjuntos)

| Tarea | Archivos que puede tocar |
|---|---|
| A · Contenido del plan | `js/plan.js` (solo contenido), `tools/verify_plan.py` |
| B · Reglas del bloque | `js/reglas.js` |
| C · Seguimiento rodilla | `js/rodilla-calc.js`, `js/rodilla-data.js`, `js/rodilla.js`, `css/rodilla.css`, `tests/rodilla-calc.test.mjs` |
| D · Exportación | `js/xlsx.js`, `js/export.js`, `tools/embed.py`, `js/original-xlsx.js` (generado), `Plan_8sem_vol_definitivo_con_cardio.xlsx` de la raíz (se sustituye por el nuevo), `tools/test-export.mjs` |

D no comparte mapeo de celdas con A: la hoja Volumen se exporta byte a byte
desde el Excel nuevo empotrado, y D solo rellena las celdas de entrada de
«Seguimiento rodilla» y la hoja `Registro`.

### Fase 3 · Verificación (solo lectura + tests)

- V1 · Contenido: app y exportación contra `volcado.json`, S1 idéntica,
  52 → 88, correctivos fuera del recuento.
- V2 · Lógica: `tests/` con la cascada de «¿Cumple?», aviso S4 y test de fuerza,
  contrastados con las fórmulas del Excel.
- Arranque local y revisión de consola (orquestador).

### Fase 4 · Cierre

README, `DECISIONES.md`, commits e informe final.
