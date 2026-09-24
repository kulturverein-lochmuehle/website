import { vitePlugin } from '@remcovaes/web-test-runner-vite-plugin';
import type { TestRunnerConfig } from '@web/test-runner';
import { playwrightLauncher } from '@web/test-runner-playwright';

export default {
  // a port of its own: the workspace's test runs side by side, and two on one
  // port - the runner's 8000 each - fail the second
  port: 8001,
  // with the views baked afresh from the whole model and compared - which on
  // a slow machine takes longer than the runner's two minutes
  testsFinishTimeout: 600000,
  browsers: [playwrightLauncher({ product: 'chromium' })],
  // that comparison is `test:views`, which names its file: the rest is quick
  files: ['./src/**/*.spec.ts', '!./src/**/*.baked.spec.ts'],
  plugins: [
    vitePlugin({
      optimizeDeps: {
        entries: ['src/**/*.spec.ts'],
        exclude: ['@web/test-runner-commands'],
      },
    }),
  ],
} satisfies TestRunnerConfig;
