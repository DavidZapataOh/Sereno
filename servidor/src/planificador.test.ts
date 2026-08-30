import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { crearPlanificador } from './planificador';

const observabilidad = { log: () => undefined, captureError: vi.fn() };

describe('planificador', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    observabilidad.captureError.mockClear();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('corre al arrancar y luego cada intervalo', async () => {
    const tarea = vi.fn().mockResolvedValue(undefined);
    const p = crearPlanificador({ intervaloMs: 1000, tarea, observabilidad });
    p.arrancar();
    await vi.advanceTimersByTimeAsync(0);
    expect(tarea).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(2500);
    expect(tarea).toHaveBeenCalledTimes(3);
    p.parar();
  });

  it('no se solapa: si una pasada tarda más que el intervalo, no arranca otra encima', async () => {
    let resolver = (): void => undefined;
    const tarea = vi.fn().mockImplementation(
      () =>
        new Promise<void>((r) => {
          resolver = r;
        }),
    );
    const p = crearPlanificador({ intervaloMs: 100, tarea, observabilidad });
    p.arrancar();
    await vi.advanceTimersByTimeAsync(0);

    await vi.advanceTimersByTimeAsync(1000);
    expect(tarea).toHaveBeenCalledTimes(1);

    resolver();
    await vi.advanceTimersByTimeAsync(200);
    expect(tarea).toHaveBeenCalledTimes(2);
    p.parar();
  });

  it('un fallo no mata el ciclo: se registra y se vuelve a intentar', async () => {
    const tarea = vi.fn().mockRejectedValueOnce(new Error('se cayó')).mockResolvedValue(undefined);
    const p = crearPlanificador({ intervaloMs: 100, tarea, observabilidad });
    p.arrancar();
    await vi.advanceTimersByTimeAsync(0);
    expect(observabilidad.captureError).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(150);
    expect(tarea).toHaveBeenCalledTimes(2);
    p.parar();
  });

  it('parar detiene de verdad', async () => {
    const tarea = vi.fn().mockResolvedValue(undefined);
    const p = crearPlanificador({ intervaloMs: 100, tarea, observabilidad });
    p.arrancar();
    await vi.advanceTimersByTimeAsync(0);
    p.parar();
    await vi.advanceTimersByTimeAsync(1000);
    expect(tarea).toHaveBeenCalledTimes(1);
  });

  it('arrancar dos veces no duplica el ciclo', async () => {
    const tarea = vi.fn().mockResolvedValue(undefined);
    const p = crearPlanificador({ intervaloMs: 100, tarea, observabilidad });
    p.arrancar();
    p.arrancar();
    await vi.advanceTimersByTimeAsync(250);
    // Una al arrancar y dos intervalos: si se hubiera duplicado, serían seis.
    expect(tarea).toHaveBeenCalledTimes(3);
    p.parar();
  });
});
