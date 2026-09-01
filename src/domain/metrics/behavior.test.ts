import { money } from '@/domain/money/money';

import {
  antiguedadDelDinero,
  deudaSobreIngreso,
  MESES_MINIMOS,
  mesesDeColchon,
  tasaDeAhorro,
  type MovimientoDeCaja,
} from './behavior';

const COP = 'COP' as const;
const mov = (dia: string, monto: number): MovimientoDeCaja => ({ dia, monto: money(monto, COP) });

describe('antiguedadDelDinero', () => {
  it('gastar lo que entró ayer da un día de antigüedad', () => {
    const m = antiguedadDelDinero([mov('2026-09-01', 100_000)], [mov('2026-09-02', 100_000)], 3);

    expect(m?.valor).toBe(1);
  });

  it('gastar lo que entró hace un mes da unos treinta días', () => {
    const m = antiguedadDelDinero([mov('2026-08-01', 100_000)], [mov('2026-08-31', 100_000)], 3);

    expect(m?.valor).toBe(30);
  });

  /**
   * FIFO: cada peso que sale es el peso más viejo que entró. Sin eso, gastar
   * hoy lo que entró hoy diría que se vive al día aunque haya colchón.
   */
  it('gasta primero lo más viejo, aunque haya entrado algo hoy', () => {
    const m = antiguedadDelDinero(
      [mov('2026-08-01', 100_000), mov('2026-08-31', 100_000)],
      [mov('2026-08-31', 100_000)],
      3,
    );

    expect(m?.valor).toBe(30);
  });

  it('promedia la edad de lo gastado, ponderando por monto', () => {
    // 100.000 de hace 30 días y 300.000 de hace 10: el promedio pesa hacia 10.
    const m = antiguedadDelDinero(
      [mov('2026-08-01', 100_000), mov('2026-08-21', 300_000)],
      [mov('2026-08-31', 400_000)],
      3,
    );

    expect(m?.valor).toBe(15);
  });

  /** Un número de dos semanas presentado como un hecho es peor que un hueco. */
  it('sin suficiente historia devuelve null, no un número', () => {
    expect(antiguedadDelDinero([mov('2026-09-01', 1)], [mov('2026-09-02', 1)], 1)).toBeNull();
    expect(MESES_MINIMOS).toBeGreaterThanOrEqual(2);
  });

  it('sin entradas o sin salidas no hay nada que medir', () => {
    expect(antiguedadDelDinero([], [mov('2026-09-02', 1)], 3)).toBeNull();
    expect(antiguedadDelDinero([mov('2026-09-01', 1)], [], 3)).toBeNull();
  });

  /** Gastar antes de que entre nada no da antigüedad negativa. */
  it('nunca devuelve días negativos', () => {
    const m = antiguedadDelDinero([mov('2026-09-10', 100_000)], [mov('2026-09-01', 100_000)], 3);

    expect(m === null || m.valor >= 0).toBe(true);
  });

  it('gastar más de lo que entró no revienta', () => {
    const m = antiguedadDelDinero([mov('2026-08-01', 50_000)], [mov('2026-08-31', 200_000)], 3);

    expect(m?.valor).toBe(30);
  });
});

describe('tasaDeAhorro', () => {
  it('ahorrar un quinto de lo que entra da 20 %', () => {
    expect(tasaDeAhorro(money(1_000_000, COP), money(800_000, COP), 3)?.valor).toBe(20);
  });

  /** Recortarlo a cero escondería justo el mes que hay que ver. */
  it('gastar más de lo que entra da negativo, y no se recorta', () => {
    expect(tasaDeAhorro(money(1_000_000, COP), money(1_300_000, COP), 3)?.valor).toBe(-30);
  });

  it('sin ingreso no se puede calcular', () => {
    expect(tasaDeAhorro(money(0, COP), money(100, COP), 3)).toBeNull();
  });
});

describe('mesesDeColchon', () => {
  it('con seis meses de gasto guardado, da seis', () => {
    expect(mesesDeColchon(money(6_000_000, COP), money(1_000_000, COP), 3)?.valor).toBe(6);
  });

  it('sin gasto medido todavía, devuelve null', () => {
    expect(mesesDeColchon(money(1_000_000, COP), money(0, COP), 3)).toBeNull();
  });
});

describe('deudaSobreIngreso', () => {
  it('deber tres veces lo que se gana en un mes da 3', () => {
    expect(deudaSobreIngreso(money(9_000_000, COP), money(3_000_000, COP), 3)?.valor).toBe(3);
  });

  /** En el ledger un pasivo es negativo: se mira el tamaño, no el signo. */
  it('una deuda negativa se mide igual', () => {
    expect(deudaSobreIngreso(money(-9_000_000, COP), money(3_000_000, COP), 3)?.valor).toBe(3);
  });

  it('sin deuda da cero, que es un dato y no un hueco', () => {
    expect(deudaSobreIngreso(money(0, COP), money(3_000_000, COP), 3)?.valor).toBe(0);
  });
});

describe('todas las métricas', () => {
  const todas = [
    antiguedadDelDinero([mov('2026-08-01', 100_000)], [mov('2026-08-31', 100_000)], 3),
    tasaDeAhorro(money(1_000_000, COP), money(800_000, COP), 3),
    mesesDeColchon(money(6_000_000, COP), money(1_000_000, COP), 3),
    deudaSobreIngreso(money(3_000_000, COP), money(3_000_000, COP), 3),
  ];

  /** Un número solo no sirve: hay que saber qué lo movería. */
  it('cada una trae qué la movería, y no está vacío', () => {
    for (const m of todas) {
      expect(m?.queLaMueve.trim().length).toBeGreaterThan(10);
    }
  });

  it('cada una dice sobre cuántos meses se calculó', () => {
    for (const m of todas) expect(m?.meses).toBe(3);
  });

  /** Son medidas, no notas: ni felicitan ni regañan. */
  it('ningún texto califica al usuario', () => {
    for (const m of todas) {
      expect(m?.queLaMueve).not.toMatch(/deberías|tienes que|mal|bien hecho|felicidades/i);
    }
  });

  it('cada una tiene clave distinta', () => {
    const claves = todas.map((m) => m?.clave);
    expect(new Set(claves).size).toBe(claves.length);
  });
});
