import { createAccount } from '@/domain/ledger/account';
import { accountId, ownerId } from '@/domain/ledger/ids';
import { money } from '@/domain/money/money';

import { fromAccount, fromMoney, toAccount, toMoney } from './mappers';

describe('conversión de montos', () => {
  it('un monto se convierte a texto y vuelve idéntico', () => {
    const original = money(-45000, 'COP');

    expect(toMoney(fromMoney(original), 'COP')).toEqual(original);
  });

  it('conserva la precisión de un saldo en wei', () => {
    const enorme = money(123456789012345678901234567890n, 'ETH');

    expect(toMoney(fromMoney(enorme), 'ETH')).toEqual(enorme);
  });

  it('conserva el cero', () => {
    expect(toMoney(fromMoney(money(0, 'COP')), 'COP').amount).toBe(0n);
  });

  it('conserva el signo negativo', () => {
    expect(toMoney('-1', 'COP').amount).toBe(-1n);
  });

  it('rechaza un texto que no es un entero', () => {
    expect(() => toMoney('45.5', 'COP')).toThrow(/monto/i);
    expect(() => toMoney('abc', 'COP')).toThrow(/monto/i);
    expect(() => toMoney('', 'COP')).toThrow(/monto/i);
  });

  it('rechaza los adornos que suelen colarse desde un CSV', () => {
    expect(() => toMoney(' 1 ', 'COP')).toThrow(/monto/i);
    expect(() => toMoney('+1', 'COP')).toThrow(/monto/i);
    expect(() => toMoney('1e3', 'COP')).toThrow(/monto/i);
    expect(() => toMoney('1_000', 'COP')).toThrow(/monto/i);
  });

  it('rechaza ceros a la izquierda, que no son la forma canónica', () => {
    // `BigInt('007')` daría 7n sin protestar. Se rechaza a propósito: la base
    // solo debe contener lo que `fromMoney` escribe, y cualquier otra cosa
    // señala un fallo en quien la escribió, no un dato que haya que tolerar.
    expect(() => toMoney('007', 'COP')).toThrow(/monto/i);
    expect(() => toMoney('-007', 'COP')).toThrow(/monto/i);
    expect(toMoney('0', 'COP').amount).toBe(0n);
  });

  it('rechaza una moneda desconocida', () => {
    expect(() => toMoney('1', 'XYZ')).toThrow(/moneda/i);
  });

  it('nombra el valor ofensivo en el mensaje', () => {
    // Un dato corrupto en la base se diagnostica por el mensaje del error: sin
    // el valor dentro, hay que salir a buscar la fila a mano.
    expect(() => toMoney('45.5', 'COP')).toThrow('45.5');
    expect(() => toMoney('1', 'XYZ')).toThrow('XYZ');
  });
});

describe('conversión de cuentas', () => {
  const cuenta = createAccount({
    id: accountId('c1'),
    owner: ownerId('david'),
    kind: 'activo',
    nombre: 'Bancolombia',
    currency: 'COP',
  });

  it('una cuenta se convierte a fila y vuelve idéntica', () => {
    expect(toAccount(fromAccount(cuenta))).toEqual(cuenta);
  });

  it('conserva la fecha de archivo', () => {
    const archivada = { ...cuenta, archivedAt: '2026-08-20T00:00:00.000Z' };

    expect(toAccount(fromAccount(archivada)).archivedAt).toBe('2026-08-20T00:00:00.000Z');
  });

  it('rechaza una fila con naturaleza desconocida', () => {
    expect(() => toAccount({ ...fromAccount(cuenta), kind: 'inventado' })).toThrow(/naturaleza/i);
  });

  it('rechaza una fila con moneda desconocida', () => {
    expect(() => toAccount({ ...fromAccount(cuenta), currency: 'XYZ' })).toThrow(/moneda/i);
  });

  it('rechaza una fila sin identificador', () => {
    expect(() => toAccount({ ...fromAccount(cuenta), id: '' })).toThrow();
  });

  it('las cinco naturalezas del dominio sobreviven la ida y vuelta', () => {
    const naturalezas = ['activo', 'pasivo', 'ingreso', 'gasto', 'patrimonio'] as const;

    naturalezas.forEach((kind) => {
      const original = createAccount({ ...cuenta, kind });
      expect(toAccount(fromAccount(original)).kind).toBe(kind);
    });
  });
});
