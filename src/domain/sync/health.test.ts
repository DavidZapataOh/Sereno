import { estadoDeIngesta } from './health';

const now = '2026-08-30T18:00:00.000-05:00';
const hace = (minutos: number): string =>
  new Date(Date.parse(now) - minutos * 60_000).toISOString();

describe('estadoDeIngesta', () => {
  it('sin ninguna corrida todavía, lo dice en vez de dar por buena la nada', () => {
    expect(estadoDeIngesta(null, now)).toBe('nunca');
  });

  it('recién corrida, está al día', () => {
    expect(estadoDeIngesta({ terminadoEn: hace(5), error: null }, now)).toBe('al-dia');
  });

  it('si la última corrida falló, se dice aunque sea reciente', () => {
    expect(estadoDeIngesta({ terminadoEn: hace(5), error: 'IMAP caído' }, now)).toBe('con-error');
  });

  it('pasado el triple del intervalo va atrasada; pasadas seis horas, detenida', () => {
    expect(estadoDeIngesta({ terminadoEn: hace(45), error: null }, now)).toBe('atrasada');
    expect(estadoDeIngesta({ terminadoEn: hace(7 * 60), error: null }, now)).toBe('detenida');
  });

  it('el umbral de «atrasada» sigue al intervalo configurado', () => {
    const media = { terminadoEn: hace(45), error: null };
    expect(estadoDeIngesta(media, now, { intervaloMinutos: 30 })).toBe('al-dia');
    expect(estadoDeIngesta(media, now, { intervaloMinutos: 5 })).toBe('atrasada');
  });

  it('una corrida abierta hace mucho también cuenta como detenida', () => {
    // `terminadoEn` nulo y hace horas: el proceso murió a mitad de pasada.
    expect(
      estadoDeIngesta({ terminadoEn: null, error: null }, now, { iniciadoEn: hace(8 * 60) }),
    ).toBe('detenida');
  });

  it('una corrida abierta hace un momento es normal: está corriendo ahora', () => {
    expect(estadoDeIngesta({ terminadoEn: null, error: null }, now, { iniciadoEn: hace(1) })).toBe(
      'al-dia',
    );
  });
});
