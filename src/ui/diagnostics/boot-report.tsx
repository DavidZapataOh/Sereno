import { View } from 'react-native';

import { AppText } from '@/ui/components/app-text';
import { Card } from '@/ui/components/card';
import { useTheme } from '@/ui/theme/use-theme';

export const TEXTO_ARRANQUE = {
  titulo: 'Cuánto tardó en abrir',
  /** La pregunta que la tarjeta responde: sin ella es un número suelto. */
  pregunta: '¿Qué parte del arranque es la que cuesta?',
  fase: {
    fuentes: 'Cargar las letras',
    base: 'Abrir la base de datos',
    migraciones: 'Poner la base al día',
    'primera-pantalla': 'Pintar la primera pantalla',
  } as Record<string, string>,
  total: (ms: number) => `Total: ${String(ms)} ms`,
  incompleto: 'El arranque no llegó al final: falta lo que no aparece.',
  vacio: 'Todavía no hay medidas de este arranque.',
};

/**
 * Lo que la tarjeta necesita saber, y nada más.
 *
 * La interfaz no importa el módulo que mide: lo recibe cableado desde la ruta,
 * igual que `LedgerHealth` recibe su verificador. Así esta tarjeta se prueba
 * sin arrancar nada.
 */
interface Props {
  marcas: readonly { fase: string; ms: number }[];
  total: number | null;
}

/**
 * Lo que tardó **este** arranque, en este teléfono.
 *
 * La suite mide sobre un portátil con una base sembrada; el arranque de verdad
 * ocurre aquí, con el historial de David. Son cosas distintas y se dicen
 * distintas: esta tarjeta es la única que habla del teléfono.
 */
export function BootReport({ marcas, total }: Props) {
  const theme = useTheme();

  return (
    <Card style={{ gap: theme.spacing.sm }}>
      <AppText level="subtitulo">{TEXTO_ARRANQUE.titulo}</AppText>
      <AppText level="apoyo" color="textSecondary">
        {TEXTO_ARRANQUE.pregunta}
      </AppText>

      {marcas.length === 0 && (
        <AppText level="apoyo" color="textMuted">
          {TEXTO_ARRANQUE.vacio}
        </AppText>
      )}

      {marcas.map((marca) => (
        <View
          key={marca.fase}
          style={{ flexDirection: 'row', justifyContent: 'space-between', gap: theme.spacing.sm }}
        >
          <AppText level="apoyo">{TEXTO_ARRANQUE.fase[marca.fase] ?? marca.fase}</AppText>
          <AppText level="apoyo" color="textSecondary">{`${String(marca.ms)} ms`}</AppText>
        </View>
      ))}

      {total !== null && (
        <AppText level="micro" color="textMuted">
          {TEXTO_ARRANQUE.total(total)}
        </AppText>
      )}

      {/* Un arranque a medias se dice: si no, faltarían fases sin explicación. */}
      {marcas.length > 0 && total === null && (
        <AppText level="micro" color="textMuted">
          {TEXTO_ARRANQUE.incompleto}
        </AppText>
      )}
    </Card>
  );
}
