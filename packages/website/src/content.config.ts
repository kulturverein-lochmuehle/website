import { defineCollection } from 'astro:content';
import { file, glob } from 'astro/loaders';
import { z } from 'astro/zod';

import { calendar, calendarEvent } from './loaders/calendar.loader.js';

// Frontmatter stays flat and scalar, every structure lives in the body.
const pages = defineCollection({
  loader: glob({ base: './src/content/pages', pattern: '**/*.mdoc' }),
  schema: z.object({
    title: z.string(),
    // pages without sections are wrapped in one, themed by this
    theme: z.enum(['light', 'dark']).default('dark'),
  }),
});

// entries are named `<yyyy>-<mm>-<dd>-<slug>`, the way the git based
// CMSs generate them, and the slug avoids umlauts to stay url safe
const chronicle = defineCollection({
  loader: glob({ base: './src/content/chronicle', pattern: '**/*.mdoc' }),
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

// opt in with `KVLM_CALENDAR_URL`, the events stay empty otherwise
const events = defineCollection({
  loader: calendar({ url: process.env['KVLM_CALENDAR_URL'] }),
  schema: calendarEvent,
});

export const collections = { chronicle, events, navigation, pages };
