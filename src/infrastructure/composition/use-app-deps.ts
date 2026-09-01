import { useMemo } from 'react';

import { AJUSTES_POR_DEFECTO } from '@/domain/alerts/reminder-settings';

import type { AppDeps } from '@/application/sync/sync-portal';

import { createBalanceSources } from '../crypto/balance-sources';
import { useDatabase } from '../db/database-provider';
import { createRepositories } from '../db/repositories';
import { createCryptoIdGenerator } from '../ids/crypto-id-generator';
import { createLocalScheduler } from '../notifications/local-scheduler';
import { createRateSources } from '../rates/rate-sources';
import { createHttpServerClient, createSinServidor } from '../sync/http-server-client';

/**
 * Los puertos del sprint, cableados sobre la base abierta al arrancar.
 *
 * Es el único punto donde las rutas tocan infraestructura: reciben esto y
 * se lo pasan a los casos de uso. Memorizado por base: se construye una vez.
 */
export function useAppDeps(): AppDeps {
  const db = useDatabase();
  return useMemo(() => {
    // Sin servidor configurado, la app funciona exactamente como antes del
    // sprint 06: lo de SQLite se ve y la traída simplemente no ocurre.
    // Con notación de punto a propósito: el bundler de Expo sustituye estas
    // variables en tiempo de compilación buscándolas literalmente. Con
    // corchetes no las encuentra y llegan `undefined` al teléfono.
    const url = process.env.EXPO_PUBLIC_SERENO_URL;
    const token = process.env.EXPO_PUBLIC_SERENO_TOKEN;
    const servidor =
      url === undefined || url.length === 0 || token === undefined || token.length === 0
        ? createSinServidor()
        : createHttpServerClient({ url, token });

    const clock = () => new Date().toISOString();

    return {
      ...createRepositories(db),
      servidor,
      ids: createCryptoIdGenerator(),
      clock,
      // Una por cadena declarada. Sin esto `syncWallets` no tiene a quién
      // preguntarle y devuelve cero, que es indistinguible de no tener nada.
      fuentesDeSaldo: createBalanceSources(clock),
      fuentesDeTasas: createRateSources(clock),
      scheduler: createLocalScheduler(),
      // Los ajustes de aviso viven en la pantalla mientras no haya dónde
      // guardarlos; el valor por defecto es el que se usa al arrancar.
      ajustesDeAviso: AJUSTES_POR_DEFECTO,
      // Desde cuándo se mide el ritmo de las metas. Con una sola instalación,
      // el día de hoy basta: lo que importa es la proporción de tiempo pasado.
      inicio: clock().slice(0, 10),
    };
  }, [db]);
}
