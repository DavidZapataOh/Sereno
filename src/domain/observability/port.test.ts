import { createMemoryObservability } from './port';
import { REDACTED } from './redact';
import { mustExist } from '@/test/must-exist';

describe('createMemoryObservability', () => {
  it('registra el nivel y el mensaje', () => {
    const obs = createMemoryObservability();
    obs.log('info', 'sincronizacion completada');
    expect(obs.entries).toEqual([
      { level: 'info', message: 'sincronizacion completada', context: undefined },
    ]);
  });

  it('redacta el contexto antes de guardarlo', () => {
    const obs = createMemoryObservability();
    obs.log('info', 'cuenta actualizada', { saldo: 5000, fuente: 'nequi' });
    expect(mustExist(obs.entries[0]).context).toEqual({ saldo: REDACTED, fuente: 'nequi' });
  });

  it('redacta también el mensaje', () => {
    const obs = createMemoryObservability();
    obs.log('warn', 'fallo para alguien@ejemplo.com');
    expect(mustExist(obs.entries[0]).message).not.toContain('alguien@ejemplo.com');
  });

  it('captura errores con nivel error', () => {
    const obs = createMemoryObservability();
    obs.captureError(new Error('algo fallo'));
    expect(mustExist(obs.entries[0]).level).toBe('error');
    expect(mustExist(obs.entries[0]).message).toBe('algo fallo');
  });

  it('redacta el contexto de un error capturado', () => {
    const obs = createMemoryObservability();
    obs.captureError(new Error('fallo'), { token: 'abc123' });
    expect(mustExist(obs.entries[0]).context).toEqual({ token: REDACTED });
  });

  it('acumula en orden', () => {
    const obs = createMemoryObservability();
    obs.log('debug', 'uno');
    obs.log('info', 'dos');
    expect(obs.entries.map((e) => e.message)).toEqual(['uno', 'dos']);
  });
});
