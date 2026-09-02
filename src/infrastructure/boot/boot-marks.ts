/**
 * Cuánto tarda cada fase del arranque.
 *
 * **Cuatro fases y no una sola cifra**, porque «arrancó en 2,4 s» no dice qué
 * arreglar: si son las migraciones es una cosa, si son las fuentes es otra muy
 * distinta, y la respuesta cambia por completo.
 *
 * Vive en un módulo y no en un estado de React a propósito: el reloj tiene que
 * empezar a correr cuando se carga el paquete, que es antes de que exista el
 * primer componente.
 */
export type FaseDeArranque = 'fuentes' | 'base' | 'migraciones' | 'primera-pantalla';

export interface MarcaDeArranque {
  fase: FaseDeArranque;
  /** Milisegundos desde que se cargó el paquete. */
  ms: number;
}

/** El orden en que se esperan. Una que falte no se inventa: no sale. */
const ORDEN: readonly FaseDeArranque[] = ['fuentes', 'base', 'migraciones', 'primera-pantalla'];

const marcas = new Map<FaseDeArranque, number>();

/** Cuándo empezó todo. Se fija al cargar el módulo. */
const inicio = ahora();

function ahora(): number {
  // `performance.now()` existe en Hermes y en Node; el respaldo es para
  // cualquier entorno donde no esté. Medir no puede depender de eso.
  const reloj = globalThis.performance as { now?: () => number } | undefined;
  return typeof reloj?.now === 'function' ? reloj.now() : Date.now();
}

/**
 * Anota que una fase terminó.
 *
 * **No hace nada caro**: ni formatea, ni escribe en disco, ni registra. Una
 * medida que cuesta cambia lo que mide.
 *
 * La primera marca de cada fase manda: si algo reintenta —React monta y
 * desmonta en desarrollo—, la segunda pasada no puede falsear el arranque.
 */
export function marcar(fase: FaseDeArranque): void {
  if (marcas.has(fase)) return;
  marcas.set(fase, ahora() - inicio);
}

/**
 * Lo que se ha medido, en orden y **con la duración de cada fase**.
 *
 * Se devuelve lo que haya: un arranque que falló a la mitad es justo el que
 * hay que poder mirar, y quedarse sin datos por no estar completo sería
 * perder la única pista.
 */
export function arranque(): MarcaDeArranque[] {
  const salida: MarcaDeArranque[] = [];
  let anterior = 0;

  for (const fase of ORDEN) {
    const marca = marcas.get(fase);
    if (marca === undefined) continue;
    salida.push({ fase, ms: Math.max(0, Math.round(marca - anterior)) });
    anterior = marca;
  }
  return salida;
}

/** Cuánto llevaba la app abierta cuando se pintó la primera pantalla. */
export function totalDeArranque(): number | null {
  const total = marcas.get('primera-pantalla');
  return total === undefined ? null : Math.round(total);
}

/** Solo para las pruebas: el módulo guarda estado entre ellas. */
export function olvidarMarcas(): void {
  marcas.clear();
}
