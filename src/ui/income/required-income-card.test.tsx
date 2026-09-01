import type { ResumenIngreso } from '@/application/income/required-income';
import { money } from '@/domain/money/money';
import { renderWithProviders } from '@/test/render';

import { RequiredIncomeCard, TEXTO_INGRESO } from './required-income-card';

const COP = 'COP' as const;

const base: ResumenIngreso = {
  requerido: {
    minimo: money(1_200_000, COP),
    sostener: money(2_400_000, COP),
    conMetas: money(2_900_000, COP),
  },
  observado: money(3_000_000, COP),
  meses: 3,
  brecha: money(-600_000, COP),
};

describe('RequiredIncomeCard', () => {
  it('enseña las tres cifras y qué incluye cada una', async () => {
    const { getByText } = await renderWithProviders(<RequiredIncomeCard resumen={base} />);

    expect(getByText('$ 1.200.000')).toBeOnTheScreen();
    expect(getByText('$ 2.400.000')).toBeOnTheScreen();
    expect(getByText('$ 2.900.000')).toBeOnTheScreen();
    expect(getByText(TEXTO_INGRESO.minimoQue)).toBeOnTheScreen();
  });

  /** Un promedio de un mes no es un promedio. */
  it('compara contra lo que entra, diciendo de cuántos meses', async () => {
    const { getByText } = await renderWithProviders(<RequiredIncomeCard resumen={base} />);

    expect(getByText(TEXTO_INGRESO.observado(3))).toBeOnTheScreen();
    expect(getByText('$ 3.000.000')).toBeOnTheScreen();
  });

  it('cuando alcanza, lo dice', async () => {
    const { getByText } = await renderWithProviders(<RequiredIncomeCard resumen={base} />);

    expect(getByText(TEXTO_INGRESO.alcanza)).toBeOnTheScreen();
  });

  /** El principio 3 entero: quien mira esto ya sabe que va apretado. */
  it('cuando no alcanza lo dice sin regañar', async () => {
    const { getByText } = await renderWithProviders(
      <RequiredIncomeCard
        resumen={{ ...base, observado: money(1_000_000, COP), brecha: money(1_400_000, COP) }}
      />,
    );

    expect(getByText(TEXTO_INGRESO.noAlcanza)).toBeOnTheScreen();
    expect(TEXTO_INGRESO.noAlcanza).not.toMatch(/deberías|tienes que|mal|error/i);
  });

  /** Devolver cero diría «no ganas nada». */
  it('sin historia no presenta un promedio como un hecho', async () => {
    const { getByText, queryByText } = await renderWithProviders(
      <RequiredIncomeCard resumen={{ ...base, observado: null, meses: 0, brecha: null }} />,
    );

    expect(getByText(TEXTO_INGRESO.sinObservado)).toBeOnTheScreen();
    expect(queryByText(TEXTO_INGRESO.alcanza)).toBeNull();
  });
});
