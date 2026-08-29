import { Component, type ErrorInfo, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

interface Props {
  children: ReactNode;
  /**
   * Reporte del error. Se inyecta desde la capa de composición.
   *
   * La interfaz no importa infraestructura: recibe la dependencia. Además de
   * respetar las fronteras, hace el componente probable sin dobles.
   */
  onError?: (error: Error, componentStack: string | null) => void;
}

interface State {
  hasError: boolean;
}

/**
 * Contiene los errores de renderizado para que un fallo en una pantalla no
 * tumbe la aplicación entera.
 *
 * El detalle técnico va a quien reporte, nunca a la pantalla: el mensaje de un
 * error puede contener datos de la transacción que lo provocó.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    this.props.onError?.(error, info.componentStack ?? null);
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <Text style={styles.title}>Algo salió mal</Text>
          <Text style={styles.body}>
            Tus datos están a salvo. Cierra y vuelve a abrir la aplicación.
          </Text>
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 8 },
  title: { fontSize: 20, fontWeight: '700' },
  body: { textAlign: 'center', opacity: 0.7 },
});
