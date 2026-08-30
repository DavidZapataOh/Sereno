import { assert, asyncProperty, integer, record, string, uniqueArray } from 'fast-check';

import type { NormalizedTransaction } from '@/domain/capture/normalized-transaction';
import { accountId, ownerId } from '@/domain/ledger/ids';
import { createInMemoryAccountRepository } from '@/test/fakes/in-memory-account-repository';
import { createInMemoryIngestRepository } from '@/test/fakes/in-memory-ingest-repository';
import { createInMemoryTransactionRepository } from '@/test/fakes/in-memory-transaction-repository';
import { createInMemoryTransferRepository } from '@/test/fakes/in-memory-transfer-repository';
import { createSequentialIds } from '@/test/fakes/sequential-ids';
import { mustExist } from '@/test/must-exist';

import { ingestNormalized } from './ingest-normalized';
import type { IngestDeps } from './types';

const owner = ownerId('david');

function deps() {
  const accounts = createInMemoryAccountRepository();
  const transactions = createInMemoryTransactionRepository(accounts.postings);
  const ingest = createInMemoryIngestRepository();
  const d: IngestDeps = {
    accounts,
    transactions,
    ingest,
    transfers: createInMemoryTransferRepository(),
    ids: createSequentialIds('run'),
    clock: () => '2026-08-28T10:00:00.000-05:00',
  };
  return { ...d, accounts, transactions, ingest };
}

const web: NormalizedTransaction = {
  fecha: '2026/08/28',
  descripcion: 'COMPRA PSE *4471 EXITO SUR',
  monto: 45000,
  moneda: 'COP',
  tipo: 'debito',
  fuente: 'bancolombia',
  referencia: 'REF-1',
};
const correo: NormalizedTransaction = {
  ...web,
  fecha: '2026/08/27',
  descripcion: 'Pago en EXITO SUR',
  fuente: 'nequi',
  referencia: null,
};

const porWeb = (lote: NormalizedTransaction[]) => ({
  owner,
  fuente: 'bancolombia' as const,
  nombreFuente: 'Bancolombia',
  lote,
  capturadoEn: '2026-08-28T10:00:00.000-05:00',
});
const porCorreo = (lote: NormalizedTransaction[]) => ({
  owner,
  fuente: 'nequi' as const,
  nombreFuente: 'Nequi',
  lote,
  capturadoEn: '2026-08-27T21:00:00.000-05:00',
});

describe('ingestNormalized — deduplicación entre fuentes', () => {
  it('la misma compra vista por web y por correo se guarda una vez, con dos observaciones', async () => {
    const d = deps();
    await ingestNormalized(d, porWeb([web]));
    const resumen = await ingestNormalized(d, porCorreo([correo]));

    expect(resumen).toMatchObject({ nuevas: 0, fusionadas: 1, duplicadas: 0 });
    expect(d.transactions.all()).toHaveLength(1);
    const obs = d.ingest.observations();
    expect(obs).toHaveLength(2);
    expect(obs.map((o) => o.fuente).sort()).toEqual(['bancolombia', 'nequi']);
    expect(new Set(obs.map((o) => o.transactionId)).size).toBe(1);
  });

  it('funciona en el otro orden: primero el correo, después la web', async () => {
    const d = deps();
    await ingestNormalized(d, porCorreo([correo]));
    const resumen = await ingestNormalized(d, porWeb([web]));

    expect(resumen).toMatchObject({ nuevas: 0, fusionadas: 1 });
    expect(d.transactions.all()).toHaveLength(1);
  });

  it('dos compras legítimas idénticas el mismo día no se fusionan', async () => {
    const d = deps();
    await ingestNormalized(d, porWeb([web, { ...web, referencia: 'REF-2' }]));
    const resumen = await ingestNormalized(d, porCorreo([correo, { ...correo }]));

    // Cada correo se empareja con UNA compra distinta: dos y dos.
    expect(resumen).toMatchObject({ nuevas: 0, fusionadas: 2 });
    expect(d.transactions.all()).toHaveLength(2);
    d.transactions.all().forEach((t) => {
      expect(d.ingest.observations().filter((o) => o.transactionId === t.id)).toHaveLength(2);
    });
  });

  it('un tercer correo igual, sin compra que emparejar, sí es una transacción nueva', async () => {
    const d = deps();
    await ingestNormalized(d, porWeb([web]));
    const resumen = await ingestNormalized(d, porCorreo([correo, { ...correo }]));

    expect(resumen).toMatchObject({ nuevas: 1, fusionadas: 1 });
    expect(d.transactions.all()).toHaveLength(2);
  });

  it('reprocesar el correo es idempotente: la referencia derivada es estable', async () => {
    const d = deps();
    await ingestNormalized(d, porCorreo([correo]));
    const segunda = await ingestNormalized(d, porCorreo([correo]));

    expect(segunda).toMatchObject({ nuevas: 0, duplicadas: 1, fusionadas: 0 });
    expect(d.transactions.all()).toHaveLength(1);
  });

  it('no empareja fuera de la tolerancia de un día', async () => {
    const d = deps();
    await ingestNormalized(d, porWeb([web]));
    const resumen = await ingestNormalized(d, porCorreo([{ ...correo, fecha: '2026/08/25' }]));

    expect(resumen).toMatchObject({ nuevas: 1, fusionadas: 0 });
  });

  it('no empareja montos distintos aunque todo lo demás coincida', async () => {
    const d = deps();
    await ingestNormalized(d, porWeb([web]));
    const resumen = await ingestNormalized(d, porCorreo([{ ...correo, monto: 45001 }]));

    expect(resumen).toMatchObject({ nuevas: 1, fusionadas: 0 });
  });

  it('la observación fusionada conserva su crudo y su fuente', async () => {
    const d = deps();
    await ingestNormalized(d, porWeb([web]));
    await ingestNormalized(d, porCorreo([correo]));

    const delCorreo = mustExist(d.ingest.observations().find((o) => o.fuente === 'nequi'));
    expect(delCorreo.crudo.descripcion).toBe('Pago en EXITO SUR');
    expect(delCorreo.transactionId).toBe('bancolombia:REF-1');
  });

  it('el saldo no se ve afectado por una fusión', async () => {
    const d = deps();
    await ingestNormalized(d, porWeb([web]));
    const antes = (await d.accounts.balanceOf(accountId('bancolombia:ahorros'))).amount;
    await ingestNormalized(d, porCorreo([correo]));
    const despues = (await d.accounts.balanceOf(accountId('bancolombia:ahorros'))).amount;

    expect(despues).toBe(antes);
  });

  it('una fila con monto cero se omite y no tumba el lote', async () => {
    // Lo encontró la sesión de campo: Bancolombia trae lineas informativas
    // con monto cero, y rechazarlas hacía fallar la importación entera.
    const d = deps();
    const resumen = await ingestNormalized(
      d,
      porWeb([
        { ...web, monto: 0, referencia: 'CERO' },
        { ...web, referencia: 'REF-2' },
      ]),
    );

    expect(resumen).toMatchObject({ nuevas: 1, omitidas: 1 });
    expect(resumen.motivosOmision[0]).toMatch(/CERO: .*cero/i);
    expect(d.transactions.all().map((t) => t.id)).toEqual(['bancolombia:REF-2']);
    expect(mustExist(await d.ingest.findLastRun(owner, 'bancolombia'))).toMatchObject({
      omitidas: 1,
      error: null,
    });
  });

  it('una fila con fecha inexistente se omite igual', async () => {
    const d = deps();
    const resumen = await ingestNormalized(d, porWeb([{ ...web, fecha: '2026/02/30' }]));
    expect(resumen).toMatchObject({ nuevas: 0, omitidas: 1 });
    expect(resumen.motivosOmision[0]).toMatch(/no existe/);
  });

  it('la corrida registra las capturas cuando vienen de capturas', async () => {
    const d = deps();
    await ingestNormalized(d, { ...porWeb([web]), capturas: 4 });
    expect(mustExist(await d.ingest.findLastRun(owner, 'bancolombia')).capturas).toBe(4);
  });

  it('propiedad: web y luego correo del mismo lote deja N transacciones con 2 observaciones cada una', async () => {
    const movimiento = record({
      dia: integer({ min: 2, max: 27 }),
      // Un comercio real no se llama «en» ni «pse»: si empezara por un
      // conector, «compra en X» y «pago en en X» serían irresolubles.
      descripcion: string({ minLength: 3, maxLength: 12 }).filter(
        (s) => /^[a-z]/i.test(s.trim()) && !/^(pse|en|a|de)\b/i.test(s.trim()),
      ),
      monto: integer({ min: 1, max: 900_000 }),
      referencia: string({ minLength: 1, maxLength: 8 }).filter((r) => r.trim().length > 0),
    });

    await assert(
      asyncProperty(
        uniqueArray(movimiento, {
          minLength: 1,
          maxLength: 15,
          selector: (m) => `${String(m.dia)}|${String(m.monto)}|${m.descripcion}`,
        }),
        async (lote) => {
          const d = deps();
          const porLaWeb = lote.map((m, i) => ({
            ...web,
            fecha: `2026/08/${String(m.dia).padStart(2, '0')}`,
            descripcion: `COMPRA ${m.descripcion}`,
            monto: m.monto,
            referencia: `R${String(i)}-${m.referencia}`,
          }));
          const porElCorreo = porLaWeb.map((n) => ({
            ...n,
            fecha: `2026/08/${String(Number(n.fecha.slice(8)) - 1).padStart(2, '0')}`,
            descripcion: n.descripcion.replace('COMPRA', 'Pago en'),
            fuente: 'nequi' as const,
            referencia: null,
          }));

          await ingestNormalized(d, porWeb(porLaWeb));
          const resumen = await ingestNormalized(d, porCorreo(porElCorreo));

          expect(resumen.fusionadas).toBe(lote.length);
          expect(resumen.nuevas).toBe(0);
          expect(d.transactions.all()).toHaveLength(lote.length);
          d.transactions.all().forEach((t) => {
            expect(d.ingest.observations().filter((o) => o.transactionId === t.id)).toHaveLength(2);
          });
        },
      ),
      { numRuns: 80 },
    );
  });

  it('con `desde`, lo anterior a ese día no entra ni deja observación; sin `desde`, entra todo', async () => {
    const d = deps();
    const conInicio = await ingestNormalized(d, { ...porWeb([web]), desde: '2030-01-01' });
    expect(conInicio).toMatchObject({ nuevas: 0, anteriores: 1, desde: '2030-01-01' });
    expect(d.transactions.all()).toHaveLength(0);
    expect(d.ingest.observations()).toHaveLength(0);

    const sinInicio = await ingestNormalized(d, porWeb([web]));
    expect(sinInicio).toMatchObject({ nuevas: 1, anteriores: 0, desde: null });
  });
});
