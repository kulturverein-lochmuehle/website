// ships CJS style typings (`export =`) within an ESM package,
// which breaks the default import of the plugin factory
declare module 'vite-plugin-lit-css' {
  import type { Plugin } from 'vite';

  export interface Options {
    include?: string | RegExp | (string | RegExp)[];
    exclude?: string | RegExp | (string | RegExp)[];
    engine?: 'lit' | 'lit-element' | 'fast' | { css: string; package: string; dtsType?: string };
    dts?: boolean;
  }

  export default function litCss(options?: Options): Plugin;
}

declare module '@remcovaes/web-test-runner-vite-plugin' {
  import type { TestRunnerCoreConfig, TestRunnerPlugin } from '@web/test-runner-core';
  import type { UserConfig } from 'vite';

  export function vitePlugin(config?: UserConfig): TestRunnerPlugin;
  export const removeViteLogging: TestRunnerCoreConfig['filterBrowserLogs'];
}
