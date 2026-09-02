import { View } from 'react-native';

import { AppText } from '@/ui/components/app-text';
import { Button } from '@/ui/components/button';
import { Card } from '@/ui/components/card';
import { useTheme } from '@/ui/theme/use-theme';

export const TEXTO_ACCION = {
  pendientes: (cuantos: number) =>
    cuantos === 1 ? '1 movimiento sin clasificar' : `${String(cuantos)} movimientos sin clasificar`,
  pendientesAyuda: 'Cuando estén clasificados, las cifras de gasto ya son de fiar.',
  clasificar: 'Clasificar',
  alDia: 'Por hoy está todo',
  /**
   * Ni felicita ni regaña.
   *
   * Duolingo pondría aquí una racha y un búho triste cuando se rompe. Esta es
   * una app de dinero: la que juzga se cierra y no se vuelve a abrir. Se
   * constata que está hecho, y ya.
   */
  alDiaAyuda: 'No hay nada esperando. Vuelve cuando entre algo nuevo.',
};

interface Props {
  pendientes: number;
  onClasificar: () => void;
}

/**
 * Lo único que hay que hacer hoy.
 *
 * **Una sola acción principal.** La pantalla tenía seis destinos seguidos con
 * el mismo peso, que es la receta exacta de la parálisis por elección —ley de
 * Hick—. Ahora hay una cosa que hacer, y el resto son destinos, no decisiones.
 */
export function NextActionCard({ pendientes, onClasificar }: Props) {
  const theme = useTheme();

  if (pendientes === 0) {
    return (
      <Card style={{ gap: theme.spacing.xs }}>
        <AppText level="subtitulo">{TEXTO_ACCION.alDia}</AppText>
        <AppText level="apoyo" color="textSecondary">
          {TEXTO_ACCION.alDiaAyuda}
        </AppText>
      </Card>
    );
  }

  return (
    <Card style={{ gap: theme.spacing.md }}>
      <View style={{ gap: theme.spacing.xs }}>
        <AppText level="subtitulo">{TEXTO_ACCION.pendientes(pendientes)}</AppText>
        <AppText level="apoyo" color="textSecondary">
          {TEXTO_ACCION.pendientesAyuda}
        </AppText>
      </View>
      <Button label={TEXTO_ACCION.clasificar} onPress={onClasificar} />
    </Card>
  );
}
