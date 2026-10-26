"""Comprueba que el plan de volumen de js/plan.js coincide celda a celda con la
hoja "Volumen (1910-1112)" de Plan_8sem_vol_definitivo_con_cardio.xlsx.

    python tools/verify_plan.py [ruta/al/excel.xlsx]

Lee la hoja con openpyxl y el plan evaluando js/plan.js con Node, y compara
por cada fila de ejercicio las columnas A (ejercicio), B (objetivo), C–J
(semanas 1–8) y K (notas), además del día y título de cada sesión, el bloque de
cardio y carrera (filas 95–98), los hitos (fila 99), los textos de reglas (A2,
A64), semanas 9–10 (A66–A69), títulos (A93, A101) y reglas del bloque rodilla
(A102–A113), y el recuento de series por grupo (filas 73–83, 52 → 88). Sale con código 1
si algo difiere.
"""
import json
import pathlib
import re
import subprocess
import sys

import openpyxl

ROOT = pathlib.Path(__file__).resolve().parent.parent
XLSX = ROOT / "Plan_8sem_vol_definitivo_con_cardio.xlsx"
SHEET = "Volumen (1910-1112)"
WEEKCOLS = "CDEFGHIJ"

# Bloque de cardio y carrera: (clave en BLOCK_VOL, fila). Cada fila es el último
# ejercicio de esa sesión (el único en D), con objetivo "Cardio"; el nombre sale de B.
CARDIO = [("M", 95), ("V", 96), ("X", 97), ("D", 98)]
HITOS_ROW = 99

# (clave en BLOCK_VOL, fila de cabecera, última fila de ejercicio)
BLOCKS = [("L", 4, 12), ("M", 14, 20), ("X", 23, 31), ("J", 33, 42), ("V", 44, 53), ("S", 55, 63)]
TEXTS = {"A2": ("rules", 0), "A64": ("rules", 1),
         "A66": ("notes", 0), "A67": ("notes", 1), "A68": ("notes", 2), "A69": ("notes", 3),
         "A93": ("cardioTitle", None), "A101": ("blockRulesTitle", None),
         "K99": ("hitosNote", None)}
TEXTS.update({f"A{102 + i}": ("blockRules", i) for i in range(12)})
# Filas 73–82: grupos, 83: TOTAL. Columnas C–J = semanas 1–8.
COUNT_ROWS = range(73, 84)

DUMP = (
    "const src = require('fs').readFileSync(process.argv[1], 'utf8');"
    "const PLAN = new Function(src + ';return PLAN;')();"
    "process.stdout.write(JSON.stringify({"
    "  blocks: PLAN.BLOCK_VOL, rules: PLAN.VOL_RULES, notes: PLAN.VOL_NOTES,"
    "  hitos: PLAN.VOL_HITOS, hitosNote: PLAN.VOL_HITOS_NOTE,"
    "  blockRules: PLAN.VOL_BLOCK_RULES, blockRulesTitle: PLAN.VOL_BLOCK_RULES_TITLE,"
    "  cardioTitle: PLAN.VOL_CARDIO_TITLE, grupos: PLAN.VOL_GRUPOS,"
    "  series: [1, 2, 3, 4, 5, 6, 7, 8].map((n) => PLAN.seriesPorGrupo(n)) }));"
)


def text(v):
    return "" if v is None else str(v).strip()


def raw(v):
    """Texto de la celda tal cual (sin strip): los saltos de línea y espacios cuentan."""
    return "" if v is None else str(v)


def expected_sets(label):
    """Series que debe tener una etiqueta: «N-M x» → N (la M se añade a mano); test → 3;
    «—»/«-» → 0."""
    if label in ("-", "—"):
        return 0
    m = re.match(r"^(\d+)(?:-(\d+))? x", label)
    if m:
        return int(m.group(1))
    if label.startswith("2 aprox.") or label.startswith("Opcional:"):
        return 3
    m = re.match(r"^(\d+) @ RIR", label)
    if m:
        return int(m.group(1))
    return None


def main():
    xlsx = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else XLSX
    out = subprocess.run(["node", "-e", DUMP, str(ROOT / "js" / "plan.js")],
                         capture_output=True, check=True, encoding="utf-8").stdout
    plan = json.loads(out)
    ws = openpyxl.load_workbook(xlsx)[SHEET]

    errors = []
    compared = 0

    def check(ref, expected, actual):
        nonlocal compared
        compared += 1
        if expected != actual:
            errors.append(f"{ref}: Excel {expected!r} != plan.js {actual!r}")

    def check_sets(ref, p, cardio=False):
        """La prescripción interpretada debe cuadrar con la etiqueta."""
        n = expected_sets(p["label"])
        if cardio:
            n = 0 if p["label"] in ("-", "—") else 1
        if n is None or p["sets"] != n:
            errors.append(f"{ref}: {p['label']!r} interpretado como {p['sets']} series (esperadas {n})")
        elif p["label"].endswith("RIR1/0") and p.get("rirs") != [1] * (n - 1) + [0]:
            errors.append(f"{ref}: RIR por serie {p.get('rirs')} en vez de 1,…,1,0")

    covered = set()
    for key, head, last in BLOCKS:
        session = plan["blocks"].get(key)
        if session is None:
            errors.append(f"Falta la sesión {key} en BLOCK_VOL")
            continue
        h = text(ws.cell(head, 1).value)
        # «(X) Día  ·  título»: el día va entre ") " y el primer «·»; el título, tras él.
        check(f"A{head} (día)", h.split(") ", 1)[1].split("·", 1)[0].strip(), session["name"])
        check(f"A{head} (título)", h.split("·", 1)[1].strip() if "·" in h else "", session["title"])

        rows = [r for r in range(head + 2, last + 1) if text(ws.cell(r, 1).value)]
        covered.update(range(head, last + 1))
        exercises = [e for e in session["exercises"] if e["target"] != "Cardio"]
        if len(rows) != len(exercises):
            errors.append(f"Sesión {key}: {len(rows)} ejercicios en el Excel, {len(exercises)} en plan.js")
        for r, ex in zip(rows, exercises):
            check(f"A{r}", text(ws.cell(r, 1).value), ex["name"])
            check(f"B{r}", raw(ws.cell(r, 2).value), ex["target"])
            for w, col in enumerate(WEEKCOLS):
                p = ex["pres"][w]
                check(f"{col}{r}", raw(ws[f"{col}{r}"].value), p["label"])
                check_sets(f"{col}{r}", p)
            check(f"K{r}", raw(ws.cell(r, 11).value), ex["notes"])

    # Cardio y carrera (filas 95–98): último ejercicio de la sesión; nombre = B.
    for key, r in CARDIO:
        exs = plan["blocks"][key]["exercises"]
        cardio = [e for e in exs if e["target"] == "Cardio"]
        if len(cardio) != 1 or exs[-1]["target"] != "Cardio":
            errors.append(f"Sesión {key}: el cardio debe ser un único ejercicio, el último")
            continue
        if key == "D" and len(exs) != 1:
            errors.append("Sesión D: la carrera del domingo debe ser el único ejercicio")
        ex = cardio[0]
        check(f"B{r}", raw(ws.cell(r, 2).value), ex["name"])
        for w, col in enumerate(WEEKCOLS):
            check(f"{col}{r}", raw(ws[f"{col}{r}"].value), ex["pres"][w]["label"])
            if ex["pres"][w]["kind"] not in ("cardio", "none"):
                errors.append(f"{col}{r}: no se interpretó como cardio")
            check_sets(f"{col}{r}", ex["pres"][w], cardio=True)
        check(f"K{r}", raw(ws.cell(r, 11).value), ex["notes"])

    # Hitos y avisos (fila 99): C–J por semana; la nota general está en K99.
    if len(plan["hitos"]) != 8:
        errors.append(f"VOL_HITOS: {len(plan['hitos'])} textos, se esperaban 8")
    for w, col in enumerate(WEEKCOLS):
        check(f"{col}{HITOS_ROW}", raw(ws[f"{col}{HITOS_ROW}"].value),
              plan["hitos"][w] if w < len(plan["hitos"]) else None)

    # Ninguna fila con datos fuera de los bloques conocidos (filas 3–63).
    for r in range(3, 64):
        if r not in covered and any(text(ws.cell(r, c).value) for c in range(2, 12)):
            errors.append(f"Fila {r}: hay datos fuera de los bloques de sesión")

    for ref, (field, i) in TEXTS.items():
        values = plan[field]
        if i is None:
            check(ref, raw(ws[ref].value), values)
        else:
            check(ref, raw(ws[ref].value), values[i] if i < len(values) else None)
    for field, refs in (("rules", 2), ("notes", 4), ("blockRules", 12)):
        if len(plan[field]) != refs:
            errors.append(f"{field}: {len(plan[field])} textos, se esperaban {refs}")

    # Recuento de series por grupo (filas 73–83). El Excel ajustado se guarda sin
    # valores calculados, así que se replica aquí su fórmula de matriz
    # (=SUM(($B$3:$B$63="grupo")*IFERROR(VALUE(LEFT(C$3:C$63,FIND(" ",C$3:C$63&" ")-1)),0)))
    # y se comprueba que la tabla sigue usándola.
    def series(grupo, col):
        total = 0
        for r in range(3, 64):
            if raw(ws.cell(r, 2).value) == grupo:
                cabeza = text(ws[f"{col}{r}"].value).split(" ")[0]
                total += int(cabeza) if cabeza.isdigit() else 0
        return total

    filas = {text(ws.cell(r, 1).value): r for r in COUNT_ROWS}
    for grupo in plan["grupos"]:
        row = filas.get(grupo)
        if row is None:
            errors.append(f"Recuento: no hay fila para {grupo!r} en la hoja")
            continue
        formula = getattr(ws[f"C{row}"].value, "text", "")
        if f'="{grupo}")' not in formula or "C$3:C$63" not in formula:
            errors.append(f"C{row}: la fórmula del recuento de {grupo!r} ha cambiado: {formula!r}")
        for w, col in enumerate(WEEKCOLS):
            check(f"{col}{row} ({grupo} S{w + 1})", series(grupo, col), plan["series"][w][grupo])
    for w, total in enumerate([52, 57, 62, 66, 71, 76, 80, 88]):
        check(f"TOTAL S{w + 1}", total, plan["series"][w]["TOTAL"])

    # Ningún correctivo ni cardio suma al recuento: su objetivo no es un grupo.
    for key, s in plan["blocks"].items():
        for e in s["exercises"]:
            if (e["target"].endswith("(correctivo)") or e["target"] == "Cardio") and e["target"] in plan["grupos"]:
                errors.append(f"{key}/{e['name']}: el objetivo {e['target']!r} sumaría al recuento")

    for e in errors:
        print("DIFERENCIA", e)
    print(f"{compared} celdas comparadas · {len(errors)} diferencias")
    return 1 if errors else 0


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    sys.exit(main())
