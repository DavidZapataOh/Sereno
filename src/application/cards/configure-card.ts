import { createCreditCard, type CreditCard } from '@/domain/cards/card';
import type { CardRepository } from '@/domain/cards/card-repository';
import type { Account } from '@/domain/ledger/account';
import type { AccountRepository } from '@/domain/ledger/account-repository';
import type { AccountId, OwnerId } from '@/domain/ledger/ids';
import type { Money } from '@/domain/money/money';

export interface ConfigureCardDeps {
  accounts: AccountRepository;
  cards: CardRepository;
}

export interface CardConfig {
  cuenta: Account;
  tarjeta: CreditCard | null;
  /** Lo que se debe ahora mismo, según el ledger. Positivo cuando se debe. */
  deuda: Money;
}

/**
 * Las cuentas que pueden configurarse como tarjeta, con lo que ya tengan.
 *
 * Son los pasivos: una tarjeta de crédito es una deuda. Las que aún no están
 * configuradas salen con `tarjeta: null`, que es lo que la pantalla necesita
 * para pedir los datos en vez de mostrar ceros.
 */
export async function listCardConfigs(
  deps: ConfigureCardDeps,
  owner: OwnerId,
): Promise<CardConfig[]> {
  const cuentas = await deps.accounts.listByOwner(owner);
  const pasivos = cuentas.filter((c) => c.kind === 'pasivo');
  return Promise.all(
    pasivos.map(async (cuenta) => {
      // Un pasivo aumenta con crédito: deber 100 es un saldo de -100. Lo que
      // se enseña es «debes 100».
      const saldo = await deps.accounts.balanceOf(cuenta.id);
      return {
        cuenta,
        tarjeta: await deps.cards.find(cuenta.id),
        deuda: { amount: -saldo.amount, currency: saldo.currency },
      };
    }),
  );
}

/**
 * Guarda el cupo, el corte y el pago de una tarjeta.
 *
 * Es el único trabajo manual del sprint, y es de una vez: son datos fijos que
 * ningún correo trae. Las validaciones viven en el dominio, no aquí.
 */
export async function configureCard(
  deps: ConfigureCardDeps,
  input: {
    owner: OwnerId;
    accountId: AccountId;
    cupo: Money;
    diaDeCorte: number;
    diaDePago: number;
  },
): Promise<CreditCard> {
  const cuenta = await deps.accounts.findById(input.accountId);
  if (cuenta === null || cuenta.owner !== input.owner) {
    throw new Error(`No existe la cuenta "${input.accountId}"`);
  }
  if (cuenta.kind !== 'pasivo') {
    throw new Error(`La cuenta "${cuenta.nombre}" no es una tarjeta ni una deuda`);
  }
  if (cuenta.currency !== input.cupo.currency) {
    throw new Error(
      `La cuenta es en ${cuenta.currency} y el cupo en ${input.cupo.currency}: moneda distinta`,
    );
  }

  const tarjeta = createCreditCard({
    accountId: input.accountId,
    owner: input.owner,
    cupo: input.cupo,
    diaDeCorte: input.diaDeCorte,
    diaDePago: input.diaDePago,
  });
  await deps.cards.save(tarjeta);
  return tarjeta;
}
