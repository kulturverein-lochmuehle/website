import type { Config } from '@stencil/core';
import { sass } from '@stencil/sass';
import { postcss } from '@stencil/postcss';
import autoprefixer from 'autoprefixer';
// import nodePolyfills from 'rollup-plugin-node-polyfills';

const isProduction = process.env.NODE_ENV === 'production';

// https://stenciljs.com/docs/config
export const config: Config = {
  devServer: {
    openBrowser: false,
  },
  globalStyle: 'src/styles/global.scss',
  namespace: 'kvlm',
  outputTargets: [
    {
      copy: [
        {
          src: 'browserconfig.xml',
        },
        {
          src: 'manifest.json',
        },
        {
          src: 'protocols.json',
        },
        {
          src: 'docs',
        },
        {
          src: 'pages',
        },
        {
          src: `config.${isProduction ? 'prod' : 'dev'}.json`,
          dest: 'config.json',
        },
        {
          src: '../node_modules/typeface-muli/files/muli-latin-400.*',
          dest: 'assets/fonts/muli',
        },
      ],
      dir: 'dist/www',
      serviceWorker: null,
      // comment the following line to disable service workers in production
      type: 'www',
    },
  ],
  plugins: [sass(), postcss({ plugins: [autoprefixer] })],
  // rollupPlugins: { after: [nodePolyfills()] },
  taskQueue: 'async',
  tsconfig: 'tsconfig.www.json',
};
