import { REDACTED, redact } from './redact';

describe('redact — claves sensibles', () => {
  const sensibles = [
    'token',
    'accessToken',
    'refresh_token',
    'password',
    'clave',
    'secret',
    'apiKey',
    'authorization',
    'cookie',
    'saldo',
    'balance',
    'monto',
    'amount',
    'accountNumber',
    'numeroCuenta',
    'email',
    'correo',
    'phone',
    'celular',
  ];

  it.each(sensibles)('redacta la clave %s', (key) => {
    const result = redact({ [key]: 'valor-real' }) as Record<string, unknown>;
    expect(result[key]).toBe(REDACTED);
  });

  it('ignora mayúsculas y minúsculas en el nombre de la clave', () => {
    const result = redact({ ACCESSTOKEN: 'x', Saldo: 1 }) as Record<string, unknown>;
    expect(result.ACCESSTOKEN).toBe(REDACTED);
    expect(result.Saldo).toBe(REDACTED);
  });

  it('conserva las claves no sensibles', () => {
    expect(redact({ tipo: 'debito', fuente: 'nequi' })).toEqual({
      tipo: 'debito',
      fuente: 'nequi',
    });
  });

  it('redacta en objetos anidados', () => {
    const result = redact({ tx: { descripcion: 'EXITO', monto: 45000 } }) as {
      tx: Record<string, unknown>;
    };
    expect(result.tx.monto).toBe(REDACTED);
    expect(result.tx.descripcion).toBe('EXITO');
  });

  it('redacta dentro de arreglos', () => {
    const result = redact([{ saldo: 1 }, { saldo: 2 }]) as Record<string, unknown>[];
    expect(result.map((r) => r.saldo)).toEqual([REDACTED, REDACTED]);
  });
});

describe('redact — valores sensibles', () => {
  it('redacta un correo aunque la clave no sea sensible', () => {
    const result = redact({ nota: 'escribir a alguien@ejemplo.com' }) as Record<string, unknown>;
    expect(result.nota).not.toContain('alguien@ejemplo.com');
    expect(result.nota).toContain(REDACTED);
  });

  it('redacta algo con forma de número de tarjeta', () => {
    const result = redact({ nota: 'tarjeta 4111 1111 1111 1111' }) as Record<string, unknown>;
    expect(result.nota).not.toContain('4111');
  });

  it('redacta algo con forma de JWT', () => {
    const jwt = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.firma-falsa-de-prueba';
    const result = redact({ nota: `bearer ${jwt}` }) as Record<string, unknown>;
    expect(result.nota).not.toContain('eyJhbGciOiJIUzI1NiJ9');
  });

  it('deja pasar texto sin nada sensible', () => {
    const result = redact({ nota: 'sincronizacion completada' }) as Record<string, unknown>;
    expect(result.nota).toBe('sincronizacion completada');
  });
});

describe('redact — robustez', () => {
  it('maneja null y undefined', () => {
    expect(redact(null)).toBeNull();
    expect(redact(undefined)).toBeUndefined();
  });

  it('deja pasar primitivos no sensibles', () => {
    expect(redact(42)).toBe(42);
    expect(redact(true)).toBe(true);
  });

  it('no entra en bucle con referencias circulares', () => {
    const circular: Record<string, unknown> = { nombre: 'raiz' };
    circular.self = circular;
    expect(() => redact(circular)).not.toThrow();
  });

  it('no muta el objeto original', () => {
    const original = { saldo: 5000 };
    redact(original);
    expect(original.saldo).toBe(5000);
  });

  it('conserva el mensaje y el nombre de un Error, redactando su contenido', () => {
    const error = new Error('fallo con token eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.firma');
    const result = redact(error) as { name: string; message: string };
    expect(result.name).toBe('Error');
    expect(result.message).not.toContain('eyJhbGciOiJIUzI1NiJ9');
  });

  it('corta la recursión a una profundidad razonable', () => {
    let deep: Record<string, unknown> = { fin: 'valor' };
    for (let i = 0; i < 50; i += 1) deep = { nivel: deep };
    expect(() => redact(deep)).not.toThrow();
  });
});
