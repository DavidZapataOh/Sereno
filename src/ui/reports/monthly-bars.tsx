import { View } from 'react-native';

import type { GastoDeMes } from '@/application/reports/spending-report';
import { formatCOP } from '@/domain/money/format';
import { AppText } from '@/ui/components/app-text';
import { Money } from '@/ui/components/money';
import { useTheme } from '@/ui/theme/use-theme';

import { TEXTO_INFORMES } from './category-bars';

const ALTURA = 100;

interface Props {
  categoria: string;
  meses: readonly GastoDeMes[];
}

/**
 * La evolución de **una** categoría.
 *
 * Una sola: mezclar varias en la misma vista no responde ninguna pregunta. Y la
 * escala va rotulada por lo mismo que en `net-worth-chart` —no arranca en cero,
 * y una escala así sin decirlo es la forma clásica de mentir con una gráfica—.
 */
export function MonthlyBars({ categoria, meses }: Props) {
  const theme = useTheme();

  if (meses.length < 2) {
    return (
      <View style={{ gap: theme.spacing.xs }}>
        <AppText level="subtitulo">{TEXTO_INFORMES.evolucion(categoria)}</AppText>
        <AppText level="apoyo" color="textSecondary">
          {TEXTO_INFORMES.sinHistoria}
        </AppText>
      </View>
    );
  }

  const valores = meses.map((m) => m.total.amount);
  const minimo = valores.reduce((a, b) => (a < b ? a : b));
  const maximo = valores.reduce((a, b) => (a > b ? a : b));
  const rango = maximo - minimo;

  return (
    <View
      style={{ gap: theme.spacing.sm }}
      accessibilityRole="summary"
      accessibilityLabel={TEXTO_INFORMES.anuncioEvolucion(
        categoria,
        formatCOP(meses[0]?.total.amount ?? 0n),
        formatCOP(meses.at(-1)?.total.amount ?? 0n),
        meses.length,
      )}
    >
      <AppText level="subtitulo">{TEXTO_INFORMES.evolucion(categoria)}</AppText>

      {/* altura-fija: el lienzo de la gráfica es un dibujo, no texto. Las
          cifras que lo acompañan sí crecen con la letra del sistema. */}
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 2, height: ALTURA }}>
        {meses.map((m) => (
          <View
            key={m.mes}
            testID={`mes-${m.mes}`}
            style={{
              flex: 1,
              height: Math.max(
                2,
                rango === 0n
                  ? ALTURA / 2
                  : Number(((m.total.amount - minimo) * 100n) / rango) * (ALTURA / 100),
              ),
              backgroundColor: theme.palette.accent,
              borderRadius: 2,
            }}
          />
        ))}
      </View>

      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <AppText level="micro" color="textMuted">
          {meses[0]?.mes ?? ''}
        </AppText>
        <AppText level="micro" color="textMuted">
          {meses.at(-1)?.mes ?? ''}
        </AppText>
      </View>

      <View style={{ gap: theme.spacing.xs }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
          <AppText level="micro" color="textMuted">
            {TEXTO_INFORMES.minimo}
          </AppText>
          <Money amount={minimo} currency="COP" direction="neutro" size="montoPequeno" />
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
          <AppText level="micro" color="textMuted">
            {TEXTO_INFORMES.maximo}
          </AppText>
          <Money amount={maximo} currency="COP" direction="neutro" size="montoPequeno" />
        </View>
      </View>
    </View>
  );
}
