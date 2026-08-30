import { serve } from '@hono/node-server';

import { crearApp } from './api/app';
import { claveDesde } from './correo/sobre';
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
const claveCifrado = process.env['SERENO_CLAVE_CIFRADO'];
if (url === undefined || token === undefined || claveCifrado === undefined) {
  observabilidad.captureError(
    new Error('Faltan DATABASE_URL, SERENO_TOKEN o SERENO_CLAVE_CIFRADO'),
  );
  process.exit(1);
}

const repos = crearRepositorios(crearBase(url), { clave: claveDesde(claveCifrado) });
const app = crearApp({ repos, token, observabilidad });
const puerto = Number(process.env['PORT'] ?? 8080);
serve({ fetch: app.fetch, port: puerto });
observabilidad.log('info', 'servidor arriba', { puerto });
