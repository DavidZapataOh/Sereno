import { money } from '@/domain/money/money';
import { accountId, ownerId, transactionId } from './ids';
import {
  createTransaction,
  imbalanceOf,
  transfer,
  UnbalancedTransactionError,
  type Posting,
} from './transaction';

const owner = ownerId('david');
const banco = accountId('bancolombia');
const mercado = accountId('gasto-mercado');
const nequi = accountId('nequi');
const conversion = accountId('conversion');
const binance = accountId('binance');

const base = {
  id: transactionId('tx-1'),
  owner,
  fecha: '2026-08-20T15:00:00.000Z',
  descripcion: 'Compra en Éxito',
  origen: { fuente: 'bancolombia', referencia: '4471' },
};

describe('createTransaction — casos que cuadran', () => {
  it('crea un gasto con dos apuntes', () => {
    const tx = createTransaction({
      ...base,
      postings: [
        { accountId: banco, amount: money(-45000, 'COP') },
        { accountId: mercado, amount: money(45000, 'COP') },
      ],
    });
    expect(tx.postings).toHaveLength(2);
    expect(tx.descripcion).toBe('Compra en Éxito');
  });

  it('acepta más de dos apuntes: compra con propina', () => {
    const tx = createTransaction({
      ...base,
      postings: [
        { accountId: banco, amount: money(-55000, 'COP') },
        { accountId: mercado, amount: money(45000, 'COP') },
        { accountId: accountId('gasto-propina'), amount: money(10000, 'COP') },
      ],
    });
    expect(tx.postings).toHaveLength(3);
  });

  it('acepta dos monedas si cada una cuadra por separado', () => {
    const tx = createTransaction({
      ...base,
      postings: [
        { accountId: banco, amount: money(-400000, 'COP') },
        { accountId: conversion, amount: money(400000, 'COP') },
        { accountId: conversion, amount: money(-100_000000, 'USDT') },
        { accountId: binance, amount: money(100_000000, 'USDT') },
      ],
    });
    expect(tx.postings).toHaveLength(4);
  });

  it('recorta la descripción', () => {
    const tx = createTransaction({
      ...base,
      descripcion: '  Compra  ',
      postings: [
        { accountId: banco, amount: money(-1, 'COP') },
        { accountId: mercado, amount: money(1, 'COP') },
      ],
    });
    expect(tx.descripcion).toBe('Compra');
  });

  it('los apuntes no se comparten con quien los pasó', () => {
    const postings: Posting[] = [
      { accountId: banco, amount: money(-1, 'COP') },
      { accountId: mercado, amount: money(1, 'COP') },
    ];
    expect(createTransaction({ ...base, postings }).postings).not.toBe(postings);
  });
});

describe('createTransaction — casos que NO cuadran', () => {
  it('rechaza una transacción descuadrada', () => {
    expect(() =>
      createTransaction({
        ...base,
        postings: [
          { accountId: banco, amount: money(-45000, 'COP') },
          { accountId: mercado, amount: money(44000, 'COP') },
        ],
      }),
    ).toThrow(UnbalancedTransactionError);
  });

  it('el error indica la moneda y el descuadre', () => {
    expect(() =>
      createTransaction({
        ...base,
        postings: [
          { accountId: banco, amount: money(-45000, 'COP') },
          { accountId: mercado, amount: money(44000, 'COP') },
        ],
      }),
    ).toThrow(/COP/);
  });

  it('rechaza si una moneda cuadra y la otra no', () => {
    expect(() =>
      createTransaction({
        ...base,
        postings: [
          { accountId: banco, amount: money(-400000, 'COP') },
          { accountId: conversion, amount: money(400000, 'COP') },
          { accountId: binance, amount: money(100_000000, 'USDT') },
        ],
      }),
    ).toThrow(UnbalancedTransactionError);
  });

  it('rechaza menos de dos apuntes', () => {
    expect(() =>
      createTransaction({ ...base, postings: [{ accountId: banco, amount: money(0, 'COP') }] }),
    ).toThrow(/dos apuntes/i);
  });

  it('rechaza una lista de apuntes vacía', () => {
    expect(() => createTransaction({ ...base, postings: [] })).toThrow();
  });

  it('rechaza una descripción vacía', () => {
    expect(() =>
      createTransaction({
        ...base,
        descripcion: '   ',
        postings: [
          { accountId: banco, amount: money(-1, 'COP') },
          { accountId: mercado, amount: money(1, 'COP') },
        ],
      }),
    ).toThrow();
  });

  it('rechaza una fecha inválida', () => {
    expect(() =>
      createTransaction({
        ...base,
        fecha: 'ayer',
        postings: [
          { accountId: banco, amount: money(-1, 'COP') },
          { accountId: mercado, amount: money(1, 'COP') },
        ],
      }),
    ).toThrow(/fecha/i);
  });
});

describe('imbalanceOf', () => {
  it('devuelve vacío cuando todo cuadra', () => {
    expect(
      imbalanceOf([
        { accountId: banco, amount: money(-100, 'COP') },
        { accountId: mercado, amount: money(100, 'COP') },
      ]),
    ).toEqual([]);
  });

  it('devuelve el descuadre por moneda', () => {
    expect(
      imbalanceOf([
        { accountId: banco, amount: money(-100, 'COP') },
        { accountId: mercado, amount: money(90, 'COP') },
      ]),
    ).toEqual([money(-10, 'COP')]);
  });

  it('informa de varias monedas descuadradas a la vez', () => {
    expect(
      imbalanceOf([
        { accountId: banco, amount: money(-100, 'COP') },
        { accountId: binance, amount: money(5, 'USDT') },
      ]),
    ).toHaveLength(2);
  });
});

describe('transfer', () => {
  const entrada = {
    id: transactionId('tx-2'),
    owner,
    fecha: '2026-08-20T15:00:00.000Z',
    descripcion: 'Paso a Nequi',
    origen: { fuente: 'manual', referencia: null },
  };

  it('crea una transacción de dos apuntes que cuadra', () => {
    const tx = transfer({ ...entrada, desde: banco, hacia: nequi, amount: money(200000, 'COP') });
    expect(tx.postings).toEqual([
      { accountId: banco, amount: money(-200000, 'COP') },
      { accountId: nequi, amount: money(200000, 'COP') },
    ]);
  });

  it('rechaza un monto negativo: la dirección la marcan desde y hacia', () => {
    expect(() =>
      transfer({ ...entrada, desde: banco, hacia: nequi, amount: money(-100, 'COP') }),
    ).toThrow(/positivo/i);
  });

  it('rechaza un monto cero', () => {
    expect(() =>
      transfer({ ...entrada, desde: banco, hacia: nequi, amount: money(0, 'COP') }),
    ).toThrow(/positivo/i);
  });

  it('rechaza transferir una cuenta a sí misma', () => {
    expect(() =>
      transfer({ ...entrada, desde: banco, hacia: banco, amount: money(100, 'COP') }),
    ).toThrow(/misma cuenta/i);
  });
});
