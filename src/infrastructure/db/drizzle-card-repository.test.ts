import { createCreditCard } from '@/domain/cards/card';
import { createAccount } from '@/domain/ledger/account';
import { accountId, ownerId } from '@/domain/ledger/ids';
import { money } from '@/domain/money/money';

import { createDrizzleAccountRepository } from './drizzle-account-repository';
import { createDrizzleCardRepository } from './drizzle-card-repository';
import { createTestDb } from './test-client';

const owner = ownerId('david');
const rappi = accountId('rappicard:tarjeta');
const nu = accountId('nu:tarjeta');

describe('CardRepository sobre Drizzle', () => {
  let cliente: ReturnType<typeof createTestDb>;
  let repo: ReturnType<typeof createDrizzleCardRepository>;

  beforeEach(async () => {
    cliente = createTestDb();
    repo = createDrizzleCardRepository(cliente.db);
    const cuentas = createDrizzleAccountRepository(cliente.db);
    for (const [id, nombre] of [
      [rappi, 'RappiCard'],
      [nu, 'Nu'],
    ] as const) {
      await cuentas.save(createAccount({ id, owner, kind: 'pasivo', nombre, currency: 'COP' }));
    }
  });

  afterEach(() => {
    cliente.close();
  });

  it('guarda una tarjeta y la encuentra', async () => {
    const tarjeta = createCreditCard({
      accountId: rappi,
      owner,
      cupo: money(3_000_000, 'COP'),
      diaDeCorte: 15,
      diaDePago: 5,
    });

    await repo.save(tarjeta);

    expect(await repo.find(rappi)).toEqual(tarjeta);
  });

  it('guardar de nuevo actualiza en vez de duplicar', async () => {
    const tarjeta = createCreditCard({
      accountId: rappi,
      owner,
      cupo: money(3_000_000, 'COP'),
      diaDeCorte: 15,
      diaDePago: 5,
    });
    await repo.save(tarjeta);
    await repo.save({ ...tarjeta, cupo: money(5_000_000, 'COP') });

    expect((await repo.find(rappi))?.cupo.amount).toBe(5_000_000n);
    expect(await repo.listByOwner(owner)).toHaveLength(1);
  });

  /**
   * El cupo va y vuelve como texto, nunca como `number`. Este valor es
   * `Number.MAX_SAFE_INTEGER + 2`: absurdo para un cupo, y exactamente el
   * punto —si alguien lo guarda como número, la prueba lo caza aquí y no
   * dentro de dos años con un saldo en satoshis—.
   */
  it('el cupo vuelve entero, sin pasar por float', async () => {
    await repo.save(
      createCreditCard({
        accountId: rappi,
        owner,
        cupo: money(9_007_199_254_740_993n, 'COP'),
        diaDeCorte: 15,
        diaDePago: 5,
      }),
    );

    expect((await repo.find(rappi))?.cupo.amount).toBe(9_007_199_254_740_993n);
  });

  it('una cuenta sin configurar no es una tarjeta', async () => {
    expect(await repo.find(nu)).toBeNull();
  });

  it('lista las del propietario', async () => {
    for (const id of [rappi, nu]) {
      await repo.save(
        createCreditCard({
          accountId: id,
          owner,
          cupo: money(1_000_000, 'COP'),
          diaDeCorte: 10,
          diaDePago: 1,
        }),
      );
    }

    expect(await repo.listByOwner(owner)).toHaveLength(2);
    expect(await repo.listByOwner(ownerId('otro'))).toHaveLength(0);
  });
});
