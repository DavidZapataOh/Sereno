import { fireEvent, renderWithProviders } from '@/test/render';

import { ServerSyncCard } from './server-sync-card';

const now = '2026-08-30T18:00:00.000-05:00';

describe('ServerSyncCard', () => {
  it('dice cuándo fue la última vez, en lenguaje llano', async () => {
    const { getByText } = await renderWithProviders(
      <ServerSyncCard
        estado={{ ultima: '2026-08-30T17:30:00.000-05:00', now, pendiente: false, error: false }}
        onTraer={() => undefined}
      />,
    );
    expect(getByText(/Última vez:/)).toBeOnTheScreen();
  });

  it('si nunca se ha traído, lo dice en vez de mostrar una fecha vacía', async () => {
    const { getByText } = await renderWithProviders(
      <ServerSyncCard
        estado={{ ultima: null, now, pendiente: false, error: false }}
        onTraer={() => undefined}
      />,
    );
    expect(getByText(/Todavía no/)).toBeOnTheScreen();
  });

  it('si la última vez falló, lo dice sin dramatizar y deja reintentar', async () => {
    const onTraer = jest.fn();
    const { getByText, getByRole } = await renderWithProviders(
      <ServerSyncCard
        estado={{ ultima: '2026-08-30T17:30:00.000-05:00', now, pendiente: false, error: true }}
        onTraer={onTraer}
      />,
    );
    const aviso = getByText(/No se pudo conectar/);
    expect(aviso).toBeOnTheScreen();
    // Principio 3: informa sin alarmar.
    expect(aviso).toHaveTextContent(/^[^!¡]*$/);

    await fireEvent.press(getByRole('button', { name: 'Traer ahora' }));
    expect(onTraer).toHaveBeenCalledTimes(1);
  });

  it('mientras trae, el botón está ocupado y no se puede tocar dos veces', async () => {
    const onTraer = jest.fn();
    const { getByRole } = await renderWithProviders(
      <ServerSyncCard
        estado={{ ultima: null, now, pendiente: true, error: false }}
        onTraer={onTraer}
      />,
    );
    await fireEvent.press(getByRole('button', { name: 'Traer ahora' }));
    expect(onTraer).not.toHaveBeenCalled();
  });
});
