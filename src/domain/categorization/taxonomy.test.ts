import { accountId } from '@/domain/ledger/ids';

import { CATALOG_SLUGS } from './merchant-catalog';
import {
  CATEGORY_GROUPS,
  categoryAccountId,
  DEFAULT_CATEGORIES,
  GROUP_NAMES,
  isCategoryAccount,
  OTHER_EXPENSES_SLUG,
  OTHER_INCOME_SLUG,
  slugify,
  slugOf,
} from './taxonomy';

describe('DEFAULT_CATEGORIES', () => {
  it('slugs únicos, en minúsculas y sin acentos; nombres con tilde donde toca', () => {
    const slugs = DEFAULT_CATEGORIES.map((c) => c.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const c of DEFAULT_CATEGORIES) {
      expect(c.slug).toMatch(/^[a-z0-9-]+$/);
      expect(c.nombre.trim().length).toBeGreaterThan(0);
      expect(CATEGORY_GROUPS).toContain(c.grupo);
      expect(c.icono.length).toBeGreaterThan(0);
    }
    expect(DEFAULT_CATEGORIES.find((c) => c.slug === 'cuatro-por-mil')?.nombre).toBe('4×1000');
    expect(DEFAULT_CATEGORIES.find((c) => c.slug === 'drogueria')?.nombre).toBe('Droguería');
  });

  it('cubre todos los slugs que sugiere el catálogo de comercios', () => {
    const slugs = new Set(DEFAULT_CATEGORIES.map((c) => c.slug));
    for (const s of CATALOG_SLUGS) expect(slugs.has(s)).toBe(true);
  });

  it('los ingresos van en el grupo ingresos y los gastos en los demás', () => {
    for (const c of DEFAULT_CATEGORIES) {
      expect(c.grupo === 'ingresos').toBe(c.kind === 'ingreso');
    }
  });

  it('el orden es único dentro de cada grupo', () => {
    for (const g of CATEGORY_GROUPS) {
      const ordenes = DEFAULT_CATEGORIES.filter((c) => c.grupo === g).map((c) => c.orden);
      expect(new Set(ordenes).size).toBe(ordenes.length);
    }
  });

  it('tiene un último recurso explícito para gastos e ingresos', () => {
    expect(DEFAULT_CATEGORIES.some((c) => c.slug === OTHER_EXPENSES_SLUG)).toBe(true);
    expect(DEFAULT_CATEGORIES.some((c) => c.slug === OTHER_INCOME_SLUG)).toBe(true);
  });

  it('cada grupo tiene nombre', () => {
    for (const g of CATEGORY_GROUPS) expect(GROUP_NAMES[g].length).toBeGreaterThan(0);
  });
});

describe('ids de categoría', () => {
  it('son deterministas y se reconocen', () => {
    expect(categoryAccountId('mercado')).toBe('categoria:mercado');
    expect(isCategoryAccount(accountId('categoria:mercado'))).toBe(true);
    expect(isCategoryAccount(accountId('sistema:gastos-sin-clasificar'))).toBe(false);
    expect(slugOf(accountId('categoria:mercado'))).toBe('mercado');
    expect(() => slugOf(accountId('bancolombia:ahorros'))).toThrow(/categoría/);
  });
});

describe('slugify', () => {
  it('minúsculas, sin acentos, guiones, sin extremos', () => {
    expect(slugify('Apoyo a la familia')).toBe('apoyo-a-la-familia');
    expect(slugify('  Droguería & Salud ')).toBe('drogueria-salud');
  });

  it('rechaza un nombre que no deja nada', () => {
    expect(() => slugify('¡¡¡')).toThrow(/nombre/);
  });
});
