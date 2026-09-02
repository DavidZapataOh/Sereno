import { fireEvent } from '@testing-library/react-native';

import { HapticsProvider } from '@/ui/motion/haptics';
import { renderWithProviders } from '@/test/render';
import { LIGHT_PALETTE } from '@/ui/theme/palette';
import { TOUCH_TARGET_MIN } from '@/ui/theme/tokens';

import { Button } from './button';

const nada = (): void => undefined;

describe('Button', () => {
  it('muestra la etiqueta', async () => {
    const { getByText } = await renderWithProviders(<Button label="Guardar" onPress={nada} />);
    expect(getByText('Guardar')).toBeOnTheScreen();
  });

  it('declara el rol de botón', async () => {
    const { getByRole } = await renderWithProviders(<Button label="Guardar" onPress={nada} />);
    expect(getByRole('button')).toBeOnTheScreen();
  });

  it('cumple el área táctil mínima de Android', async () => {
    const { getByRole } = await renderWithProviders(<Button label="Guardar" onPress={nada} />);
    expect(getByRole('button')).toHaveStyle({ minHeight: TOUCH_TARGET_MIN });
  });

  it('llama a onPress al pulsarlo', async () => {
    const onPress = jest.fn();
    const { getByRole } = await renderWithProviders(<Button label="Guardar" onPress={onPress} />);
    await fireEvent.press(getByRole('button'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('no llama a onPress cuando está deshabilitado', async () => {
    const onPress = jest.fn();
    const { getByRole } = await renderWithProviders(
      <Button label="Guardar" onPress={onPress} disabled />,
    );
    await fireEvent.press(getByRole('button'));
    expect(onPress).not.toHaveBeenCalled();
  });

  it('anuncia su estado deshabilitado', async () => {
    const { getByRole } = await renderWithProviders(
      <Button label="Guardar" onPress={nada} disabled />,
    );
    expect(getByRole('button')).toBeDisabled();
  });

  it('deshabilitado se ve desaturado, no transparente', async () => {
    // La transparencia deja ver lo que hay detrás y rompe el contraste del
    // texto; un relleno neutro con texto apagado no.
    const { getByRole } = await renderWithProviders(
      <Button label="Guardar" onPress={nada} disabled />,
    );
    expect(getByRole('button')).toHaveStyle({ backgroundColor: LIGHT_PALETTE.surfaceAlt });
    expect(getByRole('button')).not.toHaveStyle({ opacity: 0.5 });
  });

  it('no llama a onPress mientras carga', async () => {
    const onPress = jest.fn();
    const { getByRole } = await renderWithProviders(
      <Button label="Guardar" onPress={onPress} loading />,
    );
    await fireEvent.press(getByRole('button'));
    expect(onPress).not.toHaveBeenCalled();
  });

  it('anuncia que está ocupado mientras carga', async () => {
    const { getByRole } = await renderWithProviders(
      <Button label="Guardar" onPress={nada} loading />,
    );
    expect(getByRole('button')).toBeBusy();
  });

  /**
   * El primario es neutro de máximo contraste, no del color de marca: así se ve
   * desde el otro lado de la pantalla y el ámbar queda libre para acentuar.
   */
  it('el primario usa la acción principal y su texto auditado encima', async () => {
    const { getByRole, getByText } = await renderWithProviders(
      <Button label="Guardar" onPress={nada} />,
    );
    expect(getByRole('button')).toHaveStyle({ backgroundColor: LIGHT_PALETTE.actionFill });
    expect(getByText('Guardar')).toHaveStyle({ color: LIGHT_PALETTE.onActionFill });
  });

  it('el de acento usa el ámbar de relleno, con su tinta auditada', async () => {
    const { getByRole, getByText } = await renderWithProviders(
      <Button label="Sincronizar" onPress={nada} variant="acento" />,
    );
    expect(getByRole('button')).toHaveStyle({ backgroundColor: LIGHT_PALETTE.accentFill });
    expect(getByText('Sincronizar')).toHaveStyle({ color: LIGHT_PALETTE.onAccentFill });
  });

  /** Si vibra todo, no significa nada: solo lo que cambió datos. */
  it('solo vibra si se le pide', async () => {
    const sentir = jest.fn();
    const { getByRole } = await renderWithProviders(
      <HapticsProvider value={{ sentir }}>
        <Button label="Guardar" onPress={nada} vibra />
      </HapticsProvider>,
    );

    await fireEvent.press(getByRole('button'));
    expect(sentir).toHaveBeenCalledWith('confirmar');

    sentir.mockClear();
    const otra = await renderWithProviders(
      <HapticsProvider value={{ sentir }}>
        <Button label="Ver" onPress={nada} />
      </HapticsProvider>,
    );
    await fireEvent.press(otra.getAllByRole('button')[1] ?? otra.getByRole('button'));
    expect(sentir).not.toHaveBeenCalled();
  });

  it('el destructivo usa peligro, no gasto: borrar no es gastar', async () => {
    const { getByRole, getByText } = await renderWithProviders(
      <Button label="Borrar" onPress={nada} variant="peligro" />,
    );
    expect(getByRole('button')).toHaveStyle({ backgroundColor: LIGHT_PALETTE.peligro });
    expect(getByText('Borrar')).toHaveStyle({ color: LIGHT_PALETTE.onPeligro });
  });

  it('puede anunciar algo más completo que lo que muestra', async () => {
    const { getByLabelText, getByText } = await renderWithProviders(
      <Button label="Limpiar" accessibilityLabel="Limpiar capturas" onPress={nada} />,
    );
    expect(getByText('Limpiar')).toBeOnTheScreen();
    expect(getByLabelText('Limpiar capturas')).toBeOnTheScreen();
  });

  it('la etiqueta se puede ampliar', async () => {
    const { getByText } = await renderWithProviders(<Button label="Guardar" onPress={nada} />);
    expect((getByText('Guardar').props as { allowFontScaling: boolean }).allowFontScaling).toBe(
      true,
    );
  });
});
