import { View } from 'react-native';

import type { Money as MoneyValue } from '@/domain/money/money';
import { AppText } from '@/ui/components/app-text';
import { Money } from '@/ui/components/money';
import { useTheme } from '@/ui/theme/use-theme';

export const TEXTO_DEUDA = {
  cuantoDebes: 'Debes en total',
  sinDeudas: 'No debes nada',
  sinDeudasAyuda: 'Cuando conectes una tarjeta o declares un préstamo, aparecerá aquí.',
  /** Se dice con palabras. Solo con color, quien no lo distingue no se entera. */
  bajo: (cuanto: string) => `Debes ${cuanto} menos que hace un mes`,
  subio: (cuanto: string) => `Debes ${cuanto} más que hace un mes`,
  igual: 'Igual que hace un mes',
  /**
   * «Sin comparación» y «no cambió» son cosas distintas: la primera es que no
   * había historia, y decir «igual que hace un mes» ahí sería falso.
   */
  sinComparacion: 'Todavía no hay un mes de historia para comparar',
  proyeccion: 'Si sigues así',
};

interface Props {
  total: MoneyValue;
  cambio: MoneyValue | null;
  /** La fecha de salida, ya legible. `null` si no converge o no hay deudas. */
  fechaDeSalida: string | null;
}

/**
 * Cuánto debes y si vas mejor que hace un mes.
 *
 * Sin colores de alarma ni de premio: mirar lo que se debe cuando uno sabe que
 * va mal ya produce bastante ansiedad (principio 3), y celebrar con verde
 * convierte la deuda en un juego.
 */
export function DebtHeader({ total, cambio, fechaDeSalida }: Props) {
  const theme = useTheme();

  if (total.amount === 0n) {
    return (
      <View style={{ gap: theme.spacing.xs }}>
        <AppText level="titulo">{TEXTO_DEUDA.sinDeudas}</AppText>
        <AppText level="apoyo" color="textSecondary">
          {TEXTO_DEUDA.sinDeudasAyuda}
        </AppText>
      </View>
    );
  }

  return (
    <View style={{ gap: theme.spacing.xs }}>
      <AppText level="apoyo" color="textSecondary">
        {TEXTO_DEUDA.cuantoDebes}
      </AppText>
      <Money
        amount={total.amount}
        currency={total.currency}
        direction="neutro"
        size="montoGrande"
        testID="deuda-total"
      />

      <AppText level="apoyo" color="textSecondary">
        {comparacion(cambio)}
      </AppText>

      {fechaDeSalida !== null && (
        <AppText level="apoyo" color="textSecondary">
          {`${TEXTO_DEUDA.proyeccion}, sales en ${fechaDeSalida}`}
        </AppText>
      )}
    </View>
  );
}

function comparacion(cambio: MoneyValue | null): string {
  if (cambio === null) return TEXTO_DEUDA.sinComparacion;
  if (cambio.amount === 0n) return TEXTO_DEUDA.igual;
  const cuanto = `$ ${(cambio.amount < 0n ? -cambio.amount : cambio.amount).toLocaleString('es-CO')}`;
  return cambio.amount < 0n ? TEXTO_DEUDA.bajo(cuanto) : TEXTO_DEUDA.subio(cuanto);
}
