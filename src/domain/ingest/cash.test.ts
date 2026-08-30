import type { NormalizedTransaction } from '@/domain/capture/normalized-transaction';

import { isCashWithdrawal } from './cash';

const base: NormalizedTransaction = {
  fecha: '2026/08/28',
  descripcion: '',
  monto: 200000,
  moneda: 'COP',
  tipo: 'debito',
  fuente: 'bancolombia',
  referencia: 'R',
};

describe('isCashWithdrawal', () => {
  it.each([
    'RETIRO CAJERO AUTOMATICO',
    'RETIRO EFECTIVO CB EXITO',
    'Retiro en cajero Servibanca',
    'RETIRO ATM 4471',
    'RETIRO CORRESPONSAL BANCARIO',
  ])('reconoce «%s»', (descripcion) => {
    expect(isCashWithdrawal({ ...base, descripcion })).toBe(true);
  });

  it.each([
    'COMPRA EXITO SUR',
    'PAGO PSE NETFLIX',
    'TRANSFERENCIA A NEQUI',
    'ABONO NOMINA',
    'RETIRO DE INVERSION FIDUCUENTA', // sale dinero pero no a la mano
  ])('no reconoce «%s»', (descripcion) => {
    expect(isCashWithdrawal({ ...base, descripcion })).toBe(false);
  });

  it('solo aplica a dinero que sale: un reverso de retiro es crédito y no cuenta', () => {
    expect(
      isCashWithdrawal({ ...base, descripcion: 'REVERSO RETIRO CAJERO', tipo: 'credito' }),
    ).toBe(false);
  });
});
