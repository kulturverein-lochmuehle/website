import { readFile } from 'node:fs/promises';
import { type BrowserSyncInstance, type Options, create } from 'browser-sync';
import type { Plugin } from 'esbuild';

type PluginOptions = Options & { onReady?: (instance: BrowserSyncInstance) => void };

export function browserSyncPlugin(options?: Partial<PluginOptions>): Plugin {
  const sync = create();

  return {
    name: 'esbuild-plugin-browser-sync',
    setup(build) {
      build.onStart(() => {
        if (sync.active) return;
        sync.init(options);
        options?.onReady && options.onReady(sync);
      });

      build.onLoad({ filter: /\.html$/ }, async ({ path }) => {
        // prepare snippet from template
        const tpl = await readFile((sync as any).instance.config.templates.scriptTag);
        const port = sync.getOption('port');
        const version = sync.getOption('version');
        const async = sync.getOption('snippetOptions').get('async') ? 'async' : '';
        const script = `http://HOST:${port}/browser-sync/browser-sync-client.js?v=${version}`;
        const snippet = `${tpl}`.replace('%async%', async).replace('%script%', script);

        // inject snippet
        const html = await readFile(path);
        const contents = `${html}`.replace('</body>', `${snippet}</body>`);

        // pass to copy loader
        return { contents, loader: 'copy' };
      });
    }
  };
}
