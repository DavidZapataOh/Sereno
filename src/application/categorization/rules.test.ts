import { categoryAccountId } from '@/domain/categorization/taxonomy';
import { createAccount } from '@/domain/ledger/account';
import { accountId, ownerId, transactionId } from '@/domain/ledger/ids';
import { systemAccountId } from '@/domain/ledger/system-accounts';
import { createTransaction } from '@/domain/ledger/transaction';
import { money } from '@/domain/money/money';
import { categorizationDeps } from '@/test/fakes/categorization-deps';

import { ensureSystemAccounts } from '../ledger/ensure-system-accounts';
import { ensureDefaultCategories } from './ensure-default-categories';
import { createRule, deleteRule, listRules, previewRule } from './rules';
import { setCategory } from './set-category';

const owner = ownerId('david');
const ahorros = accountId('bancolombia:ahorros');
const mercado = categoryAccountId('mercado');
const hogar = categoryAccountId('hogar');
const sinClasificar = systemAccountId('gastos-sin-clasificar');

async function conMovimientos() {
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
          { accountId: sinClasificar, amount: money(monto, 'COP') },
        ],
      }),
    );
  await gasto('E1', 'COMPRA EXITO SUR', 45000);
  await gasto('E2', 'COMPRA EXITO CALLE 80', 30000);
  await gasto('E3', 'COMPRA EXITO NORTE', 12000);
  await gasto('C1', 'COMPRA CARULLA', 20000);
  return d;
}
const saldo = async (d: Awaited<ReturnType<typeof conMovimientos>>, id: string) =>
  (await d.accounts.balanceOf(accountId(id))).amount;

const exitoEsMercado = {
  campo: 'comercio' as const,
  operador: 'es' as const,
  valor: 'exito',
  categoria: mercado,
};

describe('previewRule', () => {
  it('cuenta lo que coincide y lo que cambiaría, sin escribir nada', async () => {
    const d = await conMovimientos();
    const p = await previewRule(d, { owner, draft: exitoEsMercado });
    expect(p).toMatchObject({ coinciden: 3, cambiarian: 3, respetadas: 0 });
    expect(p.ejemplos).toHaveLength(3);
    expect(d.classifications.all()).toHaveLength(0);
    expect(await saldo(d, 'categoria:mercado')).toBe(0n);
  });

  it('lo clasificado a mano se respeta y se cuenta aparte', async () => {
    const d = await conMovimientos();
    await setCategory(d, {
      owner,
      transactionId: transactionId('bancolombia:E1'),
      categoria: hogar,
      origen: 'manual',
    });
    const p = await previewRule(d, { owner, draft: exitoEsMercado });
    expect(p).toMatchObject({ coinciden: 3, cambiarian: 2, respetadas: 1 });
  });
});

describe('createRule', () => {
  it('guarda la regla y la aplica a la historia con origen regla', async () => {
    const d = await conMovimientos();
    const { rule, aplicada } = await createRule(d, { owner, draft: exitoEsMercado });
    expect(aplicada.cambiarian).toBe(3);
    expect(await saldo(d, 'categoria:mercado')).toBe(87000n);
    expect(
      await d.classifications.findByTransaction(transactionId('bancolombia:E2')),
    ).toMatchObject({
      origen: 'regla',
      reglaId: rule.id,
      confianza: 100,
    });
    expect(await saldo(d, 'sistema:gastos-sin-clasificar')).toBe(20000n);
  });

  it('una regla más específica reclasifica lo que otra regla había puesto', async () => {
    const d = await conMovimientos();
    await createRule(d, { owner, draft: { ...exitoEsMercado, operador: 'contiene' } });
    await createRule(d, {
      owner,
      draft: { campo: 'descripcion', operador: 'es', valor: 'exito', categoria: hogar },
    });
    // Las tres descripciones limpias son «exito» tras quitar sucursal.
    expect(await saldo(d, 'categoria:hogar')).toBe(87000n);
    expect(await saldo(d, 'categoria:mercado')).toBe(0n);
  });

  it('rechaza un borrador sin valor y una categoría inexistente', async () => {
    const d = await conMovimientos();
    await expect(
      createRule(d, { owner, draft: { ...exitoEsMercado, valor: ' ' } }),
    ).rejects.toThrow(/valor/);
    await expect(
      createRule(d, { owner, draft: { ...exitoEsMercado, categoria: categoryAccountId('nada') } }),
    ).rejects.toThrow(/categoría/);
    expect(d.rules.all()).toHaveLength(0);
  });
});

describe('listRules y deleteRule', () => {
  it('lista de más específica a menos y borrar no desclasifica', async () => {
    const d = await conMovimientos();
    const { rule: contiene } = await createRule(d, {
      owner,
      draft: { ...exitoEsMercado, operador: 'contiene' },
    });
    const { rule: es } = await createRule(d, {
      owner,
      draft: { ...exitoEsMercado, categoria: hogar },
    });
    expect((await listRules(d, owner)).map((r) => r.id)).toEqual([es.id, contiene.id]);

    await deleteRule(d, { owner, id: es.id });
    expect(await listRules(d, owner)).toHaveLength(1);
    expect(await saldo(d, 'categoria:hogar')).toBe(87000n);
    await expect(deleteRule(d, { owner, id: es.id })).rejects.toThrow(/regla/);
  });
});
