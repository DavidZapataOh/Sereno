import { categoryAccountId } from '@/domain/categorization/taxonomy';
import { createAccount } from '@/domain/ledger/account';
import { accountId, ownerId, transactionId } from '@/domain/ledger/ids';
import { systemAccountId } from '@/domain/ledger/system-accounts';
import { createTransaction } from '@/domain/ledger/transaction';
import { money } from '@/domain/money/money';
import { categorizationDeps } from '@/test/fakes/categorization-deps';

import { ensureSystemAccounts } from '../ledger/ensure-system-accounts';
import { ensureDefaultCategories, listCategories } from './ensure-default-categories';
import { archiveCategory, createCategory, renameCategory } from './manage-categories';
import { setCategory, unsetCategory } from './set-category';

const owner = ownerId('david');
const ahorros = accountId('bancolombia:ahorros');
const c1 = transactionId('bancolombia:C1');

async function conCompra() {
  const d = categorizationDeps();
  await ensureSystemAccounts(d.accounts, owner);
  await ensureDefaultCategories(d, owner);
  await d.accounts.save(
    createAccount({ id: ahorros, owner, kind: 'activo', nombre: 'Bancolombia', currency: 'COP' }),
  );
  await d.transactions.save(
    createTransaction({
      id: c1,
      owner,
      fecha: '2026-08-30T00:00:00.000-05:00',
      descripcion: 'COMPRA EXITO',
      origen: { fuente: 'bancolombia', referencia: 'C1' },
      postings: [
        { accountId: ahorros, amount: money(-45000, 'COP') },
        { accountId: systemAccountId('gastos-sin-clasificar'), amount: money(45000, 'COP') },
      ],
    }),
  );
  return d;
}
const saldo = async (d: Awaited<ReturnType<typeof conCompra>>, id: string) =>
  (await d.accounts.balanceOf(accountId(id))).amount;

describe('setCategory', () => {
  it('reasienta y deja constancia de quién lo decidió', async () => {
    const d = await conCompra();
    const r = await setCategory(d, {
      owner,
      transactionId: c1,
      categoria: categoryAccountId('mercado'),
      origen: 'manual',
    });
    expect(r.antes).toBeNull();
    expect(await saldo(d, 'categoria:mercado')).toBe(45000n);
    expect(await saldo(d, 'sistema:gastos-sin-clasificar')).toBe(0n);
    expect(await d.classifications.findByTransaction(c1)).toMatchObject({
      categoria: 'categoria:mercado',
      origen: 'manual',
      confianza: 100,
    });
  });

  it('reclasificar devuelve la categoría anterior', async () => {
    const d = await conCompra();
    const mercado = categoryAccountId('mercado');
    await setCategory(d, { owner, transactionId: c1, categoria: mercado, origen: 'manual' });
    const r = await setCategory(d, {
      owner,
      transactionId: c1,
      categoria: categoryAccountId('hogar'),
      origen: 'manual',
    });
    expect(r.antes).toBe('categoria:mercado');
    expect(await saldo(d, 'categoria:mercado')).toBe(0n);
    expect(await saldo(d, 'categoria:hogar')).toBe(45000n);
  });

  it('una clasificación automática lleva su confianza', async () => {
    const d = await conCompra();
    await setCategory(d, {
      owner,
      transactionId: c1,
      categoria: categoryAccountId('mercado'),
      origen: 'aprendida',
      confianza: 72,
    });
    expect(await d.classifications.findByTransaction(c1)).toMatchObject({
      origen: 'aprendida',
      confianza: 72,
    });
  });

  it('rechaza una categoría inexistente, una cuenta que no es categoría y una transacción ajena', async () => {
    const d = await conCompra();
    const mercado = categoryAccountId('mercado');
    await expect(
      setCategory(d, {
        owner,
        transactionId: c1,
        categoria: categoryAccountId('nada'),
        origen: 'manual',
      }),
    ).rejects.toThrow(/categoría/);
    await expect(
      setCategory(d, { owner, transactionId: c1, categoria: ahorros, origen: 'manual' }),
    ).rejects.toThrow(/categoría/);
    await expect(
      setCategory(d, {
        owner: ownerId('otro'),
        transactionId: c1,
        categoria: mercado,
        origen: 'manual',
      }),
    ).rejects.toThrow(/No existe/);
  });
});

describe('unsetCategory', () => {
  it('vuelve a sin clasificar y borra la constancia', async () => {
    const d = await conCompra();
    await setCategory(d, {
      owner,
      transactionId: c1,
      categoria: categoryAccountId('mercado'),
      origen: 'manual',
    });
    const r = await unsetCategory(d, { owner, transactionId: c1 });
    expect(r.antes).toBe('categoria:mercado');
    expect(await saldo(d, 'sistema:gastos-sin-clasificar')).toBe(45000n);
    expect(await d.classifications.findByTransaction(c1)).toBeNull();
  });
});

describe('crear, renombrar y archivar', () => {
  it('crear asigna el siguiente orden del grupo y rechaza el nombre repetido', async () => {
    const d = await conCompra();
    const nueva = await createCategory(d, {
      owner,
      nombre: 'Café de especialidad',
      kind: 'gasto',
      grupo: 'comida',
      icono: 'coffee',
    });
    expect(nueva).toMatchObject({
      id: 'categoria:cafe-de-especialidad',
      grupo: 'comida',
      orden: 5,
    });
    await expect(
      createCategory(d, {
        owner,
        nombre: 'Cafe de Especialidad',
        kind: 'gasto',
        grupo: 'comida',
        icono: 'coffee',
      }),
    ).rejects.toThrow(/Ya existe/);
  });

  it('renombrar conserva el id; archivar la quita de la lista y de las opciones', async () => {
    const d = await conCompra();
    const mercado = categoryAccountId('mercado');
    await renameCategory(d, { owner, id: mercado, nombre: 'Súper' });
    expect((await d.accounts.findById(mercado))?.nombre).toBe('Súper');
    await expect(renameCategory(d, { owner, id: mercado, nombre: '  ' })).rejects.toThrow(/nombre/);

    await archiveCategory(d, { owner, id: mercado });
    expect((await listCategories(d, owner)).some((c) => c.id === mercado)).toBe(false);
    await expect(
      setCategory(d, { owner, transactionId: c1, categoria: mercado, origen: 'manual' }),
    ).rejects.toThrow(/archivada/);
  });
});
