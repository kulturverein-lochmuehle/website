// @ts-check

import eslintJs from '@eslint/js';
import eslintPluginImport from 'eslint-plugin-import';
import eslintLit from 'eslint-plugin-lit';
// eslint-disable-next-line import/extensions
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import eslintPluginSimpleImportSort from 'eslint-plugin-simple-import-sort';
import eslintPluginUnusedImports from 'eslint-plugin-unused-imports';
import eslintTs from 'typescript-eslint';

export default eslintTs.config(
  eslintJs.configs.recommended,
  eslintPluginImport.flatConfigs.recommended,
  eslintPluginImport.flatConfigs.typescript,
  ...eslintTs.configs.recommended,
  eslintPluginPrettierRecommended,
  eslintLit.configs['flat/recommended'],
  {
    ignores: ['dist/', 'node_modules/'],
  },
  {
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: {
        project: true,
        tsconfigRootDir: './',
        warnOnUnsupportedTypeScriptVersion: false,
      },
    },
  },
  {
    plugins: {
      'simple-import-sort': eslintPluginSimpleImportSort,
      'unused-imports': eslintPluginUnusedImports,
    },
  },
  {
    rules: {
      // formatting
      'linebreak-style': ['error', 'unix'],
      semi: ['error', 'always'],
      'no-unused-vars': 'off',

      // import formatting
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/consistent-type-exports': 'error',
      'import/no-dynamic-require': 'warn',
      'import/no-nodejs-modules': 'warn',
      'import/extensions': ['error', { js: 'always' }],

      // import sorting
      'simple-import-sort/imports': [
        'error',
        {
          groups: [
            ['^\\u0000'],
            ['^node:'],
            ['^@?\\w'],
            ['^'],
            ['^\\.'],
            ['^.+\\.s?json$'],
            ['^.+\\.s?(png|jpg|jpeg|svg)$'],
            ['^.+\\.s?(css|scss)$'],
          ],
        },
      ],
      'simple-import-sort/exports': 'error',
      'prettier/prettier': ['error', {}, { usePrettierrc: true }],

      // unused imports
      'import/no-unresolved': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      'unused-imports/no-unused-vars': [
        'error',
        { args: 'after-used', argsIgnorePattern: '^_', vars: 'all', varsIgnorePattern: '^_' },
      ],
    },
  },
  // unit tests
  {
    files: ['**/*.spec.ts', '**/*.test.ts'],
    rules: {
      // expressions are necessary for chai assertions
      'no-unused-expressions': 'off',
      '@typescript-eslint/no-unused-expressions': 'off',
    },
  },
);
