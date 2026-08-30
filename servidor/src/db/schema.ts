import {
  bigserial,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

/**
 * El correo tal como llegó. Es la fuente de la verdad del servidor: si un
 * parser mejora, se puede volver a procesar todo sin pedirle nada a Gmail.
 * También es la cola de revisión: un mensaje que nadie supo leer queda aquí
 * con su motivo, entero, en vez de perderse.
 */
export const mensajes = pgTable(
  'mensajes',
  {
    /** Id estable del mensaje en su origen (UID de IMAP o id de Gmail). */
    id: text('id').primaryKey(),
    origen: text('origen', { enum: ['imap', 'gmail'] }).notNull(),
    remitente: text('remitente').notNull(),
    asunto: text('asunto').notNull(),
    recibidoEn: timestamp('recibido_en', { withTimezone: true }).notNull(),
    texto: text('texto').notNull(),
    html: text('html'),
    estado: text('estado', {
      enum: ['pendiente', 'parseado', 'ignorado', 'desconocido', 'error'],
    })
      .notNull()
      .default('pendiente'),
    /** Por qué no se pudo leer, cuando el estado lo pide. */
    motivo: text('motivo'),
    creadoEn: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
  },
  (tabla) => [index('idx_mensajes_estado').on(tabla.estado, tabla.recibidoEn)],
);

/**
 * Lo que se extrajo de un mensaje, con la forma exacta que el teléfono
 * espera (`NormalizedTransaction`).
 *
 * `secuencia` es el cursor de entrega: monótona, la asigna Postgres, y el
 * dispositivo solo tiene que recordar hasta cuál se trajo. `id` es el mismo
 * determinista de la app (`fuente:referencia`), así que reprocesar un correo
 * no duplica nada ni aquí ni allá.
 */
export const movimientos = pgTable(
  'movimientos',
  {
    id: text('id').primaryKey(),
    secuencia: bigserial('secuencia', { mode: 'number' }).notNull(),
    mensajeId: text('mensaje_id')
      .notNull()
      .references(() => mensajes.id, { onDelete: 'cascade' }),
    fuente: text('fuente').notNull(),
    fecha: text('fecha').notNull(),
    descripcion: text('descripcion').notNull(),
    /** Entero en la unidad mínima, como texto: ningún float toca el dinero. */
    monto: text('monto').notNull(),
    moneda: text('moneda').notNull(),
    tipo: text('tipo', { enum: ['debito', 'credito'] }).notNull(),
    referencia: text('referencia'),
    /** Cuándo confirmó el teléfono que ya lo tiene. Nulo: aún no. */
    entregadoEn: timestamp('entregado_en', { withTimezone: true }),
    creadoEn: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
  },
  (tabla) => [
    uniqueIndex('idx_movimientos_secuencia').on(tabla.secuencia),
    index('idx_movimientos_mensaje').on(tabla.mensajeId),
  ],
);

/** Por dónde va cada adaptador de correo. Una fila por origen. */
export const cursores = pgTable('cursores', {
  id: text('id', { enum: ['imap', 'gmail'] }).primaryKey(),
  valor: text('valor').notNull(),
  actualizadoEn: timestamp('actualizado_en', { withTimezone: true }).notNull().defaultNow(),
});

/** Una pasada de ingesta con sus cuentas. Es el latido del plan 06. */
export const corridas = pgTable(
  'corridas',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    iniciadoEn: timestamp('iniciado_en', { withTimezone: true }).notNull().defaultNow(),
    terminadoEn: timestamp('terminado_en', { withTimezone: true }),
    mensajesVistos: integer('mensajes_vistos').notNull().default(0),
    movimientosNuevos: integer('movimientos_nuevos').notNull().default(0),
    desconocidos: integer('desconocidos').notNull().default(0),
    error: text('error'),
  },
  (tabla) => [index('idx_corridas_inicio').on(tabla.iniciadoEn)],
);
