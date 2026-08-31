import type { Rate } from '@/domain/rates/rate';
import type { RateRepository } from '@/domain/rates/rate-repository';

/** Doble del puerto de tasas. El de verdad tiene sus propias pruebas. */
export function createInMemoryRateRepository(iniciales: Rate[] = []): RateRepository {
  const guardadas = [...iniciales];
  const delPar = (desde: string, hacia: string) =>
    guardadas
      .filter((t) => t.desde === desde && t.hacia === hacia)
      .sort((a, b) => b.momento.localeCompare(a.momento));

  return {
    guardar: (tasa) => {
      guardadas.push(tasa);
      return Promise.resolve();
    },
    ultima: (desde, hacia) => Promise.resolve(delPar(desde, hacia)[0] ?? null),
    enFecha: (desde, hacia, dia) =>
      Promise.resolve(delPar(desde, hacia).find((t) => t.momento.slice(0, 10) <= dia) ?? null),
    vigentes: () => {
      const porPar = new Map<string, Rate>();
      for (const t of [...guardadas].sort((a, b) => b.momento.localeCompare(a.momento))) {
        const clave = `${t.desde}->${t.hacia}`;
        if (!porPar.has(clave)) porPar.set(clave, t);
      }
      return Promise.resolve([...porPar.values()]);
    },
  };
}
