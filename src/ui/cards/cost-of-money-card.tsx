import { View } from 'react-native';

import {
  CATEGORIAS_DE_COSTO,
  type CategoriaDeCosto,
  type CostOfMoney,
} from '@/application/cards/cost-of-money';
import { AppText } from '@/ui/components/app-text';
import { Card } from '@/ui/components/card';
import { Money } from '@/ui/components/money';
import { useTheme } from '@/ui/theme/use-theme';

export const NOMBRE_DE_COSTO: Record<CategoriaDeCosto, string> = {
  'cuatro-por-mil': '4×1000',
  'comisiones-bancarias': 'Comisiones y cuota de manejo',
  'intereses-de-credito': 'Intereses',
  seguros: 'Seguros',
};

export const TEXTO_COSTO = {
  titulo: 'Te costó mover y tener tu plata',
  proporcion: (pct: number) => `El ${pct.toFixed(1)} % de lo que moviste`,
  ninguno: 'Este periodo no te cobraron nada por mover tu plata.',
  masCaro: 'El movimiento que más caro salió',
};

interface Props {
  costo: CostOfMoney;
}

/**
 * Cuánto cuesta tener y mover el dinero.
 *
 * El total dice poco solo: «$22.000» no significa nada sin saber sobre cuánto.
 * Por eso va la proporción justo debajo. Y el movimiento más caro es lo único
 * de toda la tarjeta que puede cambiar una conducta.
 */
export function CostOfMoneyCard({ costo }: Props) {
  const theme = useTheme();

  if (costo.total.amount === 0n) {
    return (
      <Card>
        <AppText level="apoyo" color="textSecondary">
          {TEXTO_COSTO.ninguno}
        </AppText>
      </Card>
    );
  }

  return (
    <Card style={{ gap: theme.spacing.sm }}>
      <AppText level="apoyo" color="textSecondary">
        {TEXTO_COSTO.titulo}
      </AppText>
      <Money
        amount={costo.total.amount}
        currency={costo.total.currency}
        direction="neutro"
        size="montoMediano"
        testID="costo-total"
      />
      {costo.proporcion > 0 && (
        <AppText level="apoyo" color="textSecondary">
          {TEXTO_COSTO.proporcion(costo.proporcion * 100)}
        </AppText>
      )}

      <View style={{ gap: theme.spacing.xs }}>
        {CATEGORIAS_DE_COSTO.filter((c) => costo.porTipo[c].amount > 0n).map((c) => (
          <View
            key={c}
            style={{ flexDirection: 'row', justifyContent: 'space-between', gap: theme.spacing.sm }}
          >
            <AppText level="apoyo" color="textSecondary">
              {NOMBRE_DE_COSTO[c]}
            </AppText>
            <Money
              amount={costo.porTipo[c].amount}
              currency={costo.porTipo[c].currency}
              direction="neutro"
              size="montoPequeno"
            />
          </View>
        ))}
      </View>

      {costo.masCaro !== null && (
        <AppText level="apoyo" color="textSecondary">
          {TEXTO_COSTO.masCaro}
        </AppText>
      )}
    </Card>
  );
}
