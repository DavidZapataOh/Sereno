export interface Palette {
  // Superficies (el 60 % de la pantalla: neutras, en segundo plano)
  background: string;
  surface: string;
  surfaceAlt: string;
  /** La superficie mientras se está pulsando. */
  surfacePressed: string;

  // Bordes
  border: string;
  borderStrong: string;

  // Texto (el 30 %: grises con jerarquía, no negro ni blanco puros)
  textPrimary: string;
  textSecondary: string;
  textMuted: string;

  // Identidad y semántica financiera (el 10 %: solo donde informa)
  accent: string;
  /** El acento mientras se está pulsando: un poco más oscuro. */
  accentPressed: string;
  ingreso: string;
  gasto: string;
  deuda: string;
  /** Acciones destructivas y errores del sistema. NO es un gasto. */
  peligro: string;

  // Texto que se pinta ENCIMA de un color de relleno
  onAccent: string;
  onGasto: string;
  onPeligro: string;
}

/** Claves que se pintan como texto. La auditoría las verifica contra cada superficie. */
export const TEXT_KEYS = [
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
] as const satisfies readonly (keyof Palette)[];

/**
 * Tema claro.
 *
 * Los neutros llevan un matiz frío casi imperceptible —el azul de noche de la
 * identidad, muy diluido— en vez de gris puro. El acento es el ámbar del farol
 * del sereno. La semántica evita el rojo puro: un saldo en negativo no necesita
 * gritar (principio 3).
 */
export const LIGHT_PALETTE: Palette = {
  background: '#FBFBFD',
  surface: '#FFFFFF',
  surfaceAlt: '#F1F3F7',
  surfacePressed: '#E6E9F0',

  border: '#DDE0E8',
  borderStrong: '#7C8497',

  textPrimary: '#14161F',
  textSecondary: '#555C6E',
  textMuted: '#666D80',

  accent: '#8A5A00',
  accentPressed: '#6E4800',
  ingreso: '#127A5B',
  gasto: '#8E2417',
  deuda: '#8A5A00',
  peligro: '#B42318',

  onAccent: '#FFFFFF',
  onGasto: '#FFFFFF',
  onPeligro: '#FFFFFF',
};

/**
 * Tema oscuro.
 *
 * Es el tema con el que la identidad de Sereno tiene más sentido: azul de noche
 * y el ámbar del farol. No es el claro invertido: los grises de texto son más
 * bajos que el blanco, los bordes suben para que se vean, y los colores
 * semánticos se aclaran y desaturan un poco para no vibrar sobre fondo oscuro.
 */
export const DARK_PALETTE: Palette = {
  background: '#0D1017',
  surface: '#161A23',
  surfaceAlt: '#1F242F',
  surfacePressed: '#29303D',

  border: '#2C323E',
  borderStrong: '#757E90',

  textPrimary: '#F2F4F8',
  textSecondary: '#AEB6C6',
  textMuted: '#8B94A6',

  accent: '#E8A33D',
  accentPressed: '#C98A2C',
  ingreso: '#63DBB0',
  gasto: '#E8735A',
  deuda: '#F0B45C',
  peligro: '#F47C70',

  onAccent: '#14161F',
  onGasto: '#0D1017',
  onPeligro: '#0D1017',
};
