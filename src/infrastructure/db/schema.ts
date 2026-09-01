import { index, integer, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core';

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

/** Reglas del usuario (sprint 05, plan 03). Sin orden: gana la más específica. */
export const rules = sqliteTable(
  'rules',
  {
    id: text('id').primaryKey(),
    ownerId: text('owner_id').notNull(),
    campo: text('campo', { enum: ['comercio', 'descripcion'] }).notNull(),
    operador: text('operador', { enum: ['es', 'empieza', 'contiene'] }).notNull(),
    valor: text('valor').notNull(),
    categoria: text('categoria')
      .notNull()
      .references(() => accounts.id),
    creadaEn: text('creada_en').notNull(),
    activa: integer('activa', { mode: 'boolean' }).notNull().default(true),
  },
  (tabla) => [index('idx_rules_owner').on(tabla.ownerId)],
);

/**
 * Conteos del clasificador (sprint 05, plan 04): cuántas veces se vio cada
 * rasgo en cada categoría. Es todo el «modelo»; vive aquí y no sale del
 * teléfono.
 */
export const classifierEvidence = sqliteTable(
  'classifier_evidence',
  {
    ownerId: text('owner_id').notNull(),
    feature: text('feature').notNull(),
    categoria: text('categoria').notNull(),
    cuenta: integer('cuenta').notNull().default(0),
  },
  (tabla) => [
    primaryKey({ columns: [tabla.ownerId, tabla.feature, tabla.categoria] }),
    index('idx_evidence_owner_feature').on(tabla.ownerId, tabla.feature),
  ],
);

/** Lotes de revisión (sprint 05, plan 05): qué se clasificó y desde qué, para deshacer. */
export const classificationBatches = sqliteTable(
  'classification_batches',
  {
    id: text('id').primaryKey(),
    ownerId: text('owner_id').notNull(),
    comercio: text('comercio').notNull(),
    /** JSON: instantáneas de antes y después por transacción. */
    cambios: text('cambios').notNull(),
    reglaId: text('regla_id'),
    creadoEn: text('creado_en').notNull(),
    deshechoEn: text('deshecho_en'),
  },
  (tabla) => [index('idx_batches_owner_creado').on(tabla.ownerId, tabla.creadoEn)],
);

/**
 * Wallets que se siguen (sprint 08).
 *
 * Solo direcciones **públicas**. Sereno no conoce ninguna clave privada y no
 * hay ningún campo donde escribirla.
 *
 * Viven en la base y no en el código porque son datos personales y este
 * repositorio es público.
 */
export const wallets = sqliteTable(
  'wallets',
  {
    id: text('id').primaryKey(),
    ownerId: text('owner_id').notNull(),
    /** La red, no la cadena: una dirección EVM vale en las catorce cadenas EVM. */
    red: text('red').notNull(),
    direccion: text('direccion').notNull(),
    nombre: text('nombre').notNull(),
    /** Cuándo se leyó por última vez, y si falló. */
    leidoEn: text('leido_en'),
    error: text('error'),
  },
  (tabla) => [index('idx_wallets_owner').on(tabla.ownerId)],
);

/**
 * Tasas de cambio guardadas (sprint 08).
 *
 * El valor va como TEXT y entero con su escala —«3202.79» es 320279 con
 * escala 2— por lo mismo que `postings.amount`: un float aquí introduce un
 * error que después se multiplica por el saldo.
 *
 * `origen` y `momento` no son adorno: sin ellos, dentro de un mes el número no
 * dice de dónde salió ni si se quedó pegado. Y la clave incluye el momento
 * para que **el pasado no se reescriba**: valorar el patrimonio de hace un mes
 * con la tasa de hoy haría que la gráfica cambiara sola.
 */
export const rates = sqliteTable(
  'rates',
  {
    desde: text('desde').notNull(),
    hacia: text('hacia').notNull(),
    momento: text('momento').notNull(),
    valor: text('valor').notNull(),
    escala: integer('escala').notNull(),
    origen: text('origen').notNull(),
  },
  (tabla) => [
    primaryKey({ columns: [tabla.desde, tabla.hacia, tabla.momento] }),
    // «La vigente de este par» y «la de aquel día» son las dos consultas.
    index('idx_rates_par_momento').on(tabla.desde, tabla.hacia, tabla.momento),
  ],
);

/**
 * Lo que una cuenta que es tarjeta de crédito tiene de más (sprint 07).
 *
 * Clave: la cuenta, como en `categories` (ADR 0005). Una tabla aparte y no
 * columnas en `accounts` porque la mayoría de las cuentas no son tarjetas, y
 * una columna que casi siempre está vacía invita a llenarla con cualquier cosa.
 *
 * El cupo va en TEXT por lo mismo que `postings.amount`: los enteros de SQLite
 * no cubren todas las escalas y el redondeo de un float no se nota hasta que
 * duele.
 */
export const creditCards = sqliteTable(
  'credit_cards',
  {
    accountId: text('account_id')
      .primaryKey()
      .references(() => accounts.id),
    ownerId: text('owner_id').notNull(),
    cupo: text('cupo').notNull(),
    currency: text('currency').notNull(),
    diaDeCorte: integer('dia_de_corte').notNull(),
    diaDePago: integer('dia_de_pago').notNull(),
  },
  (tabla) => [index('idx_credit_cards_owner').on(tabla.ownerId)],
);

/**
 * Dónde va la traída del servidor y cuándo fue la última (sprint 06).
 *
 * Una fila por clave. El cursor es la secuencia del último movimiento que ya
 * entró al ledger: se escribe **después** de ingerir, nunca antes.
 */
export const estadoSync = sqliteTable('estado_sync', {
  clave: text('clave').primaryKey(),
  valor: text('valor').notNull(),
});

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
    /** Por dónde llegó. Dos canales de la misma fuente son dos observaciones. */
    canal: text('canal', { enum: ['web', 'correo', 'notificacion'] })
      .notNull()
      .default('web'),
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

/**
 * El patrimonio de cada día, ya valorado (sprint 08).
 *
 * La clave es (propietario, día): dos arranques el mismo día son un solo punto,
 * no dos. Y el valor va **guardado, no recalculado**: si la serie se
 * recalculara con las tasas de hoy, la línea del pasado cambiaría cada mañana y
 * no mediría nada. `tasas` queda como constancia de con qué se calculó.
 */
export const net_worth_snapshots = sqliteTable(
  'net_worth_snapshots',
  {
    ownerId: text('owner_id').notNull(),
    dia: text('dia').notNull(),
    /** Entero en la unidad mínima, como TEXT: igual que `postings.amount`. */
    patrimonio: text('patrimonio').notNull(),
    moneda: text('moneda').notNull(),
    tasas: text('tasas').notNull(),
    tomadaEn: text('tomada_en').notNull(),
  },
  (tabla) => [
    primaryKey({ columns: [tabla.ownerId, tabla.dia] }),
    index('idx_snapshots_owner_dia').on(tabla.ownerId, tabla.dia),
  ],
);

/**
 * Los términos de una deuda (sprint 09).
 *
 * **No lleva saldo.** El saldo de una deuda sale del ledger, como el de
 * cualquier cuenta: guardarlo sería tener dos verdades sobre la misma deuda, y
 * la guardada siempre acaba siendo la vieja.
 *
 * La tasa va con su tipo al lado —«EA» o «MV»— porque «0.024» no significa
 * nada sin él, y confundirlos cambia la cuota lo bastante como para que la
 * simulación mienta. `NULL` en la tasa es «no aplica», que no es lo mismo que
 * cero: cero es una tasa pactada del 0 %.
 */
export const debts = sqliteTable(
  'debts',
  {
    accountId: text('account_id').primaryKey(),
    ownerId: text('owner_id').notNull(),
    tipo: text('tipo').notNull(),
    nombre: text('nombre').notNull(),
    /** Como TEXT: un `real` aquí introduce el error que todo esto evita. */
    tasaValor: text('tasa_valor'),
    tasaTipo: text('tasa_tipo'),
    cuotasTotales: integer('cuotas_totales'),
    diaDePago: integer('dia_de_pago'),
  },
  (tabla) => [index('idx_debts_owner').on(tabla.ownerId)],
);

/**
 * Fondos para gastos que no llegan todos los meses (sprint 10).
 *
 * **Sin columna de lo apartado:** eso sale del ledger. La cuenta es de tipo
 * `activo`, no de patrimonio: `isRealAccount` solo cuenta activos y pasivos, y
 * con un fondo de patrimonio apartar plata haría **bajar** el patrimonio neto.
 */
export const sinking_funds = sqliteTable(
  'sinking_funds',
  {
    accountId: text('account_id').primaryKey(),
    ownerId: text('owner_id').notNull(),
    nombre: text('nombre').notNull(),
    /** Entero en la unidad mínima, como TEXT: igual que `postings.amount`. */
    objetivo: text('objetivo').notNull(),
    moneda: text('moneda').notNull(),
    proximaFecha: text('proxima_fecha').notNull(),
    cadaMeses: integer('cada_meses').notNull(),
  },
  (tabla) => [index('idx_sinking_owner').on(tabla.ownerId)],
);
