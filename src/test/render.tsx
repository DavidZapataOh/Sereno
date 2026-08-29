import { render, screen, type RenderOptions } from '@testing-library/react-native';
import type { ReactElement, ReactNode } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

const SAFE_AREA_METRICS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 24, left: 0, right: 0, bottom: 16 },
};

function Providers({ children }: { children: ReactNode }) {
  return <SafeAreaProvider initialMetrics={SAFE_AREA_METRICS}>{children}</SafeAreaProvider>;
}

/**
 * Renderiza con los proveedores reales de la app.
 *
 * Es ASÍNCRONA: desde la versión 14 de la librería, `render` devuelve una
 * promesa por el renderizado concurrente de React 19. Sin esperarla, las
 * consultas fallan con «render function has not been called», que no dice nada
 * sobre la causa real.
 *
 * Devuelve `screen` porque en esa misma versión `render` ya no expone consultas.
 */
export async function renderWithProviders(
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>,
): Promise<typeof screen> {
  await render(ui, { wrapper: Providers, ...options });
  return screen;
}

export * from '@testing-library/react-native';
