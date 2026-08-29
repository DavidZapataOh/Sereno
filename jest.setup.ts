// Los matchers de React Native Testing Library (toBeOnTheScreen, toHaveStyle…)
// vienen incluidos desde la versión 12.4: no hay que registrarlos a mano.

// Las pruebas no deben depender de la hora real del sistema.
// Cada suite que necesite tiempo lo fija explícitamente.
beforeEach(() => {
  jest.useRealTimers();
});
