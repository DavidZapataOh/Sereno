import { View } from 'react-native';

import type { EnvelopeState } from '@/domain/budget/envelope';
import type { HistoricoDeCategoria } from '@/application/budget/monthly-budget';
import { AppText } from '@/ui/components/app-text';
import { Money } from '@/ui/components/money';
import { useTheme } from '@/ui/theme/use-theme';

export const TEXTO_SOBRE = {
  queda: 'Te queda',
  /** Con palabras, no solo con color: el color deja fuera a quien no lo distingue. */
  sobregirado: 'Te pasaste',
  historico: (cuantos: number) =>
    `Sueles gastar esto al mes (${String(cuantos)} ${cuantos === 1 ? 'mes' : 'meses'})`,
  sinHistorico: 'Todavía no hay historia suficiente para comparar',
};

interface Props {
  estado: EnvelopeState;
  historico: HistoricoDeCategoria | undefined;
}

/**
 * Un sobre: lo asignado, lo gastado y lo que queda.
 *
 * El histórico va al lado para **informar la decisión sin tomarla**. Con menos
 * de dos meses no se enseña ningún promedio: un promedio de un mes es un dato
 * disfrazado de consejo.
 */
export function EnvelopeRow({ estado, historico }: Props) {
  const theme = useTheme();

  return (
    <View style={{ paddingVertical: theme.spacing.sm, gap: theme.spacing.xs }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
        <View style={{ flex: 1 }}>
          <AppText level="cuerpo">{estado.envelope.categoria}</AppText>
        </View>
        <Money
          amount={estado.envelope.asignado.amount}
          currency={estado.envelope.asignado.currency}
          direction="neutro"
          size="montoPequeno"
        />
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
        <View style={{ flex: 1 }}>
          <AppText level="apoyo" color="textSecondary">
            {estado.sobregirado ? TEXTO_SOBRE.sobregirado : TEXTO_SOBRE.queda}
          </AppText>
        </View>
        <Money
          amount={estado.queda.amount}
          currency={estado.queda.currency}
          direction="neutro"
          size="montoPequeno"
        />
      </View>

      <AppText level="micro" color="textMuted">
        {historico === undefined || historico.promedio === null
          ? TEXTO_SOBRE.sinHistorico
          : `${TEXTO_SOBRE.historico(historico.meses)}: $ ${historico.promedio.amount.toLocaleString('es-CO')}`}
      </AppText>
    </View>
  );
}
