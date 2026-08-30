import { useState } from 'react';
import { View } from 'react-native';

import { AppText } from '@/ui/components/app-text';
import { Button } from '@/ui/components/button';
import { Money } from '@/ui/components/money';
import { MoneyField } from '@/ui/components/text-field';
import { useTheme } from '@/ui/theme/use-theme';

interface Props {
  /** Lo que Sereno cree que hay. Se muestra para que el usuario sepa qué está corrigiendo. */
  actual: bigint;
  onSubmit: (amount: bigint) => Promise<void>;
  onCancel: () => void;
}

/**
 * Contar el efectivo: cuánto hay en la billetera ahora mismo.
 *
 * Es el único sitio donde el usuario escribe un saldo, porque es el único
 * saldo que ninguna fuente puede ver. Sereno asienta la diferencia.
 */
export function CashCountForm({ actual, onSubmit, onCancel }: Props) {
  const theme = useTheme();
  const [monto, setMonto] = useState<bigint | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [fallo, setFallo] = useState(false);

  const valido = monto !== null;

  const enviar = (): void => {
    if (monto === null) return;
    setEnviando(true);
    setFallo(false);
    onSubmit(monto)
      .catch(() => {
        setFallo(true);
      })
      .finally(() => {
        setEnviando(false);
      });
  };

  return (
    <View style={{ gap: theme.spacing.lg, padding: theme.spacing.lg }}>
      <AppText level="subtitulo">Contar el efectivo</AppText>
      <View style={{ gap: theme.spacing.xs }}>
        <AppText level="apoyo" color="textSecondary">
          Sereno cree que tienes
        </AppText>
        <Money amount={actual} currency="COP" direction="neutro" size="montoMediano" />
      </View>
      <MoneyField label="¿Cuánto tienes ahora?" value={monto} onChange={setMonto} />
      <AppText level="micro" color="textMuted">
        La diferencia queda registrada como ajuste, con fecha de hoy.
      </AppText>
      {fallo && (
        <AppText level="apoyo" color="peligro">
          No se pudo guardar. Intenta de nuevo.
        </AppText>
      )}
      <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
        <View style={{ flex: 1 }}>
          <Button label="Cancelar" onPress={onCancel} variant="secundario" disabled={enviando} />
        </View>
        <View style={{ flex: 1 }}>
          <Button label="Guardar" onPress={enviar} disabled={!valido} loading={enviando} />
        </View>
      </View>
    </View>
  );
}
