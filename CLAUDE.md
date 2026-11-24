# app-gym · contexto para cada chat nuevo

PWA estática (HTML/CSS/JS, sin build ni servidor) para registrar el gimnasio desde el
iPhone y exportarlo al Excel. Se publica en GitHub Pages desde `main`:
https://victor-rueda02.github.io/app-gym/ (repo `victor-rueda02/app-gym`).

Antes de tocar nada, lee:

- `README.md`: qué hace la app, pestañas, mantenimiento y **«Cambiar el plan: solo el Excel»**.
- `DECISIONES.md`: todas las decisiones numeradas (plan rodilla, semáforo, progresión,
  semana sin viernes, Progreso/1RM, báscula…) y lo que queda pendiente.
- `docs/plan-rodilla/` (especificación original y volcado del Excel) y `docs/progreso/PLAN.md`.

## Cómo trabaja el usuario (respétalo)

- Habla en español. Explicaciones claras y breves; cuando pregunta por el entreno, responde
  como entrenador, sin meterse en código.
- **No revisa código, ramas ni diffs: solo mira la app ya desplegada.** Cuando un cambio
  está verificado con las pruebas, se fusiona en `main` y se hace `push` sin pedir revisión.
  (Salvo que un brief más reciente diga lo contrario.)
- Cuando pide un «prompt para un agente organizador/orquestador», los subagentes van con
  `model: "sonnet"` y `effort: "medium"`, y el orquestador no le consulta: decide, apunta la
  decisión en `DECISIONES.md` y sigue.
- Cada decisión nueva va a `DECISIONES.md` con el siguiente número libre (el último es el 125).

## Reglas técnicas que no se ven a simple vista

- **El Excel es la fuente de verdad del plan**: `Plan_8sem_vol_definitivo_con_cardio.xlsx`
  (raíz). La app lo lleva empotrado (`js/original-xlsx.js`) y lo lee al arrancar. Cambiar el
  plan = editar el Excel con openpyxl (filas con `insertar_filas`/`quitar_filas` de
  `tools/excel_app.py`) + `python tools/excel_app.py` + pruebas. Columna oculta «App»
  (L en Volumen, R en Seguimiento) con etiquetas `id=…`, `escalera=…`, `sesion`, `S1=X`…
  Nunca cambies el `id=` de un ejercicio: de él cuelga el historial.
- **Sin fórmulas matriciales** en el Excel (Excel para iPhone las calcula a 0). Si Excel
  guarda el libro, puede volver a meter alguna: compáralo con git antes de dar por buena
  una versión del disco.
- Tras tocar código sin cambiar el Excel: `python tools/excel_app.py --solo-cache` (sube la
  caché del service worker para que el móvil reciba la versión nueva).
- Datos del usuario: `localStorage['gym.log.v1']` (espejo en IndexedDB), versión 5 de
  `Store`. Si cambia el esquema, migración en `js/store.js`. Nunca se pierde lo registrado.
- Pruebas: la lista completa está en README › Mantenimiento. Las de interfaz usan
  Playwright, instalado a mano en `node_modules/` (`npm install` dentro de Google Drive
  falla).
- No hay LibreOffice: las fórmulas del Excel se evalúan con el paquete de Python `formulas`
  (`tools/out/py`).

## Google Drive y git (importante)

El repo vive en Google Drive (`G:\Mi unidad\…`). Drive hace que `git status` marque
ficheros como modificados (`M`) sin que lo estén, y eso bloquea `merge`/`checkout`.

- Para saber si hay cambios reales: `git diff HEAD --stat` (vacío = nada).
- **Nunca uses `git stash`, `git reset --hard` ni `git checkout -- .` para «limpiar» esos
  falsos cambios sin comprobar antes, fichero a fichero, que no hay trabajo sin commit de
  otro chat.** El 12/11 un `stash` hecho para fusionar se descartó y se perdió el código del
  paseo de entrada (decisiones 95-97; recuperado el 16/11, decisión 104).
- Varios chats trabajan a la vez en esta carpeta: haz commit de tu trabajo en cuanto esté
  verificado, en vez de dejarlo sin guardar.
- `gh` no tiene sesión iniciada; `git push` funciona con las credenciales de Windows.

## Ficheros del disco que no son del repo

Sin seguimiento a propósito; no los subas ni los borres: `Plan_8sem_vol*.xlsx`,
`*.gsheet`, `nutritiontracker-diario-*.json`, `.claude/`. `Plan_8sem_vol_definitivo.xlsx`
es una versión anterior al cardio.

## Apps relacionadas

- **Báscula** (`C:\Users\Victor\bascula`, repo `victor-rueda02/bascula`, en
  victor-rueda02.github.io/bascula): pesajes en `localStorage['bascula.history.v1']`. La app
  de gym los lee si comparten navegador; en el iPhone se importan en Datos › Peso corporal
  (ver decisiones 91-93). Tiene botón «Pesarme CR» (−0,5 kg) y media semanal en la gráfica.

## Estado y pendientes (actualizar al cerrar cada tarea)

Ver «Pendientes abiertos» al final de `DECISIONES.md`.
