"""Genera js/rodilla-data.js a partir de docs/plan-rodilla/volcado.json (hoja
«Seguimiento rodilla» del Excel de la raíz).

    python tools/volcado_excel.py && python tools/genera_rodilla_data.py

Los textos de cada día (columnas D/E/F) y los de las tablas son los literales del
Excel; la ayuda de la pestaña Rodilla (`textos.ayuda`) está escrita para la app y no
sale del Excel.
"""
import json
import pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
HOJA = json.loads((ROOT / "docs" / "plan-rodilla" / "volcado.json").read_text(encoding="utf-8"))["Seguimiento rodilla"]

AYUDA = (
    "Cada mañana, en casa y antes de nada, haz las dos pruebas: el test en declive y 10 "
    "subidas con la D al mismo escalón o banco, y apunta cada una de 0 a 10. La molestia de "
    "la mañana es la peor de las dos y es la referencia del día; si un día no mides, ese día "
    "no se evalúa y la siguiente medición hace de referencia.\n"
    "Después de una sesión con carga de rodilla (lunes, jueves y días de carrera) apunta la "
    "molestia máxima durante; en carrera, si vuelves al nivel previo en 60 minutos o menos; y "
    "si el chasquido dolió.\n"
    "Con las mañanas siguientes sale el semáforo: Retroceder (más de 3/10 en gimnasio o 2/10 "
    "en carrera, no vuelves al nivel previo o la mañana siguiente estás peor), Mantener "
    "(cumples, pero a las 48 h estás peor que la referencia) o Avanzar. Con él, Progresión "
    "propone el nivel de la prensa y de la carrera de cada semana, sin pasar del calendario; "
    "si haces otra cosa, apunta allí el nivel real.")


def t(ref):
    c = HOJA.get(ref)
    return c["v"] if c else ""


def iso(ref):
    return t(ref)[:10]


def j(x):
    return json.dumps(x, ensure_ascii=False)


def main():
    o = ["""/* GENERADO por tools/genera_rodilla_data.py — no editar a mano.
   Datos fijos del seguimiento de rodilla, volcados de la hoja «Seguimiento rodilla» del
   Excel (docs/plan-rodilla/volcado.json). Contrato: objeto global `RODILLA_DATA`, solo
   datos, sin lógica. Los textos de cada día son los literales del Excel (columnas D/E/F). */

const RODILLA_DATA = {"""]
    o.append(f"  desde: {j(iso('A5'))},\n  hasta: {j(iso('A67'))},")
    o.append("  reglas: { gimnasio: 'Gimnasio (≤3/10)', carrera: 'Carrera (≤2/10)', ninguna: '—' },")
    o.append(f"  semanas: {j([f'S{i}' for i in range(2, 11)])},")
    o.append("  textos: {\n"
             f"    ayuda: {j(AYUDA)},\n"
             f"    resumen: {j(t('A84'))},\n"
             f"    fuerza: {j(t('A101'))},\n"
             f"    escalones: {j(t('A110'))},\n"
             "  },")
    o.append(f"  titulos: {{ entrada: {j(t('A87'))}, fuerza: {j(t('A95'))}, escalones: {j(t('A103'))} }},")
    o.append("  // Calendario: fecha ISO, día (L/M/X/J/V/S/D), semana, sesión, regla y novedad previstas.\n  dias: [")
    for r in range(5, 68):
        o.append(f"    {{ fecha: {j(iso(f'A{r}'))}, dia: {j(t(f'B{r}'))}, sem: {j(t(f'C{r}'))}, "
                 f"sesion: {j(t(f'D{r}'))}, regla: {j(t(f'E{r}'))}, novedad: {j(t(f'F{r}'))} }},")
    o.append("  ],")
    o.append("  // Criterios de entrada a la carrera (A89–A91). Se registran por semana en\n"
             "  // Store.knee().entry; el 1 es el paseo del martes y el 2 y el 3, el miércoles.\n  entrada: [")
    for clave, r, dia in (("walk", 89, "martes"), ("touchdown", 90, "miércoles"), ("hops", 91, "miércoles")):
        o.append(f"    {{ clave: {j(clave)}, texto: {j(t(f'A{r}'))}, dia: {j(dia)} }},")
    o.append("  ],\n  // Tests de fuerza: clave en Store.knee().tests.\n  tests: [")
    for clave, r in zip(["t1", "t2", "t3", "t4"], [97, 98, 99, 100]):
        o.append(f"    {{ clave: {j(clave)}, nombre: {j(t(f'A{r}'))}, fecha: {j(iso(f'D{r}'))}, rango: {j(t(f'E{r}'))} }},")
    o.append("  ],\n  // Escalones de profundidad: clave en Store.knee().depth.\n  escalones: [")
    for clave, r in zip("01234", range(105, 110)):
        o.append(f"    {{ clave: {j(clave)}, nombre: {j(t(f'A{r}'))} }},")
    o.append("  ],\n};\n")
    (ROOT / "js" / "rodilla-data.js").write_text("\n".join(o), encoding="utf-8", newline="\n")
    print("js/rodilla-data.js")


if __name__ == "__main__":
    main()
