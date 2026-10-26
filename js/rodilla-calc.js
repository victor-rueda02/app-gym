/* Cálculos del seguimiento de rodilla (molestia de la mañana, 24 h / 48 h, peor
   24-48 h, semáforo, resumen semanal, avisos, entrada a la carrera, test de fuerza y
   progresión real). Contrato: objeto global `RodillaCalc` con funciones puras (sin DOM,
   sin Store; la fecha de hoy se recibe como parámetro), así se prueban desde Node.
   Replica las fórmulas de la hoja «Seguimiento rodilla» del Excel; la progresión real
   (que el Excel no calcula) sigue las reglas A106, A107 y A110 de la hoja Volumen.
   Valor vacío = '' (como en el Excel). */

const RodillaCalc = (() => {
  const REGLA_CARRERA = 'Carrera (≤2/10)';
  const SIN_REGLA = '—';
  const CIERRE_S4 = '2026-11-15';
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

  /* Semáforo de una sesión (columna P del Excel) y, si es «Retroceder», qué falló:
     'durante' (dolor durante o, en carrera, no volver al nivel previo) o '24h' (la
     mañana siguiente peor que la referencia). Orden de la cascada:
       regla «—» (día sin carga de rodilla) -> '—'; sin «Durante» -> ''; sin mañana ->
       'sin referencia' (ese día no se evalúa); carrera sin dato de 60 min -> 'falta K';
       Retroceder por la sesión; sin 24 h -> 'pendiente'; Retroceder por las 24 h; sin
       48 h -> 'pendiente'; Avanzar si el peor 24-48 h ≤ referencia; si no, Mantener. */
  function evaluarSesion({ rule, morning, during, back60, h24, h48 }) {
    if (rule === SIN_REGLA) return { semaforo: '—', fallo: null };
    if (!esNum(during)) return { semaforo: '', fallo: null };
    if (!esNum(morning)) return { semaforo: 'sin referencia', fallo: null };
    const carrera = rule === REGLA_CARRERA;
    if (carrera && vacio(back60)) return { semaforo: 'falta K', fallo: null };
    if (during > (carrera ? 2 : 3) || (carrera && back60 === 'No')) return { semaforo: 'Retroceder', fallo: 'durante' };
    if (!esNum(h24)) return { semaforo: 'pendiente', fallo: null };
    if (h24 > morning) return { semaforo: 'Retroceder', fallo: '24h' };
    if (!esNum(h48)) return { semaforo: 'pendiente', fallo: null };
    return { semaforo: Math.max(h24, h48) <= morning ? 'Avanzar' : 'Mantener', fallo: null };
  }

  const semaforo = (args) => evaluarSesion(args).semaforo;

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

  /* Recibe las filas en orden y devuelve copias con morning, h24, h48, worst, semaforo
     y fallo. 24 h / 48 h = molestia de la mañana de la fila siguiente / la de dos
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
        ...evaluarSesion({ rule: f.rule, morning, during: f.during, back60: f.back60, h24, h48 }),
      };
    });
  }

  /* Combina el calendario con el registro (Store.knee().days) y calcula. */
  function tablaDias(dias, registro) {
    return calcularDias(dias.map((d) => filaDia(d, (registro || {})[d.fecha])));
  }

  /* Resumen de una semana a partir de las filas ya calculadas. Solo «Retroceder»
     cuenta como sesión que no cumple. */
  function resumenSemana(filasCalculadas, sem) {
    const f = filasCalculadas.filter((x) => x.sem === sem);
    const m = f.map((x) => x.morning).filter(esNum);
    return {
      sem,
      media: m.length ? redondear1(m.reduce((a, b) => a + b, 0) / m.length) : '',
      peor: m.length ? Math.max(...m) : '',
      mananas: m.length,
      retroceder: f.filter((x) => x.semaforo === 'Retroceder').length,
      chasquidos: f.filter((x) => x.click === 'Sí').length,
    };
  }

  function resumenes(filasCalculadas, semanas) {
    return semanas.map((s) => resumenSemana(filasCalculadas, s));
  }

  /* Aviso S4 (E82): se calcula al cerrar S4 (domingo 15/11) con al menos 5 mañanas en
     S2 y en S4; compara las medias (ya redondeadas) con un umbral de 0,5. */
  function avisoS4(s2, s4, hoy) {
    if (hoy < CIERRE_S4) return { nivel: 'pendiente', texto: 'Pendiente: se calcula al cerrar S4 (domingo 15/11)' };
    if (!s2 || !s4 || s2.mananas < 5 || s4.mananas < 5) {
      return { nivel: 'pendiente', texto: 'Pendiente: hacen falta al menos 5 mañanas registradas en S2 y en S4' };
    }
    if (redondear1(s4.media - s2.media) >= 0.5) {
      return { nivel: 'peor', texto: 'PEOR que en S2 (+0,5 o más): para la progresión y la valoración del fisio pasa a ser prioritaria' };
    }
    if (redondear1(s2.media - s4.media) >= 0.5) return { nivel: 'mejor', texto: 'MEJOR que en S2 (−0,5 o más): sigue el plan' };
    return { nivel: 'igual', texto: 'IGUAL que en S2 (menos de 0,5 de diferencia): la valoración del fisio pasa a ser prioritaria' };
  }

  /* S2 = semana de referencia (E81): si alguna mañana de S2 sale peor que la primera
     medición de S2, en S3 no sube nada. */
  function avisoS2(filasCalculadas) {
    const m = filasCalculadas.filter((x) => x.sem === 'S2').map((x) => x.morning).filter(esNum);
    if (!m.length) return { nivel: 'pendiente', texto: 'Pendiente: falta la primera medición de S2' };
    if (Math.max(...m) > m[0]) {
      return { nivel: 'repite', texto: 'REPITE S2: alguna mañana salió peor que la referencia; en S3 no sube nada' };
    }
    return { nivel: 'estable', texto: 'S2 estable por ahora: en S3 se sigue el plan' };
  }

  /* Aviso de chasquido doloroso: alguna fila con click === 'Sí'. */
  function avisoChasquido(filas) {
    const n = filas.filter((f) => f.click === 'Sí').length;
    return n > 0
      ? { activo: true, n, texto: 'Registrado: la valoración del fisio pasa a ser prioritaria' }
      : { activo: false, n: 0, texto: 'Sin chasquido doloroso por ahora' };
  }

  /* Resultado de la entrada a la carrera (H92) a partir de los tres criterios. */
  function entradaResultado(oks) {
    if (oks.filter((o) => o === 'Sí').length === 3) return { estado: 'si', texto: 'SÍ: 1.ª carrera hoy (N1)' };
    if (oks.some((o) => o === 'No')) {
      return { estado: 'no', texto: 'NO: esta semana no hay carrera (el domingo, como mucho, un paseo); repite los criterios el miércoles siguiente' };
    }
    return { estado: 'pendiente', texto: 'Pendiente' };
  }

  /* Entrada a la carrera de una semana. `reg` = Store.knee().entry[sem]. El criterio 1
     (paseo del martes) es Sí si las dos casillas son Sí y la mañana del miércoles no es
     peor que la del martes (solo 24 h); los criterios 2 y 3 son sus casillas. */
  function entradaSemana(filasCalculadas, sem, reg) {
    reg = reg || {};
    const dia = (d) => filasCalculadas.find((x) => x.sem === sem && x.dia === d) || {};
    const mar = dia('M').morning;
    const mie = dia('X').morning;
    const manana = esNum(mar) && esNum(mie) ? (mie <= mar ? 'Sí' : 'No') : '';
    const partes = [reg.walkPain || '', reg.walkBack60 || '', manana];
    const c1 = partes.includes('No') ? 'No' : partes.every((p) => p === 'Sí') ? 'Sí' : '';
    const c2 = reg.tdPain || '';
    const c3 = reg.hopsPain || '';
    return { sem, manana, c1, c2, c3, ...entradaResultado([c1, c2, c3]) };
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

  /* Progresión real ---------------------------------------------------------
     Dos escaleras (PLAN.PRENSA_NIVELES y PLAN.CARRERA_NIVELES) y la bici. Cada lunes
     (prensa) y cada miércoles (carrera) de S2-S8 se decide el nivel de la semana:
       - Retroceder: si desde la decisión anterior un fallo se atribuyó a esa escalera
         (o hubo brote) -> nivel −1.
       - Avanzar: si sus sesiones de la semana anterior (lunes y jueves para la prensa,
         miércoles y domingo para la carrera) salieron todas «Avanzar» -> nivel +1, sin
         pasar del máximo del calendario. Si falta un dato, Mantener.
       - Si no, Mantener.
     La novedad solo se aplica si esa mañana estás igual o mejor que la referencia: la
     mañana del mismo día de la semana anterior (en S3, la primera medición de S2). Así
     un empeoramiento lento, poco a poco cada día, también salta.
     Atribución de un fallo (A110): un dolor durante el lunes o el jueves es de la
     prensa, y durante el miércoles o el domingo, de la carrera. Una mañana peor se
     atribuye a la última novedad aún no validada: la que todavía no tiene en verde sus
     dos mañanas (24 y 48 h), ni las de una sesión posterior de su escalera. Sin novedad
     sin validar, o con dos sesiones seguidas en «Retroceder», hay brote: se quita la bici,
     48-72 h solo isométricos y −1 en todo.
     Bici: entra el viernes de S4 si S2 y S3 no tuvieron sesiones en Retroceder; se quita
     si se le atribuye un fallo o hay brote, y vuelve al nivel del calendario el lunes
     siguiente a una semana entera en verde.
     Topes: S2 «repite» -> en S3 no sube nada; aviso S4 PEOR -> desde S5 no sube nada.
     `reales` = Store.knee().weeks: un pressLevel/runLevel apuntado manda sobre la propuesta. */
  const ddmm = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

  function sumarDias(iso, n) {
    const [y, m, d] = iso.split('-').map(Number);
    const t = new Date(Date.UTC(y, m - 1, d + n));
    return t.toISOString().slice(0, 10);
  }

  // Días de las sesiones de cada escalera (para validar una novedad).
  const DIAS_ESCALERA = { prensa: ['L', 'J'], carrera: ['X', 'D'], bici: ['M', 'V'] };

  /* ¿Está la bici quitada ese día? `bici` = progresion(...).bici. */
  const biciQuitada = (bici, fecha) => (bici && bici.quitas.find((q) => fecha >= q.desde && (!q.hasta || fecha <= q.hasta))) || null;

  function progresion(filasCalculadas, plan, reales, entradas, hoy) {
    reales = reales || {};
    entradas = entradas || {};
    const semanas = [2, 3, 4, 5, 6, 7, 8];
    const resumen = resumenes(filasCalculadas, ['S2', 'S4']);
    const s2 = avisoS2(filasCalculadas);
    const s4 = avisoS4(resumen[0], resumen[1], hoy);
    const fila = (sem, dia) => filasCalculadas.find((x) => x.sem === sem && x.dia === dia);
    const manana = (fecha) => { const x = filasCalculadas.find((f) => f.fecha === fecha); return x ? x.morning : ''; };
    const baseS2 = filasCalculadas.filter((x) => x.sem === 'S2').map((x) => x.morning).find(esNum);
    const tope = (max, v) => Math.max(0, Math.min(max, v));

    // Fallos (Retroceder) en orden: la hora decide qué novedades van antes.
    // Mañana = T06, decisión (antes de la sesión) = T09, sesión = T18.
    const evaluadas = filasCalculadas.filter((x) => ['Retroceder', 'Mantener', 'Avanzar'].includes(x.semaforo));
    const fallos = [];
    evaluadas.forEach((x, i) => {
      if (x.semaforo !== 'Retroceder') return;
      const t = x.fallo === 'durante' ? `${x.fecha}T18` : `${sumarDias(x.fecha, 1)}T06`;
      const seguidas = i > 0 && evaluadas[i - 1].semaforo === 'Retroceder';
      const escalera = x.fallo === 'durante'
        ? ({ L: 'prensa', J: 'prensa', X: 'carrera', D: 'carrera' }[x.dia] || null) : null;
      fallos.push({ t, fila: x, seguidas, escalera });
    });

    const novedades = [];             // { t, fecha, escalera, retrocedida }
    const pendiente = { prensa: null, carrera: null };   // motivo de retroceso pendiente
    const brotes = [];
    const bici = { activa: false, quitas: [] };          // quitas: { desde, hasta, motivo }
    let iFallo = 0;

    function quitarBici(desde, motivo) {
      if (!bici.activa) return;
      bici.activa = false;
      bici.quitas.push({ desde, hasta: null, motivo });
    }

    /* Validada antes del instante t: su día, o una sesión posterior de su escalera, con
       las dos mañanas siguientes (24 y 48 h) igual o mejor que la de ese día. */
    function validadaAntesDe(nov, t) {
      return filasCalculadas.some((x) => x.fecha >= nov.fecha && DIAS_ESCALERA[nov.escalera].includes(x.dia)
        && `${sumarDias(x.fecha, 2)}T06` < t
        && esNum(x.morning) && esNum(x.h24) && esNum(x.h48) && x.h24 <= x.morning && x.h48 <= x.morning);
    }

    // Procesa los fallos ocurridos antes del instante t.
    function procesarFallos(t) {
      for (; iFallo < fallos.length && fallos[iFallo].t < t; iFallo++) {
        const f = fallos[iFallo];
        const cuando = `${f.fila.dia} ${ddmm(f.fila.fecha)}`;
        const desde = f.t.endsWith('T06') ? f.t.slice(0, 10) : sumarDias(f.fila.fecha, 1);
        const brote = (motivo) => {
          brotes.push({ fecha: f.fila.fecha, motivo });
          pendiente.prensa = pendiente.carrera = `brote (${cuando}: ${motivo})`;
          quitarBici(desde, `brote (${cuando})`);
        };
        if (f.seguidas) { brote('dos sesiones seguidas en Retroceder'); continue; }
        // S2 es la semana de referencia: sus fallos no se atribuyen (manda el aviso de S2).
        if (f.fila.sem === 'S2') continue;
        if (f.escalera) {
          pendiente[f.escalera] = `dolor durante la sesión del ${cuando}`;
          continue;
        }
        const nov = novedades.filter((n) => !n.retrocedida && n.t < f.t && !validadaAntesDe(n, f.t)).pop();
        if (!nov) { brote('fallo sin ninguna novedad sin validar'); continue; }
        nov.retrocedida = true;
        if (nov.escalera === 'bici') quitarBici(desde, `fallo atribuido a la bici (${cuando})`);
        else pendiente[nov.escalera] = `mañana peor tras la sesión del ${cuando}`;
      }
    }

    // Avanzar solo si todas las sesiones decisivas de la semana anterior dieron Avanzar.
    function sesionesAvanzan(sem, dias) {
      const xs = dias.map((d) => fila(sem, d)).filter(Boolean);
      const malas = xs.filter((x) => x.semaforo !== 'Avanzar');
      if (!malas.length) return { ok: true };
      const x = malas[0];
      const estado = x.semaforo || 'sin datos';
      return { ok: false, motivo: `${x.dia} ${ddmm(x.fecha)}: ${estado}` };
    }

    // Semana entera en verde: todas las sesiones hechas con carga de rodilla, en Avanzar.
    function semanaEnVerde(sem) {
      const xs = filasCalculadas.filter((x) => x.sem === sem && x.semaforo !== '—' && esNum(x.during));
      return xs.length > 0 && xs.every((x) => x.semaforo === 'Avanzar');
    }

    // La novedad, solo si esa mañana está igual o mejor que la referencia.
    function condicionNovedad(fecha) {
      const previa = manana(sumarDias(fecha, -7));
      const ref = esNum(previa) ? previa : baseS2;
      const hoyM = manana(fecha);
      if (!esNum(ref)) return { ok: true, nota: '' };
      if (!esNum(hoyM)) return { ok: true, nota: ` (solo si esa mañana estás en ${ref}/10 o menos)` };
      return hoyM <= ref ? { ok: true, nota: '' } : { ok: false, nota: `esa mañana (${hoyM}) peor que la referencia (${ref})` };
    }

    // Decide el nivel de una escalera en una semana.
    function decidir(escalera, n, previo, diasDecisivos, fecha, max) {
      const sem = `S${n}`;
      const t = `${fecha}T09`;
      procesarFallos(t);
      let delta;
      let motivo;
      if (pendiente[escalera]) {
        delta = -1;
        motivo = `Retroceder: ${pendiente[escalera]}`;
        pendiente[escalera] = null;
      } else if (n === 3) {
        // De S2 a S3 decide el aviso de S2 (A107), no el semáforo de cada sesión.
        delta = s2.nivel === 'estable' ? 1 : 0;
        motivo = s2.nivel === 'estable' ? 'Avanzar: S2 estable (ninguna mañana peor que la referencia)'
          : s2.nivel === 'repite' ? 'Mantener: S2 repite (alguna mañana peor que la referencia)'
            : 'Mantener: faltan las mediciones de S2';
      } else {
        const r = sesionesAvanzan(`S${n - 1}`, diasDecisivos);
        delta = r.ok ? 1 : 0;
        motivo = r.ok ? 'Avanzar: la semana anterior salió en verde' : `Mantener (${r.motivo})`;
      }
      if (delta > 0 && n >= 5 && s4.nivel === 'peor') { delta = 0; motivo = 'Mantener: aviso S4 PEOR, progresión parada'; }
      if (delta > 0) {
        const cond = condicionNovedad(fecha);
        if (!cond.ok) { delta = 0; motivo = `Mantener: ${cond.nota}`; } else motivo += cond.nota;
      }
      let propuesta = tope(max, previo + delta);
      if (escalera === 'carrera') propuesta = Math.max(1, propuesta);   // ya dentro: N1 es el mínimo
      if (delta > 0 && propuesta === previo) motivo = 'Mantener: ya está en el máximo del calendario';
      const real = reales[sem] && esNum(reales[sem][escalera === 'prensa' ? 'pressLevel' : 'runLevel'])
        ? reales[sem][escalera === 'prensa' ? 'pressLevel' : 'runLevel'] : null;
      const nivel = real !== null ? real : propuesta;
      if (nivel > previo) novedades.push({ t, fecha, escalera, retrocedida: false });
      return { plan: max, propuesta, real, nivel, previo, motivo, provisional: fecha > hoy };
    }

    const out = {};
    let prensa = 0;     // S1: x12, escalón 0
    let carrera = 0;    // sin entrar
    for (const n of semanas) {
      const sem = `S${n}`;
      const lunes = fila(sem, 'L');
      const miercoles = fila(sem, 'X');
      const viernes = fila(sem, 'V');
      if (!lunes || lunes.fecha > sumarDias(hoy, 7)) break;   // más allá de la semana que viene: solo el plan

      // Bici quitada: vuelve el lunes siguiente a una semana entera en verde.
      procesarFallos(`${lunes.fecha}T09`);
      const quita = bici.quitas[bici.quitas.length - 1];
      if (n >= 5 && !bici.activa && quita && !quita.hasta && quita.desde <= sumarDias(lunes.fecha, -7)
        && semanaEnVerde(`S${n - 1}`)) {
        quita.hasta = sumarDias(lunes.fecha, -1);
        bici.activa = true;
      }

      // Prensa (lunes). En S2 la novedad x10 es la del plan: S1 no tiene seguimiento.
      let p;
      if (n === 2) {
        const real = reales[sem] && esNum(reales[sem].pressLevel) ? reales[sem].pressLevel : null;
        const nivel = real !== null ? real : 1;
        p = { plan: plan.PRENSA_MAX[n], propuesta: 1, real, nivel, previo: 0,
          motivo: 'Plan de S2 (semana de referencia)', provisional: lunes.fecha > hoy };
        if (nivel > 0) novedades.push({ t: `${lunes.fecha}T09`, fecha: lunes.fecha, escalera: 'prensa', retrocedida: false });
      } else {
        p = decidir('prensa', n, prensa, ['L', 'J'], lunes.fecha, plan.PRENSA_MAX[n]);
      }
      prensa = p.nivel;

      // Carrera (miércoles): sin entrar, decide la entrada de esa semana.
      let c;
      if (carrera === 0) {
        procesarFallos(`${miercoles.fecha}T09`);
        const e = entradaSemana(filasCalculadas, sem, entradas[sem]);
        const real = reales[sem] && esNum(reales[sem].runLevel) ? reales[sem].runLevel : null;
        const propuesta = e.estado === 'si' ? 1 : 0;
        const nivel = real !== null ? real : propuesta;
        c = { plan: plan.CARRERA_MAX[n], propuesta, real, nivel, previo: 0, entrada: e,
          motivo: e.estado === 'si' ? 'Entrada superada: 1.ª carrera (N1)'
            : e.estado === 'no' ? 'Entrada no superada: esta semana no se corre' : 'Entrada a la carrera pendiente',
          provisional: miercoles.fecha > hoy };
        if (nivel > 0) novedades.push({ t: `${miercoles.fecha}T09`, fecha: miercoles.fecha, escalera: 'carrera', retrocedida: false });
      } else {
        c = decidir('carrera', n, carrera, ['X', 'D'], miercoles.fecha, plan.CARRERA_MAX[n]);
      }
      carrera = c.nivel;

      // Bici: entra el viernes de S4 si S2 y S3 no tuvieron sesiones en Retroceder.
      if (n === 4) {
        procesarFallos(`${viernes.fecha}T09`);
        const fallidas = evaluadas.filter((x) => (x.sem === 'S2' || x.sem === 'S3') && x.semaforo === 'Retroceder');
        bici.activa = true;
        if (fallidas.length) {
          quitarBici(viernes.fecha, `S2 o S3 tuvieron sesiones en Retroceder (${fallidas.map((x) => `${x.dia} ${ddmm(x.fecha)}`).join(', ')})`);
        } else {
          novedades.push({ t: `${viernes.fecha}T09`, fecha: viernes.fecha, escalera: 'bici', retrocedida: false });
        }
      }

      // Domingo: repite el nivel del miércoles; si el miércoles salió Retroceder, uno menos (mínimo N1).
      let domingo = c.nivel;
      let motivoDomingo = c.nivel ? 'Repite el nivel del miércoles' : 'No se corre (como mucho, un paseo)';
      if (c.nivel > 0 && miercoles.semaforo === 'Retroceder') {
        domingo = Math.max(1, c.nivel - 1);
        motivoDomingo = 'El miércoles salió Retroceder: un nivel menos';
      }
      out[sem] = { lunes: lunes.fecha, prensa: p, carrera: c, domingo: { nivel: domingo, motivo: motivoDomingo } };
    }
    // Fallos hasta hoy que aún no han llegado a ninguna decisión (para los avisos de brote y bici).
    procesarFallos(`${sumarDias(hoy, 1)}T00`);
    return { semanas: out, brotes, bici: { quitas: bici.quitas }, s2, s4 };
  }

  /* Prescripción del día para un ejercicio con progresión (`prog` en js/plan.js), a
     partir de la semana calculada por `progresion`. Devuelve { sets, reps, kind, label,
     mins } o null si no hay datos de esa semana. */
  function prescripcion(prog, semana, plan) {
    if (!semana) return null;
    const P = plan.PRENSA_NIVELES;
    const N = plan.CARRERA_NIVELES;
    const { prensa, carrera, domingo } = semana;
    const nov = (x) => (x.nivel > x.previo ? 'nov' : x.nivel < x.previo ? 'retrocede' : 'mantiene');
    const fijo = (sets, reps, label) => ({ sets, kind: 'fixed', reps, label });
    const lvl = P[prensa.nivel];
    switch (prog) {
      case 'prensa': {
        const ant = P[prensa.previo];
        const cambio = nov(prensa) === 'nov'
          ? (lvl.reps !== ant.reps ? `nov: x${lvl.reps}` : 'nov: +1 escalón')
          : nov(prensa) === 'retrocede' ? 'retrocede un nivel' : 'mantiene';
        return fijo(2, lvl.reps, `2 x${lvl.reps}/pierna\nescalón ${lvl.esc} · ${cambio}`);
      }
      case 'touchdown':   // a la profundidad ya validada: la de la semana anterior
        return fijo(2, '10-15', `2 x10-15/pierna\nescalón ${P[prensa.previo].esc}`);
      case 'sentadilla':
        return fijo(3, lvl.reps, `3 x${lvl.reps}\nescalón ${lvl.esc} (prof. del lunes)`);
      case 'bulgara':
        return fijo(2, lvl.reps, `2 x${lvl.reps}/pierna\nescalón ${lvl.esc} (prof. del lunes)`);
      case 'carrera': {
        if (!carrera.nivel) {
          const e = carrera.entrada || {};
          const label = e.estado === 'no' ? 'No se corre esta semana\n(criterios de entrada no cumplidos)'
            : 'Criterios de entrada\n(10 TD + 20 saltitos ≤2/10)';
          return { sets: 1, kind: 'cardio', mins: '', label };
        }
        const cambio = carrera.previo === 0 ? '1.ª carrera' : nov(carrera) === 'nov' ? 'nivel nuevo'
          : nov(carrera) === 'retrocede' ? 'retrocede un nivel' : 'mantiene';
        return { sets: 1, kind: 'cardio', mins: '', label: `N${carrera.nivel} · ${N[carrera.nivel]}\n${cambio}` };
      }
      case 'carrera-domingo':
        if (!domingo.nivel) return { sets: 1, kind: 'cardio', mins: '', label: 'No se corre\n(como mucho, un paseo)' };
        return { sets: 1, kind: 'cardio', mins: '', label: `N${domingo.nivel} · ${N[domingo.nivel]}\n${domingo.nivel === carrera.nivel ? 'repite el miércoles' : 'un nivel menos que el miércoles'}` };
      default:
        return null;
    }
  }

  return {
    REGLA_CARRERA, SIN_REGLA, redondear1, enteroRango, entero010, enteroPositivo, decimalPositivo,
    molestiaManana, evaluarSesion, semaforo, filaDia, calcularDias, tablaDias,
    resumenSemana, resumenes, avisoS4, avisoS2, avisoChasquido, entradaResultado, entradaSemana,
    fuerzaEstimada, simetria, simetriaPct, llega90, calcularTest,
    sumarDias, progresion, prescripcion, biciQuitada,
  };
})();
