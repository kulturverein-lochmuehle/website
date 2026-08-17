import { defineCollection } from 'astro:content';
import { sveltiaLoader } from 'astro-loader-sveltia-cms/loader';
import { file } from 'astro/loaders';
import { z } from 'astro/zod';

import { chronicle as chronicleCollection } from './collections/chronicle.collection.js';
import { pages as pagesCollection } from './collections/pages.collection.js';
import { navigation as navigationSingleton } from './collections/navigation.singleton.js';

// The CMS config written by the integration prefixes every path with the
// package folder, because Sveltia resolves them against the repository root.
// The loaders however run from the Astro root, so they get the raw collections.
const chronicle = defineCollection({ loader: sveltiaLoader(chronicleCollection) });
const pages = defineCollection({ loader: sveltiaLoader(pagesCollection) });
const navigation = defineCollection({
  loader: file(navigationSingleton.file),
  schema: z.array(z.object({ useSections: z.boolean(), page: z.string() })),
});

export const collections = { chronicle, pages, navigation };
