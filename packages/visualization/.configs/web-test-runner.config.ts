import { vitePlugin } from '@remcovaes/web-test-runner-vite-plugin';
import type { TestRunnerConfig } from '@web/test-runner';
import { playwrightLauncher } from '@web/test-runner-playwright';

export default {
  // a port of its own: the workspace's test runs side by side, and two on one
  // port - the runner's 8000 each - fail the second
  port: 8001,
  // the views are baked afresh in every season and compared, twelve bakes of
  // the whole model: longer than the runner's two minutes on a slow machine
  testsFinishTimeout: 600000,
  browsers: [playwrightLauncher({ product: 'chromium' })],
  files: ['./src/**/*.spec.ts'],
  plugins: [
    vitePlugin({
      optimizeDeps: {
        entries: ['src/**/*.spec.ts'],
        exclude: ['@web/test-runner-commands'],
      },
    }),
  ],
} satisfies TestRunnerConfig;
