import { ownerId } from '@/domain/ledger/ids';
import { money } from '@/domain/money/money';
import { renderWithProviders } from '@/test/render';

import { TEXTO_WALLET, WalletCard, type WalletEnPantalla } from './wallet-card';

const base: WalletEnPantalla = {
  id: 'wallet:solana:1',
  owner: ownerId('david'),
  red: 'solana',
  direccion: '2VWvtXH5du9amnpU9NHP3dnry2ggSj6qcHwzwUn8DB5J',
  nombre: 'Solana',
  leidoEn: null,
  error: null,
  saldos: [{ chain: 'solana', simbolo: 'USDC', saldo: money(85_761n, 'USDC') }],
};

const HACE_UNA_HORA = '2026-08-31T09:00:00.000-05:00';
const AHORA = '2026-08-31T10:00:00.000-05:00';

describe('WalletCard', () => {
  it('enseña el saldo y cuándo se leyó', async () => {
    const { getByText } = await renderWithProviders(
      <WalletCard
        estado={{ ...base, leidoEn: HACE_UNA_HORA }}
        ahora={AHORA}
        onBorrar={jest.fn()}
      />,
    );

    expect(getByText(/0,085761/)).toBeOnTheScreen();
    expect(getByText(TEXTO_WALLET.leidoHace('hace 1 h'))).toBeOnTheScreen();
  });

  /**
   * Lo que separa «no tienes nada» de «no pude mirar». Borrar el saldo viejo
   * porque el nodo no respondió es borrar plata de la pantalla.
   */
  it('cuando la última lectura falló, lo dice y mantiene el saldo viejo', async () => {
    const { getByText } = await renderWithProviders(
      <WalletCard
        estado={{ ...base, error: 'el nodo no respondió', leidoEn: HACE_UNA_HORA }}
        ahora={AHORA}
        onBorrar={jest.fn()}
      />,
    );

    expect(getByText(TEXTO_WALLET.noSePudoLeer)).toBeOnTheScreen();
    expect(getByText(/0,085761/)).toBeOnTheScreen();
  });

  it('un saldo en cero se enseña como cero, no como un hueco', async () => {
    const { getByText } = await renderWithProviders(
      <WalletCard
        estado={{
          ...base,
          leidoEn: HACE_UNA_HORA,
          saldos: [{ chain: 'solana', simbolo: 'USDC', saldo: money(0n, 'USDC') }],
        }}
        ahora={AHORA}
        onBorrar={jest.fn()}
      />,
    );

    // «0 USDC», no «0,000000 USDC»: el formateador de toda la app recorta los
    // decimales del cero, y lo que pide el criterio es que el cero se vea.
    expect(getByText('0 USDC')).toBeOnTheScreen();
  });

  /**
   * Una wallet recién añadida no se ha leído todavía, y eso no es un fallo:
   * decir «no se pudo leer» ahí asustaría sin motivo.
   */
  it('sin lectura todavía, lo dice y no lo presenta como error', async () => {
    const { getByText, queryByText } = await renderWithProviders(
      <WalletCard estado={base} ahora={AHORA} onBorrar={jest.fn()} />,
    );

    expect(getByText(TEXTO_WALLET.sinLeer)).toBeOnTheScreen();
    expect(queryByText(TEXTO_WALLET.noSePudoLeer)).toBeNull();
  });

  it('dice en qué cadena está cada saldo: con catorce, «USDC» no basta', async () => {
    const { getByText } = await renderWithProviders(
      <WalletCard
        estado={{
          ...base,
          red: 'evm',
          leidoEn: HACE_UNA_HORA,
          saldos: [
            { chain: 'polygon', simbolo: 'USDC.e', saldo: money(50_000n, 'USDC') },
            { chain: 'arbitrum', simbolo: 'USDC', saldo: money(1n, 'USDC') },
          ],
        }}
        ahora={AHORA}
        onBorrar={jest.fn()}
      />,
    );

    expect(getByText('USDC.e en polygon')).toBeOnTheScreen();
    expect(getByText('USDC en arbitrum')).toBeOnTheScreen();
  });

  it('sin saldo en ninguna cadena lo dice, y no como si fuera un fallo', async () => {
    const { getByText, queryByText } = await renderWithProviders(
      <WalletCard
        estado={{ ...base, leidoEn: HACE_UNA_HORA, saldos: [] }}
        ahora={AHORA}
        onBorrar={jest.fn()}
      />,
    );

    expect(getByText(TEXTO_WALLET.sinSaldo)).toBeOnTheScreen();
    expect(queryByText(TEXTO_WALLET.noSePudoLeer)).toBeNull();
  });

  it('enseña la dirección abreviada: la entera no cabe y no se lee', async () => {
    const { getByText } = await renderWithProviders(
      <WalletCard estado={base} ahora={AHORA} onBorrar={jest.fn()} />,
    );

    expect(getByText(/2VWvtX.*DB5J/)).toBeOnTheScreen();
  });
});
