/**
 * Movimiento.
 *
 * Dos reglas, y de ellas sale todo lo demás:
 *
 * **1. El movimiento explica; no adorna.** Cada animación responde «¿qué cambió
 * y de dónde vino?». Lo que no responda a eso se quita: es lo que hace que una
 * app se sienta lenta a la tercera semana, cuando ya no sorprende y solo estorba.
 *
 * **2. Lo que responde al dedo se describe con un muelle, no con una curva.**
 * Una curva describe una animación; un muelle describe un objeto con masa. Es
 * la diferencia entre una pantalla que cambia y algo que se hunde cuando lo
 * aprietas, y es literalmente lo que hace que un botón se sienta pulsable.
 */

/**
 * Duraciones, en milisegundos.
 *
 * **Nada pasa de 420 ms.** Por encima se percibe como lentitud, no como
 * suavidad. Y lo que responde a un dedo baja de 200: ahí la espera se nota
 * incluso cuando no se ve.
 */
export const DURACION = {
  /** Un cambio de estado que ya ocurrió: color, opacidad. */
  instante: 120,
  /** La respuesta a un toque. */
  rapido: 200,
  /** Algo que aparece o desaparece dentro de la pantalla. */
  normal: 300,
  /** Algo que entra desde fuera: una hoja, una pantalla. */
  entrada: 420,
} as const;

export interface Resorte {
  /** Cuánto frena. Alto = sin rebote; bajo = elástico. */
  damping: number;
  /** La «masa» del objeto. */
  mass: number;
  /** La fuerza del muelle. */
  stiffness: number;
}

/**
 * Muelles con nombre.
 *
 * Ninguno rebota más de lo que rebotaría un objeto real: un rebote exagerado se
 * lee como juguete, y esto administra el dinero de alguien.
 */
export const RESORTE = {
  /** Al pulsar y al soltar. Rápido y sin rebote: el dedo ya está ahí. */
  presion: { damping: 26, mass: 0.6, stiffness: 420 },
  /** Algo que entra en escena. Un rebote mínimo, apenas perceptible. */
  entrada: { damping: 18, mass: 0.9, stiffness: 220 },
  /** Lo que se arrastra y se suelta: una hoja inferior. */
  arrastre: { damping: 22, mass: 1, stiffness: 260 },
} as const satisfies Record<string, Resorte>;

/**
 * Cuánto se hunde algo al pulsarlo.
 *
 * Tres por ciento. Suena a nada y se nota entero: es la diferencia entre tocar
 * una imagen y presionar un botón.
 */
export const ESCALA_PRESION = 0.97;

/** El techo de cualquier duración. Existe para que la prueba lo pueda exigir. */
export const DURACION_MAXIMA = 420;

/** El techo de lo que responde a un dedo. */
export const DURACION_MAXIMA_AL_TACTO = 200;
