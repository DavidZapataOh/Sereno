export type PortalId = 'nequi' | 'bancolombia';

export interface Portal {
  id: PortalId;
  nombre: string;
  /** Página por la que arranca la WebView. */
  url: string;
  /** Origen al que se restringe la navegación. */
  origen: string;
  /** Qué debe hacer el usuario una vez dentro. */
  instrucciones: string;
  /** Minutos de inactividad antes de que expire la sesión, si se conoce. */
  minutosDeSesion: number | null;
}

export const PORTALS: readonly Portal[] = [
  {
    id: 'nequi',
    nombre: 'Nequi',
    url: 'https://www.nequi.com.co/',
    origen: 'https://www.nequi.com.co',
    instrucciones:
      'Entra con tu número de celular y tu clave de 4 dígitos, y abre tus movimientos.',
    minutosDeSesion: null,
  },
  {
    id: 'bancolombia',
    nombre: 'Bancolombia',
    url: 'https://www.bancolombia.com/personas',
    origen: 'https://www.bancolombia.com',
    instrucciones:
      'Entra a Sucursal Virtual Personas y ve directo a Movimientos: la sesión expira a los 7 minutos de inactividad.',
    minutosDeSesion: 7,
  },
];

export function getPortal(id: string): Portal | undefined {
  return PORTALS.find((portal) => portal.id === id);
}
