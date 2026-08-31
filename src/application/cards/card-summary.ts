import { cupoDisponible, porcentajeUsado, type CreditCard } from '@/domain/cards/card';
import type { CardRepository } from '@/domain/cards/card-repository';
import type { AccountRepository } from '@/domain/ledger/account-repository';
import type { AccountId, OwnerId } from '@/domain/ledger/ids';
import type { Money } from '@/domain/money/money';
import { SOURCES, sourceOfAccount } from '@/domain/sources/registry';

export interface CardSummary {
  accountId: AccountId;
  nombre: string;
  cupo: Money;
  deuda: Money;
  disponible: Money;
  /** Proporción del cupo usada. Puede pasar de 1 con sobregiro. */
  usado: number;
  diaDeCorte: number;
  diaDePago: number;
  /** Si por los canales de esta fuente llegan todos sus movimientos. */
  completa: boolean;
}

export interface CardSummaryDeps {
  accounts: AccountRepository;
  cards: CardRepository;
}

/**
 * Lo que la pantalla de una tarjeta necesita, ya calculado.
 *
 * La deuda sale del ledger en cada llamada; no hay ningún saldo guardado que
 * pueda contradecir a los apuntes que lo produjeron.
 */
export async function cardSummary(
  deps: CardSummaryDeps,
  input: { owner: OwnerId; accountId: AccountId },
): Promise<CardSummary | null> {
  const tarjeta: CreditCard | null = await deps.cards.find(input.accountId);
  if (tarjeta === null || tarjeta.owner !== input.owner) return null;

  const cuenta = await deps.accounts.findById(input.accountId);
  if (cuenta === null || cuenta.owner !== input.owner) return null;

  // Un pasivo aumenta con crédito, así que su saldo es negativo cuando se
  // debe. La deuda es ese saldo con el signo cambiado: lo que se enseña es
  // «debes 1.200.000», no «tienes -1.200.000».
  const saldo = await deps.accounts.balanceOf(input.accountId);
  const deuda: Money = { amount: -saldo.amount, currency: saldo.currency };

  const fuente = sourceOfAccount(input.accountId);

  return {
    accountId: input.accountId,
    nombre: cuenta.nombre,
    cupo: tarjeta.cupo,
    deuda,
    disponible: cupoDisponible(tarjeta, deuda),
    usado: porcentajeUsado(tarjeta, deuda),
    diaDeCorte: tarjeta.diaDeCorte,
    diaDePago: tarjeta.diaDePago,
    // Sin fuente conocida —una tarjeta creada a mano— no se puede prometer
    // que esté completa.
    completa: fuente !== null && SOURCES[fuente].cobertura === 'completa',
  };
}
