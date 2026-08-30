import { assert, property } from 'fast-check';

import { money } from '@/domain/money/money';
import { apuntesQueCuadran } from '@/test/arbitraries';

import { accountId, ownerId, transactionId } from './ids';
import { createTransaction } from './transaction';
import { parseTransaction, serializeTransaction } from './transaction-codec';

const base = createTransaction({
  id: transactionId('t1'),
  owner: ownerId('david'),
  fecha: '2026-08-28T00:00:00.000-05:00',
  descripcion: 'Compra',
  origen: { fuente: 'bancolombia', referencia: 'REF-1' },
  postings: [
    { accountId: accountId('a'), amount: money(-45000, 'COP'), nota: 'la mitad' },
    { accountId: accountId('b'), amount: money(45000, 'COP') },
  ],
});

describe('códec de transacciones', () => {
  it('ida y vuelta devuelve una transacción igual', () => {
    expect(parseTransaction(serializeTransaction(base))).toEqual(base);
  });

  it('conserva montos que desbordan un number', () => {
    const enorme = createTransaction({
      ...base,
      postings: [
        { accountId: accountId('a'), amount: money(-(10n ** 19n + 1n), 'ETH') },
        { accountId: accountId('b'), amount: money(10n ** 19n + 1n, 'ETH') },
      ],
    });
    expect(parseTransaction(serializeTransaction(enorme)).postings[1]?.amount.amount).toBe(
      10n ** 19n + 1n,
    );
  });

  it('el JSON es legible: el monto va como texto, no como número', () => {
    expect(serializeTransaction(base)).toContain('"amount":"-45000"');
  });

  it('una transacción descuadrada en el JSON falla al leer', () => {
    const json = serializeTransaction(base).replace('"amount":"45000"', '"amount":"44999"');
    expect(() => parseTransaction(json)).toThrow(/cuadra/);
  });

  it('un JSON que no es una transacción falla con un mensaje claro', () => {
    expect(() => parseTransaction('{"id":1}')).toThrow();
    expect(() => parseTransaction('no es json')).toThrow();
  });

  it('propiedad: cualquier transacción que cuadra sobrevive la ida y vuelta', () => {
    assert(
      property(apuntesQueCuadran, (postings) => {
        const t = createTransaction({ ...base, postings });
        expect(parseTransaction(serializeTransaction(t))).toEqual(t);
      }),
    );
  });
});
