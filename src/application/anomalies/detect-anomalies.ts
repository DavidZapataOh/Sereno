import type { Anomaly } from '@/domain/anomalies/anomaly';
import type { AnomalyRepository } from '@/domain/anomalies/anomaly-repository';
import { cobroRepetido, comercioDormido, type CobroConFecha } from '@/domain/anomalies/detectors';
import { montoInusual } from '@/domain/anomalies/unusual-amount';
import { detectSubscriptions } from '@/domain/subscriptions/detect';
import { priceChangeOf } from '@/domain/subscriptions/price-change';
import { anomalyId, createAnomaly } from '@/domain/anomalies/anomaly';
import type { OwnerId } from '@/domain/ledger/ids';
import type { Money } from '@/domain/money/money';
import { calendarDay } from '@/domain/time/colombia';

import { listMovements, type MovementsDeps, type MovementView } from '../movements/movements';

export interface AnomalyDeps extends MovementsDeps {
  clock: () => string;
  anomalias: AnomalyRepository;
}

/** Cuántos movimientos se miran. Un año no trae más. */
const VENTANA = 1500;
/** Qué se considera «reciente»: solo se avisa de lo que aún se puede mirar. */
const DIAS_RECIENTES = 30;

/**
 * Lo que ocurrió y no encaja.
 *
 * **No detecta duplicados de ingesta**: eso lo resolvió el sprint 04 con huella
 * y ventanas, y lo que llega aquí ya pasó por ahí. Repetirlo daría dos alertas
 * por lo mismo, que es la forma más rápida de que se ignoren las dos.
 *
 * Lo recurrente **queda fuera a propósito**: el arriendo, la cuota y la
 * suscripción anual son grandes y esperados. Avisar de ellos es enseñar a
 * ignorar la pantalla.
 */
export async function detectAnomalies(
  deps: AnomalyDeps,
  input: { owner: OwnerId },
): Promise<Anomaly[]> {
  const hoy = calendarDay(deps.clock());
  const desde = haceDias(hoy, DIAS_RECIENTES);
  const pagina = await listMovements(deps, { owner: input.owner, limit: VENTANA });

  const gastos = pagina.items.filter((m) => m.direction === 'sale' && !m.esTransferencia);
  const suscripciones = detectSubscriptions(gastos.map(aCandidato), deps.clock());
  const recurrentes = new Set(suscripciones.map((s) => s.clave));

  const anomalias: Anomaly[] = [];

  // --- Monto inusual, contra la mediana de la misma categoría.
  for (const m of gastos) {
    if (calendarDay(m.fecha) < desde) continue;
    if (recurrentes.has(m.comercio.clave)) continue;

    const historial = historialDe(gastos, m);
    const anomalia = montoInusual(
      { transaccion: m.id, monto: m.monto, comercio: m.comercio.clave },
      historial,
    );
    if (anomalia !== null) anomalias.push(anomalia);
  }

  // --- Cobro repetido el mismo día.
  const recientes: CobroConFecha[] = gastos
    .filter((m) => calendarDay(m.fecha) >= desde && !recurrentes.has(m.comercio.clave))
    .map((m) => ({
      transaccion: m.id,
      comercio: m.comercio.clave,
      nombre: m.comercio.nombre,
      monto: m.monto,
      dia: calendarDay(m.fecha),
    }));
  anomalias.push(...cobroRepetido(recientes));

  // --- Comercio dormido.
  for (const cobro of recientes) {
    const anteriores = gastos
      .filter((m) => m.comercio.clave === cobro.comercio && calendarDay(m.fecha) < desde)
      .map((m) => calendarDay(m.fecha))
      .sort();
    const anomalia = comercioDormido(cobro, anteriores.at(-1) ?? null, hoy);
    if (anomalia !== null) anomalias.push(anomalia);
  }

  // --- Suscripción que subió de precio: ya se detecta desde el sprint 07.
  for (const sub of suscripciones) {
    const cambio = priceChangeOf(sub);
    if (cambio === null || cambio.porcentaje <= 0) continue;
    const ultimo = sub.cobros.at(-1);
    if (ultimo === undefined) continue;

    anomalias.push(
      createAnomaly({
        id: anomalyId('precio-subio', ultimo),
        tipo: 'precio-subio',
        transaccion: ultimo,
        explicacion: `${sub.comercio} subió un ${String(Math.round(cambio.porcentaje))} %`,
        comparadoCon: 'lo que te cobraba antes',
        confianza: 0.8,
      }),
    );
  }

  // Lo que David ya dio por bueno no vuelve: sin esto, la pantalla enseñaría
  // siempre lo mismo y dejaría de leerse.
  const descartadas = await deps.anomalias.descartadas(input.owner);

  // Lo más seguro primero, y desempate estable para no bailar entre corridas.
  return anomalias
    .filter((a) => !descartadas.has(a.id))
    .sort((a, b) => {
      // Desempate estable por id: sin él, dos anomalías con la misma confianza
      // podrían salir en orden distinto en cada corrida.
      const porConfianza = b.confianza - a.confianza;
      return porConfianza === 0 ? a.id.localeCompare(b.id) : porConfianza;
    });
}

/**
 * Qué se considera recurrente, y por qué no basta con «aparece todos los meses».
 *
 * Se reutiliza `detectSubscriptions` del sprint 07, que además de la cadencia
 * **exige que el monto sea estable**. Un primer intento marcaba recurrente todo
 * comercio visto en tres meses distintos, y eso incluía el supermercado —que sí
 * se visita cada mes, con montos muy distintos—: el detector principal se
 * quedaba sin nada que mirar. El arriendo se filtra porque es el mismo monto; el
 * mercado no, y ahí es donde un cobro raro se ve.
 */
function aCandidato(m: MovementView) {
  return {
    id: m.id,
    fecha: m.fecha,
    monto: m.monto,
    claveComercio: m.comercio.clave,
    nombreComercio: m.comercio.nombre,
    esTransferencia: m.esTransferencia,
    sale: m.direction === 'sale',
  };
}

/** Los montos de la misma categoría, para la mediana. */
function historialDe(gastos: readonly MovementView[], actual: MovementView): Money[] {
  const categoria = actual.contraparte?.id;
  if (categoria === undefined) return [];

  return gastos
    .filter((m) => m.id !== actual.id && m.contraparte?.id === categoria)
    .map((m) => m.monto);
}

function haceDias(dia: string, dias: number): string {
  const fecha = new Date(Date.parse(`${dia}T12:00:00.000-05:00`) - dias * 86_400_000);
  return `${String(fecha.getUTCFullYear())}-${String(fecha.getUTCMonth() + 1).padStart(2, '0')}-${String(fecha.getUTCDate()).padStart(2, '0')}`;
}
