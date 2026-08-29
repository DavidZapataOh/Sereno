import { normalizedTransactionSchema } from './normalized-transaction';

const valida = {
  fecha: '2026-08-20T00:00:00.000Z',
  descripcion: 'COMPRA PSE *4471 EXITO SUR',
  monto: 45000,
  moneda: 'COP',
  tipo: 'debito',
  fuente: 'bancolombia',
  referencia: '4471',
};

describe('normalizedTransactionSchema', () => {
  it('acepta una transacción válida', () => {
    expect(normalizedTransactionSchema.safeParse(valida).success).toBe(true);
  });

  it('acepta referencia nula', () => {
    expect(normalizedTransactionSchema.safeParse({ ...valida, referencia: null }).success).toBe(
      true,
    );
  });

  it('acepta monto cero: un movimiento sin valor sigue siendo un hecho', () => {
    expect(normalizedTransactionSchema.safeParse({ ...valida, monto: 0 }).success).toBe(true);
  });

  it('rechaza montos negativos: el signo vive en el tipo', () => {
    expect(normalizedTransactionSchema.safeParse({ ...valida, monto: -100 }).success).toBe(false);
  });

  it('rechaza montos no enteros', () => {
    expect(normalizedTransactionSchema.safeParse({ ...valida, monto: 100.5 }).success).toBe(false);
  });

  it('rechaza un tipo desconocido', () => {
    expect(normalizedTransactionSchema.safeParse({ ...valida, tipo: 'otro' }).success).toBe(false);
  });

  it('rechaza una moneda distinta de COP en esta fase', () => {
    expect(normalizedTransactionSchema.safeParse({ ...valida, moneda: 'USD' }).success).toBe(false);
  });

  it('rechaza una fuente desconocida', () => {
    expect(normalizedTransactionSchema.safeParse({ ...valida, fuente: 'davivienda' }).success).toBe(
      false,
    );
  });

  it('rechaza una fecha vacía', () => {
    expect(normalizedTransactionSchema.safeParse({ ...valida, fecha: '' }).success).toBe(false);
  });

  it('rechaza campos faltantes', () => {
    expect(normalizedTransactionSchema.safeParse({ monto: 1 }).success).toBe(false);
  });
});
