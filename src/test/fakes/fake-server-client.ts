import type { ServerClient, ServerHealth, ServerMovement } from '@/domain/sync/server-client';

export interface FakeServerClient extends ServerClient {
  confirmados: () => number[];
  responderSalud: (salud: ServerHealth) => void;
  limitarPaginaA: (n: number) => void;
  fallarTraida: () => void;
  fallarConfirmacion: () => void;
  dejarDeFallar: () => void;
}

export function createFakeServerClient(movimientos: readonly ServerMovement[]): FakeServerClient {
  const confirmados: number[] = [];
  let tamano = Number.POSITIVE_INFINITY;
  let fallaTraida = false;
  let fallaConfirmacion = false;
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
  };
}
