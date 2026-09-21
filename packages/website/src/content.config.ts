import { defineCollection } from 'astro:content';
import { file, glob } from 'astro/loaders';
import { z } from 'astro/zod';

// Frontmatter stays flat and scalar, every structure lives in the body.
const pages = defineCollection({
  loader: glob({ base: './src/content/pages', pattern: '**/*.mdoc' }),
  schema: z.object({
    title: z.string(),
    // pages without sections are wrapped in one, themed by this
    theme: z.enum(['light', 'dark']).default('dark'),
  }),
});

const chronicle = defineCollection({
  loader: glob({ base: './src/content/chronicle', pattern: '**/*.md' }),
  schema: z.object({
    title: z.string(),
    date: z.date(),
    teaser: z.string(),
    // skeletons of entries still to be written
    draft: z.boolean().default(false),
  }),
});

const navigation = defineCollection({
  loader: file('./src/content/navigation/navigation.yml'),
  // one entry per group, e.g. `main` and `footer`
  schema: z.array(
    z.object({
      page: z.string(),
      useSections: z.boolean().default(false),
    }),
  ),
});

export const collections = { chronicle, navigation, pages };
