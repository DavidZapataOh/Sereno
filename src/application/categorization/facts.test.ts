import { createAccount, type Account } from '@/domain/ledger/account';
import { accountId, ownerId, transactionId, type AccountId } from '@/domain/ledger/ids';
import { systemAccountId } from '@/domain/ledger/system-accounts';
import { createTransaction } from '@/domain/ledger/transaction';
import { money } from '@/domain/money/money';

import { factsOf } from './facts';

const owner = ownerId('david');
const ahorros = accountId('bancolombia:ahorros');
const cuenta = (id: AccountId, kind: Account['kind'], nombre: string): [AccountId, Account] => [
  id,
  createAccount({ id, owner, kind, nombre, currency: 'COP' }),
];
const cuentas = new Map<AccountId, Account>([
  cuenta(ahorros, 'activo', 'Bancolombia'),
  cuenta(systemAccountId('gastos-sin-clasificar'), 'gasto', 'Sin clasificar'),
  cuenta(systemAccountId('efectivo'), 'activo', 'Efectivo'),
]);

it('deriva comercio, descripción limpia, monto y sentido', () => {
  const tx = createTransaction({
    id: transactionId('bancolombia:C1'),
    owner,
    fecha: '2026-08-30T00:00:00.000-05:00',
    descripcion: 'COMPRA PSE *4471 EXITO SUR',
    origen: { fuente: 'bancolombia', referencia: 'C1' },
    postings: [
      { accountId: ahorros, amount: money(-45000, 'COP') },
      { accountId: systemAccountId('gastos-sin-clasificar'), amount: money(45000, 'COP') },
    ],
  });
  expect(factsOf(tx, cuentas)).toMatchObject({
    comercio: 'exito',
    descripcion: 'exito',
    monto: money(45000, 'COP'),
    sentido: 'gasto',
  });
  expect(factsOf(tx, cuentas).merchant.nombre).toBe('Éxito');
});

it('una transferencia no tiene sentido de gasto ni ingreso', () => {
  const tx = createTransaction({
    id: transactionId('bancolombia:R1'),
    owner,
    fecha: '2026-08-30T00:00:00.000-05:00',
    descripcion: 'RETIRO CAJERO',
    origen: { fuente: 'bancolombia', referencia: 'R1' },
    postings: [
      { accountId: ahorros, amount: money(-40000, 'COP') },
      { accountId: systemAccountId('efectivo'), amount: money(40000, 'COP') },
    ],
  });
  expect(factsOf(tx, cuentas).sentido).toBeNull();
});
