import { createContext, useContext, type ReactNode } from 'react';

import type { Haptics } from '@/domain/feedback/haptics-port';

export type { Haptics, Vibracion } from '@/domain/feedback/haptics-port';

/** Sin adaptador, no vibra nada. Es el comportamiento correcto por defecto. */
const SILENCIO: Haptics = { sentir: () => undefined };

const HapticsContext = createContext<Haptics>(SILENCIO);

/**
 * La interfaz no importa infraestructura: recibe el adaptador cableado desde
 * `src/app/`, igual que la observabilidad. Así las pruebas pueden afirmar que
 * vibró una vez y de qué tipo, sin tocar nada nativo.
 */
export function HapticsProvider({ value, children }: { value: Haptics; children: ReactNode }) {
  return <HapticsContext.Provider value={value}>{children}</HapticsContext.Provider>;
}

export function useHaptics(): Haptics {
  return useContext(HapticsContext);
}
