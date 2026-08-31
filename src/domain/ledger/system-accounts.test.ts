import { accountId, ownerId } from './ids';
import {
  isSystemAccount,
  isUnclassified,
  conversionAccount,
  conversionAccountId,
  sourceAccountId,
  SYSTEM_ACCOUNT_KEYS,
  systemAccount,
  systemAccountId,
} from './system-accounts';

const owner = ownerId('david');

describe('cuentas del sistema', () => {
  it('declara las cuatro que el sprint necesita', () => {
    expect([...SYSTEM_ACCOUNT_KEYS].sort()).toEqual(
      ['ajustes', 'efectivo', 'gastos-sin-clasificar', 'ingresos-sin-clasificar'].sort(),
    );
  });

  /**
   * El puente entre monedas es **una cuenta por moneda**, no una con las dos
   * dentro: `balanceOf` suma con la moneda de la cuenta, así que un puente con
   * pesos y USDC no se podría consultar. Por eso no está entre las claves
   * fijas: es una familia, no una cuenta.
   *
   * Es de patrimonio para que no infle el patrimonio neto —que suma activos y
   * pasivos—: cambiar de moneda no es ganar ni perder dinero.
   */
  it('el puente de conversiones es una cuenta de patrimonio por moneda', () => {
    expect(conversionAccountId('USDC')).toBe('sistema:conversiones:USDC');
    expect(conversionAccountId('COP')).not.toBe(conversionAccountId('USDC'));

    const puente = conversionAccount(owner, 'USDC');
    expect(puente.kind).toBe('patrimonio');
    expect(puente.currency).toBe('USDC');
  });

  it('los ids son estables y llevan el prefijo del sistema', () => {
    expect(systemAccountId('gastos-sin-clasificar')).toBe('sistema:gastos-sin-clasificar');
    expect(systemAccountId('efectivo')).toBe('sistema:efectivo');
  });

  it('cada cuenta tiene la naturaleza contable correcta', () => {
    expect(systemAccount(owner, 'gastos-sin-clasificar').kind).toBe('gasto');
    expect(systemAccount(owner, 'ingresos-sin-clasificar').kind).toBe('ingreso');
    // El efectivo es dinero que se tiene: activo, no gasto.
    expect(systemAccount(owner, 'efectivo').kind).toBe('activo');
    // Los ajustes cuadran contra patrimonio: no son ni ingreso ni gasto.
    expect(systemAccount(owner, 'ajustes').kind).toBe('patrimonio');
  });

  it('todas son en pesos y pertenecen al propietario', () => {
    SYSTEM_ACCOUNT_KEYS.forEach((key) => {
      const cuenta = systemAccount(owner, key);
      expect(cuenta.currency).toBe('COP');
      expect(cuenta.owner).toBe(owner);
      expect(cuenta.nombre.length).toBeGreaterThan(0);
    });
  });

  it('distingue una cuenta del sistema de una del usuario', () => {
    expect(isSystemAccount(systemAccountId('efectivo'))).toBe(true);
    expect(isSystemAccount(accountId('bancolombia:ahorros'))).toBe(false);
  });

  it('solo las dos «sin clasificar» cuentan como sin clasificar', () => {
    expect(isUnclassified(systemAccountId('gastos-sin-clasificar'))).toBe(true);
    expect(isUnclassified(systemAccountId('ingresos-sin-clasificar'))).toBe(true);
    expect(isUnclassified(systemAccountId('efectivo'))).toBe(false);
    expect(isUnclassified(accountId('bancolombia:ahorros'))).toBe(false);
  });
});

describe('sourceAccountId', () => {
  it('deriva el id de la cuenta de una fuente', () => {
    expect(sourceAccountId('bancolombia')).toBe('bancolombia:ahorros');
    expect(sourceAccountId('bancolombia', '12345678901')).toBe('bancolombia:12345678901');
  });
});
