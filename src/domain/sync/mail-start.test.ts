import { corteMasTarde, mailStartDay } from './mail-start';

describe('mailStartDay', () => {
  it('sin nada guardado, el corte es hoy: el correo empieza a contar ahora', () => {
    expect(mailStartDay(null, '2026-08-30T19:00:00.000-05:00')).toBe('2026-08-30');
  });

  it('una vez fijado no se mueve, aunque pasen días', () => {
    expect(mailStartDay('2026-08-30', '2026-09-15T10:00:00.000-05:00')).toBe('2026-08-30');
  });
});

describe('corteMasTarde', () => {
  it('se queda con el más tarde de los dos', () => {
    expect(corteMasTarde('2026-08-30', '2026-08-28')).toBe('2026-08-30');
    expect(corteMasTarde('2026-08-25', '2026-08-28')).toBe('2026-08-28');
  });

  it('con cortes iguales devuelve ese', () => {
    expect(corteMasTarde('2026-08-30', '2026-08-30')).toBe('2026-08-30');
  });
});
