import { View } from 'react-native';

import type { Espejo } from '@/domain/insights/mirror';
import { AppText } from '@/ui/components/app-text';
import { PressableScale } from '@/ui/motion/pressable-scale';
import { useTheme } from '@/ui/theme/use-theme';

export const TEXTO_ESPEJO = {
  /** Sin adornos ni exclamaciones: es una constatación, no un anuncio. */
  ver: 'Ver de dónde sale',
};

interface Props {
  espejo: Espejo;
  onVer: () => void;
}

/**
 * Una frase sobre quien la lee.
 *
 * «Gastaste 620.000» es un informe. «La plata que gastas hoy lleva 34 días
 * contigo» dice algo sobre la persona, y eso es lo que se recuerda y lo que
 * hace que una app deje de sentirse como una hoja de cálculo.
 *
 * **Y se puede ir a mirar de dónde sale.** Una frase sobre uno mismo que no se
 * puede comprobar es un horóscopo.
 */
export function MirrorCard({ espejo, onVer }: Props) {
  const theme = useTheme();

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={`${espejo.frase}. ${TEXTO_ESPEJO.ver}`}
      onPress={onVer}
      style={{
        minHeight: theme.touchTargetMin,
        backgroundColor: theme.palette.surfaceAlt,
        borderRadius: theme.radius.enorme,
        padding: theme.spacing.lg,
        gap: theme.spacing.xs,
      }}
      pressedStyle={{ backgroundColor: theme.palette.surfacePressed }}
    >
      <View>
        <AppText level="cuerpo">{espejo.frase}</AppText>
        <AppText level="micro" color="textMuted">
          {TEXTO_ESPEJO.ver}
        </AppText>
      </View>
    </PressableScale>
  );
}
