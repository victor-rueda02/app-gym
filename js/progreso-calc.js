/* Cálculos de la pestaña Progreso: 1RM estimado por serie, mejor 1RM por día, récords,
   progresión, volumen semanal de hipertrofia, RIR medio y cumplimiento.
   Contrato: objeto global `ProgresoCalc` con funciones puras (sin DOM, sin Store y sin leer
   el global PLAN: el catálogo de ejercicios y los grupos entran por parámetro), así se
   prueban desde Node. `data` es `Store.all()`: { days: { 'YYYY-MM-DD': { entries: { exId:
   [ { kg, reps, secs, rir, mins, side? } ] } } } }. Los valores de las series son texto
   tal como se tecleó (coma ya convertida a punto, '' = vacío); también se aceptan números. */

const ProgresoCalc = (() => {
  const vacio = (v) => v === '' || v === null || v === undefined || (typeof v === 'string' && v.trim() === '');
  const r1 = (x) => Math.round(x * 10) / 10;

  /* Número finito o null. Acepta '72.5', '72,5', ' 8 ' y números; '10-12', 'abc' y vacío -> null. */
  function num(v) {
    if (typeof v === 'number') return Number.isFinite(v) ? v : null;
    if (typeof v !== 'string') return null;
    const t = v.trim().replace(',', '.');
    if (!/^[+-]?(\d+\.?\d*|\.\d+)$/.test(t)) return null;
    const n = Number(t);
    return Number.isFinite(n) ? n : null;
  }

  const redondear05 = (x) => Math.round(x * 2) / 2;

  /* 1RM estimado. Brzycki si reps+RIR <= 10, Epley si <= 15, más de 15 no se calcula.
     RIR vacío = 0 con `sinRir: true`. */
  function estimar1RM(kg, reps, rir) {
    const nulo = { valor: null, repsEf: null, formula: null, sinRir: false };
    const k = num(kg);
    const r = num(reps);
    if (k === null || k <= 0 || r === null || r <= 0 || !Number.isInteger(r)) return nulo;
    let ri = 0;
    let sinRir = false;
    if (vacio(rir)) sinRir = true;
    else {
      ri = num(rir);
      if (ri === null || ri < 0) return nulo;
    }
    const repsEf = r + ri;
    if (repsEf > 15) return { valor: null, repsEf, formula: null, sinRir };
    if (repsEf <= 10) return { valor: redondear05((k * 36) / (37 - repsEf)), repsEf, formula: 'brzycki', sinRir };
    return { valor: redondear05(k * (1 + repsEf / 30)), repsEf, formula: 'epley', sinRir };
  }

  /* '~106,5', '~112' o '—'. Acepta el objeto de estimar1RM o un número. */
  function fmt1RM(r) {
    const v = typeof r === 'number' ? r : (r && r.valor);
    if (typeof v !== 'number' || !Number.isFinite(v)) return '—';
    const t = Number.isInteger(v) ? String(v) : v.toFixed(1).replace(/\.0$/, '').replace('.', ',');
    return '~' + t;
  }

  /* Catálogo de ejercicios a partir de las sesiones del plan (el volumen primero: si un id
     se repite gana la primera aparición). */
  function catalogo(sesiones, grupos = []) {
    const cat = {};
    for (const ses of sesiones || []) {
      for (const ex of (ses && ses.exercises) || []) {
        if (cat[ex.id]) continue;
        const pres = (ex.pres || [ex.s1, ex.s2]).filter(Boolean);
        const conRir = pres.some((p) => p.kind === 'rir');
        const t = ex.target || '';
        const conCarga = pres.some((p) => p.kind === 'rir' || p.kind === 'fixed')
          && t !== 'Cardio' && t !== 'Test' && !t.endsWith('(correctivo)') && !ex.link;
        cat[ex.id] = { id: ex.id, name: ex.name, target: t, conCarga, conRir, hipertrofia: grupos.includes(t), sides: !!ex.sides };
      }
    }
    return cat;
  }

  /* Fechas: todo en UTC para no depender de la zona horaria. */
  const aUTC = (f) => { const [y, m, d] = f.split('-').map(Number); return Date.UTC(y, m - 1, d); };
  const deUTC = (ms) => new Date(ms).toISOString().slice(0, 10);
  const sumarDias = (fecha, n) => deUTC(aUTC(fecha) + n * 86400000);
  function semanaDe(fecha) {
    const dow = new Date(aUTC(fecha)).getUTCDay();   // 0 = domingo
    return sumarDias(fecha, -((dow + 6) % 7));
  }

  const fechas = (data) => Object.keys((data && data.days) || {}).sort();
  const ladoDe = (s) => (s && (s.side === 'D' || s.side === 'I') ? s.side : '');
  const cmpFechaDescNombre = (a, b, fa, fb) => (fa < fb ? 1 : fa > fb ? -1 : a.name.localeCompare(b.name, 'es'));

  /* Series que valen para el 1RM, ordenadas por fecha. La app no distingue calentamientos:
     si algún día se marcan, aquí (junto a la comprobación de kg > 0) se filtrarían. */
  function seriesConCarga(data, cat) {
    const out = [];
    for (const fecha of fechas(data)) {
      const entries = (data.days[fecha] && data.days[fecha].entries) || {};
      for (const exId of Object.keys(entries)) {
        if (!cat[exId] || !cat[exId].conCarga) continue;
        for (const s of entries[exId] || []) {
          if (!s) continue;
          // (aquí se descartarían las series de calentamiento, si la app llegara a marcarlas)
          const e = estimar1RM(s.kg, s.reps, s.rir);
          if (e.valor === null) continue;
          out.push({
            fecha, exId, side: ladoDe(s), kg: num(s.kg), reps: num(s.reps), rir: num(s.rir),
            sinRir: e.sinRir, valor: e.valor, repsEf: e.repsEf, formula: e.formula,
          });
        }
      }
    }
    return out;
  }

  const ORDEN_LADO = { '': 0, D: 1, I: 2 };

  /* Una línea por lado con el mejor 1RM de cada día y la marca de récord. */
  function mejor1RMPorDia(data, cat, exId) {
    const lineas = {};
    for (const s of seriesConCarga(data, cat)) {
      if (s.exId !== exId) continue;
      const dias = (lineas[s.side] = lineas[s.side] || {});
      if (!dias[s.fecha] || s.valor > dias[s.fecha].valor) dias[s.fecha] = s;
    }
    return Object.keys(lineas).sort((a, b) => ORDEN_LADO[a] - ORDEN_LADO[b]).map((side) => {
      let max = -Infinity;
      const puntos = Object.keys(lineas[side]).sort().map((fecha) => {
        const s = lineas[side][fecha];
        const record = max !== -Infinity && s.valor > max;
        if (s.valor > max) max = s.valor;
        return { fecha, valor: s.valor, kg: s.kg, reps: s.reps, rir: s.rir, sinRir: s.sinRir, record };
      });
      return { side, puntos };
    });
  }

  const exIdsConDatos = (data, cat) => [...new Set(seriesConCarga(data, cat).map((s) => s.exId))];

  function ejerciciosConDatos(data, cat) {
    const por = {};
    for (const s of seriesConCarga(data, cat)) {
      const o = (por[s.exId] = por[s.exId] || { dias: new Set(), ultimo: '', mejor: 0 });
      o.dias.add(s.fecha);
      if (s.fecha > o.ultimo) o.ultimo = s.fecha;
      if (s.valor > o.mejor) o.mejor = s.valor;
    }
    return Object.keys(por).map((exId) => ({
      exId, name: cat[exId].name, target: cat[exId].target, dias: por[exId].dias.size, ultimo: por[exId].ultimo, mejor: por[exId].mejor,
    })).sort((a, b) => cmpFechaDescNombre(a, b, a.ultimo, b.ultimo));
  }

  /* Últimos récords de todas las líneas; `anterior` = mejor valor previo de la línea. */
  function records(data, cat, limite = 10) {
    const out = [];
    for (const exId of exIdsConDatos(data, cat)) {
      for (const l of mejor1RMPorDia(data, cat, exId)) {
        let previo = null;
        for (const p of l.puntos) {
          if (p.record) out.push({ fecha: p.fecha, exId, name: cat[exId].name, side: l.side, valor: p.valor, anterior: previo });
          if (previo === null || p.valor > previo) previo = p.valor;
        }
      }
    }
    out.sort((a, b) => cmpFechaDescNombre(a, b, a.fecha, b.fecha));
    return out.slice(0, limite);
  }

  /* Último día frente al anterior de cada línea con al menos 2 días. */
  function progresion(data, cat) {
    const out = [];
    for (const exId of exIdsConDatos(data, cat)) {
      for (const l of mejor1RMPorDia(data, cat, exId)) {
        if (l.puntos.length < 2) continue;
        const u = l.puntos[l.puntos.length - 1];
        const p = l.puntos[l.puntos.length - 2];
        const diff = r1(u.valor - p.valor);
        out.push({
          exId, name: cat[exId].name, side: l.side,
          ultimo: { fecha: u.fecha, valor: u.valor }, previo: { fecha: p.fecha, valor: p.valor },
          diff, tendencia: diff >= 0.5 ? 'mejor' : diff <= -0.5 ? 'peor' : 'igual',
        });
      }
    }
    return out.sort((a, b) => cmpFechaDescNombre(a, b, a.ultimo.fecha, b.ultimo.fecha));
  }

  /* Series registradas (algún dato) de ejercicios de hipertrofia, con su semana. */
  function seriesHipertrofia(data, cat) {
    const out = [];
    for (const fecha of fechas(data)) {
      const entries = (data.days[fecha] && data.days[fecha].entries) || {};
      for (const exId of Object.keys(entries)) {
        if (!cat[exId] || !cat[exId].hipertrofia) continue;
        for (const s of entries[exId] || []) {
          if (!s || ![s.kg, s.reps, s.secs, s.mins].some((v) => !vacio(v))) continue;
          out.push({ semana: semanaDe(fecha), exId, s });
        }
      }
    }
    return out;
  }

  function listaSemanas(series) {
    if (!series.length) return [];
    const ss = series.map((x) => x.semana).sort();
    const out = [];
    for (let w = ss[0]; w <= ss[ss.length - 1]; w = sumarDias(w, 7)) out.push(w);
    return out;
  }

  /* Series (D/I = 0,5) y tonelaje (kg x reps) por semana y grupo; semanas contiguas. */
  function volumenSemanal(data, cat, grupos) {
    const series = seriesHipertrofia(data, cat);
    const semanas = listaSemanas(series);
    const vacioArr = () => ({ series: semanas.map(() => 0), tonelaje: semanas.map(() => 0) });
    const porGrupo = Object.fromEntries(grupos.map((g) => [g, vacioArr()]));
    const total = vacioArr();
    for (const { semana, exId, s } of series) {
      const i = semanas.indexOf(semana);
      const peso = ladoDe(s) ? 0.5 : 1;
      const k = num(s.kg);
      const r = num(s.reps);
      const ton = k !== null && r !== null ? k * r : 0;
      const g = porGrupo[cat[exId].target];
      for (const o of g ? [g, total] : [total]) { o.series[i] += peso; o.tonelaje[i] += ton; }
    }
    return { semanas, porGrupo, total };
  }

  /* RIR medio por semana (solo semanas con algún RIR escrito), a 0,1. */
  function rirMedioSemanal(data, cat, grupos) { // eslint-disable-line no-unused-vars
    const series = seriesHipertrofia(data, cat);
    return listaSemanas(series).map((semana) => {
      const rs = series.filter((x) => x.semana === semana).map((x) => num(x.s.rir)).filter((v) => v !== null);
      return { semana, media: rs.length ? r1(rs.reduce((a, b) => a + b, 0) / rs.length) : null, n: rs.length };
    }).filter((x) => x.n > 0);
  }

  /* RIR objetivo medio de la semana n (1-8) del plan de volumen, ponderado por series. */
  function rirPrescrito(sesiones, n, grupos) {
    let suma = 0;
    let sets = 0;
    for (const ses of sesiones || []) {
      for (const ex of (ses && ses.exercises) || []) {
        if (!ex.pres || !grupos.includes(ex.target)) continue;
        const p = ex.pres[n - 1];
        if (!p || p.kind !== 'rir') continue;
        suma += Array.isArray(p.rirs) ? p.rirs.reduce((a, b) => a + b, 0) : p.rir * p.sets;
        sets += p.sets;
      }
    }
    return sets > 0 ? r1(suma / sets) : null;
  }

  function cumplimiento(hechas, planificadas) {
    return planificadas > 0 ? Math.round((100 * hechas) / planificadas) : null;
  }

  return {
    num, redondear05, estimar1RM, fmt1RM, catalogo, semanaDe, sumarDias, seriesConCarga,
    mejor1RMPorDia, ejerciciosConDatos, records, progresion, volumenSemanal, rirMedioSemanal,
    rirPrescrito, cumplimiento,
  };
})();
