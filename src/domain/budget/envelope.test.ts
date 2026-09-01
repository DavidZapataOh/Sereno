import { ownerId } from '@/domain/ledger/ids';
import { money } from '@/domain/money/money';

import { repartoDe } from './allocation';
import { createEnvelope, estadoDe, type Envelope } from './envelope';

const owner = ownerId('david');
const COP = 'COP' as const;

const sobre = (categoria: string, asignado: number): Envelope =>
  createEnvelope({ owner, mes: '2026-09', categoria, asignado: money(asignado, COP) });

describe('createEnvelope', () => {
  it('acepta un sobre corriente', () => {
    expect(sobre('mercado', 600_000).asignado.amount).toBe(600_000n);
  });

  it('el mes se escribe AAAA-MM', () => {
    expect(() => createEnvelope({ ...sobre('mercado', 1), mes: '2026-9' })).toThrow(/AAAA-MM/);
    expect(() => createEnvelope({ ...sobre('mercado', 1), mes: '2026-13' })).toThrow(/AAAA-MM/);
  });

  it('rechaza una asignación negativa', () => {
    expect(() => createEnvelope({ ...sobre('mercado', 1), asignado: money(-1, COP) })).toThrow(
      /negativa/i,
    );
  });

  it('acepta asignar cero: es una decisión, no un error', () => {
    expect(() => sobre('mercado', 0)).not.toThrow();
  });

  it('exige categoría', () => {
    expect(() => createEnvelope({ ...sobre('mercado', 1), categoria: '  ' })).toThrow(/categoría/i);
  });
});

describe('estadoDe', () => {
  it('lo que queda es lo asignado menos lo gastado', () => {
    const estado = estadoDe(sobre('mercado', 600_000), money(250_000, COP));

    expect(estado.queda.amount).toBe(350_000n);
    expect(estado.sobregirado).toBe(false);
  });

  /**
   * Recortar a cero escondería el problema justo donde hay que verlo, y dejaría
   * el total del presupuesto mintiendo: la suma de los sobres no cuadraría con
   * lo que salió de verdad.
   */
  it('gastar de más deja el sobre en negativo, no en cero', () => {
    const estado = estadoDe(sobre('mercado', 600_000), money(700_000, COP));

    expect(estado.queda.amount).toBe(-100_000n);
    expect(estado.sobregirado).toBe(true);
  });

  it('un sobre sin gasto queda entero', () => {
    expect(estadoDe(sobre('mercado', 600_000), money(0, COP)).queda.amount).toBe(600_000n);
  });

  it('gastar exactamente lo asignado no es sobregiro', () => {
    expect(estadoDe(sobre('mercado', 600_000), money(600_000, COP)).sobregirado).toBe(false);
  });

  it('no mezcla monedas', () => {
    expect(() => estadoDe(sobre('mercado', 1), money(1, 'USDC'))).toThrow();
  });
});

describe('repartoDe', () => {
  const ingreso = money(3_200_000, COP);

  /** El invariante del método: ningún peso sin destino. */
  it('está completo cuando lo asignado iguala lo que entra', () => {
    const reparto = repartoDe(ingreso, [
      sobre('mercado', 2_000_000),
      sobre('transporte', 1_200_000),
    ]);

    expect(reparto.sinAsignar.amount).toBe(0n);
    expect(reparto.completo).toBe(true);
  });

  it('lo que falta por asignar se dice, no se esconde', () => {
    const reparto = repartoDe(ingreso, [sobre('mercado', 2_000_000)]);

    expect(reparto.sinAsignar.amount).toBe(1_200_000n);
    expect(reparto.completo).toBe(false);
  });

  /**
   * Asignar más de lo que entra es una decisión —se está gastando ahorro— y no
   * un error. Pero tiene que verse: es lo que hunde un mes.
   */
  it('asignar de más deja «sin asignar» en negativo y no completo', () => {
    const reparto = repartoDe(ingreso, [sobre('mercado', 4_000_000)]);

    expect(reparto.sinAsignar.amount).toBe(-800_000n);
    expect(reparto.completo).toBe(false);
  });

  it('sin ingreso todavía, nada está completo', () => {
    expect(repartoDe(money(0, COP), []).completo).toBe(false);
  });

  it('sin sobres, todo está sin asignar', () => {
    expect(repartoDe(ingreso, []).sinAsignar.amount).toBe(3_200_000n);
  });
});
