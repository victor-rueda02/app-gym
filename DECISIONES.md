# Decisiones · integración del plan rodilla

Regla general: si la especificación (`docs/plan-rodilla/cambios_para_app_plan_rodilla.md`)
y el Excel nuevo (`docs/plan-rodilla/Plan_8sem_vol_definitivo_con_cardio.xlsx`)
no coinciden, el Excel manda en los valores (series, reps, textos de las celdas)
y la especificación en la lógica (cálculos, reglas, avisos).

## Fase 0 · Reconocimiento

1. **Versión anterior de referencia.** El diff se hace contra
   `Plan_8sem_vol_definitivo_con_cardio.xlsx` del commit `c3ece19`, que es el que
   la app llevaba empotrado. `Plan_8sem_vol_definitivo.xlsx` (sin seguimiento en
   la raíz) es anterior al cardio y solo queda como referencia; no se toca.
2. **El Excel nuevo sustituye al de la raíz.** `Plan_8sem_vol_definitivo_con_cardio.xlsx`
   de la raíz está versionado (lo empotra `tools/embed.py`) y se sobrescribe con
   la versión nueva; la anterior sigue en git. Se mantiene el nombre para que
   la descarga del móvil siga sustituyendo el fichero del usuario. Los `.xlsx`,
   `.gsheet` y `.json` sin seguimiento no se tocan.
3. **Saltos de línea en las celdas.** El Excel escribe varias celdas en dos o
   tres líneas (`'3 x10-15\n@RIR1-2'`, `'2 x10\nnov: x10'`); la especificación las
   escribe en una. Se guarda el texto tal cual, con `\n`, y la app lo muestra con
   `white-space: pre-line`.
4. **Textos que difieren entre .md y .xlsx (gana el .xlsx):**
   - Prensa: «nov: +1 escalón» (el .md dice «novedad: +1 escalón»).
   - Touchdown del lunes: «2 x10-15\n/pierna» y en S8 «2 x10-15\nrepite S7».
   - Carrera: «N1 · 8×(1'/2')» (el .md: «N1 · 8×(1' trote / 2' andar)»).
   - Bici del viernes: «Bici Z2 (sin Z3 en este bloque)».
   - Avisos de «Seguimiento rodilla»: los textos de E82, E83 y H92 del Excel
     (p. ej. «PEOR que en S2: para la progresión y la valoración del fisio pasa a
     ser prioritaria»; el .md resume «PEOR: para la progresión…»). El Excel tiene
     además un estado previo «Se calcula cuando haya datos de S2 y S4».
   - Resultado de la entrada a la carrera: «NO: hoy no corres; repite los
     criterios la semana que viene» (el .md: «NO: repite la semana que viene»).
   - Las 12 reglas del bloque: se muestran los textos de A102–A113 del Excel,
     que son la versión completa de los resúmenes de la sección 9 del .md.
5. **S1 no cambia, pero los nombres y notas son por fila.** El Excel renombra
   filas que ya existían en S1 (p. ej. «Unilateral abduction» → «Abducción de pie
   unilateral (máquina)», «Back squat» → «Sentadilla al cajón o desde pines ·
   pesado y lento n.º 2») y conserva en la columna C las prescripciones de S1.
   La app sigue al Excel: en S1 se ven los nombres nuevos con las mismas
   prescripciones de siempre. Comprobado con `diff_por_ejercicio.txt`: ninguna
   celda de la columna C cambia de valor; las filas nuevas llevan «—» o «-» en S1.
6. **Domingo.** En S1 el sábado y el domingo compartían la sesión «(S/D)» y así
   se queda (lo registrado ese domingo cuelga de esa sesión). Desde S2 el domingo
   es una sesión propia de carrera.
7. **«—» frente a «-».** «—» (raya) = no se hace esa semana: se oculta en Hoy y se
   ve atenuado en Plan. «-» (guion, la fila de S1 que antes era «Movilidad -
   trapecio inferior») se comporta como hasta ahora.

## Fase 1 · Modelo de datos

8. **Formatos de celda nuevos.** `parsePres(text, objetivo)`: «N-M x R» prescribe M
   series (las filas que se precargan); el test de fuerza («2 aprox. + 1 al fallo
   por pierna») son 3 series, y «Opcional: rango completo» también, marcado como
   opcional; el cardio y la carrera son texto libre con una sola entrada en
   minutos (los minutos se precargan solo si la celda empieza por «N min» o «N'»).
9. **Carrera.** Es un ejercicio de cardio (barra azul) llamado como la columna B
   del Excel, «Andar-correr en llano»: último ejercicio del miércoles y único de
   la sesión nueva del domingo (`VOL-D`, desde S2).
10. **Marca D/I.** Los unilaterales de rehab (lunes: abducción, touchdown y prensa;
    jueves: test, búlgara y abducción) se registran por pierna desde S2: cada
    serie lleva un botón D/I y se precargan 2 × series, alternando D e I con la D
    primero («D primero» en las notas del Excel). En S1 nada cambia. La sentadilla
    es bilateral y no lleva marca.
11. **Correctivos.** Objetivos «Hombro (correctivo)» y «Codo (correctivo)», con
    barra ámbar. El recuento (`seriesPorGrupo`) replica la fórmula del Excel, que
    solo suma objetivos idénticos a los 10 grupos: los correctivos y el cardio no
    cuentan. Da 52, 57, 62, 66, 71, 76, 80, 88.
12. **Renombrados → migración v4** (por sesión; julio/agosto no se toca): abducción
    de lunes y jueves, prensa, sentadilla, abducción y T del sábado, y bici del
    viernes. Ver la tabla en `js/store.js`.
13. **Registro de rodilla** en el mismo almacén (`knee` dentro de `gym.log.v1`, con
    su espejo en IndexedDB y en la copia JSON). Los precargados de sesión, regla y
    novedad solo se guardan si el usuario los edita.
14. **Interfaz.** Pestaña nueva «Rodilla»; tarjeta «Hitos y avisos» en Plan y en
    Hoy (S2+); botón «Reglas del bloque» en Plan. En la lista de Hoy, «hecho»
    cuenta 2 × series en los unilaterales.

## Fase 2 · Contenido, reglas, seguimiento y exportación

15. **Cabeceras de sesión.** Nombre y título salen de la fila de cabecera del Excel
    (título = todo lo que va tras el primer «·», con sus dobles espacios). El
    domingo de carrera no tiene cabecera en el Excel: «Domingo · Carrera».
16. **Textos del plan.** `VOL_RULES` = A2 y A64; semanas 9-10 = A66–A69; hitos =
    C99–J99 y su nota K99; reglas del bloque = A102–A113 con su título A101.
17. **Panel de reglas.** Hoja inferior con las 12 reglas numeradas y una leyenda de
    las etiquetas. Las etiquetas se resaltan por su primera palabra (la regla 7,
    «[LÓGICA; …: INCERTIDUMBRE]», se pinta como LÓGICA) sin cambiar el texto.
18. **Seguimiento rodilla.**
    - Una sola prueba de la mañana rellena: la molestia vale esa (como `MAX` en el
      Excel).
    - «Nivel previo ≤60 min» solo se pide con la regla Carrera; si se cambia la
      regla, el dato se conserva pero no cuenta (como en el Excel).
    - La regla «—» cae en la rama de gimnasio de «¿Cumple?» (igual que la fórmula
      P del Excel). Cuenta la regla editada, si se editó.
    - «Escalón D real» se valida como entero 0-4; «Nivel de carrera real», texto
      libre; la carga del test admite decimales con coma o punto.
    - El texto de ayuda A2 habla de «columnas G y H» y «celdas amarillas» del
      Excel: se muestra literal, plegado bajo «Cómo se rellena».
19. **Exportación.**
    - La hoja «Seguimiento rodilla» se rellena en su sitio: solo las celdas de
      entrada, con su estilo; las fórmulas no se tocan. El libro se marca con
      `fullCalcOnLoad` para que Excel y Calc recalculen al abrir. Sin datos de
      rodilla la hoja sale byte a byte igual al original.
    - Los precargados (sesión, regla, novedad) solo se escriben si se editaron.
    - La hoja `Registro` gana la columna «Lado» tras «Serie»; su cabecera usa el
      xf 12, que es el de las cabeceras de la hoja Volumen en el `styles.xml`
      nuevo (el 13 ya no lo es).
