import { render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import type { Database } from './database';
import { DatabaseProvider, useDatabase } from './database-provider';

function Sonda() {
  const db = useDatabase() as unknown as { marca: string };
  return <Text testID="marca">{db.marca}</Text>;
}

describe('DatabaseProvider', () => {
  it('entrega la base a quien la pide', async () => {
    const db = { marca: 'real' } as unknown as Database;
    await render(
      <DatabaseProvider db={db}>
        <Sonda />
      </DatabaseProvider>,
    );
    expect(screen.getByTestId('marca')).toHaveTextContent('real');
  });

  it('useDatabase falla fuera del proveedor', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    await expect(render(<Sonda />)).rejects.toThrow(/DatabaseProvider/);
  });
});
