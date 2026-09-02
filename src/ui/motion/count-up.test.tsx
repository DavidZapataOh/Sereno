import { Text } from 'react-native';

import { renderWithProviders, waitFor } from '@/test/render';

import { useCountUp } from './count-up';

function Sonda({ valor }: { valor: bigint }) {
  const mostrado = useCountUp(valor, 200);
  return <Text>{String(mostrado)}</Text>;
}

describe('useCountUp', () => {
  /** Contar al abrir es adorno, y encima retrasa la lectura. */
  it('al montar enseña el valor, sin contar', async () => {
    const { getByText } = await renderWithProviders(<Sonda valor={1_000_000n} />);

    expect(getByText('1000000')).toBeOnTheScreen();
  });

  /** Es dinero: la animación no puede dejar la cifra a medias. */
  it('cuando el valor cambia, acaba exacto', async () => {
    const { getByText, rerender } = await renderWithProviders(<Sonda valor={1_000_000n} />);

    await rerender(<Sonda valor={1_250_000n} />);

    await waitFor(() => {
      expect(getByText('1250000')).toBeOnTheScreen();
    });
  });

  it('aguanta valores negativos y bajadas', async () => {
    const { getByText, rerender } = await renderWithProviders(<Sonda valor={0n} />);

    await rerender(<Sonda valor={-500_000n} />);

    await waitFor(() => {
      expect(getByText('-500000')).toBeOnTheScreen();
    });
  });

  it('un valor que no cambia no dispara nada', async () => {
    const { getByText, rerender } = await renderWithProviders(<Sonda valor={42n} />);

    await rerender(<Sonda valor={42n} />);

    expect(getByText('42')).toBeOnTheScreen();
  });
});
