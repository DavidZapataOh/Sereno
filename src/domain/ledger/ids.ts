/**
 * Identificadores marcados.
 *
 * Sin esto, `AccountId` y `TransactionId` son ambos `string` y el compilador
 * acepta pasar uno donde va el otro. En un ledger, confundir el identificador de
 * una cuenta con el de una transacción produce apuntes huérfanos.
 */
declare const marca: unique symbol;
type Marcado<T extends string> = string & { readonly [marca]: T };

export type AccountId = Marcado<'AccountId'>;
export type TransactionId = Marcado<'TransactionId'>;
export type OwnerId = Marcado<'OwnerId'>;

function requerirNoVacio(valor: string, tipo: string): void {
  if (valor.trim().length === 0) throw new Error(`${tipo} no puede estar vacío`);
}

export function accountId(valor: string): AccountId {
  requerirNoVacio(valor, 'AccountId');
  return valor as AccountId;
}

export function transactionId(valor: string): TransactionId {
  requerirNoVacio(valor, 'TransactionId');
  return valor as TransactionId;
}

export function ownerId(valor: string): OwnerId {
  requerirNoVacio(valor, 'OwnerId');
  return valor as OwnerId;
}
