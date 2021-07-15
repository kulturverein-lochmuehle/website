import {Config} from '@stencil/core';
import {postcss} from '@stencil/postcss';
import {sass} from '@stencil/sass';
import autoprefixer from 'autoprefixer';

// https://stenciljs.com/docs/config

export const config: Config = {
  devServer: {
    openBrowser: false,
  },
  globalStyle: 'src/styles/global.scss',
  namespace: 'kvlm',
  outputTargets: [
    {
      type: 'www',
      dir: 'dist',
      copy: [{
        src: '../node_modules/typeface-spartan/files',
        dest: 'assets/fonts/spartan'
      }],
      serviceWorker: null,
    },
  ],
  plugins: [
    sass(),
    postcss({plugins: [autoprefixer]}),
  ],
  taskQueue: 'async',
};
