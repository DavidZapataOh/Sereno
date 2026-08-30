import { PortalSession } from './portal-session';
import { useCaptureStore } from './store';
import { fireEvent, renderWithProviders, waitFor } from '@/test/render';
import { getPortal } from '@/domain/portals/registry';
import { CAPTURE_PROTOCOL_VERSION, splitIntoFragments } from '@/domain/capture/protocol';

import type * as ReactNative from 'react-native';

jest.mock('react-native-webview', () => {
  const { View } = jest.requireActual<typeof ReactNative>('react-native');
  return { WebView: View };
});

/** El script real no hace falta aquí: la WebView está simulada. */
const SCRIPT = 'true;';

const portal = getPortal('nequi');
if (portal === undefined) throw new Error('portal de prueba ausente');

describe('PortalSession', () => {
  beforeEach(() => {
    useCaptureStore.getState().clear();
  });

  it('muestra las instrucciones del portal', async () => {
    const { getByText } = await renderWithProviders(
      <PortalSession portal={portal} injectedScript={SCRIPT} />,
    );
    expect(getByText(portal.instrucciones)).toBeOnTheScreen();
  });

  it('muestra el contador de capturas', async () => {
    const { getByTestId } = await renderWithProviders(
      <PortalSession portal={portal} injectedScript={SCRIPT} />,
    );
    expect(getByTestId('contador-capturas')).toHaveTextContent(/0 capturas/);
  });

  it('advierte del límite de sesión cuando el portal lo declara', async () => {
    const bancolombia = getPortal('bancolombia');
    if (bancolombia === undefined) throw new Error('portal ausente');
    const { getByTestId } = await renderWithProviders(
      <PortalSession portal={bancolombia} injectedScript={SCRIPT} />,
    );
    expect(getByTestId('aviso-sesion')).toHaveTextContent(/7 minutos/);
  });

  it('el contador refleja las capturas del store', async () => {
    const { getByTestId } = await renderWithProviders(
      <PortalSession portal={portal} injectedScript={SCRIPT} />,
    );
    const { handleMessage } = useCaptureStore.getState();

    handleMessage(
      JSON.stringify({
        type: 'sereno:meta',
        v: CAPTURE_PROTOCOL_VERSION,
        id: 'a',
        url: 'https://banco.example/api/x',
        method: 'GET',
        status: 200,
        contentType: 'application/json',
        kind: 'fetch',
        capturedAt: '2026-08-28T15:00:00.000Z',
        totalFragments: 1,
      }),
    );
    handleMessage(JSON.stringify(splitIntoFragments('a', '{}')[0]));

    // El store se actualiza fuera del ciclo de React: hay que esperar al re-render.
    await waitFor(() => {
      expect(getByTestId('contador-capturas')).toHaveTextContent(/1 captura/);
    });
  });

  it('con capturas ofrece importar y entrega las capturas a quien las procese', async () => {
    const onImportar = jest.fn();
    const { getByRole } = await renderWithProviders(
      <PortalSession portal={portal} injectedScript={SCRIPT} onImportar={onImportar} />,
    );
    expect(getByRole('button', { name: 'Importar las capturas al ledger' })).toBeDisabled();

    const { handleMessage } = useCaptureStore.getState();
    handleMessage(
      JSON.stringify({
        type: 'sereno:meta',
        v: CAPTURE_PROTOCOL_VERSION,
        id: 'a',
        url: 'https://banco.example/api/x',
        method: 'GET',
        status: 200,
        contentType: 'application/json',
        kind: 'fetch',
        capturedAt: '2026-08-28T15:00:00.000Z',
        totalFragments: 1,
      }),
    );
    handleMessage(JSON.stringify(splitIntoFragments('a', '{}')[0]));

    await waitFor(() => {
      expect(getByRole('button', { name: 'Importar las capturas al ledger' })).not.toBeDisabled();
    });
    await fireEvent.press(getByRole('button', { name: 'Importar las capturas al ledger' }));
    expect(onImportar).toHaveBeenCalledTimes(1);
    expect(onImportar.mock.calls[0]?.[0]).toHaveLength(1);
  });

  it('si la importación falló, lo dice bajo el botón', async () => {
    const { getByTestId } = await renderWithProviders(
      <PortalSession
        portal={portal}
        injectedScript={SCRIPT}
        onImportar={() => undefined}
        errorImportacion="No se pudo importar."
      />,
    );
    expect(getByTestId('error-importacion')).toHaveTextContent('No se pudo importar.');
  });

  it('dice si el saldo del banco ya se vio, y si no, cómo conseguirlo', async () => {
    const bancolombia = getPortal('bancolombia');
    if (bancolombia === undefined) throw new Error('portal ausente');
    const { getByTestId } = await renderWithProviders(
      <PortalSession portal={bancolombia} injectedScript={SCRIPT} />,
    );
    expect(getByTestId('saldo-visto')).toHaveTextContent(/aún no visto/);
    expect(getByTestId('movimientos-vistos')).toHaveTextContent(/Movimientos vistos: 0/);

    const { handleMessage } = useCaptureStore.getState();
    const cuerpo = JSON.stringify({
      data: {
        accounts: [
          {
            number: '12345678901',
            name: 'Ahorros',
            type: 'CUENTA_AHORRO',
            currency: 'COP',
            status: 'ACTIVA',
            balances: { available: 4523.4, current: 4523.4, effective: 4523.4 },
          },
        ],
      },
    });
    handleMessage(
      JSON.stringify({
        type: 'sereno:meta',
        v: CAPTURE_PROTOCOL_VERSION,
        id: 's',
        url: 'https://canalpersonas-ext.apps.bancolombia.com/super-svp/api/v1/security-filters/ch-ms-deposits/hybrid/accounts/customization/consolidated',
        method: 'GET',
        status: 200,
        contentType: 'application/json',
        kind: 'fetch',
        capturedAt: '2026-08-28T15:00:00.000Z',
        totalFragments: 1,
      }),
    );
    handleMessage(JSON.stringify(splitIntoFragments('s', cuerpo)[0]));

    await waitFor(() => {
      expect(getByTestId('saldo-visto')).toHaveTextContent(
        /Saldo del banco: \$ 4\.523 \(Ahorros \*\*\*\*8901\)/,
      );
    });
  });
});
