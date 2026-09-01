import { View } from 'react-native';

import type { Anomaly } from '@/domain/anomalies/anomaly';
import { AppText } from '@/ui/components/app-text';
import { Button } from '@/ui/components/button';
import { Card } from '@/ui/components/card';
import { useTheme } from '@/ui/theme/use-theme';

export const TEXTO_ANOMALIA = {
  titulo: {
    'monto-inusual': 'Un cobro más alto de lo normal',
    'precio-subio': 'Una suscripción subió de precio',
    'cobro-repetido': 'Te cobraron dos veces el mismo día',
    'comercio-dormido': 'Un comercio que no aparecía hace tiempo',
  } as Record<string, string>,
  comparadoCon: 'Comparado con',
  descartar: 'Está bien, no avises más',
  /** No acusa a nadie: puede ser perfectamente normal, y decirlo evita el susto. */
  aclaracion: 'Puede ser normal. Sereno solo avisa de lo que se sale de tu patrón.',
};

interface Props {
  anomalia: Anomaly;
  onDescartar: () => void;
}

/**
 * Una anomalía: qué pasó, contra qué se comparó, y un botón para callarla.
 *
 * **La explicación y el «comparado con» van los dos**, porque una alerta que no
 * dice contra qué se midió no se puede juzgar, y la que no se puede juzgar se
 * ignora —y con ella todas las demás—.
 */
export function AnomalyCard({ anomalia, onDescartar }: Props) {
  const theme = useTheme();

  return (
    <Card style={{ gap: theme.spacing.sm }}>
      <AppText level="cuerpo">{TEXTO_ANOMALIA.titulo[anomalia.tipo] ?? anomalia.tipo}</AppText>

      <AppText level="apoyo" color="textSecondary">
        {anomalia.explicacion}
      </AppText>

      <View style={{ gap: theme.spacing.xs }}>
        <AppText level="micro" color="textMuted">
          {`${TEXTO_ANOMALIA.comparadoCon}: ${anomalia.comparadoCon}`}
        </AppText>
        <AppText level="micro" color="textMuted">
          {TEXTO_ANOMALIA.aclaracion}
        </AppText>
      </View>

      <Button label={TEXTO_ANOMALIA.descartar} variant="secundario" onPress={onDescartar} />
    </Card>
  );
}
