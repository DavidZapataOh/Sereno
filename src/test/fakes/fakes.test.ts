import { createAccount } from '@/domain/ledger/account';
import { accountId, ownerId, transactionId } from '@/domain/ledger/ids';
import { createTransaction } from '@/domain/ledger/transaction';
import { money } from '@/domain/money/money';

import { createInMemoryAccountRepository } from './in-memory-account-repository';
import { createInMemoryBatchRepository } from './in-memory-batch-repository';
import { createInMemoryMailSource } from './in-memory-mail-source';
import { createInMemoryCategoryRepository } from './in-memory-category-repository';
import { createInMemoryClassificationRepository } from './in-memory-classification-repository';
import { createInMemoryEvidenceRepository } from './in-memory-evidence-repository';
import { createInMemoryIngestRepository } from './in-memory-ingest-repository';
import { createInMemoryRuleRepository } from './in-memory-rule-repository';
import { createInMemoryTransactionRepository } from './in-memory-transaction-repository';
import { createSequentialIds } from './sequential-ids';

const owner = ownerId('david');

describe('createSequentialIds', () => {
  it('genera ids predecibles y distintos', () => {
    const ids = createSequentialIds('tx');
    expect(ids.next()).toBe('tx-1');
    expect(ids.next()).toBe('tx-2');
  });
});

describe('createInMemoryAccountRepository', () => {
  it('guarda, recupera y deriva el saldo de los apuntes guardados', async () => {
    const cuentas = createInMemoryAccountRepository();
    await cuentas.save(
      createAccount({ id: accountId('a'), owner, kind: 'activo', nombre: 'A', currency: 'COP' }),
    );

    expect(await cuentas.findById(accountId('a'))).not.toBeNull();
    expect((await cuentas.balanceOf(accountId('a'))).amount).toBe(0n);
    expect(await cuentas.listByOwner(owner)).toHaveLength(1);
  });

  it('balanceOf lanza para una cuenta inexistente, como el real', async () => {
    const cuentas = createInMemoryAccountRepository();
    await expect(cuentas.balanceOf(accountId('nada'))).rejects.toThrow(/nada/);
  });
});

describe('createInMemoryTransactionRepository', () => {
  const tx = (id: string, fecha: string) =>
    createTransaction({
      id: transactionId(id),
      owner,
      fecha,
      descripcion: 'X',
      origen: { fuente: 'prueba', referencia: id },
      postings: [
        { accountId: accountId('a'), amount: money(-100, 'COP') },
        { accountId: accountId('b'), amount: money(100, 'COP') },
      ],
    });

  it('guardar dos veces el mismo id reemplaza, no duplica', async () => {
    const repo = createInMemoryTransactionRepository();
    await repo.save(tx('t1', '2026-08-20T00:00:00.000-05:00'));
    await repo.save(tx('t1', '2026-08-21T00:00:00.000-05:00'));
    expect(repo.all()).toHaveLength(1);
  });

  it('mantiene los apuntes del doble de cuentas, con la fecha de su transacción', async () => {
    const cuentas = createInMemoryAccountRepository();
    await cuentas.save(
      createAccount({ id: accountId('a'), owner, kind: 'activo', nombre: 'A', currency: 'COP' }),
    );
    const repo = createInMemoryTransactionRepository(cuentas.postings);
    await repo.save(tx('t1', '2026-08-20T00:00:00.000-05:00'));
    await repo.save(tx('t2', '2026-08-25T00:00:00.000-05:00'));

    expect((await cuentas.balanceOf(accountId('a'))).amount).toBe(-200n);
    expect(
      (await cuentas.balanceOf(accountId('a'), { hasta: '2026-08-21T00:00:00.000-05:00' })).amount,
    ).toBe(-100n);
    await repo.delete(transactionId('t1'));
    expect((await cuentas.balanceOf(accountId('a'))).amount).toBe(-100n);
  });

  it('lista por fecha descendente y filtra por rango y cuenta', async () => {
    const repo = createInMemoryTransactionRepository();
    await repo.save(tx('vieja', '2026-06-01T00:00:00.000-05:00'));
    await repo.save(tx('nueva', '2026-08-20T00:00:00.000-05:00'));

    const todas = await repo.list(owner);
    expect(todas.items.map((t) => t.id)).toEqual(['nueva', 'vieja']);

    const desde = await repo.list(owner, { desde: '2026-07-01T00:00:00.000-05:00' });
    expect(desde.items.map((t) => t.id)).toEqual(['nueva']);

    const porCuenta = await repo.list(owner, { accountId: accountId('zzz') });
    expect(porCuenta.items).toEqual([]);
  });

  it('pagina por cursor', async () => {
    const repo = createInMemoryTransactionRepository();
    await repo.save(tx('a', '2026-08-01T00:00:00.000-05:00'));
    await repo.save(tx('b', '2026-08-02T00:00:00.000-05:00'));
    await repo.save(tx('c', '2026-08-03T00:00:00.000-05:00'));

    const primera = await repo.list(owner, undefined, { limit: 2 });
    expect(primera.items.map((t) => t.id)).toEqual(['c', 'b']);
    const segunda = await repo.list(owner, undefined, {
      limit: 2,
      cursor: primera.nextCursor ?? undefined,
    });
    expect(segunda.items.map((t) => t.id)).toEqual(['a']);
    expect(segunda.nextCursor).toBeNull();
  });

  it('existsByOrigin y delete se comportan como el real', async () => {
    const repo = createInMemoryTransactionRepository();
    await repo.save(tx('t1', '2026-08-20T00:00:00.000-05:00'));
    expect(await repo.existsByOrigin(owner, 'prueba', 't1')).toBe(true);
    await repo.delete(transactionId('t1'));
    expect(await repo.findById(transactionId('t1'))).toBeNull();
    await expect(repo.delete(transactionId('t1'))).rejects.toThrow(/t1/);
  });
});

describe('createInMemoryIngestRepository', () => {
  const corrida = (id: string, iniciadoEn: string) => ({
    id,
    owner,
    fuente: 'bancolombia',
    iniciadoEn,
    terminadoEn: null,
    capturas: 0,
    extraidas: 0,
    nuevas: 0,
    duplicadas: 0,
    fusionadas: 0,
    omitidas: 0,
    anteriores: 0,
    transferencias: 0,
    error: null,
  });

  it('la última corrida es la de iniciadoEn mayor, no la guardada de último', async () => {
    const repo = createInMemoryIngestRepository();
    await repo.saveRun(corrida('nueva', '2026-08-28T10:00:00.000-05:00'));
    await repo.saveRun(corrida('vieja', '2026-08-20T10:00:00.000-05:00'));
    expect((await repo.findLastRun(owner, 'bancolombia'))?.id).toBe('nueva');
    expect(await repo.findLastRun(owner, 'nequi')).toBeNull();
  });

  it('encuentra por origen y por huella, y borra', async () => {
    const repo = createInMemoryIngestRepository();
    const o = {
      id: 't1@bancolombia',
      transactionId: transactionId('t1'),
      owner,
      fuente: 'bancolombia',
      referencia: 'REF-1',
      huella: 'h1',
      capturadoEn: '2026-08-28T10:00:00.000-05:00',
      runId: null,
      crudo: {
        fecha: '2026/08/28',
        descripcion: 'X',
        monto: 1,
        moneda: 'COP' as const,
        tipo: 'debito' as const,
        fuente: 'bancolombia' as const,
        referencia: 'REF-1',
      },
    };
    await repo.saveObservation(o);
    expect((await repo.findObservationByOrigin(owner, 'bancolombia', 'REF-1'))?.id).toBe(o.id);
    expect(await repo.findObservationsByFingerprint(owner, ['h0', 'h1'])).toHaveLength(1);
    expect(await repo.listObservations(transactionId('t1'))).toHaveLength(1);
    await repo.deleteObservation(o.id);
    expect(await repo.listObservations(transactionId('t1'))).toEqual([]);
  });
});

describe('createInMemoryCategoryRepository', () => {
  it('guarda el detalle, lo encuentra, lo lista por propietario y no confunde propietarios', async () => {
    const repo = createInMemoryCategoryRepository();
    const detalle = {
      accountId: accountId('categoria:mercado'),
      owner: ownerId('david'),
      grupo: 'comida' as const,
      icono: 'cart',
      orden: 1,
    };
    await repo.saveDetails(detalle);
    await repo.saveDetails({
      ...detalle,
      accountId: accountId('categoria:otra'),
      owner: ownerId('otro'),
    });
    expect(await repo.findDetails(accountId('categoria:mercado'))).toEqual(detalle);
    expect(await repo.listDetails(ownerId('david'))).toEqual([detalle]);
    expect(await repo.findDetails(accountId('categoria:nada'))).toBeNull();
  });
});

describe('createInMemoryClassificationRepository', () => {
  it('guardar reemplaza por transacción, lista filtra por origen y borrar lo inexistente no lanza', async () => {
    const repo = createInMemoryClassificationRepository();
    const base = {
      transactionId: transactionId('bancolombia:C1'),
      owner: ownerId('david'),
      categoria: accountId('categoria:mercado'),
      origen: 'aprendida' as const,
      reglaId: null,
      confianza: 70,
      clasificadoEn: '2026-08-30T10:00:00.000-05:00',
    };
    await repo.save(base);
    await repo.save({ ...base, origen: 'manual', confianza: 100 });
    expect(await repo.findByTransaction(base.transactionId)).toMatchObject({ origen: 'manual' });
    expect(await repo.listByOwner(ownerId('david'), { origen: 'manual' })).toHaveLength(1);
    expect(await repo.listByOwner(ownerId('david'), { origen: 'regla' })).toEqual([]);
    await expect(repo.delete(transactionId('bancolombia:nada'))).resolves.toBeUndefined();
  });
});

describe('createInMemoryRuleRepository', () => {
  it('guarda, encuentra, lista por propietario y borra', async () => {
    const repo = createInMemoryRuleRepository();
    const regla = {
      id: 'r1',
      owner: ownerId('david'),
      campo: 'comercio' as const,
      operador: 'es' as const,
      valor: 'exito',
      categoria: accountId('categoria:mercado'),
      creadaEn: '2026-08-30T10:00:00.000-05:00',
      activa: true,
    };
    await repo.save(regla);
    await repo.save({ ...regla, id: 'r2', owner: ownerId('otro') });
    expect(await repo.findById('r1')).toEqual(regla);
    expect(await repo.listByOwner(ownerId('david'))).toEqual([regla]);
    await repo.delete('r1');
    expect(await repo.findById('r1')).toBeNull();
  });
});

describe('createInMemoryEvidenceRepository', () => {
  it('suma, no baja de cero, lista solo lo pedido del propietario y suma por categoría', async () => {
    const repo = createInMemoryEvidenceRepository();
    const owner = ownerId('david');
    const mercado = accountId('categoria:mercado');
    await repo.add(owner, ['comercio:exito', 'palabra:exito'], mercado, 1);
    await repo.add(owner, ['comercio:exito'], mercado, 1);
    await repo.add(ownerId('otro'), ['comercio:exito'], mercado, 1);
    expect(await repo.listByFeatures(owner, ['comercio:exito'])).toEqual([
      { feature: 'comercio:exito', categoria: mercado, cuenta: 2 },
    ]);
    for (const _ of [1, 2, 3]) await repo.add(owner, ['comercio:exito'], mercado, -1);
    expect(await repo.listByFeatures(owner, ['comercio:exito'])).toEqual([]);
    expect(await repo.countByCategory(owner)).toEqual(new Map([[mercado, 1]]));
    expect(await repo.vocabularySize(owner)).toBe(1);
  });
});

describe('createInMemoryBatchRepository', () => {
  it('guarda, encuentra y el último es el más reciente no deshecho', async () => {
    const repo = createInMemoryBatchRepository();
    const lote = (id: string, creadoEn: string, deshechoEn: string | null = null) => ({
      id,
      owner: ownerId('david'),
      comercio: 'x',
      cambios: [],
      reglaId: null,
      creadoEn,
      deshechoEn,
    });
    await repo.save(lote('b1', '2026-08-30T10:00:00.000Z'));
    await repo.save(lote('b2', '2026-08-30T11:00:00.000Z', '2026-08-30T12:00:00.000Z'));
    expect((await repo.findById('b2'))?.deshechoEn).not.toBeNull();
    expect((await repo.findLatest(ownerId('david')))?.id).toBe('b1');
    expect(await repo.findLatest(ownerId('otro'))).toBeNull();
  });
});

describe('createInMemoryMailSource', () => {
  const correo = (id: string) => ({
    id,
    remitente: 'somos@nequi.com.co',
    asunto: 'Pago',
    recibidoEn: '2026-08-30T10:00:00.000-05:00',
    texto: 'x',
    html: null,
  });

  it('respeta el límite, avanza el cursor y la segunda vez sigue donde iba', async () => {
    const fuente = createInMemoryMailSource([correo('a'), correo('b'), correo('c')]);

    const primera = await fuente.buscar(null, 2);
    expect(primera.mensajes.map((m) => m.id)).toEqual(['a', 'b']);
    expect(primera.cursor).toEqual({ tipo: 'imap', valor: '2' });

    const segunda = await fuente.buscar(primera.cursor, 2);
    expect(segunda.mensajes.map((m) => m.id)).toEqual(['c']);
    expect(fuente.peticiones()).toBe(2);
  });

  it('sin nada nuevo devuelve vacío y no retrocede el cursor', async () => {
    const fuente = createInMemoryMailSource([correo('a')]);
    const r = await fuente.buscar({ tipo: 'imap', valor: '1' }, 10);
    expect(r.mensajes).toEqual([]);
    expect(r.cursor.valor).toBe('1');
  });
});
