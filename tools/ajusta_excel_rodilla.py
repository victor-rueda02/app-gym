"""Aplica al Excel las respuestas a la revisión del plan rodilla (26/10/2026).

    python tools/ajusta_excel_rodilla.py

Parte siempre del Excel recibido (docs/plan-rodilla/Plan_8sem_vol_definitivo_con_cardio.xlsx)
y escribe el de la raíz, que es el que empotra la app (tools/embed.py). Así se puede
volver a ejecutar sin acumular cambios. Lo que cambia, por punto de la revisión:

1. Unilaterales: «/pierna» en la primera línea de abducción, touchdown, prensa y búlgara
   (S2-S8; S1 no se toca). El test ya decía «por pierna».
3. «¿Cumple?» pasa a semáforo: Retroceder / Mantener / Avanzar. Solo «Retroceder» cuenta
   en «Sesiones que no cumplen».
4. Aviso S4: al cerrar S4 (15/11), con 5 mañanas o más en S2 y S4 y umbral de ±0,5.
5. Reglas de retroceso y brote (A110) y novedades (A106).
6. S2 = semana de referencia: aviso nuevo en la fila 81 y regla A107.
7. Sin entrada a la carrera no se corre esa semana (K98, K99, H92).
8. Progreso real: el calendario marca el máximo (A2, A106, A108).
9. Sin medición de la mañana el día no se evalúa (A103 y ayuda A2 del seguimiento).
10. Nivel intermedio de carrera (N5 = 3×(8'/1'), N6 = 2×(12'/1')); semáforo solo en días con
    carga de rodilla (regla «—» en martes y viernes); paseo y criterios de entrada con
    casillas; título del sábado «desde S2».
"""
import copy
import pathlib
import sys

import openpyxl
from openpyxl.formatting.rule import FormulaRule
from openpyxl.worksheet.datavalidation import DataValidation

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT / "docs" / "plan-rodilla" / "Plan_8sem_vol_definitivo_con_cardio.xlsx"
OUT = ROOT / "Plan_8sem_vol_definitivo_con_cardio.xlsx"

CARRERA = "Carrera (≤2/10)"
GIMNASIO = "Gimnasio (≤3/10)"
SEMANA = "DEFGHIJ"   # S2..S8 en la hoja Volumen


def por_pierna(texto):
    """'2 x10\\nnov: x10' -> '2 x10/pierna\\nnov: x10'; '2 x10-15\\n/pierna' -> '2 x10-15/pierna'."""
    if texto in (None, "—", "-") or "por pierna" in texto:
        return texto
    lineas = [l for l in texto.split("\n") if l != "/pierna"]
    if "/pierna" not in lineas[0]:
        lineas[0] += "/pierna"
    return "\n".join(lineas)


def volumen(ws):
    # 1. Unilaterales por pierna: abducción (L, J), touchdown (L), prensa (L), búlgara (J).
    for fila in (7, 9, 10, 37, 38):
        for col in SEMANA:
            ws[f"{col}{fila}"] = por_pierna(ws[f"{col}{fila}"].value)

    ws["A2"] = ws["A2"].value.replace(
        " Reglas al final de la hoja;",
        " El calendario marca el máximo de cada semana: se progresa según el semáforo"
        " (Avanzar / Mantener / Retroceder) y la app prescribe con el nivel real."
        " Reglas al final de la hoja;")

    # 10. Título del sábado: en S1 sí había pierna.
    ws["A55"] = "(S) Sábado  ·  casa, sin máquinas ni poleas  ·  desde S2, sin pierna (el domingo: carrera)"

    # 10. Nivel intermedio de carrera: el tramo continuo más largo crece como mucho ~50 %.
    ws["H97"] = "N5 · 3×(8'/1')"
    ws["I97"] = "N6 · 2×(12'/1')"
    ws["K97"] = (
        "Formato: minutos trotando / minutos andando. Niveles: N1 8×(1'/2') · N2 6×(2'/1') · "
        "N3 4×(4'/1') · N4 4×(5'/1') · N5 3×(8'/1') · N6 2×(12'/1') · N7 30' seguidos (después "
        "del viaje). N5 es un nivel intermedio para que el tramo continuo más largo no crezca más "
        "de un 50 % por nivel (5 → 8 → 12 min) [LÓGICA]. El calendario marca el máximo de cada "
        "semana; el nivel real sale del semáforo: Avanzar = +1, Mantener = el mismo, Retroceder "
        "= −1. Nivel nuevo solo si esa mañana estás igual o mejor. 5 min andando antes; llano y "
        "firme. Regla de carrera: Retroceder si pasas de 2/10 durante, no vuelves al nivel previo "
        "en ≤60 min o la mañana siguiente estás peor; Mantener si cumple pero el peor valor 24-48 h "
        "supera la referencia; Avanzar si cumple y el peor 24-48 h ≤ referencia [EVIDENCIA de uso: "
        "TREK Education, basada en Esculier; no comparada con otros umbrales]. Cadencia +5-10% "
        "opcional [EVIDENCIA mixta: Bramah 2019, serie de 12 corredores con mejora de dolor y "
        "función mantenida a 3 meses; Esculier 2018, sin beneficio extra sobre la educación].")
    ws["K98"] = (
        "Repite el nivel validado el miércoles. Si el miércoles no se cumplieron los criterios "
        "de entrada, esa semana no hay carrera: el domingo no se corre (como mucho, un paseo). "
        "Nunca dos días seguidos corriendo [LÓGICA]. El sábado no hay pierna: llegas descansado.")
    ws["K99"] = (
        "Entrada a la carrera (S2), con la regla de carrera: martes, paseo de 30 min a paso rápido "
        "(≤2/10, nivel previo en ≤60 min y el miércoles por la mañana no peor: el criterio 1 se "
        "evalúa solo con esa mañana, sin esperar a las 48 h); miércoles antes de correr, 10 "
        "touchdown con cada pierna y 20 saltitos a dos piernas (≤2/10). Si se cumplen los tres, "
        "1.ª carrera ese miércoles (N1). Si no, esa semana no hay carrera (el domingo, como mucho, "
        "un paseo) y los criterios se repiten el miércoles siguiente [LÓGICA].")
    ws["K95"] = ws["K95"].value.replace(
        "Lo primero que se quita si hay brote.",
        "En la regla de 48-72 h se mantiene si ya estaba introducida.")

    # Reglas del bloque (A102-A113).
    ws["A103"] = (
        "Mediciones: cada mañana, en casa, con las mismas pruebas: test en declive y 10 subidas "
        "con la D al mismo escalón o banco. Vale la peor de las dos (el declive solo no basta: te "
        "sale 0 aunque haya molestia). Si falta la medición de la mañana, ese día no se evalúa y "
        "la primera medición disponible hace de referencia (en S2, la del martes). Se apuntan en "
        "«Seguimiento rodilla».")
    ws["A104"] = (
        "Regla de gimnasio [LÓGICA], en semáforo (solo días con carga de rodilla: lunes y jueves): "
        "Retroceder si pasas de 3/10 durante o la mañana siguiente estás peor que la de la sesión; "
        "Mantener si cumple, pero el peor valor entre 24 y 48 h supera la referencia (no avanzas, "
        "pero no has fallado); Avanzar si cumple y el peor valor 24-48 h es igual o mejor que la "
        "referencia. Los días sin carga de rodilla no se evalúan («—»).")
    ws["A105"] = (
        "Regla de carrera [EVIDENCIA de uso], en semáforo (miércoles y domingo): Retroceder si "
        "pasas de 2/10 durante, no vuelves al nivel previo en ≤60 min o la mañana siguiente estás "
        "peor; Mantener si cumple, pero el peor valor 24-48 h supera la referencia; Avanzar si "
        "cumple y el peor valor 24-48 h ≤ referencia. El paseo de entrada se valida solo con la "
        "mañana siguiente. Se aplica también a las fases hacia el fútbol [LÓGICA].")
    ws["A106"] = (
        "Novedades [LÓGICA]: una por día y validada a las 24 y 48 h antes de repetirla. Lunes: "
        "escalón o reps (prensa) · miércoles: nivel de carrera · viernes de S4: bici. Solo si esa "
        "mañana estás igual o mejor. El calendario marca el máximo de cada semana; el nivel real "
        "sale del semáforo: Avanzar = nivel +1 (sin pasar del calendario), Mantener = el mismo, "
        "Retroceder = nivel −1. Lo validado se repite: el jueves usa la profundidad del lunes y el "
        "domingo repite el nivel del miércoles.")
    ws["A107"] = (
        "S2 = semana de referencia [LÓGICA]: el paseo del martes no cuenta como novedad (caminas a "
        "diario). Si alguna mañana de S2 sale peor que la referencia (la primera medición de S2), "
        "en S3 no sube nada y se repite S2 entera, en lugar de intentar atribuir el empeoramiento.")
    ws["A108"] = ws["A108"].value.replace(
        "Se sube los lunes de S3, S4, S6 y S7 en la prensa",
        "Se sube, como mucho, los lunes de S3, S4, S6 y S7 en la prensa (según el semáforo)")
    ws["A110"] = (
        "Retroceso y brote [LÓGICA]: si una medición falla, se retrocede solo la última novedad "
        "anterior a ella (p. ej., jueves bien y viernes peor → se retrocede la carrera del "
        "miércoles y el escalón se mantiene); si tras el retroceso la siguiente medición vuelve a "
        "fallar, se retrocede la novedad anterior, y así hacia atrás. Si falla sin ninguna novedad "
        "reciente, o fallan dos sesiones seguidas: 48-72 h solo isométricos (sentadilla española "
        "5×45 s diaria), y la bici si ya estaba introducida; luego se retoma un escalón por debajo "
        "en todo.")
    ws["A112"] = (
        "AVISO S4 (fisio deportivo pendiente): se calcula al cerrar S4 (domingo 15/11) si hay al "
        "menos 5 mañanas registradas en S2 y en S4. Compara la media de las mañanas: PEOR si la "
        "de S4 supera en 0,5 o más a la de S2; MEJOR si queda 0,5 o más por debajo; si no, IGUAL. "
        "IGUAL o PEOR, o un chasquido que empieza a doler: la valoración del fisio pasa a ser "
        "prioritaria; PEOR además para la progresión [LÓGICA]. «Seguimiento rodilla» lo calcula.")


def semaforo(r):
    """Columna P: semáforo de la sesión (ver A104/A105)."""
    carrera = f'$E{r}="{CARRERA}"'
    falla_sesion = f'OR($J{r}>IF({carrera},2,3),AND({carrera},$K{r}="No"))'
    return (
        f'=IF($E{r}="—","—",IF($J{r}="","",IF($I{r}="","sin referencia",'
        f'IF(AND({carrera},$K{r}=""),"falta K",IF({falla_sesion},"Retroceder",'
        f'IF($M{r}="","pendiente",IF($M{r}>$I{r},"Retroceder",'
        f'IF($N{r}="","pendiente",IF($O{r}<=$I{r},"Avanzar","Mantener")))))))))')


def estilo(dst, src):
    dst._style = copy.copy(src._style)


def seguimiento(ws):
    ws["A2"] = (
        "Cada mañana, en casa y antes de nada: test en declive y 10 subidas con la D al mismo "
        "escalón o banco (0-10) → columnas G y H; si falta, ese día no se evalúa y la primera "
        "medición disponible hace de referencia. Después de la sesión: molestia máxima durante (J); "
        "en carrera, si vuelves al nivel previo en ≤60 min (K); y si el chasquido dolió (L). El "
        "resto se calcula solo: 24 h y 48 h salen de las mañanas siguientes, y el semáforo (P) da "
        "«Retroceder» (más de 3/10 en gimnasio o 2/10 en carrera, no vuelves al nivel previo, o la "
        "mañana siguiente peor), «Mantener» (cumple, pero el peor valor 24-48 h supera la "
        "referencia: la mañana del día de la sesión) o «Avanzar». Solo se evalúan los días con "
        "carga de rodilla (regla distinta de «—»). «Novedad» trae lo planificado: si no la aplicas "
        "porque esa mañana estabas peor, cámbiala por «ninguna». Las celdas amarillas son para "
        "rellenar.")
    ws["P4"] = "Semáforo (auto)"

    # 10. Con el nivel intermedio, N6 ya no son 30' seguidos.
    assert ws["F42"].value == "Carrera N6 (30')"
    ws["F42"] = "Carrera N6 (2×12')"

    for r in range(5, 68):
        dia, regla = ws[f"B{r}"].value, ws[f"E{r}"].value
        # 10. Semáforo solo en días con carga de rodilla: martes y viernes (push/torso, bici,
        # paseo de entrada) pasan a «—». El paseo se valida en «Entrada a la carrera».
        if dia in ("M", "V") and regla != "—":
            ws[f"E{r}"] = "—"
        ws[f"P{r}"] = semaforo(r)
    for r in range(72, 81):
        ws[f"F{r}"] = f'=COUNTIFS($C$5:$C$67,$A{r},$P$5:$P$67,"Retroceder")'
    ws["F71"] = "Sesiones a retroceder"

    # Formato condicional del semáforo.
    cf = ws.conditional_formatting
    reglas = cf._cf_rules
    for rango in list(reglas):
        if str(rango.sqref) == "P5:P67":
            del reglas[rango]
    dxf = ws.parent._differential_styles
    rojo, verde, ambar = dxf.dxf[0], dxf.dxf[1], dxf.dxf[3]
    cf.add("P5:P67", FormulaRule(formula=['P5="Retroceder"'], font=rojo.font, fill=rojo.fill))
    cf.add("P5:P67", FormulaRule(formula=['P5="Mantener"'], fill=ambar.fill))
    cf.add("P5:P67", FormulaRule(formula=['P5="Avanzar"'], font=verde.font, fill=verde.fill))

    # 4. Aviso S4.
    m2 = '$C$5:$C$67,"S2",$I$5:$I$67,">=0"'
    m4 = '$C$5:$C$67,"S4",$I$5:$I$67,">=0"'
    ws["E82"] = (
        '=IF(TODAY()<DATE(2026,11,15),"Pendiente: se calcula al cerrar S4 (domingo 15/11)",'
        f'IF(OR(COUNTIFS({m2})<5,COUNTIFS({m4})<5),'
        '"Pendiente: hacen falta al menos 5 mañanas registradas en S2 y en S4",'
        'IF(ROUND(B74-B72,1)>=0.5,"PEOR que en S2 (+0,5 o más): para la progresión y la valoración del fisio pasa a ser prioritaria",'
        'IF(ROUND(B72-B74,1)>=0.5,"MEJOR que en S2 (−0,5 o más): sigue el plan",'
        '"IGUAL que en S2 (menos de 0,5 de diferencia): la valoración del fisio pasa a ser prioritaria"))))')
    ws["A84"] = (
        "La molestia de cada semana es la media de las mañanas (peor de las dos pruebas). El aviso "
        "S4 se calcula al cerrar S4 (domingo 15/11) con al menos 5 mañanas en S2 y en S4: PEOR si "
        "la media de S4 supera en 0,5 o más a la de S2, MEJOR si queda 0,5 o más por debajo y, si "
        "no, IGUAL. IGUAL o PEOR: la valoración del fisio pasa a ser prioritaria; PEOR además para "
        "la progresión [LÓGICA].")

    # 6. S2 = semana de referencia: alguna mañana de S2 peor que la primera medición de S2.
    primera = '"x"'
    for r in range(11, 4, -1):
        primera = f"IF(ISNUMBER(I{r}),I{r},{primera})"
    ws["A81"] = "S2 · semana de referencia"
    ws["E81"] = (
        '=IF(COUNT(I5:I11)=0,"Pendiente: falta la primera medición de S2",'
        f'IF(MAX(I5:I11)>{primera},'
        '"REPITE S2: alguna mañana salió peor que la referencia; en S3 no sube nada",'
        '"S2 estable por ahora: en S3 se sigue el plan"))')
    for col in "ABCDEFGHIJKLMNOPQ":
        estilo(ws[f"{col}81"], ws[f"{col}82"])
    ws.merge_cells("A81:D81")
    ws.merge_cells("E81:Q81")
    ws.row_dimensions[81].height = ws.row_dimensions[82].height
    cf.add("E81", FormulaRule(formula=['ISNUMBER(SEARCH("REPITE",E81))'], fill=dxf.dxf[2].fill))
    cf.add("E81", FormulaRule(formula=['ISNUMBER(SEARCH("estable",E81))'], fill=dxf.dxf[4].fill))

    # 10. Entrada a la carrera con casillas; se repite cada semana hasta cumplirse.
    ws["A87"] = ("Entrada a la carrera · regla de carrera: ≤2/10 (si no se cumple, se repite el "
                 "miércoles siguiente: apunta aquí el último intento)")
    for r in range(88, 92):
        ws.unmerge_cells(f"A{r}:F{r}")
        ws.merge_cells(f"A{r}:C{r}")
    cab, entrada, calc, fijo = ws["A88"], ws["G5"], ws["I5"], ws["G89"]
    for col, texto in zip("DEF", ("≤2/10 durante", "Nivel previo en ≤60 min",
                                 "Mañana siguiente no peor (auto)")):
        ws[f"{col}88"] = texto
        estilo(ws[f"{col}88"], cab)
    ws["H88"] = "¿Cumple? (auto)"
    for r in (89, 90, 91):
        ws[f"D{r}"] = None
        estilo(ws[f"D{r}"], entrada)
    ws["E89"] = None
    estilo(ws["E89"], entrada)
    for ref in ("E90", "E91", "F90", "F91"):
        ws[ref] = "—"
        estilo(ws[ref], fijo)

    # Día del intento: el martes del paseo (fecha); los criterios 2 y 3, el día siguiente.
    ws["G89"] = ws["A6"].value   # martes 27/10
    estilo(ws["G89"], entrada)
    ws["G89"].number_format = "dd/mm/yyyy"
    for r in (90, 91):
        ws[f"G{r}"] = "=G89+1"
        estilo(ws[f"G{r}"], calc)
        ws[f"G{r}"].number_format = "dd/mm/yyyy"

    manana = "INDEX($I$5:$I$67,MATCH({d},$A$5:$A$67,0))"
    hoy, sig = manana.format(d="G89"), manana.format(d="G89+1")
    ws["F89"] = (f'=IF(G89="","",IFERROR(IF(OR({hoy}="",{sig}=""),"",'
                 f'IF({sig}<={hoy},"Sí","No")),""))')
    estilo(ws["F89"], calc)
    ws["H89"] = ('=IF(OR(D89="No",E89="No",F89="No"),"No",'
                 'IF(AND(D89="Sí",E89="Sí",F89="Sí"),"Sí",""))')
    for r in (90, 91):
        ws[f"H{r}"] = f'=IF(D{r}="","",D{r})'
    for r in (89, 90, 91):
        estilo(ws[f"H{r}"], calc)
    ws["H92"] = ('=IF(COUNTIF(H89:H91,"Sí")=3,"SÍ: 1.ª carrera hoy (N1)",'
                 'IF(COUNTIF(H89:H91,"No")>0,"NO: esta semana no hay carrera (el domingo, como '
                 'mucho, un paseo); repite los criterios el miércoles siguiente","Pendiente"))')

    # Validaciones: las casillas de entrada son Sí/No; H89:H91 ya son fórmulas.
    for dv in ws.data_validations.dataValidation:
        if dv.type == "list":
            dv.sqref = openpyxl.worksheet.cell_range.MultiCellRange("K5:L67")
    si_no = DataValidation(type="list", formula1='"Sí,No"', allow_blank=True)
    si_no.add("D89:D91")
    si_no.add("E89")
    ws.add_data_validation(si_no)


def main():
    wb = openpyxl.load_workbook(SRC, rich_text=True)
    volumen(wb["Volumen (1910-1112)"])
    seguimiento(wb["Seguimiento rodilla"])
    wb.calculation.fullCalcOnLoad = True
    wb.save(OUT)
    print(f"{OUT.relative_to(ROOT)} <- {SRC.relative_to(ROOT)}")


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    main()
