import { accountId, ownerId } from '@/domain/ledger/ids';
import { systemAccountId } from '@/domain/ledger/system-accounts';
import { imbalanceOf } from '@/domain/ledger/transaction';
import { mustExist } from '@/test/must-exist';

import { ingestedTransactionId, SIN_DESCRIPCION, toLedgerTransaction } from './to-transaction';

const owner = ownerId('david');
const ahorros = accountId('bancolombia:ahorros');

const compra = {
  fecha: '2026/08/28',
  descripcion: 'COMPRA EXITO SUR',
  monto: 45000,
  moneda: 'COP' as const,
  tipo: 'debito' as const,
  fuente: 'bancolombia' as const,
  referencia: 'REF-1',
};

const abono = {
  ...compra,
  descripcion: 'ABONO NOMINA',
  monto: 3200000,
  tipo: 'credito' as const,
  referencia: 'REF-2',
};

describe('ingestedTransactionId', () => {
  it('es determinista: misma fuente y referencia, mismo id', () => {
    expect(ingestedTransactionId('bancolombia', 'REF-1')).toBe('bancolombia:REF-1');
    expect(ingestedTransactionId('bancolombia', 'REF-1')).toBe(
      ingestedTransactionId('bancolombia', 'REF-1'),
    );
  });

  it('rechaza una referencia vacía: sin ella no hay idempotencia posible', () => {
    expect(() => ingestedTransactionId('bancolombia', '')).toThrow(/referencia/);
    expect(() => ingestedTransactionId('bancolombia', '   ')).toThrow(/referencia/);
  });
});

describe('toLedgerTransaction', () => {
  const ctx = { owner, assetAccountId: ahorros, id: ingestedTransactionId('bancolombia', 'REF-1') };

  it('una compra saca dinero del activo y lo lleva a gastos sin clasificar', () => {
    const tx = toLedgerTransaction(compra, ctx);

    const activo = mustExist(tx.postings.find((p) => p.accountId === ahorros));
    const gasto = mustExist(
      tx.postings.find((p) => p.accountId === systemAccountId('gastos-sin-clasificar')),
    );
    expect(activo.amount.amount).toBe(-45000n);
    expect(gasto.amount.amount).toBe(45000n);
  });

  it('un abono mete dinero al activo desde ingresos sin clasificar', () => {
    const tx = toLedgerTransaction(abono, {
      ...ctx,
      id: ingestedTransactionId('bancolombia', 'REF-2'),
    });

    const activo = mustExist(tx.postings.find((p) => p.accountId === ahorros));
    const ingreso = mustExist(
      tx.postings.find((p) => p.accountId === systemAccountId('ingresos-sin-clasificar')),
    );
    expect(activo.amount.amount).toBe(3200000n);
    expect(ingreso.amount.amount).toBe(-3200000n);
  });

  it('siempre cuadra: la invariante la garantiza el constructor', () => {
    expect(imbalanceOf(toLedgerTransaction(compra, ctx).postings)).toEqual([]);
  });

  it('convierte la fecha del portal a ISO en hora de Colombia', () => {
    expect(toLedgerTransaction(compra, ctx).fecha).toBe('2026-08-28T00:00:00.000-05:00');
  });

  it('acepta una fecha que ya venga en ISO', () => {
    const tx = toLedgerTransaction({ ...compra, fecha: '2026-08-28T10:30:00.000-05:00' }, ctx);
    expect(tx.fecha).toBe('2026-08-28T10:30:00.000-05:00');
  });

  it('conserva la descripción cruda y el origen', () => {
    const tx = toLedgerTransaction(compra, ctx);
    expect(tx.descripcion).toBe('COMPRA EXITO SUR');
    expect(tx.origen).toEqual({ fuente: 'bancolombia', referencia: 'REF-1' });
    expect(tx.owner).toBe(owner);
    expect(tx.id).toBe('bancolombia:REF-1');
  });

  it('una descripción en blanco no tumba el movimiento: deja constancia', () => {
    // Lo encontró fast-check: el banco puede mandar la descripción vacía y
    // rechazarla habría reventado el lote entero por un movimiento.
    expect(toLedgerTransaction({ ...compra, descripcion: '   ' }, ctx).descripcion).toBe(
      SIN_DESCRIPCION,
    );
  });

  it('rechaza un monto cero: no hay movimiento que registrar', () => {
    expect(() => toLedgerTransaction({ ...compra, monto: 0 }, ctx)).toThrow(/monto/i);
  });
});
