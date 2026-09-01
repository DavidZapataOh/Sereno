import { categoryAccountId } from '@/domain/categorization/taxonomy';
import { createAccount } from '@/domain/ledger/account';
import { accountId, ownerId, transactionId } from '@/domain/ledger/ids';
import { createTransaction } from '@/domain/ledger/transaction';
import { money } from '@/domain/money/money';
import { createInMemoryAccountRepository } from '@/test/fakes/in-memory-account-repository';
import { createInMemoryAnomalyRepository } from '@/test/fakes/in-memory-anomaly-repository';
import { createInMemoryCategoryRepository } from '@/test/fakes/in-memory-category-repository';
import { createInMemoryClassificationRepository } from '@/test/fakes/in-memory-classification-repository';
import { createInMemoryIngestRepository } from '@/test/fakes/in-memory-ingest-repository';
import { createInMemoryTransactionRepository } from '@/test/fakes/in-memory-transaction-repository';
import { createInMemoryTransferRepository } from '@/test/fakes/in-memory-transfer-repository';

import { ensureSystemAccounts } from '../ledger/ensure-system-accounts';

import { detectAnomalies, type AnomalyDeps } from './detect-anomalies';

const owner = ownerId('david');
const banco = accountId('bancolombia:ahorros');
const COP = 'COP' as const;
const HOY = '2026-09-15T10:00:00.000-05:00';

async function deps() {
  const accounts = createInMemoryAccountRepository();
  const transactions = createInMemoryTransactionRepository(accounts.postings);
  await ensureSystemAccounts(accounts, owner);
  await accounts.save(
    createAccount({ id: banco, owner, kind: 'activo', nombre: 'Bancolombia', currency: COP }),
  );
  for (const slug of ['mercado', 'vivienda', 'restaurantes']) {
    await accounts.save(
      createAccount({
        id: categoryAccountId(slug),
        owner,
        kind: 'gasto',
        nombre: slug,
        currency: COP,
      }),
    );
  }

  const d: AnomalyDeps = {
    accounts,
    transactions,
    ingest: createInMemoryIngestRepository(),
    transfers: createInMemoryTransferRepository(),
    categories: createInMemoryCategoryRepository(),
    classifications: createInMemoryClassificationRepository(),
    clock: () => HOY,
    anomalias: createInMemoryAnomalyRepository(),
  };
  return { ...d, accounts, transactions, anomalias: d.anomalias };
}

/** Un gasto con su comercio y su categoría. */
const gastar = (
  d: Awaited<ReturnType<typeof deps>>,
  id: string,
  descripcion: string,
  categoria: string,
  monto: bigint,
  fecha: string,
) =>
  d.transactions.save(
    createTransaction({
      id: transactionId(id),
      owner,
      fecha,
      descripcion,
      origen: { fuente: 'manual', referencia: null },
      postings: [
        { accountId: banco, amount: money(-monto, COP) },
        { accountId: categoryAccountId(categoria), amount: money(monto, COP) },
      ],
    }),
  );

/** Siete compras normales de mercado, repartidas, para tener mediana. */
async function conHistorialDeMercado(d: Awaited<ReturnType<typeof deps>>) {
  const montos = [50_000, 55_000, 48_000, 52_000, 51_000, 49_000, 53_000];
  for (const [i, monto] of montos.entries()) {
    await gastar(
      d,
      `mercado-${String(i)}`,
      `EXITO SUCURSAL ${String(i)}`,
      'mercado',
      BigInt(monto),
      `2026-0${String(7 + Math.floor(i / 4))}-${String(10 + i).padStart(2, '0')}T10:00:00.000-05:00`,
    );
  }
}

describe('lo que NO puede dispararse', () => {
  /**
   * La lista de falsos positivos conocidos. Cada uno que se cuele es un aviso
   * que enseña a ignorar los demás, así que esta lista solo crece.
   */
  it('el arriendo mensual no es una anomalía, por grande que sea', async () => {
    const d = await deps();
    await conHistorialDeMercado(d);
    // Tres meses de arriendo: recurrente, y muchísimo mayor que un mercado.
    for (const mes of ['07', '08', '09']) {
      await gastar(
        d,
        `arriendo-${mes}`,
        'ARRIENDO APTO',
        'vivienda',
        1_800_000n,
        `2026-${mes}-05T10:00:00.000-05:00`,
      );
    }

    const anomalias = await detectAnomalies(d, { owner });
    expect(anomalias.filter((a) => a.transaccion.includes('arriendo'))).toEqual([]);
  });

  it('una suscripción anual cobrada una vez al año no salta', async () => {
    const d = await deps();
    await conHistorialDeMercado(d);
    await gastar(d, 'anual', 'SEGURO ANUAL', 'vivienda', 900_000n, '2026-09-10T10:00:00.000-05:00');

    // Sin historial en su categoría, no hay mediana contra la que comparar.
    const anomalias = await detectAnomalies(d, { owner });
    expect(anomalias.filter((a) => a.transaccion.includes('anual'))).toEqual([]);
  });

  it('un comercio que aparece por primera vez no es «dormido»', async () => {
    const d = await deps();
    await conHistorialDeMercado(d);
    await gastar(
      d,
      'nuevo',
      'CAFE NUEVO',
      'restaurantes',
      20_000n,
      '2026-09-14T10:00:00.000-05:00',
    );

    const anomalias = await detectAnomalies(d, { owner });
    expect(anomalias.filter((a) => a.tipo === 'comercio-dormido')).toEqual([]);
  });

  it('un gasto normal no genera nada', async () => {
    const d = await deps();
    await conHistorialDeMercado(d);
    await gastar(
      d,
      'normal',
      'EXITO SUCURSAL 9',
      'mercado',
      54_000n,
      '2026-09-14T10:00:00.000-05:00',
    );

    expect(await detectAnomalies(d, { owner })).toEqual([]);
  });

  it('sin historia suficiente no se detecta nada', async () => {
    const d = await deps();
    await gastar(d, 'solo', 'EXITO', 'mercado', 900_000n, '2026-09-14T10:00:00.000-05:00');

    expect(await detectAnomalies(d, { owner })).toEqual([]);
  });

  it('un cobro viejo no se avisa: ya no se puede hacer nada', async () => {
    const d = await deps();
    await conHistorialDeMercado(d);
    await gastar(d, 'viejo', 'EXITO RARO', 'mercado', 900_000n, '2026-06-01T10:00:00.000-05:00');

    expect(await detectAnomalies(d, { owner })).toEqual([]);
  });
});

describe('lo que SÍ', () => {
  it('un cobro de cuatro veces lo habitual en su categoría', async () => {
    const d = await deps();
    await conHistorialDeMercado(d);
    await gastar(
      d,
      'raro',
      'EXITO SUCURSAL 9',
      'mercado',
      400_000n,
      '2026-09-14T10:00:00.000-05:00',
    );

    const anomalias = await detectAnomalies(d, { owner });
    expect(anomalias.some((a) => a.tipo === 'monto-inusual')).toBe(true);
  });

  it('dos cobros del mismo comercio el mismo día', async () => {
    const d = await deps();
    await conHistorialDeMercado(d);
    await gastar(
      d,
      'doble-1',
      'CAFE JUAN VALDEZ',
      'restaurantes',
      20_000n,
      '2026-09-14T10:00:00.000-05:00',
    );
    await gastar(
      d,
      'doble-2',
      'CAFE JUAN VALDEZ',
      'restaurantes',
      20_000n,
      '2026-09-14T18:00:00.000-05:00',
    );

    const anomalias = await detectAnomalies(d, { owner });
    expect(anomalias.some((a) => a.tipo === 'cobro-repetido')).toBe(true);
  });

  it('un comercio que llevaba seis meses sin aparecer', async () => {
    const d = await deps();
    await conHistorialDeMercado(d);
    await gastar(
      d,
      'dormido-viejo',
      'TIENDA RARA',
      'restaurantes',
      30_000n,
      '2026-01-10T10:00:00.000-05:00',
    );
    await gastar(
      d,
      'dormido-nuevo',
      'TIENDA RARA',
      'restaurantes',
      30_000n,
      '2026-09-14T10:00:00.000-05:00',
    );

    const anomalias = await detectAnomalies(d, { owner });
    expect(anomalias.some((a) => a.tipo === 'comercio-dormido')).toBe(true);
  });
});

describe('la forma de las anomalías', () => {
  it('cada una trae explicación y contra qué se comparó', async () => {
    const d = await deps();
    await conHistorialDeMercado(d);
    await gastar(
      d,
      'raro',
      'EXITO SUCURSAL 9',
      'mercado',
      400_000n,
      '2026-09-14T10:00:00.000-05:00',
    );

    for (const a of await detectAnomalies(d, { owner })) {
      expect(a.explicacion.length).toBeGreaterThan(10);
      expect(a.comparadoCon.length).toBeGreaterThan(5);
    }
  });

  it('salen ordenadas por confianza', async () => {
    const d = await deps();
    await conHistorialDeMercado(d);
    await gastar(
      d,
      'raro',
      'EXITO SUCURSAL 9',
      'mercado',
      400_000n,
      '2026-09-14T10:00:00.000-05:00',
    );
    await gastar(d, 'doble-1', 'CAFE X', 'restaurantes', 20_000n, '2026-09-14T10:00:00.000-05:00');
    await gastar(d, 'doble-2', 'CAFE X', 'restaurantes', 20_000n, '2026-09-14T18:00:00.000-05:00');

    const confianzas = (await detectAnomalies(d, { owner })).map((a) => a.confianza);
    expect(confianzas).toEqual([...confianzas].sort((a, b) => b - a));
  });

  it('dos corridas dan los mismos ids: una descartada no vuelve', async () => {
    const d = await deps();
    await conHistorialDeMercado(d);
    await gastar(
      d,
      'raro',
      'EXITO SUCURSAL 9',
      'mercado',
      400_000n,
      '2026-09-14T10:00:00.000-05:00',
    );

    const a = await detectAnomalies(d, { owner });
    const b = await detectAnomalies(d, { owner });
    expect(a.map((x) => x.id)).toEqual(b.map((x) => x.id));
  });

  it('no devuelve anomalías de otro propietario', async () => {
    const d = await deps();
    await conHistorialDeMercado(d);
    await gastar(
      d,
      'raro',
      'EXITO SUCURSAL 9',
      'mercado',
      400_000n,
      '2026-09-14T10:00:00.000-05:00',
    );

    expect(await detectAnomalies(d, { owner: ownerId('otro') })).toEqual([]);
  });

  /** Sin esto, la misma alerta volvería cada vez y la pantalla dejaría de leerse. */
  it('una anomalía descartada no vuelve a aparecer', async () => {
    const d = await deps();
    await conHistorialDeMercado(d);
    await gastar(
      d,
      'raro',
      'EXITO SUCURSAL 9',
      'mercado',
      400_000n,
      '2026-09-14T10:00:00.000-05:00',
    );

    const primera = (await detectAnomalies(d, { owner }))[0];
    await d.anomalias.descartar(owner, primera?.id ?? '', HOY);

    expect((await detectAnomalies(d, { owner })).map((a) => a.id)).not.toContain(primera?.id);
  });

  it('descartar una no esconde las demás', async () => {
    const d = await deps();
    await conHistorialDeMercado(d);
    await gastar(
      d,
      'raro',
      'EXITO SUCURSAL 9',
      'mercado',
      400_000n,
      '2026-09-14T10:00:00.000-05:00',
    );
    await gastar(d, 'doble-1', 'CAFE X', 'restaurantes', 20_000n, '2026-09-14T10:00:00.000-05:00');
    await gastar(d, 'doble-2', 'CAFE X', 'restaurantes', 20_000n, '2026-09-14T18:00:00.000-05:00');

    const antes = await detectAnomalies(d, { owner });
    await d.anomalias.descartar(owner, antes[0]?.id ?? '', HOY);

    expect(await detectAnomalies(d, { owner })).toHaveLength(antes.length - 1);
  });
});
