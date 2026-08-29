export interface Factory<T> {
  /** Construye un objeto, sobrescribiendo los campos indicados. */
  build: (overrides?: Partial<T>) => T;
  /** Construye una lista, opcionalmente variando cada elemento por índice. */
  buildList: (count: number, perIndex?: (index: number) => Partial<T>) => T[];
  /** Deriva una factory con otros valores por defecto, sin alterar la original. */
  extend: (overrides: Partial<T>) => Factory<T>;
}

/**
 * Define una factory de datos de prueba.
 *
 * `defaults` es una función y no un objeto para que cada llamada produzca
 * instancias independientes: compartir referencias entre pruebas es una fuente
 * clásica de fallos que solo aparecen según el orden de ejecución.
 */
export function defineFactory<T extends object>(defaults: () => T): Factory<T> {
  const build = (overrides: Partial<T> = {}): T => ({ ...defaults(), ...overrides });

  return {
    build,
    buildList: (count, perIndex) =>
      Array.from({ length: count }, (_, index) => build(perIndex ? perIndex(index) : {})),
    extend: (extendOverrides) => defineFactory<T>(() => ({ ...defaults(), ...extendOverrides })),
  };
}
