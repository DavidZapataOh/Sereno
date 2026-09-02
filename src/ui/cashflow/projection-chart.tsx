import { View } from 'react-native';

import type { MesProyectado } from '@/domain/cashflow/projection';
import { formatCOP } from '@/domain/money/format';
import { AppText } from '@/ui/components/app-text';
import { Money } from '@/ui/components/money';
import { useTheme } from '@/ui/theme/use-theme';

export const TEXTO_PROYECCION = {
  vacio: 'Todavía no hay nada que proyectar.',
  minimo: 'El mes más bajo',
  enRojo: (mes: string) => `En ${mes} el saldo no alcanzaría`,
  /** Lo comprometido y lo estimado se ven distintos, y se dice cuál es cuál. */
  comprometido: 'Con fecha y monto conocidos',
  estimado: 'Estimado',
  sinRojo: 'Con lo que se sabe, el saldo aguanta',
  /** Lo que oye quien no ve la gráfica: la respuesta, no la forma. */
  anuncio: (meses: number, ultimo: string, mesEnRojo: string | null) =>
    mesEnRojo === null
      ? `En ${String(meses)} meses el saldo aguanta y termina en ${ultimo} pesos`
      : `En ${String(meses)} meses el saldo no alcanzaría en ${mesEnRojo}`,
};

const ALTURA = 120;

interface Props {
  meses: readonly MesProyectado[];
  primerMesEnRojo: string | null;
}

/**
 * Cómo se mueve el saldo los próximos meses.
 *
 * Barras y no línea, y la escala rotulada, por lo mismo que en
 * `net-worth-chart`: una línea une puntos que nadie midió, y una escala que no
 * arranca en cero sin decirlo es la forma clásica de mentir con una gráfica.
 *
 * **Un mes bajo cero se dibuja bajo la línea**, no recortado a la altura mínima:
 * esconderlo sería quitar de la vista justo lo que hay que ver.
 */
export function ProjectionChart({ meses, primerMesEnRojo }: Props) {
  const theme = useTheme();

  if (meses.length === 0) {
    return <AppText level="cuerpo">{TEXTO_PROYECCION.vacio}</AppText>;
  }

  const valores = meses.map((m) => m.saldoFinal.amount);
  const minimo = valores.reduce((a, b) => (a < b ? a : b));
  const maximo = valores.reduce((a, b) => (a > b ? a : b));
  const rango = maximo - minimo;

  const alto = (valor: bigint): number =>
    rango === 0n ? ALTURA / 2 : Number(((valor - minimo) * 100n) / rango) * (ALTURA / 100);

  return (
    <View style={{ gap: theme.spacing.sm }}>
      <View
        // altura-fija: el lienzo de la gráfica es un dibujo, no texto.
        style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 2, height: ALTURA }}
        accessibilityRole="summary"
        accessibilityLabel={TEXTO_PROYECCION.anuncio(
          meses.length,
          formatCOP(meses.at(-1)?.saldoFinal.amount ?? 0n),
          primerMesEnRojo,
        )}
      >
        {meses.map((m) => (
          <View
            key={m.mes}
            testID={`barra-${m.mes}`}
            style={{
              flex: 1,
              height: Math.max(2, alto(m.saldoFinal.amount)),
              backgroundColor:
                m.saldoFinal.amount < 0n ? theme.palette.textMuted : theme.palette.accent,
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

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
        <AppText level="micro" color="textMuted">
          {TEXTO_PROYECCION.minimo}
        </AppText>
        <Money amount={minimo} currency="COP" direction="neutro" size="montoPequeno" />
      </View>

      <AppText level="apoyo" color="textSecondary">
        {primerMesEnRojo === null
          ? TEXTO_PROYECCION.sinRojo
          : TEXTO_PROYECCION.enRojo(primerMesEnRojo)}
      </AppText>
    </View>
  );
}
