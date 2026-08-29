// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const tseslint = require('typescript-eslint');
const prettier = require('eslint-config-prettier');
const boundaries = require('eslint-plugin-boundaries');

module.exports = defineConfig([
  expoConfig,

  // Reglas con información de tipos, solo sobre TypeScript.
  ...tseslint.configs.strictTypeChecked.map((config) => ({
    ...config,
    files: ['src/**/*.ts', 'src/**/*.tsx'],
  })),

  {
    files: ['src/**/*.ts', 'src/**/*.tsx'],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: __dirname,
      },
    },
    rules: {
      // El dinero y las cuentas no admiten tipos borrosos.
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unsafe-assignment': 'error',
      '@typescript-eslint/no-unsafe-member-access': 'error',
      '@typescript-eslint/no-unsafe-call': 'error',
      '@typescript-eslint/no-unsafe-return': 'error',
      '@typescript-eslint/no-unsafe-argument': 'error',

      // Una promesa sin await en una ingesta bancaria es un dato perdido en silencio.
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      '@typescript-eslint/await-thenable': 'error',

      // Exactitud.
      '@typescript-eslint/strict-boolean-expressions': [
        'error',
        { allowNullableBoolean: false, allowNullableString: false, allowNumber: false },
      ],
      '@typescript-eslint/switch-exhaustiveness-check': 'error',
      '@typescript-eslint/no-unnecessary-condition': 'error',
      eqeqeq: ['error', 'always'],

      // Higiene.
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      'no-console': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
    },
  },

  // Las pruebas pueden ser más laxas con los tipos de los dobles.
  {
    files: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    rules: {
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
    },
  },

  // Fronteras entre capas. Las dependencias van en un solo sentido.
  {
    files: ['src/**/*.ts', 'src/**/*.tsx'],
    plugins: { boundaries },
    settings: {
      'boundaries/elements': [
        { type: 'domain', pattern: 'src/domain/**' },
        { type: 'application', pattern: 'src/application/**' },
        { type: 'infrastructure', pattern: 'src/infrastructure/**' },
        { type: 'ui', pattern: 'src/ui/**' },
        { type: 'routes', pattern: 'src/app/**' },
        { type: 'test', pattern: 'src/test/**' },
      ],
      // Los archivos de prueba se identifican por su nombre, no por su carpeta:
      // viven junto al código que prueban, en cualquier capa.
      'boundaries/files': [{ category: 'test', pattern: '**/*.test.{ts,tsx}' }],
    },
    rules: {
      'boundaries/dependencies': [
        'error',
        {
          default: 'disallow',
          policies: [
            // El dominio es autosuficiente: no conoce nada más.
            {
              from: { element: { type: 'domain' } },
              allow: { to: { element: { type: 'domain' } } },
            },
            // Los casos de uso orquestan el dominio.
            {
              from: { element: { type: 'application' } },
              allow: { to: { element: { types: { anyOf: ['domain', 'application'] } } } },
            },
            // La infraestructura implementa los puertos del dominio.
            {
              from: { element: { type: 'infrastructure' } },
              allow: {
                to: {
                  element: { types: { anyOf: ['domain', 'application', 'infrastructure'] } },
                },
              },
            },
            // La interfaz consume casos de uso y tipos del dominio.
            {
              from: { element: { type: 'ui' } },
              allow: { to: { element: { types: { anyOf: ['domain', 'application', 'ui'] } } } },
            },
            // Las rutas son la capa de composición: cablean la interfaz con la
            // infraestructura. Es el único sitio donde se juntan.
            {
              from: { element: { type: 'routes' } },
              allow: {
                to: {
                  element: {
                    types: {
                      anyOf: ['ui', 'application', 'domain', 'infrastructure', 'routes'],
                    },
                  },
                },
              },
            },
            // Las utilidades de prueba pueden tocar todo.
            {
              from: { element: { type: 'test' } },
              allow: {
                to: {
                  element: {
                    types: {
                      anyOf: ['domain', 'application', 'infrastructure', 'ui', 'routes', 'test'],
                    },
                  },
                },
              },
            },
            // Cualquier archivo de prueba puede usar las utilidades de prueba,
            // sea cual sea la capa en la que viva. Abrir la frontera de la capa
            // entera dejaría que el código de producción las importara también.
            {
              from: { file: { categories: 'test' } },
              allow: { to: { element: { type: 'test' } } },
            },
            // Las dependencias externas no las gobierna esta regla.
            { allow: { to: { module: { origin: 'external' } } } },
          ],
        },
      ],
    },
  },

  // Los archivos de configuración son CommonJS y corren en Node.
  {
    files: ['*.js', '*.cjs'],
    languageOptions: {
      sourceType: 'commonjs',
      globals: {
        __dirname: 'readonly',
        __filename: 'readonly',
        module: 'writable',
        require: 'readonly',
        process: 'readonly',
        exports: 'writable',
      },
    },
  },

  // Prettier al final: apaga todo lo que compita con el formato.
  prettier,

  {
    ignores: ['dist/*', '.expo/*', 'node_modules/*', 'coverage/*'],
  },
]);
