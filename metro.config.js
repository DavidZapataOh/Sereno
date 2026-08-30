const path = require('node:path');

const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// El servidor (sprint 06) es un paquete aparte, con su propio node_modules. No
// entra al bundle de la app ni al vigilante de archivos: Metro observa el
// proyecto entero y sin esto acabaría siguiendo dependencias de Node.
const servidor = path.resolve(__dirname, 'servidor').replace(/[\\/]/g, '[\\\\/]');
config.resolver.blockList = [new RegExp(`^${servidor}[\\\\/].*`)];

module.exports = config;
