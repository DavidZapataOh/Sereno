import { createAccount, type AccountKind } from '@/domain/ledger/account';
import type { AccountRepository } from '@/domain/ledger/account-repository';
import { accountId, ownerId } from '@/domain/ledger/ids';
import { CurrencyMismatchError, money, zero } from '@/domain/money/money';
import type { CurrencyCode } from '@/domain/money/currency';

import { createDrizzleAccountRepository } from './drizzle-account-repository';
import { postings, transactions } from './schema';
import { createTestDb } from './test-client';

type Cliente = ReturnType<typeof createTestDb>;

describe('AccountRepository sobre Drizzle', () => {
  let cliente: Cliente;
  let repo: AccountRepository;

  beforeEach(() => {
    cliente = createTestDb();
    repo = createDrizzleAccountRepository(cliente.db);
  });

  afterEach(() => {
    cliente.close();
  });

  const nuevaCuenta = (
    id: string,
    nombre: string,
    opciones: { owner?: string; kind?: AccountKind; currency?: CurrencyCode } = {},
  ) =>
    createAccount({
      id: accountId(id),
      owner: ownerId(opciones.owner ?? 'david'),
      kind: opciones.kind ?? 'activo',
      nombre,
      currency: opciones.currency ?? 'COP',
    });

  const asentar = (
    apuntes: readonly { id: string; cuenta: string; monto: string; moneda?: string }[],
    transaccion = 't1',
  ): void => {
    cliente.db
      .insert(transactions)
      .values({
        id: transaccion,
        ownerId: 'david',
        fecha: '2026-08-20T00:00:00.000Z',
        descripcion: 'X',
        fuente: 'prueba',
        referencia: null,
      })
      .run();
    cliente.db
      .insert(postings)
      .values(
        apuntes.map((a) => ({
          id: a.id,
          transactionId: transaccion,
          accountId: a.cuenta,
          amount: a.monto,
          currency: a.moneda ?? 'COP',
          nota: null,
        })),
      )
      .run();
  };

  describe('guardar y recuperar', () => {
    it('guarda y recupera una cuenta', async () => {
      const cuenta = nuevaCuenta('c1', 'Bancolombia');

      await repo.save(cuenta);

      expect(await repo.findById(accountId('c1'))).toEqual(cuenta);
    });

    it('devuelve null para una cuenta inexistente', async () => {
      expect(await repo.findById(accountId('fantasma'))).toBeNull();
    });

    it('guardar dos veces la misma cuenta la actualiza, no la duplica', async () => {
      await repo.save(nuevaCuenta('c1', 'Nombre viejo'));
      await repo.save(nuevaCuenta('c1', 'Nombre nuevo'));

      const cuenta = await repo.findById(accountId('c1'));
      expect(cuenta?.nombre).toBe('Nombre nuevo');
      expect(await repo.listByOwner(ownerId('david'))).toHaveLength(1);
    });
  });

  describe('listado por propietario', () => {
    it('lista solo las cuentas del propietario', async () => {
      await repo.save(nuevaCuenta('c1', 'Mía'));
      await repo.save(nuevaCuenta('c2', 'De otro', { owner: 'otra-persona' }));

      expect((await repo.listByOwner(ownerId('david'))).map((c) => c.id)).toEqual(['c1']);
    });

    it('no filtra las de otro propietario ni siquiera pidiendo las archivadas', async () => {
      await repo.save(nuevaCuenta('c1', 'De otro', { owner: 'otra-persona' }));
      await repo.archive(accountId('c1'), '2026-08-25T00:00:00.000Z');

      const todas = await repo.listByOwner(ownerId('david'), { incluirArchivadas: true });
      expect(todas).toEqual([]);
    });

    it('las archivadas no aparecen por defecto', async () => {
      await repo.save(nuevaCuenta('c1', 'Activa'));
      await repo.save(nuevaCuenta('c2', 'Vieja'));
      await repo.archive(accountId('c2'), '2026-08-25T00:00:00.000Z');

      expect((await repo.listByOwner(ownerId('david'))).map((c) => c.id)).toEqual(['c1']);
      expect(
        (await repo.listByOwner(ownerId('david'), { incluirArchivadas: true }))
          .map((c) => c.id)
          .sort(),
      ).toEqual(['c1', 'c2']);
    });

    it('devuelve una lista vacía cuando el propietario no tiene cuentas', async () => {
      expect(await repo.listByOwner(ownerId('nadie'))).toEqual([]);
    });
  });

  describe('saldo derivado', () => {
    it('el saldo de una cuenta sin apuntes es cero en su moneda', async () => {
      await repo.save(nuevaCuenta('c1', 'Vacía'));

      expect(await repo.balanceOf(accountId('c1'))).toEqual(zero('COP'));
    });

    it('el saldo es la suma de los apuntes de la cuenta', async () => {
      await repo.save(nuevaCuenta('c1', 'Ahorros'));
      asentar([
        { id: 'p1', cuenta: 'c1', monto: '1000000' },
        { id: 'p2', cuenta: 'c1', monto: '-45000' },
      ]);

      expect(await repo.balanceOf(accountId('c1'))).toEqual(money(955000, 'COP'));
    });

    it('los apuntes de otras cuentas no lo tocan', async () => {
      await repo.save(nuevaCuenta('c1', 'Ahorros'));
      await repo.save(nuevaCuenta('c2', 'Otra'));
      asentar([
        { id: 'p1', cuenta: 'c1', monto: '100' },
        { id: 'p2', cuenta: 'c2', monto: '-100' },
      ]);

      expect(await repo.balanceOf(accountId('c1'))).toEqual(money(100, 'COP'));
      expect(await repo.balanceOf(accountId('c2'))).toEqual(money(-100, 'COP'));
    });

    it('conserva la precisión de montos que desbordarían un entero de 64 bits', async () => {
      await repo.save(nuevaCuenta('c1', 'Wallet', { currency: 'ETH' }));
      asentar([
        { id: 'p1', cuenta: 'c1', monto: '5000000000000000000', moneda: 'ETH' },
        { id: 'p2', cuenta: 'c1', monto: '5000000000000000001', moneda: 'ETH' },
      ]);

      // 10^19 + 1 está por encima del máximo de SQLite (~9,22×10^18): si el
      // saldo pasara por INTEGER o por `number`, este dígito final se perdería.
      expect((await repo.balanceOf(accountId('c1'))).amount).toBe(10000000000000000001n);
    });

    it('falla si la cuenta no existe, en vez de fingir un saldo de cero', async () => {
      // Devolver cero haría indistinguible «cuenta vacía» de «cuenta que no
      // existe», y el segundo caso siempre es un error de quien pregunta.
      await expect(repo.balanceOf(accountId('fantasma'))).rejects.toThrow(/fantasma/);
    });

    it('falla si un apunte trae una moneda distinta a la de la cuenta', async () => {
      await repo.save(nuevaCuenta('c1', 'Ahorros'));
      asentar([
        { id: 'p1', cuenta: 'c1', monto: '100' },
        { id: 'p2', cuenta: 'c1', monto: '100', moneda: 'USD' },
      ]);

      await expect(repo.balanceOf(accountId('c1'))).rejects.toThrow(CurrencyMismatchError);
    });
  });

  describe('naturalezas distintas bajo la misma abstracción', () => {
    it('una tarjeta de crédito es un pasivo y su saldo crece hacia lo negativo', async () => {
      // Comprar con tarjeta aumenta lo que se debe. El repositorio no sabe nada
      // de tarjetas: solo guarda una cuenta de naturaleza `pasivo`, y el signo
      // sale del ledger.
      await repo.save(nuevaCuenta('tc', 'RappiPay', { kind: 'pasivo' }));
      asentar([
        { id: 'p1', cuenta: 'tc', monto: '-120000' },
        { id: 'p2', cuenta: 'tc', monto: '-80000' },
      ]);

      const cuenta = await repo.findById(accountId('tc'));
      expect(cuenta?.kind).toBe('pasivo');
      expect(await repo.balanceOf(accountId('tc'))).toEqual(money(-200000, 'COP'));
    });

    it('pagar la tarjeta acerca el saldo a cero', async () => {
      await repo.save(nuevaCuenta('tc', 'Nu', { kind: 'pasivo' }));
      asentar([{ id: 'p1', cuenta: 'tc', monto: '-200000' }]);
      asentar([{ id: 'p2', cuenta: 'tc', monto: '200000' }], 't2');

      expect(await repo.balanceOf(accountId('tc'))).toEqual(zero('COP'));
    });

    it('guarda las cinco naturalezas y las devuelve intactas', async () => {
      const naturalezas = ['activo', 'pasivo', 'ingreso', 'gasto', 'patrimonio'] as const;

      await Promise.all(
        naturalezas.map((kind, i) => repo.save(nuevaCuenta(`c${String(i)}`, kind, { kind }))),
      );

      const guardadas = await repo.listByOwner(ownerId('david'));
      expect(guardadas.map((c) => c.kind).sort()).toEqual([...naturalezas].sort());
    });
  });

  describe('archivado', () => {
    it('archivar no borra la historia de la cuenta', async () => {
      await repo.save(nuevaCuenta('c1', 'Vieja'));
      asentar([{ id: 'p1', cuenta: 'c1', monto: '500' }]);

      await repo.archive(accountId('c1'), '2026-08-25T00:00:00.000Z');

      expect((await repo.findById(accountId('c1')))?.archivedAt).toBe('2026-08-25T00:00:00.000Z');
      expect(await repo.balanceOf(accountId('c1'))).toEqual(money(500, 'COP'));
    });

    it('archivar una cuenta inexistente falla en vez de no hacer nada', async () => {
      await expect(repo.archive(accountId('fantasma'), '2026-08-25T00:00:00.000Z')).rejects.toThrow(
        /fantasma/,
      );
    });
  });
});
