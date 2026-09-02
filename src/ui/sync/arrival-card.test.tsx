import type { MovementView } from '@/application/movements/movements';
import { money } from '@/domain/money/money';
import { fireEvent, renderWithProviders } from '@/test/render';

import { ArrivalCard, TEXTO_LLEGADA } from './arrival-card';

const movimiento = (id: string, comercio: string): MovementView =>
  ({
    id,
    fecha: '2026-09-02T10:00:00.000-05:00',
    descripcion: comercio,
    comercio: { nombre: comercio },
    cuenta: { id: 'bancolombia', nombre: 'Bancolombia' },
    categoria: null,
    monto: money(45_000n, 'COP'),
    direction: 'sale',
    esTransferencia: false,
    contraparte: null,
  }) as unknown as MovementView;

describe('ArrivalCard', () => {
  it('dice cuántos llegaron y los enseña', async () => {
    const { getByText } = await renderWithProviders(
      <ArrivalCard
        nuevos={2}
        ultimos={[movimiento('1', 'Éxito'), movimiento('2', 'Rappi')]}
        onCerrar={jest.fn()}
      />,
    );

    expect(getByText(TEXTO_LLEGADA.titulo(2))).toBeOnTheScreen();
    expect(getByText('Éxito')).toBeOnTheScreen();
    expect(getByText('Rappi')).toBeOnTheScreen();
  });

  it('uno solo se dice en singular', () => {
    expect(TEXTO_LLEGADA.titulo(1)).toBe('Llegó 1 movimiento');
  });

  /** Más de tres deja de ser un momento y pasa a ser una lista. */
  it('con muchos, enseña unos pocos y dice cuántos faltan', async () => {
    const muchos = ['a', 'b', 'c', 'd', 'e'].map((n) => movimiento(n, `Comercio ${n}`));

    const { getByText, queryByText } = await renderWithProviders(
      <ArrivalCard nuevos={5} ultimos={muchos} onCerrar={jest.fn()} />,
    );

    expect(getByText('Comercio a')).toBeOnTheScreen();
    expect(queryByText('Comercio d')).toBeNull();
    expect(getByText(TEXTO_LLEGADA.yEstan(2))).toBeOnTheScreen();
  });

  /** Quien tiene prisa no espera a nadie. */
  it('se cierra de un toque', async () => {
    const onCerrar = jest.fn();
    const { getByLabelText } = await renderWithProviders(
      <ArrivalCard nuevos={1} ultimos={[movimiento('1', 'Éxito')]} onCerrar={onCerrar} />,
    );

    await fireEvent.press(getByLabelText(TEXTO_LLEGADA.cerrar));

    expect(onCerrar).toHaveBeenCalledTimes(1);
  });

  it('se anuncia como una unidad al lector de pantalla', async () => {
    const { getByLabelText } = await renderWithProviders(
      <ArrivalCard nuevos={1} ultimos={[movimiento('1', 'Éxito')]} onCerrar={jest.fn()} />,
    );

    expect(getByLabelText(/Llegó 1 movimiento/)).toBeOnTheScreen();
  });
});
