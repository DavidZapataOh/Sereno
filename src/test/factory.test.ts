import { defineFactory } from './factory';

interface Cuenta {
  id: string;
  nombre: string;
  saldo: number;
  activa: boolean;
}

const cuentaFactory = defineFactory<Cuenta>(() => ({
  id: 'cuenta-1',
  nombre: 'Ahorros',
  saldo: 0,
  activa: true,
}));

describe('defineFactory', () => {
  it('construye con los valores por defecto', () => {
    expect(cuentaFactory.build()).toEqual({
      id: 'cuenta-1',
      nombre: 'Ahorros',
      saldo: 0,
      activa: true,
    });
  });

  it('sobrescribe solo lo indicado', () => {
    const cuenta = cuentaFactory.build({ saldo: 5000 });
    expect(cuenta.saldo).toBe(5000);
    expect(cuenta.nombre).toBe('Ahorros');
  });

  it('construye listas', () => {
    expect(cuentaFactory.buildList(3)).toHaveLength(3);
  });

  it('permite variar cada elemento de la lista por índice', () => {
    const cuentas = cuentaFactory.buildList(3, (index) => ({ id: `cuenta-${String(index)}` }));
    expect(cuentas.map((c) => c.id)).toEqual(['cuenta-0', 'cuenta-1', 'cuenta-2']);
  });

  it('devuelve objetos independientes entre llamadas', () => {
    const a = cuentaFactory.build();
    const b = cuentaFactory.build();
    a.nombre = 'Modificada';
    expect(b.nombre).toBe('Ahorros');
  });

  it('extend crea una factory derivada sin alterar la original', () => {
    const inactivaFactory = cuentaFactory.extend({ activa: false });
    expect(inactivaFactory.build().activa).toBe(false);
    expect(cuentaFactory.build().activa).toBe(true);
  });

  it('la derivada acepta sobrescrituras propias', () => {
    const inactivaFactory = cuentaFactory.extend({ activa: false });
    expect(inactivaFactory.build({ nombre: 'Vieja' })).toEqual({
      id: 'cuenta-1',
      nombre: 'Vieja',
      saldo: 0,
      activa: false,
    });
  });
});
