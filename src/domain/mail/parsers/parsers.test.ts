import { normalizedTransactionSchema } from '@/domain/capture/normalized-transaction';
import { isCashWithdrawal } from '@/domain/ingest/cash';

import { CORREOS } from './fixtures/correos';
import { parseMessage } from './parser';

/** Qué debe salir de cada correo. Una fila por plantilla real. */
const ESPERADO = [
  [
    'bancolombiaCompraste',
    {
      fuente: 'bancolombia',
      monto: 10700,
      tipo: 'debito',
      descripcion: 'COMERCIO DE PRUEBA',
      fecha: '2026-08-28T13:05:00.000-05:00',
    },
  ],
  [
    'bancolombiaPagaste',
    {
      fuente: 'bancolombia',
      monto: 124000,
      tipo: 'debito',
      descripcion: 'UNE EPM Telecomunicaciones',
    },
  ],
  [
    'bancolombiaPagasteQr',
    {
      fuente: 'bancolombia',
      monto: 170000,
      tipo: 'debito',
      descripcion: 'Pago por QR a la llave 3000000000',
    },
  ],
  [
    'bancolombiaRetiraste',
    {
      fuente: 'bancolombia',
      monto: 40000,
      tipo: 'debito',
      descripcion: 'Retiraste en SUC_CRA00_0',
    },
  ],
  [
    'bancolombiaTransferiste',
    {
      fuente: 'bancolombia',
      monto: 10000,
      tipo: 'debito',
      descripcion: 'Transferencia a la cuenta *3000000000',
    },
  ],
  [
    'bancolombiaConsignacion',
    {
      fuente: 'bancolombia',
      monto: 500000,
      tipo: 'credito',
      descripcion: 'CORRESPONSAL DE PRUEBA',
    },
  ],
  [
    'bancolombiaTransferenciaRecibida',
    { fuente: 'bancolombia', monto: 360000, tipo: 'credito', descripcion: 'EMPRESA DE PRUEBA SAS' },
  ],
  [
    'bancolombiaTransferenciaRecibidaOtroOrden',
    { fuente: 'bancolombia', monto: 5000, tipo: 'credito', descripcion: 'PERSONA DE PRUEBA' },
  ],
  [
    'nequiFactura',
    {
      fuente: 'nequi',
      monto: 5000,
      tipo: 'debito',
      descripcion: 'Claro',
      referencia: 'V260705.0504.230013',
    },
  ],
  [
    'nequiPago',
    {
      fuente: 'nequi',
      monto: 194230,
      tipo: 'debito',
      descripcion: 'COMERCIO DE PRUEBA S.A.S',
      referencia: '557495005',
      fecha: '2026-08-11T08:25:00.000-05:00',
    },
  ],
  [
    'nequiRecibido',
    {
      fuente: 'nequi',
      monto: 350000,
      tipo: 'credito',
      descripcion: 'EMPRESA DE PRUEBA SAS',
      fecha: '2026-07-10T17:47:00.000-05:00',
    },
  ],
  [
    'nuPago',
    {
      fuente: 'nu',
      monto: 99799,
      tipo: 'credito',
      descripcion: 'Pago de la tarjeta',
      referencia: '00000000-0000-4000-8000-000000000000',
      fecha: '2026-05-10T20:03:31.000-05:00',
    },
  ],
  [
    'rappicardCompra',
    {
      fuente: 'rappicard',
      monto: 235690,
      tipo: 'debito',
      descripcion: 'COMERCIO DE PRUEBA',
      referencia: '293004',
      fecha: '2025-06-12T12:57:20.000-05:00',
    },
  ],
  [
    'rappicardPago',
    {
      fuente: 'rappicard',
      monto: 140378,
      tipo: 'credito',
      descripcion: 'Pago de la tarjeta',
      fecha: '2026-08-25T06:55:00.000-05:00',
    },
  ],
] as const;

describe('parsers de correo', () => {
  it.each(ESPERADO)('lee «%s»', (clave, esperado) => {
    const r = parseMessage(CORREOS[clave]);
    if (r.estado !== 'parseado') throw new Error(`«${clave}» salió ${r.estado}`);
    expect(r.movimientos).toHaveLength(1);
    expect(r.movimientos[0]).toMatchObject(esperado);
  });

  it('todo lo que sale cumple el esquema del dominio', () => {
    for (const [clave] of ESPERADO) {
      const r = parseMessage(CORREOS[clave]);
      if (r.estado !== 'parseado') continue;
      for (const m of r.movimientos) {
        expect(() => normalizedTransactionSchema.parse(m)).not.toThrow();
      }
    }
  });

  it('un retiro de Bancolombia se reconoce como efectivo, no como gasto', () => {
    const r = parseMessage(CORREOS.bancolombiaRetiraste);
    if (r.estado !== 'parseado') throw new Error('debía parsear');
    const movimiento = r.movimientos[0];
    if (movimiento === undefined) throw new Error('sin movimiento');
    expect(isCashWithdrawal(movimiento)).toBe(true);
  });

  it('la publicidad del banco se ignora, aunque venga del mismo remitente y asunto', () => {
    expect(parseMessage(CORREOS.bancolombiaPublicidad)).toEqual({
      estado: 'ignorado',
      fuente: 'bancolombia',
    });
  });

  it('un remitente ajeno no se parsea aunque copie la plantilla entera', () => {
    expect(parseMessage(CORREOS.sinRemitenteConocido)).toEqual({ estado: 'desconocido' });
  });

  it('dos lecturas del mismo correo dan lo mismo, referencia incluida', () => {
    expect(parseMessage(CORREOS.nuPago)).toEqual(parseMessage(CORREOS.nuPago));
  });

  it('un correo del emisor con el formato cambiado va a error con motivo', () => {
    const roto = { ...CORREOS.bancolombiaCompraste, texto: 'Compraste en COMERCIO con tu T.Deb' };
    const r = parseMessage(roto);
    expect(r.estado).toBe('error');
    if (r.estado !== 'error') return;
    expect(r.motivo).toMatch(/monto|plantilla/i);
    // El motivo acaba en la cola de revisión: no puede llevarse el correo.
    expect(r.motivo).not.toContain('COMERCIO');
  });

  it('las etiquetas en su propia línea se leen igual', () => {
    // En el correo real de RappiCard, «Comercio» y su valor están en líneas
    // distintas. Sin cruzar el salto, el comercio se perdía y la fecha caía
    // en la del correo, diez horas después.
    const r = parseMessage(CORREOS.rappicardCompra);
    if (r.estado !== 'parseado') throw new Error('debía parsear');
    expect(r.movimientos[0]?.descripcion).toBe('COMERCIO DE PRUEBA');
    expect(r.movimientos[0]?.referencia).toBe('293004');
  });

  it('los pagos de tarjeta son crédito: reducen la deuda del pasivo', () => {
    for (const clave of ['nuPago', 'rappicardPago'] as const) {
      const r = parseMessage(CORREOS[clave]);
      if (r.estado !== 'parseado') throw new Error('debía parsear');
      expect(r.movimientos[0]?.tipo).toBe('credito');
    }
  });
});
