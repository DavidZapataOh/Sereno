import type { TransactionId } from '@/domain/ledger/ids';
import type { Money } from '@/domain/money/money';
import { calendarDay, daysBetween } from '@/domain/time/colombia';

/** Un movimiento reducido a lo que hace falta para emparejar. */
export interface MovimientoParaAtar {
  id: TransactionId;
  fecha: string;
  /** Siempre positivo: cuánto salió. */
  monto: Money;
}

/**
 * Cuatro por cada mil que salen. La tasa es exacta y está en la ley.
 */
const NUMERADOR = 4n;
const DENOMINADOR = 1000n;

/**
 * Cuánto puede desviarse el cargo del cálculo exacto.
 *
 * Un peso: el banco redondea. Más margen abriría la puerta a emparejar un
 * cargo agrupado con una salida cualquiera, y **atarlo mal es peor que no
 * atarlo**: un número que parece preciso y no lo es se propaga a todas las
 * pantallas de encima.
 */
const TOLERANCIA = 1n;

/** Cuántos días después de la salida puede aparecer su cargo. */
const VENTANA_DIAS = 1;

function esperado(salida: Money): bigint {
  return (salida.amount * NUMERADOR) / DENOMINADOR;
}

/**
 * Ata cada cargo de 4×1000 al movimiento que lo causó.
 *
 * Convierte «pagaste $4.000 de impuesto» en «mandar ese millón te costó
 * $4.000», que es lo único de todo esto que puede cambiar una conducta.
 *
 * Un cargo que no cuadre con **ninguna salida sola** se deja sin atar: los
 * bancos agrupan el GMF del día, y para esos casos la verdad es que viene de
 * varias. Inventar una es peor.
 */
export function emparejarGmf(
  cargos: readonly MovimientoParaAtar[],
  candidatos: readonly MovimientoParaAtar[],
): Map<TransactionId, TransactionId> {
  const pares = new Map<TransactionId, TransactionId>();
  const usadas = new Set<TransactionId>();

  // Los cargos, del más antiguo al más nuevo: así el emparejamiento no depende
  // del orden en que vinieran de la base.
  const ordenados = [...cargos].sort((a, b) => a.fecha.localeCompare(b.fecha));

  for (const cargo of ordenados) {
    const diaCargo = calendarDay(cargo.fecha);

    const posibles = candidatos
      .filter((s) => !usadas.has(s.id))
      .filter((s) => s.monto.currency === cargo.monto.currency)
      // El cargo nunca es anterior a lo que lo causó.
      .filter((s) => calendarDay(s.fecha) <= diaCargo)
      .filter((s) => daysBetween(s.fecha, cargo.fecha) <= VENTANA_DIAS)
      .filter((s) => {
        const diferencia = cargo.monto.amount - esperado(s.monto);
        return (diferencia < 0n ? -diferencia : diferencia) <= TOLERANCIA;
      })
      .sort((a, b) => daysBetween(a.fecha, cargo.fecha) - daysBetween(b.fecha, cargo.fecha));

    const elegida = posibles[0];
    if (elegida === undefined) continue;
    pares.set(cargo.id, elegida.id);
    usadas.add(elegida.id);
  }

  return pares;
}
