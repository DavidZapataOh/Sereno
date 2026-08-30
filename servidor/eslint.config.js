// @ts-check
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist/**', 'node_modules/**', 'drizzle/**'] },
  eslint.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  {
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      // Las mismas que en la app: el dinero no admite tipos borrosos y una
      // promesa sin await en una ingesta bancaria es un dato perdido.
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/strict-boolean-expressions': [
        'error',
        { allowNullableBoolean: false, allowNullableString: false, allowNumber: false },
      ],
      '@typescript-eslint/switch-exhaustiveness-check': 'error',
      '@typescript-eslint/no-unnecessary-condition': 'error',
      'no-console': 'error',
    },
  },
  {
    files: ['**/*.test.ts', 'src/db/prueba.ts'],
    rules: { '@typescript-eslint/no-non-null-assertion': 'off' },
  },
  {
    // Los archivos de configuración son JavaScript y no están en el proyecto
    // de TypeScript: las reglas con información de tipos no aplican.
    files: ['**/*.js'],
    ...tseslint.configs.disableTypeChecked,
  },
);
