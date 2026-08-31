import { and, asc, desc, eq, gt, inArray, isNull, lte, sql } from 'drizzle-orm';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';

import type { NormalizedTransaction } from '@/domain/capture/normalized-transaction';
import { ingestedTransactionId } from '@/domain/ingest/to-transaction';

import { cifrar, descifrar } from '../correo/sobre';

import * as schema from './schema';
import { corridas, cursores, mensajes, movimientos } from './schema';

/** La base, sea la de Postgres o la de PGlite de las pruebas. */
export type BaseDeDatos = PgDatabase<PgQueryResultHKT, typeof schema>;

export type EstadoMensaje = (typeof mensajes.$inferSelect)['estado'];
export type MensajeGuardado = typeof mensajes.$inferSelect;
export type MovimientoGuardado = typeof movimientos.$inferSelect;
export type CorridaGuardada = typeof corridas.$inferSelect;

export interface Repositorios {
  mensajes: {
    guardar: (m: typeof mensajes.$inferInsert) => Promise<void>;
    existe: (id: string) => Promise<boolean>;
    marcar: (id: string, estado: EstadoMensaje, motivo?: string) => Promise<void>;
    listarParaRevision: (
      limite: number,
      estados?: readonly EstadoMensaje[],
    ) => Promise<MensajeGuardado[]>;
  };
  movimientos: {
    guardarLote: (mensajeId: string, movs: readonly NormalizedTransaction[]) => Promise<number>;
    desde: (
      cursor: number,
      limite: number,
    ) => Promise<{ movimientos: MovimientoGuardado[]; cursor: number; hayMas: boolean }>;
    confirmarHasta: (cursor: number) => Promise<void>;
    sinEntregar: () => Promise<MovimientoGuardado[]>;
  };
  cursores: {
    leer: (id: 'imap' | 'gmail') => Promise<string | null>;
    escribir: (id: 'imap' | 'gmail', valor: string) => Promise<void>;
  };
  corridas: {
    abrir: () => Promise<number>;
    cerrar: (
      id: number,
      resumen: {
        mensajesVistos: number;
        movimientosNuevos: number;
        desconocidos: number;
        error: string | null;
      },
    ) => Promise<void>;
    ultima: () => Promise<CorridaGuardada | null>;
    /** Cierra las que se quedaron abiertas por un reinicio. Devuelve cuántas. */
    cerrarHuerfanas: () => Promise<number>;
  };
}

export interface OpcionesRepositorios {
  /** 32 bytes. Con ella se cifra el cuerpo de los correos en reposo. */
  clave: Buffer;
}

export function crearRepositorios(db: BaseDeDatos, opciones: OpcionesRepositorios): Repositorios {
  return {
    mensajes: {
      guardar: async (m) => {
        // Ver el mismo correo dos veces no es un error: es lo normal cuando
        // una corrida se corta a medias. Se ignora, no se reescribe: el
        // estado del primer procesamiento manda.
        //
        // El cuerpo va cifrado; las cabeceras no, porque hacen falta para
        // consultar y no dicen cuánto se gastó.
        await db
          .insert(mensajes)
          .values({
            ...m,
            texto: cifrar(m.texto, opciones.clave),
            html: m.html === null || m.html === undefined ? null : cifrar(m.html, opciones.clave),
          })
          .onConflictDoNothing({ target: mensajes.id });
      },

      existe: async (id) => {
        const [fila] = await db
          .select({ id: mensajes.id })
          .from(mensajes)
          .where(eq(mensajes.id, id))
          .limit(1);
        return fila !== undefined;
      },

      marcar: async (id, estado, motivo) => {
        await db
          .update(mensajes)
          .set({ estado, motivo: motivo ?? null })
          .where(eq(mensajes.id, id));
      },

      // Por defecto, lo que hay que arreglar. Con estados explícitos se puede
      // pedir también lo «ignorado», que si no no se ve en ninguna parte: ahí
      // cae el estado de cuenta mensual de una tarjeta (sprint 07, plan 02).
      listarParaRevision: async (limite, estados = ['desconocido', 'error']) => {
        const filas = await db
          .select()
          .from(mensajes)
          .where(inArray(mensajes.estado, [...estados]))
          .orderBy(desc(mensajes.recibidoEn))
          .limit(limite);
        return filas.map((f) => ({
          ...f,
          texto: descifrar(f.texto, opciones.clave),
          html: f.html === null ? null : descifrar(f.html, opciones.clave),
        }));
      },
    },

    movimientos: {
      guardarLote: async (mensajeId, movs) => {
        if (movs.length === 0) return 0;
        const filas = movs.map((m) => ({
          id: ingestedTransactionId(m.fuente, m.referencia ?? ''),
          mensajeId,
          fuente: m.fuente,
          fecha: m.fecha,
          descripcion: m.descripcion,
          monto: String(m.monto),
          moneda: m.moneda,
          tipo: m.tipo,
          referencia: m.referencia,
        }));
        const insertadas = await db
          .insert(movimientos)
          .values(filas)
          .onConflictDoNothing({ target: movimientos.id })
          .returning({ id: movimientos.id });
        return insertadas.length;
      },

      desde: async (cursor, limite) => {
        const filas = await db
          .select()
          .from(movimientos)
          .where(gt(movimientos.secuencia, cursor))
          .orderBy(asc(movimientos.secuencia))
          .limit(limite + 1);
        const pagina = filas.slice(0, limite);
        return {
          movimientos: pagina,
          cursor: pagina.at(-1)?.secuencia ?? cursor,
          hayMas: filas.length > limite,
        };
      },

      confirmarHasta: async (cursor) => {
        await db
          .update(movimientos)
          .set({ entregadoEn: sql`now()` })
          .where(and(lte(movimientos.secuencia, cursor), isNull(movimientos.entregadoEn)));
      },

      sinEntregar: () =>
        db
          .select()
          .from(movimientos)
          .where(isNull(movimientos.entregadoEn))
          .orderBy(asc(movimientos.secuencia)),
    },

    cursores: {
      leer: async (id) => {
        const [fila] = await db.select().from(cursores).where(eq(cursores.id, id)).limit(1);
        return fila?.valor ?? null;
      },

      escribir: async (id, valor) => {
        await db
          .insert(cursores)
          .values({ id, valor })
          .onConflictDoUpdate({
            target: cursores.id,
            set: { valor, actualizadoEn: sql`now()` },
          });
      },
    },

    corridas: {
      abrir: async () => {
        const [fila] = await db.insert(corridas).values({}).returning({ id: corridas.id });
        if (fila === undefined) throw new Error('No se pudo abrir la corrida');
        return fila.id;
      },

      // Un despliegue, un reinicio o un proceso muerto dejan la corrida
      // abierta para siempre, y `/salud` acaba enseñando una pasada eterna
      // que en realidad ya no existe. Se cierran al arrancar, con su motivo:
      // un estado que miente es peor que uno feo.
      cerrarHuerfanas: async () => {
        const filas = await db
          .update(corridas)
          .set({ terminadoEn: sql`now()`, error: 'el proceso se reinició a mitad de la pasada' })
          .where(isNull(corridas.terminadoEn))
          .returning({ id: corridas.id });
        return filas.length;
      },

      cerrar: async (id, resumen) => {
        await db
          .update(corridas)
          .set({ ...resumen, terminadoEn: sql`now()` })
          .where(eq(corridas.id, id));
      },

      ultima: async () => {
        const [fila] = await db.select().from(corridas).orderBy(desc(corridas.id)).limit(1);
        return fila ?? null;
      },
    },
  };
}
