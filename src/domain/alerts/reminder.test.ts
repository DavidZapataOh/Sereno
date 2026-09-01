import type { Obligation } from '@/domain/calendar/obligation';
import { accountId } from '@/domain/ledger/ids';
import { money } from '@/domain/money/money';

import { recordatoriosDe } from './reminder';
import {
  AJUSTES_POR_DEFECTO,
  createReminderSettings,
  MAXIMO_DIAS_ANTES,
} from './reminder-settings';

const AHORA = '2026-09-10T08:00:00.000-05:00';

const obligacion = (extra: Partial<Obligation> = {}): Obligation => ({
  id: 'tarjeta:rappicard:2026-09-20',
  origen: 'tarjeta',
  nombre: 'RappiCard',
  monto: money(1_234_567, 'COP'),
  vence: '2026-09-20',
  estado: 'pendiente',
  accountId: accountId('rappicard:tarjeta'),
  ...extra,
});

describe('recordatoriosDe', () => {
  it('avisa con la antelación configurada, a la hora configurada', () => {
    const [aviso] = recordatoriosDe(
      [obligacion()],
      { diasAntes: 2, hora: 9, silenciado: false },
      AHORA,
    );

    expect(aviso?.cuando).toBe('2026-09-18T09:00:00.000-05:00');
  });

  /** Lo que hace inútil una app de recordatorios. */
  it('no avisa de lo que ya está pagado', () => {
    expect(recordatoriosDe([obligacion({ estado: 'pagada' })], AJUSTES_POR_DEFECTO, AHORA)).toEqual(
      [],
    );
  });

  /**
   * Una obligación que vence mañana con tres días de antelación tendría su
   * aviso anteayer: dispararlo al abrir sería ruido, y el ruido es lo que hace
   * que se dejen de mirar todos los demás.
   */
  it('no programa avisos en el pasado', () => {
    const manana = obligacion({ vence: '2026-09-11' });

    expect(recordatoriosDe([manana], { diasAntes: 3, hora: 9, silenciado: false }, AHORA)).toEqual(
      [],
    );
  });

  /**
   * Una notificación se lee en la pantalla de bloqueo, delante de quien pase.
   * Decir ahí cuánto se debe es enseñarle la deuda a cualquiera.
   */
  it('el texto no lleva ningún monto', () => {
    const avisos = recordatoriosDe([obligacion()], AJUSTES_POR_DEFECTO, AHORA);

    for (const a of avisos) {
      expect(`${a.titulo} ${a.cuerpo}`).not.toMatch(/1[.,]?234/);
      expect(`${a.titulo} ${a.cuerpo}`).not.toMatch(/\d{4,}/);
    }
  });

  it('silenciado no produce ni un aviso', () => {
    expect(
      recordatoriosDe([obligacion()], { ...AJUSTES_POR_DEFECTO, silenciado: true }, AHORA),
    ).toEqual([]);
  });

  it('dos obligaciones el mismo día son dos avisos, no uno mezclado', () => {
    const avisos = recordatoriosDe(
      [
        obligacion(),
        obligacion({ id: 'cuota:prestamo:2026-09-20', origen: 'cuota', nombre: 'Crédito' }),
      ],
      AJUSTES_POR_DEFECTO,
      AHORA,
    );

    expect(avisos).toHaveLength(2);
    expect(new Set(avisos.map((a) => a.id)).size).toBe(2);
  });

  /** Reprogramar entero no puede dejar el doble de avisos. */
  it('el id es estable: dos llamadas dan los mismos', () => {
    const a = recordatoriosDe([obligacion()], AJUSTES_POR_DEFECTO, AHORA);
    const b = recordatoriosDe([obligacion()], AJUSTES_POR_DEFECTO, AHORA);

    expect(a.map((x) => x.id)).toEqual(b.map((x) => x.id));
  });

  it('el texto dice de qué es y cuándo vence', () => {
    const [aviso] = recordatoriosDe([obligacion()], AJUSTES_POR_DEFECTO, AHORA);

    expect(aviso?.titulo).toMatch(/tarjeta/i);
    expect(aviso?.cuerpo).toContain('RappiCard');
    expect(aviso?.cuerpo).toContain('20/9');
  });

  it('con cero días de antelación avisa el mismo día', () => {
    const [aviso] = recordatoriosDe(
      [obligacion()],
      { diasAntes: 0, hora: 9, silenciado: false },
      AHORA,
    );

    expect(aviso?.cuando).toBe('2026-09-20T09:00:00.000-05:00');
  });
});

describe('createReminderSettings', () => {
  it('rechaza una antelación negativa o absurda', () => {
    expect(() => createReminderSettings({ diasAntes: -1, hora: 9, silenciado: false })).toThrow();
    expect(() =>
      createReminderSettings({ diasAntes: MAXIMO_DIAS_ANTES + 1, hora: 9, silenciado: false }),
    ).toThrow(/no sirve/);
  });

  it('rechaza una hora que no existe', () => {
    expect(() => createReminderSettings({ diasAntes: 1, hora: 24, silenciado: false })).toThrow(
      /0 a 23/,
    );
  });

  it('por defecto avisa un día antes, por la mañana', () => {
    expect(AJUSTES_POR_DEFECTO.diasAntes).toBe(1);
    expect(AJUSTES_POR_DEFECTO.hora).toBeLessThan(12);
    expect(AJUSTES_POR_DEFECTO.silenciado).toBe(false);
  });
});
