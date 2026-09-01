import type {
  AssistantAnswer,
  AssistantStatus,
  ExchangeBalance,
  ServerClient,
  ServerHealth,
  ServerMovement,
} from '@/domain/sync/server-client';

export interface FakeServerClient extends ServerClient {
  confirmados: () => number[];
  responderSalud: (salud: ServerHealth) => void;
  limitarPaginaA: (n: number) => void;
  fallarTraida: () => void;
  fallarConfirmacion: () => void;
  dejarDeFallar: () => void;
  responderSaldos: (saldos: ExchangeBalance[]) => void;
  fallarSaldos: () => void;
  sinBinance: () => void;
  /** Qué responde el asistente, y qué se le preguntó. */
  responderAsistente: (respuesta: AssistantAnswer) => void;
  asistenteResponde: (estado: AssistantStatus) => void;
  preguntado: () => { resumen: unknown; pregunta: string }[];
}

export function createFakeServerClient(movimientos: readonly ServerMovement[]): FakeServerClient {
  const confirmados: number[] = [];
  let tamano = Number.POSITIVE_INFINITY;
  let fallaTraida = false;
  let fallaConfirmacion = false;
  let saldos: ExchangeBalance[] = [];
  let fallaSaldos = false;
  let sinConfigurar = false;
  const preguntado: { resumen: unknown; pregunta: string }[] = [];
  let asistente: AssistantStatus = {
    estado: 'ok',
    respuesta: {
      respuesta: 'Con lo que tienes, no.',
      cifrasUsadas: ['saldoTotal'],
      tokens: { entrada: 400, salida: 120 },
      costoUsd: 0.005,
    },
  };
  let salud: ServerHealth = {
    estado: 'vivo',
    movimientosPendientes: 0,
    enRevision: 0,
    ultimaCorrida: null,
  };

  return {
    confirmados: () => [...confirmados],
    responderSalud: (nueva) => {
      salud = nueva;
    },
    limitarPaginaA: (n) => {
      tamano = n;
    },
    fallarTraida: () => {
      fallaTraida = true;
    },
    fallarConfirmacion: () => {
      fallaConfirmacion = true;
    },
    responderSaldos: (nuevos) => {
      saldos = nuevos;
    },
    fallarSaldos: () => {
      fallaSaldos = true;
    },
    sinBinance: () => {
      sinConfigurar = true;
    },
    responderAsistente: (respuesta) => {
      asistente = { estado: 'ok', respuesta };
    },
    asistenteResponde: (estado) => {
      asistente = estado;
    },
    preguntado: () => [...preguntado],
    dejarDeFallar: () => {
      fallaTraida = false;
      fallaConfirmacion = false;
    },
    traer: (desde, limite) => {
      if (fallaTraida) return Promise.reject(new Error('sin conexión'));
      const posteriores = movimientos.filter((m) => m.secuencia > desde);
      const pagina = posteriores.slice(0, Math.min(limite, tamano));
      return Promise.resolve({
        movimientos: [...pagina],
        cursor: pagina.at(-1)?.secuencia ?? desde,
        hayMas: posteriores.length > pagina.length,
      });
    },
    confirmar: (cursor) => {
      if (fallaConfirmacion) return Promise.reject(new Error('sin conexión'));
      confirmados.push(cursor);
      return Promise.resolve();
    },
    salud: () => (fallaTraida ? Promise.reject(new Error('sin conexión')) : Promise.resolve(salud)),
    saldos: () => {
      if (sinConfigurar) return Promise.resolve({ estado: 'sin-configurar' as const });
      if (fallaSaldos) return Promise.resolve({ estado: 'error' as const, motivo: 'sin conexión' });
      return Promise.resolve({ estado: 'ok' as const, saldos: [...saldos] });
    },
    preguntar: (resumen, pregunta) => {
      preguntado.push({ resumen, pregunta });
      return Promise.resolve(asistente);
    },
  };
}
