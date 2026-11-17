/* Configuración de cada ejercicio (Plan › Ejercicios): qué se apunta en Hoy y qué se ve como
   referencia fija. Cada parámetro tiene un modo:
     - 'serie'    : una columna por serie (peso, reps, RIR, segundos, profundidad…);
     - 'fijo'     : referencia que se ve en Hoy, sin campo (p. ej. tempo 3-1-3);
     - 'recuerda' : un campo por día que sale con lo del último día (p. ej. la profundidad);
     - 'oculto'   : no se ve.
   La posición de la máquina es una lista de ajustes con nombre (asiento, pies…), siempre en modo
   «recuerda». `lado` = se apunta por pierna (D/I).

   Lo que ajusta el usuario se guarda en el registro (Store, `ejercicios: { id: config }`); si no ha
   tocado un ejercicio, vale `porDefecto`, que sale de la prescripción del plan y de lo que el usuario
   dijo el 17/11 (decisiones 109-112). */

const Ejercicios = (() => {
  const TEMPO_DEFECTO = 'Subida explosiva · bajada controlada · 0,5 s en las pausas';
  const MODOS = { serie: 'Cada serie', fijo: 'Fijo', recuerda: 'Recuerda el último', oculto: 'Oculto' };
  // Parámetros y los modos que admite cada uno, en el orden en que se ven.
  const PARAMS = [
    { k: 'kg', nombre: 'Peso', modos: ['serie', 'oculto'] },
    { k: 'reps', nombre: 'Reps', modos: ['serie', 'fijo', 'oculto'] },
    { k: 'rir', nombre: 'RIR', modos: ['serie', 'fijo', 'oculto'] },
    { k: 'seg', nombre: 'Segundos', modos: ['serie', 'fijo', 'oculto'] },
    { k: 'tempo', nombre: 'Tempo', modos: ['fijo', 'oculto'] },
    { k: 'prof', nombre: 'Profundidad', modos: ['serie', 'recuerda', 'fijo', 'oculto'] },
  ];

  const p = (modo, valor = '') => ({ modo, valor });
  const pos = (...pares) => pares.map(([nombre, valor]) => ({ nombre, valor: String(valor) }));

  /* Lo que dijo el usuario (17/11) para cada ejercicio, encima de lo que sale del plan. */
  const PROPIOS = {
    'prensa-unil-pesado-y-lento-n-1': { tempo: p('fijo', '3-1-3'), rir: p('fijo', 'D 2 · I 1-2'),
      posicion: pos(['Profundidad D', 6], ['Profundidad I', 5], ['Altura pies', 3]) },
    'sentadilla-al-cajon-o-desde-pines-pesado-y-lento-n-2': { tempo: p('fijo', '3-1-3'), rir: p('fijo', '2'),
      posicion: pos(['Pines', 6]) },
    'bulgarian-split-squat': { tempo: p('fijo', '3-1-3'), rir: p('fijo', 'D 2 · I 1-2'),
      posicion: pos(['Altura pie de apoyo (steps)', 3]) },
    // La profundidad es lo que progresa: steps y discos en cada serie, sin peso.
    'touchdown-squat': { kg: p('oculto'), tempo: p('fijo', '2-0-2'), rir: p('fijo', '3'),
      prof: { modo: 'serie', valor: '', columnas: ['Steps', 'Discos'] } },
    'abduccion-de-pie-unilateral-maquina': { rir: p('fijo', '1-2'), posicion: pos(['Altura', 4], ['Profundidad', 5]) },
    // Sentadilla iso pared unilateral (antes, sentadilla española): peso y 45 s de referencia, por pierna.
    'sentadilla-espanola': { kg: p('serie'), seg: p('fijo', '45 s'), lado: true },
    'isquios-sentado': { posicion: pos(['Asiento', 5], ['Rodilla', 1], ['Pies', 2]) },
    'bici-z2-65-75-fc': { posicion: pos(['Altura', 6], ['Resistencia', 7]) },
    'bici-z2-sin-z3-en-este-bloque': { posicion: pos(['Altura', 6], ['Resistencia', 7]) },
    'elevacion-lateral-en-prono-t-mancuernas-banco': { rir: p('fijo', '3-4'), tempo: p('fijo', '5 s arriba') },
    'rotacion-externa-con-banda-w': { rir: p('fijo', '3-4'), tempo: p('fijo', '5-10 s fuera') },
    'curl-de-muneca-en-extension-mancuerna': { rir: p('fijo', '3-4'), tempo: p('fijo', '3 s / 3 s') },
  };

  const kinds = (ex) => new Set((ex.pres || [ex.s1, ex.s2]).filter(Boolean).map((x) => x.kind));

  /* Lo de partida de un ejercicio: según su prescripción (con RIR, reps fijas, isométrico,
     cardio) y, encima, lo que dijo el usuario. */
  function porDefecto(ex) {
    const k = kinds(ex);
    const cardio = k.has('cardio') || ex.target === 'Cardio';
    const conRir = k.has('rir') || !k.size;   // los creados en la app no traen prescripción: con RIR
    const iso = k.has('iso') && !k.has('rir') && !k.has('fixed');
    const base = {
      kg: p(cardio ? 'oculto' : 'serie'),
      reps: p(cardio || iso ? 'oculto' : 'serie'),
      rir: p(conRir ? 'serie' : 'oculto'),
      seg: p(iso ? 'serie' : 'oculto'),
      // El tempo por defecto es el de la hipertrofia; la rehab y lo demás, sin tempo salvo que se diga.
      tempo: p(conRir ? 'fijo' : 'oculto', conRir ? TEMPO_DEFECTO : ''),
      prof: { modo: 'oculto', valor: '', columnas: [] },
      posicion: [],
      lado: !!ex.sides,
    };
    return normalizar({ ...base, ...(PROPIOS[ex.id] || {}) });
  }

  function normalizar(c) {
    const out = { ...c };
    for (const { k } of PARAMS) {
      const v = c[k] || {};
      out[k] = { modo: v.modo || 'oculto', valor: v.valor == null ? '' : String(v.valor) };
    }
    out.prof.columnas = Array.isArray((c.prof || {}).columnas) ? c.prof.columnas.filter(Boolean) : [];
    out.posicion = Array.isArray(c.posicion) ? c.posicion.filter((a) => a && a.nombre).map((a) => ({ nombre: String(a.nombre), valor: a.valor == null ? '' : String(a.valor) })) : [];
    out.lado = !!c.lado;
    return out;
  }

  const guardados = () => (typeof Store !== 'undefined' && Store.ejercicios ? Store.ejercicios() : {});

  /* La configuración que vale para un ejercicio (la guardada o la de partida). */
  function config(ex) {
    const g = guardados()[ex.id];
    return g ? normalizar({ ...porDefecto(ex), ...g }) : porDefecto(ex);
  }

  const editado = (id) => !!guardados()[id];

  /* Columnas de la fila de series en Hoy: [{ etiqueta, campo, extra? }] (extra = columna de
     profundidad, que se guarda en s.x[etiqueta]). El cardio son siempre los minutos. */
  function columnas(ex, pres) {
    if (pres.kind === 'cardio') return [{ etiqueta: 'Min', campo: 'mins' }];
    const c = config(ex);
    const cols = [];
    if (c.kg.modo === 'serie') cols.push({ etiqueta: 'Kg', campo: 'kg' });
    if (c.prof.modo === 'serie') {
      (c.prof.columnas.length ? c.prof.columnas : ['Prof.']).forEach((e) => cols.push({ etiqueta: e, campo: e, extra: true }));
    }
    if (c.reps.modo === 'serie') cols.push({ etiqueta: 'Reps', campo: 'reps' });
    if (c.seg.modo === 'serie') cols.push({ etiqueta: 'Seg', campo: 'secs' });
    if (c.rir.modo === 'serie') cols.push({ etiqueta: 'RIR', campo: 'rir' });
    return cols.length ? cols : [{ etiqueta: 'Reps', campo: 'reps' }];
  }

  /* Referencias fijas para la cabecera del ejercicio en Hoy: [[nombre, valor]]. */
  function fijos(ex) {
    const c = config(ex);
    return PARAMS.filter(({ k }) => c[k].modo === 'fijo' && c[k].valor).map(({ k, nombre }) => [nombre, c[k].valor]);
  }

  /* Campos de un día que «recuerdan» el último valor: la posición de la máquina y la
     profundidad en modo «recuerda». [{ nombre, porDefecto }] */
  function ajustes(ex) {
    const c = config(ex);
    const out = c.posicion.map((a) => ({ nombre: a.nombre, porDefecto: a.valor }));
    if (c.prof.modo === 'recuerda') out.push({ nombre: 'Profundidad', porDefecto: c.prof.valor });
    return out;
  }

  /* El valor de un ajuste en una fecha: el apuntado ese día o, si no, el último anterior; si
     nunca se apuntó, el de la configuración. { valor, de: 'hoy' | fecha | 'config' } */
  function valorAjuste(ex, nombre, fecha) {
    const dias = Store.all().days;
    const hoy = (((dias[fecha] || {}).ajustes || {})[ex.id] || {})[nombre];
    if (hoy !== undefined && hoy !== '') return { valor: hoy, de: 'hoy' };
    const previas = Object.keys(dias).filter((f) => f < fecha).sort().reverse();
    for (const f of previas) {
      const v = (((dias[f] || {}).ajustes || {})[ex.id] || {})[nombre];
      if (v !== undefined && v !== '') return { valor: v, de: f };
    }
    const a = ajustes(ex).find((x) => x.nombre === nombre);
    return { valor: a ? a.porDefecto : '', de: 'config' };
  }

  /* ¿Se apunta por pierna (D/I) esa semana? Lo dice la configuración; como en el plan, solo
     desde S2 del de volumen (S1 ya está hecha). */
  const porPierna = (ex, week) => config(ex).lado && week && week.plan === 'vol' && week.n >= 2;

  return { TEMPO_DEFECTO, MODOS, PARAMS, porDefecto, config, editado, normalizar, columnas, fijos, ajustes, valorAjuste, porPierna };
})();

// El plan pregunta aquí si un ejercicio va por pierna (sustituye a la marca «/pierna» del Excel).
if (typeof PLAN !== 'undefined' && PLAN.setLadoDe) PLAN.setLadoDe((ex, week) => Ejercicios.porPierna(ex, week));
