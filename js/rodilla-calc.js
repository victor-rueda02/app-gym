/* Cálculos del seguimiento de rodilla (molestia de la mañana, 24 h / 48 h, peor
   24-48 h, ¿cumple?, resumen semanal, avisos, entrada a la carrera y test de
   fuerza). Contrato: objeto global `RodillaCalc` con funciones puras (sin DOM, sin
   Store, sin fecha actual), así se prueban desde Node. Replica las fórmulas de la
   hoja «Seguimiento rodilla» del Excel. Valor vacío = '' (como en el Excel). */

const RodillaCalc = (() => {
  const REGLA_CARRERA = 'Carrera (≤2/10)';
  const esNum = (v) => typeof v === 'number' && Number.isFinite(v);
  const vacio = (v) => v === '' || v === null || v === undefined;

  /* ROUND de Excel: la mitad se aleja de cero y sin errores de coma flotante
     (2.25 -> 2.3, 1.05 -> 1.1). Devuelve '' si no es un número. */
  function redondear1(x) {
    if (!esNum(x)) return '';
    const s = Math.abs(x).toString();
    const a = s.includes('e') ? Math.round(Math.abs(x) * 10) / 10 : Number(Math.round(Number(s + 'e1')) + 'e-1');
    return x < 0 ? -a : a;
  }

  /* Normaliza una entrada a un entero entre `min` y `max`: devuelve el número, ''
     si está vacía o null si no es válida (decimales, negativos, fuera de rango, texto). */
  function enteroRango(valor, min, max) {
    if (vacio(valor)) return '';
    if (typeof valor === 'string') {
      const t = valor.trim();
      if (t === '') return '';
      if (!/^\d{1,3}$/.test(t)) return null;
      valor = Number(t);
    }
    if (!esNum(valor) || !Number.isInteger(valor) || valor < min || valor > max) return null;
    return valor;
  }

  /* Entero 0-10 (molestia): número, '' o null. */
  const entero010 = (valor) => enteroRango(valor, 0, 10);

  /* Entero >= 0 (repeticiones): número, '' o null si es inválido. */
  function enteroPositivo(valor) {
    if (vacio(valor)) return '';
    if (typeof valor === 'string') {
      const t = valor.trim();
      if (t === '') return '';
      if (!/^\d{1,3}$/.test(t)) return null;
      valor = Number(t);
    }
    return esNum(valor) && Number.isInteger(valor) && valor >= 0 ? valor : null;
  }

  /* Decimal >= 0 con coma o punto (carga en kg): número, '' o null. */
  function decimalPositivo(valor) {
    if (vacio(valor)) return '';
    if (typeof valor === 'string') {
      const t = valor.trim().replace(',', '.');
      if (t === '') return '';
      if (!/^\d{1,4}(\.\d{1,2})?$/.test(t)) return null;
      valor = Number(t);
    }
    return esNum(valor) && valor >= 0 ? valor : null;
  }

  /* Molestia de la mañana = máximo de las dos pruebas; con una sola, esa. */
  function molestiaManana(decline, steps) {
    const v = [decline, steps].filter(esNum);
    return v.length ? Math.max(...v) : '';
  }

  /* ¿Cumple?, cascada exacta de la columna P del Excel. La regla «—» cae en la
     rama de gimnasio, como en el Excel. */
  function cumple({ rule, morning, during, back60, h24, worst }) {
    if (!esNum(during)) return '';
    if (!esNum(morning)) return 'sin referencia';
    const carrera = rule === REGLA_CARRERA;
    if (carrera && vacio(back60)) return 'falta K';
    if (!esNum(worst)) return 'pendiente';
    if (carrera) {
      return during <= 2 && back60 === 'Sí' && h24 <= morning && worst <= morning ? 'Sí' : 'No';
    }
    return during <= 3 && worst <= morning ? 'Sí' : 'No';
  }

  /* Fila de un día = plan precargado + lo registrado. session/rule/novelty
     ausentes en el registro = los del plan (presentes, aunque vacíos = lo editado). */
  function filaDia(plan, reg) {
    reg = reg || {};
    const ed = (campo, delPlan) => (reg[campo] !== undefined ? reg[campo] : delPlan);
    return {
      fecha: plan.fecha, dia: plan.dia, sem: plan.sem,
      session: ed('session', plan.sesion), rule: ed('rule', plan.regla), novelty: ed('novelty', plan.novedad),
      decline: reg.decline, steps: reg.steps, during: reg.during,
      back60: reg.back60 || '', click: reg.click || '', notes: reg.notes || '',
    };
  }

  /* Recibe las filas en orden y devuelve copias con morning, h24, h48, worst y
     cumple. 24 h / 48 h = molestia de la mañana de la fila siguiente / la de dos
     después (por orden de filas; tras la última no hay datos). */
  function calcularDias(filas) {
    const morn = filas.map((f) => molestiaManana(f.decline, f.steps));
    return filas.map((f, i) => {
      const h24 = i + 1 < filas.length ? morn[i + 1] : '';
      const h48 = i + 2 < filas.length ? morn[i + 2] : '';
      const worst = h24 === '' || h48 === '' ? '' : Math.max(h24, h48);
      const morning = morn[i];
      return {
        ...f, morning, h24, h48, worst,
        cumple: cumple({ rule: f.rule, morning, during: f.during, back60: f.back60, h24, worst }),
      };
    });
  }

  /* Combina el calendario con el registro (Store.knee().days) y calcula. */
  function tablaDias(dias, registro) {
    return calcularDias(dias.map((d) => filaDia(d, (registro || {})[d.fecha])));
  }

  /* Resumen de una semana a partir de las filas ya calculadas. */
  function resumenSemana(filasCalculadas, sem) {
    const f = filasCalculadas.filter((x) => x.sem === sem);
    const m = f.map((x) => x.morning).filter(esNum);
    return {
      sem,
      media: m.length ? redondear1(m.reduce((a, b) => a + b, 0) / m.length) : '',
      peor: m.length ? Math.max(...m) : '',
      noCumplen: f.filter((x) => x.cumple === 'No').length,
      chasquidos: f.filter((x) => x.click === 'Sí').length,
    };
  }

  function resumenes(filasCalculadas, semanas) {
    return semanas.map((s) => resumenSemana(filasCalculadas, s));
  }

  /* Aviso S4: compara las medias (ya redondeadas) de S4 y S2. */
  function avisoS4(mediaS2, mediaS4) {
    if (!esNum(mediaS2) || !esNum(mediaS4)) return { nivel: 'sin', texto: 'Se calcula cuando haya datos de S2 y S4' };
    if (mediaS4 > mediaS2) return { nivel: 'peor', texto: 'PEOR que en S2: para la progresión y la valoración del fisio pasa a ser prioritaria' };
    if (mediaS4 === mediaS2) return { nivel: 'igual', texto: 'IGUAL que en S2: la valoración del fisio pasa a ser prioritaria' };
    return { nivel: 'mejor', texto: 'MEJOR que en S2: sigue el plan' };
  }

  /* Aviso de chasquido doloroso: alguna fila con click === 'Sí'. */
  function avisoChasquido(filas) {
    const n = filas.filter((f) => f.click === 'Sí').length;
    return n > 0
      ? { activo: true, n, texto: 'Registrado: la valoración del fisio pasa a ser prioritaria' }
      : { activo: false, n: 0, texto: 'Sin chasquido doloroso por ahora' };
  }

  /* Entrada a la carrera: tres valores 'Sí' / 'No' / ''. */
  function entradaResultado(oks) {
    if (oks.filter((o) => o === 'Sí').length === 3) return { estado: 'si', texto: 'SÍ: 1.ª carrera hoy (N1)' };
    if (oks.some((o) => o === 'No')) return { estado: 'no', texto: 'NO: hoy no corres; repite los criterios la semana que viene' };
    return { estado: 'pendiente', texto: 'Pendiente' };
  }

  /* Fuerza estimada (Epley) = carga × (1 + reps/30), un decimal. */
  function fuerzaEstimada(carga, reps) {
    if (!esNum(carga) || !esNum(reps)) return '';
    return redondear1(carga * (1 + reps / 30));
  }

  /* Simetría = estimada D / estimada I (fracción, como en el Excel). */
  function simetria(estD, estI) {
    if (!esNum(estD) || !esNum(estI) || estI === 0) return '';
    return estD / estI;
  }

  /* Simetría en %, con un decimal. */
  function simetriaPct(sim) {
    return esNum(sim) ? redondear1(sim * 100) : '';
  }

  function llega90(sim) {
    if (!esNum(sim)) return '';
    return sim >= 0.9 ? 'Sí' : 'No';
  }

  /* Todo el test: { estD, estI, sim, pct, ok }. */
  function calcularTest(t) {
    t = t || {};
    const estD = fuerzaEstimada(t.load, t.repsD);
    const estI = fuerzaEstimada(t.load, t.repsI);
    const sim = simetria(estD, estI);
    return { estD, estI, sim, pct: simetriaPct(sim), ok: llega90(sim) };
  }

  return {
    REGLA_CARRERA, redondear1, enteroRango, entero010, enteroPositivo, decimalPositivo,
    molestiaManana, cumple, filaDia, calcularDias, tablaDias,
    resumenSemana, resumenes, avisoS4, avisoChasquido, entradaResultado,
    fuerzaEstimada, simetria, simetriaPct, llega90, calcularTest,
  };
})();
