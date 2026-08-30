import { fireEvent } from '@testing-library/react-native';

import { renderWithProviders } from '@/test/render';
import { TOUCH_TARGET_MIN } from '@/ui/theme/tokens';

import { IconButton } from './icon-button';

describe('IconButton', () => {
  it('es un botón con etiqueta: un icono solo no dice nada al lector de pantalla', async () => {
    const { getByRole } = await renderWithProviders(
      <IconButton icon="cog-outline" label="Ajustes" onPress={() => undefined} />,
    );
    expect(getByRole('button', { name: 'Ajustes' })).toBeOnTheScreen();
  });

  it('cumple el área táctil mínima aunque el icono sea pequeño', async () => {
    const { getByRole } = await renderWithProviders(
      <IconButton icon="cog-outline" label="Ajustes" onPress={() => undefined} />,
    );
    expect(getByRole('button')).toHaveStyle({
      minWidth: TOUCH_TARGET_MIN,
      minHeight: TOUCH_TARGET_MIN,
    });
  });

  it('llama a onPress', async () => {
    const onPress = jest.fn();
    const { getByRole } = await renderWithProviders(
      <IconButton icon="cog-outline" label="Ajustes" onPress={onPress} />,
    );
    await fireEvent.press(getByRole('button'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
