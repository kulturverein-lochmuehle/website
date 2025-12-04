import { reference, z } from 'astro:content';

export const schema = z.object({
  pages: z
    .array(
      z.object({
        page: reference('pages').describe('Seite'),
        useSections: z.boolean().nullish().default(false).describe('Abschnitte verwenden'),
      }),
    )
    .describe('Seiten'),
});
