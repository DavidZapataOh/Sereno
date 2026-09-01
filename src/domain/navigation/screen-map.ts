export interface Screen {
  id: string;
  titulo: string;
  /** Ruta de expo-router. */
  ruta: string;
  /** Identificador de la pantalla desde la que se llega. `null` si es pestaña. */
  padre: string | null;
  /** La pregunta que esta pantalla responde. Si no responde ninguna, sobra. */
  pregunta: string;
  /** Sprint en el que aparece. */
  fase: number;
}

export const TAB_IDS = ['hoy', 'movimientos', 'deudas', 'metas'] as const;

/**
 * Mapa de la aplicación completa.
 *
 * Cuatro pestañas, cada una respondiendo una de las preguntas que el usuario
 * declaró. Los ajustes no ocupan pestaña: se visitan una vez al mes, y gastar
 * un cuarto de la barra de navegación en ellos es desperdiciar el espacio más
 * valioso de la interfaz.
 *
 * Es dato y no diagrama para poder verificarlo: `depthOf` mide los toques
 * desde el arranque, y una prueba falla si alguna pantalla pasa de tres.
 */
export const SCREEN_MAP: readonly Screen[] = [
  // --- Pestañas ---
  {
    id: 'hoy',
    titulo: 'Hoy',
    ruta: '/(tabs)',
    padre: null,
    pregunta: '¿Cuánto tengo en total y qué se paga pronto?',
    fase: 4,
  },
  {
    id: 'movimientos',
    titulo: 'Movimientos',
    ruta: '/(tabs)/movimientos',
    padre: null,
    pregunta: '¿En qué se me está yendo el dinero?',
    fase: 4,
  },
  {
    id: 'deudas',
    titulo: 'Deudas',
    ruta: '/(tabs)/deudas',
    padre: null,
    pregunta: '¿Cuánto debo y cuándo salgo?',
    fase: 9,
  },
  {
    id: 'metas',
    titulo: 'Metas',
    ruta: '/(tabs)/metas',
    padre: null,
    pregunta: '¿Cuánto debo ganar y ahorrar para llegar?',
    fase: 10,
  },

  // --- Segundo nivel ---
  {
    id: 'cuentas',
    titulo: 'Cuentas',
    ruta: '/cuentas',
    padre: 'hoy',
    pregunta: '¿Cómo se reparte lo que tengo entre mis cuentas?',
    fase: 4,
  },
  {
    id: 'detalle-movimiento',
    titulo: 'Movimiento',
    ruta: '/movimientos/[id]',
    padre: 'movimientos',
    pregunta: '¿Qué fue exactamente este cargo?',
    fase: 4,
  },
  {
    id: 'categorias',
    titulo: 'Categorías',
    ruta: '/categorias',
    padre: 'movimientos',
    pregunta: '¿Cómo se reparte mi gasto por categoría?',
    fase: 5,
  },
  {
    id: 'suscripciones',
    titulo: 'Suscripciones',
    ruta: '/suscripciones',
    padre: 'hoy',
    pregunta: '¿Qué se me cobra todos los meses sin que lo note?',
    fase: 7,
  },
  {
    id: 'tarjeta',
    titulo: 'Tarjeta',
    ruta: '/deudas/tarjeta/[id]',
    padre: 'deudas',
    pregunta: '¿Cuánto llevo gastado, cuándo corta y qué cuotas tengo pendientes?',
    fase: 7,
  },
  {
    id: 'calendario',
    titulo: 'Calendario',
    ruta: '/deudas/calendario',
    padre: 'deudas',
    pregunta: '¿Qué tengo que pagar este mes y cuándo?',
    fase: 9,
  },
  {
    id: 'estrategia-deuda',
    titulo: 'Salir de deudas',
    ruta: '/deudas/estrategia',
    padre: 'deudas',
    pregunta: '¿Cuál es el camino más corto para salir y cuándo termino?',
    fase: 9,
  },
  {
    id: 'proyeccion',
    titulo: 'Proyección',
    ruta: '/metas/proyeccion',
    padre: 'metas',
    pregunta: '¿Me va a alcanzar en los próximos meses?',
    fase: 10,
  },
  {
    id: 'fondos',
    titulo: 'Fondos',
    ruta: '/metas/fondos',
    padre: 'metas',
    pregunta: '¿Cuánto llevo apartado para lo que llega una vez al año?',
    fase: 10,
  },
  {
    id: 'patrimonio',
    titulo: 'Patrimonio',
    ruta: '/patrimonio',
    padre: 'hoy',
    pregunta: '¿Estoy mejorando con el tiempo?',
    fase: 8,
  },
  {
    id: 'ajustes',
    titulo: 'Ajustes',
    ruta: '/ajustes',
    padre: 'hoy',
    pregunta: '¿Qué fuentes tengo conectadas y cómo configuro la app?',
    fase: 1,
  },

  // --- Tercer nivel ---
  // Las conexiones viven dentro del propio hub de ajustes, no en una pantalla
  // aparte: con dos portales, una pantalla intermedia es un toque que no
  // aporta nada, y dejaría la sesión del portal a cuatro toques.
  {
    id: 'portal',
    titulo: 'Portal',
    ruta: '/ajustes/portal/[id]',
    padre: 'ajustes',
    pregunta: '¿Cómo inicio sesión en el banco para que Sereno lea mis movimientos?',
    fase: 1,
  },
  {
    id: 'capturas',
    titulo: 'Capturas',
    ruta: '/ajustes/capturas',
    padre: 'ajustes',
    pregunta: '¿Qué leyó Sereno del banco en la última sesión?',
    fase: 1,
  },
  {
    id: 'diagnostico',
    titulo: 'Diagnóstico',
    ruta: '/ajustes/diagnostico',
    padre: 'ajustes',
    pregunta: '¿La contabilidad cuadra y la app se ve como debe en este teléfono?',
    fase: 3,
  },
  {
    id: 'reglas',
    titulo: 'Reglas',
    ruta: '/ajustes/reglas',
    padre: 'ajustes',
    pregunta: '¿Cómo se clasifican automáticamente mis movimientos?',
    fase: 5,
  },
  {
    id: 'tarjetas',
    titulo: 'Tarjetas',
    ruta: '/ajustes/tarjetas',
    padre: 'ajustes',
    pregunta: '¿Cuánto cupo tiene cada tarjeta y cuándo corta y se paga?',
    fase: 7,
  },
  {
    id: 'recordatorios',
    titulo: 'Recordatorios',
    ruta: '/ajustes/recordatorios',
    padre: 'ajustes',
    pregunta: '¿Con cuánta antelación quiero que me avisen, y de qué?',
    fase: 9,
  },
  {
    id: 'wallets',
    titulo: 'Wallets',
    ruta: '/ajustes/wallets',
    padre: 'ajustes',
    pregunta: '¿Qué direcciones mira Sereno en la cadena, y cuándo las leyó?',
    fase: 8,
  },
  {
    id: 'revisar',
    titulo: 'Revisar',
    ruta: '/categorias/revisar',
    padre: 'categorias',
    pregunta: '¿Qué movimientos necesitan que yo diga en qué se fueron?',
    fase: 5,
  },
  {
    id: 'detalle-cuenta',
    titulo: 'Cuenta',
    ruta: '/cuentas/[id]',
    padre: 'cuentas',
    pregunta: '¿Qué ha pasado en esta cuenta?',
    fase: 4,
  },
];

const MAX_PROFUNDIDAD = 10;

/** Toques desde el arranque hasta la pantalla. Una pestaña es 1. */
export function depthOf(id: string): number {
  const inicial = SCREEN_MAP.find((s) => s.id === id);
  if (inicial === undefined) throw new Error(`Pantalla desconocida: ${id}`);

  let actual: Screen = inicial;
  let profundidad = 1;
  while (actual.padre !== null) {
    if (profundidad > MAX_PROFUNDIDAD) throw new Error(`Ciclo en la jerarquía de: ${id}`);
    const idPadre: string = actual.padre;
    const padre: Screen | undefined = SCREEN_MAP.find((s) => s.id === idPadre);
    if (padre === undefined) throw new Error(`Padre desconocido de: ${actual.id}`);
    actual = padre;
    profundidad += 1;
  }
  return profundidad;
}
