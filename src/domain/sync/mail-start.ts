import { calendarDay } from '@/domain/time/colombia';

/**
 * El día en que este teléfono empezó a escuchar el correo.
 *
 * Es un corte **propio**, distinto del que fija conectar una cuenta por el
 * portal. Conectar el correo trae de golpe lo que el buzón guarde —semanas,
 * meses—, y nada de eso debe entrar: el usuario ya cuadró sus saldos a mano,
 * y meterle un mes de historia se los descuadra sin que él haya hecho nada.
 *
 * Se fija una sola vez, en la primera traída, y no se vuelve a mover. Si se
 * recalculara cada vez, un teléfono que estuvo tres días apagado perdería
 * justo lo que sí debía entrar.
 */
export function mailStartDay(guardado: string | null, ahora: string): string {
  return guardado ?? calendarDay(ahora);
}

/**
 * De dos cortes, el más tarde manda.
 *
 * Una fuente puede venir ya conectada por el portal desde antes; aun así, del
 * correo no entra nada anterior a haber conectado el correo. Lo de en medio
 * no se inventa: si nadie lo vio, no existe.
 */
export function corteMasTarde(a: string, b: string): string {
  return a > b ? a : b;
}
