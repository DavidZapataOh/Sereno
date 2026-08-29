import type { Account } from '@/domain/ledger/account';
import { accountId, transactionId, type OwnerId } from '@/domain/ledger/ids';
import { checkAllInvariants, type LedgerViolation } from '@/domain/ledger/invariants';
import type { Posting, Transaction } from '@/domain/ledger/transaction';

import type { Database } from './database';
import { toAccount, toMoney } from './mappers';
import { accounts, postings, transactions } from './schema';

export interface LedgerReport {
  sano: boolean;
  violaciones: LedgerViolation[];
  revisado: {
    cuentas: number;
    transacciones: number;
    apuntes: number;
  };
}

/**
 * Verifica las invariantes sobre la base real.
 *
 * Lee filas crudas y NO usa los repositorios, aunque sería más corto: el
 * repositorio valida al leer y lanzaría en la primera fila corrupta, que es
 * justo lo que este verificador existe para encontrar y contar. Un diagnóstico
 * que se cae con el primer problema no sirve para diagnosticar nada.
 *
 * Por eso también se atrapa cada conversión: un monto ilegible se reporta como
 * violación y la revisión continúa.
 */
export function checkLedger(db: Database): LedgerReport {
  const violaciones: LedgerViolation[] = [];

  const filasCuentas = db.select().from(accounts).all();
  const filasTransacciones = db.select().from(transactions).all();
  const filasApuntes = db.select().from(postings).all();

  const cuentas: Account[] = [];
  filasCuentas.forEach((fila) => {
    try {
      cuentas.push(toAccount(fila));
    } catch (error) {
      violaciones.push({
        invariante: 'cuenta-legible',
        detalle: `La cuenta "${fila.id}" no se puede leer — ${mensajeDe(error)}`,
      });
    }
  });

  const idsTransacciones = new Set(filasTransacciones.map((fila) => fila.id));
  const apuntesPorTransaccion = new Map<string, Posting[]>();

  filasApuntes.forEach((fila) => {
    if (!idsTransacciones.has(fila.transactionId)) {
      // Solo puede pasar con las claves foráneas apagadas, que es exactamente el
      // estado por defecto de SQLite en el dispositivo.
      violaciones.push({
        invariante: 'apunte-sin-transaccion',
        detalle: `El apunte "${fila.id}" apunta a la transacción "${fila.transactionId}", que no existe`,
      });
      return;
    }

    let apunte: Posting;
    try {
      apunte = {
        accountId: accountId(fila.accountId),
        amount: toMoney(fila.amount, fila.currency),
        ...(fila.nota === null ? {} : { nota: fila.nota }),
      };
    } catch (error) {
      violaciones.push({
        invariante: 'apunte-legible',
        detalle: `El apunte "${fila.id}" no se puede leer — ${mensajeDe(error)}`,
      });
      return;
    }

    const existentes = apuntesPorTransaccion.get(fila.transactionId);
    if (existentes === undefined) apuntesPorTransaccion.set(fila.transactionId, [apunte]);
    else existentes.push(apunte);
  });

  const transaccionesLeidas: Transaction[] = filasTransacciones.map((fila) => ({
    id: transactionId(fila.id),
    owner: fila.ownerId as OwnerId,
    fecha: fila.fecha,
    descripcion: fila.descripcion,
    origen: { fuente: fila.fuente, referencia: fila.referencia },
    postings: apuntesPorTransaccion.get(fila.id) ?? [],
  }));

  violaciones.push(...checkAllInvariants({ transactions: transaccionesLeidas, accounts: cuentas }));

  return {
    sano: violaciones.length === 0,
    violaciones,
    revisado: {
      cuentas: filasCuentas.length,
      transacciones: filasTransacciones.length,
      apuntes: filasApuntes.length,
    },
  };
}

function mensajeDe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
