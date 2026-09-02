import { Text } from 'react-native';

import { renderWithProviders } from '@/test/render';

import { TabPill } from './tab-pill';

describe('TabPill', () => {
  it('deja ver el icono que envuelve', async () => {
    const { getByText } = await renderWithProviders(
      <TabPill activa>
        <Text>icono</Text>
      </TabPill>,
    );

    expect(getByText('icono')).toBeOnTheScreen();
  });

  /** El color solo aparece para comunicar estado: aquí, cuál es la pestaña activa. */
  it('inactiva, sigue enseñando el icono', async () => {
    const { getByText } = await renderWithProviders(
      <TabPill activa={false}>
        <Text>icono</Text>
      </TabPill>,
    );

    expect(getByText('icono')).toBeOnTheScreen();
  });
});
