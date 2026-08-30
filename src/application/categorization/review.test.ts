import { categoryAccountId } from '@/domain/categorization/taxonomy';
import { createAccount } from '@/domain/ledger/account';
import { accountId, ownerId, transactionId } from '@/domain/ledger/ids';
import { systemAccountId } from '@/domain/ledger/system-accounts';
import { createTransaction } from '@/domain/ledger/transaction';
import { money } from '@/domain/money/money';
import { categorizationDeps } from '@/test/fakes/categorization-deps';

import { ensureSystemAccounts } from '../ledger/ensure-system-accounts';
import { classifyUnclassified } from './classify';
import { ensureDefaultCategories } from './ensure-default-categories';
import { categorizeGroup, lastBatch, listPending, undoBatch } from './review';
import { listRules } from './rules';

const owner = ownerId('david');
const ahorros = accountId('bancolombia:ahorros');
const antojos = categoryAccountId('antojos');
const p = (n: number) => transactionId(`bancolombia:P${String(n)}`);

async function base() {
  const d = categorizationDeps();
  await ensureSystemAccounts(d.accounts, owner);
  await ensureDefaultCategories(d, owner);
  await d.accounts.save(
    createAccount({ id: ahorros, owner, kind: 'activo', nombre: 'Bancolombia', currency: 'COP' }),
  );
  const gasto = (ref: string, descripcion: string, monto: number) =>
    d.transactions.save(
      createTransaction({
        id: transactionId(`bancolombia:${ref}`),
        owner,
        fecha: '2026-08-30T00:00:00.000-05:00',
        descripcion,
        origen: { fuente: 'bancolombia', referencia: ref },
        postings: [
          { accountId: ahorros, amount: money(-monto, 'COP') },
          { accountId: systemAccountId('gastos-sin-clasificar'), amount: money(monto, 'COP') },
        ],
      }),
    );
  await gasto('P1', 'COMPRA PANADERIA DONA ROSA', 8000);
  await gasto('P2', 'COMPRA PANADERIA DONA ROSA SUR', 12000);
  await gasto('P3', 'PAGO EN PANADERIA DONA ROSA CALLE 80', 5000);
  await gasto('F1', 'COMPRA FERRETERIA LA 45', 30000);
  await gasto('E1', 'COMPRA EXITO SUR', 45000);
  return d;
}
const saldo = async (d: Awaited<ReturnType<typeof base>>, id: string) =>
  (await d.accounts.balanceOf(accountId(id))).amount;

describe('listPending', () => {
  it('agrupa lo pendiente por comercio, de más a menos, con total', async () => {
    const d = await base();
    await classifyUnclassified(d, { owner }); // Éxito sale por catálogo con 80: no está pendiente
    const grupos = await listPending(d, { owner });
    expect(grupos.map((g) => g.comercio.clave)).toEqual(['panaderia dona', 'ferreteria la']);
    expect(grupos[0]?.transacciones).toHaveLength(3);
    expect(grupos[0]?.total).toEqual(money(25000, 'COP'));
    expect(grupos[0]?.comercio.nombre).toBe('Panaderia Dona Rosa');
  });
});

describe('categorizeGroup', () => {
  it('clasifica el grupo a mano en un lote y aprende de cada uno', async () => {
    const d = await base();
    const lote = await categorizeGroup(d, {
      owner,
      transactionIds: [p(1), p(2), p(3)],
      categoria: antojos,
    });
    expect(lote.cambios).toHaveLength(3);
    expect(lote.cambios[0]).toMatchObject({ antes: null, despues: 'categoria:antojos' });
    expect(lote.comercio).toBe('panaderia dona');
    expect(await saldo(d, 'categoria:antojos')).toBe(25000n);
    const evidencias = await d.evidence.listByFeatures(owner, ['comercio:panaderia dona']);
    expect(evidencias[0]?.cuenta).toBe(3);
    // Sin clasificar quedan Éxito y la ferretería, uno cada uno: por nombre.
    expect((await listPending(d, { owner })).map((g) => g.comercio.clave)).toEqual([
      'exito',
      'ferreteria la',
    ]);
  });

  it('con «siempre» crea la regla y el lote la recuerda', async () => {
    const d = await base();
    const lote = await categorizeGroup(d, {
      owner,
      transactionIds: [p(1)],
      categoria: antojos,
      siempre: true,
    });
    const reglas = await listRules(d, owner);
    expect(reglas).toHaveLength(1);
    expect(reglas[0]).toMatchObject({ campo: 'comercio', operador: 'es', valor: 'panaderia dona' });
    expect(lote.reglaId).toBe(reglas[0]?.id);
    // La regla aplicó a la historia: P2 y P3 también.
    expect(await saldo(d, 'categoria:antojos')).toBe(25000n);
  });

  it('rechaza un lote vacío', async () => {
    const d = await base();
    await expect(
      categorizeGroup(d, { owner, transactionIds: [], categoria: antojos }),
    ).rejects.toThrow(/vacío/);
  });
});

describe('undoBatch', () => {
  it('deja todo como estaba: categorías, regla y evidencia', async () => {
    const d = await base();
    const lote = await categorizeGroup(d, {
      owner,
      transactionIds: [p(1), p(2)],
      categoria: antojos,
      siempre: true,
    });
    await undoBatch(d, { owner, batchId: lote.id });

    expect(await saldo(d, 'categoria:antojos')).toBe(0n);
    expect(await saldo(d, 'sistema:gastos-sin-clasificar')).toBe(100000n);
    expect(await listRules(d, owner)).toHaveLength(0);
    expect(await d.evidence.listByFeatures(owner, ['comercio:panaderia dona'])).toEqual([]);
    expect((await d.batches.findById(lote.id))?.deshechoEn).not.toBeNull();
    expect(await lastBatch(d, owner)).toBeNull();
  });

  it('restaura la clasificación previa tal cual, con su origen', async () => {
    const d = await base();
    await classifyUnclassified(d, { owner }); // E1 → mercado por catálogo (80)
    const lote = await categorizeGroup(d, {
      owner,
      transactionIds: [transactionId('bancolombia:E1')],
      categoria: categoryAccountId('hogar'),
    });
    expect(lote.cambios[0]?.antes).toMatchObject({
      categoria: 'categoria:mercado',
      origen: 'catalogo',
    });
    await undoBatch(d, { owner, batchId: lote.id });
    expect(
      await d.classifications.findByTransaction(transactionId('bancolombia:E1')),
    ).toMatchObject({
      categoria: 'categoria:mercado',
      origen: 'catalogo',
      confianza: 80,
    });
    expect(await saldo(d, 'categoria:mercado')).toBe(45000n);
  });

  it('un lote deshecho no se deshace dos veces', async () => {
    const d = await base();
    const lote = await categorizeGroup(d, { owner, transactionIds: [p(1)], categoria: antojos });
    await undoBatch(d, { owner, batchId: lote.id });
    await expect(undoBatch(d, { owner, batchId: lote.id })).rejects.toThrow(/deshecho/);
  });
});
