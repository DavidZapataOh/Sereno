import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from '@expo-google-fonts/inter';

/**
 * Inter.
 *
 * Es el estándar de facto en interfaces financieras: cifras tabulares de buena
 * calidad, altura de x generosa y buena diferenciación entre caracteres
 * confundibles en pantalla pequeña (1/l/I, 0/O).
 *
 * Variantes estáticas, no la variable: las fuentes variables no tienen soporte
 * uniforme en todas las plataformas. Con estáticas, el peso va en la familia y
 * no en `fontWeight`, que en Android puede provocar una caída a la fuente del
 * sistema.
 */
export const FONT_FAMILY = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
} as const;

export interface TypeLevel {
  fontSize: number;
  lineHeight: number;
  fontFamily: string;
  letterSpacing?: number;
}

/**
 * Escala tipográfica.
 *
 * Pocos niveles, bien separados: es lo que permite que una pantalla densa no se
 * sienta apretada. Los niveles de monto están declarados aparte del texto
 * porque tienen otras reglas: peso mayor, interlineado más ceñido y espaciado
 * ligeramente negativo en los tamaños grandes, donde las cifras tienden a
 * separarse demasiado.
 */
export const TYPE_SCALE = {
  montoGrande: {
    fontSize: 40,
    lineHeight: 46,
    fontFamily: FONT_FAMILY.bold,
    letterSpacing: -0.8,
  },
  titulo: { fontSize: 28, lineHeight: 34, fontFamily: FONT_FAMILY.bold, letterSpacing: -0.4 },
  montoMediano: {
    fontSize: 20,
    lineHeight: 26,
    fontFamily: FONT_FAMILY.semibold,
    letterSpacing: -0.2,
  },
  subtitulo: { fontSize: 18, lineHeight: 24, fontFamily: FONT_FAMILY.semibold },
  cuerpo: { fontSize: 16, lineHeight: 24, fontFamily: FONT_FAMILY.regular },
  montoPequeno: { fontSize: 15, lineHeight: 20, fontFamily: FONT_FAMILY.medium },
  apoyo: { fontSize: 14, lineHeight: 20, fontFamily: FONT_FAMILY.regular },
  micro: { fontSize: 12, lineHeight: 16, fontFamily: FONT_FAMILY.medium },
} as const satisfies Record<string, TypeLevel>;

export type TypeScaleKey = keyof typeof TYPE_SCALE;

/**
 * Carga las fuentes.
 *
 * Devuelve `true` cuando están listas O cuando fallaron: en ambos casos la app
 * debe pintar. Si la carga falla, Android cae a la fuente del sistema y la app
 * sigue siendo usable; quedarse en la pantalla de arranque no lo sería.
 */
export function useAppFonts(): boolean {
  const [loaded, error] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });
  return loaded || error !== null;
}
