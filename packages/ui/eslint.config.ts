import config, { setTsConfigRootDir } from '@enke.dev/lint';
import { defineConfig } from 'eslint/config';

export default defineConfig([
  // extend the base config
  ...config,
  // configure typescript parser to your needs
  setTsConfigRootDir(import.meta.dirname),
  {
    ignores: ['public'],
  },
  {
    files: ['**/*.spec.ts'],
    rules: {
      '@typescript-eslint/no-unused-expressions': ['off'],
      'import/no-unresolved': ['off'],
    },
  },
  {
    files: ['**/*.ts'],
    rules: {
      'html/no-extra-spacing-attrs': ['error', { enforceBeforeSelfClose: true }],
    },
  },
]);
