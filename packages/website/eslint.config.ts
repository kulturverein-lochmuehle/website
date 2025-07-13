import config from '@enke.dev/lint';
import { FlatCompat } from '@eslint/eslintrc';
import type { Linter } from 'eslint';
import { dirname } from 'path';
import { fileURLToPath } from 'url';

const baseDirectory = dirname(fileURLToPath(import.meta.url));
const compat = new FlatCompat({ baseDirectory });

export default [
  ...config,
  ...compat.extends("next/core-web-vitals", "next/typescript"),
] satisfies Linter.Config[];
