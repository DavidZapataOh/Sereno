/**
 * Aritmética de meses, en un solo sitio.
 *
 * Estaba copiada en seis archivos de `application/`: `mesAnterior` y `finDe`
 * idénticas carácter por carácter en tres, `mesesAntes` en dos y `diasAntes` en
 * uno más. No era un problema de estilo: **una de las copias devolvía
 * `2026-02-31`**, un día que no existe, y arreglarla no habría arreglado las
 * otras cinco porque nadie sabía cuáles estaban mal.
 *
 * Todo se escribe `AAAA-MM` o `AAAA-MM-DD`, y se compara como texto, que es lo
 * que hace el resto del proyecto con las fechas del ledger.
 */
const MES = /^\d{4}-(0[1-9]|1[0-2])$/;
const DIA = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

/** La hora de Colombia. El ledger guarda las fechas con este desfase. */
const HUSO = '-05:00';

function exigirMes(mes: string): [number, number] {
  if (!MES.test(mes)) throw new Error(`Un mes se escribe AAAA-MM, no "${mes}"`);
  const [anio = 1970, m = 1] = mes.split('-').map(Number);
  return [anio, m];
}

function exigirDia(dia: string): [number, number, number] {
  if (!DIA.test(dia)) throw new Error(`Un día se escribe AAAA-MM-DD, no "${dia}"`);
  const [anio = 1970, m = 1, d = 1] = dia.split('-').map(Number);
  // Y además tiene que existir: «2026-02-31» encaja con el patrón y no es un
  // día. Aceptarlo es cómo se cuela un día inexistente en un cálculo, que es
  // justo el fallo que este módulo viene a arreglar.
  if (d > diasDelMes(anio, m)) throw new Error(`Un día se escribe AAAA-MM-DD, no "${dia}"`);
  return [anio, m, d];
}

function comoMes(anio: number, mes: number): string {
  return `${String(anio).padStart(4, '0')}-${String(mes).padStart(2, '0')}`;
}

/** Cuántos días tiene un mes de verdad. Febrero incluido, y los bisiestos. */
export function diasDelMes(anio: number, mes: number): number {
  return new Date(Date.UTC(anio, mes, 0)).getUTCDate();
}

export function mesAnterior(mes: string): string {
  const [anio, m] = exigirMes(mes);
  return m === 1 ? comoMes(anio - 1, 12) : comoMes(anio, m - 1);
}

export function mesSiguiente(mes: string): string {
  const [anio, m] = exigirMes(mes);
  return m === 12 ? comoMes(anio + 1, 1) : comoMes(anio, m + 1);
}

/**
 * El instante en que un mes termina, como cadena comparable.
 *
 * Es el primer instante del mes siguiente: se usa como cota superior con
 * `<=` o `<`, igual que el resto de las consultas del ledger.
 */
export function finDeMes(mes: string): string {
  return `${mesSiguiente(mes)}-01T00:00:00.000${HUSO}`;
}

/**
 * Un día, `n` meses antes. **Recorta al último día que exista.**
 *
 * El 31 de marzo menos un mes no es el 31 de febrero: es el 28 —o el 29 en
 * bisiesto—, que es lo que hace cualquier calendario. Las dos copias que había
 * devolvían `2026-02-31`, y hoy no rompía nada porque las fechas se comparan
 * como texto y el corte caía donde debía; el día que alguien lo convirtiera a
 * `Date`, se habría vuelto el 3 de marzo y una métrica habría empezado a mentir
 * sin fallar.
 */
export function mesesAntes(dia: string, n: number): string {
  const [anio, m, d] = exigirDia(dia);
  const total = anio * 12 + (m - 1) - n;
  const nuevoAnio = Math.floor(total / 12);
  const nuevoMes = (total % 12) + 1;
  const tope = diasDelMes(nuevoAnio, nuevoMes);
  return `${comoMes(nuevoAnio, nuevoMes)}-${String(Math.min(d, tope)).padStart(2, '0')}`;
}

/** Un día, `n` días antes. */
export function diasAntes(dia: string, n: number): string {
  exigirDia(dia);
  // Mediodía UTC para que ningún cambio de hora mueva el día resultante.
  const fecha = new Date(`${dia}T12:00:00.000Z`);
  fecha.setUTCDate(fecha.getUTCDate() - n);
  return fecha.toISOString().slice(0, 10);
}

/** El mes al que pertenece una fecha del ledger. */
export function mesDe(fecha: string): string {
  return fecha.slice(0, 7);
}
