import { defineConfig } from 'astro/config';

import lit from '@astrojs/lit';
import netlify from '@astrojs/netlify/functions';

// https://astro.build/config
export default defineConfig({
  integrations: [lit()],
  build: { format: 'file' },
  output: 'server',
  adapter: netlify()
});
