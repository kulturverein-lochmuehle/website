import { vitePlugin } from '@remcovaes/web-test-runner-vite-plugin';
import type { TestRunnerConfig } from '@web/test-runner';
import { playwrightLauncher } from '@web/test-runner-playwright';

import viteConfig from './vite.config.js';

// we just pick the necessary parts from the vite config to make the test runner work
const { resolve } = viteConfig;

export default {
  browsers: [playwrightLauncher({ product: 'chromium' })],
  files: ['./src/**/*.spec.ts'],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  plugins: [vitePlugin({ resolve }) as any],
} satisfies TestRunnerConfig;
