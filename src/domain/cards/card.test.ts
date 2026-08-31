import { accountId, ownerId } from '@/domain/ledger/ids';
import { money } from '@/domain/money/money';

import { createCreditCard, cupoDisponible, porcentajeUsado, type CreditCard } from './card';

const base: CreditCard = {
  accountId: accountId('rappicard:tarjeta'),
  owner: ownerId('david'),
  cupo: money(3_000_000, 'COP'),
  diaDeCorte: 15,
  diaDePago: 5,
};

describe('createCreditCard', () => {
  it('acepta una tarjeta corriente', () => {
    expect(createCreditCard(base).diaDeCorte).toBe(15);
  });

  it('rechaza un cupo negativo: no existe una tarjeta que preste menos que nada', () => {
    expect(() => createCreditCard({ ...base, cupo: money(-1, 'COP') })).toThrow(/cupo/i);
  });

  it('acepta cupo cero: es una tarjeta sin configurar todavía', () => {
    expect(createCreditCard({ ...base, cupo: money(0, 'COP') }).cupo.amount).toBe(0n);
  });

  /**
   * Los días 29, 30 y 31 no existen todos los meses. Aceptarlos aquí sería
   * empujar el problema al plan 03, donde ya no se sabría si el 31 era un
   * error o una decisión que hay que respetar en febrero.
   */
  it('rechaza un día que no existe en todos los meses', () => {
    expect(() => createCreditCard({ ...base, diaDeCorte: 31 })).toThrow(/1 y 28/);
    expect(() => createCreditCard({ ...base, diaDeCorte: 29 })).toThrow(/1 y 28/);
    expect(() => createCreditCard({ ...base, diaDeCorte: 0 })).toThrow(/1 y 28/);
    expect(() => createCreditCard({ ...base, diaDePago: 31 })).toThrow(/1 y 28/);
  });

  it('rechaza un día que no es entero', () => {
    expect(() => createCreditCard({ ...base, diaDeCorte: 15.5 })).toThrow(/1 y 28/);
  });
});

describe('cupoDisponible', () => {
  it('es el cupo menos la deuda', () => {
    expect(cupoDisponible(base, money(1_200_000, 'COP')).amount).toBe(1_800_000n);
  });

  /**
   * Sobregirarse pasa. Mostrar cero escondería justo el momento en que hay
   * que hacer algo.
   */
  it('con la deuda por encima del cupo queda negativo, y no se recorta a cero', () => {
    const t = createCreditCard({ ...base, cupo: money(1_000_000, 'COP') });
    expect(cupoDisponible(t, money(1_100_000, 'COP')).amount).toBe(-100_000n);
  });

  it('sin deuda, el disponible es el cupo entero', () => {
    expect(cupoDisponible(base, money(0, 'COP')).amount).toBe(3_000_000n);
  });

  it('no mezcla monedas', () => {
    expect(() => cupoDisponible(base, money(100, 'USD'))).toThrow();
  });
});

describe('porcentajeUsado', () => {
  it('la mitad del cupo es 0,5', () => {
    expect(porcentajeUsado(base, money(1_500_000, 'COP'))).toBeCloseTo(0.5, 5);
  });

  it('pasa de 1 cuando hay sobregiro', () => {
    expect(porcentajeUsado(base, money(3_300_000, 'COP'))).toBeCloseTo(1.1, 5);
  });

  /**
   * Una tarjeta sin cupo configurado no está «infinitamente usada»: está sin
   * configurar. Dividir por cero daría Infinity y llegaría a la pantalla como
   * una barra llena.
   */
  it('con cupo cero devuelve cero, no infinito', () => {
    const t = createCreditCard({ ...base, cupo: money(0, 'COP') });
    expect(porcentajeUsado(t, money(50_000, 'COP'))).toBe(0);
  });

  it('no compara monedas distintas', () => {
    expect(() => porcentajeUsado(base, money(100, 'USD'))).toThrow();
  });
});
