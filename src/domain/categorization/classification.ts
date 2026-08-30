import type { AccountId, OwnerId, TransactionId } from '@/domain/ledger/ids';

/**
 * Quién decidió la categoría de una transacción y con qué seguridad.
 *
 * - `manual`: el usuario. Confianza 100. Es lo único de lo que aprende el
 *   clasificador.
 * - `regla`: una regla del usuario (`reglaId`). También 100: la dictó él.
 * - `aprendida`: el clasificador, con la probabilidad que calculó.
 * - `catalogo`: la sugerencia del catálogo de marcas.
 */
export type ClassificationSource = 'manual' | 'regla' | 'aprendida' | 'catalogo';

export interface Classification {
  transactionId: TransactionId;
  owner: OwnerId;
  categoria: AccountId;
  origen: ClassificationSource;
  reglaId: string | null;
  /** Entero 0–100. */
  confianza: number;
  clasificadoEn: string;
}

export function createClassification(input: Classification): Classification {
  if (!Number.isInteger(input.confianza) || input.confianza < 0 || input.confianza > 100) {
    throw new Error(`La confianza va de 0 a 100 y llegó ${String(input.confianza)}`);
  }
  if ((input.origen === 'manual' || input.origen === 'regla') && input.confianza !== 100) {
    throw new Error('Lo que decide el usuario tiene confianza 100');
  }
  if (input.origen === 'regla' && input.reglaId === null) {
    throw new Error('Una clasificación por regla dice qué regla');
  }
  return { ...input };
}

export interface ClassificationRepository {
  save: (classification: Classification) => Promise<void>;
  findByTransaction: (id: TransactionId) => Promise<Classification | null>;
  listByOwner: (
    owner: OwnerId,
    filter?: { origen?: ClassificationSource },
  ) => Promise<Classification[]>;
  delete: (transactionId: TransactionId) => Promise<void>;
}
