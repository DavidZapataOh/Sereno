import { currencyName, formatAmount, formatCOP, formatSigned } from './format';

describe('formatCOP', () => {
  it.each([
    [0, '0'],
    [1, '1'],
    [999, '999'],
    [1000, '1.000'],
    [45000, '45.000'],
    [1234567, '1.234.567'],
    [1000000000, '1.000.000.000'],
  ])('formatea %s como %s', (entrada, esperado) => {
    expect(formatCOP(entrada)).toBe(esperado);
  });

  it('acepta bigint, que es como el ledger guarda el dinero', () => {
    expect(formatCOP(1234567n)).toBe('1.234.567');
  });

  it('no pierde dígitos con montos que desbordarían un number', () => {
    expect(formatCOP(12345678901234567890n)).toBe('12.345.678.901.234.567.890');
  });

  it('usa punto como separador de miles, como en Colombia', () => {
    expect(formatCOP(1234567)).toContain('.');
    expect(formatCOP(1234567)).not.toContain(',');
  });

  it('no muestra decimales: el peso no los usa en la práctica', () => {
    expect(formatCOP(1234)).toBe('1.234');
  });

  it('añade el símbolo cuando se pide', () => {
    expect(formatCOP(45000, { withSymbol: true })).toBe('$ 45.000');
  });

  it('formatea el valor absoluto: el signo es responsabilidad de quien llama', () => {
    expect(formatCOP(-45000)).toBe('45.000');
    expect(formatCOP(-45000n)).toBe('45.000');
  });

  it('es determinista y no depende de la configuración regional del dispositivo', () => {
    const original = process.env.LANG;
    process.env.LANG = 'en_US.UTF-8';
    expect(formatCOP(1234567)).toBe('1.234.567');
    process.env.LANG = original;
  });

  it('rechaza un number con decimales en vez de truncarlo en silencio', () => {
    // Un monto con decimales aquí es un error de quien llama: el dominio
    // trabaja en la unidad mínima. Truncarlo escondería el error.
    expect(() => formatCOP(45000.5)).toThrow(/entero/i);
  });

  it('rechaza un number fuera del rango seguro', () => {
    expect(() => formatCOP(2 ** 53)).toThrow(/bigint/i);
  });
});

describe('formatAmount con otras monedas', () => {
  it('USD muestra dos decimales con coma, como se escribe en Colombia', () => {
    expect(formatAmount(4550n, 'USD')).toBe('45,50');
    expect(formatAmount(4550n, 'USD', { withSymbol: true })).toBe('US$ 45,50');
  });

  it('USD conserva los ceros: 45,00 y no 45', () => {
    // En moneda fiduciaria los decimales siempre se muestran; ocultarlos hace
    // que 45 dólares y 45 pesos se vean iguales.
    expect(formatAmount(4500n, 'USD')).toBe('45,00');
  });

  it('BTC muestra los decimales que hagan falta y recorta los ceros finales', () => {
    expect(formatAmount(125000n, 'BTC')).toBe('0,00125');
    expect(formatAmount(100000000n, 'BTC')).toBe('1');
    expect(formatAmount(150000000n, 'BTC')).toBe('1,5');
  });

  it('ETH aguanta los dieciocho decimales sin perder ninguno', () => {
    expect(formatAmount(1n, 'ETH')).toBe('0,000000000000000001');
    expect(formatAmount(3n * 10n ** 18n + 7n, 'ETH')).toBe('3,000000000000000007');
  });

  it('agrupa los miles de la parte entera también en cripto', () => {
    expect(formatAmount(123456789n * 10n ** 18n, 'ETH')).toBe('123.456.789');
  });

  it('el símbolo va delante si es un signo y detrás si es un código', () => {
    expect(formatAmount(100000000n, 'BTC', { withSymbol: true })).toBe('₿ 1');
    expect(formatAmount(1000000n, 'USDT', { withSymbol: true })).toBe('1 USDT');
    expect(formatAmount(1000000000n, 'SOL', { withSymbol: true })).toBe('1 SOL');
  });

  it('el cero se escribe sin decimales sueltos', () => {
    expect(formatAmount(0n, 'BTC')).toBe('0');
    expect(formatAmount(0n, 'USD')).toBe('0,00');
  });

  it('rechaza una moneda desconocida', () => {
    expect(() => formatAmount(1n, 'XYZ' as never)).toThrow(/moneda/i);
  });
});

describe('formatSigned', () => {
  it('antepone el signo más al dinero que entra', () => {
    expect(formatSigned(45000, 'entra')).toBe('+$ 45.000');
  });

  it('antepone el signo menos al dinero que sale', () => {
    expect(formatSigned(45000, 'sale')).toBe('−$ 45.000');
  });

  it('usa el signo menos tipográfico, no el guion', () => {
    // El guion (U+002D) es más corto y no alinea con el más.
    expect(formatSigned(1000, 'sale')).toContain('−');
    expect(formatSigned(1000, 'sale')).not.toContain('-');
  });

  it('no antepone signo a un monto neutro', () => {
    expect(formatSigned(45000, 'neutro')).toBe('$ 45.000');
  });

  it('ignora el signo del número de entrada', () => {
    expect(formatSigned(-45000, 'entra')).toBe('+$ 45.000');
    expect(formatSigned(-45000n, 'entra')).toBe('+$ 45.000');
  });

  it('formatea el cero sin signo aunque tenga dirección', () => {
    expect(formatSigned(0, 'sale')).toBe('$ 0');
  });

  it('acepta otra moneda', () => {
    expect(formatSigned(4550n, 'sale', 'USD')).toBe('−US$ 45,50');
    expect(formatSigned(1000000n, 'entra', 'USDT')).toBe('+1 USDT');
  });
});

describe('currencyName', () => {
  it('nombra cada moneda en español, para el lector de pantalla', () => {
    expect(currencyName('COP')).toBe('pesos');
    expect(currencyName('USD')).toBe('dólares');
    expect(currencyName('BTC')).toBe('bitcoin');
    expect(currencyName('ETH')).toBe('ether');
  });
});
