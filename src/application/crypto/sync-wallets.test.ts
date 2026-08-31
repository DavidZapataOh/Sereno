import type { BalanceSource, SaldoLeido } from '@/domain/crypto/balance-source';
import { tokensDe, type Chain, type Wallet } from '@/domain/crypto/wallet';
import { ownerId } from '@/domain/ledger/ids';
import { money } from '@/domain/money/money';
import { createInMemoryAccountRepository } from '@/test/fakes/in-memory-account-repository';
import { createInMemoryTransactionRepository } from '@/test/fakes/in-memory-transaction-repository';
import { createSequentialIds } from '@/test/fakes/sequential-ids';

import { ensureSystemAccounts } from '../ledger/ensure-system-accounts';

import { syncWallets, walletAccountId, type SyncWalletsDeps } from './sync-wallets';

const owner = ownerId('david');
const AHORA = '2026-08-31T10:00:00.000-05:00';

const polygon: Wallet = {
  id: 'w-polygon',
  owner,
  chain: 'polygon',
  direccion: '0x5a4e9Bb1f224e8254C1d63e90dE34E8572f8dC71',
  nombre: 'Polygon',
};
const solana: Wallet = {
  id: 'w-solana',
  owner,
  chain: 'solana',
  direccion: '2VWvtXH5du9amnpU9NHP3dnry2ggSj6qcHwzwUn8DB5J',
  nombre: 'Solana',
};

/** Una fuente que devuelve lo que se le diga, y puede fallar a voluntad. */
function fuenteDoble(chain: Chain) {
  let cantidades = new Map<string, bigint>();
  let falla = false;
  const fuente: BalanceSource = {
    chain,
    leerSaldos: () => {
      if (falla) return Promise.reject(new Error(`el nodo de ${chain} no responde`));
      return Promise.resolve(
        tokensDe(chain).map((token): SaldoLeido => ({
          token,
          cantidad: money(cantidades.get(token.simbolo) ?? 0n, token.currency),
          leidoEn: AHORA,
        })),
      );
    },
  };
  return {
    fuente,
    responder: (nuevas: Record<string, bigint>) => {
      cantidades = new Map(Object.entries(nuevas));
    },
    fallar: (v = true) => {
      falla = v;
    },
  };
}

async function deps() {
  const accounts = createInMemoryAccountRepository();
  const transactions = createInMemoryTransactionRepository(accounts.postings);
  await ensureSystemAccounts(accounts, owner);
  const dobles = { polygon: fuenteDoble('polygon'), solana: fuenteDoble('solana') };
  const d: SyncWalletsDeps = {
    accounts,
    transactions,
    ids: createSequentialIds('uuid'),
    clock: () => AHORA,
    fuentes: [dobles.polygon.fuente, dobles.solana.fuente],
  };
  return { ...d, accounts, transactions, dobles };
}

const saldoDe = async (d: Awaited<ReturnType<typeof deps>>, wallet: Wallet, simbolo: string) =>
  (await d.accounts.balanceOf(walletAccountId(wallet, simbolo))).amount;

describe('syncWallets', () => {
  /**
   * La diferencia con las cuentas de banco y con las tarjetas del sprint 07:
   * la cadena devuelve el saldo **completo** cada vez, así que la primera
   * lectura ya trae todo. No hay punto de partida que declarar.
   */
  it('la primera lectura deja el saldo entero, sin declarar nada', async () => {
    const d = await deps();
    d.dobles.polygon.responder({ 'USDC.e': 50_000n });

    await syncWallets(d, { owner, wallets: [polygon] });

    expect(await saldoDe(d, polygon, 'USDC.e')).toBe(50_000n);
  });

  it('una segunda lectura igual no asienta nada', async () => {
    const d = await deps();
    d.dobles.polygon.responder({ 'USDC.e': 50_000n });
    await syncWallets(d, { owner, wallets: [polygon] });

    const resumen = await syncWallets(d, { owner, wallets: [polygon] });

    expect(resumen.ajustes).toBe(0);
    expect(d.transactions.all()).toHaveLength(1);
  });

  it('si el saldo cambió, asienta la diferencia', async () => {
    const d = await deps();
    d.dobles.polygon.responder({ 'USDC.e': 50_000n });
    await syncWallets(d, { owner, wallets: [polygon] });

    d.dobles.polygon.responder({ 'USDC.e': 120_000n });
    await syncWallets(d, { owner, wallets: [polygon] });

    expect(await saldoDe(d, polygon, 'USDC.e')).toBe(120_000n);
  });

  it('un saldo que baja también se asienta', async () => {
    const d = await deps();
    d.dobles.polygon.responder({ 'USDC.e': 120_000n });
    await syncWallets(d, { owner, wallets: [polygon] });

    d.dobles.polygon.responder({ 'USDC.e': 50_000n });
    await syncWallets(d, { owner, wallets: [polygon] });

    expect(await saldoDe(d, polygon, 'USDC.e')).toBe(50_000n);
  });

  /**
   * Un nodo caído no puede borrar plata de la pantalla. Es la diferencia entre
   * «tienes cero» y «no pude mirar», y confundirlas es de las peores cosas que
   * puede hacer una app de dinero.
   */
  it('si una cadena falla, no toca su saldo y lo dice', async () => {
    const d = await deps();
    d.dobles.polygon.responder({ 'USDC.e': 50_000n });
    await syncWallets(d, { owner, wallets: [polygon] });

    d.dobles.polygon.fallar();
    const resumen = await syncWallets(d, { owner, wallets: [polygon] });

    expect(await saldoDe(d, polygon, 'USDC.e')).toBe(50_000n);
    expect(resumen.fallidas).toEqual(['polygon']);
    expect(resumen.leidas).toBe(0);
  });

  it('un fallo en una cadena no impide leer las demás', async () => {
    const d = await deps();
    d.dobles.polygon.fallar();
    d.dobles.solana.responder({ USDC: 85_761n });

    const resumen = await syncWallets(d, { owner, wallets: [polygon, solana] });

    expect(await saldoDe(d, solana, 'USDC')).toBe(85_761n);
    expect(resumen.fallidas).toEqual(['polygon']);
    expect(resumen.leidas).toBe(1);
  });

  it('lee las dos cadenas con los saldos reales', async () => {
    const d = await deps();
    // Los medidos el 2026-08-31.
    d.dobles.polygon.responder({ 'USDC.e': 50_000n });
    d.dobles.solana.responder({ USDC: 85_761n });

    await syncWallets(d, { owner, wallets: [polygon, solana] });

    expect(await saldoDe(d, polygon, 'USDC.e')).toBe(50_000n);
    expect(await saldoDe(d, solana, 'USDC')).toBe(85_761n);
  });

  it('la cuenta de cada token se crea con su moneda', async () => {
    const d = await deps();
    d.dobles.polygon.responder({ 'USDC.e': 50_000n });

    await syncWallets(d, { owner, wallets: [polygon] });

    const cuenta = d.accounts.all().find((c) => c.id === walletAccountId(polygon, 'USDC.e'));
    expect(cuenta?.currency).toBe('USDC');
    expect(cuenta?.kind).toBe('activo');
  });

  it('un token en cero crea su cuenta igual: «miré y no hay» es información', async () => {
    const d = await deps();
    d.dobles.polygon.responder({});

    await syncWallets(d, { owner, wallets: [polygon] });

    expect(d.accounts.all().filter((c) => c.id.startsWith('wallet:polygon'))).toHaveLength(3);
  });

  it('sin fuente para una cadena, esa wallet se salta sin romper', async () => {
    const d = await deps();
    d.fuentes = [];

    const resumen = await syncWallets(d, { owner, wallets: [polygon] });

    expect(resumen).toEqual({ leidas: 0, ajustes: 0, fallidas: [] });
  });

  it('el motivo del ajuste dice de dónde salió el saldo', async () => {
    const d = await deps();
    d.dobles.polygon.responder({ 'USDC.e': 50_000n });

    await syncWallets(d, { owner, wallets: [polygon] });

    expect(d.transactions.all()[0]?.descripcion).toContain('Polygon');
    expect(d.transactions.all()[0]?.descripcion).toContain('USDC.e');
  });
});
