import { defineCollection } from 'astro:content';
import { file, glob } from 'astro/loaders';
import { z } from 'astro/zod';

// Schemas land in step 4 of the plan; the loaders only replace the
// removed Sveltia loader so the content stays readable meanwhile.
const chronicle = defineCollection({
  loader: glob({ base: './src/content/chronicle', pattern: '**/*.md' }),
});
const pages = defineCollection({
  loader: glob({ base: './src/content/pages', pattern: '**/*.md' }),
});
const navigation = defineCollection({
  loader: file('./src/content/navigation/navigation.yml'),
  schema: z.array(z.object({ useSections: z.boolean(), page: z.string() })),
});

export const collections = { chronicle, pages, navigation };
