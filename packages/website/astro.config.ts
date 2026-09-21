import markdoc from '@astrojs/markdoc';
import { defineConfig } from 'astro/config';

// The deploy workflow passes both, locally the project page defaults apply.
const site = process.env.SITE ?? 'https://kulturverein-lochmuehle.github.io';
const base = process.env.BASE ?? '/website';

// https://astro.build/config
export default defineConfig({
  site,
  base,
  output: 'static',
  // the title of the start page is set in three lines by design
  integrations: [markdoc({ allowHTML: true })],
  devToolbar: { enabled: false },
  server: { port: 4321 },
  vite: {
    // resolve aliases
    resolve: { alias: { '@': new URL('./src', import.meta.url).pathname } },
  },
});
