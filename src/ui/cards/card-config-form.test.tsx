import type { CardConfig } from '@/application/cards/configure-card';
import { createCreditCard } from '@/domain/cards/card';
import { createAccount } from '@/domain/ledger/account';
import { accountId, ownerId } from '@/domain/ledger/ids';
import { money } from '@/domain/money/money';
import { fireEvent, renderWithProviders, waitFor } from '@/test/render';

import { CardConfigForm, DIAS, TEXTO_CONFIG } from './card-config-form';

const owner = ownerId('david');
const rappi = accountId('rappicard:tarjeta');
const cuenta = createAccount({
  id: rappi,
  owner,
  kind: 'pasivo',
  nombre: 'RappiCard',
  currency: 'COP',
});

const sinConfigurar: CardConfig = { cuenta, tarjeta: null };
const configurada: CardConfig = {
  cuenta,
  tarjeta: createCreditCard({
    accountId: rappi,
    owner,
    cupo: money(3_000_000, 'COP'),
    diaDeCorte: 15,
    diaDePago: 5,
  }),
};

describe('CardConfigForm', () => {
  it('enseña el nombre de la tarjeta', async () => {
    const { getByText } = await renderWithProviders(
      <CardConfigForm config={sinConfigurar} onGuardar={() => undefined} />,
    );

    expect(getByText('RappiCard')).toBeOnTheScreen();
  });

  it('trae los datos ya guardados', async () => {
    const { getByTestId } = await renderWithProviders(
      <CardConfigForm config={configurada} onGuardar={() => undefined} />,
    );

    expect(getByTestId(`cupo-${rappi}`).props.value).toBe('3000000');
  });

  /**
   * Los días 29, 30 y 31 no existen todos los meses. Se eligen en vez de
   * escribirse: así el error no llega nunca al dominio y no hay que
   * explicarlo con un mensaje.
   */
  it('solo ofrece días del 1 al 28', async () => {
    expect(DIAS).toHaveLength(28);
    expect(DIAS.at(-1)).toBe(28);

    const { getByLabelText, queryByLabelText } = await renderWithProviders(
      <CardConfigForm config={sinConfigurar} onGuardar={() => undefined} />,
    );

    expect(getByLabelText(`${TEXTO_CONFIG.corte}: 28`)).toBeOnTheScreen();
    expect(queryByLabelText(`${TEXTO_CONFIG.corte}: 31`)).toBeNull();
  });

  it('guarda lo que se eligió', async () => {
    const onGuardar = jest.fn();
    const { getByTestId, getByLabelText, getByText } = await renderWithProviders(
      <CardConfigForm config={sinConfigurar} onGuardar={onGuardar} />,
    );

    await fireEvent.changeText(getByTestId(`cupo-${rappi}`), '2500000');
    await fireEvent.press(getByLabelText(`${TEXTO_CONFIG.corte}: 20`));
    await fireEvent.press(getByLabelText(`${TEXTO_CONFIG.pago}: 10`));
    await fireEvent.press(getByText(TEXTO_CONFIG.guardar));

    await waitFor(() => {
      expect(onGuardar).toHaveBeenCalledWith({
        cupo: 2_500_000n,
        diaDeCorte: 20,
        diaDePago: 10,
      });
    });
  });

  it('sin cupo no deja guardar: no hay nada que guardar', async () => {
    const onGuardar = jest.fn();
    const { getByText } = await renderWithProviders(
      <CardConfigForm config={sinConfigurar} onGuardar={onGuardar} />,
    );

    await fireEvent.press(getByText(TEXTO_CONFIG.guardar));

    expect(onGuardar).not.toHaveBeenCalled();
  });

  /**
   * `BigInt('3.000.000')` lanza. Sin esta guarda, escribir el cupo con puntos
   * —que es como lo escribe cualquiera— reventaría al tocar Guardar.
   */
  it('un cupo con puntos o letras no se puede guardar, y lo dice', async () => {
    const onGuardar = jest.fn();
    const { getByTestId, getByText } = await renderWithProviders(
      <CardConfigForm config={sinConfigurar} onGuardar={onGuardar} />,
    );

    await fireEvent.changeText(getByTestId(`cupo-${rappi}`), '3.000.000');
    await fireEvent.press(getByText(TEXTO_CONFIG.guardar));

    expect(onGuardar).not.toHaveBeenCalled();
    expect(getByText(TEXTO_CONFIG.soloEnteros)).toBeOnTheScreen();
  });
});
