import { esDireccionValida, type Chain, type Wallet } from '@/domain/crypto/wallet';
import type { EstadoWallet, WalletRepository } from '@/domain/crypto/wallet-repository';
import type { IdGenerator, OwnerId } from '@/domain/ledger/ids';

export interface ManageWalletsDeps {
  wallets: WalletRepository;
  ids: IdGenerator;
}

/**
 * Añade una wallet a seguir.
 *
 * Solo la dirección **pública**. Si alguien pega aquí una clave privada, la
 * validación de forma la rechaza —no tiene forma de dirección— y así el error
 * se ve en vez de guardarse.
 */
export async function addWallet(
  deps: ManageWalletsDeps,
  input: { owner: OwnerId; chain: Chain; direccion: string; nombre: string },
): Promise<Wallet> {
  const direccion = input.direccion.trim();
  if (!esDireccionValida(input.chain, direccion)) {
    // Una dirección de otra cadena devuelve cero, y un cero no se distingue
    // de no tener nada: por eso se valida por cadena y no «que parezca una».
    throw new Error(`Esa dirección no tiene la forma de una de ${input.chain}`);
  }
  const nombre = input.nombre.trim();
  if (nombre.length === 0) throw new Error('La wallet necesita un nombre');

  const wallet: Wallet = {
    id: `wallet:${input.chain}:${deps.ids.next()}`,
    owner: input.owner,
    chain: input.chain,
    direccion,
    nombre,
  };
  await deps.wallets.guardar(wallet);
  return wallet;
}

export function listWallets(deps: ManageWalletsDeps, owner: OwnerId): Promise<EstadoWallet[]> {
  return deps.wallets.listar(owner);
}

export function removeWallet(deps: ManageWalletsDeps, id: string): Promise<void> {
  return deps.wallets.borrar(id);
}
