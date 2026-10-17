"""Comprueba que el plan de volumen de js/plan.js coincide celda a celda con la
hoja "Volumen (1910-1112)" de Plan_8sem_vol.xlsx.

    python tools/verify_plan.py

Lee la hoja con openpyxl y el plan evaluando js/plan.js con Node, y compara
por cada fila de ejercicio las columnas A (ejercicio), B (objetivo), C–J
(semanas 1–8) y K (notas), además del día y título de cada sesión y los textos de
reglas (A2, A61) y semanas 9–10 (A63–A66). Sale con código 1 si algo difiere.
"""
import json
import pathlib
import subprocess
import sys

import openpyxl

ROOT = pathlib.Path(__file__).resolve().parent.parent
XLSX = ROOT / "Plan_8sem_vol.xlsx"
SHEET = "Volumen (1910-1112)"

# (clave en BLOCK_VOL, fila de cabecera, última fila de ejercicio)
BLOCKS = [("L", 4, 12), ("M", 14, 20), ("X", 23, 31), ("J", 33, 41), ("V", 43, 52), ("S", 54, 60)]
TEXTS = {"A2": ("rules", 0), "A61": ("rules", 1),
         "A63": ("notes", 0), "A64": ("notes", 1), "A65": ("notes", 2), "A66": ("notes", 3)}

DUMP = (
    "const src = require('fs').readFileSync(process.argv[1], 'utf8');"
    "const PLAN = new Function(src + ';return PLAN;')();"
    "process.stdout.write(JSON.stringify({"
    "  blocks: PLAN.BLOCK_VOL, rules: PLAN.VOL_RULES, notes: PLAN.VOL_NOTES }));"
)


def text(v):
    return "" if v is None else str(v).strip()


def main():
    out = subprocess.run(["node", "-e", DUMP, str(ROOT / "js" / "plan.js")],
                         capture_output=True, check=True, encoding="utf-8").stdout
    plan = json.loads(out)
    ws = openpyxl.load_workbook(XLSX)[SHEET]

    errors = []
    compared = 0

    def check(ref, expected, actual):
        nonlocal compared
        compared += 1
        if expected != actual:
            errors.append(f"{ref}: Excel {expected!r} != plan.js {actual!r}")

    covered = set()
    for key, head, last in BLOCKS:
        session = plan["blocks"].get(key)
        if session is None:
            errors.append(f"Falta la sesión {key} en BLOCK_VOL")
            continue
        h = text(ws.cell(head, 1).value)
        title = h.split("·", 1)[1].strip() if "·" in h else None
        check(f"A{head} (título)", title, session["title"])
        check(f"A{head} (día)", h.split(")", 1)[1].split("·", 1)[0].strip(), session["name"])

        rows = [r for r in range(head + 2, last + 1) if text(ws.cell(r, 1).value)]
        covered.update(range(head, last + 1))
        exercises = session["exercises"]
        if len(rows) != len(exercises):
            errors.append(f"Sesión {key}: {len(rows)} ejercicios en el Excel, {len(exercises)} en plan.js")
        for r, ex in zip(rows, exercises):
            check(f"A{r}", text(ws.cell(r, 1).value), ex["name"])
            check(f"B{r}", text(ws.cell(r, 2).value), ex["target"])
            for w, col in enumerate("CDEFGHIJ"):
                p = ex["pres"][w]
                check(f"{col}{r}", text(ws[f"{col}{r}"].value), p["label"])
                # La prescripción interpretada debe cuadrar con la etiqueta.
                n = 0 if p["label"] == "-" else int(p["label"].split(" ")[0])
                if p["sets"] != n:
                    errors.append(f"{col}{r}: {p['label']!r} interpretado como {p['sets']} series")
                if p["label"].endswith("RIR1/0") and p.get("rirs") != [1] * (n - 1) + [0]:
                    errors.append(f"{col}{r}: RIR por serie {p.get('rirs')} en vez de 1,…,1,0")
            check(f"K{r}", text(ws.cell(r, 11).value), ex["notes"])

    # Ninguna fila con ejercicio fuera de los bloques conocidos (filas 3–60).
    for r in range(3, 61):
        if r not in covered and text(ws.cell(r, 2).value):
            errors.append(f"Fila {r}: hay datos fuera de los bloques de sesión")

    for ref, (field, i) in TEXTS.items():
        values = plan[field]
        check(ref, text(ws[ref].value), values[i] if i < len(values) else None)
    for field, refs in (("rules", 2), ("notes", 4)):
        if len(plan[field]) != refs:
            errors.append(f"VOL_{field.upper()}: {len(plan[field])} textos, se esperaban {refs}")

    for e in errors:
        print("DIFERENCIA", e)
    print(f"{compared} celdas comparadas · {len(errors)} diferencias")
    return 1 if errors else 0


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    sys.exit(main())
