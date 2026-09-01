import { add, subtract, zero, type Money } from '@/domain/money/money';

/**
 * Lo que se sabe que va a entrar o salir un mes.
 *
 * **Comprometido y estimado van separados hasta el final.** Una cuota con fecha
 * es un hecho; «suelo gastar 600.000 en mercado» es una suposición. Sumarlos en
 * una sola cifra produce un número que parece un hecho, y sobre él se toman
 * decisiones.
 */
export interface FlujoDelMes {
  mes: string;
  /** Cuotas, tarjetas, suscripciones, aportes. Con fecha y monto conocidos. */
  comprometido: Money;
  /** El gasto y el ingreso habituales. Una media, no una promesa. */
  estimado: Money;
}

export interface MesProyectado {
  mes: string;
  saldoInicial: Money;
  comprometido: Money;
  estimado: Money;
  saldoFinal: Money;
}

export interface Proyeccion {
  meses: MesProyectado[];
  /**
   * El primer mes en que el saldo no alcanza, **según lo comprometido**.
   * `null` si no lo hay.
   */
  primerMesEnRojo: string | null;
}

/** Tope de meses. Más allá, una proyección es adivinación. */
export const MAXIMO_MESES = 24;

/**
 * El saldo de los próximos meses.
 *
 * **El aviso sale solo de lo comprometido.** Con lo estimado dentro, un mes de
 * gasto alto disparararía una alarma por algo que quizá no pasa —y el segundo
 * aviso falso desactiva todos los demás—.
 */
export function proyectar(
  saldoHoy: Money,
  flujos: readonly FlujoDelMes[],
  opciones: { meses: number },
): Proyeccion {
  const meses: MesProyectado[] = [];
  let saldo = saldoHoy;
  let saldoSoloComprometido = saldoHoy;
  let primerMesEnRojo: string | null = null;

  for (const flujo of flujos.slice(0, Math.min(opciones.meses, MAXIMO_MESES))) {
    const saldoInicial = saldo;
    const saldoFinal = add(add(saldoInicial, flujo.comprometido), flujo.estimado);

    saldoSoloComprometido = add(saldoSoloComprometido, flujo.comprometido);
    if (primerMesEnRojo === null && saldoSoloComprometido.amount < 0n) {
      primerMesEnRojo = flujo.mes;
    }

    meses.push({
      mes: flujo.mes,
      saldoInicial,
      comprometido: flujo.comprometido,
      estimado: flujo.estimado,
      saldoFinal,
    });
    saldo = saldoFinal;
  }

  return { meses, primerMesEnRojo };
}

/** Un flujo vacío para un mes: nada comprometido, nada estimado. */
export function mesVacio(mes: string, moneda: Money['currency']): FlujoDelMes {
  return { mes, comprometido: zero(moneda), estimado: zero(moneda) };
}

/** Lo que sale se resta: se guarda con signo para no confundirlo al sumar. */
export function salida(monto: Money): Money {
  return subtract(zero(monto.currency), monto);
}
