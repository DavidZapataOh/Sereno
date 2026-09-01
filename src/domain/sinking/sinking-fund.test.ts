import { accountId, ownerId } from '@/domain/ledger/ids';
import { money } from '@/domain/money/money';

import {
  alcanzaATiempo,
  aporteMensual,
  createSinkingFund,
  mesesHasta,
  siguienteCiclo,
  type SinkingFund,
} from './sinking-fund';

const COP = 'COP' as const;
const HOY = '2026-09-15';

/** Un seguro anual de 1.200.000 que se paga en septiembre del año que viene. */
const seguro: SinkingFund = createSinkingFund({
  accountId: accountId('fondo:seguro'),
  owner: ownerId('david'),
  nombre: 'Seguro del carro',
  objetivo: money(1_200_000, COP),
  proximaFecha: '2027-09-01',
  cadaMeses: 12,
});

describe('createSinkingFund', () => {
  it('acepta un fondo corriente', () => {
    expect(seguro.nombre).toBe('Seguro del carro');
  });

  it('exige nombre, objetivo positivo y fecha con forma', () => {
    expect(() => createSinkingFund({ ...seguro, nombre: '  ' })).toThrow(/nombre/i);
    expect(() => createSinkingFund({ ...seguro, objetivo: money(0, COP) })).toThrow(/positivo/i);
    expect(() => createSinkingFund({ ...seguro, proximaFecha: '01/09/2027' })).toThrow(
      /AAAA-MM-DD/,
    );
  });

  it('rechaza una repetición que no son meses enteros', () => {
    expect(() => createSinkingFund({ ...seguro, cadaMeses: 0 })).toThrow(/meses/i);
    expect(() => createSinkingFund({ ...seguro, cadaMeses: 1.5 })).toThrow(/meses/i);
  });
});

describe('mesesHasta', () => {
  it('cuenta los meses que faltan', () => {
    expect(mesesHasta('2027-09-01', HOY)).toBe(12);
  });

  it('el mismo mes son cero', () => {
    expect(mesesHasta('2026-09-30', HOY)).toBe(0);
  });

  it('una fecha pasada da negativo', () => {
    expect(mesesHasta('2026-07-01', HOY)).toBe(-2);
  });
});

describe('aporteMensual', () => {
  it('reparte lo que falta entre los meses que quedan', () => {
    // Un año por delante: doce meses más el actual, trece repartos.
    const aporte = aporteMensual(seguro, money(0, COP), HOY);

    expect(aporte.amount).toBeGreaterThan(90_000n);
    expect(aporte.amount).toBeLessThan(93_000n);
  });

  it('con algo ya apartado, el aporte baja', () => {
    const vacio = aporteMensual(seguro, money(0, COP), HOY);
    const medio = aporteMensual(seguro, money(600_000, COP), HOY);

    expect(medio.amount).toBeLessThan(vacio.amount);
  });

  /**
   * El mes del cobro no da margen: si falta plata, hace falta toda ahora. Un
   * aporte «suavizado» ahí engañaría justo cuando ya no se puede reaccionar.
   */
  it('el mes del cobro pide todo lo que falte', () => {
    const esteMes = { ...seguro, proximaFecha: '2026-09-30' };

    expect(aporteMensual(esteMes, money(900_000, COP), HOY).amount).toBe(300_000n);
  });

  it('si ya está completo, el aporte es cero y no negativo', () => {
    expect(aporteMensual(seguro, money(1_200_000, COP), HOY).amount).toBe(0n);
    expect(aporteMensual(seguro, money(1_500_000, COP), HOY).amount).toBe(0n);
  });

  /**
   * Redondear hacia abajo dejaría el fondo corto justo el último mes, que es
   * cuando ya no hay tiempo de reaccionar.
   */
  it('aportando cada mes lo que dice, el fondo llega completo y sin pasarse mucho', () => {
    let apartado = money(0, COP);

    // Mes a mes de verdad, desde septiembre de 2026 hasta el cobro.
    for (let i = 0; i <= 12; i += 1) {
      const total = 2026 * 12 + 8 + i;
      const hoy = `${String(Math.floor(total / 12))}-${String((total % 12) + 1).padStart(2, '0')}-15`;
      apartado = money(apartado.amount + aporteMensual(seguro, apartado, hoy).amount, COP);
    }

    expect(apartado.amount).toBeGreaterThanOrEqual(1_200_000n);
    // Y sin apartar de más: el redondeo hacia arriba cuesta unos pesos, no miles.
    expect(apartado.amount).toBeLessThan(1_201_000n);
  });
});

describe('alcanzaATiempo', () => {
  it('con el aporte que toca, alcanza', () => {
    const aporte = aporteMensual(seguro, money(0, COP), HOY);

    expect(alcanzaATiempo(seguro, money(0, COP), aporte, HOY)).toBe(true);
  });

  it('con un aporte demasiado pequeño, no alcanza', () => {
    expect(alcanzaATiempo(seguro, money(0, COP), money(10_000, COP), HOY)).toBe(false);
  });

  it('un fondo ya completo alcanza aunque no se aporte nada', () => {
    expect(alcanzaATiempo(seguro, money(1_200_000, COP), money(0, COP), HOY)).toBe(true);
  });
});

describe('siguienteCiclo', () => {
  it('un gasto anual pagado se reproyecta al año siguiente', () => {
    expect(siguienteCiclo(seguro).proximaFecha).toBe('2028-09-01');
  });

  it('uno semestral salta seis meses, cruzando el año', () => {
    const semestral = createSinkingFund({ ...seguro, proximaFecha: '2026-10-01', cadaMeses: 6 });

    expect(siguienteCiclo(semestral).proximaFecha).toBe('2027-04-01');
  });
});
