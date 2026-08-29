import { PortalSession } from './portal-session';
import { useCaptureStore } from './store';
import { renderWithProviders, waitFor } from '@/test/render';
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
    expect(getByTestId('contador-capturas')).toHaveTextContent('0 capturas');
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
      expect(getByTestId('contador-capturas')).toHaveTextContent('1 captura');
    });
  });
});
