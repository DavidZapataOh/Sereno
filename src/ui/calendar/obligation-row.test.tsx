import type { Obligation } from '@/domain/calendar/obligation';
import { money } from '@/domain/money/money';
import { renderWithProviders } from '@/test/render';

import { ObligationRow, TEXTO_CALENDARIO } from './obligation-row';

const base: Obligation = {
  id: 'suscripcion:netflix:2026-09-20',
  origen: 'suscripcion',
  nombre: 'Netflix',
  monto: money(38_900, 'COP'),
  vence: '2026-09-20',
  estado: 'pendiente',
  accountId: null,
};

describe('ObligationRow', () => {
  it('enseña qué es, cuánto y cuándo vence', async () => {
    const { getByText } = await renderWithProviders(<ObligationRow obligacion={base} />);

    expect(getByText('Netflix')).toBeOnTheScreen();
    expect(getByText('$ 38.900')).toBeOnTheScreen();
    expect(getByText(/Suscripción/)).toBeOnTheScreen();
  });

  /** Sin verde de premio: celebrar un pago convierte la pantalla en un juego. */
  it('lo pagado se ve pagado, sin celebrarlo', async () => {
    const { getByText } = await renderWithProviders(
      <ObligationRow obligacion={{ ...base, estado: 'pagada' }} />,
    );

    expect(getByText(TEXTO_CALENDARIO.estado.pagada)).toBeOnTheScreen();
  });

  /**
   * El color solo excluye a quien no lo distingue, y en una pantalla de
   * vencimientos eso es dinero.
   */
  it('lo vencido lo dice con palabras, no solo con color', async () => {
    const { getByText } = await renderWithProviders(
      <ObligationRow obligacion={{ ...base, estado: 'vencida' }} />,
    );

    expect(getByText(/Se pasó la fecha/)).toBeOnTheScreen();
  });

  /**
   * El monto de una tarjeta no se sabe hasta que cierra el ciclo. Enseñar cero
   * sería inventar una cifra que quien la lee tomaría por buena.
   */
  it('una tarjeta sin monto conocido lo dice, en vez de enseñar cero', async () => {
    const { getByText, queryByText } = await renderWithProviders(
      <ObligationRow
        obligacion={{ ...base, origen: 'tarjeta', nombre: 'RappiCard', monto: null }}
      />,
    );

    expect(getByText(new RegExp(TEXTO_CALENDARIO.montoDesconocido))).toBeOnTheScreen();
    expect(queryByText('$ 0')).toBeNull();
  });
});
