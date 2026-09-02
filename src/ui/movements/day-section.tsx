import { View } from 'react-native';

import { formatCOP } from '@/domain/money/format';
import { AppText } from '@/ui/components/app-text';
import { useTheme } from '@/ui/theme/use-theme';

interface Props {
  /** El día, ya escrito para leerse: «Hoy», «Ayer», «lun 25 ago». */
  titulo: string;
  /** Lo que se fue ese día, en pesos. */
  total: bigint;
}

/**
 * La cabecera de un día.
 *
 * **Un día es la unidad con la que se piensa el gasto.** Una lista plana de
 * doscientos movimientos no se lee; la misma lista partida por días se recorre
 * de un vistazo, y de paso responde una pregunta que antes no respondía:
 * cuánto se fue ese día.
 */
export function DaySection({ titulo, total }: Props) {
  const theme = useTheme();

  return (
    <View
      style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: theme.spacing.lg,
        paddingTop: theme.spacing.lg,
        paddingBottom: theme.spacing.sm,
        backgroundColor: theme.palette.background,
      }}
    >
      <AppText level="micro" color="textSecondary">
        {titulo.toUpperCase()}
      </AppText>
      {total > 0n && (
        <AppText level="micro" color="textMuted">
          {`−${formatCOP(total)}`}
        </AppText>
      )}
    </View>
  );
}
