import { renderWithProviders } from '@/test/render';

import { BootReport, TEXTO_ARRANQUE } from './boot-report';

const COMPLETO = [
  { fase: 'fuentes' as const, ms: 120 },
  { fase: 'base' as const, ms: 8 },
  { fase: 'migraciones' as const, ms: 45 },
  { fase: 'primera-pantalla' as const, ms: 60 },
];

describe('BootReport', () => {
  it('enseña las cuatro fases con su tiempo', async () => {
    const { getByText } = await renderWithProviders(<BootReport marcas={COMPLETO} total={233} />);

    for (const marca of COMPLETO) {
      expect(getByText(TEXTO_ARRANQUE.fase[marca.fase] ?? '')).toBeOnTheScreen();
      expect(getByText(`${String(marca.ms)} ms`)).toBeOnTheScreen();
    }
  });

  /** Un número suelto no dice qué arreglar; la pregunta sí. */
  it('dice qué pregunta responde', async () => {
    const { getByText } = await renderWithProviders(<BootReport marcas={COMPLETO} total={233} />);

    expect(getByText(TEXTO_ARRANQUE.pregunta)).toBeOnTheScreen();
    expect(getByText(TEXTO_ARRANQUE.total(233))).toBeOnTheScreen();
  });

  /** Un arranque a medias se dice: si no, faltarían fases sin explicación. */
  it('un arranque incompleto se declara', async () => {
    const { getByText } = await renderWithProviders(
      <BootReport marcas={COMPLETO.slice(0, 2)} total={null} />,
    );

    expect(getByText(TEXTO_ARRANQUE.incompleto)).toBeOnTheScreen();
  });

  it('sin medidas lo dice, y no enseña un cero', async () => {
    const { getByText, queryByText } = await renderWithProviders(
      <BootReport marcas={[]} total={null} />,
    );

    expect(getByText(TEXTO_ARRANQUE.vacio)).toBeOnTheScreen();
    expect(queryByText('0 ms')).toBeNull();
  });
});
