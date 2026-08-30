import { parseMessage } from '@/domain/mail/parsers/parser';

import type { Repositorios } from '../db/repositorios';
import type { Observabilidad } from '../observabilidad';

/**
 * Vuelve a parsear lo que quedó en revisión, con los parsers de hoy.
 *
 * No pide nada al servidor de correo: trabaja sobre el mensaje guardado. Es
 * para lo que se guarda entero. Y no puede duplicar: el id de un movimiento
 * es determinista, así que volver a extraerlo cae sobre la misma fila.
 */
export async function reprocesarPendientes(
  deps: { repos: Repositorios; observabilidad: Observabilidad },
  opciones: { limite: number },
): Promise<{ revisados: number; resueltos: number; movimientosNuevos: number }> {
  const pendientes = await deps.repos.mensajes.listarParaRevision(opciones.limite);
  let resueltos = 0;
  let movimientosNuevos = 0;

  for (const guardado of pendientes) {
    const resultado = parseMessage({
      id: guardado.id,
      remitente: guardado.remitente,
      asunto: guardado.asunto,
      recibidoEn: guardado.recibidoEn.toISOString(),
      texto: guardado.texto,
      html: guardado.html,
    });

    if (resultado.estado === 'parseado') {
      movimientosNuevos += await deps.repos.movimientos.guardarLote(
        guardado.id,
        resultado.movimientos,
      );
      await deps.repos.mensajes.marcar(guardado.id, 'parseado');
      resueltos += 1;
    } else if (resultado.estado === 'ignorado') {
      await deps.repos.mensajes.marcar(guardado.id, 'ignorado');
      resueltos += 1;
    }
    // Lo que sigue sin leerse se queda en la cola, con su motivo de antes.
  }

  deps.observabilidad.log('info', 'reproceso de revisión', {
    revisados: pendientes.length,
    resueltos,
  });
  return { revisados: pendientes.length, resueltos, movimientosNuevos };
}
