import {
  resumenPublicable,
  resumenPublicableSchema,
  SLUGS_CONOCIDOS,
  type EntradaDelResumen,
} from './publishable-summary';

const entrada: EntradaDelResumen = {
  gastoPorCategoria: { mercado: 620_000, 'taxi-y-apps': 180_000 },
  saldoTotal: 3_904,
  deudaTotal: 1_897_917,
  patrimonio: -1_814_013,
  patrimonioHace30Dias: 2_100_000,
  tasaDeAhorroPct: 12.4,
  mesesDeColchon: 0.3,
  ingresoMensual: 3_000_000,
};

describe('resumenPublicable', () => {
  /**
   * **La prueba que sostiene la decisión entera.** Recorre el objeto
   * serializado y exige que toda clave de categoría sea un slug de la taxonomía
   * —una lista cerrada— y todo valor un número. Un nombre de comercio no está
   * en esa lista, y esa es exactamente la frontera.
   */
  it('no deja salir ninguna cadena que no sea una etiqueta conocida', () => {
    const serializado = JSON.parse(JSON.stringify(resumenPublicable(entrada))) as {
      gastoPorCategoria: Record<string, unknown>;
    };

    for (const [clave, valor] of Object.entries(serializado.gastoPorCategoria)) {
      expect(SLUGS_CONOCIDOS).toContain(clave);
      expect(typeof valor).toBe('number');
    }
  });

  /** El caso concreto que David quiso evitar. */
  it('un nombre de comercio no puede colarse por ninguna vía', () => {
    const conComercio = {
      ...entrada,
      gastoPorCategoria: { ...entrada.gastoPorCategoria, 'RAPPI*BURGER 4512': 38_900 },
    };

    expect(JSON.stringify(resumenPublicable(conComercio))).not.toMatch(/RAPPI/i);
  });

  it('ninguna fecha de movimiento sale', () => {
    expect(JSON.stringify(resumenPublicable(entrada))).not.toMatch(/\d{4}-\d{2}-\d{2}/);
  });

  it('ningún número de cuenta ni referencia sale', () => {
    const conCuenta = {
      ...entrada,
      gastoPorCategoria: { ...entrada.gastoPorCategoria, 'bancolombia:ahorros': 1 },
    };

    expect(JSON.stringify(resumenPublicable(conCuenta))).not.toMatch(/bancolombia/i);
    // Un id de cuenta lleva dos puntos —`fuente:cuenta`—; el JSON también los
    // lleva como separador, así que se mira dentro de las claves, no del texto.
    for (const clave of Object.keys(resumenPublicable(conCuenta).gastoPorCategoria)) {
      expect(clave).not.toMatch(/:/);
    }
  });

  /**
   * Se filtra en vez de confiar en quien llama: es la única forma de que la
   * frontera aguante un cambio futuro allá arriba.
   */
  it('descarta cualquier clave que no sea un slug conocido', () => {
    const sucia = {
      ...entrada,
      gastoPorCategoria: { mercado: 1, 'lo que sea': 2, 'NETFLIX.COM 1234': 3 },
    };

    expect(Object.keys(resumenPublicable(sucia).gastoPorCategoria)).toEqual(['mercado']);
  });

  /** `null` es «no lo sé»; cero es «es cero». Se distinguen. */
  it('lo que no se pudo calcular va null, y cero significa cero', () => {
    const sinDatos = resumenPublicable({
      ...entrada,
      patrimonioHace30Dias: null,
      tasaDeAhorroPct: null,
    });

    expect(sinDatos.patrimonioHace30Dias).toBeNull();
    expect(sinDatos.tasaDeAhorroPct).toBeNull();
    expect(resumenPublicable({ ...entrada, saldoTotal: 0 }).saldoTotal).toBe(0);
  });

  it('los montos van en pesos enteros, sin decimales inventados', () => {
    const conDecimales = resumenPublicable({ ...entrada, saldoTotal: 3_904.67 });

    expect(Number.isInteger(conDecimales.saldoTotal)).toBe(true);
  });

  it('un patrimonio negativo conserva el signo', () => {
    expect(resumenPublicable(entrada).patrimonio).toBe(-1_814_013);
  });

  it('un valor que no es finito no sale', () => {
    const roto = resumenPublicable({
      ...entrada,
      gastoPorCategoria: { mercado: Number.NaN },
      tasaDeAhorroPct: Number.POSITIVE_INFINITY,
    });

    expect(roto.gastoPorCategoria).toEqual({});
    expect(roto.tasaDeAhorroPct).toBeNull();
  });

  /** Lo único textual que sale es la moneda, y es de una lista de una. */
  it('el único texto del resumen es la moneda', () => {
    const valores = Object.values(resumenPublicable(entrada)).filter((v) => typeof v === 'string');

    expect(valores).toEqual(['COP']);
  });
});

describe('resumenPublicableSchema', () => {
  const valido = resumenPublicable({
    gastoPorCategoria: { mercado: 400_000 },
    saldoTotal: 1_000_000,
    deudaTotal: 0,
    patrimonio: 1_000_000,
    patrimonioHace30Dias: null,
    tasaDeAhorroPct: null,
    mesesDeColchon: null,
    ingresoMensual: null,
  });

  it('acepta lo que produce resumenPublicable', () => {
    expect(resumenPublicableSchema.parse(valido)).toEqual(valido);
  });

  /** La frontera se defiende en los dos lados: el servidor no confía en la app. */
  it('rechaza una categoría que no es un slug de la taxonomía', () => {
    const result = resumenPublicableSchema.safeParse({
      ...valido,
      gastoPorCategoria: { 'RAPPI*BURGER 4512': 30_000 },
    });

    expect(result.success).toBe(false);
  });

  it('un campo de más no se cuela ignorado', () => {
    const result = resumenPublicableSchema.safeParse({ ...valido, descripcion: 'COMPRA EXITO' });

    expect(result.success).toBe(false);
  });

  it('exige pesos: otra moneda no pasa', () => {
    expect(resumenPublicableSchema.safeParse({ ...valido, moneda: 'USD' }).success).toBe(false);
  });
});
