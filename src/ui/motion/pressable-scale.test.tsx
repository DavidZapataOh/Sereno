import { AccessibilityInfo, Text } from 'react-native';

import { fireEvent, renderWithProviders } from '@/test/render';

import { PressableScale } from './pressable-scale';

describe('PressableScale', () => {
  it('sigue siendo un pulsable con su rol y su etiqueta', async () => {
    const { getByLabelText } = await renderWithProviders(
      <PressableScale accessibilityRole="button" accessibilityLabel="Guardar" onPress={jest.fn()}>
        <Text>Guardar</Text>
      </PressableScale>,
    );

    expect(getByLabelText('Guardar')).toBeOnTheScreen();
  });

  it('llama a onPress al soltarlo', async () => {
    const onPress = jest.fn();
    const { getByLabelText } = await renderWithProviders(
      <PressableScale accessibilityRole="button" accessibilityLabel="Guardar" onPress={onPress}>
        <Text>Guardar</Text>
      </PressableScale>,
    );

    await fireEvent.press(getByLabelText('Guardar'));

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  /** Un pulsable deshabilitado no responde: ni se hunde ni llama. */
  it('deshabilitado no llama a onPress', async () => {
    const onPress = jest.fn();
    const { getByLabelText } = await renderWithProviders(
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel="Guardar"
        onPress={onPress}
        disabled
      >
        <Text>Guardar</Text>
      </PressableScale>,
    );

    await fireEvent.press(getByLabelText('Guardar'));

    expect(onPress).not.toHaveBeenCalled();
  });

  /**
   * Con «reducir movimiento» no se escala, pero el color sí cambia: un cambio
   * de color no es movimiento, y sin él la pulsación se quedaría muda.
   */
  it('con «reducir movimiento» sigue respondiendo al tacto', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);

    const onPress = jest.fn();
    const { getByLabelText } = await renderWithProviders(
      <PressableScale accessibilityRole="button" accessibilityLabel="Guardar" onPress={onPress}>
        <Text>Guardar</Text>
      </PressableScale>,
    );

    await fireEvent.press(getByLabelText('Guardar'));

    expect(onPress).toHaveBeenCalledTimes(1);
    jest.restoreAllMocks();
  });
});
