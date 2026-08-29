import { renderWithProviders } from '@/test/render';
import { LIGHT_PALETTE } from '@/ui/theme/palette';

import { Money } from './money';

describe('Money', () => {
  it('muestra el monto formateado con símbolo', async () => {
    const { getByText } = await renderWithProviders(<Money amount={45000} direction="neutro" />);
    expect(getByText('$ 45.000')).toBeOnTheScreen();
  });

  it('antepone el signo más al dinero que entra', async () => {
    const { getByText } = await renderWithProviders(<Money amount={45000} direction="entra" />);
    expect(getByText('+$ 45.000')).toBeOnTheScreen();
  });

  it('antepone el signo menos al dinero que sale', async () => {
    const { getByText } = await renderWithProviders(<Money amount={45000} direction="sale" />);
    expect(getByText('−$ 45.000')).toBeOnTheScreen();
  });

  it('acepta bigint, que es como llega del ledger', async () => {
    const { getByText } = await renderWithProviders(<Money amount={1234567n} direction="neutro" />);
    expect(getByText('$ 1.234.567')).toBeOnTheScreen();
  });

  it('pinta otras monedas con su símbolo y sus decimales', async () => {
    const { getByText } = await renderWithProviders(
      <Money amount={4550n} currency="USD" direction="sale" />,
    );
    expect(getByText('−US$ 45,50')).toBeOnTheScreen();
  });

  it('usa cifras tabulares para que las columnas alineen', async () => {
    const { getByTestId } = await renderWithProviders(
      <Money amount={1000} direction="neutro" testID="monto" />,
    );
    expect(getByTestId('monto')).toHaveStyle({ fontVariant: ['tabular-nums'] });
  });

  it('colorea según la dirección del dinero', async () => {
    const { getByTestId, rerender } = await renderWithProviders(
      <Money amount={1000} direction="entra" testID="monto" />,
    );
    expect(getByTestId('monto')).toHaveStyle({ color: LIGHT_PALETTE.ingreso });

    await rerender(<Money amount={1000} direction="sale" testID="monto" />);
    expect(getByTestId('monto')).toHaveStyle({ color: LIGHT_PALETTE.gasto });

    await rerender(<Money amount={1000} direction="neutro" testID="monto" />);
    expect(getByTestId('monto')).toHaveStyle({ color: LIGHT_PALETTE.textPrimary });
  });

  it('anuncia el monto de forma comprensible para el lector de pantalla', async () => {
    const { getByLabelText } = await renderWithProviders(<Money amount={45000} direction="sale" />);
    expect(getByLabelText('Salen 45.000 pesos')).toBeOnTheScreen();
  });

  it('anuncia el ingreso con la palabra correcta', async () => {
    const { getByLabelText } = await renderWithProviders(
      <Money amount={45000} direction="entra" />,
    );
    expect(getByLabelText('Entran 45.000 pesos')).toBeOnTheScreen();
  });

  it('anuncia la moneda por su nombre, no por su símbolo', async () => {
    // «Salen 45,50 US$» no se entiende leído en voz alta.
    const { getByLabelText } = await renderWithProviders(
      <Money amount={4550n} currency="USD" direction="sale" />,
    );
    expect(getByLabelText('Salen 45,50 dólares')).toBeOnTheScreen();
  });

  it('limita la ampliación de fuente sin desactivarla', async () => {
    const { getByTestId } = await renderWithProviders(
      <Money amount={1000} direction="neutro" testID="monto" />,
    );
    const props = getByTestId('monto').props as {
      allowFontScaling: boolean;
      maxFontSizeMultiplier: number;
    };
    expect(props.allowFontScaling).toBe(true);
    expect(props.maxFontSizeMultiplier).toBeLessThanOrEqual(2);
  });

  it('respeta el tamaño solicitado', async () => {
    const { getByTestId } = await renderWithProviders(
      <Money amount={1000} direction="neutro" size="montoGrande" testID="monto" />,
    );
    expect(getByTestId('monto')).toHaveStyle({ fontSize: 40 });
  });

  it('usa el tamaño mediano por defecto', async () => {
    const { getByTestId } = await renderWithProviders(
      <Money amount={1000} direction="neutro" testID="monto" />,
    );
    expect(getByTestId('monto')).toHaveStyle({ fontSize: 20 });
  });
});
