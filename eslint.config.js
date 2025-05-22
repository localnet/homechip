import javascript from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import typescript from 'typescript-eslint';

export default defineConfig(
  globalIgnores(['**/dist/']),
  {
    files: ['**/*.{js,ts}'],
    extends: [javascript.configs.recommended],
    rules: {
      eqeqeq: ['error', 'always', { null: 'never' }],
      'no-console': 'warn',
      'no-duplicate-imports': ['error', { includeExports: true }],
    },
  },
  {
    files: ['**/*.ts'],
    extends: [typescript.configs.recommended, typescript.configs.stylistic],
    rules: {
      '@typescript-eslint/explicit-function-return-type': ['error', { allowExpressions: true }],
      '@typescript-eslint/member-ordering': 'error',
      '@typescript-eslint/no-explicit-any': ['error', { ignoreRestArgs: true }],
    },
  },
);
