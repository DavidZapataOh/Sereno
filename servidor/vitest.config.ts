import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    // El dominio de la app, compartido tal cual. No hay copia.
    alias: { '@': fileURLToPath(new URL('../src', import.meta.url)) },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // De un archivo a la vez. Cada prueba de base levanta su propia PGlite
    // —Postgres compilado a WebAssembly—, y varias en paralelo se estorban
    // hasta agotar el tiempo. Se cambia velocidad por pruebas que no
    // parpadean, que es el cambio correcto en una suite de dinero.
    fileParallelism: false,
    testTimeout: 20_000,
  },
});
