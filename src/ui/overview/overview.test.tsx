import { fireEvent } from '@testing-library/react-native';

import { createAccount } from '@/domain/ledger/account';
import { accountId, ownerId } from '@/domain/ledger/ids';
import { money } from '@/domain/money/money';
import type { Reconciliation } from '@/domain/reconciliation/reconciliation';
import { renderWithProviders } from '@/test/render';
import { LIGHT_PALETTE } from '@/ui/theme/palette';

import { AccountRow } from './account-row';
import { DriftCard } from './drift-card';
import { OverviewHeader } from './overview-header';

const owner = ownerId('david');
const ahora = '2026-08-28T12:00:00.000-05:00';

describe('OverviewHeader', () => {
  it('pinta el patrimonio grande, neutro y con moneda', async () => {
    const { getByText } = await renderWithProviders(
      <OverviewHeader patrimonio={money(1234567, 'COP')} ultimaSincronizacion={null} now={ahora} />,
    );
    expect(getByText('$ 1.234.567')).toHaveStyle({ fontSize: 40 });
  });

  it('sin sincronización lo dice sin alarmar', async () => {
    const { getByText } = await renderWithProviders(
      <OverviewHeader patrimonio={money(0, 'COP')} ultimaSincronizacion={null} now={ahora} />,
    );
    expect(getByText('Todavía no se ha sincronizado')).toBeOnTheScreen();
  });

  it('con sincronización dice hace cuánto', async () => {
    const { getByText } = await renderWithProviders(
      <OverviewHeader
        patrimonio={money(0, 'COP')}
        ultimaSincronizacion="2026-08-28T09:00:00.000-05:00"
        now={ahora}
      />,
    );
    expect(getByText('Sincronizado hace 3 h')).toBeOnTheScreen();
  });
});

describe('AccountRow', () => {
  const activo = createAccount({
    id: accountId('bancolombia:ahorros'),
    owner,
    kind: 'activo',
    nombre: 'Bancolombia',
    currency: 'COP',
  });
  const pasivo = createAccount({
    id: accountId('nu:tarjeta'),
    owner,
    kind: 'pasivo',
    nombre: 'Nu',
    currency: 'COP',
  });

  it('muestra nombre y saldo y es pulsable', async () => {
    const onPress = jest.fn();
    const { getByRole, getByText } = await renderWithProviders(
      <AccountRow account={activo} saldo={money(955000, 'COP')} onPress={onPress} />,
    );
    expect(getByText('$ 955.000')).toBeOnTheScreen();
    await fireEvent.press(getByRole('button', { name: /Bancolombia/ }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('un pasivo se muestra como deuda, no como saldo negativo', async () => {
    const { getByText, getByLabelText } = await renderWithProviders(
      <AccountRow account={pasivo} saldo={money(-300000, 'COP')} onPress={() => undefined} />,
    );
    expect(getByText('−$ 300.000')).toBeOnTheScreen();
    expect(getByText('Debes')).toBeOnTheScreen();
    expect(getByLabelText('Nu. Debes. Salen 300.000 pesos')).toBeOnTheScreen();
  });
});

describe('DriftCard', () => {
  const base: Reconciliation = {
    id: 'r',
    owner,
    accountId: accountId('bancolombia:ahorros'),
    fecha: '2026-08-28T10:00:00.000-05:00',
    saldoReal: money(955000, 'COP'),
    saldoCalculado: money(1000000, 'COP'),
    diferencia: money(-45000, 'COP'),
    veredicto: 'gasto-no-capturado',
    fuente: 'bancolombia',
    detalle: 'Ahorros ****8901',
    creadoEn: '2026-08-28T10:00:00.000-05:00',
  };

  it('con gasto no capturado lo dice en lenguaje llano y pinta el monto como gasto, no como peligro', async () => {
    const { getByText } = await renderWithProviders(<DriftCard reconciliation={base} />);
    expect(getByText('Salieron sin que Sereno lo viera')).toBeOnTheScreen();
    expect(getByText('−$ 45.000')).toHaveStyle({ color: LIGHT_PALETTE.gasto });
    expect(getByText('Comparado con Ahorros ****8901 el 28 de agosto de 2026')).toBeOnTheScreen();
  });

  it('con ingreso no capturado', async () => {
    const { getByText } = await renderWithProviders(
      <DriftCard
        reconciliation={{
          ...base,
          diferencia: money(200000, 'COP'),
          veredicto: 'ingreso-no-capturado',
        }}
      />,
    );
    expect(getByText('Entraron sin que Sereno lo viera')).toBeOnTheScreen();
    expect(getByText('+$ 200.000')).toBeOnTheScreen();
  });

  it('cuando cuadra no alarma ni ofrece nada', async () => {
    const { getByText, queryByRole } = await renderWithProviders(
      <DriftCard
        reconciliation={{ ...base, diferencia: money(0, 'COP'), veredicto: 'cuadra' }}
        onAdjust={() => undefined}
      />,
    );
    expect(getByText('Cuadra con el banco')).toHaveStyle({ color: LIGHT_PALETTE.ingreso });
    expect(queryByRole('button')).toBeNull();
  });

  it('ofrece asumir la diferencia solo si no cuadra y hay acción', async () => {
    const onAdjust = jest.fn();
    const { getByRole } = await renderWithProviders(
      <DriftCard reconciliation={base} onAdjust={onAdjust} />,
    );
    await fireEvent.press(getByRole('button', { name: 'Asumir la diferencia' }));
    expect(onAdjust).toHaveBeenCalledTimes(1);
  });
});
