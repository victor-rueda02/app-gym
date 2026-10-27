/* Datos fijos del seguimiento de rodilla, leídos al arrancar de la hoja «Seguimiento
   rodilla» del Excel empotrado (PLAN.LIBRO). Contrato: objeto global `RODILLA_DATA`, solo
   datos, sin lógica de cálculo. Los textos son los literales del Excel; cada elemento
   lleva su `fila` para que la exportación escriba en su sitio aunque la hoja cambie.
   La columna «App» (R, oculta) marca las filas: dias, semanas, aviso=…, texto=…,
   titulo=…, entrada=walk|touchdown|hops (+ dia=…), entrada-resultado, test=t1…,
   escalon=0… (ver tools/excel_app.py). La ayuda de la pestaña está escrita para la app. */

const RODILLA_DATA = (() => {
  const hoja = PLAN.LIBRO['Seguimiento rodilla'];
  const v = (ref) => (hoja[ref] === undefined ? '' : hoja[ref]);
  const t = (ref) => String(v(ref));
  const max = Math.max(...Object.keys(hoja).map((ref) => +ref.replace(/^[A-Z]+/, '')));
  const filas = [];
  for (let r = 1; r <= max; r++) filas.push({ r, app: PLAN.etiquetasApp(v(`R${r}`)) });
  const con = (clave, valor) => filas.filter((f) => clave in f.app && (valor === undefined || f.app[clave] === valor));
  const una = (clave, valor) => {
    const fs = con(clave, valor);
    if (fs.length !== 1) throw new Error(`Seguimiento rodilla: se esperaba una fila «${clave}${valor ? `=${valor}` : ''}» y hay ${fs.length}`);
    return fs[0].r;
  };
  // Filas de datos bajo una cabecera, mientras la columna A cumpla `vale`.
  const bajo = (cab, vale = (a) => a !== '') => {
    const out = [];
    for (let r = cab + 1; vale(v(`A${r}`)); r++) out.push(r);
    return out;
  };

  const dias = bajo(una('dias')).map((r) => ({
    fecha: LectorXlsx.fecha(v(`A${r}`)), dia: t(`B${r}`), sem: t(`C${r}`),
    sesion: t(`D${r}`), regla: t(`E${r}`), novedad: t(`F${r}`), fila: r,
  }));
  const semanas = bajo(una('semanas'), (a) => /^S\d+$/.test(String(a))).map((r) => ({ sem: t(`A${r}`), fila: r }));

  return {
    desde: dias[0].fecha,
    hasta: dias[dias.length - 1].fecha,
    reglas: { gimnasio: 'Gimnasio (≤3/10)', carrera: 'Carrera (≤2/10)', ninguna: '—' },
    semanas: semanas.map((s) => s.sem),
    filasSemana: Object.fromEntries(semanas.map((s) => [s.sem, s.fila])),
    textos: {
      ayuda: 'Cada mañana, en casa y antes de nada, haz las dos pruebas: el test en declive y 10 subidas con la D al mismo escalón o banco, y apunta cada una de 0 a 10. La molestia de la mañana es la peor de las dos y es la referencia del día; si un día no mides, ese día no se evalúa y la siguiente medición hace de referencia.\nDespués de una sesión con carga de rodilla (lunes, jueves y días de carrera) apunta la molestia máxima durante; en carrera, si vuelves al nivel previo en 60 minutos o menos; y si el chasquido dolió.\nCon las mañanas siguientes sale el semáforo: Retroceder (más de 3/10 en gimnasio o 2/10 en carrera, no vuelves al nivel previo o la mañana siguiente estás peor), Mantener (cumples, pero a las 48 h estás peor que la referencia) o Avanzar. Con él, Progresión propone el nivel de la prensa y de la carrera de cada semana, sin pasar del calendario; si haces otra cosa, apunta allí el nivel real.',
      resumen: t(`A${una('texto', 'resumen')}`),
      fuerza: t(`A${una('texto', 'fuerza')}`),
      escalones: t(`A${una('texto', 'escalones')}`),
    },
    titulos: {
      entrada: t(`A${una('titulo', 'entrada')}`),
      fuerza: t(`A${una('titulo', 'fuerza')}`),
      escalones: t(`A${una('titulo', 'escalones')}`),
    },
    // Calendario: fecha ISO, día (L/M/X/J/V/S/D), semana, sesión, regla y novedad previstas.
    dias,
    // Criterios de entrada a la carrera: el 1 es el paseo del día anterior a la carrera.
    entrada: con('entrada').map(({ r, app }) => ({ clave: app.entrada, texto: t(`A${r}`), dia: app.dia || '', fila: r })),
    filaEntradaResultado: una('entrada-resultado'),
    filasAviso: { s2: una('aviso', 's2'), s4: una('aviso', 's4'), chasquido: una('aviso', 'chasquido') },
    // Tests de fuerza: clave en Store.knee().tests.
    tests: con('test').map(({ r, app }) => ({
      clave: app.test, nombre: t(`A${r}`), fecha: LectorXlsx.fecha(v(`D${r}`)), rango: t(`E${r}`), fila: r,
    })),
    // Escalones de profundidad: clave en Store.knee().depth.
    escalones: con('escalon').map(({ r, app }) => ({ clave: app.escalon, nombre: t(`A${r}`), fila: r })),
  };
})();
