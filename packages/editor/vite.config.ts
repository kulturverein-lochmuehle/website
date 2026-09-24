import { defineConfig } from 'vite';

import litCss from './scripts/vite-plugin-lit-css.js';

export default defineConfig({
  // the component sheets are lit styles, not page styles
  plugins: [litCss()],
});
