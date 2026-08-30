import { basicClean } from '@/domain/text/bank-description';

import { CATALOG_SLUGS, findInCatalog, MERCHANT_CATALOG } from './merchant-catalog';

/** Descripciones con la forma real de Bancolombia y el nombre esperado. */
const MUESTRAS: [string, string][] = [
  ['COMPRA PSE *4471 EXITO SUR', 'Éxito'],
  ['ALMACENES EXITO SA', 'Éxito'],
  ['COMPRA CARULLA CALLE 85', 'Carulla'],
  ['COMPRA TIENDAS D1 SAS', 'D1'],
  ['COMPRA ARA', 'Ara'],
  ['PAGO EN RAPPI', 'Rappi'],
  ['COMPRA RAPPI*RAPPI PRO', 'Rappi'],
  ['COMPRA NETFLIX.COM', 'Netflix'],
  ['COMPRA SPOTIFY', 'Spotify'],
  ['COMPRA UBER *TRIP HELP.UBER.COM', 'Uber'],
  ['COMPRA DIDI FOOD', 'DiDi Food'],
  ['COMPRA DIDI', 'DiDi'],
  ['PAGO PSE CLARO MOVIL', 'Claro'],
  ['PAGO PSE EPM', 'EPM'],
  ['COMPRA FARMATODO', 'Farmatodo'],
  ['COMPRA CRUZ VERDE', 'Cruz Verde'],
  ['COMPRA HOMECENTER', 'Homecenter'],
  ['COMPRA TERPEL', 'Terpel'],
  ['COMPRA CINE COLOMBIA', 'Cine Colombia'],
  ['COMPRA MERCADOLIBRE', 'Mercado Libre'],
  ['COMPRA AMAZON', 'Amazon'],
  ['COMPRA AMAZON PRIME', 'Prime Video'],
  ['IMPTO GOBIERNO 4X1000', '4×1000'],
  ['CUOTA DE MANEJO', 'Cuota de manejo'],
  ['TRANSFERENCIA A NEQUI', 'Nequi'],
  ['RETIRO CAJERO', 'Retiro en cajero'],
  ['ABONO NOMINA', 'Nómina'],
];

describe('MERCHANT_CATALOG', () => {
  it('cada entrada tiene patrón sin banderas peligrosas, nombre y slug o null', () => {
    for (const e of MERCHANT_CATALOG) {
      expect(e.patron.flags).not.toContain('g'); // con «g», test() alterna resultados
      expect(e.nombre.trim().length).toBeGreaterThan(0);
      expect(e.categoria === null || /^[a-z0-9-]+$/.test(e.categoria)).toBe(true);
    }
  });

  it.each(MUESTRAS)('reconoce «%s» como %s', (cruda, nombre) => {
    expect(findInCatalog(basicClean(cruda))?.nombre).toBe(nombre);
  });

  it('ninguna muestra cae en dos entradas de nombre distinto, salvo la general que la específica adelanta', () => {
    // «DiDi Food» y «DiDi», «Amazon Prime» y «Amazon» se resuelven por orden:
    // la específica va antes. Lo que no se admite es que dos entradas
    // igual de específicas reclamen la misma muestra.
    const adelantadas = new Set(['DiDi', 'Amazon']);
    for (const [cruda] of MUESTRAS) {
      const limpia = basicClean(cruda);
      const nombres = new Set(
        MERCHANT_CATALOG.filter((e) => e.patron.test(limpia))
          .map((e) => e.nombre)
          .filter((n, i) => i === 0 || !adelantadas.has(n)),
      );
      expect(nombres.size).toBeLessThanOrEqual(1);
    }
  });

  it('no reconoce lo que no está', () => {
    expect(findInCatalog('la tienda de la esquina')).toBeNull();
  });

  it('expone los slugs que usa, sin repetir', () => {
    expect(new Set(CATALOG_SLUGS).size).toBe(CATALOG_SLUGS.length);
    expect(CATALOG_SLUGS).toContain('mercado');
  });
});
