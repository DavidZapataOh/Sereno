import { transactionId } from '@/domain/ledger/ids';
import { money } from '@/domain/money/money';

import { detectSubscriptions } from './detect';
import type { CobroCandidato } from './subscription';

const HOY = '2026-08-31T10:00:00.000-05:00';

let contador = 0;
function cobro(extra: Partial<CobroCandidato> & { fecha: string }): CobroCandidato {
  contador += 1;
  return {
    id: transactionId(`tx-${String(contador)}`),
    monto: money(38_900, 'COP'),
    claveComercio: 'netflix',
    nombreComercio: 'Netflix',
    esTransferencia: false,
    sale: true,
    ...extra,
  };
}

const netflix = (fechas: string[], monto = 38_900) =>
  fechas.map((f) => cobro({ fecha: `${f}T10:00:00.000-05:00`, monto: money(monto, 'COP') }));

/** Cien compras variadas: el ruido de un mes normal. */
function ruido(): CobroCandidato[] {
  return Array.from({ length: 100 }, (_, i) =>
    cobro({
      fecha: `2026-0${String((i % 4) + 5)}-${String((i % 27) + 1).padStart(2, '0')}T10:00:00.000-05:00`,
      claveComercio: `comercio-${String(i % 30)}`,
      nombreComercio: `Comercio ${String(i % 30)}`,
      monto: money(1000 * ((i % 50) + 1), 'COP'),
    }),
  );
}

describe('detectSubscriptions', () => {
  it('detecta Netflix entre el ruido de un mes normal', () => {
    const subs = detectSubscriptions(
      [...netflix(['2026-05-05', '2026-06-04', '2026-07-06', '2026-08-05']), ...ruido()],
      HOY,
    );

    const netflixSub = subs.find((s) => s.clave === 'netflix');
    expect(netflixSub).toMatchObject({ comercio: 'Netflix', cadencia: 'mensual' });
    expect(netflixSub?.cobros).toHaveLength(4);
  });

  it('agrupa por el comercio normalizado, no por la descripción cruda', () => {
    // «NETFLIX.COM 1234», «NETFLIX COM» y «Netflix» comparten clave desde el
    // sprint 05: si no, serían tres cosas y no se detectaría ninguna.
    const subs = detectSubscriptions(
      netflix(['2026-05-05', '2026-06-05', '2026-07-05']).map((c, i) => ({
        ...c,
        nombreComercio: ['NETFLIX.COM 1234', 'NETFLIX COM', 'Netflix'][i] ?? 'Netflix',
      })),
      HOY,
    );

    expect(subs).toHaveLength(1);
  });

  /**
   * El precio de una suscripción sube. Si un cambio de precio partiera la
   * serie en dos, se perdería justo el caso que más interesa avisar.
   */
  it('un cambio de precio no parte la suscripción en dos', () => {
    const subs = detectSubscriptions(
      [
        ...netflix(['2026-05-05', '2026-06-05'], 38_900),
        ...netflix(['2026-07-05', '2026-08-05'], 44_900),
      ],
      HOY,
    );

    expect(subs).toHaveLength(1);
    // El más reciente manda: es lo que van a cobrar.
    expect(subs[0]?.monto.amount).toBe(44_900n);
    expect(subs[0]?.historial).toHaveLength(4);
  });

  it('calcula el próximo cobro un periodo después del último', () => {
    const subs = detectSubscriptions(netflix(['2026-06-05', '2026-07-05', '2026-08-05']), HOY);

    expect(subs[0]?.ultimoCobro).toBe('2026-08-05');
    expect(subs[0]?.proximoCobro).toBe('2026-09-04');
  });

  /**
   * Decir «próximo cobro» de algo cancelado hace tres meses es peor que no
   * decir nada.
   */
  it('una suscripción cancelada deja de tener próximo cobro', () => {
    const subs = detectSubscriptions(netflix(['2026-01-05', '2026-02-05', '2026-03-05']), HOY);

    expect(subs[0]?.proximoCobro).toBeNull();
  });

  it('un retraso de un periodo todavía no la da por cancelada', () => {
    const subs = detectSubscriptions(netflix(['2026-05-05', '2026-06-05', '2026-07-05']), HOY);

    expect(subs[0]?.proximoCobro).not.toBeNull();
  });

  it('no confunde el arriendo con una suscripción de comercio', () => {
    // Mensual y clavado, pero es una transferencia entre cuentas propias.
    const arriendo = netflix(['2026-05-05', '2026-06-05', '2026-07-05']).map((c) => ({
      ...c,
      esTransferencia: true,
      claveComercio: 'arriendo',
    }));

    expect(detectSubscriptions(arriendo, HOY)).toHaveLength(0);
  });

  it('un ingreso recurrente es una nómina, no una suscripción', () => {
    const nomina = netflix(['2026-05-30', '2026-06-30', '2026-07-30']).map((c) => ({
      ...c,
      sale: false,
      claveComercio: 'empresa',
    }));

    expect(detectSubscriptions(nomina, HOY)).toHaveLength(0);
  });

  it('tres cafés en la misma cafetería no son una suscripción', () => {
    const cafes = ['2026-08-03', '2026-08-04', '2026-08-19'].map((f) =>
      cobro({ fecha: `${f}T10:00:00.000-05:00`, claveComercio: 'cafe', nombreComercio: 'Café' }),
    );

    expect(detectSubscriptions(cafes, HOY)).toHaveLength(0);
  });

  it('con dos cobros todavía no dice nada', () => {
    expect(detectSubscriptions(netflix(['2026-07-05', '2026-08-05']), HOY)).toHaveLength(0);
  });

  it('las ordena por el próximo cobro, y las canceladas al final', () => {
    const subs = detectSubscriptions(
      [
        ...netflix(['2026-06-20', '2026-07-20', '2026-08-20']),
        ...netflix(['2026-06-05', '2026-07-05', '2026-08-05']).map((c) => ({
          ...c,
          claveComercio: 'spotify',
          nombreComercio: 'Spotify',
        })),
        ...netflix(['2026-01-01', '2026-02-01', '2026-03-01']).map((c) => ({
          ...c,
          claveComercio: 'viejo',
          nombreComercio: 'Viejo',
        })),
      ],
      HOY,
    );

    expect(subs.map((s) => s.clave)).toEqual(['spotify', 'netflix', 'viejo']);
  });

  it('sin movimientos no inventa nada', () => {
    expect(detectSubscriptions([], HOY)).toEqual([]);
  });
});
