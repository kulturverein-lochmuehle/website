import { readdir, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { AstroIntegration } from 'astro';

export const ROUTE_SIZES_FILE = 'routes.json';

/** The deployed pages are served with a trailing slash, the router's keys are not. */
const stripTrailingSlash = (path: string) => path.replace(/(.)\/$/, '$1');

async function* walk(directory: string): AsyncGenerator<string> {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      yield* walk(path);
    } else if (entry.name === 'index.html') {
      yield path;
    }
  }
}

/**
 * Writes what each route weighs, so the router can say how far a navigation
 * has come instead of only that one is happening.
 *
 * The `Content-Length` of the response cannot serve: static hosts send html
 * gzipped, so the header counts encoded bytes while `response.body` hands out
 * decoded ones - 6.5 KB against 39 KB on this site, a ratio of 595% - and no
 * browser api reports the encoded count. At build time the number is simply
 * the size of the file. The map costs a few bytes per route and is fetched
 * once, after the page has gone idle.
 *
 * `public/routes.json` holds an empty map, so the dev server answers the same
 * url with the same content type instead of letting the catch-all route 404 on
 * it. The build copies it like any other public file and this step writes over
 * it - measuring the dev server's pages would be wrong anyway, they carry its
 * own scripts.
 */
export function routeSizes(): AstroIntegration {
  let base = '/';

  return {
    name: 'kvlm:route-sizes',
    hooks: {
      'astro:config:done': ({ config }) => {
        base = config.base;
      },

      'astro:build:done': async ({ dir, logger }) => {
        const root = fileURLToPath(dir);

        const sizes: Record<string, number> = {};
        for await (const file of walk(root)) {
          // `dist/kontakt/index.html` is served as `<base>/kontakt`
          const route = file.slice(root.length).replace(/index\.html$/, '');
          const { size } = await stat(file);
          sizes[stripTrailingSlash(`${stripTrailingSlash(base)}/${route}`)] = size;
        }

        await writeFile(join(root, ROUTE_SIZES_FILE), JSON.stringify(sizes), 'utf8');
        logger.info(`measured ${Object.keys(sizes).length} routes into ${ROUTE_SIZES_FILE}`);
      },
    },
  };
}
