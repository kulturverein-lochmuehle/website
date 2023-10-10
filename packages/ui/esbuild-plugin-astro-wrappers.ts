import { basename, dirname, join, parse, relative, resolve } from 'node:path';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import type { Plugin } from 'esbuild';
import { existsSync } from 'node:fs';

type PluginOptions = {
  /**
   * The filter to be used to match files to have wrappers generated for.
   * @default /\.component\.ts$/
   */
  filter: string | RegExp;

  /**
   * Defines the output of the generated wrappers.
   * If omitted, the wrappers will be written to the esbuild `outdir` directory.
   */
  outdir: string;

  /**
   * Do not flatten the output but keep the structure of the input files.
   * @default true
   */
  keepStructure: boolean;

  /**
   * The suffix to be removed from the component class name to generate the wrapper name.
   * If omitted, only the extension is removed.
   */
  removeSuffix: string;

  /**
   * An optional suffix to be added to the wrapper file names.
   */
  addSuffix: string;
};

export function astroWrappersPlugin({
  filter = /\.component\.ts$/,
  keepStructure = true,
  addSuffix = '',
  removeSuffix,
  ...options
}: Partial<PluginOptions> = {}): Plugin {
  return {
    name: 'esbuild-plugin-astro-wrappers',
    setup(build) {
      const outdir = options.outdir || build.initialOptions.outdir;
      if (outdir === undefined) {
        console.error('esbuild-plugin-astro-wrappers: `outdir` option is required');
        return;
      }

      build.onLoad({ filter: new RegExp(filter) }, async ({ path }) => {
        const contents = await readFile(path, 'utf8');
        const className = contents.match(/export[\n\r\s]+class[\n\r\s]+(\w+)/)?.[1];
        const baseName = basename(path, removeSuffix);
        const wrapperName = `${baseName}${addSuffix}`;

        let subpath = '';
        if (keepStructure) {
          const root = resolve(build.initialOptions.sourceRoot ?? '');
          subpath = dirname(path).substring(root.length);
        }
        const wrapperDir = join(resolve(outdir), subpath);
        const wrapperPath = join(wrapperDir, wrapperName);
        const relativePath = relative(
          wrapperDir,
          join(resolve(build.initialOptions.outdir ?? outdir), subpath)
        );
        const importPath = `${relativePath}/${parse(path).name}.js`;

        if (!existsSync(wrapperDir)) {
          await mkdir(wrapperDir, { recursive: true });
        }
        await writeFile(
          `${wrapperPath}.d.ts`,
          `import type { ${className} } from '${importPath}';
  export default class { constructor(_: Partial<${className}>): ${className} };
`
        );
        await writeFile(
          `${wrapperPath}.js`,
          `import { ${className} } from '${importPath}';
  export default ${className};
`
        );

        return undefined;
      });
    }
  };
}
