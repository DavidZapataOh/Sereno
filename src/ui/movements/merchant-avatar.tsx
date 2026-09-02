import { View } from 'react-native';

import { AppText } from '@/ui/components/app-text';
import type { Palette } from '@/ui/theme/palette';
import { useTheme } from '@/ui/theme/use-theme';

/**
 * Los cuatro tintes disponibles para un avatar.
 *
 * Son los rellenos suaves que ya existen en la paleta, con su tinta auditada.
 * Cuatro y no quince: `colors.txt` es explícito en que no todo lleva color
 * propio, y una lista con quince colores distintos no es escaneable, es un
 * mosaico.
 */
const TINTES = [
  ['accentSoft', 'onAccentSoft'],
  ['ingresoSoft', 'onIngresoSoft'],
  ['gastoSoft', 'onGastoSoft'],
  ['peligroSoft', 'onPeligroSoft'],
] as const satisfies readonly (readonly [keyof Palette, keyof Palette])[];

/**
 * Qué tinte le toca a un nombre.
 *
 * **Derivado del nombre, no del azar ni del orden.** El mismo comercio tiene
 * siempre el mismo color, en esta pantalla y en la siguiente, hoy y dentro de
 * un año: es lo que convierte el color en una pista de reconocimiento en vez de
 * en decoración.
 */
export function tinteDe(nombre: string): number {
  let suma = 0;
  for (const caracter of nombre.toUpperCase()) suma = (suma + caracter.charCodeAt(0)) % 997;
  return suma % TINTES.length;
}

/**
 * La inicial que se enseña. Una letra, la primera que sea letra o número.
 *
 * Se busca con expresión regular en vez de partir la cadena: partirla rompe los
 * caracteres que ocupan dos unidades —emojis, y algunos alfabetos— y un nombre
 * de comercio puede traer cualquier cosa.
 */
export function inicialDe(nombre: string): string {
  return /[A-ZÁÉÍÓÚÑ0-9]/.exec(nombre.toUpperCase())?.[0] ?? '·';
}

interface Props {
  nombre: string;
  /** Si el movimiento todavía no tiene categoría: se ve, sin depender del color. */
  sinClasificar?: boolean;
}

/**
 * La inicial del comercio, en un círculo.
 *
 * Es lo que hace escaneable una lista larga: el ojo reconoce la forma y el
 * color antes de leer. Y lo que **no** hace es inventarse un logo: no hay
 * ninguna descarga, ninguna petición y ningún tercero mirando en qué se gasta.
 */
export function MerchantAvatar({ nombre, sinClasificar = false }: Props) {
  const theme = useTheme();
  const [fondo, tinta] = TINTES[tinteDe(nombre)] ?? TINTES[0];

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        width: theme.spacing.xxl + theme.spacing.xs,
        height: theme.spacing.xxl + theme.spacing.xs,
        borderRadius: theme.radius.completo,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: theme.palette[fondo],
        // Sin clasificar se marca con un borde, no solo con el color: quien no
        // distingue tonos tiene que verlo igual.
        borderWidth: sinClasificar ? 2 : 0,
        borderColor: theme.palette.borderStrong,
        borderStyle: 'dashed',
      }}
    >
      <AppText level="montoPequeno" color={tinta}>
        {inicialDe(nombre)}
      </AppText>
    </View>
  );
}
