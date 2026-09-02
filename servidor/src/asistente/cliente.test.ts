import Anthropic from '@anthropic-ai/sdk';
import { describe, expect, it, vi } from 'vitest';

import { costoDe, crearClienteAsistente, explicacionDe, MODELO, motivoDeError } from './cliente';
import { cifrasDe, sinLaLineaDeCifras, SISTEMA } from './prompt';

/** Un SDK de mentira que recuerda con qué se le llamó. */
function sdkDoble(texto: string) {
  const create = vi.fn<(peticion: Record<string, unknown>) => Promise<unknown>>(() =>
    Promise.resolve({
      content: [{ type: 'text', text: texto }],
      usage: { input_tokens: 400, output_tokens: 120 },
    }),
  );
  return { sdk: { messages: { create } } as never, create };
}

const RESPUESTA = 'Te alcanza si mantienes el ritmo.\nCIFRAS: saldoTotal, tasaDeAhorroPct';

describe('clienteAsistente', () => {
  it('manda el modelo declarado y esfuerzo bajo', async () => {
    const { sdk, create } = sdkDoble(RESPUESTA);
    await crearClienteAsistente('x', sdk).preguntar({ saldoTotal: 1 }, '¿me alcanza?');

    const peticion = create.mock.calls[0]?.[0];
    expect(peticion?.['model']).toBe(MODELO);
    expect(peticion?.['output_config']).toEqual({ effort: 'low' });
  });

  /**
   * `budget_tokens` está eliminado en este modelo: mandarlo devuelve un 400.
   * Se comprobó contra la referencia de la API, no de memoria.
   */
  it('no manda budget_tokens', async () => {
    const { sdk, create } = sdkDoble(RESPUESTA);
    await crearClienteAsistente('x', sdk).preguntar({}, 'hola');

    expect(JSON.stringify(create.mock.calls[0]?.[0])).not.toContain('budget_tokens');
  });

  it('usa pensamiento adaptativo', async () => {
    const { sdk, create } = sdkDoble(RESPUESTA);
    await crearClienteAsistente('x', sdk).preguntar({}, 'hola');

    expect(create.mock.calls[0]?.[0]?.['thinking']).toEqual({
      type: 'adaptive',
    });
  });

  it('el prompt le prohíbe inventar cifras y le exige decir cuáles usó', () => {
    expect(SISTEMA).toMatch(/No inventes/i);
    expect(SISTEMA).toMatch(/CIFRAS:/);
    expect(SISTEMA).toMatch(/no lo sabes/i);
  });

  it('devuelve qué cifras dijo haber usado', async () => {
    const { sdk } = sdkDoble(RESPUESTA);

    const r = await crearClienteAsistente('x', sdk).preguntar({}, 'hola');
    expect(r.cifrasUsadas).toEqual(['saldoTotal', 'tasaDeAhorroPct']);
  });

  it('la línea de cifras no se enseña dentro de la respuesta', async () => {
    const { sdk } = sdkDoble(RESPUESTA);

    const r = await crearClienteAsistente('x', sdk).preguntar({}, 'hola');
    expect(r.respuesta).not.toMatch(/CIFRAS:/);
    expect(r.respuesta).toBe('Te alcanza si mantienes el ritmo.');
  });

  it('devuelve cuántos tokens costó, para poder enseñarlo', async () => {
    const { sdk } = sdkDoble(RESPUESTA);

    const r = await crearClienteAsistente('x', sdk).preguntar({}, 'hola');
    expect(r.tokens).toEqual({ entrada: 400, salida: 120 });
  });

  it('una respuesta sin línea de cifras no revienta', async () => {
    const { sdk } = sdkDoble('No lo sé con estas cifras.');

    const r = await crearClienteAsistente('x', sdk).preguntar({}, 'hola');
    expect(r.cifrasUsadas).toEqual([]);
    expect(r.respuesta).toBe('No lo sé con estas cifras.');
  });

  /** Los errores del SDK suben tal cual: nunca se comparan cadenas. */
  it('un error del SDK no se traga', async () => {
    const create = vi.fn<(peticion: Record<string, unknown>) => Promise<unknown>>(() =>
      Promise.reject(new Error('rate limited')),
    );
    const sdk = { messages: { create } } as never;

    await expect(crearClienteAsistente('x', sdk).preguntar({}, 'hola')).rejects.toThrow();
  });

  it('la clave no aparece en la petición que se serializa', async () => {
    const { sdk, create } = sdkDoble(RESPUESTA);
    await crearClienteAsistente('clave-secreta-de-prueba', sdk).preguntar({}, 'hola');

    expect(JSON.stringify(create.mock.calls[0]?.[0])).not.toContain('clave-secreta');
  });
});

describe('costoDe', () => {
  /** Es plata del usuario por una función accesoria: se cuenta y se enseña. */
  it('calcula el coste con los precios declarados', () => {
    expect(costoDe({ entrada: 1_000_000, salida: 0 })).toBeCloseTo(5, 5);
    expect(costoDe({ entrada: 0, salida: 1_000_000 })).toBeCloseTo(25, 5);
  });

  it('una consulta corta cuesta centavos', () => {
    expect(costoDe({ entrada: 500, salida: 200 })).toBeLessThan(0.01);
  });
});

describe('cifrasDe', () => {
  it('tolera espacios y mayúsculas alrededor', () => {
    expect(cifrasDe('texto\n  CIFRAS: a , b ')).toEqual(['a', 'b']);
  });

  it('sin la línea devuelve vacío', () => {
    expect(cifrasDe('solo texto')).toEqual([]);
  });
});

describe('sinLaLineaDeCifras', () => {
  it('quita solo esa línea', () => {
    expect(sinLaLineaDeCifras('uno\nCIFRAS: a\ndos')).toBe('uno\ndos');
  });
});

describe('motivoDeError', () => {
  /**
   * Nunca comparando cadenas: los mensajes de la API cambian sin avisar. El
   * SDK trae clases tipadas justo para esto.
   */
  it('distingue un error de tasa de uno de credenciales', () => {
    const tasa = new Anthropic.RateLimitError(429, undefined, 'demasiadas', new Headers());
    const clave = new Anthropic.AuthenticationError(401, undefined, 'clave', new Headers());

    expect(motivoDeError(tasa)).toBe('tasa');
    expect(motivoDeError(clave)).toBe('credenciales');
  });

  it('un 400 se distingue: es la petición, no la clave', () => {
    const mala = new Anthropic.BadRequestError(400, undefined, 'budget_tokens', new Headers());

    expect(motivoDeError(mala)).toBe('peticion');
  });

  it('lo que no es del SDK no se disfraza de nada', () => {
    expect(motivoDeError(new Error('se cayó la red'))).toBe('desconocido');
  });
});

describe('explicacionDe', () => {
  /**
   * Lo que se responde es una frase de una lista cerrada, nunca el error: un
   * mensaje de la API puede llevar la cabecera que se mandó, y ahí va la clave.
   */
  it('cada motivo dice qué hacer, y ninguno repite el error', () => {
    expect(explicacionDe('tasa')).toMatch(/minuto/i);
    expect(explicacionDe('credenciales')).toMatch(/clave/i);
    expect(explicacionDe('desconocido')).not.toBe('');
  });
});
