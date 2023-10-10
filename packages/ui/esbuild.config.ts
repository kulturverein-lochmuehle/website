import { createServer, request as httpRequest } from 'node:http';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';

import { type BuildOptions, build, context } from 'esbuild';
import { sassPlugin } from 'esbuild-sass-plugin';

import glob from 'fast-glob';
import autoprefixer from 'autoprefixer';
import postcss from 'postcss';
// import postcssPresetEnv from 'postcss-preset-env';

import { browserSyncPlugin } from './esbuild-plugin-browser-sync.js';
import { astroWrappersPlugin } from './esbuild-plugin-astro-wrappers.js';

// apply postcss with autoprefixer in sass
const transform = async (source: string): Promise<string> => {
  const { css } = await postcss([autoprefixer /*postcssPresetEnv({ stage: 0 })*/]).process(source, {
    from: source
  });
  return css;
};

// resolve @ imports in sass
const importMapper = (path: string): string => {
  if (path.includes('node_modules')) return path;
  if (path.includes('@')) return resolve(path.replace(/^.*@\/?/, './src/'));
  return path;
};

// parse cli arguments
const {
  values: { ci = false, port: targetPort = '3500', watch }
} = parseArgs({
  options: {
    ci: { type: 'boolean' },
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
  external: ['lit*'],
  outdir: 'dist',
  format: 'esm',
  bundle: true,
  metafile: true,
  minify: true,
  treeShaking: true,
  // external: ['lit*'],
  sourcemap: 'both',
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
    sassPlugin({
      type: 'css-text',
      filter: /\.component\.scss$/,
      importMapper,
      transform
    }),
    sassPlugin({
      type: 'css',
      importMapper,
      transform
    }),
    astroWrappersPlugin({
      filter: /\.component\.ts$/,
      removeSuffix: '.component.ts',
      outdir: 'astro',
    }),
  ]
};

if (watch) {
  try {
    const bannerJs = ` if (typeof EventSource !== 'undefined') { new EventSource('/esbuild').addEventListener('change', () => location.reload()) }`;
    const green = (message: string) => (ci ? message : `\u001b[32m${message}\u001b[0m`);
    const grey = (message: string) => (ci ? message : `\u001b[90m${message}\u001b[0m`);
    const cyan = (message: string) => (ci ? message : `\u001b[36m${message}\u001b[0m`);

    // start dev server in watch mode
    const ctx = await context({
      ...options,
      banner: { js: bannerJs },
      plugins: [
        ...(options.plugins ?? []),
        browserSyncPlugin({
          logLevel: 'silent',
          logPrefix: 'KVLM',
          logSnippet: false,
          codeSync: false,
          reloadOnRestart: false,
          injectChanges: false,
          single: true,
          ghostMode: {
            clicks: true,
            forms: true,
            // @ts-expect-error this seems not to be typed properly
            location: true,
            scroll: true
          },
          onReady(sync) {
            const syncPort = sync.getOption('ui').get('port');
            const syncUrl = `http://0.0.0.0:${syncPort}`;
            console.clear();
            console.info(grey('  KVLM'));
            console.info(`${green('>')} Browser Sync UI started at ${cyan(syncUrl)}`);
          }
        })
      ]
    });
    await ctx.watch();
    const { host: hostname, port } = await ctx.serve({ servedir: 'dist' });

    // use proxy for SPA
    // https://esbuild.github.io/api/#serve-proxy
    createServer((request, response) => {
      const { url, method, headers } = request;
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const path = ~url!.split('/').pop()!.indexOf('.') || url === '/esbuild' ? url : '/index.html';

      request.pipe(
        httpRequest({ hostname, port, path, method, headers }, proxyReponse => {
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          response.writeHead(proxyReponse.statusCode!, proxyReponse.headers);
          proxyReponse.pipe(response, { end: true });
        }),
        { end: true }
      );
    }).listen(targetPort);

    // notify user
    console.info(`${green('>')} Server started at ${cyan(`http://${hostname}:${port}`)}`);
    console.info(`${green('>')} Proxy started at ${cyan(`http://${hostname}:${targetPort}`)}`);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
} else {
  await build(options);
  process.exit(0);
}
