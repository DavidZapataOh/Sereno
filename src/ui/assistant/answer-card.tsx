import { View } from 'react-native';

import type { AssistantAnswer } from '@/domain/sync/server-client';
import { AppText } from '@/ui/components/app-text';
import { Card } from '@/ui/components/card';
import { useTheme } from '@/ui/theme/use-theme';

export const TEXTO_ASISTENTE = {
  titulo: 'Preguntar',
  campo: 'Tu pregunta',
  ejemplo: '¿Me alcanza para el viaje si sigo así?',
  preguntar: 'Preguntar',
  pensando: 'Pensando…',
  /**
   * Lo que no puede responder, dicho **antes** de que se pregunte.
   *
   * David decidió que del teléfono solo salen cifras agregadas. La consecuencia
   * es real y se declara: si la pantalla callara, la primera pregunta por un
   * comercio parecería un fallo de la app en vez de la decisión que es.
   */
  limite:
    'De tu teléfono solo salen totales. No sabe de comercios, fechas ni movimientos sueltos: no puede decirte cuánto llevas en Rappi.',
  cifras: 'Cifras que usó',
  /** Es plata de David: el coste se enseña, aunque sean centavos. */
  costo: (usd: number) => `Esta consulta costó ${usd.toFixed(3)} USD`,
  sinConfigurar: 'El asistente no está encendido',
  sinConfigurarAyuda:
    'Falta la clave de la API en el servidor. Todo lo demás de Sereno funciona igual.',
  tope: 'Se acabaron las consultas de hoy',
  topeAyuda: 'Hay un tope diario para que esto no se convierta en una factura. Mañana vuelve.',
  error: 'No se pudo preguntar.',
  queSalio: 'Qué salió de tu teléfono',
};

/**
 * La respuesta, con **qué cifras dijo haber usado**.
 *
 * Sin esa lista la respuesta es un oráculo: no hay forma de comprobarla. Con
 * ella, cada cifra se puede ir a mirar a su pantalla.
 */
export function AnswerCard({ respuesta }: { respuesta: AssistantAnswer }) {
  const theme = useTheme();
  return (
    <Card style={{ gap: theme.spacing.md }}>
      <AppText>{respuesta.respuesta}</AppText>

      <View style={{ gap: theme.spacing.xs }}>
        <AppText level="micro" color="textMuted">
          {TEXTO_ASISTENTE.cifras}
        </AppText>
        <AppText level="apoyo" color="textSecondary">
          {respuesta.cifrasUsadas.join(', ')}
        </AppText>
      </View>

      <AppText level="micro" color="textMuted">
        {TEXTO_ASISTENTE.costo(respuesta.costoUsd)}
      </AppText>
    </Card>
  );
}
