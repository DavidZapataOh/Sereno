import { View } from 'react-native';

import type { ResumenIngreso } from '@/application/income/required-income';
import { AppText } from '@/ui/components/app-text';
import { Card } from '@/ui/components/card';
import { Money } from '@/ui/components/money';
import { useTheme } from '@/ui/theme/use-theme';

export const TEXTO_INGRESO = {
  titulo: 'Cuánto necesitas ganar al mes',
  minimo: 'Para no hundirte',
  minimoQue: 'Solo lo que tiene fecha: cuotas, tarjetas y suscripciones',
  sostener: 'Para seguir como vas',
  sostenerQue: 'Lo anterior más tu gasto habitual',
  conMetas: 'Para llegar a tus metas',
  conMetasQue: 'Lo anterior más lo que apartas cada mes',
  observado: (meses: number) =>
    `Lo que entra de verdad (${String(meses)} ${meses === 1 ? 'mes' : 'meses'} observados)`,
  sinObservado: 'Todavía no hay historia de ingresos para comparar',
  /** Sin regañar: quien mira esto ya sabe que va apretado (principio 3). */
  noAlcanza: 'Con lo que entra hoy no da para sostener el ritmo',
  alcanza: 'Con lo que entra hoy alcanza',
};

interface Props {
  resumen: ResumenIngreso;
}

/**
 * Las tres cifras, y lo que de verdad entra.
 *
 * **Tres y no una:** una sola escondería cuál se está mirando, y son preguntas
 * distintas. Cada una dice qué incluye, porque un número sin su definición no
 * sirve para decidir qué cobrar.
 */
export function RequiredIncomeCard({ resumen }: Props) {
  const theme = useTheme();

  const fila = (titulo: string, que: string, monto: { amount: bigint; currency: 'COP' }) => (
    <View style={{ gap: theme.spacing.xs }}>
      <AppText level="apoyo" color="textSecondary">
        {titulo}
      </AppText>
      <Money
        amount={monto.amount}
        currency={monto.currency}
        direction="neutro"
        size="montoMediano"
      />
      <AppText level="micro" color="textMuted">
        {que}
      </AppText>
    </View>
  );

  return (
    <Card style={{ gap: theme.spacing.md }}>
      <AppText level="subtitulo">{TEXTO_INGRESO.titulo}</AppText>

      {fila(TEXTO_INGRESO.minimo, TEXTO_INGRESO.minimoQue, resumen.requerido.minimo as never)}
      {fila(TEXTO_INGRESO.sostener, TEXTO_INGRESO.sostenerQue, resumen.requerido.sostener as never)}
      {fila(TEXTO_INGRESO.conMetas, TEXTO_INGRESO.conMetasQue, resumen.requerido.conMetas as never)}

      <View style={{ gap: theme.spacing.xs }}>
        <AppText level="apoyo" color="textSecondary">
          {resumen.observado === null
            ? TEXTO_INGRESO.sinObservado
            : TEXTO_INGRESO.observado(resumen.meses)}
        </AppText>
        {resumen.observado !== null && (
          <>
            <Money
              amount={resumen.observado.amount}
              currency={resumen.observado.currency}
              direction="neutro"
              size="montoPequeno"
            />
            <AppText level="apoyo" color="textSecondary">
              {(resumen.brecha?.amount ?? 0n) > 0n
                ? TEXTO_INGRESO.noAlcanza
                : TEXTO_INGRESO.alcanza}
            </AppText>
          </>
        )}
      </View>
    </Card>
  );
}
