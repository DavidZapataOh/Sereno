import type { IngestRepository } from '@/domain/ingest/ingest-repository';
import type { TransferRepository } from '@/domain/ingest/transfer-repository';
import type { AccountRepository } from '@/domain/ledger/account-repository';
import type { IdGenerator } from '@/domain/ledger/ids';
import type { TransactionRepository } from '@/domain/ledger/transaction-repository';

export interface IngestDeps {
  accounts: AccountRepository;
  transactions: TransactionRepository;
  ingest: IngestRepository;
  transfers: TransferRepository;
  ids: IdGenerator;
  /** Ahora, en ISO. Inyectado para que las pruebas fijen el tiempo. */
  clock: () => string;
}

export interface IngestSummary {
  runId: string;
  capturas: number;
  extraidas: number;
  nuevas: number;
  /** Esta misma fuente ya las había traído: no se tocan. */
  duplicadas: number;
  /** Otra fuente ya las tenía: se sumaron como observación a esa transacción. */
  fusionadas: number;
  /** No se pudieron convertir (monto cero, fecha inexistente…). Nombradas en `motivosOmision`. */
  omitidas: number;
  /** Hasta cinco motivos, para diagnosticar sin volcar el lote entero. */
  motivosOmision: string[];
  /** Anteriores al día de inicio de la cuenta: no entran al ledger. */
  anteriores: number;
  /** Día (AAAA-MM-DD) desde el que Sereno cuenta esta fuente; null si el lote no venía de una fuente con inicio. */
  desde: string | null;
}
