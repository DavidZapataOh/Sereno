import type { SubscriptionView } from '@/application/subscriptions/list-subscriptions';
import { transactionId } from '@/domain/ledger/ids';
import { money } from '@/domain/money/money';
import { renderWithProviders } from '@/test/render';

import { CADENCIA, SubscriptionRow, TEXTO_SUSCRIPCIONES } from './subscription-row';

const HOY = '2026-08-31T15:00:00.000-05:00';

const base: SubscriptionView = {
  clave: 'netflix',
  comercio: 'Netflix',
  cadencia: 'mensual',
  monto: money(44_900, 'COP'),
  ultimoCobro: '2026-08-05',
  proximoCobro: '2026-09-04',
  cobros: [transactionId('a'), transactionId('b'), transactionId('c')],
  historial: [money(38_900, 'COP'), money(44_900, 'COP')],
  confianza: 1,
  cambio: null,
};

describe('SubscriptionRow', () => {
  it('enseña el comercio, el monto y cuándo vuelve a cobrarse', async () => {
    const { getByText } = await renderWithProviders(<SubscriptionRow sub={base} hoy={HOY} />);

    expect(getByText('Netflix')).toBeOnTheScreen();
    expect(getByText(/44.900/)).toBeOnTheScreen();
    expect(getByText(new RegExp(CADENCIA.mensual))).toBeOnTheScreen();
  });

  it('marca la que subió de precio, con cuánto subió', async () => {
    const { getByText } = await renderWithProviders(
      <SubscriptionRow
        sub={{
          ...base,
          cambio: {
            anterior: money(38_900, 'COP'),
            nuevo: money(44_900, 'COP'),
            porcentaje: 15.4,
          },
        }}
        hoy={HOY}
      />,
    );

    expect(getByText(TEXTO_SUSCRIPCIONES.subio(15.4))).toBeOnTheScreen();
  });

  it('una bajada también se dice', async () => {
    const { getByText } = await renderWithProviders(
      <SubscriptionRow
        sub={{
          ...base,
          cambio: {
            anterior: money(44_900, 'COP'),
            nuevo: money(38_900, 'COP'),
            porcentaje: -13.4,
          },
        }}
        hoy={HOY}
      />,
    );

    expect(getByText(TEXTO_SUSCRIPCIONES.bajo(-13.4))).toBeOnTheScreen();
  });

  /**
   * Decir «mañana» el mismo día del cobro es la forma más fácil de perder la
   * confianza del usuario en todo lo demás.
   */
  it('el día del cobro dice «hoy», no «mañana»', async () => {
    const { getByText } = await renderWithProviders(
      <SubscriptionRow sub={{ ...base, proximoCobro: '2026-08-31' }} hoy={HOY} />,
    );

    expect(getByText(/se cobra hoy/)).toBeOnTheScreen();
  });

  it('una cancelada lo dice y no anuncia un cobro que no va a llegar', async () => {
    const { getByText, queryByText } = await renderWithProviders(
      <SubscriptionRow sub={{ ...base, proximoCobro: null }} hoy={HOY} />,
    );

    expect(getByText(TEXTO_SUSCRIPCIONES.cancelada)).toBeOnTheScreen();
    expect(queryByText(/se cobra (hoy|mañana|en |el )/)).toBeNull();
  });

  /**
   * Es una conjetura, no un hecho, y decirlo cambia cómo se lee la fila.
   */
  it('una detección de poca confianza se muestra como probable, no como segura', async () => {
    const { getByText } = await renderWithProviders(
      <SubscriptionRow sub={{ ...base, confianza: 0.4 }} hoy={HOY} />,
    );

    expect(getByText(TEXTO_SUSCRIPCIONES.probable)).toBeOnTheScreen();
  });

  it('con confianza alta no ensucia la fila con avisos', async () => {
    const { queryByText } = await renderWithProviders(<SubscriptionRow sub={base} hoy={HOY} />);

    expect(queryByText(TEXTO_SUSCRIPCIONES.probable)).toBeNull();
    expect(queryByText(TEXTO_SUSCRIPCIONES.cancelada)).toBeNull();
  });
});
