import { useEffect } from 'react';

import { refreshCheckpoints } from '@/application/ledger/refresh-checkpoints';

import { useDatabase } from '../db/database-provider';
import { createRepositories } from '../db/repositories';
import { observability } from '../observability';

/**
 * Pone al día los cortes de saldo al arrancar (ADR 0006).
 *
 * Va aquí y no en `useDatabaseBoot` porque **no puede retrasar la primera
 * pantalla**: es una optimización, y hacer esperar a quien abre la app para ir
 * más rápido después es exactamente lo contrario de lo que se buscaba.
 *
 * **Si falla, la app funciona igual.** Sin cortes, el saldo se calcula desde
 * cero: más lento y con la misma cifra. Por eso el error se registra y no se
 * enseña.
 */
export function useCheckpointRefresh(): void {
  const db = useDatabase();

  useEffect(() => {
    let vigente = true;
    const repos = createRepositories(db);

    refreshCheckpoints({ cortes: repos.cortes, clock: () => new Date().toISOString() })
      .then((escritos) => {
        if (vigente && escritos > 0) {
          observability.log('info', 'cortes de saldo al día', { escritos });
        }
      })
      .catch((error: unknown) => {
        observability.captureError(error instanceof Error ? error : new Error(String(error)), {
          operacion: 'cortes-de-saldo',
        });
      });

    return () => {
      vigente = false;
    };
  }, [db]);
}
