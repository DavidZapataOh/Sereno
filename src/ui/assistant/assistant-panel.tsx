import { useState } from 'react';
import { View } from 'react-native';

import type { ResumenPublicable } from '@/domain/assistant/publishable-summary';
import type { AssistantStatus } from '@/domain/sync/server-client';
import { AppText } from '@/ui/components/app-text';
import { Button } from '@/ui/components/button';
import { Card } from '@/ui/components/card';
import { EmptyState, ErrorState } from '@/ui/components/states';
import { TextField } from '@/ui/components/text-field';
import { useTheme } from '@/ui/theme/use-theme';

import { AnswerCard, TEXTO_ASISTENTE } from './answer-card';

interface Props {
  onPreguntar: (pregunta: string) => void;
  pensando: boolean;
  resultado?: AssistantStatus;
  /** Lo que salió del teléfono, tal cual, para poder mirarlo. */
  enviado?: ResumenPublicable;
  fallo?: boolean;
}

/**
 * La pantalla del asistente, sin depender de nada del sistema.
 *
 * Está aquí y no en la ruta para poder probarla: la ruta se limita a traer el
 * caso de uso y pasarle estos cuatro datos.
 */
export function AssistantPanel({ onPreguntar, pensando, resultado, enviado, fallo }: Props) {
  const theme = useTheme();
  const [pregunta, setPregunta] = useState('');

  return (
    <View style={{ gap: theme.spacing.lg }}>
      {/* El límite, dicho antes de preguntar: así no parece un fallo. */}
      <AppText level="apoyo" color="textSecondary">
        {TEXTO_ASISTENTE.limite}
      </AppText>

      <View style={{ gap: theme.spacing.md }}>
        <TextField
          label={TEXTO_ASISTENTE.campo}
          value={pregunta}
          onChangeText={setPregunta}
          placeholder={TEXTO_ASISTENTE.ejemplo}
          testID="pregunta"
        />
        <Button
          label={pensando ? TEXTO_ASISTENTE.pensando : TEXTO_ASISTENTE.preguntar}
          loading={pensando}
          disabled={pregunta.trim().length === 0}
          onPress={() => {
            onPreguntar(pregunta.trim());
          }}
        />
      </View>

      {fallo === true && <ErrorState description={TEXTO_ASISTENTE.error} />}

      {resultado?.estado === 'sin-configurar' && (
        <EmptyState
          title={TEXTO_ASISTENTE.sinConfigurar}
          description={TEXTO_ASISTENTE.sinConfigurarAyuda}
        />
      )}

      {resultado?.estado === 'tope-diario' && (
        <EmptyState title={TEXTO_ASISTENTE.tope} description={TEXTO_ASISTENTE.topeAyuda} />
      )}

      {resultado?.estado === 'error' && <ErrorState description={resultado.motivo} />}

      {resultado?.estado === 'ok' && <AnswerCard respuesta={resultado.respuesta} />}

      {/*
        Lo que salió del teléfono, tal cual, para que no haya que creerle a
        nadie. Es la otra mitad de la decisión: se puede ver.
      */}
      {enviado !== undefined && (
        <Card style={{ gap: theme.spacing.xs }}>
          <AppText level="micro" color="textMuted">
            {TEXTO_ASISTENTE.queSalio}
          </AppText>
          <AppText level="micro" color="textSecondary">
            {JSON.stringify(enviado, null, 2)}
          </AppText>
        </Card>
      )}
    </View>
  );
}
