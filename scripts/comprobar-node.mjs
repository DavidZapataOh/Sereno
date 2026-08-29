/**
 * Comprueba que se está usando el Node que el proyecto exige.
 *
 * Existe por un fallo concreto: en esta máquina conviven el Node de nvm
 * (v24.12) y un `/usr/bin/node` v18 del sistema. Un shell NO interactivo —el
 * que abre `wsl -- npm`, un cron, un hook de editor— no carga nvm y coge el
 * v18. Con ese, el binario nativo de `better-sqlite3` no falla al instalarse ni
 * al compilar: falla al CARGARSE, y mata el proceso con SIGSEGV.
 *
 * El síntoma es pésimo de diagnosticar. Ocho suites mueren con «A jest worker
 * process was terminated ... signal=SIGSEGV» tras dos minutos y medio, sin
 * mencionar a Node por ningún lado. Esta comprobación tarda un milisegundo y
 * dice exactamente qué pasa.
 *
 * Se escribe con sintaxis conservadora a propósito: tiene que poder ejecutarse
 * en la versión equivocada, que es justo cuando hace falta.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const paquete = JSON.parse(readFileSync(join(raiz, 'package.json'), 'utf8'));
const exigido = paquete.engines.node;

const minimo = exigido
  .replace(/^[^\d]*/, '')
  .split('.')
  .map(Number);
const actual = process.versions.node.split('.').map(Number);

const suficiente =
  actual[0] > minimo[0] || (actual[0] === minimo[0] && actual[1] >= (minimo[1] ?? 0));

if (suficiente) process.exit(0);

const ESC = '[';
const rojo = (texto) => `${ESC}31m${texto}${ESC}0m`;
const negrita = (texto) => `${ESC}1m${texto}${ESC}0m`;

process.stderr.write(
  [
    '',
    rojo(negrita('Node equivocado.')),
    '',
    `  Este proceso corre con  Node v${process.versions.node}`,
    `                          ${process.execPath}`,
    `  y el proyecto exige     Node ${exigido}`,
    '',
    '  Con la versión equivocada, el módulo nativo de better-sqlite3 no avisa:',
    '  mata el proceso con SIGSEGV. Verías ocho suites de pruebas morir con',
    '  «A jest worker process was terminated» sin ninguna pista de la causa.',
    '',
    negrita('  Cómo arreglarlo:'),
    '',
    '  · Lo más cómodo: abre la terminal de Ubuntu y trabaja desde ahí. Un shell',
    '    interactivo carga nvm solo, y esto no vuelve a pasar.',
    '',
    '  · Si ya estás en la terminal de Ubuntu, nvm no se cargó por algún motivo:',
    '        nvm use',
    '',
    '  · Si lanzas desde PowerShell, el shell tiene que ser INTERACTIVO (-ic).',
    '    Con -lc no basta: el .bashrc de Ubuntu se corta en la primera línea',
    '    cuando el shell no es interactivo, y ahí es donde vive nvm.',
    '        wsl -d Ubuntu-24.04 --cd <ruta-del-proyecto> -- bash -ic "npm test"',
    '',
    '  `npm run integrar` no necesita nada de esto: se arregla solo.',
    '',
  ].join('\n'),
);
process.exit(1);
