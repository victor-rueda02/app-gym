/* Lector mínimo de .xlsx: descomprime con fflate y saca el valor de cada celda de cada
   hoja. Sirve igual en el navegador y en Node (no usa DOMParser), así las pruebas leen el
   Excel exactamente como la app.
   Contrato: `LectorXlsx.leer(bytes)` -> { 'Nombre de hoja': { A1: valor, … } }, con
   textos como string, números como number y celdas vacías ausentes; de las fórmulas se
   toma el valor guardado (vacío si el libro se guardó sin calcular).
   `LectorXlsx.fecha(serie)` pasa una fecha de Excel (días desde 1899-12-30) a 'YYYY-MM-DD'. */

const LectorXlsx = (() => {
  const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
  const desescapar = (s) => s.replace(/&(#x[0-9a-fA-F]+|#\d+|amp|lt|gt|quot|apos);/g, (_, e) => {
    if (e[0] !== '#') return ENT[e];
    return String.fromCodePoint(e[1] === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10));
  });
  // Texto de un <si> o un <is>: todos sus <t>, también los de texto enriquecido (<r>).
  const textos = (xml) => [...xml.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>|<t(?:\s[^>]*)?\/>/g)]
    .map((m) => desescapar(m[1] || '')).join('');

  function leerHoja(xml, compartidas) {
    const celdas = {};
    for (const m of xml.matchAll(/<c\s([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attrs = m[1];
      const ref = (attrs.match(/\br="([A-Z]+\d+)"/) || [])[1];
      const cuerpo = m[2] || '';
      if (!ref || !cuerpo) continue;
      const tipo = (attrs.match(/\bt="([^"]+)"/) || [])[1] || 'n';
      const v = (cuerpo.match(/<v>([\s\S]*?)<\/v>/) || [])[1];
      let valor;
      if (tipo === 'inlineStr') valor = textos((cuerpo.match(/<is>([\s\S]*?)<\/is>/) || [])[1] || '');
      else if (v === undefined || v === '') continue;
      else if (tipo === 's') valor = compartidas[+v];
      else if (tipo === 'str' || tipo === 'e') valor = desescapar(v);
      else if (tipo === 'b') valor = v === '1';
      else valor = Number(v);
      if (valor !== '' && valor !== undefined) celdas[ref] = valor;
    }
    return celdas;
  }

  function leer(bytes) {
    const files = fflate.unzipSync(bytes);
    const texto = (p) => (files[p] ? new TextDecoder().decode(files[p]) : '');
    const compartidas = [...texto('xl/sharedStrings.xml').matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => textos(m[1]));
    const rels = texto('xl/_rels/workbook.xml.rels');
    const hojas = {};
    for (const m of texto('xl/workbook.xml').matchAll(/<sheet\b[^>]*\/>/g)) {
      const nombre = desescapar((m[0].match(/\bname="([^"]*)"/) || [])[1] || '');
      const rid = (m[0].match(/\br:id="([^"]+)"/) || [])[1];
      const rel = rels.match(new RegExp(`<Relationship\\b[^>]*Id="${rid}"[^>]*/>`));
      const destino = rel && (rel[0].match(/Target="([^"]+)"/) || [])[1];
      if (!destino) continue;
      const ruta = destino.startsWith('/') ? destino.slice(1) : `xl/${destino}`;
      hojas[nombre] = leerHoja(texto(ruta), compartidas);
    }
    return hojas;
  }

  function fecha(serie) {
    const t = new Date(Date.UTC(1899, 11, 30) + Math.round(serie) * 86400000);
    return t.toISOString().slice(0, 10);
  }

  return { leer, fecha };
})();
