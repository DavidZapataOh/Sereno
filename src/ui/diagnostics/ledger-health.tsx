import { useState } from 'react';
import { ScrollView, View } from 'react-native';

import type { LedgerReport } from '@/domain/ledger/invariants';
import { AppText } from '@/ui/components/app-text';
import { Button } from '@/ui/components/button';
import { Card } from '@/ui/components/card';
import { Money } from '@/ui/components/money';
import { ErrorState } from '@/ui/components/states';
import { useTheme } from '@/ui/theme/use-theme';

type Estado =
  | { fase: 'inicial' }
  | { fase: 'verificando' }
  | { fase: 'listo'; reporte: LedgerReport }
  | { fase: 'fallo' };

interface Props {
  /**
   * Corre las invariantes sobre la base real. Llega cableada desde la ruta:
   * la interfaz no sabe que existe una base.
   */
  verificar: () => Promise<LedgerReport>;
  onError?: (error: Error) => void;
}

/** Montos de anchos distintos: si las cifras son tabulares, alinean en columna. */
const MUESTRA = [1111111n, 8888888n, 1000000n, 9999999n];

/**
 * Salud del ledger y del propio teléfono.
 *
 * Dos comprobaciones que solo tienen sentido en un dispositivo real: que la
 * contabilidad cuadra sobre los datos de verdad, y que las cifras tabulares
 * funcionan con la fuente cargada, cosa que ninguna prueba puede ver.
 */
export function LedgerHealth({ verificar, onError }: Props) {
  const theme = useTheme();
  const [estado, setEstado] = useState<Estado>({ fase: 'inicial' });

  const ejecutar = (): void => {
    setEstado({ fase: 'verificando' });
    verificar()
      .then((reporte) => {
        setEstado({ fase: 'listo', reporte });
      })
      .catch((error: unknown) => {
        onError?.(error instanceof Error ? error : new Error(String(error)));
        setEstado({ fase: 'fallo' });
      });
  };

  return (
    <ScrollView
      contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.lg }}
      style={{ backgroundColor: theme.palette.background }}
    >
      <View style={{ gap: theme.spacing.xs }}>
        <AppText level="subtitulo">Salud del ledger</AppText>
        <AppText level="apoyo" color="textSecondary">
          Comprueba que la contabilidad cuadra: que todo apunte tenga cuenta y que la suma de todos
          los movimientos sea cero.
        </AppText>
      </View>

      <Button label="Verificar ahora" onPress={ejecutar} loading={estado.fase === 'verificando'} />

      {estado.fase === 'fallo' && (
        <ErrorState description="No se pudo revisar la contabilidad." onRetry={ejecutar} />
      )}

      {estado.fase === 'listo' && (
        <Card style={{ gap: theme.spacing.xs }}>
          <AppText color={estado.reporte.sano ? 'ingreso' : 'peligro'}>
            {estado.reporte.sano
              ? 'Todo cuadra'
              : `${String(estado.reporte.violaciones.length)} problemas encontrados`}
          </AppText>
          <AppText level="apoyo" color="textSecondary">
            {`Revisado: ${String(estado.reporte.revisado.cuentas)} cuentas, ${String(
              estado.reporte.revisado.transacciones,
            )} transacciones, ${String(estado.reporte.revisado.apuntes)} apuntes`}
          </AppText>
        </Card>
      )}

      {estado.fase === 'listo' &&
        estado.reporte.violaciones.map((violacion, indice) => (
          <Card key={`${violacion.invariante}-${String(indice)}`} style={{ gap: theme.spacing.xs }}>
            <AppText level="micro" color="textMuted">
              {violacion.invariante}
            </AppText>
            <AppText level="apoyo">{violacion.detalle}</AppText>
          </Card>
        ))}

      <View style={{ gap: theme.spacing.xs }}>
        <AppText level="subtitulo">Muestra tipográfica</AppText>
        <AppText level="apoyo" color="textSecondary">
          Los dígitos de estas cifras deben alinear en columna. Si no, las cifras tabulares no
          funcionan en este teléfono.
        </AppText>
      </View>
      <Card style={{ alignItems: 'flex-end', gap: theme.spacing.xs }}>
        {MUESTRA.map((monto) => (
          <Money key={monto.toString()} amount={monto} direction="neutro" />
        ))}
      </Card>
    </ScrollView>
  );
}
