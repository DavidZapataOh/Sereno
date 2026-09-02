import { renderWithProviders } from '@/test/render';

import { DoneForToday, TEXTO_CIERRE } from './done-for-today';

describe('DoneForToday', () => {
  it('al vaciar la cola dice qué queda ordenado gracias a eso', async () => {
    const { getByText } = await renderWithProviders(<DoneForToday recienClasificados={7} />);

    expect(getByText(TEXTO_CIERRE.titulo)).toBeOnTheScreen();
    expect(getByText(TEXTO_CIERRE.recien(7))).toBeOnTheScreen();
    expect(getByText(TEXTO_CIERRE.ayuda)).toBeOnTheScreen();
  });

  /** No es un juego: es su plata. */
  it('no da puntos, medallas ni rachas', () => {
    const textos = [
      TEXTO_CIERRE.titulo,
      TEXTO_CIERRE.ayuda,
      TEXTO_CIERRE.vacio,
      TEXTO_CIERRE.recien(3),
    ];

    for (const texto of textos) {
      expect(texto).not.toMatch(/punto|medalla|racha|nivel|logro/i);
    }
  });

  /** Felicitar por no haber hecho nada es cómo una felicitación deja de valer. */
  it('si ya estaba vacío al entrar, no celebra nada', async () => {
    const { getByText, queryByText } = await renderWithProviders(
      <DoneForToday recienClasificados={0} />,
    );

    expect(getByText(TEXTO_CIERRE.vacio)).toBeOnTheScreen();
    expect(queryByText(TEXTO_CIERRE.ayuda)).toBeNull();
  });

  it('uno solo se dice en singular', () => {
    expect(TEXTO_CIERRE.recien(1)).toBe('Clasificaste 1 movimiento');
  });
});
