import { defineConfig } from 'astro/config';

// import lit from '@astrojs/lit';
import mdx from '@astrojs/mdx';
import netlify from '@astrojs/netlify';
import react from '@astrojs/react';

// https://astro.build/config
export default defineConfig({
  integrations: [mdx(), react({ exclude: ['**/*.tsx'] })],
  output: 'server',
  adapter: netlify({}),
  devToolbar: { enabled: false },
  server: { port: 4321 }
});
