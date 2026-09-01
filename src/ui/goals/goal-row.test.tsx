import type { GoalState } from '@/application/goals/goal-progress';
import { accountId, ownerId } from '@/domain/ledger/ids';
import { money } from '@/domain/money/money';
import { renderWithProviders } from '@/test/render';

import { GoalRow, TEXTO_META } from './goal-row';

const COP = 'COP' as const;

const base: GoalState = {
  fondo: {
    accountId: accountId('meta:viaje'),
    owner: ownerId('david'),
    nombre: 'Viaje a Japón',
    tipo: 'meta',
    objetivo: money(6_000_000, COP),
    proximaFecha: '2027-09-01',
    cadaMeses: null,
  },
  apartado: money(1_500_000, COP),
  falta: money(4_500_000, COP),
  aporteDeEsteMes: money(460_000, COP),
  alcanza: true,
  ritmo: { estado: 'al-dia', diferencia: money(0, COP) },
};

describe('GoalRow', () => {
  it('enseña cuánto lleva, para cuándo y qué toca este mes', async () => {
    const { getByText } = await renderWithProviders(<GoalRow estado={base} />);

    expect(getByText('Viaje a Japón')).toBeOnTheScreen();
    expect(getByText('$ 1.500.000')).toBeOnTheScreen();
    expect(getByText('$ 460.000')).toBeOnTheScreen();
  });

  it('dice si va adelantado o atrasado', async () => {
    const { getByText } = await renderWithProviders(
      <GoalRow
        estado={{ ...base, ritmo: { estado: 'atrasado', diferencia: money(-200_000, COP) } }}
      />,
    );

    expect(getByText(TEXTO_META.ritmo.atrasado)).toBeOnTheScreen();
  });

  /** Sin confeti: celebrar convierte la herramienta en un juego. */
  it('una meta cumplida se ve cumplida, sin celebrarlo', async () => {
    const { getByText, queryByText } = await renderWithProviders(
      <GoalRow estado={{ ...base, apartado: money(6_000_000, COP), falta: money(0, COP) }} />,
    );

    expect(getByText(TEXTO_META.cumplida)).toBeOnTheScreen();
    expect(queryByText(TEXTO_META.esteMes)).toBeNull();
  });

  it('el aviso de que no cabe está escrito sin regañar', () => {
    expect(TEXTO_META.noCabe).not.toMatch(/deberías|tienes que|mal/i);
  });
});
