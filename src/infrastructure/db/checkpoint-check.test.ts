import { createAccount } from '@/domain/ledger/account';
import { accountId, ownerId, transactionId } from '@/domain/ledger/ids';
import { createTransaction } from '@/domain/ledger/transaction';
import { money } from '@/domain/money/money';

import { checkCheckpoints } from './checkpoint-check';
import { createDrizzleCheckpointRepository } from './drizzle-checkpoint-repository';
import { createDrizzleAccountRepository } from './drizzle-account-repository';
import { createDrizzleTransactionRepository } from './drizzle-transaction-repository';
import { balanceCheckpoints } from './schema';
import { createTestDb } from './test-client';

const owner = ownerId('david');
const banco = accountId('banco');
const gasto = accountId('categoria:mercado');

async function montar() {
  const cliente = createTestDb();
  const cuentas = createDrizzleAccountRepository(cliente.db);
  const transacciones = createDrizzleTransactionRepository(cliente.db);
  const cortes = createDrizzleCheckpointRepository(cliente.db);

  await cuentas.save(
    createAccount({ id: banco, owner, kind: 'activo', nombre: 'Banco', currency: 'COP' }),
  );
  await cuentas.save(
    createAccount({ id: gasto, owner, kind: 'gasto', nombre: 'Mercado', currency: 'COP' }),
  );
  await transacciones.save(
    createTransaction({
      id: transactionId('t1'),
      owner,
      fecha: '2026-04-10T10:00:00.000-05:00',
      descripcion: 'Compra',
      origen: { fuente: 'siembra', referencia: 't1' },
      postings: [
        { accountId: banco, amount: money(-1000, 'COP') },
        { accountId: gasto, amount: money(1000, 'COP') },
      ],
    }),
  );
  await cortes.reconstruir('2026-08', '2026-09-01T10:00:00.000-05:00');
  return { cliente, cortes };
}

describe('checkCheckpoints', () => {
  it('con los cortes recién calculados, no hay diferencias', async () => {
    const { cliente } = await montar();
    try {
      const reporte = checkCheckpoints(cliente.db);

      expect(reporte.sano).toBe(true);
      expect(reporte.revisados).toBeGreaterThan(0);
    } finally {
      cliente.close();
    }
  });

  /**
   * La comprobación se ve fallar a propósito: una guarda que nunca se vio
   * fallar no se sabe si funciona.
   */
  it('detecta un corte que no coincide con el cálculo desde cero', async () => {
    const { cliente } = await montar();
    try {
      // Se corrompe un corte a mano, como lo dejaría una invalidación mal hecha.
      cliente.db.update(balanceCheckpoints).set({ amount: '999999' }).run();

      const reporte = checkCheckpoints(cliente.db);

      expect(reporte.sano).toBe(false);
      expect(reporte.diferencias[0]?.guardado).toBe(999999n);
    } finally {
      cliente.close();
    }
  });

  it('sin cortes no hay nada que revisar, y eso no es un fallo', () => {
    const cliente = createTestDb();
    try {
      expect(checkCheckpoints(cliente.db)).toEqual({ revisados: 0, diferencias: [], sano: true });
    } finally {
      cliente.close();
    }
  });
});
