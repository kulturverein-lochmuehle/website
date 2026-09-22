import { vitePlugin } from '@remcovaes/web-test-runner-vite-plugin';
import type { TestRunnerConfig } from '@web/test-runner';
import { playwrightLauncher } from '@web/test-runner-playwright';

import litCss from '../scripts/vite-plugin-lit-css.js';

export default {
  browsers: [playwrightLauncher({ product: 'chromium' })],
  files: ['./src/**/*.spec.ts'],
  plugins: [
    vitePlugin({
      // there is no vite.config.ts in this package, so the plugin that turns
      // the component sheets into lit styles has to be handed over here
      plugins: [litCss()],
      optimizeDeps: {
        entries: ['src/**/*.test.ts'],
        exclude: ['@web/test-runner-commands'],
      },
    }),
  ],
} satisfies TestRunnerConfig;
