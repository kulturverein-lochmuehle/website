import autoprefixer from 'autoprefixer';
import postcss from 'postcss';
import postcssPresetEnv from 'postcss-preset-env';

import { build } from 'esbuild';
import { clean } from 'esbuild-plugin-clean';
import { copy } from 'esbuild-plugin-copy';
import { minifyHTMLLiteralsPlugin } from 'esbuild-plugin-minify-html-literals';
import { sassPlugin, type SassPluginOptions } from 'esbuild-sass-plugin';

const sassPluginOptions: SassPluginOptions = {
  async transform(source) {
    const plugins = [autoprefixer, postcssPresetEnv({ stage: 0 })];
    const { css } = await postcss(plugins).process(source, { from: source });
    return css;
  }
};

const isWatchMode = process.argv.includes('--watch');

build({
  bundle: true,
  entryPoints: ['src/index.ts'],
  format: 'esm',
  incremental: true,
  minify: !isWatchMode,
  outdir: 'dist',
  sourcemap: isWatchMode,
  splitting: true,
  treeShaking: true,
  watch: isWatchMode,
  write: true,

  plugins: [
    clean({ patterns: ['./dist'] }),
    minifyHTMLLiteralsPlugin(),
    copy({
      resolveFrom: 'cwd',
      assets: [
        {
          from: ['./src/config.json'],
          to: ['./dist/config.json']
        },
        {
          from: ['./src/index.html'],
          to: ['./dist/index.html']
        },
        {
          from: ['./src/assets/*'],
          to: ['./dist/assets']
        }
      ]
    }),
    sassPlugin({
      ...sassPluginOptions,
      filter: /index.scss$/,
      type: 'css'
    }),
    sassPlugin({
      ...sassPluginOptions,
      type: 'css-text'
    })
  ]
});
