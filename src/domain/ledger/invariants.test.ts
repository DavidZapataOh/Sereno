import { money } from '@/domain/money/money';
import { mustExist } from '@/test/must-exist';

import { createAccount } from './account';
import { accountId, ownerId, transactionId } from './ids';
import {
  checkAccountsExist,
  checkAllInvariants,
  checkGlobalBalance,
  checkPostingCurrencies,
  checkTransactionsBalance,
  checkTransactionShape,
} from './invariants';
import { createTransaction, type Posting, type Transaction } from './transaction';

const owner = ownerId('david');
const banco = accountId('banco');
const gasto = accountId('gasto');
const wallet = accountId('wallet');

const cuentas = [
  createAccount({ id: banco, owner, kind: 'activo', nombre: 'Banco', currency: 'COP' }),
  createAccount({ id: gasto, owner, kind: 'gasto', nombre: 'Gasto', currency: 'COP' }),
  createAccount({ id: wallet, owner, kind: 'activo', nombre: 'Wallet', currency: 'ETH' }),
];

const tx = (id: string, monto: number): Transaction =>
  createTransaction({
    id: transactionId(id),
    owner,
    fecha: '2026-08-20T00:00:00.000Z',
    descripcion: 'Compra',
    origen: { fuente: 'p', referencia: null },
    postings: [
      { accountId: banco, amount: money(-monto, 'COP') },
      { accountId: gasto, amount: money(monto, 'COP') },
    ],
  });

/**
 * Transacción corrupta.
 *
 * Se construye sin pasar por `createTransaction` a propósito: el constructor la
 * rechazaría, y lo que se quiere simular es exactamente lo que el constructor no
 * puede impedir, que es una corrupción posterior en la base.
 */
const corrupta = (id: string, postings: Posting[]): Transaction => ({
  ...tx(id, 100),
  postings,
});

describe('checkTransactionsBalance', () => {
  it('no reporta nada cuando todas cuadran', () => {
    expect(checkTransactionsBalance([tx('t1', 100), tx('t2', 200)])).toEqual([]);
  });

  it('reporta una transacción descuadrada nombrándola', () => {
    const violaciones = checkTransactionsBalance([
      corrupta('t1', [
        { accountId: banco, amount: money(-100, 'COP') },
        { accountId: gasto, amount: money(90, 'COP') },
      ]),
    ]);

    expect(violaciones).toHaveLength(1);
    expect(mustExist(violaciones[0]).invariante).toBe('transaccion-cuadrada');
    expect(mustExist(violaciones[0]).detalle).toContain('t1');
  });

  it('reporta todas las rotas, no solo la primera', () => {
    const rota = (id: string): Transaction =>
      corrupta(id, [
        { accountId: banco, amount: money(-100, 'COP') },
        { accountId: gasto, amount: money(90, 'COP') },
      ]);

    // Saber si falló una transacción o mil es la diferencia entre un dato
    // corrupto y un fallo sistemático.
    expect(checkTransactionsBalance([rota('t1'), tx('t2', 50), rota('t3')])).toHaveLength(2);
  });
});

describe('checkGlobalBalance', () => {
  it('la suma de todos los apuntes es cero', () => {
    expect(checkGlobalBalance([...tx('t1', 100).postings, ...tx('t2', 200).postings])).toEqual([]);
  });

  it('reporta el descuadre global nombrando la moneda', () => {
    const violaciones = checkGlobalBalance([
      { accountId: banco, amount: money(-100, 'COP') },
      { accountId: gasto, amount: money(90, 'COP') },
    ]);

    expect(violaciones).toHaveLength(1);
    expect(mustExist(violaciones[0]).invariante).toBe('suma-global-cero');
    expect(mustExist(violaciones[0]).detalle).toContain('COP');
    expect(mustExist(violaciones[0]).detalle).toContain('-10');
  });

  it('detecta un apunte suelto aunque cada transacción cuadre por separado', () => {
    // Este es el caso que `checkTransactionsBalance` no puede ver: las dos
    // transacciones cuadran, pero hay un apunte que entró sin pareja.
    const apuntes = [...tx('t1', 100).postings, { accountId: gasto, amount: money(7, 'COP') }];

    expect(checkGlobalBalance(apuntes)).toHaveLength(1);
  });

  it('cuadra cada moneda por separado', () => {
    const apuntes: Posting[] = [
      { accountId: banco, amount: money(-100, 'COP') },
      { accountId: gasto, amount: money(100, 'COP') },
      { accountId: wallet, amount: money(5n, 'ETH') },
    ];

    const violaciones = checkGlobalBalance(apuntes);
    expect(violaciones).toHaveLength(1);
    expect(mustExist(violaciones[0]).detalle).toContain('ETH');
  });

  it('no reporta nada con una lista vacía', () => {
    expect(checkGlobalBalance([])).toEqual([]);
  });
});

describe('checkAccountsExist', () => {
  it('no reporta nada cuando todas las cuentas existen', () => {
    expect(checkAccountsExist([...tx('t1', 100).postings], cuentas)).toEqual([]);
  });

  it('reporta una cuenta referenciada que no existe', () => {
    const violaciones = checkAccountsExist(
      [{ accountId: accountId('inventada'), amount: money(1, 'COP') }],
      cuentas,
    );

    expect(violaciones).toHaveLength(1);
    expect(mustExist(violaciones[0]).invariante).toBe('cuenta-existe');
    expect(mustExist(violaciones[0]).detalle).toContain('inventada');
  });

  it('reporta cada cuenta faltante una sola vez, no una por apunte', () => {
    const fantasma = accountId('inventada');
    const violaciones = checkAccountsExist(
      [
        { accountId: fantasma, amount: money(1, 'COP') },
        { accountId: fantasma, amount: money(-1, 'COP') },
      ],
      cuentas,
    );

    expect(violaciones).toHaveLength(1);
  });
});

describe('checkPostingCurrencies', () => {
  it('no reporta nada cuando cada apunte usa la moneda de su cuenta', () => {
    expect(checkPostingCurrencies([tx('t1', 100)], cuentas)).toEqual([]);
  });

  it('reporta un apunte en moneda distinta a la de su cuenta', () => {
    const violaciones = checkPostingCurrencies(
      [
        corrupta('t1', [
          { accountId: banco, amount: money(-5n, 'ETH') },
          { accountId: gasto, amount: money(5n, 'ETH') },
        ]),
      ],
      cuentas,
    );

    expect(violaciones).toHaveLength(2);
    expect(mustExist(violaciones[0]).invariante).toBe('moneda-del-apunte');
    expect(mustExist(violaciones[0]).detalle).toContain('ETH');
    expect(mustExist(violaciones[0]).detalle).toContain('COP');
  });

  it('no reporta nada si la cuenta no existe: de eso se encarga otra invariante', () => {
    const violaciones = checkPostingCurrencies(
      [
        corrupta('t1', [
          { accountId: accountId('inventada'), amount: money(-1, 'COP') },
          { accountId: gasto, amount: money(1, 'COP') },
        ]),
      ],
      cuentas,
    );

    expect(violaciones).toEqual([]);
  });
});

describe('checkTransactionShape', () => {
  it('no reporta nada cuando todas tienen dos apuntes o más', () => {
    expect(checkTransactionShape([tx('t1', 100)])).toEqual([]);
  });

  it('detecta una transacción que se quedó sin apuntes', () => {
    // Cuadra —la suma de nada es cero— así que ninguna otra invariante la ve.
    const violaciones = checkTransactionShape([corrupta('t1', [])]);

    expect(violaciones).toHaveLength(1);
    expect(mustExist(violaciones[0]).invariante).toBe('transaccion-con-dos-apuntes');
    expect(mustExist(violaciones[0]).detalle).toContain('t1');
  });

  it('detecta una transacción con un solo apunte de importe cero', () => {
    // También cuadra, y también es imposible que sea correcta.
    expect(
      checkTransactionShape([corrupta('t1', [{ accountId: banco, amount: money(0, 'COP') }])]),
    ).toHaveLength(1);
  });
});

describe('checkAllInvariants', () => {
  it('un ledger sano no reporta nada', () => {
    expect(
      checkAllInvariants({ transactions: [tx('t1', 100), tx('t2', 200)], accounts: cuentas }),
    ).toEqual([]);
  });

  it('un ledger vacío está sano', () => {
    expect(checkAllInvariants({ transactions: [], accounts: [] })).toEqual([]);
  });

  it('acumula las violaciones de todas las invariantes a la vez', () => {
    const rota = corrupta('t1', [
      { accountId: accountId('inventada'), amount: money(-100, 'COP') },
      { accountId: gasto, amount: money(90, 'COP') },
    ]);

    const violaciones = checkAllInvariants({ transactions: [rota], accounts: cuentas });
    const rotas = new Set(violaciones.map((v) => v.invariante));

    expect(rotas).toEqual(new Set(['transaccion-cuadrada', 'suma-global-cero', 'cuenta-existe']));
  });
});
