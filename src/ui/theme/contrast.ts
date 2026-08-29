/**
 * Contraste según WCAG 2.2.
 *
 * Se implementa en vez de instalar una librería porque son doce líneas, se
 * necesita en pruebas que corren en cada commit, y una dependencia externa para
 * esto es más superficie de la que aporta.
 */

const HEX_SEIS = /^#?([0-9a-f]{6})$/i;

function channelToLinear(value: number): number {
  const c = value / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance(hex: string): number {
  const coincidencia = HEX_SEIS.exec(hex);
  if (coincidencia === null) {
    throw new Error(`Se esperaba un color hex de seis dígitos y llegó "${hex}"`);
  }
  const limpio = coincidencia[1] ?? '';
  const r = Number.parseInt(limpio.slice(0, 2), 16);
  const g = Number.parseInt(limpio.slice(2, 4), 16);
  const b = Number.parseInt(limpio.slice(4, 6), 16);
  return 0.2126 * channelToLinear(r) + 0.7152 * channelToLinear(g) + 0.0722 * channelToLinear(b);
}

export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const lighter = Math.max(la, lb);
  const darker = Math.min(la, lb);
  return (lighter + 0.05) / (darker + 0.05);
}
