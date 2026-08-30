import type { MailSource } from '@/domain/mail/message';
import { parseMessage } from '@/domain/mail/parsers/parser';

import type { Repositorios } from '../db/repositorios';
import type { Observabilidad } from '../observabilidad';
import { reintentar } from '../resiliencia/reintentar';

export interface CorridaCorreo {
  mensajesVistos: number;
  nuevos: number;
  movimientosNuevos: number;
  ignorados: number;
  desconocidos: number;
  errores: number;
}

export interface DependenciasCiclo {
  fuente: MailSource;
  repos: Repositorios;
  observabilidad: Observabilidad;
}

/**
 * Una pasada: leer desde el cursor, guardar cada correo, parsearlo, y avanzar.
 *
 * El cursor avanza aunque un correo no se pueda leer: si un formato roto
 * detuviera la lectura, un solo correo malo pararía la ingesta para siempre.
 * Lo que no se pudo leer queda en la base, entero, con su motivo, y el plan
 * 06 lo expone y lo reprocesa.
 */
export async function ingerirCorreos(
  deps: DependenciasCiclo,
  opciones: { limite: number },
): Promise<CorridaCorreo> {
  const corridaId = await deps.repos.corridas.abrir();
  const cuenta: CorridaCorreo = {
    mensajesVistos: 0,
    nuevos: 0,
    movimientosNuevos: 0,
    ignorados: 0,
    desconocidos: 0,
    errores: 0,
  };

  try {
    const guardado = await deps.repos.cursores.leer(deps.fuente.id);
    // La única salida a la red de esta función. Se reintenta lo transitorio
    // —una desconexión, un límite de tasa—; una credencial revocada sube a la
    // primera.
    const { mensajes, cursor } = await reintentar(
      () =>
        deps.fuente.buscar(
          guardado === null ? null : { tipo: deps.fuente.id, valor: guardado },
          opciones.limite,
        ),
      {
        intentos: 3,
        baseMs: 2000,
        topeMs: 30_000,
        alReintentar: (intento, _error, espera) => {
          deps.observabilidad.log('warn', 'reintentando la lectura del correo', {
            intento,
            esperaMs: espera,
          });
        },
      },
    );

    for (const mensaje of mensajes) {
      cuenta.mensajesVistos += 1;
      // Ver el mismo correo dos veces pasa cuando una corrida se corta: no es
      // un error, y no se vuelve a procesar.
      if (await deps.repos.mensajes.existe(mensaje.id)) continue;
      cuenta.nuevos += 1;

      await deps.repos.mensajes.guardar({
        id: mensaje.id,
        origen: deps.fuente.id,
        remitente: mensaje.remitente,
        asunto: mensaje.asunto,
        recibidoEn: new Date(mensaje.recibidoEn),
        texto: mensaje.texto,
        html: mensaje.html,
      });

      const resultado = parseMessage(mensaje);
      switch (resultado.estado) {
        case 'parseado': {
          cuenta.movimientosNuevos += await deps.repos.movimientos.guardarLote(
            mensaje.id,
            resultado.movimientos,
          );
          await deps.repos.mensajes.marcar(mensaje.id, 'parseado');
          break;
        }
        case 'ignorado':
          cuenta.ignorados += 1;
          await deps.repos.mensajes.marcar(mensaje.id, 'ignorado');
          break;
        case 'desconocido':
          cuenta.desconocidos += 1;
          await deps.repos.mensajes.marcar(
            mensaje.id,
            'desconocido',
            `Ningún parser reconoce a ${mensaje.remitente}`,
          );
          break;
        case 'error':
          cuenta.errores += 1;
          await deps.repos.mensajes.marcar(mensaje.id, 'error', resultado.motivo);
          // Se registra el motivo y la fuente; nunca el cuerpo.
          deps.observabilidad.log('warn', 'correo no parseado', {
            fuente: resultado.fuente,
            motivo: resultado.motivo,
          });
          break;
      }
    }

    await deps.repos.cursores.escribir(deps.fuente.id, cursor.valor);
    await deps.repos.corridas.cerrar(corridaId, {
      mensajesVistos: cuenta.mensajesVistos,
      movimientosNuevos: cuenta.movimientosNuevos,
      desconocidos: cuenta.desconocidos + cuenta.errores,
      error: null,
    });
    return cuenta;
  } catch (error) {
    // La corrida se cierra igual, con el error escrito: el latido del plan 06
    // necesita saber que se intentó y que salió mal.
    await deps.repos.corridas.cerrar(corridaId, {
      mensajesVistos: cuenta.mensajesVistos,
      movimientosNuevos: cuenta.movimientosNuevos,
      desconocidos: cuenta.desconocidos + cuenta.errores,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}
