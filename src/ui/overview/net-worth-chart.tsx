import { View } from 'react-native';

import { hayHueco, type Snapshot } from '@/domain/overview/snapshot';
import { formatShortDate } from '@/domain/time/format';
import { formatCOP } from '@/domain/money/format';
import { AppText } from '@/ui/components/app-text';
import { Money } from '@/ui/components/money';
import { useTheme } from '@/ui/theme/use-theme';

export const TEXTO_EVOLUCION = {
  vacio: 'Todavía no hay historia que enseñar.',
  vacioAyuda: 'Sereno guarda una marca al día. Vuelve mañana y habrá dos.',
  unSoloDia: 'Solo hay una marca: hace falta más de un día para ver una tendencia.',
  hueco: 'Días sin marca, porque la app no se abrió',
  minimo: 'Menor',
  maximo: 'Mayor',
  /** Lo que oye quien no ve la gráfica: la respuesta, no la forma. */
  anuncio: (dias: number, primero: string, ultimo: string) =>
    `Tu patrimonio pasó de ${primero} a ${ultimo} pesos en ${String(dias)} días`,
};

const ALTURA = 120;

interface Props {
  serie: readonly Snapshot[];
}

/**
 * Cómo se ha movido el patrimonio.
 *
 * Barras y no línea a propósito: una línea **une** los puntos, y unir sobre un
 * día sin marca dibuja una evolución que nadie midió. Las barras dejan el
 * hueco a la vista, que es la verdad.
 *
 * Sin librería de gráficas: son barras de altura proporcional, y meter una
 * dependencia de cien kilobytes para esto sería pagar arranque a cambio de
 * nada.
 *
 * La escala arranca en el **mínimo de la serie**, no en cero: entre 1,80 y 1,85
 * millones, con base cero, todas las barras se ven iguales y no se lee nada.
 * Por eso se rotulan el mínimo y el máximo —una escala que no arranca en cero y
 * no lo dice es la forma clásica de mentir con una gráfica—.
 */
export function NetWorthChart({ serie }: Props) {
  const theme = useTheme();

  if (serie.length === 0) {
    return (
      <View style={{ gap: theme.spacing.xs }}>
        <AppText level="cuerpo">{TEXTO_EVOLUCION.vacio}</AppText>
        <AppText level="apoyo" color="textSecondary">
          {TEXTO_EVOLUCION.vacioAyuda}
        </AppText>
      </View>
    );
  }

  const valores = serie.map((s) => s.patrimonio.amount);
  const minimo = valores.reduce((a, b) => (a < b ? a : b));
  const maximo = valores.reduce((a, b) => (a > b ? a : b));
  const rango = maximo - minimo;
  const huecos = serie.filter((s, i) => i > 0 && hayHueco(serie[i - 1] as Snapshot, s)).length;

  const alto = (valor: bigint): number =>
    // Todo igual: media altura, que se lea «plano» y no «cero».
    rango === 0n ? ALTURA / 2 : Number(((valor - minimo) * 100n) / rango) * (ALTURA / 100);

  return (
    <View style={{ gap: theme.spacing.sm }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'flex-end',
          gap: 2,
          // altura-fija: el lienzo de la gráfica es un dibujo, no texto.
          height: ALTURA,
        }}
        accessibilityRole="summary"
        accessibilityLabel={TEXTO_EVOLUCION.anuncio(
          serie.length,
          formatCOP(serie[0]?.patrimonio.amount ?? 0n),
          formatCOP(serie.at(-1)?.patrimonio.amount ?? 0n),
        )}
      >
        {serie.map((s) => (
          <View
            key={s.dia}
            testID={`barra-${s.dia}`}
            style={{
              flex: 1,
              height: Math.max(2, alto(s.patrimonio.amount)),
              backgroundColor: theme.palette.accentFill,
              borderRadius: 2,
            }}
          />
        ))}
      </View>

      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <AppText level="micro" color="textMuted">
          {formatShortDate(`${serie[0]?.dia ?? ''}T12:00:00.000-05:00`)}
        </AppText>
        <AppText level="micro" color="textMuted">
          {formatShortDate(`${serie.at(-1)?.dia ?? ''}T12:00:00.000-05:00`)}
        </AppText>
      </View>

      <View style={{ gap: theme.spacing.xs }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
          <AppText level="micro" color="textMuted">
            {TEXTO_EVOLUCION.minimo}
          </AppText>
          <Money amount={minimo} currency="COP" direction="neutro" size="montoPequeno" />
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
          <AppText level="micro" color="textMuted">
            {TEXTO_EVOLUCION.maximo}
          </AppText>
          <Money amount={maximo} currency="COP" direction="neutro" size="montoPequeno" />
        </View>
      </View>

      {serie.length === 1 && (
        <AppText level="apoyo" color="textSecondary">
          {TEXTO_EVOLUCION.unSoloDia}
        </AppText>
      )}
      {huecos > 0 && (
        <AppText level="apoyo" color="textSecondary">
          {`${TEXTO_EVOLUCION.hueco}: ${String(huecos)}`}
        </AppText>
      )}
    </View>
  );
}
