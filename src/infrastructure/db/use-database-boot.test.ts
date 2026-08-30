import { renderHook, waitFor } from '@testing-library/react-native';

import { useDatabaseBoot } from './use-database-boot';

const mockApplyMigrations = jest.fn<Promise<void>, [unknown]>();

jest.mock('./client', () => ({
  openDatabase: () => ({ db: { marca: 'db' }, sqlite: {} }),
  applyMigrations: (db: unknown) => mockApplyMigrations(db),
}));

describe('useDatabaseBoot', () => {
  it('arranca cargando', async () => {
    mockApplyMigrations.mockReturnValue(new Promise(() => undefined));
    const { result } = await renderHook(() => useDatabaseBoot());
    expect(result.current.estado).toBe('cargando');
  });

  it('queda listo con la base cuando las migraciones terminan', async () => {
    mockApplyMigrations.mockResolvedValue(undefined);
    const { result } = await renderHook(() => useDatabaseBoot());

    await waitFor(() => {
      expect(result.current.estado).toBe('listo');
    });
    expect(mockApplyMigrations).toHaveBeenCalledWith({ marca: 'db' });
  });

  it('devuelve el error en vez de lanzar, para que el arranque decida', async () => {
    mockApplyMigrations.mockRejectedValue(new Error('no such table'));
    const { result } = await renderHook(() => useDatabaseBoot());

    await waitFor(() => {
      expect(result.current.estado).toBe('error');
    });
    if (result.current.estado === 'error') {
      expect(result.current.error.message).toBe('no such table');
    }
  });
});
