import { ownerId, type OwnerId } from '@/domain/ledger/ids';

/**
 * Un solo usuario hoy. Cuando haya cuentas de usuario (sprint 06), esto pasa
 * a leerse de la sesión; nada más cambia, porque todo ya filtra por propietario.
 */
export const CURRENT_OWNER: OwnerId = ownerId('local');
