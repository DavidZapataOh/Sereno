/** Lo que Binance devuelve en `/sapi/v1/account/apiRestrictions`. */
export interface RestriccionesApi {
  enableReading?: boolean;
  enableWithdrawals?: boolean;
  enableInternalTransfer?: boolean;
  enableSpotAndMarginTrading?: boolean;
  enableMargin?: boolean;
  enableFutures?: boolean;
  ipRestrict?: boolean;
}

/** Los permisos que pueden mover dinero, con lo que hay que desmarcar. */
const PELIGROSOS: { campo: keyof RestriccionesApi; puede: string; casilla: string }[] = [
  { campo: 'enableWithdrawals', puede: 'retirar', casilla: 'Enable Withdrawals' },
  { campo: 'enableInternalTransfer', puede: 'transferir', casilla: 'Enable Internal Transfer' },
  {
    campo: 'enableSpotAndMarginTrading',
    puede: 'operar',
    casilla: 'Enable Spot & Margin Trading',
  },
  { campo: 'enableMargin', puede: 'operar con margen', casilla: 'Enable Margin' },
  { campo: 'enableFutures', puede: 'operar futuros', casilla: 'Enable Futures' },
];

export class ClavePeligrosaError extends Error {
  constructor(mensaje: string) {
    super(mensaje);
    this.name = 'ClavePeligrosaError';
  }
}

/**
 * Comprueba que la clave no pueda mover dinero.
 *
 * Suena excesivo hasta que se piensa qué pasa si no está: una clave creada con
 * prisa, con todos los permisos marcados, **leería los saldos igual de bien**.
 * Nadie lo notaría hasta el día que se filtrara. Esta comprobación convierte un
 * error invisible en un arranque fallido con un mensaje que dice qué tocar.
 *
 * Lanza si puede mover dinero; devuelve los avisos que no justifican parar.
 */
export function verificarPermisos(restricciones: RestriccionesApi): string[] {
  const peligros = PELIGROSOS.filter((p) => restricciones[p.campo] === true);
  if (peligros.length > 0) {
    throw new ClavePeligrosaError(
      `La clave de Binance puede ${peligros.map((p) => p.puede).join(', ')}. ` +
        `Desmarca en Binance: ${peligros.map((p) => p.casilla).join(', ')}. ` +
        'Sereno solo necesita leer.',
    );
  }
  if (restricciones.enableReading !== true) {
    throw new ClavePeligrosaError(
      'La clave de Binance no puede leer: marca «Enable Reading» y vuelve a intentarlo',
    );
  }

  const avisos: string[] = [];
  if (restricciones.ipRestrict !== true) {
    // Aviso y no bloqueo: Railway solo da IP saliente fija en el plan Pro, así
    // que exigirlo dejaría la integración sin arrancar por algo que el usuario
    // no puede cumplir. Con la clave en solo lectura, el peor caso de una
    // filtración es que alguien vea los saldos.
    avisos.push(
      'La clave de Binance no está restringida por IP. Con solo lectura el riesgo es ver saldos, no perderlos, pero conviene restringirla si algún día hay IP fija.',
    );
  }
  return avisos;
}
