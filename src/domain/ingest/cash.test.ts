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

  it('reconoce la forma del correo: «Retiraste en SUC_CRA70_3»', () => {
    // El correo real no dice «retiro» ni «cajero». Sin esto, el retiro se
    // contabilizaría como gasto y el efectivo no aparecería: el mismo error
    // que David cazó en campo en el sprint 04.
    expect(isCashWithdrawal({ ...base, descripcion: 'Retiraste en SUC_CRA70_3' })).toBe(true);
  });

  it('un crédito nunca es un retiro, diga lo que diga', () => {
    expect(isCashWithdrawal({ ...base, descripcion: 'Retiraste en SUC', tipo: 'credito' })).toBe(
      false,
    );
  });
});
