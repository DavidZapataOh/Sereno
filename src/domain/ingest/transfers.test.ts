import { array, assert, integer, property, record } from 'fast-check';

import { accountId, ownerId, transactionId } from '@/domain/ledger/ids';
import { systemAccountId } from '@/domain/ledger/system-accounts';
import { createTransaction, imbalanceOf, type Transaction } from '@/domain/ledger/transaction';
import { money } from '@/domain/money/money';
import { mustExist } from '@/test/must-exist';

import { findTransferPairs, mergeAsTransfer, pairKey, transferCandidateOf } from './transfers';

const owner = ownerId('david');
const banco = accountId('bancolombia:ahorros');
const nequi = accountId('nequi:principal');
const gastos = systemAccountId('gastos-sin-clasificar');
const ingresos = systemAccountId('ingresos-sin-clasificar');

const dia = (d: number) => `2026-08-${String(d).padStart(2, '0')}T00:00:00.000-05:00`;

/** Dinero que sale de `cuenta` hacia gastos sin clasificar. */
const salida = (id: string, cuenta = banco, monto = 200000, d = 10): Transaction =>
  createTransaction({
    id: transactionId(id),
    owner,
    fecha: dia(d),
    descripcion: `TRANSFERENCIA A ${id}`,
    origen: { fuente: 'bancolombia', referencia: id },
    postings: [
      { accountId: cuenta, amount: money(-monto, 'COP') },
      { accountId: gastos, amount: money(monto, 'COP') },
    ],
  });

/** Dinero que entra a `cuenta` desde ingresos sin clasificar. */
const entrada = (id: string, cuenta = nequi, monto = 200000, d = 11): Transaction =>
  createTransaction({
    id: transactionId(id),
    owner,
    fecha: dia(d),
    descripcion: `RECIBIDO ${id}`,
    origen: { fuente: 'nequi', referencia: id },
    postings: [
      { accountId: cuenta, amount: money(monto, 'COP') },
      { accountId: ingresos, amount: money(-monto, 'COP') },
    ],
  });

describe('transferCandidateOf', () => {
  it('reconoce una salida hacia sin clasificar', () => {
    const c = mustExist(transferCandidateOf(salida('s')));
    expect(c.asset).toBe(banco);
    expect(c.amount.amount).toBe(-200000n);
  });

  it('reconoce una entrada desde sin clasificar', () => {
    expect(mustExist(transferCandidateOf(entrada('e'))).amount.amount).toBe(200000n);
  });

  it('descarta lo que ya es una transferencia entre activos', () => {
    const ya = mergeAsTransfer({ salida: salida('s'), entrada: entrada('e') });
    expect(transferCandidateOf(ya)).toBeNull();
  });

  it('descarta transacciones con más de dos apuntes o ya clasificadas', () => {
    const clasificada = createTransaction({
      ...salida('s'),
      postings: [
        { accountId: banco, amount: money(-1000, 'COP') },
        { accountId: accountId('categoria:mercado'), amount: money(1000, 'COP') },
      ],
    });
    expect(transferCandidateOf(clasificada)).toBeNull();
  });
});

describe('findTransferPairs', () => {
  const sin = new Set<string>();

  it('empareja una salida con una entrada de igual monto en otra cuenta dentro de la ventana', () => {
    const pares = findTransferPairs([salida('s'), entrada('e')], { ventanaDias: 5, excluir: sin });
    expect(pares).toHaveLength(1);
    expect(pares[0]?.salida.id).toBe('s');
    expect(pares[0]?.entrada.id).toBe('e');
  });

  it('no empareja fuera de la ventana', () => {
    expect(
      findTransferPairs([salida('s', banco, 200000, 1), entrada('e', nequi, 200000, 10)], {
        ventanaDias: 5,
        excluir: sin,
      }),
    ).toEqual([]);
  });

  it('no empareja montos distintos', () => {
    expect(
      findTransferPairs([salida('s', banco, 200000), entrada('e', nequi, 200001)], {
        ventanaDias: 5,
        excluir: sin,
      }),
    ).toEqual([]);
  });

  it('no empareja dos movimientos de la misma cuenta', () => {
    // Un retiro y un abono en la misma cuenta no son una transferencia interna.
    expect(
      findTransferPairs([salida('s', banco), entrada('e', banco)], {
        ventanaDias: 5,
        excluir: sin,
      }),
    ).toEqual([]);
  });

  it('cada transacción se usa como máximo una vez, y gana la más cercana en fecha', () => {
    const pares = findTransferPairs(
      [
        salida('s', banco, 200000, 10),
        entrada('lejos', nequi, 200000, 14),
        entrada('cerca', nequi, 200000, 11),
      ],
      { ventanaDias: 5, excluir: sin },
    );
    expect(pares).toHaveLength(1);
    expect(pares[0]?.entrada.id).toBe('cerca');
  });

  it('acepta que la entrada se asiente antes que la salida', () => {
    const pares = findTransferPairs(
      [salida('s', banco, 200000, 12), entrada('e', nequi, 200000, 10)],
      { ventanaDias: 5, excluir: sin },
    );
    expect(pares).toHaveLength(1);
  });

  it('respeta los pares que el usuario deshizo', () => {
    const excluir = new Set([pairKey(transactionId('s'), transactionId('e'))]);
    expect(findTransferPairs([salida('s'), entrada('e')], { ventanaDias: 5, excluir })).toEqual([]);
  });

  it('el 4x1000 no se confunde con una transferencia', () => {
    // La salida de 200.000 y el impuesto de 800 tienen montos distintos: no hay par.
    const gmf = salida('gmf', banco, 800, 10);
    expect(
      findTransferPairs([salida('s'), gmf, entrada('e')], { ventanaDias: 5, excluir: sin }),
    ).toHaveLength(1);
  });

  it('propiedad: ninguna transacción aparece en dos pares', () => {
    const mov = record({
      cuenta: integer({ min: 0, max: 1 }),
      monto: integer({ min: 1, max: 5 }),
      dia: integer({ min: 1, max: 20 }),
      sale: integer({ min: 0, max: 1 }),
    });
    assert(
      property(array(mov, { maxLength: 25 }), (lote) => {
        const txs = lote.map((m, i) =>
          m.sale === 1
            ? salida(`t${String(i)}`, m.cuenta === 0 ? banco : nequi, m.monto * 1000, m.dia)
            : entrada(`t${String(i)}`, m.cuenta === 0 ? banco : nequi, m.monto * 1000, m.dia),
        );
        const pares = findTransferPairs(txs, { ventanaDias: 5, excluir: sin });
        const usadas = pares.flatMap((p) => [p.salida.id, p.entrada.id]);
        expect(new Set(usadas).size).toBe(usadas.length);
        pares.forEach((p) => {
          expect(imbalanceOf(mergeAsTransfer(p).postings)).toEqual([]);
        });
      }),
    );
  });
});

describe('mergeAsTransfer', () => {
  it('produce una transacción entre los dos activos, sin gastos ni ingresos', () => {
    const fundida = mergeAsTransfer({ salida: salida('s'), entrada: entrada('e') });

    expect(fundida.id).toBe('s');
    expect(fundida.fecha).toBe(dia(10));
    expect(fundida.postings).toHaveLength(2);
    expect(fundida.postings.find((p) => p.accountId === banco)?.amount.amount).toBe(-200000n);
    expect(fundida.postings.find((p) => p.accountId === nequi)?.amount.amount).toBe(200000n);
    expect(fundida.postings.some((p) => p.accountId === gastos || p.accountId === ingresos)).toBe(
      false,
    );
    expect(imbalanceOf(fundida.postings)).toEqual([]);
  });

  it('conserva el origen de la salida y describe la transferencia', () => {
    const fundida = mergeAsTransfer({ salida: salida('s'), entrada: entrada('e') });
    expect(fundida.origen).toEqual({ fuente: 'bancolombia', referencia: 's' });
    expect(fundida.descripcion).toMatch(/transferencia/i);
  });

  it('rechaza fundir lo que no es candidato', () => {
    const ya = mergeAsTransfer({ salida: salida('s'), entrada: entrada('e') });
    expect(() => mergeAsTransfer({ salida: ya, entrada: entrada('e2') })).toThrow(/candidatos/);
  });
});
