import type { SQLiteDatabase } from 'expo-sqlite';

import migraciones from '../../../drizzle/migrations';

interface EntradaJournal {
  idx: number;
  when: number;
  tag: string;
}

export interface EstadoMigraciones {
  /** Cuántas registra la base como aplicadas. */
  aplicadas: number;
  /** La marca de tiempo de la última aplicada, o `null` si la base está limpia. */
  ultimaMarca: number | null;
  /** Cuántas hay declaradas en el journal. */
  enJournal: number;
  /**
   * Las que Drizzle va a intentar aplicar: las de marca **mayor** que la
   * última registrada. Es el criterio literal del migrador.
   */
  porAplicar: string[];
  /**
   * Las que quedarán descartadas para siempre: existen en el journal, no están
   * aplicadas, y su marca **no supera** a la última. El migrador las salta sin
   * decir nada, y esta lista es la única forma de verlas.
   */
  descartadas: string[];
}

/**
 * Qué migraciones ha aplicado esta base y cuáles va a saltarse.
 *
 * Existe porque el fallo del 2026-08-31 fue invisible: una migración con la
 * marca fuera de orden se descarta en silencio, y el síntoma aparece semanas
 * después como «no such table» en una pantalla cualquiera. Sin esto, la única
 * forma de saberlo es deducirlo, y deducirlo sale caro.
 */
export function estadoDeMigraciones(sqlite: SQLiteDatabase): EstadoMigraciones {
  const entradas = (migraciones.journal as { entries: EntradaJournal[] }).entries;

  // La tabla no existe hasta la primera migración: en una base nueva esto es
  // lo normal, no un error.
  const filas = leerRegistro(sqlite);
  const ultimaMarca = filas.length === 0 ? null : Math.max(...filas);

  const porAplicar: string[] = [];
  const descartadas: string[] = [];
  for (const entrada of entradas) {
    if (ultimaMarca === null || entrada.when > ultimaMarca) {
      porAplicar.push(entrada.tag);
    } else if (!filas.includes(entrada.when)) {
      descartadas.push(entrada.tag);
    }
  }

  return {
    aplicadas: filas.length,
    ultimaMarca,
    enJournal: entradas.length,
    porAplicar,
    descartadas,
  };
}

function leerRegistro(sqlite: SQLiteDatabase): number[] {
  try {
    return sqlite
      .getAllSync<{ created_at: number }>('SELECT created_at FROM __drizzle_migrations')
      .map((f) => f.created_at);
  } catch {
    return [];
  }
}
