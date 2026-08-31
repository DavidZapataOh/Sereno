import { rate, type Rate } from '@/domain/rates/rate';

/**
 * La TRM oficial, en datos abiertos del gobierno.
 *
 * Comprobado contra la fuente real el 2026-08-31. La respuesta es un arreglo
 * con esta forma exacta:
 *
 *     [{ "valor": "3202.79", "unidad": "COP",
 *        "vigenciadesde": "2026-08-29T00:00:00.000",
 *        "vigenciahasta": "2026-08-31T00:00:00.000" }]
 *
 * El rango de vigencia es lo que resuelve los fines de semana y los festivos:
 * la del viernes rige hasta el domingo. Sin él habría que decidir qué hacer un
 * sábado, y la decisión más fácil —«no hay tasa»— dejaría el patrimonio sin
 * valorar dos días de cada siete.
 */
const URL_TRM = 'https://www.datos.gov.co/resource/32sa-8pi3.json';

/** El punto decimal de la respuesta, con dos cifras: «3202.79» → 320279. */
const ESCALA = 2;

interface FilaTrm {
  valor?: string;
  unidad?: string;
  vigenciadesde?: string;
  vigenciahasta?: string;
}

export type Fetch = typeof fetch;

/**
 * Convierte «3202.79» en 320279 sin pasar por coma flotante.
 *
 * `parseFloat` aquí introduciría un error que después se multiplica por el
 * saldo entero.
 */
export function aEnteroConEscala(texto: string, escala: number): bigint {
  const limpio = texto.trim();
  if (!/^\d+(\.\d+)?$/.test(limpio)) {
    throw new Error(`La TRM no vino como número: "${texto}"`);
  }
  const [entera = '0', decimal = ''] = limpio.split('.');
  const ajustado = decimal.padEnd(escala, '0').slice(0, escala);
  return BigInt(`${entera}${ajustado}`);
}

/** Un valor fuera de este rango es una respuesta rota, no una noticia. */
const MINIMO = 1_000_00n;
const MAXIMO = 100_000_00n;

export function createTrmSource(hacerFetch: Fetch = fetch) {
  return {
    /** La TRM vigente más reciente. */
    ultima: async (): Promise<Rate> => {
      const respuesta = await hacerFetch(`${URL_TRM}?$limit=1&$order=vigenciadesde%20DESC`, {
        signal: AbortSignal.timeout(15_000),
      });
      const cuerpo = (await respuesta.json().catch(() => {
        throw new Error('La fuente de la TRM respondió algo que no es JSON');
      })) as FilaTrm[];

      const fila = Array.isArray(cuerpo) ? cuerpo[0] : undefined;
      if (fila?.valor === undefined || fila.vigenciadesde === undefined) {
        throw new Error('La respuesta de la TRM cambió de forma');
      }
      if (fila.unidad !== undefined && fila.unidad !== 'COP') {
        throw new Error(`La TRM vino en ${fila.unidad}, no en pesos`);
      }

      const valor = aEnteroConEscala(fila.valor, ESCALA);
      // Una TRM de 30 pesos o de 300.000 es una respuesta corrupta. Aceptarla
      // multiplicaría o dividiría el patrimonio por cien.
      if (valor < MINIMO || valor > MAXIMO) {
        throw new Error(`La TRM vino con un valor imposible: ${fila.valor}`);
      }

      return rate({
        desde: 'USD',
        hacia: 'COP',
        valor,
        escala: ESCALA,
        origen: 'TRM oficial',
        // La fecha viene sin zona; es de Colombia por definición.
        momento: `${fila.vigenciadesde.slice(0, 19)}.000-05:00`,
      });
    },
  };
}
