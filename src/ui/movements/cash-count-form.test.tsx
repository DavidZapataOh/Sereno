import { CashCountForm } from './cash-count-form';
import { fireEvent, renderWithProviders, waitFor } from '@/test/render';

describe('CashCountForm', () => {
  it('muestra lo que Sereno cree y entrega lo que el usuario cuenta', async () => {
    const onSubmit = jest.fn(() => Promise.resolve());
    const { getByLabelText, getByText } = await renderWithProviders(
      <CashCountForm actual={40000n} onSubmit={onSubmit} onCancel={() => undefined} />,
    );
    expect(getByText('$ 40.000')).toBeOnTheScreen();

    await fireEvent.changeText(getByLabelText('¿Cuánto tienes ahora?'), '120000');
    await fireEvent.press(getByText('Guardar'));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(120000n);
    });
  });

  it('acepta cero: la billetera puede estar vacía', async () => {
    const onSubmit = jest.fn(() => Promise.resolve());
    const { getByLabelText, getByText } = await renderWithProviders(
      <CashCountForm actual={40000n} onSubmit={onSubmit} onCancel={() => undefined} />,
    );
    await fireEvent.changeText(getByLabelText('¿Cuánto tienes ahora?'), '0');
    await fireEvent.press(getByText('Guardar'));
    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(0n);
    });
  });

  it('sin monto no deja guardar', async () => {
    const onSubmit = jest.fn(() => Promise.resolve());
    const { getByText } = await renderWithProviders(
      <CashCountForm actual={0n} onSubmit={onSubmit} onCancel={() => undefined} />,
    );
    await fireEvent.press(getByText('Guardar'));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('si falla, lo dice y deja reintentar', async () => {
    const onSubmit = jest.fn(() => Promise.reject(new Error('sin red')));
    const { getByLabelText, getByText } = await renderWithProviders(
      <CashCountForm actual={0n} onSubmit={onSubmit} onCancel={() => undefined} />,
    );
    await fireEvent.changeText(getByLabelText('¿Cuánto tienes ahora?'), '5000');
    await fireEvent.press(getByText('Guardar'));
    await waitFor(() => {
      expect(getByText(/No se pudo guardar/)).toBeOnTheScreen();
    });
  });
});
