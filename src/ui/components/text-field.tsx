import { TextInput, View, type KeyboardTypeOptions } from 'react-native';

import { formatCOP } from '@/domain/money/format';
import { useTheme } from '@/ui/theme/use-theme';

import { AppText } from './app-text';

interface TextFieldProps {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  keyboardType?: KeyboardTypeOptions;
  error?: string;
  placeholder?: string;
  testID?: string;
}

export function TextField({
  label,
  value,
  onChangeText,
  keyboardType,
  error,
  placeholder,
  testID,
}: TextFieldProps) {
  const theme = useTheme();
  return (
    <View style={{ gap: theme.spacing.xs }}>
      <AppText level="apoyo" color="textSecondary">
        {label}
      </AppText>
      <TextInput
        testID={testID}
        accessibilityLabel={label}
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        placeholder={placeholder}
        placeholderTextColor={theme.palette.textMuted}
        allowFontScaling
        style={{
          minHeight: theme.touchTargetMin,
          paddingHorizontal: theme.spacing.md,
          borderWidth: 1,
          borderColor: error === undefined ? theme.palette.borderStrong : theme.palette.peligro,
          borderRadius: theme.radius.medio,
          backgroundColor: theme.palette.surface,
          color: theme.palette.textPrimary,
          fontFamily: theme.type.cuerpo.fontFamily,
          fontSize: theme.type.cuerpo.fontSize,
        }}
      />
      {error !== undefined && (
        <AppText level="micro" color="peligro">
          {error}
        </AppText>
      )}
    </View>
  );
}

interface MoneyFieldProps {
  label: string;
  /** Pesos, en la unidad mínima. `null` cuando está vacío. */
  value: bigint | null;
  onChange: (value: bigint | null) => void;
  error?: string;
  testID?: string;
}

/** Solo dígitos; se muestra formateado con punto de miles mientras se escribe. */
export function MoneyField({ label, value, onChange, error, testID }: MoneyFieldProps) {
  return (
    <TextField
      testID={testID}
      label={label}
      value={value === null ? '' : formatCOP(value)}
      keyboardType="number-pad"
      placeholder="$ 0"
      error={error}
      onChangeText={(texto) => {
        const digitos = texto.replace(/\D/g, '');
        onChange(digitos.length === 0 ? null : BigInt(digitos));
      }}
    />
  );
}
