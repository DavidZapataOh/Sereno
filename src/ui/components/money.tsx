import { Text } from 'react-native';

import type { CurrencyCode } from '@/domain/money/currency';
import {
  currencyName,
  formatAmount,
  formatSigned,
  type MoneyDirection,
} from '@/domain/money/format';
import type { TypeLevel } from '@/ui/theme/typography';
import { useTheme } from '@/ui/theme/use-theme';

interface Props {
  /**
   * Monto en la unidad mínima.
   *
   * Con `direction` «entra» o «sale», el signo lo pone la dirección y el del
   * número se ignora. Con «neutro» —un saldo, un patrimonio— el signo del
   * número **sí** se muestra: ahí es parte del dato.
   */
  amount: bigint | number;
  currency?: CurrencyCode;
  direction: MoneyDirection;
  size?: 'montoGrande' | 'montoMediano' | 'montoPequeno';
  testID?: string;
}

const VERBO_POR_DIRECCION: Record<MoneyDirection, string> = {
  entra: 'Entran',
  sale: 'Salen',
  neutro: 'Son',
};

/**
 * Presenta un monto.
 *
 * Es el único punto del proyecto donde se pinta dinero. Concentra cinco cosas
 * que en otras apps se dispersan y se desincronizan: el formato, el signo, el
 * color, las cifras tabulares y la etiqueta para el lector de pantalla.
 *
 * `fontVariant: ['tabular-nums']` tiene soporte irregular con fuentes cargadas
 * por `expo-font`. Si en algún dispositivo no funciona, la corrección ocurre
 * aquí y en ningún otro sitio.
 */
export function Money({
  amount,
  currency = 'COP',
  direction,
  size = 'montoMediano',
  testID,
}: Props) {
  const theme = useTheme();
  const nivel: TypeLevel = theme.type[size];

  const color = {
    entra: theme.palette.ingreso,
    sale: theme.palette.gasto,
    neutro: theme.palette.textPrimary,
  }[direction];

  return (
    <Text
      testID={testID}
      // El verbo ya dice la dirección, así que el número va en absoluto y sin
      // símbolo: «Salen 45.000 pesos». La excepción es un neutro negativo —un
      // saldo, un patrimonio—, donde el signo **es** el dato y sin él el
      // lector diría «Son 1.814.013» de una deuda.
      accessibilityLabel={`${VERBO_POR_DIRECCION[direction]} ${signoAccesible(amount, direction)}${formatAmount(amount, currency)} ${currencyName(currency)}`}
      // Nunca se desactiva la ampliación de fuente: se acota, para que un monto
      // muy grande no rompa el diseño de quien usa texto al 200 %.
      allowFontScaling
      maxFontSizeMultiplier={1.6}
      style={{
        // Cifras de ancho fijo: sin esto, una columna de montos no alinea y la
        // lista entera parece descuidada.
        fontVariant: ['tabular-nums'],
        fontSize: nivel.fontSize,
        lineHeight: nivel.lineHeight,
        fontFamily: nivel.fontFamily,
        letterSpacing: nivel.letterSpacing,
        color,
      }}
    >
      {formatSigned(amount, direction, currency)}
    </Text>
  );
}

/** El menos del lector de pantalla: solo para un neutro negativo. */
function signoAccesible(amount: bigint | number, direction: MoneyDirection): string {
  return direction === 'neutro' && BigInt(amount) < 0n ? '−' : '';
}
