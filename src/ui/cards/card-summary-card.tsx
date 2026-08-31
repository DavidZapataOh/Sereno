import { View } from 'react-native';

import type { CardSummary } from '@/application/cards/card-summary';
import { AppText } from '@/ui/components/app-text';
import { Card } from '@/ui/components/card';
import { Money } from '@/ui/components/money';
import { useTheme } from '@/ui/theme/use-theme';

export const TEXTO_TARJETA = {
  disponible: 'Disponible para gastar',
  deuda: 'Debes',
  sobregiro: 'Pasaste el cupo',
  incompleta:
    'Esta tarjeta solo avisa cuando pagas la cuota, no cada compra: lo que ves aquí puede ser menos de lo que debes.',
  corte: (dia: number) => `Corta el ${String(dia)} de cada mes`,
  pago: (dia: number) => `Se paga el ${String(dia)}`,
};

interface Props {
  resumen: CardSummary;
}

/**
 * Cupo, deuda y cuándo toca pagar.
 *
 * Lo primero que se ve es **cuánto queda**, que es la pregunta que uno se hace
 * antes de comprar; la deuda va debajo. Sin colores de alarma: mirar la
 * tarjeta cuando uno sabe que va mal ya produce bastante ansiedad
 * (principio 3).
 */
export function CardSummaryCard({ resumen }: Props) {
  const theme = useTheme();
  const sobregirada = resumen.disponible.amount < 0n;

  return (
    <Card style={{ gap: theme.spacing.sm }}>
      <AppText level="apoyo" color="textSecondary">
        {sobregirada ? TEXTO_TARJETA.sobregiro : TEXTO_TARJETA.disponible}
      </AppText>
      {/* El signo lo dice la palabra de arriba, no un menos delante del monto. */}
      <Money
        amount={resumen.disponible.amount}
        currency={resumen.disponible.currency}
        direction="neutro"
        size="montoGrande"
        testID="tarjeta-disponible"
      />

      <View style={{ gap: theme.spacing.xs }}>
        <AppText level="apoyo" color="textSecondary">
          {TEXTO_TARJETA.deuda}
        </AppText>
        <Money
          amount={resumen.deuda.amount}
          currency={resumen.deuda.currency}
          direction="neutro"
          size="montoPequeno"
          testID="tarjeta-deuda"
        />
      </View>

      <AppText level="apoyo" color="textSecondary">
        {TEXTO_TARJETA.corte(resumen.diaDeCorte)} · {TEXTO_TARJETA.pago(resumen.diaDePago)}
      </AppText>

      {!resumen.completa && (
        <AppText level="apoyo" color="textSecondary">
          {TEXTO_TARJETA.incompleta}
        </AppText>
      )}
    </Card>
  );
}
