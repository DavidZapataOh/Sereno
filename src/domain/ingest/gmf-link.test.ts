import { transactionId } from '@/domain/ledger/ids';
import { money } from '@/domain/money/money';

import { emparejarGmf, type MovimientoParaAtar } from './gmf-link';

const mov = (id: string, fecha: string, monto: number): MovimientoParaAtar => ({
  id: transactionId(id),
  fecha: `${fecha}T10:00:00.000-05:00`,
  monto: money(monto, 'COP'),
});

const gmf = (monto: number, fecha: string, id = `gmf-${fecha}-${String(monto)}`) =>
  mov(id, fecha, monto);
const salida = (monto: number, fecha: string, id = `sal-${fecha}-${String(monto)}`) =>
  mov(id, fecha, monto);

describe('emparejarGmf', () => {
  /**
   * La tasa es exactamente cuatro por cada mil y está en la ley: con la salida
   * y el cargo, la cuenta cierra sola.
   */
  it('empareja por la tasa: el cargo es el 4 por mil de la salida', () => {
    const pares = emparejarGmf([gmf(4_000, '2026-08-20')], [salida(1_000_000, '2026-08-20')]);

    expect(pares.size).toBe(1);
    expect([...pares.values()][0]).toBe('sal-2026-08-20-1000000');
  });

  it('acepta el redondeo del banco', () => {
    expect(emparejarGmf([gmf(4_001, '2026-08-20')], [salida(1_000_000, '2026-08-20')]).size).toBe(
      1,
    );
    expect(emparejarGmf([gmf(3_999, '2026-08-20')], [salida(1_000_000, '2026-08-20')]).size).toBe(
      1,
    );
  });

  it('el cargo nunca es anterior a lo que lo causó', () => {
    // Un cargo del 19 no puede venir de una salida del 20.
    expect(emparejarGmf([gmf(4_000, '2026-08-19')], [salida(1_000_000, '2026-08-20')]).size).toBe(
      0,
    );
  });

  it('el cargo del día siguiente sí cuenta', () => {
    expect(emparejarGmf([gmf(4_000, '2026-08-21')], [salida(1_000_000, '2026-08-20')]).size).toBe(
      1,
    );
  });

  it('un cargo de días después ya no se ata', () => {
    expect(emparejarGmf([gmf(4_000, '2026-08-25')], [salida(1_000_000, '2026-08-20')]).size).toBe(
      0,
    );
  });

  /**
   * **Atarlo mal es peor que no atarlo.** Los bancos agrupan el GMF del día;
   * si el cargo no cuadra con ninguna salida sola, viene de varias, y esa es
   * la verdad. Un número que parece preciso y no lo es se propaga a todas las
   * pantallas de encima.
   */
  it('un cargo agrupado de varias salidas no se empareja a la fuerza', () => {
    const pares = emparejarGmf(
      [gmf(12_000, '2026-08-20')],
      [salida(1_000_000, '2026-08-20'), salida(2_000_000, '2026-08-20')],
    );

    expect(pares.size).toBe(0);
  });

  it('con dos salidas posibles elige la más cercana en el tiempo', () => {
    const pares = emparejarGmf(
      [gmf(4_000, '2026-08-21')],
      [salida(1_000_000, '2026-08-20', 'cercana'), salida(1_000_000, '2026-08-19', 'lejana')],
    );

    expect([...pares.values()][0]).toBe('cercana');
  });

  it('una salida no se usa dos veces', () => {
    const pares = emparejarGmf(
      [gmf(4_000, '2026-08-20', 'g1'), gmf(4_000, '2026-08-20', 'g2')],
      [salida(1_000_000, '2026-08-20')],
    );

    expect(pares.size).toBe(1);
  });

  it('dos cargos con dos salidas se atan uno a uno', () => {
    const pares = emparejarGmf(
      [gmf(4_000, '2026-08-20', 'g1'), gmf(8_000, '2026-08-20', 'g2')],
      [salida(1_000_000, '2026-08-20', 's1'), salida(2_000_000, '2026-08-20', 's2')],
    );

    expect(pares.get(transactionId('g1'))).toBe('s1');
    expect(pares.get(transactionId('g2'))).toBe('s2');
  });

  it('no cruza monedas', () => {
    const cargoUsd = { ...gmf(4_000, '2026-08-20'), monto: money(4_000, 'USD') };

    expect(emparejarGmf([cargoUsd], [salida(1_000_000, '2026-08-20')]).size).toBe(0);
  });

  it('sin cargos ni salidas no inventa nada', () => {
    expect(emparejarGmf([], [salida(1_000_000, '2026-08-20')]).size).toBe(0);
    expect(emparejarGmf([gmf(4_000, '2026-08-20')], []).size).toBe(0);
  });
});
