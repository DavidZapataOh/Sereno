import { add, isZero, money, sum, zero, type Money } from '@/domain/money/money';

import { necesarioParaSaldar, repartir } from './amortization';
import { mensualDe } from './rate';
import { ordenar, type DeudaEnSimulacion, type Estrategia } from './strategy';

/**
 * Tope de meses simulados. Cincuenta años.
 *
 * No es una salvaguarda teórica: si el presupuesto no cubre los intereses la
 * deuda crece cada mes y el bucle no termina nunca. Un bucle infinito en el
 * teléfono es un teléfono colgado.
 */
export const MAXIMO_MESES = 600;

export interface PagoDelMes {
  deudaId: string;
  intereses: Money;
  capital: Money;
}

export interface Mes {
  /** `AAAA-MM`. */
  mes: string;
  pagos: PagoDelMes[];
  /** Lo que se debe al terminar el mes. */
  saldoTotal: Money;
}

export type Resultado =
  | { estado: 'sale'; meses: Mes[]; fechaDeSalida: string; interesesTotales: Money }
  /**
   * **No converge.** Dibujar una fecha aquí sería mentir sobre lo único que de
   * verdad importa: el presupuesto no alcanza y la deuda crece.
   */
  | { estado: 'no-converge'; motivo: string };

export interface OpcionesDeSimulacion {
  estrategia: Estrategia;
  /** Lo que se puede destinar cada mes a todas las deudas juntas. */
  presupuesto: Money;
  /** Desde qué mes, `AAAA-MM`. */
  desde: string;
}

/**
 * Cuánto se tarda en salir, mes a mes.
 *
 * Cada mes se paga el mínimo de cada deuda y lo que sobre del presupuesto va
 * entero a la primera de la lista. Cuando una se salda, **su mínimo se suma al
 * ataque** en vez de ahorrarse: eso es lo que hace «bola de nieve» lo que es, y
 * lo que hace que las dos estrategias terminen antes de lo que parece.
 *
 * Es una función pura: entra el estado de las deudas, sale una tabla. Eso la
 * hace comprobable con propiedades y deja listo el «¿y si abono más?».
 */
export function simular(
  deudas: readonly DeudaEnSimulacion[],
  opciones: OpcionesDeSimulacion,
): Resultado {
  const moneda = deudas[0]?.saldo.currency ?? opciones.presupuesto.currency;
  const vivas = ordenar(deudas, opciones.estrategia).map((d) => ({ ...d }));
  if (vivas.length === 0) {
    return {
      estado: 'sale',
      meses: [],
      fechaDeSalida: opciones.desde,
      interesesTotales: zero(moneda),
    };
  }

  const meses: Mes[] = [];
  let interesesTotales = zero(moneda);
  let mes = opciones.desde;

  for (let i = 0; i < MAXIMO_MESES; i += 1) {
    const pagos: PagoDelMes[] = [];
    let disponible = opciones.presupuesto;

    // El orden se recalcula cada mes: al saldar una, la siguiente pasa a ser
    // el objetivo, y en bola de nieve el orden cambia según bajan los saldos.
    const orden = ordenar(vivas, opciones.estrategia);

    // Primero el mínimo de cada una, para no caer en mora en ninguna. El tope
    // es lo que hace falta para saldarla —saldo **más** los intereses del
    // mes—, no el saldo: con el saldo, la deuda nunca llega a cero.
    for (const d of orden) {
      const pago = menor(d.minimo, disponible, saldar(d));
      if (isZero(pago)) continue;
      aplicar(d, pago, pagos);
      disponible = { amount: disponible.amount - pago.amount, currency: moneda };
    }

    // Lo que sobre, entero al objetivo. Aquí es donde se acelera.
    const objetivo = orden[0];
    if (objetivo !== undefined && disponible.amount > 0n && objetivo.saldo.amount > 0n) {
      const extra = menor(disponible, saldar(objetivo));
      if (!isZero(extra)) {
        aplicar(objetivo, extra, pagos);
      }
    }

    for (const p of pagos) interesesTotales = add(interesesTotales, p.intereses);
    const saldoTotal = sum(
      vivas.map((d) => d.saldo),
      moneda,
    );
    meses.push({ mes, pagos, saldoTotal });

    if (saldoTotal.amount <= 0n) {
      return { estado: 'sale', meses, fechaDeSalida: mes, interesesTotales };
    }
    mes = siguienteMes(mes);
  }

  return {
    estado: 'no-converge',
    motivo:
      'Con ese presupuesto la deuda no baja: los intereses se lo comen. Hace falta abonar más cada mes.',
  };
}

/** Lo que hace falta para dejar esta deuda en cero este mes. */
function saldar(d: DeudaEnSimulacion): Money {
  return necesarioParaSaldar(d.saldo, d.tasa === null ? 0 : mensualDe(d.tasa));
}

/** Aplica un pago a una deuda, repartiéndolo y anotándolo. */
function aplicar(d: DeudaEnSimulacion, pago: Money, pagos: PagoDelMes[]): void {
  const tasaMensual = d.tasa === null ? 0 : mensualDe(d.tasa);
  const { intereses, capital } = repartir(d.saldo, tasaMensual, pago);
  d.saldo = { amount: d.saldo.amount - capital.amount, currency: d.saldo.currency };
  if (d.saldo.amount < 0n) d.saldo = zero(d.saldo.currency);
  pagos.push({ deudaId: d.id, intereses, capital });
}

/** El menor de varios montos, nunca negativo. */
function menor(...montos: Money[]): Money {
  const primero = montos[0];
  if (primero === undefined) throw new Error('Se necesita al menos un monto');
  let m = primero.amount;
  for (const x of montos) if (x.amount < m) m = x.amount;
  return money(m < 0n ? 0n : m, primero.currency);
}

function siguienteMes(mes: string): string {
  const [anio = 1970, m = 1] = mes.split('-').map(Number);
  const total = (anio - 1) * 12 + (m - 1) + 1;
  return `${String(Math.floor(total / 12) + 1).padStart(4, '0')}-${String((total % 12) + 1).padStart(2, '0')}`;
}
