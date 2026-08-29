import { fireEvent } from '@testing-library/react-native';
import { CaptureTray } from './capture-tray';
import { useCaptureStore } from './store';
import { renderWithProviders, waitFor } from '@/test/render';
import { CAPTURE_PROTOCOL_VERSION, splitIntoFragments } from '@/domain/capture/protocol';

jest.mock('expo-clipboard', () => ({
  setStringAsync: jest.fn().mockResolvedValue(true),
}));

function guardarCaptura(id: string, body: string): void {
  const { handleMessage } = useCaptureStore.getState();
  handleMessage(
    JSON.stringify({
      type: 'sereno:meta',
      v: CAPTURE_PROTOCOL_VERSION,
      id,
      url: 'https://banco.example/api/movimientos',
      method: 'GET',
      status: 200,
      contentType: 'application/json',
      kind: 'fetch',
      capturedAt: '2026-08-28T15:00:00.000Z',
      totalFragments: 1,
    }),
  );
  handleMessage(JSON.stringify(splitIntoFragments(id, body)[0]));
}

describe('CaptureTray', () => {
  beforeEach(() => {
    useCaptureStore.getState().clear();
  });

  it('muestra el estado vacío cuando no hay capturas', async () => {
    const { getByText } = await renderWithProviders(<CaptureTray />);
    expect(getByText('Todavía no hay capturas.')).toBeOnTheScreen();
  });

  it('muestra el conteo de capturas', async () => {
    guardarCaptura('a', '{"v":1}');
    const { getByTestId } = await renderWithProviders(<CaptureTray />);
    expect(getByTestId('titulo-bandeja')).toHaveTextContent(/1 capturas/);
  });

  it('lista la URL y el método de cada captura', async () => {
    guardarCaptura('a', '{"v":1}');
    const { getByText } = await renderWithProviders(<CaptureTray />);
    expect(getByText(/GET https:\/\/banco.example\/api\/movimientos/)).toBeOnTheScreen();
  });

  it('avisa de los mensajes descartados', async () => {
    useCaptureStore.getState().handleMessage('basura');
    const { getByTestId } = await renderWithProviders(<CaptureTray />);
    expect(getByTestId('contador-descartados')).toHaveTextContent(/1 mensajes descartados/);
  });

  it('no muestra el aviso de descartados si no hay ninguno', async () => {
    const { queryByTestId } = await renderWithProviders(<CaptureTray />);
    expect(queryByTestId('contador-descartados')).toBeNull();
  });

  it('limpiar vacía la bandeja', async () => {
    guardarCaptura('a', '{"v":1}');
    const { getByLabelText, getByTestId } = await renderWithProviders(<CaptureTray />);
    await fireEvent.press(getByLabelText('Limpiar capturas'));
    // El store de Zustand notifica fuera del ciclo de React: hay que esperar.
    await waitFor(() => {
      expect(getByTestId('titulo-bandeja')).toHaveTextContent(/0 capturas/);
    });
  });

  it('copiar el volcado lo manda al portapapeles', async () => {
    const Clipboard = jest.requireMock<{ setStringAsync: jest.Mock }>('expo-clipboard');
    guardarCaptura('a', '{"v":1}');
    const { getByLabelText } = await renderWithProviders(<CaptureTray />);
    await fireEvent.press(getByLabelText('Copiar volcado de capturas'));
    expect(Clipboard.setStringAsync).toHaveBeenCalledTimes(1);
    expect(Clipboard.setStringAsync.mock.calls[0][0]).toContain('datos bancarios reales');
  });
});
