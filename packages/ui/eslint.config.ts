import config from '@davidenke/lint';
import type { Linter } from 'eslint';

export default [
  ...config,
  {
    ignores: ['src/index.ts', 'src(custom-elements.json'],
  },
  {
    files: ['**/*.spec.ts'],
    rules: {
      '@typescript-eslint/no-unused-expressions': ['off'],
      'import/no-unresolved': ['off'],
    },
  },
] satisfies Linter.Config[];
