/// <reference types="vite/client" />

declare module '@remcovaes/web-test-runner-vite-plugin' {
  import type { TestRunnerCoreConfig, TestRunnerPlugin } from '@web/test-runner-core';
  import type { UserConfig } from 'vite';

  export function vitePlugin(config?: UserConfig): TestRunnerPlugin;
  export const removeViteLogging: TestRunnerCoreConfig['filterBrowserLogs'];
}
