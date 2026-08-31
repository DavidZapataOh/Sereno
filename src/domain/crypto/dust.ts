import { absolute, type Money } from '@/domain/money/money';
import type { Rate } from '@/domain/rates/rate';

/**
 * Bajo cuánto un saldo cripto deja de mostrarse. En dólares.
 *
 * Es un umbral de **presentación**, no de contabilidad: lo que cae debajo
 * sigue sumando en el patrimonio y se declara en un renglón aparte. Esconder
 * plata de verdad para que la pantalla quede bonita es exactamente lo que una
 * app de dinero no puede hacer.
 */
export const POLVO_USD = 1n;

/**
 * Si un saldo cripto es polvo: vale menos de un dólar.
 *
 * Se compara en pesos porque es la moneda del total, y el umbral se trae a
 * pesos con la misma tasa que valoró el saldo. Compararlo en la moneda del
 * token daría un umbral distinto por token, que es justo lo que confunde.
 *
 * Sin tasa no hay comparación posible, y entonces **no es polvo**: un saldo que
 * no se pudo valorar se declara, nunca se esconde por si acaso.
 */
export function esPolvo(enPesos: Money | null, usdCop: Rate | null): boolean {
  if (enPesos === null || usdCop === null) return false;
  // La tasa es entera con su escala: 3.202,79 es 320279 con escala 2.
  const umbral = (usdCop.valor * POLVO_USD) / 10n ** BigInt(usdCop.escala);
  return absolute(enPesos).amount < umbral;
}
