import type { TestRunnerConfig } from '@web/test-runner';
import { playwrightLauncher } from '@web/test-runner-playwright';
import { esbuildPlugin } from '@web/dev-server-esbuild';
import { litSsrPlugin } from '@lit-labs/testing/web-test-runner-ssr-plugin.js';

export default {
  testFramework: { config: { timeout: 60000 } },
  nodeResolve: true,
  preserveSymlinks: true,
  staticLogging: true,
  files: ['./src/**/*.spec.ts'],
  browsers: [playwrightLauncher({ product: 'chromium' })],
  plugins: [esbuildPlugin({ ts: true }), litSsrPlugin()]
} satisfies TestRunnerConfig;
