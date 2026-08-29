import { getPortal, belongsToPortal, PORTALS } from './registry';

describe('registro de portales', () => {
  it('incluye Nequi y Bancolombia', () => {
    expect([...PORTALS].map((p) => p.id).sort()).toEqual(['bancolombia', 'nequi']);
  });

  it('todos los portales usan https', () => {
    PORTALS.forEach((portal) => {
      expect(portal.url.startsWith('https://')).toBe(true);
      expect(portal.origen.startsWith('https://')).toBe(true);
    });
  });

  it('la URL de arranque pertenece al origen declarado', () => {
    PORTALS.forEach((portal) => {
      expect(portal.url.startsWith(portal.origen)).toBe(true);
    });
  });

  it('todos los portales explican qué hacer dentro', () => {
    PORTALS.forEach((portal) => {
      expect(portal.instrucciones.length).toBeGreaterThan(20);
    });
  });

  it('Bancolombia declara el límite de sesión de 7 minutos', () => {
    expect(getPortal('bancolombia')?.minutosDeSesion).toBe(7);
  });

  it('devuelve el portal por identificador', () => {
    expect(getPortal('nequi')?.nombre).toBe('Nequi');
  });

  it('devuelve undefined para un identificador desconocido', () => {
    expect(getPortal('davivienda')).toBeUndefined();
  });

  it('devuelve undefined para una cadena vacía', () => {
    expect(getPortal('')).toBeUndefined();
  });
});

describe('belongsToPortal', () => {
  const nequi = getPortal('nequi');
  const bancolombia = getPortal('bancolombia');
  if (nequi === undefined || bancolombia === undefined) throw new Error('portal ausente');

  it('acepta el dominio principal', () => {
    expect(belongsToPortal(nequi, 'https://www.nequi.com.co/')).toBe(true);
  });

  it('acepta subdominios: el login suele vivir en otro host', () => {
    expect(belongsToPortal(nequi, 'https://id.nequi.com.co/login')).toBe(true);
    expect(belongsToPortal(nequi, 'https://transacciones.nequi.co/')).toBe(true);
  });

  it('acepta el host de login observado en campo', () => {
    // Observado el 2026-08-29: la portada es nequi.com.co pero el login vive en
    // transacciones.nequi.com — dominio distinto, no subdominio.
    expect(belongsToPortal(nequi, 'https://transacciones.nequi.com/bdigital/login.jsp')).toBe(true);
  });

  it('acepta la sucursal virtual de Bancolombia', () => {
    expect(belongsToPortal(bancolombia, 'https://sucursalvirtual.grupobancolombia.com/')).toBe(
      true,
    );
  });

  it('rechaza un dominio ajeno', () => {
    expect(belongsToPortal(nequi, 'https://google.com/')).toBe(false);
  });

  it('rechaza un dominio que solo contiene el nombre', () => {
    // «nequi.com.co.atacante.com» no es Nequi.
    expect(belongsToPortal(nequi, 'https://nequi.com.co.atacante.com/')).toBe(false);
  });

  it('rechaza una URL inválida sin lanzar', () => {
    expect(belongsToPortal(nequi, 'no-es-una-url')).toBe(false);
  });
});
