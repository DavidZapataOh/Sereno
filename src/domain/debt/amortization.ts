import { subtract, type Money } from '@/domain/money/money';

/**
 * Con cuántos dígitos se convierte la tasa a fracción exacta.
 *
 * La tasa es un `number` —una raíz doceava no es racional— pero **el monto que
 * sale de ella no puede serlo**: se pasa a numerador y denominador enteros y se
 * multiplica con `BigInt`. Nueve dígitos dan de sobra para una tasa mensual y
 * no desbordan nada.
 */
const DIGITOS = 9;
const ESCALA = 10n ** BigInt(DIGITOS);

/**
 * Parte un pago en lo que se va en intereses y lo que baja la deuda.
 *
 * Es la pieza que hace que pagar deuda **no** parezca empobrecerse: solo la
 * pata de intereses es gasto; el capital es mover plata de una cuenta a otra y
 * no toca el patrimonio. Contarlo todo como gasto diría que quien paga sus
 * deudas se está arruinando.
 *
 * **El capital se calcula por diferencia**, nunca con su propia fórmula: así
 * las dos patas suman el pago exacto y el asiento cuadra siempre. Redondear
 * cada una por su lado deja un peso suelto que aparece meses después como una
 * deuda que no cuadra.
 *
 * Un capital **negativo** es un resultado válido y no se recorta: significa que
 * el pago no cubrió ni los intereses y la deuda creció. Es justo lo que hay que
 * poder enseñarle a alguien que solo paga el mínimo.
 *
 * **El saldo se pasa en positivo**, aunque en el ledger un pasivo lo tenga
 * negativo. Aceptar el negativo daría intereses negativos —o sea, la deuda
 * pagándole a uno— sin que nada se quejara. Quien llama convierte con
 * `absolute`, y así un error de signo se ve aquí en vez de propagarse.
 */
export function repartir(
  saldo: Money,
  tasaMensual: number,
  pago: Money,
): { intereses: Money; capital: Money } {
  if (tasaMensual < 0) throw new Error('Una tasa negativa no es una deuda');
  if (saldo.amount < 0n) {
    throw new Error('El saldo va en positivo: en el ledger un pasivo es negativo, conviértelo');
  }

  // Redondeo hacia arriba: contra el deudor, y declarado. Uno a favor haría
  // que la simulación prometiera salir antes de lo que se sale.
  const factor = BigInt(Math.round(tasaMensual * Number(ESCALA)));
  const bruto = saldo.amount * factor;
  const intereses: Money = {
    amount: bruto === 0n ? 0n : (bruto + ESCALA - 1n) / ESCALA,
    currency: saldo.currency,
  };

  return { intereses, capital: subtract(pago, intereses) };
}
