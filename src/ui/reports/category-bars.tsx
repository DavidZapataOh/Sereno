import { View } from 'react-native';

import type { GastoDeCategoria } from '@/application/reports/spending-report';
import { formatCOP } from '@/domain/money/format';
import { AppText } from '@/ui/components/app-text';
import { Money } from '@/ui/components/money';
import { useTheme } from '@/ui/theme/use-theme';

export const TEXTO_INFORMES = {
  /** La pregunta va escrita: una gráfica sin pregunta es un adorno. */
  enQueSeVa: '¿En qué se te va la plata este mes?',
  evolucion: (categoria: string) => `¿Gastas más que antes en ${categoria}?`,
  vacio: 'No hay gastos este mes',
  minimo: 'El mes más bajo',
  maximo: 'El mes más alto',
  sinHistoria: 'Hace falta más de un mes para ver una tendencia',
  /**
   * Lo que oye quien no ve la gráfica. **Dice la respuesta, no la forma.**
   * «Gráfica de barras de quince categorías» no le sirve a nadie.
   */
  anuncioCategorias: (categoria: string, monto: string, porcentaje: number) =>
    `En lo que más se te va este mes es ${categoria}: ${monto} pesos, el ${String(porcentaje)} por ciento`,
  anuncioEvolucion: (categoria: string, primero: string, ultimo: string, meses: number) =>
    `En ${categoria} gastabas ${primero} pesos y ahora ${ultimo}, en ${String(meses)} meses`,
};

interface Props {
  filas: readonly GastoDeCategoria[];
  onCategoria?: (categoria: string) => void;
}

/**
 * En qué se va la plata, por categoría.
 *
 * Barras y no torta: comparar longitudes es lo que mejor hace el ojo, y con
 * quince categorías una torta es ilegible. **Cada barra lleva su nombre y su
 * monto en texto**: el color no puede ser lo único que la identifique, porque
 * deja fuera a quien no lo distingue y aquí lo que se lee es plata.
 */
export function CategoryBars({ filas }: Props) {
  const theme = useTheme();

  if (filas.length === 0) {
    return <AppText level="cuerpo">{TEXTO_INFORMES.vacio}</AppText>;
  }

  const mayor = filas[0]?.total.amount ?? 1n;

  const mayorFila = filas[0];

  return (
    <View
      style={{ gap: theme.spacing.sm }}
      accessibilityRole="summary"
      accessibilityLabel={
        mayorFila === undefined
          ? TEXTO_INFORMES.vacio
          : TEXTO_INFORMES.anuncioCategorias(
              mayorFila.categoria,
              formatCOP(mayorFila.total.amount),
              mayorFila.porcentaje,
            )
      }
    >
      <AppText level="subtitulo">{TEXTO_INFORMES.enQueSeVa}</AppText>

      {filas.map((fila) => (
        <View key={fila.categoria} style={{ gap: theme.spacing.xs }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
            <View style={{ flex: 1 }}>
              <AppText level="apoyo">{`${fila.categoria} · ${String(fila.porcentaje)} %`}</AppText>
            </View>
            <Money
              amount={fila.total.amount}
              currency={fila.total.currency}
              direction="neutro"
              size="montoPequeno"
            />
          </View>
          {/* El ancho va como fracción de una fila flexible: React Native
              tipa el porcentaje como plantilla y una cadena construida no
              encaja. Con `flex` se lee igual y no hay que forzar el tipo. */}
          {/* altura-fija: la barra es un dibujo de 8 px; el nombre y el monto
              van encima, en texto que sí escala. */}
          <View style={{ flexDirection: 'row', height: 8 }}>
            <View
              testID={`barra-${fila.categoria}`}
              style={{
                flex: Math.max(2, Number((fila.total.amount * 100n) / mayor)),
                borderRadius: 4,
                backgroundColor: theme.palette.accent,
              }}
            />
            <View style={{ flex: Math.max(0, 100 - Number((fila.total.amount * 100n) / mayor)) }} />
          </View>
        </View>
      ))}
    </View>
  );
}
