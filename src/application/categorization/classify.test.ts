import { LABELED_SAMPLE } from '@/domain/categorization/labeled-sample';
import { categoryAccountId } from '@/domain/categorization/taxonomy';
import { createAccount } from '@/domain/ledger/account';
import { accountId, ownerId, transactionId, type TransactionId } from '@/domain/ledger/ids';
import { systemAccountId } from '@/domain/ledger/system-accounts';
import { createTransaction } from '@/domain/ledger/transaction';
import { money } from '@/domain/money/money';
import { categorizationDeps } from '@/test/fakes/categorization-deps';
import { mustExist } from '@/test/must-exist';

import { ensureSystemAccounts } from '../ledger/ensure-system-accounts';
import { classifyTransaction, classifyUnclassified, correctCategory } from './classify';
import { ensureDefaultCategories } from './ensure-default-categories';
import { createRule } from './rules';
import { currentCategoryOf } from './set-category';

const owner = ownerId('david');
const ahorros = accountId('bancolombia:ahorros');
const mercado = categoryAccountId('mercado');
const hogar = categoryAccountId('hogar');

async function base() {
  const d = categorizationDeps();
  await ensureSystemAccounts(d.accounts, owner);
  await ensureDefaultCategories(d, owner);
  await d.accounts.save(
    createAccount({ id: ahorros, owner, kind: 'activo', nombre: 'Bancolombia', currency: 'COP' }),
  );
  let n = 0;
  const gasto = async (descripcion: string, monto = 20000): Promise<TransactionId> => {
    n += 1;
    const id = transactionId(`bancolombia:T${String(n)}`);
    await d.transactions.save(
      createTransaction({
        id,
        owner,
        fecha: '2026-08-30T00:00:00.000-05:00',
        descripcion,
        origen: { fuente: 'bancolombia', referencia: `T${String(n)}` },
        postings: [
          { accountId: ahorros, amount: money(-monto, 'COP') },
          { accountId: systemAccountId('gastos-sin-clasificar'), amount: money(monto, 'COP') },
        ],
      }),
    );
    return id;
  };
  return { d, gasto };
}

describe('classifyTransaction: prioridad', () => {
  it('el catálogo clasifica una marca conocida con origen catalogo', async () => {
    const { d, gasto } = await base();
    const id = await gasto('COMPRA EXITO SUR');
    const v = await classifyTransaction(d, { owner, transactionId: id });
    expect(v).toMatchObject({ categoria: mercado, origen: 'catalogo' });
    expect(await d.classifications.findByTransaction(id)).toMatchObject({ origen: 'catalogo' });
  });

  it('una regla gana al catálogo', async () => {
    const { d, gasto } = await base();
    await createRule(d, {
      owner,
      draft: { campo: 'comercio', operador: 'es', valor: 'exito', categoria: hogar },
    });
    const id = await gasto('COMPRA EXITO SUR');
    expect((await classifyTransaction(d, { owner, transactionId: id }))?.origen).toBe('regla');
    expect(currentCategoryOf(mustExist(await d.transactions.findById(id)))).toBe(hogar);
  });

  it('lo aprendido de dos correcciones gana al catálogo', async () => {
    const { d, gasto } = await base();
    const a = await gasto('COMPRA EXITO SUR');
    const b = await gasto('COMPRA EXITO CALLE 80');
    await correctCategory(d, { owner, transactionId: a, categoria: hogar });
    await correctCategory(d, { owner, transactionId: b, categoria: hogar });
    const c = await gasto('ALMACENES EXITO SA');
    expect(await classifyTransaction(d, { owner, transactionId: c })).toMatchObject({
      categoria: hogar,
      origen: 'aprendida',
    });
  });

  it('con una sola corrección aún no se atreve: cae al catálogo o a nada', async () => {
    const { d, gasto } = await base();
    const a = await gasto('COMPRA PANADERIA DONA ROSA');
    await correctCategory(d, { owner, transactionId: a, categoria: categoryAccountId('antojos') });
    const b = await gasto('COMPRA PANADERIA DONA ROSA SUR');
    expect(await classifyTransaction(d, { owner, transactionId: b })).toBeNull();
  });

  it('no toca lo clasificado a mano', async () => {
    const { d, gasto } = await base();
    const id = await gasto('COMPRA EXITO SUR');
    await correctCategory(d, { owner, transactionId: id, categoria: hogar });
    expect(await classifyTransaction(d, { owner, transactionId: id })).toBeNull();
    expect(await d.classifications.findByTransaction(id)).toMatchObject({ origen: 'manual' });
  });

  it('una transferencia no se clasifica', async () => {
    const { d } = await base();
    const id = transactionId('bancolombia:R1');
    await d.transactions.save(
      createTransaction({
        id,
        owner,
        fecha: '2026-08-30T00:00:00.000-05:00',
        descripcion: 'RETIRO CAJERO',
        origen: { fuente: 'bancolombia', referencia: 'R1' },
        postings: [
          { accountId: ahorros, amount: money(-40000, 'COP') },
          { accountId: systemAccountId('efectivo'), amount: money(40000, 'COP') },
        ],
      }),
    );
    expect(await classifyTransaction(d, { owner, transactionId: id })).toBeNull();
  });
});

describe('correctCategory', () => {
  it('corregir lo aprendido no resta: la evidencia de hogar la puso el usuario, no el clasificador', async () => {
    const { d, gasto } = await base();
    const a = await gasto('COMPRA EXITO SUR');
    const b = await gasto('COMPRA EXITO CALLE 80');
    await correctCategory(d, { owner, transactionId: a, categoria: hogar });
    await correctCategory(d, { owner, transactionId: b, categoria: hogar });
    const c = await gasto('ALMACENES EXITO SA');
    await classifyTransaction(d, { owner, transactionId: c }); // aprendida: hogar
    await correctCategory(d, { owner, transactionId: c, categoria: mercado });

    const evidencias = await d.evidence.listByFeatures(owner, ['comercio:exito']);
    const enHogar = evidencias.find((e) => e.categoria === hogar)?.cuenta ?? 0;
    const enMercado = evidencias.find((e) => e.categoria === mercado)?.cuenta ?? 0;
    expect(enHogar).toBe(2);
    expect(enMercado).toBe(1);
  });

  it('cambiar de opinión sobre una decisión manual retira el voto anterior', async () => {
    const { d, gasto } = await base();
    const a = await gasto('COMPRA EXITO SUR');
    await correctCategory(d, { owner, transactionId: a, categoria: hogar });
    await correctCategory(d, { owner, transactionId: a, categoria: mercado });
    const evidencias = await d.evidence.listByFeatures(owner, ['comercio:exito']);
    expect(evidencias).toEqual([{ feature: 'comercio:exito', categoria: mercado, cuenta: 1 }]);
  });
});

describe('classifyUnclassified', () => {
  it('clasifica lo que puede y cuenta lo que queda por revisar', async () => {
    const { d, gasto } = await base();
    await gasto('COMPRA EXITO SUR');
    await gasto('PAGO EN RAPPI');
    await gasto('COMPRA PANADERIA DONA ROSA');
    const r = await classifyUnclassified(d, { owner });
    expect(r).toEqual({ clasificadas: 2, porRevisar: 1 });
  });
});

describe('precisión sobre la muestra etiquetada', () => {
  it('tras aprender de la mitad, acierta al menos el 80 % de la otra mitad', async () => {
    const { d, gasto } = await base();
    const entrenamiento = LABELED_SAMPLE.filter((_, i) => i % 2 === 0);
    const prueba = LABELED_SAMPLE.filter((_, i) => i % 2 === 1);
    for (const m of entrenamiento) {
      // Dos confirmaciones por comercio: el umbral de evidencia lo exige.
      for (const _ of [1, 2]) {
        const id = await gasto(m.descripcion);
        await correctCategory(d, {
          owner,
          transactionId: id,
          categoria: categoryAccountId(m.slug),
        });
      }
    }
    const fallos: string[] = [];
    let aciertos = 0;
    let sinDecidir = 0;
    for (const m of prueba) {
      const id = await gasto(m.descripcion);
      const v = await classifyTransaction(d, { owner, transactionId: id });
      if (v === null) sinDecidir += 1;
      else if (v.categoria === categoryAccountId(m.slug)) aciertos += 1;
      else fallos.push(`${m.descripcion} → ${v.categoria} (esperaba ${m.slug})`);
    }
    const decididas = prueba.length - sinDecidir;
    expect(decididas).toBeGreaterThan(prueba.length * 0.6);
    expect(fallos.length / decididas).toBeLessThanOrEqual(0.2);
    expect(aciertos + fallos.length).toBe(decididas);
  });
});
