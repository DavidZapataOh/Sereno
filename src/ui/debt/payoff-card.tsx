import { View } from 'react-native';

import type { Resultado } from '@/domain/debt/payoff';
import { AppText } from '@/ui/components/app-text';
import { Card } from '@/ui/components/card';
import { Money } from '@/ui/components/money';
import { useTheme } from '@/ui/theme/use-theme';

export const TEXTO_ESTRATEGIA = {
  avalancha: 'Avalancha',
  bolaDeNieve: 'Bola de nieve',
  avalanchaComo: 'Ataca primero la deuda más cara. Es la que menos intereses cuesta.',
  bolaComo: 'Ataca primero la deuda más pequeña. Cierras deudas antes.',
  sales: 'Sales en',
  intereses: 'Te costará en intereses',
  /**
   * Cuando el presupuesto no cubre los intereses **no se dibuja ninguna fecha**.
   * Una fecha ahí sería mentir sobre lo único que de verdad importa.
   */
  noConverge: 'Con ese abono mensual la deuda no baja: los intereses se la comen.',
  supuestos: 'Esto vale si:',
};

interface Props {
  titulo: string;
  como: string;
  resultado: Resultado;
}

/**
 * La fecha de salida de una estrategia, o el aviso de que no hay.
 *
 * Es el número más motivador de la app y el más fácil de convertir en mentira.
 * Va siempre con sus supuestos, y cuando no converge **no aparece ninguna
 * fecha**: ni una aproximada, ni una «optimista».
 */
export function PayoffCard({ titulo, como, resultado }: Props) {
  const theme = useTheme();

  return (
    <Card style={{ gap: theme.spacing.sm }}>
      <AppText level="subtitulo">{titulo}</AppText>
      <AppText level="apoyo" color="textSecondary">
        {como}
      </AppText>

      {resultado.estado === 'no-converge' ? (
        <AppText level="cuerpo">{TEXTO_ESTRATEGIA.noConverge}</AppText>
      ) : (
        <View style={{ gap: theme.spacing.xs }}>
          <AppText level="apoyo" color="textSecondary">
            {TEXTO_ESTRATEGIA.sales}
          </AppText>
          <AppText level="titulo">{legible(resultado.fechaDeSalida)}</AppText>
          <AppText level="apoyo" color="textSecondary">
            {TEXTO_ESTRATEGIA.intereses}
          </AppText>
          <Money
            amount={resultado.interesesTotales.amount}
            currency={resultado.interesesTotales.currency}
            direction="neutro"
            size="montoPequeno"
          />
        </View>
      )}
    </Card>
  );
}

const MESES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];

/** «2028-03» → «marzo de 2028». Una fecha se lee, no se descifra. */
function legible(mes: string): string {
  const [anio = '', m = '01'] = mes.split('-');
  return `${MESES[Number(m) - 1] ?? m} de ${anio}`;
}
