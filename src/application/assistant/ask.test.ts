import { categoryAccountId } from '@/domain/categorization/taxonomy';
import { createAccount } from '@/domain/ledger/account';
import { accountId, ownerId, transactionId } from '@/domain/ledger/ids';
import { createTransaction } from '@/domain/ledger/transaction';
import { money } from '@/domain/money/money';
import { snapshot } from '@/domain/overview/snapshot';
import { createFakeServerClient } from '@/test/fakes/fake-server-client';
import { createInMemoryAccountRepository } from '@/test/fakes/in-memory-account-repository';
import { createInMemoryIngestRepository } from '@/test/fakes/in-memory-ingest-repository';
import { createInMemoryRateRepository } from '@/test/fakes/in-memory-rate-repository';
import { createInMemoryReconciliationRepository } from '@/test/fakes/in-memory-reconciliation-repository';
import { createInMemorySnapshotRepository } from '@/test/fakes/in-memory-snapshot-repository';
import { createInMemoryTransactionRepository } from '@/test/fakes/in-memory-transaction-repository';

import { ensureSystemAccounts } from '../ledger/ensure-system-accounts';

import { armarResumen, ask, type AskDeps } from './ask';

const owner = ownerId('david');
const banco = accountId('bancolombia:ahorros');
const tarjeta = accountId('rappicard:tarjeta');
const COP = 'COP' as const;
const HOY = '2026-09-15T10:00:00.000-05:00';

async function deps() {
  const accounts = createInMemoryAccountRepository();
  const transactions = createInMemoryTransactionRepository(accounts.postings);
  await ensureSystemAccounts(accounts, owner);
  await accounts.save(
    createAccount({ id: banco, owner, kind: 'activo', nombre: 'Bancolombia', currency: COP }),
  );
  await accounts.save(
    createAccount({ id: tarjeta, owner, kind: 'pasivo', nombre: 'RappiCard', currency: COP }),
  );
  for (const slug of ['salario', 'mercado']) {
    await accounts.save(
      createAccount({
        id: categoryAccountId(slug),
        owner,
        kind: slug === 'salario' ? 'ingreso' : 'gasto',
        nombre: slug,
        currency: COP,
      }),
    );
  }

  const servidor = createFakeServerClient([]);
  const d: AskDeps = {
    accounts,
    transactions,
    ingest: createInMemoryIngestRepository(),
    reconciliations: createInMemoryReconciliationRepository(),
    rates: createInMemoryRateRepository(),
    snapshots: createInMemorySnapshotRepository(),
    servidor,
    clock: () => HOY,
  };
  return { ...d, accounts, transactions, servidor };
}

type Deps = Awaited<ReturnType<typeof deps>>;

const gastar = (d: Deps, id: string, monto: bigint, fecha: string, slug = 'mercado') =>
  d.transactions.save(
    createTransaction({
      id: transactionId(id),
      owner,
      fecha,
      // Una descripción con un comercio de verdad: si algo de esto sale del
      // teléfono, la prueba de abajo lo ve.
      descripcion: 'COMPRA RAPPI*BURGER 4512',
      origen: { fuente: 'manual', referencia: 'REF-99887766' },
      postings: [
        { accountId: banco, amount: money(-monto, COP) },
        { accountId: categoryAccountId(slug), amount: money(monto, COP) },
      ],
    }),
  );

const cobrar = (d: Deps, id: string, monto: bigint, fecha: string) =>
  d.transactions.save(
    createTransaction({
      id: transactionId(id),
      owner,
      fecha,
      descripcion: 'PAGO NOMINA',
      origen: { fuente: 'manual', referencia: null },
      postings: [
        { accountId: banco, amount: money(monto, COP) },
        { accountId: categoryAccountId('salario'), amount: money(-monto, COP) },
      ],
    }),
  );

describe('armarResumen', () => {
  /**
   * La prueba que sostiene la decisión de David: del teléfono solo salen
   * cifras agregadas. Se comprueba sobre el objeto que de verdad se enviaría,
   * no sobre la función pura del dominio.
   */
  it('ni el comercio, ni la referencia, ni la fecha del movimiento salen', async () => {
    const d = await deps();
    await cobrar(d, 't1', 3_000_000n, '2026-09-01');
    await gastar(d, 't2', 620_000n, '2026-09-10');

    const serializado = JSON.stringify(await armarResumen(d, { owner }));

    expect(serializado).not.toMatch(/RAPPI/i);
    expect(serializado).not.toMatch(/REF-99887766/);
    expect(serializado).not.toMatch(/\d{4}-\d{2}-\d{2}/);
    expect(serializado).not.toMatch(/bancolombia/i);
  });

  it('lleva el gasto del mes por categoría, con el slug de la taxonomía', async () => {
    const d = await deps();
    await gastar(d, 't1', 620_000n, '2026-09-10');

    expect((await armarResumen(d, { owner })).gastoPorCategoria).toEqual({ mercado: 620_000 });
  });

  /** El pasivo vive en negativo en el ledger; «debo -1.897.917» no lo lee nadie. */
  it('la deuda va en positivo y el saldo aparte', async () => {
    const d = await deps();
    await cobrar(d, 't1', 3_000_000n, '2026-09-01');
    await d.transactions.save(
      createTransaction({
        id: transactionId('t2'),
        owner,
        fecha: '2026-09-05',
        descripcion: 'COMPRA',
        origen: { fuente: 'manual', referencia: null },
        postings: [
          { accountId: tarjeta, amount: money(-500_000n, COP) },
          { accountId: categoryAccountId('mercado'), amount: money(500_000n, COP) },
        ],
      }),
    );

    const resumen = await armarResumen(d, { owner });

    expect(resumen.saldoTotal).toBe(3_000_000);
    expect(resumen.deudaTotal).toBe(500_000);
    expect(resumen.patrimonio).toBe(2_500_000);
  });

  /** Sin instantánea de hace un mes va `null`: cero diría «no tenías nada». */
  it('sin histórico, el patrimonio de hace 30 días va null', async () => {
    const d = await deps();

    expect((await armarResumen(d, { owner })).patrimonioHace30Dias).toBeNull();
  });

  it('con histórico, usa el valor ya calculado de entonces', async () => {
    const d = await deps();
    await d.snapshots.guardar(
      snapshot({
        owner,
        dia: '2026-08-16',
        patrimonio: money(2_100_000n, COP),
        tasas: 'TRM oficial',
        tomadaEn: '2026-08-16T10:00:00.000-05:00',
      }),
    );

    expect((await armarResumen(d, { owner })).patrimonioHace30Dias).toBe(2_100_000);
  });

  /** Sin meses suficientes no hay métrica, y no se inventa un cero. */
  it('lo que no se pudo calcular va null', async () => {
    const d = await deps();

    const resumen = await armarResumen(d, { owner });

    expect(resumen.tasaDeAhorroPct).toBeNull();
    expect(resumen.ingresoMensual).toBeNull();
  });

  it('los montos van en pesos enteros', async () => {
    const d = await deps();
    await gastar(d, 't1', 620_000n, '2026-09-10');

    for (const valor of Object.values((await armarResumen(d, { owner })).gastoPorCategoria)) {
      expect(Number.isInteger(valor)).toBe(true);
    }
  });
});

describe('ask', () => {
  it('lo que se envía es exactamente el resumen publicable', async () => {
    const d = await deps();
    await gastar(d, 't1', 620_000n, '2026-09-10');

    const { enviado } = await ask(d, { owner, pregunta: '¿me alcanza para el viaje?' });

    expect(d.servidor.preguntado()).toEqual([
      { resumen: enviado, pregunta: '¿me alcanza para el viaje?' },
    ]);
  });

  it('devuelve qué cifras dijo haber usado', async () => {
    const d = await deps();

    const { resultado } = await ask(d, { owner, pregunta: 'hola' });

    expect(resultado.estado).toBe('ok');
    if (resultado.estado !== 'ok') throw new Error('debería haber respondido');
    expect(resultado.respuesta.cifrasUsadas).toEqual(['saldoTotal']);
  });

  /** Cuatro estados y ninguna excepción: el llamador tiene que decidir. */
  it('sin clave en el servidor lo dice, y no se rompe', async () => {
    const d = await deps();
    d.servidor.asistenteResponde({ estado: 'sin-configurar' });

    const { resultado } = await ask(d, { owner, pregunta: 'hola' });

    expect(resultado).toEqual({ estado: 'sin-configurar' });
  });

  it('el tope diario llega como estado, no como error', async () => {
    const d = await deps();
    d.servidor.asistenteResponde({ estado: 'tope-diario' });

    await expect(ask(d, { owner, pregunta: 'hola' })).resolves.toMatchObject({
      resultado: { estado: 'tope-diario' },
    });
  });
});
