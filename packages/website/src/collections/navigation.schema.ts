import { z } from 'astro:content';

export const schema = z.object({
  pages: z
    .array(
      z.object({
        page: z.string().describe('Page'),
        useSections: z.boolean().nullish().default(false).describe('Use Sections'),
      }),
    )
    .describe('Pages'),
});
