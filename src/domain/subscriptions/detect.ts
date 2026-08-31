import { calendarDay } from '@/domain/time/colombia';

import { cadenciaDe, diasDe } from './cadence';
import type { CobroCandidato, Subscription } from './subscription';

const DIA_MS = 24 * 60 * 60 * 1000;

function sumarDias(dia: string, n: number): string {
  return new Date(Date.parse(`${dia}T12:00:00.000Z`) + n * DIA_MS).toISOString().slice(0, 10);
}

/**
 * Cuántos periodos puede saltarse un cobro antes de darla por cancelada.
 *
 * Dos: uno puede ser un retraso del banco o un cobro que no llegó por correo;
 * dos seguidos ya no. Decir «próximo cobro» de algo cancelado hace tres meses
 * es peor que no decir nada.
 */
const PERIODOS_DE_GRACIA = 2;

/**
 * Encuentra las suscripciones entre los movimientos.
 *
 * No escribe nada: es una lectura sobre lo que ya pasó, así que equivocarse no
 * rompe nada. Y por eso mismo tiene que equivocarse poco: un aviso falso enseña
 * a ignorar los avisos.
 *
 * Agrupa por la **clave de comercio del sprint 05**, no por la descripción
 * cruda. Sin eso, «NETFLIX.COM 1234» y «Netflix» serían dos suscripciones y no
 * se detectaría ninguna.
 */
export function detectSubscriptions(
  movimientos: readonly CobroCandidato[],
  hoy: string,
): Subscription[] {
  const porComercio = new Map<string, CobroCandidato[]>();
  for (const m of movimientos) {
    // Una transferencia entre cuentas propias no es un cobro de nadie, y un
    // ingreso recurrente es una nómina. Ni uno ni otro es una suscripción.
    if (m.esTransferencia || !m.sale) continue;
    if (m.claveComercio.length === 0) continue;
    const lote = porComercio.get(m.claveComercio) ?? [];
    lote.push(m);
    porComercio.set(m.claveComercio, lote);
  }

  const suscripciones: Subscription[] = [];
  for (const [clave, cobros] of porComercio) {
    const ordenados = [...cobros].sort((a, b) => a.fecha.localeCompare(b.fecha));
    const dias = ordenados.map((c) => calendarDay(c.fecha));
    const cadencia = cadenciaDe(dias);
    if (cadencia === null) continue;

    const ultimo = ordenados.at(-1);
    if (ultimo === undefined) continue;
    const ultimoDia = calendarDay(ultimo.fecha);
    const periodo = diasDe(cadencia.cadencia);
    const siguiente = sumarDias(ultimoDia, periodo);
    const limite = sumarDias(ultimoDia, periodo * (PERIODOS_DE_GRACIA + 1));

    suscripciones.push({
      clave,
      comercio: ultimo.nombreComercio,
      cadencia: cadencia.cadencia,
      // El último, no el promedio: es lo que van a cobrar la próxima vez.
      monto: ultimo.monto,
      ultimoCobro: ultimoDia,
      proximoCobro: calendarDay(hoy) > limite ? null : siguiente,
      cobros: ordenados.map((c) => c.id),
      historial: ordenados.map((c) => c.monto),
      confianza: cadencia.confianza,
    });
  }

  return suscripciones.sort((a, b) =>
    (a.proximoCobro ?? '9999').localeCompare(b.proximoCobro ?? '9999'),
  );
}
