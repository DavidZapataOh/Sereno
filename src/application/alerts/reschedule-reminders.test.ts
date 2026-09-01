import { createCreditCard } from '@/domain/cards/card';
import { AJUSTES_POR_DEFECTO } from '@/domain/alerts/reminder-settings';
import { createAccount } from '@/domain/ledger/account';
import { accountId, ownerId, transactionId } from '@/domain/ledger/ids';
import { systemAccountId } from '@/domain/ledger/system-accounts';
import { createTransaction } from '@/domain/ledger/transaction';
import { money } from '@/domain/money/money';
import { createInMemoryAccountRepository } from '@/test/fakes/in-memory-account-repository';
import { createInMemoryCardRepository } from '@/test/fakes/in-memory-card-repository';
import { createInMemoryCategoryRepository } from '@/test/fakes/in-memory-category-repository';
import { createInMemoryClassificationRepository } from '@/test/fakes/in-memory-classification-repository';
import { createInMemoryDebtRepository } from '@/test/fakes/in-memory-debt-repository';
import { createInMemoryIngestRepository } from '@/test/fakes/in-memory-ingest-repository';
import { createInMemoryTransactionRepository } from '@/test/fakes/in-memory-transaction-repository';
import { createInMemoryTransferRepository } from '@/test/fakes/in-memory-transfer-repository';

import { ensureSystemAccounts } from '../ledger/ensure-system-accounts';

import { rescheduleReminders, type RescheduleDeps, type Scheduler } from './reschedule-reminders';

const owner = ownerId('david');
const tarjeta = accountId('rappicard:tarjeta');
const HOY = '2026-09-01T08:00:00.000-05:00';

/** Un planificador de mentira que recuerda qué se le pidió y en qué orden. */
function schedulerDoble() {
  const llamadas: string[] = [];
  let programados: { id: string }[] = [];
  let permiso = true;
  const scheduler: Scheduler = {
    pedirPermiso: () => {
      llamadas.push('permiso');
      return Promise.resolve(permiso);
    },
    cancelarTodo: () => {
      llamadas.push('cancelar');
      programados = [];
      return Promise.resolve();
    },
    programar: (avisos) => {
      llamadas.push('programar');
      programados = [...avisos];
      return Promise.resolve(avisos.length);
    },
  };
  return {
    scheduler,
    llamadas: () => llamadas,
    programados: () => programados,
    sinPermiso: () => {
      permiso = false;
    },
  };
}

async function deps(ajustes = AJUSTES_POR_DEFECTO) {
  const accounts = createInMemoryAccountRepository();
  const transactions = createInMemoryTransactionRepository(accounts.postings);
  await ensureSystemAccounts(accounts, owner);
  await accounts.save(
    createAccount({ id: tarjeta, owner, kind: 'pasivo', nombre: 'RappiCard', currency: 'COP' }),
  );
  const cards = createInMemoryCardRepository();
  await cards.save(
    createCreditCard({
      accountId: tarjeta,
      owner,
      cupo: money(2_000_000, 'COP'),
      diaDeCorte: 15,
      diaDePago: 5,
    }),
  );
  const doble = schedulerDoble();

  const d: RescheduleDeps = {
    accounts,
    transactions,
    ingest: createInMemoryIngestRepository(),
    transfers: createInMemoryTransferRepository(),
    categories: createInMemoryCategoryRepository(),
    classifications: createInMemoryClassificationRepository(),
    cards,
    debts: createInMemoryDebtRepository(),
    clock: () => HOY,
    scheduler: doble.scheduler,
    ajustesDeAviso: ajustes,
  };
  return { ...d, doble, transactions };
}

describe('rescheduleReminders', () => {
  it('cancela lo viejo y programa lo del calendario de hoy', async () => {
    const d = await deps();

    const r = await rescheduleReminders(d, { owner });

    expect(r.motivo).toBe('ok');
    expect(r.programados).toBeGreaterThan(0);
  });

  /** Cancelar después de programar dejaría el teléfono sin ningún aviso. */
  it('cancela antes de programar, no después', async () => {
    const d = await deps();
    await rescheduleReminders(d, { owner });

    const llamadas = d.doble.llamadas();
    expect(llamadas.indexOf('cancelar')).toBeLessThan(llamadas.indexOf('programar'));
  });

  /**
   * La propiedad que da reprogramar entero: pagar algo quita su aviso sin que
   * nadie lo cancele a mano.
   */
  it('lo que se pagó desde el último arranque deja de estar programado', async () => {
    const d = await deps();
    const antes = (await rescheduleReminders(d, { owner })).programados;

    // Se paga la tarjeta dentro de la ventana del ciclo que vence el 5.
    await d.transactions.save(
      createTransaction({
        id: transactionId('pago'),
        owner,
        fecha: '2026-09-02T10:00:00.000-05:00',
        descripcion: 'Pago',
        origen: { fuente: 'manual', referencia: null },
        postings: [
          { accountId: tarjeta, amount: money(300_000, 'COP') },
          { accountId: systemAccountId('ajustes'), amount: money(-300_000, 'COP') },
        ],
      }),
    );

    expect((await rescheduleReminders(d, { owner })).programados).toBeLessThan(antes);
  });

  it('sin permiso devuelve el motivo, no un error', async () => {
    const d = await deps();
    d.doble.sinPermiso();

    await expect(rescheduleReminders(d, { owner })).resolves.toEqual({
      programados: 0,
      motivo: 'sin-permiso',
    });
  });

  /** Silenciado tiene que cancelar: si no, seguirían sonando los de antes. */
  it('silenciado cancela lo que hubiera y no programa nada', async () => {
    const d = await deps({ ...AJUSTES_POR_DEFECTO, silenciado: true });

    const r = await rescheduleReminders(d, { owner });

    expect(r).toEqual({ programados: 0, motivo: 'silenciado' });
    expect(d.doble.llamadas()).toContain('cancelar');
  });

  it('dos arranques seguidos dejan los mismos avisos, no el doble', async () => {
    const d = await deps();
    const primero = await rescheduleReminders(d, { owner });
    const segundo = await rescheduleReminders(d, { owner });

    expect(segundo.programados).toBe(primero.programados);
    expect(new Set(d.doble.programados().map((a) => a.id)).size).toBe(segundo.programados);
  });
});
