import { money } from '@/domain/money/money';
import { renderWithProviders } from '@/test/render';
import { ProjectionChart, TEXTO_PROYECCION } from '@/ui/cashflow/projection-chart';
import { NetWorthChart, TEXTO_EVOLUCION } from '@/ui/overview/net-worth-chart';
import { CategoryBars, TEXTO_INFORMES } from '@/ui/reports/category-bars';
import { MonthlyBars } from '@/ui/reports/monthly-bars';

const COP = 'COP' as const;

/**
 * Lo que oye quien no ve la gráfica.
 *
 * «Gráfica de barras de seis meses» no le sirve a nadie: describe la forma, no
 * la respuesta. Una gráfica existe para contestar una pregunta —está escrita
 * encima de cada una desde el sprint 11—, y el anuncio tiene que contestar la
 * misma.
 */
describe('las gráficas se anuncian por lo que responden', () => {
  it('el gasto por categoría dice en qué se va, y cuánto', async () => {
    const { getByLabelText } = await renderWithProviders(
      <CategoryBars
        filas={[
          { categoria: 'mercado', total: money(620_000n, COP), porcentaje: 42 },
          { categoria: 'taxi-y-apps', total: money(180_000n, COP), porcentaje: 12 },
        ]}
      />,
    );

    expect(
      getByLabelText(TEXTO_INFORMES.anuncioCategorias('mercado', '620.000', 42)),
    ).toBeOnTheScreen();
  });

  it('la evolución de una categoría dice de cuánto a cuánto', async () => {
    const { getByLabelText } = await renderWithProviders(
      <MonthlyBars
        categoria="mercado"
        meses={[
          { mes: '2026-07', total: money(400_000n, COP) },
          { mes: '2026-08', total: money(620_000n, COP) },
        ]}
      />,
    );

    expect(
      getByLabelText(TEXTO_INFORMES.anuncioEvolucion('mercado', '400.000', '620.000', 2)),
    ).toBeOnTheScreen();
  });

  /** Lo que importa de la proyección es si algún mes no alcanza. */
  it('la proyección dice si el saldo aguanta, y si no, cuándo', async () => {
    const meses = [
      {
        mes: '2026-09',
        saldoInicial: money(1_000_000n, COP),
        saldoFinal: money(500_000n, COP),
        comprometido: money(500_000n, COP),
        estimado: money(0n, COP),
      },
      {
        mes: '2026-10',
        saldoInicial: money(500_000n, COP),
        saldoFinal: money(-200_000n, COP),
        comprometido: money(700_000n, COP),
        estimado: money(0n, COP),
      },
    ];

    const { getByLabelText } = await renderWithProviders(
      <ProjectionChart meses={meses} primerMesEnRojo="2026-10" />,
    );

    expect(getByLabelText(TEXTO_PROYECCION.anuncio(2, '-200.000', '2026-10'))).toBeOnTheScreen();
  });

  it('el patrimonio dice de cuánto a cuánto, no que es una gráfica', async () => {
    const { getByLabelText } = await renderWithProviders(
      <NetWorthChart
        serie={[
          {
            owner: 'david' as never,
            dia: '2026-08-01',
            patrimonio: money(1_000_000n, COP),
            tasas: 'TRM',
            tomadaEn: '2026-08-01T10:00:00.000-05:00',
          },
          {
            owner: 'david' as never,
            dia: '2026-08-02',
            patrimonio: money(1_200_000n, COP),
            tasas: 'TRM',
            tomadaEn: '2026-08-02T10:00:00.000-05:00',
          },
        ]}
      />,
    );

    expect(getByLabelText(TEXTO_EVOLUCION.anuncio(2, '1.000.000', '1.200.000'))).toBeOnTheScreen();
  });

  /** Ninguna se anuncia por su forma: eso describe el dibujo, no el dato. */
  it('ninguna se anuncia como «gráfica de barras»', () => {
    for (const anuncio of [
      TEXTO_INFORMES.anuncioCategorias('mercado', '1', 1),
      TEXTO_INFORMES.anuncioEvolucion('mercado', '1', '2', 3),
      TEXTO_PROYECCION.anuncio(3, '1', null),
      TEXTO_EVOLUCION.anuncio(3, '1', '2'),
    ]) {
      expect(anuncio).not.toMatch(/gráfica|barras|eje/i);
    }
  });
});
