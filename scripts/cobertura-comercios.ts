#!/usr/bin/env tsx
/**
 * Cobertura del catálogo de comercios sobre una base real del teléfono.
 *
 *   adb exec-out run-as com.sereno.app cat databases/sereno.db > sereno.db
 *   npm run cobertura-comercios -- sereno.db
 *
 * Imprime qué proporción de las descripciones reconoce el catálogo y las
 * claves desconocidas más frecuentes: esa lista es lo que hay que añadir.
 * Las descripciones son datos bancarios: no se envían a ningún sitio y el
 * guion solo escribe en la terminal.
 */
import SQLite from 'better-sqlite3';

import { merchantCoverage } from '@/domain/categorization/merchant';

function main(): void {
  const ruta = process.argv[2]?.trim();
  if (ruta === undefined || ruta.length === 0) {
    process.stderr.write('Uso: npm run cobertura-comercios -- <ruta-a-sereno.db>\n');
    process.exit(2);
  }
  let sqlite;
  try {
    sqlite = new SQLite(ruta, { readonly: true, fileMustExist: true });
  } catch (error) {
    const detalle = error instanceof Error ? error.message : String(error);
    process.stderr.write(`No se puede abrir "${ruta}": ${detalle}\n`);
    process.exit(2);
  }
  try {
    let filas: { descripcion: string }[];
    try {
      filas = sqlite
        .prepare("SELECT descripcion FROM transactions WHERE fuente <> 'manual'")
        .all() as { descripcion: string }[];
    } catch (error) {
      const detalle = error instanceof Error ? error.message : String(error);
      process.stderr.write(`"${ruta}" no parece una base de datos de Sereno: ${detalle}\n`);
      process.exitCode = 2;
      return;
    }
    const r = merchantCoverage(filas.map((f) => f.descripcion));
    process.stdout.write(
      `Descripciones: ${String(r.total)} · reconocidas: ${String(r.conocidos)} (${(r.proporcion * 100).toFixed(1)} %)\n`,
    );
    if (r.desconocidos.length > 0) {
      process.stdout.write('\nDesconocidas más frecuentes:\n');
      r.desconocidos.slice(0, 25).forEach((d) => {
        process.stdout.write(`  ${String(d.veces).padStart(4)}  ${d.clave}\n`);
      });
    }
  } finally {
    sqlite.close();
  }
}

main();
