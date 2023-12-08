import { existsSync, watch as watchFile } from 'node:fs';
import { resolve } from 'node:path';
import { readFile, writeFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';

import { type BuildOptions, build, context } from 'esbuild';
import { sassPlugin, type SassPluginOptions } from 'esbuild-sass-plugin';
import { dtsPlugin } from 'esbuild-plugin-d.ts';

import glob from 'fast-glob';
import autoprefixer from 'autoprefixer';
import postcss from 'postcss';
import postcssPresetEnv from 'postcss-preset-env';

import { createServer } from './esbuild.server.js';
import { barrelsbyPlugin } from './esbuild-barrelsby.plugin.js';
import { dtsAliasesPlugin } from './esbuild-declaration-aliases.plugin.js';

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
  logLevel: 'error',
  plugins: [
    barrelsbyPlugin({ configPath: '.barrelsby.json', addMissingJsExtensions: true }),
    dtsPlugin(),
    dtsAliasesPlugin({ tsConfigPath: 'tsconfig.types.json' }),

    sassPlugin(inlineOptions),
    sassPlugin(globalOptions)
  ]
};

if (watch) {
  // start dev server in watch mode
  const internalPort = 28487;
  const server = createServer(internalPort, true);
  const manifestPath = resolve(options.outdir!, 'custom-elements.json');

  // prepare context and start watching
  const ctx = await context({
    ...options,
    banner: {
      js: `${server.reloadBanner('wcp-hot-reload', `http://127.0.0.1:${port}`)}\n${
        options.banner?.js ?? ''
      }`
    }
  });
  await ctx.watch();
  await ctx.serve({ servedir: options.outdir, port: internalPort });

  // prepare dev server
  server.listen(Number(port), async () => {
    // notify user
    const url = `http://127.0.0.1:${port}/`;
    // eslint-disable-next-line no-console
    console.info(` > Preview: \x1b[4m${url}\x1b[0m\n\n`);

    // as the docs are maybe not ready yet, touch the target already
    if (!existsSync(manifestPath)) await writeFile(manifestPath, '{}', 'utf-8');
    watchFile(manifestPath, async () => {
      const manifest = await readFile(manifestPath, 'utf-8');
      server.respond(manifest);
    });
  });
} else {
  await build(options);
}
