import { useState } from 'react';
import { Pressable, View, type PressableStateCallbackType } from 'react-native';
import { WebView, type WebViewMessageEvent, type WebViewNavigation } from 'react-native-webview';

import { belongsToPortal, type Portal } from '@/domain/portals/registry';
import { AppText } from '@/ui/components/app-text';
import { useTheme } from '@/ui/theme/use-theme';

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
  const theme = useTheme();
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
    const permitida = belongsToPortal(portal, request.url);
    if (permitida) {
      setUrlActual(request.url);
      setBloqueada(null);
    } else {
      setBloqueada(request.url);
    }
    return permitida;
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.palette.background }}>
      <View
        style={{
          backgroundColor: theme.palette.surfaceAlt,
          padding: theme.spacing.md,
          gap: theme.spacing.xs,
        }}
      >
        <AppText level="apoyo" color="textSecondary">
          {portal.instrucciones}
        </AppText>
        {portal.minutosDeSesion !== null && (
          <AppText level="micro" color="deuda" testID="aviso-sesion">
            La sesión expira a los {portal.minutosDeSesion} minutos de inactividad.
          </AppText>
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
        style={{ flex: 1 }}
        testID="webview-portal"
      />

      <Pressable
        onPress={onVerCapturas}
        accessibilityRole="button"
        accessibilityLabel="Ver capturas"
        testID="pie-capturas"
        style={({ pressed }: PressableStateCallbackType) => ({
          minHeight: theme.touchTargetMin,
          backgroundColor: pressed ? theme.palette.surfacePressed : theme.palette.surface,
          borderTopWidth: 1,
          borderTopColor: theme.palette.border,
          padding: theme.spacing.md,
          gap: theme.spacing.xs,
        })}
      >
        <AppText level="apoyo" align="center" testID="contador-capturas">
          {total} {total === 1 ? 'captura' : 'capturas'} · toca para verlas
        </AppText>
        <AppText level="micro" color="textMuted" numberOfLines={1} testID="url-actual">
          {urlActual}
        </AppText>
        {bloqueada !== null && (
          <AppText level="micro" color="peligro" numberOfLines={2} testID="url-bloqueada">
            Bloqueada: {bloqueada}
          </AppText>
        )}
      </Pressable>
    </View>
  );
}
