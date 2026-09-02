import { fireEvent, renderWithProviders } from '@/test/render';

import { MirrorCard, TEXTO_ESPEJO } from './mirror-card';

const espejo = { frase: 'La plata que gastas hoy lleva 34 días contigo', clave: 'antiguedad' };

describe('MirrorCard', () => {
  it('enseña la frase', async () => {
    const { getByText } = await renderWithProviders(
      <MirrorCard espejo={espejo} onVer={jest.fn()} />,
    );

    expect(getByText(espejo.frase)).toBeOnTheScreen();
  });

  /** Una frase sobre uno mismo que no se puede comprobar es un horóscopo. */
  it('lleva a ver de dónde sale', async () => {
    const onVer = jest.fn();
    const { getByText } = await renderWithProviders(<MirrorCard espejo={espejo} onVer={onVer} />);

    expect(getByText(TEXTO_ESPEJO.ver)).toBeOnTheScreen();
    await fireEvent.press(getByText(espejo.frase));
    expect(onVer).toHaveBeenCalledTimes(1);
  });
});
