import * as Clipboard from 'expo-clipboard';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { buildDump } from '@/domain/capture/dump';
import { useCaptureStore } from './store';

export function CaptureTray() {
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
    <View style={styles.container}>
      <Text style={styles.title} testID="titulo-bandeja">
        {captures.length} capturas
      </Text>
      {descartados > 0 && (
        <Text style={styles.descartados} testID="contador-descartados">
          {descartados} mensajes descartados por no cumplir el protocolo
        </Text>
      )}

      <FlatList
        data={captures}
        keyExtractor={(capture) => capture.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<Text style={styles.empty}>Todavía no hay capturas.</Text>}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.url} numberOfLines={2}>
              {item.method} {item.url}
            </Text>
            <Text style={styles.meta}>
              {item.status} · {item.kind} · {item.body.length} bytes
            </Text>
            <Text style={styles.body} numberOfLines={6}>
              {item.body}
            </Text>
          </View>
        )}
      />

      <View style={styles.actions}>
        <Pressable
          style={styles.button}
          onPress={exportarArchivo}
          accessibilityRole="button"
          accessibilityLabel="Exportar volcado como archivo"
        >
          <Text style={styles.buttonText}>Exportar archivo</Text>
        </Pressable>
        <Pressable
          style={styles.button}
          onPress={exportar}
          accessibilityRole="button"
          accessibilityLabel="Copiar volcado de capturas"
        >
          <Text style={styles.buttonText}>Copiar</Text>
        </Pressable>
        <Pressable
          style={[styles.button, styles.danger]}
          onPress={clear}
          accessibilityRole="button"
          accessibilityLabel="Limpiar capturas"
        >
          <Text style={styles.buttonText}>Limpiar</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  title: { fontSize: 20, fontWeight: '700' },
  descartados: { fontSize: 12, color: '#B45309', marginTop: 4 },
  list: { gap: 12, paddingTop: 12 },
  empty: { opacity: 0.6 },
  card: { padding: 12, borderRadius: 10, backgroundColor: '#F3F4F6', gap: 4 },
  url: { fontWeight: '600', fontSize: 13 },
  meta: { fontSize: 11, opacity: 0.6 },
  body: { fontFamily: 'monospace', fontSize: 11 },
  actions: { flexDirection: 'row', gap: 12, paddingTop: 12 },
  button: {
    flex: 1,
    padding: 14,
    borderRadius: 10,
    backgroundColor: '#1F2937',
    alignItems: 'center',
  },
  danger: { backgroundColor: '#991B1B' },
  buttonText: { color: '#F9FAFB', fontWeight: '600' },
});
