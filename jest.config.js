module.exports = {
  preset: 'jest-expo',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg|react-native-webview)',
  ],
  // Se mide el código con lógica. Se excluyen:
  //  - las rutas de expo-router, que son composición y se verifican con E2E
  //  - las utilidades de prueba
  //  - las reexportaciones de una línea
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.test.{ts,tsx}',
    '!src/app/**',
    '!src/ui/hooks/use-color-scheme.ts',
    // Cableado sin lógica: elige el adaptador activo.
    '!src/infrastructure/observability/index.ts',
    // `render.tsx` es andamiaje de pruebas: envuelve la librería, no tiene
    // lógica propia que verificar. `factory.ts` y `arbitraries.ts` sí la
    // tienen y sí se miden.
    '!src/test/render.tsx',
    '!src/test/sanity-target.ts',
  ],
  coverageThreshold: {
    global: { statements: 80, branches: 75, functions: 80, lines: 80 },
  },
  // OJO: no se define `moduleNameMapper` aquí. El preset `jest-expo` ya mapea
  // `@/` hacia `src/` y, sobre todo, redirige `react-native` a una ruta
  // absoluta. Sobrescribirlo carga dos instancias de React Native: la librería
  // de pruebas renderiza en una y `screen` consulta la otra, y toda consulta
  // falla con «render function has not been called».
  clearMocks: true,
  restoreMocks: true,
  // El renderizado concurrente de React 19 con instrumentación de cobertura
  // tarda más que el umbral por defecto de 5 s.
  testTimeout: 15000,
};
