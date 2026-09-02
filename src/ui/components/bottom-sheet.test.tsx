import { Text } from 'react-native';

import { fireEvent, renderWithProviders } from '@/test/render';

import { BottomSheet } from './bottom-sheet';

describe('BottomSheet', () => {
  it('enseña su contenido y se anuncia como una unidad', async () => {
    const { getByText, getByLabelText } = await renderWithProviders(
      <BottomSheet onClose={jest.fn()} accessibilityLabel="Detalle del movimiento">
        <Text>contenido</Text>
      </BottomSheet>,
    );

    expect(getByText('contenido')).toBeOnTheScreen();
    expect(getByLabelText('Detalle del movimiento')).toBeOnTheScreen();
  });

  /** El gesto más fácil de descubrir con el dedo. */
  it('tocar el fondo la cierra', async () => {
    const onClose = jest.fn();
    const { getByLabelText } = await renderWithProviders(
      <BottomSheet onClose={onClose} accessibilityLabel="Detalle">
        <Text>contenido</Text>
      </BottomSheet>,
    );

    // Oculto al lector a propósito: la hoja es modal y atrapa el foco dentro.
    await fireEvent.press(
      getByLabelText('Cerrar tocando el fondo', { includeHiddenElements: true }),
    );

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  /**
   * Ni arrastrar ni tocar el fondo llegan a quien navega con el lector de
   * pantalla: una hoja modal atrapa el foco dentro. Así que dentro hay una
   * salida de verdad.
   */
  it('tiene un botón de cerrar dentro, al alcance del lector', async () => {
    const onClose = jest.fn();
    const { getByLabelText } = await renderWithProviders(
      <BottomSheet onClose={onClose} accessibilityLabel="Detalle">
        <Text>contenido</Text>
      </BottomSheet>,
    );

    await fireEvent.press(getByLabelText('Cerrar'));

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
