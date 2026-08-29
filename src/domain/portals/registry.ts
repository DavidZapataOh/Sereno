export type PortalId = 'nequi' | 'bancolombia';

export interface Portal {
  id: PortalId;
  nombre: string;
  /** Página por la que arranca la WebView. */
  url: string;
  /** Origen al que se restringe la navegación. */
  origen: string;
  /**
   * Dominios en los que la sesión puede moverse, sin el esquema.
   *
   * El login suele vivir en un subdominio distinto al de la portada. Si no está
   * declarado, la WebView expulsa la navegación al navegador del sistema y la
   * sesión se pierde: se entra fuera de la app y no se captura nada.
   */
  dominiosPermitidos: readonly string[];
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
    // La portada vive en nequi.com.co, pero el login está en
    // transacciones.nequi.com — otro dominio, no un subdominio del primero.
    dominiosPermitidos: ['nequi.com.co', 'nequi.co', 'nequi.com'],
    instrucciones:
      'Entra con tu número de celular y tu clave de 4 dígitos, y abre tus movimientos.',
    minutosDeSesion: null,
  },
  {
    id: 'bancolombia',
    nombre: 'Bancolombia',
    url: 'https://www.bancolombia.com/personas',
    origen: 'https://www.bancolombia.com',
    dominiosPermitidos: [
      'bancolombia.com',
      'grupobancolombia.com',
      'sucursalvirtual.grupobancolombia.com',
    ],
    instrucciones:
      'Entra a Sucursal Virtual Personas y ve directo a Movimientos: la sesión expira a los 7 minutos de inactividad.',
    minutosDeSesion: 7,
  },
];

export function getPortal(id: string): Portal | undefined {
  return PORTALS.find((portal) => portal.id === id);
}

/**
 * Si una URL pertenece a la sesión del portal.
 *
 * Compara por sufijo de host para cubrir los subdominios: el login, la sucursal
 * virtual y la portada suelen vivir en hosts distintos del mismo dominio.
 */
export function belongsToPortal(portal: Portal, url: string): boolean {
  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return false;
  }
  return portal.dominiosPermitidos.some(
    (dominio) => host === dominio || host.endsWith(`.${dominio}`),
  );
}
