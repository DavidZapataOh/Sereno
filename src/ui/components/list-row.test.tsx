import { fireEvent } from '@testing-library/react-native';

import { renderWithProviders } from '@/test/render';
import { TOUCH_TARGET_MIN } from '@/ui/theme/tokens';

import { ListRow } from './list-row';

const nada = (): void => undefined;

describe('ListRow', () => {
  it('muestra título, subtítulo y monto', async () => {
    const { getByText } = await renderWithProviders(
      <ListRow title="Éxito" subtitle="Mercado · 20 ago" amount={45000} direction="sale" />,
    );
    expect(getByText('Éxito')).toBeOnTheScreen();
    expect(getByText('Mercado · 20 ago')).toBeOnTheScreen();
    expect(getByText('−$ 45.000')).toBeOnTheScreen();
  });

  it('no declara rol de botón si no es pulsable', async () => {
    const { queryByRole } = await renderWithProviders(
      <ListRow title="Éxito" amount={45000} direction="sale" />,
    );
    expect(queryByRole('button')).toBeNull();
  });

  it('declara rol de botón y área táctil cuando es pulsable', async () => {
    const { getByRole } = await renderWithProviders(
      <ListRow title="Éxito" amount={45000} direction="sale" onPress={nada} />,
    );
    expect(getByRole('button')).toHaveStyle({ minHeight: TOUCH_TARGET_MIN });
  });

  it('llama a onPress al pulsarla', async () => {
    const onPress = jest.fn();
    const { getByRole } = await renderWithProviders(
      <ListRow title="Éxito" amount={45000} direction="sale" onPress={onPress} />,
    );
    await fireEvent.press(getByRole('button'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('anuncia la fila completa como una sola unidad al lector de pantalla', async () => {
    const { getByLabelText } = await renderWithProviders(
      <ListRow title="Éxito" subtitle="Mercado" amount={45000} direction="sale" onPress={nada} />,
    );
    expect(getByLabelText('Éxito. Mercado. Salen 45.000 pesos')).toBeOnTheScreen();
  });

  it('sin subtítulo no deja un punto suelto en la etiqueta', async () => {
    const { getByLabelText } = await renderWithProviders(
      <ListRow title="Éxito" amount={45000} direction="sale" />,
    );
    expect(getByLabelText('Éxito. Salen 45.000 pesos')).toBeOnTheScreen();
  });

  it('trunca el título largo en una línea', async () => {
    const { getByTestId } = await renderWithProviders(
      <ListRow title={'Comercio '.repeat(20)} amount={1000} direction="sale" testID="fila" />,
    );
    expect((getByTestId('fila-titulo').props as { numberOfLines: number }).numberOfLines).toBe(1);
  });

  it('acepta otra moneda y la anuncia por su nombre', async () => {
    const { getByText, getByLabelText } = await renderWithProviders(
      <ListRow title="Binance" amount={4550n} currency="USD" direction="entra" />,
    );
    expect(getByText('+US$ 45,50')).toBeOnTheScreen();
    expect(getByLabelText('Binance. Entran 45,50 dólares')).toBeOnTheScreen();
  });
});
