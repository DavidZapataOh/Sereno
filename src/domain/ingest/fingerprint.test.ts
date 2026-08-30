import { fingerprintOf, normalizeDescription } from './fingerprint';

const base = {
  fecha: '2026-08-28T00:00:00.000-05:00',
  descripcion: 'COMPRA PSE *4471 EXITO SUR',
  monto: 45000,
  moneda: 'COP' as const,
  tipo: 'debito' as const,
  fuente: 'bancolombia' as const,
  referencia: 'REF-1',
};

describe('normalizeDescription', () => {
  it('pasa a minúsculas, quita acentos y colapsa espacios', () => {
    expect(normalizeDescription('  Éxito   SUR ')).toBe('exito sur');
  });

  it('quita el prefijo de tipo del banco y los números de terminal', () => {
    // «COMPRA», «PAGO», «*4471» son ruido del banco: dos fuentes distintas
    // describen la misma compra con prefijos distintos.
    expect(normalizeDescription('COMPRA PSE *4471 EXITO SUR')).toBe('exito sur');
    expect(normalizeDescription('PAGO EXITO SUR')).toBe('exito sur');
    expect(normalizeDescription('Pago en EXITO SUR')).toBe('exito sur');
  });

  it('un comercio que se llame como un conector no desaparece', () => {
    // Lo encontró fast-check: «a» es conector en «transferencia a nequi» pero
    // comercio en «compra a». Las dos fuentes tienen que dar la misma huella.
    expect(normalizeDescription('COMPRA A')).toBe('a');
    expect(normalizeDescription('Pago en A')).toBe('a');
    expect(normalizeDescription('TRANSFERENCIA A NEQUI')).toBe('nequi');
  });

  it('no deja la descripción vacía aunque todo fuera ruido', () => {
    expect(normalizeDescription('COMPRA *0000')).toBe('compra *0000');
  });
});

describe('fingerprintOf', () => {
  it('combina día, monto y descripción normalizada', () => {
    expect(fingerprintOf(base)).toBe('2026-08-28|45000|exito sur');
  });

  it('dos fuentes que describen la misma compra dan la misma huella', () => {
    const porCorreo = { ...base, descripcion: 'Pago en EXITO SUR', fuente: 'nequi' as const };
    expect(fingerprintOf(porCorreo)).toBe(fingerprintOf(base));
  });

  it('acepta la fecha en el formato del portal', () => {
    expect(fingerprintOf({ ...base, fecha: '2026/08/28' })).toBe('2026-08-28|45000|exito sur');
  });

  it('el día sale de la fecha en Colombia, no de la cadena tal cual', () => {
    expect(fingerprintOf({ ...base, fecha: '2026-08-29T03:00:00.000Z' })).toContain('2026-08-28|');
  });

  it('montos distintos dan huellas distintas', () => {
    expect(fingerprintOf({ ...base, monto: 45001 })).not.toBe(fingerprintOf(base));
  });
});
