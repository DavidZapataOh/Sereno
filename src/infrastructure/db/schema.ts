import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

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

/**
 * Detalle de las cuentas que son categorías (ADR 0005). Clave: la cuenta.
 * Nombre, naturaleza y archivado viven en `accounts`; aquí solo lo que una
 * cuenta genérica no tiene.
 */
export const categories = sqliteTable(
  'categories',
  {
    accountId: text('account_id')
      .primaryKey()
      .references(() => accounts.id),
    ownerId: text('owner_id').notNull(),
    grupo: text('grupo').notNull(),
    icono: text('icono').notNull(),
    orden: integer('orden').notNull().default(0),
  },
  (tabla) => [index('idx_categories_owner').on(tabla.ownerId)],
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

/**
 * Quién clasificó cada transacción y con qué seguridad (ADR 0005). Una fila
 * por transacción; reclasificar la reemplaza. La categoría vigente está en el
 * apunte; esto es la procedencia.
 */
export const transactionClassifications = sqliteTable(
  'transaction_classifications',
  {
    transactionId: text('transaction_id')
      .primaryKey()
      .references(() => transactions.id, { onDelete: 'cascade' }),
    ownerId: text('owner_id').notNull(),
    categoria: text('categoria').notNull(),
    origen: text('origen', { enum: ['manual', 'regla', 'aprendida', 'catalogo'] }).notNull(),
    reglaId: text('regla_id'),
    confianza: integer('confianza').notNull(),
    clasificadoEn: text('clasificado_en').notNull(),
  },
  (tabla) => [
    // «Lo que el usuario confirmó»: es lo que lee el clasificador para aprender.
    index('idx_classifications_owner_origen').on(tabla.ownerId, tabla.origen),
  ],
);

export const ingestRuns = sqliteTable(
  'ingest_runs',
  {
    id: text('id').primaryKey(),
    ownerId: text('owner_id').notNull(),
    fuente: text('fuente').notNull(),
    iniciadoEn: text('iniciado_en').notNull(),
    terminadoEn: text('terminado_en'),
    capturas: integer('capturas').notNull().default(0),
    extraidas: integer('extraidas').notNull().default(0),
    nuevas: integer('nuevas').notNull().default(0),
    duplicadas: integer('duplicadas').notNull().default(0),
    fusionadas: integer('fusionadas').notNull().default(0),
    omitidas: integer('omitidas').notNull().default(0),
    anteriores: integer('anteriores').notNull().default(0),
    transferencias: integer('transferencias').notNull().default(0),
    error: text('error'),
  },
  (tabla) => [
    // «Última sincronización de esta fuente»: la consulta más frecuente.
    index('idx_ingest_runs_owner_fuente').on(tabla.ownerId, tabla.fuente, tabla.iniciadoEn),
  ],
);

/**
 * Observaciones: quién vio cada transacción.
 *
 * `crudo` guarda la transacción normalizada tal como llegó, en JSON. Es lo que
 * permite deshacer una fusión: la observación puede volver a ser una
 * transacción propia sin pedirle nada al banco.
 */
export const transactionObservations = sqliteTable(
  'transaction_observations',
  {
    id: text('id').primaryKey(),
    transactionId: text('transaction_id')
      .notNull()
      .references(() => transactions.id, { onDelete: 'cascade' }),
    ownerId: text('owner_id').notNull(),
    fuente: text('fuente').notNull(),
    referencia: text('referencia'),
    huella: text('huella').notNull(),
    capturadoEn: text('capturado_en').notNull(),
    runId: text('run_id'),
    crudo: text('crudo').notNull(),
  },
  (tabla) => [
    index('idx_observations_origen').on(tabla.ownerId, tabla.fuente, tabla.referencia),
    index('idx_observations_huella').on(tabla.ownerId, tabla.huella),
    index('idx_observations_transaction').on(tabla.transactionId),
  ],
);

/**
 * Transferencias detectadas.
 *
 * `salida`, `entrada` y `observaciones_entrada` son JSON: instantáneas de lo
 * que había antes de fundir. Es lo que permite deshacer sin pedirle nada al
 * banco. No se normalizan en columnas porque nunca se consultan por dentro:
 * solo se leen enteras para restaurar.
 */
export const transfers = sqliteTable(
  'transfers',
  {
    id: text('id').primaryKey(),
    ownerId: text('owner_id').notNull(),
    transactionId: text('transaction_id')
      .notNull()
      .references(() => transactions.id, { onDelete: 'cascade' }),
    salida: text('salida').notNull(),
    entrada: text('entrada').notNull(),
    observacionesEntrada: text('observaciones_entrada').notNull(),
    estado: text('estado', { enum: ['detectada', 'confirmada', 'deshecha'] }).notNull(),
    detectadaEn: text('detectada_en').notNull(),
    resueltaEn: text('resuelta_en'),
  },
  (tabla) => [
    index('idx_transfers_owner_estado').on(tabla.ownerId, tabla.estado),
    index('idx_transfers_transaction').on(tabla.transactionId),
  ],
);

export const reconciliations = sqliteTable(
  'reconciliations',
  {
    id: text('id').primaryKey(),
    ownerId: text('owner_id').notNull(),
    accountId: text('account_id')
      .notNull()
      .references(() => accounts.id),
    fecha: text('fecha').notNull(),
    saldoReal: text('saldo_real').notNull(),
    saldoCalculado: text('saldo_calculado').notNull(),
    diferencia: text('diferencia').notNull(),
    currency: text('currency').notNull(),
    veredicto: text('veredicto', {
      enum: ['cuadra', 'gasto-no-capturado', 'ingreso-no-capturado'],
    }).notNull(),
    fuente: text('fuente').notNull(),
    detalle: text('detalle').notNull(),
    creadoEn: text('creado_en').notNull(),
  },
  (tabla) => [index('idx_reconciliations_account_fecha').on(tabla.accountId, tabla.fecha)],
);
