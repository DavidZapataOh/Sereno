import { useState } from 'react';
import { ScrollView, View } from 'react-native';

import type { CardConfig } from '@/application/cards/configure-card';
import { AppText } from '@/ui/components/app-text';
import { Button } from '@/ui/components/button';
import { Card } from '@/ui/components/card';
import { MoneyField } from '@/ui/components/text-field';
import { useTheme } from '@/ui/theme/use-theme';

export const TEXTO_CONFIG = {
  cupo: 'Cupo total',
  deuda: '¿Cuánto debes hoy?',
  corte: 'Día de corte',
  pago: 'Día de pago',
  guardar: 'Guardar',
  ayuda: 'El cupo, el corte y el pago se ponen una vez: no llegan en ningún correo y no cambian.',
  ayudaDeuda:
    'Sereno solo ve lo que compras desde hoy, así que no sabe lo que ya debías. Dilo una vez y de ahí en adelante se actualiza solo con tus compras y pagos. Puedes volver aquí a cuadrarlo cuando quieras.',
};

/** De 1 a 28: los días 29, 30 y 31 no existen todos los meses. */
export const DIAS = Array.from({ length: 28 }, (_, i) => i + 1);

interface Props {
  config: CardConfig;
  /** Lo que la tarjeta debe ahora mismo, según el ledger. */
  deudaActual: bigint;
  onGuardar: (datos: {
    cupo: bigint;
    deuda: bigint;
    diaDeCorte: number;
    diaDePago: number;
  }) => void;
  guardando?: boolean;
}

/**
 * Cupo, corte y pago de una tarjeta.
 *
 * Los días se **eligen**, no se escriben: así el «31» no llega nunca al
 * dominio y no hay que explicarlo con un mensaje de error.
 *
 * La deuda actual está aquí porque sin ella la tarjeta arranca en cero y
 * muestra el cupo entero disponible: Sereno solo ve lo que pasa desde que se
 * conecta, y la deuda de una tarjeta ya existía antes. Es el mismo punto de
 * partida que el saldo inicial de una cuenta o el conteo del efectivo.
 */
export function CardConfigForm({ config, deudaActual, onGuardar, guardando = false }: Props) {
  const theme = useTheme();
  const [cupo, setCupo] = useState<bigint | null>(config.tarjeta?.cupo.amount ?? null);
  const [deuda, setDeuda] = useState<bigint | null>(deudaActual);
  const [corte, setCorte] = useState(config.tarjeta?.diaDeCorte ?? 15);
  const [pago, setPago] = useState(config.tarjeta?.diaDePago ?? 5);

  const puedeGuardar = cupo !== null && deuda !== null && !guardando;

  return (
    <Card style={{ gap: theme.spacing.md }}>
      <AppText level="titulo">{config.cuenta.nombre}</AppText>

      {/* `MoneyField`, no un `TextField` con el teclado numérico: es el único
          sitio donde se escribe dinero, y formatea los miles mientras se
          escribe igual que en los demás formularios de la app. */}
      <MoneyField
        label={TEXTO_CONFIG.cupo}
        value={cupo}
        onChange={setCupo}
        testID={`cupo-${config.cuenta.id}`}
      />

      <View style={{ gap: theme.spacing.xs }}>
        <MoneyField
          label={TEXTO_CONFIG.deuda}
          value={deuda}
          onChange={setDeuda}
          testID={`deuda-${config.cuenta.id}`}
        />
        <AppText level="apoyo" color="textSecondary">
          {TEXTO_CONFIG.ayudaDeuda}
        </AppText>
      </View>

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
          if (cupo === null || deuda === null) return;
          onGuardar({ cupo, deuda, diaDeCorte: corte, diaDePago: pago });
        }}
        disabled={!puedeGuardar}
        loading={guardando}
      />
    </Card>
  );
}
