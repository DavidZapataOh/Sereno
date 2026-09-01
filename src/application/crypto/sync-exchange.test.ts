import { ownerId } from '@/domain/ledger/ids';
import { createInMemoryAccountRepository } from '@/test/fakes/in-memory-account-repository';
import { createInMemoryTransactionRepository } from '@/test/fakes/in-memory-transaction-repository';
import { createFakeServerClient } from '@/test/fakes/fake-server-client';
import { createSequentialIds } from '@/test/fakes/sequential-ids';

import { ensureSystemAccounts } from '../ledger/ensure-system-accounts';

import { exchangeAccountId, syncExchange, type SyncExchangeDeps } from './sync-exchange';

const owner = ownerId('david');
const AHORA = '2026-08-31T10:00:00.000-05:00';
const USDC = exchangeAccountId('USDC');

async function deps() {
  const accounts = createInMemoryAccountRepository();
  const transactions = createInMemoryTransactionRepository(accounts.postings);
  await ensureSystemAccounts(accounts, owner);
  const servidor = createFakeServerClient([]);
  const d: SyncExchangeDeps = {
    accounts,
    transactions,
    ids: createSequentialIds('uuid'),
    clock: () => AHORA,
    servidor,
  };
  return { ...d, accounts, transactions, servidor };
}

describe('syncExchange', () => {
  it('la primera lectura deja el saldo entero', async () => {
    const d = await deps();
    d.servidor.responderSaldos([{ activo: 'USDC', cantidad: '85761' }]);

    const resumen = await syncExchange(d, { owner });

    expect((await d.accounts.balanceOf(USDC)).amount).toBe(85_761n);
    expect(resumen).toEqual({ leidos: 1, ajustes: 1, error: null });
  });

  it('una lectura igual no asienta nada', async () => {
    const d = await deps();
    d.servidor.responderSaldos([{ activo: 'USDC', cantidad: '85761' }]);
    await syncExchange(d, { owner });

    const resumen = await syncExchange(d, { owner });

    expect(resumen.ajustes).toBe(0);
    expect(d.accounts.postings.filter((p) => p.accountId === USDC)).toHaveLength(1);
  });

  /**
   * Lo que separa «no tienes nada» de «no pude mirar». Poner cero porque el
   * servidor no respondió sería borrar plata de la pantalla.
   */
  it('si Binance falla, no toca el saldo y lo dice', async () => {
    const d = await deps();
    d.servidor.responderSaldos([{ activo: 'USDC', cantidad: '85761' }]);
    await syncExchange(d, { owner });

    d.servidor.fallarSaldos();
    const resumen = await syncExchange(d, { owner });

    expect((await d.accounts.balanceOf(USDC)).amount).toBe(85_761n);
    expect(resumen.error).not.toBeNull();
    expect(resumen.ajustes).toBe(0);
  });

  it('sin servidor configurado tampoco revienta: lo cuenta', async () => {
    const d = await deps();
    d.servidor.fallarSaldos();

    await expect(syncExchange(d, { owner })).resolves.toMatchObject({ leidos: 0, ajustes: 0 });
  });

  it('guarda cuándo se leyó, en la fecha del asiento', async () => {
    const d = await deps();
    d.servidor.responderSaldos([{ activo: 'USDC', cantidad: '10' }]);

    await syncExchange(d, { owner });

    expect(d.transactions.all().at(-1)?.fecha).toBe(AHORA);
  });

  it('la cuenta se crea con su moneda y dice que está en Binance', async () => {
    const d = await deps();
    d.servidor.responderSaldos([{ activo: 'USDC', cantidad: '10' }]);

    await syncExchange(d, { owner });

    const cuenta = await d.accounts.findById(USDC);
    expect(cuenta?.currency).toBe('USDC');
    expect(cuenta?.nombre).toBe('USDC en Binance');
  });

  it('lee varios activos a la vez', async () => {
    const d = await deps();
    d.servidor.responderSaldos([
      { activo: 'USDC', cantidad: '85761' },
      { activo: 'USDT', cantidad: '1000000' },
    ]);

    const resumen = await syncExchange(d, { owner });

    expect(resumen.leidos).toBe(2);
    expect((await d.accounts.balanceOf(exchangeAccountId('USDT'))).amount).toBe(1_000_000n);
  });

  /**
   * Un activo cuya escala el ledger no conoce se salta. Inventarle una
   * multiplicaría o dividiría el saldo sin que nada lo dijera.
   */
  it('un activo que el ledger no sabe representar se salta', async () => {
    const d = await deps();
    d.servidor.responderSaldos([{ activo: 'DOGE', cantidad: '123' }]);

    const resumen = await syncExchange(d, { owner });

    expect(resumen.leidos).toBe(0);
    expect(await d.accounts.findById(exchangeAccountId('DOGE'))).toBeNull();
  });

  /**
   * La cantidad viaja como texto justamente para esto: un entero de escala
   * cripto no cabe en un `number` de JSON sin perder dígitos.
   */
  it('una cantidad enorme no pierde un solo dígito', async () => {
    const d = await deps();
    const enorme = '123456789012345678901234';
    d.servidor.responderSaldos([{ activo: 'USDC', cantidad: enorme }]);

    await syncExchange(d, { owner });

    expect((await d.accounts.balanceOf(USDC)).amount).toBe(BigInt(enorme));
  });

  it('un cero que nunca tuvo nada no crea cuenta', async () => {
    const d = await deps();
    d.servidor.responderSaldos([{ activo: 'USDT', cantidad: '0' }]);

    await syncExchange(d, { owner });

    expect(await d.accounts.findById(exchangeAccountId('USDT'))).toBeNull();
  });
});
