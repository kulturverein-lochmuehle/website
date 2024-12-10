/* eslint-disable import/no-nodejs-modules */
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import type { Plugin } from 'esbuild';

import pkg from './package.json' with { type: 'json' };

export type ReactCustomElementsPluginOptions = {
  fileName: string;
  importModule: string;
};

const pluginName = 'esbuild-plugin-react-lit-element';
const pattern = /@customElement\(['"](.+)['"]\)[\n\s\S]*class\s+(\w+)\s+extends\s+LitElement/m;

export function reactLitElementPlugin({
  fileName = 'components.d.ts',
  importModule = pkg.name,
}: Partial<ReactCustomElementsPluginOptions> = {}): Plugin {
  return {
    name: pluginName,
    setup(build) {
      const components = new Map<string, string>();

      build.onLoad({ filter: /\.[j|t]sx?$/ }, async ({ path }) => {
        const source = await readFile(path, 'utf8');
        if (!pattern.test(source)) return;
        const [_, tagName, className] = source.match(pattern) ?? [];
        components.set(tagName, className);
        return undefined;
      });

      build.onEnd(async () => {
        console.info(`> found ${components.size} lit elements`);
        const { outdir = 'dist' } = build.initialOptions;
        const path = resolve(outdir, fileName);
        const entries = Array.from(components.entries());
        const content = `
import type { DetailedHTMLProps, HTMLAttributes } from 'react';
import type { ${entries.map(([, k]) => k).join(', ')} } from '${importModule}';

declare global {
  type IntrinsicElement<E> = DetailedHTMLProps<HTMLAttributes<E>, E>;
  namespace JSX {
    interface IntrinsicElements {
${entries.map(([k, v]) => `      '${k}': IntrinsicElement<typeof ${v}>;`).join('\n')}
    }
  }
}

export {};
`;
        await writeFile(path, content, 'utf8');
        console.info(`> wrote ${outdir}/${fileName}`);
      });
    },
  };
}
