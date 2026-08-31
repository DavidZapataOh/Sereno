import { describe, expect, it } from 'vitest';

import { ClavePeligrosaError, verificarPermisos } from './permisos';

const SOLO_LECTURA = { enableReading: true, ipRestrict: true };

describe('verificarPermisos', () => {
  it('acepta una clave de solo lectura', () => {
    expect(() => verificarPermisos(SOLO_LECTURA)).not.toThrow();
    expect(verificarPermisos(SOLO_LECTURA)).toEqual([]);
  });

  /**
   * Las que importan. Una clave con cualquiera de ellas, si se filtra, es
   * dinero que se mueve. Y leería los saldos igual de bien, así que nadie lo
   * notaría hasta que fuera tarde.
   */
  it('rechaza una clave que puede retirar', () => {
    expect(() => verificarPermisos({ ...SOLO_LECTURA, enableWithdrawals: true })).toThrow(
      ClavePeligrosaError,
    );
    expect(() => verificarPermisos({ ...SOLO_LECTURA, enableWithdrawals: true })).toThrow(
      /retirar/i,
    );
  });

  it('rechaza una clave que puede operar', () => {
    expect(() => verificarPermisos({ ...SOLO_LECTURA, enableSpotAndMarginTrading: true })).toThrow(
      /operar/i,
    );
  });

  it('rechaza margen y futuros', () => {
    expect(() => verificarPermisos({ ...SOLO_LECTURA, enableMargin: true })).toThrow(/margen/i);
    expect(() => verificarPermisos({ ...SOLO_LECTURA, enableFutures: true })).toThrow(/futuros/i);
  });

  it('rechaza las transferencias internas', () => {
    expect(() => verificarPermisos({ ...SOLO_LECTURA, enableInternalTransfer: true })).toThrow(
      /transferir/i,
    );
  });

  /**
   * Quien lea esto está mirando el panel de Binance: hay que decirle qué
   * casilla desmarcar, no solo que está mal.
   */
  it('el mensaje dice qué casilla desmarcar', () => {
    expect(() => verificarPermisos({ ...SOLO_LECTURA, enableWithdrawals: true })).toThrow(
      /Enable Withdrawals/,
    );
  });

  it('nombra todos los permisos peligrosos, no solo el primero', () => {
    try {
      verificarPermisos({ ...SOLO_LECTURA, enableWithdrawals: true, enableFutures: true });
      expect.unreachable('debería haber lanzado');
    } catch (error) {
      expect(String(error)).toContain('Enable Withdrawals');
      expect(String(error)).toContain('Enable Futures');
    }
  });

  it('una clave que ni siquiera puede leer no sirve', () => {
    expect(() => verificarPermisos({ enableReading: false, ipRestrict: true })).toThrow(
      /Enable Reading/,
    );
  });

  /**
   * Aviso y no bloqueo: Railway solo da IP saliente fija en el plan Pro, así
   * que exigirlo dejaría la integración sin arrancar por algo que el usuario
   * no puede cumplir. Con la clave en solo lectura, el peor caso de una
   * filtración es que alguien vea los saldos.
   */
  it('sin restricción de IP avisa, pero no impide arrancar', () => {
    const avisos = verificarPermisos({ enableReading: true, ipRestrict: false });

    expect(avisos).toHaveLength(1);
    expect(avisos[0]).toContain('IP');
  });

  it('una clave peligrosa lanza aunque esté restringida por IP', () => {
    // La restricción de IP no compensa poder retirar.
    expect(() =>
      verificarPermisos({ enableReading: true, ipRestrict: true, enableWithdrawals: true }),
    ).toThrow(ClavePeligrosaError);
  });
});
