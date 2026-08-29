import { assert, constantFrom, property, string, webPath } from 'fast-check';
import { SENSITIVE_PATTERNS, isSensitiveUrl, shouldCapture } from './sensitive-routes';

/** Fragmentos literales que corresponden a cada patrón vigilado. */
const SENSITIVE_WORDS = [
  'login',
  'logon',
  'signin',
  'signup',
  'registro',
  'auth',
  'autentic',
  'contrase',
  'token',
  'session',
  'password',
  'clave',
  'credential',
  'otp',
  'mfa',
  '2fa',
  'segundo-factor',
  'captcha',
  'challenge',
];

describe('propiedades de la frontera de seguridad', () => {
  it('cada patrón vigilado tiene una palabra que lo representa', () => {
    // Impide que se añada un patrón nuevo sin cubrirlo en estas pruebas.
    SENSITIVE_PATTERNS.forEach((pattern) => {
      expect(SENSITIVE_WORDS.some((word) => pattern.test(word))).toBe(true);
    });
  });

  it('una URL que contiene una palabra sensible SIEMPRE se rechaza', () => {
    assert(
      property(constantFrom(...SENSITIVE_WORDS), webPath(), webPath(), (word, before, after) => {
        expect(isSensitiveUrl(`https://banco.example${before}/${word}${after}`)).toBe(true);
      }),
    );
  });

  it('la palabra sensible se detecta en cualquier capitalización', () => {
    assert(
      property(constantFrom(...SENSITIVE_WORDS), (word) => {
        const alternada = word
          .split('')
          .map((char, index) => (index % 2 === 0 ? char.toUpperCase() : char))
          .join('');
        expect(isSensitiveUrl(`https://banco.example/${alternada}`)).toBe(true);
      }),
    );
  });

  it('codificar la palabra no la esconde', () => {
    assert(
      property(constantFrom(...SENSITIVE_WORDS), (word) => {
        expect(isSensitiveUrl(`https://banco.example/${encodeURIComponent(word)}`)).toBe(true);
      }),
    );
  });

  it('shouldCapture rechaza cualquier URL sensible, sea cual sea el content-type', () => {
    assert(
      property(constantFrom(...SENSITIVE_WORDS), string(), (word, contentType) => {
        expect(shouldCapture(`https://banco.example/${word}`, contentType)).toBe(false);
      }),
    );
  });

  it('shouldCapture rechaza cualquier content-type que no sea JSON', () => {
    assert(
      property(
        string().filter((s) => !/json/i.test(s)),
        (contentType) => {
          expect(shouldCapture('https://banco.example/api/movimientos', contentType)).toBe(false);
        },
      ),
    );
  });

  it('nunca lanza, sea cual sea la entrada', () => {
    assert(
      property(string(), string(), (url, contentType) => {
        expect(() => shouldCapture(url, contentType)).not.toThrow();
      }),
    );
  });
});
