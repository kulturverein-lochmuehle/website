import baseConfig from '@enke.dev/lint';
import type { FixupConfigArray } from '@eslint/compat';
import { fixupConfigRules } from '@eslint/compat';
import { FlatCompat } from '@eslint/eslintrc';

// Get Next.js configs and fix compatibility issues
const nextConfigs = fixupConfigRules(
  new FlatCompat({ baseDirectory: import.meta.dirname }).extends(
    'next/core-web-vitals',
    'next/typescript',
  ) as FixupConfigArray,
);

const eslintConfig = [
  ...nextConfigs,
  ...baseConfig.filter(config => {
    const knownCriticalPlugins = ['import', '@typescript-eslint', 'json'];
    // Skip configs that define plugins that might conflict with Next.js
    return Object.keys(config.plugins ?? {}).every(
      plugin => !knownCriticalPlugins.includes(plugin),
    );
  }),
];

export default eslintConfig;
