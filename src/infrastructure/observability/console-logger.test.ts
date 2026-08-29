import { createConsoleObservability } from './console-logger';
import { REDACTED } from '@/domain/observability/redact';

describe('createConsoleObservability', () => {
  let spy: jest.SpyInstance;

  afterEach(() => {
    spy.mockRestore();
  });

  it('escribe los mensajes de info por console.info', () => {
    spy = jest.spyOn(console, 'info').mockImplementation(() => undefined);
    createConsoleObservability().log('info', 'listo');
    expect(spy).toHaveBeenCalledWith('[info] listo', '');
  });

  it('escribe los errores por console.error', () => {
    spy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    createConsoleObservability().captureError(new Error('roto'));
    expect(spy).toHaveBeenCalled();
  });

  it('redacta el contexto antes de escribirlo', () => {
    spy = jest.spyOn(console, 'info').mockImplementation(() => undefined);
    createConsoleObservability().log('info', 'cuenta', { saldo: 999 });
    const emitido = JSON.stringify(spy.mock.calls[0]);
    expect(emitido).not.toContain('999');
    expect(emitido).toContain(REDACTED);
  });

  it('redacta el mensaje antes de escribirlo', () => {
    spy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    createConsoleObservability().log('warn', 'aviso a alguien@ejemplo.com');
    expect(JSON.stringify(spy.mock.calls[0])).not.toContain('alguien@ejemplo.com');
  });
});
