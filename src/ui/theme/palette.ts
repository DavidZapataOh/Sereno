/**
 * La paleta, organizada por el papel que cumple cada color y no por su tono.
 *
 * **60/30/10.** Sesenta por ciento neutro dominante —los fondos y las
 * superficies—, treinta por ciento secundario —los grises del texto, que son
 * los que construyen la jerarquía— y diez por ciento de acento, que aparece
 * **solo donde informa**: la acción principal, la pestaña activa, un estado.
 *
 * Un color que no informa de nada es ruido, y con suficiente ruido nada resalta.
 */
export interface Palette {
  // --- 60 %: superficies. Neutras, con un matiz del azul de noche de la
  // identidad para que no sean gris muerto, y en segundo plano siempre.
  /** El fondo de la app. **Más oscuro que la superficie**, para que una tarjeta exista. */
  background: string;
  surface: string;
  surfaceAlt: string;
  /** Superficies hundidas: la pista de una barra de progreso, un campo. */
  surfaceSunken: string;
  /** La superficie mientras se está pulsando: un poco más oscura. */
  surfacePressed: string;

  // Bordes
  border: string;
  borderStrong: string;

  // --- 30 %: texto. Grises con jerarquía; ni negro ni blanco puros salvo
  // `textStrong`, que se reserva para lo más importante de la pantalla.
  /** El máximo contraste posible. **Una cosa por pantalla**, no más. */
  textStrong: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;

  // --- La acción principal. **Máximo contraste, color neutro**: es lo que
  // hace Uber en claro y en oscuro, y lo que deja libre al ámbar para ser
  // acento de verdad en vez de «el color de los botones».
  actionFill: string;
  actionFillPressed: string;
  onActionFill: string;

  // --- 10 %: acento e identidad. El ámbar del farol del sereno, en sus dos
  // formas, porque un color de marca que no pasa contraste no se abandona: se
  // adapta.
  /** Ámbar oscuro, para **texto e iconos** sobre superficie clara. */
  accent: string;
  /** El acento como texto, mientras se pulsa. */
  accentPressed: string;
  /** Ámbar de farol, brillante, para **rellenos**: el botón principal. */
  accentFill: string;
  /** El relleno mientras se pulsa: más oscuro, para que se sienta hundido. */
  accentFillPressed: string;
  /** Ámbar diluido en el neutro: fondos de chip y resaltados suaves. */
  accentSoft: string;

  // --- Semántica financiera. Cada una con su versión suave, para no tener que
  // elegir entre gritar con el relleno fuerte o apilar otra superficie.
  ingreso: string;
  ingresoSoft: string;
  gasto: string;
  gastoSoft: string;
  deuda: string;
  deudaSoft: string;
  /** Acciones destructivas y errores del sistema. NO es un gasto. */
  peligro: string;
  peligroSoft: string;

  // --- Texto que se pinta ENCIMA de un relleno.
  onAccent: string;
  onAccentFill: string;
  onAccentSoft: string;
  onGasto: string;
  onGastoSoft: string;
  onIngresoSoft: string;
  onDeudaSoft: string;
  onPeligro: string;
  onPeligroSoft: string;
}

/** Claves que se pintan como texto. La auditoría las verifica contra cada superficie. */
export const TEXT_KEYS = [
  'textStrong',
  'textPrimary',
  'textSecondary',
  'textMuted',
  'accent',
  'ingreso',
  'gasto',
  'deuda',
  'peligro',
] as const satisfies readonly (keyof Palette)[];

/** Claves que sirven de fondo. */
export const SURFACE_KEYS = [
  'background',
  'surface',
  'surfaceAlt',
  'surfaceSunken',
] as const satisfies readonly (keyof Palette)[];

/**
 * Rellenos suaves y el texto que va encima de cada uno.
 *
 * Van declarados en pares porque un fondo de color sin su tinta es la forma más
 * fácil de romper el contraste sin que nadie lo note: se ve bien en la pantalla
 * donde se probó y falla en la siguiente.
 */
export const SOFT_PAIRS = [
  ['accentSoft', 'onAccentSoft'],
  ['ingresoSoft', 'onIngresoSoft'],
  ['gastoSoft', 'onGastoSoft'],
  ['deudaSoft', 'onDeudaSoft'],
  ['peligroSoft', 'onPeligroSoft'],
] as const satisfies readonly (readonly [keyof Palette, keyof Palette])[];

/**
 * Tema claro.
 *
 * **El fondo es gris y la superficie es blanca**, no al revés y no los dos casi
 * blancos: es lo que hace que una tarjeta se lea como una tarjeta sin necesidad
 * de sombra. Los neutros llevan un matiz del azul de noche, muy diluido, para
 * que el gris no sea gris de sistema operativo.
 *
 * **El ámbar de farol no cabe en el tema claro, y eso se decide aquí.**
 * `colors.txt` propone aclarar el color de marca y ponerle tinta oscura encima;
 * con este ámbar no llega: el más brillante que aguanta 4,5:1 con tinta negra
 * queda tan oscuro que, al pulsarlo, el par se rompe. Así que en claro el
 * relleno de acento es el ámbar profundo con tinta blanca —de ahí que `accent`
 * y `accentFill` coincidan de valor y no de papel— y el brillo entra por otro
 * lado: `accentSoft`, un crema cálido que sí se puede usar a lo grande.
 *
 * El ámbar de farol vive en el tema oscuro, que es donde funciona. Es
 * literalmente lo que dice el vídeo: una paleta se construye con los objetivos
 * de cada modo, no invirtiendo el otro.
 */
export const LIGHT_PALETTE: Palette = {
  background: '#F3F5FA',
  surface: '#FFFFFF',
  surfaceAlt: '#E9EDF6',
  surfaceSunken: '#E4E9F3',
  surfacePressed: '#DDE3EF',

  border: '#DCE2EE',
  borderStrong: '#69718A',

  textStrong: '#070A12',
  textPrimary: '#111725',
  textSecondary: '#485064',
  textMuted: '#5E667A',

  actionFill: '#111725',
  actionFillPressed: '#000308',
  onActionFill: '#FFFFFF',

  accent: '#845400',
  accentPressed: '#6A4300',
  accentFill: '#845400',
  accentFillPressed: '#6A4300',
  accentSoft: '#FFEECF',

  ingreso: '#0C6E4E',
  ingresoSoft: '#D8F0E5',
  gasto: '#701A10',
  gastoSoft: '#FAE3DF',
  deuda: '#845400',
  deudaSoft: '#FFEECF',
  peligro: '#AF2116',
  peligroSoft: '#FBE2DF',

  onAccent: '#FFFFFF',
  onAccentFill: '#FFFFFF',
  onAccentSoft: '#6A4300',
  onGasto: '#FFFFFF',
  onGastoSoft: '#771E12',
  onIngresoSoft: '#0A5A40',
  onDeudaSoft: '#6A4300',
  onPeligro: '#FFFFFF',
  onPeligroSoft: '#8E1B12',
};

/**
 * Tema oscuro.
 *
 * **No es el claro invertido.** Los bordes suben por encima de las superficies
 * —los colores oscuros necesitan más separación entre sí para que la diferencia
 * se vea—, el texto principal es gris claro y no blanco, y los colores
 * semánticos se aclaran y desaturan para no vibrar sobre fondo oscuro.
 *
 * El blanco puro existe una sola vez, en `textStrong`, y es a propósito: sobre
 * fondo oscuro cansa la vista, así que se reserva para lo que de verdad manda
 * en la pantalla.
 */
export const DARK_PALETTE: Palette = {
  background: '#0A0D14',
  surface: '#141926',
  surfaceAlt: '#1C2231',
  surfaceSunken: '#0F131D',
  surfacePressed: '#252D3E',

  border: '#2A3243',
  borderStrong: '#7B8497',

  textStrong: '#FFFFFF',
  textPrimary: '#E7ECF5',
  textSecondary: '#A7B0C3',
  textMuted: '#8B94A8',

  actionFill: '#E7ECF5',
  actionFillPressed: '#C6CEDD',
  onActionFill: '#0A0D14',

  accent: '#F0B44F',
  accentPressed: '#D19A3C',
  accentFill: '#F5B53F',
  accentFillPressed: '#D89B27',
  accentSoft: '#2C2314',

  ingreso: '#5FD8AD',
  ingresoSoft: '#0F2A21',
  gasto: '#EE8067',
  gastoSoft: '#2B1815',
  deuda: '#F0B44F',
  deudaSoft: '#2C2314',
  peligro: '#F4867A',
  peligroSoft: '#2D1715',

  onAccent: '#14161F',
  onAccentFill: '#14161F',
  onAccentSoft: '#F0BC63',
  onGasto: '#0D1017',
  onGastoSoft: '#F09A83',
  onIngresoSoft: '#6FE0B8',
  onDeudaSoft: '#F0BC63',
  onPeligro: '#0D1017',
  onPeligroSoft: '#F4988E',
};
