import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { WebView, type WebViewMessageEvent, type WebViewNavigation } from 'react-native-webview';
import { perteneceAlPortal, type Portal } from '@/domain/portals/registry';
import { useCaptureStore } from './store';

/**
 * User-Agent de Chrome en Android.
 *
 * La WebView de Android añade `; wv` al suyo, y los portales bancarios lo usan
 * para rechazar la sesión. Se declara uno de Chrome real y **con versión
 * reciente**: algunos portales rechazan también las versiones antiguas.
 */
const USER_AGENT =
  'Mozilla/5.0 (Linux; Android 15; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36';

interface Props {
  portal: Portal;
  /** Abre la bandeja de capturas sin perder la sesión. */
  onVerCapturas?: () => void;
  /**
   * JavaScript que se inyecta antes de cargar el portal.
   *
   * Se recibe inyectado en vez de importarse: generar el script es
   * infraestructura, y la interfaz no la importa. Además, así el componente se
   * prueba sin arrastrar el generador.
   *
   * Debe ser estable entre renders; recrearlo reinstalaría el interceptor.
   */
  injectedScript: string;
}

export function PortalSession({ portal, injectedScript, onVerCapturas }: Props) {
  const handleMessage = useCaptureStore((state) => state.handleMessage);
  const total = useCaptureStore((state) => state.captures.length);

  const [urlActual, setUrlActual] = useState(portal.url);
  const [bloqueada, setBloqueada] = useState<string | null>(null);

  const onMessage = (event: WebViewMessageEvent): void => {
    handleMessage(event.nativeEvent.data);
  };

  /**
   * Decide si la navegación se queda dentro de la sesión.
   *
   * Sin esto, `originWhitelist` expulsa al navegador del sistema cualquier salto
   * a otro host —y el login de los bancos vive casi siempre en un subdominio
   * distinto—. Al salir, la sesión se abre fuera de la app y no se captura nada.
   */
  const onShouldStartLoadWithRequest = (request: WebViewNavigation): boolean => {
    const permitida = perteneceAlPortal(portal, request.url);
    if (permitida) {
      setUrlActual(request.url);
      setBloqueada(null);
    } else {
      setBloqueada(request.url);
    }
    return permitida;
  };

  return (
    <View style={styles.container}>
      <View style={styles.banner}>
        <Text style={styles.instrucciones}>{portal.instrucciones}</Text>
        {portal.minutosDeSesion !== null && (
          <Text style={styles.aviso} testID="aviso-sesion">
            La sesión expira a los {portal.minutosDeSesion} minutos de inactividad.
          </Text>
        )}
      </View>

      <WebView
        source={{ uri: portal.url }}
        originWhitelist={['https://*']}
        onShouldStartLoadWithRequest={onShouldStartLoadWithRequest}
        // En Android, los enlaces con target="_blank" se abren en el navegador
        // del sistema y ni siquiera pasan por la comprobación de arriba. El
        // botón de entrar de los bancos suele ser uno de ellos: sin esto, el
        // usuario acaba iniciando sesión fuera de la app.
        setSupportMultipleWindows={false}
        userAgent={USER_AGENT}
        injectedJavaScriptBeforeContentLoaded={injectedScript}
        onMessage={onMessage}
        sharedCookiesEnabled
        thirdPartyCookiesEnabled
        javaScriptEnabled
        domStorageEnabled
        style={styles.webview}
        testID="webview-portal"
      />

      <Pressable
        style={styles.footer}
        onPress={onVerCapturas}
        accessibilityRole="button"
        accessibilityLabel="Ver capturas"
        testID="pie-capturas"
      >
        <Text style={styles.contador} testID="contador-capturas">
          {total} {total === 1 ? 'captura' : 'capturas'} · toca para verlas
        </Text>
        <Text style={styles.url} numberOfLines={1} testID="url-actual">
          {urlActual}
        </Text>
        {bloqueada !== null && (
          <Text style={styles.bloqueada} numberOfLines={2} testID="url-bloqueada">
            Bloqueada: {bloqueada}
          </Text>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  webview: { flex: 1 },
  banner: { backgroundColor: '#FEF3C7', padding: 12, gap: 4 },
  instrucciones: { fontSize: 13, color: '#78350F' },
  aviso: { fontSize: 11, color: '#92400E', fontWeight: '600' },
  footer: { backgroundColor: '#1F2937', padding: 12, gap: 4 },
  contador: { color: '#F9FAFB', fontWeight: '600', textAlign: 'center' },
  url: { color: '#9CA3AF', fontSize: 10 },
  bloqueada: { color: '#FCA5A5', fontSize: 10 },
});
