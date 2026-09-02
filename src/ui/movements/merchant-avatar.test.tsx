import { renderWithProviders } from '@/test/render';

import { inicialDe, MerchantAvatar, tinteDe } from './merchant-avatar';

describe('tinteDe', () => {
  /**
   * El mismo comercio, el mismo color, siempre: en esta pantalla y en la
   * siguiente, hoy y dentro de un año. Es lo que convierte el color en una
   * pista de reconocimiento en vez de en decoración.
   */
  it('el mismo nombre da siempre el mismo tinte', () => {
    expect(tinteDe('Éxito')).toBe(tinteDe('Éxito'));
    expect(tinteDe('Rappi')).toBe(tinteDe('rappi'));
  });

  it('nombres distintos reparten', () => {
    const tintes = new Set(
      ['Éxito', 'Rappi', 'Netflix', 'Uber', 'Claro', 'Nequi'].map((n) => tinteDe(n)),
    );

    expect(tintes.size).toBeGreaterThan(1);
  });

  it('siempre cae dentro de la lista', () => {
    for (const nombre of ['', 'a', 'ÑOÑO', '12345', 'un nombre muy largo de comercio']) {
      expect(tinteDe(nombre)).toBeGreaterThanOrEqual(0);
      expect(tinteDe(nombre)).toBeLessThan(4);
    }
  });
});

describe('inicialDe', () => {
  it('toma la primera letra o número', () => {
    expect(inicialDe('Éxito')).toBe('É');
    expect(inicialDe('7-eleven')).toBe('7');
    expect(inicialDe('  rappi')).toBe('R');
  });

  it('sin ninguna letra, no se inventa una', () => {
    expect(inicialDe('***')).toBe('·');
    expect(inicialDe('')).toBe('·');
  });
});

describe('MerchantAvatar', () => {
  /** Lo lee la fila entera: repetir la inicial no aporta nada a quien no ve. */
  it('no habla al lector de pantalla', async () => {
    const { queryByLabelText } = await renderWithProviders(<MerchantAvatar nombre="Éxito" />);

    expect(queryByLabelText('É')).toBeNull();
  });

  it('enseña la inicial, aunque el lector no la lea', async () => {
    const { getByText } = await renderWithProviders(
      <MerchantAvatar nombre="Éxito" sinClasificar />,
    );

    // `includeHiddenElements` porque el avatar está oculto al lector a
    // propósito: lo que se comprueba es que se ve, no que se anuncia.
    expect(getByText('É', { includeHiddenElements: true })).toBeOnTheScreen();
  });
});
