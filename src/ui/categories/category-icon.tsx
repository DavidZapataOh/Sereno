import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';

import { useTheme } from '@/ui/theme/use-theme';

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

/** Si el nombre existe en el mapa de glifos: la taxonomía lo declara como texto y aquí se valida. */
export function isIconName(nombre: string): nombre is IconName {
  return Object.prototype.hasOwnProperty.call(MaterialCommunityIcons.glyphMap, nombre);
}

const RESPALDO: IconName = 'help-circle-outline';

interface Props {
  icono: string;
  size?: number;
  testID?: string;
}

/** Icono de una categoría. Un nombre desconocido pinta un respaldo: nunca revienta la pantalla. */
export function CategoryIcon({ icono, size, testID }: Props) {
  const theme = useTheme();
  return (
    <MaterialCommunityIcons
      testID={testID}
      name={isIconName(icono) ? icono : RESPALDO}
      size={size ?? theme.spacing.xl}
      color={theme.palette.textSecondary}
      accessibilityElementsHidden
      importantForAccessibility="no"
    />
  );
}
