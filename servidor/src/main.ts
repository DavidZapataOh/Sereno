import { serve } from '@hono/node-server';

import { crearApp } from './api/app';
import { crearBase } from './db/cliente';
import { crearRepositorios } from './db/repositorios';
import { crearObservabilidad } from './observabilidad';

/**
 * Arranque. La configuración tipada y la migración al arrancar llegan en el
 * plan 05; aquí basta con levantar y decir que está vivo.
 */
const observabilidad = crearObservabilidad();
const url = process.env['DATABASE_URL'];
const token = process.env['SERENO_TOKEN'];
if (url === undefined || token === undefined) {
  observabilidad.captureError(new Error('Faltan DATABASE_URL o SERENO_TOKEN'));
  process.exit(1);
}

const app = crearApp({ repos: crearRepositorios(crearBase(url)), token, observabilidad });
const puerto = Number(process.env['PORT'] ?? 8080);
serve({ fetch: app.fetch, port: puerto });
observabilidad.log('info', 'servidor arriba', { puerto });
