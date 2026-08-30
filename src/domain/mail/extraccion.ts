import { COLOMBIA_UTC_OFFSET } from '@/domain/time/colombia';

/** `$45.000`, `$170,000.00`, `COP 45.000`, `350.000`. */
const MONTO = /(?:\$|cop)?\s*(\d[\d.,]*)/i;

/**
 * El primer monto del texto, en pesos enteros.
 *
 * **Bancolombia mezcla los dos formatos en el mismo emisor**: manda
 * `$10.700,00` (punto de miles) y `$170,000.00` (coma de miles) según la
 * plantilla del correo. Asumir uno solo convertiría 170.000 pesos en 170, sin
 * que nada fallara. Lo destaparon los correos reales de David.
 *
 * La regla que los distingue: **tres dígitos tras el último separador nunca
 * son centavos**, porque el peso no usa milésimas. Uno o dos, sí. Los
 * centavos se truncan: redondear inventa pesos que el banco no movió.
 */
export function montoColombiano(texto: string): number | null {
  const token = MONTO.exec(texto)?.[1];
  if (token === undefined) return null;

  const corte = Math.max(token.lastIndexOf('.'), token.lastIndexOf(','));
  if (corte === -1) {
    const simple = Number(token);
    return Number.isSafeInteger(simple) ? simple : null;
  }
  const esSeparadorDeMiles = token.length - corte - 1 === 3;
  const entero = esSeparadorDeMiles ? token : token.slice(0, corte);
  const valor = Number(entero.replace(/[.,]/g, ''));
  return Number.isSafeInteger(valor) ? valor : null;
}

const MESES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];
const ABREVIADOS = [
  'ene',
  'feb',
  'mar',
  'abr',
  'may',
  'jun',
  'jul',
  'ago',
  'sep',
  'oct',
  'nov',
  'dic',
];

const ISO = /(\d{4})-(\d{2})-(\d{2})/;
const NUMERICA = /(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/;
/** `10 de julio de 2026`, `05/Jul/2026`, `25 ago 2026`, `10 mayo 2026`. */
const CON_MES = /(\d{1,2})[/\s-]+(?:de\s+)?([a-záéíóú]{3,10})\.?[/\s-]+(?:de\s+)?(\d{4})/i;
const HORA = /(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(a\.?\s?m\.?|p\.?\s?m\.?)?/i;

const dosDigitos = (n: number): string => String(n).padStart(2, '0');

function mesDesde(nombre: string): number | null {
  const limpio = nombre.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const largo = MESES.indexOf(limpio);
  if (largo !== -1) return largo + 1;
  const corto = ABREVIADOS.indexOf(limpio.slice(0, 3));
  return corto === -1 ? null : corto + 1;
}

function existe(anio: number, mes: number, dia: number): boolean {
  if (mes < 1 || mes > 12 || dia < 1) return false;
  return dia <= new Date(Date.UTC(anio, mes, 0)).getUTCDate();
}

/** `26` es 2026: los bancos escriben el año corto y nadie manda alertas de 1926. */
const anioCompleto = (n: number): number => (n < 100 ? 2000 + n : n);

/**
 * La primera fecha del texto, en hora de Colombia.
 *
 * Un correo bancario colombiano no trae zona: interpretarlo en UTC movería al
 * día siguiente todo lo de después de las siete de la tarde. Y los emisores
 * escriben la hora de varias maneras —24 horas, `a. m.`, `p.m`, `PM`—: leer
 * mal el meridiano mueve un movimiento doce horas, y con eso, de día.
 */
export function fechaColombiana(texto: string): string | null {
  let anio: number | undefined;
  let mes: number | undefined;
  let dia: number | undefined;

  const iso = ISO.exec(texto);
  const conMes = CON_MES.exec(texto);
  const numerica = NUMERICA.exec(texto);

  if (iso !== null) {
    [anio, mes, dia] = [Number(iso[1]), Number(iso[2]), Number(iso[3])];
  } else if (conMes !== null) {
    const encontrado = mesDesde(conMes[2] ?? '');
    if (encontrado === null) return null;
    [anio, mes, dia] = [Number(conMes[3]), encontrado, Number(conMes[1])];
  } else if (numerica !== null) {
    [dia, mes, anio] = [
      Number(numerica[1]),
      Number(numerica[2]),
      anioCompleto(Number(numerica[3])),
    ];
  } else {
    return null;
  }
  if (!existe(anio, mes, dia)) return null;

  const hora = HORA.exec(texto);
  let hh = Number(hora?.[1] ?? 0);
  const mm = Number(hora?.[2] ?? 0);
  const ss = Number(hora?.[3] ?? 0);
  const meridiano = hora?.[4]?.toLowerCase().replace(/[.\s]/g, '');
  if (meridiano === 'pm' && hh < 12) hh += 12;
  if (meridiano === 'am' && hh === 12) hh = 0;

  return `${String(anio)}-${dosDigitos(mes)}-${dosDigitos(dia)}T${dosDigitos(hh)}:${dosDigitos(mm)}:${dosDigitos(ss)}.000${COLOMBIA_UTC_OFFSET}`;
}

const ENTIDADES: Record<string, string> = {
  nbsp: ' ',
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  aacute: 'á',
  eacute: 'é',
  iacute: 'í',
  oacute: 'ó',
  uacute: 'ú',
  ntilde: 'ñ',
  Aacute: 'Á',
  Eacute: 'É',
  Iacute: 'Í',
  Oacute: 'Ó',
  Uacute: 'Ú',
  Ntilde: 'Ñ',
};

/** HTML a texto legible: sin etiquetas, sin entidades y sin espacios de sobra. */
export function textoPlano(html: string): string {
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<br\s*\/?>|<\/p>|<\/div>|<\/tr>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#(\d+);/g, (_, codigo: string) => String.fromCodePoint(Number(codigo)))
    .replace(/&#x([0-9a-f]+);/gi, (_, codigo: string) => String.fromCodePoint(parseInt(codigo, 16)))
    .replace(/&([a-z]+);/gi, (entera, nombre: string) => ENTIDADES[nombre] ?? entera)
    .replace(/[ \t ]+/g, ' ')
    .replace(/\s*\n\s*/g, ' ')
    .trim();
}

/** El texto del correo, o el HTML aplanado si no vino texto. */
export function cuerpoDe(m: { texto: string; html: string | null }): string {
  if (m.texto.trim().length > 0) return m.texto.trim();
  return m.html === null ? '' : textoPlano(m.html);
}
