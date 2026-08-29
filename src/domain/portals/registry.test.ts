import { getPortal, PORTALS } from './registry';

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
