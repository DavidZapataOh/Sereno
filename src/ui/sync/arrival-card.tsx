import { View } from 'react-native';

import type { MovementView } from '@/application/movements/movements';
import { AppText } from '@/ui/components/app-text';
import { IconButton } from '@/ui/components/icon-button';
import { Money } from '@/ui/components/money';
import { Reveal } from '@/ui/motion/reveal';
import { MerchantAvatar } from '@/ui/movements/merchant-avatar';
import { useTheme } from '@/ui/theme/use-theme';

export const TEXTO_LLEGADA = {
  titulo: (cuantos: number) =>
    cuantos === 1 ? 'Llegó 1 movimiento' : `Llegaron ${String(cuantos)} movimientos`,
  ayuda: 'Ya están sumados en lo que tienes.',
  cerrar: 'Cerrar',
  yEstan: (cuantos: number) => `Y ${String(cuantos)} más`,
};

interface Props {
  nuevos: number;
  /** Los últimos que entraron. Se enseñan unos pocos, no la lista entera. */
  ultimos: readonly MovementView[];
  onCerrar: () => void;
}

/** Cuántos se enseñan de uno en uno. Más que esto deja de ser un momento. */
const MAXIMO = 3;

/**
 * Lo que entró esta mañana.
 *
 * **Es el único momento de ceremonia de la app, y ya existía sin celebrarse:**
 * cada mañana el servidor trae movimientos y la lista crecía en silencio. Hay
 * una espera —la traída—, un contenido incierto —cuántos, de dónde, cuánto— y
 * una consecuencia —el saldo cambia—. Las tres etapas del regalo estaban ahí;
 * solo faltaba entregarlo.
 *
 * Se revelan **de uno en uno**: la misma información de golpe produce un solo
 * momento; en secuencia, uno por pieza.
 *
 * **Si no entró nada, esta tarjeta no existe.** Celebrar la nada es cómo una
 * celebración deja de significar algo. Y se cierra de un toque: quien tiene
 * prisa no espera a nadie.
 */
export function ArrivalCard({ nuevos, ultimos, onCerrar }: Props) {
  const theme = useTheme();
  const mostrados = ultimos.slice(0, MAXIMO);
  const restantes = nuevos - mostrados.length;

  return (
    <View
      accessibilityLabel={`${TEXTO_LLEGADA.titulo(nuevos)}. ${TEXTO_LLEGADA.ayuda}`}
      style={{
        backgroundColor: theme.palette.surface,
        borderRadius: theme.radius.enorme,
        borderWidth: 1,
        borderColor: theme.palette.border,
        padding: theme.spacing.lg,
        gap: theme.spacing.md,
      }}
    >
      <Reveal>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
          <View style={{ flex: 1, gap: theme.spacing.xs }}>
            <AppText level="subtitulo">{TEXTO_LLEGADA.titulo(nuevos)}</AppText>
            <AppText level="apoyo" color="textSecondary">
              {TEXTO_LLEGADA.ayuda}
            </AppText>
          </View>
          <IconButton icon="close" label={TEXTO_LLEGADA.cerrar} onPress={onCerrar} />
        </View>
      </Reveal>

      {mostrados.map((movimiento, indice) => (
        <Reveal key={movimiento.id} orden={indice + 1}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
            <MerchantAvatar nombre={movimiento.comercio.nombre} />
            <View style={{ flex: 1 }}>
              <AppText numberOfLines={1}>{movimiento.comercio.nombre}</AppText>
              <AppText level="micro" color="textSecondary" numberOfLines={1}>
                {movimiento.cuenta.nombre}
              </AppText>
            </View>
            <Money
              amount={movimiento.monto.amount}
              currency={movimiento.monto.currency}
              direction={movimiento.direction}
              size="montoPequeno"
            />
          </View>
        </Reveal>
      ))}

      {restantes > 0 && (
        <Reveal orden={mostrados.length + 1}>
          <AppText level="micro" color="textMuted">
            {TEXTO_LLEGADA.yEstan(restantes)}
          </AppText>
        </Reveal>
      )}
    </View>
  );
}
