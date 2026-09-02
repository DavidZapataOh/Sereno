import type { ReactNode } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { useTheme } from '@/ui/theme/use-theme';

import { AppText } from './app-text';
import { Button } from './button';
import { SkeletonRow } from './skeleton';

function Contenedor({ children }: { children: ReactNode }) {
  const theme = useTheme();
  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: theme.spacing.xl,
        gap: theme.spacing.sm,
      }}
    >
      {children}
    </View>
  );
}

interface LoadingProps {
  /**
   * Cuántas filas de esqueleto dibujar.
   *
   * **Un esqueleto con la forma de lo que viene** convierte la espera en
   * información: la pantalla ya se ve como lo que va a ser. Una rueda girando
   * solo dice «espera», que es lo que el usuario ya sabía.
   *
   * Sin filas, se cae a la rueda: hay sitios donde lo que carga no es una
   * lista y fingir una forma sería mentir sobre lo que viene.
   */
  filas?: number;
}

export function LoadingState({ filas }: LoadingProps = {}) {
  const theme = useTheme();

  if (filas !== undefined && filas > 0) {
    return (
      <View
        accessibilityRole="progressbar"
        accessibilityLabel="Cargando"
        style={{ padding: theme.spacing.lg }}
      >
        {Array.from({ length: filas }, (_, i) => (
          <SkeletonRow key={i} />
        ))}
      </View>
    );
  }

  return (
    <Contenedor>
      <ActivityIndicator
        color={theme.palette.accent}
        accessibilityLabel="Cargando"
        accessibilityRole="progressbar"
      />
    </Contenedor>
  );
}

interface EmptyProps {
  title: string;
  description: string;
  /** Qué puede hacer el usuario para que deje de estar vacío, si hay algo. */
  action?: { label: string; onPress: () => void };
}

/**
 * Estado vacío.
 *
 * Dice qué habrá aquí y, si el usuario puede hacer algo al respecto, qué. Una
 * pantalla en blanco no distingue «no hay datos» de «algo se rompió».
 */
export function EmptyState({ title, description, action }: EmptyProps) {
  const theme = useTheme();
  return (
    <Contenedor>
      <AppText level="subtitulo" align="center">
        {title}
      </AppText>
      <AppText level="apoyo" color="textSecondary" align="center">
        {description}
      </AppText>
      {action !== undefined && (
        <View style={{ marginTop: theme.spacing.md }}>
          <Button label={action.label} onPress={action.onPress} variant="secundario" />
        </View>
      )}
    </Contenedor>
  );
}

/**
 * Estado de error.
 *
 * Nunca muestra el detalle técnico: el mensaje de una excepción puede contener
 * el dato que la provocó —una descripción de transacción, una respuesta del
 * banco—. El detalle va a la capa de observabilidad del sprint 00.
 */
export function ErrorState({
  description,
  onRetry,
}: {
  description: string;
  onRetry?: () => void;
}) {
  const theme = useTheme();
  return (
    <Contenedor>
      <AppText level="subtitulo" align="center">
        Algo no salió bien
      </AppText>
      <AppText level="apoyo" color="textSecondary" align="center">
        {description}
      </AppText>
      {onRetry !== undefined && (
        <View style={{ marginTop: theme.spacing.md }}>
          <Button label="Reintentar" onPress={onRetry} variant="secundario" />
        </View>
      )}
    </Contenedor>
  );
}
