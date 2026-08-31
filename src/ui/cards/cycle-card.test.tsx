import type { CycleCheck } from '@/application/cards/verify-cycle';
import { cicloDe } from '@/domain/cards/billing-cycle';
import { money } from '@/domain/money/money';
import { renderWithProviders } from '@/test/render';

import { CycleCard, TEXTO_CICLO } from './cycle-card';

const ciclo = cicloDe('2026-08-20', 15, 5);
const HOY = '2026-09-14T10:00:00.000-05:00';

const check = (extra: Partial<CycleCheck> = {}): CycleCheck => ({
  ciclo,
  comprado: money(1_200_000, 'COP'),
  pagado: money(1_200_000, 'COP'),
  diferencia: money(0, 'COP'),
  veredicto: 'al-dia',
  ...extra,
});

describe('CycleCard', () => {
  it('dice cuánto va del ciclo', async () => {
    const { getByText, getByTestId } = await renderWithProviders(
      <CycleCard check={check()} hoy={HOY} />,
    );

    expect(getByText(new RegExp(TEXTO_CICLO.enCurso))).toBeOnTheScreen();
    expect(getByTestId('ciclo-comprado')).toHaveTextContent('$ 1.200.000');
  });

  it('mientras está abierto dice cuándo cierra', async () => {
    const { getByText } = await renderWithProviders(
      <CycleCard check={check({ veredicto: 'sin-pago', pagado: money(0, 'COP') })} hoy={HOY} />,
    );

    expect(getByText(/Cierra mañana/)).toBeOnTheScreen();
  });

  it('cuando ya cerró, dice cuándo se paga', async () => {
    const { getByText } = await renderWithProviders(<CycleCard check={check()} hoy={HOY} />);

    expect(getByText(/Se paga/)).toBeOnTheScreen();
  });

  /**
   * Pagar menos de lo comprado no es un error: es financiación. Si se pintara
   * como alarma, la alarma dejaría de significar nada.
   */
  it('cuando queda debiendo lo explica, sin tratarlo como un error', async () => {
    const { getByText, getByTestId } = await renderWithProviders(
      <CycleCard
        check={check({
          veredicto: 'financiado',
          pagado: money(100_000, 'COP'),
          diferencia: money(1_100_000, 'COP'),
        })}
        hoy={HOY}
      />,
    );

    expect(getByText(TEXTO_CICLO.financiado)).toBeOnTheScreen();
    expect(getByTestId('ciclo-financiado')).toHaveTextContent('$ 1.100.000');
    expect(getByText(TEXTO_CICLO.financiadoAyuda)).toBeOnTheScreen();
  });

  it('cuando se pagó completo lo dice, y no habla de deuda', async () => {
    const { getByText, queryByText } = await renderWithProviders(
      <CycleCard check={check()} hoy={HOY} />,
    );

    expect(getByText(TEXTO_CICLO.alDia)).toBeOnTheScreen();
    expect(queryByText(TEXTO_CICLO.financiado)).toBeNull();
  });

  it('un abono de más se explica como abono a deuda anterior', async () => {
    const { getByText } = await renderWithProviders(
      <CycleCard
        check={check({ veredicto: 'adelantado', diferencia: money(-400_000, 'COP') })}
        hoy={HOY}
      />,
    );

    expect(getByText(TEXTO_CICLO.adelantado)).toBeOnTheScreen();
  });

  /**
   * Un mensaje relativo mal calculado el día del vencimiento es la forma más
   * fácil de perder la confianza en todo lo demás.
   */
  it('el día del pago dice «hoy», no «mañana»', async () => {
    const { getByText } = await renderWithProviders(
      <CycleCard check={check()} hoy={`${ciclo.pago}T10:00:00.000-05:00`} />,
    );

    expect(getByText(/Se paga hoy/)).toBeOnTheScreen();
  });
});
