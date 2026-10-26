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
