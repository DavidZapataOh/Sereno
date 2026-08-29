import { sql } from 'drizzle-orm';

import { createAccount } from '@/domain/ledger/account';
import { accountId, ownerId, transactionId } from '@/domain/ledger/ids';
import type { TransactionRepository } from '@/domain/ledger/transaction-repository';
import { createTransaction, type Transaction } from '@/domain/ledger/transaction';
import { money } from '@/domain/money/money';
import { mustExist } from '@/test/must-exist';

import { createDrizzleAccountRepository } from './drizzle-account-repository';
import { createDrizzleTransactionRepository } from './drizzle-transaction-repository';
import { postings, transactions } from './schema';
import { createTestDb } from './test-client';

type Cliente = ReturnType<typeof createTestDb>;

describe('TransactionRepository sobre Drizzle', () => {
  let cliente: Cliente;
  let repo: TransactionRepository;

  beforeEach(async () => {
    cliente = createTestDb();
    repo = createDrizzleTransactionRepository(cliente.db);

    // Las cuentas existen de verdad: los apuntes tienen clave foránea contra
    // ellas, así que insertarlos sin cuenta fallaría y ocultaría lo que se
    // quiere medir.
    const cuentas = createDrizzleAccountRepository(cliente.db);
    await Promise.all(
      ['ahorros', 'gastos', 'nomina'].map((id) =>
        cuentas.save(
          createAccount({
            id: accountId(id),
            owner: ownerId('david'),
            kind: 'activo',
            nombre: id,
            currency: 'COP',
          }),
        ),
      ),
    );
  });

  afterEach(() => {
    cliente.close();
  });

  const compra = (
    id: string,
    opciones: {
      fecha?: string;
      monto?: number;
      descripcion?: string;
      fuente?: string;
      referencia?: string | null;
      owner?: string;
      cuenta?: string;
    } = {},
  ): Transaction => {
    const monto = opciones.monto ?? 45000;
    return createTransaction({
      id: transactionId(id),
      owner: ownerId(opciones.owner ?? 'david'),
      fecha: opciones.fecha ?? '2026-08-20T10:00:00.000-05:00',
      descripcion: opciones.descripcion ?? 'COMPRA EXITO',
      origen: {
        fuente: opciones.fuente ?? 'bancolombia',
        referencia: opciones.referencia === undefined ? `ref-${id}` : opciones.referencia,
      },
      postings: [
        { accountId: accountId(opciones.cuenta ?? 'ahorros'), amount: money(-monto, 'COP') },
        { accountId: accountId('gastos'), amount: money(monto, 'COP') },
      ],
    });
  };

  describe('guardar y recuperar', () => {
    it('guarda una transacción con sus apuntes y la devuelve idéntica', async () => {
      const tx = compra('t1');

      await repo.save(tx);

      expect(await repo.findById(transactionId('t1'))).toEqual(tx);
    });

    it('devuelve null para una transacción inexistente', async () => {
      expect(await repo.findById(transactionId('fantasma'))).toBeNull();
    });

    it('conserva la nota de un apunte', async () => {
      const tx = createTransaction({
        id: transactionId('t1'),
        owner: ownerId('david'),
        fecha: '2026-08-20T10:00:00.000-05:00',
        descripcion: 'Con nota',
        origen: { fuente: 'manual', referencia: null },
        postings: [
          { accountId: accountId('ahorros'), amount: money(-100, 'COP'), nota: 'la mitad' },
          { accountId: accountId('gastos'), amount: money(100, 'COP') },
        ],
      });

      await repo.save(tx);

      const leida = mustExist(await repo.findById(transactionId('t1')));
      expect(mustExist(leida.postings[0]).nota).toBe('la mitad');
      expect(mustExist(leida.postings[1]).nota).toBeUndefined();
    });

    it('conserva una referencia nula', async () => {
      await repo.save(compra('t1', { referencia: null }));

      const leida = mustExist(await repo.findById(transactionId('t1')));
      expect(leida.origen.referencia).toBeNull();
    });

    it('conserva montos que desbordarían un entero de 64 bits', async () => {
      const enorme = 10000000000000000001n;
      const tx = createTransaction({
        id: transactionId('t1'),
        owner: ownerId('david'),
        fecha: '2026-08-20T10:00:00.000-05:00',
        descripcion: 'Cripto',
        origen: { fuente: 'binance', referencia: null },
        postings: [
          { accountId: accountId('ahorros'), amount: money(-enorme, 'COP') },
          { accountId: accountId('gastos'), amount: money(enorme, 'COP') },
        ],
      });

      await repo.save(tx);

      const leida = mustExist(await repo.findById(transactionId('t1')));
      expect(mustExist(leida.postings[1]).amount.amount).toBe(enorme);
    });

    it('guardar dos veces la misma transacción la reemplaza, sin duplicar apuntes', async () => {
      await repo.save(compra('t1', { descripcion: 'Vieja' }));
      await repo.save(compra('t1', { descripcion: 'Nueva' }));

      const leida = mustExist(await repo.findById(transactionId('t1')));
      expect(leida.descripcion).toBe('Nueva');
      expect(leida.postings).toHaveLength(2);
    });
  });

  describe('atomicidad', () => {
    it('si un apunte falla, no queda la transacción a medias', async () => {
      const rota = {
        ...compra('t1'),
        postings: [
          { accountId: accountId('ahorros'), amount: money(-100, 'COP') },
          // Esta cuenta no existe: la clave foránea rechaza el apunte.
          { accountId: accountId('inventada'), amount: money(100, 'COP') },
        ],
      };

      await expect(repo.save(rota)).rejects.toThrow(/FOREIGN KEY/i);

      // Lo que importa no es que falle, sino que no deje basura detrás.
      expect(cliente.db.select().from(transactions).all()).toEqual([]);
      expect(cliente.db.select().from(postings).all()).toEqual([]);
    });

    it('un fallo en la segunda transacción no deshace la primera', async () => {
      await repo.save(compra('t1'));

      const rota = {
        ...compra('t2'),
        postings: [
          { accountId: accountId('ahorros'), amount: money(-100, 'COP') },
          { accountId: accountId('inventada'), amount: money(100, 'COP') },
        ],
      };
      await expect(repo.save(rota)).rejects.toThrow();

      expect(await repo.findById(transactionId('t1'))).not.toBeNull();
      expect(await repo.findById(transactionId('t2'))).toBeNull();
    });
  });

  describe('lectura que vuelve a validar', () => {
    it('una transacción descuadrada en la base falla al leerse, no devuelve basura', async () => {
      await repo.save(compra('t1'));
      // Se altera un apunte por debajo del repositorio, como haría una escritura
      // a mano o una migración con un fallo.
      cliente.db.run(sql`UPDATE postings SET amount = '1' WHERE transaction_id = 't1'`);

      await expect(repo.findById(transactionId('t1'))).rejects.toThrow(/cuadr/i);
    });
  });

  describe('listado paginado', () => {
    const sembrar = async (cantidad: number): Promise<void> => {
      for (let i = 0; i < cantidad; i += 1) {
        const dia = String(i + 1).padStart(2, '0');
        await repo.save(compra(`t${String(i)}`, { fecha: `2026-08-${dia}T10:00:00.000-05:00` }));
      }
    };

    it('devuelve las transacciones de la más reciente a la más antigua', async () => {
      await sembrar(3);

      const pagina = await repo.list(ownerId('david'));

      expect(pagina.items.map((t) => t.id)).toEqual(['t2', 't1', 't0']);
      expect(pagina.nextCursor).toBeNull();
    });

    it('recorre todas las páginas sin repetir ni saltarse ninguna', async () => {
      await sembrar(10);

      const vistas: string[] = [];
      let cursor: string | undefined;
      do {
        const pagina = await repo.list(ownerId('david'), undefined, { limit: 3, cursor });
        vistas.push(...pagina.items.map((t) => t.id));
        cursor = pagina.nextCursor ?? undefined;
      } while (cursor !== undefined);

      expect(vistas).toHaveLength(10);
      expect(new Set(vistas).size).toBe(10);
    });

    it('desempata por identificador cuando dos comparten fecha', async () => {
      const misma = '2026-08-20T10:00:00.000-05:00';
      await repo.save(compra('a', { fecha: misma }));
      await repo.save(compra('b', { fecha: misma }));
      await repo.save(compra('c', { fecha: misma }));

      const vistas: string[] = [];
      let cursor: string | undefined;
      do {
        const pagina = await repo.list(ownerId('david'), undefined, { limit: 2, cursor });
        vistas.push(...pagina.items.map((t) => t.id));
        cursor = pagina.nextCursor ?? undefined;
      } while (cursor !== undefined);

      // Sin desempate, el cursor sobre `fecha` sola repetiría o saltaría filas.
      expect(vistas.sort()).toEqual(['a', 'b', 'c']);
    });

    it('no devuelve transacciones de otro propietario', async () => {
      await repo.save(compra('mia'));
      await repo.save(compra('ajena', { owner: 'otra-persona' }));

      expect((await repo.list(ownerId('david'))).items.map((t) => t.id)).toEqual(['mia']);
    });

    it('rechaza un cursor corrupto en vez de devolver la primera página', async () => {
      await sembrar(2);

      await expect(
        repo.list(ownerId('david'), undefined, { cursor: 'esto-no-es-un-cursor' }),
      ).rejects.toThrow(/cursor/i);
    });
  });

  describe('filtros', () => {
    beforeEach(async () => {
      await repo.save(
        compra('vieja', { fecha: '2026-06-01T10:00:00.000-05:00', fuente: 'bancolombia' }),
      );
      await repo.save(compra('media', { fecha: '2026-07-15T10:00:00.000-05:00', fuente: 'nequi' }));
      await repo.save(
        compra('nueva', {
          fecha: '2026-08-20T10:00:00.000-05:00',
          fuente: 'bancolombia',
          cuenta: 'nomina',
        }),
      );
    });

    it('filtra desde una fecha, incluyéndola', async () => {
      const pagina = await repo.list(ownerId('david'), { desde: '2026-07-15T10:00:00.000-05:00' });

      expect(pagina.items.map((t) => t.id)).toEqual(['nueva', 'media']);
    });

    it('filtra hasta una fecha, incluyéndola', async () => {
      const pagina = await repo.list(ownerId('david'), { hasta: '2026-07-15T10:00:00.000-05:00' });

      expect(pagina.items.map((t) => t.id)).toEqual(['media', 'vieja']);
    });

    it('filtra por fuente', async () => {
      const pagina = await repo.list(ownerId('david'), { fuente: 'nequi' });

      expect(pagina.items.map((t) => t.id)).toEqual(['media']);
    });

    it('filtra por cuenta, mirando los apuntes', async () => {
      const pagina = await repo.list(ownerId('david'), { accountId: accountId('nomina') });

      expect(pagina.items.map((t) => t.id)).toEqual(['nueva']);
    });

    it('combina varios filtros', async () => {
      const pagina = await repo.list(ownerId('david'), {
        desde: '2026-07-01T00:00:00.000-05:00',
        fuente: 'bancolombia',
      });

      expect(pagina.items.map((t) => t.id)).toEqual(['nueva']);
    });
  });

  describe('deduplicación', () => {
    it('reconoce una referencia ya guardada', async () => {
      await repo.save(compra('t1', { fuente: 'bancolombia', referencia: 'REF-001' }));

      expect(await repo.existsByOrigin(ownerId('david'), 'bancolombia', 'REF-001')).toBe(true);
    });

    it('no confunde referencias de fuentes distintas', async () => {
      await repo.save(compra('t1', { fuente: 'bancolombia', referencia: 'REF-001' }));

      expect(await repo.existsByOrigin(ownerId('david'), 'nequi', 'REF-001')).toBe(false);
    });

    it('no confunde referencias de propietarios distintos', async () => {
      await repo.save(
        compra('t1', { fuente: 'bancolombia', referencia: 'REF-001', owner: 'otra-persona' }),
      );

      expect(await repo.existsByOrigin(ownerId('david'), 'bancolombia', 'REF-001')).toBe(false);
    });

    it('devuelve falso para una referencia desconocida', async () => {
      expect(await repo.existsByOrigin(ownerId('david'), 'bancolombia', 'NO-EXISTE')).toBe(false);
    });
  });

  describe('borrado', () => {
    it('borrar una transacción se lleva sus apuntes', async () => {
      await repo.save(compra('t1'));

      await repo.delete(transactionId('t1'));

      expect(await repo.findById(transactionId('t1'))).toBeNull();
      expect(cliente.db.select().from(postings).all()).toEqual([]);
    });

    it('borrar una transacción inexistente falla en vez de no hacer nada', async () => {
      await expect(repo.delete(transactionId('fantasma'))).rejects.toThrow(/fantasma/);
    });
  });
});
