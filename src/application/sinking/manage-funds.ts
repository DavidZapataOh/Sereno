import type { OwnerId } from '@/domain/ledger/ids';
import type { AccountRepository } from '@/domain/ledger/account-repository';
import { zero, type Money } from '@/domain/money/money';
import {
  alcanzaATiempo,
  aporteMensual,
  createSinkingFund,
  siguienteCiclo,
  type SinkingFund,
} from '@/domain/sinking/sinking-fund';
import type { SinkingRepository } from '@/domain/sinking/sinking-repository';

export interface FundDeps {
  accounts: AccountRepository;
  fondos: SinkingRepository;
  clock: () => string;
}

export interface FundState {
  fondo: SinkingFund;
  /** Del ledger, siempre. */
  apartado: Money;
  falta: Money;
  aporteDeEsteMes: Money;
  /** `false` cuando ni aportando lo que toca llega a tiempo. */
  alcanza: boolean;
}

export function createFund(
  deps: FundDeps,
  input: Omit<SinkingFund, 'owner'> & { owner: OwnerId },
): Promise<void> {
  return deps.fondos.guardar(createSinkingFund(input));
}

/**
 * Los fondos con lo que llevan apartado y lo que toca este mes.
 *
 * **Lo apartado sale del ledger** en cada llamada. Un fondo cuya fecha ya pasó
 * se reproyecta al siguiente ciclo: un seguro anual pagado en mayo vuelve a
 * apuntar a mayo, sin que nadie tenga que renovarlo.
 */
export async function listFunds(deps: FundDeps, owner: OwnerId): Promise<FundState[]> {
  const hoy = deps.clock().slice(0, 10);
  const fondos = await deps.fondos.listar(owner);

  return Promise.all(
    fondos.map(async (guardado) => {
      const apartado =
        (await deps.accounts.findById(guardado.accountId)) === null
          ? zero(guardado.objetivo.currency)
          : await deps.accounts.balanceOf(guardado.accountId);

      // Ya pasó el cobro y está cubierto: toca el siguiente ciclo.
      const fondo =
        guardado.proximaFecha < hoy && apartado.amount >= guardado.objetivo.amount
          ? siguienteCiclo(guardado)
          : guardado;

      const aporte = aporteMensual(fondo, apartado, hoy);
      return {
        fondo,
        apartado,
        falta: {
          amount:
            fondo.objetivo.amount - apartado.amount > 0n
              ? fondo.objetivo.amount - apartado.amount
              : 0n,
          currency: fondo.objetivo.currency,
        },
        aporteDeEsteMes: aporte,
        alcanza: alcanzaATiempo(fondo, apartado, aporte, hoy),
      };
    }),
  );
}
