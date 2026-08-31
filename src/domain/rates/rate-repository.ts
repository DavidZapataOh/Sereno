import type { CurrencyCode } from '@/domain/money/currency';

import type { Rate } from './rate';

/**
 * Dónde viven las tasas.
 *
 * Se **guardan**, no se recalculan: valorar el patrimonio de hace un mes con
 * la tasa de hoy reescribiría el pasado, y una gráfica que cambia sola no mide
 * nada.
 */
export interface RateRepository {
  guardar: (tasa: Rate) => Promise<void>;
  /** La más reciente de ese par, o `null` si nunca se guardó ninguna. */
  ultima: (desde: CurrencyCode, hacia: CurrencyCode) => Promise<Rate | null>;
  /** La que regía ese día: la más reciente con momento anterior o igual. */
  enFecha: (desde: CurrencyCode, hacia: CurrencyCode, dia: string) => Promise<Rate | null>;
  /** Las últimas de cada par. Es lo que necesita valorar el patrimonio de hoy. */
  vigentes: () => Promise<Rate[]>;
}
