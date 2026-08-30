import { fireEvent, waitFor } from '@testing-library/react-native';

import type { LedgerReport } from '@/domain/ledger/invariants';
import { renderWithProviders } from '@/test/render';

import { LedgerHealth } from './ledger-health';

const sano: LedgerReport = {
  sano: true,
  violaciones: [],
  revisado: { cuentas: 2, transacciones: 10, apuntes: 20 },
};

const roto: LedgerReport = {
  sano: false,
  violaciones: [
    { invariante: 'transaccion-cuadrada', detalle: 'La transacción "t1" no cuadra — COP: -5' },
    { invariante: 'cuenta-existe', detalle: 'Hay apuntes contra la cuenta "x", que no existe' },
  ],
  revisado: { cuentas: 2, transacciones: 10, apuntes: 20 },
};

describe('LedgerHealth', () => {
  it('ofrece verificar y no verifica sola', async () => {
    const verificar = jest.fn().mockResolvedValue(sano);
    const { getByRole } = await renderWithProviders(<LedgerHealth verificar={verificar} />);

    expect(getByRole('button', { name: 'Verificar ahora' })).toBeOnTheScreen();
    expect(verificar).not.toHaveBeenCalled();
  });

  it('con el ledger sano dice que cuadra y cuánto revisó', async () => {
    const verificar = jest.fn().mockResolvedValue(sano);
    const { getByRole, getByText } = await renderWithProviders(
      <LedgerHealth verificar={verificar} />,
    );

    await fireEvent.press(getByRole('button', { name: 'Verificar ahora' }));

    await waitFor(() => {
      expect(getByText('Todo cuadra')).toBeOnTheScreen();
    });
    expect(getByText(/2 cuentas/)).toBeOnTheScreen();
    expect(getByText(/10 transacciones/)).toBeOnTheScreen();
  });

  it('con violaciones las lista con su invariante', async () => {
    const verificar = jest.fn().mockResolvedValue(roto);
    const { getByRole, getByText } = await renderWithProviders(
      <LedgerHealth verificar={verificar} />,
    );

    await fireEvent.press(getByRole('button', { name: 'Verificar ahora' }));

    await waitFor(() => {
      expect(getByText('2 problemas encontrados')).toBeOnTheScreen();
    });
    expect(getByText('transaccion-cuadrada')).toBeOnTheScreen();
    expect(getByText(/"t1" no cuadra/)).toBeOnTheScreen();
  });

  it('si la verificación revienta, lo dice sin detalle técnico y avisa a quien reporta', async () => {
    const verificar = jest.fn().mockRejectedValue(new Error('SQLITE_CORRUPT: página 7'));
    const onError = jest.fn();
    const { getByRole, getByText, queryByText } = await renderWithProviders(
      <LedgerHealth verificar={verificar} onError={onError} />,
    );

    await fireEvent.press(getByRole('button', { name: 'Verificar ahora' }));

    await waitFor(() => {
      expect(getByText('Algo no salió bien')).toBeOnTheScreen();
    });
    expect(queryByText(/SQLITE_CORRUPT|página 7/)).toBeNull();
    expect(onError).toHaveBeenCalledWith(expect.any(Error));
  });

  it('muestra la muestra tipográfica para comprobar la alineación en el teléfono', async () => {
    // Las pruebas confirman que fontVariant se aplica; no que el motor de
    // fuentes lo respete. Esta sección existe para mirarlo en un Android real.
    const { getByText } = await renderWithProviders(
      <LedgerHealth verificar={jest.fn().mockResolvedValue(sano)} />,
    );
    expect(getByText('$ 1.111.111')).toBeOnTheScreen();
    expect(getByText('$ 8.888.888')).toBeOnTheScreen();
  });
});
