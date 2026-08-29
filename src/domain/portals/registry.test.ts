import { getPortal, perteneceAlPortal, PORTALS } from './registry';

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

describe('perteneceAlPortal', () => {
  const nequi = getPortal('nequi');
  const bancolombia = getPortal('bancolombia');
  if (nequi === undefined || bancolombia === undefined) throw new Error('portal ausente');

  it('acepta el dominio principal', () => {
    expect(perteneceAlPortal(nequi, 'https://www.nequi.com.co/')).toBe(true);
  });

  it('acepta subdominios: el login suele vivir en otro host', () => {
    expect(perteneceAlPortal(nequi, 'https://id.nequi.com.co/login')).toBe(true);
    expect(perteneceAlPortal(nequi, 'https://transacciones.nequi.co/')).toBe(true);
  });

  it('acepta la sucursal virtual de Bancolombia', () => {
    expect(perteneceAlPortal(bancolombia, 'https://sucursalvirtual.grupobancolombia.com/')).toBe(
      true,
    );
  });

  it('rechaza un dominio ajeno', () => {
    expect(perteneceAlPortal(nequi, 'https://google.com/')).toBe(false);
  });

  it('rechaza un dominio que solo contiene el nombre', () => {
    // «nequi.com.co.atacante.com» no es Nequi.
    expect(perteneceAlPortal(nequi, 'https://nequi.com.co.atacante.com/')).toBe(false);
  });

  it('rechaza una URL inválida sin lanzar', () => {
    expect(perteneceAlPortal(nequi, 'no-es-una-url')).toBe(false);
  });
});
