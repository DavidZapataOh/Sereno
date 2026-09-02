/**
 * Qué se puede sentir, y nada más.
 *
 * Una lista cerrada y corta a propósito: **la háptica es información, no
 * adorno**. Si vibra todo, no significa nada, y a la semana se apaga en los
 * ajustes del teléfono —y con ella se pierde la que sí servía—.
 *
 * El puerto vive en el dominio, como el de observabilidad, porque lo necesitan
 * los dos lados: la interfaz para pedir que vibre y la infraestructura para
 * hacerlo. Ninguno de los dos importa al otro.
 */
export type Vibracion =
  /** Algo se confirmó y cambió datos. */
  | 'confirmar'
  /** Algo falló y hay que enterarse. */
  | 'fallo'
  /** Un tope: el final de una lista, un límite alcanzado. */
  | 'tope';

export interface Haptics {
  sentir: (que: Vibracion) => void;
}
