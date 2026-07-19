# Gym · Plan 4 semanas (20 jul – 16 ago)

PWA para registrar el entrenamiento desde el iPhone y volcarlo al Excel
`Plan_4semanas_20jul-16ago.xlsx` sin perder el formato original.

## Cómo funciona

- **Sin servidor ni cuentas.** Todo es HTML/CSS/JS estático. El registro se
  guarda en el propio móvil (localStorage, con espejo en IndexedDB).
- **Offline.** Un service worker cachea la app entera, así que funciona en
  sótanos de gimnasio sin cobertura.
- **El Excel se reconstruye, no se parchea.** El .xlsx original va empotrado en
  `js/original-xlsx.js`. Al exportar se abre ese ZIP, se le inyecta una hoja
  `Registro` y se vuelve a comprimir. Las hojas Resumen / Bloque A / Bloque B
  se copian byte a byte: conservan colores, anchos y estilos. Como se parte
  siempre del original, exportar dos veces da el mismo resultado.

### Sobre "sobrescribir el mismo fichero"

En **iPhone/Safari** no existe la File System Access API, así que la app no
puede escribir en un fichero del disco. Descarga siempre con el mismo nombre,
`Plan_4semanas_20jul-16ago.xlsx`, y como el fichero está completo basta con
copiarlo encima del tuyo.

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

- **Hoy** — la sesión que toca según la fecha. En las semanas 3 y 4 eliges cuál
  de los 3 días haces, porque el plan los deja libres. Las series prescritas
  aparecen ya como filas vacías: solo rellenas kg / reps / RIR. Se guarda al
  teclear. Debajo, notas del día para el semáforo de rodilla.
- **Plan** — las 4 semanas completas en solo lectura, con las reglas de rodilla.
- **Datos** — exportar el .xlsx, copia de seguridad en JSON e historial.

Los ejercicios de rehab llevan una barra verde a la izquierda y sus
prescripciones son fijas las 4 semanas.

## Mantenimiento

```bash
python tools/embed.py        # re-empotra el .xlsx si cambias el plan original
node tools/test-export.mjs   # genera .xlsx de prueba en tools/out/
node tools/e2e.mjs           # recorrido completo en iPhone emulado (requiere playwright)
node tools/shots.mjs         # capturas de pantalla
```

Si editas el plan en el Excel, hay que reflejarlo también en `js/plan.js`: la
app no lee las hojas, las tiene transcritas. Tras cualquier cambio en los
ficheros estáticos, sube el número de `CACHE` en `sw.js` para que el service
worker sirva la versión nueva.
