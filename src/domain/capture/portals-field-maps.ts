import { createExtractor, type FieldMap } from './extractor';

/**
 * Movimientos de Bancolombia, descubiertos en la validación de campo del
 * 2026-08-29 sobre Sucursal Virtual Personas.
 *
 * Endpoint:
 *   POST /super-svp/api/v1/security-filters/ch-ms-deposits/account/transactions
 *
 * CUIDADO CON `type`. Bancolombia nombra los movimientos desde la perspectiva
 * del banco, no del cliente:
 *
 *   su `CREDITO`  → COMPRA, RETIRO, PAGO      → dinero que SALE  → nuestro débito
 *   su `DEBITO`   → ABONO, CONSIGNACION       → dinero que ENTRA → nuestro crédito
 *
 * Verificado sobre 180 transacciones reales: de las 103 marcadas `CREDITO`, 71
 * son compras o retiros y ninguna es un ingreso. Tomarlo al pie de la letra
 * invertiría todos los gastos e ingresos de la aplicación.
 */
export const BANCOLOMBIA_MOVIMIENTOS: FieldMap = {
  listPath: 'data.transactions',
  fecha: 'transactionDate',
  descripcion: 'description',
  monto: 'amount',
  referencia: 'reference1',
  tipo: { path: 'type', debito: 'CREDITO' },
};

export const extractBancolombia = createExtractor('bancolombia', BANCOLOMBIA_MOVIMIENTOS);
