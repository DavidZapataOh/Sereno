import { direccionDe, dominioDe, esRemitenteConocido, REMITENTES } from './senders';

describe('remitentes conocidos', () => {
  it('reconoce a los cuatro emisores por sus direcciones reales', () => {
    // Estas son las direcciones exactas de los correos de David.
    expect(esRemitenteConocido('alertasynotificaciones@an.notificacionesbancolombia.com')).toBe(
      true,
    );
    expect(esRemitenteConocido('alertasynotificaciones@ayn.notificacionesbancolombia.com')).toBe(
      true,
    );
    expect(
      esRemitenteConocido(
        'Alertas y Notificaciones <alertasynotificaciones@an.notificacionesbancolombia.com>',
      ),
    ).toBe(true);
    expect(esRemitenteConocido('somos@nequi.com.co')).toBe(true);
    expect(esRemitenteConocido('notificaciones@nequi.com.co')).toBe(true);
    expect(esRemitenteConocido('Nu <nu@nu.com.co>')).toBe(true);
    expect(esRemitenteConocido('NU@NU.COM.CO')).toBe(true);
    expect(esRemitenteConocido('RappiCard <noreply@rappicard.co>')).toBe(true);
    expect(esRemitenteConocido('RappiPay <rappi.nreply@rappi.com>')).toBe(true);
  });

  it('no reconoce a nadie más, ni a quien se le parezca', () => {
    expect(esRemitenteConocido('promociones@tienda.com')).toBe(false);
    // Un dominio que termina en el nuestro pero no es el nuestro.
    expect(esRemitenteConocido('estafa@notificacionesbancolombia.com.phishing.net')).toBe(false);
    expect(esRemitenteConocido('sindominio')).toBe(false);
    expect(esRemitenteConocido('')).toBe(false);
  });

  it('saca la dirección de un remitente con nombre delante', () => {
    expect(direccionDe('Alertas y Notificaciones <a@b.com>')).toBe('a@b.com');
    expect(direccionDe('  A@B.COM ')).toBe('a@b.com');
    expect(dominioDe('Nu <nu@nu.com.co>')).toBe('nu.com.co');
  });

  it('cada remitente declara de qué fuente es', () => {
    for (const r of REMITENTES) {
      expect(r.dominio).toMatch(/^[a-z0-9.-]+$/);
      expect(r.fuente.length).toBeGreaterThan(0);
    }
  });
});
