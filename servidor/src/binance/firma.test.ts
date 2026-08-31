import { createHmac } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { consultaFirmada, firmar, VENTANA_MS } from './firma';

const SECRETO = 'secreto-de-prueba';

describe('firmar', () => {
  /**
   * Binance firma la cadena **en el orden en que se envía**, así que el orden
   * es parte del contrato: reordenar los parámetros invalida la firma, y el
   * error que devuelve —«Signature for this request is not valid»— no dice
   * nada de la causa.
   */
  it('firma la cadena tal cual, en el orden dado', () => {
    const consulta = 'timestamp=1700000000000&recvWindow=10000';

    expect(firmar(consulta, SECRETO)).toBe(
      createHmac('sha256', SECRETO).update(consulta).digest('hex'),
    );
  });

  it('el orden cambia la firma', () => {
    expect(firmar('a=1&b=2', SECRETO)).not.toBe(firmar('b=2&a=1', SECRETO));
  });

  it('un solo carácter distinto en el secreto da otra firma', () => {
    expect(firmar('a=1', SECRETO)).not.toBe(firmar('a=1', 'Secreto-de-prueba'));
  });

  it('la firma es hexadecimal de 64 caracteres', () => {
    expect(firmar('a=1', SECRETO)).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('consultaFirmada', () => {
  const ahora = () => 1_700_000_000_000;

  it('pone la firma al final: Binance lo exige', () => {
    expect(consultaFirmada({}, SECRETO, ahora)).toMatch(/&signature=[0-9a-f]{64}$/);
  });

  /**
   * Sin `recvWindow`, Binance usa 5000 ms y una petición lenta falla con un
   * error de firma que parece un problema de credenciales.
   */
  it('siempre manda recvWindow y timestamp', () => {
    const consulta = consultaFirmada({}, SECRETO, ahora);

    expect(consulta).toContain(`recvWindow=${String(VENTANA_MS)}`);
    expect(consulta).toContain('timestamp=1700000000000');
  });

  it('conserva los parámetros que se le pasen', () => {
    expect(consultaFirmada({ symbol: 'USDCUSDT' }, SECRETO, ahora)).toContain('symbol=USDCUSDT');
  });

  it('la firma corresponde a todo lo que va antes de ella', () => {
    const consulta = consultaFirmada({ symbol: 'USDCUSDT' }, SECRETO, ahora);
    const [sinFirma = '', firma = ''] = consulta.split('&signature=');

    expect(firma).toBe(firmar(sinFirma, SECRETO));
  });

  it('dos llamadas en momentos distintos dan firmas distintas', () => {
    const a = consultaFirmada({}, SECRETO, () => 1_700_000_000_000);
    const b = consultaFirmada({}, SECRETO, () => 1_700_000_001_000);

    expect(a).not.toBe(b);
  });
});
