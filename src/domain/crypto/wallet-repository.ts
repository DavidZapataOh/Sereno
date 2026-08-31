import type { OwnerId } from '@/domain/ledger/ids';

import type { Wallet } from './wallet';

/** Estado de la última lectura de una wallet. */
export interface EstadoWallet extends Wallet {
  leidoEn: string | null;
  error: string | null;
}

export interface WalletRepository {
  guardar: (wallet: Wallet) => Promise<void>;
  listar: (owner: OwnerId) => Promise<EstadoWallet[]>;
  borrar: (id: string) => Promise<void>;
  /** Deja constancia de la última lectura: cuándo, y si falló. */
  marcarLectura: (id: string, leidoEn: string, error: string | null) => Promise<void>;
}
