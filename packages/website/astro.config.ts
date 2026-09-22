import markdoc from '@astrojs/markdoc';
import { defineConfig } from 'astro/config';
import { loadEnv } from 'vite';
import litCss from '../ui/scripts/vite-plugin-lit-css.js';
import { routeSizes } from './integrations/route-sizes.integration.js';

// the content loaders and the teaser read `process.env`, which knows nothing
// about `.env` files - so they are merged in before anything runs. The file
// belongs to the workspace, not to this package, and bun only loads it when a
// command starts at the root
const root = new URL('../..', import.meta.url).pathname;
Object.assign(process.env, loadEnv(process.env.NODE_ENV ?? 'development', root, 'KVLM_'));

// The deploy workflow passes both, locally the project page defaults apply.
const site = process.env.SITE ?? 'https://kulturverein-lochmuehle.github.io';
const base = process.env.BASE ?? '/website';

// https://astro.build/config
export default defineConfig({
  site,
  base,
  output: 'static',
  // the styles are what a page needs before anything else, a request of
  // their own would be a white screen long - they stay in the document
  build: { inlineStylesheets: 'always' },
  // the title of the start page is set in three lines by design
  integrations: [markdoc({ allowHTML: true }), routeSizes()],
  devToolbar: { enabled: false },
  server: { port: 4321 },
  vite: {
    // lightningcss folds `animation-timeline` into the `animation`
    // shorthand, which no browser accepts - esbuild leaves it alone
    build: { cssMinify: 'esbuild' },
    // resolve aliases
    resolve: { alias: { '@': new URL('./src', import.meta.url).pathname } },
    // the component sheets are lit `css` templates, not page styles
    plugins: [litCss()],
  },
});
