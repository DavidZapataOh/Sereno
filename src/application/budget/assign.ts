import type { BudgetRepository } from '@/domain/budget/budget-repository';
import { createEnvelope, type Envelope } from '@/domain/budget/envelope';
import type { OwnerId } from '@/domain/ledger/ids';
import { subtract, type Money } from '@/domain/money/money';

export interface AssignDeps {
  presupuesto: BudgetRepository;
}

/** Asignar un monto a una categoría para un mes. Reemplaza lo que hubiera. */
export function assign(
  deps: AssignDeps,
  input: { owner: OwnerId; mes: string; categoria: string; monto: Money },
): Promise<void> {
  return deps.presupuesto.guardar(
    createEnvelope({
      owner: input.owner,
      mes: input.mes,
      categoria: input.categoria,
      asignado: input.monto,
    }),
  );
}

/**
 * Cubrir un sobregiro moviendo asignación de otro sobre.
 *
 * **No asienta ninguna transacción**: no se ha gastado nada nuevo, solo cambia
 * de dónde se decía que iba a salir. Meterlo al ledger inventaría un movimiento
 * que no ocurrió.
 */
export async function coverOverspend(
  deps: AssignDeps,
  input: { owner: OwnerId; mes: string; desde: string; hacia: string; monto: Money },
): Promise<void> {
  if (input.desde === input.hacia) throw new Error('No se puede cubrir un sobre consigo mismo');
  if (input.monto.amount <= 0n) throw new Error('Lo que se mueve tiene que ser positivo');

  const sobres = await deps.presupuesto.listar(input.owner, input.mes);
  const origen = sobres.find((s) => s.categoria === input.desde);
  const destino = sobres.find((s) => s.categoria === input.hacia);
  if (origen === undefined) throw new Error(`No hay sobre de "${input.desde}" en ${input.mes}`);

  const restante = subtract(origen.asignado, input.monto);
  if (restante.amount < 0n) {
    // Dejar el origen en negativo movería el problema, no lo resolvería.
    throw new Error(`"${input.desde}" no tiene tanto asignado`);
  }

  await deps.presupuesto.guardar({ ...origen, asignado: restante });
  const nuevoDestino: Envelope = destino ?? {
    owner: input.owner,
    mes: input.mes,
    categoria: input.hacia,
    asignado: { amount: 0n, currency: input.monto.currency },
  };
  await deps.presupuesto.guardar({
    ...nuevoDestino,
    asignado: {
      amount: nuevoDestino.asignado.amount + input.monto.amount,
      currency: input.monto.currency,
    },
  });
}
