import { redDe, type Wallet } from '@/domain/crypto/wallet';
import type { EstadoWallet, WalletRepository } from '@/domain/crypto/wallet-repository';
import type { IdGenerator, OwnerId } from '@/domain/ledger/ids';

export interface ManageWalletsDeps {
  wallets: WalletRepository;
  ids: IdGenerator;
}

/**
 * Añade una wallet a seguir.
 *
 * **La red se deduce de la dirección**, no se pregunta. Es una decisión que el
 * usuario no tiene por qué tomar, y en la que se puede equivocar sin
 * enterarse: una dirección buena en la red equivocada devuelve cero, y un cero
 * no se distingue de un saldo vacío.
 *
 * Solo la dirección **pública**. Si alguien pega aquí una clave privada, no
 * tiene forma de dirección de ninguna red y se rechaza: el error se ve en vez
 * de guardarse.
 */
export async function addWallet(
  deps: ManageWalletsDeps,
  input: { owner: OwnerId; direccion: string; nombre: string },
): Promise<Wallet> {
  const direccion = input.direccion.trim();
  const red = redDe(direccion);
  if (red === null) {
    throw new Error('Eso no tiene forma de dirección pública de ninguna red conocida');
  }
  const nombre = input.nombre.trim();
  if (nombre.length === 0) throw new Error('La wallet necesita un nombre');

  const wallet: Wallet = {
    id: `wallet:${red}:${deps.ids.next()}`,
    owner: input.owner,
    red,
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
