import { resumenPublicable } from '@/domain/assistant/publishable-summary';
import type { AssistantAnswer } from '@/domain/sync/server-client';
import { fireEvent, renderWithProviders } from '@/test/render';

import { TEXTO_ASISTENTE } from './answer-card';
import { AssistantPanel } from './assistant-panel';

const RESPUESTA: AssistantAnswer = {
  respuesta: 'Con lo que tienes hoy, no te alcanza sin tocar la deuda.',
  cifrasUsadas: ['saldoTotal', 'deudaTotal'],
  tokens: { entrada: 400, salida: 120 },
  costoUsd: 0.005,
};

const ENVIADO = resumenPublicable({
  gastoPorCategoria: { mercado: 620_000 },
  saldoTotal: 3_904,
  deudaTotal: 1_897_917,
  patrimonio: -1_814_013,
  patrimonioHace30Dias: null,
  tasaDeAhorroPct: null,
  mesesDeColchon: null,
  ingresoMensual: null,
});

const panel = (props: Partial<Parameters<typeof AssistantPanel>[0]> = {}) => (
  <AssistantPanel onPreguntar={jest.fn()} pensando={false} {...props} />
);

describe('AssistantPanel', () => {
  /** Que la limitación no parezca un fallo: se dice antes de preguntar. */
  it('dice de antemano qué no puede responder', async () => {
    const { getByText } = await renderWithProviders(panel());

    expect(getByText(TEXTO_ASISTENTE.limite)).toBeOnTheScreen();
    expect(TEXTO_ASISTENTE.limite).toMatch(/comercio/i);
  });

  /** Sin esto, la respuesta es un oráculo. Con esto, se puede comprobar. */
  it('enseña qué cifras usó para responder', async () => {
    const { getByText } = await renderWithProviders(
      panel({ resultado: { estado: 'ok', respuesta: RESPUESTA } }),
    );

    expect(getByText(RESPUESTA.respuesta)).toBeOnTheScreen();
    expect(getByText('saldoTotal, deudaTotal')).toBeOnTheScreen();
  });

  /** Es plata de David por una función accesoria. */
  it('enseña lo que costó la consulta', async () => {
    const { getByText } = await renderWithProviders(
      panel({ resultado: { estado: 'ok', respuesta: RESPUESTA } }),
    );

    expect(getByText(TEXTO_ASISTENTE.costo(RESPUESTA.costoUsd))).toBeOnTheScreen();
  });

  /** Igual que Binance en el sprint 08: se dice, y no se rompe nada. */
  it('sin clave configurada lo dice y no se rompe', async () => {
    const { getByText } = await renderWithProviders(
      panel({ resultado: { estado: 'sin-configurar' } }),
    );

    expect(getByText(TEXTO_ASISTENTE.sinConfigurar)).toBeOnTheScreen();
    expect(getByText(TEXTO_ASISTENTE.sinConfigurarAyuda)).toBeOnTheScreen();
  });

  it('al llegar al tope lo dice, y dice por qué existe', async () => {
    const { getByText } = await renderWithProviders(
      panel({ resultado: { estado: 'tope-diario' } }),
    );

    expect(getByText(TEXTO_ASISTENTE.tope)).toBeOnTheScreen();
    expect(TEXTO_ASISTENTE.topeAyuda).toMatch(/factura/i);
  });

  it('mientras responde se ve que está pensando', async () => {
    const { getByLabelText } = await renderWithProviders(panel({ pensando: true }));

    // Mientras piensa, el botón lo anuncia: quien no ve la pantalla también
    // tiene que enterarse de que hay algo en curso.
    expect(getByLabelText(TEXTO_ASISTENTE.pensando)).toBeOnTheScreen();
  });

  it('no deja preguntar en vacío', async () => {
    const onPreguntar = jest.fn();
    const { getByText } = await renderWithProviders(panel({ onPreguntar }));

    await fireEvent.press(getByText(TEXTO_ASISTENTE.preguntar));

    expect(onPreguntar).not.toHaveBeenCalled();
  });

  it('manda la pregunta escrita, sin espacios de sobra', async () => {
    const onPreguntar = jest.fn();
    const { getByText, getByTestId } = await renderWithProviders(panel({ onPreguntar }));

    await fireEvent.changeText(getByTestId('pregunta'), '  ¿me alcanza?  ');
    await fireEvent.press(getByText(TEXTO_ASISTENTE.preguntar));

    expect(onPreguntar).toHaveBeenCalledWith('¿me alcanza?');
  });

  /**
   * La otra mitad de la decisión de David: no hay que creerle a nadie que solo
   * salieron cifras, se puede mirar.
   */
  it('enseña exactamente lo que salió del teléfono', async () => {
    const { getByText } = await renderWithProviders(panel({ enviado: ENVIADO }));

    expect(getByText(TEXTO_ASISTENTE.queSalio)).toBeOnTheScreen();
    expect(getByText(JSON.stringify(ENVIADO, null, 2))).toBeOnTheScreen();
  });

  it('un fallo de red se ve, y no como una respuesta', async () => {
    const { getByText, queryByText } = await renderWithProviders(panel({ fallo: true }));

    expect(getByText(TEXTO_ASISTENTE.error)).toBeOnTheScreen();
    expect(queryByText(TEXTO_ASISTENTE.cifras)).toBeNull();
  });
});
