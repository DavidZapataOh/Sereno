import { DEFAULT_CATEGORIES } from '@/domain/categorization/taxonomy';

/**
 * Lo único que puede salir del teléfono hacia el asistente.
 *
 * **David lo decidió el 2026-09-01: solo cifras agregadas.** Nunca comercios,
 * descripciones, referencias, números de cuenta ni fechas de movimientos. Lo
 * que se pierde está declarado —no podrá responder «¿cuánto llevo en Rappi?»— y
 * lo que se gana es que lo que sale, suelto, no identifica ni describe nada.
 *
 * La frontera vive aquí, en el dominio, **y se prueba**: una promesa en un
 * comentario no impide que alguien añada un campo dentro de seis meses. La
 * prueba recorre el objeto serializado y exige que toda clave sea un slug de la
 * taxonomía y todo valor un número.
 */
export interface ResumenPublicable {
  /** Slugs de la taxonomía —lista cerrada— contra pesos enteros. */
  gastoPorCategoria: Record<string, number>;
  saldoTotal: number;
  deudaTotal: number;
  patrimonio: number;
  /** `null` cuando no hay con qué comparar. Cero significaría «no tenías nada». */
  patrimonioHace30Dias: number | null;
  tasaDeAhorroPct: number | null;
  mesesDeColchon: number | null;
  ingresoMensual: number | null;
  moneda: 'COP';
}

/** Los slugs válidos. Un nombre de comercio no está aquí, y esa es la frontera. */
export const SLUGS_CONOCIDOS: readonly string[] = DEFAULT_CATEGORIES.map((c) => c.slug);

export interface EntradaDelResumen {
  gastoPorCategoria: Record<string, number>;
  saldoTotal: number;
  deudaTotal: number;
  patrimonio: number;
  patrimonioHace30Dias: number | null;
  tasaDeAhorroPct: number | null;
  mesesDeColchon: number | null;
  ingresoMensual: number | null;
}

/**
 * Construye el resumen, **descartando todo lo que no esté permitido**.
 *
 * Se filtra en vez de confiar: si el llamador pasa una clave que no es un slug
 * conocido —el nombre de un comercio, por ejemplo—, aquí se cae. Es la única
 * forma de que la frontera aguante cambios futuros en quien la llama.
 */
export function resumenPublicable(entrada: EntradaDelResumen): ResumenPublicable {
  const permitidos = new Set(SLUGS_CONOCIDOS);
  const gastoPorCategoria: Record<string, number> = {};

  for (const [clave, valor] of Object.entries(entrada.gastoPorCategoria)) {
    if (!permitidos.has(clave)) continue;
    if (!Number.isFinite(valor)) continue;
    gastoPorCategoria[clave] = Math.round(valor);
  }

  return {
    gastoPorCategoria,
    saldoTotal: Math.round(entrada.saldoTotal),
    deudaTotal: Math.round(entrada.deudaTotal),
    patrimonio: Math.round(entrada.patrimonio),
    patrimonioHace30Dias: redondearONull(entrada.patrimonioHace30Dias),
    tasaDeAhorroPct: redondearONull(entrada.tasaDeAhorroPct),
    mesesDeColchon: redondearONull(entrada.mesesDeColchon),
    ingresoMensual: redondearONull(entrada.ingresoMensual),
    moneda: 'COP',
  };
}

/** `null` se conserva: no es lo mismo que cero, y aquí la diferencia importa. */
function redondearONull(valor: number | null): number | null {
  if (valor === null || !Number.isFinite(valor)) return null;
  return Math.round(valor * 10) / 10;
}
