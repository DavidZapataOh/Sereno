import { renderWithProviders } from '@/test/render';
import { LIGHT_PALETTE } from '@/ui/theme/palette';
import { TYPE_SCALE } from '@/ui/theme/typography';

import { AppText } from './app-text';

describe('AppText', () => {
  it('muestra el texto recibido', async () => {
    const { getByText } = await renderWithProviders(<AppText>Hola</AppText>);
    expect(getByText('Hola')).toBeOnTheScreen();
  });

  it('usa el nivel cuerpo por defecto', async () => {
    const { getByTestId } = await renderWithProviders(<AppText testID="t">Hola</AppText>);
    expect(getByTestId('t')).toHaveStyle({
      fontSize: TYPE_SCALE.cuerpo.fontSize,
      fontFamily: TYPE_SCALE.cuerpo.fontFamily,
    });
  });

  it('aplica el nivel solicitado', async () => {
    const { getByTestId } = await renderWithProviders(
      <AppText level="titulo" testID="t">
        Hola
      </AppText>,
    );
    expect(getByTestId('t')).toHaveStyle({
      fontSize: TYPE_SCALE.titulo.fontSize,
      letterSpacing: TYPE_SCALE.titulo.letterSpacing,
    });
  });

  it('usa el color de texto primario por defecto', async () => {
    const { getByTestId } = await renderWithProviders(<AppText testID="t">Hola</AppText>);
    expect(getByTestId('t')).toHaveStyle({ color: LIGHT_PALETTE.textPrimary });
  });

  it('aplica el color semántico solicitado', async () => {
    const { getByTestId } = await renderWithProviders(
      <AppText color="textMuted" testID="t">
        Hola
      </AppText>,
    );
    expect(getByTestId('t')).toHaveStyle({ color: LIGHT_PALETTE.textMuted });
  });

  it('permite ampliar la fuente', async () => {
    const { getByTestId } = await renderWithProviders(<AppText testID="t">Hola</AppText>);
    expect((getByTestId('t').props as { allowFontScaling: boolean }).allowFontScaling).toBe(true);
  });

  it('acepta alineación y recorte sin abrir la puerta a estilos sueltos', async () => {
    const { getByTestId } = await renderWithProviders(
      <AppText align="center" numberOfLines={1} testID="t">
        Hola
      </AppText>,
    );
    expect(getByTestId('t')).toHaveStyle({ textAlign: 'center' });
    expect((getByTestId('t').props as { numberOfLines: number }).numberOfLines).toBe(1);
  });
});
