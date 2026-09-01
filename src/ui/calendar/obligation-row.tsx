import { View } from 'react-native';

import type { EstadoObligacion, Obligation } from '@/domain/calendar/obligation';
import { formatShortDate } from '@/domain/time/format';
import { AppText } from '@/ui/components/app-text';
import { Money } from '@/ui/components/money';
import { useTheme } from '@/ui/theme/use-theme';

export const TEXTO_CALENDARIO = {
  /**
   * El estado va **en palabras**. Decirlo solo con color deja fuera a quien no
   * lo distingue, y en una pantalla de vencimientos eso es dinero.
   */
  estado: {
    pendiente: 'Por pagar',
    pagada: 'Pagado',
    vencida: 'Se pasó la fecha',
  } satisfies Record<EstadoObligacion, string>,
  origen: {
    tarjeta: 'Tarjeta',
    suscripcion: 'Suscripción',
    cuota: 'Cuota',
  },
  montoDesconocido: 'El monto se sabe cuando cierre el ciclo',
};

interface Props {
  obligacion: Obligation;
}

/**
 * Una obligación: qué es, cuánto, cuándo y si ya se pagó.
 *
 * Sin colores de alarma ni de premio. Mirar lo que se debe cuando uno sabe que
 * va mal ya produce bastante ansiedad (principio 3), y celebrar un pago con
 * verde convierte la pantalla en un juego.
 */
export function ObligationRow({ obligacion }: Props) {
  const theme = useTheme();

  return (
    <View style={{ paddingVertical: theme.spacing.sm, gap: theme.spacing.xs }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
        <View style={{ flex: 1 }}>
          <AppText level="cuerpo">{obligacion.nombre}</AppText>
          <AppText level="apoyo" color="textSecondary">
            {`${TEXTO_CALENDARIO.origen[obligacion.origen]} · ${formatShortDate(
              `${obligacion.vence}T12:00:00.000-05:00`,
            )}`}
          </AppText>
        </View>
        {obligacion.monto !== null && (
          <Money
            amount={obligacion.monto.amount}
            currency={obligacion.monto.currency}
            direction="neutro"
            size="montoPequeno"
          />
        )}
      </View>

      <AppText level="apoyo" color="textSecondary">
        {obligacion.monto === null
          ? `${TEXTO_CALENDARIO.estado[obligacion.estado]} · ${TEXTO_CALENDARIO.montoDesconocido}`
          : TEXTO_CALENDARIO.estado[obligacion.estado]}
      </AppText>
    </View>
  );
}
