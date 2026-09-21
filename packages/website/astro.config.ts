import { defineConfig } from 'astro/config';

// https://astro.build/config
export default defineConfig({
  output: 'static',
  devToolbar: { enabled: false },
  server: { port: 4321 },
  vite: {
    // resolve aliases
    resolve: { alias: { '@': new URL('./src', import.meta.url).pathname } },
  },
});
