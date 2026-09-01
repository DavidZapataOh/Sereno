import { View } from 'react-native';

import type { Metrica } from '@/domain/metrics/behavior';
import { AppText } from '@/ui/components/app-text';
import { Card } from '@/ui/components/card';
import { useTheme } from '@/ui/theme/use-theme';

export const TEXTO_METRICAS = {
  titulo: {
    'antiguedad-del-dinero': 'Antigüedad de tu dinero',
    'tasa-de-ahorro': 'De lo que entra, se queda',
    'meses-de-colchon': 'Aguantarías',
    'deuda-sobre-ingreso': 'Debes, en meses de ingreso',
  } as Record<string, string>,
  que: {
    'antiguedad-del-dinero':
      'Cuántos días llevaba en tu cuenta la plata que estás gastando. Cuanto más alto, menos vives al día.',
    'tasa-de-ahorro': 'La parte de tus ingresos que no se gasta.',
    'meses-de-colchon': 'Cuánto durarías con lo que tienes si mañana se corta el ingreso.',
    'deuda-sobre-ingreso': 'Cuántos meses de ingreso equivale lo que debes.',
  } as Record<string, string>,
  unidad: {
    dias: (v: number) => `${String(v)} días`,
    porcentaje: (v: number) => `${String(v)} %`,
    meses: (v: number) => `${String(v)} meses`,
    veces: (v: number) => `${String(v)} veces`,
  },
  sobre: (meses: number) => `Medido sobre ${String(meses)} meses`,
  queLaMueve: 'Qué la mueve',
  /**
   * Son medidas, no notas. Ni felicitar ni regañar: las dos cosas convierten
   * una herramienta en un juez, y el principio 3 lo descarta.
   */
  explicacion: 'Estas cifras miden cómo se mueve tu plata. No hay una nota buena ni mala.',
  sinDatos: (cuantas: number) =>
    cuantas === 1
      ? '1 medida necesita más historia para poder calcularse'
      : `${String(cuantas)} medidas necesitan más historia para poder calcularse`,
};

interface Props {
  metrica: Metrica;
}

/** Una medida: el número, qué significa y qué la movería. */
export function MetricRow({ metrica }: Props) {
  const theme = useTheme();

  return (
    <Card style={{ gap: theme.spacing.xs }}>
      <AppText level="apoyo" color="textSecondary">
        {TEXTO_METRICAS.titulo[metrica.clave] ?? metrica.clave}
      </AppText>
      <AppText level="titulo">{TEXTO_METRICAS.unidad[metrica.unidad](metrica.valor)}</AppText>

      <AppText level="apoyo" color="textSecondary">
        {TEXTO_METRICAS.que[metrica.clave] ?? ''}
      </AppText>

      <View style={{ gap: theme.spacing.xs }}>
        <AppText level="micro" color="textMuted">
          {`${TEXTO_METRICAS.queLaMueve}: ${metrica.queLaMueve}`}
        </AppText>
        <AppText level="micro" color="textMuted">
          {TEXTO_METRICAS.sobre(metrica.meses)}
        </AppText>
      </View>
    </Card>
  );
}
