import { describe, expect, it, vi } from 'vitest';

import { esperaPara, esTransitorio, reintentar } from './reintentar';

const sinDormir = () => Promise.resolve();
const opciones = { intentos: 3, baseMs: 1, topeMs: 10, dormir: sinDormir };

describe('esTransitorio', () => {
  it('reconoce lo que mejora esperando', () => {
    expect(esTransitorio(Object.assign(new Error('x'), { code: 'ETIMEDOUT' }))).toBe(true);
    expect(esTransitorio(Object.assign(new Error('x'), { code: 'ECONNRESET' }))).toBe(true);
    expect(esTransitorio(new Error('429 Too Many Requests'))).toBe(true);
    expect(esTransitorio(new Error('503 Service Unavailable'))).toBe(true);
  });

  it('no reintenta lo que no mejora esperando', () => {
    // Una contraseña revocada no se arregla insistiendo; insistir es cómo se
    // consigue que bloqueen la cuenta.
    expect(esTransitorio(new Error('AUTHENTICATIONFAILED Invalid credentials'))).toBe(false);
    expect(esTransitorio(new Error('401 Unauthorized'))).toBe(false);
    expect(esTransitorio(new Error('cualquier otra cosa'))).toBe(false);
    expect(esTransitorio(null)).toBe(false);
  });
});

describe('esperaPara', () => {
  it('crece exponencialmente y se detiene en el tope', () => {
    const sinAzar = () => 1;
    expect(esperaPara(0, 1000, 60_000, sinAzar)).toBe(1000);
    expect(esperaPara(1, 1000, 60_000, sinAzar)).toBe(2000);
    expect(esperaPara(3, 1000, 60_000, sinAzar)).toBe(8000);
    expect(esperaPara(20, 1000, 60_000, sinAzar)).toBe(60_000);
  });

  it('el jitter reparte: entre la mitad y el total previsto', () => {
    for (const azar of [() => 0, () => 0.5, () => 0.999]) {
      const espera = esperaPara(2, 1000, 60_000, azar);
      expect(espera).toBeGreaterThanOrEqual(2000);
      expect(espera).toBeLessThanOrEqual(4000);
    }
  });
});

describe('reintentar', () => {
  it('devuelve al primer intento cuando no falla', async () => {
    const fn = vi.fn().mockResolvedValue('bien');
    expect(await reintentar(fn, opciones)).toBe('bien');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('reintenta lo transitorio hasta que sale', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(Object.assign(new Error('x'), { code: 'ETIMEDOUT' }))
      .mockRejectedValueOnce(new Error('429 Too Many Requests'))
      .mockResolvedValue('a la tercera');

    expect(await reintentar(fn, { ...opciones, intentos: 5 })).toBe('a la tercera');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('se rinde tras agotar los intentos y deja subir el último error', async () => {
    const fn = vi
      .fn()
      .mockRejectedValue(Object.assign(new Error('sigue caído'), { code: 'ECONNRESET' }));
    await expect(reintentar(fn, opciones)).rejects.toThrow('sigue caído');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('lo permanente no se reintenta ni una vez', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('AUTHENTICATIONFAILED'));
    await expect(reintentar(fn, { ...opciones, intentos: 5 })).rejects.toThrow(
      'AUTHENTICATIONFAILED',
    );
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('avisa de cada reintento, para que quede en el registro', async () => {
    const avisos: number[] = [];
    const fn = vi.fn().mockRejectedValueOnce(new Error('503')).mockResolvedValue('bien');
    await reintentar(fn, {
      ...opciones,
      alReintentar: (intento) => avisos.push(intento),
    });
    expect(avisos).toEqual([1]);
  });
});
