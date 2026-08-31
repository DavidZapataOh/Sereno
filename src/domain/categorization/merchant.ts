import { basicClean } from '@/domain/text/bank-description';

import { findInCatalog } from './merchant-catalog';

/**
 * Un comercio tal como se muestra y se agrupa.
 *
 * - `nombre`: lo que ve el usuario. Del catálogo si la marca se conoce; si
 *   no, la descripción limpia con mayúsculas iniciales.
 * - `clave`: por lo que se agrupa y por lo que aprende el clasificador. Dos
 *   variantes de sucursal («Éxito Sur», «Éxito Calle 80») comparten clave.
 * - `conocido`: si vino del catálogo.
 * - `categoriaSugerida`: slug de categoría del plan 02, o `null`.
 *
 * La descripción original de la transacción no se toca nunca: esto se
 * deriva al mostrar, y si el catálogo mejora, mejora todo el historial.
 */
export interface Merchant {
  nombre: string;
  clave: string;
  conocido: boolean;
  categoriaSugerida: string | null;
}

/** Palabras que distinguen sucursales o ciudades, no comercios. */
const CALIFICADORES = new Set([
  'sur',
  'norte',
  'centro',
  'oriente',
  'occidente',
  'este',
  'oeste',
  'calle',
  'cll',
  'carrera',
  'cra',
  'kr',
  'avenida',
  'av',
  'diagonal',
  'dg',
  'transversal',
  'tv',
  'cc',
  'c.c',
  'plaza',
  'mall',
  'local',
  'sede',
  'sucursal',
  'sas',
  'sa',
  'ltda',
  'bogota',
  'medellin',
  'cali',
  'barranquilla',
  'cartagena',
  'bucaramanga',
  'pereira',
  'manizales',
  'cucuta',
  'ibague',
  'villavicencio',
  'armenia',
  'pasto',
  'neiva',
  'monteria',
  'colombia',
  'col',
  'co',
]);
const PALABRAS_MINUSCULAS = new Set(['de', 'la', 'el', 'los', 'las', 'y', 'del', 'en', 'a']);

/**
 * Palabras que no nombran a nadie.
 *
 * «Transferencia a la cuenta *3218502671» se queda en «la cuenta» al quitarle
 * el prefijo del banco y el número: el título del movimiento salía **«La
 * Cuenta»**, que no dice nada. Lo cazó David en campo el 2026-08-30, con su
 * primera transferencia de verdad.
 *
 * Aquí no hay comercio, y fingir uno es peor que no tenerlo: se muestra la
 * frase del banco entera, que sí dice a dónde fue la plata.
 */
const RELLENO = new Set([...PALABRAS_MINUSCULAS, 'cuenta', 'cuentas', 'llave', 'llaves']);

function esSoloRelleno(limpia: string): boolean {
  const palabras = limpia.split(' ').filter((p) => p.length > 0);
  return palabras.length > 0 && palabras.every((p) => RELLENO.has(p));
}

/**
 * Descripción sin ruido del banco ni calificadores de sucursal. Un
 * calificador corta la descripción: lo que sigue es dirección o ciudad. Si
 * al quitarlos no queda nada, se conservan: «SUR» a secas es un comercio
 * que se llama Sur.
 */
export function cleanDescription(raw: string): string {
  const base = basicClean(raw);
  const sinCalificadores: string[] = [];
  for (const palabra of base.split(' ')) {
    if (palabra.length === 0) continue;
    if (CALIFICADORES.has(palabra)) break;
    sinCalificadores.push(palabra);
  }
  const limpia = sinCalificadores.join(' ').trim();
  return limpia.length > 0 ? limpia : base;
}

/** Palabras de la descripción limpia para el clasificador: 2+ letras, sin números sueltos, sin repetir. */
export function tokensOf(raw: string): string[] {
  const vistas = new Set<string>();
  for (const palabra of cleanDescription(raw).split(' ')) {
    const limpia = palabra.replace(/[^a-z0-9]/g, '');
    if (limpia.length < 2 || /^\d+$/.test(limpia)) continue;
    vistas.add(limpia);
  }
  return [...vistas];
}

export function titleCase(texto: string): string {
  return texto
    .split(' ')
    .map((p, i) =>
      i > 0 && PALABRAS_MINUSCULAS.has(p) ? p : p.charAt(0).toUpperCase() + p.slice(1),
    )
    .join(' ');
}

export function merchantOf(raw: string): Merchant {
  const base = basicClean(raw);
  const entrada = findInCatalog(base);
  if (entrada !== null) {
    return {
      nombre: entrada.nombre,
      // La clave sale del nombre, no del patrón: estable aunque el patrón cambie.
      clave: basicClean(entrada.nombre),
      conocido: true,
      categoriaSugerida: entrada.categoria,
    };
  }
  const limpia = cleanDescription(raw);
  if (esSoloRelleno(limpia)) {
    // La frase entera, con su número de cuenta: es lo único informativo que
    // hay. Se agrupa por la primera palabra —«transferencia», «pago»—, no por
    // el número, que es distinto en cada movimiento.
    // Tal como la escribió el banco: aquí no hay nada que embellecer, y
    // `titleCase` sobre una frase deja «a la Cuenta».
    const frase = raw.replace(/\s+/g, ' ').trim();
    return {
      nombre: frase,
      clave: basicClean(raw.split(' ')[0] ?? frase),
      conocido: false,
      categoriaSugerida: null,
    };
  }
  const clave = limpia.split(' ').slice(0, 2).join(' ');
  return {
    nombre: titleCase(limpia),
    clave: clave.length > 0 ? clave : limpia,
    conocido: false,
    categoriaSugerida: null,
  };
}

export interface CoverageReport {
  total: number;
  conocidos: number;
  proporcion: number;
  desconocidos: { clave: string; veces: number }[];
}

/** Qué parte de unas descripciones reconoce el catálogo, y qué falta, por frecuencia. */
export function merchantCoverage(descripciones: readonly string[]): CoverageReport {
  const desconocidos = new Map<string, number>();
  let conocidos = 0;
  for (const d of descripciones) {
    const m = merchantOf(d);
    if (m.conocido) conocidos += 1;
    else desconocidos.set(m.clave, (desconocidos.get(m.clave) ?? 0) + 1);
  }
  return {
    total: descripciones.length,
    conocidos,
    proporcion: descripciones.length === 0 ? 0 : conocidos / descripciones.length,
    desconocidos: [...desconocidos.entries()]
      .map(([clave, veces]) => ({ clave, veces }))
      .sort((a, b) => {
        const porVeces = b.veces - a.veces;
        return porVeces !== 0 ? porVeces : a.clave.localeCompare(b.clave);
      }),
  };
}
