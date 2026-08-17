import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sveltia from 'astro-loader-sveltia-cms';
import node from '@astrojs/node';
import { viteStaticCopy } from 'vite-plugin-static-copy';

import { clientSlot } from './src/integrations/client-slot.integration.js';
import type { ViteUserConfig } from 'astro';
import { chronicle } from './src/collections/chronicle.collection.js';
import { pages } from './src/collections/pages.collection.js';
import { navigation } from './src/collections/navigation.singleton.js';

// https://astro.build/config
export default defineConfig({
  integrations: [
    mdx(),
    clientSlot(),
    sveltia({
      config: {
        backend: {
          name: 'github',
          repo: 'kulturverein-lochmuehle/website',
          branch: 'next',
        },
        media_folder: 'packages/website/public',
        public_folder: '/',
        collections: [chronicle, pages].map(collection => ({
          ...collection,
          folder: `packages/website/${collection.folder}`,
        })),
        singletons: [{ ...navigation, file: `packages/website/${navigation.file}` }],
      },
    }),
  ],
  output: 'static',
  adapter: node({ mode: 'standalone' }),
  devToolbar: { enabled: false },
  server: { port: 4321 },
  vite: {
    define: { global: 'window' },
    plugins: [
      viteStaticCopy({
        targets: [
          {
            src: 'node_modules/@kvlm/ui/dist/*',
            dest: 'ui',
          },
        ],
      }) as NonNullable<ViteUserConfig['plugins']>[number],
    ],
    // resolve aliases
    resolve: { alias: { '@': new URL('./src', import.meta.url).pathname } },
    // proxy dev server
    server: {
      proxy:
        import.meta.env.MODE === 'development'
          ? {
              '/esbuild': {
                target: 'http://localhost:3500',
                changeOrigin: true,
              },
              '/ui': {
                target: 'http://localhost:3500',
                changeOrigin: true,
                rewrite: path => path.replace(/^\/ui/, ''),
              },
            }
          : {},
    },
  },
});
