#!/usr/bin/env node
/**
 * Busca secretos en lo que está versionado.
 *
 * Existe porque «no subir secretos» es una intención, y una intención no
 * protege nada. Esto sí: corre en `verify` y en CI, y falla el commit.
 *
 * Solo mira archivos versionados (`git ls-files`): lo que está en
 * `.gitignore` puede tener secretos, para eso está.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

/** Variables cuyo valor nunca puede estar en el repositorio. */
const NOMBRES =
  '(SERENO_TOKEN|SERENO_CLAVE_CIFRADO|IMAP_CLAVE|SERENO_GOOGLE_SECRET|SERENO_GMAIL_REFRESH_TOKEN|EXPO_PUBLIC_SERENO_TOKEN)';

const PATRONES = [
  {
    nombre: 'contraseña en una URL de Postgres',
    patron: /postgres(ql)?:\/\/[^\s:'"]+:[^\s@'"]+@/i,
  },
  { nombre: 'token de refresco de Google', patron: /\b1\/\/[0-9A-Za-z_-]{30,}/ },
  { nombre: 'clave de API de Google', patron: /\bAIza[0-9A-Za-z_-]{35}\b/ },
  { nombre: 'clave privada', patron: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
  { nombre: 'clave de AWS', patron: /\bAKIA[0-9A-Z]{16}\b/ },
  {
    // En un archivo de entorno: `NOMBRE=valor`, sin comillas, hasta el final.
    nombre: 'secreto en un archivo de entorno',
    patron: new RegExp(`^\\s*${NOMBRES}\\s*=\\s*[A-Za-z0-9+/_=-]{8,}\\s*$`),
  },
  {
    // En código: el valor va entrecomillado. Sin exigir la comilla, un
    // `SERENO_CLAVE_CIFRADO: randomBytes(32)` se marcaría como secreto, y una
    // alarma que salta con lo correcto enseña a ignorarla.
    nombre: 'secreto escrito en el código',
    patron: new RegExp(`${NOMBRES}\\s*[=:]\\s*['"\`][A-Za-z0-9+/_=-]{8,}['"\`]`),
  },
];

/** Archivos que hablan de secretos sin contener ninguno. */
const EXENTOS = new Set([
  'scripts/comprobar-secretos.mjs',
  'scripts/comprobar-secretos.test.ts',
  '.env.example',
  'servidor/.env.example',
]);

const archivos = execFileSync('git', ['ls-files'], { encoding: 'utf8' })
  .split('\n')
  .filter((f) => f.length > 0)
  .filter((f) => !EXENTOS.has(f))
  .filter((f) => !/\.(png|jpg|jpeg|gif|webp|ttf|otf|ico)$/i.test(f))
  .filter((f) => !/(^|\/)package-lock\.json$/.test(f));

const hallazgos = [];
for (const archivo of archivos) {
  let contenido;
  try {
    contenido = readFileSync(archivo, 'utf8');
  } catch {
    continue;
  }
  const lineas = contenido.split('\n');
  for (const { nombre, patron } of PATRONES) {
    const linea = lineas.findIndex((l) => patron.test(l));
    if (linea !== -1) hallazgos.push(`${archivo}:${String(linea + 1)} — ${nombre}`);
  }
}

if (hallazgos.length > 0) {
  process.stderr.write('\nParece haber secretos en el repositorio:\n\n');
  for (const h of hallazgos) process.stderr.write(`  ${h}\n`);
  process.stderr.write(
    '\nSi es un falso positivo, añade el archivo a EXENTOS con un comentario que explique por qué.\n' +
      'Si es real: rota la credencial ANTES de borrarla del historial. Ya está publicada.\n\n',
  );
  process.exit(1);
}
process.stdout.write(
  `Sin secretos aparentes en ${String(archivos.length)} archivos versionados.\n`,
);
