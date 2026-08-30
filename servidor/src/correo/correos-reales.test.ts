import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { simpleParser } from 'mailparser';
import { describe, expect, it } from 'vitest';

import { parseMessage } from '@/domain/mail/parsers/parser';

import { mensajeDesde } from './imap';

const CARPETA = join(fileURLToPath(new URL('.', import.meta.url)), '../../../capturas/correos');
const archivos = existsSync(CARPETA) ? readdirSync(CARPETA).filter((f) => f.endsWith('.eml')) : [];

/**
 * El camino real, entero: MIME → `mensajeDesde` → `parseMessage`. Vive en el
 * servidor y no en el dominio porque necesita `mailparser`, que es quien
 * despliega las cabeceras plegadas y decodifica `quoted-printable`. Un
 * ayudante casero se salta eso y da un falso resultado: la cabecera `From`
 * de Bancolombia viene partida en dos líneas.
 */
async function leer(archivo: string) {
  const crudo = readFileSync(join(CARPETA, archivo));
  return mensajeDesde(0, await simpleParser(crudo));
}

/**
 * Los correos reales de David, si están.
 *
 * No se versionan —este repositorio es público y son datos bancarios—, así
 * que esto se salta donde no estén, y lo dice en vez de dar un falso verde.
 * Donde están, mide la cobertura de verdad.
 */
(archivos.length > 0 ? describe : describe.skip)('correos reales de capturas/correos', () => {
  it.each(archivos)('%s se lee sin quedar en error ni desconocido', async (archivo) => {
    const r = parseMessage(await leer(archivo));
    if (r.estado === 'error') throw new Error(`${archivo}: ${r.motivo}`);
    expect(r.estado).not.toBe('desconocido');
  });

  it('todos producen un movimiento con monto, fecha y descripción creíbles', async () => {
    const fallos: string[] = [];
    for (const archivo of archivos) {
      const r = parseMessage(await leer(archivo));
      if (r.estado !== 'parseado') {
        fallos.push(`${archivo}: ${r.estado}`);
        continue;
      }
      for (const m of r.movimientos) {
        if (m.monto <= 0) fallos.push(`${archivo}: monto ${String(m.monto)}`);
        if (Number.isNaN(Date.parse(m.fecha))) fallos.push(`${archivo}: fecha «${m.fecha}»`);
        if (m.descripcion.trim().length === 0) fallos.push(`${archivo}: sin descripción`);
      }
    }
    expect(fallos).toEqual([]);
  });
});
