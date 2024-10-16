#!/usr/bin/env ts-node
/* eslint-disable import/no-nodejs-modules */

import { dirname, resolve } from 'node:path';

import { customElementExamplesPlugin } from '@webcomponents-preview/cem-plugin-examples';
import { customElementGenerateReadmesPlugin } from '@webcomponents-preview/cem-plugin-generate-readmes';
import { customElementGroupingPlugin } from '@webcomponents-preview/cem-plugin-grouping';

export default {
  packagejson: true,
  litelement: true,
  globs: ['src/components/**/*.component.{scss,ts}', 'src/components/**/EXAMPLES.md'],
  outdir: 'src',
  plugins: [
    customElementExamplesPlugin(),
    customElementGenerateReadmesPlugin({
      addInlineReadme: true,
      transformer: 'wca',
      outputPath(path) {
        if (path === undefined) return '';
        return resolve(dirname(path), 'README.md');
      },
    }),
    customElementGroupingPlugin({
      addGroups(componentPath) {
        const [, , group] = componentPath?.split('/') || [];
        return [group];
      },
    }),
  ],
};
