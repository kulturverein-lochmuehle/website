import { globSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { dirname, extname, relative, resolve } from 'node:path';
import { argv } from 'node:process';
import { fileURLToPath } from 'node:url';

import { customElementExamplesPlugin } from '@webcomponents-preview/cem-plugin-examples';
import { customElementGenerateReadmesPlugin } from '@webcomponents-preview/cem-plugin-generate-readmes';
import { customElementGroupingPlugin } from '@webcomponents-preview/cem-plugin-grouping';
import autoprefixer from 'autoprefixer';
import dts from 'unplugin-dts/vite';
import { defineConfig } from 'vite';
import createManifestPlugin from 'vite-plugin-cem';
import { checker } from 'vite-plugin-checker';
import litCss from 'vite-plugin-lit-css';
import { viteStaticCopy } from 'vite-plugin-static-copy';
import topLevelAwait from 'vite-plugin-top-level-await';

import MANIFEST from '../package.json' with { type: 'json' };
import BREAKPOINTS from './breakpoints.json' with { type: 'json' };
import { reloadStories } from './vite-reload-stories.plugin.js';

// inject some global sass variables
const sassBreakpoints = `$breakpoints: (
${Object.entries(BREAKPOINTS).reduce((acc, [key, value]) => `${acc}  ${key}: ${value}px,\n`, '')});
`;
const jsBreakpoints = `window.kvlm.breakpoints = { ${Object.entries(BREAKPOINTS).reduce((acc, [key, value]) => `${acc}${key}: ${value}, `, '')}};`;

await writeFile(
  resolve(import.meta.dirname, '../src/styles/variables/breakpoint.variables.scss'),
  `// THIS LINE WILL BE REPLACED BY THE BUILD SCRIPT
// TO FEED IN THE GLOBALLY DEFINED BREAKPOINTS!
${sassBreakpoints}
`,
  'utf-8'
);

export default defineConfig(({ command }) => {
  const isWatchMode = argv.includes('--watch');
  const isWatchBuild = command === 'build' && isWatchMode;

  return {
    base: './',
    // CSS vendor prefixes
    css: { postcss: { plugins: [autoprefixer] } },
    build: {
      emptyOutDir: !isWatchBuild,
      minify: false,
      target: 'esnext',
      cssCodeSplit: true,
      rollupOptions: {
        external: [/^@?lit(-\w+)?($|\/.+)/],
        treeshake: false,
        output: {
          globals: { lit: 'lit' },
          intro: `
// prepare global namespace
if (!window.kvlm) window.kvlm = {};
if (!window.kvlm.ui) window.kvlm.ui = {};

// set kvlm version globally
if (window.kvlm.ui.version !== undefined && window.kvlm.ui.version !== '${MANIFEST.version}') {
  console.warn(\`[kvlm] ${
    MANIFEST.version
  }: Another version (\${window.kvlm.ui.version}) has already been loaded.\`);
} else window.kvlm.ui.version = '${MANIFEST.version}';

// set breakpoints globally
${jsBreakpoints}
`,
          // organize output
          chunkFileNames: 'chunks/[name].js',
          assetFileNames: () => '[name][extname]',
          entryFileNames: () => '[name].js',
        },
      },
      lib: {
        entry: {
          // add a preview app
          index: './index.html',

          // add the global styles
          globals: './src/globals.scss',
          fonts: './src/fonts.scss',

          // create an entry point for each component
          ...Object.fromEntries(
            globSync('./src/**/*.{component,utils}.ts').map(file => [
              // remove `src/` as well as the file extension from each
              // file, so e.g. src/nested/foo.ts becomes nested/foo
              relative('src', file.slice(0, file.length - extname(file).length)),
              // expand the relative paths to absolute paths, so e.g.
              // src/nested/foo.ts becomes /project/src/nested/foo.ts
              fileURLToPath(new URL(`../${file}`, import.meta.url)),
            ])
          ),
        },
        formats: ['es'],
      },
    },
    plugins: [
      // lint and type check
      checker({
        typescript: true,
        eslint: { lintCommand: 'lint', useFlatConfig: true },
      }),
      // create custom elements manifest
      createManifestPlugin({
        lit: true,
        files: ['./src/**/*.component.ts', './src/**/EXAMPLES.md'],
        plugins: [
          customElementExamplesPlugin(),
          customElementGenerateReadmesPlugin({
            addInlineReadme: true,
            transformer: 'wca',
            outputPath(path) {
              if (path === undefined) {
                return '';
              }
              return resolve(dirname(path), 'README.md');
            },
          }),
          customElementGroupingPlugin({
            addGroups(componentPath) {
              const [, , group] = componentPath?.split('/') || [];
              return [group] as [string];
            },
          }),
        ],
      }),
      // handle css imports in lit components
      litCss({
        include: ['src/components/**/*.scss'],
      }),
      // ssl for local dev server to use secure APIs
      // mkcert() // wont work for netlify dev reverse proxy
      // netlify environment uses a target not supporting tla
      topLevelAwait(),
      // generate typings for entry points
      dts({
        entryRoot: 'src',
        include: globSync(['./src/**/*.{component,utils}.ts', 'src/vite-env.d.ts']),
      }),
      // reload stories when they change
      reloadStories('./src/**/EXAMPLES.md'),
      // copy static files to dist
      viteStaticCopy({
        targets: [
          // copy readme to dist docs
          {
            src: './README.md',
            dest: './docs/',
            rename: 'introduction.md',
          },
          // copy preview config
          {
            src: './.configs/preview.config.json',
            rename: (...[, , filePath]) => filePath.split('.configs/')[1] as string,
            dest: './',
          },
          // copy runtime dependencies
          {
            dereference: true,
            src: globSync(
              `./node_modules/{${Object.keys(MANIFEST.peerDependencies).concat(['@lit', 'lit-element', 'lit-html']).join(',')}}/**/*`
            ),
            rename: (...[, , filePath]) => filePath.split('node_modules/')[1] as string,
            dest: './libs/',
          },
        ],
      }),
    ],
    optimizeDeps: { esbuildOptions: { target: 'esnext' } },
  };
});
