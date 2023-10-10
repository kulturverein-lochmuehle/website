import { defineConfig } from 'astro/config';

import lit from '@astrojs/lit';
import mdx from '@astrojs/mdx';
import netlify from '@astrojs/netlify/functions';

// https://astro.build/config
export default defineConfig({
  integrations: [lit(), mdx()],
  output: 'server',
  adapter: netlify(),
  // vite: {
  //   optimizeDeps: {
  //     include: ['@kvlm/ui']
  //   },
  //   ssr: {
  //     noExternal: ['@kvlm/ui']
  //   },
  //   build: {
  //     rollupOptions: {
  //         external: [/^@kvlm\/ui/]
  //     }
  //   }
  // }
});
