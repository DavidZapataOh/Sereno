/** Escala de espaciado en base 4. Todo margen y relleno sale de aquí. */
export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

/**
 * Área táctil mínima en Android.
 *
 * Cualquier elemento con el que se pueda interactuar mide al menos esto, aunque
 * su parte visible sea más pequeña.
 */
export const TOUCH_TARGET_MIN = 48;

export const RADIUS = {
  pequeno: 8,
  medio: 12,
  grande: 20,
  completo: 9999,
} as const;

/**
 * Elevación.
 *
 * Casi todo es plano: una tarjeta se separa del fondo con un borde, no con
 * sombra, que en Android se pinta distinto según la versión. La elevación se
 * reserva para lo que de verdad flota encima del contenido.
 */
export const ELEVATION = {
  plano: 0,
  elevado: 2,
  flotante: 8,
} as const;

/**
 * Duraciones de animación.
 *
 * El movimiento existe para explicar un cambio, no para entretener. Nada pasa
 * de 400 ms: por encima, se percibe como lentitud.
 */
export const DURATION = {
  instantaneo: 120,
  rapido: 200,
  normal: 300,
} as const;
