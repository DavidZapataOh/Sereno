import { money } from '@/domain/money/money';

import { ordenar, type DeudaEnSimulacion } from './strategy';

const deuda = (id: string, saldo: number, tasa: number | null): DeudaEnSimulacion => ({
  id,
  nombre: id,
  saldo: money(saldo, 'COP'),
  tasa: tasa === null ? null : { valor: tasa, tipo: 'EA' },
  minimo: money(50_000, 'COP'),
});

describe('ordenar', () => {
  it('avalancha ataca primero la tasa más alta', () => {
    const orden = ordenar(
      [deuda('barata', 1_000_000, 0.1), deuda('cara', 5_000_000, 0.3)],
      'avalancha',
    );

    expect(orden.map((d) => d.id)).toEqual(['cara', 'barata']);
  });

  it('bola de nieve ataca primero el saldo más pequeño', () => {
    const orden = ordenar(
      [deuda('grande', 5_000_000, 0.3), deuda('chica', 1_000_000, 0.1)],
      'bola-de-nieve',
    );

    expect(orden.map((d) => d.id)).toEqual(['chica', 'grande']);
  });

  /**
   * La del primo no cuesta intereses, así que atacarla primero sería pagar de
   * más en las otras. Pero no se confunde con una al 0 % pactado.
   */
  it('una deuda sin tasa va al final en avalancha', () => {
    const orden = ordenar(
      [deuda('primo', 100_000, null), deuda('banco', 5_000_000, 0.02)],
      'avalancha',
    );

    expect(orden.map((d) => d.id)).toEqual(['banco', 'primo']);
  });

  /**
   * Sin desempate, el orden dependería de cómo vinieran de la base y la
   * simulación daría resultados distintos entre corridas.
   */
  it('a igualdad de tasa, desempata por saldo', () => {
    const orden = ordenar([deuda('b', 3_000_000, 0.2), deuda('a', 1_000_000, 0.2)], 'avalancha');

    expect(orden.map((d) => d.id)).toEqual(['a', 'b']);
  });

  it('el orden es estable: dos llamadas dan lo mismo', () => {
    const deudas = [
      deuda('a', 1_000_000, 0.2),
      deuda('b', 1_000_000, 0.2),
      deuda('c', 1_000_000, 0.2),
    ];

    expect(ordenar(deudas, 'avalancha').map((d) => d.id)).toEqual(
      ordenar(deudas, 'avalancha').map((d) => d.id),
    );
  });

  it('deja fuera las deudas ya saldadas', () => {
    expect(
      ordenar([deuda('saldada', 0, 0.2), deuda('viva', 1_000, 0.2)], 'avalancha'),
    ).toHaveLength(1);
  });
});
