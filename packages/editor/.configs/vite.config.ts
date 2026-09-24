import { defineConfig } from 'vite';

import litCss from '../scripts/vite-plugin-lit-css.js';

export default defineConfig({
  // next to the website's 4321, as the root's dev fan out lists them
  server: { port: 4322, strictPort: true },
  // the component sheets are lit styles, not page styles
  plugins: [litCss()],
  // the preview's worker imports the model as modules, as the page does
  worker: { format: 'es' },
});
