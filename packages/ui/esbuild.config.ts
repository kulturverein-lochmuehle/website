import { resolve } from 'node:path';
import { parseArgs } from 'node:util';

import autoprefixer from 'autoprefixer';
import { build, type BuildOptions, context } from 'esbuild';
import copyStaticFiles from 'esbuild-copy-static-files';
import { sassPlugin, type SassPluginOptions } from 'esbuild-sass-plugin';
import postcss from 'postcss';
import postcssPresetEnv from 'postcss-preset-env';

import { barrelsbyPlugin } from './esbuild-barrelsby.plugin.js';

import BREAKPOINTS from './breakpoints.json' assert { type: 'json' };
import MANIFEST from './package.json' assert { type: 'json' };

// inject some global sass variables
const precompile = (source: string, path: string): string => {
  if (path.endsWith('breakpoint.variables.scss')) {
    const breakpoints = Object.entries(BREAKPOINTS).reduce(
      (acc, [key, value]) => `${acc}  ${key}: ${value}px,\n`,
      '\n'
    );
    return source.replace(/(\$breakpoints:\s+\()(\);)/, `$1${breakpoints}$2`);
  }
  return source;
};

// resolve @ imports in sass
const importMapper = (path: string): string => {
  if (path.includes('node_modules')) return path;
  if (path.includes('@')) return resolve(path.replace(/^.*@\/?/, './src/'));
  return path;
};

// add postcss to sass transformer
const transform = async (source: string): Promise<string> => {
  const { css } = await postcss([autoprefixer, postcssPresetEnv({ stage: 0 })]).process(source, {
    from: source
  });
  return css;
};

// will load suffixed paths as strings inline to be used in web components
export const inlineOptions: SassPluginOptions = {
  type: 'css-text',
  filter: /\.component\.scss$/,
  precompile,
  importMapper,
  transform
};

// will transform the given SCSS files into CSS files
export const globalOptions: SassPluginOptions = {
  type: 'css',
  precompile,
  importMapper,
  transform
};

// parse cli arguments
const {
  values: { port = '3500', watch }
} = parseArgs({
  options: {
    port: { type: 'string', short: 'p' },
    watch: { type: 'boolean', short: 'w' }
  }
});

// prepare common build options
const options: BuildOptions = {
  sourceRoot: 'src',
  entryPoints: [
    // manifest (to be copied)
    'src/custom-elements.json',
    // bundle library
    'src/index.ts',
    'src/fonts.scss',
    'src/globals.scss',
    // bundle preview
    'src/preview.ts',
    'src/preview.scss',
    'src/preview.config.json'
  ],
  outdir: 'dist',
  format: 'esm',
  platform: 'browser',
  bundle: true,
  metafile: true,
  minify: true,
  treeShaking: true,
  sourcemap: watch ? 'both' : false,
  loader: {
    '.html': 'copy',
    '.json': 'copy',
    '.md': 'copy',
    '.png': 'dataurl',
    '.ttf': 'file',
    '.woff': 'file',
    '.woff2': 'file'
  },
  logLevel: 'error',
  banner: {
    js: `// prepare global namespace
if (!window.kvlm) window.kvlm = {};

// set kvlm version globally
if (window.kvlm.version !== undefined && window.kvlm.version !== '${MANIFEST.version}') {
  console.warn('[kvlm] ${
    MANIFEST.version
  }: Another version (' + window.kvlm.version + ') has already been loaded.');
} else window.kvlm.version = '${MANIFEST.version}';

// set breakpoints globally
window.kvlm.breakpoints = {
${Object.entries(BREAKPOINTS).reduce((acc, [key, value]) => `${acc}  ${key}: ${value},\n`, '')}};
`
  },
  plugins: [
    barrelsbyPlugin({ configPath: '.barrelsby.json', addMissingJsExtensions: true }),

    copyStaticFiles({ src: 'src/preview.html', dest: 'dist/index.html' }),
    copyStaticFiles({ src: 'docs', dest: 'dist/docs', recursive: true }),
    copyStaticFiles({ src: 'README.md', dest: 'dist/docs/introduction.md' }),

    sassPlugin(inlineOptions),
    sassPlugin(globalOptions)
  ]
};

if (watch) {
  // start dev server in watch mode
  const reloadBanner = `
    // reload page on file change
    if (typeof EventSource !== 'undefined') {
      new EventSource('/esbuild').addEventListener('message', () => window.location.reload());
    }
  `;
  const ctx = await context({
    ...options,
    banner: { js: `${options.banner?.js ?? ''}\n${reloadBanner}` }
  });
  await ctx.watch();
  await ctx.serve({ servedir: 'dist', port: Number(port) });

  // notify user
  const url = `http://127.0.0.1:${port}/`;
  console.info(`> Preview: \x1b[4m${url}\x1b[0m\n\n`);
} else {
  await build(options);
}
