/// <reference types="node" />

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

/**
 * Reads the Decap CMS configuration and provides a schema for the normalized collections.
 * This schema can then be used to configure the Astro collections.
*/

// in order to use the config utils from Decap CMS, we need to mock some globals first
(globalThis as any).window = {
  document: { createElement: () => ({}) },
  navigator: { userAgent: 'Node.js' },
  history: { pushState: () => {}, replaceState: () => {} },
  location: { href: 'http://localhost', replace: () => {} },
  localStorage: { getItem() {}, setItem() {} },
  URL: { createObjectURL: URL.createObjectURL } as any,
};

const { parseConfig, normalizeConfig } = await import('decap-cms-core/dist/esm/actions/config.js');

const { values } = parseArgs({ options: {config: {type: 'string', short: 'c'}} })
const { config: configPath = fileURLToPath(new URL('../public/admin/config.yml', import.meta.url)) } = values;

const configRaw = await readFile(configPath, 'utf8');
const config = normalizeConfig(parseConfig(configRaw));
console.log(config);
