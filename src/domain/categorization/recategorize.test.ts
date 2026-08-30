import { assert, bigInt, property } from 'fast-check';

import { createAccount, type Account } from '@/domain/ledger/account';
import { accountId, ownerId, transactionId, type AccountId } from '@/domain/ledger/ids';
import { systemAccountId } from '@/domain/ledger/system-accounts';
import { createTransaction, imbalanceOf } from '@/domain/ledger/transaction';
import { money } from '@/domain/money/money';

import type { Category } from './category';
import {
  counterpartOf,
  NotCategorizableError,
  withCategory,
  withoutCategory,
} from './recategorize';
import { categoryAccountId } from './taxonomy';

const owner = ownerId('david');
const ahorros = accountId('bancolombia:ahorros');
const efectivo = systemAccountId('efectivo');
const sinClasificar = systemAccountId('gastos-sin-clasificar');
const ingresosSinClasificar = systemAccountId('ingresos-sin-clasificar');

const cuenta = (id: AccountId, kind: Account['kind'], nombre: string): [AccountId, Account] => [
  id,
  createAccount({ id, owner, kind, nombre, currency: 'COP' }),
];
const cuentas = new Map<AccountId, Account>([
  cuenta(ahorros, 'activo', 'Bancolombia'),
  cuenta(efectivo, 'activo', 'Efectivo'),
  cuenta(sinClasificar, 'gasto', 'Sin clasificar'),
  cuenta(ingresosSinClasificar, 'ingreso', 'Ingresos sin clasificar'),
  cuenta(categoryAccountId('mercado'), 'gasto', 'Mercado'),
]);

const mercado: Category = {
  id: categoryAccountId('mercado'),
  owner,
  kind: 'gasto',
  nombre: 'Mercado',
  grupo: 'comida',
  icono: 'cart',
  orden: 1,
  archivedAt: null,
};

const compra = (monto = 45000) =>
  createTransaction({
    id: transactionId('bancolombia:C1'),
    owner,
    fecha: '2026-08-30T00:00:00.000-05:00',
    descripcion: 'COMPRA EXITO',
    origen: { fuente: 'bancolombia', referencia: 'C1' },
    postings: [
      { accountId: ahorros, amount: money(-monto, 'COP') },
      { accountId: sinClasificar, amount: money(monto, 'COP') },
    ],
  });
const retiro = () =>
  createTransaction({
    ...compra(),
    postings: [
      { accountId: ahorros, amount: money(-40000, 'COP') },
      { accountId: efectivo, amount: money(40000, 'COP') },
    ],
  });

describe('counterpartOf', () => {
  it('es el apunte que no es de cuenta real', () => {
    expect(counterpartOf(compra(), cuentas)?.accountId).toBe(sinClasificar);
  });

  it('una transferencia no tiene contrapartida', () => {
    expect(counterpartOf(retiro(), cuentas)).toBeNull();
  });

  it('un reparto de tres apuntes no se clasifica aquí', () => {
    const t = createTransaction({
      ...compra(),
      postings: [
        { accountId: ahorros, amount: money(-45000, 'COP') },
        { accountId: sinClasificar, amount: money(20000, 'COP') },
        { accountId: sinClasificar, amount: money(25000, 'COP') },
      ],
    });
    expect(counterpartOf(t, cuentas)).toBeNull();
  });

  it('con una cuenta desconocida no se atreve', () => {
    expect(counterpartOf(compra(), new Map([cuenta(ahorros, 'activo', 'Bancolombia')]))).toBeNull();
  });
});

describe('withCategory', () => {
  it('mueve la contrapartida a la categoría y todo lo demás queda igual', () => {
    const t = withCategory(compra(), cuentas, mercado);
    expect(t.postings).toEqual([
      { accountId: ahorros, amount: money(-45000, 'COP') },
      { accountId: mercado.id, amount: money(45000, 'COP') },
    ]);
    expect(t.id).toBe('bancolombia:C1');
    expect(t.descripcion).toBe('COMPRA EXITO');
  });

  it('rechaza una transferencia', () => {
    expect(() => withCategory(retiro(), cuentas, mercado)).toThrow(NotCategorizableError);
  });

  it('rechaza una categoría archivada', () => {
    expect(() =>
      withCategory(compra(), cuentas, { ...mercado, archivedAt: '2026-08-01T00:00:00.000Z' }),
    ).toThrow(/archivada/);
  });

  it('propiedad: el resultado siempre cuadra y conserva el apunte real', () => {
    assert(
      property(bigInt({ min: 1n, max: 10_000_000n }), (monto) => {
        const t = withCategory(compra(Number(monto)), cuentas, mercado);
        return (
          imbalanceOf(t.postings).length === 0 &&
          t.postings[0]?.accountId === ahorros &&
          t.postings[0].amount.amount === -monto
        );
      }),
    );
  });
});

describe('withoutCategory', () => {
  it('devuelve la contrapartida a sin clasificar según el signo', () => {
    const clasificada = withCategory(compra(), cuentas, mercado);
    expect(withoutCategory(clasificada, cuentas).postings[1]?.accountId).toBe(sinClasificar);

    const abono = createTransaction({
      ...compra(),
      postings: [
        { accountId: ahorros, amount: money(50000, 'COP') },
        { accountId: mercado.id, amount: money(-50000, 'COP') },
      ],
    });
    expect(withoutCategory(abono, cuentas).postings[1]?.accountId).toBe(ingresosSinClasificar);
  });
});
