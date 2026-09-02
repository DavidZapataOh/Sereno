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

/**
 * Radios, proporcionales al tamaño de lo que redondean.
 *
 * Una tarjeta grande con el mismo radio que un chip se ve barata: el ojo lee la
 * proporción, no el número. De ahí que haya cinco escalones y no tres.
 *
 * React Native no sabe dibujar el *squircle* de Apple —la curva continua—, pero
 * el efecto que produce se consigue igual con radios más generosos de lo que
 * pide el instinto.
 */
export const RADIUS = {
  pequeno: 10,
  medio: 14,
  grande: 20,
  enorme: 28,
  completo: 9999,
} as const;

/**
 * Sombras. Una sola forma, suave y ancha.
 *
 * **No sustituyen al borde**: lo acompañan donde algo de verdad flota encima
 * del contenido —una hoja inferior, un botón que sigue al desplazamiento—. Una
 * app llena de sombras es una app sin jerarquía, porque si todo flota nada
 * flota.
 */
export const SHADOW = {
  ninguna: {
    shadowOpacity: 0,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 0 },
    elevation: 0,
  },
  suave: {
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  flotante: {
    shadowOpacity: 0.16,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
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
