import { CAPTURE_PROTOCOL_VERSION, MAX_FRAGMENT_BYTES } from '@/domain/capture/protocol';
import { SENSITIVE_PATTERNS } from '@/domain/capture/sensitive-routes';

/**
 * Serializa los patrones del dominio como literales de expresión regular.
 *
 * Esto es lo que impide que la lista del script diverja de la del dominio.
 * Reescribirlos a mano sería un fallo de seguridad esperando a ocurrir: alguien
 * añade un patrón en `sensitive-routes.ts`, olvida el script, y a partir de ahí
 * se captura lo que se creía excluido.
 */
function serializePatterns(): string {
  return SENSITIVE_PATTERNS.map((pattern) => `/${pattern.source}/${pattern.flags}`).join(', ');
}

/**
 * Genera el JavaScript que se inyecta antes de cargar el contenido del portal.
 *
 * Reglas que este script cumple y que no se relajan:
 *   - Solo lee cuerpos de RESPUESTA. Nunca de petición.
 *   - Excluye toda URL con patrones de autenticación.
 *   - Solo captura contenido JSON.
 *   - No toca el DOM ni los formularios.
 *   - Ante cualquier error propio, calla y deja pasar: la página del banco debe
 *     funcionar exactamente igual con el script que sin él.
 */
export function buildInjectedScript(): string {
  return `
(function () {
  if (window.__serenoInstalled) return;
  window.__serenoInstalled = true;

  var VERSION = ${String(CAPTURE_PROTOCOL_VERSION)};
  var MAX = ${String(MAX_FRAGMENT_BYTES)};
  var SENSITIVE = [${serializePatterns()}];
  var MAX_DECODE_PASSES = 3;

  function fullyDecode(url) {
    var current = String(url || '');
    for (var pass = 0; pass < MAX_DECODE_PASSES; pass++) {
      var decoded;
      try { decoded = decodeURIComponent(current); } catch (e) { return current; }
      if (decoded === current) return current;
      current = decoded;
    }
    return current;
  }

  function isSensitive(url) {
    var candidate = fullyDecode(url);
    for (var i = 0; i < SENSITIVE.length; i++) {
      if (SENSITIVE[i].test(candidate)) return true;
    }
    return false;
  }

  function shouldCapture(url, contentType) {
    if (!url) return false;
    if (isSensitive(url)) return false;
    return /\\bjson\\b/i.test(contentType || '');
  }

  function post(payload) {
    try {
      if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
        window.ReactNativeWebView.postMessage(JSON.stringify(payload));
      }
    } catch (e) {}
  }

  function newId() {
    return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
  }

  function emit(meta, text) {
    var content = typeof text === 'string' ? text : '';
    var total = Math.max(1, Math.ceil(content.length / MAX));
    post({
      type: 'sereno:meta',
      v: VERSION,
      id: meta.id,
      url: meta.url,
      method: meta.method,
      status: meta.status,
      contentType: meta.contentType,
      kind: meta.kind,
      capturedAt: new Date().toISOString(),
      totalFragments: total
    });
    for (var seq = 0; seq < total; seq++) {
      post({
        type: 'sereno:fragment',
        v: VERSION,
        id: meta.id,
        seq: seq,
        data: content.slice(seq * MAX, (seq + 1) * MAX)
      });
    }
  }

  var originalFetch = window.fetch;
  if (typeof originalFetch === 'function') {
    window.fetch = function (input, init) {
      var method = (init && init.method) || 'GET';
      var requested = typeof input === 'string' ? input : (input && input.url) || '';
      return originalFetch.apply(this, arguments).then(function (response) {
        try {
          var url = response.url || requested;
          var contentType = (response.headers && response.headers.get('content-type')) || '';
          if (shouldCapture(url, contentType)) {
            response.clone().text().then(function (text) {
              emit({
                id: newId(),
                url: url,
                method: method,
                status: response.status,
                contentType: contentType,
                kind: 'fetch'
              }, text);
            })['catch'](function () {});
          }
        } catch (e) {}
        return response;
      });
    };
  }

  var proto = XMLHttpRequest.prototype;
  var originalOpen = proto.open;
  var originalSend = proto.send;

  proto.open = function (method, url) {
    this.__sereno = { method: method, url: url };
    return originalOpen.apply(this, arguments);
  };

  proto.send = function () {
    var self = this;
    try {
      self.addEventListener('load', function () {
        try {
          var info = self.__sereno || {};
          var contentType = self.getResponseHeader
            ? self.getResponseHeader('content-type') || ''
            : '';
          if (shouldCapture(info.url || '', contentType)) {
            emit({
              id: newId(),
              url: info.url || '',
              method: info.method || 'GET',
              status: self.status,
              contentType: contentType,
              kind: 'xhr'
            }, self.responseText);
          }
        } catch (e) {}
      });
    } catch (e) {}
    return originalSend.apply(this, arguments);
  };
})();
true;
`;
}
