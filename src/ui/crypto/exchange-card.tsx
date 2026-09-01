import { View } from 'react-native';

import type { ResumenExchange } from '@/application/crypto/sync-exchange';
import { formatRelative } from '@/domain/time/format';
import { AppText } from '@/ui/components/app-text';
import { Card } from '@/ui/components/card';
import { useTheme } from '@/ui/theme/use-theme';

export const TEXTO_EXCHANGE = {
  titulo: 'Binance',
  ok: (cuantos: number) =>
    cuantos === 0
      ? 'Conectado. No hay saldo en los activos que se siguen.'
      : `Conectado. ${String(cuantos)} ${cuantos === 1 ? 'activo leído' : 'activos leídos'}.`,
  sinConfigurar: 'El servidor no tiene las claves de Binance.',
  /**
   * Se dice **qué hacer**, no solo qué pasa. Quien lee esto está buscando por
   * qué no ve su saldo, y la respuesta está en un panel al que puede entrar.
   */
  comoConfigurar:
    'En Railway → Variables, añade BINANCE_API_KEY y BINANCE_API_SECRET. El servidor se reinicia solo y comprueba que la clave sea de solo lectura.',
  error: 'No se pudieron leer los saldos la última vez. El saldo que ya está sigue aquí.',
  leido: (cuando: string) => `Leído ${cuando}`,
  nunca: 'Todavía no se ha leído',
};

interface Props {
  resumen: ResumenExchange | undefined;
  leidoEn: string | null;
  now: string;
}

/**
 * Si Binance está llegando, y si no, por qué.
 *
 * Existe por un fallo concreto: las claves estaban en `servidor/.env` —que
 * está en `.gitignore` y por tanto nunca llega a Railway—, el servidor
 * respondía «no configurado», y la app **no decía nada en ninguna parte**.
 * Hizo falta consultar el servidor a mano para enterarse.
 *
 * Sin colores de alarma: consultar el dinero cuando uno sabe que va mal ya
 * produce bastante ansiedad (principio 3).
 */
export function ExchangeCard({ resumen, leidoEn, now }: Props) {
  const theme = useTheme();

  return (
    <Card style={{ gap: theme.spacing.xs }}>
      <AppText level="cuerpo">{TEXTO_EXCHANGE.titulo}</AppText>

      {resumen?.estado === 'ok' && (
        <AppText level="apoyo" color="textSecondary">
          {TEXTO_EXCHANGE.ok(resumen.leidos)}
        </AppText>
      )}

      {resumen?.estado === 'sin-configurar' && (
        <View style={{ gap: theme.spacing.xs }}>
          <AppText level="apoyo" color="textSecondary">
            {TEXTO_EXCHANGE.sinConfigurar}
          </AppText>
          <AppText level="apoyo" color="textSecondary">
            {TEXTO_EXCHANGE.comoConfigurar}
          </AppText>
        </View>
      )}

      {resumen?.estado === 'error' && (
        <AppText level="apoyo" color="textSecondary">
          {TEXTO_EXCHANGE.error}
        </AppText>
      )}

      <AppText level="micro" color="textMuted">
        {leidoEn === null
          ? TEXTO_EXCHANGE.nunca
          : TEXTO_EXCHANGE.leido(formatRelative(leidoEn, now))}
      </AppText>
    </Card>
  );
}
