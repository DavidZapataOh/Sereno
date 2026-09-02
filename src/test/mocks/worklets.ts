/**
 * `react-native-worklets`, doblado.
 *
 * Es el runtime que hay debajo de reanimated, y en Jest revienta al importarse
 * por lo mismo: necesita el puente nativo. Lo único que se usa de él en la app
 * es `scheduleOnRN`, que en pruebas es llamar a la función y ya.
 */
module.exports = {
  __esModule: true,
  scheduleOnRN: <A extends unknown[]>(fn: (...args: A) => unknown, ...args: A) => fn(...args),
  runOnUI: <A extends unknown[]>(fn: (...args: A) => unknown) => fn,
};
