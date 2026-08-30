import { View } from 'react-native';

import { formatRelative } from '@/domain/time/format';
import { AppText } from '@/ui/components/app-text';
import { Button } from '@/ui/components/button';
import { Card } from '@/ui/components/card';
import { useTheme } from '@/ui/theme/use-theme';

export interface EstadoServidor {
  /** Cuándo se trajo del servidor por última vez, o `null` si nunca. */
  ultima: string | null;
  now: string;
  pendiente: boolean;
  error: boolean;
}

interface Props {
  estado: EstadoServidor;
  onTraer: () => void;
}

/**
 * Qué sabe el teléfono del servidor.
 *
 * Dice tres cosas y ninguna alarma: cuándo fue la última vez, si la última
 * falló, y un botón para forzarla. Sin conexión no pasa nada: la app sigue
 * con lo que ya tiene en SQLite.
 */
export function ServerSyncCard({ estado, onTraer }: Props) {
  const theme = useTheme();
  const cuando =
    estado.ultima === null
      ? 'Todavía no se ha traído nada del servidor'
      : `Última vez: ${formatRelative(estado.ultima, estado.now)}`;

  return (
    <Card style={{ gap: theme.spacing.sm }}>
      <AppText>{cuando}</AppText>
      {estado.error && (
        <AppText level="apoyo" color="textSecondary">
          No se pudo conectar la última vez. Lo que ya está sigue aquí.
        </AppText>
      )}
      <View>
        <Button
          label="Traer ahora"
          onPress={onTraer}
          variant="secundario"
          loading={estado.pendiente}
        />
      </View>
    </Card>
  );
}
