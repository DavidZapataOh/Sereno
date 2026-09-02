// Los matchers de React Native Testing Library (toBeOnTheScreen, toHaveStyle…)
// vienen incluidos desde la versión 12.4: no hay que registrarlos a mano.

/**
 * Reanimated, doblado.
 *
 * Su código real arranca el runtime de *worklets*, que necesita el puente
 * nativo y en Jest revienta **al importarse**, no al usarse. Y el doble que
 * trae la librería tampoco sirve: importa su propio `index` y cae en lo mismo.
 * Así que el doble es nuestro, y vive en `src/test/mocks/`.
 */
// eslint-disable-next-line @typescript-eslint/no-require-imports -- la fábrica de un mock de Jest se evalúa antes que los imports del módulo
jest.mock('react-native-reanimated', () => require('./src/test/mocks/reanimated'));
// eslint-disable-next-line @typescript-eslint/no-require-imports -- misma razón que arriba
jest.mock('react-native-worklets', () => require('./src/test/mocks/worklets'));

// Las pruebas no deben depender de la hora real del sistema.
// Cada suite que necesite tiempo lo fija explícitamente.
beforeEach(() => {
  jest.useRealTimers();
});
