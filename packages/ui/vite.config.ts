import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import autoprefixer from 'autoprefixer';
import { defineConfig } from 'vite';
import banner from 'vite-plugin-banner';
import { checker } from 'vite-plugin-checker';
import { viteStaticCopy } from 'vite-plugin-static-copy';
import topLevelAwait from 'vite-plugin-top-level-await';

import BREAKPOINTS from './breakpoints.json' with { type: 'json' };
import MANIFEST from './package.json' with { type: 'json' };

// inject some global sass variables
const sassBreakpoints = `$breakpoints: (
${Object.entries(BREAKPOINTS).reduce((acc, [key, value]) => `${acc}  ${key}: ${value}px,\n`, '')});
`;
const jsBreakpoints = `window.kvlm.breakpoints = {
${Object.entries(BREAKPOINTS).reduce((acc, [key, value]) => `${acc}  ${key}: ${value},\n`, '')}};
`;

await writeFile(
  './src/styles/variables/breakpoint.variables.scss',
  `// THIS LINE WILL BE REPLACED BY THE BUILD SCRIPT
// TO FEED IN THE GLOBALLY DEFINED BREAKPOINTS!
${sassBreakpoints}
`,
  'utf-8',
);

export default defineConfig({
  base: './',
  // CSS vendor prefixes
  css: { postcss: { plugins: [autoprefixer] } },
  plugins: [
    // lint and type check
    checker({
      typescript: true,
      eslint: { lintCommand: 'lint', useFlatConfig: true },
    }),
    // ssl for local dev server to use secure APIs
    // mkcert() // wont work for netlify dev reverse proxy
    // netlify environment uses a target not supporting tla
    topLevelAwait(),
    // copy static files to dist
    viteStaticCopy({
      targets: [
        {
          src: './README.md',
          dest: './docs/',
          rename: 'introduction.md',
        },
      ],
    }),
    // @ts-expect-error -- types are incorrect
    banner(`// prepare global namespace
if (!window.kvlm) window.kvlm = {};

// set kvlm version globally
if (window.kvlm.version !== undefined && window.kvlm.version !== '${MANIFEST.version}') {
  console.warn('[kvlm] ${
    MANIFEST.version
  }: Another version (' + window.kvlm.version + ') has already been loaded.');
} else window.kvlm.version = '${MANIFEST.version}';

// set breakpoints globally
${jsBreakpoints}
`),
  ],
  server: {
    proxy: {
      // s. nginx.conf, requires docker stack running locally, or at least the database and api services
      // → docker compose --env-file .env.local up --build --force-recreate --no-deps -d
      // '/api': 'http://localhost:5332',
      '/api': {
        target: 'http://localhost:5332/api',
        changeOrigin: true,
        rewrite: path => path.replace(/^\/api/, ''),
      },
    },
  },
  resolve: {
    // some convenient short-hands for importing modules or styles
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '~': fileURLToPath(new URL('./node_modules', import.meta.url)),
    },
  },
  optimizeDeps: { esbuildOptions: { target: 'esnext' } },
});
