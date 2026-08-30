import { categoryAccountId, DEFAULT_CATEGORIES } from '@/domain/categorization/taxonomy';
import { ownerId } from '@/domain/ledger/ids';
import { categorizationDeps } from '@/test/fakes/categorization-deps';

import { ensureDefaultCategories, listCategories } from './ensure-default-categories';

const owner = ownerId('david');

describe('ensureDefaultCategories', () => {
  it('crea cuenta y detalle de cada categoría por defecto', async () => {
    const d = categorizationDeps();
    const r = await ensureDefaultCategories(d, owner);
    expect(r.creadas).toBe(DEFAULT_CATEGORIES.length);
    const mercado = await d.accounts.findById(categoryAccountId('mercado'));
    expect(mercado).toMatchObject({ kind: 'gasto', nombre: 'Mercado', currency: 'COP' });
    expect(await d.categories.findDetails(categoryAccountId('mercado'))).toMatchObject({
      grupo: 'comida',
      icono: 'cart',
    });
  });

  it('es idempotente y respeta lo que el usuario cambió', async () => {
    const d = categorizationDeps();
    await ensureDefaultCategories(d, owner);
    const mercado = await d.accounts.findById(categoryAccountId('mercado'));
    if (mercado === null) throw new Error('falta mercado');
    await d.accounts.save({ ...mercado, nombre: 'Súper' });

    const segunda = await ensureDefaultCategories(d, owner);
    expect(segunda.creadas).toBe(0);
    expect((await d.accounts.findById(categoryAccountId('mercado')))?.nombre).toBe('Súper');
  });
});

describe('listCategories', () => {
  it('devuelve las categorías enteras, por grupo y orden, sin las archivadas', async () => {
    const d = categorizationDeps();
    await ensureDefaultCategories(d, owner);
    await d.accounts.archive(categoryAccountId('mascotas'), '2026-08-30T10:00:00.000-05:00');

    const lista = await listCategories(d, owner);
    expect(lista[0]).toMatchObject({ id: 'categoria:arriendo', grupo: 'vivienda', orden: 1 });
    expect(lista.some((c) => c.id === 'categoria:mascotas')).toBe(false);
    expect(lista.at(-1)?.grupo).toBe('ingresos');

    const conArchivadas = await listCategories(d, owner, { incluirArchivadas: true });
    expect(conArchivadas.some((c) => c.id === 'categoria:mascotas')).toBe(true);
  });
});
