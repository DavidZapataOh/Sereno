import { estadoDe } from './obligation';

const HOY = '2026-09-15T10:00:00.000-05:00';

describe('estadoDe', () => {
  it('lo que vence mañana y no se ha pagado está pendiente', () => {
    expect(estadoDe('2026-09-16', null, HOY)).toBe('pendiente');
  });

  it('lo que tiene pago es pagada, aunque haya vencido', () => {
    expect(estadoDe('2026-09-01', '2026-09-02', HOY)).toBe('pagada');
  });

  /**
   * Vencida y pendiente se enseñan distinto: una pide acción hoy y la otra
   * cabe en la semana. Mezclarlas hace inútil la pantalla.
   */
  it('lo que venció ayer sin pago está vencida', () => {
    expect(estadoDe('2026-09-14', null, HOY)).toBe('vencida');
  });

  /**
   * Un aviso de «vencida» a las ocho de la mañana del día de pago es falso: el
   * día todavía no ha terminado.
   */
  it('lo que vence hoy sigue pendiente hasta que acabe el día', () => {
    expect(estadoDe('2026-09-15', null, '2026-09-15T06:00:00.000-05:00')).toBe('pendiente');
    expect(estadoDe('2026-09-15', null, '2026-09-15T23:59:00.000-05:00')).toBe('pendiente');
  });

  /**
   * Las 22:00 en Colombia ya son el día siguiente en UTC. Comparar por
   * instante haría que una obligación venciera un día antes de tiempo.
   */
  it('compara por día en hora de Colombia, no por instante UTC', () => {
    expect(estadoDe('2026-09-15', null, '2026-09-15T22:00:00.000-05:00')).toBe('pendiente');
  });
});
