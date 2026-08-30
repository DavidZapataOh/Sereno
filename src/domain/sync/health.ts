export type EstadoIngesta = 'nunca' | 'al-dia' | 'atrasada' | 'detenida' | 'con-error';

export interface UltimaCorrida {
  terminadoEn: string | null;
  error: string | null;
}

const MINUTO = 60_000;
/** Medio día sin correr sí es noticia; un rato, no. */
const HORAS_PARA_DETENIDA = 6;

/**
 * Si la ingesta está corriendo como debe.
 *
 * Es una regla, no una pantalla: por eso vive aquí y se prueba. Una corrida
 * abierta hace horas cuenta igual que ninguna corrida reciente: significa que
 * el proceso murió a mitad de pasada.
 */
export function estadoDeIngesta(
  ultima: UltimaCorrida | null,
  now: string,
  opciones: { intervaloMinutos?: number; iniciadoEn?: string } = {},
): EstadoIngesta {
  if (ultima === null) return 'nunca';
  if (ultima.error !== null) return 'con-error';

  const intervalo = opciones.intervaloMinutos ?? 10;
  const referencia = ultima.terminadoEn ?? opciones.iniciadoEn ?? null;
  if (referencia === null) return 'nunca';

  const minutos = (Date.parse(now) - Date.parse(referencia)) / MINUTO;
  if (minutos >= HORAS_PARA_DETENIDA * 60) return 'detenida';
  if (minutos > intervalo * 3) return 'atrasada';
  return 'al-dia';
}
