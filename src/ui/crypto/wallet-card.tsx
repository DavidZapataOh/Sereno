import { View } from 'react-native';

import type { EstadoWallet } from '@/domain/crypto/wallet-repository';
import type { Money as MoneyValue } from '@/domain/money/money';
import { formatRelative } from '@/domain/time/format';
import { AppText } from '@/ui/components/app-text';
import { Card } from '@/ui/components/card';
import { IconButton } from '@/ui/components/icon-button';
import { Money } from '@/ui/components/money';
import { useTheme } from '@/ui/theme/use-theme';

export const TEXTO_WALLET = {
  leidoHace: (cuando: string) => `Leído ${cuando}`,
  sinLeer: 'Todavía no se ha leído',
  noSePudoLeer: 'No se pudo leer la última vez. Se muestra el último saldo bueno.',
  sinSaldo: 'Se miró en todas las cadenas y no hay saldo.',
  borrar: 'Dejar de seguir esta wallet',
};

export interface SaldoEnPantalla {
  /** En qué cadena está. Con catorce, «USDC» a secas no dice dónde. */
  chain: string;
  simbolo: string;
  saldo: MoneyValue;
}

export interface WalletEnPantalla extends EstadoWallet {
  saldos: SaldoEnPantalla[];
}

/**
 * La dirección entera no cabe en el ancho de un teléfono y, entera, tampoco se
 * lee: lo que uno comprueba de un vistazo son las puntas.
 */
function abreviar(direccion: string): string {
  return `${direccion.slice(0, 6)}…${direccion.slice(-4)}`;
}

interface Props {
  estado: WalletEnPantalla;
  ahora: string;
  onBorrar: () => void;
}

/**
 * Una wallet: qué hay, y de cuándo es ese dato.
 *
 * Lo segundo importa tanto como lo primero. Un saldo sin fecha no se puede
 * interpretar: si el nodo lleva dos días caído, el número sigue ahí, tan
 * convincente como el primer día. Por eso un fallo de lectura **no** borra el
 * saldo —eso sería borrar plata de la pantalla— pero sí lo dice encima.
 */
export function WalletCard({ estado, ahora, onBorrar }: Props) {
  const theme = useTheme();
  const fallo = estado.error !== null;

  return (
    <Card style={{ gap: theme.spacing.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
        <View style={{ flex: 1 }}>
          <AppText level="cuerpo">{estado.nombre}</AppText>
          <AppText level="apoyo" color="textSecondary">
            {abreviar(estado.direccion)}
          </AppText>
        </View>
        <IconButton icon="close" label={TEXTO_WALLET.borrar} onPress={onBorrar} />
      </View>

      {estado.saldos.length === 0 && !fallo && (
        <AppText level="apoyo" color="textSecondary">
          {TEXTO_WALLET.sinSaldo}
        </AppText>
      )}
      {estado.saldos.map((s) => (
        <View key={`${s.chain}:${s.simbolo}`} style={{ gap: theme.spacing.xs }}>
          <AppText level="apoyo" color="textSecondary">
            {`${s.simbolo} en ${s.chain}`}
          </AppText>
          <Money
            amount={s.saldo.amount}
            currency={s.saldo.currency}
            direction="neutro"
            size="montoMediano"
          />
        </View>
      ))}

      {fallo && (
        <AppText level="apoyo" color="textSecondary">
          {TEXTO_WALLET.noSePudoLeer}
        </AppText>
      )}
      <AppText level="apoyo" color="textSecondary">
        {estado.leidoEn === null
          ? TEXTO_WALLET.sinLeer
          : TEXTO_WALLET.leidoHace(formatRelative(estado.leidoEn, ahora))}
      </AppText>
    </Card>
  );
}
