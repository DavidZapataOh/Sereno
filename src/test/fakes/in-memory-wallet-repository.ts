import type { EstadoWallet, WalletRepository } from '@/domain/crypto/wallet-repository';

export function createInMemoryWalletRepository(): WalletRepository {
  const guardadas = new Map<string, EstadoWallet>();
  return {
    guardar: (wallet) => {
      // No se pisa `leidoEn` ni `error`: editar el nombre no borra la
      // constancia de la última lectura. El adaptador de SQLite hace lo mismo.
      const previa = guardadas.get(wallet.id);
      guardadas.set(wallet.id, {
        ...wallet,
        leidoEn: previa?.leidoEn ?? null,
        error: previa?.error ?? null,
      });
      return Promise.resolve();
    },
    listar: (owner) =>
      Promise.resolve(
        [...guardadas.values()].filter((w) => w.owner === owner).map((w) => ({ ...w })),
      ),
    borrar: (id) => {
      guardadas.delete(id);
      return Promise.resolve();
    },
    marcarLectura: (id, leidoEn, error) => {
      const previa = guardadas.get(id);
      if (previa !== undefined) guardadas.set(id, { ...previa, leidoEn, error });
      return Promise.resolve();
    },
  };
}
