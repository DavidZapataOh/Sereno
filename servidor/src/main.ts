import { serve } from '@hono/node-server';
import { migrate } from 'drizzle-orm/postgres-js/migrator';

import { crearApp } from './api/app';
import { leerConfig } from './config';
import { crearFuenteGmail } from './correo/gmail';
import { crearClienteBinance } from './binance/cliente';
import { verificarPermisos } from './binance/permisos';
import { crearFuenteImap } from './correo/imap';
import { crearBase } from './db/cliente';
import { crearRepositorios } from './db/repositorios';
import { ingerirCorreos } from './ingesta/ciclo';
import { crearObservabilidad } from './observabilidad';
import { crearPlanificador } from './planificador';

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
  const huerfanas = await repos.corridas.cerrarHuerfanas();
  if (huerfanas > 0) {
    observabilidad.log('warn', 'corridas cerradas por reinicio', { cuantas: huerfanas });
  }
  // Antes de servir nada: si hay claves de Binance, que no puedan mover
  // dinero. Es el único caso del proyecto donde un problema de configuración
  // impide arrancar, y es a propósito: aquí el riesgo no es un dato mal leído,
  // es una cuenta vaciada. Una clave con todos los permisos leería los saldos
  // igual de bien, y nadie lo notaría hasta que se filtrara.
  if (config.binance !== null) {
    const cliente = crearClienteBinance(config.binance);
    const avisos = verificarPermisos(await cliente.permisos());
    for (const aviso of avisos) observabilidad.log('warn', aviso, {});
    observabilidad.log('info', 'clave de Binance verificada: solo lectura', {});
  }

  const app = crearApp({ repos, token: config.token, observabilidad });
  serve({ fetch: app.fetch, port: config.puerto });

  // IMAP salvo que haya credenciales completas de Gmail. Ver «Decisiones» en
  // el README del sprint 06: una app de Google en «Testing» caduca su token a
  // los siete días.
  const fuente =
    config.gmail === null ? crearFuenteImap(config.imap) : crearFuenteGmail(config.gmail);
  const planificador = crearPlanificador({
    intervaloMs: config.intervaloMinutos * 60_000,
    tarea: async () => {
      await ingerirCorreos({ fuente, repos, observabilidad }, { limite: 200 });
    },
    observabilidad,
  });
  planificador.arrancar();

  for (const senal of ['SIGTERM', 'SIGINT'] as const) {
    process.on(senal, () => {
      planificador.parar();
      process.exit(0);
    });
  }

  observabilidad.log('info', 'servidor arriba', {
    puerto: config.puerto,
    fuente: fuente.id,
    intervaloMinutos: config.intervaloMinutos,
  });
}

arrancar().catch((error: unknown) => {
  observabilidad.captureError(error, { operacion: 'arranque' });
  process.exit(1);
});
