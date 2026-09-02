import { Text } from 'react-native';

import { renderWithProviders } from '@/test/render';

import { HapticsProvider, useHaptics, type Vibracion } from './haptics';

function Sonda({ que }: { que: Vibracion }) {
  const { sentir } = useHaptics();
  sentir(que);
  return <Text>listo</Text>;
}

describe('háptica', () => {
  it('llega al adaptador cableado desde la composición', async () => {
    const sentir = jest.fn();

    await renderWithProviders(
      <HapticsProvider value={{ sentir }}>
        <Sonda que="confirmar" />
      </HapticsProvider>,
    );

    expect(sentir).toHaveBeenCalledWith('confirmar');
  });

  /** Sin adaptador no vibra nada, y no se rompe: es el defecto correcto. */
  it('sin adaptador no vibra y no falla', async () => {
    const { getByText } = await renderWithProviders(<Sonda que="confirmar" />);

    expect(getByText('listo')).toBeOnTheScreen();
  });
});
