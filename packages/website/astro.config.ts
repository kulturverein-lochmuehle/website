import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import netlify from '@astrojs/netlify';
import react from '@astrojs/react';
import { viteStaticCopy } from 'vite-plugin-static-copy';

import { clientSlot } from './src/integrations/client-slot.integration.js';

// https://astro.build/config
export default defineConfig({
  integrations: [mdx(), react({ experimentalReactChildren: true }), clientSlot()],
  output: 'server',
  adapter: netlify(),
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
      }),
    ],
    resolve: { alias: { '@': new URL('./src', import.meta.url).pathname } },
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
