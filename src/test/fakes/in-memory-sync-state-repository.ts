import type { SyncStateRepository } from '@/domain/sync/server-client';

export function createInMemorySyncStateRepository(): SyncStateRepository {
  let cursor = 0;
  let ultima: string | null = null;
  let inicioCorreo: string | null = null;
  return {
    leerCursor: () => Promise.resolve(cursor),
    escribirCursor: (valor) => {
      cursor = valor;
      return Promise.resolve();
    },
    ultimaTraida: () => Promise.resolve(ultima),
    marcarTraida: (iso) => {
      ultima = iso;
      return Promise.resolve();
    },
    leerInicioCorreo: () => Promise.resolve(inicioCorreo),
    escribirInicioCorreo: (dia) => {
      inicioCorreo = dia;
      return Promise.resolve();
    },
  };
}
