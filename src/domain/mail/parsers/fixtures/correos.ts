import type { RawMessage } from '@/domain/mail/message';

/**
 * Correos de ejemplo con la **forma literal** de los reales (sprint 06): las
 * plantillas son las que mandan los emisores, palabra por palabra, incluidos
 * los dos formatos de monto de Bancolombia y los cinco de fecha.
 *
 * Los nombres, cuentas y montos están cambiados: este repositorio es público.
 * Los originales viven en `capturas/correos/`, fuera de git, y
 * `correos-reales.test.ts` los usa cuando están.
 */
const base = { id: 'm-1', recibidoEn: '2026-08-28T18:05:57.000Z', html: null };
const BANCOLOMBIA = 'alertasynotificaciones@an.notificacionesbancolombia.com';
const ASUNTO_BANCOLOMBIA = 'Alertas y Notificaciones';

export const CORREOS = {
  bancolombiaCompraste: {
    ...base,
    remitente: BANCOLOMBIA,
    asunto: ASUNTO_BANCOLOMBIA,
    texto:
      '¡Listo! Todo salió bien con tus movimientos Bancolombia: Compraste $10.700,00 ' +
      'en COMERCIO DE PRUEBA con tu T.Deb *0000, el 28/08/2026 a las 13:05. ' +
      'Si tienes dudas, encuentranos aqui: 6045109095.',
  },
  bancolombiaPagaste: {
    ...base,
    id: 'm-2',
    remitente: 'alertasynotificaciones@ayn.notificacionesbancolombia.com',
    asunto: ASUNTO_BANCOLOMBIA,
    texto:
      '¡Listo! Todo salió bien con tus movimientos Bancolombia: Pagaste $124,000.00 ' +
      'a UNE EPM Telecomunicaciones desde tu producto 0000 el 19/08/2026 17:29:38.',
  },
  bancolombiaPagasteQr: {
    ...base,
    id: 'm-3',
    remitente: BANCOLOMBIA,
    asunto: ASUNTO_BANCOLOMBIA,
    texto:
      '¡Listo! Todo salió bien con tus movimientos Bancolombia: NOMBRE DE PRUEBA pagaste ' +
      '$170,000.00 por codigo QR desde tu cuenta *0000 a la llave 3000000000 el 16/08/2026 a las 13:21.',
  },
  bancolombiaRetiraste: {
    ...base,
    id: 'm-4',
    remitente: BANCOLOMBIA,
    asunto: ASUNTO_BANCOLOMBIA,
    texto:
      '¡Listo! Todo salió bien con tus movimientos Bancolombia: Retiraste $40.000,00 ' +
      'en SUC_CRA00_0 de tu T.Deb **0000 el 29/08/2026 a las 11:45.',
  },
  bancolombiaTransferiste: {
    ...base,
    id: 'm-5',
    remitente: BANCOLOMBIA,
    asunto: ASUNTO_BANCOLOMBIA,
    texto:
      '¡Listo! Todo salió bien con tus movimientos Bancolombia: Transferiste $10,000.00 ' +
      'desde tu cuenta *0000 a la cuenta *3000000000 el 25/08/26 a las 10:33.',
  },
  bancolombiaConsignacion: {
    ...base,
    id: 'm-6',
    remitente: BANCOLOMBIA,
    asunto: ASUNTO_BANCOLOMBIA,
    texto:
      '¡Listo! Todo salió bien con tus movimientos Bancolombia: Recibiste una consignacion ' +
      'por $500,000 desde el corresponsal CORRESPONSAL DE PRUEBA en MUNICIPIO, el 24/08/26 10:24.',
  },
  bancolombiaTransferenciaRecibida: {
    ...base,
    id: 'm-7',
    remitente: BANCOLOMBIA,
    asunto: ASUNTO_BANCOLOMBIA,
    texto:
      '¡Listo! Todo salió bien con tus movimientos Bancolombia: nombre, recibiste una ' +
      'transferencia de EMPRESA DE PRUEBA SAS por $360,000.00 en tu cuenta *0000 ' +
      'conectada a la llave @llavedeprueba el 15/08/26 a las 15:51.',
  },
  bancolombiaTransferenciaRecibidaOtroOrden: {
    ...base,
    id: 'm-8',
    remitente: BANCOLOMBIA,
    asunto: ASUNTO_BANCOLOMBIA,
    texto:
      '¡Listo! Todo salió bien con tus movimientos Bancolombia: Recibiste una transferencia ' +
      'por $5,000 de PERSONA DE PRUEBA en tu cuenta **0000, el 29/08/2026 a las 09:16.',
  },
  bancolombiaPublicidad: {
    ...base,
    id: 'm-9',
    remitente: BANCOLOMBIA,
    asunto: ASUNTO_BANCOLOMBIA,
    texto:
      '¿Quieres ver el equilibrio de tus gastos y tus ingresos? Haz eso y mucho más desde ' +
      'Día a Día en nuestra app Mi Bancolombia. DESCUBRIR MÁS',
  },
  nequiFactura: {
    ...base,
    id: 'm-10',
    remitente: 'somos@nequi.com.co',
    asunto: 'Comprobante de Pago Claro',
    texto:
      'NEQUI Listo tu pago en Claro Pagaste con Nequi tu factura por $5.000 Estado: Exitoso ' +
      'Comprobante de Pago Nombre: No aplica Cel: 3000000000 Fecha: 05/Jul/2026 ' +
      'Paquete: 800_MB_RDS_3D Valor: $5.000 Código de autorización: V260705.0504.230013',
  },
  nequiPago: {
    ...base,
    id: 'm-11',
    remitente: 'somos@nequi.com.co',
    asunto: '¡Pago exitoso!',
    texto:
      'NEQUI ¡Pago exitoso! Hiciste un pago en COMERCIO DE PRUEBA S.A.S por $194.230 ' +
      'Fecha: El 11 de agosto de 2026 Hora: 8:25 a. m. CUS: 557495005',
  },
  nequiRecibido: {
    ...base,
    id: 'm-12',
    remitente: 'notificaciones@nequi.com.co',
    asunto: '¡Recibiste plata por Bre-B!',
    texto:
      'NEQUI ¡Recibiste plata por Bre-B! ¡Hola, NOMBRE DE PRUEBA! Recibiste 350.000 ' +
      'de EMPRESA DE PRUEBA SAS el 10 de julio de 2026 a las 5:47 p.m, desde el banco .',
  },
  nuPago: {
    ...base,
    id: 'm-13',
    remitente: 'nu@nu.com.co',
    asunto: '¡Ya entró tu pago!',
    texto:
      '¡Recibimos tu pago! Hola, Nombre: Recibimos el pago que hiciste de tu Tarjeta de ' +
      'crédito Nu. Estos son los detalles de lo que pagaste: Tu pago fue de $99.799,30 ' +
      'Lo has realizado el 10 mayo 2026 8:03:31 PM Tipo de transacción Pago en linea ' +
      'Costo de transacción $0 Producto origen NEQUI Producto destino **** **** **** 0000 ' +
      'ID transacción 00000000-0000-4000-8000-000000000000 Tu próxima fecha de corte es 31 mayo 2026',
  },
  rappicardCompra: {
    ...base,
    id: 'm-14',
    remitente: 'rappi.nreply@rappi.com',
    asunto: 'RappiCard - Resumen de transacción',
    texto:
      // Con saltos de línea, como llega de verdad: mailparser deriva el texto
      // del HTML y cada etiqueta queda en su propia línea.
      '¡Hola, NOMBRE DE PRUEBA !\nRealizaste una compra con tu RappiCard.\nDetalle de tu ' +
      'transacción:\nMonto\n$235.690\nMétodo de pago\n*0000\nNo. de autorización\n293004\n' +
      'Comercio\nCOMERCIO DE PRUEBA\nFecha de la transacción\n2025-06-12 12:57:20',
  },
  rappicardPago: {
    ...base,
    id: 'm-15',
    remitente: 'noreply@rappicard.co',
    asunto: 'Comprobante de pago',
    texto:
      'Hola, NOMBRE DE PRUEBA\nRecibimos el pago de tu tarjeta y lo estamos procesando.\n' +
      'Destino de pago\n*0000\nFecha y hora\n25 ago 2026 06:55\nMétodo de pago\nPSE\nMonto\n140.378,92',
  },
  sinRemitenteConocido: {
    ...base,
    id: 'm-16',
    remitente: 'promociones@tienda.com',
    asunto: 'Compraste $45.000',
    texto: 'Compraste $45.000 en TIENDA con tu T.Deb *0000, el 30/08/2026 a las 10:00.',
  },
} satisfies Record<string, RawMessage>;
