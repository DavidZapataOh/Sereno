import { createHttpServerClient, createSinServidor } from './http-server-client';

const config = { url: 'https://servidor.example.com/', token: 'secreto' };
const pagina = {
  movimientos: [
    {
      id: 'bancolombia:A',
      secuencia: 1,
      fecha: '2026-08-30T10:00:00.000-05:00',
      descripcion: 'COMPRA',
      monto: 45000,
      moneda: 'COP',
      tipo: 'debito',
      fuente: 'bancolombia',
      referencia: 'A',
    },
  ],
  cursor: 1,
  hayMas: false,
};

describe('createHttpServerClient', () => {
  const original = global.fetch;
  afterEach(() => {
    global.fetch = original;
  });

  const responder = (cuerpo: unknown, ok = true, status = 200) => {
    const espia = jest.fn().mockResolvedValue({ ok, status, json: () => Promise.resolve(cuerpo) });
    global.fetch = espia as typeof fetch;
    return espia;
  };

  it('pide la página con el cursor, el límite y el token', async () => {
    const espia = responder(pagina);
    const cliente = createHttpServerClient(config);

    expect(await cliente.traer(3, 50)).toEqual(pagina);
    const [url, opciones] = espia.mock.calls[0] as [string, { headers: Record<string, string> }];
    // La barra final de la URL no se duplica.
    expect(url).toBe('https://servidor.example.com/movimientos?desde=3&limite=50');
    expect(opciones.headers['authorization']).toBe('Bearer secreto');
  });

  it('una respuesta con otra forma es un error, no un undefined que viaja al ledger', async () => {
    responder({ movimientos: [{ id: 'x' }], cursor: 1, hayMas: false });
    await expect(createHttpServerClient(config).traer(0, 10)).rejects.toThrow();
  });

  it('un código de error del servidor se dice con su número', async () => {
    responder({}, false, 503);
    await expect(createHttpServerClient(config).traer(0, 10)).rejects.toThrow(/503/);
  });

  it('confirmar manda el cursor y falla ruidosamente si el servidor no acepta', async () => {
    const espia = responder({ confirmados: true });
    await createHttpServerClient(config).confirmar(7);
    const [, opciones] = espia.mock.calls[0] as [string, { body: string }];
    expect(JSON.parse(opciones.body)).toEqual({ cursor: 7 });

    responder({}, false, 401);
    await expect(createHttpServerClient(config).confirmar(7)).rejects.toThrow(/401/);
  });
});

describe('createSinServidor', () => {
  it('dice que no hay servidor en vez de fingir que trajo cero', async () => {
    // Fingir «cero movimientos» dejaría a la app diciendo que está al día
    // cuando en realidad no ha preguntado.
    await expect(createSinServidor().traer(0, 10)).rejects.toThrow(/Sin servidor/);
  });
});
