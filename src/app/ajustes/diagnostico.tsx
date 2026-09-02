import { Stack } from 'expo-router';
import { ScrollView } from 'react-native';

import { arranque, totalDeArranque } from '@/infrastructure/boot/boot-marks';
import { useDatabase } from '@/infrastructure/db/database-provider';
import { checkLedger } from '@/infrastructure/db/ledger-check';
import { observability } from '@/infrastructure/observability';
import { BootReport } from '@/ui/diagnostics/boot-report';
import { LedgerHealth } from '@/ui/diagnostics/ledger-health';

/** Composición: la base y el verificador son infraestructura; la pantalla no los conoce. */
export default function DiagnosticoRoute() {
  const db = useDatabase();

  return (
    <>
      <Stack.Screen options={{ title: 'Diagnóstico' }} />
      {/* Lo que tardó este arranque, en este teléfono: la suite mide otra cosa. */}
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <BootReport marcas={arranque()} total={totalDeArranque()} />
      </ScrollView>
      <LedgerHealth
        verificar={() => Promise.resolve(checkLedger(db))}
        onError={(error) => {
          observability.captureError(error, { operacion: 'verificar-ledger' });
        }}
      />
    </>
  );
}
