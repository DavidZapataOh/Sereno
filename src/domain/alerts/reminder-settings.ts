/**
 * Cuánta antelación y a qué hora avisar.
 *
 * El tope de catorce días no es arbitrario: un aviso con más antelación llega
 * cuando todavía no se puede hacer nada, y el que llega demasiado pronto se
 * descarta igual que el que llega tarde.
 */
export interface ReminderSettings {
  diasAntes: number;
  /** Hora del día, 0–23, en hora de Colombia. */
  hora: number;
  silenciado: boolean;
}

export const MAXIMO_DIAS_ANTES = 14;

/** Un día antes, por la mañana. Suficiente para mover plata si hace falta. */
export const AJUSTES_POR_DEFECTO: ReminderSettings = {
  diasAntes: 1,
  hora: 9,
  silenciado: false,
};

export function createReminderSettings(input: ReminderSettings): ReminderSettings {
  if (!Number.isInteger(input.diasAntes) || input.diasAntes < 0) {
    throw new Error('La antelación son días enteros, y no puede ser negativa');
  }
  if (input.diasAntes > MAXIMO_DIAS_ANTES) {
    throw new Error(`Avisar con más de ${String(MAXIMO_DIAS_ANTES)} días no sirve de nada`);
  }
  if (!Number.isInteger(input.hora) || input.hora < 0 || input.hora > 23) {
    throw new Error('La hora va de 0 a 23');
  }
  return { ...input };
}
