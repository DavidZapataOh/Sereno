import * as Clipboard from 'expo-clipboard';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Alert, FlatList, Text, View } from 'react-native';

import { buildDump } from '@/domain/capture/dump';
import { AppText } from '@/ui/components/app-text';
import { Button } from '@/ui/components/button';
import { Card } from '@/ui/components/card';
import { EmptyState } from '@/ui/components/states';
import { useTheme } from '@/ui/theme/use-theme';

import { useCaptureStore } from './store';

export function CaptureTray() {
  const theme = useTheme();
  const captures = useCaptureStore((state) => state.captures);
  const descartados = useCaptureStore((state) => state.descartados);
  const clear = useCaptureStore((state) => state.clear);

  const exportar = (): void => {
    void Clipboard.setStringAsync(buildDump(captures)).then(() => {
      Alert.alert(
        'Copiado',
        `${String(captures.length)} capturas en el portapapeles. Contienen datos reales: pégalas en un archivo y bórralo al terminar.`,
      );
    });
  };

  /**
   * Escribe el volcado a un archivo y abre el diálogo de compartir.
   *
   * Es la vía fiable: el portapapeles de Android trunca los textos grandes, y un
   * volcado de una sesión bancaria pasa de los cien kilobytes con facilidad.
   */
  const exportarArchivo = (): void => {
    const nombre = `sereno-capturas-${String(Date.now())}.json`;
    const archivo = new File(Paths.cache, nombre);
    archivo.create({ overwrite: true });
    archivo.write(buildDump(captures));

    void Sharing.isAvailableAsync().then((disponible) => {
      if (!disponible) {
        Alert.alert('No disponible', `Archivo guardado en ${archivo.uri}`);
        return;
      }
      return Sharing.shareAsync(archivo.uri, {
        mimeType: 'application/json',
        dialogTitle: 'Enviar el volcado de capturas',
      });
    });
  };

  return (
    <View style={{ flex: 1, padding: theme.spacing.lg, backgroundColor: theme.palette.background }}>
      <AppText level="subtitulo" testID="titulo-bandeja">
        {captures.length} capturas
      </AppText>
      {descartados > 0 && (
        <AppText level="apoyo" color="deuda" testID="contador-descartados">
          {descartados} mensajes descartados por no cumplir el protocolo
        </AppText>
      )}

      <FlatList
        data={captures}
        keyExtractor={(capture) => capture.id}
        contentContainerStyle={{ gap: theme.spacing.md, paddingTop: theme.spacing.md }}
        ListEmptyComponent={
          <EmptyState
            title="Todavía no hay capturas."
            description="Abre un portal e inicia sesión: lo que el banco responda aparecerá aquí."
          />
        }
        renderItem={({ item }) => (
          <Card style={{ gap: theme.spacing.xs, padding: theme.spacing.md }}>
            <AppText level="apoyo" numberOfLines={2}>
              {item.method} {item.url}
            </AppText>
            <AppText level="micro" color="textMuted">
              {item.status} · {item.kind} · {item.body.length} bytes
            </AppText>
            {/* Un volcado JSON se lee en monoespaciada; es la única excepción a
                AppText, y es una herramienta de diagnóstico, no una pantalla. */}
            <Text
              numberOfLines={6}
              allowFontScaling
              style={{
                fontFamily: 'monospace',
                fontSize: theme.type.micro.fontSize,
                lineHeight: theme.type.micro.lineHeight,
                color: theme.palette.textSecondary,
              }}
            >
              {item.body}
            </Text>
          </Card>
        )}
      />

      <View style={{ flexDirection: 'row', gap: theme.spacing.md, paddingTop: theme.spacing.md }}>
        <View style={{ flex: 1 }}>
          <Button
            label="Exportar archivo"
            accessibilityLabel="Exportar volcado como archivo"
            onPress={exportarArchivo}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Button
            label="Copiar"
            accessibilityLabel="Copiar volcado de capturas"
            onPress={exportar}
            variant="secundario"
          />
        </View>
        <View style={{ flex: 1 }}>
          <Button
            label="Limpiar"
            accessibilityLabel="Limpiar capturas"
            onPress={clear}
            variant="peligro"
          />
        </View>
      </View>
    </View>
  );
}
