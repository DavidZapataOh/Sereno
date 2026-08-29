#!/usr/bin/env node
/**
 * Audita los volcados de captura buscando rutas sensibles.
 *
 * Es la última barrera: si la frontera falló, esto lo detecta antes de que nadie
 * analice el archivo. Sale con código 1 ante cualquier hallazgo.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const DIR = 'capturas';

const PATRONES = [
  /login/i,
  /logon/i,
  /signin/i,
  /signup/i,
  /registro/i,
  /auth/i,
  /autentic/i,
  /contrase/i,
  /token/i,
  /session/i,
  /password/i,
  /clave/i,
  /credential/i,
  /otp/i,
  /mfa/i,
  /2fa/i,
  /segundo-factor/i,
  /captcha/i,
  /challenge/i,
];

/** Formas de secreto que no deberían aparecer en ningún cuerpo capturado. */
const SECRETOS_EN_CUERPO = [
  { nombre: 'JWT', patron: /\beyJ[\w-]+\.[\w-]+\.[\w-]+/ },
  { nombre: 'campo de contraseña', patron: /"(password|clave|pin|contrasena)"\s*:/i },
  { nombre: 'campo de token', patron: /"(access_?token|refresh_?token|jwt|id_?token)"\s*:/i },
];

let archivos;
try {
  archivos = readdirSync(DIR).filter((f) => f.endsWith('.json'));
} catch {
  console.error(`No existe el directorio ${DIR}/. Nada que verificar.`);
  process.exit(1);
}

if (archivos.length === 0) {
  console.error(`No hay volcados en ${DIR}/.`);
  process.exit(1);
}

let fallos = 0;

for (const archivo of archivos) {
  let dump;
  try {
    dump = JSON.parse(readFileSync(join(DIR, archivo), 'utf8'));
  } catch {
    console.error(
      `${archivo}: NO es JSON válido. Suele significar que se copió el texto visible ` +
        `de la pantalla en vez de exportar el volcado, o que el portapapeles lo truncó.`,
    );
    fallos += 1;
    continue;
  }

  if (!Array.isArray(dump.captures)) {
    console.error(`${archivo}: no tiene el campo "captures". No es un volcado de Sereno.`);
    fallos += 1;
    continue;
  }

  const capturas = dump.captures;

  const urlsSensibles = capturas.filter((c) => PATRONES.some((p) => p.test(c.url)));
  const cuerposSospechosos = capturas.flatMap((c) =>
    SECRETOS_EN_CUERPO.filter((s) => s.patron.test(c.body)).map((s) => ({
      url: c.url,
      tipo: s.nombre,
    })),
  );

  console.log(
    `${archivo}: ${capturas.length} capturas, ` +
      `${urlsSensibles.length} urls sensibles, ${cuerposSospechosos.length} cuerpos sospechosos`,
  );

  for (const c of urlsSensibles) {
    console.error(`  FALLO DE FRONTERA — url sensible capturada: ${c.url}`);
    fallos += 1;
  }
  for (const s of cuerposSospechosos) {
    console.error(`  FALLO DE CONTENIDO — ${s.tipo} en ${s.url}`);
    fallos += 1;
  }
}

if (fallos > 0) {
  console.error(`\n${fallos} hallazgos. DETENER el sprint y endurecer la frontera.`);
  process.exit(1);
}

console.log('\nSin hallazgos. La frontera aguantó.');
