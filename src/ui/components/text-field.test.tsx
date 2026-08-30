import { fireEvent } from '@testing-library/react-native';

import { renderWithProviders } from '@/test/render';

import { MoneyField, TextField } from './text-field';

describe('TextField', () => {
  it('muestra la etiqueta y propaga el texto', async () => {
    const onChangeText = jest.fn();
    const { getByLabelText } = await renderWithProviders(
      <TextField label="Descripción" value="" onChangeText={onChangeText} />,
    );
    await fireEvent.changeText(getByLabelText('Descripción'), 'Almuerzo');
    expect(onChangeText).toHaveBeenCalledWith('Almuerzo');
  });

  it('muestra el error debajo, sin signos de admiración', async () => {
    const { getByText } = await renderWithProviders(
      <TextField
        label="D"
        value=""
        onChangeText={() => undefined}
        error="Escribe una descripción"
      />,
    );
    expect(getByText('Escribe una descripción')).toBeOnTheScreen();
  });
});

describe('MoneyField', () => {
  it('ignora lo que no sea dígito y emite el monto en pesos', async () => {
    const onChange = jest.fn();
    const { getByLabelText } = await renderWithProviders(
      <MoneyField label="Monto" value={null} onChange={onChange} />,
    );
    await fireEvent.changeText(getByLabelText('Monto'), '12a000');
    expect(onChange).toHaveBeenCalledWith(12000n);
  });

  it('muestra el valor formateado con punto de miles', async () => {
    const { getByDisplayValue } = await renderWithProviders(
      <MoneyField label="Monto" value={12000n} onChange={() => undefined} />,
    );
    expect(getByDisplayValue('12.000')).toBeOnTheScreen();
  });

  it('vacío emite null', async () => {
    const onChange = jest.fn();
    const { getByLabelText } = await renderWithProviders(
      <MoneyField label="Monto" value={12000n} onChange={onChange} />,
    );
    await fireEvent.changeText(getByLabelText('Monto'), '');
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it('usa el teclado numérico', async () => {
    const { getByLabelText } = await renderWithProviders(
      <MoneyField label="Monto" value={null} onChange={() => undefined} />,
    );
    expect((getByLabelText('Monto').props as { keyboardType: string }).keyboardType).toBe(
      'number-pad',
    );
  });
});
