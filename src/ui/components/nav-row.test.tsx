import { fireEvent } from '@testing-library/react-native';

import { renderWithProviders } from '@/test/render';
import { TOUCH_TARGET_MIN } from '@/ui/theme/tokens';

import { NavRow } from './nav-row';

describe('NavRow', () => {
  it('muestra título y subtítulo', async () => {
    const { getByText } = await renderWithProviders(
      <NavRow title="Bancolombia" subtitle="Cuenta de ahorros" onPress={() => undefined} />,
    );
    expect(getByText('Bancolombia')).toBeOnTheScreen();
    expect(getByText('Cuenta de ahorros')).toBeOnTheScreen();
  });

  it('es un botón con área táctil mínima', async () => {
    const { getByRole } = await renderWithProviders(
      <NavRow title="Bancolombia" onPress={() => undefined} />,
    );
    expect(getByRole('button')).toHaveStyle({ minHeight: TOUCH_TARGET_MIN });
  });

  it('llama a onPress', async () => {
    const onPress = jest.fn();
    const { getByRole } = await renderWithProviders(
      <NavRow title="Bancolombia" onPress={onPress} />,
    );
    await fireEvent.press(getByRole('button'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('se anuncia como una sola unidad', async () => {
    const { getByLabelText } = await renderWithProviders(
      <NavRow title="Bancolombia" subtitle="Cuenta de ahorros" onPress={() => undefined} />,
    );
    expect(getByLabelText('Bancolombia. Cuenta de ahorros')).toBeOnTheScreen();
  });
});
