import { vitePlugin } from '@remcovaes/web-test-runner-vite-plugin';
import type { TestRunnerConfig } from '@web/test-runner';
import { playwrightLauncher } from '@web/test-runner-playwright';

export default {
  browsers: [playwrightLauncher({ product: 'chromium' })],
  files: ['./src/**/*.spec.ts'],
  plugins: [vitePlugin()],
} satisfies TestRunnerConfig;
