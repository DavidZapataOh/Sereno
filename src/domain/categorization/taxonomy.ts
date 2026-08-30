import { accountId, type AccountId } from '@/domain/ledger/ids';
import { stripAccents } from '@/domain/text/bank-description';

/**
 * Grupos: el primer nivel. Fijos en código; el usuario crea y renombra
 * categorías dentro de ellos. Están pensados para Colombia: «familia» existe
 * porque el apoyo a padres y hermanos es un rubro real, y «finanzas» porque
 * el 4×1000 y la cuota de manejo son decenas de cobros al mes que, sueltos,
 * ensucian cualquier estadística.
 */
export const CATEGORY_GROUPS = [
  'vivienda',
  'comida',
  'transporte',
  'salud',
  'personal',
  'ocio',
  'familia',
  'finanzas',
  'otros',
  'ingresos',
] as const;
export type CategoryGroup = (typeof CATEGORY_GROUPS)[number];

export const GROUP_NAMES: Record<CategoryGroup, string> = {
  vivienda: 'Vivienda',
  comida: 'Comida',
  transporte: 'Transporte',
  salud: 'Salud',
  personal: 'Personal',
  ocio: 'Ocio',
  familia: 'Familia',
  finanzas: 'Finanzas',
  otros: 'Otros',
  ingresos: 'Ingresos',
};

export interface CategorySpec {
  slug: string;
  nombre: string;
  kind: 'gasto' | 'ingreso';
  grupo: CategoryGroup;
  /** Nombre de icono de MaterialCommunityIcons. La interfaz lo valida contra el mapa de glifos. */
  icono: string;
  orden: number;
}

export const OTHER_EXPENSES_SLUG = 'otros-gastos';
export const OTHER_INCOME_SLUG = 'otros-ingresos';

const g = (
  slug: string,
  nombre: string,
  grupo: CategoryGroup,
  icono: string,
  orden: number,
): CategorySpec => ({ slug, nombre, kind: 'gasto', grupo, icono, orden });
const i = (slug: string, nombre: string, icono: string, orden: number): CategorySpec => ({
  slug,
  nombre,
  kind: 'ingreso',
  grupo: 'ingresos',
  icono,
  orden,
});

/**
 * Categorías por defecto. No son una traducción: son los rubros en los que
 * se va el dinero en Colombia, con los nombres con los que la gente los
 * llama. Cada slug del catálogo de comercios tiene que existir aquí.
 */
export const DEFAULT_CATEGORIES: readonly CategorySpec[] = [
  // Vivienda
  g('arriendo', 'Arriendo o cuota de vivienda', 'vivienda', 'home-city', 1),
  g('administracion', 'Administración', 'vivienda', 'office-building', 2),
  g('servicios-publicos', 'Servicios públicos', 'vivienda', 'lightning-bolt', 3),
  g('internet-y-celular', 'Internet y celular', 'vivienda', 'wifi', 4),
  g('hogar', 'Hogar y mantenimiento', 'vivienda', 'hammer-wrench', 5),
  // Comida
  g('mercado', 'Mercado', 'comida', 'cart', 1),
  g('restaurantes', 'Restaurantes', 'comida', 'silverware-fork-knife', 2),
  g('domicilios', 'Domicilios', 'comida', 'moped', 3),
  g('antojos', 'Cafés y antojos', 'comida', 'coffee', 4),
  // Transporte
  g('transporte-publico', 'Transporte público', 'transporte', 'bus', 1),
  g('taxi-y-apps', 'Taxi y apps', 'transporte', 'taxi', 2),
  g('gasolina', 'Gasolina', 'transporte', 'gas-station', 3),
  g('parqueadero-y-peajes', 'Parqueadero y peajes', 'transporte', 'parking', 4),
  g('vehiculo', 'Vehículo: mantenimiento, SOAT, impuestos', 'transporte', 'car-wrench', 5),
  // Salud
  g('salud', 'EPS, prepagada y consultas', 'salud', 'hospital-box', 1),
  g('drogueria', 'Droguería', 'salud', 'pill', 2),
  g('gimnasio-y-deporte', 'Gimnasio y deporte', 'salud', 'dumbbell', 3),
  // Personal
  g('ropa', 'Ropa y calzado', 'personal', 'tshirt-crew', 1),
  g('cuidado-personal', 'Peluquería y cuidado personal', 'personal', 'content-cut', 2),
  g('educacion', 'Educación y cursos', 'personal', 'school', 3),
  g('compras', 'Compras y tecnología', 'personal', 'shopping', 4),
  g('regalos', 'Regalos', 'personal', 'gift', 5),
  g('mascotas', 'Mascotas', 'personal', 'paw', 6),
  // Ocio
  g('suscripciones', 'Suscripciones', 'ocio', 'play-circle', 1),
  g('salidas', 'Salidas y entretenimiento', 'ocio', 'glass-cocktail', 2),
  g('viajes', 'Viajes', 'ocio', 'airplane', 3),
  g('videojuegos-y-apps', 'Videojuegos y apps', 'ocio', 'gamepad-variant', 4),
  // Familia
  g('apoyo-familiar', 'Apoyo a la familia', 'familia', 'account-heart', 1),
  g('hijos', 'Hijos y colegio', 'familia', 'human-child', 2),
  // Finanzas
  g('cuatro-por-mil', '4×1000', 'finanzas', 'percent', 1),
  g('comisiones-bancarias', 'Comisiones bancarias', 'finanzas', 'bank', 2),
  g('intereses-de-credito', 'Intereses de crédito', 'finanzas', 'credit-card-clock', 3),
  g('seguros', 'Seguros', 'finanzas', 'shield-check', 4),
  g('impuestos', 'Impuestos', 'finanzas', 'file-document', 5),
  // Otros
  g(OTHER_EXPENSES_SLUG, 'Otros gastos', 'otros', 'dots-horizontal', 1),
  // Ingresos
  i('salario', 'Salario', 'cash-multiple', 1),
  i('honorarios', 'Honorarios y freelance', 'briefcase', 2),
  i('ventas', 'Ventas', 'tag', 3),
  i('rendimientos', 'Intereses y rendimientos', 'trending-up', 4),
  i('reembolsos', 'Devoluciones y reembolsos', 'cash-refund', 5),
  i('apoyos-recibidos', 'Regalos y apoyos recibidos', 'hand-heart', 6),
  i(OTHER_INCOME_SLUG, 'Otros ingresos', 'dots-horizontal', 7),
];

const PREFIJO = 'categoria:';

export function categoryAccountId(slug: string): AccountId {
  return accountId(`${PREFIJO}${slug}`);
}

export function isCategoryAccount(id: AccountId): boolean {
  return id.startsWith(PREFIJO);
}

export function slugOf(id: AccountId): string {
  if (!isCategoryAccount(id)) throw new Error(`"${id}" no es una cuenta de categoría`);
  return id.slice(PREFIJO.length);
}

/** De un nombre escrito por el usuario a un slug estable. */
export function slugify(nombre: string): string {
  const slug = stripAccents(nombre)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (slug.length === 0) throw new Error('El nombre no sirve para identificar la categoría');
  return slug;
}
