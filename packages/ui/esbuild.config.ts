/* eslint-disable no-console */
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';

import { type BuildOptions, build, context } from 'esbuild';
import { sassPlugin, type SassPluginOptions } from 'esbuild-sass-plugin';

import glob from 'fast-glob';
import autoprefixer from 'autoprefixer';
import postcss from 'postcss';
import postcssPresetEnv from 'postcss-preset-env';

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
  importMapper,
  transform
};

// will transform the given SCSS files into CSS files
export const globalOptions: SassPluginOptions = {
  type: 'css',
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

// we bundle each individual element as well
const singleElements = await glob('src/*/**/!(*.spec).ts', { onlyFiles: true, unique: true });

// prepare common build options
const options: BuildOptions = {
  sourceRoot: 'src',
  entryPoints: [
    // bundle each element
    ...singleElements,
    // bundle library
    'src/index.ts',
    'src/index.scss',
    // bundle preview
    'src/index.html',
    'src/preview.ts',
    'src/preview.config.json'
  ],
  outdir: 'dist',
  format: 'esm',
  bundle: true,
  metafile: true,
  minify: true,
  treeShaking: true,
  sourcemap: watch ? 'both' : false,
  loader: {
    '.html': 'copy',
    '.json': 'copy',
    '.md': 'copy',
    '.png': 'file',
    '.jpg': 'file',
    '.jpeg': 'file',
    '.ttf': 'file',
    '.woff': 'file',
    '.woff2': 'file'
  },
  logLevel: watch ? 'info' : 'error',
  plugins: [sassPlugin(inlineOptions), sassPlugin(globalOptions)]
};

if (watch) {
  const bannerJs = ` if (typeof EventSource !== 'undefined') { new EventSource('/esbuild').addEventListener('change', () => location.reload(true)) }`;

  // start dev server in watch mode
  const ctx = await context({ ...options, banner: { js: bannerJs } });
  await ctx.watch();
  await ctx.serve({ servedir: 'dist', port: Number(port) });
} else {
  await build(options);
}
