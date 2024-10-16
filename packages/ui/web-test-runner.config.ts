import { litSsrPlugin } from '@lit-labs/testing/web-test-runner-ssr-plugin.js';
import { esbuildPlugin } from '@web/dev-server-esbuild';
import type { TestRunnerConfig } from '@web/test-runner';
import { playwrightLauncher } from '@web/test-runner-playwright';

export default {
  browsers: [playwrightLauncher({ product: 'chromium' })],
  files: ['./src/**/*.spec.ts'],
  nodeResolve: true,
  plugins: [esbuildPlugin({ ts: true }), litSsrPlugin()],
  preserveSymlinks: true,
  staticLogging: true,
  testFramework: { config: { timeout: 60000 } },
} satisfies TestRunnerConfig;
