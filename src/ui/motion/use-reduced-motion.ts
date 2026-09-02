import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/**
 * Si el sistema pide reducir el movimiento.
 *
 * No es un extra: es la diferencia entre una app viva y una app que marea a
 * quien no puede con ella. Cuando esto devuelve `true`, **nada se mueve** —los
 * cambios ocurren de golpe— y todo sigue funcionando igual.
 *
 * Se consulta al montar y se escucha el cambio: se puede activar con la app
 * abierta, y quien lo activa suele hacerlo justo porque algo le está sentando
 * mal.
 */
export function useReducedMotion(): boolean {
  const [reducido, setReducido] = useState(false);

  useEffect(() => {
    let vigente = true;

    AccessibilityInfo.isReduceMotionEnabled()
      .then((valor) => {
        if (vigente) setReducido(valor);
      })
      .catch(() => {
        // Si no se puede saber, se asume que no. Un fallo al consultar una
        // preferencia no puede dejar la app sin movimiento ni romperla.
      });

    const suscripcion = AccessibilityInfo.addEventListener('reduceMotionChanged', setReducido);

    return () => {
      vigente = false;
      suscripcion.remove();
    };
  }, []);

  return reducido;
}
