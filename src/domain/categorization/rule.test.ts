import { assert, boolean, property } from 'fast-check';

import { ownerId, type AccountId } from '@/domain/ledger/ids';

import { createRule, pickRule, ruleMatches, specificityOf, type Rule } from './rule';
import { categoryAccountId } from './taxonomy';

const owner = ownerId('david');
const regla = (extra: Partial<Rule>): Rule =>
  createRule({
    id: extra.id ?? 'r1',
    owner,
    campo: 'comercio',
    operador: 'contiene',
    valor: 'exito',
    categoria: categoryAccountId('mercado'),
    creadaEn: '2026-08-30T10:00:00.000-05:00',
    activa: true,
    ...extra,
  });
const hechos = { comercio: 'exito', descripcion: 'exito sur' };

describe('createRule', () => {
  it('normaliza el valor como las descripciones: minúsculas, sin acentos', () => {
    expect(regla({ valor: '  Éxito ' }).valor).toBe('exito');
  });

  it('rechaza valor vacío y categoría que no lo es', () => {
    expect(() => regla({ valor: '   ' })).toThrow(/valor/);
    expect(() => regla({ categoria: 'bancolombia:ahorros' as AccountId })).toThrow(/categoría/);
  });
});

describe('ruleMatches', () => {
  it('es / empieza / contiene sobre el campo elegido', () => {
    expect(ruleMatches(regla({ operador: 'es', valor: 'exito' }), hechos)).toBe(true);
    expect(ruleMatches(regla({ operador: 'es', valor: 'exi' }), hechos)).toBe(false);
    expect(ruleMatches(regla({ operador: 'empieza', valor: 'exi' }), hechos)).toBe(true);
    expect(
      ruleMatches(regla({ campo: 'descripcion', operador: 'contiene', valor: 'sur' }), hechos),
    ).toBe(true);
    expect(
      ruleMatches(regla({ campo: 'comercio', operador: 'contiene', valor: 'sur' }), hechos),
    ).toBe(false);
  });

  it('«contiene» es por palabra entera: «ara» no coincide con «carulla»', () => {
    expect(
      ruleMatches(regla({ valor: 'ara' }), { comercio: 'carulla', descripcion: 'carulla' }),
    ).toBe(false);
    expect(ruleMatches(regla({ valor: 'ara' }), { comercio: 'ara', descripcion: 'ara' })).toBe(
      true,
    );
  });

  it('una regla inactiva nunca coincide', () => {
    expect(ruleMatches(regla({ activa: false }), hechos)).toBe(false);
  });
});

describe('pickRule', () => {
  it('la más específica gana: es > empieza > contiene; más largo gana', () => {
    const contiene = regla({ id: 'a', operador: 'contiene', valor: 'exito' });
    const es = regla({
      id: 'b',
      operador: 'es',
      valor: 'exito',
      categoria: categoryAccountId('hogar'),
    });
    expect(pickRule([contiene, es], hechos)?.id).toBe('b');
    expect(specificityOf(es)).toBeGreaterThan(specificityOf(contiene));

    const corta = regla({ id: 'c', campo: 'descripcion', valor: 'exito' });
    const larga = regla({ id: 'd', campo: 'descripcion', valor: 'exito sur' });
    expect(pickRule([corta, larga], hechos)?.id).toBe('d');
  });

  it('a igual especificidad gana la más reciente', () => {
    const vieja = regla({ id: 'a', creadaEn: '2026-08-01T00:00:00.000Z' });
    const nueva = regla({
      id: 'b',
      creadaEn: '2026-08-30T00:00:00.000Z',
      categoria: categoryAccountId('hogar'),
    });
    expect(pickRule([vieja, nueva], hechos)?.id).toBe('b');
  });

  it('sin coincidencias, null', () => {
    expect(pickRule([regla({ valor: 'carulla' })], hechos)).toBeNull();
  });

  it('propiedad: el orden de la lista no cambia la elección', () => {
    const reglas = [
      regla({ id: 'a', operador: 'contiene', valor: 'exito' }),
      regla({ id: 'b', operador: 'empieza', valor: 'exi' }),
      regla({ id: 'c', campo: 'descripcion', valor: 'sur' }),
    ];
    assert(
      property(boolean(), (invertir) => {
        const barajadas = invertir ? [...reglas].reverse() : [...reglas];
        return pickRule(barajadas, hechos)?.id === pickRule(reglas, hechos)?.id;
      }),
    );
  });
});
