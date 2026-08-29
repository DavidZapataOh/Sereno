import { buildInjectedScript } from './injected-script';
import { FakeResponse, FakeXHR, flush, installScript } from './webview-harness';
import { SENSITIVE_PATTERNS } from '@/domain/capture/sensitive-routes';
import { mustExist } from '@/test/must-exist';

const URL_DATOS = 'https://banco.example/api/movimientos';

describe('buildInjectedScript — forma del script', () => {
  it('termina en true, para no emitir advertencias en la WebView', () => {
    expect(buildInjectedScript().trimEnd().endsWith('true;')).toBe(true);
  });

  it('incluye TODOS los patrones sensibles del dominio', () => {
    const script = buildInjectedScript();
    SENSITIVE_PATTERNS.forEach((pattern) => {
      expect(script).toContain(pattern.source);
    });
  });

  it('no lee cuerpos de petición en ninguna forma', () => {
    const script = buildInjectedScript();
    expect(script).not.toMatch(/init\.body/);
    expect(script).not.toMatch(/requestBody/);
  });

  it('no toca el DOM', () => {
    const script = buildInjectedScript();
    expect(script).not.toMatch(/document\.querySelector/);
    expect(script).not.toMatch(/document\.forms/);
    expect(script).not.toMatch(/addEventListener\(\s*['"]submit/);
  });
});

describe('script inyectado — fetch', () => {
  it('captura una respuesta JSON de una ruta de datos', async () => {
    const { win, captures } = installScript(
      buildInjectedScript(),
      new FakeResponse(URL_DATOS, 200, 'application/json', '{"a":1}'),
    );
    await win.fetch(URL_DATOS);
    await flush();

    expect(captures).toHaveLength(1);
    expect(mustExist(captures[0]).body).toBe('{"a":1}');
    expect(mustExist(captures[0]).url).toBe(URL_DATOS);
    expect(mustExist(captures[0]).kind).toBe('fetch');
    expect(mustExist(captures[0]).status).toBe(200);
  });

  it('NO captura una ruta de autenticación', async () => {
    const url = 'https://banco.example/api/auth/login';
    const { win, captures } = installScript(
      buildInjectedScript(),
      new FakeResponse(url, 200, 'application/json', '{"token":"secreto"}'),
    );
    await win.fetch(url);
    await flush();
    expect(captures).toHaveLength(0);
  });

  it('NO captura una ruta de autenticación en español', async () => {
    const url = 'https://banco.example/api/autenticacion';
    const { win, captures } = installScript(
      buildInjectedScript(),
      new FakeResponse(url, 200, 'application/json', '{"jwt":"secreto"}'),
    );
    await win.fetch(url);
    await flush();
    expect(captures).toHaveLength(0);
  });

  it('NO captura contenido que no sea JSON', async () => {
    const { win, captures } = installScript(
      buildInjectedScript(),
      new FakeResponse(URL_DATOS, 200, 'text/html', '<html></html>'),
    );
    await win.fetch(URL_DATOS);
    await flush();
    expect(captures).toHaveLength(0);
  });

  it('devuelve intacta la respuesta a quien la pidió', async () => {
    const { win } = installScript(
      buildInjectedScript(),
      new FakeResponse(URL_DATOS, 200, 'application/json', '{"a":1}'),
    );
    const response = await win.fetch(URL_DATOS);
    expect(await response.text()).toBe('{"a":1}');
  });

  it('fragmenta cuerpos grandes y los reensambla íntegros', async () => {
    const grande = 'z'.repeat(200 * 1024);
    const { win, captures } = installScript(
      buildInjectedScript(),
      new FakeResponse(URL_DATOS, 200, 'application/json', grande),
    );
    await win.fetch(URL_DATOS);
    await flush();
    expect(mustExist(captures[0]).body).toBe(grande);
  });

  it('instalarlo dos veces no duplica capturas', async () => {
    const script = buildInjectedScript();
    const { win, captures } = installScript(
      script,
      new FakeResponse(URL_DATOS, 200, 'application/json', '{"a":1}'),
    );
    // eslint-disable-next-line @typescript-eslint/no-implied-eval -- reinstalación deliberada
    new Function('window', 'XMLHttpRequest', script).call(win, win, win.XMLHttpRequest);
    await win.fetch(URL_DATOS);
    await flush();
    expect(captures).toHaveLength(1);
  });
});

describe('script inyectado — XMLHttpRequest', () => {
  function instalar() {
    return installScript(buildInjectedScript(), new FakeResponse('', 200, '', ''));
  }

  it('captura una respuesta JSON', async () => {
    const { win, captures } = instalar();
    const xhr = new win.XMLHttpRequest();
    xhr.open('GET', 'https://banco.example/api/saldo');
    xhr.send();
    xhr.simulateLoad('application/json', '{"saldo":5000}');
    await flush();

    expect(captures).toHaveLength(1);
    expect(mustExist(captures[0]).body).toBe('{"saldo":5000}');
    expect(mustExist(captures[0]).kind).toBe('xhr');
    expect(mustExist(captures[0]).method).toBe('GET');
  });

  it('NO captura una ruta de autenticación', async () => {
    const { win, captures } = instalar();
    const xhr = new win.XMLHttpRequest();
    xhr.open('POST', 'https://banco.example/api/session/start');
    xhr.send();
    xhr.simulateLoad('application/json', '{"jwt":"secreto"}');
    await flush();
    expect(captures).toHaveLength(0);
  });

  it('no interfiere si la respuesta no es JSON', async () => {
    const { win, captures } = instalar();
    const xhr = new win.XMLHttpRequest();
    xhr.open('GET', 'https://banco.example/api/logo');
    xhr.send();
    xhr.simulateLoad('image/png', 'binario');
    await flush();
    expect(captures).toHaveLength(0);
  });
});

describe('script inyectado — robustez', () => {
  it('no rompe la página si el puente no existe', async () => {
    const script = buildInjectedScript();
    const response = new FakeResponse(URL_DATOS, 200, 'application/json', '{"a":1}');
    const win = {
      fetch: () => Promise.resolve(response),
      XMLHttpRequest: FakeXHR,
    };

    // eslint-disable-next-line @typescript-eslint/no-implied-eval -- ejecución del script bajo prueba
    new Function('window', 'XMLHttpRequest', script).call(win, win, win.XMLHttpRequest);
    await expect(win.fetch()).resolves.toBeDefined();
  });

  it('propaga el rechazo de fetch sin alterarlo', async () => {
    const script = buildInjectedScript();
    const fallo = new Error('sin red');
    const win = {
      ReactNativeWebView: { postMessage: () => undefined },
      fetch: () => Promise.reject(fallo),
      XMLHttpRequest: FakeXHR,
    } as unknown as { fetch: () => Promise<FakeResponse>; XMLHttpRequest: typeof FakeXHR };

    // eslint-disable-next-line @typescript-eslint/no-implied-eval -- ejecución del script bajo prueba
    new Function('window', 'XMLHttpRequest', script).call(win, win, win.XMLHttpRequest);
    await expect(win.fetch()).rejects.toThrow('sin red');
  });
});

describe('script inyectado — filtro de dominios del banco', () => {
  const SCRIPT = buildInjectedScript(['banco.example']);

  it('captura del dominio del banco', async () => {
    const url = 'https://banco.example/api/movimientos';
    const { win, captures } = installScript(
      SCRIPT,
      new FakeResponse(url, 200, 'application/json', '{"a":1}'),
    );
    await win.fetch(url);
    await flush();
    expect(captures).toHaveLength(1);
  });

  it('captura de un subdominio del banco', async () => {
    const url = 'https://transacciones.banco.example/api/saldo';
    const { win, captures } = installScript(
      SCRIPT,
      new FakeResponse(url, 200, 'application/json', '{"a":1}'),
    );
    await win.fetch(url);
    await flush();
    expect(captures).toHaveLength(1);
  });

  it('NO captura rastreadores de terceros incrustados en la página', async () => {
    const url = 'https://analytics.medallia.com/api/web/events';
    const { win, captures } = installScript(
      SCRIPT,
      new FakeResponse(url, 200, 'application/json', '{"evento":1}'),
    );
    await win.fetch(url);
    await flush();
    expect(captures).toHaveLength(0);
  });

  it('sin dominios declarados no filtra: mantiene el comportamiento anterior', async () => {
    const url = 'https://cualquiera.example/api/x';
    const { win, captures } = installScript(
      buildInjectedScript(),
      new FakeResponse(url, 200, 'application/json', '{"a":1}'),
    );
    await win.fetch(url);
    await flush();
    expect(captures).toHaveLength(1);
  });
});

describe('script inyectado — rutas relativas', () => {
  it('captura una ruta relativa: pertenece al origen del banco', async () => {
    // Caso observado en campo: Nequi emite /bdigital/rest/services/... sin host.
    const url = '/bdigital/rest/services/private/MovimientosService/consultar';
    const { win, captures } = installScript(
      buildInjectedScript(['nequi.com']),
      new FakeResponse(url, 200, 'application/json', '{"a":1}'),
    );
    await win.fetch(url);
    await flush();
    expect(captures).toHaveLength(1);
  });
});
