import { accountId, ownerId } from '@/domain/ledger/ids';
import { money } from '@/domain/money/money';

import {
  alcanzaATiempo,
  aporteMensual,
  createSinkingFund,
  mesesHasta,
  ritmoDe,
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
  tipo: 'gasto',
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

describe('metas de ahorro: el mismo fondo con otra intención', () => {
  /** Un viaje de 6.000.000 para dentro de un año, sin repetición. */
  const viaje: SinkingFund = createSinkingFund({
    ...seguro,
    tipo: 'meta',
    nombre: 'Viaje',
    objetivo: money(6_000_000, COP),
    proximaFecha: '2027-09-01',
    cadaMeses: null,
  });

  it('una meta no se repite', () => {
    expect(viaje.cadaMeses).toBeNull();
  });

  /** Una meta que se repite sola no es una meta: es un gasto recurrente. */
  it('rechaza una meta con repetición', () => {
    expect(() => createSinkingFund({ ...viaje, cadaMeses: 12 })).toThrow(/no se repite/);
  });

  it('una meta no se reproyecta al cumplirse: se cumplió', () => {
    expect(siguienteCiclo(viaje).proximaFecha).toBe('2027-09-01');
  });

  it('el aporte requerido se calcula igual que en un fondo', () => {
    const aporte = aporteMensual(viaje, money(0, COP), HOY);

    expect(aporte.amount).toBeGreaterThan(450_000n);
    expect(aporte.amount).toBeLessThan(470_000n);
  });
});

describe('ritmoDe', () => {
  const desde = '2026-09-15';
  const meta: SinkingFund = createSinkingFund({
    ...seguro,
    tipo: 'meta',
    nombre: 'Viaje',
    objetivo: money(1_200_000, COP),
    proximaFecha: '2027-09-01',
    cadaMeses: null,
  });

  it('recién creado está al día, no atrasado', () => {
    expect(ritmoDe(meta, money(0, COP), desde, desde).estado).toBe('al-dia');
  });

  it('con más de lo que tocaba, va adelantado', () => {
    // A los seis meses tocaría la mitad; con 900.000 va sobrado.
    expect(ritmoDe(meta, money(900_000, COP), '2027-03-15', desde).estado).toBe('adelantado');
  });

  it('con menos de lo que tocaba, va atrasado y dice cuánto', () => {
    const ritmo = ritmoDe(meta, money(100_000, COP), '2027-03-15', desde);

    expect(ritmo.estado).toBe('atrasado');
    expect(ritmo.diferencia.amount).toBeLessThan(0n);
  });

  /**
   * Exigir el céntimo exacto haría que «al día» no se alcanzara nunca, y un
   * estado inalcanzable no informa de nada.
   */
  it('una diferencia de unos pesos sigue siendo al día', () => {
    const tocaria = ritmoDe(meta, money(0, COP), '2027-03-15', desde).diferencia.amount;
    const casi = money(-tocaria - 500n, COP);

    expect(ritmoDe(meta, casi, '2027-03-15', desde).estado).toBe('al-dia');
  });
});
