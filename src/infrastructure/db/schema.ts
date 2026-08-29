import { index, sqliteTable, text } from 'drizzle-orm/sqlite-core';

/**
 * Cuentas del ledger.
 *
 * `ownerId` está desde el primer día aunque hoy haya un solo usuario: añadirlo
 * después obligaría a una migración de datos sobre un historial financiero
 * completo, que es exactamente el tipo de migración que sale cara.
 */
export const accounts = sqliteTable(
  'accounts',
  {
    id: text('id').primaryKey(),
    ownerId: text('owner_id').notNull(),
    kind: text('kind', {
      enum: ['activo', 'pasivo', 'ingreso', 'gasto', 'patrimonio'],
    }).notNull(),
    nombre: text('nombre').notNull(),
    currency: text('currency').notNull(),
    archivedAt: text('archived_at'),
  },
  (tabla) => [index('idx_accounts_owner').on(tabla.ownerId)],
);

export const transactions = sqliteTable(
  'transactions',
  {
    id: text('id').primaryKey(),
    ownerId: text('owner_id').notNull(),
    /** ISO 8601 con zona. Se guarda como texto para poder ordenar por él. */
    fecha: text('fecha').notNull(),
    descripcion: text('descripcion').notNull(),
    fuente: text('fuente').notNull(),
    referencia: text('referencia'),
  },
  (tabla) => [
    // Sostiene el listado paginado: se ordena por fecha descendente dentro de un
    // propietario, y `id` desempata para que el cursor no salte ni repita
    // filas cuando dos transacciones comparten fecha.
    index('idx_transactions_owner_fecha').on(tabla.ownerId, tabla.fecha, tabla.id),
    // Sostiene la deduplicación. Sin él, `existsByOrigin` escanea la tabla
    // entera en cada movimiento importado, que es justo la operación que más
    // veces se repite durante una sincronización.
    index('idx_transactions_origen').on(tabla.ownerId, tabla.fuente, tabla.referencia),
  ],
);

/**
 * Apuntes.
 *
 * `amount` es TEXT, no INTEGER. SQLite usa enteros de 64 bits, que dan hasta
 * unos 9×10^18; un solo ether son 10^18 unidades mínimas, así que tres ether ya
 * desbordan. Como texto cabe cualquier escala, y la conversión a `bigint` ocurre
 * en el repositorio.
 */
export const postings = sqliteTable(
  'postings',
  {
    id: text('id').primaryKey(),
    transactionId: text('transaction_id')
      .notNull()
      .references(() => transactions.id, { onDelete: 'cascade' }),
    accountId: text('account_id')
      .notNull()
      .references(() => accounts.id),
    amount: text('amount').notNull(),
    currency: text('currency').notNull(),
    nota: text('nota'),
  },
  (tabla) => [
    index('idx_postings_account').on(tabla.accountId),
    index('idx_postings_transaction').on(tabla.transactionId),
  ],
);
