import { calendarDay } from '@/domain/time/colombia';
import { formatShortDate } from '@/domain/time/format';

export interface ConFechaYMonto {
  fecha: string;
  monto: { amount: bigint };
  direction: 'entra' | 'sale' | 'neutro';
}

export interface DiaDeMovimientos<T> {
  /** `AAAA-MM-DD` en hora de Colombia. */
  dia: string;
  /** Ya escrito para leerse: «Hoy», «Ayer», «28 ago». */
  titulo: string;
  /** Lo que salió ese día. Las entradas y los traslados no cuentan. */
  gastado: bigint;
  movimientos: T[];
}

/**
 * Parte una lista de movimientos por días.
 *
 * **Un día es la unidad con la que se piensa el gasto.** Una lista plana de
 * doscientos movimientos no se lee; la misma partida por días se recorre de un
 * vistazo, y de paso responde algo que antes no respondía: cuánto se fue ese
 * día.
 *
 * Solo se suma lo que **sale**: meter las entradas en el total del día daría
 * una cifra que no significa nada, y los traslados entre cuentas propias
 * inflarían el gasto con dinero que no se gastó.
 *
 * El orden de entrada se conserva —ya viene del repositorio, por fecha
 * descendente—: reordenar aquí sería decidir dos veces lo mismo.
 */
export function agruparPorDia<T extends ConFechaYMonto>(
  movimientos: readonly T[],
  hoy: string,
): DiaDeMovimientos<T>[] {
  const dias: DiaDeMovimientos<T>[] = [];
  const porDia = new Map<string, DiaDeMovimientos<T>>();

  for (const movimiento of movimientos) {
    const dia = calendarDay(movimiento.fecha);
    let grupo = porDia.get(dia);

    if (grupo === undefined) {
      grupo = { dia, titulo: tituloDe(dia, hoy), gastado: 0n, movimientos: [] };
      porDia.set(dia, grupo);
      dias.push(grupo);
    }

    grupo.movimientos.push(movimiento);
    if (movimiento.direction === 'sale') {
      const monto = movimiento.monto.amount;
      grupo.gastado += monto < 0n ? -monto : monto;
    }
  }

  return dias;
}

/**
 * Cómo se llama un día.
 *
 * «Hoy» y «Ayer» tienen nombre propio porque es como se piensan; el resto va
 * con su fecha corta. Nada de «hace 3 días»: para un movimiento concreto, la
 * fecha exacta es lo que se busca.
 */
function tituloDe(dia: string, hoy: string): string {
  const hoyDia = calendarDay(hoy);
  if (dia === hoyDia) return 'Hoy';

  const ayer = new Date(`${hoyDia}T12:00:00.000Z`);
  ayer.setUTCDate(ayer.getUTCDate() - 1);
  if (dia === ayer.toISOString().slice(0, 10)) return 'Ayer';

  return formatShortDate(`${dia}T12:00:00.000-05:00`);
}
