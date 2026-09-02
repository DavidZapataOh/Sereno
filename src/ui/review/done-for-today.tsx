import { View } from 'react-native';

import { AppText } from '@/ui/components/app-text';
import { Card } from '@/ui/components/card';
import { Reveal } from '@/ui/motion/reveal';
import { useTheme } from '@/ui/theme/use-theme';

export const TEXTO_CIERRE = {
  titulo: 'Ya está todo clasificado',
  /**
   * El cierre dice **qué queda ordenado gracias a eso**, no cuántos puntos se
   * ganaron. El resultado real de clasificar es que las cifras de gasto ya son
   * de fiar; eso es lo que se cuenta.
   */
  ayuda: 'Tus cifras de gasto por categoría ya están completas.',
  recien: (cuantos: number) =>
    cuantos === 1 ? 'Clasificaste 1 movimiento' : `Clasificaste ${String(cuantos)} movimientos`,
  vacio: 'Cuando llegue algo que Sereno no sepa clasificar, aparecerá aquí.',
};

interface Props {
  /**
   * Cuántos se acaban de clasificar en esta sesión.
   *
   * Cero significa que ya estaba vacío al entrar: entonces no hay nada que
   * cerrar, y decir «bien hecho» por no hacer nada es exactamente cómo una
   * felicitación deja de valer.
   */
  recienClasificados: number;
}

/**
 * El final de la única tarea repetitiva de la app.
 *
 * Clasificar terminaba como terminan las listas: se acababa y ya. Es la
 * definición de final desaprovechado —y el final es, con el pico, lo único que
 * se recuerda de una experiencia—.
 *
 * **Sin medallas ni puntos.** No es un juego: es su plata. Se constata lo que
 * se hizo y qué queda ordenado por ello.
 */
export function DoneForToday({ recienClasificados }: Props) {
  const theme = useTheme();

  return (
    <Card style={{ gap: theme.spacing.sm, margin: theme.spacing.lg }}>
      <Reveal>
        <View style={{ gap: theme.spacing.xs }}>
          <AppText level="subtitulo">{TEXTO_CIERRE.titulo}</AppText>
          {recienClasificados > 0 && (
            <AppText level="apoyo" color="textSecondary">
              {TEXTO_CIERRE.recien(recienClasificados)}
            </AppText>
          )}
          <AppText level="apoyo" color="textSecondary">
            {recienClasificados > 0 ? TEXTO_CIERRE.ayuda : TEXTO_CIERRE.vacio}
          </AppText>
        </View>
      </Reveal>
    </Card>
  );
}
