import type { Capture } from './reassembler';
import { pickSavingsBalance, summarizeSession } from './session-summary';

const HOST =
  'https://canalpersonas-ext.apps.bancolombia.com/super-svp/api/v1/security-filters/ch-ms-deposits';

const captura = (
  url: string,
  body: unknown,
  capturedAt = '2026-08-28T10:00:00.000-05:00',
): Capture => ({
  id: `${url}@${capturedAt}`,
  url,
  method: 'GET',
  status: 200,
  contentType: 'application/json',
  kind: 'fetch',
  capturedAt,
  body: JSON.stringify(body),
});

const cuenta = (name: string, available: number, number = '12345678901') => ({
  number,
  name,
  type: 'CUENTA_AHORRO',
  currency: 'COP',
  status: 'ACTIVA',
  balances: { available, current: available, effective: available },
});

const saldos = (available: number, capturedAt?: string) =>
  captura(
    `${HOST}/hybrid/accounts/customization/consolidated`,
    { data: { accounts: [cuenta('Ahorros', available)] } },
    capturedAt,
  );

const movimientos = captura(`${HOST}/account/transactions`, {
  data: {
    transactions: [
      {
        transactionDate: '2026/08/27',
        description: 'ABONO',
        amount: 1000,
        type: 'DEBITO',
        reference1: 'A',
      },
      {
        transactionDate: '2026/08/28',
        description: 'COMPRA',
        amount: -500,
        type: 'CREDITO',
        reference1: 'B',
      },
    ],
  },
});

describe('summarizeSession', () => {
  it('cuenta los movimientos extraíbles y encuentra el saldo de ahorros', () => {
    const resumen = summarizeSession('bancolombia', [movimientos, saldos(4523)]);
    expect(resumen).toMatchObject({ capturas: 2, movimientos: 2 });
    expect(resumen.saldo?.balance.saldo).toBe(4523);
    expect(resumen.saldo?.capturedAt).toBe('2026-08-28T10:00:00.000-05:00');
  });

  it('sin la respuesta de saldos, lo dice: saldo null, no cero', () => {
    const resumen = summarizeSession('bancolombia', [movimientos]);
    expect(resumen.saldo).toBeNull();
    expect(resumen.movimientos).toBe(2);
  });

  it('con varias respuestas de saldos usa la más reciente', () => {
    const resumen = summarizeSession('bancolombia', [
      saldos(1000, '2026-08-28T09:00:00.000-05:00'),
      saldos(4523, '2026-08-28T10:30:00.000-05:00'),
      saldos(2000, '2026-08-28T10:00:00.000-05:00'),
    ]);
    expect(resumen.saldo?.balance.saldo).toBe(4523);
  });

  it('ignora un cuerpo con la forma correcta en otra ruta', () => {
    const impostor = captura(`${HOST}/otra/cosa`, {
      data: { accounts: [cuenta('Ahorros', 999)] },
    });
    expect(summarizeSession('bancolombia', [impostor]).saldo).toBeNull();
  });

  it('un portal sin extractores resume cero de todo', () => {
    expect(summarizeSession('nequi', [movimientos, saldos(1)])).toEqual({
      capturas: 2,
      movimientos: 0,
      saldo: null,
    });
  });
});

describe('pickSavingsBalance', () => {
  const b = (nombre: string, saldo: number) => ({
    fuente: 'bancolombia' as const,
    numero: '1',
    nombre,
    moneda: 'COP' as const,
    saldo,
  });

  it('prefiere la cuenta de ahorros aunque no sea la primera', () => {
    expect(pickSavingsBalance([b('Corriente', 1), b('Cuenta de Ahorros', 2)])?.saldo).toBe(2);
  });

  it('sin ahorros, la primera; sin nada, null', () => {
    expect(pickSavingsBalance([b('Corriente', 1), b('CDT', 2)])?.saldo).toBe(1);
    expect(pickSavingsBalance([])).toBeNull();
  });
});
