import { useEffect, useRef, useState } from 'react';

import { useReducedMotion } from './use-reduced-motion';

/**
 * Cuenta hasta un número, **y termina exacto**.
 *
 * Se usa cuando una cifra cambia estando a la vista: el patrimonio después de
 * sincronizar, por ejemplo. Ahí el cambio **es** la noticia, y verlo subir es lo
 * que le da peso.
 *
 * Tres reglas que la hacen segura en una app de dinero:
 *
 * 1. **Al montar no cuenta**: enseña el valor. Contar al abrir una pantalla es
 *    adorno, y encima retrasa la lectura.
 * 2. **Acaba en el valor exacto**, siempre. La animación no puede dejar una
 *    cifra a medias ni redondeada.
 * 3. Con «reducir movimiento», salta directamente al valor.
 */
export function useCountUp(valor: bigint, duracionMs: number): bigint {
  const reducido = useReducedMotion();
  const [mostrado, setMostrado] = useState(valor);
  const anterior = useRef(valor);
  const primeraVez = useRef(true);

  useEffect(() => {
    if (primeraVez.current) {
      primeraVez.current = false;
      anterior.current = valor;
      setMostrado(valor);
      return;
    }

    const desde = anterior.current;
    anterior.current = valor;

    if (reducido || desde === valor) {
      setMostrado(valor);
      return;
    }

    const inicio = Date.now();
    const diferencia = valor - desde;
    let vigente = true;

    const paso = (): void => {
      if (!vigente) return;
      const avance = Math.min(1, (Date.now() - inicio) / duracionMs);
      if (avance >= 1) {
        // El valor final es el de verdad, no el interpolado: es dinero.
        setMostrado(valor);
        return;
      }
      // Desaceleración: rápido al principio, suave al llegar.
      const suave = 1 - (1 - avance) ** 3;
      setMostrado(desde + (diferencia * BigInt(Math.round(suave * 1000))) / 1000n);
      requestAnimationFrame(paso);
    };

    requestAnimationFrame(paso);
    return () => {
      vigente = false;
    };
  }, [valor, duracionMs, reducido]);

  return mostrado;
}
