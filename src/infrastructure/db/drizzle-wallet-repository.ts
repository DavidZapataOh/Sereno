import { eq } from 'drizzle-orm';

import type { Chain } from '@/domain/crypto/wallet';
import type { EstadoWallet, WalletRepository } from '@/domain/crypto/wallet-repository';
import { ownerId } from '@/domain/ledger/ids';

import type { Database } from './database';
import { wallets } from './schema';

function asPromise<T>(operacion: () => T): Promise<T> {
  try {
    return Promise.resolve(operacion());
  } catch (error) {
    return Promise.reject(error instanceof Error ? error : new Error(String(error)));
  }
}

const toWallet = (fila: typeof wallets.$inferSelect): EstadoWallet => ({
  id: fila.id,
  owner: ownerId(fila.ownerId),
  chain: fila.chain as Chain,
  direccion: fila.direccion,
  nombre: fila.nombre,
  leidoEn: fila.leidoEn,
  error: fila.error,
});

export function createDrizzleWalletRepository(db: Database): WalletRepository {
  return {
    guardar: (wallet) =>
      asPromise(() => {
        const fila = {
          id: wallet.id,
          ownerId: wallet.owner,
          chain: wallet.chain,
          direccion: wallet.direccion,
          nombre: wallet.nombre,
        };
        db.insert(wallets)
          .values(fila)
          .onConflictDoUpdate({
            target: wallets.id,
            // No se pisa `leidoEn` ni `error`: editar el nombre no borra la
            // constancia de la última lectura.
            set: { chain: fila.chain, direccion: fila.direccion, nombre: fila.nombre },
          })
          .run();
      }),

    listar: (owner) =>
      asPromise(() =>
        db.select().from(wallets).where(eq(wallets.ownerId, owner)).all().map(toWallet),
      ),

    borrar: (id) =>
      asPromise(() => {
        db.delete(wallets).where(eq(wallets.id, id)).run();
      }),

    marcarLectura: (id, leidoEn, error) =>
      asPromise(() => {
        db.update(wallets).set({ leidoEn, error }).where(eq(wallets.id, id)).run();
      }),
  };
}
