import { useState } from 'react';
import { View } from 'react-native';

import { AppText } from '@/ui/components/app-text';
import { Button } from '@/ui/components/button';
import { MoneyField, TextField } from '@/ui/components/text-field';
import { useTheme } from '@/ui/theme/use-theme';

interface Props {
  onSubmit: (amount: bigint, descripcion: string) => Promise<void>;
  onCancel: () => void;
}

/** El único formulario de la app: cuánto se gastó del efectivo. Es una corrección, no un flujo. */
export function CashExpenseForm({ onSubmit, onCancel }: Props) {
  const theme = useTheme();
  const [monto, setMonto] = useState<bigint | null>(null);
  const [descripcion, setDescripcion] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [fallo, setFallo] = useState(false);

  const valido = monto !== null && monto > 0n && descripcion.trim().length > 0;

  const enviar = (): void => {
    if (monto === null || monto <= 0n || descripcion.trim().length === 0) return;
    setEnviando(true);
    setFallo(false);
    onSubmit(monto, descripcion.trim())
      .catch(() => {
        setFallo(true);
      })
      .finally(() => {
        setEnviando(false);
      });
  };

  return (
    <View style={{ gap: theme.spacing.lg, padding: theme.spacing.lg }}>
      <AppText level="subtitulo">Gasto en efectivo</AppText>
      <MoneyField label="Monto" value={monto} onChange={setMonto} />
      <TextField
        label="Descripción"
        value={descripcion}
        onChangeText={setDescripcion}
        placeholder="Almuerzo"
      />
      {fallo && (
        <AppText level="apoyo" color="peligro">
          No se pudo registrar. Intenta de nuevo.
        </AppText>
      )}
      <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
        <View style={{ flex: 1 }}>
          <Button label="Cancelar" onPress={onCancel} variant="secundario" disabled={enviando} />
        </View>
        <View style={{ flex: 1 }}>
          <Button label="Registrar" onPress={enviar} disabled={!valido} loading={enviando} />
        </View>
      </View>
    </View>
  );
}
