import type { NormalizedTransaction } from '@/domain/capture/normalized-transaction';
import { categoryAccountId } from '@/domain/categorization/taxonomy';
import { ownerId } from '@/domain/ledger/ids';
import { categorizationDeps } from '@/test/fakes/categorization-deps';
import { createInMemoryIngestRepository } from '@/test/fakes/in-memory-ingest-repository';
import { createInMemoryTransferRepository } from '@/test/fakes/in-memory-transfer-repository';

import { classifyUnclassified } from '../categorization/classify';
import { ensureDefaultCategories } from '../categorization/ensure-default-categories';
import type { CategorizationDeps } from '../categorization/types';
import { ingestNormalized } from '../ingest/ingest-normalized';
import type { IngestDeps } from '../ingest/types';
import { listMovements } from '../movements/movements';

import { costOfMoney } from './cost-of-money';

const owner = ownerId('david');
const DESDE = '2026-08-01T00:00:00.000-05:00';
const HASTA = '2026-08-31T23:59:59.000-05:00';

function deps() {
  const base = categorizationDeps();
  const d: IngestDeps & CategorizationDeps = {
    ...base,
    ingest: createInMemoryIngestRepository(),
    transfers: createInMemoryTransferRepository(),
    clock: () => HASTA,
  };
  return { ...d, accounts: base.accounts, transactions: base.transactions };
}

const gasto = (descripcion: string, fecha: string, monto: number): NormalizedTransaction => ({
  fecha,
  descripcion,
  monto,
  moneda: 'COP',
  tipo: 'debito',
  fuente: 'bancolombia',
  referencia: `${descripcion}-${fecha}-${String(monto)}`,
});

async function sembrar(d: ReturnType<typeof deps>, lote: NormalizedTransaction[]) {
  await ensureDefaultCategories(d, owner);
  await ingestNormalized(d, {
    owner,
    fuente: 'bancolombia',
    canal: 'web' as const,
    nombreFuente: 'Bancolombia',
    lote,
    capturadoEn: HASTA,
  });
  await classifyUnclassified(d, { owner });
}

describe('los cargos del banco se clasifican solos', () => {
  /**
   * El catálogo del sprint 05 ya reconoce el 4×1000, la cuota de manejo y los
   * intereses. Esta prueba lo ata: si alguien tocara ese catálogo, todo el
   * cálculo de costos se quedaría en cero sin decir nada.
   */
  it('el 4x1000 entra clasificado, sin pasar por revisión', async () => {
    const d = deps();
    await sembrar(d, [gasto('GMF 4X1000', '2026/08/20', 4000)]);

    const { items } = await listMovements(d, { owner });
    expect(items[0]?.categoria?.id).toBe(categoryAccountId('cuatro-por-mil'));
    expect(items[0]?.sinClasificar).toBe(false);
  });

  it('la cuota de manejo también', async () => {
    const d = deps();
    await sembrar(d, [gasto('CUOTA DE MANEJO TARJETA', '2026/08/05', 18000)]);

    const { items } = await listMovements(d, { owner });
    expect(items[0]?.categoria?.id).toBe(categoryAccountId('comisiones-bancarias'));
  });
});

describe('costOfMoney', () => {
  it('suma los cargos del periodo y los desglosa', async () => {
    const d = deps();
    await sembrar(d, [
      gasto('GMF 4X1000', '2026/08/20', 4000),
      gasto('CUOTA DE MANEJO', '2026/08/05', 18000),
    ]);

    const costo = await costOfMoney(d, { owner, desde: DESDE, hasta: HASTA });

    expect(costo.total.amount).toBe(22_000n);
    expect(costo.porTipo['cuatro-por-mil'].amount).toBe(4_000n);
    expect(costo.porTipo['comisiones-bancarias'].amount).toBe(18_000n);
    expect(costo.porTipo['seguros'].amount).toBe(0n);
  });

  /**
   * «$22.000» dice poco; «el 2 % de lo que moviste» dice qué hacer.
   */
  it('lo dice también como proporción de lo movido', async () => {
    const d = deps();
    await sembrar(d, [
      gasto('GMF 4X1000', '2026/08/20', 4000),
      gasto('COMPRA EXITO', '2026/08/20', 996_000),
    ]);

    const costo = await costOfMoney(d, { owner, desde: DESDE, hasta: HASTA });

    expect(costo.movido.amount).toBe(996_000n);
    expect(costo.proporcion).toBeCloseTo(0.004, 4);
  });

  it('con un periodo sin movimientos no divide por cero', async () => {
    const d = deps();

    const costo = await costOfMoney(d, { owner, desde: DESDE, hasta: HASTA });

    expect(costo.total.amount).toBe(0n);
    expect(costo.proporcion).toBe(0);
    expect(costo.masCaro).toBeNull();
  });

  it('los cargos de otro periodo no entran', async () => {
    const d = deps();
    await sembrar(d, [gasto('GMF 4X1000', '2026/07/20', 4000)]);

    expect((await costOfMoney(d, { owner, desde: DESDE, hasta: HASTA })).total.amount).toBe(0n);
  });

  /**
   * Lo único de todo esto que puede cambiar una conducta: no «pagaste $4.000
   * de impuesto», sino «mandar ese millón te costó $4.000».
   */
  it('señala el movimiento que más caro salió', async () => {
    const d = deps();
    await sembrar(d, [
      gasto('TRANSFERENCIA A TERCERO', '2026/08/20', 1_000_000),
      gasto('GMF 4X1000', '2026/08/20', 4000),
      gasto('TRANSFERENCIA CHICA', '2026/08/10', 100_000),
      gasto('GMF 4X1000 B', '2026/08/10', 400),
    ]);

    const costo = await costOfMoney(d, { owner, desde: DESDE, hasta: HASTA });

    expect(costo.masCaro?.costo.amount).toBe(4_000n);
  });

  it('un cargo agrupado no se atribuye a ningún movimiento', async () => {
    const d = deps();
    await sembrar(d, [
      gasto('TRANSFERENCIA A TERCERO', '2026/08/20', 1_000_000),
      // 12.000 no es el 4×1000 de ninguna salida sola.
      gasto('GMF 4X1000', '2026/08/20', 12_000),
    ]);

    expect((await costOfMoney(d, { owner, desde: DESDE, hasta: HASTA })).masCaro).toBeNull();
  });
});
