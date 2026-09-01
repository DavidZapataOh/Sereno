import type { Money } from '@/domain/money/money';

import type { Tasa } from './debt';
import { mensualDe } from './rate';

/**
 * Las dos formas de atacar varias deudas a la vez.
 *
 * **Avalancha** paga menos intereses: es la óptima en dinero. **Bola de nieve**
 * cierra deudas antes, y cada una cerrada es una menos que recordar.
 *
 * Se ofrecen las dos y la app no elige. La avalancha siempre gana en pesos,
 * pero el problema de este usuario es la constancia, y ver desaparecer una
 * deuda la sostiene mejor que ahorrarse un interés que no se ve.
 */
export type Estrategia = 'avalancha' | 'bola-de-nieve';

export interface DeudaEnSimulacion {
  id: string;
  nombre: string;
  /** Lo que se debe, **en positivo**. */
  saldo: Money;
  /** `null` cuando no aplica: lo que se le debe a una persona. */
  tasa: Tasa | null;
  /** Lo mínimo que hay que pagar cada mes. */
  minimo: Money;
}

/**
 * El orden de ataque.
 *
 * Una deuda **sin tasa** va al final en avalancha: no cuesta intereses, así que
 * atacarla primero sería pagar de más en las otras. Pero no se confunde con una
 * al 0 % pactado —esa sí es una tasa, y empata con las demás de 0 %—.
 *
 * El desempate por saldo no es un detalle: sin él, el orden dependería de cómo
 * vinieran las deudas de la base y la simulación daría resultados distintos
 * entre corridas.
 */
export function ordenar(
  deudas: readonly DeudaEnSimulacion[],
  estrategia: Estrategia,
): DeudaEnSimulacion[] {
  const vivas = deudas.filter((d) => d.saldo.amount > 0n);

  return [...vivas].sort((a, b) => {
    if (estrategia === 'bola-de-nieve') {
      const porSaldo = Number(a.saldo.amount - b.saldo.amount);
      return porSaldo === 0 ? a.id.localeCompare(b.id) : porSaldo;
    }

    // Avalancha: mayor tasa primero. Sin tasa va al final.
    const ta = a.tasa === null ? -1 : mensualDe(a.tasa);
    const tb = b.tasa === null ? -1 : mensualDe(b.tasa);
    if (ta !== tb) return tb - ta;
    const porSaldo = Number(a.saldo.amount - b.saldo.amount);
    return porSaldo === 0 ? a.id.localeCompare(b.id) : porSaldo;
  });
}
