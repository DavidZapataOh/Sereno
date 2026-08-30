#!/usr/bin/env tsx
/**
 * Obtiene el token de refresco de Gmail, una sola vez.
 *
 *   SERENO_GOOGLE_ID=... SERENO_GOOGLE_SECRET=... npx tsx scripts/autorizar-gmail.ts
 *
 * Abre la URL que imprime, autoriza con la cuenta del correo, y pega aquí el
 * código. Lo que imprime al final va al almacén de secretos del servidor;
 * **no** al repositorio.
 *
 * Ojo con la trampa del README del sprint: si la app de Google está en estado
 * «Testing», este token caduca a los siete días. Por eso el adaptador que se
 * usa es el de IMAP.
 */
import { createInterface } from 'node:readline/promises';

import { google } from 'googleapis';

const id = process.env['SERENO_GOOGLE_ID'];
const secreto = process.env['SERENO_GOOGLE_SECRET'];
if (id === undefined || secreto === undefined) {
  process.stderr.write('Faltan SERENO_GOOGLE_ID y SERENO_GOOGLE_SECRET\n');
  process.exit(2);
}

const auth = new google.auth.OAuth2(id, secreto, 'urn:ietf:wg:oauth:2.0:oob');
const url = auth.generateAuthUrl({
  access_type: 'offline',
  prompt: 'consent',
  scope: ['https://www.googleapis.com/auth/gmail.readonly'],
});

process.stdout.write(`\nAbre esta URL y autoriza:\n\n${url}\n\n`);
const consola = createInterface({ input: process.stdin, output: process.stdout });
const codigo = await consola.question('Pega el código: ');
consola.close();

const { tokens } = await auth.getToken(codigo.trim());
if (typeof tokens.refresh_token !== 'string') {
  process.stderr.write('Google no devolvió token de refresco. Revoca el acceso y repite.\n');
  process.exit(1);
}
process.stdout.write(`\nSERENO_GMAIL_REFRESH_TOKEN=${tokens.refresh_token}\n`);
