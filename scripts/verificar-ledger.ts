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
  const ruta = process.argv[2];
  if (ruta === undefined) {
    process.stderr.write('Uso: npm run verificar-ledger -- <ruta-a-sereno.db>\n');
    process.exit(2);
  }

  // Solo lectura: un diagnóstico no debe poder empeorar lo que diagnostica.
  const sqlite = new SQLite(ruta, { readonly: true, fileMustExist: true });
  try {
    const reporte = checkLedger(drizzle(sqlite, { schema }) as Database);
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
