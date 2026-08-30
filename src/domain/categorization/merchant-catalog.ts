/**
 * Marcas que aparecen en los extractos colombianos, con el nombre legible y
 * la categoría que casi siempre les corresponde.
 *
 * Los patrones se aplican sobre texto ya limpio (`basicClean`): minúsculas,
 * sin acentos, sin prefijo del banco. El primero que coincide gana, así que
 * lo específico va antes que lo general («didi food» antes que «didi»).
 *
 * `categoria` es un slug del plan 02. `null` significa «esto no es un
 * gasto»: una transferencia a otro banco o un retiro, que el sprint 04 ya
 * trata como movimiento entre cuentas propias.
 */
export interface CatalogEntry {
  patron: RegExp;
  nombre: string;
  categoria: string | null;
}

export const MERCHANT_CATALOG: readonly CatalogEntry[] = [
  // --- Mercado ---
  { patron: /\bexito\b/, nombre: 'Éxito', categoria: 'mercado' },
  { patron: /\bcarulla\b/, nombre: 'Carulla', categoria: 'mercado' },
  { patron: /\bd1\b/, nombre: 'D1', categoria: 'mercado' },
  { patron: /\bara\b/, nombre: 'Ara', categoria: 'mercado' },
  { patron: /\bjumbo\b/, nombre: 'Jumbo', categoria: 'mercado' },
  { patron: /\bolimpica\b/, nombre: 'Olímpica', categoria: 'mercado' },
  { patron: /\bpricesmart\b/, nombre: 'PriceSmart', categoria: 'mercado' },
  { patron: /\bmakro\b/, nombre: 'Makro', categoria: 'mercado' },
  { patron: /\balkosto\b/, nombre: 'Alkosto', categoria: 'hogar' },
  { patron: /\boxxo\b/, nombre: 'Oxxo', categoria: 'antojos' },

  // --- Domicilios y restaurantes ---
  { patron: /\brappi\b/, nombre: 'Rappi', categoria: 'domicilios' },
  { patron: /\bdidi food\b/, nombre: 'DiDi Food', categoria: 'domicilios' },
  { patron: /\bifood\b/, nombre: 'iFood', categoria: 'domicilios' },
  { patron: /\bcrepes\b/, nombre: 'Crepes & Waffles', categoria: 'restaurantes' },
  { patron: /\bfrisby\b/, nombre: 'Frisby', categoria: 'restaurantes' },
  { patron: /\bmc ?donald/, nombre: "McDonald's", categoria: 'restaurantes' },
  { patron: /\bkfc\b/, nombre: 'KFC', categoria: 'restaurantes' },
  { patron: /\bsubway\b/, nombre: 'Subway', categoria: 'restaurantes' },
  { patron: /\bel corral\b/, nombre: 'El Corral', categoria: 'restaurantes' },
  { patron: /\bjuan valdez\b/, nombre: 'Juan Valdez', categoria: 'antojos' },
  { patron: /\btostao\b/, nombre: 'Tostao', categoria: 'antojos' },
  { patron: /\bstarbucks\b/, nombre: 'Starbucks', categoria: 'antojos' },

  // --- Transporte ---
  { patron: /\buber\b/, nombre: 'Uber', categoria: 'taxi-y-apps' },
  { patron: /\bdidi\b/, nombre: 'DiDi', categoria: 'taxi-y-apps' },
  { patron: /\bcabify\b/, nombre: 'Cabify', categoria: 'taxi-y-apps' },
  { patron: /\bindrive\b/, nombre: 'inDrive', categoria: 'taxi-y-apps' },
  {
    patron: /\btransmilenio\b|\btullave\b/,
    nombre: 'TransMilenio',
    categoria: 'transporte-publico',
  },
  {
    patron: /\bmetro de medellin\b|\bcivica\b/,
    nombre: 'Metro de Medellín',
    categoria: 'transporte-publico',
  },
  { patron: /\bterpel\b/, nombre: 'Terpel', categoria: 'gasolina' },
  { patron: /\bprimax\b/, nombre: 'Primax', categoria: 'gasolina' },
  { patron: /\bmobil\b/, nombre: 'Mobil', categoria: 'gasolina' },
  { patron: /\bbiomax\b/, nombre: 'Biomax', categoria: 'gasolina' },
  { patron: /\bflypass\b/, nombre: 'Flypass', categoria: 'parqueadero-y-peajes' },

  // --- Servicios ---
  { patron: /\bclaro\b/, nombre: 'Claro', categoria: 'internet-y-celular' },
  { patron: /\bmovistar\b/, nombre: 'Movistar', categoria: 'internet-y-celular' },
  { patron: /\btigo\b/, nombre: 'Tigo', categoria: 'internet-y-celular' },
  { patron: /\bwom\b/, nombre: 'WOM', categoria: 'internet-y-celular' },
  { patron: /\betb\b/, nombre: 'ETB', categoria: 'internet-y-celular' },
  { patron: /\bepm\b/, nombre: 'EPM', categoria: 'servicios-publicos' },
  { patron: /\benel\b|\bcodensa\b/, nombre: 'Enel', categoria: 'servicios-publicos' },
  { patron: /\bvanti\b|\bgas natural\b/, nombre: 'Vanti', categoria: 'servicios-publicos' },
  { patron: /\bacueducto\b|\beaab\b/, nombre: 'Acueducto', categoria: 'servicios-publicos' },
  { patron: /\bemcali\b/, nombre: 'Emcali', categoria: 'servicios-publicos' },

  // --- Salud ---
  { patron: /\bfarmatodo\b/, nombre: 'Farmatodo', categoria: 'drogueria' },
  { patron: /\bcruz verde\b/, nombre: 'Cruz Verde', categoria: 'drogueria' },
  { patron: /\bla rebaja\b/, nombre: 'La Rebaja', categoria: 'drogueria' },
  { patron: /\bcolsubsidio\b/, nombre: 'Colsubsidio', categoria: 'drogueria' },
  { patron: /\bsmart ?fit\b/, nombre: 'Smart Fit', categoria: 'gimnasio-y-deporte' },
  { patron: /\bbodytech\b/, nombre: 'Bodytech', categoria: 'gimnasio-y-deporte' },

  // --- Hogar y compras ---
  { patron: /\bhomecenter\b/, nombre: 'Homecenter', categoria: 'hogar' },
  { patron: /\bfalabella\b/, nombre: 'Falabella', categoria: 'ropa' },
  { patron: /\bzara\b/, nombre: 'Zara', categoria: 'ropa' },
  { patron: /\bh&m\b|\bh m hennes\b/, nombre: 'H&M', categoria: 'ropa' },
  { patron: /\barturo calle\b/, nombre: 'Arturo Calle', categoria: 'ropa' },
  {
    patron: /\bmercadolibre\b|\bmercado libre\b|\bmeli\b/,
    nombre: 'Mercado Libre',
    categoria: 'compras',
  },
  { patron: /\bamazon prime\b|\bprime video\b/, nombre: 'Prime Video', categoria: 'suscripciones' },
  { patron: /\bamazon\b/, nombre: 'Amazon', categoria: 'compras' },
  { patron: /\baliexpress\b/, nombre: 'AliExpress', categoria: 'compras' },
  { patron: /\btemu\b/, nombre: 'Temu', categoria: 'compras' },
  { patron: /\bshein\b/, nombre: 'Shein', categoria: 'ropa' },

  // --- Ocio y suscripciones ---
  { patron: /\bnetflix\b/, nombre: 'Netflix', categoria: 'suscripciones' },
  { patron: /\bspotify\b/, nombre: 'Spotify', categoria: 'suscripciones' },
  { patron: /\byoutube\b/, nombre: 'YouTube', categoria: 'suscripciones' },
  { patron: /\bdisney\b/, nombre: 'Disney+', categoria: 'suscripciones' },
  { patron: /\bhbo\b|\bmax\b/, nombre: 'Max', categoria: 'suscripciones' },
  { patron: /\bapple\b|\bitunes\b/, nombre: 'Apple', categoria: 'suscripciones' },
  { patron: /\bgoogle\b/, nombre: 'Google', categoria: 'suscripciones' },
  { patron: /\bopenai\b|\bchatgpt\b/, nombre: 'OpenAI', categoria: 'suscripciones' },
  { patron: /\bcine ?colombia\b/, nombre: 'Cine Colombia', categoria: 'salidas' },
  { patron: /\bcinemark\b/, nombre: 'Cinemark', categoria: 'salidas' },
  { patron: /\bsteam\b/, nombre: 'Steam', categoria: 'videojuegos-y-apps' },
  {
    patron: /\bplaystation\b|\bsony interactive\b/,
    nombre: 'PlayStation',
    categoria: 'videojuegos-y-apps',
  },
  { patron: /\bnintendo\b/, nombre: 'Nintendo', categoria: 'videojuegos-y-apps' },

  // --- Viajes ---
  { patron: /\bavianca\b/, nombre: 'Avianca', categoria: 'viajes' },
  { patron: /\blatam\b/, nombre: 'LATAM', categoria: 'viajes' },
  { patron: /\bwingo\b/, nombre: 'Wingo', categoria: 'viajes' },
  { patron: /\bairbnb\b/, nombre: 'Airbnb', categoria: 'viajes' },
  { patron: /\bbooking\b/, nombre: 'Booking', categoria: 'viajes' },

  // --- Banco: cobros propios ---
  {
    patron: /\b4x1000\b|\bgmf\b|\bimpto gobierno\b|\bimpuesto gobierno\b/,
    nombre: '4×1000',
    categoria: 'cuatro-por-mil',
  },
  {
    patron: /\bcuota (de )?manejo\b/,
    nombre: 'Cuota de manejo',
    categoria: 'comisiones-bancarias',
  },
  { patron: /\bcomision\b/, nombre: 'Comisión bancaria', categoria: 'comisiones-bancarias' },
  {
    patron: /\bintereses?\b.*\b(credito|tarjeta|prestamo)\b/,
    nombre: 'Intereses de crédito',
    categoria: 'intereses-de-credito',
  },

  // --- Dinero entre cuentas propias: no es gasto ---
  { patron: /\bnequi\b/, nombre: 'Nequi', categoria: null },
  { patron: /\bdaviplata\b/, nombre: 'Daviplata', categoria: null },
  {
    patron: /\bcajero\b|\bretiro\b.*\b(atm|efectivo|corresponsal)\b/,
    nombre: 'Retiro en cajero',
    categoria: null,
  },

  // --- Ingresos ---
  { patron: /\bnomina\b|\bsalario\b|\bsueldo\b/, nombre: 'Nómina', categoria: 'salario' },
];

export const CATALOG_SLUGS: readonly string[] = [
  ...new Set(MERCHANT_CATALOG.map((e) => e.categoria).filter((c): c is string => c !== null)),
];

/** Primera entrada que reconoce el texto limpio, o `null`. */
export function findInCatalog(limpia: string): CatalogEntry | null {
  return MERCHANT_CATALOG.find((e) => e.patron.test(limpia)) ?? null;
}
