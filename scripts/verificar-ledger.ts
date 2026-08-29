#!/usr/bin/env tsx
/**
 * Diagnóstico del ledger sobre una base real.
 *
 * Las invariantes que solo corren en pruebas no ayudan cuando el problema
 * aparece en el dispositivo, con datos reales, seis meses después. Esto las
 * ejecuta sobre el archivo de base que se saque del teléfono:
 *
 *   adb exec-out run-as com.sereno.app cat databases/sereno.db > sereno.db
 *   npm run verificar-ledger -- sereno.db
 *
 * Sale con código 1 si encuentra algo, para poder encadenarlo.
 */
import SQLite from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';

import type { Database } from '@/infrastructure/db/database';
import { checkLedger } from '@/infrastructure/db/ledger-check';
import * as schema from '@/infrastructure/db/schema';

function main(): void {
  // Se comprueba que haya contenido, no solo que el argumento exista. `npm run
  // verificar-ledger --` sin ruta pasa una cadena vacía, no `undefined`, y
  // `new SQLite('')` la interpreta como base en memoria: revienta con un
  // «In-memory/temporary databases cannot be readonly» y un volcado de pila,
  // en vez de decir cómo se usa.
  const ruta = process.argv[2]?.trim();
  if (ruta === undefined || ruta.length === 0) {
    process.stderr.write('Uso: npm run verificar-ledger -- <ruta-a-sereno.db>\n');
    process.exit(2);
  }

  // Solo lectura: un diagnóstico no debe poder empeorar lo que diagnostica.
  let sqlite;
  try {
    sqlite = new SQLite(ruta, { readonly: true, fileMustExist: true });
  } catch (error) {
    // Un archivo que no existe o que no es una base es un error de uso, no un
    // fallo del programa: se dice en una línea, sin volcado de pila.
    const detalle = error instanceof Error ? error.message : String(error);
    process.stderr.write(`No se puede abrir "${ruta}": ${detalle}\n`);
    process.exit(2);
  }
  try {
    let reporte;
    try {
      reporte = checkLedger(drizzle(sqlite, { schema }) as Database);
    } catch (error) {
      // Un archivo que no es una base de Sereno falla al consultar, no al
      // abrir: SQLite acepta cualquier archivo y se queja cuando busca las
      // tablas. También es un error de uso.
      const detalle = error instanceof Error ? error.message : String(error);
      process.stderr.write(`"${ruta}" no parece una base de datos de Sereno: ${detalle}\n`);
      process.exitCode = 2;
      return;
    }

    const { cuentas, transacciones, apuntes } = reporte.revisado;

    process.stdout.write(
      `Revisado: ${String(cuentas)} cuentas, ${String(transacciones)} transacciones, ${String(apuntes)} apuntes\n`,
    );

    if (reporte.sano) {
      process.stdout.write('El ledger cuadra. No se encontró ninguna violación.\n');
      return;
    }

    const porInvariante = new Map<string, number>();
    reporte.violaciones.forEach((violacion) => {
      porInvariante.set(violacion.invariante, (porInvariante.get(violacion.invariante) ?? 0) + 1);
    });

    process.stdout.write(`\n${String(reporte.violaciones.length)} violación(es):\n\n`);
    porInvariante.forEach((cantidad, invariante) => {
      process.stdout.write(`  ${invariante}: ${String(cantidad)}\n`);
    });

    process.stdout.write('\nDetalle:\n');
    reporte.violaciones.forEach((violacion) => {
      process.stdout.write(`  · ${violacion.detalle}\n`);
    });

    process.exitCode = 1;
  } finally {
    sqlite.close();
  }
}

main();
