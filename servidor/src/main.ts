import { serve } from '@hono/node-server';
import { migrate } from 'drizzle-orm/postgres-js/migrator';

import { crearApp } from './api/app';
import { leerConfig } from './config';
import { crearBase } from './db/cliente';
import { crearRepositorios } from './db/repositorios';
import { crearObservabilidad } from './observabilidad';

/**
 * Arranque.
 *
 * La configuración se lee y se valida **una vez, aquí**: si falta un secreto,
 * el proceso se muere diciendo exactamente qué falta, en vez de fallar tres
 * horas después con un `undefined`. Y se migra antes de escuchar: un esquema a
 * medias sirve datos a medias.
 */
const observabilidad = crearObservabilidad();

async function arrancar(): Promise<void> {
  const config = leerConfig(process.env);
  const base = crearBase(config.baseDeDatos);
  await migrate(base, {
    migrationsFolder: new URL('../drizzle', import.meta.url).pathname,
  });

  const repos = crearRepositorios(base, { clave: config.claveCifrado });
  const app = crearApp({ repos, token: config.token, observabilidad });
  serve({ fetch: app.fetch, port: config.puerto });
  observabilidad.log('info', 'servidor arriba', { puerto: config.puerto });
}

arrancar().catch((error: unknown) => {
  observabilidad.captureError(error, { operacion: 'arranque' });
  process.exit(1);
});
