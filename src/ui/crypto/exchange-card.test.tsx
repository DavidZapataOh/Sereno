import { renderWithProviders } from '@/test/render';

import { ExchangeCard, TEXTO_EXCHANGE } from './exchange-card';

const AHORA = '2026-08-31T10:00:00.000-05:00';
const HACE_UNA_HORA = '2026-08-31T09:00:00.000-05:00';

describe('ExchangeCard', () => {
  it('conectado dice cuántos activos leyó', async () => {
    const { getByText } = await renderWithProviders(
      <ExchangeCard
        resumen={{ estado: 'ok', leidos: 2, ajustes: 1, error: null }}
        leidoEn={HACE_UNA_HORA}
        now={AHORA}
      />,
    );

    expect(getByText(TEXTO_EXCHANGE.ok(2))).toBeOnTheScreen();
    expect(getByText(/Leído/)).toBeOnTheScreen();
  });

  /**
   * El caso que motivó esta tarjeta. Las claves estaban en `servidor/.env`
   * —gitignored, o sea que nunca llegan a Railway— y la app no decía nada:
   * hubo que consultar el servidor a mano para enterarse.
   */
  it('sin claves lo dice, y dice qué hacer', async () => {
    const { getByText } = await renderWithProviders(
      <ExchangeCard
        resumen={{ estado: 'sin-configurar', leidos: 0, ajustes: 0, error: null }}
        leidoEn={null}
        now={AHORA}
      />,
    );

    expect(getByText(TEXTO_EXCHANGE.sinConfigurar)).toBeOnTheScreen();
    expect(getByText(/BINANCE_API_KEY/)).toBeOnTheScreen();
  });

  /** «Sin configurar» no es «no tienes nada»: no puede leerse como cero. */
  it('sin claves no dice que esté conectado', async () => {
    const { queryByText } = await renderWithProviders(
      <ExchangeCard
        resumen={{ estado: 'sin-configurar', leidos: 0, ajustes: 0, error: null }}
        leidoEn={null}
        now={AHORA}
      />,
    );

    expect(queryByText(/Conectado/)).toBeNull();
  });

  it('un fallo lo dice sin sugerir que el saldo se borró', async () => {
    const { getByText } = await renderWithProviders(
      <ExchangeCard
        resumen={{ estado: 'error', leidos: 0, ajustes: 0, error: 'El servidor respondió 502' }}
        leidoEn={HACE_UNA_HORA}
        now={AHORA}
      />,
    );

    expect(getByText(TEXTO_EXCHANGE.error)).toBeOnTheScreen();
    expect(TEXTO_EXCHANGE.error).toMatch(/sigue aquí/);
  });

  it('conectado y sin saldo no se confunde con un fallo', async () => {
    const { getByText, queryByText } = await renderWithProviders(
      <ExchangeCard
        resumen={{ estado: 'ok', leidos: 0, ajustes: 0, error: null }}
        leidoEn={HACE_UNA_HORA}
        now={AHORA}
      />,
    );

    expect(getByText(/No hay saldo/)).toBeOnTheScreen();
    expect(queryByText(TEXTO_EXCHANGE.error)).toBeNull();
  });

  it('sin haber leído nunca lo dice', async () => {
    const { getByText } = await renderWithProviders(
      <ExchangeCard resumen={undefined} leidoEn={null} now={AHORA} />,
    );

    expect(getByText(TEXTO_EXCHANGE.nunca)).toBeOnTheScreen();
  });
});
