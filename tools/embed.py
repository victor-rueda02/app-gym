"""Regenera js/original-xlsx.js empotrando el .xlsx del plan en base64.

Ejecutar tras cualquier cambio en Plan_8sem_vol_definitivo_con_cardio.xlsx (contiene las hojas
del plan de 4 semanas, el de volumen y «Seguimiento rodilla»):
    python tools/embed.py
"""
import base64
import io
import pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT / "Plan_8sem_vol_definitivo_con_cardio.xlsx"
OUT = ROOT / "js" / "original-xlsx.js"

b64 = base64.b64encode(SRC.read_bytes()).decode("ascii")
chunks = [b64[i:i + 100] for i in range(0, len(b64), 100)]
body = "\n  '" + "'\n  + '".join(chunks) + "'"

js = f"""/* GENERADO por tools/embed.py — no editar a mano.
   {SRC.name} ({SRC.stat().st_size} bytes) en base64. Cada exportación parte de
   estos bytes, de modo que el .xlsx resultante es siempre idéntico al original
   más la hoja Registro y los datos de «Seguimiento rodilla». */

const ORIGINAL_XLSX_NAME = '{SRC.name}';

const ORIGINAL_XLSX_B64 ={body};

function originalXlsxBytes() {{
  const bin = atob(ORIGINAL_XLSX_B64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}}
"""

io.open(OUT, "w", encoding="utf-8", newline="\n").write(js)
print(f"{OUT.relative_to(ROOT)} <- {SRC.name} ({len(b64)} chars base64)")
