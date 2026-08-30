import { assert, asyncProperty, integer, record, string, uniqueArray } from 'fast-check';

import type { Capture } from '@/domain/capture/reassembler';
import { ownerId } from '@/domain/ledger/ids';
import { sourceAccountId, systemAccountId } from '@/domain/ledger/system-accounts';
import { createInMemoryAccountRepository } from '@/test/fakes/in-memory-account-repository';
import { createInMemoryIngestRepository } from '@/test/fakes/in-memory-ingest-repository';
import { createInMemoryTransactionRepository } from '@/test/fakes/in-memory-transaction-repository';
import { createInMemoryTransferRepository } from '@/test/fakes/in-memory-transfer-repository';
import { createSequentialIds } from '@/test/fakes/sequential-ids';
import { mustExist } from '@/test/must-exist';

import { ingestCaptures, type IngestDeps } from './ingest-captures';

const owner = ownerId('david');

interface Movimiento {
  fecha: string;
  descripcion: string;
  monto: number;
  tipo: 'CREDITO' | 'DEBITO';
  referencia: string;
}

let contadorCapturas = 0;

/** Una captura con la forma real del endpoint de movimientos de Bancolombia. */
function capturaBancolombia(movimientos: Movimiento[]): Capture {
  contadorCapturas += 1;
  return {
    id: `c-${String(contadorCapturas)}`,
    url: 'https://canalpersonas-ext.apps.bancolombia.com/super-svp/api/v1/security-filters/ch-ms-deposits/account/transactions',
    method: 'POST',
    status: 200,
    contentType: 'application/json',
    kind: 'fetch',
    capturedAt: '2026-08-28T10:00:00.000-05:00',
    body: JSON.stringify({
      data: {
        transactions: movimientos.map((m) => ({
          transactionDate: m.fecha,
          description: m.descripcion,
          amount: m.tipo === 'CREDITO' ? -m.monto : m.monto,
          type: m.tipo,
          reference1: m.referencia,
        })),
      },
      meta: { pages: 1 },
    }),
  };
}

/** El reloj por defecto cae en el día del movimiento más antiguo de las fixtures. */
function deps(clock: string | (() => string) = '2026-08-27T10:00:00.000-05:00') {
  const accounts = createInMemoryAccountRepository();
  const transactions = createInMemoryTransactionRepository(accounts.postings);
  const ingest = createInMemoryIngestRepository();
  const d: IngestDeps = {
    accounts,
    transactions,
    ingest,
    transfers: createInMemoryTransferRepository(),
    ids: createSequentialIds('run'),
    clock: typeof clock === 'string' ? () => clock : clock,
  };
  return { ...d, accounts, transactions, ingest };
}

const compra: Movimiento = {
  fecha: '2026/08/28',
  descripcion: 'COMPRA EXITO SUR',
  monto: 45000,
  tipo: 'CREDITO',
  referencia: 'REF-1',
};
const nomina: Movimiento = {
  fecha: '2026/08/27',
  descripcion: 'ABONO NOMINA',
  monto: 3200000,
  tipo: 'DEBITO',
  referencia: 'REF-2',
};

describe('ingestCaptures', () => {
  it('convierte las capturas en transacciones del ledger', async () => {
    const d = deps();

    const resumen = await ingestCaptures(d, {
      owner,
      portalId: 'bancolombia',
      captures: [capturaBancolombia([compra, nomina])],
    });

    expect(resumen).toMatchObject({ capturas: 1, extraidas: 2, nuevas: 2, duplicadas: 0 });
    expect(d.transactions.all()).toHaveLength(2);
  });

  it('crea las cuentas del sistema y la de la fuente antes de guardar', async () => {
    const d = deps();
    await ingestCaptures(d, {
      owner,
      portalId: 'bancolombia',
      captures: [capturaBancolombia([compra])],
    });

    const ids = d.accounts.all().map((c) => c.id);
    expect(ids).toContain(systemAccountId('gastos-sin-clasificar'));
    expect(ids).toContain(sourceAccountId('bancolombia'));
  });

  it('el saldo de la cuenta refleja lo ingerido', async () => {
    const d = deps();
    await ingestCaptures(d, {
      owner,
      portalId: 'bancolombia',
      captures: [capturaBancolombia([compra, nomina])],
    });

    expect((await d.accounts.balanceOf(sourceAccountId('bancolombia'))).amount).toBe(
      3200000n - 45000n,
    );
  });

  it('es idempotente: la misma captura dos veces no crea nada la segunda', async () => {
    const d = deps();
    const captura = capturaBancolombia([compra, nomina]);

    await ingestCaptures(d, { owner, portalId: 'bancolombia', captures: [captura] });
    const segunda = await ingestCaptures(d, {
      owner,
      portalId: 'bancolombia',
      captures: [captura],
    });

    expect(segunda).toMatchObject({ extraidas: 2, nuevas: 0, duplicadas: 2 });
    expect(d.transactions.all()).toHaveLength(2);
    expect(d.ingest.observations()).toHaveLength(2);
  });

  it('la misma transacción en dos capturas de la misma corrida entra una vez', async () => {
    // Las páginas del portal se solapan: la última fila de una página es la
    // primera de la siguiente.
    const d = deps();
    const resumen = await ingestCaptures(d, {
      owner,
      portalId: 'bancolombia',
      captures: [capturaBancolombia([compra, nomina]), capturaBancolombia([nomina])],
    });

    expect(resumen).toMatchObject({ extraidas: 3, nuevas: 2, duplicadas: 1 });
  });

  it('deja una observación por transacción, con el crudo y la corrida', async () => {
    const d = deps();
    const resumen = await ingestCaptures(d, {
      owner,
      portalId: 'bancolombia',
      captures: [capturaBancolombia([compra])],
    });

    const obs = mustExist(d.ingest.observations()[0]);
    expect(obs.transactionId).toBe('bancolombia:REF-1');
    expect(obs.fuente).toBe('bancolombia');
    expect(obs.referencia).toBe('REF-1');
    expect(obs.runId).toBe(resumen.runId);
    expect(obs.crudo.descripcion).toBe('COMPRA EXITO SUR');
    expect(obs.huella).toBe('2026-08-28|45000|exito sur');
  });

  it('registra la corrida con sus cuentas y la cierra', async () => {
    const d = deps();
    const resumen = await ingestCaptures(d, {
      owner,
      portalId: 'bancolombia',
      captures: [capturaBancolombia([compra, nomina])],
    });

    const corrida = mustExist(await d.ingest.findLastRun(owner, 'bancolombia'));
    expect(corrida.id).toBe(resumen.runId);
    expect(corrida).toMatchObject({
      capturas: 1,
      extraidas: 2,
      nuevas: 2,
      duplicadas: 0,
      error: null,
    });
    expect(corrida.terminadoEn).not.toBeNull();
  });

  it('ignora las capturas que no son del endpoint de movimientos', async () => {
    const d = deps();
    const ruido: Capture = {
      ...capturaBancolombia([compra]),
      url: 'https://www.bancolombia.com/otra-cosa',
      body: '{"data":{"x":1}}',
    };

    const resumen = await ingestCaptures(d, { owner, portalId: 'bancolombia', captures: [ruido] });

    expect(resumen).toMatchObject({ capturas: 1, extraidas: 0, nuevas: 0 });
  });

  it('un movimiento sin referencia recibe una derivada y entra una sola vez aunque se reprocese', async () => {
    const d = deps();
    const sinRef = capturaBancolombia([{ ...compra, referencia: '' }]);

    const primera = await ingestCaptures(d, { owner, portalId: 'bancolombia', captures: [sinRef] });
    const segunda = await ingestCaptures(d, { owner, portalId: 'bancolombia', captures: [sinRef] });

    expect(primera).toMatchObject({ extraidas: 1, nuevas: 1 });
    expect(segunda).toMatchObject({ extraidas: 1, nuevas: 0, duplicadas: 1 });
    expect(d.transactions.all()).toHaveLength(1);
    expect(d.ingest.observations()[0]?.referencia).toMatch(/^h:/);
  });

  it('los movimientos anteriores al día de la primera sincronización no entran', async () => {
    const d = deps('2026-08-28T10:00:00.000-05:00');
    const resumen = await ingestCaptures(d, {
      owner,
      portalId: 'bancolombia',
      captures: [capturaBancolombia([compra, nomina])],
    });

    // La nómina es del 27; la compra, del 28: solo la compra cuenta.
    expect(resumen).toMatchObject({ extraidas: 2, nuevas: 1, anteriores: 1, desde: '2026-08-28' });
    expect(d.transactions.all()).toHaveLength(1);
    expect(d.ingest.observations()).toHaveLength(1);
    expect(mustExist(await d.ingest.findLastRun(owner, 'bancolombia')).anteriores).toBe(1);
  });

  it('el inicio es el día de la primera corrida, aunque el reloj avance', async () => {
    let ahora = '2026-08-28T10:00:00.000-05:00';
    const d = deps(() => ahora);
    await ingestCaptures(d, {
      owner,
      portalId: 'bancolombia',
      captures: [capturaBancolombia([compra])],
    });

    ahora = '2026-09-15T10:00:00.000-05:00';
    const segunda = await ingestCaptures(d, {
      owner,
      portalId: 'bancolombia',
      captures: [
        capturaBancolombia([{ ...compra, fecha: '2026/09/01', referencia: 'REF-9' }, nomina]),
      ],
    });

    expect(segunda).toMatchObject({ nuevas: 1, anteriores: 1, desde: '2026-08-28' });
  });

  it('para un portal sin extractor falla antes de tocar nada', async () => {
    const d = deps();
    await expect(ingestCaptures(d, { owner, portalId: 'nequi', captures: [] })).rejects.toThrow(
      /nequi/,
    );
    expect(d.ingest.runs()).toEqual([]);
  });

  it('si algo revienta a mitad, la corrida queda cerrada con el error y lo ya guardado se conserva', async () => {
    const d = deps();
    let llamadas = 0;
    const original = d.transactions.save;
    d.transactions.save = (tx) => {
      llamadas += 1;
      return llamadas === 2 ? Promise.reject(new Error('disco lleno')) : original(tx);
    };

    await expect(
      ingestCaptures(d, {
        owner,
        portalId: 'bancolombia',
        captures: [capturaBancolombia([compra, nomina])],
      }),
    ).rejects.toThrow('disco lleno');

    const corrida = mustExist(await d.ingest.findLastRun(owner, 'bancolombia'));
    expect(corrida.error).toBe('disco lleno');
    expect(corrida.terminadoEn).not.toBeNull();
    expect(corrida.nuevas).toBe(1);
  });

  it('propiedad: reprocesar cualquier lote es idempotente y el ledger cuadra', async () => {
    const movimiento = record({
      fecha: integer({ min: 1, max: 28 }).map((d) => `2026/08/${String(d).padStart(2, '0')}`),
      descripcion: string({ minLength: 1, maxLength: 20 }),
      monto: integer({ min: 1, max: 5_000_000 }),
      tipo: integer({ min: 0, max: 1 }).map((n) =>
        n === 0 ? ('CREDITO' as const) : ('DEBITO' as const),
      ),
      referencia: string({ minLength: 1, maxLength: 12 }).filter((r) => r.trim().length > 0),
    });

    await assert(
      asyncProperty(
        uniqueArray(movimiento, { minLength: 1, maxLength: 30, selector: (m) => m.referencia }),
        async (lote) => {
          const d = deps('2026-08-01T00:00:00.000-05:00');
          const primera = await ingestCaptures(d, {
            owner,
            portalId: 'bancolombia',
            captures: [capturaBancolombia(lote)],
          });
          const segunda = await ingestCaptures(d, {
            owner,
            portalId: 'bancolombia',
            captures: [capturaBancolombia(lote)],
          });

          expect(primera.nuevas).toBe(lote.length);
          expect(segunda.nuevas).toBe(0);
          expect(d.transactions.all()).toHaveLength(lote.length);

          const saldos = await Promise.all(d.accounts.all().map((c) => d.accounts.balanceOf(c.id)));
          expect(saldos.reduce((acc, s) => acc + s.amount, 0n)).toBe(0n);
        },
      ),
      { numRuns: 80 },
    );
  });
});
