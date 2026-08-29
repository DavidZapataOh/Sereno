import { array, assert, asyncProperty, constantFrom, oneof, record, integer } from 'fast-check';

import { createAccount } from '@/domain/ledger/account';
import { accountId, ownerId, transactionId } from '@/domain/ledger/ids';
import { createTransaction } from '@/domain/ledger/transaction';
import { money } from '@/domain/money/money';
import { isoDate, positiveAmount } from '@/test/arbitraries';

import { createDrizzleAccountRepository } from './drizzle-account-repository';
import { createDrizzleTransactionRepository } from './drizzle-transaction-repository';
import { checkLedger } from './ledger-check';
import { createTestDb } from './test-client';

const owner = ownerId('david');
const CUENTAS = ['banco', 'tarjeta', 'gasto', 'ingreso'] as const;

type Operacion =
  | {
      tipo: 'guardar';
      indice: number;
      desde: string;
      hacia: string;
      monto: number;
      fecha: string;
    }
  | { tipo: 'borrar'; indice: number }
  | { tipo: 'reguardar'; indice: number; monto: number };

const operacion = oneof(
  record({
    tipo: constantFrom('guardar' as const),
    indice: integer({ min: 0, max: 19 }),
    desde: constantFrom(...CUENTAS),
    hacia: constantFrom(...CUENTAS),
    monto: positiveAmount,
    fecha: isoDate,
  }),
  record({
    tipo: constantFrom('borrar' as const),
    indice: integer({ min: 0, max: 19 }),
  }),
  record({
    tipo: constantFrom('reguardar' as const),
    indice: integer({ min: 0, max: 19 }),
    monto: positiveAmount,
  }),
);

/**
 * Propiedades del sistema completo.
 *
 * Los casos concretos comprueban las corrupciones que se me ocurrieron a mí.
 * Esto comprueba que ninguna secuencia de operaciones legítimas —cientos,
 * generadas al azar y en cualquier orden— deje el ledger descuadrado. Es la
 * diferencia entre «no encontré cómo romperlo» y «no se puede romper así».
 */
describe('propiedades del ledger completo', () => {
  jest.setTimeout(120_000);

  it('ninguna secuencia de operaciones deja el ledger descuadrado', async () => {
    await assert(
      asyncProperty(array(operacion as never, { minLength: 1, maxLength: 40 }), async (ops) => {
        const cliente = createTestDb();
        try {
          const cuentas = createDrizzleAccountRepository(cliente.db);
          const transacciones = createDrizzleTransactionRepository(cliente.db);

          await Promise.all(
            CUENTAS.map((id) =>
              cuentas.save(
                createAccount({
                  id: accountId(id),
                  owner,
                  kind: 'activo',
                  nombre: id,
                  currency: 'COP',
                }),
              ),
            ),
          );

          const guardadas = new Set<string>();

          for (const op of ops as Operacion[]) {
            const id = `t${String(op.indice).padStart(2, '0')}`;

            if (op.tipo === 'borrar') {
              if (guardadas.has(id)) {
                await transacciones.delete(transactionId(id));
                guardadas.delete(id);
              }
              continue;
            }

            if (op.tipo === 'reguardar' && !guardadas.has(id)) continue;

            const desde = op.tipo === 'guardar' ? op.desde : CUENTAS[0];
            const hacia = op.tipo === 'guardar' && op.hacia !== op.desde ? op.hacia : CUENTAS[1];
            const fecha = op.tipo === 'guardar' ? op.fecha : '2026-01-01T00:00:00.000Z';

            await transacciones.save(
              createTransaction({
                id: transactionId(id),
                owner,
                fecha,
                descripcion: `Operación ${id}`,
                origen: { fuente: 'propiedad', referencia: id },
                postings: [
                  { accountId: accountId(desde), amount: money(-op.monto, 'COP') },
                  { accountId: accountId(hacia), amount: money(op.monto, 'COP') },
                ],
              }),
            );
            guardadas.add(id);
          }

          const reporte = checkLedger(cliente.db);
          expect(reporte.violaciones).toEqual([]);
          expect(reporte.revisado.transacciones).toBe(guardadas.size);
        } finally {
          cliente.close();
        }
      }),
      { numRuns: 40 },
    );
  });

  it('la suma de los saldos de todas las cuentas es siempre cero', async () => {
    await assert(
      asyncProperty(array(operacion as never, { minLength: 1, maxLength: 25 }), async (ops) => {
        const cliente = createTestDb();
        try {
          const cuentas = createDrizzleAccountRepository(cliente.db);
          const transacciones = createDrizzleTransactionRepository(cliente.db);

          await Promise.all(
            CUENTAS.map((id) =>
              cuentas.save(
                createAccount({
                  id: accountId(id),
                  owner,
                  kind: 'activo',
                  nombre: id,
                  currency: 'COP',
                }),
              ),
            ),
          );

          for (const [indice, op] of (ops as Operacion[]).entries()) {
            if (op.tipo === 'borrar') continue;
            const desde = op.tipo === 'guardar' ? op.desde : CUENTAS[0];
            const hacia = op.tipo === 'guardar' && op.hacia !== op.desde ? op.hacia : CUENTAS[1];

            await transacciones.save(
              createTransaction({
                id: transactionId(`t${String(indice)}`),
                owner,
                fecha: '2026-01-01T00:00:00.000Z',
                descripcion: 'Movimiento',
                origen: { fuente: 'propiedad', referencia: `r${String(indice)}` },
                postings: [
                  { accountId: accountId(desde), amount: money(-op.monto, 'COP') },
                  { accountId: accountId(hacia), amount: money(op.monto, 'COP') },
                ],
              }),
            );
          }

          // La ecuación contable, comprobada a través de los saldos derivados y
          // no de los apuntes: si `balanceOf` tuviera un fallo de filtrado, la
          // suma dejaría de dar cero aunque el ledger estuviera bien.
          const saldos = await Promise.all(CUENTAS.map((id) => cuentas.balanceOf(accountId(id))));
          const total = saldos.reduce((acc, saldo) => acc + saldo.amount, 0n);

          expect(total).toBe(0n);
        } finally {
          cliente.close();
        }
      }),
      { numRuns: 30 },
    );
  });
});
