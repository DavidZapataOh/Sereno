import { createAccount, type Account, type AccountKind } from './account';
import { accountId, type AccountId, type OwnerId } from './ids';

export const SYSTEM_ACCOUNT_KEYS = [
  'gastos-sin-clasificar',
  'ingresos-sin-clasificar',
  'efectivo',
  'ajustes',
] as const;

export type SystemAccountKey = (typeof SYSTEM_ACCOUNT_KEYS)[number];

const PREFIJO = 'sistema:';

/**
 * Cuentas que la aplicación necesita para que el ledger cuadre sin que el
 * usuario haya clasificado nada todavía.
 *
 * - Las dos «sin clasificar» son la contraparte de todo lo ingerido hasta que
 *   el sprint 05 lo reclasifique.
 * - «Efectivo» es un activo: el retiro en cajero es una transferencia hacia
 *   aquí, no un gasto.
 * - «Ajustes» es patrimonio: una corrección manual o de conciliación cuadra
 *   contra esta cuenta y no contamina ni ingresos ni gastos.
 */
const ESPECIFICACION: Record<SystemAccountKey, { kind: AccountKind; nombre: string }> = {
  'gastos-sin-clasificar': { kind: 'gasto', nombre: 'Gastos sin clasificar' },
  'ingresos-sin-clasificar': { kind: 'ingreso', nombre: 'Ingresos sin clasificar' },
  efectivo: { kind: 'activo', nombre: 'Efectivo' },
  ajustes: { kind: 'patrimonio', nombre: 'Ajustes' },
};

export function systemAccountId(key: SystemAccountKey): AccountId {
  return accountId(`${PREFIJO}${key}`);
}

export function systemAccount(owner: OwnerId, key: SystemAccountKey): Account {
  const spec = ESPECIFICACION[key];
  return createAccount({
    id: systemAccountId(key),
    owner,
    kind: spec.kind,
    nombre: spec.nombre,
    currency: 'COP',
  });
}

export function isSystemAccount(id: AccountId): boolean {
  return id.startsWith(PREFIJO);
}

export function isUnclassified(id: AccountId): boolean {
  return (
    id === systemAccountId('gastos-sin-clasificar') ||
    id === systemAccountId('ingresos-sin-clasificar')
  );
}

/**
 * Id de la cuenta de una fuente externa.
 *
 * Determinista a propósito: dos sincronizaciones de la misma cuenta bancaria
 * tienen que caer en la misma cuenta del ledger sin buscarla por nombre.
 */
export function sourceAccountId(fuente: string, numero = 'ahorros'): AccountId {
  return accountId(`${fuente}:${numero}`);
}
