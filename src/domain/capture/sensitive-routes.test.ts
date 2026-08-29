import { isCapturableContentType, isSensitiveUrl, shouldCapture } from './sensitive-routes';

describe('isSensitiveUrl — rutas de autenticación', () => {
  const sensibles = [
    'https://banco.example/login',
    'https://banco.example/api/auth/validar',
    'https://banco.example/oauth2/token',
    'https://banco.example/api/session/create',
    'https://banco.example/cambiar-password',
    'https://banco.example/api/credentials',
    'https://banco.example/validar-otp',
    'https://banco.example/signin',
    'https://banco.example/logon.do',
    'https://banco.example/api/clave-dinamica',
    'https://banco.example/api/segundo-factor',
    'https://banco.example/api/mfa/verify',
    'https://banco.example/autenticacion',
    'https://banco.example/api/usuario/registro',
    'https://banco.example/cambiar-contrasena',
    'https://banco.example/api/autenticar',
  ];

  it.each(sensibles)('marca como sensible %s', (url) => {
    expect(isSensitiveUrl(url)).toBe(true);
  });

  it('ignora mayúsculas y minúsculas', () => {
    expect(isSensitiveUrl('https://banco.example/API/LOGIN')).toBe(true);
  });

  it('detecta el patrón en los parámetros de consulta', () => {
    expect(isSensitiveUrl('https://banco.example/api/x?flow=authentication')).toBe(true);
  });

  it('detecta el patrón aunque venga codificado en la URL', () => {
    expect(isSensitiveUrl('https://banco.example/%6Cogin')).toBe(true);
  });

  it('detecta el patrón con doble codificación', () => {
    expect(isSensitiveUrl('https://banco.example/%256Cogin')).toBe(true);
  });

  it('no falla ante una URL con escapes inválidos', () => {
    expect(() => isSensitiveUrl('https://banco.example/%ZZ')).not.toThrow();
  });
});

describe('isSensitiveUrl — rutas de datos', () => {
  const seguras = [
    'https://banco.example/api/movimientos',
    'https://banco.example/api/productos/saldo',
    'https://banco.example/api/cuentas/123/transacciones',
    'https://banco.example/api/extracto',
  ];

  it.each(seguras)('no marca como sensible %s', (url) => {
    expect(isSensitiveUrl(url)).toBe(false);
  });
});

describe('isCapturableContentType', () => {
  it.each([
    ['application/json', true],
    ['application/json; charset=utf-8', true],
    ['application/vnd.api+json', true],
    ['text/json', true],
    ['text/html', false],
    ['image/png', false],
    ['application/javascript', false],
    ['text/css', false],
    ['', false],
  ])('para %s devuelve %s', (contentType, esperado) => {
    expect(isCapturableContentType(contentType)).toBe(esperado);
  });
});

describe('shouldCapture', () => {
  it('captura JSON de una ruta de datos', () => {
    expect(shouldCapture('https://banco.example/api/movimientos', 'application/json')).toBe(true);
  });

  it('NO captura JSON de una ruta de autenticación', () => {
    expect(shouldCapture('https://banco.example/api/auth', 'application/json')).toBe(false);
  });

  it('NO captura contenido que no sea JSON', () => {
    expect(shouldCapture('https://banco.example/api/movimientos', 'text/html')).toBe(false);
  });

  it('NO captura con URL vacía', () => {
    expect(shouldCapture('', 'application/json')).toBe(false);
  });
});
