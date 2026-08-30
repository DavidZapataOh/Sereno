import { Stack } from 'expo-router';

import { useDatabase } from '@/infrastructure/db/database-provider';
import { checkLedger } from '@/infrastructure/db/ledger-check';
import { observability } from '@/infrastructure/observability';
import { LedgerHealth } from '@/ui/diagnostics/ledger-health';

/** Composición: la base y el verificador son infraestructura; la pantalla no los conoce. */
export default function DiagnosticoRoute() {
  const db = useDatabase();

  return (
    <>
      <Stack.Screen options={{ title: 'Diagnóstico' }} />
      <LedgerHealth
        verificar={() => Promise.resolve(checkLedger(db))}
        onError={(error) => {
          observability.captureError(error, { operacion: 'verificar-ledger' });
        }}
      />
    </>
  );
}
