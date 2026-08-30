import { describe, expect, it } from 'vitest';

import { redactar } from './observabilidad';

describe('redactar', () => {
  it('tapa lo que no puede acabar en un registro', () => {
    expect(
      redactar({ token: 'abc', monto: 45000, texto: 'Compraste $45.000 en EXITO', ruta: '/salud' }),
    ).toEqual({
      token: '[redactado]',
      monto: '[redactado]',
      texto: '[redactado]',
      ruta: '/salud',
    });
  });

  it('el cuerpo de un correo nunca sale, se llame como se llame', () => {
    for (const clave of ['texto', 'html', 'cuerpo']) {
      expect(redactar({ [clave]: 'datos bancarios' })[clave]).toBe('[redactado]');
    }
  });

  it('deja pasar lo que sirve para diagnosticar', () => {
    expect(redactar({ fuente: 'bancolombia', intento: 2, esperaMs: 1000 })).toEqual({
      fuente: 'bancolombia',
      intento: 2,
      esperaMs: 1000,
    });
  });
});
