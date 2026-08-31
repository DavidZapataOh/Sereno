import { useState } from 'react';
import { ScrollView, View } from 'react-native';

import type { CardConfig } from '@/application/cards/configure-card';
import { AppText } from '@/ui/components/app-text';
import { Button } from '@/ui/components/button';
import { Card } from '@/ui/components/card';
import { TextField } from '@/ui/components/text-field';
import { useTheme } from '@/ui/theme/use-theme';

export const TEXTO_CONFIG = {
  cupo: 'Cupo total',
  corte: 'Día de corte',
  pago: 'Día de pago',
  guardar: 'Guardar',
  ayuda:
    'Estos tres datos no llegan en ningún correo y no cambian: se ponen una vez. El corte es el día en que la tarjeta cierra el mes; el pago, el día en que vence.',
  soloEnteros: 'Escribe solo números',
};

/** De 1 a 28: los días 29, 30 y 31 no existen todos los meses. */
export const DIAS = Array.from({ length: 28 }, (_, i) => i + 1);

interface Props {
  config: CardConfig;
  onGuardar: (datos: { cupo: bigint; diaDeCorte: number; diaDePago: number }) => void;
  guardando?: boolean;
}

/**
 * Cupo, corte y pago de una tarjeta.
 *
 * Los días se **eligen**, no se escriben: así el «31» no llega nunca al
 * dominio y no hay que explicarlo con un mensaje de error. El cupo sí se
 * escribe, y solo acepta dígitos.
 */
export function CardConfigForm({ config, onGuardar, guardando = false }: Props) {
  const theme = useTheme();
  const [cupo, setCupo] = useState(
    config.tarjeta === null ? '' : config.tarjeta.cupo.amount.toString(),
  );
  const [corte, setCorte] = useState(config.tarjeta?.diaDeCorte ?? 15);
  const [pago, setPago] = useState(config.tarjeta?.diaDePago ?? 5);

  const soloDigitos = /^\d*$/.test(cupo);
  const puedeGuardar = soloDigitos && cupo.length > 0 && !guardando;

  return (
    <Card style={{ gap: theme.spacing.md }}>
      <AppText level="titulo">{config.cuenta.nombre}</AppText>

      <TextField
        label={TEXTO_CONFIG.cupo}
        value={cupo}
        onChangeText={setCupo}
        keyboardType="number-pad"
        error={soloDigitos ? undefined : TEXTO_CONFIG.soloEnteros}
        testID={`cupo-${config.cuenta.id}`}
      />

      {(
        [
          [TEXTO_CONFIG.corte, corte, setCorte],
          [TEXTO_CONFIG.pago, pago, setPago],
        ] as const
      ).map(([etiqueta, valor, set]) => (
        <View key={etiqueta} style={{ gap: theme.spacing.xs }}>
          <AppText level="apoyo" color="textSecondary">
            {etiqueta}
          </AppText>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={{ flexDirection: 'row', gap: theme.spacing.xs }}>
              {DIAS.map((dia) => (
                <Button
                  key={dia}
                  label={String(dia)}
                  accessibilityLabel={`${etiqueta}: ${String(dia)}`}
                  variant={valor === dia ? 'primario' : 'secundario'}
                  onPress={() => {
                    set(dia);
                  }}
                />
              ))}
            </View>
          </ScrollView>
        </View>
      ))}

      <AppText level="apoyo" color="textSecondary">
        {TEXTO_CONFIG.ayuda}
      </AppText>

      <Button
        label={TEXTO_CONFIG.guardar}
        onPress={() => {
          onGuardar({ cupo: BigInt(cupo), diaDeCorte: corte, diaDePago: pago });
        }}
        disabled={!puedeGuardar}
        loading={guardando}
      />
    </Card>
  );
}
