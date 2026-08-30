import { DEFAULT_CATEGORIES } from '@/domain/categorization/taxonomy';
import { renderWithProviders } from '@/test/render';

import { CategoryIcon, isIconName } from './category-icon';

describe('iconos de categoría', () => {
  it('todos los iconos de la taxonomía existen en MaterialCommunityIcons', () => {
    const desconocidos = DEFAULT_CATEGORIES.filter((c) => !isIconName(c.icono)).map(
      (c) => `${c.slug}: ${c.icono}`,
    );
    expect(desconocidos).toEqual([]);
  });

  it('un nombre desconocido pinta el respaldo en vez de reventar', async () => {
    const { getByTestId } = await renderWithProviders(
      <CategoryIcon icono="no-existe-este-icono" testID="icono" />,
    );
    // El icono se oculta a los lectores de pantalla (la fila ya se etiqueta): hay que pedirlo aparte.
    expect(getByTestId('icono', { includeHiddenElements: true })).toBeOnTheScreen();
  });
});
