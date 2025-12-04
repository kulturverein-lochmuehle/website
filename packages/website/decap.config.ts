import { parseConfig } from 'astro-decap-collection';
import type { CmsCollection, CmsConfig } from 'decap-cms-core';

// const pages = await loadDecapConfig('src/collections/pages.collection.yml');
// console.log({ pages });
const definitions = import.meta.glob('./src/collections/*.collection.yml', {
  query: '?raw',
  import: 'default',
});

const collections = await Object.values(definitions).reduce(
  async (acc, collection) => {
    const raw = await collection();
    const config = await parseConfig(raw as string);
    return [...(await acc), ...(config?.collections ?? [])];
  },
  Promise.resolve([] as CmsCollection[]),
);

export const config: CmsConfig = {
  locale: 'de',

  backend: { name: 'git-gateway', squash_merges: true, branch: 'next' },
  // https://decapcms.org/docs/working-with-a-local-git-repository/#configure-the-decap-cms-proxy-server-port-number
  local_backend: { url: 'http://localhost:4320/api/v1' },

  // https://decapcms.org/docs/manual-initialization/
  load_config_file: false,

  media_folder: 'packages/website/public/media',
  public_folder: 'packages/website/public/media',
  publish_mode: 'editorial_workflow',

  collections,
};
