import { array, assert, bigInt, property } from 'fast-check';
import { money, sum } from '@/domain/money/money';
import { accountId, ownerId, transactionId } from './ids';
import {
  createTransaction,
  imbalanceOf,
  UnbalancedTransactionError,
  type Posting,
} from './transaction';

const base = {
  id: transactionId('tx'),
  owner: ownerId('david'),
  fecha: '2026-08-20T15:00:00.000Z',
  descripcion: 'Generada',
  origen: { fuente: 'prueba', referencia: null },
};

/** Genera apuntes que cuadran: n montos libres y uno final que compensa. */
const apuntesQueCuadran = array(bigInt({ min: -100_000_000n, max: 100_000_000n }), {
  minLength: 1,
  maxLength: 8,
}).map((montos): Posting[] => {
  const compensacion = -montos.reduce((acc, m) => acc + m, 0n);
  return [...montos, compensacion].map((amount, indice) => ({
    accountId: accountId(`cuenta-${String(indice)}`),
    amount: money(amount, 'COP'),
  }));
});

describe('propiedades de la invariante', () => {
  it('toda transacción construida cuadra', () => {
    assert(
      property(apuntesQueCuadran, (postings) => {
        expect(imbalanceOf(createTransaction({ ...base, postings }).postings)).toEqual([]);
      }),
    );
  });

  it('la suma de los apuntes de una transacción construida es cero', () => {
    assert(
      property(apuntesQueCuadran, (postings) => {
        const tx = createTransaction({ ...base, postings });
        expect(
          sum(
            [...tx.postings].map((p) => p.amount),
            'COP',
          ).amount,
        ).toBe(0n);
      }),
    );
  });

  it('alterar un solo apunte hace que deje de poder construirse', () => {
    assert(
      property(apuntesQueCuadran, bigInt({ min: 1n, max: 1_000_000n }), (postings, desvio) => {
        const alterados = [...postings];
        alterados[0] = {
          ...alterados[0],
          amount: money(alterados[0].amount.amount + desvio, 'COP'),
        };
        expect(() => createTransaction({ ...base, postings: alterados })).toThrow(
          UnbalancedTransactionError,
        );
      }),
    );
  });

  it('el orden de los apuntes no afecta al cuadre', () => {
    assert(
      property(apuntesQueCuadran, (postings) => {
        expect(imbalanceOf([...postings].reverse())).toEqual(imbalanceOf(postings));
      }),
    );
  });
});
