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

## Fase 3 · Verificación

20. **Fórmulas del Excel sin LibreOffice.** No hay LibreOffice en la máquina; el
    contraste de los cálculos de rodilla con el Excel se hace evaluando las
    fórmulas reales del .xlsx exportado con el paquete de Python `formulas`
    (370 celdas, 0 diferencias). No es dependencia del repo: el test lo busca en
    `tools/out/py` o en `RODILLA_PY` y, si no está, omite ese contraste con aviso.
21. **Playwright.** `npm install` dentro de la carpeta de Google Drive dejó el
    paquete corrupto (error de tar); se instaló fuera y se copió a
    `node_modules/` (ignorado en git).

## Pendiente o a revisar por el usuario

22. ~~La ayuda de la pestaña Rodilla hablaba de columnas y celdas del Excel.~~
    Resuelto en la revisión del 26/10 (punto 37).
23. ~~El título del sábado decía «sin pierna» también en S1.~~ Resuelto (punto 36).
24. Falta abrir un exportado con datos reales en Excel/Numbers del iPhone para
    ver el recálculo en vivo (comprobado con `formulas` y openpyxl, no con Excel).

## Revisión del usuario (26/10) · respuestas aplicadas

Los cambios del Excel están en `tools/ajusta_excel_rodilla.py`, que parte siempre
del Excel recibido (`docs/plan-rodilla/`) y escribe el de la raíz.

25. **Excel editado con openpyxl.** Se comprobó que el resto del libro queda igual
    (valores, estilos, celdas combinadas, fórmulas de matriz, formato condicional).
    openpyxl no guarda valores calculados: el libro lleva `fullCalcOnLoad` y se
    recalcula al abrirlo. Por eso `verify_plan.py` replica la fórmula del recuento
    en vez de leer su valor (sigue dando 52 → 88).
26. **Unilaterales por pierna (1).** «/pierna» en la primera línea de abducción,
    touchdown, prensa y búlgara de S2 a S8 (la extensión ya decía «por pierna»);
    S1 no se toca. La app ya precargaba 2 × series alternando D e I.
27. **Test de fuerza (2).** En Hoy es un enlace a Rodilla › Test y no un ejercicio
    con series. La fila sigue en la hoja Volumen, porque marca el orden de la sesión
    (test → sentadilla → búlgara → abducción), y no cuenta en el recuento.
28. **Semáforo (3).** Columna P «Semáforo (auto)». Orden: día sin carga «—» →
    sin «Durante» vacío → sin mañana «sin referencia» → carrera sin K «falta K» →
    Retroceder por la sesión (más de 3/10 o 2/10, o K = No) → sin 24 h «pendiente» →
    Retroceder si la mañana siguiente es peor → sin 48 h «pendiente» → Avanzar si el
    peor 24-48 h ≤ referencia, si no Mantener. Un fallo de la sesión o de las 24 h
    ya da Retroceder aunque falte la de 48 h. Solo «Retroceder» cuenta en «Sesiones
    a retroceder» (antes «que no cumplen»).
29. **Aviso S4 (4).** El Excel usa `TODAY()`: hasta el 15/11 muestra «Pendiente».
    Hacen falta 5 mañanas en S2 y en S4. El umbral de ±0,5 se aplica sobre las
    medias ya redondeadas (las que se ven), con la diferencia también redondeada,
    para evitar el 0,4999… de la coma flotante.
30. **Retroceso (5).** Cómo se atribuye un fallo:
    - Dolor durante (o no volver al nivel previo): a la escalera de esa sesión
      (lunes y jueves → prensa; miércoles y domingo → carrera).
    - Mañana peor: a la última novedad aplicada antes de esa mañana, en los 7 días
      previos, que no se haya retrocedido ya. Así, un segundo fallo va a la novedad
      anterior.
    - Brote: un fallo sin novedad reciente, o dos sesiones evaluadas seguidas en
      Retroceder. Supone −1 en prensa y carrera, más el aviso de 48-72 h.
    - La bici del viernes de S4 cuenta como novedad para atribuir. Si se le atribuye
      un fallo, la app avisa de que se quita, pero no lleva su nivel: la bici sigue
      el calendario.
31. **S2 de referencia (6).** La referencia es la primera mañana medida de S2 (el
    martes, al no haber medido el lunes). Aviso nuevo en la fila 81 del Excel y en
    la app. El paso de S2 a S3 lo decide solo ese aviso (estable → S3 según el plan;
    repite → S3 igual que S2), y los fallos de S2 no se atribuyen.
32. **Sin entrada no hay carrera (7).** Ese domingo «No se corre (como mucho, un
    paseo)», y los criterios vuelven el miércoles siguiente. La app guarda un intento
    por semana; el Excel tiene sitio para uno, así que exporta el último, con la
    fecha de su martes en G89.
33. **Progreso real (8).** Dos escaleras:
    - **Prensa**, de 0 a 6: x12/esc. 0 · x10/esc. 0 · x10/esc. 1 · x10/esc. 2 ·
      x8/esc. 2 · x8/esc. 3 · x8/esc. 4. Rige también la sentadilla y la búlgara del
      jueves y la touchdown del lunes, que va al escalón de la semana anterior.
    - **Carrera**, de 0 a 6 (0 = sin entrar).

    Cada lunes y cada miércoles:
    - **Avanzar (+1)** si las dos sesiones de esa escalera de la semana anterior
      salieron en verde.
    - **Retroceder (−1)** si se le atribuyó un fallo.
    - **Mantener** en cualquier otro caso, también si faltan datos o hay «pendiente».

    Nunca pasa del máximo del calendario. Tampoco hay novedad si esa mañana estás
    peor que la del día anterior, ni desde S5 si el aviso de S4 es PEOR. Hoy y el
    Registro prescriben con el nivel real; la pestaña Plan sigue mostrando el
    calendario (el máximo). En Rodilla › Progresión se ven el máximo, la propuesta y
    el motivo, y se puede apuntar el nivel real, que manda sobre la propuesta. Se
    calcula hasta la semana siguiente a hoy. En el Excel, las columnas «Nivel de
    carrera real» y «Escalón D real» reciben los niveles de las semanas ya empezadas.
34. **Sin referencia (9).** Un día sin medición no se evalúa y no permite avanzar
    (salvo el paso de S2 a S3, que va por el punto 31).
35. **Carrera N4 → N5 (10).** Nuevo nivel N5 = 3×(8'/1') y N6 = 2×(12'/1'). Los
    30' seguidos pasan a N7, después del viaje; S8 repite N6. La regla del 50 % solo
    se ha aplicado donde pediste: N1 → N2 → N3 doblan el tramo (100 %), y N6 → N7
    pasa de 12 a 30 minutos.
36. **Semáforo solo en días con carga de rodilla (10).** Lunes, jueves y días de
    carrera. Martes y viernes pasan a «—», incluidos el paseo del martes de S2 (se
    valida con el criterio 1 de la entrada) y la bici del viernes de S4.
    **El sábado no se evalúa:** desde S2 es «sin pierna», así que se aplica tu
    criterio de «días con carga de rodilla» y no la lista. A confirmar.
37. **Paseo y criterios (10).** Casillas Sí/No: el paseo lleva dos («≤2/10
    durante» y «nivel previo en ≤60 min») y cada criterio del miércoles, una. La
    mañana del miércoles no peor (24 h) se calcula sola.
38. **«2-3 x…» (10)** precarga 2 series; la tercera se añade con «+ Añadir serie».
39. **Sábado de S1 (10).** La app lo vuelve a llamar «Sábado/Domingo» (también en
    la exportación). En el Excel, A55 dice «desde S2, sin pierna».
40. **Ayuda (10).** Hay una ayuda nueva para la app, en `tools/genera_rodilla_data.py`,
    sin referencias al Excel. La ayuda A2 del Excel se actualiza al semáforo pero
    sigue hablando de sus columnas, porque es la del Excel.
41. **Bici y brote: contradicción a confirmar.** Tu punto 5 dice que en las 48-72 h
    se mantiene la bici si ya estaba introducida. K95 decía «lo primero que se
    quita si hay brote». Se ha aplicado tu respuesta y K95 se ha cambiado en ese
    sentido.
42. **«Esa mañana igual o mejor».** Se compara la mañana del día de la novedad con
    la del día anterior.
43. **Esquema del registro.** La versión 4 no llegó a publicarse (`main` sigue en la
    3): `knee.weeks` y `knee.entry` cambian sin migración nueva.

## Segunda ronda de la revisión (26/10) · ajustes del usuario

Sustituyen a los puntos anteriores donde se contradicen (30, 35, 41 y 42).

44. **Sábado (1): confirmado.** Sin pierna y sin semáforo. La pierna se queda en
    lunes y jueves; la abducción, en máquina esos dos días.
45. **Extensión de rodilla con escalera de rango (1): no existe.** No aparece en
    ninguna de las entradas: ni en la especificación, ni en el Excel recibido, ni en
    las versiones anteriores del plan ni de la app. Lo único que hay es el **test de
    fuerza** (extensión unilateral en máquina, rango fijo 90→45°, jueves de S2, S5 y
    S7; rango completo opcional en S8), que no lleva escalera. No se ha inventado:
    queda pendiente de que la definas (ver «Pendiente», punto 52).
46. **Bici en el brote (2).** Vuelve la nota original de K95: «lo primero que se quita
    si hay brote». Durante las 48-72 h, solo isométricos y caminar, sin bici (A110).
47. **Carrera después del viaje (3).** N7 = 18', N8 = 25' y N9 = 30' seguidos
    (12 → 18 → 25 → 30: como mucho +50 % por nivel). De N1 a N3 el tramo se dobla,
    como aceptaste. S8 repite N6.
48. **«Esa mañana igual o mejor» (4).** Se compara con la referencia: la mañana del
    mismo día de la semana anterior, es decir, la referencia de la última sesión de
    esa escalera en el mismo día; en S3, la primera medición de S2. Si la mañana aún
    no está apuntada, la propuesta lo indica («solo si esa mañana estás en X/10 o
    menos»). Así, un empeoramiento lento, un poco cada día, también bloquea la novedad
    (hay prueba: martes y miércoles a 3 con referencia 2).
49. **Atribución (6).**
    - El dolor durante la sesión retrocede la escalera de esa sesión.
    - Una mañana peor se atribuye a la **última novedad aún no validada**: la que
      todavía no tiene en verde sus dos mañanas (24 y 48 h), ni las de una sesión
      posterior de su escalera. Se quita la ventana de 7 días: una novedad validada no
      se culpa.
    - Si no queda ninguna novedad sin validar, o hay dos sesiones seguidas en
      «Retroceder», hay brote.
50. **Bici (7).**
    - Entra el viernes de S4 solo si S2 y S3 no tuvieron sesiones en «Retroceder»
      (K95: «solo si S2 y S3 cumplieron la regla»).
    - Se quita si se le atribuye un fallo o si hay un brote.
    - Vuelve al nivel del calendario el lunes siguiente a una semana entera en verde:
      todas las sesiones hechas con carga de rodilla de esa semana en «Avanzar».
    - Mientras está quitada, Hoy la muestra como «Sin bici (quitada)», con el motivo.
      En Progresión se ve desde cuándo está quitada y por qué.
51. **Excel para iPhone (11).** No queda ninguna fórmula matricial en el libro:
    - La tabla de series por grupo (C73:J82) suma ahora fila a fila las de cada grupo,
      igual que el desglose de espalda. Si se añade un ejercicio a un grupo, hay que
      volver a ejecutar `tools/ajusta_excel_rodilla.py`.
    - La peor mañana de cada semana (E72:E80) usa `MAX` sobre sus 7 filas.
    - `verify_plan.py` comprueba que no hay matrices y que cada celda suma las filas
      de su grupo.
    - La evaluación de las fórmulas da 52 → 88. Falta tu prueba en el iPhone.

## Pendiente o a revisar por el usuario (segunda ronda)

52. **Extensión con escalera de rango.** Para añadirla hace falta:
    - series y repeticiones (¿y RIR?);
    - si la escalera de rango (90→45°, 35°, 25°, 15°, 5°, completo) tiene un máximo
      por semana en el calendario, como la prensa, o sube libre según el semáforo;
    - si va en todas las semanas o solo en algunas;
    - qué pasa los jueves de test, en los que el test ya es una extensión 90→45°.

    La regla de subida ya está decidida: sube si el jueves y sus dos mañanas
    siguientes salen en verde, con el rango nuevo estrenado el jueves (después del
    test en las semanas de test) y validado con las mañanas del viernes y el sábado.

## El Excel como fuente de verdad (27/10)

53. **La app lee el plan del Excel empotrado al arrancar.** Ya no hay plan copiado en
    el código (salvo el de julio, ya pasado). Se ha comprobado que el plan leído es
    idéntico al que estaba escrito a mano (paridad exacta) antes de borrar este último.
    Para cambiar el plan: editar el Excel y `python tools/excel_app.py`. Ver README,
    «Cambiar el plan: solo el Excel».
54. **Columna «App» oculta** (L en Volumen, R en Seguimiento) con etiquetas para lo
    que la hoja no dice sola: id estable de cada ejercicio (renombrar ya no rompe el
    historial), papel en la progresión, a qué sesión va cada fila de cardio y qué filas
    son reglas, notas, hitos y tablas. Está oculta para no estorbar al leer el Excel.
55. **Fórmulas regeneradas.** `excel_app.py` rehace todas las fórmulas de las dos hojas
    a partir de las etiquetas, porque openpyxl no actualiza referencias al insertar
    filas. `insertar_filas`/`quitar_filas` mueven además las celdas combinadas, las
    alturas, las validaciones y el formato condicional. Las fórmulas regeneradas son
    idénticas a las anteriores, salvo tres del final de la tabla de días que miraban
    filas vacías (siguen dando vacío).
56. **Escaleras genéricas.** Además de prensa, carrera y bici, cualquier ejercicio con
    `escalera=<nombre>` es una escalera, con las mismas reglas que la prensa (semáforo,
    novedad frente a la referencia, atribución, validación y topes). Así, la extensión
    con su escalera de rango (punto 52) se podrá añadir solo desde el Excel en cuanto
    la definas. Si un día tiene dos escaleras, el dolor durante la sesión se atribuye a
    la que tuvo novedad ese día; si ninguna la tuvo, a la primera.
57. **Fechas.** Las semanas del plan salen de la primera fecha de la hoja de
    seguimiento y de la semana que es; la semana de referencia es la primera con
    seguimiento (S2), y el cierre de S4, su último día.
58. **Lo que sigue necesitando código:** reglas o cálculos nuevos (otro tipo de aviso,
    otra forma de progresar) y formatos de celda nuevos. Las fórmulas de la hoja de
    seguimiento tampoco las lee la app: el cálculo de la app las replica, y
    `tests/rodilla-logica.test.mjs` comprueba que coinciden. Si se cambia una fórmula
    del Excel, hay que cambiar también la app.

## Abs del martes: colgado + máquina (27/10)

59. **Desde S2, 1 serie de abs colgado y el resto en máquina.** Fila nueva «Abs en
    máquina (crunch)» (`id=abs-maquina-crunch`, objetivo «Abs») justo debajo del
    colgado, en la sesión del martes. S1 no cambia (colgado 3 series, máquina «—»).
    Desde S2 el colgado es «1 @ RIR0» (una sola serie de RIR1/0 es RIR0) y la máquina
    lleva las series que tenía el colgado menos una, con el mismo RIR1/0: 2, 2, 2, 3,
    3, 3, 4. Las series de Abs (5→9) y el total (52→88) quedan igual. El colgado
    conserva su id, así que su historial no se pierde.
60. **Notas.** Ninguna nota ni regla del Excel hablaba del número de series del
    colgado, así que no se ha tocado ninguna. La nota técnica del colgado (K) se deja
    igual; la de la máquina dice que recoge sus series desde S2, para que se entienda
    en el Excel por qué el colgado baja a 1.
61. **Pruebas.** `tests/contenido.test.mjs` («hipertrofia como antes») tiene una
    excepción explícita para el colgado: comprueba que colgado + máquina suman lo de
    antes con el mismo RIR. `tests/contenido-ui.mjs` buscaba filas por número (hitos
    en la 99, reglas del bloque en la 102-113, notas en la 66-69) y fallaba al insertar
    una fila; ahora las busca por su etiqueta de la columna «App», como la app.
