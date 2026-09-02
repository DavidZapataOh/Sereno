import { View } from 'react-native';

import { formatCOP } from '@/domain/money/format';
import type { Money as MoneyValue } from '@/domain/money/money';
import { formatRelative } from '@/domain/time/format';
import { AppText } from '@/ui/components/app-text';
import { useCountUp } from '@/ui/motion/count-up';
import { useTheme } from '@/ui/theme/use-theme';

export const TEXTO_HERO = {
  titulo: 'Tienes',
  sinValorar: 'Hay saldo que todavía no se pudo pasar a pesos, y no está sumado aquí',
  tasaVieja: (cuando: string) => `Valorado con tasas de ${cuando}`,
  sincronizado: (cuando: string) => `Al día · ${cuando}`,
  nunca: 'Todavía no se ha sincronizado',
};

interface Props {
  patrimonio: MoneyValue;
  sinValorar?: MoneyValue[];
  tasaMasVieja?: string | null;
  ultimaSincronizacion: string | null;
  now: string;
}

/**
 * La cifra que responde «¿cuánto tengo?».
 *
 * **Es el único protagonista de la pantalla.** Antes competía con seis filas de
 * navegación del mismo peso; ahora ocupa el sitio que le corresponde y todo lo
 * demás baja de contraste alrededor. Es la regla de `design.txt`: bajar el
 * contraste de lo secundario **es** lo que crea el espacio para lo principal.
 *
 * Y la cifra **cuenta cuando cambia**: al sincronizar por la mañana, verla
 * subir es la diferencia entre un dato y una noticia.
 */
export function NetWorthHero({
  patrimonio,
  sinValorar = [],
  tasaMasVieja = null,
  ultimaSincronizacion,
  now,
}: Props) {
  const theme = useTheme();
  const mostrado = useCountUp(patrimonio.amount, theme.motion.duracion.entrada);

  return (
    <View
      style={{
        backgroundColor: theme.palette.accentSoft,
        borderRadius: theme.radius.enorme,
        padding: theme.spacing.xl,
        gap: theme.spacing.xs,
      }}
    >
      <AppText level="apoyo" color="onAccentSoft">
        {TEXTO_HERO.titulo}
      </AppText>

      {/*
        El monto va con el texto más fuerte de la paleta y a tamaño grande: es
        la única cosa de la app que se lee desde el otro lado de la mesa. El
        color se pone a mano porque va sobre un relleno, y ese par está
        auditado en `palette.test.ts`.
      */}
      <AppText
        level="montoGrande"
        color="onAccentSoft"
        accessibilityLabel={`Tienes ${formatCOP(mostrado)} pesos`}
      >
        {formatCOP(mostrado)}
      </AppText>

      <AppText level="micro" color="onAccentSoft">
        {ultimaSincronizacion === null
          ? TEXTO_HERO.nunca
          : TEXTO_HERO.sincronizado(formatRelative(ultimaSincronizacion, now))}
      </AppText>

      {sinValorar.length > 0 && (
        <AppText level="micro" color="onAccentSoft">
          {TEXTO_HERO.sinValorar}
        </AppText>
      )}
      {tasaMasVieja !== null && (
        <AppText level="micro" color="onAccentSoft">
          {TEXTO_HERO.tasaVieja(formatRelative(tasaMasVieja, now))}
        </AppText>
      )}
    </View>
  );
}
