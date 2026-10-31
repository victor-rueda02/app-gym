# Gym · Volumen 8 semanas (19 oct – 13 dic) + plan de 4 semanas (20 jul – 16 ago)

PWA para registrar el entrenamiento desde el iPhone y volcarlo al Excel
`Plan_8sem_vol_definitivo_con_cardio.xlsx` sin perder el formato original.

La app lleva dos planes:

- **Volumen 8 semanas**, del lunes 19/10/2026 al domingo 13/12/2026, sacado de
  la hoja `Volumen (1910-1112)`. Desde S2 incluye el plan rodilla: rehab de
  rodilla lunes y jueves, sábado en casa sin pierna, carrera miércoles y
  domingo, y la hoja `Seguimiento rodilla` (pestaña Rodilla, del 26/10 al
  27/12). Las semanas 9 (viaje = descarga) y 10 no están en el calendario de
  sesiones; sus indicaciones salen como notas en la pestaña Plan.
- **4 semanas**, del 20/07 al 16/08/2026 (hojas `Bloque A` y `Bloque B`). Lo
  registrado en esas fechas se sigue viendo y exportando igual que antes.

Fuera de esas fechas, la pestaña Hoy avisa de que no hay plan.

## Cómo funciona

- **Sin servidor ni cuentas.** Todo es HTML/CSS/JS estático. El registro se
  guarda en el propio móvil (localStorage, con espejo en IndexedDB).
- **Offline.** Un service worker cachea la app entera, así que funciona en
  sótanos de gimnasio sin cobertura.
- **El plan sale del Excel.** La app lee al arrancar el plan de volumen y el
  seguimiento del `.xlsx` empotrado: para cambiar el plan basta con editar el Excel
  (ver «Cambiar el plan: solo el Excel»).
- **El Excel se reconstruye, no se parchea.** El .xlsx original va empotrado en
  `js/original-xlsx.js`. Al exportar se abre ese ZIP, se le inyecta una hoja
  `Registro` y se vuelve a comprimir. Las hojas Resumen / Bloque A / Bloque B /
  Volumen se copian byte a byte: conservan colores, anchos y estilos. En
  `Seguimiento rodilla` solo se rellenan las celdas de entrada (con su estilo);
  sus fórmulas no se tocan y el libro se marca para recalcularse al abrirlo.
  Como se parte siempre del original, exportar dos veces da el mismo resultado.
- **Registro con los dos planes.** En la hoja `Registro`, la columna *Bloque*
  dice de qué plan es cada fila: `A` o `B` para el de 4 semanas y `Volumen`
  para el de 8. La columna *Semana* es la semana dentro de ese plan.

### Sobre "sobrescribir el mismo fichero"

En **iPhone/Safari** no existe la File System Access API, así que la app no
puede escribir en un fichero del disco. Descarga siempre con el mismo nombre,
`Plan_8sem_vol_definitivo_con_cardio.xlsx`, y como el fichero está completo basta con copiarlo
encima del tuyo.

En **Chrome/Edge de escritorio** sí se usa esa API: eliges el fichero una vez y
las siguientes exportaciones de esa sesión lo sobrescriben directamente.

## Publicar en GitHub Pages

```bash
git init && git add . && git commit -m "App de gimnasio"
gh repo create app-gym --private --source=. --push
gh api -X POST repos/:owner/app-gym/pages -f build_type=legacy \
  -f 'source[branch]=main' -f 'source[path]=/'
```

Espera un par de minutos y la app queda en
`https://<usuario>.github.io/app-gym/`.

> GitHub Pages sirve por HTTPS, requisito para que iOS instale la PWA. Un
> repositorio privado necesita GitHub Pro para publicar Pages; con cuenta
> gratuita, crea el repo como público (el plan no contiene nada sensible) o
> usa Netlify/Vercel arrastrando la carpeta.

### Instalar en el iPhone

Abre la URL en **Safari** (no Chrome) → botón Compartir → **Añadir a pantalla
de inicio**. Se abre a pantalla completa, sin barra del navegador.

## Uso

- **Hoy** — la sesión que toca según la fecha. Las series prescritas aparecen
  ya como filas vacías: solo rellenas kg / reps / RIR. Se guarda al teclear.
  Debajo, notas del día para el semáforo de rodilla.
  - *Volumen:* la sesión fija de ese día. En S1 sábado y domingo comparten la
    sesión del sábado; desde S2 el domingo es la carrera. En `N @ RIR1/0`, el
    RIR objetivo de cada serie aparece como 1, 1, …, 0. Los ejercicios con «—»
    esa semana no se listan. Desde S2 los unilaterales de rehab se registran
    por pierna: cada serie lleva un botón D/I (D = derecha, la afectada).
  - *Progreso real:* desde S2, la prensa, la sentadilla, la búlgara, la
    touchdown y la carrera se prescriben con tu nivel real (el semáforo de la
    semana anterior), no con el calendario; dentro del ejercicio se ve el motivo
    y el máximo del calendario. La bici sale «Sin bici (quitada)» tras un brote
    o un fallo atribuido a ella, hasta una semana entera en verde. El test de
    fuerza del jueves es un enlace a Rodilla › Test.
  - Arriba, la tarjeta de rodilla con las dos pruebas de la mañana, y desde S2
    los «Hitos y avisos» de la semana.
  - *4 semanas:* en las semanas 3 y 4 eliges cuál de los 3 días haces, porque
    el plan los deja libres.
- **Cronómetro** — dentro de cada ejercicio, con *Iniciar / Pausar / A cero*.
  Cuenta hacia arriba y solo se mueve cuando tú lo dices: no hay cuenta atrás
  ni avisos. Es único para toda la app, así que puedes arrancarlo al acabar una
  serie y seguir navegando; mientras corre aparece un reloj verde en la barra
  superior. En los ejercicios isométricos hay además un botón para volcar el
  tiempo medido a la columna *Seg* de la serie.
- **Plan** — el plan completo en solo lectura, con un selector de semana y las
  reglas. Por defecto abre el plan en curso, o el próximo, en la semana de la
  fecha elegida. Arriba se cambia al otro plan. En el de volumen, los hitos de
  la semana y el botón **Reglas del bloque** (las 12 reglas del plan rodilla,
  con sus etiquetas [EVIDENCIA], [LÓGICA] e [INCERTIDUMBRE]).
- **Rodilla** — el seguimiento diario del 26/10 al 27/12: pruebas de la mañana,
  dolor durante, nivel previo en ≤60 min (carrera) y chasquido; calcula 24 h,
  48 h, peor 24-48 h y el semáforo (Avanzar / Mantener / Retroceder; solo en los
  días con carga de rodilla). Además: resumen semanal con los avisos de S2
  (semana de referencia), S4 y chasquido; **Progresión** (máximo del calendario,
  propuesta del semáforo y nivel real, que se puede apuntar); entrada a la
  carrera con casillas, una por semana hasta superarla; test de fuerza y
  escalones de profundidad. Los cálculos están en `js/rodilla-calc.js`
  (funciones puras) y las reglas, en `DECISIONES.md`.
- **Datos** — exportar el .xlsx, copia de seguridad en JSON e historial.

Los ejercicios de rehab (y el test de fuerza) llevan una barra verde a la
izquierda, los correctivos del sábado una ámbar y el **cardio** (bici martes y
viernes, carrera miércoles y domingo, al final de la sesión) una azul. El
cardio es un ejercicio más, pero se registra con una sola entrada en minutos
(columna *Min* de la hoja `Registro`); sus pautas largas se leen dentro del
ejercicio. Los correctivos no cuentan como series de hipertrofia.

## Mantenimiento

```bash
python tools/excel_app.py       # tras editar el Excel: fórmulas, volcado, empotrado y caché (ver abajo)
python tools/excel_app.py --solo-cache   # tras tocar código sin cambiar el Excel
python tools/verify_plan.py     # la app frente al Excel (por etiquetas), sin fórmulas matriciales
python tools/prueba_edicion.py  # simula una edición del Excel y comprueba que la app la sigue
node tools/test-export.mjs      # genera .xlsx de prueba en tools/out/ y los valida (usa openpyxl)
node tools/e2e.mjs              # recorrido completo en iPhone emulado (requiere playwright)
node tools/test-migracion.mjs   # comprueba las migraciones de datos ya registrados
node tools/shots.mjs            # capturas de pantalla
for t in tests/*.test.mjs; do node "$t"; done   # pruebas de Node sin dependencias
node tests/contenido-ui.mjs     # Plan y Hoy contra el Excel en iPhone emulado (requiere playwright)
node tests/progresion-ui.mjs    # progresión real, entrada a la carrera y test (requiere playwright)
```

`tests/rodilla-logica.test.mjs` y `tools/prueba_edicion.py` contrastan con las
fórmulas reales del Excel si encuentran el paquete de Python `formulas`
(`pip install --target tools/out/py formulas`, o en otra carpeta indicada con
`RODILLA_PY`); si no, omiten ese contraste con un aviso.

Playwright no viene instalado. Para las pruebas que lo necesitan:

```bash
npm install && npx playwright install --only-shell chromium
```

### Cambiar el plan: solo el Excel

**El Excel de la raíz es la fuente de verdad.** La app lleva el `.xlsx` empotrado
(`js/original-xlsx.js`) y al arrancar lee de él el plan de volumen entero
(`js/lector-xlsx.js` → `js/plan.js`) y el seguimiento (`js/rodilla-data.js`):
sesiones, ejercicios, celdas S1–S8, notas, hitos, reglas, fechas, escaleras de
progresión y los días y textos del seguimiento. Para cambiar el plan:

1. Editar `Plan_8sem_vol_definitivo_con_cardio.xlsx` (a mano o con openpyxl; para
   insertar o quitar filas, `insertar_filas`/`quitar_filas` de `tools/excel_app.py`,
   que también mueven celdas combinadas, alturas, validaciones y formato condicional).
2. `python tools/excel_app.py`: regenera todas las fórmulas a partir de las
   etiquetas (sin matrices: Excel para iPhone las calcula a 0), vuelca el Excel a
   `docs/plan-rodilla/`, lo empotra y cambia la versión de la caché.
3. Pasar las pruebas.

Lo que la hoja no dice por sí sola va en la columna oculta **«App»** (L en
Volumen, R en Seguimiento), con etiquetas `clave` o `clave=valor` separadas por `;`:

| Etiqueta (Volumen, columna L) | Qué hace |
|---|---|
| `sesion` | cabecera de sesión `(L) Lunes · título` (`nombreS1=…`: nombre en S1); dos cabeceras con la misma letra son el mismo día, con sus filas seguidas |
| `S1=X;S2=X` | día de esas semanas, si no es el de la cabecera: en una cabecera mueve toda la sesión; en un ejercicio, solo esa fila (p. ej. el pull, el miércoles en S1-S2 y el jueves desde S3) |
| `id=…` | id estable del ejercicio: el historial cuelga de él, así que **renombrar es solo cambiar el nombre** |
| `escalera=prensa` / `prensa:sigue` / `prensa:anterior` | la prensa marca reps y escalón (`nov: xN`, `nov: +1 escalón`); la sentadilla y la búlgara siguen su nivel; la touchdown va al de la semana anterior |
| `escalera=carrera` / `carrera:domingo` | los niveles salen de las celdas `N1 · 8×(1'/2')`; el domingo repite |
| `escalera=<otra>` / `<otra>:sigue` | escalera nueva: primera línea `N x R`, segunda la descripción; cada subida, `nov: <descripción>` |
| `bici` | la bici: entra en su primera celda con seguimiento, se quita en brote o fallo y vuelve |
| `sesion=X;titulo=…` | (bloque de cardio) fila que va al final de la sesión X |
| `cardio`, `hitos`, `regla`, `nota`, `grupos`, `reglas-bloque` | títulos, hitos, reglas, notas, tabla de series y reglas del bloque (las de debajo, hasta una fila vacía) |
| `desglose=id1,id2` | filas del desglose de espalda: qué ejercicios suman |

En Seguimiento (columna R): `dias`, `semanas`, `aviso=s2|s4|chasquido`,
`texto=…`, `titulo=…`, `entrada=walk|touchdown|hops` (+ `dia=…`),
`entrada-resultado`, `test=t1…`, `escalon=0…`.

Las celdas siguen la gramática de `parsePres` (`2 @ RIR1/0`, `1 @ RIR0`, `3 x10`,
`2 x15–20`, `'3 x10-15/pierna\n@RIR1-2'`, `2-3 x…`, `—`, `-`…), con líneas de
aclaración opcionales debajo (`'2 @ RIR1/0\n2/11: con goma'`; en las filas con escalera,
la app muestra también las que empiezan por una fecha): un formato nuevo
hace fallar la carga a propósito, y lo detectan `verify_plan.py` y las pruebas.
Lo ya registrado no se pierde si una sesión cambia de día: la app muestra y exporta, al
final de la sesión de ese día, cualquier ejercicio registrado que no esté en ella.
Lo que sí necesita código: reglas o cálculos nuevos (el semáforo, la progresión,
los avisos) y formatos de celda nuevos. Las decisiones del plan rodilla están en
`DECISIONES.md`.

Si se renombra un ejercicio **sin** `id=` (o cambia su id), lo ya registrado queda
huérfano: hay que añadir una migración en `MIGRATIONS` de `js/store.js` y subir
`VERSION` (`tools/test-migracion.mjs` las verifica).
