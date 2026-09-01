/**
 * Los días 29, 30 y 31 no existen todos los meses.
 *
 * Aceptarlos empujaría el problema a quien calcula ciclos o vencimientos, donde
 * ya no se sabría si un «31» fue un error de quien lo escribió o una decisión
 * que hay que respetar en febrero.
 *
 * Vive aquí y no en `cards/` porque lo usan las tarjetas (sprint 07) y las
 * deudas (sprint 09): la misma regla escrita dos veces se corrige una sola.
 */
export const DIA_MAXIMO = 28;

export function validarDiaDelMes(dia: number, nombre: string): void {
  if (!Number.isInteger(dia) || dia < 1 || dia > DIA_MAXIMO) {
    throw new Error(`El ${nombre} debe estar entre 1 y ${String(DIA_MAXIMO)}`);
  }
}
