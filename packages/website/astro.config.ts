import { defineConfig } from 'astro/config';

import lit from '@astrojs/lit';
import mdx from '@astrojs/mdx';
import netlify from '@astrojs/netlify/functions';

// https://astro.build/config
export default defineConfig({
  integrations: [lit(), mdx()],
  build: {
    format: 'file'
  },
  output: 'server',
  adapter: netlify()
});
