import { View } from 'react-native';

import type { EstadoIngesta } from '@/domain/sync/health';
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
  /** Qué tal va la ingesta en el servidor, si se pudo preguntar. */
  ingesta?: EstadoIngesta;
}

/**
 * El estado de la ingesta, en palabras.
 *
 * Sin signos de admiración y sin colores de alarma: consultar el dinero
 * cuando uno sabe que va mal ya produce bastante ansiedad (principio 3).
 */
export const TEXTO_INGESTA: Record<EstadoIngesta, string> = {
  nunca: 'El servidor todavía no ha leído el correo',
  'al-dia': 'La ingesta está al día',
  atrasada: 'La ingesta lleva un rato sin correr',
  detenida: 'La ingesta lleva horas sin correr',
  'con-error': 'La última lectura del correo falló',
};

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
      {estado.ingesta !== undefined && (
        <AppText level="apoyo" color="textSecondary">
          {TEXTO_INGESTA[estado.ingesta]}
        </AppText>
      )}
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
