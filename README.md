# Gym · Volumen 8 semanas (19 oct – 13 dic) + plan de 4 semanas (20 jul – 16 ago)

PWA para registrar el entrenamiento desde el iPhone y volcarlo al Excel
`Plan_8sem_vol_definitivo_con_cardio.xlsx` sin perder el formato original.

La app lleva dos planes:

- **Volumen 8 semanas**, del lunes 19/10/2026 al domingo 13/12/2026, sacado de
  la hoja `Volumen (1910-1112)`. Las semanas 9 (viaje = descarga) y 10 no
  están en el calendario; sus indicaciones salen como notas en la pestaña Plan.
- **4 semanas**, del 20/07 al 16/08/2026 (hojas `Bloque A` y `Bloque B`). Lo
  registrado en esas fechas se sigue viendo y exportando igual que antes.

Fuera de esas fechas, la pestaña Hoy avisa de que no hay plan.

## Cómo funciona

- **Sin servidor ni cuentas.** Todo es HTML/CSS/JS estático. El registro se
  guarda en el propio móvil (localStorage, con espejo en IndexedDB).
- **Offline.** Un service worker cachea la app entera, así que funciona en
  sótanos de gimnasio sin cobertura.
- **El Excel se reconstruye, no se parchea.** El .xlsx original va empotrado en
  `js/original-xlsx.js`. Al exportar se abre ese ZIP, se le inyecta una hoja
  `Registro` y se vuelve a comprimir. Las hojas Resumen / Bloque A / Bloque B /
  Volumen se copian byte a byte: conservan colores, anchos y estilos. Como se
  parte siempre del original, exportar dos veces da el mismo resultado.
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
  - *Volumen:* la sesión fija de ese día; sábado y domingo comparten la sesión
    `(S/D)`. En `N @ RIR1/0`, el RIR objetivo de cada serie aparece como
    1, 1, …, 0.
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
  fecha elegida. Arriba se cambia al otro plan.
- **Datos** — exportar el .xlsx, copia de seguridad en JSON e historial.

Los ejercicios de rehab llevan una barra verde a la izquierda y el **cardio**
(bici, martes y viernes, al final de la sesión) una barra azul. El cardio es un
ejercicio más, pero se registra con una sola entrada en minutos (columna *Min*
de la hoja `Registro`); sus pautas largas se leen dentro del ejercicio.

## Mantenimiento

```bash
python tools/embed.py           # re-empotra el .xlsx si cambias el plan original
python tools/verify_plan.py     # compara la hoja Volumen celda a celda con js/plan.js
node tools/test-export.mjs      # genera .xlsx de prueba en tools/out/ y los valida (usa openpyxl)
node tools/e2e.mjs              # recorrido completo en iPhone emulado (requiere playwright)
node tools/test-migracion.mjs   # comprueba las migraciones de datos ya registrados
node tools/shots.mjs            # capturas de pantalla
```

Playwright no viene instalado. Para las dos pruebas que lo necesitan:

```bash
npm install && npx playwright install --only-shell chromium
```

### Al cambiar el plan

El plan vive en dos sitios que hay que mantener a la vez: las hojas del
`.xlsx` y `js/plan.js` (la app no lee el Excel, lo tiene transcrito). Tras
tocar el Excel, ejecuta `python tools/embed.py`. Si el cambio es en la hoja
Volumen, actualiza `BLOCK_VOL` y comprueba con `python tools/verify_plan.py`.
Allí las prescripciones se escriben igual que en la celda (`2 @ RIR1/0`,
`1 @ RIR0`, `3 x10`, `2 x15–20`, `-`). Un formato nuevo hace fallar
`parsePres` a propósito.

**Renombrar un ejercicio rompe su historial**: el identificador se calcula a
partir del nombre, así que lo ya registrado queda huérfano. Hay que añadir una
migración en `MIGRATIONS` de `js/store.js` y subir `VERSION`; se aplican solas
al abrir la app. `tools/test-migracion.mjs` las verifica.

Tras cualquier cambio en los ficheros estáticos, sube el número de `CACHE` en
`sw.js` para que el service worker sirva la versión nueva en vez de la cacheada.
