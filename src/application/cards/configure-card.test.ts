import { createAccount } from '@/domain/ledger/account';
import { accountId, ownerId } from '@/domain/ledger/ids';
import { money } from '@/domain/money/money';
import { createInMemoryAccountRepository } from '@/test/fakes/in-memory-account-repository';
import { createInMemoryCardRepository } from '@/test/fakes/in-memory-card-repository';

import { configureCard, listCardConfigs } from './configure-card';

const owner = ownerId('david');
const rappi = accountId('rappicard:tarjeta');
const nu = accountId('nu:tarjeta');
const ahorros = accountId('bancolombia:ahorros');

async function deps() {
  const accounts = createInMemoryAccountRepository();
  const cards = createInMemoryCardRepository();
  await accounts.save(
    createAccount({ id: ahorros, owner, kind: 'activo', nombre: 'Bancolombia', currency: 'COP' }),
  );
  for (const [id, nombre] of [
    [rappi, 'RappiCard'],
    [nu, 'Nu'],
  ] as const) {
    await accounts.save(createAccount({ id, owner, kind: 'pasivo', nombre, currency: 'COP' }));
  }
  return { accounts, cards };
}

const base = {
  owner,
  accountId: rappi,
  cupo: money(3_000_000, 'COP'),
  diaDeCorte: 15,
  diaDePago: 5,
};

describe('listCardConfigs', () => {
  it('lista los pasivos, no las cuentas de ahorros', async () => {
    const d = await deps();

    const configs = await listCardConfigs(d, owner);

    expect(configs.map((c) => c.cuenta.nombre).sort()).toEqual(['Nu', 'RappiCard']);
  });

  /**
   * Una tarjeta sin configurar sale con `tarjeta: null` y no con ceros: la
   * pantalla tiene que poder pedir los datos, y un cupo de cero se ve igual
   * que un cupo agotado.
   */
  it('las que no están configuradas salen vacías, no en cero', async () => {
    const d = await deps();

    expect((await listCardConfigs(d, owner)).every((c) => c.tarjeta === null)).toBe(true);
  });

  it('las configuradas traen sus datos', async () => {
    const d = await deps();
    await configureCard(d, base);

    const config = (await listCardConfigs(d, owner)).find((c) => c.cuenta.id === rappi);
    expect(config?.tarjeta?.cupo.amount).toBe(3_000_000n);
  });
});

describe('configureCard', () => {
  it('guarda cupo, corte y pago', async () => {
    const d = await deps();

    const tarjeta = await configureCard(d, base);

    expect(tarjeta).toMatchObject({ diaDeCorte: 15, diaDePago: 5 });
    expect((await d.cards.find(rappi))?.cupo.amount).toBe(3_000_000n);
  });

  it('volver a configurar reemplaza, no duplica', async () => {
    const d = await deps();
    await configureCard(d, base);
    await configureCard(d, { ...base, cupo: money(5_000_000, 'COP') });

    expect((await d.cards.find(rappi))?.cupo.amount).toBe(5_000_000n);
    expect(await d.cards.listByOwner(owner)).toHaveLength(1);
  });

  it('no configura como tarjeta una cuenta de ahorros', async () => {
    const d = await deps();

    await expect(configureCard(d, { ...base, accountId: ahorros })).rejects.toThrow(
      /no es una tarjeta/i,
    );
  });

  it('rechaza un día que no existe en todos los meses', async () => {
    const d = await deps();

    await expect(configureCard(d, { ...base, diaDeCorte: 31 })).rejects.toThrow(/1 y 28/);
  });

  it('rechaza un cupo en otra moneda que la cuenta', async () => {
    const d = await deps();

    await expect(configureCard(d, { ...base, cupo: money(1000, 'USD') })).rejects.toThrow(
      /moneda/i,
    );
  });

  it('rechaza una cuenta de otro propietario', async () => {
    const d = await deps();

    await expect(configureCard(d, { ...base, owner: ownerId('otro') })).rejects.toThrow(
      /No existe/,
    );
  });
});
