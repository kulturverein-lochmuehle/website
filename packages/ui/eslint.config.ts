import config from '@davidenke/lint';
import type { Linter } from 'eslint';

export default [
  ...config,
  {
    ignores: ['public', 'src/esbuild.config.ts'],
  },
  {
    files: ['**/*.spec.ts'],
    rules: {
      '@typescript-eslint/no-unused-expressions': ['off'],
      'import/no-unresolved': ['off'],
    },
  },
] satisfies Linter.Config[];
