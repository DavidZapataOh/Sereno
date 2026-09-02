#!/usr/bin/env tsx
/**
 * Comprueba los cortes de saldo sobre una base real (ADR 0006).
 *
 * Hermano de `verificar-ledger`, y por la misma razón: una invariante que solo
 * corre en pruebas no ayuda cuando el problema aparece en el dispositivo, con
 * datos reales, seis meses después.
 *
 *   adb exec-out run-as com.sereno.app cat databases/sereno.db > sereno.db
 *   npm run verificar-saldos -- sereno.db
 *
 * Sale con código 1 si algún corte no coincide con el cálculo desde cero.
 */
import SQLite from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';

import { checkCheckpoints } from '@/infrastructure/db/checkpoint-check';
import type { Database } from '@/infrastructure/db/database';
import * as schema from '@/infrastructure/db/schema';

function main(): void {
  const ruta = process.argv[2]?.trim();
  if (ruta === undefined || ruta.length === 0) {
    process.stderr.write('Uso: npm run verificar-saldos -- <ruta-a-sereno.db>\n');
    process.exit(2);
  }

  // Solo lectura: un diagnóstico no debe poder empeorar lo que diagnostica.
  let sqlite;
  try {
    sqlite = new SQLite(ruta, { readonly: true, fileMustExist: true });
  } catch (error) {
    const detalle = error instanceof Error ? error.message : String(error);
    process.stderr.write(`No se puede abrir "${ruta}": ${detalle}\n`);
    process.exit(2);
  }

  try {
    let reporte;
    try {
      reporte = checkCheckpoints(drizzle(sqlite, { schema }) as Database);
    } catch (error) {
      const detalle = error instanceof Error ? error.message : String(error);
      process.stderr.write(`"${ruta}" no parece una base de datos de Sereno: ${detalle}\n`);
      process.exitCode = 2;
      return;
    }

    process.stdout.write(`Revisados: ${String(reporte.revisados)} cortes de saldo\n`);

    if (reporte.sano) {
      process.stdout.write('Todos coinciden con el cálculo desde cero.\n');
      return;
    }

    process.stdout.write(`\n${String(reporte.diferencias.length)} corte(s) que no coinciden:\n\n`);
    reporte.diferencias.forEach((d) => {
      process.stdout.write(
        `  · ${d.accountId} en ${d.mes}: guardado ${String(d.guardado)}, derivado ${String(d.derivado)}\n`,
      );
    });
    process.stdout.write(
      '\nUn corte es un caché: borrarlo es seguro y la app lo vuelve a calcular.\n',
    );

    process.exitCode = 1;
  } finally {
    sqlite.close();
  }
}

main();
