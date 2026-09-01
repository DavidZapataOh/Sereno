import type { DebtSummary } from '@/application/debt/list-debts';
import { accountId, ownerId } from '@/domain/ledger/ids';
import { money } from '@/domain/money/money';
import { renderWithProviders } from '@/test/render';

import { DebtRow, TEXTO_FILA_DEUDA } from './debt-row';

const owner = ownerId('david');
const id = accountId('prestamo:banco');

const base: DebtSummary = {
  accountId: id,
  nombre: 'Crédito',
  saldo: money(-1_000_000, 'COP'),
  terminos: {
    accountId: id,
    owner,
    tipo: 'prestamo',
    nombre: 'Crédito',
    tasa: { valor: 0.24, tipo: 'EA' },
    cuotasTotales: 36,
    diaDePago: 15,
  },
};

describe('DebtRow', () => {
  /**
   * Con la misma convención que la lista de Cuentas: un pasivo se enseña con
   * signo de salida. Inventar otra aquí haría que la misma deuda se viera de
   * dos formas en dos pantallas.
   */
  it('enseña el nombre y lo que se debe', async () => {
    const { getByText } = await renderWithProviders(<DebtRow deuda={base} />);

    expect(getByText('Crédito')).toBeOnTheScreen();
    expect(getByText('−$ 1.000.000')).toBeOnTheScreen();
  });

  it('dice de qué tipo es la deuda', async () => {
    const { getByText } = await renderWithProviders(<DebtRow deuda={base} />);

    expect(getByText(TEXTO_FILA_DEUDA.tipo.prestamo)).toBeOnTheScreen();
  });

  /**
   * Un pasivo que llegó por la ingesta y que nadie ha configurado sigue siendo
   * plata que se debe: esconderlo sería mentir por omisión.
   */
  it('una deuda sin términos declarados lo dice, y se sigue viendo', async () => {
    const { getByText } = await renderWithProviders(
      <DebtRow deuda={{ ...base, terminos: null }} />,
    );

    expect(getByText(TEXTO_FILA_DEUDA.sinDeclarar)).toBeOnTheScreen();
    expect(getByText('−$ 1.000.000')).toBeOnTheScreen();
  });

  it('una deuda saldada se ve en cero, no desaparece', async () => {
    const { getByText } = await renderWithProviders(
      <DebtRow deuda={{ ...base, saldo: money(0, 'COP') }} />,
    );

    expect(getByText(TEXTO_FILA_DEUDA.saldada)).toBeOnTheScreen();
    expect(getByText('$ 0')).toBeOnTheScreen();
  });
});
